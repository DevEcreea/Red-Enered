"""
Integración con la consulta pública del MTC (DGTT) — Transporte de mercancías.
Replica el flujo de 3 pasos del formulario ASP.NET (sin captcha):
  1) GET   Frm_rep_intra_mercancia.aspx           -> tokens ViewState/EventValidation
  2) POST  Frm_rep_intra_mercancia_display.aspx   -> lista de autorizaciones (código, razón social)
  3) POST  Frm_rep_intra_mercancia_datos.aspx     -> detalle (estado, vigencia, unidades/placas)

Devuelve datos estructurados: estado (habilitado), N° de permiso, vigencia y las placas.
"""
from __future__ import annotations
import re
import os
import asyncio
import html as _html
from typing import Optional

import httpx

# Proxy opcional para llegar al MTC desde hosts cuya IP el MTC bloquea (p.ej. datacenters).
# Configurar en el entorno: MTC_PROXY=http://usuario:pass@host:puerto
_MTC_PROXY = os.getenv("MTC_PROXY") or None
# Conexión con timeout corto (si el MTC bloquea la IP, falla en ~8s en vez de colgarse),
# pero lectura amplia para bajar el HTML de empresas grandes (cientos de vehículos).
_MTC_TIMEOUT = httpx.Timeout(connect=8.0, read=40.0, write=15.0, pool=8.0)

BASE = "https://www.mtc.gob.pe/tramitesenlinea/tweb_tLinea/tw_consultadgtt/"
FORM = BASE + "Frm_rep_intra_mercancia.aspx"
DISPLAY = BASE + "Frm_rep_intra_mercancia_display.aspx"
DATOS = BASE + "Frm_rep_intra_mercancia_datos.aspx"
UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120 Safari/537.36"

# Mapa de tipo de búsqueda -> valor del radio del formulario
OPCIONES = {"ruc": "2", "partida": "3", "placa": "4", "constancia": "5"}


class MtcError(Exception):
    pass


# Tipo de permiso = iniciales al final del código de la autorización (ej. 15121884CNG → CNG).
# Regla de negocio (Giuliana, 25/09/2026): solo las placas de un permiso que APLICA cuentan
# para el subsidio; una empresa puede tener un permiso que aplica y otro que no, y rige el
# que está activo (habilitado y vigente).
PERMISOS_APLICAN = {"CNG", "MRP", "URV", "ERG", "INT", "CIR"}   # CIR: confirmado por Giuliana (25/09/2026) que aplica
PERMISOS_NO_APLICAN = {"MPW", "PNT", "PNW", "CON", "C0N", "TRA", "ESC"}


def tipo_permiso(codigo: str) -> str:
    m = re.search(r"([A-Z0-9]{3})\s*$", (codigo or "").strip().upper())
    t = m.group(1) if m else ""
    return t if re.search(r"[A-Z]", t) else ""


def permiso_aplica(codigo: str):
    """True = aplica al subsidio · False = no aplica · None = tipo no clasificado."""
    t = tipo_permiso(codigo)
    if t in PERMISOS_APLICAN:
        return True
    if t in PERMISOS_NO_APLICAN:
        return False
    return None


def _vencida(vig) -> bool:
    import datetime as _dt
    m = re.match(r"(\d{2})/(\d{2})/(\d{4})", str(vig or ""))
    if not m:
        return False
    try:
        return _dt.date(int(m.group(3)), int(m.group(2)), int(m.group(1))) < _dt.date.today()
    except Exception:
        return False


def autorizacion_activa(a: dict) -> bool:
    return bool(a.get("habilitado")) and not _vencida(a.get("vigente_hasta"))


def unidades_para_subsidio(data: dict) -> list:
    """Una fila por PLACA (sin repetir) con la autorización que la rige:
      1º permisos activos que aplican · 2º activos no clasificados · 3º activos que no aplican ·
      luego los vencidos/no habilitados en el mismo orden.
    Cada fila trae `permiso`, `permiso_aplica` (True/False/None) y `autorizacion` (código)."""
    auts = list((data or {}).get("autorizaciones") or [])

    def _peso(a):
        ap = a.get("permiso_aplica")
        return (0 if autorizacion_activa(a) else 1, 0 if ap is True else (1 if ap is None else 2), -int(a.get("total_unidades") or 0))
    auts.sort(key=_peso)
    out, vistas = [], set()
    for a in auts:
        for v in a.get("vehiculos", []) or []:
            pn = (v.get("placa") or "").replace("-", "").replace(" ", "").upper()
            if not pn or pn in vistas:
                continue
            vistas.add(pn)
            out.append({**v, "autorizacion": a.get("codigo") or "", "permiso": a.get("tipo_permiso") or tipo_permiso(a.get("codigo")),
                        "permiso_aplica": a.get("permiso_aplica", permiso_aplica(a.get("codigo"))),
                        "autorizacion_activa": autorizacion_activa(a), "vigente_hasta": a.get("vigente_hasta"),
                        "modalidad": a.get("modalidad") or "", "razon_social": a.get("razon_social") or ""})
    return out


