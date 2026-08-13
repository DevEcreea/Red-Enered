"""
Diagnóstico ATU — Subsidio del transportista (DU 004).
Consulta las habilitaciones que la ATU reconoce para un RUC y detecta el problema
clave: unidades HABILITADAS en el MTC pero que la ATU muestra SIN TUC (tuc=null o
malformado) => NO serán reconocidas para el subsidio. Ese gap es el gancho comercial.

Dos vías de entrada:
  A) diagnosticar_desde_json(data)      -> se pega la respuesta de la ATU (sin credenciales)
  B) consultar_habilitaciones(token,ruc) -> consulta en vivo con el access_token de sesión ATU
"""
from __future__ import annotations
import re
import os
from typing import Optional

import httpx

# Proxy opcional para llegar a la ATU (usa ATU_PROXY, o cae al MTC_PROXY si no se define).
_ATU_PROXY = os.getenv("ATU_PROXY") or os.getenv("MTC_PROXY") or None

API_BASE = "https://api.atu.gob.pe/api_comprobante"
IAM_BASE = "https://api.atu.gob.pe/api_iam"
HABILITACIONES = API_BASE + "/verificacion/habilitaciones"
DATOS = API_BASE + "/verificacion/datos"
SEMAFORO = API_BASE + "/verificacion/semaforo"
REFRESH = IAM_BASE + "/auth/refresh"
UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120 Safari/537.36"
_ATU_HDRS = {
    "User-Agent": UA,
    "Accept": "application/json, text/plain, */*",
    "Origin": "https://soluciones.atu.gob.pe",
    "Referer": "https://soluciones.atu.gob.pe/",
}

# Un TUC válido tiene forma T-###### (6 dígitos). Malformado => truncado/incompleto.
_TUC_RE = re.compile(r"^T-\d{6}$", re.IGNORECASE)


class AtuError(Exception):
    pass


def _tuc_estado(tuc: Optional[str]) -> str:
    if not tuc or not str(tuc).strip():
        return "sin_tuc"          # tuc=null → la ATU no reconoce la unidad
    if not _TUC_RE.match(str(tuc).strip()):
        return "tuc_malformado"   # tuc incompleto/truncado (ej. "T-5284")
    return "ok"


def diagnosticar(lista: list, ruc: str = "") -> dict:
    """Toma la lista de vehículos de la ATU y arma el diagnóstico."""
    unidades = []
    ok = con_problema = 0
    for v in (lista or []):
        estado = _tuc_estado(v.get("tuc"))
        problema = estado != "ok"
        if problema:
            con_problema += 1
        else:
            ok += 1
        unidades.append({
            "placa": v.get("placa"),
            "categoria": v.get("categoria"),
            "tuc": v.get("tuc"),
            "tuc_estado": estado,                                   # ok | sin_tuc | tuc_malformado
            "numero_autorizacion": v.get("numeroAutorizacion"),
            "estado_autorizacion": v.get("estadoAutorizacionNombre") or v.get("estadoAutorizacion"),
            "tope_galones": v.get("topeGalones"),
            "fuente": v.get("fuente"),
            "problema": problema,
        })
    # ordenar: primero las que tienen problema (para que salten a la vista)
    unidades.sort(key=lambda u: (not u["problema"], u.get("placa") or ""))
    total = len(unidades)
    return {
        "ruc": ruc,
        "total_unidades": total,
        "reconocidas": ok,                 # con TUC válido → sí reciben subsidio
        "con_problema": con_problema,      # sin TUC / TUC malformado → NO reconocidas
        "tiene_problemas": con_problema > 0,
        "unidades": unidades,
    }


def diagnosticar_desde_json(data) -> dict:
    """Acepta la respuesta cruda de la ATU (dict con data.lista, o directamente la lista)."""
    lista = None
    ruc = ""
    if isinstance(data, list):
        lista = data
    elif isinstance(data, dict):
        d = data.get("data") or data
        lista = d.get("lista") if isinstance(d, dict) else None
        if lista is None and isinstance(data.get("lista"), list):
            lista = data["lista"]
        ruc = str(data.get("ruc") or "")
    if not isinstance(lista, list):
        raise AtuError("No se encontró la lista de vehículos en el JSON pegado.")
    return diagnosticar(lista, ruc)


