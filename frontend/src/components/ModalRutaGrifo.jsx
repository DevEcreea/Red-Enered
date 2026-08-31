import React, { useEffect, useState } from "react";
import { MapContainer, TileLayer, Marker, Polyline, Popup } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { api } from "../lib/api";
import { X, Navigation, Loader2, MapPin, Clock3, Route as RouteIcon, AlertTriangle, ChevronRight } from "lucide-react";

// Los íconos por defecto de Leaflet no cargan bien con bundlers; los definimos inline (SVG data-URI).
const pin = (color) => L.divIcon({
  className: "",
  html: `<svg width="30" height="40" viewBox="0 0 24 32" xmlns="http://www.w3.org/2000/svg">
    <path d="M12 0C5.4 0 0 5.4 0 12c0 8.5 12 20 12 20s12-11.5 12-20C24 5.4 18.6 0 12 0z" fill="${color}"/>
    <circle cx="12" cy="12" r="5" fill="#fff"/></svg>`,
  iconSize: [30, 40], iconAnchor: [15, 40], popupAnchor: [0, -38],
});
const ICONO_ORIGEN = pin("#2563EB");
const ICONO_GRIFO = pin("#7C3AED");

/** Ajusta el mapa para que se vean ambos puntos (o el camino completo). */
function encuadrar(map, puntos) {
  if (!map || !puntos.length) return;
  map.fitBounds(L.latLngBounds(puntos), { padding: [40, 40], maxZoom: 15 });
}

// "586 min" → "9 h 46 min"; hora de llegada = ahora + duración.
function fmtDuracion(min) {
  if (min == null) return "—";
  const h = Math.floor(min / 60), m = min % 60;
  return h > 0 ? `${h} h ${m} min` : `${m} min`;
}
function horaLlegada(min) {
  if (min == null) return "—";
  const t = new Date(Date.now() + min * 60000);
  return t.toLocaleTimeString("es-PE", { hour: "2-digit", minute: "2-digit", hour12: true });
}

// Costo por km REFERENCIAL — placeholder mientras se define la lógica real (combustible,
// rendimiento del vehículo, peajes, etc.). Editable en el modal para ir calibrando.
const COSTO_KM_DEFAULT = 2.50;

