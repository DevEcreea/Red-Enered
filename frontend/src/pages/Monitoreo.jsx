import React, { useEffect, useState, useRef } from "react";
import { api } from "../lib/api";
import { useAuth } from "../context/AuthContext";
import ModuloBloqueado from "./ModuloBloqueado";
import {
  Loader2, AlertTriangle, RefreshCw, ExternalLink, Users, Building2,
  MapPin, Gauge, Clock, Truck, Plus, Power, Navigation, Route, Calendar, X, MessageCircle
} from "lucide-react";

import { MapContainer, TileLayer, Marker, Popup } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import L from "leaflet";

function fmtDate(ts) {
  if (!ts) return "—";
  try {
    const d = new Date(ts * 1000);
    const now = Date.now();
    const diff = Math.floor((now - d.getTime()) / 1000);
    if (diff < 60) return `hace ${diff} s`;
    if (diff < 3600) return `hace ${Math.floor(diff/60)} m`;
    if (diff < 86400) return `hace ${Math.floor(diff/3600)} h`;
    return d.toLocaleString("es-PE", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });
  } catch { return "—"; }
}

// Ícono personalizado para los marcadores en el mapa
const createUnitIcon = (course = 0, isMoving = false) => {
  const color = isMoving ? "#10B981" : "#F59E0B"; // Verde si se mueve, naranja si no
  return L.divIcon({
    className: "custom-wialon-marker",
    html: `
      <div style="
        width: 32px; height: 32px; 
        background: ${color}; 
        border: 2px solid white; 
        border-radius: 50%; 
        display: flex; align-items: center; justify-content: center;
        box-shadow: 0 2px 4px rgba(0,0,0,0.3);
      ">
        <div style="transform: rotate(${course}deg);">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <polygon points="3 11 22 2 13 21 11 13 3 11"></polygon>
          </svg>
        </div>
      </div>
    `,
    iconSize: [32, 32],
    iconAnchor: [16, 16],
  });
};

