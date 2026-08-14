import React, { useState, useEffect, useMemo } from "react";
import { api } from "../lib/api";
import { Fuel, MapPin, Loader2, Search, ShieldCheck, MessageCircle, TrendingDown } from "lucide-react";

const LOGO_IMG = "https://customer-assets.emergentagent.com/job_enered-insight/artifacts/hrbrugb8_image.png";
const WSP = "51997389536";
const fmtSoles = (n) => "S/ " + (Number(n) || 0).toLocaleString("es-PE", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export default function PreciosPublico() {
  const [data, setData] = useState([]);
  const [combustibles, setCombustibles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [comb, setComb] = useState("");
  const [q, setQ] = useState("");

  useEffect(() => {
    let alive = true;
    setLoading(true);
    api.get("/precios/publico")
      .then(({ data }) => { if (alive) { setData(data.estaciones || []); setCombustibles(data.combustibles || []); } })
      .catch(() => {})
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, []);

  const filtradas = useMemo(() => data.filter((e) => {
    if (comb && e.combustible !== comb) return false;
    if (q) {
      const t = q.toLowerCase();
      const blob = `${e.estacion} ${e.departamento} ${e.provincia} ${e.distrito}`.toLowerCase();
      if (!blob.includes(t)) return false;
    }
    return true;
  }), [data, comb, q]);

  const ciudad = (e) => [e.distrito, e.provincia, e.departamento].filter(Boolean)[0] || "—";

  return (
    <div style={{ minHeight: "100vh", background: "#F6F7FB", fontFamily: "'Open Sans', system-ui, sans-serif" }}>
      {/* Header */}
      <div style={{ background: "linear-gradient(135deg,#7C3AED 0%,#5B21B6 100%)", color: "#fff", padding: "22px 24px 30px" }}>
        <div style={{ maxWidth: 1100, margin: "0 auto" }}>
          <img src={LOGO_IMG} alt="ENERED" style={{ height: 30, filter: "brightness(0) invert(1)", marginBottom: 14 }} />
          <div style={{ display: "inline-flex", alignItems: "center", gap: 7, background: "rgba(255,255,255,.18)", padding: "4px 12px", borderRadius: 999, fontSize: 11.5, fontWeight: 800, letterSpacing: ".05em" }}>
            <Fuel style={{ width: 14, height: 14 }} /> PRECIOS RED ENERED
          </div>
          <h1 style={{ fontSize: 30, fontWeight: 800, margin: "10px 0 4px" }}>Precios de combustible por estación</h1>
          <p style={{ fontSize: 14, color: "#E9D5FF", margin: 0 }}>Precios especiales de la Red ENERED. Aceptan factura y tarjeta ENERED.</p>
        </div>
      </div>

      <div style={{ maxWidth: 1100, margin: "-16px auto 0", padding: "0 20px 60px" }}>
        {/* Filtros */}
        <div style={{ background: "#fff", border: "1px solid #EEE", borderRadius: 14, padding: 14, display: "flex", gap: 12, flexWrap: "wrap", alignItems: "center", boxShadow: "0 6px 20px rgba(0,0,0,.06)" }}>
          <div style={{ position: "relative", flex: 1, minWidth: 220 }}>
            <Search style={{ width: 15, height: 15, color: "#9CA3AF", position: "absolute", left: 12, top: 12 }} />
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar estación o ciudad…"
              style={{ width: "100%", padding: "10px 12px 10px 34px", border: "1px solid #E5E7EB", borderRadius: 10, fontSize: 14, boxSizing: "border-box" }} />
          </div>
          <select value={comb} onChange={(e) => setComb(e.target.value)}
            style={{ padding: "10px 12px", border: "1px solid #E5E7EB", borderRadius: 10, fontSize: 14, fontWeight: 600, color: "#374151", minWidth: 200 }}>
            <option value="">Todos los combustibles</option>
            {combustibles.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
          <div style={{ fontSize: 12.5, color: "#6b7280", fontWeight: 600 }}>{filtradas.length} estación(es)</div>
        </div>

        {/* Tabla */}
        <div style={{ background: "#fff", border: "1px solid #EEE", borderRadius: 14, overflow: "hidden", marginTop: 14, boxShadow: "0 6px 20px rgba(0,0,0,.06)" }}>
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13, minWidth: 760 }}>
              <thead>
                <tr style={{ background: "#211A36", color: "#fff", fontSize: 11, textTransform: "uppercase", letterSpacing: ".04em" }}>
                  {["Estación", "Ciudad", "Combustible", "Pizarra", "Precio ENERED", "Ahorro", "Factura", "Tarjeta"].map((h) => (
                    <th key={h} style={{ padding: "11px 14px", textAlign: h === "Estación" || h === "Ciudad" || h === "Combustible" ? "left" : "right", fontWeight: 700, whiteSpace: "nowrap", color: h === "Precio ENERED" ? "#6EE7B7" : "#fff" }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr><td colSpan={8} style={{ padding: 40, textAlign: "center", color: "#9CA3AF" }}><Loader2 style={{ width: 22, height: 22, animation: "spin 1s linear infinite", color: "#7C3AED" }} /><div style={{ marginTop: 8 }}>Cargando precios…</div></td></tr>
                ) : filtradas.length === 0 ? (
                  <tr><td colSpan={8} style={{ padding: 40, textAlign: "center", color: "#9CA3AF" }}>No hay estaciones para ese filtro.</td></tr>
                ) : filtradas.map((e, i) => (
                  <tr key={i} style={{ borderBottom: "1px solid #F3F4F6", background: "#fff" }}>
                    <td style={{ padding: "11px 14px", fontWeight: 800, color: "#111827" }}>
                      <span style={{ color: "#F59E0B" }}>⭐ </span>{e.estacion}
                    </td>
                    <td style={{ padding: "11px 14px", color: "#059669", fontWeight: 700, textTransform: "capitalize" }}>{ciudad(e)}</td>
                    <td style={{ padding: "11px 14px", color: "#374151" }}>{e.combustible}</td>
                    <td style={{ padding: "11px 14px", textAlign: "right", color: "#6b7280", whiteSpace: "nowrap" }}>{e.precio_pizarra ? fmtSoles(e.precio_pizarra) : "—"}</td>
                    <td style={{ padding: "11px 14px", textAlign: "right", fontWeight: 900, color: "#059669", whiteSpace: "nowrap" }}>{fmtSoles(e.precio_enered)}</td>
                    <td style={{ padding: "11px 14px", textAlign: "right", whiteSpace: "nowrap" }}>
                      {e.ahorro ? <span style={{ display: "inline-flex", alignItems: "center", gap: 3, color: "#059669", fontWeight: 800 }}><TrendingDown style={{ width: 13, height: 13 }} />-{fmtSoles(e.ahorro)}</span> : <span style={{ color: "#D1D5DB" }}>—</span>}
                    </td>
                    <td style={{ padding: "11px 14px", textAlign: "right" }}>{e.acepta_factura ? "✅" : "—"}</td>
                    <td style={{ padding: "11px 14px", textAlign: "right" }}>{e.acepta_tarjeta ? "✅" : "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* CTA */}
        <div style={{ background: "#fff", border: "1px solid #A7F3D0", borderRadius: 14, padding: 20, marginTop: 16, display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 12, boxShadow: "0 6px 20px rgba(0,0,0,.06)" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <ShieldCheck style={{ width: 26, height: 26, color: "#16A34A" }} />
            <div>
              <div style={{ fontWeight: 800, color: "#065F46", fontSize: 15 }}>¿Quieres estos precios para tu flota?</div>
              <div style={{ fontSize: 13, color: "#4B5563", marginTop: 2 }}>Afíliate a la Red ENERED y carga combustible con precio especial, factura y tarjeta.</div>
            </div>
          </div>
          <a href={`https://wa.me/${WSP}?text=${encodeURIComponent("Hola ENERED, quiero afiliar mi flota a la Red ENERED y acceder a los precios especiales de combustible.")}`}
            target="_blank" rel="noreferrer"
            style={{ background: "#16A34A", color: "#fff", padding: "12px 20px", borderRadius: 10, fontSize: 14.5, fontWeight: 800, textDecoration: "none", display: "inline-flex", alignItems: "center", gap: 8 }}>
            <MessageCircle style={{ width: 17, height: 17 }} /> Quiero afiliarme
          </a>
        </div>

        <div style={{ marginTop: 14, fontSize: 11.5, color: "#9CA3AF", display: "flex", alignItems: "center", gap: 6 }}>
          <MapPin style={{ width: 13, height: 13 }} /> Precios referenciales de la Red ENERED. La pizarra es el precio de mercado (Facilito · OSINERGMIN).
        </div>
      </div>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  );
}
