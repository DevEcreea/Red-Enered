"""ENERED — Subsidio module (DU 004-2026)
Endpoints públicos (calculadora) + privados (cliente_subsidio).
Aislado del resto del backend: solo añade endpoints, no modifica los existentes.
"""
from __future__ import annotations

import os
import io
import uuid
import logging
import httpx
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


# Etapas del trámite (controladas por admin_enered)
SUBSIDIO_STAGES = ["solicitud_enviada", "evaluacion_atu", "aprobada", "abonado_en_cuenta"]


class StageUpdateIn(BaseModel):
    stage: Literal["solicitud_enviada", "evaluacion_atu", "aprobada", "abonado_en_cuenta"]


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
@subsidio_router.get("/sunat/ruc/{ruc}")
async def lookup_ruc(ruc: str):
    """Consulta SUNAT vía api.apis.net.pe usando token desde variable de entorno.
    Si falla, permite escribir la razón social a mano (fallback manual)."""
    ruc = (ruc or "").strip()
    if not ruc.isdigit() or len(ruc) != 11:
        raise HTTPException(status_code=400, detail="RUC inválido: deben ser 11 dígitos numéricos")

    # Leer token desde variable de entorno con fallback
    token = os.getenv("DECOLECTA_TOKEN", "").strip()
    if not token:
        token = "sk_16580.IMOLc0SewJrvEsXBlAWFnYEKB1YQdsPz"

    url = f"https://api.decolecta.com/v1/sunat/ruc?numero={ruc}"
    headers = {
        "Accept": "application/json",
    }
    if token:
        headers["Authorization"] = f"Bearer {token}"

    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            r = await client.get(url, headers=headers)
        
        # Manejo de errores más tolerante
        if r.status_code == 401 or r.status_code == 403:
            logger.warning("apis.net.pe auth error %s: %s", r.status_code, r.text[:200])
            # Fallback: permitir entrada manual
            raise HTTPException(
                status_code=206,  # Partial Content — requiere entrada manual
                detail="SUNAT no disponible en este momento. Por favor, ingresa la razón social manualmente."
            )
        if r.status_code == 404:
            raise HTTPException(status_code=404, detail="RUC no encontrado en SUNAT")
        if r.status_code == 429 or r.status_code == 422:
            raise HTTPException(status_code=429, detail="Límite de consultas SUNAT alcanzado. Intenta en unos segundos.")
        if r.status_code != 200:
            logger.warning("apis.net.pe respondió %s: %s", r.status_code, r.text[:200])
            raise HTTPException(status_code=502, detail=f"SUNAT respondió con {r.status_code}")
        
        data = r.json() or {}
    except HTTPException:
        raise
    except Exception as ex:
        logger.warning("RUC lookup failed: %s", ex)
        raise HTTPException(status_code=206, detail="No pudimos consultar SUNAT. Ingresa la razón social manualmente.")

    razon_social = (
        data.get("razonSocial")
        or data.get("nombre")
        or data.get("razon_social")
        or ""
    ).strip()
    if not razon_social:
        raise HTTPException(status_code=404, detail="RUC no encontrado en SUNAT")

    return {
        "ruc": ruc,
        "razon_social": razon_social,
        "estado": data.get("estado") or "",
        "condicion": data.get("condicion") or "",
        "direccion": data.get("direccion") or "",
        "departamento": data.get("departamento") or "",
        "provincia": data.get("provincia") or "",
        "distrito": data.get("distrito") or "",
    }


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

# MIME allowed per category (Art. user-defined: empresa solo PDF, flota PDF+imágenes)
EMPRESA_MIME = {"application/pdf"}
FLOTA_MIME = {"application/pdf", "image/jpeg", "image/jpg", "image/png", "image/webp"}
COMBUSTIBLE_MIME = {"application/pdf", "image/jpeg", "image/jpg", "image/png", "image/webp"}


