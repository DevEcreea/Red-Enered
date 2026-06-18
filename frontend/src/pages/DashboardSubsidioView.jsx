import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Loader2, Fuel, Banknote, Truck, Building2, FileCheck2,
  CheckCircle2, Circle, AlertTriangle, ShieldCheck, BarChart3, Gauge, Users,
  MapPin, FileText, Clock,
} from "lucide-react";
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, Cell,
} from "recharts";
import { api } from "../lib/api";

const STAGE_ICONS = {
  solicitud_enviada:   FileCheck2,
  evaluacion_atu:      ShieldCheck,
  aprobada:            CheckCircle2,
  abonado_en_cuenta:   Banknote,
};

export default function DashboardSubsidioView() {
  const navigate = useNavigate();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [serieView, setSerieView] = useState("galones"); // galones | importe
  const [topUView, setTopUView] = useState("galones");
  const [topEView, setTopEView] = useState("galones");

  useEffect(() => {
    (async () => {
      try {
        const { data } = await api.get("/subsidio/dashboard-data");
        setData(data);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  if (loading) {
    return (
      <div className="min-h-[400px] flex items-center justify-center" data-testid="dashboard-subsidio-loading">
        <Loader2 className="w-8 h-8 animate-spin text-brand" />
      </div>
    );
  }
  if (!data) return null;

  const {
    stages = [], kpis = {}, serie_semanal = [],
    top_unidades = [], top_estaciones = [],
    documentos_semaforo = { items: [], summary: {} },
  } = data;

  const fmt = (n) => Number(n || 0).toLocaleString("es-PE", { maximumFractionDigits: 2 });

  return (
    <div className="space-y-6" data-testid="dashboard-subsidio">
      {/* Header */}
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <span className="text-[10px] uppercase tracking-widest font-bold text-brand">DU 004-2026</span>
          <h2 className="font-cabinet text-2xl font-bold text-neutral-900 mt-1">Tu subsidio en cifras</h2>
          <p className="text-sm text-neutral-500 mt-1">Avance del expediente, consumo y vencimientos de documentos.</p>
        </div>
        <button
          onClick={() => navigate("/subsidio/documentos")}
          className="px-4 py-2 bg-brand hover:bg-brand-hover text-white text-sm font-bold rounded-lg flex items-center gap-2"
          data-testid="dashboard-subsidio-cta-expediente"
        >
          <FileCheck2 className="w-4 h-4" /> Subir más facturas
        </button>
      </div>

      {/* FILA 1 — Stages */}
      <StagesRow stages={stages} />

      {/* FILA 2 — 6 KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        <Kpi icon={Truck}   label="Unidades incluidas"          value={kpis.unidades_incluidas}                                  accent="brand"   testid="kpi-unidades-incluidas" />
        <Kpi icon={Users}   label="Unidades habilitadas activas" value={kpis.unidades_activas}                                   accent="cyan"    testid="kpi-unidades-activas" />
        <Kpi icon={Fuel}    label="Galones reconocidos"          value={fmt(kpis.galones_reconocidos)} suffix=" gl"               accent="emerald" testid="kpi-galones-reconocidos" />
        <Kpi icon={Banknote} label="Gasto total"                 value={`S/ ${fmt(kpis.gasto_total)}`}                            accent="amber"   testid="kpi-gasto-total" />
        <Kpi icon={Gauge}   label="Precio promedio x galón"      value={`S/ ${fmt(kpis.precio_promedio_galon)}`}                  accent="brand"   testid="kpi-precio-promedio" />
        <Kpi icon={BarChart3} label="Costo promedio x unidad"    value={`S/ ${fmt(kpis.costo_promedio_unidad)}`}                  accent="neutral" testid="kpi-costo-unidad" />
      </div>

      {/* FILA 3 — Evolución semanal */}
      <div className="bg-white border border-neutral-200 rounded-2xl p-5 shadow-sm" data-testid="card-evolucion-semanal">
        <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
          <div>
            <h3 className="font-cabinet text-lg font-bold">Evolución semanal de consumo</h3>
            <p className="text-xs text-neutral-500">Semanas de 7 días desde el 01/06/2026</p>
          </div>
          <Toggle value={serieView} onChange={setSerieView} testidPrefix="serie-toggle" />
        </div>
        {serie_semanal.length === 0 ? (
          <Empty msg="Aún no hay consumos del 01/06/2026 en adelante. Sube comprobantes para verlos aquí." />
        ) : (
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={serie_semanal} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#eee" />
              <XAxis dataKey="semana" stroke="#737373" fontSize={11} />
              <YAxis stroke="#737373" fontSize={11} />
              <Tooltip content={<SemanaTooltip fmt={fmt} />} />
              <Bar dataKey={serieView} fill="#7c3aed" radius={[6, 6, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>

      {/* FILA 4 — Top unidades + Top estaciones */}
      <div className="grid md:grid-cols-2 gap-4">
        {/* Top unidades */}
        <div className="bg-white border border-neutral-200 rounded-2xl p-5 shadow-sm" data-testid="card-top-unidades">
          <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
            <h3 className="font-cabinet text-lg font-bold flex items-center gap-2">
              <Truck className="w-5 h-5 text-brand" /> Top unidades por consumo
            </h3>
            <Toggle value={topUView} onChange={setTopUView} testidPrefix="topu-toggle" />
          </div>
          {top_unidades.length === 0 ? (
            <Empty msg="Sin datos aún." />
          ) : (
            <ResponsiveContainer width="100%" height={240}>
              <BarChart data={top_unidades} layout="vertical" margin={{ left: 4 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#eee" />
                <XAxis type="number" stroke="#737373" fontSize={11} />
                <YAxis type="category" dataKey="placa" stroke="#737373" fontSize={11} width={80} />
                <Tooltip
                  formatter={(v) => topUView === "importe" ? [`S/ ${fmt(v)}`, "Importe"] : [`${fmt(v)} gl`, "Galones"]}
                />
                <Bar dataKey={topUView} fill="#7c3aed" radius={[0, 6, 6, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>

        {/* Top estaciones */}
        <div className="bg-white border border-neutral-200 rounded-2xl p-5 shadow-sm" data-testid="card-top-estaciones">
          <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
            <h3 className="font-cabinet text-lg font-bold flex items-center gap-2">
              <MapPin className="w-5 h-5 text-brand" /> Top estaciones / proveedores
            </h3>
            <Toggle value={topEView} onChange={setTopEView} testidPrefix="tope-toggle" />
          </div>
          {top_estaciones.length === 0 ? (
            <Empty msg="Sin datos aún." />
          ) : (
            <ResponsiveContainer width="100%" height={240}>
              <BarChart data={top_estaciones} layout="vertical" margin={{ left: 4 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#eee" />
                <XAxis type="number" stroke="#737373" fontSize={11} />
                <YAxis
                  type="category"
                  dataKey="estacion"
                  stroke="#737373"
                  fontSize={10}
                  width={140}
                  tickFormatter={(s) => (s && s.length > 22 ? s.slice(0, 22) + "…" : s)}
                />
                <Tooltip
                  formatter={(v) => topEView === "importe" ? [`S/ ${fmt(v)}`, "Importe"] : [`${fmt(v)} gl`, "Galones"]}
                />
                <Bar dataKey={topEView} fill="#06b6d4" radius={[0, 6, 6, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      {/* FILA 5 — Semáforo de vencimiento */}
      <DocsSemaforoCard semaforo={documentos_semaforo} navigate={navigate} />
    </div>
  );
}

/* ============================================================ */
/* Stages — Fila 1                                              */
/* ============================================================ */
function StagesRow({ stages }) {
  if (!stages?.length) return null;
  return (
    <div className="bg-white border border-neutral-200 rounded-2xl p-5 shadow-sm" data-testid="card-stages">
      <div className="flex items-center justify-between flex-wrap gap-2 mb-4">
        <div>
          <h3 className="font-cabinet text-lg font-bold">Estado de tu expediente</h3>
          <p className="text-xs text-neutral-500">Solo el equipo Enered puede avanzar estas etapas.</p>
        </div>
      </div>
      <div className="relative">
        {/* línea base */}
        <div className="absolute top-5 left-0 right-0 h-0.5 bg-neutral-200" />
        <div className="grid grid-cols-4 gap-3 relative">
          {stages.map((s, idx) => {
            const Icon = STAGE_ICONS[s.key] || Circle;
            const isDone = s.status === "done";
            const isCurrent = s.status === "current";
            const colors = isDone
              ? "bg-emerald-500 text-white border-emerald-500"
              : isCurrent
              ? "bg-brand text-white border-brand ring-4 ring-brand/20 animate-pulse"
              : "bg-white text-neutral-300 border-neutral-200";
            const labelColor = isDone
              ? "text-emerald-700"
              : isCurrent
              ? "text-brand"
              : "text-neutral-400";
            return (
              <div key={s.key} className="flex flex-col items-center text-center relative" data-testid={`stage-${s.key}`}>
                <div className={`w-10 h-10 rounded-full border-2 flex items-center justify-center z-10 ${colors}`}>
                  <Icon className="w-5 h-5" strokeWidth={2.5} />
                </div>
                <div className={`text-xs font-bold mt-2 ${labelColor}`}>{s.label}</div>
                <div className="text-[10px] uppercase tracking-widest mt-0.5 text-neutral-400">
                  Etapa {idx + 1}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

/* ============================================================ */
/* Documents semáforo — Fila 5                                  */
/* ============================================================ */
function DocsSemaforoCard({ semaforo, navigate }) {
  const { items = [], summary = {} } = semaforo || {};
  const colorFor = (status) => {
    if (status === "active")   return { bg: "bg-emerald-50",  border: "border-emerald-200",  text: "text-emerald-700",  badge: "bg-emerald-500", label: "Activo" };
    if (status === "expiring") return { bg: "bg-amber-50",    border: "border-amber-200",    text: "text-amber-700",    badge: "bg-amber-500",   label: "Por vencer" };
    if (status === "expired")  return { bg: "bg-red-50",      border: "border-red-200",      text: "text-red-700",      badge: "bg-red-500",     label: "Vencido" };
    return { bg: "bg-neutral-50", border: "border-neutral-200", text: "text-neutral-500", badge: "bg-neutral-300", label: "Falta" };
  };

  return (
    <div className="bg-white border border-neutral-200 rounded-2xl p-5 shadow-sm" data-testid="card-docs-semaforo">
      <div className="flex items-center justify-between flex-wrap gap-2 mb-3">
        <div>
          <h3 className="font-cabinet text-lg font-bold flex items-center gap-2">
            <FileText className="w-5 h-5 text-brand" /> Vencimiento de documentos
          </h3>
          <p className="text-xs text-neutral-500">Vigencia 365 días desde la carga. Reemplaza los documentos antes que venzan.</p>
        </div>
        <div className="flex items-center gap-2 text-xs">
          <SummaryBadge color="emerald" label="Activos" value={summary.active || 0} testid="semaforo-summary-active" />
          <SummaryBadge color="amber"   label="Por vencer" value={summary.expiring || 0} testid="semaforo-summary-expiring" />
          <SummaryBadge color="red"     label="Vencidos" value={summary.expired || 0} testid="semaforo-summary-expired" />
          {(summary.missing || 0) > 0 && (
            <SummaryBadge color="neutral" label="Faltantes" value={summary.missing} testid="semaforo-summary-missing" />
          )}
        </div>
      </div>

      {items.length === 0 ? (
        <Empty msg="Aún no has cargado documentos de empresa." />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          {items.map((d) => {
            const c = colorFor(d.status);
            return (
              <div key={d.categoria} className={`border rounded-xl p-4 ${c.bg} ${c.border}`} data-testid={`semaforo-item-${d.categoria}`}>
                <div className="flex items-start justify-between gap-2">
                  <div className="text-sm font-bold text-neutral-900 leading-tight">{d.label}</div>
                  <span className={`w-3 h-3 rounded-full ${c.badge} flex-shrink-0 mt-1`} aria-label={c.label} />
                </div>
                <div className={`text-[10px] uppercase tracking-widest font-bold mt-2 ${c.text}`}>{c.label}</div>
                <div className="mt-2 text-xs text-neutral-600">
                  {d.status === "missing" ? (
                    <button
                      onClick={() => navigate("/subsidio/documentos")}
                      className="text-brand font-bold hover:underline"
                      data-testid={`semaforo-upload-${d.categoria}`}
                    >
                      Cargar documento →
                    </button>
                  ) : d.expires_at ? (
                    <>
                      <Clock className="w-3 h-3 inline mr-1" />
                      Vence {new Date(d.expires_at).toLocaleDateString("es-PE")}
                      {typeof d.days_remaining === "number" && (
                        <span className="ml-1 text-neutral-500">
                          ({d.days_remaining < 0 ? `${Math.abs(d.days_remaining)}d vencido` : `${d.days_remaining}d restantes`})
                        </span>
                      )}
                    </>
                  ) : null}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

/* ============================================================ */
/* UI helpers                                                    */
/* ============================================================ */
function SemanaTooltip({ active, payload, fmt }) {
  if (!active || !payload?.length) return null;
  const p = payload[0].payload;
  return (
    <div className="bg-white border border-neutral-200 rounded-lg shadow-md p-2.5 text-xs">
      <div className="font-bold">{p.semana}</div>
      <div className="text-neutral-500">{p.rango}</div>
      <div className="mt-1">
        <span className="text-brand font-bold">{fmt(p.galones)}</span> galones
      </div>
      <div>S/ <span className="font-bold">{fmt(p.importe)}</span></div>
      <div className="text-neutral-500">{p.cargas} cargas</div>
    </div>
  );
}

function Kpi({ icon: Icon, label, value, suffix = "", accent = "brand", testid }) {
  const colors = {
    brand:   "bg-brand text-white",
    cyan:    "bg-cyan-100 text-cyan-700",
    emerald: "bg-emerald-100 text-emerald-700",
    amber:   "bg-amber-100 text-amber-700",
    neutral: "bg-neutral-100 text-neutral-700",
  };
  return (
    <div className="bg-white border border-neutral-200 rounded-2xl p-4 shadow-sm" data-testid={testid}>
      <div className={`w-9 h-9 rounded-lg flex items-center justify-center mb-3 ${colors[accent]}`}>
        <Icon className="w-4 h-4" strokeWidth={2} />
      </div>
      <div className="text-[10px] uppercase tracking-widest font-bold text-neutral-500">{label}</div>
      <div className="font-cabinet text-xl font-bold mt-0.5">{value}{suffix}</div>
    </div>
  );
}

function Toggle({ value, onChange, testidPrefix }) {
  return (
    <div className="inline-flex bg-neutral-100 rounded-lg p-0.5 text-xs font-bold">
      <button
        onClick={() => onChange("galones")}
        className={`px-3 py-1 rounded-md transition ${value === "galones" ? "bg-white text-brand shadow" : "text-neutral-500"}`}
        data-testid={`${testidPrefix}-galones`}
      >
        Galones
      </button>
      <button
        onClick={() => onChange("importe")}
        className={`px-3 py-1 rounded-md transition ${value === "importe" ? "bg-white text-brand shadow" : "text-neutral-500"}`}
        data-testid={`${testidPrefix}-importe`}
      >
        Soles
      </button>
    </div>
  );
}

function SummaryBadge({ color, label, value, testid }) {
  const palette = {
    emerald: "bg-emerald-100 text-emerald-700",
    amber:   "bg-amber-100 text-amber-700",
    red:     "bg-red-100 text-red-700",
    neutral: "bg-neutral-100 text-neutral-700",
  }[color];
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full ${palette}`} data-testid={testid}>
      <span className="font-bold">{value}</span>
      <span className="opacity-80">{label}</span>
    </span>
  );
}

function Empty({ msg }) {
  return (
    <div className="text-center py-10 text-sm text-neutral-400 border-2 border-dashed border-neutral-200 rounded-xl">
      {msg}
    </div>
  );
}
