"""
auto_fast_scraper.py - EXTRACCIÓN AUTOMÁTICA ULTRA RÁPIDA (DIESEL + TODOS)
==========================================================================
Navega automáticamente en la página de resultados de Facilito:
  1. Abre el navegador y entra a la pantalla de resultados.
  2. Recorre automáticamente todos los Departamentos, Provincias y Productos (DB5 S-50 UV, Regular, Premium).
  3. Extrae todas las estaciones (con todas sus páginas de DataTables).
  4. Hace UPSERT en MongoDB sin borrar ningún dato previo.
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
                if (dt.page.len() < 100) {
                    dt.page.len(100).draw(false);
                }
            }
        }
    } catch(e) {}

    var selects = document.querySelectorAll("select");
    var dpto = "", prov = "", prod = "";
    if (selects.length >= 1 && selects[0].selectedIndex >= 0) dpto = selects[0].options[selects[0].selectedIndex].text;
    if (selects.length >= 2 && selects[1].selectedIndex >= 0) prov = selects[1].options[selects[1].selectedIndex].text;
    if (selects.length >= 4 && selects[3].selectedIndex >= 0) prod = selects[3].options[selects[3].selectedIndex].text;
    else if (selects.length >= 3 && selects[2].selectedIndex >= 0) prod = selects[2].options[selects[2].selectedIndex].text;

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

    return {
        dpto: dpto.trim().toUpperCase(),
        prov: prov.trim().toUpperCase(),
        prod: prod.trim().toUpperCase(),
        rows: rows
    };
}
"""


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


async def main():
    logger.info("=" * 65)
    logger.info("⚡ AUTO FAST SCRAPER (DIESEL + TODOS LOS COMBUSTIBLES) ⚡")
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

        logger.info("👉 HACIENDO CLIC EN EL MAPA PARA ENTRAR A RESULTADOS...")
        await page.wait_for_timeout(1500)
        try:
            # Hacer clic en cualquier región del mapa SVG
            path = page.locator("path, polygon, g").first
            if await path.count() > 0:
                await path.click(force=True)
                await page.wait_for_timeout(2000)
        except:
            pass

        # Esperar a que la página de resultados tenga los dropdowns de dpto, prov, prod
        for _ in range(30):
            if await page.locator("select").count() >= 2:
                break
            await page.wait_for_timeout(500)

        selects = page.locator("select")
        n_selects = await selects.count()
        if n_selects < 2:
            logger.error("No se detectaron dropdowns. Por favor haz 1 clic en el mapa manualmente.")
            await page.wait_for_selector("select", timeout=30000)
            selects = page.locator("select")

        dpto_select = selects.nth(0)
        dptos = await get_options(dpto_select)
        logger.info(f"Departamentos detectados ({len(dptos)}): {[d['label'] for d in dptos[:10]]}...")

        total_upserted = 0

        for d_idx, dpto in enumerate(dptos, 1):
            logger.info(f"\n[{d_idx}/{len(dptos)}] 🏢 DEPARTAMENTO: {dpto['label']}")

            try:
                selects = page.locator("select")
                await selects.nth(0).select_option(value=dpto["value"])
                await page.wait_for_timeout(1200)
            except Exception as e:
                logger.warning(f"  Error cambiando Dpto {dpto['label']}: {e}")
                continue

            selects = page.locator("select")
            n_sel = await selects.count()
            if n_sel < 2:
                continue

            prov_select = selects.nth(1)
            provincias = await get_options(prov_select)

            for p_info in provincias:
                try:
                    selects = page.locator("select")
                    await selects.nth(1).select_option(value=p_info["value"])
                    await page.wait_for_timeout(800)
                except:
                    continue

                selects = page.locator("select")
                n_sel = await selects.count()
                prod_select = selects.nth(3) if n_sel >= 4 else selects.nth(n_sel - 1)
                productos = await get_options(prod_select)

                for prod in productos:
                    try:
                        selects = page.locator("select")
                        n_sel = await selects.count()
                        prod_sel = selects.nth(3) if n_sel >= 4 else selects.nth(n_sel - 1)
                        await prod_sel.select_option(value=prod["value"])
                        await page.wait_for_timeout(1000)

                        # Extraer datos en JS 50ms
                        data = await page.evaluate(JS_FAST_EXTRACTOR)
                        rows = data.get("rows", [])

                        count_prov = 0
                        for cols in rows:
                            if len(cols) >= 5:
                                distrito, establecimiento, direccion, telefono, precio_raw = cols[0], cols[1], cols[2], cols[3], cols[4]
                            elif len(cols) == 4:
                                distrito, establecimiento, direccion, telefono, precio_raw = "", cols[0], cols[1], cols[2], cols[3]
                            else:
                                continue

                            precio = parse_precio(precio_raw)
                            if not establecimiento or precio is None:
                                continue

                            prod_label = prod["label"]
                            prod_clean = "Diesel B5 UV"
                            p_upper = prod_label.upper()
                            if any(k in p_upper for k in ["PREMIUM", "95", "97", "98"]):
                                prod_clean = "Gasohol Premium"
                            elif any(k in p_upper for k in ["REGULAR", "84", "90"]):
                                prod_clean = "Gasohol Regular"

                            doc = {
                                "establecimiento": establecimiento,
                                "direccion": direccion,
                                "telefono": telefono,
                                "precio_venta": precio,
                                "precio_pizarra": precio,
                                "combustible": prod_clean,
                                "combustible_original": prod_label,
                                "departamento": dpto["label"],
                                "provincia": p_info["label"],
                                "distrito": distrito,
                                "ciudad": distrito or p_info["label"],
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
                                total_upserted += 1
                                count_prov += 1

                        if len(rows) > 0:
                            logger.info(f"    ✅ {p_info['label']} | {prod['label']} -> {len(rows)} estaciones guardadas")

                    except Exception as ex:
                        pass

        await browser.close()

    total_db = await db.precios_facilito.count_documents({})
    logger.info("=" * 65)
    logger.info(f"✅ EXTRACCIÓN COMPLETADA: {total_db} estaciones totales en MongoDB!")
    logger.info("=" * 65)


if __name__ == "__main__":
    asyncio.run(main())
