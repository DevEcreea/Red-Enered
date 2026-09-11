"""
Diagnóstico ATU — Subsidio del transportista (DU 004).
Consulta las habilitaciones que la ATU reconoce para un RUC y detecta el problema
clave: unidades HABILITADAS en el MTC pero que la ATU muestra SIN TUC (tuc=null o
malformado) => NO serán reconocidas para el subsidio. Ese gap es el gancho comercial.

Dos vías de entrada:
  A) diagnosticar_desde_json(data)      -> se pega la respuesta de la ATU (sin credenciales)
  B) consultar_habilitaciones(token,ruc) -> consulta en vivo con el access_token de sesión ATU
"""
from __future__ import annotations
import re
import os
from typing import Optional

import httpx

# Proxy opcional para llegar a la ATU (usa ATU_PROXY, o cae al MTC_PROXY si no se define).
_ATU_PROXY = os.getenv("ATU_PROXY") or os.getenv("MTC_PROXY") or None

API_BASE = "https://api.atu.gob.pe/api_comprobante"
IAM_BASE = "https://api.atu.gob.pe/api_iam"
HABILITACIONES = API_BASE + "/verificacion/habilitaciones"
DATOS = API_BASE + "/verificacion/datos"
SEMAFORO = API_BASE + "/verificacion/semaforo"
REFRESH = IAM_BASE + "/auth/refresh"
UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120 Safari/537.36"
_ATU_HDRS = {
    "User-Agent": UA,
    "Accept": "application/json, text/plain, */*",
    "Origin": "https://soluciones.atu.gob.pe",
    "Referer": "https://soluciones.atu.gob.pe/",
}

class AtuError(Exception):
    pass


def _tuc_estado(tuc: Optional[str]) -> str:
    """
    Un TUC válido de la ATU es un número de al menos 6 dígitos (p.ej. '26000478'),
    con o sin prefijo 'T-'. Si la ATU devuelve un TUC completo, la unidad SÍ está
    reconocida. Solo es problema cuando viene vacío (sin_tuc) o claramente truncado.
    """
    s = str(tuc or "").strip()
    if not s:
        return "sin_tuc"                 # tuc=null → la ATU no reconoce la unidad
    digitos = re.sub(r"\D", "", s)       # cuenta solo los dígitos (ignora 'T-', espacios)
    if len(digitos) >= 6:
        return "ok"                      # TUC completo → reconocido
    return "tuc_malformado"              # incompleto/truncado (ej. 'T-5284' → 4 dígitos)


def diagnosticar(lista: list, ruc: str = "") -> dict:
    """Toma la lista de vehículos de la ATU y arma el diagnóstico."""
    unidades = []
    ok = con_problema = 0
    for v in (lista or []):
        estado = _tuc_estado(v.get("tuc"))
        problema = estado != "ok"
        if problema:
            con_problema += 1
        else:
            ok += 1
        unidades.append({
            "placa": v.get("placa"),
            "categoria": v.get("categoria"),
            "tuc": v.get("tuc"),
            "tuc_estado": estado,                                   # ok | sin_tuc | tuc_malformado
            "numero_autorizacion": v.get("numeroAutorizacion"),
            "estado_autorizacion": v.get("estadoAutorizacionNombre") or v.get("estadoAutorizacion"),
            "tope_galones": v.get("topeGalones"),
            "fuente": v.get("fuente"),
            "problema": problema,
        })
    # ordenar: primero las que tienen problema (para que salten a la vista)
    unidades.sort(key=lambda u: (not u["problema"], u.get("placa") or ""))
    total = len(unidades)
    return {
        "ruc": ruc,
        "total_unidades": total,
        "reconocidas": ok,                 # con TUC válido → sí reciben subsidio
        "con_problema": con_problema,      # sin TUC / TUC malformado → NO reconocidas
        "tiene_problemas": con_problema > 0,
        "unidades": unidades,
    }


