"""
Padrón de grifos de OSINERGMIN (Datos Abiertos del Estado).

Sirve para autocompletar los datos del grifo que exige la ATU (razón social, departamento,
provincia, distrito, dirección) a partir del RUC que viene en la factura, y para indicar si
el establecimiento figura inscrito en OSINERGMIN.

Se carga a Mongo con un job (idempotente) y se consulta por RUC.
"""
from __future__ import annotations
import csv
import io
import logging
from datetime import datetime, timezone

logger = logging.getLogger(__name__)

CSV_URL = "https://www.datosabiertos.gob.pe/sites/default/files/18Grifos%20y%20Estaciones%20de%20Servicios_1.csv"
# El portal rechaza clientes sin cabeceras de navegador (devuelve 418).
_HEADERS = {
    "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 "
                  "(KHTML, like Gecko) Chrome/120.0 Safari/537.36",
    "Accept": "text/csv,*/*",
    "Referer": "https://www.datosabiertos.gob.pe/",
}
COLECCION = "grifos_osinergmin"


def _limpiar(v) -> str:
    return (v or "").strip()


def _fila_a_doc(r: dict) -> dict | None:
    ruc = _limpiar(r.get("RUC"))
    if not ruc or len(ruc) != 11 or not ruc.isdigit():
        return None
    return {
        "ruc": ruc,
        "codigo_osinergmin": _limpiar(r.get("CODIGO OSINERGMIN")),
        "razon_social": _limpiar(r.get("RAZON SOCIAL")),
        "direccion": _limpiar(r.get("DIRECCION OPERATIVA")),
        "departamento": _limpiar(r.get("DEPARTAMENTO")).upper(),
        "provincia": _limpiar(r.get("PROVINCIA")).upper(),
        "distrito": _limpiar(r.get("DISTRITO")).upper(),
        "tipo_establecimiento": _limpiar(r.get("TIPO DE ESTABLECIMIENTO")),
        "vigencia": _limpiar(r.get("TÉRMINO DE VIGENCIA")) or "INDEFINIDO",
        "registro": _limpiar(r.get("REGISTRO")),
    }


async def sincronizar(db) -> dict:
    """Descarga el padrón y lo carga en Mongo. Devuelve un resumen."""
    import os
    import httpx
    # Los .gob.pe bloquean servidores extranjeros: en producción se sale por el proxy peruano
    # (el mismo del MTC); en local queda None (conexión directa).
    proxy = os.getenv("FACILITO_PROXY") or os.getenv("MTC_PROXY") or None
    async with httpx.AsyncClient(timeout=120.0, verify=False, headers=_HEADERS,
                                 follow_redirects=True, proxy=proxy) as c:
        r = await c.get(CSV_URL)
        if r.status_code != 200:
            raise RuntimeError(f"OSINERGMIN respondió {r.status_code}")
        contenido = r.content

    texto = contenido.decode("latin-1", errors="replace")
    filas = list(csv.DictReader(io.StringIO(texto), delimiter=";"))
    docs = [d for d in (_fila_a_doc(f) for f in filas) if d]
    if not docs:
        raise RuntimeError("El padrón vino vacío o con formato inesperado")

    ahora = datetime.now(timezone.utc).isoformat()
    for d in docs:
        d["actualizado_en"] = ahora

    # Reemplazo completo (el padrón es la fuente de verdad).
    await db[COLECCION].delete_many({})
    await db[COLECCION].insert_many(docs)
    try:
        await db[COLECCION].create_index("ruc")
    except Exception:
        pass

    logger.info(f"Padrón OSINERGMIN sincronizado: {len(docs)} establecimientos")
    return {"establecimientos": len(docs), "rucs": len({d['ruc'] for d in docs}), "actualizado_en": ahora}


