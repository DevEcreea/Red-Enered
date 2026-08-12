"""
scrape_facilito_playwright.py - VERSIÓN ESTABLE DEFINITIVA
============================================================
Flujo anti-rebote:
  1. Para cada departamento: carga el mapa de forma limpia.
  2. Ejecuta makeAction(departamento_code) y espera a que la página de resultados cargue 100%.
  3. Recorre las Provincias y Productos de ese departamento sin rebotar jamás.
  4. Muestra las estaciones reales por consola y las guarda continuamente en MongoDB.
"""
import asyncio
import logging
import os
import sys
import re
from datetime import datetime, timezone

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
    datefmt="%H:%M:%S",
)
logger = logging.getLogger(__name__)

sys.path.insert(0, os.path.dirname(__file__))
from dotenv import load_dotenv
load_dotenv()

import motor.motor_asyncio

MONGO_URL = os.environ.get("MONGO_URL", "mongodb://localhost:27017")
DB_NAME   = os.environ.get("DB_NAME",   "red_enered")

MAP_URL           = "https://www.facilito.gob.pe/facilito/pages/facilito/buscadorEESS.jsp"
# Combustibles a scrapear (coma-separado). Por defecto solo Diésel (subsidio). Vacío = todos.
FUELS_FILTER      = [f.strip().upper() for f in os.environ.get("FUELS", "DB5 S-50 UV").split(",") if f.strip()]
RESULT_URL_SUBSTR = "PreciosCombustibleAutomotorAction"

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


def parse_precio(raw: str):
    if not raw:
        return None
    s = re.sub(r"[Ss]/\.?\s*", "", str(raw)).strip()
    s = re.sub(r"[^\d.,]", "", s)
    if not s:
        return None
    if "," in s and "." in s:
        s = s.replace(".", "").replace(",", ".")
    elif "," in s:
        s = s.replace(",", ".")
    try:
        v = float(s)
        return v if 5.0 < v < 100.0 else None
    except:
        return None


async def get_data_table(page):
    """Encuentra la tabla REAL de estaciones de Facilito verificando sus encabezados."""
    try:
        tables = await page.locator("table").all()
        for t in tables:
            txt = (await t.inner_text()).lower()
            if "establecimiento" in txt and ("precio" in txt or "distrito" in txt or "direcci" in txt):
                return t
    except:
        pass
    return None


async def get_options(select_locator) -> list[dict]:
    options = []
    try:
        opts = await select_locator.locator("option").all()
        for opt in opts:
            val = (await opt.get_attribute("value") or "").strip()
            txt = (await opt.inner_text()).strip()
            if val and val not in ("", "0", "-1") and "seleccione" not in txt.lower():
                options.append({"value": val, "label": txt})
    except:
        pass
    return options


async def wait_datatables_ready(page):
    """Espera a que la tabla termine de cargar los datos de Facilito."""
    await page.wait_for_timeout(1200)
    try:
        await page.wait_for_selector(".dataTables_processing", state="hidden", timeout=4000)
    except:
        pass


async def extract_all_rows(page) -> list[list[str]]:
    """Extrae TODAS las filas de la tabla de datos real recorriendo sus páginas."""
    await wait_datatables_ready(page)

    table = await get_data_table(page)
    if not table:
        return []

    # 1. Intentar cambiar la longitud de registros a 100
    try:
        length_sel = page.locator("select[name$='_length'], select[name*='length']").first
        if await length_sel.count() > 0 and await length_sel.is_visible(timeout=500):
            for val in ["100", "50", "25"]:
                try:
                    await length_sel.select_option(value=val)
                    await page.wait_for_timeout(800)
                    break
                except:
                    continue
    except:
        pass

    rows_data = []
    visited_pages = set()

    while True:
        table = await get_data_table(page)
        if not table:
            break

        try:
            trs = await table.locator("tbody tr").all()
            for tr in trs:
                tds = await tr.locator("td").all()
                if len(tds) < 3:
                    continue
                texts = [(await td.inner_text()).strip() for td in tds]
                joined = " ".join(texts).lower()
                if any(k in joined for k in ["no hay", "no data", "no existen", "no matching", "procesando"]):
                    continue
                rows_data.append(texts)
        except:
            break

        current_page_num = None
        try:
            cur_elem = page.locator(".paginate_button.current, .paginate_button.active, .page-item.active").first
            if await cur_elem.count() > 0:
                txt = (await cur_elem.inner_text()).strip()
                if txt.isdigit():
                    current_page_num = int(txt)
        except:
            pass

        if current_page_num is None or current_page_num in visited_pages:
            break
        visited_pages.add(current_page_num)

        next_num = current_page_num + 1
        moved = False
        try:
            num_btn = page.locator(f".paginate_button:has-text('{next_num}'), a.paginate_button:text-is('{next_num}')").first
            if await num_btn.count() > 0 and await num_btn.is_visible(timeout=800):
                await num_btn.click()
                await page.wait_for_timeout(800)
                moved = True
        except:
            pass

        if not moved:
            try:
                next_btn = page.locator("a.paginate_button.next:not(.disabled), .next:not(.disabled)").first
                if await next_btn.count() > 0 and await next_btn.is_visible(timeout=800):
                    btn_class = (await next_btn.get_attribute("class") or "").lower()
                    if "disabled" not in btn_class:
                        await next_btn.click()
                        await page.wait_for_timeout(800)
                        moved = True
            except:
                pass

        if not moved:
            break

    return rows_data


