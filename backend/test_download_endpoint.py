import httpx
try:
    r = httpx.get("http://localhost:8000/api/admin/subsidio/invoices/F021-00000645/download")
    print("STATUS:", r.status_code)
    print("CONTENT TYPE:", r.headers.get("content-type"))
    print("BODY HEAD:", r.content[:100])
except Exception as e:
    print("ERROR:", e)
