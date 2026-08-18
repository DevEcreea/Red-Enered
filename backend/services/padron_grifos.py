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
    import httpx
    async with httpx.AsyncClient(timeout=120.0, verify=False, headers=_HEADERS, follow_redirects=True) as c:
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


async def buscar_por_ruc(db, ruc: str) -> dict | None:
    """
    Devuelve los datos del grifo para autocompletar el formulario de la ATU.
    Si el RUC tiene varios locales, devuelve el primero y cuántos hay.
    """
    ruc = (ruc or "").strip()
    if len(ruc) != 11 or not ruc.isdigit():
        return None
    docs = await db[COLECCION].find({"ruc": ruc}, {"_id": 0}).to_list(200)
    if not docs:
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
