"""
Script de prueba del scraper de Facilito.
Ejecutar desde la carpeta backend:
  python test_facilito_scraper.py

Primero instalar dependencias si no las tienes:
  pip install beautifulsoup4 lxml httpx
"""

import sys
import os
import time
sys.path.insert(0, os.path.dirname(__file__))

from services.facilito_scraper import (
    DEPARTAMENTOS,
    COMBUSTIBLES,
    MAIN_PAGE_URL,
    BASE_URL,
    HEADERS,
    TIMEOUT_SECONDS,
    _parse_precio,
)
from bs4 import BeautifulSoup
import httpx


def test_parse_precio():
    assert _parse_precio("18.40") == 18.40
    assert _parse_precio("S/ 22.39") == 22.39
    assert _parse_precio("22,39") == 22.39
    assert _parse_precio("1.022,39") == 1022.39
    assert _parse_precio("") is None
    assert _parse_precio(None) is None
    print("✅ _parse_precio: OK")


def test_scrape_debug():
    """
    Prueba la conexión con Facilito y guarda el HTML de respuesta
    para inspección. Muy útil para entender la estructura de la tabla.
    """
    dpto = {"code": "130000", "name": "LA LIBERTAD"}
    combustible = "DB5 S-50 UV"

    payload = {
        "departamento_elegido": dpto["code"],
        "provincia": "",
        "distrito": "",
        "combustible": combustible,
        "nameRedirectfile": "buscadorEESS",
        "g-recaptcha-response": "",
    }

    print(f"\n🌐 Conectando con Facilito OSINERGMIN...")

    with httpx.Client(headers=HEADERS, follow_redirects=True) as session:
        # Paso 1: GET para obtener cookies de sesión
        print(f"  → GET {MAIN_PAGE_URL}")
        try:
            r0 = session.get(MAIN_PAGE_URL, timeout=TIMEOUT_SECONDS)
            print(f"  → Status sesión: {r0.status_code} | Cookies: {dict(session.cookies)}")
            time.sleep(1.5)
        except Exception as e:
            print(f"  ⚠️  Error en GET inicial: {e}")

        # Paso 2: POST con los datos de búsqueda
        print(f"  → POST {BASE_URL}")
        print(f"     Payload: {payload}")
        try:
            response = session.post(BASE_URL, data=payload, timeout=TIMEOUT_SECONDS)
            print(f"  → Status POST: {response.status_code}")
            print(f"  → URL final (tras redirecciones): {response.url}")
            print(f"  → Content-Type: {response.headers.get('content-type', '?')}")
            print(f"  → Tamaño respuesta: {len(response.text)} chars")
        except Exception as e:
            print(f"  ❌ Error en POST: {e}")
            return

    # Guardar HTML para inspección
    html_path = os.path.join(os.path.dirname(__file__), "debug_facilito_response.html")
    with open(html_path, "w", encoding="utf-8") as f:
        f.write(response.text)
    print(f"\n💾 HTML guardado en: {html_path}")
    print("   Abre ese archivo en el navegador para ver qué devuelve el servidor.\n")

    # Analizar el HTML
    soup = BeautifulSoup(response.text, "lxml")

    # Listar todas las tablas encontradas
    tables = soup.find_all("table")
    print(f"📊 Tablas encontradas en el HTML: {len(tables)}")
    for i, t in enumerate(tables):
        rows = t.find_all("tr")
        attrs = dict(t.attrs)
        print(f"  Tabla {i}: id={attrs.get('id','?')} class={attrs.get('class','?')} | {len(rows)} filas")
        if rows:
            first_row_text = " | ".join(td.get_text(strip=True) for td in rows[0].find_all(["th","td"]))
            print(f"    Primera fila: {first_row_text[:120]}")

    # Listar forms
    forms = soup.find_all("form")
    print(f"\n📝 Forms encontrados: {len(forms)}")
    for f in forms:
        print(f"  action={f.get('action','?')} method={f.get('method','?')}")

    # Buscar algún precio en el texto
    import re
    precios_en_texto = re.findall(r'\d{1,2}[.,]\d{2}', response.text)
    if precios_en_texto:
        print(f"\n💰 Precios potenciales en el HTML: {precios_en_texto[:10]}")
    else:
        print("\n⚠️  No se encontraron números de precio en el HTML.")
        print("   Posibles causas:")
        print("   1. El sitio requiere reCAPTCHA válido")
        print("   2. Los datos se cargan por JavaScript (AJAX) después de cargar la página")
        print("   3. La URL de la acción es diferente")

    # Verificar si hay scripts AJAX
    scripts = soup.find_all("script", src=True)
    print(f"\n📜 Scripts externos: {len(scripts)}")
    for s in scripts[:5]:
        print(f"  {s.get('src','')}")


if __name__ == "__main__":
    print("=" * 60)
    print("TEST: Facilito OSINERGMIN Scraper (con debug)")
    print("=" * 60)

    test_parse_precio()
    test_scrape_debug()

    print("\n" + "=" * 60)
    print("✅ Tests completados")
    print("=" * 60)
