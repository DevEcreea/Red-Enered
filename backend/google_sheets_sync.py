"""Google Sheets sync for ENERED consumption data."""
import os
import re
import uuid
import asyncio
import unicodedata
from datetime import datetime, timezone
from typing import Optional

import gspread
import pandas as pd
from google.oauth2.service_account import Credentials

SCOPES = [
    "https://www.googleapis.com/auth/spreadsheets.readonly",
    "https://www.googleapis.com/auth/drive.readonly",
]


def _strip_accents(s: str) -> str:
    return "".join(
        c for c in unicodedata.normalize("NFD", s)
        if unicodedata.category(c) != "Mn"
    )


def _normalize_col(name: str) -> str:
    if name is None:
        return ""
    s = str(name).strip().upper()
    s = _strip_accents(s)
    # Remove text in parentheses e.g. "CANTIDAD (GL)" -> "CANTIDAD"
    s = re.sub(r"\s*\([^)]*\)\s*", "", s)
    # Replace non-alphanumeric with underscore
    s = re.sub(r"[^A-Z0-9]+", "_", s)
    s = s.strip("_")
    # Common aliases
    if s in ("CANTIDAD", "GALONES", "CANT", "CANT_GL"):
        s = "CANTIDAD_GL"
    if s in ("IMPORTE", "MONTO", "IMPORTE_TOTAL"):
        s = "IMPORTE_TOTAL"
    if s in ("PRECIO_UNIT", "PRECIO_UNITARIO"):
        s = "PRECIO_UNITARIO"
    if s in ("ESTACION",):
        s = "ESTACION"
    if s in ("UNIDAD_DE_MEDIDA", "UNIDAD"):
        s = "UNIDAD"
    if s in ("NRO_TARJETA", "NRO_DE_TARJETA", "N_TARJETA", "NUMERO_DE_TARJETA"):
        s = "NRO_DE_TARJETA"
    if s in ("MEDIO_DE_IDENTIFICACION", "MEDIO_IDENTIFICACION"):
        s = "MEDIO_DE_IDENTIFICACION"
    if s in ("NOTA_DE_DESPACHO", "NOTA_DESPACHO"):
        s = "NOTA_DE_DESPACHO"
    return s


def _parse_number(v) -> Optional[float]:
    if v is None or v == "":
        return None
    try:
        s = str(v).replace("S/", "").replace("S/.", "").replace(",", "").strip()
        if s == "" or s == "-":
            return None
        return float(s)
    except Exception:
        return None


def _get_client():
    """Authorize gspread using either:
      - GOOGLE_SHEETS_CREDENTIALS_JSON: service-account JSON content as string
        (preferred in production / cloud env vars).
      - GOOGLE_SHEETS_CREDENTIALS_PATH: filesystem path to the JSON file
        (used in local dev).
    """
    import json as _json
    raw = os.environ.get("GOOGLE_SHEETS_CREDENTIALS_JSON")
    if raw and raw.strip().startswith("{"):
        try:
            info = _json.loads(raw)
        except Exception as e:
            raise RuntimeError(f"GOOGLE_SHEETS_CREDENTIALS_JSON no es JSON válido: {e}")
        creds = Credentials.from_service_account_info(info, scopes=SCOPES)
        return gspread.authorize(creds)

    path = os.environ.get("GOOGLE_SHEETS_CREDENTIALS_PATH")
    if path and os.path.exists(path):
        creds = Credentials.from_service_account_file(path, scopes=SCOPES)
        return gspread.authorize(creds)

    raise RuntimeError(
        "Google Sheets no configurado. Define GOOGLE_SHEETS_CREDENTIALS_JSON "
        "(contenido del JSON) o GOOGLE_SHEETS_CREDENTIALS_PATH (ruta al archivo)."
    )


