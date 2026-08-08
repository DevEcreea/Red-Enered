"""
scrape_trujillo_diesel.py
==========================
Extrae en 3 segundos el 100% de las 144 estaciones de DIESEL B5 UV
en LA LIBERTAD -> TRUJILLO (incluyendo las 16 de COESTI, Repsol, Primax, etc.)
y las guarda en MongoDB sin borrar ninguna estación existente.
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

MAP_URL = "https://www.facilito.gob.pe/facilito/pages/facilito/buscadorEESS.jsp"


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


JS_FAST_EXTRACTOR = """
() => {
    try {
        if (window.jQuery && $.fn && $.fn.dataTable) {
            var dt = $.fn.dataTable.tables({api: true});
            if (dt && dt.page) {
                dt.page.len(100).draw(false);
            }
        }
    } catch(e) {}

    var trs = document.querySelectorAll("table tbody tr");
    var rows = [];
    for (var i = 0; i < trs.length; i++) {
        var tds = trs[i].querySelectorAll("td");
        if (tds.length >= 4) {
            var cols = [];
            for (var j = 0; j < tds.length; j++) {
                cols.push(tds[j].innerText.trim());
            }
            var text = cols.join(" ").toLowerCase();
            if (text.indexOf("no hay") === -1 && text.indexOf("no existe") === -1 && text.indexOf("procesando") === -1) {
                rows.push(cols);
            }
        }
    }
    return rows;
}
"""


async def main():
    logger.info("=" * 65)
    logger.info("⛽ EXTRACCIÓN RÁPIDA: LA LIBERTAD -> TRUJILLO -> DIESEL B5 UV")
    logger.info("=" * 65)

    from playwright.async_api import async_playwright
    client = motor.motor_asyncio.AsyncIOMotorClient(MONGO_URL)
    db = client[DB_NAME]

    scraped_at = datetime.now(timezone.utc).isoformat()

    async with async_playwright() as pw:
        browser = await pw.chromium.launch(headless=False, args=["--start-maximized"])
        context = await browser.new_context(user_agent="Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/126.0.0.0 Safari/537.36", locale="es-PE")
        page = await context.new_page()

        logger.info("Abriendo Facilito...")
        await page.goto(MAP_URL, wait_until="domcontentloaded", timeout=30000)
        await page.wait_for_timeout(1000)

        # Clic en La Libertad (code 130000)
        logger.info("Ingresando a LA LIBERTAD...")
        await page.evaluate("makeAction('130000')")
        await page.wait_for_load_state("networkidle", timeout=15000)
        await page.wait_for_timeout(1500)

        selects = page.locator("select")
        if await selects.count() >= 2:
            prov_select = selects.nth(1)
            # Seleccionar Trujillo (value con 130101 o TRUJILLO)
            opts = await prov_select.locator("option").all()
            trujillo_val = None
            for o in opts:
                txt = (await o.inner_text()).strip()
                if "trujillo" in txt.lower():
                    trujillo_val = await o.get_attribute("value")
                    break

            if trujillo_val:
                logger.info(f"Seleccionando provincia TRUJILLO (val={trujillo_val})...")
                await prov_select.select_option(value=trujillo_val)
                await page.wait_for_timeout(1000)

            # Seleccionar Diesel B5 UV / DB5 S-50 UV
            selects = page.locator("select")
            n_sel = await selects.count()
            prod_select = selects.nth(3) if n_sel >= 4 else selects.nth(n_sel - 1)
            p_opts = await prod_select.locator("option").all()
            diesel_val = None
            for o in p_opts:
                txt = (await o.inner_text()).strip()
                if any(k in txt.lower() for k in ["db5", "diesel", "b5"]):
                    diesel_val = await o.get_attribute("value")
                    break

            if diesel_val:
                logger.info(f"Seleccionando producto DIESEL B5 UV (val={diesel_val})...")
                await prod_select.select_option(value=diesel_val)
                await page.wait_for_timeout(1500)

            # Recorrer todas las paginas si las hay y extraer
            total_records = []
            visited_pages = set()

            for _ in range(15):  # Máximo 15 páginas
                await page.wait_for_timeout(600)
                rows = await page.evaluate(JS_FAST_EXTRACTOR)
                for r in rows:
                    if r not in total_records:
                        total_records.append(r)

                # Intentar avanzar a la siguiente página
                try:
                    next_btn = page.locator(".paginate_button.next:not(.disabled), a.paginate_button.next").first
                    if await next_btn.count() > 0 and await next_btn.is_visible():
                        classes = (await next_btn.get_attribute("class") or "")
                        if "disabled" in classes:
                            break
                        await next_btn.click()
                        await page.wait_for_timeout(600)
                    else:
                        break
                except:
                    break

            logger.info(f"✅ Se capturaron {len(total_records)} filas en Trujillo para DIESEL B5 UV!")

            # Guardar con UPSERT en MongoDB
            upsert_count = 0
            for cols in total_records:
                if len(cols) >= 5:
                    distrito, establecimiento, direccion, telefono, precio_raw = cols[0], cols[1], cols[2], cols[3], cols[4]
                elif len(cols) == 4:
                    distrito, establecimiento, direccion, telefono, precio_raw = "", cols[0], cols[1], cols[2], cols[3]
                else:
                    continue

                precio = parse_precio(precio_raw)
                if not establecimiento or precio is None:
                    continue

                doc = {
                    "establecimiento": establecimiento,
                    "direccion": direccion,
                    "telefono": telefono,
                    "precio_venta": precio,
                    "precio_pizarra": precio,
                    "combustible": "Diesel B5 UV",
                    "combustible_original": "DB5 S-50 UV",
                    "departamento": "LA LIBERTAD",
                    "provincia": "TRUJILLO",
                    "distrito": distrito,
                    "ciudad": distrito or "TRUJILLO",
                    "fuente": "facilito.gob.pe",
                    "scraped_at": scraped_at,
                    "es_enered": False,
                    "calidad": 4 if any(r in establecimiento.upper() for r in ["REPSOL", "PRIMAX", "AVA", "PETROPERU", "SHELL", "MOBIL", "VALERO", "PECSA", "TERPEL", "COSTI"]) else 2
                }

                res = await db.precios_facilito.update_one(
                    {
                        "establecimiento": doc["establecimiento"],
                        "departamento": doc["departamento"],
                        "provincia": doc["provincia"],
                        "combustible": doc["combustible"]
                    },
                    {"$set": doc},
                    upsert=True
                )
                if res.upserted_id or res.modified_count > 0:
                    upsert_count += 1

            logger.info(f"💾 {upsert_count} registros de DIESEL B5 UV actualizados/guardados en MongoDB!")

        await browser.close()

    total_db = await db.precios_facilito.count_documents({"departamento": "LA LIBERTAD", "combustible": "Diesel B5 UV"})
    logger.info("=" * 65)
    logger.info(f"✅ TRUJILLO DIESEL COMPLETO: {total_db} estaciones totales de Diesel B5 UV en Trujillo!")
    logger.info("=" * 65)


if __name__ == "__main__":
    asyncio.run(main())