def diagnosticar_desde_json(data) -> dict:
    """Acepta la respuesta cruda de la ATU (dict con data.lista, o directamente la lista)."""
    lista = None
    ruc = ""
    if isinstance(data, list):
        lista = data
    elif isinstance(data, dict):
        d = data.get("data") or data
        lista = d.get("lista") if isinstance(d, dict) else None
        if lista is None and isinstance(data.get("lista"), list):
            lista = data["lista"]
        ruc = str(data.get("ruc") or "")
    if not isinstance(lista, list):
        raise AtuError("No se encontró la lista de vehículos en el JSON pegado.")
    return diagnosticar(lista, ruc)


async def consultar_habilitaciones(token: str, ruc: str) -> dict:
    """Consulta en vivo la ATU con el access_token de sesión. Devuelve el diagnóstico."""
    ruc = (ruc or "").strip()
    if not re.fullmatch(r"\d{11}", ruc):
        raise AtuError("El RUC debe tener 11 dígitos")
    token = (token or "").strip()
    if not token:
        raise AtuError("Falta el access_token de la ATU")
    headers = {
        "User-Agent": UA,
        "Accept": "application/json, text/plain, */*",
        "Content-Type": "application/json",
        "Origin": "https://soluciones.atu.gob.pe",
        "Referer": "https://soluciones.atu.gob.pe/",
        "Authorization": f"Bearer {token}",
    }
    cookies = {"access_token": token}
    async with httpx.AsyncClient(timeout=30.0, verify=False, headers=headers, cookies=cookies, proxy=_ATU_PROXY) as client:
        # OJO: el endpoint es POST, con el ruc como parámetro de query (no en el body).
        r = await client.post(HABILITACIONES, params={"ruc": ruc}, content=b"")
        if r.status_code in (401, 403):
            raise AtuError("La ATU rechazó el token (expiró o no autoriza).")
        if r.status_code == 404:
            # El RUC no tiene habilitaciones en el padrón del subsidio.
            return {"ruc": ruc, "total_unidades": 0, "reconocidas": 0, "con_problema": 0,
                    "tiene_problemas": False, "unidades": [], "sin_habilitaciones": True}
        if r.status_code != 200:
            raise AtuError(f"La ATU respondió {r.status_code}")
        try:
            data = r.json()
        except Exception:
            raise AtuError("Respuesta inesperada de la ATU (no es JSON)")
    diag = diagnosticar_desde_json(data)
    diag["ruc"] = ruc
    return diag


async def consultar_semaforo(token: str, ruc: str) -> list:
    """Trae el semáforo de condiciones de la ATU (activo/habido, autorización, TUC…)."""
    headers = {**_ATU_HDRS, "Authorization": f"Bearer {token}"}
    async with httpx.AsyncClient(timeout=25.0, verify=False, headers=headers,
                                 cookies={"access_token": token}, proxy=_ATU_PROXY) as client:
        r = await client.get(SEMAFORO, params={"ruc": ruc})
        if r.status_code in (401, 403):
            raise AtuError("La ATU rechazó el token.")
        if r.status_code != 200:
            return []
        try:
            lista = (r.json().get("data") or {}).get("lista") or []
        except Exception:
            return []
    return lista if isinstance(lista, list) else []


async def refresh_session(refresh_token: str) -> dict:
    """Renueva la sesión ATU con el refresh_token (no requiere reCAPTCHA). Devuelve tokens nuevos."""
    if not refresh_token:
        raise AtuError("Falta el refresh_token")
    hdrs = {**_ATU_HDRS, "Cookie": f"refresh_token={refresh_token}"}
    async with httpx.AsyncClient(timeout=30.0, verify=False, headers=hdrs, proxy=_ATU_PROXY) as client:
        r = await client.post(REFRESH, content=b"")
        if r.status_code not in (200, 204):
            raise AtuError("La sesión ATU expiró; hay que volver a conectar la cuenta.")
        # Leer los tokens nuevos de los Set-Cookie (la ATU puede devolver el mismo nombre
        # en varias rutas, por eso parseamos los headers en vez de usar el cookie-jar).
        new_access = new_refresh = None
        for k, v in r.headers.multi_items():
            if k.lower() != "set-cookie":
                continue
            m = re.match(r"\s*([^=;]+)=([^;]+)", v)
            if not m:
                continue
            name, val = m.group(1).strip(), m.group(2).strip()
            if name == "access_token" and val:
                new_access = val
            elif name == "refresh_token" and val:
                new_refresh = val
    if not new_access or new_access.count(".") != 2:
        raise AtuError("La ATU no devolvió una sesión nueva válida.")
    return {"access_token": new_access, "refresh_token": new_refresh or refresh_token}


