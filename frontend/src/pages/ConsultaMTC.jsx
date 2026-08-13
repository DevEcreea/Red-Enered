import React, { useState } from "react";
import { api } from "../lib/api";
import { toast } from "sonner";
import {
  Search, Loader2, ShieldCheck, ShieldX, Building2, Truck, Calendar,
  FileText, MapPin, Hash, Download, Copy, AlertTriangle,
} from "lucide-react";

const TIPOS = [
  { key: "ruc", label: "RUC", ph: "20482372407", len: 11 },
  { key: "placa", label: "Placa", ph: "T8D811", len: 6 },
  { key: "constancia", label: "Constancia", ph: "15M26019402E", len: 9 },
  { key: "partida", label: "Partida", ph: "Código de empresa", len: 0 },
];

export default function ConsultaMTC() {
  const [tipo, setTipo] = useState("ruc");
  const [valor, setValor] = useState("");
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState(null);
  const [error, setError] = useState("");

  const tipoInfo = TIPOS.find((t) => t.key === tipo);

  async function buscar() {
    const v = valor.trim().toUpperCase();
    if (!v) { toast.error("Ingresa un valor a buscar"); return; }
    setLoading(true); setError(""); setData(null);
    try {
      const { data } = await api.get("/mtc/consulta", { params: { tipo, valor: v } });
      setData(data);
      if (data.total_autorizaciones === 0) toast.info("El MTC no devolvió resultados para ese valor.");
    } catch (e) {
      setError(e?.response?.data?.detail || "No se pudo consultar el MTC");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={{ padding: "22px 26px", background: "#F5F7FA", minHeight: "100%" }} data-testid="mtc-page">
      {/* Header */}
      <div style={{ marginBottom: 18 }}>
        <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: ".1em", color: "#2073b7", textTransform: "uppercase" }}>MTC · DGTT</div>
        <div style={{ fontSize: 22, fontWeight: 800, color: "#111827", marginTop: 2 }}>Consulta de habilitación — Transporte de mercancías</div>
        <div style={{ fontSize: 13, color: "#6b7280", marginTop: 2 }}>Estado de habilitación, N° de permiso, vigencia y unidades autorizadas, en tiempo real desde el MTC.</div>
      </div>

      {/* Buscador */}
      <div style={{ background: "#fff", borderRadius: 12, boxShadow: "0 2px 8px rgba(0,0,0,.05)", padding: 18, display: "flex", flexWrap: "wrap", gap: 14, alignItems: "flex-end" }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          <label style={lbl}>Buscar por</label>
          <div style={{ display: "inline-flex", background: "#F3F4F6", borderRadius: 9, padding: 3 }}>
            {TIPOS.map((t) => (
              <button key={t.key} onClick={() => setTipo(t.key)} data-testid={`tipo-${t.key}`}
                style={{ padding: "7px 14px", border: "none", borderRadius: 6, cursor: "pointer", fontSize: 13, fontWeight: 700,
                  background: tipo === t.key ? "#fff" : "transparent", color: tipo === t.key ? "#2073b7" : "#6b7280",
                  boxShadow: tipo === t.key ? "0 1px 3px rgba(0,0,0,.1)" : "none" }}>
                {t.label}
              </button>
            ))}
          </div>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 6, flex: 1, minWidth: 240 }}>
          <label style={lbl}>Valor ({tipoInfo.label})</label>
          <input value={valor} onChange={(e) => setValor(e.target.value)} placeholder={tipoInfo.ph}
            onKeyDown={(e) => e.key === "Enter" && buscar()} data-testid="mtc-input"
            style={{ padding: "11px 14px", border: "1px solid #E5E7EB", borderRadius: 9, fontSize: 15, outline: "none", fontWeight: 600, letterSpacing: ".02em", textTransform: "uppercase" }} />
        </div>
        <button onClick={buscar} disabled={loading} data-testid="mtc-buscar"
          style={{ padding: "12px 22px", background: loading ? "#93C5FD" : "#2073b7", color: "#fff", border: "none", borderRadius: 9, cursor: loading ? "wait" : "pointer", fontSize: 15, fontWeight: 700, display: "inline-flex", alignItems: "center", gap: 8 }}>
          {loading ? <Loader2 style={{ width: 17, height: 17, animation: "spin 1s linear infinite" }} /> : <Search style={{ width: 17, height: 17 }} />}
          {loading ? "Consultando…" : "Consultar"}
        </button>
      </div>

      {error && (
        <div style={{ marginTop: 16, background: "#FEF2F2", border: "1px solid #FECACA", borderRadius: 12, padding: "14px 18px", color: "#991B1B", fontSize: 14, fontWeight: 500, display: "flex", alignItems: "center", gap: 8 }}>
          <AlertTriangle style={{ width: 18, height: 18 }} /> {error}
        </div>
      )}

      {loading && (
        <div style={{ marginTop: 16, background: "#fff", borderRadius: 12, padding: 50, textAlign: "center", color: "#6b7280" }}>
          <Loader2 style={{ width: 30, height: 30, animation: "spin 1s linear infinite", color: "#2073b7", margin: "0 auto" }} />
          <div style={{ marginTop: 10, fontWeight: 600 }}>Consultando el MTC…</div>
        </div>
      )}

      {data && !loading && data.total_autorizaciones === 0 && (
        <div style={{ marginTop: 16, background: "#fff", borderRadius: 12, padding: 40, textAlign: "center", color: "#9CA3AF" }}>
          <Search style={{ width: 30, height: 30, margin: "0 auto", color: "#D1D5DB" }} />
          <div style={{ marginTop: 8, fontWeight: 600, color: "#6b7280" }}>Sin resultados para {data.tipo.toUpperCase()} {data.valor}</div>
        </div>
      )}

      {data && !loading && data.autorizaciones.map((a, i) => <Autorizacion key={i} a={a} />)}
    </div>
  );
}

