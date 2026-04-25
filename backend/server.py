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
    }


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
    return {"user": user_public(user), "access_token": access}


@api.post("/auth/logout")
async def logout(response: Response, user: dict = Depends(get_current_user)):
    clear_auth_cookies(response)
    return {"ok": True}


@api.get("/auth/me")
async def me(user: dict = Depends(get_current_user)):
    return user_public(user)


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


@api.get("/dashboard/filter-options")
async def dashboard_filter_options(user: dict = Depends(get_current_user), empresa: Optional[str] = None):
    q = tenant_filter(user)
    if empresa and user["role"] == "admin_enered":
        q["EMPRESA"] = empresa
    rows = await db.consumptions.find(q, {"_id": 0, "PLACA": 1, "SEMANA": 1, "ESTACION": 1, "PRODUCTO": 1}).to_list(100000)
    placas = sorted({r["PLACA"] for r in rows if r.get("PLACA")})
    semanas = sorted({r["SEMANA"] for r in rows if r.get("SEMANA")})
    estaciones = sorted({r["ESTACION"] for r in rows if r.get("ESTACION")})
    productos = sorted({r["PRODUCTO"] for r in rows if r.get("PRODUCTO")})
    return {"placas": placas, "semanas": semanas, "estaciones": estaciones, "productos": productos}


# ---------- Empresa Config (plan, línea crédito, unidades, RUC, días crédito) ----------
class EmpresaConfig(BaseModel):
    empresa: str
    ruc: Optional[str] = ""
    plan: Literal["tracking", "advanced", "integral"] = "tracking"
    linea_credito: float = 0.0
    unidades_contratadas: int = 0
    dias_credito: int = 0  # condición de crédito (días)


@api.get("/empresas-config")
async def list_empresas_config(user: dict = Depends(require_roles("admin_enered"))):
    configs = await db.empresas_config.find({}, {"_id": 0}).to_list(500)
    return configs


