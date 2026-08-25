import React, { useEffect, useMemo, useRef, useState } from "react";
import { MapContainer, TileLayer, Marker, Popup } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { api } from "../lib/api";
import { Loader2, MapPin } from "lucide-react";

/* Colores por nivel de precio (respecto al rango del resultado):
   verde = más barato, ámbar = medio, gris = más caro. Morado = mis unidades. */
const COL = { mejor: "#059669", medio: "#EA8104", caro: "#6B7280", enered: "#059669" };

// Pin por estación con su PRECIO visible: burbuja compacta coloreada por nivel
// (verde barato · ámbar medio · gris caro), ★ dorada si aplica ENERED. Compacta para
// apilarse lo menos posible; el detalle completo sale al hacer clic (Popup).
function pin(precio, color, estrella) {
  const p = precio != null ? Number(precio).toFixed(2) : "—";
  return L.divIcon({
    className: "",
    html: `<div style="transform:translate(-50%,-100%);white-space:nowrap;line-height:1;">
      <div style="background:${color};color:#fff;font-weight:800;font-size:10.5px;
        padding:2px 6px;border-radius:7px;box-shadow:0 2px 5px -1px rgba(0,0,0,.4);
        border:1.5px solid #fff;display:inline-flex;align-items:center;gap:3px;">
        ${estrella ? '<span style="color:#FDE047;font-size:9px">★</span>' : ""}${p}</div>
      <div style="width:0;height:0;margin:0 auto;border-left:4px solid transparent;
        border-right:4px solid transparent;border-top:5px solid ${color};"></div>
    </div>`,
    iconSize: [0, 0], iconAnchor: [0, 0], popupAnchor: [0, -8],
  });
}

export default function MapaGrifos({ filtros }) {
  const [grifos, setGrifos] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [pendientes, setPendientes] = useState(0);
  const [map, setMap] = useState(null);
  const timer = useRef(null);

  // Carga incremental: geocodifica pocos por request; reintenta hasta que no queden pendientes.
  useEffect(() => {
    let vivo = true;
    setCargando(true); setGrifos([]); setPendientes(0);
    const cargar = async () => {
      try {
        const { data } = await api.get("/precios/mapa", { params: { ...filtros }, timeout: 60000 });
        if (!vivo) return;
        setGrifos(data.grifos || []);
        setPendientes(data.pendientes || 0);
        setCargando(false);
        if (data.pendientes > 0) timer.current = setTimeout(cargar, 1500);
      } catch {
        if (vivo) { setCargando(false); }
      }
    };
    cargar();
    return () => { vivo = false; if (timer.current) clearTimeout(timer.current); };
  }, [filtros]);

  // Umbrales de color por terciles del precio visible.
  const nivel = useMemo(() => {
    const ps = grifos.map((g) => g.precio_venta).filter((x) => x != null).sort((a, b) => a - b);
    if (ps.length < 2) return () => "medio";
    const t1 = ps[Math.floor(ps.length / 3)], t2 = ps[Math.floor((2 * ps.length) / 3)];
    return (p) => (p <= t1 ? "mejor" : p >= t2 ? "caro" : "medio");
  }, [grifos]);

  // Cada estación se dibuja con su etiqueta de precio en su ubicación real. NUNCA se
  // agrupan en un contador: se quiere ver dónde está cada una (en zonas densas las
  // etiquetas se apilan, y se separan al hacer zoom). Solo se omiten las que no tienen
  // ninguna ubicación (quedan en la tabla).
  const conUbicacion = useMemo(
    () => grifos.filter((g) => g.lat != null && g.lon != null), [grifos]);
  const puntos = useMemo(
    () => conUbicacion.map((g) => [g.lat, g.lon]), [conUbicacion]);

  // Reencuadra el mapa cada vez que cambian los puntos visibles.
  useEffect(() => {
    if (!map || !puntos.length) return;
    map.fitBounds(L.latLngBounds(puntos), { padding: [50, 50], maxZoom: 14 });
    setTimeout(() => map.invalidateSize(), 100);
  }, [map, puntos]);

  const centro = grifos.length ? [grifos[0].lat, grifos[0].lon] : [-9.19, -75.02]; // Perú

  return (
    <div className="bg-white border border-neutral-200 rounded-xl overflow-hidden shadow-sm">
      <div className="px-4 py-2.5 border-b border-neutral-100 flex items-center justify-between">
        <span className="text-xs font-bold text-neutral-600 uppercase tracking-wider flex items-center gap-1.5">
          <MapPin className="w-3.5 h-3.5 text-brand" /> Red de grifos en el mapa
        </span>
        <span className="text-[11px] text-neutral-400">
          {cargando && !grifos.length ? "Ubicando grifos…" : `${grifos.length} grifos`}
          {pendientes > 0 && ` · cargando ${pendientes} más…`}
        </span>
      </div>

      <div className="h-[420px] relative bg-neutral-100">
        {cargando && grifos.length === 0 && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 text-neutral-500 z-[500]">
            <Loader2 className="w-7 h-7 animate-spin text-brand" />
            <div className="text-sm font-semibold">Ubicando los grifos en el mapa…</div>
            <div className="text-xs text-neutral-400">La primera vez tarda; luego es instantáneo.</div>
          </div>
        )}
        {!cargando && grifos.length === 0 && (
          <div className="absolute inset-0 flex items-center justify-center text-sm text-neutral-400 px-8 text-center z-[500]">
            No pudimos ubicar estos grifos en el mapa por su dirección. Prueba otro filtro.
          </div>
        )}
        <MapContainer center={centro} zoom={grifos.length ? 12 : 5}
          style={{ height: "100%", width: "100%" }} ref={setMap} scrollWheelZoom>
          <TileLayer attribution="&copy; OpenStreetMap &copy; CARTO"
            url="https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png"
            subdomains="abcd" maxZoom={20} />
          {/* Una etiqueta de precio por estación, en su ubicación real. */}
          {conUbicacion.map((g, i) => {
            const color = g.es_enered ? COL.enered : COL[nivel(g.precio_venta)];
            return (
              <Marker key={`g${i}`} position={[g.lat, g.lon]} icon={pin(g.precio_venta, color, g.es_enered)}>
                <Popup>
                  <b>{g.establecimiento}</b>
                  {g.direccion ? <><br />{g.direccion}</> : null}
                  <br />S/ {Number(g.precio_venta).toFixed(2)} · {g.combustible}
                  {g.es_enered && <><br /><span style={{ color: "#059669", fontWeight: 700 }}>★ Aplica ENERED</span></>}
                </Popup>
              </Marker>
            );
          })}
        </MapContainer>
      </div>

      {/* Leyenda */}
      <div className="px-4 py-2.5 flex flex-wrap items-center gap-x-4 gap-y-1.5 border-t border-neutral-100">
        {[["Mejor precio", COL.mejor], ["Medio", COL.medio], ["Más caro", COL.caro]].map(([t, c]) => (
          <span key={t} className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-neutral-600">
            <span style={{ background: c }} className="w-2.5 h-2.5 rounded-full" /> {t}
          </span>
        ))}
        <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-700">
          <span style={{ color: "#FDE047", background: COL.enered }} className="px-1 rounded text-[10px]">★</span> Aplica ENERED
        </span>
      </div>
    </div>
  );
}
