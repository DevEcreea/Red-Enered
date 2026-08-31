import React, { useState, useEffect, useMemo } from "react";
import { api } from "../lib/api";
import { Fuel, MapPin, Loader2, Search, MessageCircle, Star } from "lucide-react";

const LOGO_IMG = "https://customer-assets.emergentagent.com/job_enered-insight/artifacts/hrbrugb8_image.png";
const WSP = "51997389536";
const WSP_MSG = encodeURIComponent("Hola ENERED, quiero acceder a los mejores precios de combustible con la calidad asegurada de la Red ENERED para mi flota.");
const fmtSoles = (n) => "S/ " + (Number(n) || 0).toLocaleString("es-PE", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const mapUrl = (est, ciudad) => `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${est} ${ciudad} peru`)}`;
const rutaUrl = (est, ciudad) => `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(`${est} ${ciudad} peru`)}`;

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
  const [pageSize, setPageSize] = useState(10);

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
    if (q && !`${e.estacion} ${e.departamento} ${e.provincia} ${e.distrito} ${e.direccion}`.toLowerCase().includes(q.toLowerCase())) return false;
    return true;
  }), [data, comb, q, soloEnered, dep, prov, dist]);

  useEffect(() => { setPage(1); }, [comb, q, soloEnered, dep, prov, dist, pageSize]);
  const totalPages = Math.max(1, Math.ceil(filtradas.length / pageSize));
  const pageRows = filtradas.slice((page - 1) * pageSize, page * pageSize);
  const ciudad = (e) => [e.distrito, e.provincia, e.departamento].filter(Boolean)[0] || "—";

  const selStyle = { padding: "10px 12px", border: "1px solid #E5E7EB", borderRadius: 10, fontSize: 13.5, fontWeight: 600, color: "#374151", background: "#fff" };

  return (
    <div style={{ minHeight: "100vh", background: "#F6F7FB", fontFamily: "'Open Sans', system-ui, sans-serif" }}>
      <div style={{ background: "#fff", borderBottom: "1px solid #EEE", padding: "14px 24px" }}>
        <div style={{ maxWidth: 1180, margin: "0 auto" }}><img src={LOGO_IMG} alt="ENERED" style={{ height: 30 }} /></div>
      </div>

      <div style={{ maxWidth: 1180, margin: "0 auto", padding: "22px 20px 60px" }}>
        {/* HERO + BOTÓN GRANDE */}
        <div style={{ background: "linear-gradient(135deg,#7C3AED 0%,#5B21B6 100%)", borderRadius: 20, padding: "30px 28px", color: "#fff", position: "relative", overflow: "hidden" }}>
          <div style={{ position: "absolute", right: -30, top: -30, opacity: 0.12 }}><Fuel style={{ width: 190, height: 190 }} /></div>
          <div style={{ display: "inline-flex", alignItems: "center", gap: 7, background: "rgba(255,255,255,.18)", padding: "4px 12px", borderRadius: 999, fontSize: 11.5, fontWeight: 800, letterSpacing: ".05em" }}>
            <Fuel style={{ width: 14, height: 14 }} /> RED DE GRIFOS · TIEMPO REAL · FACILITO + RED ENERED
          </div>
          <h1 style={{ fontSize: 34, fontWeight: 900, lineHeight: 1.1, margin: "12px 0 8px", maxWidth: 740 }}>
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
        <div style={{ background: "#fff", border: "1px solid #EEE", borderRadius: 14, padding: 14, display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center", marginTop: 16, boxShadow: "0 6px 20px rgba(0,0,0,.05)" }}>
          <select value={dep} onChange={(e) => { setDep(e.target.value); setProv(""); setDist(""); }} style={{ ...selStyle, minWidth: 150 }}>
            <option value="">Departamento</option>{departamentos.map((d) => <option key={d} value={d}>{d}</option>)}
          </select>
          <select value={prov} onChange={(e) => { setProv(e.target.value); setDist(""); }} disabled={!provincias.length} style={{ ...selStyle, minWidth: 140, opacity: provincias.length ? 1 : 0.5 }}>
            <option value="">Provincia</option>{provincias.map((p) => <option key={p} value={p}>{p}</option>)}
          </select>
          <select value={dist} onChange={(e) => setDist(e.target.value)} disabled={!distritos.length} style={{ ...selStyle, minWidth: 140, opacity: distritos.length ? 1 : 0.5 }}>
            <option value="">Distrito</option>{distritos.map((d) => <option key={d} value={d}>{d}</option>)}
          </select>
          <select value={comb} onChange={(e) => setComb(e.target.value)} style={{ ...selStyle, minWidth: 160 }}>
            <option value="">Producto</option>{combustibles.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
          <div style={{ position: "relative", flex: 1, minWidth: 180 }}>
            <Search style={{ width: 15, height: 15, color: "#9CA3AF", position: "absolute", left: 12, top: 12 }} />
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Nombre del grifo…"
              style={{ width: "100%", padding: "10px 12px 10px 34px", border: "1px solid #E5E7EB", borderRadius: 10, fontSize: 13.5, boxSizing: "border-box" }} />
          </div>
          {(dep || prov || dist || comb || q || soloEnered) && (
            <button onClick={() => { setDep(""); setProv(""); setDist(""); setComb(""); setQ(""); setSoloEnered(false); }}
              style={{ ...selStyle, cursor: "pointer", color: "#6b7280" }}>Limpiar</button>
          )}
        </div>

        {/* Encabezado lista + toggle */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 10, marginTop: 22, marginBottom: 10 }}>
          <div style={{ fontSize: 12.5, fontWeight: 800, color: "#9CA3AF", letterSpacing: ".08em" }}>LISTA DE PRECIOS · {filtradas.length} grifos</div>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div style={{ display: "flex", background: "#EEF0F4", borderRadius: 10, padding: 3 }}>
              <button onClick={() => setSoloEnered(false)} style={{ padding: "7px 16px", borderRadius: 8, border: "none", cursor: "pointer", fontWeight: 800, fontSize: 13, background: !soloEnered ? "#7C3AED" : "transparent", color: !soloEnered ? "#fff" : "#6b7280" }}>Ver todos</button>
              <button onClick={() => setSoloEnered(true)} style={{ padding: "7px 16px", borderRadius: 8, border: "none", cursor: "pointer", fontWeight: 800, fontSize: 13, background: soloEnered ? "#7C3AED" : "transparent", color: soloEnered ? "#fff" : "#6b7280" }}>Solo Red ENERED</button>
            </div>
            <select value={pageSize} onChange={(e) => setPageSize(Number(e.target.value))} style={{ ...selStyle, padding: "8px 10px" }}>
              {[10, 25, 50, 100].map((n) => <option key={n} value={n}>Ver {n} registros</option>)}
            </select>
          </div>
        </div>

        {/* Tabla */}
        <div style={{ background: "#fff", border: "1px solid #EEE", borderRadius: 14, overflow: "hidden", boxShadow: "0 6px 20px rgba(0,0,0,.05)" }}>
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13, minWidth: 940 }}>
              <thead>
                <tr style={{ background: "#2A2140", color: "#fff", fontSize: 11.5, letterSpacing: ".02em" }}>
                  {[["Estación", "left"], ["Ciudad", "left"], ["Calidad", "center"], ["Pizarra", "right"], ["ENERED", "right"], ["Diferencia", "right"], ["Factura", "center"], ["Tarjeta", "center"], ["Acción", "center"]].map(([h, al]) => (
                    <th key={h} style={{ padding: "13px 16px", textAlign: al, fontWeight: 700, whiteSpace: "nowrap" }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr><td colSpan={9} style={{ padding: 46, textAlign: "center", color: "#9CA3AF" }}><Loader2 style={{ width: 22, height: 22, animation: "spin 1s linear infinite", color: "#7C3AED" }} /><div style={{ marginTop: 8 }}>Cargando grifos…</div></td></tr>
                ) : pageRows.length === 0 ? (
                  <tr><td colSpan={9} style={{ padding: 46, textAlign: "center", color: "#9CA3AF" }}>No hay grifos para ese filtro.</td></tr>
                ) : pageRows.map((e, i) => (
                  <tr key={i} style={{ borderBottom: "1px solid #F3F4F6", background: e.es_enered ? "#F6FDF9" : "#fff" }}>
                    {/* Estación */}
                    <td style={{ padding: "13px 16px" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
                        <span style={{ fontWeight: 800, color: "#111827", fontSize: 14 }}>{e.estacion}</span>
                        {e.es_enered && <Star style={{ width: 14, height: 14, color: "#F59E0B", fill: "#F59E0B" }} />}
                        <MapPin style={{ width: 13, height: 13, color: "#16A34A" }} />
                      </div>
                      <div style={{ fontSize: 11.5, color: "#9CA3AF", marginTop: 2 }}>
                        {e.direccion ? (e.direccion.length > 34 ? e.direccion.slice(0, 34) + "…" : e.direccion) + " · " : ""}
                        <span style={{ fontWeight: 800, color: e.es_enered ? "#16A34A" : "#EF4444" }}>{e.es_enered ? "Red ENERED" : "Independiente"}</span>
                      </div>
                    </td>
                    {/* Ciudad */}
                    <td style={{ padding: "13px 16px", color: "#059669", fontWeight: 700, textTransform: "capitalize", whiteSpace: "nowrap" }}>{ciudad(e)}</td>
                    {/* Calidad */}
                    <td style={{ padding: "13px 16px", textAlign: "center" }}>
                      <span style={{ display: "inline-flex", gap: 1 }}>{[1, 2, 3, 4, 5].map((s) => <Star key={s} style={{ width: 12, height: 12, color: s <= (e.calidad || 2) ? "#F59E0B" : "#E5E7EB", fill: s <= (e.calidad || 2) ? "#F59E0B" : "none" }} />)}</span>
                    </td>
                    {/* Pizarra */}
                    <td style={{ padding: "13px 16px", textAlign: "right", color: "#374151", fontWeight: 600, whiteSpace: "nowrap" }}>{e.precio_pizarra ? fmtSoles(e.precio_pizarra) : "—"}</td>
                    {/* ENERED */}
                    <td style={{ padding: "13px 16px", textAlign: "right", fontWeight: 900, color: e.precio_enered ? "#059669" : "#C7CBD1", whiteSpace: "nowrap" }}>{e.precio_enered ? fmtSoles(e.precio_enered) : "no aplica"}</td>
                    {/* Diferencia */}
                    <td style={{ padding: "13px 16px", textAlign: "right", fontWeight: 800, color: "#059669", whiteSpace: "nowrap" }}>{e.ahorro ? `−${fmtSoles(e.ahorro)}` : <span style={{ color: "#D1D5DB" }}>—</span>}</td>
                    {/* Factura */}
                    <td style={{ padding: "13px 16px", textAlign: "center" }}>
                      {e.acepta_factura ? <span style={{ display: "inline-flex", width: 22, height: 22, borderRadius: 999, background: "#DCFCE7", color: "#16A34A", alignItems: "center", justifyContent: "center", fontWeight: 900 }}>✓</span>
                        : <span style={{ display: "inline-flex", width: 22, height: 22, borderRadius: 999, background: "#FEE2E2", color: "#EF4444", alignItems: "center", justifyContent: "center", fontWeight: 900 }}>✕</span>}
                    </td>
                    {/* Tarjeta */}
                    <td style={{ padding: "13px 16px", textAlign: "center", whiteSpace: "nowrap" }}>
                      {e.acepta_tarjeta ? <span style={{ fontSize: 11.5, fontWeight: 800, color: "#16A34A", background: "#DCFCE7", padding: "3px 9px", borderRadius: 999 }}>✓ Acepta</span>
                        : <span style={{ fontSize: 11.5, fontWeight: 800, color: "#EF4444", background: "#FEE2E2", padding: "3px 9px", borderRadius: 999 }}>✕ No</span>}
                    </td>
                    {/* Acción */}
                    <td style={{ padding: "13px 16px", textAlign: "center", whiteSpace: "nowrap" }}>
                      <div style={{ display: "inline-flex", gap: 6 }}>
                        <a href={mapUrl(e.estacion, ciudad(e))} target="_blank" rel="noreferrer"
                          style={{ fontSize: 11.5, fontWeight: 800, textDecoration: "none", padding: "6px 12px", borderRadius: 999, ...(e.es_enered ? { background: "#7C3AED", color: "#fff" } : { background: "#fff", color: "#374151", border: "1px solid #D1D5DB" }) }}>
                          {e.es_enered ? "Dirigir" : "Evaluar"}
                        </a>
                        <a href={rutaUrl(e.estacion, ciudad(e))} target="_blank" rel="noreferrer"
                          style={{ fontSize: 11.5, fontWeight: 800, textDecoration: "none", padding: "6px 12px", borderRadius: 999, background: "#fff", color: "#6b7280", border: "1px solid #D1D5DB" }}>Ruta</a>
                      </div>
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

        {/* Leyenda */}
        <div style={{ display: "flex", gap: 16, flexWrap: "wrap", marginTop: 14, fontSize: 12, color: "#6b7280" }}>
          <span style={{ display: "inline-flex", alignItems: "center", gap: 5 }}><Star style={{ width: 13, height: 13, color: "#F59E0B", fill: "#F59E0B" }} /> Aplica ENERED (precio especial)</span>
          <span style={{ display: "inline-flex", alignItems: "center", gap: 5 }}><span style={{ width: 10, height: 10, borderRadius: 999, background: "#16A34A" }} /> Red ENERED</span>
          <span style={{ display: "inline-flex", alignItems: "center", gap: 5 }}><span style={{ width: 10, height: 10, borderRadius: 999, background: "#EF4444" }} /> Independiente</span>
          <span style={{ display: "inline-flex", alignItems: "center", gap: 5 }}><MapPin style={{ width: 13, height: 13 }} /> Fuente: Facilito · OSINERGMIN</span>
        </div>
      </div>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  );
}
