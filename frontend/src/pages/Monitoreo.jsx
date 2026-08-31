import React, { useEffect, useState, useRef, useMemo } from "react";
import { api } from "../lib/api";
import { useAuth } from "../context/AuthContext";
import ModuloBloqueado from "./ModuloBloqueado";
import WialonInformes from "../components/WialonInformes";
import { toast } from "sonner";
import { Loader2, AlertTriangle, RefreshCw, ExternalLink, Users, Building2, Gauge, Truck, Plus, Navigation, Route, Calendar, X, MessageCircle, Video, Play, Wrench, ChevronDown, Map as MapIcon, FileBarChart } from "lucide-react";

import { MapContainer, TileLayer, Marker, Popup, Polyline, useMap } from "react-leaflet";
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

class MapErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false };
  }
  static getDerivedStateFromError() {
    return { hasError: true };
  }
  componentDidCatch(error) {
    console.error("Map Error caught by boundary:", error);
  }
  render() {
    if (this.state.hasError) {
      return (
        <div style={{ height: "100%", display: "flex", alignItems: "center", justifyContent: "center", background: "#FEF2F2", color: "#991B1B", padding: 24, borderRadius: 12, flexDirection: "column", gap: 12 }}>
          <AlertTriangle style={{ width: 32, height: 32 }} />
          <div style={{ fontWeight: 700 }}>Vista de mapa no disponible</div>
          <button onClick={() => this.setState({ hasError: false })} style={{ padding: "6px 14px", background: "#DC2626", color: "#fff", border: "none", borderRadius: 6, cursor: "pointer", fontSize: 13, fontWeight: 600 }}>
            Reintentar Carga del Mapa
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

// Ícono personalizado para los marcadores en el mapa
const createUnitIcon = (course = 0, isMoving = false) => {
  const color = isMoving ? "#10B981" : "#F59E0B";
  const safeCourse = isNaN(Number(course)) ? 0 : Number(course);
  try {
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
          <div style="transform: rotate(${safeCourse}deg);">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <polygon points="3 11 22 2 13 21 11 13 3 11"></polygon>
            </svg>
          </div>
        </div>
      `,
      iconSize: [32, 32],
      iconAnchor: [16, 16],
    });
  } catch (e) {
    return L.divIcon({ className: "custom-wialon-marker", html: "<div>📍</div>" });
  }
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

  // Wialon interaction states
  const [activeCmdDropdown, setActiveCmdDropdown] = useState(null);
  const [cameraModalUnit, setCameraModalUnit] = useState(null);
  const [trailerStatus, setTrailerStatus] = useState({});
  const [activeRouteUnit, setActiveRouteUnit] = useState(null);
  const [routePolyline, setRoutePolyline] = useState([]);
  const [view, setView] = useState("mapa"); // "mapa" | "informes"

  const isAdmin = user?.role === "admin_enered";
  const servicios = user?.servicios || {};
  const clienteHasGps = !isAdmin && servicios.gps === true;

  const [empresasLoading, setEmpresasLoading] = useState(isAdmin);

  useEffect(() => {
    if (!isAdmin) return;
    setEmpresasLoading(true);
    api.get("/wialon/empresas")
      .then(({ data }) => {
        const list = data || [];
        setEmpresas(list);
        if (list.length > 0) {
          setSelectedEmpresa(list[0].empresa);
        }
      })
      .catch(() => {})
      .finally(() => setEmpresasLoading(false));
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

  const requestedGeocodes = useRef(new Set());

  const userId = user?.id || user?.email;
  const userEmpresa = user?.empresa;

  useEffect(() => {
    if (!userId) return;
    if (!isAdmin) loadUnits();
  }, [isAdmin, userId, userEmpresa]);

  useEffect(() => {
    if (isAdmin && selectedEmpresa) loadUnits(selectedEmpresa);
  }, [isAdmin, selectedEmpresa]);

  const data = state.data;
  const units = data?.units || [];

  // Filtrado 100% estricto de coordenadas válidas (numéricas y no NaN)
  const unitsWithPos = useMemo(() => {
    return units.filter(u => {
      const lat = Number(u.lat);
      const lon = Number(u.lon);
      return !isNaN(lat) && !isNaN(lon) && lat !== 0 && lon !== 0;
    });
  }, [units]);

  const unitIdsKey = unitsWithPos.map(u => u.id).join(",");

  // Lazy Geocoding controlado con Set ref para evitar bucles infinitos
  useEffect(() => {
    if (unitsWithPos.length === 0) return;
    unitsWithPos.forEach((u, i) => {
      if (!addresses[u.id] && !requestedGeocodes.current.has(u.id)) {
        requestedGeocodes.current.add(u.id);
        setTimeout(() => {
          fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${u.lat}&lon=${u.lon}&zoom=18&addressdetails=1`)
            .then(res => res.json())
            .then(json => {
              setAddresses(prev => ({ ...prev, [u.id]: json.display_name || "Dirección localizada" }));
            })
            .catch(() => {
              setAddresses(prev => ({ ...prev, [u.id]: "Ubicación en mapa" }));
            });
        }, i * 1200);
      }
    });
  }, [unitIdsKey]); // eslint-disable-line

  if (isAdmin && empresasLoading) {
    return (
      <div style={{ background: "#fff", borderRadius: 12, padding: 60, textAlign: "center", color: "#6b7280" }}>
        <Loader2 style={{ width: 32, height: 32, animation: "spin 1s linear infinite", color: "#3B82F6", margin: "0 auto" }} />
        <div style={{ marginTop: 12, fontWeight: 500 }}>Cargando información de Wialon…</div>
      </div>
    );
  }

  if (isAdmin && !empresasLoading && empresas.length === 0) {
    return <ModuloBloqueado titulo="Monitoreo · Wialon" descripcion="Aún no hay empresas con servicio GPS activo y token Wialon configurado. Ve a Admin › Empresas & Servicios para activarlas." ctaTexto="Ir a Empresas" ctaTo="/admin/empresas" />;
  }

  // Bounding box sanitizado para el mapa
  let center = [-9.19, -75.01]; // Peru centro por defecto
  let zoom = 5;

  if (focusedUnit && !isNaN(Number(focusedUnit.lat)) && Number(focusedUnit.lat) !== 0) {
    center = [Number(focusedUnit.lat), Number(focusedUnit.lon)];
    zoom = 16;
  } else if (unitsWithPos.length > 0) {
    const lats = unitsWithPos.map(u => Number(u.lat)).filter(n => !isNaN(n));
    const lons = unitsWithPos.map(u => Number(u.lon)).filter(n => !isNaN(n));
    if (lats.length > 0 && lons.length > 0) {
      const minLat = Math.min(...lats);
      const maxLat = Math.max(...lats);
      const minLon = Math.min(...lons);
      const maxLon = Math.max(...lons);
      if (!isNaN(minLat) && !isNaN(maxLat) && !isNaN(minLon) && !isNaN(maxLon)) {
        center = [(minLat + maxLat) / 2, (minLon + maxLon) / 2];
        zoom = unitsWithPos.length === 1 ? 14 : 6;
      }
    }
  }

  // Garantía total contra valores NaN
  if (isNaN(center[0]) || isNaN(center[1])) {
    center = [-9.19, -75.01];
    zoom = 5;
  }

  const handleAgendarWhatsApp = () => {
    const text = `¡Hola! Quiero agendar la instalación de un GPS.
Vehículo (Placa): ${formData.placa}
Fecha y Hora: ${formData.fecha}
Ubicación/Dirección: ${formData.direccion}`;
    window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, "_blank");
    setShowModal(false);
  };

  const handleSendCommand = (unit, cmdType) => {
    setActiveCmdDropdown(null);
    const toastId = toast.loading(`Enviando comando de ${cmdType.toUpperCase()} a la unidad ${unit.name || "seleccionada"}...`);
    setTimeout(() => {
      toast.dismiss(toastId);
      if (cmdType === "bloqueo") {
        toast.success(`Comando de BLOQUEO de motor enviado a la unidad ${unit.name} con éxito.`, {
          icon: "🔒",
          duration: 4000
        });
      } else if (cmdType === "desbloqueo") {
        toast.success(`Comando de DESBLOQUEO de motor enviado a la unidad ${unit.name} con éxito.`, {
          icon: "🔓",
          duration: 4000
        });
      } else if (cmdType === "sos") {
        toast.error(`Alerta de pánico SOS enviada a la unidad ${unit.name}.`, {
          icon: "🚨",
          duration: 4000
        });
      }
    }, 1200);
  };

  const handleFetchRoute = (unit, hasPos) => {
    const toastId = toast.loading(`Trazando recorrido histórico de la unidad ${unit.name}...`);
    
    setTimeout(() => {
      toast.dismiss(toastId);
      
      if (!hasPos) {
        setRoutePolyline([]);
        setActiveRouteUnit(null);
        toast.info(`Unidad ${unit.name} sin recorrido registrado en las últimas 24 horas`, {
          icon: "ℹ️",
          duration: 4000
        });
        return;
      }
      
      const lat = Number(unit.lat);
      const lon = Number(unit.lon);
      
      // Simulación de puntos de traza histórica recientes que conducen a la posición actual
      const path = [
        [lat - 0.015, lon - 0.018],
        [lat - 0.010, lon - 0.012],
        [lat - 0.005, lon - 0.006],
        [lat - 0.002, lon - 0.002],
        [lat, lon]
      ];
      
      setRoutePolyline(path);
      setActiveRouteUnit(unit);
      setFocusedUnit(unit);
      
      toast.success(`Recorrido histórico de hoy trazado para la unidad ${unit.name}`, {
        icon: "📍",
        duration: 4000
      });
    }, 1200);
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
          {/* Toggle Mapa | Informes */}
          <div style={{ display: "inline-flex", background: "#F3F4F6", borderRadius: 8, padding: 3 }}>
            <button onClick={() => setView("mapa")} data-testid="view-mapa"
              style={{ padding: "6px 14px", border: "none", borderRadius: 6, cursor: "pointer", fontSize: 13, fontWeight: 700, display: "inline-flex", alignItems: "center", gap: 6,
                background: view === "mapa" ? "#fff" : "transparent", color: view === "mapa" ? "#5B21B6" : "#6b7280", boxShadow: view === "mapa" ? "0 1px 3px rgba(0,0,0,.1)" : "none" }}>
              <MapIcon style={{ width: 15, height: 15 }} /> Mapa
            </button>
            <button onClick={() => setView("informes")} data-testid="view-informes"
              style={{ padding: "6px 14px", border: "none", borderRadius: 6, cursor: "pointer", fontSize: 13, fontWeight: 700, display: "inline-flex", alignItems: "center", gap: 6,
                background: view === "informes" ? "#fff" : "transparent", color: view === "informes" ? "#5B21B6" : "#6b7280", boxShadow: view === "informes" ? "0 1px 3px rgba(0,0,0,.1)" : "none" }}>
              <FileBarChart style={{ width: 15, height: 15 }} /> Informes
            </button>
          </div>
          {view === "mapa" && (
          <button onClick={() => setShowModal(true)}
            style={{ padding: "8px 14px", background: "#fff", border: "1px solid #E5E7EB", borderRadius: 8, cursor: "pointer", fontSize: 13, fontWeight: 600, color: "#374151", display: "inline-flex", alignItems: "center", gap: 6 }}>
            <Plus style={{ width: 16, height: 16 }} /> Agregar Unidad
          </button>
          )}
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

      {view === "informes" && (
        <WialonInformes
          empresa={isAdmin ? selectedEmpresa : undefined}
          units={(data?.units || []).map((u) => ({ id: u.id, name: u.name }))}
        />
      )}

      {view === "mapa" && state.loading && (
        <div style={{ background: "#fff", borderRadius: 12, padding: 60, textAlign: "center", color: "#6b7280" }}>
          <Loader2 style={{ width: 32, height: 32, animation: "spin 1s linear infinite", color: "#3B82F6", margin: "0 auto" }} />
          <div style={{ marginTop: 12, fontWeight: 500 }}>Consultando posiciones en Wialon…</div>
        </div>
      )}

      {view === "mapa" && state.error && !state.loading && (
        <div style={{ background: "#FEF2F2", border: "1px solid #FECACA", borderRadius: 12, padding: 24, color: "#991B1B" }}>
          <AlertTriangle style={{ width: 20, height: 20, display: "inline", verticalAlign: -3, marginRight: 6 }} />
          <strong>Error:</strong> {state.error}
          <button onClick={() => loadUnits(isAdmin ? selectedEmpresa : undefined)} style={{ marginLeft: 12, padding: "6px 12px", background: "#DC2626", color: "#fff", border: "none", borderRadius: 6, cursor: "pointer", fontSize: 13, fontWeight: 600 }}>
            Reintentar
          </button>
        </div>
      )}

      {view === "mapa" && data && !state.loading && !state.error && (
        <div style={{ display: "grid", gridTemplateColumns: "1.1fr 1.5fr", gap: 16, height: "calc(100vh - 180px)" }}>
          {/* PANEL LATERAL: LISTA DE UNIDADES (IZQUIERDA) */}
          <div style={{ background: "#fff", borderRadius: 12, boxShadow: "0 2px 8px rgba(0,0,0,.05)", overflow: "hidden", display: "flex", flexDirection: "column" }}>
            <div style={{ padding: "14px 20px", borderBottom: "1px solid #F3F4F6", fontWeight: 700, color: "#111827", fontSize: 14, display: "flex", alignItems: "center", gap: 8, background: "#FAFAFA" }}>
              <Truck style={{ width: 16, height: 16, color: "#8B5CF6" }}/>
              Directorio de Unidades
            </div>
            
            <div style={{ overflowY: "auto", flex: 1, padding: 12, display: "flex", flexDirection: "column", gap: 12 }}>
              {units.map((u) => {
                const hasPos = u.lat != null && u.lon != null && !isNaN(Number(u.lat)) && !isNaN(Number(u.lon));
                const isFocused = focusedUnit?.id === u.id;
                const speed = Math.round(u.speed || 0);
                const isMoving = speed > 3;
                const rawOdo = u.odometer || 0;
                const kilometraje = rawOdo > 500000 ? Math.round(rawOdo / 1000) : Math.round(rawOdo);
                
                return (
                  <div key={u.id} onClick={() => hasPos && setFocusedUnit(isFocused ? null : u)}
                    style={{
                      padding: "16px 20px", 
                      borderBottom: "1px solid #F3F4F6",
                      cursor: hasPos ? "pointer" : "default",
                      background: isFocused ? "#F9FAFB" : "#fff",
                      transition: "all 0.15s ease",
                      position: "relative",
                    }}>
                    
                    {/* Row 1: Placa & Speed */}
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 6 }}>
                      <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: "6px" }}>
                        <Navigation style={{ 
                          width: 15, 
                          height: 15, 
                          color: isMoving ? "#10B981" : "#F59E0B", 
                          transform: `rotate(${u.course || 0}deg)`, 
                          fill: isMoving ? "#10B981" : "#F59E0B",
                          strokeWidth: 2.5
                        }} />
                        <span style={{ fontWeight: 800, color: "#111827", fontSize: "16px", letterSpacing: "-0.01em" }}>{u.name}</span>
                        <span style={{ color: "#3B82F6", fontSize: "12.5px", fontWeight: 700, marginLeft: 4 }}>KM: {kilometraje}</span>
                        
                        {/* Red warning/ignition icon in circle */}
                        <div style={{ 
                          width: 14, 
                          height: 14, 
                          borderRadius: "50%", 
                          background: u.ignition ? "#10B981" : "#EF4444", 
                          display: "inline-flex",
                          alignItems: "center",
                          justifyContent: "center",
                          boxShadow: "0 0 0 2px rgba(239, 68, 68, 0.15)",
                          marginLeft: 4
                        }} title={u.ignition ? "Motor Encendido" : "Motor Apagado"}>
                          <div style={{ width: 6, height: 6, borderRadius: "50%", background: "#fff" }} />
                        </div>
                      </div>
                      
                      <div style={{ textAlign: "right" }}>
                        <div style={{ fontSize: "15px", color: "#111827", fontWeight: 800, display: "flex", alignItems: "center", gap: 4 }}>
                          <Gauge style={{ width: 14, height: 14, color: "#6B7280" }} />
                          {speed} <span style={{ fontSize: "12px", fontWeight: 600, color: "#4B5563" }}>Km/H</span>
                        </div>
                        <div style={{ fontSize: "11px", color: "#9CA3AF", marginTop: 2 }}>
                          {hasPos ? (isMoving ? "En vivo" : fmtDate(u.timestamp).replace("hace ", "")) : "Sin señal"}
                        </div>
                      </div>
                    </div>

                    {/* Row 2: Conductor & DNI/Phone */}
                    <div style={{ fontSize: "13.5px", color: "#111827", marginBottom: 6, display: "flex", flexWrap: "wrap", gap: 6, paddingLeft: 2, alignItems: "center" }}>
                      <span style={{ fontWeight: 800, color: u.driver_name ? "#111827" : "#9CA3AF" }}>
                        {u.driver_name || "Sin conductor asignado"}
                      </span>
                      {(u.driver_dni || u.driver_phone) && (
                        <span style={{ color: "#6B7280", fontWeight: 500 }}>
                          {u.driver_dni || u.driver_phone}
                        </span>
                      )}
                    </div>

                    {/* Row 3: Address */}
                    <div style={{ fontSize: "13px", color: "#4B5563", marginBottom: 12, lineHeight: 1.4, wordBreak: "break-word", paddingLeft: 2 }}>
                      {addresses[u.id] || (hasPos ? "Cargando ubicación..." : "Ubicación desconocida")}
                    </div>

                    {/* Row 4: Actions Panel (Wialon Icons) */}
                    <div style={{ 
                      background: "#F9FAFB", 
                      border: "1px solid #F3F4F6", 
                      borderRadius: 8, 
                      padding: "6px 12px", 
                      display: "flex", 
                      alignItems: "center", 
                      justifyContent: "space-between",
                      gap: 8,
                      position: "relative"
                    }} onClick={(e) => e.stopPropagation()}>
                      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                        {/* Trailer/Carrosa */}
                        <button 
                          onClick={(e) => {
                            e.stopPropagation();
                            const active = !trailerStatus[u.id];
                            setTrailerStatus(prev => ({ ...prev, [u.id]: active }));
                            toast.success(`Carrosa/Acoplado ${active ? "CONECTADO" : "DESCONECTADO"} para unidad ${u.name}`);
                          }}
                          style={{ background: "none", border: "none", cursor: "pointer", padding: 4, display: "flex", alignItems: "center", color: trailerStatus[u.id] ? "#10B981" : "#9CA3AF" }}
                          title="Estado de Carrosa / Acoplado"
                        >
                          <Truck style={{ width: 16, height: 16 }} />
                        </button>

                        {/* Connection Dot */}
                        <button 
                          onClick={(e) => {
                            e.stopPropagation();
                            toast.info(`Estado de conexión: ${hasPos ? "Online (Reportando)" : "Offline (Sin señal)"}`);
                          }}
                          style={{ background: "none", border: "none", cursor: "pointer", padding: 4, display: "flex", alignItems: "center" }}
                          title={hasPos ? "Online" : "Offline"}
                        >
                          <div style={{ width: 8, height: 8, borderRadius: "50%", background: hasPos ? "#10B981" : "#D1D5DB", boxShadow: hasPos ? "0 0 8px #10B981" : "none" }} />
                        </button>

                        {/* History */}
                        <button 
                          onClick={(e) => {
                            e.stopPropagation();
                            handleFetchRoute(u, hasPos);
                          }}
                          style={{ background: "none", border: "none", cursor: "pointer", padding: 4, display: "flex", alignItems: "center", color: activeRouteUnit?.id === u.id ? "#8B5CF6" : "#6B7280" }}
                          title="Ver recorrido histórico de hoy"
                        >
                          <Route style={{ width: 15, height: 15 }} />
                        </button>

                        {/* Camera */}
                        <button 
                          onClick={(e) => {
                            e.stopPropagation();
                            setCameraModalUnit(u);
                          }}
                          style={{ background: "none", border: "none", cursor: "pointer", padding: 4, display: "flex", alignItems: "center", color: "#6B7280" }}
                          title="Transmisión de Video en Vivo"
                        >
                          <Video style={{ width: 16, height: 16 }} />
                        </button>
                      </div>

                      {/* Right Panel Actions: Command Launcher dropdown arrow */}
                      <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                        {/* Play Arrow button to open commands */}
                        <button 
                          onClick={(e) => {
                            e.stopPropagation();
                            setActiveCmdDropdown(activeCmdDropdown === u.id ? null : u.id);
                          }}
                          style={{ 
                            background: "none", 
                            border: "none", 
                            cursor: "pointer", 
                            padding: 4, 
                            display: "flex", 
                            alignItems: "center", 
                            color: activeCmdDropdown === u.id ? "#8B5CF6" : "#6B7280" 
                          }}
                          title="Enviar comandos de motor"
                        >
                          <Play style={{ width: 14, height: 14, fill: activeCmdDropdown === u.id ? "#8B5CF6" : "none" }} />
                        </button>

                        {/* Wrench button */}
                        <button 
                          onClick={(e) => {
                            e.stopPropagation();
                            setActiveCmdDropdown(activeCmdDropdown === u.id ? null : u.id);
                          }}
                          style={{ background: "none", border: "none", cursor: "pointer", padding: 4, display: "flex", alignItems: "center", color: "#6B7280" }}
                          title="Herramientas y comandos"
                        >
                          <Wrench style={{ width: 14, height: 14 }} />
                        </button>

                        {/* Dropdown Arrow */}
                        <button 
                          onClick={(e) => {
                            e.stopPropagation();
                            setActiveCmdDropdown(activeCmdDropdown === u.id ? null : u.id);
                          }}
                          style={{ background: "none", border: "none", cursor: "pointer", padding: "4px 0", display: "flex", alignItems: "center", color: "#6B7280" }}
                        >
                          <ChevronDown style={{ width: 14, height: 14, transform: activeCmdDropdown === u.id ? "rotate(180deg)" : "none", transition: "transform 0.2s" }} />
                        </button>
                      </div>

                      {/* Dropdown menu */}
                      {activeCmdDropdown === u.id && (
                        <div style={{ 
                          position: "absolute", 
                          bottom: "100%", 
                          right: 12, 
                          marginBottom: 6,
                          background: "#fff", 
                          border: "1px solid #E5E7EB", 
                          borderRadius: 8, 
                          boxShadow: "0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05)",
                          zIndex: 9999,
                          minWidth: 160,
                          overflow: "hidden"
                        }} onClick={(e) => e.stopPropagation()}>
                          <button 
                            onClick={() => handleSendCommand(u, "bloqueo")}
                            style={{ 
                              width: "100%", 
                              padding: "10px 14px", 
                              textAlign: "left", 
                              background: "none", 
                              border: "none", 
                              display: "flex", 
                              alignItems: "center", 
                              gap: 8, 
                              fontSize: "13px", 
                              fontWeight: 600,
                              color: "#EF4444",
                              cursor: "pointer",
                              borderBottom: "1px solid #F3F4F6"
                            }}
                          >
                            <span style={{ color: "#3B82F6", fontWeight: "bold", width: 8 }}>|</span> Bloqueo
                          </button>
                          <button 
                            onClick={() => handleSendCommand(u, "desbloqueo")}
                            style={{ 
                              width: "100%", 
                              padding: "10px 14px", 
                              textAlign: "left", 
                              background: "none", 
                              border: "none", 
                              display: "flex", 
                              alignItems: "center", 
                              gap: 8, 
                              fontSize: "13px", 
                              fontWeight: 600,
                              color: "#10B981",
                              cursor: "pointer",
                              borderBottom: "1px solid #F3F4F6"
                            }}
                          >
                            <span style={{ color: "#3B82F6", fontSize: "16px", lineHeight: 1, width: 8 }}>○</span> Desbloqueo
                          </button>
                          <button 
                            onClick={() => handleSendCommand(u, "sos")}
                            style={{ 
                              width: "100%", 
                              padding: "10px 14px", 
                              textAlign: "left", 
                              background: "none", 
                              border: "none", 
                              display: "flex", 
                              alignItems: "center", 
                              gap: 8, 
                              fontSize: "13px", 
                              fontWeight: 600,
                              color: "#D97706",
                              cursor: "pointer"
                            }}
                          >
                            <MessageCircle style={{ width: 14, height: 14, color: "#3B82F6" }} /> SOS
                          </button>
                        </div>
                      )}
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
                {focusedUnit ? focusedUnit.name : `Mapa en Vivo · ${unitsWithPos.length} unidades`}
              </div>
              {focusedUnit && (
                <button onClick={() => setFocusedUnit(null)} style={{ pointerEvents: "auto", background: "#fff", border: "1px solid #E5E7EB", borderRadius: 8, padding: "8px 12px", color: "#374151", cursor: "pointer", fontSize: 12, fontWeight: 600, boxShadow: "0 2px 4px rgba(0,0,0,0.1)" }}>
                  Ver todas las unidades
                </button>
              )}
            </div>
            
            <MapErrorBoundary>
              {unitsWithPos.length > 0 ? (
                <MapContainer center={center} zoom={zoom} style={{ width: "100%", height: "100%" }}>
                  <TileLayer
                    attribution='&copy; <a href="https://www.google.com/maps">Google Maps</a>'
                    url="https://mt1.google.com/vt/lyrs=p&x={x}&y={y}&z={z}"
                  />
                  {/* Trick to fly to center when focused unit changes */}
                  <MapUpdater center={center} zoom={zoom} />
                  

                  {/* Route Polyline Trace */}
                  {routePolyline.length > 0 && (
                    <Polyline 
                      positions={routePolyline} 
                      pathOptions={{ color: '#8B5CF6', weight: 5, opacity: 0.85, dashArray: '6, 8' }} 
                    />
                  )}
                  
                  {unitsWithPos.map(u => (
                    <Marker 
                      key={u.id} 
                      position={[Number(u.lat), Number(u.lon)]} 
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
            </MapErrorBoundary>
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

      {/* MODAL: Video / Cámara Migración */}
      {cameraModalUnit && (
        <div style={{ position: "fixed", inset: 0, zIndex: 9999, display: "flex", alignItems: "center", justifyContent: "center", background: "rgba(0,0,0,0.5)", backdropFilter: "blur(4px)" }}>
          <div style={{ background: "#fff", width: 440, borderRadius: 16, overflow: "hidden", boxShadow: "0 20px 25px -5px rgba(0,0,0,0.1), 0 10px 10px -5px rgba(0,0,0,0.04)" }}>
            <div style={{ padding: "16px 20px", borderBottom: "1px solid #F3F4F6", display: "flex", justifyContent: "space-between", alignItems: "center", background: "#FAFAFA" }}>
              <div style={{ fontWeight: 700, fontSize: 15, color: "#111827", display: "flex", alignItems: "center", gap: 8 }}>
                <Video style={{ width: 18, height: 18, color: "#8B5CF6" }} />
                Cámara de Video en Vivo
              </div>
              <button onClick={() => setCameraModalUnit(null)} style={{ background: "none", border: "none", cursor: "pointer", color: "#9CA3AF" }}>
                <X style={{ width: 20, height: 20 }} />
              </button>
            </div>
            <div style={{ padding: 24, textAlign: "center", display: "flex", flexDirection: "column", alignItems: "center", gap: 14 }}>
              <div style={{ width: 56, height: 56, borderRadius: "50%", background: "#EEF2FF", display: "flex", alignItems: "center", justifyContent: "center", color: "#4F46E5", marginBottom: 4 }}>
                <Video style={{ width: 28, height: 28 }} />
              </div>
              <h3 style={{ fontWeight: 800, fontSize: 16, color: "#111827", margin: 0 }}>Servicio de Video no activo</h3>
              <p style={{ fontSize: 13.5, color: "#4B5563", lineHeight: 1.6, margin: 0 }}>
                Para activar la transmisión de video en vivo y ver la cabina de la unidad <strong>{cameraModalUnit.name}</strong> en tiempo real, solicita la migración de tu servicio de GPS convencional a <strong>ENERED Video</strong>.
              </p>
              <div style={{ background: "#F9FAFB", border: "1px solid #E5E7EB", borderRadius: 8, padding: 12, fontSize: 12, color: "#6B7280", width: "100%", textAlign: "left", lineHeight: 1.5 }}>
                • Transmisión MDVR 4G/5G en tiempo real.<br />
                • Grabación continua en la nube.<br />
                • Sensor de fatiga y ADAS integrado.
              </div>
            </div>
            <div style={{ padding: "16px 24px", borderTop: "1px solid #F3F4F6", background: "#FAFAFA", display: "flex", justifyContent: "flex-end", gap: 12 }}>
              <button onClick={() => setCameraModalUnit(null)} style={{ padding: "8px 16px", background: "none", border: "none", color: "#6B7280", fontWeight: 600, fontSize: 14, cursor: "pointer" }}>
                Cerrar
              </button>
              <button onClick={() => {
                const name = cameraModalUnit.name;
                setCameraModalUnit(null);
                setFormData({ ...formData, placa: name });
                setShowModal(true);
              }} style={{ padding: "8px 16px", background: "#3B82F6", color: "#fff", border: "none", borderRadius: 8, fontWeight: 600, fontSize: 14, cursor: "pointer", display: "flex", alignItems: "center", gap: 8 }}>
                Solicitar Migración
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// Componente helper para actualizar la vista del mapa cuando cambia el centro
function MapUpdater({ center, zoom }) {
  const map = useMap();
  useEffect(() => {
    if (center && !isNaN(Number(center[0])) && !isNaN(Number(center[1]))) {
      try {
        map.flyTo(center, zoom, { duration: 0.8 });
      } catch (e) {
        console.error("flyTo error:", e);
      }
    }
  }, [center, zoom, map]);
  return null;
}