function Autorizacion({ a }) {
  const hab = a.habilitado;
  function copiarPlacas() {
    const txt = a.vehiculos.map((v) => v.placa).join(", ");
    navigator.clipboard.writeText(txt);
    toast.success(`${a.vehiculos.length} placas copiadas`);
  }
  function exportCsv() {
    const cols = ["item", "placa", "constancia", "categoria", "chasis", "anio", "ejes", "carga_util", "peso_seco"];
    const esc = (v) => `"${String(v ?? "").replace(/"/g, '""')}"`;
    const lines = [cols.join(",")];
    a.vehiculos.forEach((v) => lines.push(cols.map((c) => esc(v[c])).join(",")));
    const blob = new Blob(["﻿" + lines.join("\n")], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const el = document.createElement("a");
    el.href = url; el.download = `MTC_${a.razon_social.replace(/[^\w]+/g, "_")}_placas.csv`; el.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div style={{ marginTop: 16, background: "#fff", borderRadius: 14, boxShadow: "0 2px 10px rgba(0,0,0,.06)", overflow: "hidden" }}>
      {/* Cabecera empresa + estado */}
      <div style={{ padding: "18px 22px", borderBottom: "1px solid #F3F4F6", display: "flex", alignItems: "flex-start", justifyContent: "space-between", flexWrap: "wrap", gap: 14 }}>
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: 9 }}>
            <Building2 style={{ width: 19, height: 19, color: "#2073b7" }} />
            <span style={{ fontSize: 18, fontWeight: 800, color: "#111827" }}>{a.razon_social || "—"}</span>
          </div>
          <div style={{ fontSize: 13, color: "#6b7280", marginTop: 6, display: "flex", flexWrap: "wrap", gap: "4px 18px" }}>
            <span><Hash style={ic} /> RUC {a.ruc}</span>
            {a.modalidad && <span>{a.modalidad}</span>}
            {a.direccion && <span><MapPin style={ic} /> {a.direccion}</span>}
          </div>
        </div>
        <div style={{ display: "inline-flex", alignItems: "center", gap: 8, padding: "8px 16px", borderRadius: 999,
          background: hab ? "#ECFDF5" : "#FEF2F2", color: hab ? "#065F46" : "#991B1B", fontWeight: 800, fontSize: 14 }}>
          {hab ? <ShieldCheck style={{ width: 18, height: 18 }} /> : <ShieldX style={{ width: 18, height: 18 }} />}
          {a.estado || "—"}
        </div>
      </div>

      {/* KPIs: permiso, vigencia, unidades */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 1, background: "#F3F4F6" }}>
        <Kpi icon={<FileText style={kic} />} label="N° de permiso" value={a.codigo || "—"} />
        <Kpi icon={<Calendar style={kic} />} label="Vigente hasta" value={a.vigente_hasta || "—"} tone={hab ? "" : "danger"} />
        <Kpi icon={<Truck style={kic} />} label="Unidades autorizadas" value={a.total_unidades} />
        <Kpi icon={<MapPin style={kic} />} label="Inscrita en" value={a.ciudad_inscripcion || "—"} />
      </div>

      {/* Tabla de placas */}
      {a.vehiculos.length > 0 && (
        <div>
          <div style={{ padding: "12px 20px", display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 10 }}>
            <div style={{ fontWeight: 800, color: "#111827", fontSize: 14, display: "flex", alignItems: "center", gap: 8 }}>
              <Truck style={{ width: 16, height: 16, color: "#2073b7" }} /> Flota autorizada ({a.vehiculos.length})
            </div>
            <div style={{ display: "flex", gap: 8 }}>
              <button onClick={copiarPlacas} style={btnMini}><Copy style={{ width: 13, height: 13 }} /> Copiar placas</button>
              <button onClick={exportCsv} style={btnMini}><Download style={{ width: 13, height: 13 }} /> CSV</button>
            </div>
          </div>
          <div style={{ overflowX: "auto", maxHeight: 420, overflowY: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
              <thead>
                <tr>
                  {["#", "Placa", "N° Constancia", "Categoría", "Año", "Ejes", "Carga útil (kg)", "Chasis"].map((h) => (
                    <th key={h} style={th}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {a.vehiculos.map((v, i) => (
                  <tr key={i} style={{ borderBottom: "1px solid #F3F4F6" }}>
                    <td style={td}>{v.item}</td>
                    <td style={{ ...td, fontWeight: 800, color: "#2073b7", letterSpacing: ".03em" }}>{v.placa}</td>
                    <td style={td}>{v.constancia}</td>
                    <td style={td}><span style={{ background: "#EFF6FF", color: "#1E40AF", padding: "2px 8px", borderRadius: 6, fontWeight: 700, fontSize: 12 }}>{v.categoria}</span></td>
                    <td style={td}>{v.anio && v.anio !== "0" && v.anio !== "0000" ? v.anio : "—"}</td>
                    <td style={td}>{v.ejes}</td>
                    <td style={td}>{v.carga_util}</td>
                    <td style={{ ...td, color: "#9CA3AF", fontFamily: "monospace", fontSize: 11.5 }}>{v.chasis}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

function Kpi({ icon, label, value, tone }) {
  return (
    <div style={{ background: "#fff", padding: "14px 18px" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 6, color: "#6b7280", fontSize: 11.5, fontWeight: 700, textTransform: "uppercase", letterSpacing: ".03em" }}>{icon}{label}</div>
      <div style={{ fontSize: 20, fontWeight: 800, marginTop: 4, color: tone === "danger" ? "#DC2626" : "#111827" }}>{value}</div>
    </div>
  );
}

const lbl = { fontSize: 11.5, fontWeight: 700, color: "#6b7280", textTransform: "uppercase", letterSpacing: ".03em" };
const ic = { width: 13, height: 13, display: "inline", verticalAlign: -2, marginRight: 3 };
const kic = { width: 14, height: 14 };
const th = { position: "sticky", top: 0, background: "#F8FAFC", padding: "9px 14px", textAlign: "left", fontWeight: 700, color: "#475569", borderBottom: "1px solid #E5E7EB", whiteSpace: "nowrap" };
const td = { padding: "9px 14px", color: "#374151", whiteSpace: "nowrap" };
const btnMini = { display: "inline-flex", alignItems: "center", gap: 5, padding: "7px 12px", background: "#F3F4F6", border: "1px solid #E5E7EB", borderRadius: 8, cursor: "pointer", fontSize: 12.5, fontWeight: 700, color: "#374151" };