async def consultar_habilitaciones(token: str, ruc: str) -> dict:
    """Consulta en vivo la ATU con el access_token de sesión. Devuelve el diagnóstico."""
    ruc = (ruc or "").strip()
    if not re.fullmatch(r"\d{11}", ruc):
        raise AtuError("El RUC debe tener 11 dígitos")
    token = (token or "").strip()
    if not token:
        raise AtuError("Falta el access_token de la ATU")
    headers = {
        "User-Agent": UA,
        "Accept": "application/json, text/plain, */*",
        "Content-Type": "application/json",
        "Origin": "https://soluciones.atu.gob.pe",
        "Referer": "https://soluciones.atu.gob.pe/",
        "Authorization": f"Bearer {token}",
    }
    cookies = {"access_token": token}
    async with httpx.AsyncClient(timeout=30.0, verify=False, headers=headers, cookies=cookies, proxy=_ATU_PROXY) as client:
        # OJO: el endpoint es POST, con el ruc como parámetro de query (no en el body).
        r = await client.post(HABILITACIONES, params={"ruc": ruc}, content=b"")
        if r.status_code in (401, 403):
            raise AtuError("La ATU rechazó el token (expiró o no autoriza).")
        if r.status_code == 404:
            # El RUC no tiene habilitaciones en el padrón del subsidio.
            return {"ruc": ruc, "total_unidades": 0, "reconocidas": 0, "con_problema": 0,
                    "tiene_problemas": False, "unidades": [], "sin_habilitaciones": True}
        if r.status_code != 200:
            raise AtuError(f"La ATU respondió {r.status_code}")
        try:
            data = r.json()
        except Exception:
            raise AtuError("Respuesta inesperada de la ATU (no es JSON)")
    diag = diagnosticar_desde_json(data)
    diag["ruc"] = ruc
    return diag


async def consultar_semaforo(token: str, ruc: str) -> list:
    """Trae el semáforo de condiciones de la ATU (activo/habido, autorización, TUC…)."""
    headers = {**_ATU_HDRS, "Authorization": f"Bearer {token}"}
    async with httpx.AsyncClient(timeout=25.0, verify=False, headers=headers,
                                 cookies={"access_token": token}, proxy=_ATU_PROXY) as client:
        r = await client.get(SEMAFORO, params={"ruc": ruc})
        if r.status_code in (401, 403):
            raise AtuError("La ATU rechazó el token.")
        if r.status_code != 200:
            return []
        try:
            lista = (r.json().get("data") or {}).get("lista") or []
        except Exception:
            return []
    return lista if isinstance(lista, list) else []


async def refresh_session(refresh_token: str) -> dict:
    """Renueva la sesión ATU con el refresh_token (no requiere reCAPTCHA). Devuelve tokens nuevos."""
    if not refresh_token:
        raise AtuError("Falta el refresh_token")
    hdrs = {**_ATU_HDRS, "Cookie": f"refresh_token={refresh_token}"}
    async with httpx.AsyncClient(timeout=30.0, verify=False, headers=hdrs, proxy=_ATU_PROXY) as client:
        r = await client.post(REFRESH, content=b"")
        if r.status_code not in (200, 204):
            raise AtuError("La sesión ATU expiró; hay que volver a conectar la cuenta.")
        # Leer los tokens nuevos de los Set-Cookie (la ATU puede devolver el mismo nombre
        # en varias rutas, por eso parseamos los headers en vez de usar el cookie-jar).
        new_access = new_refresh = None
        for k, v in r.headers.multi_items():
            if k.lower() != "set-cookie":
                continue
            m = re.match(r"\s*([^=;]+)=([^;]+)", v)
            if not m:
                continue
            name, val = m.group(1).strip(), m.group(2).strip()
            if name == "access_token" and val:
                new_access = val
            elif name == "refresh_token" and val:
                new_refresh = val
    if not new_access or new_access.count(".") != 2:
        raise AtuError("La ATU no devolvió una sesión nueva válida.")
    return {"access_token": new_access, "refresh_token": new_refresh or refresh_token}


async def diagnosticar_con_sesion(session: dict, ruc: str):
    """
    Corre el diagnóstico usando una sesión guardada {access_token, refresh_token}.
    Si el access_token expiró, intenta renovarlo con el refresh y reintenta.
    Devuelve (diagnostico, sesion_actualizada).
    """
    access = (session or {}).get("access_token")
    refresh = (session or {}).get("refresh_token")
    try:
        diag = await consultar_habilitaciones(access, ruc)
        return diag, session
    except AtuError as e:
        msg = str(e).lower()
        if "rechaz" not in msg and "expir" not in msg:
            raise
        if not refresh:
            raise AtuError("La sesión ATU expiró y no hay refresh; vuelve a conectar la cuenta.")
        nuevos = await refresh_session(refresh)
        diag = await consultar_habilitaciones(nuevos["access_token"], ruc)
        return diag, {**(session or {}), **nuevos}
