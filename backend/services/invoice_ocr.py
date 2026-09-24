"""Invoice OCR service using Gemini Vision via emergentintegrations.
Extracts structured data from fuel invoice images / PDFs.
"""
from __future__ import annotations

import os
import io
import json
import base64
import logging
import tempfile
from typing import Optional

logger = logging.getLogger("enered.invoice_ocr")

OCR_PROMPT = """Eres un asistente experto en extraer datos de FACTURAS ELECTRÓNICAS de COMBUSTIBLE peruanas (SUNAT).

Analiza la imagen de la factura adjunta y devuelve EXCLUSIVAMENTE un JSON válido con estos campos:

{
  "fecha": "YYYY-MM-DD" (extrae la Fecha de Emisión, usa SIEMPRE formato YYYY-MM-DD. Ej: 2026-04-21),
  "fecha_vencimiento": "YYYY-MM-DD" (extrae la Fecha de Vencimiento si la hay, sino usa la de emisión),
  "hora": "HH:MM" (hora de la transacción si aparece, sino null),
  "ruc_emisor": "RUC de quien EMITE la factura: el grifo/estación (11 dígitos)",
  "ruc_cliente": "RUC del cliente/receptor (11 dígitos, obligatorio)",
  "estacion": "Nombre comercial del grifo o estación de servicio que emite",
  "ciudad": "Ciudad o distrito del grifo",
  "placa": "Placa del vehículo (formato ABC-123). Búscala en la descripción del ítem, glosa u observaciones. Si no aparece, null",
  "producto": "Nombre del combustible (ej: DIESEL B5 S-50, GASOHOL REGULAR, etc)",
  "galones": número decimal (CANTIDAD de combustible en GALONES. Es la cantidad/unidades del ítem, normalmente con unidad GLL o GAL. Ej: 172.487. OBLIGATORIO si aparece),
  "precio_unitario": número decimal (Precio por galón, sin IGV o con IGV según figure. Ej: 24.86),
  "importe_total": número decimal (Total a pagar, sin IGV aparte, solo el TOTAL final. Ej: 1540.50),
  "numero_documento": "Serie-Correlativo exacto (ej: F003-00000219)",
  "confianza": número entre 0 y 1 (qué tan seguro estás de la extracción)
}

REGLAS ESTRICTAS:
- No devuelvas texto adicional, solo el objeto JSON limpio.
- El importe_total DEBE ser un número decimal con punto, NO con coma, sin símbolo de moneda.
- Respeta estrictamente el formato YYYY-MM-DD en las fechas (AÑO-MES-DIA).
- numero_documento debe conservar los ceros a la izquierda (ej: F003-00000219).
- galones y precio_unitario son números decimales con punto, sin unidades ni símbolos.
- No confundas ruc_emisor (el grifo que emite) con ruc_cliente (el transportista que compra).
- Si un dato no existe, devuelve null.
"""


def _ensure_load_dotenv():
    try:
        from dotenv import load_dotenv
        from pathlib import Path
        load_dotenv(Path(__file__).parent.parent / ".env")
    except Exception:
        pass


def _emergent_key() -> str:
    _ensure_load_dotenv()
    key = os.environ.get("EMERGENT_LLM_KEY")
    if not key:
        raise RuntimeError("LLM_KEY no encontrada. Agrega EMERGENT_LLM_KEY en tu archivo .env")
    return key


def _pdf_first_page_to_png_bytes(pdf_bytes: bytes) -> Optional[bytes]:
    """Primera página del PDF → PNG. Usa PyMuPDF (sin dependencias del sistema, funciona en Render)
    y solo si falla cae a pdf2image (necesita poppler). Rasteriza a ~2000 px en el lado largo para
    que una foto de celular envuelta en PDF llegue nítida al modelo de visión."""
    try:
        try:
            import pymupdf
        except ImportError:  # versiones antiguas
            import fitz as pymupdf
        with pymupdf.open(stream=pdf_bytes, filetype="pdf") as doc:
            if doc.page_count == 0:
                return None
            page = doc[0]
            lado = max(page.rect.width, page.rect.height) or 1
            zoom = max(1.0, min(4.0, 2000.0 / lado))
            # JPEG: una foto de celular en PNG pasa fácil de 5 MB (límite de los modelos de visión)
            return page.get_pixmap(matrix=pymupdf.Matrix(zoom, zoom), alpha=False).tobytes("jpeg", jpg_quality=92)
    except Exception as e:
        logger.warning(f"PDF→PNG con PyMuPDF falló ({e}); intento con pdf2image")
    try:
        from pdf2image import convert_from_bytes
        images = convert_from_bytes(pdf_bytes, dpi=200, first_page=1, last_page=1)
        if not images:
            return None
        buf = io.BytesIO()
        images[0].save(buf, format="PNG")
        return buf.getvalue()
    except Exception as e:
        logger.warning(f"PDF→PNG falló: {e}")
        return None


