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

# El registro de hidrocarburos de OSINERGMIN se publica en 28 archivos por categoría.
# La ATU acepta como proveedor no solo grifos: también distribuidores minoristas
# (p.ej. venta en contenedores intermedios/cisterna) y mayoristas. Cargamos las
# categorías que VENDEN combustible a transportistas.
FUENTES = [
    ("18Grifos%20y%20Estaciones%20de%20Servicios_1.csv", "GRIFO / ESTACIÓN DE SERVICIOS"),
    ("17Grifos%20Rurales%20con%20almacenamiento%20en%20Cilindros_1.csv", "GRIFO RURAL"),
    ("16Grifos%20Flotantes_1.csv", "GRIFO FLOTANTE"),
    ("21Distribuidores%20Mayoristas%20Combustibles%20L%C3%ADquidos_1.csv", "DISTRIBUIDOR MAYORISTA"),
    ("3Transporte%20de%20combustibles%20l%C3%ADquidos%20en%20contenedores%20intermedios_1.csv",
     "DISTRIBUIDOR MINORISTA (CONTENEDORES INTERMEDIOS)"),
]
_BASE_FILES = "https://www.datosabiertos.gob.pe/sites/default/files/"
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


def _clave_norm(k: str) -> str:
    """Normaliza un encabezado: sin acentos/mojibake/símbolos, solo A-Z."""
    import re as _re
    import unicodedata
    k = unicodedata.normalize("NFKD", k or "")
    return _re.sub(r"[^A-Z]", "", k.upper())


def _mapear_columnas(encabezados: list[str]) -> dict:
    """Cada categoría del registro usa nombres de columna algo distintos
    (DIRECCION OPERATIVA / DOMICILIO LEGAL / DIRECCIÓN LEGAL, RAZON/RAZÓN...).
    Devuelve {campo_destino: nombre_columna_original}."""
    m: dict = {}
    for h in encabezados:
        n = _clave_norm(h)
        if n == "RUC":
            m.setdefault("ruc", h)
        elif "RAZ" in n and "SOCIAL" in n:
            m.setdefault("razon_social", h)
        elif "CODIGOOSINERGMIN" in n:
            m.setdefault("codigo_osinergmin", h)
        elif n == "REGISTRO":
            m.setdefault("registro", h)
        elif "DIRECC" in n or "DOMICILIO" in n:
            m.setdefault("direccion", h)
        elif n == "DEPARTAMENTO":
            m.setdefault("departamento", h)
        elif n == "PROVINCIA":
            m.setdefault("provincia", h)
        elif n == "DISTRITO":
            m.setdefault("distrito", h)
        elif "VIGENCIA" in n:
            m.setdefault("vigencia", h)
        elif "TIPODEESTABLECIMIENTO" in n:
            m.setdefault("tipo", h)
    return m


def _fila_a_doc(r: dict, cols: dict, tipo_defecto: str) -> dict | None:
    ruc = _limpiar(r.get(cols.get("ruc", "RUC")))
    if not ruc or len(ruc) != 11 or not ruc.isdigit():
        return None
    def v(campo):
        col = cols.get(campo)
        return _limpiar(r.get(col)) if col else ""
    return {
        "ruc": ruc,
        "codigo_osinergmin": v("codigo_osinergmin"),
        "razon_social": v("razon_social"),
        "direccion": v("direccion"),
        "departamento": v("departamento").upper(),
        "provincia": v("provincia").upper(),
        "distrito": v("distrito").upper(),
        "tipo_establecimiento": v("tipo") or tipo_defecto,
        "vigencia": v("vigencia") or "INDEFINIDO",
        "registro": v("registro"),
    }