def _fetch_rows_sync(sheet_id: str, tab_name: str):
    """Blocking call — read all rows from the sheet."""
    gc = _get_client()
    sh = gc.open_by_key(sheet_id)
    ws = None
    try:
        ws = sh.worksheet(tab_name)
    except gspread.WorksheetNotFound:
        for variant in [tab_name.strip(), "Hoja1", "Hoja 1", "Sheet1", "Sheet 1"]:
            try:
                ws = sh.worksheet(variant)
                break
            except gspread.WorksheetNotFound:
                continue
    if ws is None:
        available = [w.title for w in sh.worksheets()]
        raise RuntimeError(f"Pestaña '{tab_name}' no encontrada. Disponibles: {available}")

    records = ws.get_all_records(empty2zero=False, default_blank="")
    return records, ws.title


async def fetch_rows(sheet_id: str, tab_name: str):
    return await asyncio.to_thread(_fetch_rows_sync, sheet_id, tab_name)


NUMERIC_FIELDS = [
    "CANTIDAD_GL", "IMPORTE_TOTAL", "AHORRO",
    "PRECIO_UNITARIO", "PRECIO_PIZARRA", "KILOMETRAJE",
]


def normalize_row(raw: dict) -> Optional[dict]:
    """Normalize a raw row from Google Sheets into our consumption schema."""
    if not raw:
        return None

    norm = {}
    for k, v in raw.items():
        key = _normalize_col(k)
        if not key:
            continue
        norm[key] = v

    if not norm.get("EMPRESA") or not norm.get("FECHA"):
        return None

    for f in NUMERIC_FIELDS:
        if f in norm:
            norm[f] = _parse_number(norm[f])

    # Parse date (supports DD/MM/YYYY and ISO)
    if norm.get("FECHA"):
        try:
            norm["FECHA"] = pd.to_datetime(norm["FECHA"], dayfirst=True).date().isoformat()
        except Exception:
            try:
                norm["FECHA"] = pd.to_datetime(norm["FECHA"]).date().isoformat()
            except Exception:
                norm["FECHA"] = str(norm["FECHA"])

    # Normalize string fields (trim)
    for f in ["EMPRESA", "PLACA", "CIUDAD", "ESTACION", "PRODUCTO", "SEMANA", "ESTADO", "FACTURA_ASOCIADA", "NOTA_DE_DESPACHO"]:
        if norm.get(f) is not None:
            norm[f] = str(norm[f]).strip().upper() if f == "ESTADO" else str(norm[f]).strip()

    norm["id"] = str(uuid.uuid4())
    return norm


async def sync_to_mongo(db, mode: str = "replace"):
    """Sync Google Sheets to MongoDB.
    mode: 'replace' (delete all + insert) or 'append' (just insert)
    """
    sheet_id = os.environ.get("GOOGLE_SHEETS_ID")
    tab = os.environ.get("GOOGLE_SHEETS_TAB", "Hoja 1")
    if not sheet_id:
        raise RuntimeError("GOOGLE_SHEETS_ID no configurado en .env")

    started_at = datetime.now(timezone.utc)
    records, actual_tab = await fetch_rows(sheet_id, tab)

    normalized = []
    skipped = 0
    for r in records:
        n = normalize_row(r)
        if n is None:
            skipped += 1
            continue
        normalized.append(n)

    deleted = 0
    if mode == "replace":
        res = await db.consumptions.delete_many({})
        deleted = res.deleted_count

    inserted = 0
    if normalized:
        r = await db.consumptions.insert_many(normalized)
        inserted = len(r.inserted_ids)

    result = {
        "ok": True,
        "mode": mode,
        "tab": actual_tab,
        "rows_read": len(records),
        "rows_inserted": inserted,
        "rows_skipped": skipped,
        "rows_deleted": deleted,
        "started_at": started_at.isoformat(),
        "finished_at": datetime.now(timezone.utc).isoformat(),
    }

    # Store sync status (keep only last 20)
    await db.sheets_sync_log.insert_one({**result, "id": str(uuid.uuid4())})

    return result


async def last_sync_status(db):
    doc = await db.sheets_sync_log.find_one({}, {"_id": 0}, sort=[("finished_at", -1)])
    return doc
