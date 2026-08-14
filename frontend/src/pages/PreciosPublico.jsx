import React, { useState, useEffect, useMemo } from "react";
import { api } from "../lib/api";
import { Fuel, MapPin, Loader2, Search, MessageCircle, TrendingDown, Star, ShieldCheck } from "lucide-react";

const LOGO_IMG = "https://customer-assets.emergentagent.com/job_enered-insight/artifacts/hrbrugb8_image.png";
const WSP = "51997389536";
const WSP_MSG = encodeURIComponent("Hola ENERED, quiero acceder a los mejores precios de combustible con la calidad asegurada de la Red ENERED para mi flota.");
const fmtSoles = (n) => "S/ " + (Number(n) || 0).toLocaleString("es-PE", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export default function PreciosPublico() {
  const [data, setData] = useState([]);
  const [combustibles, setCombustibles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [comb, setComb] = useState("");
  const [q, setQ] = useState("");
  const [soloEnered, setSoloEnered] = useState(false);
  const [dep, setDep] = useState("");
  const [prov, setProv] = useState("");
  const [dist, setDist] = useState("");
  const [page, setPage] = useState(1);
  const pageSize = 25;

  const uniq = (arr) => [...new Set(arr.map((x) => (x || "").trim()).filter(Boolean))].sort();
  const departamentos = useMemo(() => uniq(data.map((e) => e.departamento)), [data]);
  const provincias = useMemo(() => uniq(data.filter((e) => !dep || e.departamento === dep).map((e) => e.provincia)), [data, dep]);
  const distritos = useMemo(() => uniq(data.filter((e) => (!dep || e.departamento === dep) && (!prov || e.provincia === prov)).map((e) => e.distrito)), [data, dep, prov]);

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
    if (soloEnered && !e.es_enered) return false;
    if (comb && e.combustible !== comb) return false;
    if (dep && e.departamento !== dep) return false;
    if (prov && e.provincia !== prov) return false;
    if (dist && e.distrito !== dist) return false;
    if (q) {
      const t = q.toLowerCase();
      if (!`${e.estacion} ${e.departamento} ${e.provincia} ${e.distrito} ${e.direccion}`.toLowerCase().includes(t)) return false;
    }
    return true;
  }), [data, comb, q, soloEnered, dep, prov, dist]);

  useEffect(() => { setPage(1); }, [comb, q, soloEnered, dep, prov, dist]);
  const totalPages = Math.max(1, Math.ceil(filtradas.length / pageSize));
  const pageRows = filtradas.slice((page - 1) * pageSize, page * pageSize);
  const ciudad = (e) => [e.distrito, e.provincia, e.departamento].filter(Boolean)[0] || "—";

  return (
    <div style={{ minHeight: "100vh", background: "#F6F7FB", fontFamily: "'Open Sans', system-ui, sans-serif" }}>
      {/* Header */}
      <div style={{ background: "#fff", borderBottom: "1px solid #EEE", padding: "14px 24px" }}>
        <div style={{ maxWidth: 1120, margin: "0 auto" }}>
          <img src={LOGO_IMG} alt="ENERED" style={{ height: 30 }} />
        </div>
      </div>

      <div style={{ maxWidth: 1120, margin: "0 auto", padding: "22px 20px 60px" }}>
        {/* HERO + BOTÓN GRANDE */}
        <div style={{ background: "linear-gradient(135deg,#7C3AED 0%,#5B21B6 100%)", borderRadius: 20, padding: "30px 28px", color: "#fff", position: "relative", overflow: "hidden" }}>
          <div style={{ position: "absolute", right: -30, top: -30, opacity: 0.12 }}><Fuel style={{ width: 190, height: 190 }} /></div>
          <div style={{ display: "inline-flex", alignItems: "center", gap: 7, background: "rgba(255,255,255,.18)", padding: "4px 12px", borderRadius: 999, fontSize: 11.5, fontWeight: 800, letterSpacing: ".05em" }}>
            <Fuel style={{ width: 14, height: 14 }} /> COMBUSTIBLE · RED ENERED
          </div>
          <h1 style={{ fontSize: 34, fontWeight: 900, lineHeight: 1.1, margin: "12px 0 8px", maxWidth: 720 }}>
            Los mejores precios del mercado, con la <span style={{ color: "#6EE7B7" }}>calidad asegurada</span> de ENERED
          </h1>
          <p style={{ fontSize: 15, color: "#E9D5FF", margin: "0 0 20px", maxWidth: 640 }}>
            Compara todas las estaciones del país en tiempo real y carga con el <b style={{ color: "#fff" }}>precio especial ENERED</b>, factura y tarjeta. Calidad garantizada en cada galón.
          </p>
          <a href={`https://wa.me/${WSP}?text=${WSP_MSG}`} target="_blank" rel="noreferrer"
            style={{ display: "inline-flex", alignItems: "center", gap: 10, background: "#16A34A", color: "#fff", padding: "16px 30px", borderRadius: 14, fontSize: 18, fontWeight: 900, textDecoration: "none", boxShadow: "0 10px 26px rgba(22,163,74,.4)" }}>
            <MessageCircle style={{ width: 22, height: 22 }} /> Quiero los mejores precios con ENERED
          </a>
        </div>

        {/* Filtros */}
        <div style={{ background: "#fff", border: "1px solid #EEE", borderRadius: 14, padding: 14, display: "flex", gap: 12, flexWrap: "wrap", alignItems: "center", marginTop: 16, boxShadow: "0 6px 20px rgba(0,0,0,.05)" }}>
          <div style={{ position: "relative", flex: 1, minWidth: 220 }}>
            <Search style={{ width: 15, height: 15, color: "#9CA3AF", position: "absolute", left: 12, top: 12 }} />
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar estación o ciudad…"
              style={{ width: "100%", padding: "10px 12px 10px 34px", border: "1px solid #E5E7EB", borderRadius: 10, fontSize: 14, boxSizing: "border-box" }} />
          </div>
          <select value={dep} onChange={(e) => { setDep(e.target.value); setProv(""); setDist(""); }}
            style={{ padding: "10px 12px", border: "1px solid #E5E7EB", borderRadius: 10, fontSize: 14, fontWeight: 600, color: "#374151", minWidth: 150 }}>
            <option value="">Todo departamento</option>
            {departamentos.map((d) => <option key={d} value={d}>{d}</option>)}
          </select>
          <select value={prov} onChange={(e) => { setProv(e.target.value); setDist(""); }} disabled={!provincias.length}
            style={{ padding: "10px 12px", border: "1px solid #E5E7EB", borderRadius: 10, fontSize: 14, fontWeight: 600, color: "#374151", minWidth: 150, opacity: provincias.length ? 1 : 0.5 }}>
            <option value="">Toda provincia</option>
            {provincias.map((p) => <option key={p} value={p}>{p}</option>)}
          </select>
          <select value={dist} onChange={(e) => setDist(e.target.value)} disabled={!distritos.length}
            style={{ padding: "10px 12px", border: "1px solid #E5E7EB", borderRadius: 10, fontSize: 14, fontWeight: 600, color: "#374151", minWidth: 150, opacity: distritos.length ? 1 : 0.5 }}>
            <option value="">Todo distrito</option>
            {distritos.map((d) => <option key={d} value={d}>{d}</option>)}
          </select>
          <select value={comb} onChange={(e) => setComb(e.target.value)}
            style={{ padding: "10px 12px", border: "1px solid #E5E7EB", borderRadius: 10, fontSize: 14, fontWeight: 600, color: "#374151", minWidth: 170 }}>
            <option value="">Todos los combustibles</option>
            {combustibles.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
          {(dep || prov || dist || comb || q || soloEnered) && (
            <button onClick={() => { setDep(""); setProv(""); setDist(""); setComb(""); setQ(""); setSoloEnered(false); }}
              style={{ padding: "10px 12px", border: "1px solid #E5E7EB", borderRadius: 10, fontSize: 13, fontWeight: 700, color: "#6b7280", background: "#fff", cursor: "pointer" }}>Limpiar</button>
          )}
          <label style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 13, fontWeight: 700, color: "#5B21B6", cursor: "pointer" }}>
            <input type="checkbox" checked={soloEnered} onChange={(e) => setSoloEnered(e.target.checked)} style={{ accentColor: "#7C3AED", width: 15, height: 15 }} />
            Solo Red ENERED
          </label>
          <div style={{ fontSize: 12.5, color: "#6b7280", fontWeight: 600 }}>{filtradas.length} estación(es)</div>
        </div>

        {/* Tabla */}
        <div style={{ background: "#fff", border: "1px solid #EEE", borderRadius: 14, overflow: "hidden", marginTop: 14, boxShadow: "0 6px 20px rgba(0,0,0,.05)" }}>
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13, minWidth: 800 }}>
              <thead>
                <tr style={{ background: "#211A36", color: "#fff", fontSize: 11, textTransform: "uppercase", letterSpacing: ".04em" }}>
                  {[["Estación", "left"], ["Ciudad", "left"], ["Combustible", "left"], ["Calidad", "center"], ["Pizarra", "right"], ["Precio ENERED", "right"], ["Ahorro", "right"]].map(([h, al]) => (
                    <th key={h} style={{ padding: "11px 14px", textAlign: al, fontWeight: 700, whiteSpace: "nowrap", color: h === "Precio ENERED" ? "#6EE7B7" : "#fff" }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr><td colSpan={7} style={{ padding: 40, textAlign: "center", color: "#9CA3AF" }}><Loader2 style={{ width: 22, height: 22, animation: "spin 1s linear infinite", color: "#7C3AED" }} /><div style={{ marginTop: 8 }}>Cargando precios del mercado…</div></td></tr>
                ) : pageRows.length === 0 ? (
                  <tr><td colSpan={7} style={{ padding: 40, textAlign: "center", color: "#9CA3AF" }}>No hay estaciones para ese filtro.</td></tr>
                ) : pageRows.map((e, i) => (
                  <tr key={i} style={{ borderBottom: "1px solid #F3F4F6", background: e.es_enered ? "#F0FDF4" : "#fff" }}>
                    <td style={{ padding: "11px 14px", fontWeight: 800, color: "#111827" }}>
                      {e.es_enered && <span style={{ color: "#F59E0B" }}>⭐ </span>}{e.estacion}
                      {e.es_enered && <span style={{ marginLeft: 6, background: "#DCFCE7", color: "#065F46", fontSize: 10, fontWeight: 800, padding: "1px 7px", borderRadius: 999 }}>RED ENERED</span>}
                    </td>
                    <td style={{ padding: "11px 14px", color: "#059669", fontWeight: 700, textTransform: "capitalize" }}>{ciudad(e)}</td>
                    <td style={{ padding: "11px 14px", color: "#374151", whiteSpace: "nowrap" }}>{e.combustible || "—"}</td>
                    <td style={{ padding: "11px 14px", textAlign: "center" }}>
                      <span style={{ display: "inline-flex", gap: 1 }}>{[1, 2, 3, 4, 5].map((s) => <Star key={s} style={{ width: 12, height: 12, color: s <= (e.calidad || 2) ? "#F59E0B" : "#E5E7EB", fill: s <= (e.calidad || 2) ? "#F59E0B" : "none" }} />)}</span>
                    </td>
                    <td style={{ padding: "11px 14px", textAlign: "right", color: "#6b7280", whiteSpace: "nowrap" }}>{e.precio_pizarra ? fmtSoles(e.precio_pizarra) : "—"}</td>
                    <td style={{ padding: "11px 14px", textAlign: "right", fontWeight: 900, color: e.precio_enered ? "#059669" : "#D1D5DB", whiteSpace: "nowrap" }}>{e.precio_enered ? fmtSoles(e.precio_enered) : "no aplica"}</td>
                    <td style={{ padding: "11px 14px", textAlign: "right", whiteSpace: "nowrap" }}>
                      {e.ahorro ? <span style={{ display: "inline-flex", alignItems: "center", gap: 3, color: "#059669", fontWeight: 800 }}><TrendingDown style={{ width: 13, height: 13 }} />-{fmtSoles(e.ahorro)}</span> : <span style={{ color: "#D1D5DB" }}>—</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {/* Paginación */}
          {!loading && filtradas.length > pageSize && (
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "12px 16px", borderTop: "1px solid #F3F4F6", fontSize: 13, color: "#6b7280" }}>
              <span>Mostrando {(page - 1) * pageSize + 1}–{Math.min(page * pageSize, filtradas.length)} de {filtradas.length}</span>
              <div style={{ display: "flex", gap: 8 }}>
                <button disabled={page === 1} onClick={() => setPage((p) => Math.max(1, p - 1))} style={{ padding: "7px 14px", border: "1px solid #E5E7EB", borderRadius: 8, background: "#fff", cursor: page === 1 ? "default" : "pointer", opacity: page === 1 ? 0.4 : 1, fontWeight: 600 }}>Anterior</button>
                <span style={{ padding: "7px 12px", fontWeight: 700, color: "#5B21B6" }}>Pág {page} / {totalPages}</span>
                <button disabled={page >= totalPages} onClick={() => setPage((p) => Math.min(totalPages, p + 1))} style={{ padding: "7px 14px", border: "1px solid #E5E7EB", borderRadius: 8, background: "#fff", cursor: page >= totalPages ? "default" : "pointer", opacity: page >= totalPages ? 0.4 : 1, fontWeight: 600 }}>Siguiente</button>
              </div>
            </div>
          )}
        </div>

        {/* CTA inferior */}
        <div style={{ background: "#fff", border: "1px solid #A7F3D0", borderRadius: 14, padding: 20, marginTop: 16, display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 12, boxShadow: "0 6px 20px rgba(0,0,0,.05)" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <ShieldCheck style={{ width: 26, height: 26, color: "#16A34A" }} />
            <div style={{ fontWeight: 800, color: "#065F46", fontSize: 15 }}>Precio especial, factura y tarjeta ENERED. Calidad asegurada en cada galón.</div>
          </div>
          <a href={`https://wa.me/${WSP}?text=${WSP_MSG}`} target="_blank" rel="noreferrer"
            style={{ background: "#16A34A", color: "#fff", padding: "12px 22px", borderRadius: 10, fontSize: 14.5, fontWeight: 800, textDecoration: "none", display: "inline-flex", alignItems: "center", gap: 8 }}>
            <MessageCircle style={{ width: 17, height: 17 }} /> Afíliate por WhatsApp
          </a>
        </div>

        <div style={{ marginTop: 14, fontSize: 11.5, color: "#9CA3AF", display: "flex", alignItems: "center", gap: 6 }}>
          <MapPin style={{ width: 13, height: 13 }} /> Precios de mercado (Facilito · OSINERGMIN). Las estaciones ⭐ Red ENERED tienen precio especial garantizado.
        </div>
      </div>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  );
}
