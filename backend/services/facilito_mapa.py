"""
Facilito · Mapa de grifos con coordenadas GPS REALES.

El buscador de precios (tabla) pide reCAPTCHA, pero el mapa de Facilito
(MapaAction.do?method=mostrarMapa) responde SIN captcha y trae, embebido en el HTML,
un arreglo con cada grifo: código OSINERGMIN, latitud, longitud, nombre, dirección y
sus precios por producto. Esa es la fuente correcta para ubicar los grifos donde de
verdad están (no una aproximación por dirección).

Se itera por (departamento, provincia). El código de provincia es el ubigeo estándar
por 100 (Trujillo 1301 → 130100); el de departamento es ubigeo·10000 (La Libertad 13 →
130000). Como no todas las combinaciones existen, se prueban las provincias 01..N y se
guardan solo las que devuelven grifos.
"""
from __future__ import annotations
import re
import json
import logging
import asyncio
from datetime import datetime, timezone
from typing import Optional

import httpx

logger = logging.getLogger(__name__)

MAPA_URL = "https://www.facilito.gob.pe/facilito/actions/MapaAction.do"
MAIN_URL = "https://www.facilito.gob.pe/facilito/pages/facilito/buscadorEESS.jsp"
HEADERS = {
    "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120 Safari/537.36",
    "Referer": MAIN_URL,
}

# Código de departamento en Facilito = ubigeo(2 díg) · 10000.
DEPARTAMENTOS = {
    "AMAZONAS": 1, "ANCASH": 2, "APURIMAC": 3, "AREQUIPA": 4, "AYACUCHO": 5,
    "CAJAMARCA": 6, "CALLAO": 7, "CUSCO": 8, "HUANCAVELICA": 9, "HUANUCO": 10,
    "ICA": 11, "JUNIN": 12, "LA LIBERTAD": 13, "LAMBAYEQUE": 14, "LIMA": 15,
    "LORETO": 16, "MADRE DE DIOS": 17, "MOQUEGUA": 18, "PASCO": 19, "PIURA": 20,
    "PUNO": 21, "SAN MARTIN": 22, "TACNA": 23, "TUMBES": 24, "UCAYALI": 25,
}
# Provincias por departamento (para acotar la iteración; Lima y otras son las más grandes).
NUM_PROVINCIAS = {
    1: 7, 2: 20, 3: 7, 4: 8, 5: 11, 6: 13, 7: 1, 8: 13, 9: 7, 10: 11, 11: 5,
    12: 9, 13: 12, 14: 3, 15: 10, 16: 8, 17: 3, 18: 3, 19: 3, 20: 8, 21: 13,
    22: 10, 23: 4, 24: 3, 25: 4,
}
PRODUCTO_DIESEL = "40"   # una llamada trae los 3 productos de cada grifo


def _puntos_de_html(html: str) -> list[dict]:
    """Extrae los grifos embebidos en el HTML del mapa (arreglo listaPuntos)."""
    puntos = []
    for m in re.finditer(
        r'\{"codigoOsinergmin":"?(?P<cod>[^",]*)"?,'
        r'"latitud":(?P<lat>-?[0-9.]+),"longitud":(?P<lon>-?[0-9.]+),'
        r'"unidad":"(?P<uni>[^"]*)","direccion":"(?P<dir>[^"]*)",'
        r'"productos":\[(?P<prods>[^\]]*)\]', html):
        prods = []
        for pm in re.finditer(r'\{"producto":"([^"]*)","precioVenta":([0-9.]+)\}', m.group("prods")):
            prods.append({"producto": pm.group(1), "precio": float(pm.group(2))})
        puntos.append({
            "codigo_osinergmin": m.group("cod"),
            "lat": float(m.group("lat")), "lon": float(m.group("lon")),
            "unidad": m.group("uni").strip(), "direccion": m.group("dir").strip(),
            "productos": prods,
        })
    return puntos


async def _mapa_provincia(client: httpx.AsyncClient, dep_code: int, prov_code: int) -> list[dict]:
    url = (f"{MAPA_URL}?departamento={dep_code}&provincia={prov_code}&distrito=9999999"
           f"&producto={PRODUCTO_DIESEL}&method=mostrarMapa&subtitulocabecera=1&tipo=LIQ")
    r = await client.get(url)
    if r.status_code != 200:
        return []
    return _puntos_de_html(r.text)


async def traer_precios_con_gps(departamentos: Optional[list[str]] = None) -> list[dict]:
    """Recorre los departamentos pedidos (o todos) y devuelve un registro por (grifo, producto)
    con coordenadas GPS reales, listo para guardar en precios_facilito."""
    scraped_at = datetime.now(timezone.utc).isoformat()
    objetivo = [d.upper() for d in departamentos] if departamentos else list(DEPARTAMENTOS.keys())
    salida = []

    async with httpx.AsyncClient(headers=HEADERS, timeout=30.0, follow_redirects=True) as client:
        try:
            await client.get(MAIN_URL)  # establece la cookie de sesión
        except Exception:
            pass
        for dep_name in objetivo:
            dd = DEPARTAMENTOS.get(dep_name)
            if not dd:
                continue
            dep_code = dd * 10000
            for pp in range(1, NUM_PROVINCIAS.get(dd, 15) + 1):
                prov_code = (dd * 100 + pp) * 100
                try:
                    puntos = await _mapa_provincia(client, dep_code, prov_code)
                except Exception as e:
                    logger.warning(f"[facilito_mapa] {dep_name}/{prov_code}: {e}")
                    puntos = []
                for p in puntos:
                    for pr in p["productos"]:
                        salida.append({
                            "establecimiento": p["unidad"],
                            "direccion": p["direccion"],
                            "codigo_osinergmin": p["codigo_osinergmin"],
                            "combustible": pr["producto"],
                            "precio_venta": pr["precio"], "precio_pizarra": pr["precio"],
                            "departamento": dep_name,
                            "lat": p["lat"], "lon": p["lon"],
                            "fuente": "facilito.gob.pe/mapa", "scraped_at": scraped_at,
                            "acepta_factura": True, "acepta_tarjeta": False, "calidad": 4,
                        })
                if puntos:
                    logger.info(f"[facilito_mapa] {dep_name}/{prov_code}: {len(puntos)} grifos")
                await asyncio.sleep(0.5)
    return salida