def _allowed_mimes_for(categoria: str) -> set:
    if categoria in EMPRESA_CATEGORIES:
        return EMPRESA_MIME
    if categoria in FLOTA_CATEGORIES:
        return FLOTA_MIME
    return COMBUSTIBLE_MIME


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

    # Conteos de facturas (drafts y confirmadas)
    invoices_draft = await db.consumos_subsidio.count_documents({"user_id": user["id"], "status": "draft"})
    invoices_confirmed = await db.consumos_subsidio.count_documents({"user_id": user["id"], "status": "confirmed"})

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
        "invoices": {"draft": invoices_draft, "confirmed": invoices_confirmed},
        "declaracion": await db.subsidio_declaraciones.find_one(
            {"user_id": user["id"]}, {"_id": 0}
        ),
    }


# ============================================================================
# DECLARACIÓN JURADA
# ============================================================================
class DeclaracionPayload(BaseModel):
    accepted: bool
    representante: Optional[str] = None


@subsidio_router.post("/subsidio/declaracion")
async def aceptar_declaracion(
    payload: DeclaracionPayload,
    request: Request,
    user: dict = Depends(_require_subsidio),
):
    if not payload.accepted:
        raise HTTPException(status_code=400, detail="Debes marcar la casilla de aceptación")

    # Idempotente: si ya aceptó, devolver el registro existente
    existing = await db.subsidio_declaraciones.find_one({"user_id": user["id"]}, {"_id": 0})
    if existing:
        return {"ok": True, "declaracion": existing, "already": True}

    # Validar que hayan terminado etapas 1, 2 y 3
    drafts_pendientes = await db.consumos_subsidio.count_documents(
        {"user_id": user["id"], "status": "draft"}
    )
    confirmadas = await db.consumos_subsidio.count_documents(
        {"user_id": user["id"], "status": "confirmed"}
    )
    if drafts_pendientes > 0:
        raise HTTPException(status_code=400, detail="Aún tienes facturas en borrador. Confírmalas antes de firmar la declaración.")
    if confirmadas == 0:
        raise HTTPException(status_code=400, detail="Debes subir y confirmar al menos una factura de combustible.")

    # Verificar docs empresa + flota subidos
    docs = await db.subsidio_documents.find({"user_id": user["id"]}, {"_id": 0}).to_list(1000)
    vehicles = await db.subsidio_vehicles.find({"user_id": user["id"]}, {"_id": 0}).to_list(200)
    docs_set = {(d["categoria"], d.get("placa")) for d in docs}
    missing = []
    for cat in EMPRESA_CATEGORIES:
        if (cat, None) not in docs_set:
            missing.append(DOCUMENT_LABELS[cat])
    if len(vehicles) == 0:
        missing.append("Al menos una placa registrada")
    for v in vehicles:
        for cat in FLOTA_CATEGORIES:
            if (cat, v["placa"]) not in docs_set:
                missing.append(f"{DOCUMENT_LABELS[cat]} — {v['placa']}")
    if missing:
        raise HTTPException(status_code=400, detail={
            "message": "Faltan documentos antes de firmar la declaración",
            "missing": missing[:10],
        })

    record = {
        "id": str(uuid.uuid4()),
        "user_id": user["id"],
        "empresa": user.get("empresa"),
        "ruc": user.get("ruc"),
        "representante": payload.representante or user.get("contacto") or user.get("name"),
        "accepted_at": datetime.now(timezone.utc).isoformat(),
        "ip": (request.client.host if request.client else None),
        "user_agent": request.headers.get("user-agent", ""),
        "texto": (
            "Declaro bajo juramento que la información, documentos y comprobantes presentados "
            "para acceder al subsidio económico del Decreto de Urgencia N.° 004-2026 son verdaderos, "
            "exactos y corresponden a unidades con habilitación vigente. Reconozco que la presentación "
            "de información falsa, adulterada o inexacta genera la pérdida automática del subsidio, "
            "sin perjuicio de las responsabilidades administrativas, civiles y penales que correspondan."
        ),
    }
    await db.subsidio_declaraciones.insert_one(record)
    # Marcar expediente como enviado a la ATU + iniciar etapa "solicitud enviada"
    await db.users.update_one(
        {"id": user["id"]},
        {"$set": {"expediente_status": "submitted", "documentos_completos": True,
                  "expediente_submitted_at": record["accepted_at"],
                  "expediente_stage": "solicitud_enviada",
                  "expediente_stage_updated_at": record["accepted_at"]}},
    )
    rec_out = {k: v for k, v in record.items() if k != "_id"}
    return {"ok": True, "declaracion": rec_out, "expediente_status": "submitted"}


