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
import html as _html
from typing import Optional

import httpx

BASE = "https://www.mtc.gob.pe/tramitesenlinea/tweb_tLinea/tw_consultadgtt/"
FORM = BASE + "Frm_rep_intra_mercancia.aspx"
DISPLAY = BASE + "Frm_rep_intra_mercancia_display.aspx"
DATOS = BASE + "Frm_rep_intra_mercancia_datos.aspx"
UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120 Safari/537.36"

# Mapa de tipo de búsqueda -> valor del radio del formulario
OPCIONES = {"ruc": "2", "partida": "3", "placa": "4", "constancia": "5"}


class MtcError(Exception):
    pass


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
    for tr in re.findall(r"<tr[^>]*>(.*?)</tr>", html_text, re.S):
        cells = [_clean(c) for c in re.findall(r"<t[dh][^>]*>(.*?)</t[dh]>", tr, re.S)]
        cells = [c for c in cells if c != ""]
        if not cells:
            continue
        # fila clave: valor  (ej. "Estado: | Habilitado")
        if len(cells) == 2 and cells[0].endswith(":"):
            info[cells[0][:-1].strip()] = cells[1]
        # fila de vehículo: empieza con número de ítem y tiene 8+ columnas
        elif len(cells) >= 8 and re.fullmatch(r"\d+", cells[0]):
            vehiculos.append({
                "item": cells[0],
                "placa": cells[1],
                "constancia": cells[2],
                "categoria": cells[3],
                "chasis": cells[4] if len(cells) > 4 else "",
                "anio": cells[5] if len(cells) > 5 else "",
                "ejes": cells[6] if len(cells) > 6 else "",
                "carga_util": cells[7] if len(cells) > 7 else "",
                "peso_seco": cells[8] if len(cells) > 8 else "",
            })

    razon = info.get("Razón Social", "") or info.get("Razon Social", "")
    codigo, nombre = "", razon
    if " - " in razon:
        codigo, nombre = razon.split(" - ", 1)
    estado = info.get("Estado", "")
    vigente = info.get("Vigente Hasta", "")
    return {
        "codigo": codigo.strip(),
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


async def consultar(tipo: str, valor: str) -> dict:
    """
    Consulta la DGTT del MTC. tipo ∈ {ruc, placa, partida, constancia}.
    Devuelve las autorizaciones encontradas con su detalle (estado, vigencia, placas).
    """
    tipo = (tipo or "").strip().lower()
    valor = (valor or "").strip().upper()
    if tipo not in OPCIONES:
        raise MtcError("Tipo de búsqueda inválido (use ruc, placa, partida o constancia)")
    if not valor:
        raise MtcError("Ingrese el valor a buscar")
    _validar(tipo, valor)
    opc = OPCIONES[tipo]

    async with httpx.AsyncClient(timeout=45.0, verify=False, follow_redirects=True,
                                 headers={"User-Agent": UA}) as client:
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

        # 3) detalle de cada autorización
        disp_tokens = _tokens(disp)
        autorizaciones = []
        for cod, rc in codes:
            dd = {**disp_tokens, "hdpartida": cod, "hdruc": rc}
            r2 = await client.post(DATOS, data=dd, headers={"Referer": DISPLAY})
            det = _parse_detalle(r2.text)
            # descartar autorizaciones vacías (código sin datos)
            nombre = (det.get("razon_social") or "").strip()
            if (nombre and nombre != "-") or det.get("vehiculos"):
                autorizaciones.append(det)

    # ordenar: habilitadas primero, luego por más unidades
    autorizaciones.sort(key=lambda a: (not a["habilitado"], -a["total_unidades"]))
    return {
        "tipo": tipo,
        "valor": valor,
        "total_autorizaciones": len(autorizaciones),
        "autorizaciones": autorizaciones,
    }