async def diagnosticar_con_sesion(session: dict, ruc: str):
    """
    Corre el diagnóstico usando una sesión guardada {access_token, refresh_token}.
    Si el access_token expiró, intenta renovarlo con el refresh y reintenta.
    Devuelve (diagnostico, sesion_actualizada).
    """
    access = (session or {}).get("access_token")
    refresh = (session or {}).get("refresh_token")
    try:
        diag = await consultar_habilitaciones(access, ruc)
        return diag, session
    except AtuError as e:
        msg = str(e).lower()
        if "rechaz" not in msg and "expir" not in msg:
            raise
        if not refresh:
            raise AtuError("La sesión ATU expiró y no hay refresh; vuelve a conectar la cuenta.")
        nuevos = await refresh_session(refresh)
        diag = await consultar_habilitaciones(nuevos["access_token"], ruc)
        return diag, {**(session or {}), **nuevos}


# ---------------------------------------------------------------------------
# Expediente del transportista en la ATU (lo que ya cargó y lo que reclama)
# Endpoints que usa la propia web de la ATU (soluciones.atu.gob.pe), todos con
# la sesión maestra:  /comprobantes/resumen?ruc=  ·  /perfil?ruc=
#                     /declaracion-jurada/obtener-calculo?entidadUuid=
#                     /declaracion-jurada/estado  (sin parámetro RUC: describe la
#                     cuenta que inició sesión, NO al RUC consultado → se marca).
# ---------------------------------------------------------------------------
PERFIL = API_BASE + "/perfil"
RESUMEN = API_BASE + "/comprobantes/resumen"
COMPROBANTES = API_BASE + "/comprobantes"
ACUMULADO = API_BASE + "/comprobantes/acumulado-vehiculos"
VEH_ASOCIADOS = API_BASE + "/comprobantes/vehiculos-asociados"
VEHICULOS = API_BASE + "/vehiculos"
CUMPLIMIENTO = API_BASE + "/verificacion/verificacion-cumplimiento"
RANGO = API_BASE + "/comprobantes/rango-activo"
DJ_ESTADO = API_BASE + "/declaracion-jurada/estado"
DJ_CALCULO = API_BASE + "/declaracion-jurada/obtener-calculo"   # ?entidadUuid= (uuid de /verificacion/datos)
DJ_CARGO = API_BASE + "/declaracion-jurada/cargo-pdf"           # ?entidadUuid= → PDF si la DJ fue enviada, 404 si no


async def _call(client: "httpx.AsyncClient", method: str, url: str, params: dict | None):
    """Llama a la ATU; devuelve (status, data.lista | json | None). 401/403 → AtuError."""
    try:
        if method == "POST":
            r = await client.post(url, params=params or None, content=b"")
        else:
            r = await client.get(url, params=params or None)
    except Exception as e:
        return 0, {"_error": str(e)[:160]}
    if r.status_code in (401, 403):
        raise AtuError("La ATU rechazó el token (expiró o no autoriza).")
    try:
        j = r.json()
    except Exception:
        return r.status_code, None
    d = j.get("data") if isinstance(j, dict) else None
    if isinstance(d, dict) and "lista" in d:
        return r.status_code, d.get("lista")
    return r.status_code, d if d is not None else j


def _num(x) -> float:
    try:
        return float(x or 0)
    except Exception:
        return 0.0


_M3_A_GAL = 264.172  # 1 m³ = 264.172 galones


