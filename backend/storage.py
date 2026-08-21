"""
Abstract storage backend for ENERED.

Two backends:
- "r2" (Cloudflare R2 / S3-compatible) — used in production. Activated when
  R2_ACCESS_KEY_ID + R2_SECRET_ACCESS_KEY + R2_ENDPOINT + R2_BUCKET are set.
- "local" — fallback for local development. Stores files under /app/backend/uploads/.

Public API:
    save_object(key, data, content_type) -> str (returns the key)
    get_object_bytes(key) -> bytes
    delete_object(key)
    object_exists(key) -> bool
    download_response(key, filename, content_type) -> FastAPI Response
        (uses RedirectResponse to presigned URL on R2; FileResponse on local)
"""
from __future__ import annotations

import io
import os
import logging
from pathlib import Path
from typing import Optional

logger = logging.getLogger("enered.storage")

ROOT_DIR = Path(__file__).parent
LOCAL_BASE = ROOT_DIR / "uploads"


def _backend() -> str:
    if (
        os.environ.get("R2_ACCESS_KEY_ID")
        and os.environ.get("R2_SECRET_ACCESS_KEY")
        and os.environ.get("R2_ENDPOINT")
        and os.environ.get("R2_BUCKET")
    ):
        return "r2"
    return "local"


# --------------------------------------------------------------------------
# R2 / S3 client (lazy)
# --------------------------------------------------------------------------
_r2_client = None


def _get_r2():
    global _r2_client
    if _r2_client is None:
        import boto3
        from botocore.config import Config
        _r2_client = boto3.client(
            "s3",
            endpoint_url=os.environ["R2_ENDPOINT"],
            aws_access_key_id=os.environ["R2_ACCESS_KEY_ID"],
            aws_secret_access_key=os.environ["R2_SECRET_ACCESS_KEY"],
            region_name="auto",
            config=Config(signature_version="s3v4"),
        )
    return _r2_client


def _bucket() -> str:
    return os.environ["R2_BUCKET"]


# --------------------------------------------------------------------------
# Public API
# --------------------------------------------------------------------------
def save_object(key: str, data: bytes, content_type: str = "application/octet-stream") -> str:
    """Save raw bytes to storage at the given key. Returns the key."""
    backend = _backend()
    if backend == "r2":
        _get_r2().put_object(
            Bucket=_bucket(),
            Key=key,
            Body=data,
            ContentType=content_type,
        )
        logger.info(f"[R2] saved {key} ({len(data)} bytes)")
    else:
        path = LOCAL_BASE / key
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_bytes(data)
        logger.info(f"[LOCAL] saved {path} ({len(data)} bytes)")
    return key


def get_object_bytes(key: str) -> bytes:
    """Read bytes from storage. Raises FileNotFoundError if missing."""
    backend = _backend()
    if backend == "r2":
        try:
            r = _get_r2().get_object(Bucket=_bucket(), Key=key)
            return r["Body"].read()
        except Exception as e:
            raise FileNotFoundError(f"R2 object not found: {key} ({e})")
    else:
        path = LOCAL_BASE / key
        if not path.exists():
            raise FileNotFoundError(str(path))
        return path.read_bytes()


def delete_object(key: str) -> None:
    """Delete an object. Silently ignores if not present."""
    backend = _backend()
    if backend == "r2":
        try:
            _get_r2().delete_object(Bucket=_bucket(), Key=key)
        except Exception as e:
            logger.warning(f"[R2] delete failed {key}: {e}")
    else:
        path = LOCAL_BASE / key
        try:
            if path.exists():
                path.unlink()
        except Exception:
            pass


def object_exists(key: str) -> bool:
    backend = _backend()
    if backend == "r2":
        try:
            _get_r2().head_object(Bucket=_bucket(), Key=key)
            return True
        except Exception:
            return False
    else:
        return (LOCAL_BASE / key).exists()

