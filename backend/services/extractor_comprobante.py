"""
Extractor de datos de comprobantes electrónicos (facturas de combustible).

Cascada, de más fiable a menos:
  1. XML UBL 2.1  → datos exactos, incluidos los GALONES (unitCode GLL). Certeza total.
  2. QR del PDF   → RUC emisor, serie, número, fecha, IGV, total, RUC adquirente (norma SUNAT).
  3. Texto del PDF→ rellena lo que falte (galones, placa, producto).

Lo que se extrae alimenta el formulario que exige la ATU; el usuario siempre puede editarlo.
"""
from __future__ import annotations
import io
import re
import xml.etree.ElementTree as ET
from typing import Optional

_NS = {
    "cbc": "urn:oasis:names:specification:ubl:schema:xsd:CommonBasicComponents-2",
    "cac": "urn:oasis:names:specification:ubl:schema:xsd:CommonAggregateComponents-2",
}
# Placa peruana: ABC-123 / A1B-234 (con o sin guion)
_RE_PLACA = re.compile(r"\b([A-Z]\d[A-Z]|[A-Z]{3})-?(\d{3})\b")
_RE_GAL = re.compile(r"(\d+[.,]\d{1,3})\s*(?:GLL|GAL|GALON|GALONES)\b", re.IGNORECASE)


def _f(v) -> Optional[float]:
    try:
        return float(str(v).replace(",", "").strip())
    except (TypeError, ValueError):
        return None


def _serie_numero(doc_id: str) -> tuple[Optional[str], Optional[str]]:
    """'F003-00000039' → ('F003', '00000039')"""
    m = re.match(r"^\s*([A-Z]{1,4}\d{0,3})\s*-\s*(\d+)\s*$", (doc_id or "").upper())
    return (m.group(1), m.group(2)) if m else (None, None)


# ─────────────────────────────── XML (UBL 2.1) ───────────────────────────────
def extraer_de_xml(contenido: bytes) -> Optional[dict]:
    """Extrae de un XML UBL 2.1. Es la fuente más exacta: incluye galones."""
    try:
        root = ET.fromstring(contenido)
    except ET.ParseError:
        return None

    def t(path: str, node=None) -> Optional[str]:
        el = (node if node is not None else root).find(path, _NS)
        return el.text.strip() if (el is not None and el.text) else None

    doc_id = t("cbc:ID")
    serie, numero = _serie_numero(doc_id or "")
    if not serie:
        return None  # no es una factura UBL válida

    galones, producto, precio_unit = None, None, None
    for ln in root.findall("cac:InvoiceLine", _NS):
        q = ln.find("cbc:InvoicedQuantity", _NS)
        if q is not None and (q.get("unitCode") or "").upper() in ("GLL", "GAL"):
            galones = (galones or 0) + (_f(q.text) or 0)
        if producto is None:
            producto = t("cac:Item/cbc:Description", ln)
        if precio_unit is None:
            precio_unit = _f(t("cac:Price/cbc:PriceAmount", ln))

    # La placa no es obligatoria en el XML, pero a veces va en Note o en la descripción.
    blob = " ".join(filter(None, [t("cbc:Note"), producto or ""]))
    mp = _RE_PLACA.search((blob or "").upper())

    return {
        "fuente": "XML",
        "serie": serie, "numero": numero, "numero_documento": doc_id,
        "fecha": t("cbc:IssueDate"),
        "tipo_comprobante": t("cbc:InvoiceTypeCode"),
        "ruc_emisor": t("cac:AccountingSupplierParty/cac:Party/cac:PartyIdentification/cbc:ID"),
        "razon_social_emisor": t("cac:AccountingSupplierParty/cac:Party/cac:PartyLegalEntity/cbc:RegistrationName"),
        "ruc_adquirente": t("cac:AccountingCustomerParty/cac:Party/cac:PartyIdentification/cbc:ID"),
        "igv": _f(t("cac:TaxTotal/cbc:TaxAmount")),
        "importe_total": _f(t("cac:LegalMonetaryTotal/cbc:PayableAmount")),
        "galones": round(galones, 3) if galones else None,
        "producto": producto,
        "precio_unitario": precio_unit,
        "placa": f"{mp.group(1)}-{mp.group(2)}" if mp else None,
    }