@api.post("/empresas-config")
async def upsert_empresa_config(data: EmpresaConfig, user: dict = Depends(require_roles("admin_enered"))):
    doc = data.model_dump()
    doc["updated_at"] = datetime.now(timezone.utc).isoformat()
    existing = await db.empresas_config.find_one({"empresa": data.empresa}, {"_id": 0})
    if existing:
        await db.empresas_config.update_one({"empresa": data.empresa}, {"$set": doc})
    else:
        doc["id"] = str(uuid.uuid4())
        doc["created_at"] = doc["updated_at"]
        await db.empresas_config.insert_one(doc)
    return await db.empresas_config.find_one({"empresa": data.empresa}, {"_id": 0})


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
    rows = await db.consumptions.find(q, {"_id": 0}).to_list(100000)

    def _f(x, d=0):
        try: return float(x) if x not in (None, "") else d
        except Exception: return d

    total_gal = sum(_f(r.get("CANTIDAD_GL")) for r in rows)
    total_gasto = sum(_f(r.get("IMPORTE_TOTAL")) for r in rows)
    total_ahorro = sum(_f(r.get("AHORRO")) for r in rows)
    cargas = len(rows)

    # Precio promedio ponderado
    sum_pu = sum(_f(r.get("PRECIO_UNITARIO")) * _f(r.get("CANTIDAD_GL")) for r in rows if _f(r.get("CANTIDAD_GL")) > 0 and _f(r.get("PRECIO_UNITARIO")) > 0)
    sum_gl = sum(_f(r.get("CANTIDAD_GL")) for r in rows if _f(r.get("PRECIO_UNITARIO")) > 0)
    precio_prom = (sum_pu / sum_gl) if sum_gl > 0 else 0

    ticket_prom = total_gasto / cargas if cargas else 0
    gal_por_carga = total_gal / cargas if cargas else 0
    ahorro_gl = (total_ahorro / precio_prom) if precio_prom > 0 else 0

    # Línea de crédito: utilizada = facturas no pagadas
    inv_q = {"empresa": target_empresa} if target_empresa else {}
    facturas = await db.invoices.find(inv_q, {"_id": 0}).to_list(1000)
    utilizada = sum(float(f.get("monto", 0) or 0) for f in facturas if f.get("estado") != "pagada")
    total_credito = float(cfg.get("linea_credito", 0) or 0)
    disponible = max(0, total_credito - utilizada)

    # Unidades (placas únicas reales)
    placas_reales = len({r.get("PLACA") for r in rows if r.get("PLACA")})

    # Última sync de sheets
    last_sync = await db.sheets_sync_log.find_one({}, {"_id": 0}, sort=[("finished_at", -1)])
    last_sync_at = last_sync["finished_at"] if last_sync else None

    return {
        "empresa": cfg["empresa"],
        "ruc": cfg.get("ruc", ""),
        "plan": cfg.get("plan", "tracking"),
        "unidades_contratadas": int(cfg.get("unidades_contratadas", 0) or 0),
        "unidades_reales": placas_reales,
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

    rows = await db.consumptions.find(q, {"_id": 0}).to_list(100000)

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
        d = by_week.setdefault(s, {"consumo": 0.0, "gasto": 0.0, "ahorro": 0.0, "cargas": 0})
        g = _f(r.get("CANTIDAD_GL"))
        d["consumo"] += g
        d["gasto"] += _f(r.get("IMPORTE_TOTAL"))
        d["ahorro"] += _f(r.get("AHORRO"))
        d["cargas"] += 1

        pu = _f(r.get("PRECIO_UNITARIO"))
        pp = _f(r.get("PRECIO_PIZARRA"))
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
        d = by_placa.setdefault(p, {"consumo": 0.0, "gasto": 0.0, "cargas": 0})
        d["consumo"] += _f(r.get("CANTIDAD_GL"))
        d["gasto"] += _f(r.get("IMPORTE_TOTAL"))
        d["cargas"] += 1

    top_placas_consumo = sorted(
        [{"placa": p, "galones": round(v["consumo"], 2)} for p, v in by_placa.items()],
        key=lambda x: -x["galones"]
    )[:5]
    gasto_placa = sorted(
        [{"placa": p, "gasto": round(v["gasto"], 2)} for p, v in by_placa.items()],
        key=lambda x: -x["gasto"]
    )[:10]
    cargas_placa = sorted(
        [{"placa": p, "cargas": v["cargas"]} for p, v in by_placa.items()],
        key=lambda x: -x["cargas"]
    )[:10]

    # ---- Ciudad / Estación ----
    ciudades = {}
    ciudades_gasto = {}
    est_consumo = {}
    est_gasto = {}
    est_ahorro = {}
    for r in rows:
        c = r.get("CIUDAD", "Sin ciudad")
        ciudades[c] = ciudades.get(c, 0) + _f(r.get("CANTIDAD_GL"))
        ciudades_gasto[c] = ciudades_gasto.get(c, 0) + _f(r.get("IMPORTE_TOTAL"))
        e = r.get("ESTACION", "Sin estación")
        est_consumo[e] = est_consumo.get(e, 0) + _f(r.get("CANTIDAD_GL"))
        est_gasto[e] = est_gasto.get(e, 0) + _f(r.get("IMPORTE_TOTAL"))
        est_ahorro[e] = est_ahorro.get(e, 0) + _f(r.get("AHORRO"))

    consumo_ciudad = [{"ciudad": c, "galones": round(v, 2), "gasto": round(ciudades_gasto.get(c, 0), 2)} for c, v in sorted(ciudades.items(), key=lambda x: -x[1])[:10]]
    consumo_estacion = [{"estacion": e, "galones": round(v, 2), "gasto": round(est_gasto.get(e, 0), 2)} for e, v in sorted(est_consumo.items(), key=lambda x: -x[1])[:10]]
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

    rows = await db.consumptions.find(q, {"_id": 0}).to_list(100000)
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
    rows = await db.consumptions.find(q, {"_id": 0}).to_list(100000)
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
    rows = await db.invoices.find(q, {"_id": 0}).sort("fecha_emision", -1).to_list(1000)
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
async def delete_invoice(inv_id: str, user: dict = Depends(require_roles("admin_enered"))):
    await db.invoices.delete_one({"id": inv_id})
    return {"ok": True}


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
INV_DIR = ROOT_DIR / "uploads" / "invoices"
INV_DIR.mkdir(parents=True, exist_ok=True)


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
        "producto": producto or "Combustible",
    }