async def rows_to_records(rows, dpto_name, provincia_name, combustible_label) -> list[dict]:
    scraped_at = datetime.now(timezone.utc).isoformat()
    records = []
    for cols in rows:
        if len(cols) >= 5:
            distrito, establecimiento, direccion, telefono, precio_raw = \
                cols[0], cols[1], cols[2], cols[3], cols[4]
        elif len(cols) == 4:
            distrito, establecimiento, direccion, telefono, precio_raw = \
                "", cols[0], cols[1], cols[2], cols[3]
        else:
            continue

        precio = parse_precio(precio_raw)
        if not establecimiento or precio is None:
            continue

        records.append({
            "establecimiento": establecimiento,
            "direccion": direccion,
            "telefono": telefono,
            "precio_venta": precio,
            "precio_pizarra": precio,
            "combustible": combustible_label,
            "departamento": dpto_name,
            "provincia": provincia_name,
            "distrito": distrito,
            "ciudad": distrito or provincia_name,
            "fuente": "facilito.gob.pe",
            "scraped_at": scraped_at,
            "es_enered": False,
            "calidad": 4,
        })
    return records


async def load_dept(page, code, tries=6):
    """Navega a la página de resultados de un departamento. El reCAPTCHA v3 en headless
    es intermitente, así que reintenta hasta que aparezca el dropdown de provincias."""
    for i in range(tries):
        try:
            await page.goto(MAP_URL, wait_until="domcontentloaded", timeout=30000)
            await page.wait_for_timeout(1500)  # deja que grecaptcha.execute genere el token
            await page.evaluate(f"makeAction('{code}')")
            try:
                await page.wait_for_load_state("networkidle", timeout=25000)
            except Exception:
                pass
            await page.wait_for_timeout(1500)
            sels = page.locator("select")
            if await sels.count() >= 4:
                provs = await get_options(sels.nth(1))
                if provs:
                    return provs
        except Exception as e:
            logger.warning(f"    intento {i+1} error: {e}")
        logger.info(f"    reintento {i+1}/{tries} (reCAPTCHA no cargó resultados)…")
        await page.wait_for_timeout(2500)
    return []


async def main():
    logger.info("=" * 60)
    logger.info("FACILITO SCRAPER (Playwright headless + reintentos reCAPTCHA)")
    logger.info(f"Destino: {DB_NAME}.precios_facilito")
    logger.info("=" * 60)

    try:
        from playwright.async_api import async_playwright
    except ImportError:
        logger.error("pip install playwright && python -m playwright install chromium")
        return

    client = motor.motor_asyncio.AsyncIOMotorClient(MONGO_URL)
    db = client[DB_NAME]

    all_results = []
    seen = set()

    async with async_playwright() as pw:
        browser = await pw.chromium.launch(headless=True)
        context = await browser.new_context(
            viewport={"width": 1366, "height": 768},
            user_agent="Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36",
            locale="es-PE",
        )
        page = await context.new_page()

        for dpto_idx, dpto in enumerate(DEPARTAMENTOS, 1):
            dpto_name = dpto["name"]
            dpto_code = dpto["code"]
            logger.info(f"\n[{dpto_idx}/{len(DEPARTAMENTOS)}] ============ {dpto_name} ============")

            provincias = await load_dept(page, dpto_code)
            if not provincias:
                logger.warning(f"  {dpto_name}: sin resultados tras reintentos → se omite")
                continue

            n = await page.locator("select").count()
            prod_sel = page.locator("select").nth(3) if n >= 4 else page.locator("select").nth(n - 1)
            productos = await get_options(prod_sel)
            # Filtro de combustible (env FUELS, coma-separado). Por defecto solo Diésel
            # (el combustible del subsidio) → scrape nacional viable y confiable.
            if FUELS_FILTER:
                productos = [p for p in productos if p["label"].strip().upper() in FUELS_FILTER]
            logger.info(f"  {len(provincias)} provincias · {len(productos)} productos")

            for prov in provincias:
                # Página fresca por provincia: es la forma confiable de que DataTables
                # recargue los datos (el cambio in-page no siempre dispara la recarga).
                if not await load_dept(page, dpto_code):
                    continue
                try:
                    await page.locator("select").nth(1).select_option(value=prov["value"])
                    await page.wait_for_timeout(1200)
                except Exception as e:
                    logger.debug(f"    Error prov {prov['label']}: {e}")
                    continue

                for prod in productos:
                    try:
                        sels = page.locator("select")
                        cnt = await sels.count()
                        prod_select = sels.nth(3) if cnt >= 4 else sels.nth(cnt - 1)
                        await prod_select.select_option(value=prod["value"])
                        await wait_datatables_ready(page)

                        records = await rows_to_records(await extract_all_rows(page), dpto_name, prov["label"], prod["label"])
                        nuevos = 0
                        for r in records:
                            key = (r["establecimiento"].upper(), r["departamento"], r["provincia"], r["combustible"])
                            if key not in seen:
                                seen.add(key)
                                all_results.append(r)
                                nuevos += 1
                        logger.info(f"    {prov['label']} | {prod['label']} → {len(records)} filas ({nuevos} nuevos)")
                    except Exception as e:
                        logger.debug(f"    Error prod {prod['label']}: {e}")

            logger.info(f"  Acumulado: {len(all_results)} precios")

        await browser.close()

    # Reemplazo atómico: solo se sobrescribe si el scrape trajo datos (evita vaciar por un fallo).
    if all_results:
        await db.precios_facilito.delete_many({})
        # insertar en lotes
        for i in range(0, len(all_results), 1000):
            await db.precios_facilito.insert_many(all_results[i:i + 1000])
    total_db = await db.precios_facilito.count_documents({})
    logger.info(f"\n{'='*60}")
    logger.info(f"✅ COMPLETO: {total_db} precios guardados en {DB_NAME}.precios_facilito")
    logger.info(f"{'='*60}")


if __name__ == "__main__":
    asyncio.run(main())
