"""
Servicios contratados por empresa + integración Wialon.

Provee:
- get_empresa_servicios(): fetch defensivo con defaults seguros
- encriptar/desencriptar token Wialon (Fernet derivado de JWT_SECRET)
- test_wialon_connection(): valida un token contra la API de Wialon
- backfill_servicios(): migración one-shot que garantiza el campo en todas las empresas
"""
import os
import json
import base64
import hashlib
from typing import Optional

import httpx
from cryptography.fernet import Fernet, InvalidToken


# ---------- Defaults ----------
DEFAULT_SERVICIOS = {
    "plataforma": True,   # base: acceso a la plataforma
    "combustible": True,  # consumo con ENERED (Google Sheets)
    "gps": False,         # monitoreo Wialon
    "subsidio": False,    # expediente DU 004 (Mi Flota + Dashboard Subsidio)
}

DEFAULT_TIPO_CLIENTE = "enered"  # enered | subsidio

DEFAULT_WIALON_HOST = "hst-api.wialon.com"


# ---------- Encriptación del token Wialon (Fernet derivado de JWT_SECRET) ----------
def _fernet() -> Fernet:
    secret = os.environ.get("WIALON_ENCRYPTION_KEY") or os.environ.get("JWT_SECRET", "dev-secret-fallback")
    # Derivamos 32 bytes con SHA-256 y lo codificamos en base64 para Fernet.
    key = base64.urlsafe_b64encode(hashlib.sha256(secret.encode("utf-8")).digest())
    return Fernet(key)


def encrypt_wialon_token(token: str) -> str:
    if not token:
        return ""
    return _fernet().encrypt(token.encode("utf-8")).decode("utf-8")


def decrypt_wialon_token(encrypted: str) -> str:
    if not encrypted:
        return ""
    try:
        return _fernet().decrypt(encrypted.encode("utf-8")).decode("utf-8")
    except (InvalidToken, ValueError):
        return ""


def mask_wialon_token(token: str) -> str:
    """Devuelve solo los primeros 4 y últimos 4 caracteres, resto con asteriscos."""
    if not token:
        return ""
    if len(token) <= 12:
        return "•" * len(token)
    return f"{token[:4]}{'•' * (len(token) - 8)}{token[-4:]}"


# ---------- Servicios por empresa ----------
def _normalize_servicios(raw: Optional[dict]) -> dict:
    """Aplica defaults seguros; nunca devuelve None."""
    if not raw or not isinstance(raw, dict):
        return dict(DEFAULT_SERVICIOS)
    return {
        "plataforma": bool(raw.get("plataforma", True)),
        "combustible": bool(raw.get("combustible", DEFAULT_SERVICIOS["combustible"])),
        "gps": bool(raw.get("gps", DEFAULT_SERVICIOS["gps"])),
        "subsidio": bool(raw.get("subsidio", DEFAULT_SERVICIOS["subsidio"])),
    }


async def get_empresa_servicios(db, empresa: Optional[str]) -> dict:
    """
    Devuelve dict {servicios, tipo_cliente, wialon_configurado (bool)} para una empresa.
    - Si no existe empresa_config: retorna defaults.
    - Si el campo servicios no existe (empresa legacy): defaults = {combustible: true, gps: false}.
    - NUNCA expone el token Wialon al frontend, solo un flag booleano.
    """
    if not empresa:
        return {
            "servicios": dict(DEFAULT_SERVICIOS),
            "tipo_cliente": DEFAULT_TIPO_CLIENTE,
            "wialon_configurado": False,
        }
    cfg = await db.empresas_config.find_one({"empresa": empresa}, {"_id": 0})
    if not cfg:
        return {
            "servicios": dict(DEFAULT_SERVICIOS),
            "tipo_cliente": DEFAULT_TIPO_CLIENTE,
            "wialon_configurado": False,
        }
    wialon_cfg = cfg.get("wialon") or {}
    return {
        "servicios": _normalize_servicios(cfg.get("servicios")),
        "tipo_cliente": cfg.get("tipo_cliente") or DEFAULT_TIPO_CLIENTE,
        "wialon_configurado": bool(wialon_cfg.get("token")),
    }


async def get_empresa_wialon_config(db, empresa: Optional[str]) -> Optional[dict]:
    """Retorna {host, token (decrypted)} o None si no está configurado."""
    if not empresa:
        return None
    cfg = await db.empresas_config.find_one({"empresa": empresa}, {"_id": 0, "wialon": 1})
    if not cfg or not cfg.get("wialon"):
        return None
    w = cfg["wialon"]
    tok_enc = w.get("token") or ""
    tok = decrypt_wialon_token(tok_enc)
    if not tok:
        return None
    return {"host": w.get("host") or DEFAULT_WIALON_HOST, "token": tok}


