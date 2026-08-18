"""
Validador automático de facturas de combustible (DU 004-2026).

Replica —antes de presentar el expediente— las validaciones que la ATU hace a mano,
para que el transportista sepa AL INSTANTE si su factura será aceptada y por qué no.

Cada factura queda clasificada como:
  CONFORME   → pasó todo, no requiere revisión humana
  OBSERVADA  → algo no cuadra pero es corregible (se explica el motivo)
  RECHAZADA  → no califica para el subsidio (fuera de periodo, placa ajena, etc.)
"""
from __future__ import annotations
import re
from datetime import date, datetime
from typing import Optional

# Periodo de compra reconocido por el DU 004-2026 (según plataforma ATU).
PERIODO_INICIO = date(2026, 5, 29)
PERIODO_FIN = date(2026, 7, 29)

# Tope de galones por categoría de unidad habilitada (DU 004-2026).
TOPES_GALONES = {"M2": 674.65, "M3": 1915.41, "N1": 552.52, "N2": 888.45, "N3": 1412.54}

# Combustibles reconocidos para el subsidio.
_PRODUCTO_OK = re.compile(r"DIES?EL|DB5|B5|S-?50|GASOHOL|GASOLINA", re.IGNORECASE)


def _norm_placa(p: Optional[str]) -> str:
    return re.sub(r"[^A-Z0-9]", "", (p or "").upper())


def _parse_fecha(v) -> Optional[date]:
    if isinstance(v, date):
        return v
    s = str(v or "").strip()[:10]
    for fmt in ("%Y-%m-%d", "%d/%m/%Y", "%d-%m-%Y"):
        try:
            return datetime.strptime(s, fmt).date()
        except ValueError:
            continue
    return None


def _check(codigo: str, nombre: str, ok: Optional[bool], detalle: str, bloqueante: bool = False) -> dict:
    return {"codigo": codigo, "nombre": nombre, "ok": ok, "detalle": detalle, "bloqueante": bloqueante}


def validar_factura(doc: dict, *, placas_flota: set[str] | None = None,
                    categoria_por_placa: dict[str, str] | None = None,
                    numeros_existentes: set[tuple] | None = None) -> dict:
    """
    Valida una factura ya extraída (por OCR/QR/XML) contra las reglas del DU 004-2026.

    doc: {fecha, placa, producto, galones, importe_total, numero_documento, ruc_emisor, ...}
    placas_flota: placas del transportista (normalizadas)
    categoria_por_placa: {placa_normalizada: "N3"} para validar el tope
    numeros_existentes: {(ruc_emisor, numero_documento)} ya cargados → detecta duplicados
    """
    placas_flota = placas_flota or set()
    categoria_por_placa = categoria_por_placa or {}
    numeros_existentes = numeros_existentes or set()
    checks: list[dict] = []

    # 1) Datos mínimos legibles
    faltantes = [k for k in ("fecha", "numero_documento", "galones") if not doc.get(k)]
    checks.append(_check(
        "datos_completos", "Datos legibles en la factura", not faltantes,
        "Se leyeron los datos principales." if not faltantes
        else f"No se pudo leer: {', '.join(faltantes)}. Revisa la calidad del archivo.",
    ))

    # 2) Periodo de compra permitido
    f = _parse_fecha(doc.get("fecha"))
    if f is None:
        checks.append(_check("periodo", "Fecha dentro del periodo DU 004", None,
                             "No se pudo leer la fecha de emisión."))
    else:
        dentro = PERIODO_INICIO <= f <= PERIODO_FIN
        checks.append(_check(
            "periodo", "Fecha dentro del periodo DU 004", dentro,
            f"Emitida el {f.strftime('%d/%m/%Y')}." if dentro
            else f"Emitida el {f.strftime('%d/%m/%Y')}: fuera del periodo permitido "
                 f"({PERIODO_INICIO.strftime('%d/%m/%Y')} – {PERIODO_FIN.strftime('%d/%m/%Y')}).",
            bloqueante=True,
        ))

    # 3) La placa pertenece a la flota del transportista
    placa = _norm_placa(doc.get("placa"))
    if not placa:
        checks.append(_check("placa_presente", "Placa indicada en la factura", False,
                             "La factura no muestra la placa. La ATU exige la placa en la descripción.",
                             bloqueante=True))
    else:
        en_flota = placa in placas_flota if placas_flota else None
        checks.append(_check(
            "placa_flota", "La placa pertenece a tu flota", en_flota,
            f"Placa {doc.get('placa')} reconocida en tu flota." if en_flota
            else f"La placa {doc.get('placa')} no figura en tu flota." if en_flota is False
            else "No se pudo verificar la flota.",
            bloqueante=True,
        ))

    # 4) Categoría subsidiable + tope de galones
    cat = categoria_por_placa.get(placa)
    galones = doc.get("galones")
    try:
        galones = float(galones) if galones is not None else None
    except (TypeError, ValueError):
        galones = None
    if cat and cat not in TOPES_GALONES:
        checks.append(_check("categoria", "Categoría con derecho a subsidio", False,
                             f"La unidad es categoría {cat}: no recibe subsidio (solo M2, M3, N1, N2, N3).",
                             bloqueante=True))
    elif cat and galones:
        tope = TOPES_GALONES[cat]
        dentro = galones <= tope
        checks.append(_check(
            "tope_galones", "Galones dentro del tope de la categoría", dentro,
            f"{galones:,.2f} gal de {tope:,.2f} gal máx ({cat})." if dentro
            else f"{galones:,.2f} gal supera el tope de {tope:,.2f} gal de la categoría {cat}.",
        ))

    # 5) Producto reconocido
    prod = str(doc.get("producto") or "")
    if prod:
        ok = bool(_PRODUCTO_OK.search(prod))
        checks.append(_check("producto", "Combustible reconocido", ok,
                             prod if ok else f"'{prod}' no parece un combustible subsidiable."))

    # 6) Comprobante duplicado.
    #    Un mismo comprobante SÍ puede repetirse para varias placas (así lo exige la ATU:
    #    "una fila por placa"), por eso la clave incluye la placa.
    num = str(doc.get("numero_documento") or "").strip().upper()
    clave = (str(doc.get("ruc_emisor") or "").strip(), num, placa)
    if num:
        dup = clave in numeros_existentes
        checks.append(_check("duplicado", "Comprobante no duplicado", not dup,
                             "Sin duplicados." if not dup
                             else f"El comprobante {num} ya fue cargado para la placa {doc.get('placa')}.",
                             bloqueante=True))

    # ── Veredicto
    fallidos = [c for c in checks if c["ok"] is False]
    pendientes = [c for c in checks if c["ok"] is None]
    bloqueantes = [c for c in fallidos if c["bloqueante"]]
    if bloqueantes:
        estado = "RECHAZADA"
    elif fallidos or pendientes:
        estado = "OBSERVADA"
    else:
        estado = "CONFORME"

    return {
        "estado": estado,
        "checks": checks,
        "motivos": [c["detalle"] for c in fallidos] or ([c["detalle"] for c in pendientes] if pendientes else []),
        "requiere_revision": estado != "CONFORME",
    }