@subsidio_router.get("/subsidio/declaracion")
async def get_declaracion(user: dict = Depends(_require_subsidio)):
    rec = await db.subsidio_declaraciones.find_one({"user_id": user["id"]}, {"_id": 0})
    return {"declaracion": rec}


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

    # Validate MIME per category
    content_type = (file.content_type or "application/octet-stream").lower()
    allowed = _allowed_mimes_for(categoria)
    if content_type not in allowed:
        nice = {
            frozenset(EMPRESA_MIME): "PDF",
            frozenset(FLOTA_MIME): "PDF, JPG o PNG",
        }.get(frozenset(allowed), "PDF, JPG o PNG")
        raise HTTPException(status_code=400, detail=f"Formato no permitido. Esta etapa solo acepta: {nice}")

    content = await file.read()
    if len(content) > 20 * 1024 * 1024:
        raise HTTPException(status_code=400, detail="Archivo demasiado grande (max 20MB)")

    key = _subsidio_key(user["id"], categoria, placa_norm, file.filename or "doc")
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
    from services.pdf_invoice_reader import extract_invoice_data

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
    """Datos del dashboard del cliente_subsidio (5 filas):
    Fila 1: Etapas del trámite
    Fila 2: 6 KPIs
    Fila 3: Evolución semanal (semanas de 7 días desde 01/06/2026)
    Fila 4: Top unidades, Top estaciones
    Fila 5: Semáforo de vencimientos de documentos
    """
    from datetime import date, timedelta

    rows = await db.consumos_subsidio.find(
        {"user_id": user["id"], "status": "confirmed"},
        {"_id": 0, "raw_ocr_response": 0, "factura_storage_key": 0},
    ).to_list(5000)

    def _f(x):
        try:
            return float(x) if x not in (None, "") else 0.0
        except Exception:
            return 0.0

    # === KPIs base (galones, importe) ===
    total_gal = sum(_f(r.get("galones")) for r in rows)
    total_importe = sum(_f(r.get("importe_total")) for r in rows)

    # === Unidades (vehículos) ===
    vehicles = await db.subsidio_vehicles.find({"user_id": user["id"]}, {"_id": 0}).to_list(200)
    unidades_incluidas = len(vehicles)
    placas_activas = {(r.get("placa") or "").upper().strip() for r in rows if (r.get("placa") or "").strip()}
    unidades_activas = len({v["placa"] for v in vehicles if v["placa"].upper() in placas_activas})

    precio_promedio_gl = (total_importe / total_gal) if total_gal > 0 else 0
    costo_promedio_unidad = (total_importe / unidades_activas) if unidades_activas > 0 else 0

    # === Etapas (Fila 1) ===
    current_stage = user.get("expediente_stage")
    stages_list = [
        {"key": "solicitud_enviada",  "label": "Solicitud enviada"},
        {"key": "evaluacion_atu",     "label": "Evaluación ATU"},
        {"key": "aprobada",           "label": "Aprobada"},
        {"key": "abonado_en_cuenta",  "label": "Abonado en cuenta"},
    ]
    if current_stage in SUBSIDIO_STAGES:
        cur_idx = SUBSIDIO_STAGES.index(current_stage)
    else:
        cur_idx = -1
    for i, s in enumerate(stages_list):
        s["status"] = "done" if i < cur_idx else ("current" if i == cur_idx else "pending")

    # === Serie semanal (Fila 3): semanas de 7 días empezando 01/06/2026 ===
    WEEK_START = date(2026, 6, 1)
    weeks_map = {}

    def _parse_date(s):
        if not s:
            return None
        s = str(s).strip()
        # ISO YYYY-MM-DD
        try:
            return datetime.strptime(s[:10], "%Y-%m-%d").date()
        except Exception:
            pass
        # DD/MM/YYYY
        try:
            return datetime.strptime(s[:10], "%d/%m/%Y").date()
        except Exception:
            pass
        # DD-MM-YYYY
        try:
            return datetime.strptime(s[:10], "%d-%m-%Y").date()
        except Exception:
            return None

    for r in rows:
        d = _parse_date(r.get("fecha"))
        if not d:
            continue
        delta_days = (d - WEEK_START).days
        if delta_days < 0:
            continue
        week_idx = delta_days // 7  # 0-based
        wk_start = WEEK_START + timedelta(days=week_idx * 7)
        wk_end = wk_start + timedelta(days=6)
        key = week_idx
        slot = weeks_map.setdefault(key, {
            "semana": f"Sem {week_idx + 1}",
            "rango": f"{wk_start.strftime('%d/%m')}–{wk_end.strftime('%d/%m')}",
            "galones": 0.0,
            "importe": 0.0,
            "cargas": 0,
        })
        slot["galones"] += _f(r.get("galones"))
        slot["importe"] += _f(r.get("importe_total"))
        slot["cargas"] += 1

    serie_semanal = []
    if weeks_map:
        max_week = max(weeks_map.keys())
        for i in range(max_week + 1):
            wk_start = WEEK_START + timedelta(days=i * 7)
            wk_end = wk_start + timedelta(days=6)
            slot = weeks_map.get(i, {
                "semana": f"Sem {i + 1}",
                "rango": f"{wk_start.strftime('%d/%m')}–{wk_end.strftime('%d/%m')}",
                "galones": 0.0,
                "importe": 0.0,
                "cargas": 0,
            })
            serie_semanal.append({
                "semana": slot["semana"],
                "rango": slot["rango"],
                "galones": round(slot["galones"], 2),
                "importe": round(slot["importe"], 2),
                "cargas": slot["cargas"],
            })

    # === Top unidades (Fila 4 izq) ===
    by_placa = {}
    for r in rows:
        p = (r.get("placa") or "Sin placa").upper().strip() or "Sin placa"
        d = by_placa.setdefault(p, {"galones": 0.0, "importe": 0.0, "cargas": 0})
        d["galones"] += _f(r.get("galones"))
        d["importe"] += _f(r.get("importe_total"))
        d["cargas"] += 1
    top_unidades = sorted(
        [{"placa": p, "galones": round(v["galones"], 2), "importe": round(v["importe"], 2), "cargas": v["cargas"]} for p, v in by_placa.items()],
        key=lambda x: -x["galones"],
    )[:5]

    # === Top estaciones (Fila 4 der) ===
    by_est = {}
    for r in rows:
        e = (r.get("estacion") or "Sin estación").strip() or "Sin estación"
        d = by_est.setdefault(e, {"galones": 0.0, "importe": 0.0, "cargas": 0})
        d["galones"] += _f(r.get("galones"))
        d["importe"] += _f(r.get("importe_total"))
        d["cargas"] += 1
    top_estaciones = sorted(
        [{"estacion": e, "galones": round(v["galones"], 2), "importe": round(v["importe"], 2), "cargas": v["cargas"]} for e, v in by_est.items()],
        key=lambda x: -x["galones"],
    )[:5]

    # === Semáforo de vencimiento de documentos (Fila 5) — MOCK simple ===
    # Heurística sin créditos extra: cada documento de empresa tiene vigencia
    # de 365 días desde su carga. Verde > 30d, Amarillo ≤30d, Rojo vencido.
    docs = await db.subsidio_documents.find(
        {"user_id": user["id"], "categoria": {"$in": EMPRESA_CATEGORIES}},
        {"_id": 0, "categoria": 1, "uploaded_at": 1, "filename": 1},
    ).to_list(50)
    today = datetime.now(timezone.utc).date()
    DOC_LIFETIME_DAYS = 365
    docs_semaforo = []
    for cat in EMPRESA_CATEGORIES:
        match = next((d for d in docs if d.get("categoria") == cat), None)
        if not match:
            docs_semaforo.append({
                "categoria": cat,
                "label": DOCUMENT_LABELS.get(cat, cat),
                "uploaded": False,
                "expires_at": None,
                "days_remaining": None,
                "status": "missing",
            })
            continue
        try:
            up_date = datetime.fromisoformat(match["uploaded_at"].replace("Z", "+00:00")).date()
        except Exception:
            up_date = today
        expires_at = up_date + timedelta(days=DOC_LIFETIME_DAYS)
        days_rem = (expires_at - today).days
        if days_rem < 0:
            status = "expired"
        elif days_rem <= 30:
            status = "expiring"
        else:
            status = "active"
        docs_semaforo.append({
            "categoria": cat,
            "label": DOCUMENT_LABELS.get(cat, cat),
            "uploaded": True,
            "expires_at": expires_at.isoformat(),
            "days_remaining": days_rem,
            "status": status,
        })

    summary_active = sum(1 for d in docs_semaforo if d["status"] == "active")
    summary_expiring = sum(1 for d in docs_semaforo if d["status"] == "expiring")
    summary_expired = sum(1 for d in docs_semaforo if d["status"] == "expired")
    summary_missing = sum(1 for d in docs_semaforo if d["status"] == "missing")

    # Calc para subsidio_estimado (legacy)
    calc = await db.calculations.find_one({"id": user.get("calc_id")}, {"_id": 0}) or {}
    subsidio_estimado = float(calc.get("subsidio_estimado", 0) or 0)

    # Contar drafts pendientes (facturas subidas pero no confirmadas)
    pending_drafts = await db.consumos_subsidio.count_documents(
        {"user_id": user["id"], "status": "draft"}
    )

    # Serie mensual (legacy compatibility para no romper otras vistas)
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
        for k, v in sorted(by_month.items()) if k != "sin-fecha"
    ]

    return {
        # Fila 1
        "stages": stages_list,
        "current_stage": current_stage,
        # Pending drafts (banner)
        "pending_drafts": pending_drafts,
        # Fila 2 (6 KPIs)
        "kpis": {
            "unidades_incluidas": unidades_incluidas,
            "unidades_activas": unidades_activas,
            "galones_reconocidos": round(total_gal, 2),
            "gasto_total": round(total_importe, 2),
            "precio_promedio_galon": round(precio_promedio_gl, 2),
            "costo_promedio_unidad": round(costo_promedio_unidad, 2),
            # Legacy (no romper UI antigua/admin)
            "facturas_confirmadas": len(rows),
            "galones_confirmados": round(total_gal, 2),
            "importe_total": round(total_importe, 2),
            "subsidio_estimado": round(subsidio_estimado, 2),
            "subsidio_reconocido": round(total_gal * 1.5, 2),
            "precio_promedio": round(precio_promedio_gl, 2),
        },
        # Fila 3
        "serie_semanal": serie_semanal,
        # Fila 4
        "top_unidades": top_unidades,
        "top_estaciones": top_estaciones,
        # Fila 5
        "documentos_semaforo": {
            "items": docs_semaforo,
            "summary": {
                "active": summary_active,
                "expiring": summary_expiring,
                "expired": summary_expired,
                "missing": summary_missing,
            },
        },
        # Legacy
        "serie_mensual": serie_mensual,
        "top_placas": top_unidades,
        "ultimas_facturas": sorted(rows, key=lambda r: r.get("fecha") or "", reverse=True)[:10],
    }



