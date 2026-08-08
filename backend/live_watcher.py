"""
live_watcher.py - MODO MANUAL INTERACTIVO (CON UPSERT ETERNO)
===============================================================
¡TÚ TIENEN EL CONTROL TOTAL DEL NAVEGADOR!

Mejora clave:
  Usa UPSERT en MongoDB. Cada clic que hagas en cualquier
  departamento, provincia o combustible SE GUARDA PARA SIEMPRE
  sin borrar jamás lo que ya tenías acumulado.

Uso:
    python live_watcher.py
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


async def main():
    logger.info("=" * 65)
    logger.info("🔥 FACILITO LIVE WATCHER - MODO INTERACTIVO MANUAL 🔥")
    logger.info("=" * 65)

    from playwright.async_api import async_playwright
    client = motor.motor_asyncio.AsyncIOMotorClient(MONGO_URL)
    db = client[DB_NAME]

    last_hash = ""
    scraped_at = datetime.now(timezone.utc).isoformat()

    async with async_playwright() as pw:
        browser = await pw.chromium.launch(
            headless=False,
            args=["--window-size=1366,768", "--start-maximized"],
        )
        context = await browser.new_context(
            user_agent="Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/126.0.0.0 Safari/537.36",
            locale="es-PE",
        )
        page = await context.new_page()

        logger.info("Abriendo Facilito...")
        await page.goto(MAP_URL, wait_until="domcontentloaded", timeout=30000)

        print("\n" + "="*65)
        print("🎯 ¡MODO MANUAL ACTIVADO CON GUARDA ETERNA (UPSERT)!")
        print("   1. Haz 1 clic en el mapa para entrar.")
        print("   2. Selecciona cualquier Departamento, Provincia o Combustible.")
        print("   3. Si la tabla tiene varias páginas (1, 2, 3...), haz clic en los números")
        print("      para que capture el 100% de las estaciones de esa vista.")
        print("   4. Cada estación se acumula en MongoDB sin borrar jamás nada.")
        print("="*65 + "\n")

        while True:
            try:
                data = await page.evaluate(JS_FAST_EXTRACTOR)
                rows = data.get("rows", [])
                dpto = data.get("dpto", "GENERAL")
                prov = data.get("prov", "GENERAL")
                prod = data.get("prod", "COMBUSTIBLE")

                if rows:
                    current_hash = f"{dpto}|{prov}|{prod}|{len(rows)}|{rows[0][1] if len(rows[0])>1 else ''}"

                    if current_hash != last_hash:
                        last_hash = current_hash

                        prod_clean = "Diesel B5 UV"
                        p_upper = prod.upper()
                        if any(k in p_upper for k in ["PREMIUM", "95", "97", "98"]):
                            prod_clean = "Gasohol Premium"
                        elif any(k in p_upper for k in ["REGULAR", "84", "90"]):
                            prod_clean = "Gasohol Regular"

                        count_new = 0
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

                            doc = {
                                "establecimiento": establecimiento,
                                "direccion": direccion,
                                "telefono": telefono,
                                "precio_venta": precio,
                                "precio_pizarra": precio,
                                "combustible": prod_clean,
                                "combustible_original": prod,
                                "departamento": dpto,
                                "provincia": prov,
                                "distrito": distrito,
                                "ciudad": distrito or prov,
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
                                count_new += 1

                        total_db = await db.precios_facilito.count_documents({})
                        logger.info(f"✅ CAPTURADAS {len(rows)} ESTACIONES en [{dpto} / {prov} / {prod}]")
                        logger.info(f"   💾 Acumulado Total en MongoDB: {total_db} estaciones guardadas")

            except Exception as e:
                pass

            await asyncio.sleep(0.2)


if __name__ == "__main__":
    try:
        asyncio.run(main())
    except KeyboardInterrupt:
        print("\nPrograma finalizado por el usuario.")
