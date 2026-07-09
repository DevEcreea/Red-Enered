from dotenv import load_dotenv
from pathlib import Path

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

import os
import io
import uuid
import random
import secrets
import logging
from datetime import datetime, timezone, timedelta
from typing import List, Optional, Literal

import jwt
import bcrypt
import pandas as pd
from fastapi import FastAPI, APIRouter, HTTPException, Request, Response, Depends, UploadFile, File, Form
from fastapi.responses import JSONResponse
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
from pydantic import BaseModel, Field, EmailStr

import servicios as _svc
from storage import save_object, download_response

# ---------- Config ----------
JWT_ALGORITHM = "HS256"
JWT_ACCESS_MINUTES = 60 * 8  # 8 hours
JWT_REFRESH_DAYS = 7

mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

app = FastAPI(title="ENERED API")
api = APIRouter(prefix="/api")

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("enered")


# ---------- Utils ----------
def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")


def verify_password(password: str, hashed: str) -> bool:
    try:
        return bcrypt.checkpw(password.encode("utf-8"), hashed.encode("utf-8"))
    except Exception:
        return False


def get_jwt_secret() -> str:
    return os.environ["JWT_SECRET"]


def create_access_token(user_id: str, email: str, role: str, empresa: Optional[str]) -> str:
    payload = {
        "sub": user_id,
        "email": email,
        "role": role,
        "empresa": empresa,
        "exp": datetime.now(timezone.utc) + timedelta(minutes=JWT_ACCESS_MINUTES),
        "type": "access",
    }
    return jwt.encode(payload, get_jwt_secret(), algorithm=JWT_ALGORITHM)


def create_refresh_token(user_id: str) -> str:
    payload = {
        "sub": user_id,
        "exp": datetime.now(timezone.utc) + timedelta(days=JWT_REFRESH_DAYS),
        "type": "refresh",
    }
    return jwt.encode(payload, get_jwt_secret(), algorithm=JWT_ALGORITHM)


def set_auth_cookies(response: Response, access: str, refresh: str):
    response.set_cookie("access_token", access, httponly=True, secure=True, samesite="none",
                        max_age=JWT_ACCESS_MINUTES * 60, path="/")
    response.set_cookie("refresh_token", refresh, httponly=True, secure=True, samesite="none",
                        max_age=JWT_REFRESH_DAYS * 86400, path="/")


def clear_auth_cookies(response: Response):
    response.delete_cookie("access_token", path="/")
    response.delete_cookie("refresh_token", path="/")


def user_public(u: dict) -> dict:
    return {
        "id": u["id"],
        "email": u["email"],
        "name": u.get("name", ""),
        "role": u["role"],
        "empresa": u.get("empresa"),
        "created_at": u.get("created_at"),
        "documentos_completos": u.get("documentos_completos", True),
        "expediente_status": u.get("expediente_status", "confirmed"),
    }


async def user_public_with_servicios(u: dict) -> dict:
    """Igual que user_public pero enriquecido con servicios de la empresa."""
    base = user_public(u)
    # admin_enered no está atado a una empresa; tiene todos los servicios habilitados por default
    if u.get("role") == "admin_enered":
        base["servicios"] = {"plataforma": True, "combustible": True, "gps": True, "subsidio": True}
        base["tipo_cliente"] = "enered"
        base["wialon_configurado"] = False
        return base
    empresa = u.get("empresa")
    info = await _svc.get_empresa_servicios(db, empresa)
    base["servicios"] = info["servicios"]
    base["tipo_cliente"] = info["tipo_cliente"]
    base["wialon_configurado"] = info["wialon_configurado"]
    return base


async def get_current_user(request: Request) -> dict:
    token = request.cookies.get("access_token")
    if not token:
        auth = request.headers.get("Authorization", "")
        if auth.startswith("Bearer "):
            token = auth[7:]
    if not token:
        raise HTTPException(status_code=401, detail="No autenticado")
    try:
        payload = jwt.decode(token, get_jwt_secret(), algorithms=[JWT_ALGORITHM])
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


def require_roles(*roles):
    async def checker(user: dict = Depends(get_current_user)):
        if user["role"] not in roles:
            raise HTTPException(status_code=403, detail="Permiso denegado")
        return user
    return checker


# Alias usado por endpoints de Infracciones (estilo: u = await require_auth(req))
async def require_auth(request: Request) -> dict:
    return await get_current_user(request)

# Alias usado por endpoints de Infracciones (estilo: u = await require_auth(req))
async def require_auth(request: Request) -> dict:
    return await get_current_user(request)


# ---------- Models ----------
ROLES = ["admin_enered", "administrador", "logistica", "contabilidad"]


class LoginIn(BaseModel):
    email: EmailStr
    password: str


class ForgotIn(BaseModel):
    email: EmailStr


class ResetIn(BaseModel):
    token: str
    password: str


class UserCreate(BaseModel):
    email: EmailStr
    password: str
    name: str
    role: Literal["admin_enered", "administrador", "logistica", "contabilidad"]
    empresa: Optional[str] = None


class UserUpdate(BaseModel):
    name: Optional[str] = None
    role: Optional[Literal["admin_enered", "administrador", "logistica", "contabilidad"]] = None
    empresa: Optional[str] = None
    password: Optional[str] = None


class InvoiceCreate(BaseModel):
    empresa: str
    numero: str
    fecha_emision: str
    fecha_vencimiento: str
    monto: float
    estado: Literal["pendiente", "pagada", "vencida"] = "pendiente"
    pdf_url: Optional[str] = None


class InvoiceUpdate(BaseModel):
    estado: Optional[Literal["pendiente", "pagada", "vencida"]] = None
    pdf_url: Optional[str] = None


class ControlRequestIn(BaseModel):
    tipo: Literal["tope_mensual_galones", "tope_diario", "estaciones_permitidas",
                  "ciudades_permitidas", "combustible_permitido", "limite_por_carga"]
    placa: Optional[str] = None
    detalle: str
    valor: Optional[str] = None


class ControlStatusUpdate(BaseModel):
    estado: Literal["pendiente", "realizada", "rechazada"]
    nota: Optional[str] = None


class CourseCreate(BaseModel):
    titulo: str
    descripcion: str
    video_url: Optional[str] = None
    pdf_url: Optional[str] = None
    puntaje_minimo: int = 70
    preguntas: List[dict] = []  # {pregunta, opciones:[], correcta:int}


class CourseSubmit(BaseModel):
    respuestas: List[int]


# ---------- Auth Endpoints ----------
@api.post("/auth/login")
async def login(data: LoginIn, response: Response):
    email = data.email.lower().strip()
    user = await db.users.find_one({"email": email}, {"_id": 0})
    if not user or not verify_password(data.password, user["password_hash"]):
        raise HTTPException(status_code=401, detail="Credenciales inválidas")
    access = create_access_token(user["id"], user["email"], user["role"], user.get("empresa"))
    refresh = create_refresh_token(user["id"])
    set_auth_cookies(response, access, refresh)
    response.headers["X-Access-Token"] = access  # fallback for clients
    user_data = await user_public_with_servicios(user)
    return {"user": user_data, "access_token": access}


@api.post("/auth/logout")
async def logout(response: Response, user: dict = Depends(get_current_user)):
    clear_auth_cookies(response)
    return {"ok": True}


@api.get("/auth/me")
async def me(user: dict = Depends(get_current_user)):
    return await user_public_with_servicios(user)


@api.post("/auth/refresh")
async def refresh_token(request: Request, response: Response):
    token = request.cookies.get("refresh_token")
    if not token:
        raise HTTPException(status_code=401, detail="Sin token de refresco")
    try:
        payload = jwt.decode(token, get_jwt_secret(), algorithms=[JWT_ALGORITHM])
        if payload.get("type") != "refresh":
            raise HTTPException(status_code=401, detail="Token inválido")
        user = await db.users.find_one({"id": payload["sub"]}, {"_id": 0})
        if not user:
            raise HTTPException(status_code=401, detail="Usuario no encontrado")
        access = create_access_token(user["id"], user["email"], user["role"], user.get("empresa"))
        response.set_cookie("access_token", access, httponly=True, secure=True, samesite="none",
                            max_age=JWT_ACCESS_MINUTES * 60, path="/")
        return {"access_token": access}
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Token inválido")


@api.post("/auth/forgot-password")
async def forgot_password(data: ForgotIn):
    email = data.email.lower().strip()
    user = await db.users.find_one({"email": email}, {"_id": 0})
    if user:
        token = secrets.token_urlsafe(32)
        await db.password_reset_tokens.insert_one({
            "token": token,
            "user_id": user["id"],
            "expires_at": datetime.now(timezone.utc) + timedelta(hours=1),
            "used": False,
        })
        logger.info(f"[PASSWORD RESET] {email} token={token}")
    return {"message": "Si el correo existe, recibirás un enlace de recuperación."}


@api.post("/auth/reset-password")
async def reset_password(data: ResetIn):
    rec = await db.password_reset_tokens.find_one({"token": data.token, "used": False}, {"_id": 0})
    if not rec:
        raise HTTPException(status_code=400, detail="Token inválido o ya usado")
    expires = rec["expires_at"]
    if isinstance(expires, str):
        expires = datetime.fromisoformat(expires)
    if expires.replace(tzinfo=timezone.utc) < datetime.now(timezone.utc):
        raise HTTPException(status_code=400, detail="Token expirado")
    await db.users.update_one({"id": rec["user_id"]},
                              {"$set": {"password_hash": hash_password(data.password)}})
    await db.password_reset_tokens.update_one({"token": data.token}, {"$set": {"used": True}})
    return {"message": "Contraseña actualizada"}


# ---------- Users Management ----------
@api.get("/users")
async def list_users(user: dict = Depends(require_roles("admin_enered"))):
    users = await db.users.find({}, {"_id": 0, "password_hash": 0}).to_list(1000)
    return users


