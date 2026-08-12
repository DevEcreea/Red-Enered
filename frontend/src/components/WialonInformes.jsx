import React, { useEffect, useMemo, useState } from "react";
import { api } from "../lib/api";
import { toast } from "sonner";
import {
  Loader2, FileBarChart, Truck, Calendar, Play, Fuel, AlertTriangle,
  Table as TableIcon, Download, TrendingUp, LineChart as LineChartIcon, ArrowDown, ArrowUp
} from "lucide-react";
import {
  ResponsiveContainer, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  AreaChart, Area
} from "recharts";

const CAT_LABEL = {
  combustible: "⛽ Combustible",
  viajes: "🛣️ Viajes y kilometraje",
  conduccion: "🚦 Conducción / velocidad",
  mantenimiento: "🔧 Mantenimiento",
  otros: "📄 Otros",
};
const CAT_ORDER = ["combustible", "viajes", "conduccion", "mantenimiento", "otros"];

// --- helpers de parseo ---
function toNumber(cell) {
  if (cell == null) return null;
  const s = String(cell).replace(/\s/g, "").replace(",", ".");
  const m = s.match(/-?\d+(\.\d+)?/);
  return m ? parseFloat(m[0]) : null;
}
// "14.07.2026 00:05:35" -> Date
function parseWialonDate(s) {
  if (!s) return null;
  const m = String(s).match(/(\d{2})\.(\d{2})\.(\d{4})\s+(\d{2}):(\d{2}):(\d{2})/);
  if (!m) return null;
  return new Date(+m[3], +m[2] - 1, +m[1], +m[4], +m[5], +m[6]);
}
function ymd(d) {
  return d.toISOString().slice(0, 10);
}
function epochFromInput(dateStr, endOfDay) {
  // dateStr = "yyyy-mm-dd" -> epoch seconds (hora local)
  const [y, mo, da] = dateStr.split("-").map(Number);
  const d = endOfDay ? new Date(y, mo - 1, da, 23, 59, 59) : new Date(y, mo - 1, da, 0, 0, 0);
  return Math.floor(d.getTime() / 1000);
}

