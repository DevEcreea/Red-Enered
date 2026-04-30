#!/usr/bin/env python3
"""
Upload all local files under backend/uploads/ to Cloudflare R2.
Reads R2_* env vars (or backend/.env if present).
Usage:
    cd /app && python scripts/migrate_uploads_to_r2.py
"""
import os
import sys
from pathlib import Path

# Load backend/.env if available so we share creds with the running backend.
try:
    from dotenv import load_dotenv
    env_path = Path(__file__).resolve().parent.parent / "backend" / ".env"
    if env_path.exists():
        load_dotenv(env_path)
except ImportError:
    pass

import boto3
from botocore.config import Config

ROOT = Path(__file__).resolve().parent.parent
UPLOADS = ROOT / "backend" / "uploads"


def _client():
    for k in ("R2_ACCESS_KEY_ID", "R2_SECRET_ACCESS_KEY", "R2_ENDPOINT", "R2_BUCKET"):
        if not os.environ.get(k):
            print(f"[ERROR] missing env var {k}", file=sys.stderr)
            sys.exit(1)
    return boto3.client(
        "s3",
        endpoint_url=os.environ["R2_ENDPOINT"],
        aws_access_key_id=os.environ["R2_ACCESS_KEY_ID"],
        aws_secret_access_key=os.environ["R2_SECRET_ACCESS_KEY"],
        region_name="auto",
        config=Config(signature_version="s3v4"),
    )


MIME_BY_EXT = {
    ".pdf":  "application/pdf",
    ".xml":  "application/xml",
    ".png":  "image/png",
    ".jpg":  "image/jpeg",
    ".jpeg": "image/jpeg",
    ".webp": "image/webp",
    ".svg":  "image/svg+xml",
}


def main() -> int:
    if not UPLOADS.exists():
        print(f"No uploads dir at {UPLOADS}")
        return 0
    s3 = _client()
    bucket = os.environ["R2_BUCKET"]
    n_ok = n_err = 0
    total_bytes = 0
    for path in UPLOADS.rglob("*"):
        if not path.is_file():
            continue
        rel = path.relative_to(UPLOADS).as_posix()
        ctype = MIME_BY_EXT.get(path.suffix.lower(), "application/octet-stream")
        try:
            with open(path, "rb") as fh:
                s3.put_object(Bucket=bucket, Key=rel, Body=fh.read(), ContentType=ctype)
            size = path.stat().st_size
            total_bytes += size
            n_ok += 1
            print(f"  ok   {rel}  ({size} bytes, {ctype})")
        except Exception as e:
            n_err += 1
            print(f"  ERR  {rel}: {e}", file=sys.stderr)
    print()
    print(f"Migrated {n_ok} files ({total_bytes/1024/1024:.2f} MB) to R2 bucket {bucket!r}")
    if n_err:
        print(f"Errors: {n_err}")
        return 1
    return 0


if __name__ == "__main__":
    sys.exit(main())
