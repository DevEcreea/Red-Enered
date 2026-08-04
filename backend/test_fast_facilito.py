"""
test_fast_facilito.py
Test if selecting ONLY Department + Product (without Province) loads all stations for the Department.
"""
import asyncio
from playwright.async_api import async_playwright

async def main():
    async with async_playwright() as pw:
        browser = await pw.chromium.launch(headless=False)
        context = await browser.new_context()
        page = await context.new_page()

        print("Abriendo mapa...")
        await page.goto("https://www.facilito.gob.pe/facilito/pages/facilito/buscadorEESS.jsp")
        await page.wait_for_timeout(2000)

        print("Haciendo click en Lima (code=150000)...")
        await page.evaluate("makeAction('150000')")
        await page.wait_for_load_state("networkidle")
        await page.wait_for_timeout(2000)

        selects = page.locator("select")
        n = await selects.count()
        print(f"Selects disponibles: {n}")

        prod_select = selects.nth(3) if n >= 4 else selects.nth(n-1)

        # Seleccionar Producto "DB5 S-50 UV" SIN seleccionar Provincia
        print("Seleccionando producto DB5 S-50 UV directamente...")
        try:
            await prod_select.select_option(label="DB5 S-50 UV")
        except:
            opts = await prod_select.locator("option").all()
            for opt in opts:
                if "DB5" in (await opt.inner_text()):
                    val = await opt.get_attribute("value")
                    await prod_select.select_option(value=val)
                    break

        await page.wait_for_timeout(2000)

        # Verificar si aparecieron registros en la tabla
        trs = await page.query_selector_all("table tbody tr")
        print(f"Filas en la tabla: {len(trs)}")
        for tr in trs[:5]:
            tds = await tr.query_selector_all("td")
            txts = [(await td.inner_text()).strip() for td in tds]
            print("  Row:", txts)

        await browser.close()

if __name__ == "__main__":
    asyncio.run(main())
