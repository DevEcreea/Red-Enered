"""
Facilito OSINERGMIN Scraper - FIXED VERSION
Scrapes ALL fuel stations from https://www.facilito.gob.pe per department + fuel type.

Table columns from Facilito:
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
    {"label": "DB5 S-50 UV",      "value": "DB5 S-50 UV"},
    {"label": "Gasohol Regular",   "value": "Gasohol Regular"},
    {"label": "Gasohol Premium",   "value": "Gasohol Premium"},
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


def _get_provinces(session: httpx.Client, dpto_code: str) -> list[dict]:
    """Fetch the list of provinces for a department via AJAX."""
    try:
        resp = session.post(
            f"{ACTION_URL}?method=cargarProvincias",
            data={"departamento": dpto_code},
            timeout=TIMEOUT_SECONDS,
        )
        if resp.status_code == 200:
            soup = BeautifulSoup(resp.text, "lxml")
            options = soup.find_all("option")
            provinces = []
            for opt in options:
                val = opt.get("value", "").strip()
                txt = opt.get_text(strip=True)
                if val and val != "0" and val != "-1" and txt and "Seleccione" not in txt:
                    provinces.append({"code": val, "name": txt.upper()})
            return provinces
    except Exception as e:
        logger.warning(f"Could not load provinces for {dpto_code}: {e}")
    return []


def _scrape_department(
    session: httpx.Client,
    dpto: dict,
    combustible: dict,
    enered_stations: set,
) -> list[dict]:
    """Scrape todas las estaciones de un departamento+combustible, iterando por provincia.
    Iterar por provincia permite guardar el nombre de provincia en cada registro.
    """
    results = []

    # Obtener provincias para enriquecer cada registro con su provincia real
    provinces = _get_provinces(session, dpto["code"])

    if provinces:
        for prov in provinces:
            dpto_with_prov = {**dpto, "provincia": prov["name"]}
            payload = {
                "method": "inicio",
                "departamento_elegido": dpto["code"],
                "provincia": prov["code"],
                "distrito": "",
                "combustible": combustible["value"],
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
                rows_found = _parse_table(response.text, dpto_with_prov, combustible["value"], enered_stations)
                results.extend(rows_found)
                logger.info(
                    f"[Facilito] {dpto['name']} / {prov['name']} / {combustible['value']}: {len(rows_found)} registros"
                )
                time.sleep(0.4)  # pausa corta entre provincias
            except Exception as e:
                logger.warning(
                    f"[Facilito] Error {dpto['name']}/{prov['name']}/{combustible['value']}: {e}"
                )
    else:
        # Fallback: scrape a nivel de departamento sin nombre de provincia
        payload = {
            "method": "inicio",
            "departamento_elegido": dpto["code"],
            "provincia": "",
            "distrito": "",
            "combustible": combustible["value"],
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
            rows_found = _parse_table(response.text, dpto, combustible["value"], enered_stations)
            results.extend(rows_found)
            logger.info(f"[Facilito] {dpto['name']} / {combustible['value']}: {len(rows_found)} registros")
        except Exception as e:
            logger.warning(f"[Facilito] Error {dpto['name']} / {combustible['value']}: {e}")

    return results


def _parse_table(html: str, dpto: dict, combustible_label: str, enered_stations: set) -> list[dict]:
    """Parse the HTML table from Facilito response.
    
    Facilito table columns (confirmed from screenshot):
      col[0] = Distrito
      col[1] = Establecimiento  
      col[2] = Dirección
      col[3] = Teléfono
      col[4] = Precio de Venta (Soles por galón)
    """
    soup = BeautifulSoup(html, "lxml")
    
    # Find the data table - Facilito uses DataTables
    table = None
    for t in soup.find_all("table"):
        rows = t.find_all("tr")
        if len(rows) > 2:
            # Check headers to confirm it's the right table
            header_cells = rows[0].find_all(["th", "td"]) if rows else []
            header_text = " ".join(c.get_text(strip=True).lower() for c in header_cells)
            if any(k in header_text for k in ["establecimiento", "distrito", "precio", "dirección", "telefono"]):
                table = t
                break
            elif len(rows) > 5:  # fallback: pick largest table
                table = t
                break
    
    if not table:
        # Last resort: any table with enough rows
        all_tables = soup.find_all("table")
        for t in sorted(all_tables, key=lambda x: len(x.find_all("tr")), reverse=True):
            if len(t.find_all("tr")) > 2:
                table = t
                break

    if not table:
        return []

    results = []
    rows = table.find_all("tr")
    scraped_at = datetime.now(timezone.utc).isoformat()

    for row in rows[1:]:  # skip header row
        cols = [td.get_text(strip=True) for td in row.find_all("td")]
        if len(cols) < 3:
            continue

        # La página actual pone el Distrito en un <th scope="row"> (no <td>).
        th_row = row.find("th")
        distrito_th = th_row.get_text(strip=True) if th_row else ""

        # CORRECT column mapping for Facilito:
        # col[0]=Distrito, col[1]=Establecimiento, col[2]=Dirección, col[3]=Teléfono, col[4]=Precio
        if len(cols) >= 5:
            distrito        = cols[0].strip()
            establecimiento = cols[1].strip()
            direccion       = cols[2].strip()
            telefono        = cols[3].strip()
            precio_raw      = cols[4].strip()
        elif len(cols) == 4:
            distrito        = distrito_th
            establecimiento = cols[0].strip()
            direccion       = cols[1].strip()
            telefono        = cols[2].strip()
            precio_raw      = cols[3].strip()
        else:
            continue
        if telefono == "\xa0":
            telefono = ""

        precio = _parse_precio(precio_raw)
        if not establecimiento or precio is None:
            continue

        es_enered = establecimiento.upper() in {s.upper() for s in enered_stations}

        results.append({
            "establecimiento": establecimiento,
            "direccion": direccion,
            "telefono": telefono,
            "precio_venta": precio,
            "precio_pizarra": precio,
            "combustible": combustible_label,
            "departamento": dpto["name"],
            "provincia": dpto.get("provincia", dpto["name"]),
            "distrito": distrito,
            "ciudad": distrito or dpto.get("provincia", dpto["name"]),
            "fuente": "facilito.gob.pe",
            "scraped_at": scraped_at,
            "es_enered": es_enered,
            "calidad": 4,
            "acepta_factura": True,
            "acepta_tarjeta": False,
        })

    return results



def parsear_html_guardado(html: str, enered_stations: set = None,
                          departamento: str = "", provincia: str = "", combustible: str = "") -> dict:
    """
    Importación ASISTIDA: Facilito puso reCAPTCHA al buscador, así que una persona hace la
    búsqueda en su navegador (resolviendo el captcha), guarda la página de resultados
    (⌘+S / Ctrl+S) y la sube. Aquí se parsea ese HTML con el mismo _parse_table del scraper.

    Auto-detecta departamento/provincia/combustible desde los <select> server-rendered de la
    página; los parámetros explícitos (si vienen) tienen prioridad.
    """
    soup = BeautifulSoup(html, "lxml")

    def _selected(*nombres):
        """Primer <select> que exista entre los nombres dados, con su opción seleccionada."""
        for nombre in nombres:
            sel = soup.find("select", attrs={"name": nombre}) or soup.find("select", id=nombre)
            if not sel:
                continue
            opt = sel.find("option", selected=True)
            if opt:
                return (opt.get("value") or "").strip(), opt.get_text(strip=True).upper()
        return None, None

    # Departamento: la página actual usa "departamentoAux" (+ hidden "departamento" con el código);
    # versiones anteriores usaban "departamento_elegido".
    dpto_name = (departamento or "").upper().strip()
    if not dpto_name:
        code, txt = _selected("departamentoAux", "departamento_elegido")
        if txt and "SELECCIONE" not in txt:
            dpto_name = txt
        elif code:
            dpto_name = next((d["name"] for d in DEPARTAMENTOS if d["code"] == code), "")
    if not dpto_name:
        hid = soup.find("input", attrs={"name": "departamento"})
        if hid and hid.get("value"):
            dpto_name = next((d["name"] for d in DEPARTAMENTOS if d["code"] == hid["value"].strip()), "")
    # OSINERGMIN nombra al Callao "PROV. CONST. DEL CALLAO"
    if dpto_name.startswith("PROV. CONST"):
        dpto_name = "CALLAO"

    prov_name = (provincia or "").upper().strip()
    if not prov_name:
        _, txt = _selected("provincia")
        if txt and "SELECCIONE" not in txt:
            prov_name = txt

    # Combustible: la página actual usa "producto" con value numérico (40/126/127) y el nombre
    # en el TEXTO de la opción; versiones anteriores usaban "combustible" con el nombre en value.
    comb = (combustible or "").strip()
    if not comb:
        val, txt = _selected("producto", "combustible")
        comb = (txt if (val or "").isdigit() else (val or txt or "")).strip()
        if "SELECCIONE" in comb.upper():
            comb = ""

    if not dpto_name:
        return {"ok": False, "registros": [],
                "error": "No se pudo detectar el departamento en la página; elígelo manualmente."}
    if not comb:
        return {"ok": False, "registros": [],
                "error": "No se pudo detectar el combustible en la página; elígelo manualmente."}

    dpto = {"name": dpto_name}
    if prov_name:
        dpto["provincia"] = prov_name
    registros = _parse_table(html, dpto, comb, enered_stations or set())
    return {"ok": True, "departamento": dpto_name, "provincia": prov_name or None,
            "combustible": comb, "registros": registros}


def scrape_all_precios(enered_stations: set = None) -> list[dict]:
    """Scrape ALL fuel stations from Facilito OSINERGMIN across Peru."""
    if enered_stations is None:
        enered_stations = set()

    
    all_results = []
    seen = set()  # dedup by (establecimiento, departamento, combustible)

    with httpx.Client(headers=HEADERS, follow_redirects=True, timeout=TIMEOUT_SECONDS) as session:
        # Warm up session / get cookies
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
                logger.info(f"[Facilito] Scraping {current}/{total}: {dpto['name']} / {combustible['value']}")
                
                records = _scrape_department(session, dpto, combustible, enered_stations)
                
                for r in records:
                    key = (r["establecimiento"].upper(), r["departamento"], r["combustible"])
                    if key not in seen:
                        seen.add(key)
                        all_results.append(r)

                if current < total:
                    time.sleep(REQUEST_DELAY_SECONDS)

    logger.info(f"[Facilito] Scraping completo: {len(all_results)} estaciones únicas encontradas")
    return all_results


async def scrape_all_precios_async(enered_stations: set = None) -> list[dict]:
    loop = asyncio.get_event_loop()
    return await loop.run_in_executor(None, scrape_all_precios, enered_stations)