# ─────────────────────────────── QR del PDF ───────────────────────────────
def _qr_de_pdf(contenido: bytes) -> Optional[str]:
    """Lee el QR: primero de las imágenes embebidas (rápido y exacto), luego rasterizando."""
    try:
        import pymupdf
        import zxingcpp
        from PIL import Image
    except ImportError:
        return None

    def _leer(img) -> Optional[str]:
        for r in zxingcpp.read_barcodes(img):
            if r.text and r.text.count("|") >= 6:
                return r.text
        return None

    # Foto o imagen (JPG/PNG/WEBP): se lee el QR directo de la imagen.
    if not contenido[:5].startswith(b"%PDF"):
        try:
            img = Image.open(io.BytesIO(contenido))
            img.load()
            txt = _leer(img.convert("RGB"))
            if txt:
                return txt
            # Fotos grandes: reintenta a mitad de tamaño (mejora el enfoque del QR)
            w, h = img.size
            if max(w, h) > 1800:
                txt = _leer(img.convert("RGB").resize((w // 2, h // 2)))
                if txt:
                    return txt
        except Exception:
            pass
    try:
        doc = pymupdf.open(stream=contenido, filetype="pdf")
    except Exception:
        return None
    try:
        for page in doc:
            for info in page.get_images(full=True):
                try:
                    pix = pymupdf.Pixmap(doc, info[0])
                    if pix.n > 4:
                        pix = pymupdf.Pixmap(pymupdf.csRGB, pix)
                    txt = _leer(Image.open(io.BytesIO(pix.tobytes("png"))))
                    if txt:
                        return txt
                except Exception:
                    continue
        for page in doc:  # fallback: rasterizar la página
            try:
                pix = page.get_pixmap(dpi=300)
                txt = _leer(Image.open(io.BytesIO(pix.tobytes("png"))))
                if txt:
                    return txt
            except Exception:
                continue
    finally:
        doc.close()
    return None


def extraer_de_qr(contenido: bytes) -> Optional[dict]:
    """
    QR obligatorio SUNAT (RS 244-2019, anexo 6):
      RUC | TIPO | SERIE | NÚMERO | IGV | TOTAL | FECHA | TIPO DOC ADQ | NRO DOC ADQ | HASH
    """
    txt = _qr_de_pdf(contenido)
    if not txt:
        return None
    c = [p.strip() for p in txt.split("|")]
    if len(c) < 7 or not re.fullmatch(r"\d{11}", c[0] or ""):
        return None
    # La norma dice RUC|TIPO|SERIE|NÚMERO|IGV|TOTAL|FECHA|…, pero muchos emisores
    # (p.ej. Primax/4-fact) juntan "SERIE-NÚMERO" en un solo campo y todo se corre
    # una posición. Se ancla en la FECHA (único campo con formato inequívoco):
    # los dos anteriores son IGV y TOTAL; lo que queda entre TIPO y ellos es serie/número.
    _es_fecha = lambda x: bool(re.fullmatch(r"(\d{4}-\d{2}-\d{2}|\d{2}/\d{2}/\d{4})", x or ""))
    i_fecha = next((i for i in range(2, len(c)) if _es_fecha(c[i])), None)
    if i_fecha is None or i_fecha < 4:
        return None
    igv, total, fecha = _f(c[i_fecha - 2]), _f(c[i_fecha - 1]), c[i_fecha]
    if re.fullmatch(r"\d{2}/\d{2}/\d{4}", fecha):
        d, m, y = fecha.split("/")
        fecha = f"{y}-{m}-{d}"
    campos_sn = [x for x in c[2:i_fecha - 2] if x]
    if len(campos_sn) >= 2:
        serie, numero = campos_sn[0], campos_sn[1]
    elif len(campos_sn) == 1 and "-" in campos_sn[0]:
        serie, numero = campos_sn[0].split("-", 1)
    elif campos_sn:
        serie, numero = campos_sn[0], None
    else:
        serie = numero = None
    serie = (serie or "").strip().upper() or None
    numero = (numero or "").strip() or None
    resto = c[i_fecha + 1:]
    tipo_doc_adq = resto[0] if len(resto) > 0 and resto[0] else None
    ruc_adq = resto[1] if len(resto) > 1 and re.fullmatch(r"\d{8,11}", resto[1] or "") else None
    hash_ = resto[2].replace(" ", "+") if len(resto) > 2 and resto[2] else None
    # Algunos emisores ponen mal el tipo de comprobante: se deriva de la letra de la serie.
    tipo = "01" if (serie or "").startswith("F") else "03" if (serie or "").startswith("B") else (c[1] or None)
    return {
        "fuente": "QR",
        "ruc_emisor": c[0],
        "tipo_comprobante": tipo,
        "serie": serie, "numero": numero,
        "numero_documento": f"{serie}-{numero}" if serie and numero else None,
        "igv": igv,
        "importe_total": total,
        "fecha": fecha,
        "tipo_doc_adquirente": tipo_doc_adq,
        "ruc_adquirente": ruc_adq,
        # zxing devuelve espacio donde el base64 lleva '+'
        "hash": hash_,
    }


# ─────────────────────────────── Texto del PDF ───────────────────────────────
def extraer_de_texto(contenido: bytes) -> dict:
    """Rellena lo que el QR no trae: galones, placa, producto."""
    texto = ""
    try:
        import pdfplumber
        with pdfplumber.open(io.BytesIO(contenido)) as pdf:
            texto = "\n".join((p.extract_text() or "") for p in pdf.pages[:3])
    except Exception:
        return {}
    up = texto.upper()
    galones = None
    if (mg := _RE_GAL.search(up)):
        galones = _f(mg.group(1).replace(",", "."))
    placa = None
    if (mp := _RE_PLACA.search(up)):
        placa = f"{mp.group(1)}-{mp.group(2)}"
    producto = None
    if (mpr := re.search(r"(DIESEL[\w\s\-\.]{0,20}|GASOHOL[\w\s\-\.]{0,15}|GASOLINA[\w\s\-\.]{0,15})", up)):
        producto = " ".join(mpr.group(1).split())[:40]
    return {"fuente": "TEXTO", "galones": galones, "placa": placa, "producto": producto, "_texto": texto[:2000]}


# ─────────────────────────────── Cascada ───────────────────────────────
def extraer(contenido: bytes, filename: str = "") -> dict:
    """
    Devuelve los datos del comprobante combinando XML → QR → texto,
    con `fuentes` indicando de dónde salió cada dato (para mostrarlo en la UI).
    """
    es_xml = filename.lower().endswith(".xml") or contenido[:200].lstrip().startswith(b"<?xml")
    datos: dict = {}
    fuentes: dict[str, str] = {}

    def _merge(d: Optional[dict]):
        if not d:
            return
        origen = d.get("fuente", "?")
        for k, v in d.items():
            if k in ("fuente", "_texto") or v in (None, ""):
                continue
            if datos.get(k) in (None, ""):
                datos[k] = v
                fuentes[k] = origen

    if es_xml:
        _merge(extraer_de_xml(contenido))
    else:
        _merge(extraer_de_qr(contenido))     # exacto para importes/serie/fecha
        _merge(extraer_de_texto(contenido))  # completa galones/placa/producto

    datos["fuentes"] = fuentes
    datos["extraccion_ok"] = bool(datos.get("numero_documento") or datos.get("serie"))
    return datos