def _clean(fragment: str) -> str:
    txt = re.sub(r"<[^>]+>", "", fragment or "")
    txt = _html.unescape(txt)
    return re.sub(r"\s+", " ", txt).strip()


def _token(html_text: str, name: str) -> str:
    m = re.search(r'name="%s"[^>]*value="([^"]*)"' % re.escape(name), html_text)
    return m.group(1) if m else ""


def _tokens(html_text: str) -> dict:
    return {
        "__VIEWSTATE": _token(html_text, "__VIEWSTATE"),
        "__VIEWSTATEGENERATOR": _token(html_text, "__VIEWSTATEGENERATOR"),
        "__EVENTVALIDATION": _token(html_text, "__EVENTVALIDATION"),
    }


def _validar(tipo: str, valor: str):
    n = len(valor)
    if tipo == "ruc" and n != 11:
        raise MtcError("El RUC debe tener 11 dígitos")
    if tipo == "placa" and n != 6:
        raise MtcError("La placa debe tener 6 caracteres")
    if tipo == "constancia" and n != 9:
        raise MtcError("La constancia debe tener 9 caracteres")


def _parse_detalle(html_text: str) -> dict:
    html_text = re.sub(r"<style.*?</style>", "", html_text, flags=re.S)
    html_text = re.sub(r"<script.*?</script>", "", html_text, flags=re.S)
    info: dict = {}
    vehiculos = []
    # Posiciones por defecto (tabla estándar); se reemplazan por las de la cabecera real.
    cols = {"placa": 1, "constancia": 2, "categoria": 3, "chasis": 4, "anio": 5, "ejes": 6, "carga_util": 7, "peso_seco": 8}
    _nombres = {"placa": "placa", "constancia": "constancia", "categor": "categoria", "chasis": "chasis",
                "fabric": "anio", "ejes": "ejes", "carga": "carga_util", "peso": "peso_seco"}
    for tr in re.findall(r"<tr[^>]*>(.*?)</tr>", html_text, re.S):
        raw = [_clean(c) for c in re.findall(r"<t[dh][^>]*>(.*?)</t[dh]>", tr, re.S)]
        cells = [c for c in raw if c != ""]
        if not cells:
            continue
        # fila clave: valor  (ej. "Estado: | Habilitado")
        if len(cells) == 2 and cells[0].endswith(":"):
            info[cells[0][:-1].strip()] = cells[1]
            continue
        # cabecera de la tabla de unidades: mapea cada columna por su nombre
        if len(cells) >= 6 and not re.fullmatch(r"\d+", cells[0]) and any("placa" in c.lower() for c in cells):
            for idx, c in enumerate(raw):
                cl = c.lower()
                for clave, campo in _nombres.items():
                    if clave in cl:
                        cols[campo] = idx
                        break
            continue
        # fila de vehículo: empieza con número de ítem. Se leen las celdas SIN descartar las
        # vacías (una autorización sin N° Constancia dejaba la columna vacía y corría todo:
        # el chasis quedaba como categoría y la unidad salía "no subsidiable").
        if len(raw) >= 7 and re.fullmatch(r"\d+", raw[0].strip()):
            def _col(campo):
                i = cols.get(campo)
                return raw[i] if i is not None and i < len(raw) else ""
            vehiculos.append({
                "item": raw[0].strip(),
                "placa": _col("placa"),
                "constancia": _col("constancia"),
                "categoria": _col("categoria"),
                "chasis": _col("chasis"),
                "anio": _col("anio"),
                "ejes": _col("ejes"),
                "carga_util": _col("carga_util"),
                "peso_seco": _col("peso_seco"),
            })

    razon = info.get("Razón Social", "") or info.get("Razon Social", "")
    codigo, nombre = "", razon
    if " - " in razon:
        codigo, nombre = razon.split(" - ", 1)
    estado = info.get("Estado", "")
    vigente = info.get("Vigente Hasta", "")
    return {
        "codigo": codigo.strip(),
        "tipo_permiso": tipo_permiso(codigo),
        "permiso_aplica": permiso_aplica(codigo),
        "razon_social": nombre.strip(),
        "ruc": info.get("Número de R.U.C.", "") or info.get("Numero de R.U.C.", ""),
        "direccion": info.get("Dirección", "") or info.get("Direccion", ""),
        "ciudad_inscripcion": info.get("Ciudad en la que se inscribio", ""),
        "personeria": info.get("Tipo de Personería", "") or info.get("Tipo de Personeria", ""),
        "modalidad": info.get("Modalidad de Empresa", ""),
        "estado": estado,
        "habilitado": estado.strip().lower() == "habilitado",
        "vigente_hasta": vigente,
        "total_unidades": len(vehiculos),
        "vehiculos": vehiculos,
    }


