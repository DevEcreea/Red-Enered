"""ENERED — Subsidio module (DU 004-2026)
Endpoints públicos (calculadora) + privados (cliente_subsidio).
Aislado del resto del backend: solo añade endpoints, no modifica los existentes.
"""
from __future__ import annotations

import os
import io
import uuid
import logging
from datetime import datetime, timezone
from typing import List, Optional, Literal

import bcrypt
import jwt
from fastapi import APIRouter, Depends, HTTPException, Request, Response, UploadFile, File, Form
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, EmailStr, Field

import storage  # tu storage.py existente (R2 + fallback local)

logger = logging.getLogger("enered.subsidio")

subsidio_router = APIRouter(prefix="/api")

# Will be wired up in server.py
db = None
JWT_ALGORITHM = "HS256"


def _jwt_secret() -> str:
    return os.environ["JWT_SECRET"]


def _set_db(database):
    """Inject Mongo db from server.py at startup."""
    global db
    db = database


def _hash_pw(p: str) -> str:
    return bcrypt.hashpw(p.encode(), bcrypt.gensalt()).decode()


def _verify_pw(p: str, h: str) -> bool:
    try:
        return bcrypt.checkpw(p.encode(), h.encode())
    except Exception:
        return False


def _create_access_token(user_id: str, email: str, role: str, empresa: Optional[str]) -> str:
    from datetime import timedelta
    payload = {
        "sub": user_id, "email": email, "role": role, "empresa": empresa,
        "exp": datetime.now(timezone.utc) + timedelta(minutes=60 * 8),
        "type": "access",
    }
    return jwt.encode(payload, _jwt_secret(), algorithm=JWT_ALGORITHM)


def _create_refresh_token(user_id: str) -> str:
    from datetime import timedelta
    payload = {
        "sub": user_id,
        "exp": datetime.now(timezone.utc) + timedelta(days=7),
        "type": "refresh",
    }
    return jwt.encode(payload, _jwt_secret(), algorithm=JWT_ALGORITHM)


def _set_auth_cookies(response: Response, access: str, refresh: str):
    response.set_cookie("access_token", access, httponly=True, secure=True, samesite="none",
                        max_age=60 * 60 * 8, path="/")
    response.set_cookie("refresh_token", refresh, httponly=True, secure=True, samesite="none",
                        max_age=7 * 86400, path="/")


async def _get_current_user(request: Request) -> dict:
    token = request.cookies.get("access_token")
    if not token:
        auth = request.headers.get("Authorization", "")
        if auth.startswith("Bearer "):
            token = auth[7:]
    if not token:
        raise HTTPException(status_code=401, detail="No autenticado")
    try:
        payload = jwt.decode(token, _jwt_secret(), algorithms=[JWT_ALGORITHM])
        if payload.get("type") != "access":
            raise HTTPException(status_code=401, detail="Token inválido")
        user = await db.users.find_one({"id": payload["sub"]}, {"_id": 0, "password_hash": 0})
        if not user:
            raise HTTPException(status_code=401, detail="Usuario no encontrado")
        return user
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Sesión expirada")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Token inválido")


async def _require_subsidio(request: Request) -> dict:
    user = await _get_current_user(request)
    if user["role"] != "cliente_subsidio":
        raise HTTPException(status_code=403, detail="Solo clientes de subsidio")
    return user


# ============================================================================
# MODELS
# ============================================================================
class CategoriaVehicular(BaseModel):
    code: Literal["M2", "M3", "N1", "N2", "N3"]
    cantidad: int = Field(ge=0)
    galones_mensuales: float = Field(ge=0)


class CalculationCreate(BaseModel):
    califica: bool
    categorias: List[CategoriaVehicular] = []
    total_galones_mensuales: Optional[float] = None
    subsidio_estimado: float = 0.0
    detalle: Optional[dict] = None
    canal_origen: str = "calculadora"


