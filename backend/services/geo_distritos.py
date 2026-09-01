"""Ubica departamento/provincia/distrito a partir de coordenadas GPS.

Usa los límites distritales del Perú (INEI, 1834 distritos) con un test
point-in-polygon (ray casting) y un pre-filtro por bounding box para que sea
rápido. Fuente correcta y completa: no depende del padrón OSINERGMIN (que está
desactualizado) ni de que Facilito devuelva el distrito (no lo hace).

Los grifos traen GPS real desde el mapa de Facilito, así que con esto el
distrito sale exacto para TODAS las estaciones.
"""
from __future__ import annotations
import json
import logging
import os

logger = logging.getLogger(__name__)

_GEOJSON = os.path.join(os.path.dirname(os.path.dirname(__file__)), "data", "peru_distrital.geojson")
_INDEX = None  # [(minx,miny,maxx,maxy, ring, props)]


def _cargar():
    global _INDEX
    if _INDEX is not None:
        return _INDEX
    _INDEX = []
    try:
        with open(_GEOJSON, encoding="utf-8") as f:
            gj = json.load(f)
    except Exception as e:  # pragma: no cover
        logger.warning(f"[geo_distritos] no se pudo cargar el geojson: {e}")
        return _INDEX
    for feat in gj.get("features", []):
        props = feat.get("properties", {}) or {}
        geom = feat.get("geometry", {}) or {}
        gtype = geom.get("type")
        coords = geom.get("coordinates") or []
        anillos = []
        if gtype == "Polygon" and coords:
            anillos.append(coords[0])                 # anillo exterior
        elif gtype == "MultiPolygon":
            for poly in coords:
                if poly:
                    anillos.append(poly[0])
        info = {
            "departamento": (props.get("NOMBDEP") or "").upper().strip(),
            "provincia": (props.get("NOMBPROV") or "").upper().strip(),
            "distrito": (props.get("NOMBDIST") or "").upper().strip(),
        }
        for ring in anillos:
            xs = [p[0] for p in ring]
            ys = [p[1] for p in ring]
            _INDEX.append((min(xs), min(ys), max(xs), max(ys), ring, info))
    logger.info(f"[geo_distritos] {len(_INDEX)} polígonos distritales cargados")
    return _INDEX


def _en_anillo(lon: float, lat: float, ring) -> bool:
    """Ray casting: ¿el punto (lon,lat) está dentro del anillo?"""
    inside = False
    n = len(ring)
    j = n - 1
    for i in range(n):
        xi, yi = ring[i][0], ring[i][1]
        xj, yj = ring[j][0], ring[j][1]
        if ((yi > lat) != (yj > lat)) and \
           (lon < (xj - xi) * (lat - yi) / ((yj - yi) or 1e-12) + xi):
            inside = not inside
        j = i
    return inside


def ubicar(lat, lon):
    """Devuelve {departamento, provincia, distrito} para unas coordenadas, o None."""
    if lat is None or lon is None:
        return None
    try:
        lat = float(lat); lon = float(lon)
    except (TypeError, ValueError):
        return None
    for minx, miny, maxx, maxy, ring, info in _cargar():
        if lon < minx or lon > maxx or lat < miny or lat > maxy:
            continue
        if _en_anillo(lon, lat, ring):
            return info
    return None