# Palabras genéricas que no identifican al grifo (para el match por razón social).
_GENERICAS = {
    "ESTACION", "ESTACIN", "DE", "SERVICIOS", "SERVICIO", "SERVICENTRO", "GRIFO", "GRIFOS",
    "S", "A", "C", "SA", "SAC", "SRL", "EIRL", "SCRL", "E", "I", "R", "L", "Y", "DEL", "LA",
    "EL", "LOS", "LAS", "EMPRESA", "CORPORACION", "INVERSIONES", "COMBUSTIBLES", "MULTISERVICIOS",
}


def _tokens_significativos(nombre: str) -> list[str]:
    import re as _re
    limpio = _re.sub(r"[^A-Z0-9 ]", " ", (nombre or "").upper())
    return [t for t in limpio.split() if len(t) >= 3 and t not in _GENERICAS]


async def _buscar_en_facilito(db, razon_social: str) -> list[dict]:
    """Respaldo: el padrón CSV de Datos Abiertos está incompleto, pero toda estación
    que declara precios en Facilito está inscrita en OSINERGMIN por definición.
    Busca el establecimiento por los tokens distintivos de la razón social."""
    import re as _re
    tokens = _tokens_significativos(razon_social)
    if not tokens:
        return []
    cond = [{"establecimiento": {"$regex": _re.escape(t), "$options": "i"}} for t in tokens]
    rows = await db.precios_facilito.find(
        {"$and": cond},
        {"_id": 0, "establecimiento": 1, "codigo_osinergmin": 1, "direccion": 1,
         "departamento": 1, "provincia": 1, "distrito": 1},
    ).to_list(300)
    # un local por código osinergmin
    vistos, locales = set(), []
    for r in rows:
        cod = r.get("codigo_osinergmin") or r.get("direccion")
        if cod in vistos:
            continue
        vistos.add(cod)
        locales.append(r)
    return locales


async def buscar_por_ruc(db, ruc: str, razon_social: str | None = None) -> dict | None:
    """
    Devuelve los datos del grifo para autocompletar el formulario de la ATU.
    Si el RUC tiene varios locales, devuelve el primero y cuántos hay.
    Si el RUC no está en el padrón CSV, intenta por razón social en Facilito
    (padrón vivo de OSINERGMIN) antes de marcarlo como no inscrito.
    """
    ruc = (ruc or "").strip()
    if len(ruc) != 11 or not ruc.isdigit():
        return None
    docs = await db[COLECCION].find({"ruc": ruc}, {"_id": 0}).to_list(200)
    if not docs:
        if razon_social:
            fac = await _buscar_en_facilito(db, razon_social)
            if fac:
                f0 = fac[0]
                return {
                    "ruc": ruc, "inscrito": True, "fuente": "OSINERGMIN (vía Facilito)",
                    "razon_social": razon_social,
                    "codigo_osinergmin": f0.get("codigo_osinergmin", ""),
                    "direccion": f0.get("direccion", ""),
                    "departamento": (f0.get("departamento") or "").upper(),
                    "provincia": (f0.get("provincia") or "").upper(),
                    "distrito": (f0.get("distrito") or "").upper(),
                    "vigencia": "VIGENTE (declara precios en Facilito)",
                    "locales": [
                        {"direccion": x.get("direccion", ""), "distrito": (x.get("distrito") or "").upper(),
                         "provincia": (x.get("provincia") or "").upper(),
                         "departamento": (x.get("departamento") or "").upper(),
                         "codigo_osinergmin": x.get("codigo_osinergmin", "")}
                        for x in fac
                    ],
                    "total_locales": len(fac),
                }
        return {"ruc": ruc, "inscrito": False, "locales": []}
    d = dict(docs[0])
    d["inscrito"] = True
    # Todos los locales del RUC: el formulario los usa para que el usuario elija la
    # dirección correcta (un mismo RUC puede tener decenas de establecimientos).
    d["locales"] = [
        {"direccion": x.get("direccion", ""), "distrito": x.get("distrito", ""),
         "provincia": x.get("provincia", ""), "departamento": x.get("departamento", ""),
         "codigo_osinergmin": x.get("codigo_osinergmin", "")}
        for x in docs
    ]
    d["total_locales"] = len(docs)
    return d