# ============================================================================
# ADMIN — Vista de expedientes para admin_enered (read-only)
# ============================================================================
async def _require_admin_enered(request: Request) -> dict:
    user = await _get_current_user(request)
    if user.get("role") != "admin_enered":
        raise HTTPException(status_code=403, detail="Solo admin_enered")
    return user


@subsidio_router.get("/admin/subsidio/expedientes")
async def admin_list_expedientes(
    _: dict = Depends(_require_admin_enered),
    q: Optional[str] = None,
    estado: Optional[str] = None,
    limit: int = 200,
):
    """Lista todos los clientes de subsidio con resumen del expediente."""
    filt = {"role": "cliente_subsidio"}
    if q:
        filt["$or"] = [
            {"empresa": {"$regex": q, "$options": "i"}},
            {"ruc": {"$regex": q}},
            {"email": {"$regex": q, "$options": "i"}},
        ]
    if estado:
        filt["expediente_status"] = estado

    users = await db.users.find(filt, {"_id": 0, "password_hash": 0}).sort("created_at", -1).to_list(limit)

    out = []
    for u in users:
        uid = u["id"]
        calc = await db.calculations.find_one({"id": u.get("calc_id")}, {"_id": 0}) if u.get("calc_id") else None
        docs_count = await db.subsidio_documents.count_documents({"user_id": uid})
        vehicles_count = await db.subsidio_vehicles.count_documents({"user_id": uid})
        invoices_draft = await db.consumos_subsidio.count_documents({"user_id": uid, "status": "draft"})
        invoices_conf = await db.consumos_subsidio.count_documents({"user_id": uid, "status": "confirmed"})
        decl = await db.subsidio_declaraciones.find_one({"user_id": uid}, {"_id": 0, "accepted_at": 1, "representante": 1})
        # Suma galones confirmados → ahorro reconocido
        agg = await db.consumos_subsidio.aggregate([
            {"$match": {"user_id": uid, "status": "confirmed"}},
            {"$group": {"_id": None, "gal": {"$sum": "$galones"}, "imp": {"$sum": "$importe_total"}}},
        ]).to_list(1)
        galones_conf = (agg[0]["gal"] if agg else 0) or 0
        importe_conf = (agg[0]["imp"] if agg else 0) or 0

        out.append({
            "user_id": uid,
            "empresa": u.get("empresa"),
            "ruc": u.get("ruc"),
            "email": u.get("email"),
            "contacto": u.get("contacto"),
            "telefono": u.get("telefono"),
            "created_at": u.get("created_at"),
            "expediente_status": u.get("expediente_status") or "uploading",
            "expediente_stage": u.get("expediente_stage"),
            "expediente_stage_updated_at": u.get("expediente_stage_updated_at"),
            "documentos_completos": bool(u.get("documentos_completos")),
            "expediente_submitted_at": u.get("expediente_submitted_at"),
            "ahorro_estimado": (calc or {}).get("subsidio_estimado", 0),
            "ahorro_reconocido": round(float(galones_conf) * 1.5, 2),
            "galones_confirmados": round(float(galones_conf), 2),
            "importe_confirmado": round(float(importe_conf), 2),
            "docs_count": docs_count,
            "vehicles_count": vehicles_count,
            "invoices": {"draft": invoices_draft, "confirmed": invoices_conf},
            "declaracion_firmada": bool(decl),
            "declaracion_at": (decl or {}).get("accepted_at"),
        })
    return {"items": out, "total": len(out)}