def _safe_doc(name: str) -> str:
    base = name.rsplit(".", 1)[0].strip()
    return "".join(c for c in base if c.isalnum() or c in ("-", "_"))


@api.post("/admin/invoices/upload-bulk")
async def admin_invoices_upload_bulk(
    files: List[UploadFile] = File(...),
    user: dict = Depends(require_roles("admin_enered")),
):
    """Bulk upload pairs of PDF + XML files. Files are matched by basename
    (e.g. F001-123.pdf + F001-123.xml). Each XML is parsed (SUNAT UBL 2.1) to
    extract invoice metadata. Empresa is matched by RUC against empresas_config.
    """
    by_base: dict = {}
    for f in files:
        base = _safe_doc(f.filename)
        ext = (f.filename.rsplit(".", 1)[-1] if "." in f.filename else "").lower()
        content = await f.read()
        by_base.setdefault(base, {})[ext] = (f.filename, content)

    saved: List[dict] = []
    skipped: List[dict] = []
    rucs_to_empresa = {}
    cfgs = await db.empresas_config.find({}, {"_id": 0}).to_list(500)
    for c in cfgs:
        if c.get("ruc"):
            rucs_to_empresa[str(c["ruc"]).strip()] = c["empresa"]

    for base, parts in by_base.items():
        if "xml" not in parts:
            skipped.append({"base": base, "reason": "falta XML"})
            continue
        try:
            xml_name, xml_bytes = parts["xml"]
            meta = _parse_sunat_xml(xml_bytes)
        except Exception as e:
            skipped.append({"base": base, "reason": f"XML no parseable: {e}"})
            continue

        ruc = (meta.get("ruc_cliente") or "").strip()
        empresa = rucs_to_empresa.get(ruc) or meta.get("razon_social_cliente") or "DESCONOCIDO"

        # Save files
        empresa_dir = INV_DIR / _safe_doc(empresa)
        empresa_dir.mkdir(parents=True, exist_ok=True)
        n_doc = meta.get("n_doc") or base
        xml_path = empresa_dir / f"{_safe_doc(n_doc)}.xml"
        with open(xml_path, "wb") as out:
            out.write(xml_bytes)

        pdf_filename = None
        if "pdf" in parts:
            pdf_name, pdf_bytes = parts["pdf"]
            pdf_path = empresa_dir / f"{_safe_doc(n_doc)}.pdf"
            with open(pdf_path, "wb") as out:
                out.write(pdf_bytes)
            pdf_filename = pdf_path.name

        # Determine status & atraso
        from datetime import date as _date
        today = _date.today()
        f_venc = meta.get("f_vencimiento") or meta.get("f_emision")
        estado = "por_vencer"
        atraso_dias = 0
        if f_venc:
            try:
                fv = _date.fromisoformat(f_venc)
                if fv < today:
                    estado = "vencido"
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
            "xml_filename": xml_path.name,
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

        saved.append({"n_doc": n_doc, "empresa": empresa, "estado": estado})

    return {"uploaded": len(saved), "saved": saved, "skipped": skipped}


@api.get("/invoices/{inv_id}/download/{kind}")
async def invoice_download(inv_id: str, kind: str, user: dict = Depends(get_current_user)):
    from fastapi.responses import FileResponse
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
    file_path = INV_DIR / _safe_doc(inv["empresa"]) / fname
    if not file_path.exists():
        raise HTTPException(status_code=404, detail="Archivo no existe")
    media = "application/pdf" if kind == "pdf" else "application/xml"
    return FileResponse(path=str(file_path), filename=fname, media_type=media)


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
    facturas_pendientes = sum(_f(i.get("saldo")) for i in invs if i.get("estado") != "pagado")
    notas_despacho = sum(_f(c.get("IMPORTE_TOTAL")) for c in cons)
    total_vencido = sum(_f(i.get("saldo")) for i in invs if i.get("estado") == "vencido")

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
        "total_facturado": round(total_facturado, 2),
        "total_vencido": round(total_vencido, 2),
        "pct_utilizada": pct,
        "dias_credito": int(cfg.get("dias_credito") or 0),
        "n_facturas": len(invs),
    }


