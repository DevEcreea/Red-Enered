"""
Valorización referencial de vehículos — Tabla de Valores Referenciales del MEF
(Resolución Ministerial N° 008-2026-EF/15, base del Impuesto al Patrimonio Vehicular 2026).

Fuente oficial, pública y gratuita: anexo Excel publicado en gob.pe. Cubre automóviles
(A1-A4), camionetas, camiones, buses y remolcadores (tracto camiones), con valores
directos para años de fabricación 2023-2025. Para años anteriores la propia RM fija
factores sobre el valor 2025 (art. 2): 2022→0,7 · 2021→0,6 · 2020→0,5 · 2019→0,4 ·
2018→0,3 · 2017→0,2 · 2016 y anteriores→0,1, redondeando a la decena de soles.

Es un VALOR REFERENCIAL (base tributaria), no un precio de mercado: se presenta así.
"""
from __future__ import annotations
import difflib
import io
import logging
import re
import unicodedata
from datetime import datetime, timezone

logger = logging.getLogger(__name__)

EJERCICIO = 2026
XLSX_URL = "https://cdn.www.gob.pe/uploads/document/file/9293915/7623157-anexo-tvr-ipv-2026.xlsx"
FUENTE = "MEF · Tabla de Valores Referenciales 2026 (RM 008-2026-EF/15)"
COLECCION = "valores_referenciales"

ANIOS_DIRECTOS = (2025, 2024, 2023)
FACTORES = {2022: 0.7, 2021: 0.6, 2020: 0.5, 2019: 0.4, 2018: 0.3, 2017: 0.2}
FACTOR_MINIMO = 0.1  # 2016 y anteriores

_HEADERS = {"User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/124.0"}


def _norm(s) -> str:
    s = unicodedata.normalize("NFKD", str(s or "")).encode("ascii", "ignore").decode()
    return re.sub(r"[^A-Z0-9]", "", s.upper())