class RegisterFromCalculator(BaseModel):
    calc_id: str
    ruc: str = Field(min_length=11, max_length=11)
    razon_social: str
    contacto: str
    telefono: str
    email: EmailStr
    password: str = Field(min_length=8)


class BankAccountIn(BaseModel):
    es_banco_nacion: bool
    banco: str
    tipo_cuenta: Literal["ahorros", "corriente"]
    numero_cuenta: str
    moneda: Literal["PEN", "USD"] = "PEN"
    cci: Optional[str] = None


class VehicleIn(BaseModel):
    placa: str
    categoria: Literal["M2", "M3", "N1", "N2", "N3"]


# ============================================================================
# PUBLIC: Calculator
# ============================================================================
@subsidio_router.post("/calculations")
async def create_calculation(payload: CalculationCreate):
    """Public endpoint — la calculadora externa guarda el resultado y obtiene calc_id."""
    calc_id = str(uuid.uuid4())
    doc = {
        "id": calc_id,
        "califica": payload.califica,
        "categorias": [c.model_dump() for c in payload.categorias],
        "total_galones_mensuales": payload.total_galones_mensuales,
        "subsidio_estimado": payload.subsidio_estimado,
        "detalle": payload.detalle or {},
        "canal_origen": payload.canal_origen,
        "created_at": datetime.now(timezone.utc).isoformat(),
        "linked_user_id": None,
    }
    await db.calculations.insert_one(doc)
    # Save also as lead
    await db.subsidio_leads.insert_one({
        "id": str(uuid.uuid4()),
        "calc_id": calc_id,
        "califica": payload.califica,
        "subsidio_estimado": payload.subsidio_estimado,
        "registered": False,
        "created_at": doc["created_at"],
    })
    return {
        "calc_id": calc_id,
        "subsidio_estimado": payload.subsidio_estimado,
        "califica": payload.califica,
        "created_at": doc["created_at"],
    }


@subsidio_router.get("/calculations/{calc_id}")
async def get_calculation(calc_id: str):
    calc = await db.calculations.find_one({"id": calc_id}, {"_id": 0})
    if not calc:
        raise HTTPException(status_code=404, detail="Cálculo no encontrado")
    return calc


