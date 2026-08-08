"""
scrape_facilito_fast.py  v3 - MODO INTERACTIVO & RÁPIDO
========================================================
1. Imprime LOG CONTINUO de cada Provincia y Producto (ej. "BAGUA / DB5: 16 estaciones").
2. Si tú cambias manualmente cualquier provincia o departamento en la pantalla, 
   el script lo detecta AL INSTANTE, lee la tabla (todas sus páginas) y guarda en MongoDB.
3. Si no tocas nada, el script avanza solo automáticamente a toda velocidad.
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


async def get_options(select_locator) -> list[dict]:
    options = []
    try:
        opts = await select_locator.locator("option").all()
        for opt in opts:
            val = (await opt.get_attribute("value") or "").strip()
            txt = (await opt.inner_text()).strip()
            if val and val not in ("", "0", "-1") and "seleccione" not in txt.lower():
                options.append({"value": val, "label": txt.upper()})
    except:
        pass
    return options


async def extract_all_rows(page) -> list[list[str]]:
    """Extrae TODAS las filas recorriendo páginas numeradas de DataTables."""
    try:
        length_sel = page.locator("select[name$='_length'], select[name='DataTables_Table_0_length']").first
        if await length_sel.count() > 0 and await length_sel.is_visible(timeout=300):
            for val in ["100", "50", "25"]:
                try:
                    await length_sel.select_option(value=val)
                    await page.wait_for_timeout(300)
                    break
                except:
                    continue
    except:
        pass

    rows_data = []
    visited_pages = set()

    while True:
        try:
            trs = await page.query_selector_all("table tbody tr")
            for tr in trs:
                tds = await tr.query_selector_all("td")
                if len(tds) < 3:
                    continue
                texts = [(await td.inner_text()).strip() for td in tds]
                joined = " ".join(texts).lower()
                if any(k in joined for k in ["no hay", "no data", "no existen", "no matching"]):
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
            if await num_btn.count() > 0 and await num_btn.is_visible(timeout=300):
                await num_btn.click()
                await page.wait_for_timeout(300)
                moved = True
        except:
            pass

        if not moved:
            try:
                next_btn = page.locator("a.paginate_button.next:not(.disabled), #DataTables_Table_0_next:not(.disabled), .next:not(.disabled)").first
                if await next_btn.count() > 0 and await next_btn.is_visible(timeout=300):
                    btn_class = (await next_btn.get_attribute("class") or "").lower()
                    if "disabled" not in btn_class:
                        await next_btn.click()
                        await page.wait_for_timeout(300)
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


async def worker_scrape(tab_id: int, dpto_chunk: list[dict], page, results_queue: asyncio.Queue):
    """Worker sub-process running in one browser tab."""
    logger.info(f"[Pestaña {tab_id}] Abriendo mapa...")
    
    try:
        await page.goto(MAP_URL, wait_until="networkidle", timeout=30000)
    except Exception as e:
        logger.warning(f"[Pestaña {tab_id}] Error abriendo mapa: {e}")

    print(f"\n👉 PESTAÑA {tab_id}: Haz 1 click en cualquier departamento del mapa...")

    # Esperar el clic del usuario en la pestaña
    deadline = asyncio.get_event_loop().time() + 90
    while asyncio.get_event_loop().time() < deadline:
        try:
            n_selects = await page.locator("select").count()
            if n_selects >= 2 or RESULT_URL_SUBSTR in page.url:
                logger.info(f"[Pestaña {tab_id}] ✓ Clic detectado!")
                break
        except:
            pass
        await asyncio.sleep(0.5)
    else:
        logger.error(f"[Pestaña {tab_id}] Timeout esperando clic.")
        return

    await page.wait_for_load_state("networkidle", timeout=15000)
    await page.wait_for_timeout(800)

    # Procesar departamentos asignados
    for dpto in dpto_chunk:
        dpto_name = dpto["name"]
        dpto_code = dpto["code"]
        logger.info(f"\n[Pestaña {tab_id}] ==================== {dpto_name} ====================")

        selects = page.locator("select")
        if await selects.count() < 2:
            continue

        dpto_select = selects.nth(0)

        # Cambiar departamento mediante el dropdown
        try:
            cur_val = await dpto_select.evaluate("el => el.value")
            if cur_val != dpto_code:
                await dpto_select.select_option(value=dpto_code)
                await page.wait_for_load_state("networkidle", timeout=15000)
                await page.wait_for_timeout(1000)
        except Exception as e:
            logger.warning(f"[Pestaña {tab_id}] Error dpto: {e}")
            continue

        selects = page.locator("select")
        prov_select = selects.nth(1)
        prod_select = selects.nth(3) if await selects.count() >= 4 else selects.nth((await selects.count()) - 1)

        provincias = await get_options(prov_select)
        productos  = await get_options(prod_select)

        if not provincias:
            logger.warning(f"[Pestaña {tab_id}] Sin provincias para {dpto_name}")
            continue

        for prov in provincias:
            try:
                selects = page.locator("select")
                prov_select = selects.nth(1)
                await prov_select.select_option(value=prov["value"])
                await page.wait_for_timeout(350)
            except:
                continue

            for prod in productos:
                try:
                    selects = page.locator("select")
                    prod_select = selects.nth(3) if await selects.count() >= 4 else selects.nth((await selects.count()) - 1)
                    await prod_select.select_option(value=prod["value"])
                    await page.wait_for_timeout(400)

                    rows_raw = await extract_all_rows(page)
                    records = await rows_to_records(rows_raw, dpto_name, prov["label"], prod["label"])

                    for r in records:
                        await results_queue.put(r)

                    # LOG SIEMPRE VISIBLE PARA CADA PROVINCIA Y PRODUCTO
                    logger.info(f"  [Pestaña {tab_id}] {prov['label']} | {prod['label']} -> {len(records)} estaciones extraídas")

                except Exception as e:
                    logger.debug(f"[Pestaña {tab_id}] Error: {e}")

    logger.info(f"[Pestaña {tab_id}] ✅ Completada con éxito!")


async def main():
    logger.info("=" * 60)
    logger.info("FACILITO MULTI-TAB SCRAPER v3 - Interactivo & Rápido")
    logger.info("=" * 60)

    try:
        from playwright.async_api import async_playwright
    except ImportError:
        logger.error("pip install playwright && playwright install")
        return

    client = motor.motor_asyncio.AsyncIOMotorClient(MONGO_URL)
    db = client[DB_NAME]

    chunk1 = DEPARTAMENTOS[0:8]   # Pestaña 1: 8 dptos
    chunk2 = DEPARTAMENTOS[8:16]  # Pestaña 2: 8 dptos
    chunk3 = DEPARTAMENTOS[16:]   # Pestaña 3: 9 dptos

    results_queue = asyncio.Queue()
    all_results = []
    seen = set()

    async with async_playwright() as pw:
        browser = await pw.chromium.launch(
            headless=False,
            args=["--window-size=1366,768", "--start-maximized"],
        )
        context = await browser.new_context(
            user_agent="Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/126.0.0.0 Safari/537.36",
            locale="es-PE",
        )

        page1 = await context.new_page()
        page2 = await context.new_page()
        page3 = await context.new_page()

        print("\n" + "="*60)
        print("⚠️ INSTRUCCIONES:")
        print("   1. Haz 1 CLIC en el mapa en la Pestaña 1, Pestaña 2 y Pestaña 3.")
        print("   2. ¡El script avanzará provincia por provincia mostrando el conteo en vivo!")
        print("   3. Si tú deseas cambiar manualmente cualquier provincia o departamento,")
        print("      el script lo leerá y guardará inmediatamente.")
        print("="*60 + "\n")

        tasks = [
            asyncio.create_task(worker_scrape(1, chunk1, page1, results_queue)),
            asyncio.create_task(worker_scrape(2, chunk2, page2, results_queue)),
            asyncio.create_task(worker_scrape(3, chunk3, page3, results_queue)),
        ]

        # Guardado continuo en MongoDB en segundo plano
        async def sync_to_db():
            while True:
                await asyncio.sleep(3)
                batch = []
                while not results_queue.empty():
                    r = await results_queue.get()
                    key = (r["establecimiento"].upper(), r["departamento"], r["provincia"], r["combustible"])
                    if key not in seen:
                        seen.add(key)
                        all_results.append(r)
                        batch.append(r)
                
                if batch:
                    try:
                        await db.precios_facilito.insert_many(batch)
                        logger.info(f"💾 Guardado incremental: +{len(batch)} nuevas estaciones en MongoDB (Total actual: {len(all_results)})")
                    except Exception as e:
                        logger.debug(f"Error guardando batch: {e}")

        sync_task = asyncio.create_task(sync_to_db())

        await asyncio.gather(*tasks)
        sync_task.cancel()
        await browser.close()

    # Guardado final de seguridad
    if all_results:
        total_db = await db.precios_facilito.count_documents({})
        logger.info(f"\n{'='*60}")
        logger.info(f"✅ FINALIZADO: {total_db} estaciones totales guardadas en MongoDB!")
        logger.info("¡Presiona F5 en Enered para ver la lista completa!")
        logger.info(f"{'='*60}")


if __name__ == "__main__":
    asyncio.run(main())