def _redondear_decena(v: float) -> int:
    """Art. 2.2 de la RM: a la decena superior si las unidades son >= 5, si no a la inferior."""
    base = int(v // 10) * 10
    return base + 10 if (v - base) >= 5 else base


async def sincronizar(db) -> dict:
    """Descarga el anexo Excel del MEF y lo carga en Mongo (reemplazo completo)."""
    import os
    import httpx
    import openpyxl

    proxy = os.getenv("FACILITO_PROXY") or os.getenv("MTC_PROXY") or None
    async with httpx.AsyncClient(timeout=180.0, headers=_HEADERS, follow_redirects=True, proxy=proxy) as c:
        r = await c.get(XLSX_URL)
        if r.status_code != 200:
            raise RuntimeError(f"gob.pe respondió {r.status_code}")
        contenido = r.content

    wb = openpyxl.load_workbook(io.BytesIO(contenido), read_only=True)
    ws = wb.worksheets[0]
    ahora = datetime.now(timezone.utc).isoformat()
    docs, categorias = [], {}
    for fila in ws.iter_rows(min_row=7, values_only=True):
        if not fila or not fila[0] or not fila[1]:
            continue
        cat, marca = str(fila[0]).strip().upper(), str(fila[1]).strip().upper()
        modelo = str(fila[3] or fila[2] or "").strip().upper()
        try:
            v25, v24, v23 = (float(fila[4] or 0), float(fila[5] or 0), float(fila[6] or 0))
        except Exception:
            continue
        if not modelo or v25 <= 0:
            continue
        docs.append({
            "ejercicio": EJERCICIO, "categoria": cat, "marca": marca, "marca_norm": _norm(marca),
            "modelo": modelo, "modelo_norm": _norm(modelo),
            "valores": {"2025": v25, "2024": v24, "2023": v23},
            "actualizado_en": ahora,
        })
        categorias[cat] = categorias.get(cat, 0) + 1
    if not docs:
        raise RuntimeError("El anexo vino vacío o con formato inesperado")

    await db[COLECCION].delete_many({})
    await db[COLECCION].insert_many(docs)
    try:
        await db[COLECCION].create_index([("marca_norm", 1), ("categoria", 1)])
    except Exception:
        pass
    logger.info(f"Valores referenciales MEF sincronizados: {len(docs)} modelos")
    return {"modelos": len(docs), "categorias": categorias, "ejercicio": EJERCICIO, "actualizado_en": ahora}


def _categorias_preferidas(categoria_mtc: str | None) -> list[str]:
    c = (categoria_mtc or "").upper()
    if c.startswith("N"):
        return ["CAMIONES", "REMOLCADORES"]
    if c.startswith("M2") or c.startswith("M3"):
        return ["BUSES Y OMNIBUSES"]
    if c.startswith("M1"):
        return ["CAMIONETAS", "A4", "A3", "A2", "A1"]
    return []


def _valor_por_anio(valores: dict, anio: int | None) -> tuple[int | None, str]:
    """Aplica la regla de la RM según el año de fabricación."""
    v25 = float(valores.get("2025") or 0)
    if not anio:
        return (_redondear_decena(v25) if v25 else None), "sin año: se usa el valor 2025"
    if anio >= 2025:
        return _redondear_decena(v25), "valor directo 2025"
    if anio in (2024, 2023):
        v = float(valores.get(str(anio)) or 0) or v25
        return _redondear_decena(v), f"valor directo {anio}"
    factor = FACTORES.get(anio, FACTOR_MINIMO)
    return _redondear_decena(v25 * factor), f"valor 2025 × factor {factor} (año {anio})"


async def valorizar(db, marca: str, modelo: str, anio: int | None, categoria_mtc: str | None = None) -> dict:
    """Devuelve la valorización referencial de un vehículo o {} si no hay marca en la tabla.
    Estrategia de match: modelo exacto → modelo más parecido (≥ 0,72) → fila 'OTROS MODELOS'
    de la marca → mediana de la marca en su categoría (confianza baja)."""
    mk = _norm(marca)
    if not mk:
        return {}
    filas = await db[COLECCION].find({"marca_norm": mk}, {"_id": 0}).to_list(3000)
    if not filas and len(mk) >= 5:
        # alias de marca: "MERCEDES" → "MERCEDES BENZ", "VW" no; solo prefijos claros
        marcas = await db[COLECCION].distinct("marca_norm")
        alias = [m for m in marcas if m.startswith(mk) or mk.startswith(m)]
        if len(alias) == 1:
            filas = await db[COLECCION].find({"marca_norm": alias[0]}, {"_id": 0}).to_list(3000)
    if not filas:
        return {}
    pref = _categorias_preferidas(categoria_mtc)
    if pref:
        cand = [f for f in filas if f["categoria"] in pref] or filas
    else:
        cand = filas
    mn = _norm(modelo)
    match, tipo, score = None, "", 0.0
    if mn:
        exact = [f for f in cand if f["modelo_norm"] == mn]
        if exact:
            match, tipo, score = exact[0], "exacto", 1.0
        else:
            # misma familia de modelo primero (AROCS ≠ ACTROS aunque se parezcan en letras)
            fam = re.match(r"^[A-Z]+", mn)
            fam = fam.group(0) if fam and len(fam.group(0)) >= 3 else ""
            pool = [f for f in cand if f["modelo_norm"].startswith(fam)] if fam else []
            misma_familia = bool(pool)
            pool = pool or cand
            mejor = max(pool, key=lambda f: difflib.SequenceMatcher(None, mn, f["modelo_norm"]).ratio())
            score = difflib.SequenceMatcher(None, mn, mejor["modelo_norm"]).ratio()
            # dentro de la misma familia (AROCS, FMX, G460...) basta un parecido moderado:
            # la variante cambia el valor menos que equivocarse de familia.
            if score >= (0.6 if misma_familia else 0.72):
                match, tipo = mejor, "aproximado"
    if not match:
        otros = [f for f in cand if "OTROSMODELOS" in f["modelo_norm"]]
        if otros:
            match, tipo, score = otros[0], "otros modelos de la marca", 0.5
        else:
            vals = sorted(float(f["valores"]["2025"]) for f in cand)
            med = vals[len(vals) // 2]
            match = {"categoria": cand[0]["categoria"], "modelo": f"mediana {cand[0]['marca']}",
                     "valores": {"2025": med, "2024": med * 0.9, "2023": med * 0.8}}
            tipo, score = "mediana de la marca", 0.3
    valor, regla = _valor_por_anio(match["valores"], anio)
    if not valor:
        return {}
    return {
        "valor_referencial": valor,
        "valor_ref_detalle": {
            "fuente": FUENTE, "categoria_tabla": match["categoria"], "modelo_tabla": match["modelo"],
            "match": tipo, "confianza": round(score, 2), "regla": regla, "ejercicio": EJERCICIO,
        },
    }
