import React, { useState, useEffect, useMemo, useCallback } from "react";
import { api } from "../lib/api";
import { toast } from "sonner";
import { Loader2, RefreshCw, Building2, Send, Clock, AlertTriangle, Search, Download, Plus, FileText } from "lucide-react";

const soles = (n) => `S/ ${Number(n || 0).toLocaleString("es-PE", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const num = (n) => Number(n || 0).toLocaleString("es-PE", { maximumFractionDigits: 2 });

export default function PadronATU() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [q, setQ] = useState("");
  const [soloDj, setSoloDj] = useState(false);
  const [pegar, setPegar] = useState("");
  const [agregando, setAgregando] = useState(false);

  const registrarDj = async (r) => {
    const exp = window.prompt(`N.° de expediente ATU de ${r.razon_social || r.ruc}:`, r.dj_manual?.numero_expediente || "");
    if (exp === null) return;
    const tk = window.prompt("N.° de ticket (orden de prelación):", r.dj_manual?.numero_ticket || "");
    if (tk === null) return;
    try {
      await api.put(`/atu/padron/${r.ruc}/dj`, { numero_expediente: exp, numero_ticket: tk, fecha: new Date().toISOString().slice(0, 10) });
      toast.success("DJ registrada"); cargar();
    } catch (e) { toast.error(e?.response?.data?.detail || "No se pudo registrar"); }
  };

  const cargar = useCallback(async () => {
    try {
      const { data: d } = await api.get("/atu/padron");
      setData(d);
      return d;
    } catch (e) {
      toast.error(e?.response?.data?.detail || "No se pudo cargar el padrón");
    } finally { setLoading(false); }
  }, []);

  useEffect(() => { cargar(); }, [cargar]);

  // Si hay una sincronización corriendo, refresca cada 4s hasta que termine.
  useEffect(() => {
    if (!data?.sync?.corriendo) { setSyncing(false); return; }
    setSyncing(true);
    const t = setInterval(async () => {
      const d = await cargar();
      if (!d?.sync?.corriendo) { clearInterval(t); setSyncing(false); }
    }, 4000);
    return () => clearInterval(t);
  }, [data?.sync?.corriendo, cargar]);

  const sincronizar = async () => {
    try {
      await api.post("/atu/padron/sync");
      setSyncing(true);
      toast.success("Actualizando el padrón contra la ATU…");
      setTimeout(cargar, 1500);
    } catch (e) {
      toast.error(e?.response?.data?.detail || "No se pudo iniciar la actualización");
    }
  };

  const agregar = async () => {
    const rucs = (pegar.match(/\d{11}/g) || []);
    if (!rucs.length) { toast.error("Pega RUCs de 11 dígitos (uno por línea o separados por coma)"); return; }
    setAgregando(true);
    try {
      const { data: r } = await api.post("/atu/padron/agregar", { rucs });
      toast.success(`Procesados ${r.procesados}: ${r.ok} con datos, ${r.sin_cuenta} sin cuenta ATU, ${r.error} con error`);
      setPegar(""); cargar();
    } catch (e) {
      toast.error(e?.response?.data?.detail || "No se pudieron agregar los RUCs");
    } finally { setAgregando(false); }
  };

  const filas = useMemo(() => {
    let f = data?.items || [];
    if (q) { const s = q.toLowerCase(); f = f.filter((x) => (x.razon_social || "").toLowerCase().includes(s) || (x.ruc || "").includes(s)); }
    if (soloDj) f = f.filter((x) => x.dj_manual);
    return f;
  }, [data, q, soloDj]);

  const exportarCsv = () => {
    const cols = ["ruc", "razon_social", "inscrito_atu", "flota_reconocida", "subsidio_maximo", "volumen_galones", "comprobantes", "subsidio_reconocido", "galones_no_reconocidos", "dj_expediente", "dj_ticket", "dj_fecha"];
    const head = cols.join(",");
    const body = (data?.items || []).map((r) => {
      const row = { ...r, dj_expediente: r.dj_manual?.numero_expediente, dj_ticket: r.dj_manual?.numero_ticket, dj_fecha: r.dj_manual?.fecha };
      return cols.map((c) => `"${String(row[c] ?? "").replace(/"/g, '""')}"`).join(",");
    }).join("\n");
    const blob = new Blob(["﻿" + head + "\n" + body], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob); const a = document.createElement("a");
    a.href = url; a.download = "padron_atu_enered.csv"; a.click(); URL.revokeObjectURL(url);
  };

  if (loading) return <div style={{ padding: 40, textAlign: "center" }}><Loader2 style={{ width: 30, height: 30, animation: "spin 1s linear infinite", color: "#1D4ED8" }} /></div>;

  const s = data || {};
  const kpi = (label, value, color = "#111827", sub) => (
    <div style={{ background: "#fff", border: "1px solid #E5E7EB", borderRadius: 12, padding: "14px 16px", flex: 1, minWidth: 170 }}>
      <div style={{ fontSize: 10.5, fontWeight: 800, color: "#6b7280", textTransform: "uppercase", letterSpacing: ".05em" }}>{label}</div>
      <div style={{ fontSize: 22, fontWeight: 800, color, marginTop: 3 }}>{value}</div>
      {sub && <div style={{ fontSize: 11.5, color: "#9CA3AF", marginTop: 2 }}>{sub}</div>}
    </div>
  );

  return (
    <div style={{ padding: "22px 26px", background: "#F5F7FA", minHeight: "100%" }} data-testid="atu-padron">
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", flexWrap: "wrap", gap: 12, marginBottom: 16 }}>
        <div>
          <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: ".1em", color: "#1D4ED8", textTransform: "uppercase" }}>ATU · SUBSIDIO DU 004 · MACRO</div>
          <div style={{ fontSize: 22, fontWeight: 800, color: "#111827", marginTop: 2 }}>Padrón de empresas vs. el subsidio</div>
          <div style={{ fontSize: 13, color: "#6b7280", marginTop: 2, maxWidth: 720 }}>
            Todas las empresas de ENERED (y las que agregues) con lo que la ATU les reconoce, su tope máximo y si ya enviaron su declaración jurada.
          </div>
        </div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <button onClick={sincronizar} disabled={syncing} style={btn(syncing ? "#93C5FD" : "#1D4ED8")}>
            {syncing ? <Loader2 style={sp} /> : <RefreshCw style={{ width: 15, height: 15 }} />} {syncing ? "Actualizando…" : "Actualizar contra la ATU"}
          </button>
          <button onClick={exportarCsv} style={btn("#059669")}><Download style={{ width: 15, height: 15 }} /> Exportar CSV</button>
        </div>
      </div>

      {syncing && s.sync && (
        <div style={{ marginBottom: 14, background: "#EFF6FF", border: "1px solid #BFDBFE", borderRadius: 10, padding: "10px 14px", color: "#1E40AF", fontSize: 13, display: "flex", alignItems: "center", gap: 8 }}>
          <Loader2 style={sp} /> Consultando la ATU empresa por empresa… {s.sync.hechos}/{s.sync.total}
        </div>
      )}

      {/* KPIs macro */}
      <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginBottom: 16 }}>
        {kpi("Empresas en el padrón", s.total_empresas, "#111827", `${s.inscritas_atu || 0} con cuenta ATU · ${s.sin_cuenta_atu || 0} sin cuenta`)}
        {kpi("Con DJ presentada", s.con_dj, "#059669", "registradas en ENERED (la ATU no lo expone por RUC)")}
        {kpi("Solicitudes a nivel nacional ≈", s.ticket_maximo ? s.ticket_maximo.toLocaleString("es-PE") : "—", "#B45309", "ticket ATU más alto registrado (orden de prelación)")}
        {kpi("Total reclamado (reconocido ATU)", soles(s.total_reclamado), "#1D4ED8", `de un tope de ${soles(s.total_maximo)}`)}
        {kpi("Peso en el fondo DU 004", s.fondo_du004 ? `${((s.total_reclamado / s.fondo_du004) * 100).toFixed(2)} %` : "—", "#7C3AED", `Fondo: ${soles(s.fondo_du004)}`)}
      </div>

      {/* Agregar universo de RUCs */}
      <details style={{ background: "#fff", border: "1px solid #E5E7EB", borderRadius: 12, padding: "12px 16px", marginBottom: 16 }}>
        <summary style={{ cursor: "pointer", fontWeight: 700, color: "#111827", fontSize: 14, display: "flex", alignItems: "center", gap: 8 }}>
          <Plus style={{ width: 16, height: 16, color: "#1D4ED8" }} /> Agregar más empresas al padrón (pega una lista de RUCs)
        </summary>
        <div style={{ marginTop: 10 }}>
          <div style={{ fontSize: 12.5, color: "#6b7280", marginBottom: 6 }}>
            Un RUC por línea o separados por coma. Se consultan contra la ATU y se suman a la tabla. Útil para tus clientes o cualquier universo que quieras comparar.
          </div>
          <textarea value={pegar} onChange={(e) => setPegar(e.target.value)} placeholder={"20482372407\n20601174538\n…"} rows={4}
            style={{ width: "100%", border: "1px solid #E5E7EB", borderRadius: 9, padding: 10, fontFamily: "monospace", fontSize: 13, resize: "vertical" }} />
          <button onClick={agregar} disabled={agregando} style={{ ...btn("#1D4ED8"), marginTop: 8 }}>
            {agregando ? <Loader2 style={sp} /> : <Plus style={{ width: 15, height: 15 }} />} {agregando ? "Consultando…" : "Agregar y consultar"}
          </button>
        </div>
      </details>

      {/* Filtros */}
      <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center", marginBottom: 10 }}>
        <div style={{ position: "relative", flex: 1, minWidth: 220 }}>
          <Search style={{ width: 15, height: 15, color: "#9CA3AF", position: "absolute", left: 11, top: 11 }} />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar por razón social o RUC…"
            style={{ width: "100%", padding: "9px 12px 9px 32px", border: "1px solid #E5E7EB", borderRadius: 9, fontSize: 14 }} />
        </div>
        <label style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 13, fontWeight: 600, color: "#374151" }}>
          <input type="checkbox" checked={soloDj} onChange={(e) => setSoloDj(e.target.checked)} /> Solo con DJ enviada
        </label>
        <span style={{ fontSize: 12.5, color: "#9CA3AF" }}>{filas.length} de {s.total_empresas} · actualizado {s.actualizado ? new Date(s.actualizado).toLocaleString("es-PE") : "—"}</span>
      </div>

      {/* Tabla */}
      <div style={{ background: "#fff", borderRadius: 12, boxShadow: "0 2px 8px rgba(0,0,0,.05)", overflow: "hidden" }}>
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
            <thead><tr>{["Empresa", "RUC", "ATU", "Flota", "Comprob.", "Volumen (gal)", "Máximo (S/)", "Reclama / reconoce (S/)", "DJ"].map((h) => <th key={h} style={th}>{h}</th>)}</tr></thead>
            <tbody>
              {filas.map((r) => (
                <tr key={r.ruc} style={{ borderBottom: "1px solid #F3F4F6" }}>
                  <td style={{ ...td, fontWeight: 700, color: "#111827", maxWidth: 280, whiteSpace: "normal" }}>{r.razon_social || "—"}{r.error && <div style={{ color: "#DC2626", fontSize: 11 }}>{r.error}</div>}</td>
                  <td style={{ ...td, fontFamily: "monospace" }}>{r.ruc}</td>
                  <td style={td}>{r.error ? "—" : r.inscrito_atu ? <span style={{ color: "#059669", fontWeight: 700 }}>Sí</span> : <span style={{ color: "#DC2626" }}>No</span>}</td>
                  <td style={td}>{r.flota_reconocida ?? "—"}</td>
                  <td style={td}>{r.comprobantes ?? 0}</td>
                  <td style={td}>{num(r.volumen_galones)}</td>
                  <td style={td}>{r.subsidio_maximo ? soles(r.subsidio_maximo) : "—"}</td>
                  <td style={{ ...td, fontWeight: 800, color: "#059669" }}>
                    {r.subsidio_reconocido != null ? soles(r.subsidio_reconocido) : r.subsidio_estimado ? <span style={{ color: "#B45309" }}>{soles(r.subsidio_estimado)}*</span> : "—"}
                    {r.galones_no_reconocidos > 0 && <div style={{ fontSize: 11, color: "#B45309", fontWeight: 500 }}>{num(r.galones_no_reconocidos)} gal no reconocidos</div>}
                  </td>
                  <td style={td}>
                    {r.dj_manual
                      ? <span style={{ display: "inline-flex", alignItems: "center", gap: 4, color: "#065F46", fontWeight: 700 }} title={`Ticket ${r.dj_manual.numero_ticket || "—"} · ${r.dj_manual.fecha || ""}`}><Send style={bi} /> {r.dj_manual.numero_expediente || "Presentada"}{r.dj_manual.numero_ticket ? <span style={{ color: "#6b7280", fontWeight: 500 }}> · #{r.dj_manual.numero_ticket}</span> : null}</span>
                      : <span style={{ color: "#9CA3AF" }}>sin registro</span>}
                    <button onClick={() => registrarDj(r)} style={{ background: "none", border: "none", color: "#1D4ED8", cursor: "pointer", fontSize: 11.5, fontWeight: 700, padding: "0 0 0 8px" }}>{r.dj_manual ? "editar" : "registrar"}</button>
                  </td>
                </tr>
              ))}
              {filas.length === 0 && <tr><td colSpan={9} style={{ ...td, textAlign: "center", color: "#9CA3AF", padding: 30 }}>Sin empresas. Pulsa "Actualizar contra la ATU" o agrega RUCs.</td></tr>}
            </tbody>
          </table>
        </div>
      </div>
      <div style={{ fontSize: 11.5, color: "#9CA3AF", marginTop: 8 }}>
        * Estimado (S/ 4 × galón) cuando la ATU aún no devuelve el cálculo oficial. El resto es el cálculo oficial de la ATU por RUC.
        La ATU no expone por RUC si la DJ fue enviada: el N.° de expediente y ticket se registran a mano (lo que la ATU le muestra al transportista).
        Este padrón cubre las empresas de ENERED y las que agregues, no el total nacional.
      </div>
    </div>
  );
}

const th = { position: "sticky", top: 0, background: "#F8FAFC", padding: "10px 12px", textAlign: "left", fontWeight: 700, color: "#475569", borderBottom: "1px solid #E5E7EB", whiteSpace: "nowrap", fontSize: 12 };
const td = { padding: "9px 12px", color: "#374151", whiteSpace: "nowrap", verticalAlign: "top" };
const bi = { width: 12, height: 12 };
const sp = { width: 15, height: 15, animation: "spin 1s linear infinite" };
const btn = (bg) => ({ padding: "9px 16px", background: bg, color: "#fff", border: "none", borderRadius: 9, cursor: "pointer", fontSize: 13.5, fontWeight: 700, display: "inline-flex", alignItems: "center", gap: 7 });
