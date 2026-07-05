import React, { useEffect, useState, useRef } from "react";
import { api } from "../lib/api";
import { useAuth } from "../context/AuthContext";
import ModuloBloqueado from "./ModuloBloqueado";
import { Loader2, AlertTriangle, RefreshCw, ExternalLink, Users, Building2 } from "lucide-react";

export default function Monitoreo() {
  const { user } = useAuth();
  const iframeRef = useRef(null);
  const [state, setState] = useState({ loading: false, error: "", data: null });
  const [empresas, setEmpresas] = useState([]);      // solo admin_enered
  const [selectedEmpresa, setSelectedEmpresa] = useState("");

  const isAdmin = user?.role === "admin_enered";
  const servicios = user?.servicios || {};
  // Para admin_enered: puede ver iframe si selecciona una empresa con GPS.
  // Para clientes: necesita servicios.gps=true en su propia empresa.
  const clienteHasGps = !isAdmin && servicios.gps === true;

  // Admin: cargar lista de empresas con Wialon
  useEffect(() => {
    if (!isAdmin) return;
    (async () => {
      try {
        const { data } = await api.get("/wialon/empresas");
        setEmpresas(data || []);
        if ((data || []).length > 0) {
          setSelectedEmpresa(data[0].empresa);
        }
      } catch (e) {
        // ignora
      }
    })();
  }, [isAdmin]);

  async function loadSid(empresa) {
    setState({ loading: true, error: "", data: null });
    try {
      const params = empresa ? { empresa } : {};
      const { data } = await api.get("/wialon/sid", { params });
      setState({ loading: false, error: "", data });
    } catch (e) {
      setState({ loading: false, error: e.response?.data?.detail || "Error conectando con Wialon", data: null });
    }
  }

  // Cliente: cargar sid apenas monta
  useEffect(() => {
    if (clienteHasGps) loadSid();
  }, [clienteHasGps]);

  // Admin: cargar sid cuando selecciona empresa
  useEffect(() => {
    if (isAdmin && selectedEmpresa) loadSid(selectedEmpresa);
  }, [isAdmin, selectedEmpresa]);

  // Caso 1: cliente sin servicio GPS
  if (!isAdmin && !clienteHasGps) {
    return (
      <ModuloBloqueado
        titulo="Monitoreo · Wialon"
        descripcion="Tu empresa aún no tiene el servicio GPS con Wialon activado. Contacta a tu administrador ENERED para habilitarlo."
      />
    );
  }

  // Caso 2: admin sin empresas configuradas
  if (isAdmin && empresas.length === 0) {
    return (
      <ModuloBloqueado
        titulo="Monitoreo · Wialon"
        descripcion="Aún no hay empresas con servicio GPS activo y token Wialon configurado. Ve a Admin › Empresas & Servicios para activarlas."
        ctaTexto="Ir a Empresas"
        ctaTo="/admin/empresas"
      />
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "calc(100vh - 90px)", background: "#F5F7FA" }} data-testid="monitoreo-page">
      {/* Header */}
      <div style={{ background: "#fff", padding: "12px 20px", borderBottom: "1px solid #E5E7EB", display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 10 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 20, flexWrap: "wrap" }}>
          <div>
            <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: ".08em", color: "#3B82F6", textTransform: "uppercase" }}>Monitoreo · Wialon</div>
            <div style={{ fontSize: 18, fontWeight: 700, color: "#111827" }}>
              {isAdmin ? "Vista Administrador" : (user?.empresa || "—")}
            </div>
          </div>

          {isAdmin && (
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <Building2 style={{ width: 15, height: 15, color: "#6b7280" }} />
              <select
                value={selectedEmpresa}
                onChange={(e) => setSelectedEmpresa(e.target.value)}
                data-testid="wialon-empresa-select"
                style={{ padding: "8px 12px", border: "1px solid #E5E7EB", borderRadius: 8, background: "#fff", fontSize: 13.5, fontWeight: 500, minWidth: 240, cursor: "pointer", outline: "none" }}
              >
                {empresas.map((e) => (
                  <option key={e.empresa} value={e.empresa}>{e.empresa}</option>
                ))}
              </select>
            </div>
          )}

          {state.data && !state.loading && (
            <div style={{ display: "flex", alignItems: "center", gap: 8, background: "#EFF6FF", padding: "6px 12px", borderRadius: 999, fontSize: 12.5, color: "#1E40AF" }}>
              <Users style={{ width: 14, height: 14 }} />
              <strong>{state.data.total_unidades}</strong> unidades · usuario <strong>{state.data.user}</strong>
            </div>
          )}
        </div>

        <div style={{ display: "flex", gap: 8 }}>
          <button onClick={() => loadSid(isAdmin ? selectedEmpresa : undefined)} title="Refrescar sesión"
            style={{ padding: "6px 12px", background: "#fff", border: "1px solid #E5E7EB", borderRadius: 8, cursor: "pointer", fontSize: 13, fontWeight: 500, color: "#374151", display: "inline-flex", alignItems: "center", gap: 6 }}
            data-testid="btn-wialon-refresh">
            <RefreshCw style={{ width: 14, height: 14 }} /> Refrescar
          </button>
          {state.data?.iframe_url && (
            <a href={state.data.iframe_url} target="_blank" rel="noreferrer" data-testid="btn-wialon-newtab"
              style={{ padding: "6px 12px", background: "#3B82F6", color: "#fff", border: "none", borderRadius: 8, textDecoration: "none", fontSize: 13, fontWeight: 600, display: "inline-flex", alignItems: "center", gap: 6 }}>
              <ExternalLink style={{ width: 14, height: 14 }} /> Abrir en pestaña
            </a>
          )}
        </div>
      </div>

      {/* Contenido */}
      <div style={{ flex: 1, minHeight: 500, background: "#000", position: "relative" }}>
        {state.loading && (
          <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", flexDirection: "column", gap: 10 }} data-testid="monitoreo-loading">
            <Loader2 style={{ width: 32, height: 32, animation: "spin 1s linear infinite" }} />
            <div>Conectando con Wialon…</div>
          </div>
        )}
        {state.error && !state.loading && (
          <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center" }}>
            <div style={{ background: "#FEF2F2", border: "1px solid #FECACA", borderRadius: 12, padding: 24, color: "#991B1B", maxWidth: 520, textAlign: "center" }} data-testid="monitoreo-error">
              <AlertTriangle style={{ width: 32, height: 32, marginBottom: 10 }} />
              <div style={{ fontWeight: 700, marginBottom: 6 }}>No se pudo conectar con Wialon</div>
              <div style={{ fontSize: 14, marginBottom: 16 }}>{state.error}</div>
              <button onClick={() => loadSid(isAdmin ? selectedEmpresa : undefined)} style={{ padding: "8px 16px", background: "#DC2626", color: "#fff", border: "none", borderRadius: 8, cursor: "pointer", fontSize: 13.5, fontWeight: 600, display: "inline-flex", alignItems: "center", gap: 6 }}>
                <RefreshCw style={{ width: 14, height: 14 }} /> Reintentar
              </button>
            </div>
          </div>
        )}
        {state.data?.iframe_url && !state.loading && !state.error && (
          <iframe
            ref={iframeRef}
            src={state.data.iframe_url}
            title="Wialon Monitoreo"
            style={{ width: "100%", height: "100%", border: "none", display: "block" }}
            allow="geolocation *; fullscreen"
            data-testid="wialon-iframe"
          />
        )}
      </div>
    </div>
  );
}
