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
    if s in ("CALIDAD", "TIPO_DE_COMBUSTIBLE", "PRODUCTO", "COMBUSTIBLE"):
        s = "COMBUSTIBLE"
    if s in ("UNIDAD_DE_MEDIDA", "UNIDAD"):
        s = "UNIDAD"
    if s in ("DEPARTAMENTO", "DEPTO", "DEP"):
        s = "DEPARTAMENTO"
    if s in ("PROVINCIA", "PROV"):
        s = "PROVINCIA"
    if s in ("DISTRITO", "DIST"):
        s = "DISTRITO"
    if s in ("PRECIO_VENT", "PRECIO", "VENTA", "PRECIO_FINAL", "PRECIO_ENERED"):
        s = "PRECIO_VENTA"
    return s


def _parse_number(v) -> Optional[float]:
    if v is None or v == "":
        return None
    try:
        # Need to replace the longer string 'S/.' first, before 'S/'
        s = str(v).upper().replace("S/.", "").replace("S/", "").replace("S.", "").replace("S", "").replace(",", "").strip()
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
        # Intento de coincidencia ignorando espacios y mayúsculas
        target = tab_name.strip().upper()
        for w in sh.worksheets():
            if w.title.strip().upper() == target:
                ws = w
                break
        
        # Fallbacks si no se encontró el tab con el nombre exacto ni ignorando espacios
        if ws is None:
            for variant in ["Hoja1", "Hoja 1", "Sheet1", "Sheet 1"]:
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
            raw_fecha = str(norm["FECHA"]).strip()
            if re.match(r"^\d{4}[-/]", raw_fecha):
                norm["FECHA"] = pd.to_datetime(raw_fecha).date().isoformat()
            else:
                norm["FECHA"] = pd.to_datetime(raw_fecha, dayfirst=True).date().isoformat()
        except Exception:
            norm["FECHA"] = str(norm.get("FECHA", ""))

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

async def sync_precios_to_mongo(db):
    """Sync the PRECIOS tab from Google Sheets."""
    sheet_id = os.environ.get("GOOGLE_SHEETS_ID")
    if not sheet_id:
        raise RuntimeError("GOOGLE_SHEETS_ID no configurado en .env")

    tab = os.environ.get("GOOGLE_SHEETS_TAB_PRECIOS", "PRECIOS")
    started_at = datetime.now(timezone.utc)
    
    try:
        records, actual_tab = await fetch_rows(sheet_id, tab)
    except Exception as e:
        return {"ok": False, "error": str(e)}

    normalized = []
    current_empresa = ""
    
    for r in records:
        # Normalize keys
        norm = {}
        for k, v in r.items():
            key = _normalize_col(k)
            if key:
                norm[key] = v
                
        # Handle merged cells for Empresa: if it's empty, use the previous one
        empresa_val = str(norm.get("EMPRESA", r.get("EMPRESA", ""))).strip()
        if empresa_val:
            current_empresa = empresa_val
        else:
            # If there's no Empresa column at all, default to GENERAL
            if "EMPRESA" not in norm:
                current_empresa = "GENERAL"
            elif not current_empresa:
                current_empresa = "GENERAL"
        
        departamento = str(norm.get("DEPARTAMENTO", r.get("DEPARTAMENTO", r.get("DEP", "")))).strip()
        provincia = str(norm.get("PROVINCIA", r.get("PROVINCIA", r.get("PROV", "")))).strip()
        distrito = str(norm.get("DISTRITO", r.get("DISTRITO", r.get("DIST", "")))).strip()
        ciudad = str(norm.get("CIUDAD", r.get("CIUDAD", ""))).strip()
        combustible = str(norm.get("COMBUSTIBLE", r.get("COMBUSTIBLE", ""))).strip()
        estacion = str(norm.get("ESTACION", r.get("ESTACION", ""))).strip()
        
        # We need at least one valid price to insert
        precio_venta = _parse_number(norm.get("PRECIO_VENTA"))
        if precio_venta is None:
            precio_venta = _parse_number(norm.get("ENERED"))
        if precio_venta is None:
            # Look for ANY column that might be a price
            for k, v in norm.items():
                if "PRECIO" in k or "B5" in k or "B20" in k:
                    parsed = _parse_number(v)
                    if parsed is not None and parsed > 0 and parsed < 50: # valid price range per galon
                        precio_venta = parsed
                        break
            
        precio_pizarra = _parse_number(norm.get("PRECIO_PIZARRA"))
        if precio_pizarra is None:
            precio_pizarra = _parse_number(norm.get("PIZARRA"))

        if not estacion and not combustible:
            continue
            
        if precio_venta is None:
            continue
            
        normalized.append({
            "id": str(uuid.uuid4()),
            "empresa": current_empresa,
            "departamento": departamento,
            "provincia": provincia,
            "distrito": distrito,
            "ciudad": ciudad,
            "estacion": estacion,
            "combustible": combustible,
            "precio_venta": precio_venta,
            "precio_pizarra": precio_pizarra,
            "updated_at": datetime.now(timezone.utc).isoformat()
        })

    # Deduplicate normalized list by (empresa, estacion, ciudad, combustible)
    dedup = {}
    for item in normalized:
        key = (
            item["empresa"].strip().upper(),
            item["estacion"].strip().upper(),
            item["ciudad"].strip().upper(),
            item["combustible"].strip().upper()
        )
        dedup[key] = item
    final_normalized = list(dedup.values())

    # Update DB
    if final_normalized:
        await db.precios.delete_many({})
        await db.precios.insert_many(final_normalized)

    return {
        "ok": True,
        "tab": actual_tab,
        "rows_inserted": len(final_normalized),
        "started_at": started_at.isoformat(),
        "finished_at": datetime.now(timezone.utc).isoformat(),
    }
