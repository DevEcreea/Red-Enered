import React, { useState } from "react";
import { Navigate } from "react-router-dom";
import { api } from "../lib/api";
import { useAuth } from "../context/AuthContext";
import {
  Search, Loader2, Truck, ShieldCheck, XCircle, CheckCircle2,
  AlertTriangle, Building2, ArrowRight, Coins,
} from "lucide-react";

const fmtSoles = (n) => "S/ " + (Number(n) || 0).toLocaleString("es-PE", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const fmtNum = (n) => (Number(n) || 0).toLocaleString("es-PE", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export default function SubsidioPublico() {
  const { user, checking } = useAuth();
  const [ruc, setRuc] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [data, setData] = useState(null);

  // Un cliente ya logueado no debe ver la landing pública: va a su Mi Flota.
  if (checking) return null;
  if (user && user.role === "cliente_subsidio") return <Navigate to="/subsidio/documentos" replace />;

  async function consultar() {
    const r = ruc.trim();
    if (!/^\d{11}$/.test(r)) { setError("Ingresa un RUC válido de 11 dígitos"); return; }
    setLoading(true); setError("");
    try {
      // Diagnóstico PÚBLICO: solo consulta (NO crea usuario en la plataforma por cada búsqueda).
      const { data } = await api.get("/subsidio/resumen", { params: { ruc: r } });
      setData(data);
    } catch (e) {
      setError(e?.response?.data?.detail || "No se pudo consultar. Intenta de nuevo.");
    } finally {
      setLoading(false);
    }
  }

  // Pantalla inicial: estilo login (imagen + RUC)
  if (!data) {
    return (
      <div style={{ minHeight: "100vh", display: "flex", background: "#fff", fontFamily: "'Open Sans', system-ui, sans-serif" }}>
        {/* Panel imagen (izquierda) */}
        <div style={{ flex: "0 0 55%", backgroundImage: `url(${HERO_IMG})`, backgroundSize: "cover", backgroundPosition: "center", display: "none" }} className="sub-hero" />
        {/* Panel formulario (derecha) */}
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
            <button onClick={consultar} disabled={loading} data-testid="sub-consultar"
              style={{ marginTop: 16, width: "100%", padding: "15px", background: loading ? "#A78BFA" : "#7C3AED", color: "#fff", border: "none", borderRadius: 12, cursor: loading ? "wait" : "pointer", fontSize: 16.5, fontWeight: 800, display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 8 }}>
              {loading ? <Loader2 style={{ width: 19, height: 19, animation: "spin 1s linear infinite" }} /> : <Search style={{ width: 19, height: 19 }} />}
              {loading ? "Consultando…" : "Ver mi subsidio"}
            </button>
            <div style={{ marginTop: 22, fontSize: 12.5, color: "#9CA3AF" }}>¿Ya tienes cuenta con contraseña? <a href="/login" style={{ color: "#7C3AED", fontWeight: 700 }}>Inicia sesión</a></div>
          </div>
        </div>
        <style>{`@keyframes spin{to{transform:rotate(360deg)}} @media(min-width:1024px){.sub-hero{display:block!important}}`}</style>
      </div>
    );
  }

  // Con datos: cabecera + Etapa 0
  return (
    <div style={{ minHeight: "100vh", background: "linear-gradient(160deg,#0B1220 0%,#15213B 55%,#1E2A4A 100%)", fontFamily: "'Open Sans', system-ui, sans-serif" }}>
      <div style={{ padding: "16px 28px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <img src={LOGO_IMG} alt="ENERED" style={{ height: 30, filter: "brightness(0) invert(1)" }} />
        <button onClick={() => { setData(null); setRuc(""); }} style={{ background: "rgba(255,255,255,.1)", color: "#fff", border: "1px solid rgba(255,255,255,.2)", borderRadius: 9, padding: "8px 14px", cursor: "pointer", fontSize: 13, fontWeight: 700 }}>← Otra consulta</button>
      </div>
      <div style={{ maxWidth: 1080, margin: "0 auto", padding: "6px 20px 60px" }}>
        <Etapa0 data={data} />
      </div>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  );
}

const HERO_IMG = "https://customer-assets.emergentagent.com/job_ui-update-11/artifacts/mbmk49w0_WhatsApp%20Image%202026-06-10%20at%206.26.35%20PM.jpeg";
const LOGO_IMG = "https://customer-assets.emergentagent.com/job_enered-insight/artifacts/hrbrugb8_image.png";

function Etapa0({ data }) {
  const s = data.subsidio || {};
  const cumplen = data.unidades.filter((u) => u.cumple).length;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      {/* ETAPA 0 · Máximo a reclamar */}
      <div style={{ background: "linear-gradient(135deg,#7C3AED 0%,#5B21B6 100%)", borderRadius: 18, padding: 26, color: "#fff", position: "relative", overflow: "hidden" }}>
        <div style={{ position: "absolute", right: -20, top: -20, opacity: 0.12 }}><Coins style={{ width: 160, height: 160 }} /></div>
        <div style={{ display: "inline-flex", alignItems: "center", gap: 7, background: "rgba(255,255,255,.18)", padding: "4px 12px", borderRadius: 999, fontSize: 11.5, fontWeight: 800, letterSpacing: ".05em" }}>ETAPA 0 · TU POTENCIAL</div>
        <div style={{ fontSize: 14, fontWeight: 600, color: "#E9D5FF", marginTop: 12, display: "flex", alignItems: "center", gap: 8 }}>
          <Building2 style={{ width: 15, height: 15 }} /> {data.razon_social || `RUC ${data.ruc}`}
        </div>
        <div style={{ fontSize: 14, color: "#DDD6FE", marginTop: 14 }}>Máximo del subsidio que puedes reclamar</div>
        <div style={{ fontSize: 46, fontWeight: 800, lineHeight: 1.05, marginTop: 2 }}>{fmtSoles(s.total_monto)}</div>
        <div style={{ fontSize: 13.5, color: "#DDD6FE", marginTop: 6 }}>
          Hasta <b style={{ color: "#fff" }}>{fmtNum(s.total_galones)} galones</b> · {s.unidades_con_subsidio} unidad{s.unidades_con_subsidio !== 1 ? "es" : ""} con subsidio de {s.total_unidades} en total
        </div>
        {/* desglose por categoría */}
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginTop: 16 }}>
          {(s.por_categoria || []).map((c) => (
            <div key={c.categoria} style={{ background: "rgba(255,255,255,.12)", borderRadius: 11, padding: "10px 14px", minWidth: 120 }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: "#E9D5FF" }}>{c.unidades} × Categoría {c.categoria}</div>
              <div style={{ fontSize: 17, fontWeight: 800, marginTop: 2 }}>{fmtSoles(c.monto)}</div>
              <div style={{ fontSize: 11, color: "#C4B5FD" }}>{fmtNum(c.tope)} gal/unid · máx</div>
            </div>
          ))}
        </div>
      </div>

      {/* Veredicto de requisitos */}
      {data.requisitos && (
        <div style={{ background: "#fff", borderRadius: 16, padding: 20, boxShadow: "0 10px 30px rgba(0,0,0,.2)" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 14, flexWrap: "wrap" }}>
            {data.cumple_subsidio === true
              ? <div style={{ display: "inline-flex", alignItems: "center", gap: 9, background: "#F0FDF4", color: "#065F46", padding: "8px 16px", borderRadius: 11, fontWeight: 800, fontSize: 15 }}><CheckCircle2 style={{ width: 20, height: 20 }} /> ¡Cumples los requisitos del subsidio!</div>
              : data.cumple_subsidio === false
              ? <div style={{ display: "inline-flex", alignItems: "center", gap: 9, background: "#FEF2F2", color: "#991B1B", padding: "8px 16px", borderRadius: 11, fontWeight: 800, fontSize: 15 }}><XCircle style={{ width: 20, height: 20 }} /> Aún no cumples todos los requisitos</div>
              : <div style={{ display: "inline-flex", alignItems: "center", gap: 9, background: "#FFFBEB", color: "#92400E", padding: "8px 16px", borderRadius: 11, fontWeight: 800, fontSize: 15 }}><AlertTriangle style={{ width: 20, height: 20 }} /> Requisitos por verificar</div>}
            {data.cumple_subsidio === false && <span style={{ fontSize: 13, color: "#6b7280", fontWeight: 600 }}>ENERED te ayuda a regularizar lo que falta.</span>}
            {data.cumple_subsidio == null && <span style={{ fontSize: 13, color: "#6b7280", fontWeight: 600 }}>Verificación ATU no disponible en este momento.</span>}
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(240px,1fr))", gap: 10 }}>
            {data.requisitos.map((r) => {
              const col = r.cumple === true ? { bg: "#F0FDF4", bd: "#16A34A" } : r.cumple === false ? { bg: "#FEF2F2", bd: "#DC2626" } : { bg: "#FFFBEB", bd: "#EAB308" };
              return (
                <div key={r.codigo} style={{ display: "flex", gap: 10, padding: "12px 14px", borderRadius: 11, background: col.bg, borderLeft: `4px solid ${col.bd}` }}>
                  {r.cumple === true ? <CheckCircle2 style={{ width: 19, height: 19, color: "#16A34A", flexShrink: 0 }} />
                    : r.cumple === false ? <XCircle style={{ width: 19, height: 19, color: "#DC2626", flexShrink: 0 }} />
                    : <AlertTriangle style={{ width: 19, height: 19, color: "#EAB308", flexShrink: 0 }} />}
                  <div>
                    <div style={{ fontWeight: 800, color: "#111827", fontSize: 13.5 }}>{r.nombre}</div>
                    <div style={{ fontSize: 12, color: "#6b7280", marginTop: 2 }}>{r.detalle}</div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Dos cuadros lado a lado */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
        {/* Unidades ATU */}
        <div style={{ background: "#fff", borderRadius: 16, overflow: "hidden", boxShadow: "0 10px 30px rgba(0,0,0,.2)" }}>
          <div style={{ padding: "14px 18px", borderBottom: "1px solid #F3F4F6", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <div style={{ fontWeight: 800, color: "#111827", fontSize: 14.5, display: "flex", alignItems: "center", gap: 8 }}><Truck style={{ width: 17, height: 17, color: "#7C3AED" }} /> Tus unidades en la ATU</div>
            <div style={{ fontSize: 12.5, fontWeight: 700, color: cumplen ? "#059669" : "#DC2626" }}>{cumplen}/{data.unidades.length} aceptadas</div>
          </div>
          <div style={{ maxHeight: 380, overflowY: "auto" }}>
            {data.unidades.length === 0 && <div style={{ padding: 24, textAlign: "center", color: "#9CA3AF", fontSize: 13.5 }}>Sin unidades en el MTC.</div>}
            {data.unidades.map((u, i) => (
              <div key={i} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "11px 18px", borderBottom: "1px solid #F6F7F9", background: u.cumple ? "#fff" : "#FFFBFB" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <span style={{ fontWeight: 800, color: "#1D4ED8", letterSpacing: ".03em", fontSize: 14 }}>{u.placa}</span>
                  <span style={{ background: "#EFF6FF", color: "#1E40AF", padding: "1px 8px", borderRadius: 6, fontWeight: 700, fontSize: 11.5 }}>{u.categoria || "—"}</span>
                </div>
                {u.cumple
                  ? <span style={{ display: "inline-flex", alignItems: "center", gap: 5, color: "#065F46", fontWeight: 700, fontSize: 12.5 }}><CheckCircle2 style={{ width: 15, height: 15 }} /> Cumple</span>
                  : <span style={{ display: "inline-flex", alignItems: "center", gap: 5, color: "#991B1B", fontWeight: 700, fontSize: 12.5 }}><XCircle style={{ width: 15, height: 15 }} /> No cumple</span>}
              </div>
            ))}
          </div>
        </div>

        {/* Semáforo ATU */}
        <div style={{ background: "#fff", borderRadius: 16, overflow: "hidden", boxShadow: "0 10px 30px rgba(0,0,0,.2)" }}>
          <div style={{ padding: "14px 18px", borderBottom: "1px solid #F3F4F6", fontWeight: 800, color: "#111827", fontSize: 14.5, display: "flex", alignItems: "center", gap: 8 }}>
            <ShieldCheck style={{ width: 17, height: 17, color: "#7C3AED" }} /> Semáforo de condiciones (ATU)
          </div>
          <div style={{ padding: 14, display: "flex", flexDirection: "column", gap: 10, maxHeight: 380, overflowY: "auto" }}>
            {!data.atu_disponible && <div style={{ padding: 18, textAlign: "center", color: "#9CA3AF", fontSize: 13 }}>Verificación ATU no disponible ahora.</div>}
            {data.semaforo.length === 0 && data.atu_disponible && <div style={{ padding: 18, textAlign: "center", color: "#9CA3AF", fontSize: 13 }}>Sin condiciones para este RUC.</div>}
            {data.semaforo.map((c, i) => {
              const cumple = (c.estado || "").toUpperCase() === "CUMPLE";
              return (
                <div key={i} style={{ display: "flex", gap: 11, padding: "12px 14px", borderRadius: 11, background: cumple ? "#F0FDF4" : "#FEF2F2", borderLeft: `4px solid ${cumple ? "#16A34A" : "#DC2626"}` }}>
                  {cumple ? <CheckCircle2 style={{ width: 20, height: 20, color: "#16A34A", flexShrink: 0 }} /> : <XCircle style={{ width: 20, height: 20, color: "#DC2626", flexShrink: 0 }} />}
                  <div>
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <span style={{ fontWeight: 800, color: "#111827", fontSize: 13.5 }}>{c.nombre}</span>
                      <span style={{ fontSize: 11, fontWeight: 800, color: cumple ? "#16A34A" : "#DC2626" }}>{cumple ? "CUMPLE" : "NO CUMPLE"}</span>
                    </div>
                    <div style={{ fontSize: 12.5, color: "#6b7280", marginTop: 2 }}>{c.descripcion}</div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* CTA WhatsApp (conversión) */}
      <div style={{ background: "#fff", borderRadius: 16, padding: 20, display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 12, boxShadow: "0 10px 30px rgba(0,0,0,.2)" }}>
        <div>
          <div style={{ fontWeight: 800, color: "#111827", fontSize: 15 }}>¿Quieres reclamar tu subsidio completo?</div>
          <div style={{ fontSize: 13, color: "#6b7280", marginTop: 2 }}>La ATU permite postular una sola vez. Escríbenos y nuestro equipo arma tu expediente sin margen de error.</div>
        </div>
        <a href={`https://wa.me/51997389536?text=${encodeURIComponent(`Hola ENERED, soy ${data.razon_social || `RUC ${data.ruc}`}. Vi mi diagnóstico de subsidio (hasta ${fmtSoles(s.total_monto)}) y quiero que me ayuden a reclamarlo.`)}`}
          target="_blank" rel="noreferrer" data-testid="sub-continuar"
          style={{ padding: "13px 24px", background: "#16A34A", color: "#fff", border: "none", borderRadius: 11, cursor: "pointer", fontSize: 15, fontWeight: 800, display: "inline-flex", alignItems: "center", gap: 8, textDecoration: "none" }}>
          Escríbenos por WhatsApp <ArrowRight style={{ width: 17, height: 17 }} />
        </a>
      </div>
    </div>
  );
}
