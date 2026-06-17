import io
import re
import pdfplumber


async def extract_invoice_data(content, content_type, session_id=None):

    text = ""

    with pdfplumber.open(io.BytesIO(content)) as pdf:
        for page in pdf.pages:
            t = page.extract_text()
            if t:
                text += t + "\n"

    fecha = None
    m = re.search(r'(\d{2}/\d{2}/\d{4})', text)
    if m:
        fecha = m.group(1)

    ruc = None
    m = re.search(r'RUC[:\s]+(\d{11})', text, re.IGNORECASE)
    if m:
        ruc = m.group(1)

    documento = None
    m = re.search(r'F\d{3}-\d+', text)
    if m:
        documento = m.group(0)

    galones = None
    m = re.search(r'(\d+\.\d+)\s*Gal', text, re.IGNORECASE)
    if m:
        galones = float(m.group(1))

    importe = None
    m = re.search(r'Total\s*S/\s*([\d,]+\.\d+)', text)
    if m:
        importe = float(m.group(1).replace(",", ""))

    precio = None
    m = re.search(r'Gal\s+([\d\.]+)\s+IGV', text)
    if m:
        precio = float(m.group(1))

    placa = None
    m = re.search(r'PLACA[:\s]+([A-Z0-9\-]+)', text)
    if m:
        placa = m.group(1)

    producto = None
    m = re.search(r'(DIESEL\s+B5.*?|GASOHOL.*?)(\d+\.\d+\s*Gal)', text, re.IGNORECASE)
    if m:
        producto = m.group(1).strip()

    return {
        "extracted": {
            "fecha": fecha,
            "hora": None,
            "estacion": None,
            "ciudad": None,
            "ruc_emisor": ruc,
            "placa": placa,
            "producto": producto,
            "galones": galones,
            "precio_unitario": precio,
            "importe_total": importe,
            "numero_documento": documento,
            "confianza": 0.95
        },
        "raw_response": text
    }
