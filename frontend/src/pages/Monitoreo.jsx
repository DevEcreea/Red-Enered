import React, { useEffect, useState, useRef } from "react";
import { api } from "../lib/api";
import { useAuth } from "../context/AuthContext";
import ModuloBloqueado from "./ModuloBloqueado";
import { Loader2, AlertTriangle, RefreshCw, ExternalLink, Users } from "lucide-react";

export default function Monitoreo() {
  const { user } = useAuth();
  const [state, setState] = useState({ loading: true, error: "", data: null });
  const iframeRef = useRef(null);

  const servicios = user?.servicios || {};
  const hasGps = user?.role === "admin_enered" ? false : servicios.gps === true;

  async function loadSid() {
    setState({ loading: true, error: "", data: null });
    try {
      const { data } = await api.get("/wialon/sid");
      setState({ loading: false, error: "", data });
    } catch (e) {
      setState({ loading: false, error: e.response?.data?.detail || "Error conectando con Wialon", data: null });
    }
  }

  useEffect(() => {
    if (hasGps) loadSid();
  }, [hasGps]);

  // Caso 1: usuario sin servicio GPS activo (o admin_enered)
  if (!hasGps) {
    return (
      <ModuloBloqueado
        titulo="Monitoreo · Wialon"
        descripcion={
          user?.role === "admin_enered"
            ? "Este módulo muestra el monitoreo Wialon de cada empresa cliente. Ingresa como usuario de una empresa con servicio GPS activo."
            : "Tu empresa aún no tiene el servicio GPS con Wialon activado. Contacta a tu administrador ENERED para habilitarlo."
        }
      />
    );
  }

  // Caso 2: cargando o error
  if (state.loading) {
    return (
      <div style={{ padding: 40, textAlign: "center", color: "#6b7280" }} data-testid="monitoreo-loading">
        <Loader2 style={{ width: 32, height: 32, animation: "spin 1s linear infinite", color: "#3B82F6", marginBottom: 12 }} />
        <div style={{ fontSize: 15 }}>Conectando con Wialon…</div>
      </div>
    );
  }

  if (state.error) {
    return (
      <div style={{ padding: 40 }} data-testid="monitoreo-error">
        <div style={{ background: "#FEF2F2", border: "1px solid #FECACA", borderRadius: 12, padding: 20, color: "#991B1B", maxWidth: 600, margin: "0 auto" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, fontWeight: 700, marginBottom: 8 }}>
            <AlertTriangle style={{ width: 20, height: 20 }} /> No se pudo conectar con Wialon
          </div>
          <div style={{ fontSize: 14, marginBottom: 14 }}>{state.error}</div>
          <button onClick={loadSid} style={{ padding: "8px 16px", background: "#DC2626", color: "#fff", border: "none", borderRadius: 8, cursor: "pointer", fontSize: 13.5, fontWeight: 600, display: "inline-flex", alignItems: "center", gap: 6 }}>
            <RefreshCw style={{ width: 14, height: 14 }} /> Reintentar
          </button>
        </div>
      </div>
    );
  }

  // Caso 3: iframe embebido
  const { iframe_url, base_url, sid, total_unidades, user: wialonUser } = state.data || {};

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "calc(100vh - 90px)", background: "#F5F7FA" }} data-testid="monitoreo-page">
      {/* Header con info */}
      <div style={{ background: "#fff", padding: "12px 20px", borderBottom: "1px solid #E5E7EB", display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 10 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 20 }}>
          <div>
            <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: ".08em", color: "#3B82F6", textTransform: "uppercase" }}>Monitoreo · Wialon</div>
            <div style={{ fontSize: 18, fontWeight: 700, color: "#111827" }}>{user?.empresa || "—"}</div>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 8, background: "#EFF6FF", padding: "6px 12px", borderRadius: 999, fontSize: 12.5, color: "#1E40AF" }}>
            <Users style={{ width: 14, height: 14 }} />
            <strong>{total_unidades}</strong> unidades &middot; usuario <strong>{wialonUser}</strong>
          </div>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <button onClick={loadSid} title="Refrescar sesión" style={{ padding: "6px 12px", background: "#fff", border: "1px solid #E5E7EB", borderRadius: 8, cursor: "pointer", fontSize: 13, fontWeight: 500, color: "#374151", display: "inline-flex", alignItems: "center", gap: 6 }}>
            <RefreshCw style={{ width: 14, height: 14 }} /> Refrescar
          </button>
          <a href={iframe_url} target="_blank" rel="noreferrer" style={{ padding: "6px 12px", background: "#3B82F6", color: "#fff", border: "none", borderRadius: 8, textDecoration: "none", fontSize: 13, fontWeight: 600, display: "inline-flex", alignItems: "center", gap: 6 }}>
            <ExternalLink style={{ width: 14, height: 14 }} /> Abrir en pestaña nueva
          </a>
        </div>
      </div>

      {/* Iframe */}
      <div style={{ flex: 1, minHeight: 500, background: "#000" }}>
        <iframe
          ref={iframeRef}
          src={iframe_url}
          title="Wialon Monitoreo"
          style={{ width: "100%", height: "100%", border: "none" }}
          allow="geolocation *; fullscreen"
          data-testid="wialon-iframe"
        />
      </div>
    </div>
  );
}