@api.post("/users")
async def create_user(data: UserCreate, user: dict = Depends(require_roles("admin_enered"))):
    email = data.email.lower().strip()
    if await db.users.find_one({"email": email}):
        raise HTTPException(status_code=400, detail="Correo ya registrado")
    doc = {
        "id": str(uuid.uuid4()),
        "email": email,
        "name": data.name,
        "role": data.role,
        "empresa": data.empresa,
        "password_hash": hash_password(data.password),
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    await db.users.insert_one(doc)
    doc.pop("password_hash", None)
    doc.pop("_id", None)
    return doc


@api.put("/users/{uid}")
async def update_user(uid: str, data: UserUpdate, user: dict = Depends(require_roles("admin_enered"))):
    patch = {k: v for k, v in data.model_dump(exclude_unset=True).items() if v is not None}
    if "password" in patch:
        patch["password_hash"] = hash_password(patch.pop("password"))
    if not patch:
        raise HTTPException(status_code=400, detail="Nada que actualizar")
    res = await db.users.update_one({"id": uid}, {"$set": patch})
    if res.matched_count == 0:
        raise HTTPException(status_code=404, detail="Usuario no encontrado")
    u = await db.users.find_one({"id": uid}, {"_id": 0, "password_hash": 0})
    return u


@api.delete("/users/{uid}")
async def delete_user(uid: str, user: dict = Depends(require_roles("admin_enered"))):
    if uid == user["id"]:
        raise HTTPException(status_code=400, detail="No puedes eliminarte a ti mismo")
    await db.users.delete_one({"id": uid})
    return {"ok": True}


@api.get("/empresas")
async def list_empresas(user: dict = Depends(get_current_user)):
    empresas = await db.consumptions.distinct("EMPRESA")
    return sorted([e for e in empresas if e])


# ---------- Consumptions ----------
def tenant_filter(user: dict) -> dict:
    if user["role"] == "admin_enered":
        return {}
    return {"EMPRESA": user.get("empresa")}


def _subsidio_row_to_consumption(r: dict) -> dict:
    """Map consumos_subsidio doc → schema esperado por el frontend (UPPERCASE keys)."""
    gal = float(r.get("galones") or 0)
    imp = float(r.get("importe_total") or 0)
    pre = float(r.get("precio_unitario") or 0)
    fecha = r.get("fecha") or ""
    # Semana ISO desde fecha
    semana = ""
    try:
        from datetime import date as _date
        y, m, d = (int(x) for x in fecha[:10].split("-"))
        wk = _date(y, m, d).isocalendar()
        semana = f"{wk.year}-W{wk.week:02d}"
    except Exception:
        pass
    return {
        "id": r.get("id") or str(r.get("_id")) or "",
        "EMPRESA": r.get("empresa") or "",
        "FECHA": fecha,
        "HORA": r.get("hora") or "",
        "PLACA": r.get("placa") or "",
        "CIUDAD": r.get("ciudad") or "",
        "ESTACION": r.get("estacion") or "",
        "PRODUCTO": r.get("producto") or "",
        "CANTIDAD_GL": gal,
        "PRECIO_UNITARIO": pre,
        "IMPORTE_TOTAL": imp,
        "KILOMETRAJE": r.get("kilometraje") or 0,
        "AHORRO": round(gal * 1.5, 2),  # MOCKED: S/ 1.5 por galón (alineado con dashboard subsidio)
        "SEMANA": semana,
        "RUC_EMISOR": r.get("ruc_emisor") or "",
        "NUMERO_DOCUMENTO": r.get("numero_documento") or "",
        "ESTADO": "FACTURADO",
        "_origen": "subsidio",
        "CONDUCTOR": r.get("conductor") or "",
        "pdf_filename": r.get("pdf_filename") or "",
    }


@api.get("/consumptions")
async def list_consumptions(
    user: dict = Depends(get_current_user),
    empresa: Optional[str] = None,
    fecha_desde: Optional[str] = None,
    fecha_hasta: Optional[str] = None,
    placa: Optional[str] = None,
    ciudad: Optional[str] = None,
    estacion: Optional[str] = None,
    producto: Optional[str] = None,
    semana: Optional[str] = None,
    limit: int = 2000,
):
    # cliente_subsidio: leer de consumos_subsidio confirmados y mapear al schema /consumptions
    if user.get("role") == "cliente_subsidio":
        raw = await db.consumos_subsidio.find(
            {"user_id": user["id"], "status": "confirmed"},
            {"_id": 0, "raw_ocr_response": 0, "factura_storage_key": 0},
        ).sort("fecha", -1).to_list(limit)
        mapped = [_subsidio_row_to_consumption(r) for r in raw]
        # Filtros opcionales
        def keep(row):
            if fecha_desde and (row["FECHA"] or "") < fecha_desde: return False
            if fecha_hasta and (row["FECHA"] or "") > fecha_hasta: return False
            if placa and row["PLACA"] != placa: return False
            if ciudad and row["CIUDAD"] != ciudad: return False
            if estacion and row["ESTACION"] != estacion: return False
            if producto and row["PRODUCTO"] != producto: return False
            if semana and row["SEMANA"] != semana: return False
            return True
        return [r for r in mapped if keep(r)]

    q = tenant_filter(user)
    if empresa and user["role"] == "admin_enered":
        q["EMPRESA"] = empresa
    if fecha_desde:
        q.setdefault("FECHA", {})["$gte"] = fecha_desde
    if fecha_hasta:
        q.setdefault("FECHA", {})["$lte"] = fecha_hasta
    if placa:
        q["PLACA"] = placa
    if ciudad:
        q["CIUDAD"] = ciudad
    if estacion:
        q["ESTACION"] = estacion
    if producto:
        q["PRODUCTO"] = producto
    if semana:
        q["SEMANA"] = semana
    rows = await db.consumptions.find(q, {"_id": 0}).sort("FECHA", -1).to_list(limit)
    return rows


class ConsumptionCreate(BaseModel):
    PLACA: str
    EMPRESA: Optional[str] = None
    FECHA: str
    HORA: Optional[str] = None
    CIUDAD: Optional[str] = None
    ESTACION: Optional[str] = None
    PRODUCTO: str
    CANTIDAD_GL: float
    PRECIO_UNITARIO: float
    IMPORTE_TOTAL: float
    CONDUCTOR: Optional[str] = None
    KILOMETRAJE: Optional[int] = None
    RUC_EMISOR: Optional[str] = None
    NUMERO_DOCUMENTO: Optional[str] = None


@api.post("/consumptions")
async def create_consumption(
    PLACA: str = Form(...),
    EMPRESA: Optional[str] = Form(None),
    FECHA: str = Form(...),
    HORA: Optional[str] = Form(None),
    CIUDAD: Optional[str] = Form(None),
    ESTACION: Optional[str] = Form(None),
    PRODUCTO: str = Form(...),
    CANTIDAD_GL: float = Form(...),
    PRECIO_UNITARIO: float = Form(...),
    IMPORTE_TOTAL: float = Form(...),
    CONDUCTOR: Optional[str] = Form(None),
    KILOMETRAJE: Optional[int] = Form(None),
    RUC_EMISOR: Optional[str] = Form(None),
    NUMERO_DOCUMENTO: Optional[str] = Form(None),
    file: Optional[UploadFile] = File(None),
    user: dict = Depends(get_current_user)
):
    cid = str(uuid.uuid4())
    empresa_target = EMPRESA or user.get("empresa") or ""
    
    # Guardar comprobante PDF si es provisto
    pdf_filename = None
    if file and file.filename:
        content = await file.read()
        pdf_filename = f"inv_{cid}_{file.filename}"
        key = _inv_key(empresa_target, pdf_filename)
        storage.save_object(key, content, content_type="application/pdf")

    f_venc = FECHA[:10]
    try:
        from datetime import datetime as _datetime, timedelta
        f_dt = _datetime.strptime(FECHA[:10], "%Y-%m-%d")
        f_venc = (f_dt + timedelta(days=30)).date().isoformat()
    except Exception:
        pass

    # Crear factura relacionada
    if NUMERO_DOCUMENTO:
        existing_inv = await db.invoices.find_one({"empresa": empresa_target, "n_doc": NUMERO_DOCUMENTO.upper()})
        if not existing_inv:
            inv_doc = {
                "id": cid,
                "empresa": empresa_target,
                "n_doc": NUMERO_DOCUMENTO.upper(),
                "tipo_doc": "factura",
                "producto": PRODUCTO,
                "f_emision": FECHA[:10],
                "f_vencimiento": f_venc,
                "moneda": "PEN",
                "monto_total": IMPORTE_TOTAL,
                "saldo": IMPORTE_TOTAL,
                "estado": "pendiente",
                "atraso_dias": 0,
                "pdf_filename": pdf_filename,
                "xml_filename": None,
                "uploaded_at": datetime.now(timezone.utc).isoformat(),
                "uploaded_by": user["email"],
                "created_via": "consumption_sync",
            }
            await db.invoices.insert_one(inv_doc)

    if user.get("role") == "cliente_subsidio":
        doc = {
            "id": cid,
            "user_id": user["id"],
            "empresa": empresa_target,
            "placa": PLACA.upper(),
            "fecha": FECHA[:10],
            "hora": HORA or "00:00",
            "ciudad": CIUDAD or "",
            "estacion": ESTACION or "",
            "producto": PRODUCTO,
            "galones": CANTIDAD_GL,
            "precio_unitario": PRECIO_UNITARIO,
            "importe_total": IMPORTE_TOTAL,
            "kilometraje": KILOMETRAJE or 0,
            "conductor": CONDUCTOR or "",
            "ruc_emisor": RUC_EMISOR or "",
            "numero_documento": NUMERO_DOCUMENTO or "",
            "status": "confirmed",
            "pdf_filename": pdf_filename,
            "created_at": datetime.now(timezone.utc).isoformat(),
        }
        await db.consumos_subsidio.insert_one(doc)

        # Sync: crear factura en db.invoices para Facturación/Cuenta
        n_doc_sub = (NUMERO_DOCUMENTO or "").upper().strip()
        if n_doc_sub:
            existing_inv = await db.invoices.find_one({"empresa": empresa_target, "n_doc": n_doc_sub})
            if not existing_inv:
                f_venc_sub = FECHA[:10]
                try:
                    from datetime import timedelta as _td
                    f_dt_sub = datetime.strptime(FECHA[:10], "%Y-%m-%d")
                    f_venc_sub = (f_dt_sub + _td(days=30)).date().isoformat()
                except Exception:
                    pass
                inv_doc_sub = {
                    "id": cid,
                    "empresa": empresa_target,
                    "n_doc": n_doc_sub,
                    "tipo_doc": "factura",
                    "producto": PRODUCTO,
                    "f_emision": FECHA[:10],
                    "f_vencimiento": f_venc_sub,
                    "moneda": "PEN",
                    "monto_total": IMPORTE_TOTAL,
                    "saldo": IMPORTE_TOTAL,
                    "estado": "pendiente",
                    "atraso_dias": 0,
                    "pdf_filename": pdf_filename,
                    "xml_filename": None,
                    "uploaded_at": datetime.now(timezone.utc).isoformat(),
                    "uploaded_by": user["email"],
                    "created_via": "subsidio_consumption",
                }
                await db.invoices.insert_one(inv_doc_sub)

        return _subsidio_row_to_consumption(doc)
    else:
        semana = ""
        try:
            from datetime import date as _date
            y, m, d = (int(x) for x in FECHA[:10].split("-"))
            wk = _date(y, m, d).isocalendar()
            semana = f"{wk.year}-W{wk.week:02d}"
        except Exception:
            pass
            
        doc = {
            "id": cid,
            "EMPRESA": empresa_target,
            "PLACA": PLACA.upper(),
            "FECHA": FECHA,
            "HORA": HORA or "",
            "CIUDAD": CIUDAD or "",
            "ESTACION": ESTACION or "",
            "PRODUCTO": PRODUCTO,
            "CANTIDAD_GL": CANTIDAD_GL,
            "PRECIO_UNITARIO": PRECIO_UNITARIO,
            "IMPORTE_TOTAL": IMPORTE_TOTAL,
            "AHORRO": round(CANTIDAD_GL * 1.5, 2),
            "SEMANA": semana,
            "CONDUCTOR": CONDUCTOR or "",
            "KILOMETRAJE": KILOMETRAJE or 0,
            "RUC_EMISOR": RUC_EMISOR or "",
            "NUMERO_DOCUMENTO": NUMERO_DOCUMENTO or "",
            "ESTADO": "FACTURADO",
            "_origen": "manual",
            "pdf_filename": pdf_filename,
        }
        await db.consumptions.insert_one(doc)
        if "_id" in doc:
            doc.pop("_id")
        return doc


@api.put("/consumptions/{cid}")
async def update_consumption(
    cid: str,
    PLACA: str = Form(...),
    EMPRESA: Optional[str] = Form(None),
    FECHA: str = Form(...),
    HORA: Optional[str] = Form(None),
    CIUDAD: Optional[str] = Form(None),
    ESTACION: Optional[str] = Form(None),
    PRODUCTO: str = Form(...),
    CANTIDAD_GL: float = Form(...),
    PRECIO_UNITARIO: float = Form(...),
    IMPORTE_TOTAL: float = Form(...),
    CONDUCTOR: Optional[str] = Form(None),
    KILOMETRAJE: Optional[int] = Form(None),
    RUC_EMISOR: Optional[str] = Form(None),
    NUMERO_DOCUMENTO: Optional[str] = Form(None),
    file: Optional[UploadFile] = File(None),
    user: dict = Depends(get_current_user)
):
    empresa_target = EMPRESA or user.get("empresa") or ""
    
    coll = db.consumptions
    if user.get("role") == "cliente_subsidio":
        coll = db.consumos_subsidio
        q = {"id": cid, "user_id": user["id"]}
    else:
        q = {"id": cid}
        if user["role"] != "admin_enered" and user.get("empresa"):
            q["EMPRESA"] = user["empresa"]
            
    c_doc = await coll.find_one(q)
    if not c_doc:
        raise HTTPException(status_code=404, detail="Consumo no encontrado")

    pdf_filename = c_doc.get("pdf_filename")
    if file and file.filename:
        content = await file.read()
        pdf_filename = f"inv_{cid}_{file.filename}"
        key = _inv_key(empresa_target, pdf_filename)
        storage.save_object(key, content, content_type="application/pdf")
        
    update_fields = {
        "placa" if user.get("role") == "cliente_subsidio" else "PLACA": PLACA.upper(),
        "fecha" if user.get("role") == "cliente_subsidio" else "FECHA": FECHA[:10] if user.get("role") == "cliente_subsidio" else FECHA,
        "hora" if user.get("role") == "cliente_subsidio" else "HORA": HORA or ("00:00" if user.get("role") == "cliente_subsidio" else ""),
        "ciudad" if user.get("role") == "cliente_subsidio" else "CIUDAD": CIUDAD or "",
        "estacion" if user.get("role") == "cliente_subsidio" else "ESTACION": ESTACION or "",
        "producto" if user.get("role") == "cliente_subsidio" else "PRODUCTO": PRODUCTO,
        "galones" if user.get("role") == "cliente_subsidio" else "CANTIDAD_GL": CANTIDAD_GL,
        "precio_unitario" if user.get("role") == "cliente_subsidio" else "PRECIO_UNITARIO": PRECIO_UNITARIO,
        "importe_total" if user.get("role") == "cliente_subsidio" else "IMPORTE_TOTAL": IMPORTE_TOTAL,
        "conductor" if user.get("role") == "cliente_subsidio" else "CONDUCTOR": CONDUCTOR or "",
        "kilometraje" if user.get("role") == "cliente_subsidio" else "KILOMETRAJE": KILOMETRAJE or 0,
        "ruc_emisor" if user.get("role") == "cliente_subsidio" else "RUC_EMISOR": RUC_EMISOR or "",
        "numero_documento" if user.get("role") == "cliente_subsidio" else "NUMERO_DOCUMENTO": NUMERO_DOCUMENTO or "",
        "pdf_filename": pdf_filename,
    }
    
    if user.get("role") != "cliente_subsidio":
        update_fields["AHORRO"] = round(CANTIDAD_GL * 1.5, 2)
        try:
            from datetime import date as _date
            y, m, d = (int(x) for x in FECHA[:10].split("-"))
            wk = _date(y, m, d).isocalendar()
            update_fields["SEMANA"] = f"{wk.year}-W{wk.week:02d}"
        except:
            pass

    await coll.update_one(q, {"$set": update_fields})
    
    updated_doc = await coll.find_one(q)
    if "_id" in updated_doc:
        updated_doc.pop("_id")
        
    if user.get("role") == "cliente_subsidio":
        return _subsidio_row_to_consumption(updated_doc)
    return updated_doc


@api.delete("/consumptions/{cid}")
async def delete_consumption(cid: str, user: dict = Depends(get_current_user)):
    if user.get("role") == "cliente_subsidio":
        c_doc = await db.consumos_subsidio.find_one({"id": cid, "user_id": user["id"]})
        if not c_doc:
            raise HTTPException(status_code=404, detail="Consumo no encontrado")
        
        n_doc = c_doc.get("numero_documento")
        empresa = c_doc.get("empresa") or user.get("empresa") or ""
        if n_doc and empresa:
            await db.invoices.delete_one({"n_doc": n_doc, "empresa": empresa})
            
        await db.consumos_subsidio.delete_one({"id": cid, "user_id": user["id"]})
        return {"ok": True, "deleted": 1}
    else:
        q = {"id": cid}
        if user["role"] != "admin_enered" and user.get("empresa"):
            q["EMPRESA"] = user["empresa"]
        c_doc = await db.consumptions.find_one(q)
        if not c_doc:
            raise HTTPException(status_code=404, detail="Consumo no encontrado")
            
        n_doc = c_doc.get("NUMERO_DOCUMENTO")
        empresa = c_doc.get("EMPRESA") or user.get("empresa") or ""
        if n_doc and empresa:
            await db.invoices.delete_one({"n_doc": n_doc, "empresa": empresa})
            
        await db.consumptions.delete_one(q)
        return {"ok": True, "deleted": 1}



@api.get("/consumptions/{cid}/download/pdf")
async def download_consumption_pdf(cid: str, user: dict = Depends(get_current_user)):
    c_doc = None
    if user.get("role") == "cliente_subsidio":
        c_doc = await db.consumos_subsidio.find_one({"id": cid, "user_id": user["id"]})
    else:
        q = {"id": cid}
        if user["role"] != "admin_enered" and user.get("empresa"):
            q["EMPRESA"] = user["empresa"]
        c_doc = await db.consumptions.find_one(q)
        
    if not c_doc:
        raise HTTPException(status_code=404, detail="Consumo no encontrado")
        
    fname = c_doc.get("pdf_filename") or c_doc.get("factura_key")
    if not fname:
        raise HTTPException(status_code=404, detail="Comprobante no adjuntado")
        
    empresa = c_doc.get("EMPRESA") or c_doc.get("empresa") or user.get("empresa") or ""
    key = _inv_key(empresa, fname)
    return storage.download_response(key, fname, "application/pdf")


@api.get("/dashboard/filter-options")
async def dashboard_filter_options(user: dict = Depends(get_current_user), empresa: Optional[str] = None):
    # cliente_subsidio: opciones desde consumos_subsidio confirmados
    if user.get("role") == "cliente_subsidio":
        raw = await db.consumos_subsidio.find(
            {"user_id": user["id"], "status": "confirmed"},
            {"_id": 0, "placa": 1, "estacion": 1, "producto": 1, "fecha": 1},
        ).to_list(100000)
        from datetime import date as _date
        placas, estaciones, productos, semanas = set(), set(), set(), set()
        for r in raw:
            if r.get("placa"): placas.add(r["placa"])
            if r.get("estacion"): estaciones.add(r["estacion"])
            if r.get("producto"): productos.add(r["producto"])
            f = (r.get("fecha") or "")[:10]
            try:
                y, m, d = (int(x) for x in f.split("-"))
                wk = _date(y, m, d).isocalendar()
                semanas.add(f"{wk.year}-W{wk.week:02d}")
            except Exception:
                pass
        return {
            "placas": sorted(placas), "semanas": sorted(semanas),
            "estaciones": sorted(estaciones), "productos": sorted(productos),
        }

    q = tenant_filter(user)
    if empresa and user["role"] == "admin_enered":
        q["EMPRESA"] = empresa
    rows = await db.consumptions.find(q, {"_id": 0, "PLACA": 1, "SEMANA": 1, "ESTACION": 1, "PRODUCTO": 1}).to_list(100000)
    placas = sorted({r["PLACA"] for r in rows if r.get("PLACA")})
    semanas = sorted({r["SEMANA"] for r in rows if r.get("SEMANA")})
    estaciones = sorted({r["ESTACION"] for r in rows if r.get("ESTACION")})
    productos = sorted({r["PRODUCTO"] for r in rows if r.get("PRODUCTO")})
    return {"placas": placas, "semanas": semanas, "estaciones": estaciones, "productos": productos}


# ---------- Empresa Config (plan, línea crédito, unidades, RUC, días crédito, servicios) ----------
class EmpresaServicios(BaseModel):
    plataforma: bool = True
    combustible: bool = True
    gps: bool = False
    subsidio: bool = False


class EmpresaConfig(BaseModel):
    empresa: str
    ruc: Optional[str] = ""
    plan: Literal["tracking", "advanced", "integral"] = "tracking"
    linea_credito: float = 0.0
    unidades_contratadas: int = 0
    dias_credito: int = 0  # condición de crédito (días)
    tipo_cliente: Optional[Literal["enered", "subsidio"]] = "enered"
    servicios: Optional[EmpresaServicios] = None


class ServiciosUpdate(BaseModel):
    servicios: EmpresaServicios
    tipo_cliente: Optional[Literal["enered", "subsidio"]] = None


class WialonConfigIn(BaseModel):
    token: str
    host: Optional[str] = None


@api.get("/empresas-config")
async def list_empresas_config(user: dict = Depends(require_roles("admin_enered"))):
    configs = await db.empresas_config.find({}, {"_id": 0}).to_list(500)
    # Mask wialon tokens
    for c in configs:
        w = c.get("wialon") or {}
        if w.get("token"):
            c["wialon"] = {"host": w.get("host") or _svc.DEFAULT_WIALON_HOST, "configurado": True, "token_mask": _svc.mask_wialon_token(_svc.decrypt_wialon_token(w["token"]))}
        else:
            c["wialon"] = {"host": w.get("host") or _svc.DEFAULT_WIALON_HOST, "configurado": False, "token_mask": ""}
        # Normalize servicios defensively
        c["servicios"] = _svc._normalize_servicios(c.get("servicios"))
        c["tipo_cliente"] = c.get("tipo_cliente") or _svc.DEFAULT_TIPO_CLIENTE
    return configs


@api.post("/empresas-config")
async def upsert_empresa_config(data: EmpresaConfig, user: dict = Depends(require_roles("admin_enered"))):
    doc = data.model_dump(exclude_none=True)
    if "servicios" in doc and isinstance(doc["servicios"], dict):
        doc["servicios"] = _svc._normalize_servicios(doc["servicios"])
    doc["updated_at"] = datetime.now(timezone.utc).isoformat()
    existing = await db.empresas_config.find_one({"empresa": data.empresa}, {"_id": 0})
    if existing:
        await db.empresas_config.update_one({"empresa": data.empresa}, {"$set": doc})
    else:
        doc["id"] = str(uuid.uuid4())
        doc["created_at"] = doc["updated_at"]
        if "servicios" not in doc:
            doc["servicios"] = dict(_svc.DEFAULT_SERVICIOS)
        if "tipo_cliente" not in doc:
            doc["tipo_cliente"] = _svc.DEFAULT_TIPO_CLIENTE
        await db.empresas_config.insert_one(doc)
    return await db.empresas_config.find_one({"empresa": data.empresa}, {"_id": 0})


# ---------- Admin: Empresas & Servicios ----------
@api.put("/admin/empresas/{empresa}/servicios")
async def update_empresa_servicios(empresa: str, data: ServiciosUpdate, user: dict = Depends(require_roles("admin_enered"))):
    patch = {
        "servicios": _svc._normalize_servicios(data.servicios.model_dump()),
        "updated_at": datetime.now(timezone.utc).isoformat(),
    }
    if data.tipo_cliente:
        patch["tipo_cliente"] = data.tipo_cliente
    existing = await db.empresas_config.find_one({"empresa": empresa}, {"_id": 0})
    if not existing:
        # crear config mínima
        await db.empresas_config.insert_one({
            "id": str(uuid.uuid4()),
            "empresa": empresa,
            "ruc": "",
            "plan": "tracking",
            "linea_credito": 0.0,
            "unidades_contratadas": 0,
            "created_at": patch["updated_at"],
            **patch,
        })
    else:
        await db.empresas_config.update_one({"empresa": empresa}, {"$set": patch})
    return {"ok": True, "empresa": empresa, "servicios": patch["servicios"], "tipo_cliente": patch.get("tipo_cliente", existing.get("tipo_cliente") if existing else _svc.DEFAULT_TIPO_CLIENTE)}


@api.put("/admin/empresas/{empresa}/wialon")
async def set_empresa_wialon(empresa: str, data: WialonConfigIn, user: dict = Depends(require_roles("admin_enered"))):
    token = (data.token or "").strip()
    if not token:
        raise HTTPException(status_code=400, detail="Token vacío")
    host = (data.host or _svc.DEFAULT_WIALON_HOST).strip()
    enc = _svc.encrypt_wialon_token(token)
    patch = {
        "wialon": {"host": host, "token": enc, "updated_at": datetime.now(timezone.utc).isoformat()},
        "updated_at": datetime.now(timezone.utc).isoformat(),
    }
    existing = await db.empresas_config.find_one({"empresa": empresa}, {"_id": 0})
    if not existing:
        await db.empresas_config.insert_one({
            "id": str(uuid.uuid4()),
            "empresa": empresa,
            "created_at": patch["updated_at"],
            "servicios": {**_svc.DEFAULT_SERVICIOS, "gps": True},
            "tipo_cliente": _svc.DEFAULT_TIPO_CLIENTE,
            **patch,
        })
    else:
        # activar gps automáticamente al configurar wialon
        current_servicios = _svc._normalize_servicios(existing.get("servicios"))
        current_servicios["gps"] = True
        patch["servicios"] = current_servicios
        await db.empresas_config.update_one({"empresa": empresa}, {"$set": patch})
    return {"ok": True, "empresa": empresa, "host": host, "token_mask": _svc.mask_wialon_token(token)}


@api.delete("/admin/empresas/{empresa}/wialon")
async def delete_empresa_wialon(empresa: str, user: dict = Depends(require_roles("admin_enered"))):
    await db.empresas_config.update_one(
        {"empresa": empresa},
        {"$unset": {"wialon": ""}, "$set": {"updated_at": datetime.now(timezone.utc).isoformat()}},
    )
    return {"ok": True}


@api.post("/admin/empresas/{empresa}/wialon/test")
async def test_empresa_wialon(empresa: str, data: WialonConfigIn, user: dict = Depends(require_roles("admin_enered"))):
    """Probar un token Wialon sin guardarlo (o guardado). Si viene token en el body, prueba ese; si no, prueba el guardado."""
    if data.token:
        return await _svc.test_wialon_connection(data.token, data.host or _svc.DEFAULT_WIALON_HOST)
    cfg = await _svc.get_empresa_wialon_config(db, empresa)
    if not cfg:
        raise HTTPException(status_code=404, detail="Wialon no configurado para esta empresa")
    return await _svc.test_wialon_connection(cfg["token"], cfg["host"])


@api.get("/dashboard/overview")
async def dashboard_overview(
    user: dict = Depends(get_current_user),
    empresa: Optional[str] = None,
):
    # Determinar empresa visible
    if user["role"] == "admin_enered":
        target_empresa = empresa or None
    else:
        target_empresa = user.get("empresa")

    # Config de la empresa
    cfg = None
    if target_empresa:
        cfg = await db.empresas_config.find_one({"empresa": target_empresa}, {"_id": 0})
    if not cfg:
        cfg = {
            "empresa": target_empresa or "Todas las empresas",
            "ruc": "",
            "plan": "tracking",
            "linea_credito": 0,
            "unidades_contratadas": 0,
        }

    # Consumos
    q = tenant_filter(user)
    if target_empresa and user["role"] == "admin_enered":
        q["EMPRESA"] = target_empresa
    proj = {"_id": 0, "CANTIDAD_GL": 1, "IMPORTE_TOTAL": 1, "PRECIO_UNITARIO": 1, "AHORRO": 1, "EMPRESA": 1, "FECHA": 1, "PLACA": 1, "KILOMETRAJE": 1}
    rows = await db.consumptions.find(q, proj).to_list(100000)

    # Fetch subsidio consumptions
    sub_q = {"status": "confirmed"}
    if target_empresa and user["role"] == "admin_enered":
        sub_q["empresa"] = target_empresa
    elif user["role"] != "admin_enered":
        sub_q["empresa"] = user.get("empresa")
    sub_proj = {"_id": 0, "galones": 1, "importe_total": 1, "precio_unitario": 1, "empresa": 1, "fecha": 1, "placa": 1, "kilometraje": 1}
    sub_rows = await db.consumos_subsidio.find(sub_q, sub_proj).to_list(100000)
    mapped_sub = [_subsidio_row_to_consumption(r) for r in sub_rows]
    rows.extend(mapped_sub)

    def _f(x, d=0):
        try: return float(x) if x not in (None, "") else d
        except Exception: return d

    total_gal = sum(_f(r.get("CANTIDAD_GL")) for r in rows)
    total_gasto = sum(_f(r.get("IMPORTE_TOTAL")) for r in rows)
    cargas = len(rows)

    # Precio promedio ponderado
    sum_pu = sum(_f(r.get("PRECIO_UNITARIO")) * _f(r.get("CANTIDAD_GL")) for r in rows if _f(r.get("CANTIDAD_GL")) > 0 and _f(r.get("PRECIO_UNITARIO")) > 0)
    sum_gl = sum(_f(r.get("CANTIDAD_GL")) for r in rows if _f(r.get("PRECIO_UNITARIO")) > 0)
    precio_prom = (sum_pu / sum_gl) if sum_gl > 0 else 0

    ticket_prom = total_gasto / cargas if cargas else 0
    gal_por_carga = total_gal / cargas if cargas else 0

    # Ahorro calculation based on services
    if target_empresa:
        svc_info = await _svc.get_empresa_servicios(db, target_empresa)
        has_comb = svc_info.get("servicios", {}).get("combustible", True)
        if not has_comb:
            total_ahorro = 0
            ahorro_gl = 0
        else:
            total_ahorro = sum(_f(r.get("AHORRO")) for r in rows)
            ahorro_gl = (total_ahorro / precio_prom) if precio_prom > 0 else 0
    else:
        cursor = db.empresas_config.find({})
        comb_companies = set()
        async for c in cursor:
            if c.get("servicios", {}).get("combustible", True):
                comb_companies.add(c.get("empresa"))
        total_ahorro = sum(_f(r.get("AHORRO")) for r in rows if r.get("EMPRESA") in comb_companies)
        ahorro_gl = (total_ahorro / precio_prom) if precio_prom > 0 else 0

    # Línea de crédito: utilizada = facturas pendientes/vencidas (saldo) + notas de despacho
    # (alineado con /api/account-state para mostrar los mismos valores que Estado de Cuenta)
    inv_q = {"empresa": target_empresa} if target_empresa else {}
    facturas = await db.invoices.find(inv_q, {"_id": 0}).to_list(5000)
    PAID = {"pagada", "pagado"}
    facturas_pendientes = sum(
        float(f.get("saldo", f.get("monto_total", f.get("monto", 0))) or 0)
        for f in facturas
        if (f.get("estado") or "").lower() not in PAID
    )
    cons_nd_q = {"ESTADO": {"$ne": "FACTURADO"}}
    if target_empresa:
        cons_nd_q["EMPRESA"] = target_empresa
    elif user["role"] != "admin_enered":
        cons_nd_q["EMPRESA"] = user.get("empresa")
    cons_nd = await db.consumptions.find(cons_nd_q, {"_id": 0, "IMPORTE_TOTAL": 1}).to_list(100000)
    notas_despacho = sum(_f(c.get("IMPORTE_TOTAL")) for c in cons_nd)
    utilizada = facturas_pendientes + notas_despacho
    total_credito = float(cfg.get("linea_credito", 0) or 0)
    disponible = max(0, total_credito - utilizada)

    # Unidades (placas únicas reales)
    placas_reales = len({r.get("PLACA") for r in rows if r.get("PLACA")})

    # Cargas de la última semana (últimos 7 días)
    from datetime import datetime, timedelta
    seven_days_ago = (datetime.now() - timedelta(days=7)).strftime("%Y-%m-%d")
    cargas_semana = sum(1 for r in rows if r.get("FECHA") and r.get("FECHA") >= seven_days_ago)

    # Cargas inválidas
    cargas_invalidas = sum(
        1 for r in rows
        if not r.get("PLACA") or _f(r.get("CANTIDAD_GL")) <= 0 or _f(r.get("IMPORTE_TOTAL")) <= 0
    )

    # Unidades / Vehículos
    veh_q = {}
    if target_empresa:
        veh_q["empresa"] = target_empresa
    total_vehicles = await db.vehiculos.count_documents(veh_q)

    # Subsidio vehicles count
    user_ids = []
    if target_empresa:
        cursor = db.users.find({"empresa": target_empresa}, {"_id": 0, "id": 1})
        async for u in cursor:
            if u.get("id"):
                user_ids.append(u["id"])
    elif user["role"] != "admin_enered":
        cursor = db.users.find({"empresa": user.get("empresa")}, {"_id": 0, "id": 1})
        async for u in cursor:
            if u.get("id"):
                user_ids.append(u["id"])
    if user.get("id"):
        user_ids.append(user["id"])
    user_ids = list(set(user_ids))

    subsidio_vehicles_count = 0
    if target_empresa or user["role"] != "admin_enered":
        subsidio_vehicles_count = await db.subsidio_vehicles.count_documents({"user_id": {"$in": user_ids}})
    else:
        subsidio_vehicles_count = await db.subsidio_vehicles.count_documents({})
    
    total_vehicles = max(total_vehicles, subsidio_vehicles_count)

    # Active GPS units count via Wialon
    und_con_gps = 0
    if target_empresa:
        svc_info = await _svc.get_empresa_servicios(db, target_empresa)
        if svc_info.get("servicios", {}).get("gps"):
            cfg_w = await _svc.get_empresa_wialon_config(db, target_empresa)
            if cfg_w:
                try:
                    import json as _json, httpx as _httpx
                    host = cfg_w["host"]
                    base = f"https://{host}/wialon/ajax.html"
                    async with _httpx.AsyncClient(timeout=4.0) as client:
                        r = await client.get(base, params={"svc": "token/login", "params": _json.dumps({"token": cfg_w["token"]})})
                        d = r.json()
                        if "eid" in d:
                            sid = d["eid"]
                            search_params = {
                                "spec": {"itemsType":"avl_unit","propName":"sys_name","propValueMask":"*","sortType":"sys_name","propType":"property"},
                                "force": 1, "flags": 1, "from": 0, "to": 500,
                            }
                            r2 = await client.get(base, params={"svc":"core/search_items", "params": _json.dumps(search_params), "sid": sid})
                            d2 = r2.json()
                            und_con_gps = len(d2.get("items") or [])
                except Exception:
                    und_con_gps = total_vehicles
        else:
            und_con_gps = 0
    else:
        cursor = db.empresas_config.find({})
        gps_companies = []
        async for c in cursor:
            if c.get("servicios", {}).get("gps"):
                gps_companies.append(c.get("empresa"))
        und_con_gps = await db.vehiculos.count_documents({"empresa": {"$in": gps_companies}})

    # Unidades activas is the units with GPS
    unidades_activas = und_con_gps

    # Rendimiento promedio (km/gal) y Costo por km (TCO)
    by_placa_km = {}
    for r in rows:
        p = r.get("PLACA")
        if not p: continue
        km = _f(r.get("KILOMETRAJE"))
        gl = _f(r.get("CANTIDAD_GL"))
        if km > 0:
            d = by_placa_km.setdefault(p, {"kms": [], "gal": 0})
            d["kms"].append(km)
            d["gal"] += gl
            
    total_dist = 0
    total_gal_km = 0
    for p, d in by_placa_km.items():
        if len(d["kms"]) >= 2:
            dist = max(d["kms"]) - min(d["kms"])
            if dist > 0:
                total_dist += dist
                total_gal_km += d["gal"]
                
    rendimiento = total_dist / total_gal_km if total_gal_km > 0 else 0
    costo_km = total_gasto / total_dist if total_dist > 0 else 0

    # Última sync de sheets
    last_sync = await db.sheets_sync_log.find_one({}, {"_id": 0}, sort=[("finished_at", -1)])
    last_sync_at = last_sync["finished_at"] if last_sync else None

    # Get services configuration for response
    svc_data = {}
    if target_empresa:
        svc_info = await _svc.get_empresa_servicios(db, target_empresa)
        svc_data = svc_info.get("servicios", {})
    else:
        svc_data = {"plataforma": True, "combustible": True, "gps": True, "subsidio": True}

    return {
        "empresa": cfg["empresa"],
        "ruc": cfg.get("ruc", ""),
        "plan": cfg.get("plan", "tracking"),
        "servicios": svc_data,
        "unidades_contratadas": int(cfg.get("unidades_contratadas", 0) or 0),
        "unidades_reales": placas_reales,
        "unidades_activas": unidades_activas,
        "total_vehicles": total_vehicles,
        "cargas_semana": cargas_semana,
        "cargas_invalidas": cargas_invalidas,
        "rendimiento": round(rendimiento, 1) if rendimiento > 0 else 0,
        "costo_km": round(costo_km, 2) if costo_km > 0 else 0,
        "und_con_gps": und_con_gps,
        "red_estaciones": 358,
        "linea_credito": {
            "total": total_credito,
            "utilizada": round(utilizada, 2),
            "disponible": round(disponible, 2),
        },
        "ahorro": {
            "soles": round(total_ahorro, 2),
            "galones": round(ahorro_gl, 2),
        },
        "consumo": {
            "soles": round(total_gasto, 2),
            "galones": round(total_gal, 2),
        },
        "promedios": {
            "ticket": round(ticket_prom, 2),
            "block_gal": round(gal_por_carga, 2), # avoid collision
            "carga_gal": round(gal_por_carga, 2),
            "precio": round(precio_prom, 2),
        },
        "cargas": cargas,
        "ultima_sincronizacion": last_sync_at,
    }


DIAS_SEMANA = ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"]


@api.get("/dashboard/kpis")
async def dashboard_kpis(
    user: dict = Depends(get_current_user),
    empresa: Optional[str] = None,
    fecha_desde: Optional[str] = None,
    fecha_hasta: Optional[str] = None,
    placa: Optional[str] = None,
    semana: Optional[str] = None,
    estacion: Optional[str] = None,
    producto: Optional[str] = None,
):
    q = tenant_filter(user)
    if empresa and user["role"] == "admin_enered":
        q["EMPRESA"] = empresa
    if fecha_desde:
        q.setdefault("FECHA", {})["$gte"] = fecha_desde
    if fecha_hasta:
        q.setdefault("FECHA", {})["$lte"] = fecha_hasta
    if placa:
        q["PLACA"] = placa
    if semana:
        q["SEMANA"] = semana
    if estacion:
        q["ESTACION"] = estacion
    if producto:
        q["PRODUCTO"] = producto

    proj = {"_id": 0, "CANTIDAD_GL": 1, "IMPORTE_TOTAL": 1, "AHORRO": 1, "SEMANA": 1, "PRECIO_UNITARIO": 1, "PRECIO_PIZARRA": 1, "PLACA": 1, "CIUDAD": 1, "ESTACION": 1, "PRODUCTO": 1, "HORA": 1, "FECHA": 1, "NRO_DE_TARJETA": 1, "MEDIO_DE_IDENTIFICACION": 1, "KILOMETRAJE": 1}
    rows = await db.consumptions.find(q, proj).to_list(100000)

    # Fetch subsidio consumptions
    sub_q = {"status": "confirmed"}
    if empresa and user["role"] == "admin_enered":
        sub_q["empresa"] = empresa
    elif user["role"] != "admin_enered":
        sub_q["empresa"] = user.get("empresa")

    if fecha_desde:
        sub_q.setdefault("fecha", {})["$gte"] = fecha_desde
    if fecha_hasta:
        sub_q.setdefault("fecha", {})["$lte"] = fecha_hasta
    if placa:
        sub_q["placa"] = placa.upper()
    if estacion:
        sub_q["estacion"] = estacion
    if producto:
        sub_q["producto"] = producto

    sub_proj = {"_id": 0, "galones": 1, "importe_total": 1, "precio_unitario": 1, "precio_pizarra": 1, "fecha": 1, "hora": 1, "placa": 1, "ciudad": 1, "estacion": 1, "producto": 1, "kilometraje": 1, "semana": 1}
    sub_rows = await db.consumos_subsidio.find(sub_q, sub_proj).to_list(100000)
    mapped_sub = [_subsidio_row_to_consumption(r) for r in sub_rows]
    if semana:
        mapped_sub = [r for r in mapped_sub if r.get("SEMANA") == semana]
    rows.extend(mapped_sub)

    def _f(x, default=0):
        try: return float(x) if x not in (None, "") else default
        except Exception: return default

    # ---- Totales ----
    total_gal = sum(_f(r.get("CANTIDAD_GL")) for r in rows)
    total_gasto = sum(_f(r.get("IMPORTE_TOTAL")) for r in rows)
    total_ahorro = sum(_f(r.get("AHORRO")) for r in rows)
    cargas = len(rows)

    # ---- Agregados por semana ----
    by_week = {}
    precios_pond = {}  # sum(precio_unit*gal), sum(gal) per semana
    pizarra_pond = {}
    for r in rows:
        s = r.get("SEMANA", "Sin semana")
        d = by_week.setdefault(s, {"consumo": 0.0, "gasto": 0.0, "ahorro": 0.0, "ahorro_gal": 0.0, "cargas": 0})
        g = _f(r.get("CANTIDAD_GL"))
        ah = _f(r.get("AHORRO"))
        d["consumo"] += g
        d["gasto"] += _f(r.get("IMPORTE_TOTAL"))
        d["ahorro"] += ah
        d["cargas"] += 1

        pu = _f(r.get("PRECIO_UNITARIO"))
        pp = _f(r.get("PRECIO_PIZARRA"))
        # Galones equivalentes ahorrados = ahorro_S/ / precio_pizarra
        if pp > 0 and ah > 0:
            d["ahorro_gal"] += ah / pp
        if pu > 0 and g > 0:
            pw = precios_pond.setdefault(s, {"pond": 0.0, "gal": 0.0})
            pw["pond"] += pu * g
            pw["gal"] += g
        if pp > 0 and g > 0:
            pw = pizarra_pond.setdefault(s, {"pond": 0.0, "gal": 0.0})
            pw["pond"] += pp * g
            pw["gal"] += g

    semanas_sorted = sorted(by_week.keys())
    serie_semanas = []
    for s in semanas_sorted:
        d = by_week[s]
        pu_avg = (precios_pond[s]["pond"] / precios_pond[s]["gal"]) if s in precios_pond and precios_pond[s]["gal"] > 0 else 0
        pp_avg = (pizarra_pond[s]["pond"] / pizarra_pond[s]["gal"]) if s in pizarra_pond and pizarra_pond[s]["gal"] > 0 else 0
        ticket = (d["gasto"] / d["cargas"]) if d["cargas"] else 0
        gal_carga = (d["consumo"] / d["cargas"]) if d["cargas"] else 0
        serie_semanas.append({
            "semana": s,
            "consumo": round(d["consumo"], 2),
            "gasto": round(d["gasto"], 2),
            "ahorro": round(d["ahorro"], 2),
            "ahorro_galones": round(d["ahorro_gal"], 2),
            "cargas": d["cargas"],
            "ticket_prom": round(ticket, 2),
            "gal_por_carga": round(gal_carga, 2),
            "precio_enered": round(pu_avg, 2),
            "precio_pizarra": round(pp_avg, 2),
        })

    # ---- Agregados por placa ----
    by_placa = {}
    for r in rows:
        p = r.get("PLACA")
        if not p: continue
        d = by_placa.setdefault(p, {"consumo": 0.0, "gasto": 0.0, "ahorro": 0.0, "ahorro_gal": 0.0, "cargas": 0})
        d["consumo"] += _f(r.get("CANTIDAD_GL"))
        d["gasto"] += _f(r.get("IMPORTE_TOTAL"))
        ah = _f(r.get("AHORRO"))
        pp = _f(r.get("PRECIO_PIZARRA"))
        d["ahorro"] += ah
        if pp > 0 and ah > 0:
            d["ahorro_gal"] += ah / pp
        d["cargas"] += 1

    top_placas_consumo = sorted(
        [{"placa": p, "galones": round(v["consumo"], 2), "ahorro": round(v["ahorro"], 2), "ahorro_galones": round(v["ahorro_gal"], 2)} for p, v in by_placa.items()],
        key=lambda x: -x["galones"]
    )[:5]
    gasto_placa = sorted(
        [{"placa": p, "gasto": round(v["gasto"], 2), "ahorro": round(v["ahorro"], 2), "ahorro_galones": round(v["ahorro_gal"], 2)} for p, v in by_placa.items()],
        key=lambda x: -x["gasto"]
    )[:10]
    cargas_placa = sorted(
        [{"placa": p, "cargas": v["cargas"]} for p, v in by_placa.items()],
        key=lambda x: -x["cargas"]
    )[:10]

    # ---- Ciudad / Estación ----
    ciudades = {}
    ciudades_gasto = {}
    ciudades_ahorro = {}
    ciudades_ahorro_gal = {}
    est_consumo = {}
    est_gasto = {}
    est_ahorro = {}
    est_ahorro_gal = {}
    for r in rows:
        c = r.get("CIUDAD", "Sin ciudad")
        ah = _f(r.get("AHORRO"))
        pp = _f(r.get("PRECIO_PIZARRA"))
        ah_gal = (ah / pp) if (pp > 0 and ah > 0) else 0.0
        ciudades[c] = ciudades.get(c, 0) + _f(r.get("CANTIDAD_GL"))
        ciudades_gasto[c] = ciudades_gasto.get(c, 0) + _f(r.get("IMPORTE_TOTAL"))
        ciudades_ahorro[c] = ciudades_ahorro.get(c, 0) + ah
        ciudades_ahorro_gal[c] = ciudades_ahorro_gal.get(c, 0) + ah_gal
        e = r.get("ESTACION", "Sin estación")
        est_consumo[e] = est_consumo.get(e, 0) + _f(r.get("CANTIDAD_GL"))
        est_gasto[e] = est_gasto.get(e, 0) + _f(r.get("IMPORTE_TOTAL"))
        est_ahorro[e] = est_ahorro.get(e, 0) + ah
        est_ahorro_gal[e] = est_ahorro_gal.get(e, 0) + ah_gal

    consumo_ciudad = [{
        "ciudad": c,
        "galones": round(v, 2),
        "gasto": round(ciudades_gasto.get(c, 0), 2),
        "ahorro": round(ciudades_ahorro.get(c, 0), 2),
        "ahorro_galones": round(ciudades_ahorro_gal.get(c, 0), 2),
    } for c, v in sorted(ciudades.items(), key=lambda x: -x[1])[:10]]
    consumo_estacion = [{
        "estacion": e,
        "galones": round(v, 2),
        "gasto": round(est_gasto.get(e, 0), 2),
        "ahorro": round(est_ahorro.get(e, 0), 2),
        "ahorro_galones": round(est_ahorro_gal.get(e, 0), 2),
    } for e, v in sorted(est_consumo.items(), key=lambda x: -x[1])[:10]]
    ahorro_estacion = [{"estacion": e, "ahorro": round(v, 2)} for e, v in sorted(est_ahorro.items(), key=lambda x: -x[1])[:10]]

    # ---- Producto ----
    prod_consumo = {}
    prod_gasto = {}
    for r in rows:
        pr = r.get("PRODUCTO", "Otro")
        prod_consumo[pr] = prod_consumo.get(pr, 0) + _f(r.get("CANTIDAD_GL"))
        prod_gasto[pr] = prod_gasto.get(pr, 0) + _f(r.get("IMPORTE_TOTAL"))

    consumo_producto = [{"producto": p, "galones": round(v, 2)} for p, v in sorted(prod_consumo.items(), key=lambda x: -x[1])]
    gasto_producto = [{"producto": p, "gasto": round(v, 2)} for p, v in sorted(prod_gasto.items(), key=lambda x: -x[1])]

    # ---- Comportamiento: hora, día, medio ----
    cargas_hora = [0] * 24
    cargas_dia = {d: 0 for d in DIAS_SEMANA}
    medio_counts = {}
    for r in rows:
        h_raw = r.get("HORA", "")
        try:
            h = int(str(h_raw).split(":")[0])
            if 0 <= h <= 23:
                cargas_hora[h] += 1
        except Exception:
            pass
        try:
            d = datetime.fromisoformat(r["FECHA"])
            cargas_dia[DIAS_SEMANA[d.weekday()]] += 1
        except Exception:
            pass
        m = r.get("MEDIO_DE_IDENTIFICACION") or "Sin dato"
        medio_counts[m] = medio_counts.get(m, 0) + 1

    cargas_por_hora = [{"hora": f"{h:02d}h", "cargas": cargas_hora[h]} for h in range(24)]
    cargas_por_dia = [{"dia": d, "cargas": cargas_dia[d]} for d in DIAS_SEMANA]
    medio_identificacion = [
        {"medio": m, "cargas": c} for m, c in sorted(medio_counts.items(), key=lambda x: -x[1])
    ]

    # ---- Precio ENERED vs pizarra (global) ----
    total_pu_pond = sum(p["pond"] for p in precios_pond.values())
    total_pu_gal = sum(p["gal"] for p in precios_pond.values())
    total_pp_pond = sum(p["pond"] for p in pizarra_pond.values())
    total_pp_gal = sum(p["gal"] for p in pizarra_pond.values())
    precio_enered = round(total_pu_pond / total_pu_gal, 2) if total_pu_gal > 0 else 0
    precio_pizarra = round(total_pp_pond / total_pp_gal, 2) if total_pp_gal > 0 else 0

    precio_comparacion_producto = []
    by_prod_precio = {}
    for r in rows:
        pr = r.get("PRODUCTO", "Otro")
        g = _f(r.get("CANTIDAD_GL"))
        pu = _f(r.get("PRECIO_UNITARIO"))
        pp = _f(r.get("PRECIO_PIZARRA"))
        if g <= 0: continue
        d = by_prod_precio.setdefault(pr, {"pu": 0.0, "pp": 0.0, "g1": 0.0, "g2": 0.0})
        if pu > 0: d["pu"] += pu * g; d["g1"] += g
        if pp > 0: d["pp"] += pp * g; d["g2"] += g
    for pr, d in by_prod_precio.items():
        precio_comparacion_producto.append({
            "producto": pr,
            "enered": round(d["pu"] / d["g1"], 2) if d["g1"] > 0 else 0,
            "pizarra": round(d["pp"] / d["g2"], 2) if d["g2"] > 0 else 0,
        })

    # ---- Ticket & Gal promedio ----
    ticket_prom = round(total_gasto / cargas, 2) if cargas else 0
    gal_por_carga = round(total_gal / cargas, 2) if cargas else 0

    return {
        "totals": {
            "total_gal": round(total_gal, 2),
            "total_gasto": round(total_gasto, 2),
            "total_ahorro": round(total_ahorro, 2),
            "cargas": cargas,
            "ticket_prom": ticket_prom,
            "gal_por_carga": gal_por_carga,
            "precio_enered": precio_enered,
            "precio_pizarra": precio_pizarra,
            "ahorro_pct": round((total_ahorro / (total_gasto + total_ahorro) * 100) if (total_gasto + total_ahorro) else 0, 2),
        },
        "series_semana": serie_semanas,
        "top_placas_consumo": top_placas_consumo,
        "gasto_placa": gasto_placa,
        "cargas_placa": cargas_placa,
        "consumo_ciudad": consumo_ciudad,
        "consumo_estacion": consumo_estacion,
        "ahorro_estacion": ahorro_estacion,
        "consumo_producto": consumo_producto,
        "gasto_producto": gasto_producto,
        "precio_comparacion_producto": precio_comparacion_producto,
        "cargas_por_hora": cargas_por_hora,
        "cargas_por_dia": cargas_por_dia,
        "medio_identificacion": medio_identificacion,
    }


@api.get("/analytics/fleet")
async def analytics_fleet(
    user: dict = Depends(get_current_user),
    empresa: Optional[str] = None,
    fecha_desde: Optional[str] = None,
    fecha_hasta: Optional[str] = None,
):
    q = tenant_filter(user)
    if empresa and user["role"] == "admin_enered":
        q["EMPRESA"] = empresa
    if fecha_desde:
        q.setdefault("FECHA", {})["$gte"] = fecha_desde
    if fecha_hasta:
        q.setdefault("FECHA", {})["$lte"] = fecha_hasta

    proj = {"_id": 0, "CANTIDAD_GL": 1, "IMPORTE_TOTAL": 1, "AHORRO": 1, "PLACA": 1, "KILOMETRAJE": 1, "FECHA": 1, "ESTACION": 1, "PRECIO_UNITARIO": 1, "SEMANA": 1, "PRODUCTO": 1, "NRO_DE_TARJETA": 1, "MEDIO_DE_IDENTIFICACION": 1}
    rows = await db.consumptions.find(q, proj).to_list(100000)
    if not rows:
        return {
            "kpis": {"ahorro_pct": 0, "galones_por_carga": 0, "costo_por_carga": 0, "rendimiento_prom": 0, "cargas_por_dia": 0},
            "rendimiento": [], "pareto": [], "precio_estaciones": [],
            "tendencia_precio": [], "heatmap": [], "productos_pct": [], "top_tarjetas": [],
        }

    # ---- Aggregate per placa ----
    per_placa = {}
    for r in rows:
        p = r.get("PLACA")
        if not p:
            continue
        d = per_placa.setdefault(p, {
            "placa": p, "gal": 0.0, "gasto": 0.0, "ahorro": 0.0,
            "cargas": 0, "readings": [],
        })
        d["gal"] += float(r.get("CANTIDAD_GL", 0) or 0)
        d["gasto"] += float(r.get("IMPORTE_TOTAL", 0) or 0)
        d["ahorro"] += float(r.get("AHORRO", 0) or 0)
        d["cargas"] += 1
        km = r.get("KILOMETRAJE")
        try:
            km = float(km) if km not in (None, "") else None
        except Exception:
            km = None
        if km is not None and km > 0 and r.get("FECHA"):
            d["readings"].append((r["FECHA"], km))

    # Sensible upper bound for km between two fuel loads in a transport fleet
    MAX_KM_PER_DELTA = 3000

    rendimiento = []
    for p, d in per_placa.items():
        # Sort readings by date and sum valid consecutive deltas
        d["readings"].sort(key=lambda x: x[0])
        km_trav = 0
        for i in range(1, len(d["readings"])):
            delta = d["readings"][i][1] - d["readings"][i - 1][1]
            # keep only physically plausible deltas
            if 0 < delta <= MAX_KM_PER_DELTA:
                km_trav += delta
        km_por_gal = round(km_trav / d["gal"], 2) if d["gal"] > 0 and km_trav > 0 else None
        costo_km = round(d["gasto"] / km_trav, 2) if km_trav > 0 else None
        rendimiento.append({
            "placa": p,
            "gal": round(d["gal"], 2),
            "gasto": round(d["gasto"], 2),
            "ahorro": round(d["ahorro"], 2),
            "cargas": d["cargas"],
            "km_recorridos": round(km_trav, 0) if km_trav else 0,
            "km_por_gal": km_por_gal,
            "costo_km": costo_km,
        })
    rendimiento.sort(key=lambda x: -(x["km_por_gal"] or 0))

    # ---- Pareto (80/20) gasto ----
    pareto_sorted = sorted(per_placa.values(), key=lambda x: -x["gasto"])
    total_gasto = sum(d["gasto"] for d in pareto_sorted) or 1
    pareto = []
    acc = 0
    for d in pareto_sorted:
        acc += d["gasto"]
        pareto.append({
            "placa": d["placa"],
            "gasto": round(d["gasto"], 2),
            "pct_acum": round((acc / total_gasto) * 100, 2),
        })

    # ---- Precio promedio por estación ----
    per_est = {}
    for r in rows:
        e = r.get("ESTACION")
        if not e:
            continue
        pu = float(r.get("PRECIO_UNITARIO", 0) or 0)
        gl = float(r.get("CANTIDAD_GL", 0) or 0)
        ah = float(r.get("AHORRO", 0) or 0)
        if pu <= 0:
            continue
        d = per_est.setdefault(e, {"estacion": e, "suma_pu_pond": 0.0, "gal": 0.0, "cargas": 0, "ahorro": 0.0})
        d["suma_pu_pond"] += pu * gl
        d["gal"] += gl
        d["cargas"] += 1
        d["ahorro"] += ah
    precio_estaciones = []
    for d in per_est.values():
        precio = d["suma_pu_pond"] / d["gal"] if d["gal"] > 0 else 0
        ahorro_gal = d["ahorro"] / d["gal"] if d["gal"] > 0 else 0
        precio_estaciones.append({
            "estacion": d["estacion"],
            "precio_prom": round(precio, 2),
            "cargas": d["cargas"],
            "ahorro_por_gal": round(ahorro_gal, 2),
        })
    precio_estaciones.sort(key=lambda x: x["precio_prom"])

    # ---- Tendencia de precio unitario en el tiempo ----
    per_date = {}
    for r in rows:
        fecha = r.get("FECHA")
        if not fecha:
            continue
        pu = float(r.get("PRECIO_UNITARIO", 0) or 0)
        gl = float(r.get("CANTIDAD_GL", 0) or 0)
        if pu <= 0:
            continue
        d = per_date.setdefault(fecha, {"suma_pond": 0.0, "gal": 0.0})
        d["suma_pond"] += pu * gl
        d["gal"] += gl
    tendencia_precio = sorted([
        {"fecha": k, "precio_prom": round(v["suma_pond"] / v["gal"], 3) if v["gal"] > 0 else 0}
        for k, v in per_date.items()
    ], key=lambda x: x["fecha"])

    # ---- Heatmap día semana x hora ----
    DIAS = ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"]
    heatmap_counts = {}
    for r in rows:
        try:
            d = datetime.fromisoformat(r["FECHA"])
            dia = DIAS[d.weekday()]
        except Exception:
            continue
        hora = r.get("HORA", "")
        try:
            h = int(str(hora).split(":")[0])
        except Exception:
            continue
        if not (0 <= h <= 23):
            continue
        heatmap_counts[(dia, h)] = heatmap_counts.get((dia, h), 0) + 1
    heatmap = []
    for dia in DIAS:
        for h in range(24):
            heatmap.append({"dia": dia, "hora": h, "count": heatmap_counts.get((dia, h), 0)})

    # ---- Heatmap placa x semana (consumo gal) ----
    placa_semana = {}
    semanas_set = set()
    placas_set = set()
    for r in rows:
        p = r.get("PLACA")
        s = r.get("SEMANA")
        if not p or not s: continue
        semanas_set.add(s); placas_set.add(p)
        placa_semana[(p, s)] = placa_semana.get((p, s), 0) + float(r.get("CANTIDAD_GL", 0) or 0)
    semanas_list = sorted(semanas_set)
    # Placas ordenadas por consumo total desc (para mostrar top en primera fila)
    placas_totales = {}
    for (p, s), v in placa_semana.items():
        placas_totales[p] = placas_totales.get(p, 0) + v
    placas_list = [p for p, _ in sorted(placas_totales.items(), key=lambda x: -x[1])]
    heatmap_ps = [
        {
            "placa": p,
            "semana": s,
            "galones": round(placa_semana.get((p, s), 0), 2),
        }
        for p in placas_list for s in semanas_list
    ]

    # Participación por placa (%)
    tot_gal_placas = sum(placas_totales.values()) or 1
    participacion_placa = [
        {"placa": p, "galones": round(v, 2), "pct": round(v / tot_gal_placas * 100, 2)}
        for p, v in sorted(placas_totales.items(), key=lambda x: -x[1])
    ]

    # ---- Productos (%) ----
    productos = {}
    total_gal_prod = 0
    for r in rows:
        p = r.get("PRODUCTO", "Otro")
        gl = float(r.get("CANTIDAD_GL", 0) or 0)
        productos[p] = productos.get(p, 0) + gl
        total_gal_prod += gl
    productos_pct = [
        {"producto": p, "galones": round(g, 2), "pct": round((g / total_gal_prod * 100) if total_gal_prod else 0, 2)}
        for p, g in sorted(productos.items(), key=lambda x: -x[1])
    ]

    # ---- Top tarjetas ----
    tarjetas = {}
    for r in rows:
        t = r.get("NRO_DE_TARJETA") or r.get("MEDIO_DE_IDENTIFICACION") or "Sin ID"
        d = tarjetas.setdefault(t, {"tarjeta": str(t), "gal": 0, "gasto": 0, "cargas": 0})
        d["gal"] += float(r.get("CANTIDAD_GL", 0) or 0)
        d["gasto"] += float(r.get("IMPORTE_TOTAL", 0) or 0)
        d["cargas"] += 1
    top_tarjetas = sorted(
        [{"tarjeta": v["tarjeta"], "gal": round(v["gal"], 2), "gasto": round(v["gasto"], 2), "cargas": v["cargas"]} for v in tarjetas.values()],
        key=lambda x: -x["gasto"]
    )[:10]

    # ---- KPIs avanzados ----
    total_gal_all = sum(float(r.get("CANTIDAD_GL", 0) or 0) for r in rows)
    total_gasto_all = sum(float(r.get("IMPORTE_TOTAL", 0) or 0) for r in rows)
    total_ahorro_all = sum(float(r.get("AHORRO", 0) or 0) for r in rows)
    cargas_all = len(rows)

    try:
        dates = sorted({datetime.fromisoformat(r["FECHA"]) for r in rows if r.get("FECHA")})
        dias_unicos = len(dates) or 1
    except Exception:
        dias_unicos = 1

    rendimientos_validos = [r["km_por_gal"] for r in rendimiento if r["km_por_gal"]]
    rend_prom = round(sum(rendimientos_validos) / len(rendimientos_validos), 2) if rendimientos_validos else 0

    ahorro_pct = round((total_ahorro_all / (total_gasto_all + total_ahorro_all) * 100) if (total_gasto_all + total_ahorro_all) else 0, 2)

    return {
        "kpis": {
            "ahorro_pct": ahorro_pct,
            "galones_por_carga": round(total_gal_all / cargas_all, 2) if cargas_all else 0,
            "costo_por_carga": round(total_gasto_all / cargas_all, 2) if cargas_all else 0,
            "rendimiento_prom": rend_prom,
            "cargas_por_dia": round(cargas_all / dias_unicos, 2) if dias_unicos else 0,
        },
        "rendimiento": rendimiento,
        "pareto": pareto,
        "precio_estaciones": precio_estaciones,
        "tendencia_precio": tendencia_precio,
        "heatmap": heatmap,
        "heatmap_placa_semana": {
            "placas": placas_list,
            "semanas": semanas_list,
            "cells": heatmap_ps,
        },
        "participacion_placa": participacion_placa,
        "productos_pct": productos_pct,
        "top_tarjetas": top_tarjetas,
    }


@api.get("/dashboard/alerts")
async def dashboard_alerts(user: dict = Depends(get_current_user), empresa: Optional[str] = None):
    q = tenant_filter(user)
    if empresa and user["role"] == "admin_enered":
        q["EMPRESA"] = empresa
    proj = {"_id": 0, "FECHA": 1, "PLACA": 1, "ESTACION": 1}
    rows = await db.consumptions.find(q, proj).to_list(100000)
    if not rows:
        return []

    # Parse dates
    for r in rows:
        try:
            r["_date"] = datetime.fromisoformat(r["FECHA"])
        except Exception:
            r["_date"] = None

    max_date = max((r["_date"] for r in rows if r["_date"]), default=datetime.now(timezone.utc))

    alerts = []

    # 1) Más cargas que la semana pasada (por placa)
    last_week_start = max_date - timedelta(days=7)
    prev_week_start = max_date - timedelta(days=14)
    per_placa_last = {}
    per_placa_prev = {}
    for r in rows:
        if not r["_date"]:
            continue
        if r["_date"] >= last_week_start:
            per_placa_last[r["PLACA"]] = per_placa_last.get(r["PLACA"], 0) + 1
        elif r["_date"] >= prev_week_start:
            per_placa_prev[r["PLACA"]] = per_placa_prev.get(r["PLACA"], 0) + 1
    for placa, c_last in per_placa_last.items():
        c_prev = per_placa_prev.get(placa, 0)
        if c_prev > 0 and c_last > c_prev * 1.3:
            alerts.append({
                "tipo": "cargas_incrementadas",
                "nivel": "yellow",
                "titulo": "Incremento de cargas",
                "mensaje": f"Placa {placa}: {c_last} cargas vs {c_prev} semana previa",
                "placa": placa,
            })

    # 2) Estación no usada en últimas 4 semanas
    four_weeks = max_date - timedelta(days=28)
    stations_recent = {r["ESTACION"] for r in rows if r["_date"] and r["_date"] >= four_weeks}
    stations_old = {r["ESTACION"] for r in rows if r["_date"] and r["_date"] < four_weeks}
    dormidas = stations_old - stations_recent
    for s in list(dormidas)[:5]:
        alerts.append({
            "tipo": "estacion_dormida",
            "nivel": "yellow",
            "titulo": "Estación sin uso reciente",
            "mensaje": f"Estación {s} no se ha usado en las últimas 4 semanas",
            "estacion": s,
        })

    # 3) Estación con uso < 10% histórico (en última semana)
    total_last = sum(1 for r in rows if r["_date"] and r["_date"] >= last_week_start)
    if total_last > 0:
        per_est_last = {}
        per_est_hist = {}
        for r in rows:
            if not r["_date"]:
                continue
            if r["_date"] >= last_week_start:
                per_est_last[r["ESTACION"]] = per_est_last.get(r["ESTACION"], 0) + 1
            per_est_hist[r["ESTACION"]] = per_est_hist.get(r["ESTACION"], 0) + 1
        total_hist = len(rows)
        for est, c_last in per_est_last.items():
            pct_last = c_last / total_last
            pct_hist = per_est_hist.get(est, 0) / total_hist
            if pct_hist > 0.1 and pct_last < pct_hist * 0.1:
                alerts.append({
                    "tipo": "estacion_caida",
                    "nivel": "red",
                    "titulo": "Caída de uso en estación",
                    "mensaje": f"Estación {est}: uso bajo vs histórico",
                    "estacion": est,
                })

    # 4) Estación nueva para la placa
    placa_estaciones_hist = {}
    for r in rows:
        if not r["_date"]:
            continue
        if r["_date"] < last_week_start:
            placa_estaciones_hist.setdefault(r["PLACA"], set()).add(r["ESTACION"])
    nuevas = set()
    for r in rows:
        if r["_date"] and r["_date"] >= last_week_start:
            prev = placa_estaciones_hist.get(r["PLACA"], set())
            if r["ESTACION"] and r["ESTACION"] not in prev:
                nuevas.add((r["PLACA"], r["ESTACION"]))
    for placa, est in list(nuevas)[:5]:
        alerts.append({
            "tipo": "estacion_nueva_placa",
            "nivel": "green",
            "titulo": "Nueva estación para placa",
            "mensaje": f"Placa {placa} usó por primera vez la estación {est}",
            "placa": placa,
            "estacion": est,
        })

    return alerts[:20]


# ---------- CSV / Excel Upload for Consumptions ----------
@api.post("/admin/consumptions/upload")
async def upload_consumptions(file: UploadFile = File(...),
                              user: dict = Depends(require_roles("admin_enered"))):
    content = await file.read()
    try:
        if file.filename.endswith(".csv"):
            df = pd.read_csv(io.BytesIO(content))
        else:
            df = pd.read_excel(io.BytesIO(content))
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Error leyendo archivo: {e}")

    # Normalize column names
    df.columns = [c.strip().upper().replace(" ", "_") for c in df.columns]

    expected = ["FECHA", "EMPRESA", "PLACA", "CIUDAD", "ESTACION", "PRODUCTO", "CANTIDAD_GL", "IMPORTE_TOTAL"]
    missing = [c for c in expected if c not in df.columns]
    if missing:
        raise HTTPException(status_code=400, detail=f"Faltan columnas: {missing}")

    records = []
    for _, row in df.iterrows():
        rec = {k: (row[k] if k in df.columns and pd.notna(row[k]) else None) for k in df.columns}
        # Type fixes
        for fnum in ["CANTIDAD_GL", "IMPORTE_TOTAL", "AHORRO", "PRECIO_UNITARIO", "PRECIO_PIZARRA", "KILOMETRAJE"]:
            if fnum in rec and rec[fnum] is not None:
                try:
                    rec[fnum] = float(rec[fnum])
                except Exception:
                    rec[fnum] = None
        # Date handling
        if rec.get("FECHA") is not None:
            try:
                rec["FECHA"] = pd.to_datetime(rec["FECHA"]).date().isoformat()
            except Exception:
                rec["FECHA"] = str(rec["FECHA"])
        rec["id"] = str(uuid.uuid4())
        records.append(rec)

    if records:
        await db.consumptions.insert_many(records)
    return {"inserted": len(records)}


@api.delete("/admin/consumptions")
async def delete_all_consumptions(user: dict = Depends(require_roles("admin_enered"))):
    res = await db.consumptions.delete_many({})
    return {"deleted": res.deleted_count}


# ---------- Manual fuel loads (para empresas con servicios.combustible=false: plataforma / solo GPS) ----------
@api.post("/consumptions/manual")
async def create_manual_consumption(
    placa: str = Form(...),
    fecha: str = Form(...),                    # YYYY-MM-DD
    hora: Optional[str] = Form(""),            # HH:MM
    estacion: Optional[str] = Form(""),
    ciudad: Optional[str] = Form(""),
    producto: Optional[str] = Form("DIESEL B5"),
    galones: float = Form(...),
    precio_unitario: Optional[float] = Form(None),
    importe_total: float = Form(...),
    kilometraje: Optional[int] = Form(None),
    conductor: Optional[str] = Form(""),
    numero_factura: Optional[str] = Form(""),
    factura: Optional[UploadFile] = File(None),
    user: dict = Depends(get_current_user),
):
    """
    Carga manual de un abastecimiento. Usado por empresas que NO consumen con ENERED
    (servicios.combustible=false). El PDF de la factura es opcional pero recomendado.
    """
    empresa = user.get("empresa")
    if user["role"] == "admin_enered":
        raise HTTPException(status_code=400, detail="admin_enered no tiene empresa; use un usuario cliente")
    if not empresa:
        raise HTTPException(status_code=400, detail="Usuario sin empresa asociada")

    # Guardar PDF de factura (si viene)
    factura_key = None
    factura_content_type = None
    if factura and factura.filename:
        contents = await factura.read()
        if len(contents) > 20 * 1024 * 1024:  # 20 MB
            raise HTTPException(status_code=413, detail="Factura excede 20 MB")
        # Ruta canonical: manual_invoices/{empresa}/{consumo_id}.{ext}
        ext = (factura.filename.rsplit(".", 1)[-1] or "pdf").lower()
        consumo_id = str(uuid.uuid4())
        factura_key = f"manual_invoices/{empresa}/{consumo_id}.{ext}"
        factura_content_type = factura.content_type or "application/pdf"
        save_object(factura_key, contents, content_type=factura_content_type)
    else:
        consumo_id = str(uuid.uuid4())

    # Semana ISO
    from datetime import date as _date
    try:
        y, m, d = (int(x) for x in fecha[:10].split("-"))
        wk = _date(y, m, d).isocalendar()
        semana = f"{wk.year}-W{wk.week:02d}"
    except Exception:
        semana = ""

    doc = {
        "id": consumo_id,
        "FECHA": fecha,
        "HORA": hora or "",
        "CIUDAD": ciudad or "",
        "ESTACION": estacion or "",
        "PLACA": placa.strip().upper(),
        "PRODUCTO": producto or "DIESEL B5",
        "UNIDAD": "GALON",
        "CANTIDAD_GL": float(galones),
        "PRECIO_UNITARIO": float(precio_unitario) if precio_unitario is not None else (float(importe_total) / float(galones) if float(galones) > 0 else 0),
        "IMPORTE_TOTAL": float(importe_total),
        "AHORRO": 0,  # no aplica para carga manual
        "NOTA_DE_DESPACHO": numero_factura or "",
        "EMPRESA": empresa,
        "KILOMETRAJE": kilometraje if kilometraje is not None else None,
        "CONDUCTOR": conductor or "",
        "SEMANA": semana,
        "ESTADO": "FACTURADO",
        "_origen": "manual",
        "factura_key": factura_key,
        "factura_content_type": factura_content_type,
        "numero_factura": numero_factura or "",
        "created_at": datetime.now(timezone.utc).isoformat(),
        "created_by": user["id"],
    }
    await db.consumptions.insert_one(doc)

    # SIEMPRE crear la factura en /api/invoices para que aparezca en Facturación
    inv_numero = numero_factura or f"MAN-{consumo_id[:8]}"
    await db.invoices.insert_one({
        "id": str(uuid.uuid4()),
        "empresa": empresa,
        "numero": inv_numero,
        "fecha_emision": fecha,
        "fecha_vencimiento": fecha,
        "monto": float(importe_total),
        "saldo": float(importe_total),
        "estado": "pendiente",
        "pdf_url": f"/api/consumptions/{consumo_id}/factura" if factura_key else None,
        "origen": "manual",
        "consumo_id": consumo_id,
        "placa": doc["PLACA"],
        "created_at": datetime.now(timezone.utc).isoformat(),
    })

    doc.pop("_id", None)
    return {"ok": True, "consumo": doc, "invoice_numero": inv_numero}


# ---------- Delete individual consumption (tenant-checked) ----------
@api.delete("/consumptions/{consumo_id}")
async def delete_consumption(consumo_id: str, user: dict = Depends(get_current_user)):
    """Elimina un consumo individual + su invoice + su PDF factura si existe."""
    doc = await db.consumptions.find_one({"id": consumo_id}, {"_id": 0})
    if not doc:
        raise HTTPException(status_code=404, detail="Consumo no encontrado")
    if user["role"] != "admin_enered" and doc.get("EMPRESA") != user.get("empresa"):
        raise HTTPException(status_code=403, detail="Sin acceso")
    # borrar PDF factura si existe
    try:
        from storage import delete_object as _delobj
        if doc.get("factura_key"):
            _delobj(doc["factura_key"])
    except Exception:
        pass
    # borrar invoice asociada si es manual
    await db.invoices.delete_many({"consumo_id": consumo_id})
    r = await db.consumptions.delete_one({"id": consumo_id})
    return {"ok": True, "deleted": r.deleted_count}


@api.get("/consumptions/{consumo_id}/factura")
async def download_manual_factura(consumo_id: str, user: dict = Depends(get_current_user)):
    """Descargar la factura PDF asociada a una carga manual."""
    doc = await db.consumptions.find_one({"id": consumo_id}, {"_id": 0})
    if not doc:
        raise HTTPException(status_code=404, detail="Consumo no encontrado")
    # Tenant check
    if user["role"] != "admin_enered" and doc.get("EMPRESA") != user.get("empresa"):
        raise HTTPException(status_code=403, detail="Sin acceso")
    key = doc.get("factura_key")
    if not key:
        raise HTTPException(status_code=404, detail="Esta carga no tiene factura adjunta")
    ct = doc.get("factura_content_type") or "application/pdf"
    filename = key.rsplit("/", 1)[-1]
    return download_response(key, filename=filename, content_type=ct)


# ---------- Google Sheets Sync ----------
from google_sheets_sync import sync_to_mongo, last_sync_status


class SheetsSyncIn(BaseModel):
    mode: Literal["replace", "append"] = "replace"


@api.post("/admin/sheets/sync")
async def sheets_sync(data: SheetsSyncIn, user: dict = Depends(require_roles("admin_enered"))):
    try:
        result = await sync_to_mongo(db, mode=data.mode)
        return result
    except Exception as e:
        logger.exception("Sheets sync error")
        raise HTTPException(status_code=400, detail=f"Error al sincronizar: {str(e)}")


@api.get("/admin/sheets/status")
async def sheets_status(user: dict = Depends(require_roles("admin_enered"))):
    last = await last_sync_status(db)
    return {
        "sheet_id": os.environ.get("GOOGLE_SHEETS_ID"),
        "tab": os.environ.get("GOOGLE_SHEETS_TAB"),
        "service_account": "enered-reader@quick-platform-481116-a9.iam.gserviceaccount.com",
        "last_sync": last,
    }


# ---------- Invoices ----------
@api.get("/invoices")
async def list_invoices(user: dict = Depends(get_current_user), empresa: Optional[str] = None):
    q = {}
    if user["role"] == "admin_enered":
        if empresa:
            q["empresa"] = empresa
    elif user["role"] == "logistica":
        raise HTTPException(status_code=403, detail="Sin acceso a facturación")
    else:
        q["empresa"] = user.get("empresa")
    rows = await db.invoices.find(q, {"_id": 0}).sort([("f_emision", 1), ("fecha_emision", 1), ("n_doc", 1)]).to_list(1000)
    return rows


@api.post("/invoices")
async def create_invoice(data: InvoiceCreate, user: dict = Depends(require_roles("admin_enered"))):
    doc = data.model_dump()
    doc["id"] = str(uuid.uuid4())
    doc["created_at"] = datetime.now(timezone.utc).isoformat()
    await db.invoices.insert_one(doc)
    doc.pop("_id", None)
    return doc


@api.put("/invoices/{inv_id}")
async def update_invoice(inv_id: str, data: InvoiceUpdate,
                         user: dict = Depends(require_roles("admin_enered"))):
    patch = {k: v for k, v in data.model_dump(exclude_unset=True).items() if v is not None}
    res = await db.invoices.update_one({"id": inv_id}, {"$set": patch})
    if res.matched_count == 0:
        raise HTTPException(status_code=404, detail="Factura no encontrada")
    return await db.invoices.find_one({"id": inv_id}, {"_id": 0})


@api.delete("/invoices/{inv_id}")
async def delete_invoice(inv_id: str, user: dict = Depends(get_current_user)):
    inv = await db.invoices.find_one({"id": inv_id})
    if not inv:
        raise HTTPException(status_code=404, detail="Factura no encontrada")
        
    if user["role"] != "admin_enered" and inv.get("empresa") != user.get("empresa"):
        raise HTTPException(status_code=403, detail="Sin permisos para eliminar esta factura")
        
    n_doc = inv.get("n_doc")
    empresa = inv.get("empresa")
    
    await db.invoices.delete_one({"id": inv_id})
    
    if n_doc and empresa:
        await db.consumptions.delete_many({"NUMERO_DOCUMENTO": n_doc, "EMPRESA": empresa})
        await db.consumos_subsidio.delete_many({"numero_documento": n_doc, "empresa": empresa})
        
    return {"ok": True}




@api.post("/admin/invoices/{inv_id}/reassign")
async def admin_invoice_reassign(inv_id: str, empresa: str = Form(...),
                                  user: dict = Depends(require_roles("admin_enered"))):
    """Reasigna una factura existente a otra empresa (corrige matching incorrecto)."""
    res = await db.invoices.update_one({"id": inv_id}, {"$set": {"empresa": empresa}})
    if res.matched_count == 0:
        raise HTTPException(status_code=404, detail="Factura no encontrada")
    return await db.invoices.find_one({"id": inv_id}, {"_id": 0})


# ---------- Control Integral ----------
@api.get("/control-requests")
async def list_control(user: dict = Depends(get_current_user), empresa: Optional[str] = None):
    if user["role"] == "contabilidad":
        raise HTTPException(status_code=403, detail="Sin acceso")
    q = {}
    if user["role"] == "admin_enered":
        if empresa:
            q["empresa"] = empresa
    else:
        q["empresa"] = user.get("empresa")
    rows = await db.control_requests.find(q, {"_id": 0}).sort("created_at", -1).to_list(1000)
    return rows


@api.post("/control-requests")
async def create_control(data: ControlRequestIn, user: dict = Depends(get_current_user)):
    if user["role"] not in ["administrador", "logistica", "admin_enered"]:
        raise HTTPException(status_code=403, detail="Sin permiso")
    doc = {
        "id": str(uuid.uuid4()),
        "empresa": user.get("empresa") if user["role"] != "admin_enered" else "ENERED",
        "solicitante": user["email"],
        "tipo": data.tipo,
        "placa": data.placa,
        "detalle": data.detalle,
        "valor": data.valor,
        "estado": "pendiente",
        "nota": None,
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    await db.control_requests.insert_one(doc)
    doc.pop("_id", None)
    return doc


@api.put("/control-requests/{rid}")
async def update_control(rid: str, data: ControlStatusUpdate,
                         user: dict = Depends(require_roles("admin_enered"))):
    patch = data.model_dump(exclude_unset=True)
    res = await db.control_requests.update_one({"id": rid}, {"$set": patch})
    if res.matched_count == 0:
        raise HTTPException(status_code=404, detail="No encontrado")
    return await db.control_requests.find_one({"id": rid}, {"_id": 0})


# ---------- Courses (LMS) ----------
@api.get("/courses")
async def list_courses(user: dict = Depends(get_current_user)):
    rows = await db.courses.find({}, {"_id": 0}).sort("created_at", -1).to_list(1000)
    return rows


@api.post("/courses")
async def create_course(data: CourseCreate, user: dict = Depends(require_roles("admin_enered"))):
    doc = data.model_dump()
    doc["id"] = str(uuid.uuid4())
    doc["created_at"] = datetime.now(timezone.utc).isoformat()
    await db.courses.insert_one(doc)
    doc.pop("_id", None)
    return doc


@api.delete("/courses/{cid}")
async def delete_course(cid: str, user: dict = Depends(require_roles("admin_enered"))):
    await db.courses.delete_one({"id": cid})
    await db.course_results.delete_many({"course_id": cid})
    return {"ok": True}


@api.post("/courses/{cid}/submit")
async def submit_course(cid: str, data: CourseSubmit, user: dict = Depends(get_current_user)):
    course = await db.courses.find_one({"id": cid}, {"_id": 0})
    if not course:
        raise HTTPException(status_code=404, detail="Curso no encontrado")
    preguntas = course.get("preguntas", [])
    if len(data.respuestas) != len(preguntas):
        raise HTTPException(status_code=400, detail="Cantidad de respuestas incorrecta")
    correct = sum(1 for i, q in enumerate(preguntas) if data.respuestas[i] == q.get("correcta"))
    total = len(preguntas) if preguntas else 1
    puntaje = round((correct / total) * 100, 2)
    aprobado = puntaje >= course.get("puntaje_minimo", 70)
    result = {
        "id": str(uuid.uuid4()),
        "course_id": cid,
        "user_id": user["id"],
        "user_email": user["email"],
        "user_name": user.get("name"),
        "empresa": user.get("empresa"),
        "puntaje": puntaje,
        "aprobado": aprobado,
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    await db.course_results.insert_one(result)
    result.pop("_id", None)
    return result


@api.get("/courses/results/me")
async def my_results(user: dict = Depends(get_current_user)):
    rows = await db.course_results.find({"user_id": user["id"]}, {"_id": 0}).to_list(1000)
    return rows


# ---------- Invoices: Bulk Upload (PDF + XML SUNAT) ----------
import storage  # storage abstraction (local FS or Cloudflare R2)

INV_PREFIX = "invoices"  # storage key prefix


def _inv_key(empresa: str, filename: str) -> str:
    return f"{INV_PREFIX}/{_safe_doc(empresa)}/{filename}"


def _parse_sunat_xml(xml_bytes: bytes) -> dict:
    """Parse SUNAT UBL 2.1 invoice XML. Returns dict with extracted fields."""
    import xml.etree.ElementTree as ET
    ns = {
        "cbc": "urn:oasis:names:specification:ubl:schema:xsd:CommonBasicComponents-2",
        "cac": "urn:oasis:names:specification:ubl:schema:xsd:CommonAggregateComponents-2",
    }
    try:
        root = ET.fromstring(xml_bytes)
    except Exception as e:
        raise ValueError(f"XML inválido: {e}")

    def _find(path):
        el = root.find(path, ns)
        return el.text.strip() if el is not None and el.text else None

    n_doc = _find("cbc:ID")  # ej: F001-123
    f_emision = _find("cbc:IssueDate")
    f_vencimiento = _find("cbc:DueDate")
    moneda = _find("cbc:DocumentCurrencyCode") or "PEN"
    monto = _find("cac:LegalMonetaryTotal/cbc:PayableAmount")

    # Cliente: AccountingCustomerParty
    customer = root.find("cac:AccountingCustomerParty", ns)
    ruc = None
    razon_social = None
    if customer is not None:
        party = customer.find("cac:Party", ns)
        if party is not None:
            id_el = party.find("cac:PartyIdentification/cbc:ID", ns)
            if id_el is not None and id_el.text:
                ruc = id_el.text.strip()
            name_el = party.find("cac:PartyLegalEntity/cbc:RegistrationName", ns)
            if name_el is not None and name_el.text:
                razon_social = name_el.text.strip()

    # Detectar tipo de doc desde InvoiceTypeCode (01=Factura, 03=Boleta, 07=NC, 08=ND)
    tipo_code = _find("cbc:InvoiceTypeCode")
    tipo_doc = {
        "01": "Factura Ventas", "03": "Boleta Ventas",
        "07": "Nota de Crédito", "08": "Nota de Débito",
    }.get(tipo_code or "01", "Factura Ventas")

    # Producto: tomamos primer line item description
    producto = None
    line = root.find("cac:InvoiceLine/cac:Item/cbc:Description", ns)
    if line is not None and line.text:
        producto = line.text.strip()[:120]

    return {
        "n_doc": n_doc,
        "f_emision": f_emision,
        "f_vencimiento": f_vencimiento,
        "moneda": moneda,
        "monto_total": float(monto) if monto else 0.0,
        "ruc_cliente": ruc,
        "razon_social_cliente": razon_social,
        "tipo_doc": tipo_doc,
        "producto": "Comb. Liq. Livianos",
    }


def _safe_doc(name: str) -> str:
    base = name.rsplit(".", 1)[0].strip()
    return "".join(c for c in base if c.isalnum() or c in ("-", "_"))


@api.post("/admin/invoices/upload-bulk")
async def admin_invoices_upload_bulk(
    files: List[UploadFile] = File(...),
    empresa_override: Optional[str] = Form(None),
    estado_override: Optional[str] = Form(None),
    user: dict = Depends(require_roles("admin_enered")),
):
    """Bulk upload pairs of PDF + XML files (or .zip from Odoo containing both).
    Files are matched by basename. Each XML is parsed (SUNAT UBL 2.1) to
    extract invoice metadata. Empresa is matched by RUC against empresas_config.
    If empresa_override is provided, all uploaded invoices are assigned to that
    empresa. If estado_override is one of (pagada/pendiente/vencida), it is
    used as the manual status; otherwise estado is auto-calculated by due date.
    """
    import io, zipfile

    # Separar XMLs (procesar primero) y PDFs (matching posterior)
    xmls: List[tuple] = []   # (filename_base, content, original_name)
    pdfs: dict = {}          # base_normalized -> (content, original_name)

    def _consume(filename: str, content: bytes):
        ext = (filename.rsplit(".", 1)[-1] if "." in filename else "").lower()
        base = _safe_doc(filename)
        # Skip CDR (constancia de recepción SUNAT)
        if filename.upper().startswith("CDR-") or filename.upper().startswith("R-"):
            return
        if ext == "xml":
            xmls.append((base, content, filename))
        elif ext == "pdf":
            pdfs[base.upper()] = (content, filename)

    for f in files:
        ext = (f.filename.rsplit(".", 1)[-1] if "." in f.filename else "").lower()
        content = await f.read()
        if ext == "zip":
            try:
                with zipfile.ZipFile(io.BytesIO(content)) as zf:
                    for zi in zf.infolist():
                        if zi.is_dir():
                            continue
                        inner_name = os.path.basename(zi.filename)
                        if not inner_name:
                            continue
                        _consume(inner_name, zf.read(zi))
            except Exception as e:
                logger.warning(f"ZIP inválido {f.filename}: {e}")
        else:
            _consume(f.filename, content)

    saved: List[dict] = []
    skipped: List[dict] = []

    # Build matching maps from empresas_config
    rucs_to_empresa: dict = {}
    name_to_empresa: dict = {}

    def _clean_name(n: str) -> str:
        """Lowercase, strip punctuation and corporate suffixes for fuzzy match."""
        if not n: return ""
        s = str(n).upper()
        s = "".join(c for c in s if c.isalnum() or c == " ")
        for suf in [" SAC", " S A C", " EIRL", " E I R L", " SA", " S A", " SRL", " S R L"]:
            if s.endswith(suf):
                s = s[: -len(suf)]
        return " ".join(s.split())

    cfgs = await db.empresas_config.find({}, {"_id": 0}).to_list(500)
    for c in cfgs:
        if c.get("ruc"):
            ruc_clean = str(c["ruc"]).strip().lstrip("0")
            rucs_to_empresa[ruc_clean] = c["empresa"]
        if c.get("empresa"):
            name_to_empresa[_clean_name(c["empresa"])] = c["empresa"]

    def _find_pdf_for(base: str, n_doc: str):
        """Try multiple strategies to match a PDF for the given XML."""
        # 1) Exact basename
        if base.upper() in pdfs:
            return pdfs[base.upper()]
        # 2) PDF whose normalized base contains n_doc (or vice versa)
        if n_doc:
            n = _safe_doc(n_doc).upper()
            for k, v in pdfs.items():
                if n and (n in k or k in n):
                    return v
        # 3) If only one XML and one PDF in this batch, pair them
        if len(xmls) == 1 and len(pdfs) == 1:
            return list(pdfs.values())[0]
        return None

    for base, xml_bytes, xml_orig in xmls:
        try:
            meta = _parse_sunat_xml(xml_bytes)
        except Exception as e:
            skipped.append({"base": base, "reason": f"XML no parseable: {e}"})
            continue

        # Resolve empresa: override > RUC match > razón social fuzzy match
        empresa = None
        match_source = "none"
        if empresa_override:
            empresa = empresa_override
            match_source = "override"
        else:
            ruc = (meta.get("ruc_cliente") or "").strip().lstrip("0")
            if ruc and ruc in rucs_to_empresa:
                empresa = rucs_to_empresa[ruc]
                match_source = "ruc"
            else:
                rs_clean = _clean_name(meta.get("razon_social_cliente") or "")
                if rs_clean and rs_clean in name_to_empresa:
                    empresa = name_to_empresa[rs_clean]
                    match_source = "razon_social"
        if not empresa:
            skipped.append({
                "base": base,
                "reason": f"No se encontró empresa para RUC={meta.get('ruc_cliente')!r} / Razón={meta.get('razon_social_cliente')!r}. Configura el RUC en 'Configuración por empresa' o usa el dropdown 'Asignar a empresa'.",
            })
            continue

        # Save files via storage abstraction
        n_doc = meta.get("n_doc") or base
        xml_filename = f"{_safe_doc(n_doc)}.xml"
        xml_key = _inv_key(empresa, xml_filename)
        storage.save_object(xml_key, xml_bytes, "application/xml")

        pdf_filename = None
        pdf_match = _find_pdf_for(base, n_doc)
        if pdf_match:
            pdf_bytes, pdf_orig = pdf_match
            pdf_filename = f"{_safe_doc(n_doc)}.pdf"
            pdf_key = _inv_key(empresa, pdf_filename)
            storage.save_object(pdf_key, pdf_bytes, "application/pdf")

        # Determine status & atraso
        from datetime import date as _date
        today = _date.today()
        f_venc = meta.get("f_vencimiento") or meta.get("f_emision")
        atraso_dias = 0
        # Manual override: pagada / pendiente / vencida
        if estado_override in ("pagada", "pendiente", "vencida"):
            estado = estado_override
            if estado == "vencida" and f_venc:
                try:
                    fv = _date.fromisoformat(f_venc)
                    atraso_dias = max(0, (today - fv).days)
                except Exception:
                    pass
        else:
            # Auto: por fecha de vencimiento
            estado = "pendiente"
            if f_venc:
                try:
                    fv = _date.fromisoformat(f_venc)
                    if fv < today:
                        estado = "vencida"
                        atraso_dias = (today - fv).days
                except Exception:
                    pass

        record = {
            "id": str(uuid.uuid4()),
            "empresa": empresa,
            "ruc_cliente": ruc,
            "razon_social_cliente": meta.get("razon_social_cliente"),
            "n_doc": n_doc,
            "tipo_doc": meta.get("tipo_doc"),
            "producto": meta.get("producto"),
            "f_emision": meta.get("f_emision"),
            "f_vencimiento": f_venc,
            "moneda": meta.get("moneda", "PEN"),
            "monto_total": meta.get("monto_total", 0.0),
            "saldo": meta.get("monto_total", 0.0),
            "estado": estado,  # vencido | por_vencer | pagado
            "atraso_dias": atraso_dias,
            "pdf_filename": pdf_filename,
            "xml_filename": xml_filename,
            "uploaded_at": datetime.now(timezone.utc).isoformat(),
            "uploaded_by": user["email"],
        }
        # Upsert by (empresa, n_doc)
        existing = await db.invoices.find_one({"empresa": empresa, "n_doc": n_doc}, {"_id": 0})
        if existing:
            record["id"] = existing.get("id", record["id"])
            await db.invoices.update_one({"empresa": empresa, "n_doc": n_doc}, {"$set": record})
        else:
            await db.invoices.insert_one(record)

        saved.append({"n_doc": n_doc, "empresa": empresa, "estado": estado, "match": match_source})

    return {"uploaded": len(saved), "saved": saved, "skipped": skipped}


@api.get("/invoices/{inv_id}/download/{kind}")
async def invoice_download(inv_id: str, kind: str, user: dict = Depends(get_current_user)):
    if kind not in ("pdf", "xml"):
        raise HTTPException(status_code=400, detail="kind inválido")
    inv = await db.invoices.find_one({"id": inv_id}, {"_id": 0})
    if not inv:
        raise HTTPException(status_code=404, detail="Factura no encontrada")
    if user["role"] != "admin_enered" and inv.get("empresa") != user.get("empresa"):
        raise HTTPException(status_code=403, detail="Sin acceso")
    fname = inv.get(f"{kind}_filename")
    if not fname:
        raise HTTPException(status_code=404, detail=f"Sin archivo {kind}")
    media = "application/pdf" if kind == "pdf" else "application/xml"
    key = _inv_key(inv["empresa"], fname)
    return storage.download_response(key, fname, media)


@api.get("/account-state")
async def account_state(user: dict = Depends(get_current_user), empresa: Optional[str] = None):
    """Estado de Cuenta agregado por empresa.

    - linea_credito_total: de empresas_config
    - total_facturado: SUM monto_total de todas las invoices
    - facturas_pendientes: SUM saldo donde estado != pagado
    - notas_despacho: SUM IMPORTE_TOTAL de consumptions con facturado != true
    - linea_credito_utilizada: facturas_pendientes + notas_despacho
    - disponible: linea_credito_total - linea_credito_utilizada
    - pct_utilizada: %
    - total_vencido: SUM saldo donde estado == vencido
    """
    if user["role"] == "admin_enered":
        target = empresa
    else:
        target = user.get("empresa")

    cfg = None
    if target:
        cfg = await db.empresas_config.find_one({"empresa": target}, {"_id": 0})
    if not cfg:
        cfg = {"empresa": target or "", "linea_credito": 0.0, "dias_credito": 0, "ruc": ""}

    inv_q = {"empresa": target} if target else {}
    invs = await db.invoices.find(inv_q, {"_id": 0}).to_list(5000)

    # Notas de despacho = consumos NO facturados (ESTADO != "FACTURADO" en el sheet)
    cons_q = {"ESTADO": {"$ne": "FACTURADO"}}
    if target:
        cons_q["EMPRESA"] = target
    elif user["role"] != "admin_enered":
        cons_q["EMPRESA"] = user.get("empresa")
    cons = await db.consumptions.find(cons_q, {"_id": 0, "IMPORTE_TOTAL": 1}).to_list(100000)

    def _f(x, d=0.0):
        try: return float(x) if x not in (None, "") else d
        except Exception: return d

    total_facturado = sum(_f(i.get("monto_total")) for i in invs)
    # Estados nuevos: pagada/pendiente/vencida. Compat con legacy: pagado/por_vencer/vencido.
    PAID = {"pagada", "pagado"}
    OVERDUE = {"vencida", "vencido"}
    facturas_pendientes = sum(_f(i.get("saldo")) for i in invs if (i.get("estado") or "").lower() not in PAID)
    notas_despacho = sum(_f(c.get("IMPORTE_TOTAL")) for c in cons)
    notas_despacho_cnt = len(cons)
    total_vencido = sum(_f(i.get("saldo")) for i in invs if (i.get("estado") or "").lower() in OVERDUE)
    total_pagado = sum(_f(i.get("monto_total")) for i in invs if (i.get("estado") or "").lower() in PAID)

    linea_total = float(cfg.get("linea_credito") or 0)
    linea_utilizada = facturas_pendientes + notas_despacho
    disponible = max(0.0, linea_total - linea_utilizada)
    pct = round((linea_utilizada / linea_total * 100), 2) if linea_total > 0 else 0.0

    return {
        "empresa": cfg.get("empresa") or target or "",
        "ruc": cfg.get("ruc") or "",
        "linea_credito_total": round(linea_total, 2),
        "disponible": round(disponible, 2),
        "linea_credito_utilizada": round(linea_utilizada, 2),
        "facturas_pendientes": round(facturas_pendientes, 2),
        "notas_despacho": round(notas_despacho, 2),
        "notas_despacho_cnt": notas_despacho_cnt,
        "total_facturado": round(total_facturado, 2),
        "total_pagado": round(total_pagado, 2),
        "total_vencido": round(total_vencido, 2),
        "pct_utilizada": pct,
        "dias_credito": int(cfg.get("dias_credito") or 0),
        "n_facturas": len(invs),
    }


# ---------- Security / Training Documents ----------
SEC_PREFIX = "security"


def _sec_key(filename: str) -> str:
    return f"{SEC_PREFIX}/{filename}"


@api.get("/security-docs")
async def list_security_docs(
    q: Optional[str] = None,
    user: dict = Depends(get_current_user),
):
    """List all security/training documents. Available to all authenticated users."""
    query = {}
    if q:
        query["$or"] = [
            {"codigo": {"$regex": q, "$options": "i"}},
            {"nombre": {"$regex": q, "$options": "i"}},
            {"descripcion": {"$regex": q, "$options": "i"}},
        ]
    docs = await db.security_docs.find(query, {"_id": 0}).sort("created_at", -1).to_list(500)
    return docs


@api.post("/admin/security-docs")
async def upload_security_doc(
    nombre: str = Form(...),
    descripcion: str = Form(""),
    file: UploadFile = File(...),
    user: dict = Depends(require_roles("admin_enered")),
):
    """Upload a PDF training document (admin only)."""
    if not file.filename.lower().endswith(".pdf"):
        raise HTTPException(400, "Solo se permiten archivos PDF")

    # Auto-generate código M00001, M00002...
    last = await db.security_docs.find_one({}, sort=[("counter", -1)])
    next_n = (last.get("counter", 0) + 1) if last else 1
    codigo = f"M{next_n:05d}"

    doc_id = str(uuid.uuid4())
    safe_name = "".join(c for c in file.filename if c.isalnum() or c in ("-", "_", "."))
    stored_filename = f"{doc_id}_{safe_name}"
    content = await file.read()
    storage.save_object(_sec_key(stored_filename), content, "application/pdf")

    record = {
        "id": doc_id,
        "counter": next_n,
        "codigo": codigo,
        "nombre": nombre.strip(),
        "descripcion": descripcion.strip(),
        "filename_original": file.filename,
        "filename_stored": stored_filename,
        "size_bytes": len(content),
        "created_at": datetime.now(timezone.utc).isoformat(),
        "updated_at": datetime.now(timezone.utc).isoformat(),
        "uploaded_by": user.get("email"),
    }
    await db.security_docs.insert_one(record)
    return {k: v for k, v in record.items() if k not in ("filename_stored", "counter", "_id")}


@api.get("/security-docs/{doc_id}/download")
async def download_security_doc(
    doc_id: str,
    user: dict = Depends(get_current_user),
):
    record = await db.security_docs.find_one({"id": doc_id})
    if not record:
        raise HTTPException(404, "Documento no encontrado")
    return storage.download_response(
        _sec_key(record["filename_stored"]),
        record["filename_original"],
        "application/pdf",
    )


@api.delete("/admin/security-docs/{doc_id}")
async def delete_security_doc(
    doc_id: str,
    user: dict = Depends(require_roles("admin_enered")),
):
    record = await db.security_docs.find_one({"id": doc_id})
    if not record:
        raise HTTPException(404, "Documento no encontrado")
    storage.delete_object(_sec_key(record["filename_stored"]))
    await db.security_docs.delete_one({"id": doc_id})
    return {"ok": True}


# ---------- QR Code Bulk Upload / Download ----------
QR_PREFIX = "qr"


def _qr_key(empresa: str, filename: str) -> str:
    return f"{QR_PREFIX}/{_safe_placa(empresa)}/{filename}"


def _safe_placa(name: str) -> str:
    """Sanitize placa filename: alphanumeric, dash, underscore only."""
    base = name.rsplit(".", 1)[0].strip().upper()
    return "".join(c for c in base if c.isalnum() or c in ("-", "_"))


@api.post("/admin/qr/upload-bulk")
async def admin_qr_upload_bulk(
    empresa: str = Form(...),
    files: List[UploadFile] = File(...),
    user: dict = Depends(require_roles("admin_enered")),
):
    """Bulk upload QR images. Filename format: [PLACA].png/jpg/etc.
    Each file is associated with the placa (filename without extension)."""
    if not empresa:
        raise HTTPException(status_code=400, detail="empresa es requerida")

    saved: List[dict] = []
    skipped: List[dict] = []

    for f in files:
        try:
            placa = _safe_placa(f.filename)
            if not placa:
                skipped.append({"file": f.filename, "reason": "nombre inválido"})
                continue
            ext = f.filename.rsplit(".", 1)[-1].lower() if "." in f.filename else "png"
            if ext not in ("png", "jpg", "jpeg", "webp", "svg"):
                skipped.append({"file": f.filename, "reason": "extensión no soportada"})
                continue
            content = await f.read()
            if len(content) > 5 * 1024 * 1024:
                skipped.append({"file": f.filename, "reason": "supera 5MB"})
                continue
            target_filename = f"{placa}.{ext}"
            content_type = {
                "png": "image/png", "jpg": "image/jpeg", "jpeg": "image/jpeg",
                "webp": "image/webp", "svg": "image/svg+xml",
            }.get(ext, "application/octet-stream")
            storage.save_object(_qr_key(empresa, target_filename), content, content_type)
            # Upsert in mongo
            await db.qr_codes.update_one(
                {"empresa": empresa, "placa": placa},
                {"$set": {
                    "empresa": empresa,
                    "placa": placa,
                    "filename": target_filename,
                    "uploaded_at": datetime.now(timezone.utc).isoformat(),
                    "uploaded_by": user["email"],
                }},
                upsert=True,
            )
            saved.append({"placa": placa, "file": target_filename})
        except Exception as e:
            skipped.append({"file": f.filename, "reason": str(e)})

    return {"uploaded": len(saved), "saved": saved, "skipped": skipped}


@api.get("/qr/list")
async def qr_list(user: dict = Depends(get_current_user), empresa: Optional[str] = None):
    """List QR codes available to current user (filtered by empresa for non-admin)."""
    q: dict = {}
    if user["role"] != "admin_enered":
        q["empresa"] = user.get("empresa")
    elif empresa:
        q["empresa"] = empresa
    rows = await db.qr_codes.find(q, {"_id": 0}).sort("placa", 1).to_list(2000)
    return rows


@api.get("/qr/download/{placa}")
async def qr_download(placa: str, user: dict = Depends(get_current_user), empresa: Optional[str] = None):
    """Download QR for a specific placa. Validates empresa for non-admin users."""
    placa = _safe_placa(placa)
    target_empresa = empresa if user["role"] == "admin_enered" else user.get("empresa")
    if not target_empresa:
        raise HTTPException(status_code=400, detail="empresa requerida")
    record = await db.qr_codes.find_one({"empresa": target_empresa, "placa": placa}, {"_id": 0})
    if not record:
        raise HTTPException(status_code=404, detail="QR no encontrado")
    fname = record["filename"]
    ext = fname.rsplit(".", 1)[-1].lower() if "." in fname else "png"
    media = {
        "png": "image/png", "jpg": "image/jpeg", "jpeg": "image/jpeg",
        "webp": "image/webp", "svg": "image/svg+xml",
    }.get(ext, "application/octet-stream")
    return storage.download_response(
        _qr_key(target_empresa, fname),
        f"QR_{placa}.{ext}",
        media,
    )


@api.delete("/admin/qr/{placa}")
async def admin_qr_delete(placa: str, empresa: str, user: dict = Depends(require_roles("admin_enered"))):
    placa = _safe_placa(placa)
    record = await db.qr_codes.find_one({"empresa": empresa, "placa": placa}, {"_id": 0})
    if not record:
        raise HTTPException(status_code=404, detail="QR no encontrado")
    storage.delete_object(_qr_key(empresa, record["filename"]))
    await db.qr_codes.delete_one({"empresa": empresa, "placa": placa})
    return {"ok": True}


# ---------- Root ----------
@api.get("/")
async def root():
    return {"service": "ENERED API", "status": "ok"}


@api.get("/health")
async def health():
    """Diagnostic endpoint for production monitoring."""
    try:
        await db.command("ping")
        mongo_ok = True
    except Exception as e:
        mongo_ok = False
    return {
        "status": "ok" if mongo_ok else "degraded",
        "mongo": "ok" if mongo_ok else "fail",
        "storage_backend": storage.current_backend(),
        "version": "1.0.0",
    }

# ============================================================
# INFRACCIONES - Vehículos, Conductores y Infracciones
# ============================================================

# --- MODELS ---
class VehiculoCreate(BaseModel):
    placa: str = Field(min_length=6, max_length=8)
    marca: Optional[str] = None
    modelo: Optional[str] = None
    año: Optional[int] = None
    chasis: Optional[str] = None
    estado: Optional[str] = "OPERATIVO"
    unidad: Optional[str] = None
    tipo: Optional[str] = None
    base: Optional[str] = None
    titular: Optional[str] = None
    cc: Optional[str] = None
    conductor_principal_id: Optional[str] = None
    empresa: Optional[str] = None
    kilometraje: Optional[int] = None

class VehiculoUpdate(BaseModel):
    placa: Optional[str] = None
    marca: Optional[str] = None
    modelo: Optional[str] = None
    año: Optional[int] = None
    chasis: Optional[str] = None
    estado: Optional[str] = None
    unidad: Optional[str] = None
    tipo: Optional[str] = None
    base: Optional[str] = None
    titular: Optional[str] = None
    cc: Optional[str] = None
    conductor_principal_id: Optional[str] = None
    kilometraje: Optional[int] = None

class ConductorCreate(BaseModel):
    dni: str = Field(min_length=8, max_length=8)
    nombre: str
    apellidos: str
    licencia: Optional[str] = None
    vencimiento_licencia: Optional[str] = None
    telefono: Optional[str] = None
    email: Optional[EmailStr] = None
    empresa: Optional[str] = None

class ConductorUpdate(BaseModel):
    nombre: Optional[str] = None
    apellidos: Optional[str] = None
    licencia: Optional[str] = None
    vencimiento_licencia: Optional[str] = None
    telefono: Optional[str] = None
    email: Optional[EmailStr] = None

class InfraccionCreate(BaseModel):
    vehiculo_id: str
    conductor_id: Optional[str] = None
    fecha: str
    codigo: str
    descripcion: str
    monto: float
    estado: Literal["pendiente", "pagada", "impugnada", "anulada"] = "pendiente"
    lugar: Optional[str] = None
    papeleta: Optional[str] = None
    observaciones: Optional[str] = None
    empresa: Optional[str] = None

class InfraccionUpdate(BaseModel):
    estado: Optional[Literal["pendiente", "pagada", "impugnada", "anulada"]] = None
    monto: Optional[float] = None
    observaciones: Optional[str] = None

# --- VEHICULOS ENDPOINTS ---
@api.get("/vehiculos/consulta-sunarp/{placa}")
async def consulta_sunarp_placa(req: Request, placa: str):
    await require_auth(req)
    placa_clean = placa.replace("-", "").upper()
    if not placa_clean:
        raise HTTPException(400, "Placa no válida")
        
    token = "tr_6e6e5d380db1da4432d0c3e57851396a"
    url = f"https://api2.consultadatos.com/api/placa/leyenda/{placa_clean}"
    
    import urllib.request
    import json
    import ssl
    import asyncio
    
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
            
            titular = ""
            if props:
                titular = props[0].get("propietario", "")
            
            año = None
            try:
                año_str = v.get("ano_fab") or v.get("an_mode")
                if año_str:
                    año = int(año_str)
            except:
                pass
                
            return {
                "placa": v.get("num_placa", placa_clean),
                "marca": v.get("marca", ""),
                "modelo": v.get("modelo", ""),
                "chasis": v.get("no_vin") or v.get("num_serie", ""),
                "año": año,
                "titular": titular,
                "tipo": v.get("desc_tipo_carr", "")
            }
        else:
            msg = res_data.get("message", "No se encontró información para esta placa")
            raise HTTPException(404, msg)
    except urllib.error.HTTPError as e:
        try:
            err_body = e.read().decode('utf-8')
            err_json = json.loads(err_body)
            err_msg = err_json.get("message", "Error consultando SUNARP")
        except:
            err_msg = "Error consultando SUNARP"
        raise HTTPException(e.code, f"{err_msg} (HTTP {e.code})")
    except Exception as e:
        raise HTTPException(500, f"Error de servidor: {str(e)}")

@api.get("/vehiculos")
async def list_vehiculos(req: Request):
    u = await require_auth(req)
    filt = {}
    if u["role"] != "admin_enered" and u.get("empresa"):
        filt["empresa"] = u["empresa"]
    
    cursor = db.vehiculos.find(filt)
    vehiculos = []
    async for v in cursor:
        v["_id"] = str(v["_id"])
        vehiculos.append(v)
    return vehiculos

@api.post("/vehiculos")
async def create_vehiculo(req: Request, body: VehiculoCreate):
    u = await require_auth(req)
    
    # Validar placa única
    existing = await db.vehiculos.find_one({"placa": body.placa.upper()})
    if existing:
        raise HTTPException(400, f"La placa {body.placa} ya existe")
    
    doc = {
        "id": str(uuid.uuid4()),
        "placa": body.placa.upper(),
        "marca": body.marca,
        "modelo": body.modelo,
        "año": body.año,
        "chasis": body.chasis,
        "estado": body.estado or "OPERATIVO",
        "unidad": body.unidad,
        "tipo": body.tipo,
        "base": body.base,
        "titular": body.titular,
        "cc": body.cc,
        "conductor_principal_id": body.conductor_principal_id,
        "empresa": body.empresa or u.get("empresa"),
        "kilometraje": body.kilometraje,
        "created_at": datetime.now(timezone.utc).isoformat(),
        "created_by": u["id"],
    }
    await db.vehiculos.insert_one(doc)
    doc.pop("_id", None)
    return doc

@api.put("/vehiculos/{vehiculo_id}")
async def update_vehiculo(req: Request, vehiculo_id: str, body: VehiculoUpdate):
    u = await require_auth(req)
    
    v = await db.vehiculos.find_one({"id": vehiculo_id})
    if not v:
        raise HTTPException(404, "Vehículo no encontrado")
    
    updates = {k: v for k, v in body.dict(exclude_unset=True).items() if v is not None}
    if updates:
        updates["updated_at"] = datetime.now(timezone.utc).isoformat()
        await db.vehiculos.update_one({"id": vehiculo_id}, {"$set": updates})
    
    updated = await db.vehiculos.find_one({"id": vehiculo_id})
    updated.pop("_id")
    return updated

@api.delete("/vehiculos/{vehiculo_id}")
async def delete_vehiculo(req: Request, vehiculo_id: str):
    u = await require_auth(req)
    
    v = await db.vehiculos.find_one({"id": vehiculo_id})
    if not v:
        raise HTTPException(404, "Vehículo no encontrado")
    
    await db.vehiculos.delete_one({"id": vehiculo_id})
    return {"ok": True}

# --- CONDUCTORES ENDPOINTS ---
@api.get("/conductores")
async def list_conductores(req: Request):
    u = await require_auth(req)
    filt = {}
    if u["role"] != "admin_enered" and u.get("empresa"):
        filt["empresa"] = u["empresa"]
    
    cursor = db.conductores.find(filt)
    conductores = []
    async for c in cursor:
        c["_id"] = str(c["_id"])
        conductores.append(c)
    return conductores

@api.post("/conductores")
async def create_conductor(req: Request, body: ConductorCreate):
    u = await require_auth(req)
    if u["role"] not in ["admin_enered", "administrador"]:
        raise HTTPException(403, "Solo administradores pueden crear conductores")
    
    # Validar DNI único
    existing = await db.conductores.find_one({"dni": body.dni})
    if existing:
        raise HTTPException(400, f"El DNI {body.dni} ya existe")
    
    doc = {
        "id": str(uuid.uuid4()),
        "dni": body.dni,
        "nombre": body.nombre,
        "apellidos": body.apellidos,
        "licencia": body.licencia,
        "vencimiento_licencia": body.vencimiento_licencia,
        "telefono": body.telefono,
        "email": body.email,
        "empresa": body.empresa or u.get("empresa"),
        "created_at": datetime.now(timezone.utc).isoformat(),
        "created_by": u["id"],
    }
    await db.conductores.insert_one(doc)
    doc.pop("_id")
    return doc

@api.put("/conductores/{conductor_id}")
async def update_conductor(req: Request, conductor_id: str, body: ConductorUpdate):
    u = await require_auth(req)
    if u["role"] not in ["admin_enered", "administrador"]:
        raise HTTPException(403, "Solo administradores pueden editar conductores")
    
    c = await db.conductores.find_one({"id": conductor_id})
    if not c:
        raise HTTPException(404, "Conductor no encontrado")
    
    if u["role"] != "admin_enered" and c.get("empresa") != u.get("empresa"):
        raise HTTPException(403, "No tienes acceso a este conductor")
    
    updates = {k: v for k, v in body.dict().items() if v is not None}
    if updates:
        updates["updated_at"] = datetime.now(timezone.utc).isoformat()
        await db.conductores.update_one({"id": conductor_id}, {"$set": updates})
    
    updated = await db.conductores.find_one({"id": conductor_id})
    updated.pop("_id")
    return updated

@api.delete("/conductores/{conductor_id}")
async def delete_conductor(req: Request, conductor_id: str):
    u = await require_auth(req)
    if u["role"] not in ["admin_enered", "administrador"]:
        raise HTTPException(403, "Solo administradores pueden eliminar conductores")
    
    c = await db.conductores.find_one({"id": conductor_id})
    if not c:
        raise HTTPException(404, "Conductor no encontrado")
    
    if u["role"] != "admin_enered" and c.get("empresa") != u.get("empresa"):
        raise HTTPException(403, "No tienes acceso a este conductor")
    
    await db.conductores.delete_one({"id": conductor_id})
    return {"ok": True}

# --- INFRACCIONES ENDPOINTS ---
@api.get("/infracciones")
async def list_infracciones(req: Request):
    u = await require_auth(req)
    filt = {}
    if u["role"] != "admin_enered" and u.get("empresa"):
        filt["empresa"] = u["empresa"]
    
    cursor = db.infracciones.find(filt).sort("fecha", -1)
    infracciones = []
    async for i in cursor:
        i["_id"] = str(i["_id"])
        # Obtener datos del vehículo
        if i.get("vehiculo_id"):
            vehiculo = await db.vehiculos.find_one({"id": i["vehiculo_id"]})
            if vehiculo:
                i["vehiculo_placa"] = vehiculo.get("placa")
        # Obtener datos del conductor
        if i.get("conductor_id"):
            conductor = await db.conductores.find_one({"id": i["conductor_id"]})
            if conductor:
                i["conductor_nombre"] = f"{conductor.get('nombre')} {conductor.get('apellidos')}"
        infracciones.append(i)
    return infracciones

@api.post("/infracciones")
async def create_infraccion(req: Request, body: InfraccionCreate):
    u = await require_auth(req)
    if u["role"] not in ["admin_enered", "administrador"]:
        raise HTTPException(403, "Solo administradores pueden registrar infracciones")
    
    # Validar que el vehículo existe
    vehiculo = await db.vehiculos.find_one({"id": body.vehiculo_id})
    if not vehiculo:
        raise HTTPException(404, "Vehículo no encontrado")
    
    # Validar que el conductor existe (si se proporciona)
    if body.conductor_id:
        conductor = await db.conductores.find_one({"id": body.conductor_id})
        if not conductor:
            raise HTTPException(404, "Conductor no encontrado")
    
    doc = {
        "id": str(uuid.uuid4()),
        "vehiculo_id": body.vehiculo_id,
        "conductor_id": body.conductor_id,
        "fecha": body.fecha,
        "codigo": body.codigo,
        "descripcion": body.descripcion,
        "monto": body.monto,
        "estado": body.estado,
        "lugar": body.lugar,
        "papeleta": body.papeleta,
        "observaciones": body.observaciones,
        "empresa": body.empresa or u.get("empresa") or vehiculo.get("empresa"),
        "created_at": datetime.now(timezone.utc).isoformat(),
        "created_by": u["id"],
    }
    await db.infracciones.insert_one(doc)
    doc.pop("_id")
    return doc

@api.put("/infracciones/{infraccion_id}")
async def update_infraccion(req: Request, infraccion_id: str, body: InfraccionUpdate):
    u = await require_auth(req)
    if u["role"] not in ["admin_enered", "administrador"]:
        raise HTTPException(403, "Solo administradores pueden editar infracciones")
    
    i = await db.infracciones.find_one({"id": infraccion_id})
    if not i:
        raise HTTPException(404, "Infracción no encontrada")
    
    if u["role"] != "admin_enered" and i.get("empresa") != u.get("empresa"):
        raise HTTPException(403, "No tienes acceso a esta infracción")
    
    updates = {k: v for k, v in body.dict().items() if v is not None}
    if updates:
        updates["updated_at"] = datetime.now(timezone.utc).isoformat()
        await db.infracciones.update_one({"id": infraccion_id}, {"$set": updates})
    
    updated = await db.infracciones.find_one({"id": infraccion_id})
    updated.pop("_id")
    return updated

@api.delete("/infracciones/{infraccion_id}")
async def delete_infraccion(req: Request, infraccion_id: str):
    u = await require_auth(req)
    if u["role"] not in ["admin_enered", "administrador"]:
        raise HTTPException(403, "Solo administradores pueden eliminar infracciones")
    
    i = await db.infracciones.find_one({"id": infraccion_id})
    if not i:
        raise HTTPException(404, "Infracción no encontrada")
    
    if u["role"] != "admin_enered" and i.get("empresa") != u.get("empresa"):
        raise HTTPException(403, "No tienes acceso a esta infracción")
    
    await db.infracciones.delete_one({"id": infraccion_id})
    return {"ok": True}

# --- DASHBOARD INFRACCIONES ---
@api.get("/infracciones/dashboard/stats")
async def infracciones_dashboard(req: Request):
    u = await require_auth(req)
    filt = {}
    if u["role"] != "admin_enered" and u.get("empresa"):
        filt["empresa"] = u["empresa"]
    
    # Total infracciones
    total = await db.infracciones.count_documents(filt)
    
    # Por estado
    pendientes = await db.infracciones.count_documents({**filt, "estado": "pendiente"})
    pagadas = await db.infracciones.count_documents({**filt, "estado": "pagada"})
    impugnadas = await db.infracciones.count_documents({**filt, "estado": "impugnada"})
    
    # Monto total pendiente
    cursor_pendiente = db.infracciones.find({**filt, "estado": "pendiente"})
    monto_pendiente = 0
    async for inf in cursor_pendiente:
        monto_pendiente += inf.get("monto", 0)
    
    # Monto total pagado
    cursor_pagada = db.infracciones.find({**filt, "estado": "pagada"})
    monto_pagado = 0
    async for inf in cursor_pagada:
        monto_pagado += inf.get("monto", 0)
    
    return {
        "total": total,
        "pendientes": pendientes,
        "pagadas": pagadas,
        "impugnadas": impugnadas,
        "monto_pendiente": monto_pendiente,
        "monto_pagado": monto_pagado,
    }


# ---------- Wialon: SID on-demand para iframe embed ----------
@api.get("/wialon/sid")
async def get_wialon_sid(empresa: Optional[str] = None, user: dict = Depends(get_current_user)):
    """
    Genera un session_id (sid) fresco de Wialon usando el token guardado.
    - Usuario cliente: usa el token de SU empresa (ignora ?empresa=).
    - admin_enered: debe pasar ?empresa=NOMBRE para elegir qué cliente monitorear.
    """
    if user.get("role") == "admin_enered":
        if not empresa:
            raise HTTPException(status_code=400, detail="admin_enered debe indicar ?empresa=<nombre>")
        target_empresa = empresa
    else:
        target_empresa = user.get("empresa")
        if not target_empresa:
            raise HTTPException(status_code=400, detail="Usuario sin empresa asociada")
    info = await _svc.get_empresa_servicios(db, target_empresa)
    if not info["servicios"].get("gps"):
        raise HTTPException(status_code=403, detail=f"Servicio GPS no habilitado para {target_empresa}")
    cfg = await _svc.get_empresa_wialon_config(db, target_empresa)
    if not cfg:
        raise HTTPException(status_code=404, detail="Token Wialon no configurado. Contacta al administrador de ENERED.")
    result = await _svc.test_wialon_connection(cfg["token"], cfg["host"])
    if not result.get("ok"):
        raise HTTPException(status_code=502, detail=f"Wialon rechazó el token: {result.get('error')}")
    import json as _json, httpx as _httpx
    host = cfg["host"]
    base = f"https://{host}/wialon/ajax.html"
    async with _httpx.AsyncClient(timeout=10.0) as client:
        r = await client.get(base, params={"svc": "token/login", "params": _json.dumps({"token": cfg["token"]})})
        data = r.json()
        sid = data.get("eid") if isinstance(data, dict) else None
    if not sid:
        raise HTTPException(status_code=502, detail="No se pudo generar sesión Wialon")
    api_base = (result.get("base_url") or f"https://{host}").rstrip("/")
    ui_base = api_base.replace("hst-api.", "hosting.").replace("http://", "https://")
    return {
        "empresa": target_empresa,
        "sid": sid,
        "host": host,
        "base_url": ui_base,
        "iframe_url": f"{ui_base}/?sid={sid}&lang=es",
        "total_unidades": result.get("total_unidades", 0),
        "user": result.get("user", ""),
    }


# ---------- Wialon: listar empresas con GPS configurado (para selector admin) ----------
@api.get("/wialon/empresas")
async def list_empresas_with_wialon(user: dict = Depends(require_roles("admin_enered"))):
    """Lista empresas con servicios.gps=true Y token Wialon guardado — usado por selector de admin."""
    out = []
    async for cfg in db.empresas_config.find({}, {"_id": 0}):
        serv = _svc._normalize_servicios(cfg.get("servicios"))
        if serv.get("gps") and (cfg.get("wialon") or {}).get("token"):
            out.append({"empresa": cfg["empresa"], "tipo_cliente": cfg.get("tipo_cliente", "enered")})
    return out


# ---------- Wialon: obtener unidades con última posición (reemplaza iframe bloqueado por X-Frame) ----------
@api.get("/wialon/units")
async def get_wialon_units(empresa: Optional[str] = None, user: dict = Depends(get_current_user)):
    """
    Retorna lista de unidades con última posición conocida.
    Cliente: usa su propia empresa. admin_enered: debe pasar ?empresa=X.
    """
    if user.get("role") == "admin_enered":
        if not empresa:
            raise HTTPException(status_code=400, detail="admin_enered debe indicar ?empresa=<nombre>")
        target_empresa = empresa
    else:
        target_empresa = user.get("empresa")
        if not target_empresa:
            raise HTTPException(status_code=400, detail="Usuario sin empresa asociada")
    info = await _svc.get_empresa_servicios(db, target_empresa)
    if not info["servicios"].get("gps"):
        raise HTTPException(status_code=403, detail=f"Servicio GPS no habilitado para {target_empresa}")
    cfg = await _svc.get_empresa_wialon_config(db, target_empresa)
    if not cfg:
        raise HTTPException(status_code=404, detail="Token Wialon no configurado")
    import json as _json, httpx as _httpx
    host = cfg["host"]
    base = f"https://{host}/wialon/ajax.html"
    async with _httpx.AsyncClient(timeout=15.0) as client:
        # 1) Login
        r = await client.get(base, params={"svc": "token/login", "params": _json.dumps({"token": cfg["token"]})})
        d = r.json()
        if not isinstance(d, dict) or "eid" not in d:
            raise HTTPException(status_code=502, detail=f"Login Wialon falló: {d.get('error') if isinstance(d,dict) else 'unknown'}")
        sid = d["eid"]
        # 2) search_items con flag para position (1025 = base + last msg + position)
        # flag 1 sys, 8 unit_prop_lastPos, 256 measure, 1024 lastMsg → suma 1289
        search_params = {
            "spec": {"itemsType":"avl_unit","propName":"sys_name","propValueMask":"*","sortType":"sys_name","propType":"property"},
            "force": 1, "flags": 1025, "from": 0, "to": 500,
        }
        r2 = await client.get(base, params={"svc":"core/search_items", "params": _json.dumps(search_params), "sid": sid})
        d2 = r2.json()
    units = []
    for u in (d2.get("items") or []):
        pos = u.get("pos") or {}
        lmsg = u.get("lmsg") or {}
        units.append({
            "id": u.get("id"),
            "name": u.get("nm") or "",
            "lat": pos.get("y"),
            "lon": pos.get("x"),
            "speed": pos.get("s"),
            "course": pos.get("c"),
            "timestamp": pos.get("t") or lmsg.get("t"),
            "sat_count": pos.get("sc"),
        })
    # Bounding box (para el mapa)
    lats = [u["lat"] for u in units if u.get("lat") is not None]
    lons = [u["lon"] for u in units if u.get("lon") is not None]
    bbox = None
    if lats and lons:
        # padding
        pad = 0.02
        bbox = {
            "min_lat": min(lats) - pad, "max_lat": max(lats) + pad,
            "min_lon": min(lons) - pad, "max_lon": max(lons) + pad,
        }
    return {"empresa": target_empresa, "total": len(units), "units": units, "bbox": bbox}


# ---------- Admin: eliminar empresa con cascada ----------
@api.delete("/admin/empresas/{empresa}")
async def delete_empresa(empresa: str, user: dict = Depends(require_roles("admin_enered"))):
    """
    Elimina una empresa y TODOS los datos asociados en cascada:
    - empresas_config
    - users (usuarios de esa empresa)
    - consumptions (facturas de combustible)
    - invoices (facturación)
    - qr_codes
    - subsidio_vehicles, subsidio_documents, subsidio_bank_accounts, subsidio_declaraciones
    - consumos_subsidio (a través de sus user_ids)
    Retorna el conteo de documentos eliminados por colección.
    """
    if not empresa:
        raise HTTPException(status_code=400, detail="Nombre de empresa vacío")
    # Obtener ids de usuarios para cascada de subsidio
    user_ids = [u["id"] async for u in db.users.find({"empresa": empresa}, {"_id": 0, "id": 1})]
    counts = {}
    r = await db.empresas_config.delete_many({"empresa": empresa}); counts["empresas_config"] = r.deleted_count
    r = await db.users.delete_many({"empresa": empresa}); counts["users"] = r.deleted_count
    r = await db.consumptions.delete_many({"EMPRESA": empresa}); counts["consumptions"] = r.deleted_count
    r = await db.invoices.delete_many({"empresa": empresa}); counts["invoices"] = r.deleted_count
    r = await db.qr_codes.delete_many({"empresa": empresa}); counts["qr_codes"] = r.deleted_count
    if user_ids:
        for coll in ["subsidio_vehicles", "subsidio_documents", "subsidio_bank_accounts", "subsidio_declaraciones", "consumos_subsidio", "subsidio_leads"]:
            r = await db[coll].delete_many({"user_id": {"$in": user_ids}})
            counts[coll] = r.deleted_count
    return {"ok": True, "empresa": empresa, "deleted": counts}


app.include_router(api)

# ============================================================================
# SUBSIDIO MODULE (DU 004-2026) — añadido sin tocar lo anterior
# ============================================================================
from subsidio import subsidio_router, _set_db as _set_subsidio_db
_set_subsidio_db(db)
app.include_router(subsidio_router)


# CORS — supports comma-separated CORS_ORIGINS, plus FRONTEND_URL for backwards-compat
_origins_env = os.environ.get("CORS_ORIGINS", "")
_frontend = os.environ.get("FRONTEND_URL", "http://localhost:3000")
_allow_origins: list[str] = []
if _origins_env:
    _allow_origins.extend([o.strip() for o in _origins_env.split(",") if o.strip()])
if _frontend and _frontend not in _allow_origins:
    _allow_origins.append(_frontend)
if "http://localhost:3000" not in _allow_origins:
    _allow_origins.append("http://localhost:3000")

# Optionally allow regex match for Netlify preview deploys, e.g.
# CORS_ORIGIN_REGEX="https://.*--enered\.netlify\.app"
_cors_regex = os.environ.get("CORS_ORIGIN_REGEX")

app.add_middleware(
    CORSMiddleware,
    allow_origins=_allow_origins,
    allow_origin_regex=_cors_regex,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
logger.info(f"CORS allow_origins={_allow_origins} regex={_cors_regex!r}")


# ---------- Seed ----------
SAMPLE_COMPANIES = ["TRANSPORTES LIMA SAC", "LOGISTICA ANDINA SA", "CARGO PERU EIRL"]
SAMPLE_CITIES = ["LIMA", "AREQUIPA", "TRUJILLO", "CUSCO", "CHICLAYO"]
SAMPLE_STATIONS = ["PRIMAX SAN ISIDRO", "PRIMAX MIRAFLORES", "PRIMAX AREQUIPA", "PRIMAX TRUJILLO", "PRIMAX NORTE", "PRIMAX SUR"]
SAMPLE_PRODUCTS = ["DIESEL B5", "DIESEL DB5 S-50", "GASOLINA 90", "GASOLINA 95"]


async def seed_demo_data():
    # Users
    admin_email = os.environ.get("ADMIN_EMAIL", "admin@enered.com")
    admin_password = os.environ.get("ADMIN_PASSWORD", "admin123")

    if not await db.users.find_one({"email": admin_email}):
        await db.users.insert_one({
            "id": str(uuid.uuid4()),
            "email": admin_email,
            "name": "Admin ENERED",
            "role": "admin_enered",
            "empresa": None,
            "password_hash": hash_password(admin_password),
            "created_at": datetime.now(timezone.utc).isoformat(),
        })

    demo_users = [
        ("administrador@lima.com", "demo123", "Administrador Lima", "administrador", "TRANSPORTES LIMA SAC"),
        ("logistica@lima.com", "demo123", "Logística Lima", "logistica", "TRANSPORTES LIMA SAC"),
        ("contabilidad@lima.com", "demo123", "Contabilidad Lima", "contabilidad", "TRANSPORTES LIMA SAC"),
        ("administrador@andina.com", "demo123", "Administrador Andina", "administrador", "LOGISTICA ANDINA SA"),
        ("administrador@cargo.com", "demo123", "Administrador Cargo", "administrador", "CARGO PERU EIRL"),
    ]
    for email, pwd, name, role, empresa in demo_users:
        if not await db.users.find_one({"email": email}):
            await db.users.insert_one({
                "id": str(uuid.uuid4()),
                "email": email,
                "name": name,
                "role": role,
                "empresa": empresa,
                "password_hash": hash_password(pwd),
                "created_at": datetime.now(timezone.utc).isoformat(),
            })

    # Consumptions - only if empty
    existing_count = await db.consumptions.count_documents({})
    if existing_count == 0:
        random.seed(42)
        rows = []
        today = datetime.now(timezone.utc).date()
        for empresa in SAMPLE_COMPANIES:
            placas = [f"{random.choice(['A','B','T','P','V'])}{random.randint(1,9)}{random.choice(['A','B','C'])}-{random.randint(100,999)}"
                      for _ in range(random.randint(6, 10))]
            for days_back in range(60):
                date = today - timedelta(days=days_back)
                week_num = date.isocalendar().week
                for _ in range(random.randint(1, 4)):
                    placa = random.choice(placas)
                    ciudad = random.choice(SAMPLE_CITIES)
                    estacion = random.choice(SAMPLE_STATIONS)
                    producto = random.choice(SAMPLE_PRODUCTS)
                    cantidad = round(random.uniform(8, 35), 2)
                    precio_pizarra = round(random.uniform(14.5, 17.2), 2)
                    descuento = round(random.uniform(0.4, 1.2), 2)
                    precio_unit = round(precio_pizarra - descuento, 2)
                    importe = round(cantidad * precio_unit, 2)
                    ahorro = round(cantidad * descuento, 2)
                    rows.append({
                        "id": str(uuid.uuid4()),
                        "FECHA": date.isoformat(),
                        "HORA": f"{random.randint(6,20):02d}:{random.randint(0,59):02d}",
                        "CIUDAD": ciudad,
                        "ESTACION": estacion,
                        "NRO_DE_TARJETA": f"TAR{random.randint(10000,99999)}",
                        "PLACA": placa,
                        "PRODUCTO": producto,
                        "UNIDAD": "GALON",
                        "CANTIDAD_GL": cantidad,
                        "PRECIO_UNITARIO": precio_unit,
                        "IMPORTE_TOTAL": importe,
                        "PRECIO_PIZARRA": precio_pizarra,
                        "AHORRO": ahorro,
                        "NOTA_DE_DESPACHO": f"ND{random.randint(100000,999999)}",
                        "EMPRESA": empresa,
                        "KILOMETRAJE": random.randint(1000, 250000),
                        "MEDIO_DE_IDENTIFICACION": random.choice(["TARJETA", "APP", "QR"]),
                        "SEMANA": f"2026-W{week_num:02d}",
                    })
        if rows:
            await db.consumptions.insert_many(rows)
            logger.info(f"Seeded {len(rows)} consumption rows")

    # Invoices
    if await db.invoices.count_documents({}) == 0:
        invoices = []
        for empresa in SAMPLE_COMPANIES:
            for i in range(3):
                fecha = (datetime.now(timezone.utc).date() - timedelta(days=30 * i)).isoformat()
                venc = (datetime.now(timezone.utc).date() - timedelta(days=30 * i - 15)).isoformat()
                invoices.append({
                    "id": str(uuid.uuid4()),
                    "empresa": empresa,
                    "numero": f"F001-{random.randint(1000,9999)}",
                    "fecha_emision": fecha,
                    "fecha_vencimiento": venc,
                    "monto": round(random.uniform(5000, 35000), 2),
                    "estado": random.choice(["pendiente", "pagada", "vencida"]),
                    "pdf_url": None,
                    "created_at": datetime.now(timezone.utc).isoformat(),
                })
        if invoices:
            await db.invoices.insert_many(invoices)

    # Courses
    if await db.courses.count_documents({}) == 0:
        await db.courses.insert_one({
            "id": str(uuid.uuid4()),
            "titulo": "Conducción Eficiente y Ahorro de Combustible",
            "descripcion": "Aprende las mejores prácticas para reducir el consumo de combustible y mejorar la eficiencia de tu flota.",
            "video_url": "https://www.youtube.com/embed/dQw4w9WgXcQ",
            "pdf_url": None,
            "puntaje_minimo": 70,
            "preguntas": [
                {"pregunta": "¿Cuál es la velocidad óptima para ahorrar combustible?", "opciones": ["60-80 km/h", "100-120 km/h", "Mayor a 120 km/h"], "correcta": 0},
                {"pregunta": "¿Qué hábito reduce más el consumo?", "opciones": ["Aceleraciones bruscas", "Conducción suave", "Frenados fuertes"], "correcta": 1},
                {"pregunta": "¿Es recomendable mantener presión correcta en neumáticos?", "opciones": ["Sí", "No", "Solo en invierno"], "correcta": 0},
            ],
            "created_at": datetime.now(timezone.utc).isoformat(),
        })

    # Empresa configs (plan, RUC, línea de crédito, unidades)
    empresa_defaults = []
    for empresa, ruc, plan, linea, unidades in empresa_defaults:
        if not await db.empresas_config.find_one({"empresa": empresa}):
            await db.empresas_config.insert_one({
                "id": str(uuid.uuid4()),
                "empresa": empresa,
                "ruc": ruc,
                "plan": plan,
                "linea_credito": linea,
                "unidades_contratadas": unidades,
                "created_at": datetime.now(timezone.utc).isoformat(),
                "updated_at": datetime.now(timezone.utc).isoformat(),
            })




# ─── DOCUMENTACION MODULE ENDPOINTS ───

SUB_CAT_MAP = {
    "ficha_ruc": ("Empresa", "Ficha RUC"),
    "resolucion_autorizacion": ("Empresa", "Resolución de autorización"),
    "dni_representante": ("Empresa", "DNI del representante"),
    "tarjeta_propiedad": ("Vehículos", "Tarjeta de propiedad"),
    "tarjeta_habilitacion": ("Vehículos", "Tarjeta de habilitación"),
    "tarjeta_circulacion": ("Vehículos", "Tarjeta de circulación"),
    "soat": ("Vehículos", "SOAT"),
    "revision_tecnica": ("Vehículos", "Revisión Técnica"),
}

@api.get("/documents")
async def list_documents(
    user: dict = Depends(get_current_user),
    empresa: Optional[str] = None,
):
    # Multi-tenant isolation
    if user["role"] == "admin_enered":
        target_empresa = empresa or None
    else:
        target_empresa = user.get("empresa")

    # Fetch manual documents from db.documents
    doc_q = {}
    if target_empresa:
        doc_q["empresa"] = target_empresa
    manual_docs = await db.documents.find(doc_q).to_list(1000)

    # Fetch subsidio documents from db.subsidio_documents
    sub_q = {}
    if target_empresa:
        sub_q["empresa"] = target_empresa
    elif user["role"] != "admin_enered":
        cursor = db.users.find({"empresa": user.get("empresa")}, {"_id": 0, "id": 1})
        uids = [u["id"] async for u in cursor if "id" in u]
        sub_q["user_id"] = {"$in": uids}
    subsidio_docs = await db.subsidio_documents.find(sub_q).to_list(1000)

    # Load verified dates from db.subsidio_vehicles
    veh_map = {}
    if subsidio_docs:
        uids = list(set(sd.get("user_id") for sd in subsidio_docs if sd.get("user_id")))
        plates = list(set(sd.get("placa").upper().strip() for sd in subsidio_docs if sd.get("placa")))
        if uids and plates:
            v_cursor = db.subsidio_vehicles.find({
                "user_id": {"$in": uids},
                "placa": {"$in": plates}
            }, {"_id": 0, "user_id": 1, "placa": 1, "vigente_desde": 1, "vigente_hasta": 1})
            async for v in v_cursor:
                key = (v.get("user_id"), v.get("placa").upper().strip() if v.get("placa") else "")
                veh_map[key] = v

    results = []

    # Map manual documents
    for d in manual_docs:
        results.append({
            "id": d.get("id") or str(d.get("_id")),
            "tipo": d.get("tipo") or "Otros",
            "doc": d.get("doc") or "Documento",
            "por": d.get("por") or "Admin",
            "el": d.get("el") or d.get("uploaded_at") or "",
            "emi": d.get("emi") or "—",
            "ven": d.get("ven") or "—",
            "atr": d.get("atr") or "—",
            "veh": d.get("veh") or 0,
            "grp": d.get("grp") or 0,
            "all": d.get("all") or 0,
            "placa": d.get("placa") or "",
            "archived": int(d.get("archived") or 0),
            "est": d.get("est") or "Vigente",
            "filename": d.get("filename") or "",
            "_origen": "manual",
        })

    # Map subsidio documents
    for sd in subsidio_docs:
        cat = sd.get("categoria") or sd.get("category")
        tipo, doc_name = SUB_CAT_MAP.get(cat, ("Otros", cat or "Documento"))
        
        placa = sd.get("placa").upper().strip() if sd.get("placa") else ""
        emi_date = "—"
        ven_date = "—"
        atr_str = "—"
        est = "Vigente"

        # If it's a fleet document with a plate, read dates from manual validation
        if placa and cat in ["tarjeta_habilitacion", "tarjeta_propiedad"]:
            v_info = veh_map.get((sd.get("user_id"), placa))
            if v_info:
                raw_emi = v_info.get("vigente_desde")
                raw_ven = v_info.get("vigente_hasta")

                if raw_emi and raw_emi != "—":
                    try:
                        if "-" in raw_emi:
                            parts = raw_emi.split("-")
                            if len(parts) == 3:
                                emi_date = f"{parts[2]}/{parts[1]}/{parts[0][2:]}"
                            else:
                                emi_date = raw_emi
                        else:
                            emi_date = raw_emi
                    except Exception:
                        emi_date = raw_emi

                if raw_ven and raw_ven != "—":
                    try:
                        if "-" in raw_ven:
                            parts = raw_ven.split("-")
                            if len(parts) == 3:
                                ven_date = f"{parts[2]}/{parts[1]}/{parts[0][2:]}"
                            else:
                                ven_date = raw_ven
                        else:
                            ven_date = raw_ven
                    except Exception:
                        ven_date = raw_ven

                # Calculate expiration status if vigente_hasta is set
                if raw_ven and raw_ven != "—":
                    try:
                        if "-" in raw_ven:
                            y, m, d = map(int, raw_ven.split("-")[:3])
                        else:
                            d, m, y = map(int, raw_ven.split("/")[:3])
                            if y < 100:
                                y += 2000
                        exp_dt = datetime(y, m, d, tzinfo=timezone.utc)
                        now_dt = datetime.now(timezone.utc)
                        diff_days = (exp_dt - now_dt).days
                        if diff_days < 0:
                            est = "Vencido"
                            atr_str = f"{abs(diff_days)} días"
                        elif diff_days <= 30:
                            est = "Próximo"
                            atr_str = f"{diff_days} días"
                    except Exception:
                        pass

        if sd.get("status") == "rechazado":
            est = "Vencido"
        elif sd.get("archived"):
            est = "Archivado"

        el_date = ""
        up_at = sd.get("uploaded_at") or sd.get("created_at")
        if up_at:
            try:
                dt = datetime.fromisoformat(up_at.replace("Z", "+00:00"))
                el_date = dt.strftime("%d/%m/%y")
            except Exception:
                el_date = up_at[:10]

        results.append({
            "id": sd.get("id") or str(sd.get("_id")),
            "tipo": tipo,
            "doc": doc_name,
            "por": "Cliente (Subsidio)",
            "el": el_date,
            "emi": emi_date,
            "ven": ven_date,
            "atr": atr_str,
            "veh": 1 if placa else 0,
            "grp": 0,
            "all": 0,
            "placa": placa,
            "archived": 1 if sd.get("archived") else 0,
            "est": est,
            "filename": sd.get("filename") or "",
            "_origen": "subsidio",
        })

    results.sort(key=lambda x: x["id"], reverse=True)
    return results

@api.post("/documents")
async def upload_manual_document(
    file: UploadFile = File(...),
    tipo: str = Form(...),
    doc: str = Form(...),
    emi: Optional[str] = Form(None),
    ven: Optional[str] = Form(None),
    placa: Optional[str] = Form(None),
    user: dict = Depends(get_current_user),
):
    content = await file.read()
    key = f"documents/{user.get('empresa') or 'general'}/{str(uuid.uuid4())}_{file.filename}"
    content_type = file.content_type or "application/octet-stream"
    storage.save_object(key, content, content_type)

    doc_id = str(uuid.uuid4())
    doc_record = {
        "id": doc_id,
        "empresa": user.get("empresa"),
        "tipo": tipo,
        "doc": doc,
        "por": user.get("name", "Usuario"),
        "el": datetime.now(timezone.utc).strftime("%d/%m/%y"),
        "uploaded_at": datetime.now(timezone.utc).isoformat(),
        "emi": emi or "—",
        "ven": ven or "—",
        "atr": "—",
        "veh": 1 if placa else 0,
        "grp": 0,
        "all": 0 if placa else 1,
        "placa": placa.upper().strip() if placa else "",
        "archived": 0,
        "est": "Vigente",
        "filename": file.filename,
        "storage_key": key,
        "content_type": content_type,
        "size": len(content),
    }

    await db.documents.insert_one(doc_record)
    doc_record.pop("_id", None)
    doc_record.pop("storage_key", None)
    doc_record.pop("content_type", None)
    doc_record["_origen"] = "manual"
    return doc_record

@api.delete("/documents/{doc_id}")
async def delete_document(
    doc_id: str,
    user: dict = Depends(get_current_user),
):
    doc = await db.documents.find_one({"id": doc_id})
    if doc:
        if user["role"] != "admin_enered" and doc.get("empresa") != user.get("empresa"):
            raise HTTPException(status_code=403, detail="No autorizado")
        try:
            storage.delete_object(doc["storage_key"])
        except Exception:
            pass
        await db.documents.delete_one({"id": doc_id})
        return {"status": "deleted"}

    sub_doc = await db.subsidio_documents.find_one({"id": doc_id})
    if sub_doc:
        if user["role"] != "admin_enered" and sub_doc.get("empresa") != user.get("empresa"):
            raise HTTPException(status_code=403, detail="No autorizado")
        try:
            storage.delete_object(sub_doc["storage_key"])
        except Exception:
            pass
        await db.subsidio_documents.delete_one({"id": doc_id})
        return {"status": "deleted"}

    raise HTTPException(status_code=404, detail="Documento no encontrado")

@api.put("/documents/{doc_id}/archive")
async def archive_document(
    doc_id: str,
    archived: int,
    user: dict = Depends(get_current_user),
):
    doc = await db.documents.find_one({"id": doc_id})
    if doc:
        if user["role"] != "admin_enered" and doc.get("empresa") != user.get("empresa"):
            raise HTTPException(status_code=403, detail="No autorizado")
        est = "Archivado" if archived else "Vigente"
        await db.documents.update_one({"id": doc_id}, {"$set": {"archived": archived, "est": est}})
        return {"status": "updated"}

    sub_doc = await db.subsidio_documents.find_one({"id": doc_id})
    if sub_doc:
        if user["role"] != "admin_enered" and sub_doc.get("empresa") != user.get("empresa"):
            raise HTTPException(status_code=403, detail="No autorizado")
        await db.subsidio_documents.update_one({"id": doc_id}, {"$set": {"archived": bool(archived)}})
        return {"status": "updated"}

    raise HTTPException(status_code=404, detail="Documento no encontrado")

from fastapi.responses import StreamingResponse
import io

@api.get("/documents/{doc_id}/download")
async def download_document(
    doc_id: str,
    user: dict = Depends(get_current_user),
):
    doc = await db.documents.find_one({"id": doc_id})
    if doc:
        if user["role"] != "admin_enered" and doc.get("empresa") != user.get("empresa"):
            raise HTTPException(status_code=403, detail="No autorizado")
        file_bytes = storage.read_object(doc["storage_key"])
        if not file_bytes:
            raise HTTPException(status_code=404, detail="Archivo no encontrado")
        content_type = doc.get("content_type") or "application/octet-stream"
        filename = doc.get("filename") or "documento"
        return StreamingResponse(
            io.BytesIO(file_bytes),
            media_type=content_type,
            headers={"Content-Disposition": f"attachment; filename={filename}"}
        )

    sub_doc = await db.subsidio_documents.find_one({"id": doc_id})
    if sub_doc:
        if user["role"] != "admin_enered" and sub_doc.get("empresa") != user.get("empresa"):
            raise HTTPException(status_code=403, detail="No autorizado")
        file_bytes = storage.read_object(sub_doc["storage_key"])
        if not file_bytes:
            raise HTTPException(status_code=404, detail="Archivo no encontrado")
        content_type = sub_doc.get("content_type") or "application/octet-stream"
        filename = sub_doc.get("filename") or "documento"
        return StreamingResponse(
            io.BytesIO(file_bytes),
            media_type=content_type,
            headers={"Content-Disposition": f"attachment; filename={filename}"}
        )


@app.get("/api/temp-backfill-invoices-881")
async def temp_backfill_invoices():
    """Temporary: sync existing confirmed subsidio records to db.invoices."""
    from datetime import timedelta as _td
    confirmed = await db.consumos_subsidio.find({"status": "confirmed"}).to_list(10000)
    created = 0
    for d in confirmed:
        n_doc = (d.get("numero_documento") or "").upper().strip()
        empresa = d.get("empresa") or ""
        if not n_doc or not empresa:
            continue
        existing = await db.invoices.find_one({"empresa": empresa, "n_doc": n_doc})
        if existing:
            continue
        fecha_str = (d.get("fecha") or "")[:10]
        f_venc = fecha_str
        try:
            f_dt = datetime.strptime(fecha_str, "%Y-%m-%d")
            f_venc = (f_dt + _td(days=30)).date().isoformat()
        except Exception:
            try:
                f_dt = datetime.strptime(fecha_str, "%d/%m/%Y")
                fecha_str = f_dt.date().isoformat()
                f_venc = (f_dt + _td(days=30)).date().isoformat()
            except Exception:
                pass
        inv_doc = {
            "id": d.get("id") or str(uuid.uuid4()),
            "empresa": empresa,
            "n_doc": n_doc,
            "tipo_doc": "factura",
            "producto": d.get("producto") or "DIESEL B5 S-50",
            "f_emision": fecha_str,
            "f_vencimiento": f_venc,
            "moneda": "PEN",
            "monto_total": float(d.get("importe_total") or 0),
            "saldo": float(d.get("importe_total") or 0),
            "estado": "pendiente",
            "atraso_dias": 0,
            "pdf_filename": d.get("factura_filename"),
            "xml_filename": None,
            "uploaded_at": datetime.now(timezone.utc).isoformat(),
            "uploaded_by": "backfill",
            "created_via": "subsidio_backfill",
        }
        await db.invoices.insert_one(inv_doc)
        created += 1
    return {"ok": True, "backfilled": created}


@app.on_event("startup")
async def startup():
    await db.users.create_index("email", unique=True)
    await db.consumptions.create_index("EMPRESA")
    await db.consumptions.create_index("FECHA")
    # Nuevos índices para acelerar dashboards y filtros (compuestos)
    try:
        await db.consumptions.create_index([("EMPRESA", 1), ("FECHA", -1)])
        await db.consumptions.create_index([("EMPRESA", 1), ("PLACA", 1)])
        await db.consumptions.create_index("PLACA")
        await db.consumptions.create_index("SEMANA")
        await db.invoices.create_index([("empresa", 1), ("estado", 1)])
        await db.qr_codes.create_index([("empresa", 1), ("placa", 1)])
        await db.consumos_subsidio.create_index([("user_id", 1), ("status", 1)])
        await db.consumos_subsidio.create_index([("user_id", 1), ("fecha", -1)])
        await db.empresas_config.create_index("empresa", unique=True)
        # Índices para acelerar el listado admin de expedientes de subsidio
        await db.subsidio_documents.create_index("user_id")
        await db.subsidio_vehicles.create_index("user_id")
        await db.subsidio_declaraciones.create_index("user_id")
        await db.subsidio_bank_accounts.create_index("user_id")
        await db.subsidio_leads.create_index("calc_id")
        await db.subsidio_leads.create_index("email")
        await db.subsidio_leads.create_index("ruc")
        await db.users.create_index([("role", 1), ("created_at", -1)])
        await db.calculations.create_index("id")
    except Exception as e:
        logger.warning(f"Index creation warning: {e}")
    await db.password_reset_tokens.create_index("expires_at", expireAfterSeconds=3600)
    await seed_demo_data()
    # Backfill de servicios/tipo_cliente para empresas legacy
    try:
        result = await _svc.backfill_servicios(db)
        logger.info(f"Servicios backfill: {result}")
    except Exception as e:
        logger.warning(f"Servicios backfill failed: {e}")


@app.on_event("shutdown")
async def shutdown():
    client.close()
