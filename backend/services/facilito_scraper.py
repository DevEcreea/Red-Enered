"""
Facilito OSINERGMIN Scraper - FIXED VERSION
Scrapes ALL fuel stations from https://www.facilito.gob.pe per department + fuel type.

Table columns from Facilito (confirmed from official site screenshot):
  col[0] = Distrito
  col[1] = Establecimiento
  col[2] = Dirección
  col[3] = Teléfono
  col[4] = Precio de Venta (Soles por galón)
"""

import asyncio
import logging
import re
import time
from datetime import datetime, timezone
from typing import Optional

import httpx
from bs4 import BeautifulSoup

logger = logging.getLogger(__name__)

MAIN_PAGE_URL = "https://www.facilito.gob.pe/facilito/pages/facilito/buscadorEESS.jsp"
ACTION_URL = "https://www.facilito.gob.pe/facilito/actions/PreciosCombustibleAutomotorAction.do"

HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
        "AppleWebKit/537.36 (KHTML, like Gecko) "
        "Chrome/126.0.0.0 Safari/537.36"
    ),
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    "Accept-Language": "es-PE,es;q=0.9",
    "Origin": "https://www.facilito.gob.pe",
    "Referer": "https://www.facilito.gob.pe/facilito/pages/facilito/buscadorEESS.jsp",
    "Content-Type": "application/x-www-form-urlencoded",
}

DEPARTAMENTOS = [
    {"code": "10000",  "name": "AMAZONAS"},
    {"code": "20000",  "name": "ANCASH"},
    {"code": "30000",  "name": "APURIMAC"},
    {"code": "40000",  "name": "AREQUIPA"},
    {"code": "50000",  "name": "AYACUCHO"},
    {"code": "60000",  "name": "CAJAMARCA"},
    {"code": "70000",  "name": "CALLAO"},
    {"code": "80000",  "name": "CUSCO"},
    {"code": "90000",  "name": "HUANCAVELICA"},
    {"code": "100000", "name": "HUANUCO"},
    {"code": "110000", "name": "ICA"},
    {"code": "120000", "name": "JUNIN"},
    {"code": "130000", "name": "LA LIBERTAD"},
    {"code": "140000", "name": "LAMBAYEQUE"},
    {"code": "150000", "name": "LIMA"},
    {"code": "160000", "name": "LORETO"},
    {"code": "170000", "name": "MADRE DE DIOS"},
    {"code": "180000", "name": "MOQUEGUA"},
    {"code": "190000", "name": "PASCO"},
    {"code": "200000", "name": "PIURA"},
    {"code": "210000", "name": "PUNO"},
    {"code": "220000", "name": "SAN MARTIN"},
    {"code": "230000", "name": "TACNA"},
    {"code": "240000", "name": "TUMBES"},
    {"code": "250000", "name": "UCAYALI"},
]

COMBUSTIBLES = [
    "DB5 S-50 UV",
    "Gasohol Regular",
    "Gasohol Premium",
]

REQUEST_DELAY_SECONDS = 1.2
TIMEOUT_SECONDS = 30


def _parse_precio(raw: str) -> Optional[float]:
    if not raw:
        return None
    s = str(raw).strip()
    s = re.sub(r"[Ss]/\.?\s*", "", s).strip()
    if not s or s == "-" or s == "":
        return None
    if "," in s and "." in s:
        s = s.replace(".", "").replace(",", ".")
    elif "," in s:
        s = s.replace(",", ".")
    s = re.sub(r"[^\d.]", "", s)
    try:
        val = float(s)
        return val if 5.0 < val < 100.0 else None
    except ValueError:
        return None


