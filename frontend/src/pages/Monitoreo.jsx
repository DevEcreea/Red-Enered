import React, { useEffect, useState } from "react";
import { api } from "../lib/api";
import { useAuth } from "../context/AuthContext";
import ModuloBloqueado from "./ModuloBloqueado";
import {
  Loader2, AlertTriangle, RefreshCw, ExternalLink, Users, Building2,
  MapPin, Gauge, Clock, Truck
} from "lucide-react";

function fmtDate(ts) {
  if (!ts) return "—";
  try {
    const d = new Date(ts * 1000);
    const now = Date.now();
    const diff = Math.floor((now - d.getTime()) / 1000);
    if (diff < 60) return `hace ${diff}s`;
    if (diff < 3600) return `hace ${Math.floor(diff/60)} min`;
    if (diff < 86400) return `hace ${Math.floor(diff/3600)} h`;
    return d.toLocaleString("es-PE", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });
  } catch { return "—"; }
}

export default function Monitoreo() {
  const { user } = useAuth();
  const [state, setState] = useState({ loading: false, error: "", data: null });
  const [empresas, setEmpresas] = useState([]);
  const [selectedEmpresa, setSelectedEmpresa] = useState("");
  const [focusedUnit, setFocusedUnit] = useState(null);
  const [showFullscreen, setShowFullscreen] = useState(false);

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

  if (!isAdmin && !clienteHasGps) {
    return <ModuloBloqueado titulo="Monitoreo · Wialon" descripcion="Tu empresa aún no tiene el servicio GPS con Wialon activado. Contacta a tu administrador ENERED para habilitarlo." />;
  }
  if (isAdmin && empresas.length === 0) {
    return <ModuloBloqueado titulo="Monitoreo · Wialon" descripcion="Aún no hay empresas con servicio GPS activo y token Wialon configurado. Ve a Admin › Empresas & Servicios para activarlas." ctaTexto="Ir a Empresas" ctaTo="/admin/empresas" />;
  }

  const data = state.data;
  const units = data?.units || [];
  const unitsWithPos = units.filter(u => u.lat != null && u.lon != null);
  const bbox = data?.bbox;

  // OSM embed URL. Si hay una unidad enfocada, centramos ahí con zoom alto. Si no, bbox.
  let osmUrl = "";
  if (focusedUnit && focusedUnit.lat != null) {
    const lat = focusedUnit.lat, lon = focusedUnit.lon;
    const d = 0.01;
    osmUrl = `https://www.openstreetmap.org/export/embed.html?bbox=${lon-d},${lat-d},${lon+d},${lat+d}&layer=mapnik&marker=${lat},${lon}`;
  } else if (bbox) {
    osmUrl = `https://www.openstreetmap.org/export/embed.html?bbox=${bbox.min_lon},${bbox.min_lat},${bbox.max_lon},${bbox.max_lat}&layer=mapnik`;
  }

  return (
    <div style={{ padding: "20px 24px", background: "#F5F7FA", minHeight: "100%" }} data-testid="monitoreo-page">
      {/* Header */}
      <div style={{ background: "#fff", padding: "14px 20px", borderRadius: 12, boxShadow: "0 2px 8px rgba(0,0,0,.05)", display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 12, marginBottom: 16 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 20, flexWrap: "wrap" }}>
          <div>
            <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: ".08em", color: "#3B82F6", textTransform: "uppercase" }}>Monitoreo · Wialon</div>
            <div style={{ fontSize: 18, fontWeight: 700, color: "#111827" }}>{isAdmin ? "Vista Administrador" : (user?.empresa || "—")}</div>
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
            <div style={{ display: "flex", alignItems: "center", gap: 8, background: "#EFF6FF", padding: "6px 12px", borderRadius: 999, fontSize: 12.5, color: "#1E40AF" }}>
              <Users style={{ width: 14, height: 14 }} /><strong>{data.total}</strong> unidades · <strong>{unitsWithPos.length}</strong> con GPS activo
            </div>
          )}
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <button onClick={() => loadUnits(isAdmin ? selectedEmpresa : undefined)} data-testid="btn-wialon-refresh"
            style={{ padding: "8px 14px", background: "#fff", border: "1px solid #E5E7EB", borderRadius: 8, cursor: "pointer", fontSize: 13, fontWeight: 500, color: "#374151", display: "inline-flex", alignItems: "center", gap: 6 }}>
            <RefreshCw style={{ width: 14, height: 14 }} /> Actualizar
          </button>
          <a href="https://hosting.wialon.us" target="_blank" rel="noreferrer" data-testid="btn-wialon-newtab"
            style={{ padding: "8px 14px", background: "#3B82F6", color: "#fff", border: "none", borderRadius: 8, textDecoration: "none", fontSize: 13, fontWeight: 600, display: "inline-flex", alignItems: "center", gap: 6 }}>
            <ExternalLink style={{ width: 14, height: 14 }} /> Abrir Wialon completo
          </a>
        </div>
      </div>

      {state.loading && (
        <div style={{ background: "#fff", borderRadius: 12, padding: 60, textAlign: "center", color: "#6b7280" }} data-testid="monitoreo-loading">
          <Loader2 style={{ width: 32, height: 32, animation: "spin 1s linear infinite", color: "#3B82F6" }} />
          <div style={{ marginTop: 10 }}>Consultando posiciones en Wialon…</div>
        </div>
      )}

      {state.error && !state.loading && (
        <div style={{ background: "#FEF2F2", border: "1px solid #FECACA", borderRadius: 12, padding: 24, color: "#991B1B" }} data-testid="monitoreo-error">
          <AlertTriangle style={{ width: 20, height: 20, display: "inline", verticalAlign: -3, marginRight: 6 }} />
          <strong>Error:</strong> {state.error}
          <button onClick={() => loadUnits(isAdmin ? selectedEmpresa : undefined)} style={{ marginLeft: 12, padding: "6px 12px", background: "#DC2626", color: "#fff", border: "none", borderRadius: 6, cursor: "pointer", fontSize: 13, fontWeight: 600 }}>
            Reintentar
          </button>
        </div>
      )}

      {data && !state.loading && !state.error && (
        <div style={{ display: "grid", gridTemplateColumns: "1.3fr 1fr", gap: 16 }}>
          {/* MAPA */}
          <div style={{ background: "#fff", borderRadius: 12, overflow: "hidden", boxShadow: "0 2px 8px rgba(0,0,0,.05)", minHeight: 520 }}>
            <div style={{ padding: "10px 14px", borderBottom: "1px solid #E5E7EB", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div style={{ fontWeight: 600, color: "#111827", fontSize: 14 }}>
                <MapPin style={{ width: 15, height: 15, display: "inline", verticalAlign: -2, marginRight: 6, color: "#3B82F6" }}/>
                {focusedUnit ? focusedUnit.name : `Mapa de flota · ${unitsWithPos.length} unidades`}
              </div>
              {focusedUnit && (
                <button onClick={() => setFocusedUnit(null)} style={{ background: "none", border: "none", color: "#6b7280", cursor: "pointer", fontSize: 12.5 }}>Ver todas ←</button>
              )}
            </div>
            {osmUrl ? (
              <iframe title="Mapa Wialon" src={osmUrl} style={{ width: "100%", height: 520, border: "none", display: "block" }} data-testid="wialon-map"/>
            ) : (
              <div style={{ padding: 60, textAlign: "center", color: "#9ca3af" }}>Ninguna unidad reporta posición GPS actualmente</div>
            )}
          </div>

          {/* PANEL LATERAL: LISTA DE UNIDADES */}
          <div style={{ background: "#fff", borderRadius: 12, boxShadow: "0 2px 8px rgba(0,0,0,.05)", overflow: "hidden", display: "flex", flexDirection: "column", maxHeight: 570 }}>
            <div style={{ padding: "12px 14px", borderBottom: "1px solid #E5E7EB", fontWeight: 600, color: "#111827", fontSize: 14 }}>
              <Truck style={{ width: 15, height: 15, display: "inline", verticalAlign: -2, marginRight: 6, color: "#8B3DFF" }}/>
              Unidades ({data.total})
            </div>
            <div style={{ overflowY: "auto", flex: 1 }}>
              {units.map((u) => {
                const hasPos = u.lat != null && u.lon != null;
                const isFocused = focusedUnit?.id === u.id;
                return (
                  <div key={u.id} onClick={() => hasPos && setFocusedUnit(isFocused ? null : u)}
                    data-testid={`unit-row-${u.id}`}
                    style={{
                      padding: "10px 14px", borderBottom: "1px solid #F1F3F7",
                      cursor: hasPos ? "pointer" : "default",
                      background: isFocused ? "#EFF6FF" : "transparent",
                      borderLeft: `3px solid ${isFocused ? "#3B82F6" : "transparent"}`,
                      display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10,
                    }}>
                    <div style={{ minWidth: 0, flex: 1 }}>
                      <div style={{ fontWeight: 600, color: "#111827", fontSize: 13.5, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{u.name}</div>
                      <div style={{ display: "flex", gap: 12, fontSize: 11.5, color: "#6b7280", marginTop: 2 }}>
                        <span><Clock style={{ width: 11, height: 11, display: "inline", verticalAlign: -1 }}/> {fmtDate(u.timestamp)}</span>
                        {u.speed != null && <span><Gauge style={{ width: 11, height: 11, display: "inline", verticalAlign: -1 }}/> {Math.round(u.speed)} km/h</span>}
                      </div>
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 11, fontWeight: 600 }}>
                      {hasPos ? (
                        <span style={{ color: (u.speed || 0) > 5 ? "#059669" : "#F59E0B" }}>
                          <span style={{ display: "inline-block", width: 8, height: 8, borderRadius: "50%", background: (u.speed || 0) > 5 ? "#10B981" : "#F59E0B", marginRight: 4 }}></span>
                          {(u.speed || 0) > 5 ? "Movimiento" : "Detenido"}
                        </span>
                      ) : (
                        <span style={{ color: "#9CA3AF" }}>
                          <span style={{ display: "inline-block", width: 8, height: 8, borderRadius: "50%", background: "#D1D5DB", marginRight: 4 }}></span>
                          Sin señal
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
              {units.length === 0 && (
                <div style={{ padding: 40, textAlign: "center", color: "#9ca3af", fontSize: 13.5 }}>No hay unidades en esta cuenta</div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
