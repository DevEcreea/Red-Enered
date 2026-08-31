import React, { useEffect, useState } from "react";
import { MapContainer, GeoJSON, useMap } from "react-leaflet";

// Reajusta el tamaño y encuadre tras montar (evita el mapa en blanco cuando el
// contenedor aún no tenía dimensiones al renderizar).
function AjustarPeru({ bounds }) {
  const map = useMap();
  useEffect(() => {
    const t = setTimeout(() => { map.invalidateSize(); map.fitBounds(bounds); }, 200);
    return () => clearTimeout(t);
  }, [map, bounds]);
  return null;
}

const norm = (s) => (s || "").normalize("NFD").replace(new RegExp("[\\u0300-\\u036f]", "g"), "").toUpperCase().trim();

// Tonos de azul (como el mapa de Facilito). Se asigna uno estable por nombre.
const AZULES = ["#BBD6F2", "#9CC3EC", "#7FB0E6", "#5B97DB", "#3B82C4", "#2E6DAA"];
const colorDe = (nombre) => {
  let h = 0; const s = norm(nombre);
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  return AZULES[h % AZULES.length];
};

// Encajar el Perú en el recuadro (sin tiles, mapa plano).
const PERU_BOUNDS = [[-18.6, -81.6], [0.2, -68.5]];

export default function MapaDepartamentos({ departamentos = [], onSelect }) {
  const [geo, setGeo] = useState(null); // null=cargando, false=error, obj=ok

  useEffect(() => {
    fetch("/peru_departamentos.geojson")
      .then((r) => r.json())
      .then(setGeo)
      .catch(() => setGeo(false));
  }, []);

  // Nombre EXACTO de la lista real (para que el filtro de precios coincida).
  const nombreReal = (nombreMapa) => {
    const n = norm(nombreMapa);
    return departamentos.find((d) => norm(d) === n) || nombreMapa;
  };

  const style = (feature) => ({
    fillColor: colorDe(feature.properties.NOMBDEP),
    color: "#ffffff", weight: 1, fillOpacity: 0.9,
  });

  const onEach = (feature, layer) => {
    const nombre = feature.properties.NOMBDEP;
    layer.bindTooltip(nombre, { sticky: true, direction: "top" });
    layer.on({
      click: () => onSelect?.(nombreReal(nombre)),
      mouseover: (e) => e.target.setStyle({ fillOpacity: 1, weight: 2.5, color: "#5A1FB8" }),
      mouseout: (e) => e.target.setStyle({ fillOpacity: 0.9, weight: 1, color: "#ffffff" }),
    });
  };

  return (
    <div>
      <div className="bg-white border border-neutral-200 rounded-xl overflow-hidden shadow-sm relative" style={{ height: 560 }}>
        {geo === null && (
          <div className="absolute inset-0 flex items-center justify-center text-sm text-neutral-400 z-[500]">Cargando mapa…</div>
        )}
        {geo === false && (
          <div className="absolute inset-0 flex items-center justify-center text-sm text-neutral-400 z-[500]">No se pudo cargar el mapa. Usa la lista de abajo.</div>
        )}
        <MapContainer
          bounds={PERU_BOUNDS}
          style={{ height: "100%", width: "100%", background: "#ffffff" }}
          zoomControl={false} attributionControl={false}
          dragging={false} scrollWheelZoom={false} doubleClickZoom={false}
          boxZoom={false} keyboard={false} touchZoom={false}
        >
          <AjustarPeru bounds={PERU_BOUNDS} />
          {geo && geo.features && (
            <GeoJSON key="peru-dep" data={geo} style={style} onEachFeature={onEach} />
          )}
        </MapContainer>
      </div>
    </div>
  );
}
