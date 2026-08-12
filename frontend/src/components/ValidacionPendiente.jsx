import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../lib/api";
import { useAuth } from "../context/AuthContext";
import { Clock, ShieldCheck, Car, FileText, ArrowRight } from "lucide-react";

/**
 * Aviso "estamos validando tu información" para clientes de subsidio.
 * Se muestra cuando el cliente ya subió facturas pero el equipo ENERED aún no las validó
 * (los KPIs de Combustible / Gestión de Gastos / Mi Flota salen en 0 hasta entonces).
 * No renderiza nada si no aplica.
 */
export default function ValidacionPendiente({ contexto = "tus indicadores" }) {
  const { user } = useAuth();
  const [state, setState] = useState(null);
  const navigate = useNavigate();

  useEffect(() => {
    if (user?.role !== "cliente_subsidio") return;
    let alive = true;
    api.get("/subsidio/validation-state")
      .then(({ data }) => { if (alive) setState(data); })
      .catch(() => {});
    return () => { alive = false; };
  }, [user?.role]);

  if (user?.role !== "cliente_subsidio") return null;
  if (!state || !state.pending_validation) return null;

  return (
    <div
      data-testid="validacion-pendiente"
      style={{
        position: "relative",
        borderRadius: 16,
        padding: "20px 22px",
        marginBottom: 18,
        background: "linear-gradient(135deg, #FFF7ED 0%, #FEFCE8 100%)",
        border: "1px solid #FDE68A",
        boxShadow: "0 4px 16px rgba(217,119,6,.08)",
        overflow: "hidden",
      }}
    >
      {/* icono decorativo */}
      <div style={{ position: "absolute", right: -18, top: -18, opacity: 0.12 }}>
        <ShieldCheck style={{ width: 120, height: 120, color: "#D97706" }} />
      </div>

      <div style={{ display: "flex", alignItems: "flex-start", gap: 14, position: "relative" }}>
        <div style={{ flexShrink: 0, width: 44, height: 44, borderRadius: 12, background: "#FEF3C7", display: "flex", alignItems: "center", justifyContent: "center" }}>
          <Clock style={{ width: 23, height: 23, color: "#D97706" }} />
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 16, fontWeight: 800, color: "#92400E", display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
            Estamos validando tu información
            <span style={{ display: "inline-flex", alignItems: "center", gap: 5, background: "#FEF3C7", color: "#B45309", fontSize: 11.5, fontWeight: 700, padding: "3px 10px", borderRadius: 999 }}>
              <span style={{ width: 7, height: 7, borderRadius: 999, background: "#F59E0B", display: "inline-block", animation: "pulse 1.5s ease-in-out infinite" }} />
              En revisión
            </span>
          </div>
          <div style={{ fontSize: 13.5, color: "#78350F", marginTop: 6, lineHeight: 1.5, maxWidth: 680 }}>
            {state.uploaded > 0
              ? <>Ya recibimos las facturas que subiste ({state.uploaded}). El equipo de <b>ENERED</b> las está validando y, en cuanto queden aprobadas, <b>{contexto}</b> aparecerán aquí automáticamente.</>
              : <>Ya recibimos la información que cargaste. El equipo de <b>ENERED</b> la está revisando y, en cuanto se valide, <b>{contexto}</b> aparecerán aquí automáticamente.</>}
          </div>

          {/* CTA: mientras tanto ordena tu empresa */}
          <div style={{ marginTop: 14, display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
            <span style={{ fontSize: 12.5, fontWeight: 700, color: "#92400E" }}>Mientras tanto, ordena tu empresa:</span>
            <button onClick={() => navigate("/vehiculos")} data-testid="cta-vehiculos"
              style={ctaStyle}>
              <Car style={{ width: 15, height: 15 }} /> Vehículos <ArrowRight style={{ width: 13, height: 13, opacity: 0.6 }} />
            </button>
            <button onClick={() => navigate("/documentacion")} data-testid="cta-documentacion"
              style={ctaStyle}>
              <FileText style={{ width: 15, height: 15 }} /> Documentación <ArrowRight style={{ width: 13, height: 13, opacity: 0.6 }} />
            </button>
          </div>
        </div>
      </div>

      <style>{`@keyframes pulse { 0%,100% { opacity: 1; } 50% { opacity: .3; } }`}</style>
    </div>
  );
}

const ctaStyle = {
  display: "inline-flex",
  alignItems: "center",
  gap: 6,
  padding: "7px 14px",
  background: "#fff",
  border: "1px solid #FCD34D",
  borderRadius: 9,
  cursor: "pointer",
  fontSize: 13,
  fontWeight: 700,
  color: "#B45309",
};
