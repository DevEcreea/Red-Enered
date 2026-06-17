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

Analiza esta imagen y devuelve EXCLUSIVAMENTE un JSON válido (sin markdown, sin ```, sin comentarios) con exactamente estos campos:

{
  "fecha": "YYYY-MM-DD o null",
  "hora": "HH:MM o null",
  "estacion": "Nombre / razón social del grifo (string) o null",
  "ciudad": "Ciudad del grifo o null",
  "ruc_emisor": "RUC del grifo (11 dígitos) o null",
  "placa": "Placa del vehículo (formato ABC-123 o ABC123) o null",
  "producto": "Tipo de combustible (DIESEL B5, DIESEL B20, GASOHOL 90, etc.) o null",
  "galones": número decimal (cantidad en galones) o null,
  "precio_unitario": número decimal (precio por galón en soles) o null,
  "importe_total": número decimal (total en soles, con IGV incluido) o null,
  "numero_documento": "Serie-Correlativo (ej: F001-12345) o null",
  "confianza": número entre 0 y 1 (qué tan seguro estás de los datos)
}

Reglas estrictas:
- Si un campo no es legible o no aparece, usa null (no inventes).
- Devuelve únicamente el JSON, sin texto adicional, sin envoltorio markdown.
- placa: convierte a MAYÚSCULAS y elimina espacios. Si ves AAA 123 → AAA-123.
- fecha en formato ISO YYYY-MM-DD (asume zona Perú).
- Números siempre como decimal con punto (no coma).
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
        raise RuntimeError("EMERGENT_LLM_KEY no configurada")
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
    from emergentintegrations.llm.chat import LlmChat, UserMessage, ImageContent

    img_bytes, mime = _normalize_to_image(content, content_type)
    b64 = base64.b64encode(img_bytes).decode("ascii")

    chat = LlmChat(
        api_key=_emergent_key(),
        session_id=session_id,
        system_message="Eres un OCR estructurado. Solo devuelves JSON válido sin markdown.",
    ).with_model("gemini", "gemini-2.5-flash")

    msg = UserMessage(
        text=OCR_PROMPT,
        file_contents=[ImageContent(image_base64=b64)],
    )

    raw = await chat.send_message(msg)
    text = raw if isinstance(raw, str) else str(raw)

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
                v = v.replace(",", ".").replace("S/", "").strip()
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
        "hora": _to_str(p.get("hora")),
        "estacion": _to_str(p.get("estacion")),
        "ciudad": _to_str(p.get("ciudad")),
        "ruc_emisor": _to_str(p.get("ruc_emisor")),
        "placa": placa,
        "producto": _to_str(p.get("producto")),
        "galones": _to_float(p.get("galones")),
        "precio_unitario": _to_float(p.get("precio_unitario")),
        "importe_total": _to_float(p.get("importe_total")),
        "numero_documento": _to_str(p.get("numero_documento")),
        "confianza": _to_float(p.get("confianza")) or 0.0,
    }