@subsidio_router.get("/admin/subsidio/expedientes/{user_id}")
async def admin_get_expediente(user_id: str, _: dict = Depends(_require_admin_enered)):
    """Detalle completo de un cliente_subsidio: cálculo, banco, docs, flota, facturas, declaración."""
    u = await db.users.find_one({"id": user_id, "role": "cliente_subsidio"}, {"_id": 0, "password_hash": 0})
    if not u:
        raise HTTPException(status_code=404, detail="Expediente no encontrado")
    calc = await db.calculations.find_one({"id": u.get("calc_id")}, {"_id": 0}) if u.get("calc_id") else None
    bank = await db.subsidio_bank_accounts.find_one({"user_id": user_id}, {"_id": 0})
    docs = await db.subsidio_documents.find({"user_id": user_id}, {"_id": 0, "storage_key": 0}).sort("created_at", -1).to_list(500)
    vehicles = await db.subsidio_vehicles.find({"user_id": user_id}, {"_id": 0}).sort("created_at", 1).to_list(200)
    invoices = await db.consumos_subsidio.find(
        {"user_id": user_id},
        {"_id": 0, "raw_ocr_response": 0, "factura_storage_key": 0},
    ).sort("fecha", -1).to_list(2000)
    decl = await db.subsidio_declaraciones.find_one({"user_id": user_id}, {"_id": 0})

    # Etiquetas legibles
    for d in docs:
        d["label"] = DOCUMENT_LABELS.get(d.get("categoria"), d.get("categoria"))

    return {
        "user": u,
        "calculation": calc,
        "bank_account": bank,
        "documents": docs,
        "vehicles": vehicles,
        "invoices": invoices,
        "declaracion": decl,
        "stats": {
            "docs_count": len(docs),
            "vehicles_count": len(vehicles),
            "invoices_draft": sum(1 for i in invoices if i.get("status") == "draft"),
            "invoices_confirmed": sum(1 for i in invoices if i.get("status") == "confirmed"),
            "galones_confirmados": round(sum((i.get("galones") or 0) for i in invoices if i.get("status") == "confirmed"), 2),
            "importe_confirmado": round(sum((i.get("importe_total") or 0) for i in invoices if i.get("status") == "confirmed"), 2),
        },
    }