def _normalize_to_image(content: bytes, content_type: str) -> tuple[bytes, str]:
    """Returns (image_bytes, mime). Converts PDF to PNG first page."""
    ct = (content_type or "").lower()
    if "pdf" in ct or content[:4] == b"%PDF":
        png = _pdf_first_page_to_png_bytes(content)
        if not png:
            raise RuntimeError("No se pudo convertir el PDF a imagen. Sube el comprobante como imagen JPG/PNG.")
        return png, "image/png"
    # Image (jpg/png/webp). Trust content_type if reasonable.
    if "jpeg" in ct or "jpg" in ct:
        return content, "image/jpeg"
    if "png" in ct:
        return content, "image/png"
    if "webp" in ct:
        return content, "image/webp"
    # Default to png
    return content, "image/png"


def _proveedor_vision() -> str:
    """Motor de visión disponible según la clave configurada: 'claude' (ANTHROPIC_API_KEY),
    'gemini' (GOOGLE_API_KEY / GEMINI_API_KEY) o 'legacy' (EMERGENT_LLM_KEY con el SDK viejo)."""
    _ensure_load_dotenv()
    if os.environ.get("ANTHROPIC_API_KEY"):
        return "claude"
    if os.environ.get("GOOGLE_API_KEY") or os.environ.get("GEMINI_API_KEY"):
        return "gemini"
    return "legacy"


def _a_imagen_png(content: bytes, content_type: str) -> tuple[bytes, str]:
    """Cualquier entrada (PDF o imagen) → bytes de imagen + mime, para mandarla al modelo."""
    ct = (content_type or "").lower()
    if "pdf" in ct or content[:4] == b"%PDF":
        img = _pdf_first_page_to_png_bytes(content)
        if not img:
            raise RuntimeError("No se pudo convertir el PDF a imagen.")
        return img, ("image/jpeg" if img[:3] == b"\xff\xd8\xff" else "image/png")
    return _normalize_to_image(content, content_type)


def _parsear_json(text: str) -> dict:
    cleaned = (text or "").strip()
    if cleaned.startswith("```"):
        cleaned = cleaned.strip("`")
        if cleaned.lower().startswith("json"):
            cleaned = cleaned[4:].strip()
    try:
        return json.loads(cleaned)
    except Exception:
        import re as _re
        m = _re.search(r"\{.*\}", cleaned, _re.DOTALL)
        if m:
            try:
                return json.loads(m.group(0))
            except Exception:
                pass
    return {}


async def _extract_claude(content: bytes, content_type: str) -> dict:
    """Lectura con Claude (Anthropic) — modelo de visión actual, entrada imagen base64."""
    import base64
    from anthropic import AsyncAnthropic
    img, mime = _a_imagen_png(content, content_type)
    modelo = os.environ.get("ANTHROPIC_VISION_MODEL", "claude-sonnet-5")
    async with AsyncAnthropic(api_key=os.environ["ANTHROPIC_API_KEY"]) as client:
      resp = await client.messages.create(
        model=modelo, max_tokens=1200,
        system="Eres un OCR estructurado de facturas peruanas de combustible. Respondes SOLO con un objeto JSON válido, sin markdown ni texto adicional.",
        messages=[{"role": "user", "content": [
            {"type": "image", "source": {"type": "base64", "media_type": mime, "data": base64.b64encode(img).decode()}},
            {"type": "text", "text": OCR_PROMPT},
        ]}],
    )
    text = "".join(getattr(b, "text", "") for b in resp.content)
    return {"extracted": _normalize_fields(_parsear_json(text)), "raw_response": text, "motor": f"claude:{modelo}"}


async def _extract_gemini(content: bytes, content_type: str) -> dict:
    """Lectura con Gemini actual (SDK google-genai)."""
    from google import genai
    from google.genai import types as gtypes
    img, mime = _a_imagen_png(content, content_type)
    client = genai.Client(api_key=os.environ.get("GOOGLE_API_KEY") or os.environ.get("GEMINI_API_KEY"))
    modelo = os.environ.get("GEMINI_VISION_MODEL", "gemini-2.5-flash")
    resp = await client.aio.models.generate_content(
        model=modelo,
        contents=[gtypes.Part.from_bytes(data=img, mime_type=mime), OCR_PROMPT],
        config=gtypes.GenerateContentConfig(temperature=0, response_mime_type="application/json",
                                            system_instruction="Eres un OCR estructurado. Solo devuelves JSON válido sin markdown."),
    )
    text = resp.text or ""
    return {"extracted": _normalize_fields(_parsear_json(text)), "raw_response": text, "motor": f"gemini:{modelo}"}


