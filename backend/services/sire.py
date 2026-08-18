"""
Cliente del API SIRE de SUNAT — Registro de Compras Electrónico (RCE).

Trae la "propuesta" mensual: TODOS los comprobantes que le emitieron al contribuyente,
sin que este descargue ni suba nada. Solo LECTURA (lista blanca dura: jamás se llama
aceptar/reemplazar propuesta, que modificarían su registro tributario).

Flujo (asíncrono por diseño de SUNAT):
  token → solicitar exportación (ticket) → esperar → descargar ZIP/CSV → parsear
"""
from __future__ import annotations
import asyncio
import io
import re
import zipfile
from typing import Optional

import httpx

SEGURIDAD = "https://api-seguridad.sunat.gob.pe/v1/clientessol/{client_id}/oauth2/token/"
BASE = "https://api-sire.sunat.gob.pe/v1/contribuyente/migeigv/libros"
UA = {"User-Agent": "Mozilla/5.0", "Accept": "application/json"}


class SireError(Exception):
    pass


async def obtener_token(client_id: str, client_secret: str, ruc: str, usuario: str, clave: str) -> str:
    async with httpx.AsyncClient(timeout=40, headers=UA) as c:
        r = await c.post(SEGURIDAD.format(client_id=client_id),
                         data={"grant_type": "password",
                               "scope": "https://api-sire.sunat.gob.pe",
                               "client_id": client_id, "client_secret": client_secret,
                               "username": f"{ruc}{usuario}", "password": clave})
    if r.status_code != 200:
        raise SireError(f"SUNAT rechazó las credenciales (HTTP {r.status_code}): {r.text[:200]}")
    tok = r.json().get("access_token")
    if not tok:
        raise SireError("SUNAT no devolvió token")
    return tok


async def compras_periodo(*, client_id: str, client_secret: str, ruc: str,
                          usuario: str, clave: str, periodo: str,
                          max_espera_seg: int = 150) -> dict:
    """Descarga y parsea la propuesta RCE de un periodo (YYYYMM). Solo lectura."""
    if not re.fullmatch(r"20\d{4}", periodo or ""):
        raise SireError("Periodo inválido (formato YYYYMM, ej. 202606)")

    token = await obtener_token(client_id, client_secret, ruc, usuario, clave)
    H = {**UA, "Authorization": f"Bearer {token}"}

    async with httpx.AsyncClient(timeout=60, headers=H) as c:
        # 1) Solicitar exportación de la propuesta (CSV)
        r = await c.get(f"{BASE}/rce/propuesta/web/propuesta/{periodo}/exportacioncomprobantepropuesta",
                        params={"codTipoArchivo": 1, "codOrigenEnvio": 2})
        if r.status_code != 200:
            raise SireError(f"No se pudo solicitar la propuesta (HTTP {r.status_code}): {r.text[:250]}")
        ticket = r.json().get("numTicket")
        if not ticket:
            raise SireError(f"SUNAT no devolvió ticket: {r.text[:200]}")

        # 2) Esperar a que el ticket termine
        nombre = None
        inicio = asyncio.get_event_loop().time()
        while asyncio.get_event_loop().time() - inicio < max_espera_seg:
            await asyncio.sleep(4)
            r = await c.get(f"{BASE}/rvierce/gestionprocesosmasivos/web/masivo/consultaestadotickets",
                            params={"perIni": periodo, "perFin": periodo, "page": 1,
                                    "perPage": 20, "numTicket": ticket})
            if r.status_code != 200:
                continue
            regs = (r.json() or {}).get("registros") or []
            if not regs:
                continue
            archivos = regs[0].get("archivoReporte") or []
            if archivos and archivos[0].get("nomArchivoReporte"):
                nombre = archivos[0]["nomArchivoReporte"]
                break
        if not nombre:
            raise SireError("SUNAT no terminó de generar el archivo a tiempo; reintenta en un minuto")

        # 3) Descargar
        r = await c.get(f"{BASE}/rvierce/gestionprocesosmasivos/web/masivo/archivoreporte",
                        params={"nomArchivoReporte": nombre, "codTipoArchivoReporte": "01",
                                "perTributario": periodo, "codProceso": "1", "numTicket": ticket})
        if r.status_code != 200:
            raise SireError(f"No se pudo descargar el archivo (HTTP {r.status_code})")
        contenido = r.content

    try:
        zf = zipfile.ZipFile(io.BytesIO(contenido))
        texto = zf.read(zf.namelist()[0]).decode("utf-8", errors="replace")
    except zipfile.BadZipFile:
        texto = contenido.decode("utf-8", errors="replace")

    comprobantes = _parsear(texto)
    return {"periodo": periodo, "ticket": ticket, "total": len(comprobantes),
            "comprobantes": comprobantes}


def _parsear(texto: str) -> list[dict]:
    """Parsea el CSV/TXT pipe-delimited del RCE con matching tolerante de columnas."""
    lineas = [l for l in texto.splitlines() if l.strip()]
    if not lineas:
        return []
    sep = "|" if "|" in lineas[0] else (";" if ";" in lineas[0] else ",")
    cab = [h.strip().lower() for h in lineas[0].split(sep)]

    def col(*claves) -> Optional[int]:
        for i, h in enumerate(cab):
            if any(k in h for k in claves):
                return i
        return None

    ix = {
        "ruc_emisor": col("doc identidad", "documento proveedor", "ruc"),
        "razon_social": col("razon social", "razón social", "nombre"),
        "tipo": col("tipo de cdp", "tipo cdp", "tipo compro"),
        "serie": col("serie"),
        "numero": col("nro cp", "num cdp", "numero final", "nro doc", "numero"),
        "fecha": col("fecha de emis", "fecha emis"),
        "base": col("bi gravada", "base imponible"),
        "igv": col("igv"),
        "total": col("total cp", "importe total", "total"),
        "moneda": col("moneda"),
    }
    out = []
    for l in lineas[1:]:
        c = [x.strip() for x in l.split(sep)]
        g = lambda k: (c[ix[k]] if ix.get(k) is not None and ix[k] < len(c) else None)
        ruc_e = re.sub(r"\D", "", g("ruc_emisor") or "")
        if len(ruc_e) != 11:
            continue
        num = lambda v: (float(v.replace(",", "")) if v and re.match(r"^-?[\d,]+\.?\d*$", v) else None)
        serie, numero = (g("serie") or "").upper(), (g("numero") or "")
        out.append({
            "ruc_emisor": ruc_e,
            "razon_social": g("razon_social") or "",
            "tipo": g("tipo") or "",
            "serie": serie, "numero": numero,
            "numero_documento": f"{serie}-{numero}" if serie and numero else None,
            "fecha": g("fecha") or "",
            "base": num(g("base")), "igv": num(g("igv")), "total": num(g("total")),
            "moneda": g("moneda") or "PEN",
        })
    return out
