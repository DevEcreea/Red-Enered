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
  "ruc_cliente": "RUC del cliente/receptor (11 dígitos, obligatorio)",
  "placa": "Placa del vehículo (formato ABC-123)",
  "producto": "Nombre del combustible (ej: DIESEL B5 S-50, GASOHOL REGULAR, etc)",
  "importe_total": número decimal (Total a pagar, sin IGV aparte, solo el TOTAL final. Ej: 1540.50),
  "numero_documento": "Serie-Correlativo exacto (ej: F003-00000219)"
}

REGLAS ESTRICTAS:
- No devuelvas texto adicional, solo el objeto JSON limpio.
- El importe_total DEBE ser un número decimal con punto, NO con coma, sin símbolo de moneda.
- Respeta estrictamente el formato YYYY-MM-DD en las fechas (AÑO-MES-DIA).
- numero_documento debe conservar los ceros a la izquierda (ej: F003-00000219).
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
    """Convert first page of PDF to PNG bytes. Returns None if pdf2image not available."""
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


async def extract_invoice_data(content: bytes, content_type: str, session_id: str) -> dict:
    """Main entry point. Returns dict with extracted fields + raw response."""
    import google.generativeai as genai
    import os
    import tempfile

    ct = (content_type or "").lower()
    is_pdf = "pdf" in ct or content[:4] == b"%PDF"

    try:
        genai.configure(api_key=_emergent_key())
        
        model = genai.GenerativeModel(
            model_name="gemini-1.5-flash",
            system_instruction="Eres un OCR estructurado. Solo devuelves JSON válido sin markdown."
        )

        sample_file = None
        tmp_path = None
        
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