@subsidio_router.get("/admin/subsidio/documents/{doc_id}/download")
async def admin_download_document(doc_id: str, _: dict = Depends(_require_admin_enered)):
    """Admin descarga cualquier documento del expediente."""
    d = await db.subsidio_documents.find_one({"id": doc_id}, {"_id": 0})
    if not d:
        raise HTTPException(status_code=404, detail="Documento no encontrado")
    return storage.download_response(d["storage_key"], d["filename"], d.get("content_type", "application/octet-stream"))


@subsidio_router.put("/admin/subsidio/expedientes/{user_id}/stage")
async def admin_update_stage(
    user_id: str,
    payload: StageUpdateIn,
    _: dict = Depends(_require_admin_enered),
):
    """Admin cambia la etapa del expediente del cliente_subsidio.
    Etapas: solicitud_enviada → evaluacion_atu → aprobada → abonado_en_cuenta
    """
    u = await db.users.find_one({"id": user_id, "role": "cliente_subsidio"}, {"_id": 0, "password_hash": 0})
    if not u:
        raise HTTPException(status_code=404, detail="Expediente no encontrado")
    now = datetime.now(timezone.utc).isoformat()
    await db.users.update_one(
        {"id": user_id},
        {"$set": {
            "expediente_stage": payload.stage,
            "expediente_stage_updated_at": now,
        }},
    )
    return {"ok": True, "expediente_stage": payload.stage, "updated_at": now}