async def consultar_expediente(token: str, ruc: str) -> dict:
    """TODO lo que la ATU expone de un RUC con una sesión de transportista:
    empresa (perfil + verificación + cumplimiento), flota reconocida (con TUC, tope y
    volumen acumulado), comprobantes uno a uno (estado de validación, SUNAT, archivo),
    resumen por mes y estimación del subsidio. La DJ (número de expediente / ticket)
    NO se puede consultar por RUC: ese endpoint solo describe la cuenta que inició sesión."""
    ruc = (ruc or "").strip()
    if not re.fullmatch(r"\d{11}", ruc):
        raise AtuError("El RUC debe tener 11 dígitos")
    token = (token or "").strip()
    if not token:
        raise AtuError("Falta el access_token de la ATU")
    headers = {**_ATU_HDRS, "Authorization": f"Bearer {token}"}
    raw: dict = {}
    async with httpx.AsyncClient(timeout=30.0, verify=False, headers=headers,
                                 cookies={"access_token": token}, proxy=_ATU_PROXY) as client:
        import asyncio as _aio
        (st_per, perfil), (st_dat, datos), (st_cum, cumpl), (st_res, resumen), \
            (st_com, comps), (st_veh, vehs), (st_acu, acum), (st_ran, rango) = await _aio.gather(
            _call(client, "GET", PERFIL, {"ruc": ruc}),
            _call(client, "GET", DATOS, {"ruc": ruc}),
            _call(client, "POST", CUMPLIMIENTO, {"ruc": ruc}),
            _call(client, "GET", RESUMEN, {"ruc": ruc}),
            _call(client, "GET", COMPROBANTES, {"ruc": ruc}),
            _call(client, "GET", VEHICULOS, {"ruc": ruc}),
            _call(client, "GET", ACUMULADO, {"ruc": ruc}),
            _call(client, "GET", RANGO, None),
        )
        raw = {"perfil": (st_per, perfil), "datos": (st_dat, datos), "cumplimiento": (st_cum, cumpl),
               "resumen": (st_res, resumen), "comprobantes": (st_com, comps), "vehiculos": (st_veh, vehs),
               "acumulado": (st_acu, acum), "rango": (st_ran, rango)}
        # El uuid de /verificacion/datos es el entidadUuid del transportista: con él la ATU
        # devuelve su CÁLCULO OFICIAL del subsidio y el cargo de la DJ (si ya la envió).
        entidad_uuid = datos.get("uuid") if isinstance(datos, dict) else None
        calculo = None
        cargo_pdf = None
        cargo_status = None
        if entidad_uuid:
            (st_cal, calculo), cargo = await _aio.gather(
                _call(client, "GET", DJ_CALCULO, {"entidadUuid": entidad_uuid}),
                client.get(DJ_CARGO, params={"entidadUuid": entidad_uuid}),
            )
            raw["calculo"] = (st_cal, calculo)
            cargo_status = cargo.status_code
            if cargo.status_code == 200 and "pdf" in (cargo.headers.get("content-type") or ""):
                cargo_pdf = cargo.content

    # ---- Empresa ----
    emp = (perfil or {}).get("datosEmpresa") if isinstance(perfil, dict) else None
    contacto = (perfil or {}).get("contacto") if isinstance(perfil, dict) else None
    datos = datos if isinstance(datos, dict) else {}
    empresa = {
        "razon_social": (emp or {}).get("razonSocial") or (contacto or {}).get("empresaRazonSocial"),
        "ruc": ruc,
        "registrada_atu": bool(emp) or bool(datos),
        "validado_sunat": (emp or {}).get("flValidadoSunat"),
        "activo_sunat": (emp or {}).get("activoSunat", datos.get("activoSunat")),
        "habido_sunat": (emp or {}).get("habidoSunat", datos.get("habidoSunat")),
        "estado_atu": datos.get("estado"),
        "registrado_en_padron": datos.get("registradoEnPadron"),
        "total_autorizaciones": datos.get("totalAutorizaciones"),
        "actualizaciones_restantes": datos.get("actualizacionesRestantes"),
        "contacto": (contacto or {}).get("nombres") if contacto else None,  # correo/DNI/teléfono van cifrados
    }
    cumplimiento = [{"codigo": c.get("codigo"), "nombre": c.get("nombre"), "estado": c.get("estado"),
                     "descripcion": c.get("descripcion")} for c in (cumpl or []) if isinstance(c, dict)]

    # ---- Flota reconocida por la ATU (+ acumulado) ----
    acum_by = {}
    for a in (acum or []):
        if isinstance(a, dict):
            acum_by[(a.get("placa") or "").replace("-", "").upper()] = a
    flota = []
    tope_total_gal = 0.0
    for v in (vehs or []):
        if not isinstance(v, dict):
            continue
        pn = (v.get("placa") or "").replace("-", "").upper()
        a = acum_by.get(pn, {})
        tope = _num(v.get("topeGalones"))
        tope_total_gal += tope
        acum_gal = _num(a.get("volumenAcumuladoM3")) * _M3_A_GAL
        flota.append({
            "placa": v.get("placa"), "categoria": v.get("categoria"), "tuc": v.get("tuc"),
            "tuc_vigente": v.get("tucVigente"), "autorizacion": v.get("numeroAutorizacion"),
            "autorizacion_vigente": v.get("autorizacionVigente"), "estado": v.get("estadoRegistroNombre") or v.get("estadoRegistro"),
            "fuente": v.get("fuenteDato") or v.get("fuente"), "fecha_registro": v.get("fechaRegistro"),
            "tope_galones": tope, "acumulado_galones": round(acum_gal, 2),
            "porcentaje_tope": a.get("porcentaje"), "alerta": a.get("textoAlerta"),
        })

    # ---- Comprobantes uno a uno ----
    comprobantes = []
    est_count: dict = {}
    vol_comp = 0.0
    for cp in (comps or []):
        if not isinstance(cp, dict):
            continue
        est = cp.get("estadoComprobanteCodigo") or "—"
        est_count[est] = est_count.get(est, 0) + 1
        vol_comp += _num(cp.get("volumenGal"))
        comprobantes.append({
            "uuid": cp.get("comprobanteUuid"), "forma": cp.get("tipoComprobanteCodigo"),
            "estado": est, "estado_nombre": cp.get("estadoComprobanteNombre"),
            "serie": cp.get("serie"), "numero": cp.get("numero"), "fecha": cp.get("fechaEmision"),
            "mes": cp.get("mes"), "anio": cp.get("anio"), "placa": cp.get("placa"), "placas": cp.get("cantidadPlacas"),
            "ruc_distribuidor": cp.get("rucDistribuidor"), "distribuidor": cp.get("razonSocialDistribuidor"),
            "departamento": cp.get("departamentoDistribuidor"), "galones": _num(cp.get("volumenGal")),
            "valida_sunat": cp.get("validaSunat"), "tiene_archivo": cp.get("tieneArchivo"),
            "nota_credito": cp.get("tieneNotaCreditoActiva"), "origen": cp.get("origen"),
            "tipo_sunat": cp.get("tipoComprobanteSunatCodigo"),
        })
    comprobantes.sort(key=lambda x: x.get("fecha") or "", reverse=True)

    # ---- Resumen por mes (formas) ----
    formas = (resumen or {}).get("formas") if isinstance(resumen, dict) else None
    comp = {"total": 0, "conformes": 0, "pendientes": 0, "observados": 0, "inhabilitados": 0}
    volumen_gal = 0.0
    meses = []
    for f in (formas or []):
        comp["total"] += int(_num(f.get("total")))
        comp["conformes"] += int(_num(f.get("conformes")))
        comp["pendientes"] += int(_num(f.get("sinValidacion"))) + int(_num(f.get("pendientes")))
        comp["observados"] += int(_num(f.get("observados")))
        comp["inhabilitados"] += int(_num(f.get("inhabilitados")))
        volumen_gal += _num(f.get("volumenGal"))
        meses.append({"forma": f.get("tipoComprobanteCodigo"), "mes": f.get("mes"), "anio": f.get("anio"),
                      "galones": round(_num(f.get("volumenGal")), 2), "comprobantes": int(_num(f.get("total"))),
                      "conformes": int(_num(f.get("conformes"))), "observados": int(_num(f.get("observados"))),
                      "pendientes": int(_num(f.get("sinValidacion"))) + int(_num(f.get("pendientes")))})
    if not formas and comprobantes:
        comp["total"] = len(comprobantes)
        volumen_gal = vol_comp

    # ---- Cálculo oficial de la ATU (lo que reconoce y pagará) ----
    oficial = None
    reconocido_por_comprobante: dict = {}
    if isinstance(calculo, dict) and calculo.get("subsidioTotal") is not None:
        det = calculo.get("detalle") or {}
        rt = det.get("resumenTotal") or {}
        fa = (det.get("detalleFormaA") or {})
        fb = (det.get("detalleFormaB") or {})
        ra, rb = fa.get("resumen") or {}, fb.get("resumen") or {}
        for cpo in (fa.get("comprobantes") or []) + (fb.get("comprobantes") or []):
            if isinstance(cpo, dict):
                reconocido_por_comprobante[f"{cpo.get('serie')}-{cpo.get('numero')}"] = {
                    "galones": _num(cpo.get("galones")), "placas": cpo.get("placas") or [], "combustible": cpo.get("combustible")}
        oficial = {
            "subsidio_total": _num(calculo.get("subsidioTotal")),
            "subsidio_forma_a": _num(rt.get("subsidioFormaA")), "subsidio_forma_b": _num(rt.get("subsidioFormaB")),
            "monto_por_galon": ra.get("montoPorGalon") or rb.get("montoPorGalon") or 4,
            "galones_acumulados": round(_num(ra.get("totalGalonesAcumulados")) + _num(rb.get("totalGalonesAcumulados")), 2),
            "galones_reconocidos": round(_num(ra.get("totalGalonesReconocidos")) + _num(rb.get("totalGalonesReconocidos")), 2),
            "galones_no_reconocidos": round(_num(ra.get("galonesNoReconocidos")) + _num(rb.get("galonesNoReconocidos")), 2),
            "vehiculos_procesados": int(_num(ra.get("totalVehiculos")) + _num(rb.get("totalVehiculos"))),
            "vehiculos_subsidiables": int(_num(ra.get("vehiculosSubsidiables")) + _num(rb.get("vehiculosSubsidiables"))),
            "vehiculos_no_subsidiables": int(_num(ra.get("vehiculosNoSubsidiables")) + _num(rb.get("vehiculosNoSubsidiables"))),
            "mensaje_forma_a": (det.get("mensajes") or {}).get("formaA"),
            "mensaje_forma_b": (det.get("mensajes") or {}).get("formaB"),
            "comprobantes_considerados": len(reconocido_por_comprobante),
        }
    for cpx in comprobantes:
        rc = reconocido_por_comprobante.get(f"{cpx.get('serie')}-{cpx.get('numero')}")
        cpx["reconocido_atu"] = bool(rc)
        cpx["galones_reconocidos"] = rc["galones"] if rc else 0.0
        cpx["placas_reconocidas"] = rc["placas"] if rc else []

    # ---- DJ: el cargo existe solo si la DJ fue enviada ----
    dj = None
    if cargo_status is not None:
        dj = {"enviada": cargo_pdf is not None, "cargo_disponible": cargo_pdf is not None}
        if cargo_pdf:
            dj.update(_leer_cargo_dj(cargo_pdf))

    tiene_datos = bool(emp) or bool(datos) or bool(flota) or bool(comprobantes)
    return {
        "entidad_uuid": entidad_uuid,
        "oficial": oficial,
        "ruc": ruc,
        "inscrito": tiene_datos,
        "empresa": empresa,
        "cumplimiento": cumplimiento,
        "flota": flota,
        "tope_flota_galones": round(tope_total_gal, 2),
        "comprobantes": comp,
        "comprobantes_por_estado": est_count,
        "comprobantes_detalle": comprobantes,
        "volumen_galones": round(volumen_gal, 2),
        "subsidio_estimado": round(volumen_gal * 4, 2),                      # S/ 4 × galón cargado
        "subsidio_maximo_flota": round(tope_total_gal * 4, 2),               # tope por categoría × 4
        "subsidio_estimado_topado": round(min(volumen_gal, tope_total_gal) * 4, 2) if tope_total_gal else round(volumen_gal * 4, 2),
        "periodo": rango if isinstance(rango, dict) else None,
        "por_mes": meses,
        "dj": dj,
        "dj_consultable": dj is not None,
        "_raw": raw,
    }


