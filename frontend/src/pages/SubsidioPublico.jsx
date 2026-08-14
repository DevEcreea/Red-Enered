import React, { useState } from "react";
import { Navigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import Etapa0Card from "../components/Etapa0Card";
import { Search, Loader2, AlertTriangle, Building2, Coins } from "lucide-react";

const HERO_IMG = "https://customer-assets.emergentagent.com/job_ui-update-11/artifacts/mbmk49w0_WhatsApp%20Image%202026-06-10%20at%206.26.35%20PM.jpeg";
const LOGO_IMG = "https://customer-assets.emergentagent.com/job_enered-insight/artifacts/hrbrugb8_image.png";

export default function SubsidioPublico() {
  const { user, checking } = useAuth();
  const [ruc, setRuc] = useState("");
  const [error, setError] = useState("");
  const [submittedRuc, setSubmittedRuc] = useState(null);

  // Un cliente ya logueado no debe ver la landing pública: va a su Mi Flota.
  if (checking) return null;
  if (user && user.role === "cliente_subsidio") return <Navigate to="/subsidio/documentos" replace />;

  function consultar() {
    const r = ruc.trim();
    if (!/^\d{11}$/.test(r)) { setError("Ingresa un RUC válido de 11 dígitos"); return; }
    setError("");
    setSubmittedRuc(r);
  }

  // Con RUC: cabecera clara + el MISMO diagnóstico aprobado (Etapa0Card), sin crear usuario.
  if (submittedRuc) {
    return (
      <div style={{ minHeight: "100vh", background: "#F6F7FB", fontFamily: "'Open Sans', system-ui, sans-serif" }}>
        <div style={{ padding: "16px 28px", display: "flex", alignItems: "center", justifyContent: "space-between", background: "#fff", borderBottom: "1px solid #EEE" }}>
          <img src={LOGO_IMG} alt="ENERED" style={{ height: 30 }} />
          <button onClick={() => { setSubmittedRuc(null); setRuc(""); }} style={{ background: "#F5F3FF", color: "#6D28D9", border: "1px solid #E5E7EB", borderRadius: 9, padding: "8px 14px", cursor: "pointer", fontSize: 13, fontWeight: 700 }}>← Otra consulta</button>
        </div>
        <div style={{ maxWidth: 1120, margin: "0 auto", padding: "20px 20px 60px" }}>
          <Etapa0Card ruc={submittedRuc} />
        </div>
      </div>
    );
  }

  // Pantalla inicial: estilo login (imagen + RUC)
  return (
    <div style={{ minHeight: "100vh", display: "flex", background: "#fff", fontFamily: "'Open Sans', system-ui, sans-serif" }}>
      <div style={{ flex: "0 0 55%", backgroundImage: `url(${HERO_IMG})`, backgroundSize: "cover", backgroundPosition: "center", display: "none" }} className="sub-hero" />
      <div style={{ flex: 1, display: "flex", flexDirection: "column", justifyContent: "center", padding: "40px 6vw" }}>
        <div style={{ width: "100%", maxWidth: 420, margin: "0 auto" }}>
          <img src={LOGO_IMG} alt="ENERED" style={{ height: 44, marginBottom: 30 }} />
          <div style={{ display: "inline-flex", alignItems: "center", gap: 7, background: "#F5F3FF", color: "#6D28D9", padding: "5px 12px", borderRadius: 999, fontSize: 12, fontWeight: 800, marginBottom: 14 }}>
            <Coins style={{ width: 14, height: 14 }} /> SUBSIDIO DU 004-2026
          </div>
          <h1 style={{ color: "#7C3AED", fontSize: 32, fontWeight: 800, margin: "0 0 6px", letterSpacing: "-.01em" }}>Consulta tu subsidio</h1>
          <p style={{ color: "#6b7280", fontSize: 14.5, marginTop: 0, marginBottom: 24 }}>Ingresa tu RUC y descubre cuánto puedes reclamar y si cumples los requisitos.</p>

          <label style={{ fontSize: 11.5, fontWeight: 800, color: "#6b7280", textTransform: "uppercase", letterSpacing: ".05em", display: "flex", alignItems: "center", gap: 6, marginBottom: 8 }}>
            <Building2 style={{ width: 14, height: 14 }} /> Tu RUC
          </label>
          <input value={ruc} onChange={(e) => setRuc(e.target.value.replace(/\D/g, "").slice(0, 11))} placeholder="20123456789"
            onKeyDown={(e) => e.key === "Enter" && consultar()} data-testid="sub-ruc" autoFocus
            style={{ width: "100%", padding: "15px 16px", border: "1.5px solid #E5E7EB", borderRadius: 12, fontSize: 21, fontWeight: 800, letterSpacing: ".06em", outline: "none", color: "#111827", boxSizing: "border-box", background: "#F8F7FE" }} />
          {error && <div style={{ marginTop: 10, color: "#DC2626", fontSize: 13.5, fontWeight: 600, display: "flex", alignItems: "center", gap: 6 }}><AlertTriangle style={{ width: 15, height: 15 }} /> {error}</div>}
          <button onClick={consultar} data-testid="sub-consultar"
            style={{ marginTop: 16, width: "100%", padding: "15px", background: "#7C3AED", color: "#fff", border: "none", borderRadius: 12, cursor: "pointer", fontSize: 16.5, fontWeight: 800, display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 8 }}>
            <Search style={{ width: 19, height: 19 }} /> Ver mi subsidio
          </button>
          <div style={{ marginTop: 22, fontSize: 12.5, color: "#9CA3AF" }}>¿Ya tienes cuenta con contraseña? <a href="/login" style={{ color: "#7C3AED", fontWeight: 700 }}>Inicia sesión</a></div>
        </div>
      </div>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}} @media(min-width:1024px){.sub-hero{display:block!important}}`}</style>
    </div>
  );
}
