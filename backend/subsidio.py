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
from datetime import datetime, timezone, timedelta
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
        token = request.query_params.get("t") or request.query_params.get("token")
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


async def _get_company_uids(user_id: str) -> list[str]:
    u = await db.users.find_one({"id": user_id})
    if u and u.get("empresa"):
        users = await db.users.find({"empresa": u["empresa"]}).to_list(100)
        return [usr["id"] for usr in users]
    return [user_id]


async def _require_subsidio(request: Request) -> dict:
    user = await _get_current_user(request)
    allowed = ["admin_enered", "cliente_subsidio", "administrador", "logistica", "contabilidad"]
    if user["role"] not in allowed:
        raise HTTPException(status_code=403, detail="No tienes acceso al módulo de subsidio")
    return user


def _normalize_doc(d: dict) -> dict:
    if not d:
        return d
    if "categoria" in d and "category" not in d:
        d["category"] = d["categoria"]
    elif "category" in d and "categoria" not in d:
        d["categoria"] = d["category"]
    
    if "uploaded_at" in d and "created_at" not in d:
        d["created_at"] = d["uploaded_at"]
    elif "created_at" in d and "uploaded_at" not in d:
        d["uploaded_at"] = d["created_at"]
    return d



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


class VehicleAdminIn(BaseModel):
    placa: str
    categoria: Literal["M2", "M3", "N1", "N2", "N3"]
    anio_fabricacion: Optional[int] = None
    vigente_desde: Optional[str] = None
    vigente_hasta: Optional[str] = None


class InvoiceAdminCreateIn(BaseModel):
    numero_documento: str
    fecha: str
    estacion: str
    ruc_emisor: str
    ciudad: str
    placa: str
    galones: float
    precio_unitario: float
    importe_total: float
    producto: Optional[str] = "DIESEL B5"