def _leer_cargo_dj(pdf_bytes: bytes) -> dict:
    """Extrae del cargo de la DJ (PDF) el número de expediente / ticket y la fecha."""
    out = {"numero_expediente": None, "numero_ticket": None, "fecha": None, "texto": None}
    try:
        import io
        import pdfplumber
        with pdfplumber.open(io.BytesIO(pdf_bytes)) as pdf:
            txt = "\n".join((pg.extract_text() or "") for pg in pdf.pages)
    except Exception:
        return out
    out["texto"] = txt[:1500]
    m = re.search(r"(?:N\.?\s*°?\s*(?:de\s+)?expediente|expediente\s*(?:sgd)?)\s*[:#]?\s*([A-Z0-9][A-Z0-9\-/]{3,})", txt, re.I)
    if m:
        out["numero_expediente"] = m.group(1)
    m = re.search(r"(?:N\.?\s*°?\s*(?:de\s+)?ticket|ticket)\s*[:#]?\s*([A-Z0-9][A-Z0-9\-/]{3,})", txt, re.I)
    if m:
        out["numero_ticket"] = m.group(1)
    m = re.search(r"(\d{2}/\d{2}/\d{4}(?:\s+\d{2}:\d{2}(?::\d{2})?)?)", txt)
    if m:
        out["fecha"] = m.group(1)
    return out