# ============================================================================
# PUBLIC: Self-register from calculator
# ============================================================================
@subsidio_router.post("/auth/register-from-calculator")
async def register_from_calculator(payload: RegisterFromCalculator, response: Response):
    calc = await db.calculations.find_one({"id": payload.calc_id})
    if not calc:
        raise HTTPException(status_code=400, detail="calc_id inválido")

    email = payload.email.lower().strip()
    if await db.users.find_one({"email": email}):
        raise HTTPException(status_code=409, detail="Ya existe una cuenta con este correo")

    # Find or create empresa (en empresas_config si no existe)
    empresa_name = payload.razon_social.strip()
    existing_emp = await db.empresas_config.find_one({"empresa": empresa_name})
    if not existing_emp:
        await db.empresas_config.insert_one({
            "id": str(uuid.uuid4()),
            "empresa": empresa_name,
            "ruc": payload.ruc,
            "plan": "subsidio",
            "linea_credito": 0,
            "unidades_contratadas": 0,
            "dias_credito": 0,
            "canal_origen": "calculadora",
            "created_at": datetime.now(timezone.utc).isoformat(),
        })

    user_id = str(uuid.uuid4())
    user_doc = {
        "id": user_id,
        "email": email,
        "name": payload.contacto,
        "password_hash": _hash_pw(payload.password),
        "role": "cliente_subsidio",
        "empresa": empresa_name,
        "ruc": payload.ruc,
        "contacto": payload.contacto,
        "telefono": payload.telefono,
        "calc_id": payload.calc_id,
        "documentos_completos": False,
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    await db.users.insert_one(user_doc)
    user_doc.pop("_id", None)

    # Link calc & lead
    await db.calculations.update_one(
        {"id": payload.calc_id},
        {"$set": {"linked_user_id": user_id, "linked_empresa": empresa_name}}
    )
    await db.subsidio_leads.update_one(
        {"calc_id": payload.calc_id},
        {"$set": {"registered": True, "user_id": user_id}}
    )

    access = _create_access_token(user_id, email, "cliente_subsidio", empresa_name)
    refresh = _create_refresh_token(user_id)
    _set_auth_cookies(response, access, refresh)
    response.headers["X-Access-Token"] = access

    pub = {k: v for k, v in user_doc.items() if k != "password_hash"}
    return {"user": pub, "access_token": access}


# ============================================================================
# PRIVATE: cliente_subsidio
# ============================================================================
DOCUMENT_LABELS = {
    "ficha_ruc": "Ficha RUC (activo y habido)",
    "resolucion_autorizacion": "Resolución de autorización",
    "dni_representante": "DNI del representante legal",
    "tarjeta_habilitacion": "Tarjeta de habilitación",
    "tarjeta_propiedad": "Tarjeta de propiedad",
    "comprobante_jun_2026": "Comprobantes — Mes 1 (junio 2026)",
    "comprobante_jul_2026": "Comprobantes — Mes 2 (julio 2026)",
}

EMPRESA_CATEGORIES = ["ficha_ruc", "resolucion_autorizacion", "dni_representante"]
FLOTA_CATEGORIES = ["tarjeta_habilitacion", "tarjeta_propiedad"]
COMBUSTIBLE_CATEGORIES = ["comprobante_jun_2026", "comprobante_jul_2026"]
ALL_CATEGORIES = EMPRESA_CATEGORIES + FLOTA_CATEGORIES + COMBUSTIBLE_CATEGORIES


@subsidio_router.get("/subsidio/status")
async def subsidio_status(user: dict = Depends(_require_subsidio)):
    """Devuelve si el usuario ya completó documentos (para redirect post-login)."""
    return {
        "documentos_completos": bool(user.get("documentos_completos")),
        "ruc": user.get("ruc"),
        "empresa": user.get("empresa"),
    }


def _subsidio_key(user_id: str, category: str, placa: Optional[str], filename: str) -> str:
    safe = "".join(c for c in filename if c.isalnum() or c in ("-", "_", "."))[-80:]
    pid = f"{placa}-" if placa else ""
    return f"subsidio/{user_id}/{category}/{pid}{uuid.uuid4().hex[:8]}-{safe}"


@subsidio_router.get("/subsidio/dashboard")
async def subsidio_dashboard(user: dict = Depends(_require_subsidio)):
    """Devuelve toda la info para la pantalla de carga de documentos."""
    # Cálculo
    calc = await db.calculations.find_one({"id": user.get("calc_id")}, {"_id": 0}) or {}

    # Vehículos
    vehicles = await db.subsidio_vehicles.find(
        {"user_id": user["id"]}, {"_id": 0}
    ).to_list(200)

    # Documentos
    docs = await db.subsidio_documents.find(
        {"user_id": user["id"]}, {"_id": 0}
    ).to_list(1000)

    # Cuenta bancaria
    bank = await db.subsidio_bank_accounts.find_one(
        {"user_id": user["id"]}, {"_id": 0}
    )

    # Construir checklist
    def files_for(cat, placa=None):
        return [d for d in docs if d["categoria"] == cat and d.get("placa") == placa]

    checklist = {"empresa": [], "flota": [], "combustible": []}
    for cat in EMPRESA_CATEGORIES:
        f = files_for(cat)
        checklist["empresa"].append({
            "categoria": cat, "label": DOCUMENT_LABELS[cat],
            "uploaded": bool(f), "files": f,
        })
    for v in vehicles:
        for cat in FLOTA_CATEGORIES:
            f = files_for(cat, v["placa"])
            checklist["flota"].append({
                "categoria": cat, "placa": v["placa"],
                "label": f"{DOCUMENT_LABELS[cat]} — Placa {v['placa']}",
                "uploaded": bool(f), "files": f,
            })
    for cat in COMBUSTIBLE_CATEGORIES:
        f = files_for(cat)
        checklist["combustible"].append({
            "categoria": cat, "label": DOCUMENT_LABELS[cat],
            "uploaded": bool(f), "files": f,
        })

    total_required = 3 + 2 * len(vehicles) + 2
    total_done = sum(1 for items in checklist.values() for it in items if it["uploaded"])
    pct = round((total_done / total_required) * 100) if total_required else 0

    # Faltan placas para subir flota
    can_finalize = (
        all(it["uploaded"] for it in checklist["empresa"])
        and len(vehicles) > 0
        and all(it["uploaded"] for it in checklist["flota"])
        and all(it["uploaded"] for it in checklist["combustible"])
        and bank is not None
    )

    return {
        "user": {k: v for k, v in user.items() if k not in ("password_hash", "_id")},
        "calculation": calc,
        "ahorro_estimado": calc.get("subsidio_estimado", 0),
        "ahorro_reconocido": calc.get("subsidio_estimado", 0),  # MOCKED hasta validación
        "vehicles": vehicles,
        "bank_account": bank,
        "checklist": checklist,
        "progress": {"total_required": total_required, "total_done": total_done, "pct": pct},
        "can_finalize": can_finalize,
        "documentos_completos": bool(user.get("documentos_completos")),
    }


@subsidio_router.post("/subsidio/documents")
async def upload_document(
    file: UploadFile = File(...),
    categoria: str = Form(...),
    placa: Optional[str] = Form(None),
    user: dict = Depends(_require_subsidio),
):
    if categoria not in ALL_CATEGORIES:
        raise HTTPException(status_code=400, detail="Categoría inválida")
    if categoria in FLOTA_CATEGORIES and not placa:
        raise HTTPException(status_code=400, detail="Placa requerida para documentos de flota")

    placa_norm = placa.upper().strip() if placa else None
    if placa_norm:
        own = await db.subsidio_vehicles.find_one({"user_id": user["id"], "placa": placa_norm})
        if not own:
            raise HTTPException(status_code=400, detail="La placa no está registrada en tu flota")

    content = await file.read()
    if len(content) > 20 * 1024 * 1024:
        raise HTTPException(status_code=400, detail="Archivo demasiado grande (max 20MB)")

    key = _subsidio_key(user["id"], categoria, placa_norm, file.filename or "doc")
    content_type = file.content_type or "application/octet-stream"
    storage.save_object(key, content, content_type)

    doc = {
        "id": str(uuid.uuid4()),
        "user_id": user["id"],
        "empresa": user.get("empresa"),
        "categoria": categoria,
        "placa": placa_norm,
        "filename": file.filename,
        "storage_key": key,
        "content_type": content_type,
        "size": len(content),
        "uploaded_at": datetime.now(timezone.utc).isoformat(),
        "status": "pendiente_validacion",
    }
    await db.subsidio_documents.insert_one(doc)
    return {"ok": True, "document": {k: v for k, v in doc.items() if k != "_id"}}


@subsidio_router.delete("/subsidio/documents/{doc_id}")
async def delete_document(doc_id: str, user: dict = Depends(_require_subsidio)):
    d = await db.subsidio_documents.find_one({"id": doc_id, "user_id": user["id"]})
    if not d:
        raise HTTPException(status_code=404, detail="Documento no encontrado")
    try:
        storage.delete_object(d["storage_key"])
    except Exception as e:
        logger.warning(f"No se pudo borrar storage: {e}")
    await db.subsidio_documents.delete_one({"id": doc_id})
    return {"ok": True}


@subsidio_router.get("/subsidio/documents/{doc_id}/download")
async def download_document(doc_id: str, user: dict = Depends(_require_subsidio)):
    d = await db.subsidio_documents.find_one({"id": doc_id, "user_id": user["id"]}, {"_id": 0})
    if not d:
        raise HTTPException(status_code=404, detail="Documento no encontrado")
    return storage.download_response(d["storage_key"], d["filename"], d.get("content_type", "application/octet-stream"))


@subsidio_router.put("/subsidio/bank-account")
async def update_bank_account(payload: BankAccountIn, user: dict = Depends(_require_subsidio)):
    if not payload.es_banco_nacion and not payload.cci:
        raise HTTPException(status_code=400, detail="CCI obligatorio si no es Banco de la Nación")
    doc = payload.model_dump()
    doc["user_id"] = user["id"]
    doc["empresa"] = user.get("empresa")
    doc["updated_at"] = datetime.now(timezone.utc).isoformat()
    await db.subsidio_bank_accounts.update_one(
        {"user_id": user["id"]}, {"$set": doc}, upsert=True
    )
    return {"ok": True, "bank_account": doc}


@subsidio_router.post("/subsidio/vehicles")
async def add_vehicle(payload: VehicleIn, user: dict = Depends(_require_subsidio)):
    placa = payload.placa.upper().strip()
    if await db.subsidio_vehicles.find_one({"user_id": user["id"], "placa": placa}):
        raise HTTPException(status_code=409, detail="La placa ya está registrada")
    doc = {
        "id": str(uuid.uuid4()),
        "user_id": user["id"],
        "empresa": user.get("empresa"),
        "placa": placa,
        "categoria": payload.categoria,
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    await db.subsidio_vehicles.insert_one(doc)
    return {"ok": True, "vehicle": {k: v for k, v in doc.items() if k != "_id"}}


@subsidio_router.delete("/subsidio/vehicles/{placa}")
async def remove_vehicle(placa: str, user: dict = Depends(_require_subsidio)):
    placa_norm = placa.upper().strip()
    await db.subsidio_vehicles.delete_one({"user_id": user["id"], "placa": placa_norm})
    # Borra docs de esa placa
    docs = await db.subsidio_documents.find(
        {"user_id": user["id"], "placa": placa_norm}, {"_id": 0}
    ).to_list(100)
    for d in docs:
        try:
            storage.delete_object(d["storage_key"])
        except Exception:
            pass
    await db.subsidio_documents.delete_many({"user_id": user["id"], "placa": placa_norm})
    return {"ok": True}


@subsidio_router.post("/subsidio/finalize")
async def finalize(user: dict = Depends(_require_subsidio)):
    """Marca el expediente como completado. Valida que todo esté presente."""
    # Re-construir el dashboard para verificar can_finalize
    vehicles = await db.subsidio_vehicles.find({"user_id": user["id"]}, {"_id": 0}).to_list(200)
    docs = await db.subsidio_documents.find({"user_id": user["id"]}, {"_id": 0}).to_list(1000)
    bank = await db.subsidio_bank_accounts.find_one({"user_id": user["id"]}, {"_id": 0})

    missing = []
    docs_set = {(d["categoria"], d.get("placa")) for d in docs}
    for cat in EMPRESA_CATEGORIES:
        if (cat, None) not in docs_set:
            missing.append(DOCUMENT_LABELS[cat])
    if not vehicles:
        missing.append("Al menos 1 vehículo registrado")
    for v in vehicles:
        for cat in FLOTA_CATEGORIES:
            if (cat, v["placa"]) not in docs_set:
                missing.append(f"{DOCUMENT_LABELS[cat]} — {v['placa']}")
    for cat in COMBUSTIBLE_CATEGORIES:
        if (cat, None) not in docs_set:
            missing.append(DOCUMENT_LABELS[cat])
    if not bank:
        missing.append("Cuenta bancaria para depósito")

    if missing:
        raise HTTPException(status_code=400, detail={"message": "Faltan documentos", "missing": missing})

    await db.users.update_one(
        {"id": user["id"]},
        {"$set": {
            "documentos_completos": True,
            "expediente_status": "verifying",
            "documentos_completados_at": datetime.now(timezone.utc).isoformat(),
        }}
    )
    return {"ok": True}


# ============================================================================
# OCR de facturas — DU 004-2026
# ============================================================================
class InvoiceUpdateIn(BaseModel):
    fecha: Optional[str] = None
    hora: Optional[str] = None
    estacion: Optional[str] = None
    ciudad: Optional[str] = None
    placa: Optional[str] = None
    producto: Optional[str] = None
    galones: Optional[float] = None
    precio_unitario: Optional[float] = None
    importe_total: Optional[float] = None
    numero_documento: Optional[str] = None
    ruc_emisor: Optional[str] = None


@subsidio_router.post("/subsidio/invoices/upload")
async def invoices_upload(
    files: List[UploadFile] = File(...),
    user: dict = Depends(_require_subsidio),
):
    """Recibe N facturas (imágenes o PDFs), las pasa por OCR Gemini Vision,
    guarda el archivo en storage y un draft en consumos_subsidio (status=draft).
    Devuelve la lista con los datos extraídos para verificación."""
    from services.invoice_ocr import extract_invoice_data

    if not files:
        raise HTTPException(status_code=400, detail="Sin archivos")
    if len(files) > 60:
        raise HTTPException(status_code=400, detail="Máximo 60 facturas por carga")

    # Cargar placas del usuario para auto-match
    vehicles = await db.subsidio_vehicles.find(
        {"user_id": user["id"]}, {"_id": 0, "placa": 1}
    ).to_list(200)
    user_placas = {v["placa"] for v in vehicles}

    results = []
    for f in files:
        content = await f.read()
        if len(content) > 20 * 1024 * 1024:
            results.append({"filename": f.filename, "ok": False, "error": "Archivo > 20MB"})
            continue
        content_type = f.content_type or "application/octet-stream"

        # Save raw file
        key = _subsidio_key(user["id"], "factura_subsidio", None, f.filename or "factura")
        storage.save_object(key, content, content_type)

        # OCR
        try:
            ocr = await extract_invoice_data(content, content_type, session_id=f"ocr-{user['id']}-{uuid.uuid4().hex[:6]}")
            extracted = ocr["extracted"]
            raw_resp = ocr["raw_response"]
            ocr_ok = True
            ocr_error = None
        except Exception as e:
            logger.warning(f"OCR error en {f.filename}: {e}")
            extracted = {
                "fecha": None, "hora": None, "estacion": None, "ciudad": None,
                "placa": None, "producto": None, "galones": None,
                "precio_unitario": None, "importe_total": None,
                "numero_documento": None, "ruc_emisor": None, "confianza": 0.0,
            }
            raw_resp = ""
            ocr_ok = False
            ocr_error = str(e)[:200]

        # Auto-match con flota del usuario
        placa_match = None
        if extracted.get("placa") and extracted["placa"] in user_placas:
            placa_match = extracted["placa"]

        doc = {
            "id": str(uuid.uuid4()),
            "user_id": user["id"],
            "empresa": user.get("empresa"),
            "empresa_id": user.get("empresa"),
            "calc_id": user.get("calc_id"),
            "factura_filename": f.filename,
            "factura_storage_key": key,
            "factura_content_type": content_type,
            "factura_size": len(content),
            "raw_ocr_response": raw_resp,
            "ocr_ok": ocr_ok,
            "ocr_error": ocr_error,
            "placa_match": placa_match,  # placa que coincide con flota, si la hubo
            "status": "draft",  # draft → confirmed
            "created_at": datetime.now(timezone.utc).isoformat(),
            "confirmed_at": None,
            # Campos OCR
            "fecha": extracted.get("fecha"),
            "hora": extracted.get("hora"),
            "estacion": extracted.get("estacion"),
            "ciudad": extracted.get("ciudad"),
            "ruc_emisor": extracted.get("ruc_emisor"),
            "placa": extracted.get("placa"),
            "producto": extracted.get("producto"),
            "galones": extracted.get("galones"),
            "precio_unitario": extracted.get("precio_unitario"),
            "importe_total": extracted.get("importe_total"),
            "numero_documento": extracted.get("numero_documento"),
            "confianza": extracted.get("confianza", 0.0),
        }
        await db.consumos_subsidio.insert_one(doc)
        results.append({
            "id": doc["id"],
            "filename": f.filename,
            "ok": ocr_ok,
            "error": ocr_error,
            "data": {k: v for k, v in doc.items() if k != "_id" and k != "raw_ocr_response"},
        })

    # Mark expediente as verifying
    await db.users.update_one(
        {"id": user["id"]},
        {"$set": {"expediente_status": "verifying"}},
    )
    return {"uploaded": len(results), "items": results}


@subsidio_router.get("/subsidio/invoices/preview")
async def invoices_preview(user: dict = Depends(_require_subsidio)):
    """Devuelve facturas en draft (pendientes de confirmar) del usuario."""
    rows = await db.consumos_subsidio.find(
        {"user_id": user["id"], "status": "draft"},
        {"_id": 0, "raw_ocr_response": 0, "factura_storage_key": 0},
    ).sort("created_at", -1).to_list(500)
    # Placas registradas para mostrar dropdown de corrección
    vehicles = await db.subsidio_vehicles.find(
        {"user_id": user["id"]}, {"_id": 0, "placa": 1, "categoria": 1}
    ).to_list(200)
    return {"items": rows, "vehicles": vehicles}


@subsidio_router.put("/subsidio/invoices/{invoice_id}")
async def invoices_update(
    invoice_id: str,
    payload: InvoiceUpdateIn,
    user: dict = Depends(_require_subsidio),
):
    inv = await db.consumos_subsidio.find_one(
        {"id": invoice_id, "user_id": user["id"]}, {"_id": 0}
    )
    if not inv:
        raise HTTPException(status_code=404, detail="Factura no encontrada")
    patch = {k: v for k, v in payload.model_dump(exclude_unset=True).items() if v is not None}
    if "placa" in patch and patch["placa"]:
        patch["placa"] = patch["placa"].upper().strip()
    patch["updated_at"] = datetime.now(timezone.utc).isoformat()
    await db.consumos_subsidio.update_one({"id": invoice_id}, {"$set": patch})
    updated = await db.consumos_subsidio.find_one(
        {"id": invoice_id},
        {"_id": 0, "raw_ocr_response": 0, "factura_storage_key": 0},
    )
    return {"ok": True, "item": updated}


@subsidio_router.delete("/subsidio/invoices/{invoice_id}")
async def invoices_delete(invoice_id: str, user: dict = Depends(_require_subsidio)):
    inv = await db.consumos_subsidio.find_one({"id": invoice_id, "user_id": user["id"]})
    if not inv:
        raise HTTPException(status_code=404, detail="Factura no encontrada")
    try:
        storage.delete_object(inv["factura_storage_key"])
    except Exception:
        pass
    await db.consumos_subsidio.delete_one({"id": invoice_id})
    return {"ok": True}


@subsidio_router.post("/subsidio/invoices/confirm")
async def invoices_confirm(user: dict = Depends(_require_subsidio)):
    """Confirma TODAS las facturas en draft del usuario → status=confirmed.
    Marca expediente_status=confirmed si no quedan drafts."""
    now = datetime.now(timezone.utc).isoformat()
    res = await db.consumos_subsidio.update_many(
        {"user_id": user["id"], "status": "draft"},
        {"$set": {"status": "confirmed", "confirmed_at": now}},
    )
    await db.users.update_one(
        {"id": user["id"]},
        {"$set": {"expediente_status": "confirmed"}},
    )
    return {"ok": True, "confirmed": res.modified_count}


@subsidio_router.get("/subsidio/invoices/confirmed")
async def invoices_confirmed(user: dict = Depends(_require_subsidio)):
    """Lista facturas confirmadas (para módulos del cliente_subsidio)."""
    rows = await db.consumos_subsidio.find(
        {"user_id": user["id"], "status": "confirmed"},
        {"_id": 0, "raw_ocr_response": 0, "factura_storage_key": 0},
    ).sort("fecha", -1).to_list(2000)
    return rows


@subsidio_router.get("/subsidio/dashboard-data")
async def subsidio_dashboard_data(user: dict = Depends(_require_subsidio)):
    """KPIs específicos del dashboard del cliente_subsidio (lee consumos_subsidio)."""
    rows = await db.consumos_subsidio.find(
        {"user_id": user["id"], "status": "confirmed"},
        {"_id": 0, "raw_ocr_response": 0, "factura_storage_key": 0},
    ).to_list(5000)

    def _f(x):
        try:
            return float(x) if x not in (None, "") else 0.0
        except Exception:
            return 0.0

    total_gal = sum(_f(r.get("galones")) for r in rows)
    total_importe = sum(_f(r.get("importe_total")) for r in rows)
    facturas = len(rows)

    # Subsidio estimado (de la calculadora) y reconocido (a partir de galones confirmados)
    calc = await db.calculations.find_one({"id": user.get("calc_id")}, {"_id": 0}) or {}
    subsidio_estimado = float(calc.get("subsidio_estimado", 0) or 0)

    # Galones confirmados / promedio mensual
    # Agrupar por mes
    by_month = {}
    for r in rows:
        f = r.get("fecha") or ""
        ym = f[:7] if len(f) >= 7 else "sin-fecha"
        d = by_month.setdefault(ym, {"galones": 0.0, "importe": 0.0, "facturas": 0})
        d["galones"] += _f(r.get("galones"))
        d["importe"] += _f(r.get("importe_total"))
        d["facturas"] += 1

    serie_mensual = [
        {"mes": k, "galones": round(v["galones"], 2), "importe": round(v["importe"], 2), "facturas": v["facturas"]}
        for k, v in sorted(by_month.items())
        if k != "sin-fecha"
    ]

    # Top placas
    by_placa = {}
    for r in rows:
        p = r.get("placa") or "Sin placa"
        d = by_placa.setdefault(p, {"galones": 0.0, "importe": 0.0, "facturas": 0})
        d["galones"] += _f(r.get("galones"))
        d["importe"] += _f(r.get("importe_total"))
        d["facturas"] += 1
    top_placas = sorted(
        [{"placa": p, **{kk: round(vv, 2) if isinstance(vv, float) else vv for kk, vv in v.items()}} for p, v in by_placa.items()],
        key=lambda x: -x["galones"],
    )[:10]

    # Subsidio reconocido: galones * (precio_pizarra - precio_enered)
    # Como aún no tenemos pizarra/enered para el cliente subsidio, usamos un mock simple:
    # subsidio_reconocido = subsidio_estimado * (facturas reales / facturas esperadas)
    # Pero para una métrica más útil, devolvemos solo lo confirmado en S/.
    return {
        "kpis": {
            "facturas_confirmadas": facturas,
            "galones_confirmados": round(total_gal, 2),
            "importe_total": round(total_importe, 2),
            "subsidio_estimado": round(subsidio_estimado, 2),
            "subsidio_reconocido": round(total_gal * 1.5, 2),  # MOCKED: S/ 1.5 por galón
            "precio_promedio": round(total_importe / total_gal, 2) if total_gal > 0 else 0,
        },
        "serie_mensual": serie_mensual,
        "top_placas": top_placas,
        "ultimas_facturas": sorted(rows, key=lambda r: r.get("fecha") or "", reverse=True)[:10],
    }
