import httpx
from bs4 import BeautifulSoup

url = "https://www.facilito.gob.pe/facilito/actions/PreciosCombustibleAutomotorAction.do?method=inicio"

headers = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36",
    "Referer": "https://www.facilito.gob.pe/facilito/pages/facilito/buscadorEESS.jsp",
    "Content-Type": "application/x-www-form-urlencoded"
}

payload = {
    "departamento": "130000", # LA LIBERTAD
    "provincia": "130100",    # TRUJILLO
    "distrito": "0",
    "producto": "DB5 S-50 UV",
    "idProducto": "1",
    "metodo": "buscar"
}

with httpx.Client(follow_redirects=True, headers=headers) as client:
    # Get main session cookies
    r1 = client.get("https://www.facilito.gob.pe/facilito/pages/facilito/buscadorEESS.jsp")
    print("Page 1 status:", r1.status_code)
    
    r2 = client.post(url, data=payload)
    print("Post status:", r2.status_code)
    print("Length of response:", len(r2.text))
    
    soup = BeautifulSoup(r2.text, "html.parser")
    tables = soup.find_all("table")
    print("Tables found:", len(tables))
    for t in tables:
        rows = t.find_all("tr")
        print("Rows in table:", len(rows))
        for row in rows[:5]:
            cols = [td.get_text(strip=True) for td in row.find_all(["td", "th"])]
            print("Row:", cols)