async def descargar_cargo_dj(token: str, ruc: str, entidad_uuid: str) -> tuple[bytes, str, str]:
    """PDF del cargo de la declaración jurada (solo existe si el transportista la envió)."""
    headers = {**_ATU_HDRS, "Authorization": f"Bearer {token}"}
    async with httpx.AsyncClient(timeout=60.0, verify=False, headers=headers,
                                 cookies={"access_token": token}, proxy=_ATU_PROXY) as client:
        r = await client.get(DJ_CARGO, params={"entidadUuid": entidad_uuid})
        if r.status_code in (401, 403):
            raise AtuError("La ATU rechazó el token (expiró o no autoriza).")
        if r.status_code != 200 or "pdf" not in (r.headers.get("content-type") or ""):
            raise AtuError("La ATU no tiene cargo de DJ para este transportista (aún no la envió).")
        return r.content, f"cargo_DJ_{ruc}.pdf", "application/pdf"


async def expediente_con_sesion(session: dict, ruc: str):
    """Igual que diagnosticar_con_sesion pero para consultar_expediente (auto-refresh)."""
    access = (session or {}).get("access_token")
    refresh = (session or {}).get("refresh_token")
    try:
        return await consultar_expediente(access, ruc), session
    except AtuError as e:
        msg = str(e).lower()
        if "rechaz" not in msg and "expir" not in msg:
            raise
        if not refresh:
            raise AtuError("La sesión ATU expiró y no hay refresh; vuelve a conectar la cuenta.")
        nuevos = await refresh_session(refresh)
        return await consultar_expediente(nuevos["access_token"], ruc), {**(session or {}), **nuevos}