# ---------- QR Code Bulk Upload / Download ----------
QR_DIR = ROOT_DIR / "uploads" / "qr"
QR_DIR.mkdir(parents=True, exist_ok=True)


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

    empresa_dir = QR_DIR / _safe_placa(empresa)
    empresa_dir.mkdir(parents=True, exist_ok=True)

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
            target = empresa_dir / f"{placa}.{ext}"
            with open(target, "wb") as out:
                out.write(content)
            # Upsert in mongo
            await db.qr_codes.update_one(
                {"empresa": empresa, "placa": placa},
                {"$set": {
                    "empresa": empresa,
                    "placa": placa,
                    "filename": target.name,
                    "uploaded_at": datetime.now(timezone.utc).isoformat(),
                    "uploaded_by": user["email"],
                }},
                upsert=True,
            )
            saved.append({"placa": placa, "file": target.name})
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
    from fastapi.responses import FileResponse
    placa = _safe_placa(placa)
    target_empresa = empresa if user["role"] == "admin_enered" else user.get("empresa")
    if not target_empresa:
        raise HTTPException(status_code=400, detail="empresa requerida")
    record = await db.qr_codes.find_one({"empresa": target_empresa, "placa": placa}, {"_id": 0})
    if not record:
        raise HTTPException(status_code=404, detail="QR no encontrado")
    file_path = QR_DIR / _safe_placa(target_empresa) / record["filename"]
    if not file_path.exists():
        raise HTTPException(status_code=404, detail="archivo no encontrado")
    return FileResponse(path=str(file_path), filename=f"QR_{placa}.{file_path.suffix.lstrip('.')}", media_type="application/octet-stream")


@api.delete("/admin/qr/{placa}")
async def admin_qr_delete(placa: str, empresa: str, user: dict = Depends(require_roles("admin_enered"))):
    placa = _safe_placa(placa)
    record = await db.qr_codes.find_one({"empresa": empresa, "placa": placa}, {"_id": 0})
    if not record:
        raise HTTPException(status_code=404, detail="QR no encontrado")
    file_path = QR_DIR / _safe_placa(empresa) / record["filename"]
    if file_path.exists():
        try:
            file_path.unlink()
        except Exception:
            pass
    await db.qr_codes.delete_one({"empresa": empresa, "placa": placa})
    return {"ok": True}


# ---------- Root ----------
@api.get("/")
async def root():
    return {"service": "ENERED API", "status": "ok"}


app.include_router(api)

# CORS
_frontend = os.environ.get("FRONTEND_URL", "http://localhost:3000")
app.add_middleware(
    CORSMiddleware,
    allow_origins=[_frontend, "http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


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
        ("administrador@lima.com", "demo123", "Juan Pérez", "administrador", "TRANSPORTES LIMA SAC"),
        ("logistica@lima.com", "demo123", "María López", "logistica", "TRANSPORTES LIMA SAC"),
        ("contabilidad@lima.com", "demo123", "Carlos Ruiz", "contabilidad", "TRANSPORTES LIMA SAC"),
        ("administrador@andina.com", "demo123", "Ana Gómez", "administrador", "LOGISTICA ANDINA SA"),
        ("administrador@cargo.com", "demo123", "Pedro Silva", "administrador", "CARGO PERU EIRL"),
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
    empresa_defaults = [
        ("ROSANDINA SAC", "20605479686", "tracking", 50000, 77),
        ("TRANSPORTES LIMA SAC", "20512345678", "advanced", 80000, 25),
        ("LOGISTICA ANDINA SA", "20556781234", "tracking", 40000, 18),
        ("CARGO PERU EIRL", "20578912345", "integral", 30000, 12),
    ]
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


@app.on_event("startup")
async def startup():
    await db.users.create_index("email", unique=True)
    await db.consumptions.create_index("EMPRESA")
    await db.consumptions.create_index("FECHA")
    await db.invoices.create_index("empresa")
    await db.password_reset_tokens.create_index("expires_at", expireAfterSeconds=3600)
    await seed_demo_data()


@app.on_event("shutdown")
async def shutdown():
    client.close()
