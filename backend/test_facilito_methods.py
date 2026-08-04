"""
Diagnostic script to test Facilito OSINERGMIN action endpoints and parameters.
"""
import httpx
from bs4 import BeautifulSoup
import re

BASE_URL = "https://www.facilito.gob.pe/facilito/actions/PreciosCombustibleAutomotorAction.do"
MAIN_URL = "https://www.facilito.gob.pe/facilito/pages/facilito/buscadorEESS.jsp"

HEADERS = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36",
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    "Referer": MAIN_URL,
}

with httpx.Client(headers=HEADERS, follow_redirects=True) as client:
    # 1. Warm up
    r1 = client.get(MAIN_URL)
    print("GET Main Page Status:", r1.status_code)

    # 2. Select Department (La Libertad = 130000, Arequipa = 40000)
    p1 = {
        "departamento_elegido": "40000",
        "nameRedirectfile": "buscadorEESS",
    }
    r2 = client.post(f"{BASE_URL}?method=inicio", data=p1)
    print("POST Step 1 (Dept 40000) Status:", r2.status_code, "URL:", r2.url)
    
    soup2 = BeautifulSoup(r2.text, "lxml")
    
    # Print forms and inputs
    forms = soup2.find_all("form")
    print(f"\nFound {len(forms)} forms in step 1 response:")
    for f in forms:
        print("  Form action:", f.get("action"), "method:", f.get("method"))
        inputs = f.find_all(["input", "select"])
        for inp in inputs:
            print(f"    - {inp.get('name')}: tag={inp.name} type={inp.get('type')} value={inp.get('value','')[:30]}")
            if inp.name == "select":
                opts = [o.get_text(strip=True) for o in inp.find_all("option")]
                print(f"      options ({len(opts)}): {opts[:5]}")

    # Check for script functions in step 2 response
    scripts = soup2.find_all("script")
    print(f"\nSearching inline scripts for form actions / methods:")
    for s in scripts:
        text = s.get_text()
        if "action" in text or "method" in text or "submit" in text or "function" in text:
            for line in text.splitlines():
                if any(k in line for k in ["action", "method", "submit", "Precios", ".do"]):
                    print("  JS Line:", line.strip())