# ---------- Wialon API ----------
async def test_wialon_connection(token: str, host: str = DEFAULT_WIALON_HOST) -> dict:
    """
    Valida un token de Wialon. Retorna:
      {ok: True, user: "...", total_unidades: N, base_url: "..."} si OK
      {ok: False, error: "..."}                                    si falla
    No lanza excepciones — siempre retorna dict.
    """
    if not token:
        return {"ok": False, "error": "Token vacío"}
    host = (host or DEFAULT_WIALON_HOST).replace("https://", "").replace("http://", "").rstrip("/")
    base = f"https://{host}/wialon/ajax.html"
    try:
        async with httpx.AsyncClient(timeout=15.0) as client:
            # 1) Login
            params = {"svc": "token/login", "params": json.dumps({"token": token})}
            r = await client.get(base, params=params)
            data = r.json()
            if not isinstance(data, dict) or "eid" not in data:
                err = data.get("error") if isinstance(data, dict) else str(data)
                return {"ok": False, "error": f"Login rechazado por Wialon: {err}"}
            sid = data["eid"]
            user_name = (data.get("user") or {}).get("nm") or data.get("au") or ""
            base_url = data.get("base_url") or ""
            # 2) Contar unidades
            search_params = {
                "spec": {
                    "itemsType": "avl_unit",
                    "propName": "sys_name",
                    "propValueMask": "*",
                    "sortType": "sys_name",
                    "propType": "property",
                },
                "force": 1,
                "flags": 1,
                "from": 0,
                "to": 0,
            }
            r2 = await client.get(base, params={
                "svc": "core/search_items",
                "params": json.dumps(search_params),
                "sid": sid,
            })
            d2 = r2.json()
            total = 0
            if isinstance(d2, dict):
                total = int(d2.get("totalItemsCount") or 0)
            return {
                "ok": True,
                "user": user_name,
                "total_unidades": total,
                "base_url": base_url,
                "host": host,
            }
    except httpx.TimeoutException:
        return {"ok": False, "error": "Timeout conectando con Wialon"}
    except Exception as e:
        return {"ok": False, "error": f"Error inesperado: {type(e).__name__}: {e}"}


# ---------- Backfill / migración ----------
async def backfill_servicios(db) -> dict:
    """
    Garantiza que todas las empresas en empresas_config tengan el campo `servicios`
    y `tipo_cliente`. Idempotente: no sobreescribe si ya existe.
    Reglas especiales:
    - Si tipo_cliente=subsidio → activa servicios.subsidio=true
    - Si algún usuario de la empresa tiene role=cliente_subsidio → activa servicios.subsidio=true
    """
    updated = 0
    scanned = 0
    async for cfg in db.empresas_config.find({}, {"_id": 0}):
        scanned += 1
        patch = {}
        current_serv = cfg.get("servicios")
        if not isinstance(current_serv, dict):
            current_serv = dict(DEFAULT_SERVICIOS)
            patch["servicios"] = current_serv
        else:
            # add missing keys (e.g. subsidio recién agregado)
            normalized = _normalize_servicios(current_serv)
            if normalized != current_serv:
                patch["servicios"] = normalized
                current_serv = normalized
        tipo = cfg.get("tipo_cliente") or DEFAULT_TIPO_CLIENTE
        if "tipo_cliente" not in cfg or not cfg.get("tipo_cliente"):
            patch["tipo_cliente"] = tipo
        # Regla: si tipo_cliente=subsidio, asegurar servicios.subsidio=true
        if tipo == "subsidio" and not current_serv.get("subsidio"):
            current_serv = dict(current_serv); current_serv["subsidio"] = True
            patch["servicios"] = current_serv
        # Regla: si algún usuario de esta empresa es cliente_subsidio, activar
        if not current_serv.get("subsidio"):
            u = await db.users.find_one({"empresa": cfg["empresa"], "role": "cliente_subsidio"}, {"_id": 0, "id": 1})
            if u:
                current_serv = dict(current_serv); current_serv["subsidio"] = True
                patch["servicios"] = current_serv
        if patch:
            await db.empresas_config.update_one({"empresa": cfg["empresa"]}, {"$set": patch})
            updated += 1
    return {"scanned": scanned, "updated": updated}