def _parse_table(html: str, dpto: dict, combustible_label: str, enered_stations: set) -> list[dict]:
    """Parse the HTML table from Facilito response.

    Facilito table columns (confirmed from official site screenshot):
      col[0] = Distrito
      col[1] = Establecimiento
      col[2] = Dirección
      col[3] = Teléfono
      col[4] = Precio de Venta (Soles por galón)
    """
    soup = BeautifulSoup(html, "lxml")

    # Find the data table - Facilito uses DataTables
    table = None
    all_tables = soup.find_all("table")
    for t in all_tables:
        rows = t.find_all("tr")
        if len(rows) < 2:
            continue
        header_cells = rows[0].find_all(["th", "td"])
        header_text = " ".join(c.get_text(strip=True).lower() for c in header_cells)
        if any(k in header_text for k in ["establecimiento", "distrito", "precio", "dirección", "telefono"]):
            table = t
            break

    if not table:
        # Fallback: pick largest table
        for t in sorted(all_tables, key=lambda x: len(x.find_all("tr")), reverse=True):
            if len(t.find_all("tr")) > 2:
                table = t
                break

    if not table:
        return []

    results = []
    rows = table.find_all("tr")
    scraped_at = datetime.now(timezone.utc).isoformat()

    for row in rows[1:]:  # skip header
        cols = [td.get_text(strip=True) for td in row.find_all("td")]
        if len(cols) < 3:
            continue

        # CORRECT column order for Facilito:
        if len(cols) >= 5:
            distrito        = cols[0].strip()
            establecimiento = cols[1].strip()
            direccion       = cols[2].strip()
            telefono        = cols[3].strip()
            precio_raw      = cols[4].strip()
        elif len(cols) == 4:
            distrito        = ""
            establecimiento = cols[0].strip()
            direccion       = cols[1].strip()
            telefono        = cols[2].strip()
            precio_raw      = cols[3].strip()
        else:
            continue

        precio = _parse_precio(precio_raw)
        if not establecimiento or precio is None:
            continue

        nombre_upper = establecimiento.upper()
        es_enered = any(
            enered_name.upper() in nombre_upper or nombre_upper in enered_name.upper()
            for enered_name in enered_stations
        ) if enered_stations else False

        results.append({
            "establecimiento": establecimiento,
            "direccion": direccion,
            "telefono": telefono,
            "precio_venta": precio,
            "precio_pizarra": precio,
            "combustible": combustible_label,
            "departamento": dpto["name"],
            "provincia": "",
            "distrito": distrito,
            "ciudad": distrito or dpto["name"],
            "fuente": "facilito.gob.pe",
            "scraped_at": scraped_at,
            "es_enered": es_enered,
            "calidad": 4,
            "acepta_factura": True,
            "acepta_tarjeta": False,
        })

    return results


def _scrape_one(
    session: httpx.Client,
    dpto: dict,
    combustible: str,
    enered_stations: set,
) -> list[dict]:
    payload = {
        "departamento_elegido": dpto["code"],
        "provincia": "",
        "distrito": "",
        "combustible": combustible,
        "nameRedirectfile": "buscadorEESS",
        "g-recaptcha-response": "",
    }

    try:
        response = session.post(
            f"{ACTION_URL}?method=inicio",
            data=payload,
            timeout=TIMEOUT_SECONDS,
        )
        response.raise_for_status()
    except Exception as e:
        logger.warning(f"[Facilito] Error fetching {dpto['name']} / {combustible}: {e}")
        return []

    records = _parse_table(response.text, dpto, combustible, enered_stations)
    logger.info(f"[Facilito] {dpto['name']} / {combustible}: {len(records)} registros")
    return records


def scrape_all_precios(enered_stations: set = None) -> list[dict]:
    """Scrape ALL fuel stations from Facilito OSINERGMIN across Peru."""
    if enered_stations is None:
        enered_stations = set()

    all_results = []
    seen = set()

    with httpx.Client(headers=HEADERS, follow_redirects=True, timeout=TIMEOUT_SECONDS) as session:
        try:
            session.get(MAIN_PAGE_URL, timeout=TIMEOUT_SECONDS)
            time.sleep(1)
        except Exception:
            pass

        total = len(DEPARTAMENTOS) * len(COMBUSTIBLES)
        current = 0

        for dpto in DEPARTAMENTOS:
            for combustible in COMBUSTIBLES:
                current += 1
                logger.info(f"[Facilito] Scraping {current}/{total}: {dpto['name']} / {combustible}")
                records = _scrape_one(session, dpto, combustible, enered_stations)

                for r in records:
                    key = (r["establecimiento"].upper(), r["departamento"], r["combustible"])
                    if key not in seen:
                        seen.add(key)
                        all_results.append(r)

                if current < total:
                    time.sleep(REQUEST_DELAY_SECONDS)

    logger.info(f"[Facilito] Total: {len(all_results)} estaciones únicas")
    return all_results


async def scrape_all_precios_async(enered_stations: set = None) -> list[dict]:
    loop = asyncio.get_event_loop()
    return await loop.run_in_executor(None, scrape_all_precios, enered_stations)
