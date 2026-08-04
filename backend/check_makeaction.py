import httpx

r = httpx.get("https://www.facilito.gob.pe/facilito/pages/facilito/buscadorEESS.jsp")
print("Status:", r.status_code)
for line in r.text.splitlines():
    if "makeAction" in line or "function" in line or "grecaptcha" in line or "submit" in line:
        print("  ", line.strip())
