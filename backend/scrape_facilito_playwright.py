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


async def main():
    logger.info("=" * 60)
    logger.info("FACILITO SCRAPER ANTI-REBOTE (ESTABLE 100%)")
    logger.info("=" * 60)

    try:
        from playwright.async_api import async_playwright
    except ImportError:
        logger.error("pip install playwright && playwright install")
        return

    client = motor.motor_asyncio.AsyncIOMotorClient(MONGO_URL)
    db = client[DB_NAME]

    all_results = []
    seen = set()

    async with async_playwright() as pw:
        browser = await pw.chromium.launch(
            headless=False,
            args=["--window-size=1366,768", "--start-maximized"],
        )
        context = await browser.new_context(
            viewport={"width": 1366, "height": 768},
            user_agent="Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/126.0.0.0 Safari/537.36",
            locale="es-PE",
        )
        page = await context.new_page()

        for dpto_idx, dpto in enumerate(DEPARTAMENTOS, 1):
            dpto_name = dpto["name"]
            dpto_code = dpto["code"]
            logger.info(f"\n[{dpto_idx}/{len(DEPARTAMENTOS)}] ==================== {dpto_name} ====================")

            # 1. Cargar el mapa de forma limpia
            try:
                await page.goto(MAP_URL, wait_until="domcontentloaded", timeout=30000)
                await page.wait_for_timeout(1000)

                # 2. Entrar al departamento llamando makeAction(code) y esperando navegacion completa
                await page.evaluate(f"makeAction('{dpto_code}')")
                await page.wait_for_load_state("networkidle", timeout=20000)
                await page.wait_for_timeout(1500)
            except Exception as e:
                logger.warning(f"  Error cargando departamento {dpto_name}: {e}")
                continue

            # 3. Leer los dropdowns de Provincia y Producto de esta página
            selects = page.locator("select")
            n_selects = await selects.count()

            if n_selects < 2:
                logger.warning(f"  Sin dropdowns en la página de {dpto_name}")
                continue

            prov_select = selects.nth(1)
            prod_select = selects.nth(3) if n_selects >= 4 else selects.nth(n_selects - 1)

            provincias = await get_options(prov_select)
            productos  = await get_options(prod_select)

            if not provincias:
                logger.warning(f"  Sin provincias para {dpto_name}")
                continue

            logger.info(f"  {len(provincias)} provincias encontradas: {[p['label'] for p in provincias]}")

            # 4. Iterar provincias y productos dentro de la página de este departamento
            for prov in provincias:
                try:
                    selects = page.locator("select")
                    prov_select = selects.nth(1)
                    await prov_select.select_option(value=prov["value"])
                    await page.wait_for_timeout(1000)
                except Exception as e:
                    logger.debug(f"    Error prov {prov['label']}: {e}")
                    continue

                for prod in productos:
                    try:
                        selects = page.locator("select")
                        prod_select = selects.nth(3) if await selects.count() >= 4 else selects.nth((await selects.count()) - 1)
                        await prod_select.select_option(value=prod["value"])
                        
                        # Esperar a que DataTables termine de renderizar las filas
                        await wait_datatables_ready(page)

                        rows_raw = await extract_all_rows(page)
                        records = await rows_to_records(rows_raw, dpto_name, prov["label"], prod["label"])

                        for r in records:
                            key = (r["establecimiento"].upper(), r["departamento"], r["provincia"], r["combustible"])
                            if key not in seen:
                                seen.add(key)
                                all_results.append(r)

                        if len(records) > 0:
                            logger.info(f"    ✅ {prov['label']} | {prod['label']} -> {len(records)} estaciones extraídas")
                        else:
                            logger.info(f"    ℹ️ {prov['label']} | {prod['label']} -> 0 estaciones")

                    except Exception as e:
                        logger.debug(f"    Error prod: {e}")

                # Guardado continuo en MongoDB
                if all_results:
                    try:
                        await db.precios_facilito.delete_many({})
                        await db.precios_facilito.insert_many(all_results)
                    except:
                        pass

            logger.info(f"  Acumulado total actual: {len(all_results)} estaciones")

        await browser.close()

    total_db = await db.precios_facilito.count_documents({})
    logger.info(f"\n{'='*60}")
    logger.info(f"✅ COMPLETO: {total_db} estaciones guardadas en MongoDB!")
    logger.info("Presiona F5 en Enered para ver la lista completa.")
    logger.info(f"{'='*60}")


if __name__ == "__main__":
    asyncio.run(main())