@subsidio_router.get("/admin/subsidio/invoices/{invoice_id}/download")
async def admin_download_invoice(invoice_id: str, _: dict = Depends(_require_admin_enered)):
    """Admin descarga el archivo PDF/imagen de una factura de consumo."""
    inv = await db.consumos_subsidio.find_one({"id": invoice_id})
    if not inv or not inv.get("factura_storage_key"):
        raise HTTPException(status_code=404, detail="Archivo de factura no encontrado")
    return storage.download_response(
        inv["factura_storage_key"],
        inv["factura_filename"],
        inv.get("factura_content_type", "application/octet-stream")
    )


@subsidio_router.delete("/admin/subsidio/documents/{doc_id}")
async def admin_delete_document(doc_id: str, _: dict = Depends(_require_admin_enered)):
    """Admin elimina un documento (empresa o flota) del expediente."""
    d = await db.subsidio_documents.find_one({"id": doc_id})
    if not d:
        raise HTTPException(status_code=404, detail="Documento no encontrado")
    if d.get("storage_key"):
        storage.delete_object(d["storage_key"])
    await db.subsidio_documents.delete_one({"id": doc_id})
    return {"status": "ok"}


@subsidio_router.delete("/admin/subsidio/invoices/{invoice_id}")
async def admin_delete_invoice(invoice_id: str, _: dict = Depends(_require_admin_enered)):
    """Admin elimina una factura de consumo. Se descuenta del historial del cliente."""
    inv = await db.consumos_subsidio.find_one({"id": invoice_id})
    if not inv:
        raise HTTPException(status_code=404, detail="Factura no encontrada")
    if inv.get("factura_storage_key"):
        storage.delete_object(inv["factura_storage_key"])
    await db.consumos_subsidio.delete_one({"id": invoice_id})
    return {"status": "ok"}