export default function Monitoreo() {
  const { user } = useAuth();
  const [state, setState] = useState({ loading: false, error: "", data: null });
  const [empresas, setEmpresas] = useState([]);
  const [selectedEmpresa, setSelectedEmpresa] = useState("");
  const [focusedUnit, setFocusedUnit] = useState(null);
  const [addresses, setAddresses] = useState({});
  const [showModal, setShowModal] = useState(false);

  // Modal form state
  const [formData, setFormData] = useState({ placa: "", fecha: "", direccion: "" });

  const isAdmin = user?.role === "admin_enered";
  const servicios = user?.servicios || {};
  const clienteHasGps = !isAdmin && servicios.gps === true;

  useEffect(() => {
    if (!isAdmin) return;
    api.get("/wialon/empresas").then(({ data }) => {
      setEmpresas(data || []);
      if ((data || []).length > 0) setSelectedEmpresa(data[0].empresa);
    }).catch(() => {});
  }, [isAdmin]);

  async function loadUnits(empresa) {
    setState({ loading: true, error: "", data: null });
    setFocusedUnit(null);
    try {
      const params = empresa ? { empresa } : {};
      const { data } = await api.get("/wialon/units", { params });
      setState({ loading: false, error: "", data });
    } catch (e) {
      setState({ loading: false, error: e.response?.data?.detail || "Error consultando Wialon", data: null });
    }
  }

  useEffect(() => { if (clienteHasGps) loadUnits(); }, [clienteHasGps]);
  useEffect(() => { if (isAdmin && selectedEmpresa) loadUnits(selectedEmpresa); }, [isAdmin, selectedEmpresa]);

  const data = state.data;
  const units = data?.units || [];
  const unitsWithPos = units.filter(u => u.lat != null && u.lon != null);

  // Lazy Geocoding con retraso para no bloquear a Nominatim (1 req/sec)
  useEffect(() => {
    if (unitsWithPos.length === 0) return;
    unitsWithPos.forEach((u, i) => {
      if (!addresses[u.id]) {
        setTimeout(() => {
          fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${u.lat}&lon=${u.lon}&zoom=18&addressdetails=1`)
            .then(res => res.json())
            .then(json => {
              setAddresses(prev => ({ ...prev, [u.id]: json.display_name || "Dirección desconocida" }));
            })
            .catch(() => {
              setAddresses(prev => ({ ...prev, [u.id]: "Error obteniendo dirección" }));
            });
        }, i * 1100);
      }
    });
  }, [unitsWithPos]); // eslint-disable-line

  if (!isAdmin && !clienteHasGps) {
    return <ModuloBloqueado titulo="Monitoreo · Wialon" descripcion="Tu empresa aún no tiene el servicio GPS con Wialon activado. Contacta a tu administrador ENERED para habilitarlo." />;
  }
  if (isAdmin && empresas.length === 0) {
    return <ModuloBloqueado titulo="Monitoreo · Wialon" descripcion="Aún no hay empresas con servicio GPS activo y token Wialon configurado. Ve a Admin › Empresas & Servicios para activarlas." ctaTexto="Ir a Empresas" ctaTo="/admin/empresas" />;
  }

  // Bounding box (para el mapa inicial)
  let center = [-9.19, -75.01]; // Peru centro por defecto
  let zoom = 5;
  if (focusedUnit && focusedUnit.lat != null) {
    center = [focusedUnit.lat, focusedUnit.lon];
    zoom = 16;
  } else if (unitsWithPos.length > 0) {
    const lats = unitsWithPos.map(u => u.lat);
    const lons = unitsWithPos.map(u => u.lon);
    center = [
      (Math.min(...lats) + Math.max(...lats)) / 2,
      (Math.min(...lons) + Math.max(...lons)) / 2
    ];
    zoom = unitsWithPos.length === 1 ? 14 : 5; // Ajuste básico
  }

  const handleAgendarWhatsApp = () => {
    const text = `¡Hola! Quiero agendar la instalación de un GPS.
Vehículo (Placa): ${formData.placa}
Fecha y Hora: ${formData.fecha}
Ubicación/Dirección: ${formData.direccion}`;
    window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, "_blank");
    setShowModal(false);
  };

  return (
    <div style={{ padding: "20px 24px", background: "#F5F7FA", minHeight: "100%" }} data-testid="monitoreo-page">
      {/* Header Premium */}
      <div style={{ background: "#fff", padding: "14px 20px", borderRadius: 12, boxShadow: "0 2px 8px rgba(0,0,0,.05)", display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 12, marginBottom: 16 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 20, flexWrap: "wrap" }}>
          <div>
            <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: ".1em", color: "#8B5CF6", textTransform: "uppercase" }}>MONITOREO · WIALON</div>
            <div style={{ fontSize: 18, fontWeight: 800, color: "#111827", marginTop: 2 }}>{isAdmin ? "Vista Administrador" : (user?.empresa || "—")}</div>
          </div>
          {isAdmin && (
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <Building2 style={{ width: 15, height: 15, color: "#6b7280" }} />
              <select value={selectedEmpresa} onChange={(e) => setSelectedEmpresa(e.target.value)} data-testid="wialon-empresa-select"
                style={{ padding: "8px 12px", border: "1px solid #E5E7EB", borderRadius: 8, background: "#fff", fontSize: 13.5, fontWeight: 500, minWidth: 240, cursor: "pointer", outline: "none" }}>
                {empresas.map((e) => <option key={e.empresa} value={e.empresa}>{e.empresa}</option>)}
              </select>
            </div>
          )}
          {data && (
            <div style={{ display: "flex", alignItems: "center", gap: 8, background: "#EDE9FE", padding: "8px 16px", borderRadius: 999, fontSize: 13, color: "#5B21B6" }}>
              <Users style={{ width: 16, height: 16 }} />
              <span style={{ fontWeight: 700 }}>{data.total}</span> unidades <span style={{ opacity: 0.5 }}>•</span> 
              <span style={{ fontWeight: 700 }}>{unitsWithPos.length}</span> con GPS activo
            </div>
          )}
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <button onClick={() => setShowModal(true)} 
            style={{ padding: "8px 14px", background: "#fff", border: "1px solid #E5E7EB", borderRadius: 8, cursor: "pointer", fontSize: 13, fontWeight: 600, color: "#374151", display: "inline-flex", alignItems: "center", gap: 6 }}>
            <Plus style={{ width: 16, height: 16 }} /> Agregar Unidad
          </button>
          <button onClick={() => loadUnits(isAdmin ? selectedEmpresa : undefined)} data-testid="btn-wialon-refresh"
            style={{ padding: "8px 14px", background: "#fff", border: "1px solid #E5E7EB", borderRadius: 8, cursor: "pointer", fontSize: 13, fontWeight: 500, color: "#374151", display: "inline-flex", alignItems: "center", gap: 6 }}>
            <RefreshCw style={{ width: 14, height: 14 }} /> Actualizar
          </button>
          <a href="https://hosting.wialon.us" target="_blank" rel="noreferrer" data-testid="btn-wialon-newtab"
            style={{ padding: "8px 16px", background: "#3B82F6", color: "#fff", border: "none", borderRadius: 8, textDecoration: "none", fontSize: 13, fontWeight: 600, display: "inline-flex", alignItems: "center", gap: 6, transition: "background 0.2s" }}>
            <ExternalLink style={{ width: 16, height: 16 }} /> Gestión avanzada de flota
          </a>
        </div>
      </div>

      {state.loading && (
        <div style={{ background: "#fff", borderRadius: 12, padding: 60, textAlign: "center", color: "#6b7280" }}>
          <Loader2 style={{ width: 32, height: 32, animation: "spin 1s linear infinite", color: "#3B82F6", margin: "0 auto" }} />
          <div style={{ marginTop: 12, fontWeight: 500 }}>Consultando posiciones en Wialon…</div>
        </div>
      )}

      {state.error && !state.loading && (
        <div style={{ background: "#FEF2F2", border: "1px solid #FECACA", borderRadius: 12, padding: 24, color: "#991B1B" }}>
          <AlertTriangle style={{ width: 20, height: 20, display: "inline", verticalAlign: -3, marginRight: 6 }} />
          <strong>Error:</strong> {state.error}
          <button onClick={() => loadUnits(isAdmin ? selectedEmpresa : undefined)} style={{ marginLeft: 12, padding: "6px 12px", background: "#DC2626", color: "#fff", border: "none", borderRadius: 6, cursor: "pointer", fontSize: 13, fontWeight: 600 }}>
            Reintentar
          </button>
        </div>
      )}

      {data && !state.loading && !state.error && (
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1.6fr", gap: 16, height: "calc(100vh - 180px)" }}>
          {/* PANEL LATERAL: LISTA DE UNIDADES (IZQUIERDA) */}
          <div style={{ background: "#fff", borderRadius: 12, boxShadow: "0 2px 8px rgba(0,0,0,.05)", overflow: "hidden", display: "flex", flexDirection: "column" }}>
            <div style={{ padding: "14px 20px", borderBottom: "1px solid #F3F4F6", fontWeight: 700, color: "#111827", fontSize: 14, display: "flex", alignItems: "center", gap: 8, background: "#FAFAFA" }}>
              <Truck style={{ width: 16, height: 16, color: "#8B5CF6" }}/>
              Directorio de Unidades
            </div>
            
            <div style={{ overflowY: "auto", flex: 1, padding: 12, display: "flex", flexDirection: "column", gap: 12 }}>
              {units.map((u) => {
                const hasPos = u.lat != null && u.lon != null;
                const isFocused = focusedUnit?.id === u.id;
                const speed = Math.round(u.speed || 0);
                const rawOdo = u.odometer || 0;
                const kilometraje = rawOdo > 500000 ? Math.round(rawOdo / 1000) : Math.round(rawOdo);
                
                return (
                  <div key={u.id} onClick={() => hasPos && setFocusedUnit(isFocused ? null : u)}
                    style={{
                      padding: "16px", 
                      borderBottom: "1px solid #F3F4F6",
                      cursor: hasPos ? "pointer" : "default",
                      background: isFocused ? "#F9FAFB" : "#fff",
                      transition: "all 0.15s ease",
                    }}>
                    
                    {/* Row 1: Placa & Speed */}
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <Navigation style={{ width: 16, height: 16, color: isMoving ? "#10B981" : "#6B7280", transform: `rotate(${u.course || 0}deg)`, fill: isMoving ? "#10B981" : "#6B7280" }} />
                        <div style={{ display: "flex", alignItems: "baseline", gap: 6 }}>
                          <span style={{ fontWeight: 800, color: "#111827", fontSize: 15 }}>{u.name}</span>
                          <span style={{ color: "#3B82F6", fontSize: 13, fontWeight: 700 }}>KM: {kilometraje}</span>
                        </div>
                      </div>
                      <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 14, color: "#374151", fontWeight: 700 }}>
                        {(speed > 80 || (!u.ignition && speed > 3)) && <AlertTriangle style={{ width: 14, height: 14, color: "#EF4444", fill: "#EF4444" }} />}
                        {speed} <span style={{ textTransform: "none", fontWeight: 500 }}>Km/H</span>
                      </div>
                    </div>

                    {/* Row 2: Conductor & Time */}
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10, paddingLeft: 24 }}>
                      <div style={{ fontSize: 13 }}>
                        <span style={{ fontWeight: 800, color: "#111827" }}>Conductor Asignado</span> <span style={{ color: "#6B7280", marginLeft: 4 }}>—</span>
                      </div>
                      <div style={{ display: "flex", alignItems: "center", gap: 4, color: "#9CA3AF", fontSize: 12 }}>
                        <Clock style={{ width: 13, height: 13 }} />
                        <span>{hasPos ? (isMoving ? "En vivo" : fmtDate(u.timestamp).replace("hace ", "")) : "Sin señal"}</span>
                      </div>
                    </div>

                    {/* Row 3 & 4: Timeline Addresses */}
                    <div style={{ display: "flex", gap: 8, marginBottom: 8, paddingLeft: 24 }}>
                      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", width: 12, marginTop: 4 }}>
                        <div style={{ width: 10, height: 10, borderRadius: "50%", border: "2px solid #D1D5DB", background: "transparent" }} />
                        <div style={{ width: 1, height: 14, background: "#E5E7EB", margin: "2px 0" }} />
                        <MapPin style={{ width: 12, height: 12, color: "#D1D5DB" }} />
                      </div>
                      <div style={{ display: "flex", flexDirection: "column", gap: 6, flex: 1, fontSize: 12.5, color: "#6B7280" }}>
                        <div style={{ display: "flex", justifyContent: "space-between", gap: 8 }}>
                          <span style={{ whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", flex: 1 }}>Punto de partida desconocido</span>
                          <span style={{ fontSize: 11, color: "#9CA3AF" }}>En vivo</span>
                        </div>
                        <div style={{ whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", color: "#374151" }}>
                          {addresses[u.id] || (hasPos ? "Cargando ubicación..." : "Desconocida")}
                        </div>
                      </div>
                    </div>

                    {/* Row 5: Stats */}
                    <div style={{ paddingLeft: 44, display: "flex", alignItems: "center", gap: 6, fontSize: 10, color: "#111827", fontWeight: 800 }}>
                      {kilometraje} km <span style={{ color: "#E5E7EB", fontWeight: 400 }}>|</span> 
                      — <span style={{ color: "#E5E7EB", fontWeight: 400 }}>|</span> 
                      — <span style={{ color: "#E5E7EB", fontWeight: 400 }}>|</span> 
                      ETA — 
                      <RefreshCw style={{ width: 10, height: 10, color: "#9CA3AF", marginLeft: 2 }} />
                    </div>
                  </div>
                );
              })}
              {units.length === 0 && (
                <div style={{ padding: 40, textAlign: "center", color: "#9ca3af", fontSize: 13.5 }}>No hay unidades registradas</div>
              )}
            </div>
          </div>

          {/* MAPA INTERACTIVO NATIVO (DERECHA) */}
          <div style={{ background: "#fff", borderRadius: 12, overflow: "hidden", boxShadow: "0 2px 8px rgba(0,0,0,.05)", position: "relative", zIndex: 1 }}>
            <div style={{ position: "absolute", top: 12, left: 12, right: 12, zIndex: 1000, display: "flex", justifyContent: "space-between", pointerEvents: "none" }}>
              <div style={{ background: "rgba(255,255,255,0.9)", backdropFilter: "blur(4px)", padding: "8px 14px", borderRadius: 8, fontWeight: 700, color: "#111827", fontSize: 13, boxShadow: "0 2px 4px rgba(0,0,0,0.1)", pointerEvents: "auto" }}>
                <MapPin style={{ width: 15, height: 15, display: "inline", verticalAlign: -2, marginRight: 6, color: "#3B82F6" }}/>
                {focusedUnit ? focusedUnit.name : `Mapa en Vivo · ${unitsWithPos.length} unidades`}
              </div>
              {focusedUnit && (
                <button onClick={() => setFocusedUnit(null)} style={{ pointerEvents: "auto", background: "#fff", border: "1px solid #E5E7EB", borderRadius: 8, padding: "8px 12px", color: "#374151", cursor: "pointer", fontSize: 12, fontWeight: 600, boxShadow: "0 2px 4px rgba(0,0,0,0.1)" }}>
                  Ver todas las unidades
                </button>
              )}
            </div>
            
            {unitsWithPos.length > 0 ? (
              <MapContainer center={center} zoom={zoom} style={{ width: "100%", height: "100%" }}>
                <TileLayer
                  attribution='&copy; <a href="https://www.google.com/maps">Google Maps</a>'
                  url="https://mt1.google.com/vt/lyrs=p&x={x}&y={y}&z={z}"
                />
                {/* Trick to fly to center when focused unit changes */}
                <MapUpdater center={center} zoom={zoom} />
                
                {unitsWithPos.map(u => (
                  <Marker 
                    key={u.id} 
                    position={[u.lat, u.lon]} 
                    icon={createUnitIcon(u.course, (u.speed || 0) > 3)}
                    eventHandlers={{ click: () => setFocusedUnit(u) }}
                  >
                    <Popup>
                      <div style={{ fontWeight: 600, fontSize: 14 }}>{u.name}</div>
                      <div style={{ fontSize: 12, color: "#6b7280" }}>{(u.speed || 0)} km/h · {u.ignition ? "Encendido" : "Apagado"}</div>
                      <div style={{ fontSize: 11, marginTop: 4 }}>{addresses[u.id] || "Buscando dirección..."}</div>
                    </Popup>
                  </Marker>
                ))}
              </MapContainer>
            ) : (
              <div style={{ height: "100%", display: "flex", alignItems: "center", justifyContent: "center", color: "#9ca3af", flexDirection: "column", gap: 12 }}>
                <Navigation style={{ width: 48, height: 48, opacity: 0.3 }} />
                <span>Ninguna unidad reporta posición GPS actualmente</span>
              </div>
            )}
          </div>
        </div>
      )}

      {/* MODAL: Agregar Unidad (WhatsApp) */}
      {showModal && (
        <div style={{ position: "fixed", inset: 0, zIndex: 9999, display: "flex", alignItems: "center", justifyContent: "center", background: "rgba(0,0,0,0.5)", backdropFilter: "blur(4px)" }}>
          <div style={{ background: "#fff", width: 400, borderRadius: 16, overflow: "hidden", boxShadow: "0 20px 25px -5px rgba(0,0,0,0.1), 0 10px 10px -5px rgba(0,0,0,0.04)" }}>
            <div style={{ padding: "16px 20px", borderBottom: "1px solid #F3F4F6", display: "flex", justifyContent: "space-between", alignItems: "center", background: "#FAFAFA" }}>
              <div style={{ fontWeight: 700, fontSize: 15, color: "#111827", display: "flex", alignItems: "center", gap: 8 }}>
                <Calendar style={{ width: 18, height: 18, color: "#8B5CF6" }} />
                Agendar Instalación GPS
              </div>
              <button onClick={() => setShowModal(false)} style={{ background: "none", border: "none", cursor: "pointer", color: "#9CA3AF" }}>
                <X style={{ width: 20, height: 20 }} />
              </button>
            </div>
            <div style={{ padding: 24, display: "flex", flexDirection: "column", gap: 16 }}>
              <div>
                <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "#374151", marginBottom: 6 }}>Placa del Vehículo</label>
                <input 
                  type="text" 
                  placeholder="Ej: ABC-123" 
                  value={formData.placa}
                  onChange={(e) => setFormData({...formData, placa: e.target.value.toUpperCase()})}
                  style={{ width: "100%", padding: "10px 14px", border: "1px solid #D1D5DB", borderRadius: 8, fontSize: 14, outline: "none" }}
                />
              </div>
              <div>
                <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "#374151", marginBottom: 6 }}>Fecha y Hora Solicitada</label>
                <input 
                  type="datetime-local" 
                  value={formData.fecha}
                  onChange={(e) => setFormData({...formData, fecha: e.target.value})}
                  style={{ width: "100%", padding: "10px 14px", border: "1px solid #D1D5DB", borderRadius: 8, fontSize: 14, outline: "none" }}
                />
              </div>
              <div>
                <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "#374151", marginBottom: 6 }}>Dirección de Instalación</label>
                <input 
                  type="text" 
                  placeholder="Dirección exacta o referencia"
                  value={formData.direccion}
                  onChange={(e) => setFormData({...formData, direccion: e.target.value})}
                  style={{ width: "100%", padding: "10px 14px", border: "1px solid #D1D5DB", borderRadius: 8, fontSize: 14, outline: "none" }}
                />
              </div>
              <p style={{ fontSize: 12, color: "#6B7280", lineHeight: 1.5, background: "#F3F4F6", padding: 12, borderRadius: 8 }}>
                Esta información se enviará vía WhatsApp a nuestro equipo de operaciones para coordinar y confirmar la instalación.
              </p>
            </div>
            <div style={{ padding: "16px 24px", borderTop: "1px solid #F3F4F6", background: "#FAFAFA", display: "flex", justifyContent: "flex-end", gap: 12 }}>
              <button onClick={() => setShowModal(false)} style={{ padding: "8px 16px", background: "none", border: "none", color: "#6B7280", fontWeight: 600, fontSize: 14, cursor: "pointer" }}>
                Cancelar
              </button>
              <button onClick={handleAgendarWhatsApp} 
                disabled={!formData.placa || !formData.fecha}
                style={{ padding: "8px 16px", background: "#10B981", color: "#fff", border: "none", borderRadius: 8, fontWeight: 600, fontSize: 14, cursor: "pointer", display: "flex", alignItems: "center", gap: 8, opacity: (!formData.placa || !formData.fecha) ? 0.5 : 1 }}>
                <MessageCircle style={{ width: 16, height: 16 }} /> Agendar vía WhatsApp
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// Componente helper para actualizar la vista del mapa cuando cambia el centro
import { useMap } from "react-leaflet";
function MapUpdater({ center, zoom }) {
  const map = useMap();
  useEffect(() => {
    map.flyTo(center, zoom, { duration: 0.8 });
  }, [center, zoom, map]);
  return null;
}