def list_keys(prefix: str = "") -> list:
    """List every object key under a prefix (one bucket scan; cache the result
    when you need to match many filenames against the same prefix)."""
    backend = _backend()
    if backend == "r2":
        try:
            keys = []
            paginator = _get_r2().get_paginator('list_objects_v2')
            for page in paginator.paginate(Bucket=_bucket(), Prefix=prefix):
                for obj in page.get('Contents', []):
                    keys.append(obj['Key'])
            return keys
        except Exception:
            return []
    else:
        try:
            base = LOCAL_BASE / prefix if prefix else LOCAL_BASE
            return [str(p.relative_to(LOCAL_BASE)).replace("\\", "/")
                    for p in base.rglob("*") if p.is_file()]
        except Exception:
            return []


def find_by_suffix(suffix: str, prefix: str = "") -> Optional[str]:
    """Search for the first object matching a suffix (case-insensitive)."""
    backend = _backend()
    if backend == "r2":
        try:
            paginator = _get_r2().get_paginator('list_objects_v2')
            for page in paginator.paginate(Bucket=_bucket(), Prefix=prefix):
                for obj in page.get('Contents', []):
                    if obj['Key'].lower().endswith(suffix.lower()):
                        return obj['Key']
            return None
        except Exception:
            return None
    else:
        try:
            for p in LOCAL_BASE.rglob("*"):
                if p.is_file() and p.name.lower().endswith(suffix.lower()):
                    return str(p.relative_to(LOCAL_BASE)).replace("\\", "/")
        except Exception:
            pass
        return None


def presigned_url(key: str, ttl: int = 3600, filename: Optional[str] = None,
                  content_type: Optional[str] = None) -> str:
    """Generate a temporary URL for direct download.
    Only valid on R2 backend; on local returns a relative path (callers must
    handle that case explicitly via download_response)."""
    if _backend() != "r2":
        raise RuntimeError("presigned_url only available on R2 backend")
    params: dict = {"Bucket": _bucket(), "Key": key}
    if filename:
        params["ResponseContentDisposition"] = f'attachment; filename="{filename}"'
    if content_type:
        params["ResponseContentType"] = content_type
    return _get_r2().generate_presigned_url(
        "get_object",
        Params=params,
        ExpiresIn=ttl,
    )


def download_response(key: str, filename: str, content_type: str = "application/octet-stream", inline: bool = True):
    """Returns a FastAPI response that lets the client view/download the object.

    On R2: streams the bytes through the backend (avoids cross-origin redirect
    + R2 CORS issues with XHR/blob downloads).
    On local: FileResponse from disk.
    """
    from fastapi import HTTPException
    disposition_type = "inline" if inline else "attachment"
    backend = _backend()
    if backend == "r2":
        try:
            data = get_object_bytes(key)
        except FileNotFoundError:
            raise HTTPException(status_code=404, detail="archivo no encontrado en R2")
        from fastapi.responses import Response
        return Response(
            content=data,
            media_type=content_type,
            headers={"Content-Disposition": f'{disposition_type}; filename="{filename}"'},
        )
    else:
        from fastapi.responses import FileResponse
        path = LOCAL_BASE / key
        if not path.exists():
            raise HTTPException(status_code=404, detail="archivo no encontrado en disco")
        return FileResponse(
            path=str(path),
            filename=filename,
            media_type=content_type,
            headers={"Content-Disposition": f'{disposition_type}; filename="{filename}"'}
        )

def stream_object(key: str) -> io.BytesIO:
    """Get the object as a BytesIO stream (for in-memory processing)."""
    return io.BytesIO(get_object_bytes(key))


def list_keys(prefix: str = "") -> list[str]:
    """List all object keys under the given prefix."""
    backend = _backend()
    if backend == "r2":
        out: list[str] = []
        token = None
        while True:
            kw = {"Bucket": _bucket(), "Prefix": prefix, "MaxKeys": 1000}
            if token:
                kw["ContinuationToken"] = token
            r = _get_r2().list_objects_v2(**kw)
            for obj in r.get("Contents", []):
                out.append(obj["Key"])
            if r.get("IsTruncated"):
                token = r.get("NextContinuationToken")
            else:
                break
        return out
    else:
        base = LOCAL_BASE / prefix
        if not base.exists():
            return []
        return [
            str(p.relative_to(LOCAL_BASE)).replace("\\", "/")
            for p in base.rglob("*")
            if p.is_file()
        ]


def current_backend() -> str:
    """Returns 'r2' or 'local' — useful for /api/health."""
    return _backend()