export default function ModalRutaGrifo({ grifo, onClose }) {
  const [modo, setModo] = useState("elegir");          // elegir | mapa
  const [estado, setEstado] = useState("ubicando");   // ubicando | calculando | ok | error
  const [error, setError] = useState("");
  const [origen, setOrigen] = useState(null);
  const [ruta, setRuta] = useState(null);             // { destino, distancia_km, duracion_min, camino }
  const [map, setMap] = useState(null);
  const [costoKm, setCostoKm] = useState(COSTO_KM_DEFAULT);

  const nombre = grifo.establecimiento || grifo.estacion || "Grifo";
  const consultaDir = `${nombre} ${grifo.direccion || ""} ${grifo.distrito || grifo.ciudad || ""} ${grifo.provincia || ""} peru`.replace(/\s+/g, " ").trim();

  const irAExterna = (app) => {
    const q = encodeURIComponent(consultaDir);
    const url = app === "waze"
      ? `https://waze.com/ul?q=${q}&navigate=yes`
      : `https://www.google.com/maps/dir/?api=1&destination=${q}`;
    window.open(url, "_blank");
    onClose();
  };

  const usarEstaApp = () => {
    setModo("mapa");
    if (!navigator.geolocation) {
      setEstado("error");
      setError("Tu navegador no permite compartir ubicación. Usa Google Maps o Waze.");
      return;
    }
    setEstado("ubicando");
    navigator.geolocation.getCurrentPosition(
      (pos) => calcular(pos.coords.latitude, pos.coords.longitude),
      () => {
        setEstado("error");
        setError("Necesitamos tu ubicación para trazar la ruta. Actívala o usa Google Maps / Waze.");
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  };

  const calcular = async (lat, lon) => {
    setOrigen({ lat, lon });
    setEstado("calculando");
    try {
      // Si el grifo ya trae coordenadas GPS reales (de Facilito), se usan directo — así la
      // ruta llega al grifo de verdad, no a una aproximación por dirección.
      const params = { origen_lat: lat, origen_lon: lon };
      if (grifo.lat != null && grifo.lon != null) {
        params.dest_lat = grifo.lat; params.dest_lon = grifo.lon;
      } else {
        params.direccion = grifo.direccion || "";
        params.distrito = grifo.distrito || grifo.ciudad || "";
        params.provincia = grifo.provincia || "";
        params.departamento = grifo.departamento || "";
      }
      const { data } = await api.get("/precios/ruta", { params, timeout: 30000 });
      setRuta(data);
      setEstado("ok");
    } catch (e) {
      setEstado("error");
      setError(e?.response?.data?.detail || "No pudimos calcular la ruta a este grifo.");
    }
  };

  useEffect(() => {
    if (estado !== "ok" || !map || !ruta) return;
    const pts = ruta.camino?.length ? ruta.camino
      : [origen && [origen.lat, origen.lon], ruta.destino && [ruta.destino.lat, ruta.destino.lon]].filter(Boolean);
    encuadrar(map, pts);
  }, [estado, map, ruta, origen]);

  const gmaps = () => irAExterna("gmaps");

  // ── Paso 1: elegir cómo navegar (como el diseño de referencia) ──
  if (modo === "elegir") {
    const Opt = ({ onClick, icon, titulo, sub, destacado }) => (
      <button onClick={onClick}
        className={`w-full flex items-center gap-3 p-3.5 rounded-xl border text-left transition-colors ${
          destacado ? "border-brand bg-brand/5 hover:bg-brand/10" : "border-neutral-200 hover:bg-neutral-50"}`}>
        <span className={`w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 ${destacado ? "bg-brand text-white" : "bg-neutral-100 text-neutral-600"}`}>{icon}</span>
        <span className="flex-1 min-w-0">
          <span className="block font-bold text-sm text-neutral-900">{titulo}</span>
          <span className="block text-xs text-neutral-500">{sub}</span>
        </span>
        <ChevronRight className="w-4 h-4 text-neutral-400 flex-shrink-0" />
      </button>
    );
    return (
      <div className="fixed inset-0 z-[1000] bg-black/50 flex items-center justify-center p-4" onClick={onClose}>
        <div className="bg-white rounded-2xl w-full max-w-md overflow-hidden shadow-2xl" onClick={(e) => e.stopPropagation()}>
          <div className="flex items-start justify-between p-4 border-b border-neutral-200">
            <div className="min-w-0">
              <h3 className="font-cabinet font-bold text-lg text-neutral-900">¿Vas a iniciar la ruta?</h3>
              <p className="text-xs text-neutral-500 mt-0.5">Elige cómo navegar hacia <b className="text-neutral-700">{nombre}</b>.</p>
            </div>
            <button onClick={onClose} className="p-1.5 hover:bg-neutral-100 rounded-lg flex-shrink-0"><X className="w-5 h-5" /></button>
          </div>
          <div className="p-4 space-y-2.5">
            <Opt onClick={usarEstaApp} destacado icon={<MapPin className="w-5 h-5" />}
              titulo="Continuar en esta App" sub="Ruta, distancia y tiempo dentro de ENERED" />
            <Opt onClick={() => irAExterna("gmaps")} icon={<Navigation className="w-5 h-5" />}
              titulo="Google Maps" sub="Navegación paso a paso" />
            <Opt onClick={() => irAExterna("waze")} icon={<Navigation className="w-5 h-5" />}
              titulo="Waze" sub="Navegación paso a paso" />
          </div>
          <div className="px-4 pb-4 text-[11px] text-neutral-400 leading-relaxed">
            Si usas una app externa, ENERED seguirá usando la información de la ruta para tus reportes.
          </div>
        </div>
      </div>
    );
  }

  // ── Paso 2: mapa embebido ──
  return (
    <div className="fixed inset-0 z-[1000] bg-black/50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl w-full max-w-3xl overflow-hidden shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-start justify-between p-4 border-b border-neutral-200">
          <div className="min-w-0">
            <div className="text-[11px] font-bold uppercase tracking-widest text-brand flex items-center gap-1.5">
              <Navigation className="w-3.5 h-3.5" /> Cómo llegar
            </div>
            <h3 className="font-cabinet font-bold text-lg text-neutral-900 truncate">{nombre}</h3>
            {grifo.direccion && <p className="text-xs text-neutral-500 truncate">{grifo.direccion}</p>}
          </div>
          <button onClick={onClose} className="p-1.5 hover:bg-neutral-100 rounded-lg flex-shrink-0"><X className="w-5 h-5" /></button>
        </div>

        {/* Métricas */}
        {estado === "ok" && (
          <>
            <div className="grid grid-cols-3 divide-x divide-neutral-200 border-b border-neutral-200 bg-neutral-50">
              <div className="px-3 py-3 text-center">
                <div className="text-[10px] font-bold uppercase tracking-wider text-neutral-500 flex items-center justify-center gap-1"><RouteIcon className="w-3 h-3" /> Distancia</div>
                <div className="text-lg font-black text-neutral-900 mt-0.5">{ruta.distancia_km != null ? `${ruta.distancia_km} km` : "—"}</div>
              </div>
              <div className="px-3 py-3 text-center">
                <div className="text-[10px] font-bold uppercase tracking-wider text-neutral-500 flex items-center justify-center gap-1"><Clock3 className="w-3 h-3" /> Tiempo <span className="text-neutral-400 normal-case font-semibold">c/tráfico</span></div>
                <div className="text-lg font-black text-brand mt-0.5">{fmtDuracion(ruta.duracion_min)}</div>
              </div>
              <div className="px-3 py-3 text-center">
                <div className="text-[10px] font-bold uppercase tracking-wider text-neutral-500 flex items-center justify-center gap-1"><Clock3 className="w-3 h-3" /> Llegada</div>
                <div className="text-lg font-black text-neutral-900 mt-0.5">{horaLlegada(ruta.duracion_min)}</div>
              </div>
            </div>

            {/* Costo por km — referencial, editable (lógica final por definir) */}
            <div className="flex items-center gap-3 px-4 py-2.5 border-b border-neutral-200 bg-amber-50/60">
              <span className="text-[11px] font-bold text-amber-700 uppercase tracking-wider flex-shrink-0">Costo estimado</span>
              <div className="flex items-center gap-1 text-xs text-neutral-600">
                <span>S/</span>
                <input type="number" step="0.1" min="0" value={costoKm}
                  onChange={(e) => setCostoKm(parseFloat(e.target.value) || 0)}
                  className="w-16 h-7 px-2 border border-neutral-300 rounded-md text-center font-bold" />
                <span>/km</span>
              </div>
              <span className="text-neutral-300">×</span>
              <span className="text-xs text-neutral-600">{ruta.distancia_km != null ? `${ruta.distancia_km} km` : "—"}</span>
              <span className="text-neutral-300">=</span>
              <span className="text-base font-black text-neutral-900">
                {ruta.distancia_km != null ? `S/ ${(ruta.distancia_km * costoKm).toFixed(2)}` : "—"}
              </span>
              <button onClick={gmaps} className="ml-auto btn-brand px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 flex-shrink-0">
                <Navigation className="w-3.5 h-3.5" /> Abrir en Maps
              </button>
            </div>
          </>
        )}

        {/* Mapa / estados */}
        <div className="h-[420px] relative bg-neutral-100">
          {(estado === "ubicando" || estado === "calculando") && (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 text-neutral-500 z-[500]">
              <Loader2 className="w-7 h-7 animate-spin text-brand" />
              <div className="text-sm font-semibold">{estado === "ubicando" ? "Obteniendo tu ubicación…" : "Trazando la ruta…"}</div>
            </div>
          )}
          {estado === "error" && (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 text-center px-8 z-[500]">
              <AlertTriangle className="w-8 h-8 text-amber-500" />
              <div className="text-sm text-neutral-600 max-w-sm">{error}</div>
              <button onClick={gmaps} className="btn-brand px-4 py-2 rounded-lg text-sm font-bold flex items-center gap-1.5">
                <Navigation className="w-4 h-4" /> Abrir en Google Maps
              </button>
            </div>
          )}
          {estado === "ok" && origen && ruta?.destino && (
            <MapContainer center={[ruta.destino.lat, ruta.destino.lon]} zoom={13}
              style={{ height: "100%", width: "100%" }} ref={setMap} scrollWheelZoom>
              <TileLayer attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
                url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                subdomains="abc" maxZoom={19} />
              <Marker position={[origen.lat, origen.lon]} icon={ICONO_ORIGEN}>
                <Popup>Tu ubicación</Popup>
              </Marker>
              <Marker position={[ruta.destino.lat, ruta.destino.lon]} icon={ICONO_GRIFO}>
                <Popup><b>{nombre}</b>{grifo.direccion ? <><br />{grifo.direccion}</> : null}</Popup>
              </Marker>
              {ruta.camino?.length > 0 && (
                <Polyline positions={ruta.camino} pathOptions={{ color: "#7C3AED", weight: 5, opacity: 0.85 }} />
              )}
            </MapContainer>
          )}
        </div>

        <div className="px-4 py-2.5 text-[11px] text-neutral-400 flex items-center gap-1.5 border-t border-neutral-100">
          <MapPin className="w-3 h-3" />
          {grifo.lat != null && grifo.lon != null
            ? "Ubicación GPS de Facilito · Tiempo estimado con tráfico · Ruta por OpenStreetMap."
            : "Ubicación aproximada por la dirección del grifo · Tiempo estimado con tráfico · Ruta por OpenStreetMap."}
        </div>
      </div>
    </div>
  );
}