async def sincronizar(db) -> dict:
    """Descarga las categorías vendedoras del registro de hidrocarburos y las carga
    en Mongo (reemplazo completo). Devuelve un resumen por categoría."""
    import os
    import httpx
    # Los .gob.pe bloquean servidores extranjeros: en producción se sale por el proxy peruano
    # (el mismo del MTC); en local queda None (conexión directa).
    proxy = os.getenv("FACILITO_PROXY") or os.getenv("MTC_PROXY") or None
    docs, por_categoria, vistos = [], {}, set()
    ahora = datetime.now(timezone.utc).isoformat()
    async with httpx.AsyncClient(timeout=120.0, verify=False, headers=_HEADERS,
                                 follow_redirects=True, proxy=proxy) as c:
        for archivo, tipo in FUENTES:
            try:
                r = await c.get(_BASE_FILES + archivo)
                if r.status_code != 200:
                    raise RuntimeError(f"HTTP {r.status_code}")
                try:
                    texto = r.content.decode("utf-8")
                except UnicodeDecodeError:
                    texto = r.content.decode("latin-1", errors="replace")
                filas = list(csv.DictReader(io.StringIO(texto), delimiter=";"))
                if not filas:
                    raise RuntimeError("vacío")
                cols = _mapear_columnas(list(filas[0].keys()))
                n = 0
                for f in filas:
                    d = _fila_a_doc(f, cols, tipo)
                    if not d:
                        continue
                    # una fila por local (el archivo de contenedores repite el RUC por placa)
                    clave = (d["ruc"], d["codigo_osinergmin"], d["direccion"])
                    if clave in vistos:
                        continue
                    vistos.add(clave)
                    d["actualizado_en"] = ahora
                    docs.append(d)
                    n += 1
                por_categoria[tipo] = n
            except Exception as e:
                # una categoría caída no debe tumbar el padrón completo
                por_categoria[tipo] = f"ERROR: {str(e)[:80]}"
                logger.warning(f"Padrón OSINERGMIN: fallo en {archivo}: {e}")

    if not docs:
        raise RuntimeError("El padrón vino vacío o con formato inesperado")

    # Reemplazo completo (el padrón es la fuente de verdad).
    await db[COLECCION].delete_many({})
    await db[COLECCION].insert_many(docs)
    try:
        await db[COLECCION].create_index("ruc")
    except Exception:
        pass

    logger.info(f"Padrón OSINERGMIN sincronizado: {len(docs)} establecimientos ({por_categoria})")
    return {"establecimientos": len(docs), "rucs": len({d['ruc'] for d in docs}),
            "por_categoria": por_categoria, "actualizado_en": ahora}


# Palabras genéricas que no identifican al grifo (para el match por razón social).
_GENERICAS = {
    "ESTACION", "ESTACIN", "DE", "SERVICIOS", "SERVICIO", "SERVICENTRO", "GRIFO", "GRIFOS",
    "S", "A", "C", "SA", "SAC", "SRL", "EIRL", "SCRL", "E", "I", "R", "L", "Y", "DEL", "LA",
    "EL", "LOS", "LAS", "EMPRESA", "CORPORACION", "INVERSIONES", "COMBUSTIBLES", "MULTISERVICIOS",
    # forma societaria completa que trae SUNAT (no aparece así en Facilito)
    "SOCIEDAD", "ANONIMA", "ANNIMA", "CERRADA", "ABIERTA", "INDIVIDUAL", "RESPONSABILIDAD", "LIMITADA",
    "COMERCIAL", "SUCURSAL", "PERU", "GENERALES", "NEGOCIOS", "NEGOCIACIONES", "NEGOCIACION",
    "TRANSPORTES", "TRANSPORTE", "SERVICENTROS", "GRIFOS", "ESTACIONES", "COMPANIA", "COMPAÑIA",
}


def _tokens_significativos(nombre: str) -> list[str]:
    import re as _re
    import unicodedata as _ud
    limpio = _ud.normalize("NFKD", (nombre or "").upper()).encode("ascii", "ignore").decode()
    limpio = _re.sub(r"[^A-Z0-9 ]", " ", limpio)
    return [t for t in limpio.split() if len(t) >= 3 and t not in _GENERICAS]


def _regex_nombre_corto(nombre: str):
    """Para razones sociales sin tokens significativos ('ESTACION DE SERVICIOS J & F S.A.C.'):
    arma un patrón con las letras/números cortos que quedan (J, F) en orden, tolerando
    símbolos entre ellos: r'\bJ\W{0,4}F\b'. Devuelve None si no hay nada usable."""
    import re as _re
    import unicodedata as _ud
    limpio = _ud.normalize("NFKD", (nombre or "").upper()).encode("ascii", "ignore").decode()
    limpio = _re.sub(r"[^A-Z0-9 ]", " ", limpio)
    cortos = [t for t in limpio.split() if t not in _GENERICAS and t not in ("S", "A", "C", "E", "I", "R", "L")]
    if not cortos or len("".join(cortos)) < 2:
        return None
    return r"\b" + r"\W{0,4}".join(_re.escape(t) for t in cortos) + r"\b"


_SUFIJOS = {"SOCIEDAD", "ANONIMA", "ANNIMA", "CERRADA", "ABIERTA", "INDIVIDUAL", "RESPONSABILIDAD", "LIMITADA",
            "S", "A", "C", "SA", "SAC", "SRL", "EIRL", "SCRL", "E", "I", "R", "L", "SUCURSAL", "PERU"}