# ---------------------------------------------------------------------------
# Detalle de cada comprobante (placas asignadas, azufre, validaciones) y su PDF
# ---------------------------------------------------------------------------
async def detalle_comprobantes(token: str, ruc: str, uuids: list[str], concurrencia: int = 6) -> dict:
    """GET /comprobantes/{uuid} para cada comprobante (en paralelo acotado).
    Devuelve {uuid: detalle_normalizado}."""
    token = (token or "").strip()
    if not token:
        raise AtuError("Falta el access_token de la ATU")
    import asyncio as _aio
    headers = {**_ATU_HDRS, "Authorization": f"Bearer {token}"}
    sem = _aio.Semaphore(concurrencia)
    out: dict = {}

    async def _uno(client, u):
        async with sem:
            st, d = await _call(client, "GET", f"{COMPROBANTES}/{u}", {"ruc": ruc})
        if not isinstance(d, dict) or st != 200:
            out[u] = {"uuid": u, "error": f"ATU {st}"}
            return
        archivos = [{"archivo_uuid": a.get("archivoUuid"), "nombre": a.get("nombreOriginal"),
                     "tipo": a.get("tipoArchivo"), "bytes": a.get("tamanioBytes"), "mime": a.get("tipoContenidoMime")}
                    for a in (d.get("archivos") or []) if isinstance(a, dict)]
        placas = [{"placa": pl.get("placa"), "categoria": pl.get("categoriaCodigo"),
                   "combustible": pl.get("tipoCombustibleCodigo"), "galones": _num(pl.get("volumenAsignadoGal"))}
                  for pl in (d.get("placas") or []) if isinstance(pl, dict)]
        combustibles = [{"codigo": c.get("tipoCombustibleCodigo"), "nombre": c.get("tipoCombustibleNombre"),
                         "galones": _num(c.get("volumenGal"))} for c in (d.get("combustibles") or []) if isinstance(c, dict)]
        out[u] = {
            "uuid": u,
            "tipo_nombre": d.get("tipoComprobanteNombre"),
            "estado": d.get("estadoComprobanteCodigo"), "estado_nombre": d.get("estadoComprobanteNombre"),
            "azufre_ppm": d.get("azufrePpm"), "costo": d.get("costo"),
            "valida_sunat": d.get("validaSunat"), "valida_osinergmin": d.get("validaOsinergmin"),
            "observacion": d.get("observacion"),
            "fecha_validacion_sunat": d.get("fechaValidacionSunat"), "detalle_validacion_sunat": d.get("detalleValidacionSunat"),
            "tipo_sunat": d.get("tipoComprobanteSunatCodigo"),
            "direccion_distribuidor": d.get("direccionDistribuidor"),
            "placas": placas, "combustibles": combustibles, "archivos": archivos,
            "nota_credito": {"serie": d.get("serieNc"), "numero": d.get("numeroNc"), "tipo": d.get("tipoNotaCredito")} if d.get("tieneNotaCreditoActiva") else None,
        }

    async with httpx.AsyncClient(timeout=40.0, verify=False, headers=headers,
                                 cookies={"access_token": token}, proxy=_ATU_PROXY) as client:
        await _aio.gather(*[_uno(client, u) for u in uuids if u])
    return out


