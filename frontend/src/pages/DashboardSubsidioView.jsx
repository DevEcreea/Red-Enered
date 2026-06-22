import React, { useEffect, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import {
  Loader2, Fuel, Banknote, Truck, Building2, FileCheck2,
  CheckCircle2, Circle, AlertTriangle, ShieldCheck, BarChart3, Gauge, Users,
  MapPin, FileText, Clock, RefreshCw,
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
  const [refreshing, setRefreshing] = useState(false);
  const [serieView, setSerieView] = useState("galones"); // galones | importe
  const [topUView, setTopUView] = useState("galones");
  const [topEView, setTopEView] = useState("galones");

  const fetchData = useCallback(async (silent = false) => {
    if (silent) setRefreshing(true);
    try {
      const { data } = await api.get("/subsidio/dashboard-data");
      setData(data);
    } finally {
      if (silent) setRefreshing(false);
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
    // Refetch al volver el foco a la pestaña (p.ej. tras confirmar facturas en otra ruta)
    const onFocus = () => fetchData(true);
    const onVisibility = () => { if (!document.hidden) fetchData(true); };
    window.addEventListener("focus", onFocus);
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      window.removeEventListener("focus", onFocus);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [fetchData]);

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
    pending_drafts = 0,
  } = data;

  const fmt = (n) => Number(n || 0).toLocaleString("es-PE", { maximumFractionDigits: 2 });
  const hasNoData =
    (kpis.galones_reconocidos || 0) === 0 &&
    (kpis.gasto_total || 0) === 0 &&
    serie_semanal.length === 0 &&
    top_unidades.length === 0;

  return (
    <div className="space-y-6" data-testid="dashboard-subsidio">
      {/* Header */}
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <span className="text-[10px] uppercase tracking-widest font-bold text-brand">DU 004-2026</span>
          <h2 className="font-cabinet text-2xl font-bold text-neutral-900 mt-1">Tu subsidio en cifras</h2>
          <p className="text-sm text-neutral-500 mt-1">Avance del expediente, consumo y vencimientos de documentos.</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => fetchData(true)}
            disabled={refreshing}
            className="h-10 px-3 border border-neutral-300 hover:border-brand text-neutral-600 hover:text-brand text-sm font-bold rounded-lg flex items-center gap-2 disabled:opacity-50"
            data-testid="dashboard-subsidio-refresh"
            title="Actualizar datos"
          >
            <RefreshCw className={`w-4 h-4 ${refreshing ? "animate-spin" : ""}`} />
            {refreshing ? "Actualizando..." : "Actualizar"}
          </button>
          <button
            onClick={() => navigate("/subsidio/documentos")}
            className="px-4 py-2 bg-brand hover:bg-brand-hover text-white text-sm font-bold rounded-lg flex items-center gap-2"
            data-testid="dashboard-subsidio-cta-expediente"
          >
            <FileCheck2 className="w-4 h-4" /> Subir más facturas
          </button>
        </div>
      </div>

      {/* Banner: hay drafts pendientes de confirmar */}
      {pending_drafts > 0 && (
        <div
          className="bg-gradient-to-r from-amber-50 to-orange-50 border border-amber-300 rounded-2xl p-4 flex items-start gap-3 shadow-sm"
          data-testid="dashboard-drafts-banner"
        >
          <div className="w-10 h-10 rounded-lg bg-amber-500 text-white flex items-center justify-center flex-shrink-0">
            <AlertTriangle className="w-5 h-5" />
          </div>
          <div className="flex-1">
            <div className="font-cabinet font-bold text-amber-900">
              Tienes {pending_drafts} {pending_drafts === 1 ? "factura subida" : "facturas subidas"} sin confirmar
            </div>
            <p className="text-xs text-amber-800 mt-0.5">
              El dashboard solo muestra facturas <strong>confirmadas</strong>. Revísalas y confírmalas para que los KPIs y gráficos se actualicen.
            </p>
          </div>
          <button
            onClick={() => navigate("/subsidio/verificar")}
            className="px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white text-sm font-bold rounded-lg flex items-center gap-2 flex-shrink-0"
            data-testid="dashboard-drafts-banner-cta"
          >
            <CheckCircle2 className="w-4 h-4" /> Verificar y confirmar
          </button>
        </div>
      )}

      {/* Banner: sin facturas confirmadas todavía (sin drafts tampoco) */}
      {hasNoData && pending_drafts === 0 && (
        <div
          className="bg-gradient-to-r from-brand/5 to-cyan-50 border border-brand/20 rounded-2xl p-4 flex items-start gap-3 shadow-sm"
          data-testid="dashboard-empty-banner"
        >
          <div className="w-10 h-10 rounded-lg bg-brand text-white flex items-center justify-center flex-shrink-0">
            <Fuel className="w-5 h-5" />
          </div>
          <div className="flex-1">
            <div className="font-cabinet font-bold text-neutral-900">Aún no hay facturas confirmadas</div>
            <p className="text-xs text-neutral-600 mt-0.5">
              Carga tus comprobantes de combustible y confírmalos para alimentar el dashboard con KPIs, evolución semanal y rankings.
            </p>
          </div>
          <button
            onClick={() => navigate("/subsidio/documentos")}
            className="px-4 py-2 bg-brand hover:bg-brand-hover text-white text-sm font-bold rounded-lg flex items-center gap-2 flex-shrink-0"
            data-testid="dashboard-empty-banner-cta"
          >
            <FileCheck2 className="w-4 h-4" /> Subir facturas
          </button>
        </div>
      )}

      {/* FILA 1 — Stages */}
      <StagesRow stages={stages} user={data.user} kpis={kpis} />

      {/* FILA 2 — 4 KPIs */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Kpi
          icon={Truck}
          label="Unidades incluidas"
          value={`${kpis.unidades_incluidas || 0} / ${kpis.unidades_contratadas || 0}`}
          subValue={kpis.unidades_detalle || "Sin vehículos"}
          iconColor="text-brand"
          testid="kpi-unidades-incluidas"
        />
        <Kpi
          icon={CheckCircle2}
          label="Habilitadas y activas"
          value={`${kpis.unidades_validas || 0} / ${kpis.unidades_incluidas || 0}`}
          subValue={`${kpis.unidades_validas_pct || 0}% operativas`}
          subValueColor="text-emerald-600"
          iconColor="text-emerald-500"
          testid="kpi-unidades-activas"
        />
        <Kpi
          icon={Fuel}
          label="Galones reconocidos"
          value={fmt(kpis.galones_reconocidos)}
          subValue={`${kpis.invoices_confirmed || 0} de ${kpis.invoices_total || 0} comprobantes`}
          iconColor="text-red-500"
          testid="kpi-galones-reconocidos"
        />
        <Kpi
          icon={FileText}
          label="Documentos en regla"
          value={`${kpis.pct_docs || 0}%`}
          subValue={kpis.docs_detalle || "Todos al día"}
          subValueColor={kpis.docs_detalle?.includes("vencer") || kpis.docs_detalle?.includes("vencidos") ? "text-amber-600" : "text-emerald-600"}
          iconColor="text-violet-500"
          testid="kpi-docs-en-regla"
        />
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
const fmtStageDate = (isoStr, formatType) => {
  if (!isoStr) return "—";
  try {
    const d = new Date(isoStr);
    const months = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];
    const day = String(d.getDate()).padStart(2, '0');
    const month = months[d.getMonth()];
    const year = d.getFullYear();
    if (formatType === "desde") {
      return `desde ${day} ${month}`;
    }
    return `${day} ${month} ${year}`;
  } catch {
    return "—";
  }
};

/* ============================================================ */
/* Stages — Fila 1                                              */
/* ============================================================ */
function StagesRow({ stages, user, kpis }) {
  if (!stages?.length) return null;

  const subsidioReconocido = (kpis.galones_reconocidos || 0) * 4;
  const gastoTotal = kpis.gasto_total || 0;
  const pctAhorro = gastoTotal > 0 ? ((subsidioReconocido / gastoTotal) * 100).toFixed(1) : "0.0";

  const num = (v) => Number(v || 0).toLocaleString("es-PE", { maximumFractionDigits: 2 });

  const ruc = user?.ruc || "20000000000";
  const numENR = `ENR-2026-${ruc.slice(-5)}`;
  const numATU = `ATU-2026-${ruc.slice(-6)}`;

  const getStageSubtitle = (s, idx) => {
    const currentStage = user?.expediente_stage;
    const submittedAt = user?.expediente_submitted_at || user?.created_at;
    const stageUpdatedAt = user?.expediente_stage_updated_at;

    if (idx === 0) {
      return submittedAt ? fmtStageDate(submittedAt) : "—";
    }

    if (currentStage === s.key) {
      return stageUpdatedAt ? fmtStageDate(stageUpdatedAt, "desde") : "—";
    }

    const currentIdx = stages.findIndex(st => st.key === currentStage);
    if (currentIdx > idx) {
      return "Completado";
    }

    return "—";
  };

  return (
    <div className="bg-brand text-white border border-brand/20 rounded-2xl p-6 shadow-sm relative overflow-hidden" data-testid="card-stages">
      {/* Upper Section: Info & Ahorro */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-center mb-8">
        <div className="lg:col-span-2 space-y-2">
          <div className="text-xs lg:text-sm font-bold opacity-90 flex items-center gap-1">
            💰 Tu subsidio reconocido · N.º {numENR}
          </div>
          <div className="text-4xl lg:text-5xl font-cabinet font-black tracking-tight">
            S/ {num(subsidioReconocido)}
          </div>
          <div className="text-xs opacity-75">
            Validado de tus comprobantes · expediente {numATU}
          </div>
        </div>

        <div className="bg-white/10 border border-white/20 rounded-xl p-4 space-y-1">
          <div className="text-[10px] tracking-wider font-bold opacity-75">% DE AHORRO DEL TOTAL CONSUMIDO</div>
          <div className="text-3xl font-cabinet font-black">{pctAhorro}%</div>
          <div className="text-xs opacity-80 leading-normal">
            De los S/ {num(gastoTotal)} que gastaste en diésel, el Estado te devuelve S/ {num(subsidioReconocido)}.
          </div>
        </div>
      </div>

      {/* Progress Timeline */}
      <div className="relative pt-4">
        {/* line track */}
        <div className="absolute top-[27px] left-[12%] right-[12%] h-[2px] bg-white/20" />
        
        <div className="grid grid-cols-4 gap-2 relative">
          {stages.map((s, idx) => {
            const isDone = s.status === "done";
            const isCurrent = s.status === "current";
            
            let dotCls = "bg-white/20 border-white/30 text-white/50";
            if (isDone) {
              dotCls = "bg-white text-brand border-white";
            } else if (isCurrent) {
              dotCls = "bg-white text-brand border-white ring-4 ring-white/30";
            }

            return (
              <div key={s.key} className="flex flex-col items-center text-center relative" data-testid={`stage-${s.key}`}>
                <div className={`w-8 h-8 rounded-full border-2 flex items-center justify-center z-10 transition-all ${dotCls}`}>
                  {isDone ? (
                    <span className="text-[10px] font-bold text-brand">✓</span>
                  ) : isCurrent ? (
                    <span className="w-2.5 h-2.5 rounded-full bg-brand" />
                  ) : (
                    <span className="w-2 h-2 rounded-full bg-white/40" />
                  )}
                </div>
                
                <div className="text-xs font-bold mt-2 text-white">{s.label}</div>
                <div className="text-[10px] opacity-75 mt-0.5 font-medium">
                  {getStageSubtitle(s, idx)}
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

function Kpi({ icon: Icon, label, value, subValue, subValueColor = "text-neutral-500", testid, iconColor = "text-brand" }) {
  return (
    <div className="bg-white border border-neutral-200 rounded-2xl p-5 shadow-sm hover:shadow-md transition-all duration-200" data-testid={testid}>
      <div className="flex items-center gap-2 mb-3">
        <Icon className={`w-4 h-4 ${iconColor}`} strokeWidth={2.5} />
        <span className="text-xs font-bold text-neutral-500">{label}</span>
      </div>
      <div className="font-cabinet text-2xl font-black text-neutral-900 leading-none">{value}</div>
      <div className={`text-xs font-bold mt-2 ${subValueColor}`}>{subValue}</div>
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