async def _consultar_via(proxy: Optional[str], tipo: str, valor: str, opc: str) -> dict:
    async with httpx.AsyncClient(timeout=_MTC_TIMEOUT, verify=False, follow_redirects=True,
                                 headers={"User-Agent": UA}, proxy=proxy) as client:
        # 1) tokens del formulario
        r0 = await client.get(FORM)
        payload = {
            **_tokens(r0.text),
            "rbOpciones": opc, "txtValor": valor,
            "hdopcion": opc, "hdvalore": valor, "hdopc": opc,
            "btnBuscar": "Buscar",
        }
        # 2) lista de coincidencias
        r1 = await client.post(DISPLAY, data=payload, headers={"Referer": FORM})
        disp = r1.text
        codes = re.findall(r"toDetalle\('([^']+)','([^']+)'\)", disp)
        if not codes:
            # ¿mensaje de "no se encontró"?
            return {"tipo": tipo, "valor": valor, "total_autorizaciones": 0, "autorizaciones": []}

        # 3) detalle de cada autorización — en PARALELO (empresas grandes tienen decenas de
        #    autorizaciones; secuencial se demora demasiado). Semáforo para no saturar al MTC.
        disp_tokens = _tokens(disp)
        sem = asyncio.Semaphore(10)

        async def _detalle(cod, rc):
            dd = {**disp_tokens, "hdpartida": cod, "hdruc": rc}
            async with sem:
                r2 = await client.post(DATOS, data=dd, headers={"Referer": DISPLAY})
            return _parse_detalle(r2.text)

        resultados = await asyncio.gather(*[_detalle(cod, rc) for cod, rc in codes],
                                          return_exceptions=True)
        autorizaciones = []
        for det in resultados:
            if isinstance(det, Exception):
                continue
            # descartar autorizaciones vacías (código sin datos)
            nombre = (det.get("razon_social") or "").strip()
            if (nombre and nombre != "-") or det.get("vehiculos"):
                autorizaciones.append(det)

    # ordenar: activas (habilitadas y vigentes) primero, entre ellas las que APLICAN al
    # subsidio, luego por más unidades
    autorizaciones.sort(key=lambda a: (not autorizacion_activa(a),
                                       0 if a.get("permiso_aplica") is True else (1 if a.get("permiso_aplica") is None else 2),
                                       -a["total_unidades"]))
    return {
        "tipo": tipo,
        "valor": valor,
        "total_autorizaciones": len(autorizaciones),
        "autorizaciones": autorizaciones,
    }


async def consultar(tipo: str, valor: str) -> dict:
    """
    Consulta la DGTT del MTC. tipo ∈ {ruc, placa, partida, constancia}.
    Devuelve las autorizaciones encontradas con su detalle (estado, vigencia, placas).

    Intenta primero la conexión directa; si el MTC bloquea la IP (o el proxy configurado
    está caído), reintenta a través de MTC_PROXY cuando exista. Antes se usaba el proxy de
    forma exclusiva y ciega: si ese proxy fallaba, TODA consulta al MTC fallaba en silencio
    aunque la conexión directa funcionara.
    """
    tipo = (tipo or "").strip().lower()
    valor = (valor or "").strip().upper()
    if tipo not in OPCIONES:
        raise MtcError("Tipo de búsqueda inválido (use ruc, placa, partida o constancia)")
    if not valor:
        raise MtcError("Ingrese el valor a buscar")
    _validar(tipo, valor)
    opc = OPCIONES[tipo]

    try:
        return await _consultar_via(None, tipo, valor, opc)
    except httpx.RequestError:
        if not _MTC_PROXY:
            raise
        return await _consultar_via(_MTC_PROXY, tipo, valor, opc)