class RepresentanteUpdateIn(BaseModel):
    representante: str


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
        token = "sk_17602.EtG1u5naGp52wXGBfMWGY5QjvZFEYmJH"

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
            "tipo_cliente": "subsidio",
            "servicios": {
                "plataforma": False,
                "combustible": False,
                "gps": False,
                "subsidio": True,
            },
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
    pub["servicios"] = {
        "plataforma": False,
        "combustible": False,
        "gps": False,
        "subsidio": True,
    }
    pub["tipo_cliente"] = "subsidio"
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

    uids = await _get_company_uids(user["id"])
    
    # Vehículos
    vehicles_dict = {}
    
    # Traer primero los de la flota principal si hay empresa
    if user.get("empresa"):
        main_veh = await db.vehiculos.find({"empresa": user.get("empresa")}, {"_id": 0}).to_list(1000)
        for mv in main_veh:
            placa = (mv.get("placa") or mv.get("veh") or "").strip().upper()
            if not placa: continue
            vehicles_dict[placa] = {
                "id": mv.get("id", str(uuid.uuid4())),
                "placa": placa,
                "categoria": mv.get("categoria") or "N1",
                "user_id": mv.get("created_by") or user["id"],
                "from_main_fleet": True
            }
            
    # Traer los del modulo subsidio (sobreescriben si hay duplicados por placa)
    sub_veh = await db.subsidio_vehicles.find({"user_id": {"$in": uids}}, {"_id": 0}).to_list(500)
    for sv in sub_veh:
        placa = (sv.get("placa") or "").strip().upper()
        if not placa: continue
        vehicles_dict[placa] = sv
        
    vehicles = list(vehicles_dict.values())

    # Documentos
    docs = await db.subsidio_documents.find(
        {"user_id": {"$in": uids}}, {"_id": 0}
    ).to_list(1000)
    docs = [_normalize_doc(d) for d in docs]

    # Cuenta bancaria
    bank = await db.subsidio_bank_accounts.find_one(
        {"user_id": {"$in": uids}}, {"_id": 0}, sort=[("updated_at", -1)]
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
    invoices_draft = await db.consumos_subsidio.count_documents({"user_id": {"$in": uids}, "status": "draft"})
    invoices_confirmed = await db.consumos_subsidio.count_documents({"user_id": {"$in": uids}, "status": "confirmed"})
    
    # Calcular ahorro_reconocido real (galones confirmados * 4)
    ahorro_reconocido_real = 0
    if invoices_confirmed > 0:
        agg = await db.consumos_subsidio.aggregate([
            {"$match": {"user_id": {"$in": uids}, "status": "confirmed"}},
            {"$group": {"_id": None, "total_gal": {"$sum": "$galones"}}}
        ]).to_list(1)
        if agg and agg[0].get("total_gal"):
            ahorro_reconocido_real = round(float(agg[0]["total_gal"]) * 4.0, 2)

    return {
        "user": {k: v for k, v in user.items() if k not in ("password_hash", "_id")},
        "calculation": calc,
        "ahorro_estimado": calc.get("subsidio_estimado", 0),
        "ahorro_reconocido": ahorro_reconocido_real,
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

    uids = await _get_company_uids(user["id"])
    
    # Idempotente: si ya aceptó alguien de la empresa, devolver el registro existente
    existing = await db.subsidio_declaraciones.find_one({"user_id": {"$in": uids}}, {"_id": 0})
    if existing:
        return {"ok": True, "declaracion": existing, "already": True}

    # Validar que hayan terminado etapas 1, 2 y 3
    drafts_pendientes = await db.consumos_subsidio.count_documents(
        {"user_id": {"$in": uids}, "status": "draft"}
    )
    confirmadas = await db.consumos_subsidio.count_documents(
        {"user_id": {"$in": uids}, "status": "confirmed"}
    )
    if drafts_pendientes > 0:
        raise HTTPException(status_code=400, detail="Aún tienes facturas en borrador. Confírmalas antes de firmar la declaración.")
    if confirmadas == 0:
        raise HTTPException(status_code=400, detail="Debes subir y confirmar al menos una factura de combustible.")

    # Verificar docs empresa + flota subidos
    docs = await db.subsidio_documents.find({"user_id": {"$in": uids}}, {"_id": 0}).to_list(1000)
    docs = [_normalize_doc(d) for d in docs]
    vehicles = await db.subsidio_vehicles.find({"user_id": {"$in": uids}}, {"_id": 0}).to_list(200)
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
    # Marcar expediente como enviado a la ATU para toda la empresa
    await db.users.update_many(
        {"id": {"$in": uids}},
        {"$set": {"expediente_status": "submitted", "documentos_completos": True,
                  "expediente_submitted_at": record["accepted_at"],
                  "expediente_stage": "solicitud_enviada",
                  "expediente_stage_updated_at": record["accepted_at"]}},
    )
    rec_out = {k: v for k, v in record.items() if k != "_id"}
    return {"ok": True, "declaracion": rec_out, "expediente_status": "submitted"}


@subsidio_router.get("/subsidio/declaracion")
async def get_declaracion(user: dict = Depends(_require_subsidio)):
    uids = await _get_company_uids(user["id"])
    rec = await db.subsidio_declaraciones.find_one({"user_id": {"$in": uids}}, {"_id": 0}, sort=[("accepted_at", -1)])
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
        "category": categoria,
        "placa": placa_norm,
        "filename": file.filename,
        "storage_key": key,
        "content_type": content_type,
        "size": len(content),
        "uploaded_at": datetime.now(timezone.utc).isoformat(),
        "created_at": datetime.now(timezone.utc).isoformat(),
        "status": "pendiente_validacion",
    }
    await db.subsidio_documents.insert_one(doc)
    return {"ok": True, "document": {k: v for k, v in doc.items() if k != "_id"}}


@subsidio_router.delete("/subsidio/documents/{doc_id}")
async def delete_document(doc_id: str, user: dict = Depends(_require_subsidio)):
    uids = await _get_company_uids(user["id"])
    d = await db.subsidio_documents.find_one({"id": doc_id, "user_id": {"$in": uids}})
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
    uids = await _get_company_uids(user["id"])
    d = await db.subsidio_documents.find_one({"id": doc_id, "user_id": {"$in": uids}}, {"_id": 0})
    if not d:
        raise HTTPException(status_code=404, detail="Documento no encontrado")
    return storage.download_response(d["storage_key"], d["filename"], d.get("content_type", "application/octet-stream"))


@subsidio_router.get("/subsidio/my-docs-summary")
async def my_docs_summary(user: dict = Depends(_require_subsidio)):
    """Resumen de documentos subidos en Mi Flota, listos para consumirse
    desde los módulos Vehículos y Documentación una vez desbloqueados.
    Retorna:
      - empresa: [{id, categoria, label, filename, uploaded_at, download_url}]
      - por_placa: { "ABC-123": [{...docs de esa placa...}], ... }
      - combustible: [{...docs comprobantes...}]
    """
    uids = await _get_company_uids(user["id"])
    docs = await db.subsidio_documents.find(
        {"user_id": {"$in": uids}}, {"_id": 0, "storage_key": 0}
    ).sort("uploaded_at", -1).to_list(2000)

    empresa = []
    por_placa = {}
    combustible = []
    for d in docs:
        d = _normalize_doc(d)
        cat = d.get("categoria")
        item = {
            "id": d.get("id"),
            "categoria": cat,
            "label": DOCUMENT_LABELS.get(cat, cat),
            "filename": d.get("filename"),
            "content_type": d.get("content_type"),
            "size": d.get("size"),
            "placa": d.get("placa"),
            "uploaded_at": d.get("uploaded_at"),
            "download_url": f"/api/subsidio/documents/{d.get('id')}/download",
        }
        if cat in EMPRESA_CATEGORIES:
            empresa.append(item)
        elif cat in FLOTA_CATEGORIES:
            placa = (d.get("placa") or "").upper().strip()
            por_placa.setdefault(placa, []).append(item)
        elif cat in COMBUSTIBLE_CATEGORIES:
            combustible.append(item)

    return {
        "empresa": empresa,
        "por_placa": por_placa,
        "combustible": combustible,
        "total": len(docs),
    }



@subsidio_router.put("/subsidio/bank-account")
async def update_bank_account(payload: BankAccountIn, user: dict = Depends(_require_subsidio)):
    if not payload.es_banco_nacion and not payload.cci:
        raise HTTPException(status_code=400, detail="CCI obligatorio si no es Banco de la Nación")
    doc = payload.model_dump()
    uids = await _get_company_uids(user["id"])
    doc["user_id"] = user["id"]
    doc["empresa"] = user.get("empresa")
    doc["updated_at"] = datetime.now(timezone.utc).isoformat()
    # Find existing bank account for company or insert new
    existing = await db.subsidio_bank_accounts.find_one({"user_id": {"$in": uids}})
    if existing:
        await db.subsidio_bank_accounts.update_one({"user_id": existing["user_id"]}, {"$set": doc})
    else:
        await db.subsidio_bank_accounts.insert_one(doc)
    return {"ok": True, "bank_account": doc}


@subsidio_router.post("/subsidio/vehicles")
async def add_vehicle(payload: VehicleIn, user: dict = Depends(_require_subsidio)):
    placa = payload.placa.upper().strip()
    uids = await _get_company_uids(user["id"])
    if await db.subsidio_vehicles.find_one({"user_id": {"$in": uids}, "placa": placa}):
        raise HTTPException(status_code=409, detail="La placa ya está registrada en la empresa")
    doc = {
        "id": str(uuid.uuid4()),
        "user_id": user["id"],
        "empresa": user.get("empresa"),
        "placa": placa,
        "categoria": payload.categoria,
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    await db.subsidio_vehicles.insert_one(doc)
    
    # --- AUTO SYNC CON MODULO VEHICULOS ---
    existing_vehiculo = await db.vehiculos.find_one({"placa": placa})
    if not existing_vehiculo:
        import urllib.request
        import json
        import ssl
        import asyncio
        
        token = "tr_4f9d763ed120de2849b99dd05e61c67e"
        placa_clean = placa.replace("-", "").upper()
        url = f"https://api2.consultadatos.com/api/placa/leyenda/{placa_clean}"
        
        marca = ""
        modelo = ""
        chasis = ""
        año = None
        titular = ""
        tipo = ""
        
        try:
            headers = {
                "Authorization": f"Bearer {token}",
                "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
                "Accept": "application/json"
            }
            req_api = urllib.request.Request(url, headers=headers)
            ctx = ssl.create_default_context()
            ctx.check_hostname = False
            ctx.verify_mode = ssl.CERT_NONE
            
            def fetch_api():
                with urllib.request.urlopen(req_api, context=ctx, timeout=5) as response:
                    return response.read().decode('utf-8')
                    
            raw_res = await asyncio.to_thread(fetch_api)
            res_data = json.loads(raw_res)
            
            if res_data.get("success") and "data" in res_data:
                    v = res_data["data"].get("vehiculo", {})
                    props = res_data["data"].get("propietarios", [])
                    
                    if props:
                        titular = props[0].get("propietario", "")
                    
                    try:
                        año_str = v.get("ano_fab") or v.get("an_mode")
                        if año_str:
                            año = int(año_str)
                    except:
                        pass
                        
                    marca = v.get("marca", "")
                    modelo = v.get("modelo", "")
                    chasis = v.get("no_vin") or v.get("num_serie", "")
                    tipo = v.get("desc_tipo_carr", "")
        except Exception:
            pass # Si falla SUNARP, registramos el vehiculo con datos en blanco
            
        vehiculo_doc = {
            "id": str(uuid.uuid4()),
            "placa": placa,
            "marca": marca,
            "modelo": modelo,
            "año": año,
            "chasis": chasis,
            "estado": "OPERATIVO",
            "unidad": "",
            "tipo": tipo,
            "base": "",
            "titular": titular,
            "cc": "",
            "conductor_principal_id": None,
            "empresa": user.get("empresa"),
            "kilometraje": 0,
            "created_at": datetime.now(timezone.utc).isoformat(),
            "created_by": user["id"],
        }
        await db.vehiculos.insert_one(vehiculo_doc)
    # --------------------------------------
    return {"ok": True, "vehicle": {k: v for k, v in doc.items() if k != "_id"}}


@subsidio_router.delete("/subsidio/vehicles/{placa}")
async def remove_vehicle(placa: str, user: dict = Depends(_require_subsidio)):
    placa_norm = placa.upper().strip()
    uids = await _get_company_uids(user["id"])
    await db.subsidio_vehicles.delete_one({"user_id": {"$in": uids}, "placa": placa_norm})
    # Borra docs de esa placa
    docs = await db.subsidio_documents.find(
        {"user_id": {"$in": uids}, "placa": placa_norm}, {"_id": 0}
    ).to_list(100)
    for d in docs:
        try:
            storage.delete_object(d["storage_key"])
        except Exception:
            pass
    await db.subsidio_documents.delete_many({"user_id": {"$in": uids}, "placa": placa_norm})
    return {"ok": True}


@subsidio_router.post("/subsidio/finalize")
async def finalize(user: dict = Depends(_require_subsidio)):
    """Marca el expediente como completado. Valida que todo esté presente."""
    # Re-construir el dashboard para verificar can_finalize
    uids = await _get_company_uids(user["id"])
    vehicles = await db.subsidio_vehicles.find({"user_id": {"$in": uids}}, {"_id": 0}).to_list(200)
    docs = await db.subsidio_documents.find({"user_id": {"$in": uids}}, {"_id": 0}).to_list(1000)
    docs = [_normalize_doc(d) for d in docs]
    bank = await db.subsidio_bank_accounts.find_one({"user_id": {"$in": uids}}, {"_id": 0})

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
    # Al terminar Mi Flota, desbloqueamos los módulos operativos:
    # Combustible, Cuenta, Vehículos y Documentación pasan a estar disponibles.
    # El resto (Analytics BI, Monitoreo, Calendario, etc.) siguen mostrando la vista Demo.
    empresa_name = user.get("empresa")
    if empresa_name:
        await db.empresas_config.update_one(
            {"empresa": empresa_name},
            {"$set": {
                "servicios.plataforma": True,
                "servicios.combustible": True,
                "updated_at": datetime.now(timezone.utc).isoformat(),
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
    uids = await _get_company_uids(user["id"])
    rows = await db.consumos_subsidio.find(
        {"user_id": {"$in": uids}, "status": "draft"},
        {"_id": 0, "raw_ocr_response": 0, "factura_storage_key": 0},
    ).sort("created_at", -1).to_list(500)
    # Placas registradas para mostrar dropdown de corrección
    vehicles = await db.subsidio_vehicles.find(
        {"user_id": {"$in": uids}}, {"_id": 0, "placa": 1, "categoria": 1}
    ).to_list(200)
    return {"items": rows, "vehicles": vehicles}


@subsidio_router.put("/subsidio/invoices/{invoice_id}")
async def invoices_update(
    invoice_id: str,
    payload: InvoiceUpdateIn,
    user: dict = Depends(_require_subsidio),
):
    uids = await _get_company_uids(user["id"])
    inv = await db.consumos_subsidio.find_one(
        {"id": invoice_id, "user_id": {"$in": uids}}, {"_id": 0}
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
    uids = await _get_company_uids(user["id"])
    inv = await db.consumos_subsidio.find_one({"id": invoice_id, "user_id": {"$in": uids}})
    if not inv:
        raise HTTPException(status_code=404, detail="Factura no encontrada")
    try:
        storage.delete_object(inv["factura_storage_key"])
    except Exception:
        pass
    
    # Delete from db.invoices if it was confirmed
    n_doc = (inv.get("numero_documento") or "").upper().strip()
    empresa = inv.get("empresa") or user.get("empresa") or ""
    if n_doc:
        await db.invoices.delete_one({"empresa": empresa, "n_doc": n_doc})

    await db.consumos_subsidio.delete_one({"id": invoice_id})
    return {"ok": True}


@subsidio_router.post("/subsidio/invoices/confirm")
async def invoices_confirm(user: dict = Depends(_require_subsidio)):
    """Confirma TODAS las facturas en draft del usuario → status=confirmed.
    Crea las facturas correspondientes en db.invoices y marca expediente_status=confirmed."""
    now = datetime.now(timezone.utc).isoformat()
    uids = await _get_company_uids(user["id"])
    drafts = await db.consumos_subsidio.find({"user_id": {"$in": uids}, "status": "draft"}).to_list(1000)

    for d in drafts:
        fecha_str = d.get("fecha") or datetime.now(timezone.utc).date().isoformat()
        if len(fecha_str) > 10:
            fecha_str = fecha_str[:10]
        f_venc = fecha_str
        try:
            f_dt = datetime.strptime(fecha_str, "%Y-%m-%d")
            f_venc = (f_dt + timedelta(days=30)).date().isoformat()
        except Exception:
            try:
                f_dt = datetime.strptime(fecha_str, "%d/%m/%Y")
                fecha_str = f_dt.date().isoformat()
                f_venc = (f_dt + timedelta(days=30)).date().isoformat()
            except Exception:
                pass

        n_doc = (d.get("numero_documento") or "").upper().strip()
        empresa = d.get("empresa") or user.get("empresa") or ""
        if n_doc:
            existing = await db.invoices.find_one({"empresa": empresa, "n_doc": n_doc})
            if not existing:
                inv_doc = {
                    "id": d.get("id") or str(uuid.uuid4()),
                    "empresa": empresa,
                    "n_doc": n_doc,
                    "tipo_doc": "factura",
                    "producto": d.get("producto") or "DIESEL B5 S-50",
                    "f_emision": fecha_str,
                    "f_vencimiento": f_venc,
                    "moneda": "PEN",
                    "monto_total": float(d.get("importe_total") or 0.0),
                    "saldo": float(d.get("importe_total") or 0.0),
                    "estado": "pendiente",
                    "atraso_dias": 0,
                    "pdf_filename": d.get("factura_filename"),
                    "xml_filename": None,
                    "uploaded_at": datetime.now(timezone.utc).isoformat(),
                    "uploaded_by": user["email"],
                    "created_via": "subsidio_confirm",
                }
                await db.invoices.insert_one(inv_doc)

    res = await db.consumos_subsidio.update_many(
        {"user_id": user["id"], "status": "draft"},
        {"$set": {"status": "confirmed", "confirmed_at": now}},
    )
    await db.users.update_one(
        {"id": user["id"]},
        {"$set": {"expediente_status": "confirmed"}},
    )
    return {"ok": True, "confirmed": res.modified_count}


def _combustible_to_subsidio(r: dict) -> dict:
    try:
        gal = float(r.get("CANTIDAD_GL") or 0)
    except Exception:
        gal = 0.0
    try:
        imp = float(r.get("IMPORTE_TOTAL") or 0)
    except Exception:
        imp = 0.0

    return {
        "id": r.get("id") or str(uuid.uuid4()),
        "fecha": r.get("FECHA") or "",
        "hora": r.get("HORA") or "",
        "placa": r.get("PLACA") or "",
        "ciudad": r.get("CIUDAD") or "",
        "estacion": r.get("ESTACION") or "",
        "producto": r.get("PRODUCTO") or "",
        "galones": gal,
        "precio_unitario": r.get("PRECIO_UNITARIO") or 0,
        "importe_total": imp,
        "ruc_emisor": r.get("RUC_EMISOR") or "",
        "numero_documento": r.get("NUMERO_DOCUMENTO") or "",
        "estado": "Confirmado (Combustible)",
        "_origen": "combustible"
    }

@subsidio_router.get("/subsidio/invoices/confirmed")
async def invoices_confirmed(user: dict = Depends(_require_subsidio)):
    """Lista facturas confirmadas (para módulos del cliente_subsidio)."""
    uids = await _get_company_uids(user["id"])
    rows = await db.consumos_subsidio.find(
        {"user_id": {"$in": uids}, "status": "confirmed"},
        {"_id": 0, "raw_ocr_response": 0, "factura_storage_key": 0},
    ).to_list(2000)

    if user.get("empresa"):
        rows_comb = await db.consumptions.find(
            {"EMPRESA": user["empresa"]},
            {"_id": 0}
        ).to_list(2000)
        mapped = [_combustible_to_subsidio(r) for r in rows_comb]
        rows.extend(mapped)

    rows.sort(key=lambda x: x.get("fecha") or "", reverse=True)
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
    
    uids = await _get_company_uids(user["id"])

    rows = await db.consumos_subsidio.find(
        {"user_id": {"$in": uids}, "status": "confirmed"},
        {"_id": 0, "raw_ocr_response": 0, "factura_storage_key": 0},
    ).to_list(5000)

    if user.get("empresa"):
        rows_comb = await db.consumptions.find(
            {"EMPRESA": user["empresa"]},
            {"_id": 0}
        ).to_list(5000)
        mapped = [_combustible_to_subsidio(r) for r in rows_comb]
        rows.extend(mapped)

    def _f(x):
        try:
            return float(x) if x not in (None, "") else 0.0
        except Exception:
            return 0.0

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

    # === KPIs base (galones, importe) ===
    total_gal = sum(_f(r.get("galones")) for r in rows)
    total_importe = sum(_f(r.get("importe_total")) for r in rows)

    # === Unidades (vehículos) ===
    vehicles = await db.subsidio_vehicles.find({"user_id": {"$in": uids}}, {"_id": 0}).to_list(200)
    unidades_incluidas = len(vehicles)
    placas_activas = {(r.get("placa") or "").upper().strip() for r in rows if (r.get("placa") or "").strip()}
    unidades_activas = len({v["placa"] for v in vehicles if v["placa"].upper() in placas_activas})

    cfg = await db.empresas_config.find_one({"empresa": user.get("empresa")})
    unidades_contratadas = cfg.get("unidades_contratadas", 0) if cfg else 0

    cat_counts = {}
    for v in vehicles:
        cat = v.get("categoria", "N2")
        cat_counts[cat] = cat_counts.get(cat, 0) + 1
    detail_parts = [f"{count} {cat}" for cat, count in sorted(cat_counts.items(), key=lambda x: -x[1])]
    unidades_detalle = " - ".join(detail_parts) if detail_parts else "0 unidades"

    today_date = datetime.now(timezone.utc).date()
    valid_vehicles = 0
    for v in vehicles:
        hasta = v.get("vigente_hasta")
        if not hasta:
            valid_vehicles += 1
            continue
        try:
            exp_date = datetime.strptime(hasta[:10], "%Y-%m-%d").date()
            if exp_date >= today_date:
                valid_vehicles += 1
        except Exception:
            valid_vehicles += 1

    # === Documentos en regla percentage and detail ===
    uploaded_docs_map = {}
    docs_list = await db.subsidio_documents.find({"user_id": user["id"]}).to_list(1000)
    for d in docs_list:
        cat = d.get("categoria") or d.get("category")
        placa = d.get("placa")
        uploaded_docs_map[(cat, placa)] = d

    total_req_docs = 3 + 2 * len(vehicles)
    valid_docs_count = 0
    expiring_soon_count = 0
    expired_count = 0
    missing_count = 0

    def eval_doc(cat, placa):
        nonlocal valid_docs_count, expiring_soon_count, expired_count, missing_count
        doc_match = uploaded_docs_map.get((cat, placa))
        if not doc_match:
            missing_count += 1
            return
        
        uploaded_at_str = doc_match.get("uploaded_at") or doc_match.get("created_at")
        if not uploaded_at_str:
            valid_docs_count += 1
            return
        
        try:
            up_date = datetime.fromisoformat(uploaded_at_str.replace("Z", "+00:00")).date()
            expires_at = up_date + timedelta(days=365)
            days_rem = (expires_at - today_date).days
            if days_rem < 0:
                expired_count += 1
            elif days_rem <= 30:
                expiring_soon_count += 1
                valid_docs_count += 1
            else:
                valid_docs_count += 1
        except Exception:
            valid_docs_count += 1

    for cat in ["ficha_ruc", "resolucion_autorizacion", "dni_representante"]:
        eval_doc(cat, None)
    for v in vehicles:
        for cat in ["tarjeta_habilitacion", "tarjeta_propiedad"]:
            eval_doc(cat, v["placa"])

    pct_docs = round((valid_docs_count / total_req_docs) * 100) if total_req_docs > 0 else 100

    if expiring_soon_count > 0:
        docs_detalle = f"{expiring_soon_count} por vencer pronto"
    elif expired_count > 0:
        docs_detalle = f"{expired_count} vencidos"
    elif missing_count > 0:
        docs_detalle = f"{missing_count} pendientes"
    else:
        docs_detalle = "Todos al día"

    distinct_months = {r.get("fecha")[:7] for r in rows if r.get("fecha") and len(r.get("fecha")) >= 7}
    num_meses = len(distinct_months) if distinct_months else 1

    by_month_stats = {}
    for r in rows:
        f_date = _parse_date(r.get("fecha"))
        if not f_date:
            continue
        ym = f_date.strftime("%Y-%m")
        stats = by_month_stats.setdefault(ym, {"galones": 0.0, "importe": 0.0})
        stats["galones"] += _f(r.get("galones"))
        stats["importe"] += _f(r.get("importe_total"))

    sorted_months = sorted(by_month_stats.keys())
    precio_promedio_diff = 0.0
    if len(sorted_months) >= 2:
        m_curr = sorted_months[-1]
        m_prev = sorted_months[-2]
        s_curr = by_month_stats[m_curr]
        s_prev = by_month_stats[m_prev]
        avg_curr = s_curr["importe"] / s_curr["galones"] if s_curr["galones"] > 0 else 0.0
        avg_prev = s_prev["importe"] / s_prev["galones"] if s_prev["galones"] > 0 else 0.0
        precio_promedio_diff = avg_curr - avg_prev

    current_year = datetime.now(timezone.utc).year
    ages = []
    older_than_10 = 0
    for v in vehicles:
        yr = v.get("anio_fabricacion")
        if yr:
            try:
                yr_val = int(yr)
                age = current_year - yr_val
                ages.append(age)
                if age >= 10:
                    older_than_10 += 1
            except Exception:
                pass
    avg_age = round(sum(ages) / len(ages), 1) if ages else 0.0

    precio_promedio_gl = (total_importe / total_gal) if total_gal > 0 else 0
    # Costo promedio por unidad dividiendo entre unidades_incluidas para coincidir con la maqueta
    costo_promedio_unidad = (total_importe / unidades_incluidas) if unidades_incluidas > 0 else 0

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
            "unidades_contratadas": unidades_contratadas,
            "unidades_detalle": unidades_detalle,
            "unidades_validas": valid_vehicles,
            "unidades_validas_pct": round((valid_vehicles / unidades_incluidas * 100) if unidades_incluidas > 0 else 0),
            "galones_reconocidos": round(total_gal, 2),
            "invoices_confirmed": len(rows),
            "invoices_total": len(rows) + pending_drafts,
            "gasto_total": round(total_importe, 2),
            "precio_promedio_galon": round(precio_promedio_gl, 2),
            "costo_promedio_unidad": round(costo_promedio_unidad, 2),
            "pct_docs": pct_docs,
            "docs_detalle": docs_detalle,
            "num_meses": num_meses,
            "precio_promedio_diff": round(precio_promedio_diff, 2),
            "avg_age": avg_age,
            "older_than_10": older_than_10,
            # Legacy (no romper UI antigua/admin)
            "unidades_activas": unidades_activas,
            "facturas_confirmadas": len(rows),
            "galones_confirmados": round(total_gal, 2),
            "importe_total": round(total_importe, 2),
            "subsidio_estimado": round(subsidio_estimado, 2),
            "subsidio_reconocido": round(total_gal * 4, 2),
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
    # Include both cliente_subsidio users AND users whose empresa has servicios.subsidio enabled
    empresas_subsidio = []
    async for cfg in db.empresas_config.find({"servicios.subsidio": True}, {"_id": 0, "empresa": 1}):
        if cfg.get("empresa"):
            empresas_subsidio.append(cfg["empresa"])

    role_or = [{"role": "cliente_subsidio"}]
    if empresas_subsidio:
        role_or.append({"empresa": {"$in": empresas_subsidio}, "role": {"$ne": "admin_enered"}})
    filt = {"$or": role_or} if len(role_or) > 1 else role_or[0]

    if q:
        filt = {"$and": [
            filt,
            {"$or": [
                {"empresa": {"$regex": q, "$options": "i"}},
                {"ruc": {"$regex": q}},
                {"email": {"$regex": q, "$options": "i"}},
            ]}
        ]}
    if estado:
        filt["expediente_status"] = estado

    users = await db.users.find(filt, {"_id": 0, "password_hash": 0}).sort("created_at", -1).to_list(limit)
    if not users:
        return {"items": [], "total": 0}

    uids = [u.get("id") for u in users if u.get("id")]
    calc_ids = [u.get("calc_id") for u in users if u.get("calc_id")]

    # Bulk queries
    calcs = await db.calculations.find({"id": {"$in": calc_ids}}, {"_id": 0}).to_list(10000)
    calcs_map = {c["id"]: c for c in calcs}

    docs_agg = await db.subsidio_documents.aggregate([
        {"$match": {"user_id": {"$in": uids}}},
        {"$group": {"_id": "$user_id", "count": {"$sum": 1}}}
    ]).to_list(10000)
    docs_map = {d["_id"]: d["count"] for d in docs_agg}

    veh_agg = await db.subsidio_vehicles.aggregate([
        {"$match": {"user_id": {"$in": uids}}},
        {"$group": {"_id": "$user_id", "count": {"$sum": 1}}}
    ]).to_list(10000)
    veh_map = {d["_id"]: d["count"] for d in veh_agg}

    inv_agg = await db.consumos_subsidio.aggregate([
        {"$match": {"user_id": {"$in": uids}}},
        {"$group": {
            "_id": {"user_id": "$user_id", "status": "$status"},
            "count": {"$sum": 1},
            "gal": {"$sum": "$galones"},
            "imp": {"$sum": "$importe_total"}
        }}
    ]).to_list(10000)
    
    inv_map = {}
    for r in inv_agg:
        uid = r["_id"]["user_id"]
        status = r["_id"]["status"]
        if uid not in inv_map:
            inv_map[uid] = {"draft": 0, "conf": 0, "gal": 0, "imp": 0}
        if status == "draft":
            inv_map[uid]["draft"] += r["count"]
        elif status == "confirmed":
            inv_map[uid]["conf"] += r["count"]
            inv_map[uid]["gal"] += r.get("gal", 0) or 0
            inv_map[uid]["imp"] += r.get("imp", 0) or 0
            
    # Traer facturas de Red-Enered
    empresas_list = [u.get("empresa") for u in users if u.get("empresa")]
    if empresas_list:
        enered_inv_agg = await db.invoices.aggregate([
            {"$match": {"empresa": {"$in": empresas_list}}},
            {"$group": {
                "_id": "$empresa",
                "count": {"$sum": 1},
                "imp": {"$sum": "$monto_total"}
            }}
        ]).to_list(10000)
        
        enered_map = {r["_id"]: r for r in enered_inv_agg}
        # Associate to correct users
        for u in users:
            uid = u.get("id")
            emp = u.get("empresa")
            if emp and emp in enered_map:
                if uid not in inv_map:
                    inv_map[uid] = {"draft": 0, "conf": 0, "gal": 0, "imp": 0}
                inv_map[uid]["conf"] += enered_map[emp]["count"]
                inv_map[uid]["imp"] += enered_map[emp].get("imp", 0) or 0

    decl_list = await db.subsidio_declaraciones.find({"user_id": {"$in": uids}}, {"_id": 0}).to_list(10000)
    decl_map = {d.get("user_id"): d for d in decl_list if d.get("user_id")}

    out = []
    for u in users:
        uid = u.get("id")
        calc = calcs_map.get(u.get("calc_id"), {})
        docs_count = docs_map.get(uid, 0)
        vehicles_count = veh_map.get(uid, 0)
        
        inv = inv_map.get(uid, {"draft": 0, "conf": 0, "gal": 0, "imp": 0})
        decl = decl_map.get(uid)

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
            "ahorro_estimado": calc.get("subsidio_estimado", 0),
            "ahorro_reconocido": round(float(inv["gal"]) * 1.5, 2),
            "galones_confirmados": round(float(inv["gal"]), 2),
            "importe_confirmado": round(float(inv["imp"]), 2),
            "docs_count": docs_count,
            "vehicles_count": vehicles_count,
            "invoices": {"draft": inv["draft"], "confirmed": inv["conf"]},
            "declaracion_firmada": bool(decl),
            "declaracion_at": (decl or {}).get("accepted_at"),
        })
    return {"items": out, "total": len(out)}





@subsidio_router.get("/admin/subsidio/expedientes/{user_id}")
async def admin_get_expediente(user_id: str, _: dict = Depends(_require_admin_enered)):
    """Detalle completo de un expediente: cálculo, banco, docs, flota, facturas, declaración."""
    u = await db.users.find_one({"id": user_id}, {"_id": 0, "password_hash": 0})
    if not u:
        raise HTTPException(status_code=404, detail="Expediente no encontrado")
    
    uids = await _get_company_uids(user_id)
    
    calc = await db.calculations.find_one({"id": u.get("calc_id")}, {"_id": 0}) if u.get("calc_id") else None
    
    # Obtener el último banco y declaración (cualquiera de la empresa sirve)
    bank = await db.subsidio_bank_accounts.find_one({"user_id": {"$in": uids}}, {"_id": 0}, sort=[("updated_at", -1)])
    decl = await db.subsidio_declaraciones.find_one({"user_id": {"$in": uids}}, {"_id": 0}, sort=[("accepted_at", -1)])
    
    docs = await db.subsidio_documents.find({"user_id": {"$in": uids}}, {"_id": 0, "storage_key": 0}).sort("uploaded_at", -1).to_list(500)
    
    # Merge vehicles from both main fleet and subsidio
    vehicles_dict = {}
    if u.get("empresa"):
        main_veh = await db.vehiculos.find({"empresa": u.get("empresa")}, {"_id": 0}).to_list(1000)
        for mv in main_veh:
            placa = (mv.get("placa") or mv.get("veh") or "").strip().upper()
            if not placa: continue
            vehicles_dict[placa] = {
                "id": mv.get("id", str(uuid.uuid4())),
                "placa": placa,
                "categoria": mv.get("categoria") or "N1",
                "user_id": mv.get("created_by") or user_id,
                "from_main_fleet": True
            }
    
    sub_veh = await db.subsidio_vehicles.find({"user_id": {"$in": uids}}, {"_id": 0}).sort("created_at", 1).to_list(200)
    for sv in sub_veh:
        placa = (sv.get("placa") or "").strip().upper()
        if not placa: continue
        vehicles_dict[placa] = sv
        
    vehicles = list(vehicles_dict.values())
    sub_invs = await db.consumos_subsidio.find(
        {"user_id": {"$in": uids}},
        {"_id": 0, "raw_ocr_response": 0, "factura_storage_key": 0},
    ).sort("fecha", -1).to_list(2000)
    
    invoices = list(sub_invs)
    
    if u.get("empresa"):
        enered_invs = await db.invoices.find(
            {"empresa": u.get("empresa")},
            {"_id": 0}
        ).to_list(2000)
        for ei in enered_invs:
            # Map db.invoices format to consumos_subsidio format for the admin table
            mapped_inv = {
                "id": ei.get("id"),
                "numero_documento": ei.get("n_doc"),
                "fecha": ei.get("f_emision"),
                "importe_total": ei.get("monto_total"),
                "status": "confirmed", # By default Red-Enered invoices are confirmed
                "empresa": ei.get("empresa"),
                "producto": ei.get("producto"),
                "factura_filename": ei.get("pdf_filename"),
                "origen": "RED_ENERED",
                "is_tercero": False
            }
            invoices.append(mapped_inv)
            
    # sort all by fecha descending
    invoices.sort(key=lambda x: x.get("fecha") or "", reverse=True)

    # Etiquetas legibles
    for d in docs:
        d = _normalize_doc(d)
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
    u = await db.users.find_one({"id": user_id}, {"_id": 0, "password_hash": 0})
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
    
    # Generate unique filename based on numero_documento to prevent OS/Browser mix-ups
    original = inv.get("factura_filename") or "factura.pdf"
    ext = original.split(".")[-1] if "." in original else "pdf"
    ndoc = inv.get("numero_documento")
    
    if ndoc:
        safe_ndoc = "".join(c for c in ndoc if c.isalnum() or c == "-")
        dl_name = f"Factura_{safe_ndoc}.{ext}"
    else:
        dl_name = original

    import urllib.parse
    encoded_name = urllib.parse.quote(dl_name)
    
    try:
        data = storage.get_object_bytes(inv["factura_storage_key"])
    except FileNotFoundError:
        from fastapi.responses import HTMLResponse
        return HTMLResponse(
            status_code=404,
            content="""
            <html>
                <body style="display:flex;justify-content:center;align-items:center;height:100vh;margin:0;font-family:sans-serif;background-color:#f5f5f5;color:#666;">
                    <div style="text-align:center;">
                        <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="margin-bottom:1rem;color:#999;"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="9" y1="15" x2="15" y2="15"></line></svg>
                        <h3>Archivo no disponible</h3>
                        <p style="font-size:14px;">El documento físico no se encontró en el servidor<br/>(probablemente fue ingresado manualmente).</p>
                    </div>
                </body>
            </html>
            """
        )

    from fastapi.responses import Response
    return Response(
        content=data,
        media_type=inv.get("factura_content_type", "application/pdf"),
        headers={
            "Content-Disposition": f"inline; filename*=UTF-8''{encoded_name}"
        },
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


@subsidio_router.put("/admin/subsidio/expedientes/{user_id}/representante")
async def admin_update_representante(
    user_id: str,
    payload: RepresentanteUpdateIn,
    _: dict = Depends(_require_admin_enered),
):
    u = await db.users.find_one({"id": user_id})
    if not u:
        raise HTTPException(status_code=404, detail="Usuario no encontrado")
    await db.users.update_one(
        {"id": user_id},
        {"$set": {
            "contacto": payload.representante,
            "representante": payload.representante
        }}
    )
    return {"ok": True, "representante": payload.representante}


@subsidio_router.post("/admin/subsidio/expedientes/{user_id}/vehicles")
async def admin_add_vehicle(
    user_id: str,
    payload: VehicleAdminIn,
    _: dict = Depends(_require_admin_enered),
):
    u = await db.users.find_one({"id": user_id})
    if not u:
        raise HTTPException(status_code=404, detail="Usuario no encontrado")
    placa = payload.placa.upper().strip()
    if await db.subsidio_vehicles.find_one({"user_id": user_id, "placa": placa}):
        raise HTTPException(status_code=409, detail="La placa ya está registrada")
    doc = {
        "id": str(uuid.uuid4()),
        "user_id": user_id,
        "empresa": u.get("empresa"),
        "placa": placa,
        "categoria": payload.categoria,
        "anio_fabricacion": payload.anio_fabricacion,
        "vigente_desde": payload.vigente_desde,
        "vigente_hasta": payload.vigente_hasta,
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    await db.subsidio_vehicles.insert_one(doc)
    doc.pop("_id", None)
    return {"ok": True, "vehicle": doc}


@subsidio_router.put("/admin/subsidio/expedientes/{user_id}/vehicles/{vehicle_id}")
async def admin_update_vehicle(
    user_id: str,
    vehicle_id: str,
    payload: VehicleAdminIn,
    _: dict = Depends(_require_admin_enered),
):
    v = await db.subsidio_vehicles.find_one({"id": vehicle_id})
    if not v:
        raise HTTPException(status_code=404, detail="Vehículo no encontrado")
        
    uids = await _get_company_uids(user_id)
    
    placa_new = payload.placa.upper().strip()
    if placa_new != v["placa"]:
        if await db.subsidio_vehicles.find_one({"user_id": {"$in": uids}, "placa": placa_new}):
            raise HTTPException(status_code=409, detail="La nueva placa ya está registrada")
    
    if placa_new != v["placa"]:
        await db.subsidio_documents.update_many(
            {"user_id": {"$in": uids}, "placa": v["placa"]},
            {"$set": {"placa": placa_new}}
        )
        await db.consumos_subsidio.update_many(
            {"user_id": {"$in": uids}, "placa": v["placa"]},
            {"$set": {"placa": placa_new}}
        )

    await db.subsidio_vehicles.update_one(
        {"id": vehicle_id},
        {"$set": {
            "placa": placa_new,
            "categoria": payload.categoria,
            "anio_fabricacion": payload.anio_fabricacion,
            "vigente_desde": payload.vigente_desde,
            "vigente_hasta": payload.vigente_hasta,
            "updated_at": datetime.now(timezone.utc).isoformat(),
        }}
    )
    return {"ok": True}


@subsidio_router.delete("/admin/subsidio/expedientes/{user_id}/vehicles/{vehicle_id}")
async def admin_delete_vehicle(
    user_id: str,
    vehicle_id: str,
    _: dict = Depends(_require_admin_enered),
):
    v = await db.subsidio_vehicles.find_one({"id": vehicle_id, "user_id": user_id})
    if not v:
        raise HTTPException(status_code=404, detail="Vehículo no encontrado")
    
    placa = v["placa"]
    await db.subsidio_vehicles.delete_one({"id": vehicle_id})
    
    docs = await db.subsidio_documents.find(
        {"user_id": user_id, "placa": placa}, {"_id": 0}
    ).to_list(100)
    for d in docs:
        try:
            storage.delete_object(d["storage_key"])
        except Exception:
            pass
    await db.subsidio_documents.delete_many({"user_id": user_id, "placa": placa})
    return {"ok": True}


@subsidio_router.post("/admin/subsidio/expedientes/{user_id}/invoices")
async def admin_add_invoice(
    user_id: str,
    payload: InvoiceAdminCreateIn,
    _: dict = Depends(_require_admin_enered),
):
    u = await db.users.find_one({"id": user_id})
    if not u:
        raise HTTPException(status_code=404, detail="Usuario no encontrado")
    
    placa = payload.placa.upper().strip()
    own = await db.subsidio_vehicles.find_one({"user_id": user_id, "placa": placa})
    placa_match = placa if own else None

    doc = {
        "id": str(uuid.uuid4()),
        "user_id": user_id,
        "empresa": u.get("empresa"),
        "empresa_id": u.get("empresa"),
        "calc_id": u.get("calc_id"),
        "factura_filename": "manual_entry.pdf",
        "factura_storage_key": None,
        "factura_content_type": "application/pdf",
        "factura_size": 0,
        "raw_ocr_response": "Manual Entry by Admin",
        "ocr_ok": True,
        "ocr_error": None,
        "placa_match": placa_match,
        "status": "confirmed",
        "created_at": datetime.now(timezone.utc).isoformat(),
        "confirmed_at": datetime.now(timezone.utc).isoformat(),
        "fecha": payload.fecha,
        "hora": "12:00",
        "estacion": payload.estacion,
        "ciudad": payload.ciudad,
        "ruc_emisor": payload.ruc_emisor,
        "placa": placa,
        "producto": payload.producto or "DIESEL B5",
        "galones": payload.galones,
        "precio_unitario": payload.precio_unitario,
        "importe_total": payload.importe_total,
        "numero_documento": payload.numero_documento,
        "confianza": 1.0,
    }
    await db.consumos_subsidio.insert_one(doc)
    doc.pop("_id", None)
    return {"ok": True, "invoice": doc}


@subsidio_router.put("/admin/subsidio/expedientes/{user_id}/invoices/{invoice_id}")
async def admin_update_invoice(
    user_id: str,
    invoice_id: str,
    payload: InvoiceUpdateIn,
    _: dict = Depends(_require_admin_enered),
):
    inv = await db.consumos_subsidio.find_one({"id": invoice_id})
    if not inv:
        raise HTTPException(status_code=404, detail="Factura no encontrada")
    
    uids = await _get_company_uids(user_id)
    
    patch = {k: v for k, v in payload.model_dump(exclude_unset=True).items() if v is not None}
    if "placa" in patch and patch["placa"]:
        placa = patch["placa"].upper().strip()
        patch["placa"] = placa
        own = await db.subsidio_vehicles.find_one({"user_id": {"$in": uids}, "placa": placa})
        patch["placa_match"] = placa if own else None

    patch["updated_at"] = datetime.now(timezone.utc).isoformat()
    await db.consumos_subsidio.update_one({"id": invoice_id}, {"$set": patch})
    return {"ok": True}


@subsidio_router.delete("/admin/subsidio/expedientes/{user_id}")
async def admin_delete_expediente(user_id: str, _: dict = Depends(_require_admin_enered)):
    u = await db.users.find_one({"id": user_id})
    if not u:
        raise HTTPException(status_code=404, detail="Usuario no encontrado")

    empresa_name = u.get("empresa")
    email = (u.get("email") or "").lower().strip()
    ruc = u.get("ruc")
    calc_id = u.get("calc_id")

    deleted = {
        "user": 0, "calculations": 0, "leads": 0, "bank_accounts": 0,
        "vehicles": 0, "declaraciones": 0, "documents": 0, "invoices": 0,
        "empresas_config": 0, "storage_objects": 0,
    }

    # 1) Cálculo asociado (por calc_id) y leads por múltiples claves
    if calc_id:
        r = await db.calculations.delete_one({"id": calc_id})
        deleted["calculations"] += r.deleted_count or 0
    lead_filter = {"$or": []}
    if calc_id: lead_filter["$or"].append({"calc_id": calc_id})
    if email:   lead_filter["$or"].append({"email": email})
    if ruc:     lead_filter["$or"].append({"ruc": ruc})
    if lead_filter["$or"]:
        r = await db.subsidio_leads.delete_many(lead_filter)
        deleted["leads"] += r.deleted_count or 0

    # 2) Datos accesorios del cliente
    r = await db.subsidio_bank_accounts.delete_many({"user_id": user_id})
    deleted["bank_accounts"] += r.deleted_count or 0
    r = await db.subsidio_vehicles.delete_many({"user_id": user_id})
    deleted["vehicles"] += r.deleted_count or 0
    r = await db.subsidio_declaraciones.delete_many({"user_id": user_id})
    deleted["declaraciones"] += r.deleted_count or 0

    # 3) Documentos + storage
    docs = await db.subsidio_documents.find({"user_id": user_id}, {"_id": 0, "storage_key": 1}).to_list(5000)
    for d in docs:
        if d.get("storage_key"):
            try:
                storage.delete_object(d["storage_key"])
                deleted["storage_objects"] += 1
            except Exception:
                pass
    r = await db.subsidio_documents.delete_many({"user_id": user_id})
    deleted["documents"] += r.deleted_count or 0

    # 4) Facturas/consumos + storage
    invs = await db.consumos_subsidio.find({"user_id": user_id}, {"_id": 0, "factura_storage_key": 1}).to_list(5000)
    for i in invs:
        if i.get("factura_storage_key"):
            try:
                storage.delete_object(i["factura_storage_key"])
                deleted["storage_objects"] += 1
            except Exception:
                pass
    r = await db.consumos_subsidio.delete_many({"user_id": user_id})
    deleted["invoices"] += r.deleted_count or 0

    # 5) Usuario
    r = await db.users.delete_one({"id": user_id})
    deleted["user"] += r.deleted_count or 0

    # 6) empresas_config (solo si NO queda ningún otro usuario en esa empresa)
    if empresa_name:
        remaining = await db.users.count_documents({"empresa": empresa_name})
        if remaining == 0:
            r = await db.empresas_config.delete_one({"empresa": empresa_name})
            deleted["empresas_config"] += r.deleted_count or 0

    logger.info(f"[admin_delete_expediente] user_id={user_id} empresa={empresa_name} deleted={deleted}")
    return {"ok": True, "deleted": deleted}


@subsidio_router.post("/admin/subsidio/expedientes/{user_id}/migrate")
async def admin_migrate_expediente(user_id: str, _: dict = Depends(_require_admin_enered)):
    u = await db.users.find_one({"id": user_id})
    if not u:
        raise HTTPException(status_code=404, detail="Usuario no encontrado o ya migrado")
        
    empresa_name = u.get("empresa")
    if empresa_name:
        await db.empresas_config.update_one(
            {"empresa": empresa_name},
            {"$set": {
                "tipo_cliente": "enered",
                "servicios.plataforma": True,
                "updated_at": datetime.now(timezone.utc).isoformat()
            }}
        )
        
    await db.users.update_one(
        {"id": user_id},
        {"$set": {
            "role": "administrador",
            "expediente_status": "migrated",
            "expediente_stage": "abonado_en_cuenta"
        }}
    )
    
    return {"ok": True}
