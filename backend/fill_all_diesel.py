"""
fill_all_diesel.py
===================
Recorre automáticamente los departamentos y provincias en Facilito para
extraer el 100% de estaciones de DIESEL B5 UV (y Gasohol Regular / Premium),
haciendo upsert en MongoDB sin borrar nunca ningún dato existente.
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

DEPARTAMENTOS = [
    {"code": "130000", "name": "LA LIBERTAD"},
    {"code": "150000", "name": "LIMA"},
    {"code": "40000",  "name": "AREQUIPA"},
    {"code": "200000", "name": "PIURA"},
    {"code": "140000", "name": "LAMBAYEQUE"},
    {"code": "20000",  "name": "ANCASH"},
    {"code": "80000",  "name": "CUSCO"},
    {"code": "70000",  "name": "CALLAO"},
    {"code": "110000", "name": "ICA"},
    {"code": "120000", "name": "JUNIN"},
    {"code": "10000",  "name": "AMAZONAS"},
    {"code": "30000",  "name": "APURIMAC"},
    {"code": "50000",  "name": "AYACUCHO"},
    {"code": "60000",  "name": "CAJAMARCA"},
    {"code": "90000",  "name": "HUANCAVELICA"},
    {"code": "100000", "name": "HUANUCO"},
    {"code": "160000", "name": "LORETO"},
    {"code": "170000", "name": "MADRE DE DIOS"},
    {"code": "180000", "name": "MOQUEGUA"},
    {"code": "190000", "name": "PASCO"},
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

async def main():
    logger.info("=" * 65)
    logger.info("⛽ EXTRACCIÓN MASIVA DE DIESEL B5 UV Y DÁS DE COMBUSTIBLES ⛽")
    logger.info("=" * 65)

    from playwright.async_api import async_playwright
    client = motor.motor_asyncio.AsyncIOMotorClient(MONGO_URL)
    db = client[DB_NAME]

    scraped_at = datetime.now(timezone.utc).isoformat()
    total_added = 0

    async with async_playwright() as pw:
        browser = await pw.chromium.launch(headless=False)
        context = await browser.new_context(viewport={"width": 1366, "height": 768}, locale="es-PE")
        page = await context.new_page()

        for dpto in DEPARTAMENTOS:
            dpto_name = dpto["name"]
            dpto_code = dpto["code"]
            logger.info(f"\nProcesando Departamento: {dpto_name}...")

            try:
                await page.goto(MAP_URL, wait_until="domcontentloaded", timeout=25000)
                await page.wait_for_timeout(800)
                await page.evaluate(f"makeAction('{dpto_code}')")
                await page.wait_for_load_state("networkidle", timeout=15000)
                await page.wait_for_timeout(1000)
            except Exception as e:
                logger.warning(f"Error accediendo a {dpto_name}: {e}")
                continue

            selects = page.locator("select")
            if await selects.count() < 2:
                continue

            prov_select = selects.nth(1)
            opts = await prov_select.locator("option").all()
            provincias = []
            for o in opts:
                val = (await o.get_attribute("value") or "").strip()
                txt = (await o.inner_text()).strip()
                if val and val not in ("0", "-1") and "seleccione" not in txt.lower():
                    provincias.append({"value": val, "label": txt})

            logger.info(f"  {len(provincias)} provincias en {dpto_name}: {[p['label'] for p in provincias]}")

            for p_info in provincias:
                try:
                    selects = page.locator("select")
                    prov_select = selects.nth(1)
                    await prov_select.select_option(value=p_info["value"])
                    await page.wait_for_timeout(800)
                except Exception as e:
                    continue

                # Recorrer productos (dando prioridad a DIESEL / DB5 S-50 UV)
                selects = page.locator("select")
                n_sel = await selects.count()
                prod_select = selects.nth(3) if n_sel >= 4 else selects.nth(n_sel - 1)
                prod_opts = await prod_select.locator("option").all()

                for p_opt in prod_opts:
                    p_val = (await p_opt.get_attribute("value") or "").strip()
                    p_label = (await p_opt.inner_text()).strip()
                    if not p_val or p_val in ("0", "-1") or "seleccione" in p_label.lower():
                        continue

                    try:
                        selects = page.locator("select")
                        n_sel = await selects.count()
                        prod_sel = selects.nth(3) if n_sel >= 4 else selects.nth(n_sel - 1)
                        await prod_sel.select_option(value=p_val)
                        await page.wait_for_timeout(1200)

                        # Extraer con JS fast
                        data = await page.evaluate(JS_FAST_EXTRACTOR)
                        rows = data.get("rows", [])

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

                            # Normalizar combustible
                            prod_clean = "Diesel B5 UV"
                            p_upper = p_label.upper()
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
                                "combustible_original": p_label,
                                "departamento": dpto_name,
                                "provincia": p_info["label"],
                                "distrito": distrito,
                                "ciudad": distrito or p_info["label"],
                                "fuente": "facilito.gob.pe",
                                "scraped_at": scraped_at,
                                "es_enered": False,
                                "calidad": 4 if any(r in establecimiento.upper() for r in ["REPSOL", "PRIMAX", "AVA", "PETROPERU", "SHELL", "MOBIL", "VALERO", "PECSA", "TERPEL", "COSTI"]) else 2
                            }

                            # UPSERT en MongoDB por llave única
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
                                total_added += 1

                        if rows:
                            logger.info(f"    ✅ {p_info['label']} | {p_label} -> {len(rows)} estaciones extraídas")

                    except Exception as ex:
                        pass

        await browser.close()

    total_db = await db.precios_facilito.count_documents({})
    logger.info("=" * 65)
    logger.info(f"✅ EXTRACCIÓN MASIVA COMPLETA: {total_db} estaciones totales en MongoDB!")
    logger.info("=" * 65)

if __name__ == "__main__":
    asyncio.run(main())