export default function WialonInformes({ empresa, units }) {
  const [templates, setTemplates] = useState([]);
  const [tplLoading, setTplLoading] = useState(true);
  const [tplError, setTplError] = useState("");

  const [unitId, setUnitId] = useState("");
  const [templateKey, setTemplateKey] = useState(""); // "resource_id:template_id"
  const today = useMemo(() => new Date(), []);
  const [from, setFrom] = useState(() => ymd(new Date(Date.now() - 7 * 86400000)));
  const [to, setTo] = useState(() => ymd(new Date()));

  const [mode, setMode] = useState("grafica"); // "grafica" | "informe"
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState(null);
  const [graph, setGraph] = useState(null);
  const [runError, setRunError] = useState("");

  // cargar plantillas (solo unidad individual, que es lo soportado por el runner)
  useEffect(() => {
    let alive = true;
    setTplLoading(true); setTplError(""); setTemplates([]);
    const params = empresa ? { empresa } : {};
    api.get("/wialon/report/templates", { params })
      .then(({ data }) => {
        if (!alive) return;
        const single = (data.templates || []).filter((t) => t.single_unit);
        setTemplates(single);
        // preseleccionar primer informe de combustible o viajes
        const pref = single.find((t) => t.category === "combustible") ||
                     single.find((t) => t.category === "viajes") || single[0];
        if (pref) setTemplateKey(`${pref.resource_id}:${pref.template_id}`);
      })
      .catch((e) => { if (alive) setTplError(e?.response?.data?.detail || "No se pudieron cargar los informes"); })
      .finally(() => { if (alive) setTplLoading(false); });
    return () => { alive = false; };
  }, [empresa]);

  // preseleccionar primera unidad
  useEffect(() => {
    if (!unitId && units && units.length) setUnitId(String(units[0].id));
  }, [units]); // eslint-disable-line

  const grouped = useMemo(() => {
    const g = {};
    for (const t of templates) {
      (g[t.category] = g[t.category] || []).push(t);
    }
    return g;
  }, [templates]);

  async function run() {
    if (!unitId) { toast.error("Elige una unidad"); return; }
    setRunning(true); setRunError(""); setResult(null); setGraph(null);
    try {
      if (mode === "grafica") {
        const { data } = await api.post("/wialon/fuel-graph", {
          empresa: empresa || undefined,
          unit_id: Number(unitId),
          date_from: epochFromInput(from, false),
          date_to: epochFromInput(to, true),
        });
        setGraph(data);
      } else {
        if (!templateKey) { toast.error("Elige un informe"); setRunning(false); return; }
        const [rid, tid] = templateKey.split(":").map(Number);
        const { data } = await api.post("/wialon/report/run", {
          empresa: empresa || undefined,
          resource_id: rid,
          template_id: tid,
          unit_id: Number(unitId),
          date_from: epochFromInput(from, false),
          date_to: epochFromInput(to, true),
        });
        setResult(data);
        if (!data.tables || data.tables.length === 0) {
          toast.info("El informe no arrojó datos para ese rango. Prueba ampliar las fechas.");
        }
      }
    } catch (e) {
      setRunError(e?.response?.data?.detail || (mode === "grafica" ? "Error al generar la gráfica" : "Error al ejecutar el informe"));
    } finally {
      setRunning(false);
    }
  }

  function setPreset(days) {
    setFrom(ymd(new Date(Date.now() - days * 86400000)));
    setTo(ymd(new Date()));
  }

  const unitName = useMemo(() => (units.find((u) => String(u.id) === String(unitId))?.name || ""), [unitId, units]);
  const selectedTpl = templates.find((t) => `${t.resource_id}:${t.template_id}` === templateKey);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      {/* Selector de modo */}
      <div style={{ display: "inline-flex", background: "#F3F4F6", borderRadius: 10, padding: 4, alignSelf: "flex-start" }}>
        <button onClick={() => setMode("grafica")} data-testid="mode-grafica"
          style={{ padding: "8px 16px", border: "none", borderRadius: 7, cursor: "pointer", fontSize: 13.5, fontWeight: 700, display: "inline-flex", alignItems: "center", gap: 7,
            background: mode === "grafica" ? "#fff" : "transparent", color: mode === "grafica" ? "#0369A1" : "#6b7280", boxShadow: mode === "grafica" ? "0 1px 3px rgba(0,0,0,.1)" : "none" }}>
          <Fuel style={{ width: 16, height: 16 }} /> Gráfica de combustible
        </button>
        <button onClick={() => setMode("informe")} data-testid="mode-informe"
          style={{ padding: "8px 16px", border: "none", borderRadius: 7, cursor: "pointer", fontSize: 13.5, fontWeight: 700, display: "inline-flex", alignItems: "center", gap: 7,
            background: mode === "informe" ? "#fff" : "transparent", color: mode === "informe" ? "#5B21B6" : "#6b7280", boxShadow: mode === "informe" ? "0 1px 3px rgba(0,0,0,.1)" : "none" }}>
          <FileBarChart style={{ width: 16, height: 16 }} /> Informe de Wialon
        </button>
      </div>

      {/* Barra de configuración */}
      <div style={{ background: "#fff", borderRadius: 12, boxShadow: "0 2px 8px rgba(0,0,0,.05)", padding: 18, display: "flex", flexWrap: "wrap", gap: 16, alignItems: "flex-end" }}>
        {/* Unidad */}
        <div style={{ display: "flex", flexDirection: "column", gap: 5, minWidth: 200 }}>
          <label style={lblStyle}><Truck style={{ width: 13, height: 13 }} /> Unidad</label>
          <select value={unitId} onChange={(e) => setUnitId(e.target.value)} style={inputStyle} data-testid="inf-unit">
            {(!units || !units.length) && <option value="">— sin unidades —</option>}
            {units.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
          </select>
        </div>
        {/* Informe (solo modo informe) */}
        {mode === "informe" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 5, minWidth: 260 }}>
          <label style={lblStyle}><FileBarChart style={{ width: 13, height: 13 }} /> Informe</label>
          <select value={templateKey} onChange={(e) => setTemplateKey(e.target.value)} style={inputStyle} data-testid="inf-template" disabled={tplLoading}>
            {tplLoading && <option>Cargando…</option>}
            {!tplLoading && CAT_ORDER.filter((c) => grouped[c]?.length).map((c) => (
              <optgroup key={c} label={CAT_LABEL[c]}>
                {grouped[c].map((t) => (
                  <option key={`${t.resource_id}:${t.template_id}`} value={`${t.resource_id}:${t.template_id}`}>{t.name}</option>
                ))}
              </optgroup>
            ))}
          </select>
        </div>
        )}
        {/* Fechas */}
        <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
          <label style={lblStyle}><Calendar style={{ width: 13, height: 13 }} /> Desde</label>
          <input type="date" value={from} max={to} onChange={(e) => setFrom(e.target.value)} style={inputStyle} data-testid="inf-from" />
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
          <label style={lblStyle}>&nbsp;Hasta</label>
          <input type="date" value={to} min={from} max={ymd(today)} onChange={(e) => setTo(e.target.value)} style={inputStyle} data-testid="inf-to" />
        </div>
        {/* Presets */}
        <div style={{ display: "flex", gap: 6 }}>
          {[["Hoy", 0], ["7 días", 7], ["30 días", 30]].map(([lbl, d]) => (
            <button key={lbl} onClick={() => setPreset(d)} style={presetStyle}>{lbl}</button>
          ))}
        </div>
        {/* Ejecutar */}
        <button onClick={run} disabled={running || !unitId || (mode === "informe" && tplLoading)} data-testid="inf-run"
          style={{ marginLeft: "auto", padding: "10px 20px", background: running ? "#A78BFA" : (mode === "grafica" ? "#0284C7" : "#7C3AED"), color: "#fff", border: "none", borderRadius: 8, cursor: running ? "wait" : "pointer", fontSize: 14, fontWeight: 700, display: "inline-flex", alignItems: "center", gap: 8 }}>
          {running ? <Loader2 style={{ width: 16, height: 16, animation: "spin 1s linear infinite" }} /> : <Play style={{ width: 16, height: 16 }} />}
          {running ? "Generando…" : (mode === "grafica" ? "Ver gráfica" : "Generar informe")}
        </button>
      </div>

      {tplError && <Banner tone="error">{tplError}</Banner>}
      {runError && <Banner tone="error">{runError} <button onClick={run} style={{ marginLeft: 10, ...presetStyle }}>Reintentar</button></Banner>}

      {running && (
        <div style={{ background: "#fff", borderRadius: 12, padding: 50, textAlign: "center", color: "#6b7280" }}>
          <Loader2 style={{ width: 30, height: 30, animation: "spin 1s linear infinite", color: mode === "grafica" ? "#0284C7" : "#7C3AED", margin: "0 auto" }} />
          <div style={{ marginTop: 10, fontWeight: 600 }}>{mode === "grafica" ? "Leyendo sensores y armando la gráfica…" : "Wialon está calculando el informe…"}</div>
          <div style={{ fontSize: 12.5, color: "#9CA3AF", marginTop: 4 }}>{unitName}{mode === "informe" && selectedTpl ? ` · ${selectedTpl.name}` : ""}</div>
        </div>
      )}

      {graph && !running && mode === "grafica" && <FuelGraphView graph={graph} />}
      {result && !running && mode === "informe" && (
        <ResultView result={result} unitName={unitName} tplName={selectedTpl?.name} />
      )}

      {!result && !graph && !running && !runError && (
        <div style={{ background: "#fff", borderRadius: 12, padding: 50, textAlign: "center", color: "#9CA3AF" }}>
          {mode === "grafica" ? <Fuel style={{ width: 34, height: 34, margin: "0 auto", color: "#BAE6FD" }} /> : <FileBarChart style={{ width: 34, height: 34, margin: "0 auto", color: "#DDD6FE" }} />}
          <div style={{ marginTop: 10, fontWeight: 600, color: "#6b7280" }}>
            {mode === "grafica"
              ? <>Elige unidad y fechas, y presiona <b>Ver gráfica</b></>
              : <>Elige unidad, informe y fechas, y presiona <b>Generar informe</b></>}
          </div>
          <div style={{ fontSize: 12.5, marginTop: 4 }}>
            {mode === "grafica"
              ? "Detectamos automáticamente el sensor de combustible de la unidad (CANbus, % de tanque, tanques izq/der…)"
              : "Los datos se calculan en Wialon (cargas, viajes, km…)"}
          </div>
        </div>
      )}
    </div>
  );
}