def _normalizar(nombre: str) -> list[str]:
    import re as _re
    import unicodedata as _ud
    limpio = _ud.normalize("NFKD", (nombre or "").upper()).encode("ascii", "ignore").decode()
    limpio = _re.sub(r"[^A-Z0-9 ]", " ", limpio)
    return limpio.split()


def _frase_base(nombre: str):
    """Razón social sin la forma societaria del final, como patrón exacto de palabras en orden:
    'EMPRESA DE SERVICIOS Y TRANSPORTES EL NEGRO E.I.R.L.' → EMPRESA\W+DE\W+…\W+NEGRO.
    Es la coincidencia más confiable: Facilito suele copiar el nombre tal cual."""
    import re as _re
    palabras = _normalizar(nombre)
    while palabras and palabras[-1] in _SUFIJOS:
        palabras.pop()
    palabras = [w for w in palabras if w not in ("S", "A", "C", "E", "I", "R", "L")]
    if len(palabras) < 2 or len("".join(palabras)) < 5:
        return None
    return r"\b" + r"\W+".join(_re.escape(w) for w in palabras) + r"\b"


async def _buscar_por_nombre(db, razon_social: str):
    """Busca una razón social en Facilito (precios_facilito.establecimiento) y en el CSV de
    OSINERGMIN (razon_social), de más a menos estricta:
      1) frase completa sin forma societaria, en orden;
      2) todos los tokens significativos (AND);
      3) un único token corto (3-6 letras) solo si la coincidencia es única.
    Devuelve (fuente, filas) o (None, [])."""
    import re as _re
    proy_f = {"_id": 0, "establecimiento": 1, "codigo_osinergmin": 1, "direccion": 1,
              "departamento": 1, "provincia": 1, "distrito": 1}

    async def _fac(cond):
        rows = await db.precios_facilito.find(cond, proy_f).to_list(300)
        vistos, out = set(), []
        for r in rows:
            cod = r.get("codigo_osinergmin") or r.get("direccion")
            if cod in vistos:
                continue
            vistos.add(cod)
            out.append(r)
        return out

    async def _csv(cond):
        return await db[COLECCION].find(cond, {"_id": 0}).to_list(50)

    intentos = []  # (cond_facilito, cond_csv, exigir_unico)
    frase = _frase_base(razon_social)
    if frase:
        intentos.append(({"establecimiento": {"$regex": frase, "$options": "i"}},
                         {"razon_social": {"$regex": frase, "$options": "i"}}, False))
    tokens = _tokens_significativos(razon_social)
    if tokens and (len(tokens) >= 2 or len(tokens[0]) >= 7):
        intentos.append(({"$and": [{"establecimiento": {"$regex": _re.escape(t), "$options": "i"}} for t in tokens]},
                         {"$and": [{"razon_social": {"$regex": _re.escape(t), "$options": "i"}} for t in tokens]}, False))
    elif tokens:  # un solo token corto (KIO, NEGRO): palabra completa y coincidencia única
        pat = r"\b" + _re.escape(tokens[0]) + r"\b"
        intentos.append(({"establecimiento": {"$regex": pat, "$options": "i"}},
                         {"razon_social": {"$regex": pat, "$options": "i"}}, True))
    else:
        pat = _regex_nombre_corto(razon_social)
        if pat:
            intentos.append(({"establecimiento": {"$regex": pat, "$options": "i"}},
                             {"razon_social": {"$regex": pat, "$options": "i"}}, True))

    def _nombres(rows, campo):
        return {(r.get(campo) or "").strip().upper() for r in rows}

    for cond_f, cond_c, unico in intentos:
        rows = await _fac(cond_f)
        if rows and (not unico or len(_nombres(rows, "establecimiento")) <= 2):
            return "facilito", rows
        rows = await _csv(cond_c)
        if rows and (not unico or len(_nombres(rows, "razon_social")) <= 2):
            return "csv", rows
    return None, []


async def _buscar_en_facilito(db, razon_social: str) -> list[dict]:
    """Compatibilidad: solo Facilito (usa la búsqueda por nombre unificada)."""
    fuente, rows = await _buscar_por_nombre(db, razon_social)
    return rows if fuente == "facilito" else []


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
            fuente, rows = await _buscar_por_nombre(db, razon_social)
            if fuente == "csv":
                docs = [{**d, "ruc_padron": d.get("ruc"), "ruc": ruc, "fuente": "OSINERGMIN (por razón social)",
                         "advertencia": "El RUC no figura en el CSV de Datos Abiertos; coincide por razón social."} for d in rows]
            elif fuente == "facilito" and rows:
                f0 = rows[0]
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
                        for x in rows
                    ],
                    "total_locales": len(rows),
                }
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