async def extract_invoice_data(content: bytes, content_type: str, session_id: str) -> dict:
    """Main entry point. Returns dict with extracted fields + raw response.
    Elige el motor por la clave disponible: Claude (ANTHROPIC_API_KEY), Gemini actual
    (GOOGLE_API_KEY/GEMINI_API_KEY) o, si no hay ninguna, el camino antiguo (EMERGENT_LLM_KEY)."""
    prov = _proveedor_vision()
    if prov in ("claude", "gemini"):
        try:
            return await (_extract_claude if prov == "claude" else _extract_gemini)(content, content_type)
        except Exception as e:
            logger.warning(f"OCR {prov} falló: {e}")
            return {"extracted": _normalize_fields({}), "raw_response": f"{prov}: {e}", "motor": prov}
    return await _extract_invoice_data_legacy(content, content_type, session_id)


async def _extract_invoice_data_legacy(content: bytes, content_type: str, session_id: str) -> dict:
    """Camino original (google.generativeai + gemini-1.5-flash + EMERGENT_LLM_KEY)."""
    import google.generativeai as genai
    import os
    import tempfile

    ct = (content_type or "").lower()
    is_pdf = "pdf" in ct or content[:4] == b"%PDF"

    sample_file = None
    tmp_path = None
    try:
        genai.configure(api_key=_emergent_key())
        
        model = genai.GenerativeModel(
            model_name="gemini-1.5-flash",
            system_instruction="Eres un OCR estructurado. Solo devuelves JSON válido sin markdown."
        )
        
        if is_pdf:
            with tempfile.NamedTemporaryFile(suffix=".pdf", delete=False) as tmp:
                tmp.write(content)
                tmp_path = tmp.name
            
            sample_file = genai.upload_file(path=tmp_path, display_name="Factura PDF")
            response = await model.generate_content_async([
                sample_file,
                OCR_PROMPT
            ])
        else:
            img_bytes, mime = _normalize_to_image(content, content_type)
            response = await model.generate_content_async([
                {"mime_type": mime, "data": img_bytes},
                OCR_PROMPT
            ])
            
        text = response.text
    except Exception as e:
        logger.warning(f"OCR bypass / Error: {e}")
        # Return empty data so frontend allows manual filling
        return {"extracted": _normalize_fields({}), "raw_response": str(e)}
    finally:
        if sample_file:
            try:
                genai.delete_file(sample_file.name)
            except Exception:
                pass
        if tmp_path and os.path.exists(tmp_path):
            try:
                os.unlink(tmp_path)
            except Exception:
                pass

    # Strip code fences if present
    cleaned = text.strip()
    if cleaned.startswith("```"):
        cleaned = cleaned.strip("`")
        if cleaned.lower().startswith("json"):
            cleaned = cleaned[4:].strip()

    parsed = {}
    try:
        parsed = json.loads(cleaned)
    except Exception:
        # Try to find JSON block
        import re
        m = re.search(r"\{.*\}", cleaned, re.DOTALL)
        if m:
            try:
                parsed = json.loads(m.group(0))
            except Exception as e:
                logger.warning(f"OCR JSON parse falló: {e}; raw={cleaned[:300]}")
                parsed = {}

    return {
        "extracted": _normalize_fields(parsed),
        "raw_response": text,
    }


def _normalize_fields(p: dict) -> dict:
    """Normalize/sanitize the extracted fields."""
    def _to_float(v):
        if v in (None, ""):
            return None
        try:
            if isinstance(v, str):
                v = v.replace("S/", "").replace("S/.", "").strip()
                # Si tiene múltiples comas/puntos, asumimos que el último es el decimal
                import re
                v = re.sub(r"[^\d\.,]", "", v)
                if "," in v and "." in v:
                    v = v.replace(",", "") # Remove thousands comma
                elif v.count(",") == 1 and v.count(".") == 0:
                    v = v.replace(",", ".") # Comma is decimal
                elif v.count(",") > 1:
                    v = v.replace(",", "") # Commas are thousands
            return float(v)
        except Exception:
            return None

    def _to_str(v):
        if v in (None, ""):
            return None
        return str(v).strip()

    placa = _to_str(p.get("placa"))
    if placa:
        placa = placa.upper().replace(" ", "")
        if "-" not in placa and len(placa) == 6:
            placa = f"{placa[:3]}-{placa[3:]}"

    return {
        "fecha": _to_str(p.get("fecha")),
        "fecha_vencimiento": _to_str(p.get("fecha_vencimiento")),
        "hora": _to_str(p.get("hora")),
        "estacion": _to_str(p.get("estacion")),
        "ciudad": _to_str(p.get("ciudad")),
        "ruc_emisor": _to_str(p.get("ruc_emisor")),
        "ruc_cliente": _to_str(p.get("ruc_cliente")),
        "placa": placa,
        "producto": _to_str(p.get("producto")),
        "galones": _to_float(p.get("galones")),
        "precio_unitario": _to_float(p.get("precio_unitario")),
        "importe_total": _to_float(p.get("importe_total")),
        "numero_documento": _to_str(p.get("numero_documento")),
        "confianza": _to_float(p.get("confianza")) or 0.0,
    }