async def descargar_archivo(token: str, ruc: str, archivo_uuid: str) -> tuple[bytes, str, str]:
    """Descarga el PDF de un comprobante cargado en la ATU (archivoUuid del detalle).
    Devuelve (bytes, nombre_archivo, content_type)."""
    token = (token or "").strip()
    if not token or not re.fullmatch(r"[0-9a-fA-F-]{36}", archivo_uuid or ""):
        raise AtuError("Archivo inválido")
    headers = {**_ATU_HDRS, "Authorization": f"Bearer {token}"}
    async with httpx.AsyncClient(timeout=60.0, verify=False, headers=headers,
                                 cookies={"access_token": token}, proxy=_ATU_PROXY) as client:
        r = await client.get(f"{API_BASE}/archivos/{archivo_uuid}/previsualizar", params={"ruc": ruc})
        if r.status_code in (401, 403):
            raise AtuError("La ATU rechazó el token (expiró o no autoriza).")
        if r.status_code != 200:
            raise AtuError(f"La ATU no entregó el archivo ({r.status_code})")
        ct = r.headers.get("content-type") or "application/pdf"
        cd = r.headers.get("content-disposition") or ""
        m = re.search(r'filename="?([^";]+)"?', cd)
        nombre = m.group(1) if m else f"{archivo_uuid}.pdf"
        return r.content, nombre, ct