// ---------- Gráfica de nivel de combustible ----------
function FuelGraphView({ graph }) {
  const series = graph.series || [];
  if (!series.length) return <Banner tone="info">No hay datos de combustible para ese rango.</Banner>;
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      {series.map((s, i) => <FuelSeriesCard key={i} s={s} unitName={graph.unit_name} />)}
    </div>
  );
}

function FuelSeriesCard({ s, unitName }) {
  const data = (s.points || []).map((p) => ({
    t: p.t,
    label: fmtTs(p.t),
    nivel: p.v,
  }));
  const delta = (s.last ?? 0) - (s.first ?? 0);
  return (
    <div style={{ background: "#fff", borderRadius: 12, boxShadow: "0 2px 8px rgba(0,0,0,.05)", padding: 18 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 12, marginBottom: 6 }}>
        <div style={{ fontWeight: 800, color: "#111827", fontSize: 15, display: "flex", alignItems: "center", gap: 8 }}>
          <Fuel style={{ width: 17, height: 17, color: "#0EA5E9" }} /> {s.name}
          <span style={{ fontSize: 12, fontWeight: 500, color: "#9CA3AF" }}>· {unitName}</span>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <Stat label="Actual" value={`${s.last} ${s.unit}`} color="#0369A1" />
          <Stat label="Mínimo" value={`${s.min} ${s.unit}`} color="#EF4444" />
          <Stat label="Máximo" value={`${s.max} ${s.unit}`} color="#10B981" />
          <Stat label="Variación" value={`${delta > 0 ? "+" : ""}${delta.toFixed(1)} ${s.unit}`} color={delta >= 0 ? "#10B981" : "#EF4444"}
            icon={delta >= 0 ? <ArrowUp style={{ width: 12, height: 12 }} /> : <ArrowDown style={{ width: 12, height: 12 }} />} />
        </div>
      </div>
      <div style={{ fontSize: 12, color: "#9CA3AF", marginBottom: 10 }}>Caída brusca ≈ posible robo · subida ≈ carga · unidad de medida: {s.unit || "—"}</div>
      <ResponsiveContainer width="100%" height={300}>
        <AreaChart data={data} margin={{ top: 8, right: 16, left: 0, bottom: 0 }}>
          <defs>
            <linearGradient id={`fuelGrad_${s.name.replace(/\W/g, "")}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#0EA5E9" stopOpacity={0.35} />
              <stop offset="100%" stopColor="#0EA5E9" stopOpacity={0.02} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" />
          <XAxis dataKey="label" tick={{ fontSize: 11, fill: "#94A3B8" }} minTickGap={40} />
          <YAxis tick={{ fontSize: 11, fill: "#94A3B8" }} width={44} domain={["auto", "auto"]} />
          <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8 }} formatter={(v) => [`${v} ${s.unit}`, "Nivel"]} />
          <Area type="monotone" dataKey="nivel" stroke="#0284C7" strokeWidth={2} fill={`url(#fuelGrad_${s.name.replace(/\W/g, "")})`} dot={false} activeDot={{ r: 4 }} />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

function Stat({ label, value, color, icon }) {
  return (
    <div style={{ textAlign: "right" }}>
      <div style={{ fontSize: 10.5, fontWeight: 700, color: "#9CA3AF", textTransform: "uppercase", letterSpacing: ".03em" }}>{label}</div>
      <div style={{ fontSize: 15, fontWeight: 800, color, display: "inline-flex", alignItems: "center", gap: 3 }}>{icon}{value}</div>
    </div>
  );
}

function fmtTs(t) {
  const d = new Date(t * 1000);
  return `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")} ${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

// ---------- Resultado ----------
function ResultView({ result, unitName, tplName }) {
  const tables = result.tables || [];
  // detectar tabla y columna de combustible para la gráfica (hook antes de cualquier return)
  const fuelChart = useMemo(() => buildFuelChart(tables), [tables]);
  if (!tables.length) {
    return <Banner tone="info">El informe no arrojó datos para ese rango de fechas.</Banner>;
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      {/* KPIs rápidos */}
      <KpiRow tables={tables} />

      {/* Gráfica de combustible si existe */}
      {fuelChart && (
        <div style={{ background: "#fff", borderRadius: 12, boxShadow: "0 2px 8px rgba(0,0,0,.05)", padding: 18 }}>
          <div style={{ fontWeight: 800, color: "#111827", fontSize: 15, display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
            <Fuel style={{ width: 17, height: 17, color: "#0EA5E9" }} /> Nivel de combustible en el tiempo
            <span style={{ fontSize: 12, fontWeight: 500, color: "#9CA3AF", marginLeft: 6 }}>{fuelChart.unit}</span>
          </div>
          <div style={{ fontSize: 12, color: "#9CA3AF", marginBottom: 10 }}>Una caída brusca puede indicar un posible robo; una subida, una carga.</div>
          <ResponsiveContainer width="100%" height={260}>
            <LineChart data={fuelChart.data} margin={{ top: 8, right: 16, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" />
              <XAxis dataKey="label" tick={{ fontSize: 11, fill: "#94A3B8" }} minTickGap={28} />
              <YAxis tick={{ fontSize: 11, fill: "#94A3B8" }} width={44} />
              <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8 }} />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              <Line type="monotone" dataKey="nivel" name={`Nivel (${fuelChart.unit})`} stroke="#0EA5E9" strokeWidth={2} dot={{ r: 2 }} activeDot={{ r: 5 }} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Tablas */}
      {tables.map((t) => <DataTable key={t.index} table={t} unitName={unitName} tplName={tplName} />)}
    </div>
  );
}

function KpiRow({ tables }) {
  // heurísticas: # de viajes, km total, cargas/robos
  const kpis = [];
  const viajes = tables.find((t) => /viaje/i.test(t.label) && !/detalle/i.test(t.label));
  if (viajes) {
    kpis.push({ label: "Viajes", value: viajes.total_rows, icon: <Truck style={{ width: 16, height: 16 }} />, color: "#7C3AED" });
    const kmIdx = viajes.header.findIndex((h) => /kilometraje/i.test(h));
    if (kmIdx >= 0) {
      const totalKm = viajes.rows.reduce((s, r) => s + (toNumber(r[kmIdx]) || 0), 0);
      kpis.push({ label: "Km recorridos", value: totalKm.toFixed(1) + " km", icon: <TrendingUp style={{ width: 16, height: 16 }} />, color: "#0EA5E9" });
    }
  }
  const cargas = tables.find((t) => /carga|repost|llenado|filling/i.test(t.label));
  if (cargas) kpis.push({ label: "Cargas de combustible", value: cargas.total_rows, icon: <Fuel style={{ width: 16, height: 16 }} />, color: "#10B981" });
  const robos = tables.find((t) => /robo|drenaj|theft|descarg/i.test(t.label));
  if (robos) kpis.push({ label: "Posibles robos", value: robos.total_rows, icon: <AlertTriangle style={{ width: 16, height: 16 }} />, color: "#EF4444" });
  const estac = tables.find((t) => /estacionam|parking/i.test(t.label));
  if (estac) kpis.push({ label: "Estacionamientos", value: estac.total_rows, icon: <Calendar style={{ width: 16, height: 16 }} />, color: "#F59E0B" });

  if (!kpis.length) return null;
  return (
    <div style={{ display: "grid", gridTemplateColumns: `repeat(${Math.min(kpis.length, 5)}, 1fr)`, gap: 12 }}>
      {kpis.map((k, i) => (
        <div key={i} style={{ background: "#fff", borderRadius: 12, boxShadow: "0 2px 8px rgba(0,0,0,.05)", padding: "14px 16px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 6, color: k.color, fontSize: 12, fontWeight: 700, textTransform: "uppercase", letterSpacing: ".03em" }}>{k.icon}{k.label}</div>
          <div style={{ fontSize: 24, fontWeight: 800, color: "#111827", marginTop: 4 }}>{k.value}</div>
        </div>
      ))}
    </div>
  );
}

function DataTable({ table, unitName, tplName }) {
  const [expanded, setExpanded] = useState(table.rows.length <= 30);
  const rows = expanded ? table.rows : table.rows.slice(0, 30);
  function exportCsv() {
    const esc = (v) => `"${String(v ?? "").replace(/"/g, '""')}"`;
    const lines = [table.header.map(esc).join(",")];
    for (const r of table.rows) lines.push(r.map(esc).join(","));
    const blob = new Blob(["﻿" + lines.join("\n")], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${(tplName || "informe").replace(/[^\w]+/g, "_")}_${(unitName || "").replace(/[^\w]+/g, "_")}_${table.label.replace(/[^\w]+/g, "_")}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }
  return (
    <div style={{ background: "#fff", borderRadius: 12, boxShadow: "0 2px 8px rgba(0,0,0,.05)", overflow: "hidden" }}>
      <div style={{ padding: "12px 16px", borderBottom: "1px solid #F3F4F6", background: "#FAFAFA", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div style={{ fontWeight: 800, color: "#111827", fontSize: 14, display: "flex", alignItems: "center", gap: 8 }}>
          <TableIcon style={{ width: 15, height: 15, color: "#8B5CF6" }} /> {table.label}
          <span style={{ fontSize: 12, fontWeight: 500, color: "#9CA3AF" }}>· {table.total_rows} filas{table.truncated ? " (mostrando 1500)" : ""}</span>
        </div>
        {table.rows.length > 0 && (
          <button onClick={exportCsv} style={{ ...presetStyle, display: "inline-flex", alignItems: "center", gap: 5 }}>
            <Download style={{ width: 13, height: 13 }} /> CSV
          </button>
        )}
      </div>
      <div style={{ overflowX: "auto", maxHeight: expanded ? 460 : "auto", overflowY: expanded ? "auto" : "visible" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12.5 }}>
          <thead>
            <tr>{table.header.map((h, i) => (
              <th key={i} style={{ position: "sticky", top: 0, background: "#F8FAFC", padding: "9px 12px", textAlign: "left", fontWeight: 700, color: "#475569", borderBottom: "1px solid #E5E7EB", whiteSpace: "nowrap" }}>{h}</th>
            ))}</tr>
          </thead>
          <tbody>
            {rows.map((r, ri) => (
              <tr key={ri} style={{ borderBottom: "1px solid #F3F4F6" }}>
                {r.map((c, ci) => (
                  <td key={ci} style={{ padding: "8px 12px", color: "#374151", whiteSpace: "nowrap", maxWidth: 320, overflow: "hidden", textOverflow: "ellipsis" }} title={String(c ?? "")}>{c}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {table.rows.length > 30 && (
        <div style={{ padding: "10px 16px", borderTop: "1px solid #F3F4F6", textAlign: "center" }}>
          <button onClick={() => setExpanded((v) => !v)} style={presetStyle}>
            {expanded ? "Mostrar menos" : `Ver todas (${table.rows.length})`}
          </button>
        </div>
      )}
    </div>
  );
}

// construir serie de nivel de combustible desde una tabla de viajes/detalle
function buildFuelChart(tables) {
  // buscar tabla con columna de "nivel de combustible" y una de fecha de inicio
  for (const t of tables) {
    const h = t.header || [];
    const fuelIdx = h.findIndex((x) => /nivel de combustible inicial/i.test(x));
    const fuelFinIdx = h.findIndex((x) => /nivel de combustible final/i.test(x));
    const dateIdx = h.findIndex((x) => /comienzo|inicio|tiempo|fecha/i.test(x));
    if (fuelIdx < 0 || dateIdx < 0) continue;
    // unidad de medida
    let unit = "";
    const data = [];
    for (const r of t.rows) {
      const ini = toNumber(r[fuelIdx]);
      const d = parseWialonDate(r[dateIdx]);
      if (ini == null || !d) continue;
      if (!unit) { const um = String(r[fuelIdx]).match(/[a-zA-Z%]+$/); if (um) unit = um[0]; }
      data.push({ ts: d.getTime(), label: `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")} ${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`, nivel: ini });
      // agregar también nivel final para más resolución
      if (fuelFinIdx >= 0) {
        const fin = toNumber(r[fuelFinIdx]);
        if (fin != null) data.push({ ts: d.getTime() + 1, label: "", nivel: fin });
      }
    }
    if (data.length >= 2) {
      data.sort((a, b) => a.ts - b.ts);
      return { data, unit: unit || "" };
    }
  }
  return null;
}

// ---------- estilos / util ----------
const lblStyle = { fontSize: 11.5, fontWeight: 700, color: "#6b7280", textTransform: "uppercase", letterSpacing: ".03em", display: "inline-flex", alignItems: "center", gap: 5 };
const inputStyle = { padding: "9px 12px", border: "1px solid #E5E7EB", borderRadius: 8, background: "#fff", fontSize: 13.5, fontWeight: 500, outline: "none", color: "#111827" };
const presetStyle = { padding: "8px 12px", background: "#F3F4F6", border: "1px solid #E5E7EB", borderRadius: 8, cursor: "pointer", fontSize: 12.5, fontWeight: 600, color: "#374151" };

function Banner({ tone, children }) {
  const map = {
    error: { bg: "#FEF2F2", bd: "#FECACA", fg: "#991B1B" },
    info: { bg: "#EFF6FF", bd: "#BFDBFE", fg: "#1E40AF" },
  };
  const c = map[tone] || map.info;
  return (
    <div style={{ background: c.bg, border: `1px solid ${c.bd}`, borderRadius: 12, padding: "14px 18px", color: c.fg, fontSize: 13.5, fontWeight: 500, display: "flex", alignItems: "center", gap: 8 }}>
      <AlertTriangle style={{ width: 17, height: 17 }} /> {children}
    </div>
  );
}
