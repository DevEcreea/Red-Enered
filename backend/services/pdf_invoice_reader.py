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
    m = re.search(
        r'Fecha de (?:emisión|factura)\s+(\d{2}/\d{2}/\d{4})',
        text,
        re. IGNORECASE
    )
    if m:
        fecha = m.group(1)


    estacion = None
    
    # Try to find RUC of issuer (often doesn't have a colon)
    ruc = None
    m = re.search(r'RUC\s+(20\d{9})', text, re.IGNORECASE)
    if m:
        ruc = m.group(1)
    else:
        # Fallback to any 20... RUC
        m = re.search(r'\b(20\d{9})\b', text)
        if m:
            ruc = m.group(1)
            
    # For Estacion, try to look for the line below 'Factura electronica'
    m = re.search(r'Factura\s+electrónica[^\n]*\n([^\n]+)', text, re.IGNORECASE)
    if m:
        est = m.group(1).strip()
        if "enered" in est.lower() or "soluciones integrales" in est.lower():
            m2 = re.search(r'Factura\s+electrónica[^\n]*\n[^\n]+\n([^\n]+)', text, re.IGNORECASE)
            if m2:
                estacion = m2.group(1).strip()
            else:
                estacion = est
        else:
            estacion = est

    if not estacion and ruc:
        # Fallback: line before RUC
        m = re.search(r'([^\n]+)\n\s*(?:RUC)?\s*' + ruc, text, re.IGNORECASE)
        if m:
            estacion = m.group(1).strip()
            if estacion.lower() in ["perú", "peru", "lima"]:
                estacion = None

    ciudad = None
    ciudades = [
        "Trujillo", "Lima", "Huancayo", "Arequipa", "Chiclayo", 
        "Piura", "Cusco", "Chimbote", "Nuevo Chimbote"
    ]
    for c in ciudades:
        if c.lower() in text.lower():
            ciudad = c
            break

    documento = None
    m = re.search(r'[FB]\d{3}-\d+', text, re.IGNORECASE)
    if m:
        documento = m.group(0).upper()

    galones = None
    m = re.search(r'(\d+\.\d+)\s*Gal', text, re.IGNORECASE)
    if m:
        galones = float(m.group(1))

    importe = None
    m = re.search(r'Total\s*S/\s*([\d,]+\.\d+)', text)
    if m:
        importe = float(m.group(1).replace(",", ""))

    precio = None
    # Try format: Gal 16.805085 IGV
    m = re.search(r'Gal\s+([\d\.]+)\s+IGV', text, re.IGNORECASE)
    if m:
        precio = float(m.group(1))
    else:
        # Try finding a price near the galones
        m = re.search(r'(\d+\.\d+)\s*Gal\s+([\d\.]+)', text, re.IGNORECASE)
        if m:
            precio = float(m.group(2))

    placa = None
    m = re.search(r'PLACA[:\s]+([A-Z0-9\-]+)', text, re.IGNORECASE)
    if m:
        placa = m.group(1)

    producto = None
    m = re.search(r'(DIESEL.*?|GASOHOL.*?)\s*\d+\.\d+\s*Gal', text, re.IGNORECASE)
    if m:
        producto = m.group(1).strip()
        # Clean up any trailing stuff
        producto = re.sub(r'(\s+S-50|\s+B5|\s+B20).*', r'\1', producto).strip()

    return {
        "extracted": {
            "fecha": fecha,
            "fecha_vencimiento": fecha,
            "estacion": estacion,
            "ciudad": ciudad,
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
