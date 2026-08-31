import React from "react";
import { MapContainer, TileLayer, CircleMarker, Tooltip } from "react-leaflet";
import { MapPin } from "lucide-react";

// Centroides aproximados de los 24 departamentos + Callao (para ubicar el punto
// clicable en el mapa). Claves sin tildes/mayúsculas: se cruzan con la lista real
// de departamentos por un normalizador, así el filtro usa el nombre exacto.
const DEP_COORDS = {
  "AMAZONAS": [-5.1, -78.0], "ANCASH": [-9.4, -77.5], "APURIMAC": [-14.0, -72.9],
  "AREQUIPA": [-16.0, -72.0], "AYACUCHO": [-13.5, -74.0], "CAJAMARCA": [-6.6, -78.6],
  "CALLAO": [-12.05, -77.12], "CUSCO": [-13.4, -72.0], "HUANCAVELICA": [-12.9, -74.9],
  "HUANUCO": [-9.4, -76.1], "ICA": [-14.2, -75.6], "JUNIN": [-11.5, -75.0],
  "LA LIBERTAD": [-8.0, -78.4], "LAMBAYEQUE": [-6.4, -79.8], "LIMA": [-11.8, -76.8],
  "LORETO": [-4.0, -74.5], "MADRE DE DIOS": [-12.0, -70.7], "MOQUEGUA": [-17.0, -70.9],
  "PASCO": [-10.5, -75.5], "PIURA": [-5.2, -80.4], "PUNO": [-15.2, -70.1],
  "SAN MARTIN": [-7.0, -76.7], "TACNA": [-17.8, -70.2], "TUMBES": [-3.7, -80.4],
  "UCAYALI": [-9.5, -73.5],
};

const norm = (s) => (s || "").normalize("NFD").replace(new RegExp("[\\u0300-\\u036f]", "g"), "").toUpperCase().trim();

export default function MapaDepartamentos({ departamentos = [], onSelect }) {
  // Cruza la lista real de departamentos con las coordenadas conocidas.
  const puntos = departamentos
    .map((dep) => ({ dep, pos: DEP_COORDS[norm(dep)] }))
    .filter((x) => x.pos);
  // Si la lista viniera vacía, usamos las 25 conocidas como respaldo.
  const items = puntos.length ? puntos : Object.entries(DEP_COORDS).map(([dep, pos]) => ({ dep, pos }));

  return (
    <div className="space-y-3">
      <div className="bg-white border border-neutral-200 rounded-xl overflow-hidden shadow-sm" style={{ height: 520 }}>
        <MapContainer center={[-9.2, -75.2]} zoom={5} style={{ height: "100%", width: "100%" }} scrollWheelZoom>
          <TileLayer attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" subdomains="abc" maxZoom={19} />
          {items.map(({ dep, pos }) => (
            <CircleMarker key={dep} center={pos} radius={10}
              pathOptions={{ color: "#5A1FB8", fillColor: "#8039F4", fillOpacity: 0.9, weight: 2 }}
              eventHandlers={{ click: () => onSelect?.(dep) }}>
              <Tooltip direction="top" offset={[0, -6]}>{dep}</Tooltip>
            </CircleMarker>
          ))}
        </MapContainer>
      </div>

      {/* Lista de apoyo: los mismos departamentos como botones (por si el mapa no es cómodo). */}
      <div className="flex flex-wrap gap-2">
        {items.map(({ dep }) => (
          <button key={dep} onClick={() => onSelect?.(dep)}
            className="text-xs font-semibold px-3 py-1.5 rounded-full border border-neutral-200 text-neutral-700 hover:border-brand hover:text-brand hover:bg-brand/5 transition-colors flex items-center gap-1">
            <MapPin className="w-3 h-3" /> {dep}
          </button>
        ))}
      </div>
    </div>
  );
}
