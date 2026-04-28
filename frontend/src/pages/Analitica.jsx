import React, { useEffect, useMemo, useState } from "react";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid, ResponsiveContainer,
  PieChart, Pie, Cell, Legend, LineChart, Line, ComposedChart,
} from "recharts";
import { TrendingUp, Zap, PieChart as PieIcon, Grid3X3, Filter, X, DollarSign, TrendingDown, Fuel, Receipt, Coins, Clock as ClockIcon } from "lucide-react";
import { api } from "../lib/api";
import { formatSoles, formatNumber, BRAND_COLORS } from "../lib/utils";
import { useAuth } from "../context/AuthContext";

export default function Analitica() {
  const { user } = useAuth();
  const [data, setData] = useState(null);
  const [kpis, setKpis] = useState(null);
  const [empresas, setEmpresas] = useState([]);
  const [options, setOptions] = useState({ placas: [], semanas: [], estaciones: [], productos: [] });
  const [filters, setFilters] = useState({ empresa: "", placa: "", semana: "", estacion: "", producto: "" });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (user?.role === "admin_enered") api.get("/empresas").then((r) => setEmpresas(r.data)).catch(() => {});
    api.get("/dashboard/filter-options").then((r) => setOptions(r.data)).catch(() => {});
  }, [user]);

  useEffect(() => {
    setLoading(true);
    const params = Object.fromEntries(Object.entries(filters).filter(([_, v]) => v));
    Promise.all([
      api.get("/analytics/fleet", { params }),
      api.get("/dashboard/kpis", { params }),
    ])
      .then(([a, k]) => { setData(a.data); setKpis(k.data); })
      .finally(() => setLoading(false));
  }, [filters]);

  const activeFilters = useMemo(() => Object.values(filters).filter(Boolean).length, [filters]);

  // Heatmap map (must be before any early return)
  const hm = data?.heatmap_placa_semana || { placas: [], semanas: [], cells: [] };
  const hmMap = useMemo(() => {
    const m = {}; (hm.cells || []).forEach((c) => { m[`${c.placa}__${c.semana}`] = c.galones; });
    return m;
  }, [hm]);

  if (loading || !data) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="w-10 h-10 border-4 border-brand border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const paretoChart = data.pareto.slice(0, 15);
  const top10Participacion = data.participacion_placa.slice(0, 10);
  const othersPct = Math.max(0, 100 - top10Participacion.reduce((s, p) => s + p.pct, 0));
  const participacionPie = othersPct > 0.5
    ? [...top10Participacion.map((p) => ({ name: p.placa, value: p.pct })), { name: "Otras", value: othersPct }]
    : top10Participacion.map((p) => ({ name: p.placa, value: p.pct }));

  // Heatmap display
  const hmPlacas = hm.placas || [];
  const hmSemanas = hm.semanas || [];
  const hmMax = Math.max(1, ...(hm.cells || []).map((c) => c.galones));

  return (
    <div className="space-y-8">
      <div className="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-4">
        <div>
          <div className="text-[11px] font-bold uppercase tracking-widest text-brand mb-2">Inteligencia de flota</div>
          <h1 className="font-cabinet font-black text-3xl md:text-4xl text-neutral-900">Analítica avanzada</h1>
          <p className="text-neutral-500 mt-1 text-sm">Concentración, distribución y patrones profundos.</p>
        </div>
        {user?.role === "admin_enered" && empresas.length > 0 && (
          <select
            value={filters.empresa}
            onChange={(e) => setFilters({ ...filters, empresa: e.target.value })}
            className="h-11 px-3 border border-border rounded-md bg-white text-sm font-semibold min-w-[220px]"
          >
            <option value="">Todas las empresas</option>
            {empresas.map((e) => <option key={e} value={e}>{e}</option>)}
          </select>
        )}
      </div>

      {/* Filtros globales */}
      <div className="bg-white border border-border rounded-lg p-3 md:p-4 flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-2 text-xs font-bold text-neutral-600 uppercase tracking-wider">
          <Filter className="w-4 h-4" /> Filtros
        </div>
        <select value={filters.placa} onChange={(e) => setFilters({ ...filters, placa: e.target.value })} className="h-9 px-3 border border-border rounded-md bg-white text-sm font-medium min-w-[140px]">
          <option value="">Placa</option>{options.placas.map((v) => <option key={v}>{v}</option>)}
        </select>
        <select value={filters.semana} onChange={(e) => setFilters({ ...filters, semana: e.target.value })} className="h-9 px-3 border border-border rounded-md bg-white text-sm font-medium min-w-[140px]">
          <option value="">Semana</option>{options.semanas.map((v) => <option key={v}>{v}</option>)}
        </select>
        <select value={filters.estacion} onChange={(e) => setFilters({ ...filters, estacion: e.target.value })} className="h-9 px-3 border border-border rounded-md bg-white text-sm font-medium min-w-[180px]">
          <option value="">Estación</option>{options.estaciones.map((v) => <option key={v}>{v}</option>)}
        </select>
        <select value={filters.producto} onChange={(e) => setFilters({ ...filters, producto: e.target.value })} className="h-9 px-3 border border-border rounded-md bg-white text-sm font-medium min-w-[160px]">
          <option value="">Producto</option>{options.productos.map((v) => <option key={v}>{v}</option>)}
        </select>
        {activeFilters > 0 && (
          <button onClick={() => setFilters({ empresa: filters.empresa, placa: "", semana: "", estacion: "", producto: "" })}
            className="h-9 px-3 border border-border rounded-md text-xs font-bold flex items-center gap-1 hover:bg-neutral-50">
            <X className="w-3 h-3" /> Limpiar
          </button>
        )}
      </div>

      {/* KPI 27 — Pareto */}
      <div className="chart-card" data-testid="chart-pareto">
        <div className="mb-5 pb-4 border-b border-neutral-100 flex items-start justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <span className="px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-widest bg-amber-50 text-amber-700 border border-amber-200">KPI 27</span>
              <h2 className="font-cabinet font-bold text-lg text-neutral-900">Pareto de consumo 80/20</h2>
            </div>
            <p className="text-xs text-neutral-500 mt-1 font-semibold">¿Qué % de placas concentra el 80% del gasto? Actuar primero sobre esas unidades.</p>
          </div>
          <TrendingUp className="w-5 h-5 text-amber-600" />
        </div>

        <ResponsiveContainer width="100%" height={380}>
          <ComposedChart data={paretoChart} margin={{ top: 10, right: 30, left: 0, bottom: 50 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" vertical={false} />
            <XAxis dataKey="placa" tick={{ fontSize: 10, fontWeight: 700 }} stroke="#525252" angle={-45} textAnchor="end" height={60} />
            <YAxis yAxisId="left" tick={{ fontSize: 10 }} stroke="#a3a3a3" />
            <YAxis yAxisId="right" orientation="right" domain={[0, 100]} tick={{ fontSize: 10 }} stroke="#8039F4" unit="%" />
            <Tooltip contentStyle={{ borderRadius: 8, fontSize: 12 }} formatter={(v, n) => n === "pct_acum" ? `${v}%` : `S/ ${formatNumber(v, 2)}`} />
            <Legend wrapperStyle={{ fontSize: 11, fontWeight: 600 }} />
            <Bar yAxisId="left" dataKey="gasto" fill="#8039F4" name="Gasto (S/)" radius={[4, 4, 0, 0]} />
            <Line yAxisId="right" type="monotone" dataKey="pct_acum" stroke="#DC2626" strokeWidth={2.5} dot={{ r: 3 }} name="% acumulado" />
          </ComposedChart>
        </ResponsiveContainer>

        {/* 80/20 annotation */}
        {paretoChart.length > 0 && (
          <div className="mt-4 bg-amber-50 border border-amber-200 rounded-md p-3 text-sm flex items-start gap-2">
            <Zap className="w-4 h-4 text-amber-600 mt-0.5 flex-shrink-0" />
            <div className="text-neutral-700">
              <b>Insight:</b> las primeras <b>{paretoChart.findIndex((p) => p.pct_acum >= 80) + 1 || paretoChart.length}</b> placas concentran el 80% del gasto. Son las prioritarias para auditoría, mantenimiento y control.
            </div>
          </div>
        )}
      </div>

      {/* KPI 28 — Heatmap placa x semana */}
      <div className="chart-card" data-testid="chart-heatmap-placa-semana">
        <div className="mb-5 pb-4 border-b border-neutral-100 flex items-start justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <span className="px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-widest bg-brand-50 text-brand border border-brand-100">KPI 28</span>
              <h2 className="font-cabinet font-bold text-lg text-neutral-900">Heatmap placa × semana</h2>
            </div>
            <p className="text-xs text-neutral-500 mt-1 font-semibold">Patrones de uso intensivo · celdas más oscuras = más galones</p>
          </div>
          <Grid3X3 className="w-5 h-5 text-brand" />
        </div>

        {hmPlacas.length === 0 ? (
          <div className="text-center py-8 text-neutral-500 text-sm">Sin datos suficientes</div>
        ) : (
          <div className="overflow-x-auto">
            <div className="inline-block min-w-full">
              <div className="flex text-[10px] font-bold text-neutral-500 pl-20 mb-1">
                {hmSemanas.map((s) => (
                  <div key={s} style={{ width: 60 }} className="text-center truncate px-1">{s.replace("Semana ", "W")}</div>
                ))}
              </div>
              {hmPlacas.map((placa) => (
                <div key={placa} className="flex items-center mb-1">
                  <div className="w-20 text-[11px] font-mono font-bold text-neutral-700 pr-2">{placa}</div>
                  {hmSemanas.map((sem) => {
                    const v = hmMap[`${placa}__${sem}`] || 0;
                    const intensity = v / hmMax;
                    const bg = v === 0 ? "#f5f5f5" : `rgba(153, 51, 255, ${0.12 + intensity * 0.88})`;
                    return (
                      <div
                        key={sem}
                        style={{ width: 58, height: 30, background: bg }}
                        className="mr-0.5 rounded-sm flex items-center justify-center text-[10px] font-bold"
                        title={`${placa} · ${sem} — ${formatNumber(v, 2)} gal`}
                      >
                        {v > 0 && intensity > 0.35 ? <span className="text-white">{Math.round(v)}</span> : v > 0 ? <span className="text-neutral-600">{Math.round(v)}</span> : null}
                      </div>
                    );
                  })}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* KPI 29 — Participación por placa (dona) */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="chart-card lg:col-span-2" data-testid="chart-participacion-donut">
          <div className="mb-5 pb-4 border-b border-neutral-100 flex items-start justify-between gap-3">
            <div>
              <div className="flex items-center gap-2">
                <span className="px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-widest bg-pink-50 text-pink-700 border border-pink-200">KPI 29</span>
                <h2 className="font-cabinet font-bold text-lg text-neutral-900">Participación por placa</h2>
              </div>
              <p className="text-xs text-neutral-500 mt-1 font-semibold">Concentración del consumo en top 10 placas (+ otras)</p>
            </div>
            <PieIcon className="w-5 h-5 text-pink-600" />
          </div>
          <ResponsiveContainer width="100%" height={360}>
            <PieChart>
              <Pie data={participacionPie} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={70} outerRadius={130} paddingAngle={2} label={(p) => `${p.name} ${p.value.toFixed(1)}%`}>
                {participacionPie.map((_, i) => <Cell key={i} fill={BRAND_COLORS[i % BRAND_COLORS.length]} />)}
              </Pie>
              <Tooltip formatter={(v) => `${v.toFixed(2)}%`} contentStyle={{ borderRadius: 8, fontSize: 12 }} />
            </PieChart>
          </ResponsiveContainer>
        </div>

        <div className="chart-card" data-testid="participacion-table">
          <div className="mb-5 pb-4 border-b border-neutral-100">
            <h3 className="font-cabinet font-bold text-base text-neutral-900">Detalle participación</h3>
            <p className="text-xs text-neutral-500 mt-0.5 font-semibold">Top 15 por consumo</p>
          </div>
          <div className="space-y-2">
            {data.participacion_placa.slice(0, 15).map((p, i) => (
              <div key={p.placa} className="flex items-center gap-3 text-sm">
                <span className="w-5 text-[11px] font-bold text-neutral-400">{i + 1}.</span>
                <span className="font-mono font-bold text-neutral-900 w-20">{p.placa}</span>
                <div className="flex-1 h-2 bg-neutral-100 rounded-full overflow-hidden">
                  <div className="h-full rounded-full" style={{ width: `${p.pct}%`, background: BRAND_COLORS[i % BRAND_COLORS.length] }} />
                </div>
                <span className="text-xs font-bold text-neutral-700 w-14 text-right">{p.pct.toFixed(1)}%</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ============== EXTRA: Gasto, Ahorro, Operativos, Producto, Comportamiento ============== */}
      {kpis && <ExtraSections data={kpis} />}
    </div>
  );
}

/* ============== EXTRA SECTIONS (movidas desde Dashboard) ============== */
const SECTION_COLORS = {
  amber: "bg-amber-50 text-amber-700 border-amber-200",
  green: "bg-green-50 text-green-700 border-green-200",
  blue: "bg-blue-50 text-blue-700 border-blue-200",
  pink: "bg-pink-50 text-pink-700 border-pink-200",
  slate: "bg-slate-50 text-slate-700 border-slate-200",
};

function SectionHeader({ label, title, color = "amber" }) {
  return (
    <div className="flex items-baseline gap-3 mb-5 mt-2">
      <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-widest border ${SECTION_COLORS[color]}`}>
        {label}
      </span>
      <h2 className="font-cabinet font-bold text-xl text-neutral-900">{title}</h2>
    </div>
  );
}

function KPI({ label, value, sub, icon: Icon, accent = "brand" }) {
  const ring = {
    brand: "bg-brand-50 border-brand-100 text-brand",
    green: "bg-green-50 border-green-100 text-green-600",
    amber: "bg-amber-50 border-amber-100 text-amber-600",
    blue: "bg-blue-50 border-blue-100 text-blue-600",
  }[accent];
  return (
    <div className="kpi-card">
      <div className="flex items-start justify-between">
        <div>
          <div className="text-[10px] font-bold uppercase tracking-widest text-neutral-500 mb-2">{label}</div>
          <div className="font-cabinet font-black text-3xl text-neutral-900 leading-none">{value}</div>
          {sub && <div className="text-xs text-neutral-500 mt-2 font-semibold">{sub}</div>}
        </div>
        <div className={`w-10 h-10 rounded-md border flex items-center justify-center ${ring}`}>
          <Icon className="w-5 h-5" strokeWidth={2.5} />
        </div>
      </div>
    </div>
  );
}

function MiniCard({ title, subtitle, children, className = "" }) {
  return (
    <div className={`chart-card ${className}`}>
      <div className="mb-4 pb-3 border-b border-neutral-100">
        <div className="font-cabinet font-bold text-base text-neutral-900">{title}</div>
        {subtitle && <div className="text-[11px] text-neutral-500 mt-0.5 font-semibold">{subtitle}</div>}
      </div>
      {children}
    </div>
  );
}

function ExtraSections({ data }) {
  const t = data.totals;
  const productosPie = (data.consumo_producto || []).map((p) => ({ name: p.producto, value: p.galones }));
  const medioPie = (data.medio_identificacion || []).map((m) => ({ name: m.medio, value: m.cargas }));

  return (
    <div className="space-y-8 pt-4 border-t border-neutral-200">
      {/* Gasto */}
      <SectionHeader label="Gasto" title="Control financiero" color="amber" />
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 md:gap-5">
        <KPI label="Gasto total" value={formatSoles(t.total_gasto)} icon={DollarSign} accent="amber" />
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <MiniCard title="Gasto en el tiempo" subtitle="S/ por semana">
          <ResponsiveContainer width="100%" height={280}>
            <LineChart data={data.series_semana} margin={{ top: 10, right: 20, left: 0, bottom: 10 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis dataKey="semana" tick={{ fontSize: 10, fontWeight: 700 }} stroke="#525252" />
              <YAxis tick={{ fontSize: 11 }} stroke="#a3a3a3" />
              <Tooltip contentStyle={{ borderRadius: 8, fontSize: 12 }} formatter={(v) => formatSoles(v)} />
              <Line type="monotone" dataKey="gasto" stroke="#F59E0B" strokeWidth={3} dot={{ r: 3 }} name="S/" />
            </LineChart>
          </ResponsiveContainer>
        </MiniCard>

        <MiniCard title="Gasto por placa" subtitle="Top 10 unidades más costosas">
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={data.gasto_placa} layout="vertical" margin={{ top: 5, right: 20, left: 10, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" horizontal={false} />
              <XAxis type="number" tick={{ fontSize: 10 }} stroke="#a3a3a3" />
              <YAxis type="category" dataKey="placa" tick={{ fontSize: 11, fontWeight: 700 }} width={80} stroke="#525252" />
              <Tooltip formatter={(v) => formatSoles(v)} contentStyle={{ borderRadius: 8, fontSize: 12 }} />
              <Bar dataKey="gasto" fill="#F59E0B" radius={[0, 4, 4, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </MiniCard>
      </div>

      {/* Ahorro */}
      <SectionHeader label="Ahorro" title="El diferencial ENERED" color="green" />
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 md:gap-5">
        <KPI label="Ahorro total" value={formatSoles(t.total_ahorro)} icon={TrendingDown} accent="green" />
        <KPI label="Ahorro %" value={`${t.ahorro_pct}%`} sub="vs precio pizarra" icon={Coins} accent="green" />
        <KPI label="Precio ENERED" value={`S/ ${t.precio_enered}`} sub="prom ponderado" icon={Fuel} accent="brand" />
        <KPI label="Precio pizarra" value={`S/ ${t.precio_pizarra}`} sub="de referencia" icon={Fuel} accent="amber" />
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <MiniCard title="Ahorro en el tiempo" subtitle="S/ por semana">
          <ResponsiveContainer width="100%" height={280}>
            <LineChart data={data.series_semana} margin={{ top: 10, right: 20, left: 0, bottom: 10 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis dataKey="semana" tick={{ fontSize: 10, fontWeight: 700 }} stroke="#525252" />
              <YAxis tick={{ fontSize: 11 }} stroke="#a3a3a3" />
              <Tooltip contentStyle={{ borderRadius: 8, fontSize: 12 }} formatter={(v) => formatSoles(v)} />
              <Line type="monotone" dataKey="ahorro" stroke="#16A34A" strokeWidth={3} dot={{ r: 3 }} name="Ahorro S/" />
            </LineChart>
          </ResponsiveContainer>
        </MiniCard>

        <MiniCard title="Ahorro por estación" subtitle="Top 10 dónde conviene cargar">
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={data.ahorro_estacion} layout="vertical" margin={{ top: 5, right: 20, left: 10, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" horizontal={false} />
              <XAxis type="number" tick={{ fontSize: 10 }} stroke="#a3a3a3" />
              <YAxis type="category" dataKey="estacion" tick={{ fontSize: 10, fontWeight: 700 }} width={140} stroke="#525252" />
              <Tooltip formatter={(v) => formatSoles(v)} contentStyle={{ borderRadius: 8, fontSize: 12 }} />
              <Bar dataKey="ahorro" fill="#16A34A" radius={[0, 4, 4, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </MiniCard>
      </div>

      <MiniCard title="Precio ENERED vs Pizarra" subtitle="Por tipo de combustible · ahorro visible">
        <ResponsiveContainer width="100%" height={300}>
          <BarChart data={data.precio_comparacion_producto} margin={{ top: 10, right: 20, left: 0, bottom: 10 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" vertical={false} />
            <XAxis dataKey="producto" tick={{ fontSize: 11, fontWeight: 700 }} stroke="#525252" />
            <YAxis tick={{ fontSize: 11 }} stroke="#a3a3a3" domain={["auto", "auto"]} />
            <Tooltip formatter={(v) => `S/ ${v}`} contentStyle={{ borderRadius: 8, fontSize: 12 }} />
            <Legend wrapperStyle={{ fontSize: 12, fontWeight: 600 }} />
            <Bar dataKey="pizarra" fill="#F59E0B" radius={[4, 4, 0, 0]} name="Precio Pizarra" />
            <Bar dataKey="enered" fill="#8039F4" radius={[4, 4, 0, 0]} name="Precio ENERED" />
          </BarChart>
        </ResponsiveContainer>
      </MiniCard>

      {/* Operativos */}
      <SectionHeader label="Operativos" title="Eficiencia del abastecimiento" color="blue" />
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <MiniCard title="Cargas en el tiempo" subtitle="Frecuencia por semana">
          <ResponsiveContainer width="100%" height={260}>
            <LineChart data={data.series_semana} margin={{ top: 10, right: 20, left: 0, bottom: 10 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis dataKey="semana" tick={{ fontSize: 10, fontWeight: 700 }} stroke="#525252" />
              <YAxis tick={{ fontSize: 11 }} stroke="#a3a3a3" allowDecimals={false} />
              <Tooltip contentStyle={{ borderRadius: 8, fontSize: 12 }} />
              <Line type="monotone" dataKey="cargas" stroke="#3B82F6" strokeWidth={3} dot={{ r: 3 }} name="Cargas" />
            </LineChart>
          </ResponsiveContainer>
        </MiniCard>

        <MiniCard title="Cargas por placa" subtitle="Top 10 unidades">
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={data.cargas_placa} layout="vertical" margin={{ top: 5, right: 20, left: 10, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" horizontal={false} />
              <XAxis type="number" tick={{ fontSize: 10 }} stroke="#a3a3a3" allowDecimals={false} />
              <YAxis type="category" dataKey="placa" tick={{ fontSize: 11, fontWeight: 700 }} width={80} stroke="#525252" />
              <Tooltip contentStyle={{ borderRadius: 8, fontSize: 12 }} />
              <Bar dataKey="cargas" fill="#3B82F6" radius={[0, 4, 4, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </MiniCard>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <MiniCard title="Ticket promedio en el tiempo" subtitle="S/ por carga · evolución">
          <ResponsiveContainer width="100%" height={240}>
            <LineChart data={data.series_semana} margin={{ top: 10, right: 20, left: 0, bottom: 10 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis dataKey="semana" tick={{ fontSize: 10, fontWeight: 700 }} stroke="#525252" />
              <YAxis tick={{ fontSize: 11 }} stroke="#a3a3a3" />
              <Tooltip contentStyle={{ borderRadius: 8, fontSize: 12 }} formatter={(v) => formatSoles(v)} />
              <Line type="monotone" dataKey="ticket_prom" stroke="#EC4899" strokeWidth={2.5} dot={{ r: 3 }} name="Ticket" />
            </LineChart>
          </ResponsiveContainer>
        </MiniCard>

        <MiniCard title="Galones promedio por carga" subtitle="Evolución">
          <ResponsiveContainer width="100%" height={240}>
            <LineChart data={data.series_semana} margin={{ top: 10, right: 20, left: 0, bottom: 10 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis dataKey="semana" tick={{ fontSize: 10, fontWeight: 700 }} stroke="#525252" />
              <YAxis tick={{ fontSize: 11 }} stroke="#a3a3a3" />
              <Tooltip contentStyle={{ borderRadius: 8, fontSize: 12 }} formatter={(v) => `${v} gal`} />
              <Line type="monotone" dataKey="gal_por_carga" stroke="#06B6D4" strokeWidth={2.5} dot={{ r: 3 }} name="Gal/carga" />
            </LineChart>
          </ResponsiveContainer>
        </MiniCard>
      </div>

      {/* Producto */}
      <SectionHeader label="Producto" title="Mezcla de combustibles" color="pink" />
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <MiniCard title="Consumo por producto" subtitle="Galones · mix utilizado">
          <ResponsiveContainer width="100%" height={300}>
            <PieChart>
              <Pie data={productosPie} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={60} outerRadius={110} paddingAngle={2}>
                {productosPie.map((_, i) => <Cell key={i} fill={BRAND_COLORS[i % BRAND_COLORS.length]} />)}
              </Pie>
              <Tooltip formatter={(v) => `${formatNumber(v, 2)} gal`} contentStyle={{ borderRadius: 8, fontSize: 12 }} />
              <Legend wrapperStyle={{ fontSize: 12, fontWeight: 600 }} />
            </PieChart>
          </ResponsiveContainer>
        </MiniCard>

        <MiniCard title="Gasto por producto" subtitle="S/ · cuál pesa más">
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={data.gasto_producto} margin={{ top: 10, right: 20, left: 0, bottom: 10 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" vertical={false} />
              <XAxis dataKey="producto" tick={{ fontSize: 11, fontWeight: 700 }} stroke="#525252" />
              <YAxis tick={{ fontSize: 11 }} stroke="#a3a3a3" />
              <Tooltip formatter={(v) => formatSoles(v)} contentStyle={{ borderRadius: 8, fontSize: 12 }} />
              <Bar dataKey="gasto" fill="#EC4899" radius={[6, 6, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </MiniCard>
      </div>

      {/* Comportamiento */}
      <SectionHeader label="Comportamiento" title="Patrones operativos" color="slate" />
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        <MiniCard title="Cargas por hora" subtitle="Horarios operativos" className="lg:col-span-2">
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={data.cargas_por_hora} margin={{ top: 10, right: 10, left: 0, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" vertical={false} />
              <XAxis dataKey="hora" tick={{ fontSize: 10, fontWeight: 700 }} stroke="#525252" />
              <YAxis tick={{ fontSize: 11 }} stroke="#a3a3a3" allowDecimals={false} />
              <Tooltip contentStyle={{ borderRadius: 8, fontSize: 12 }} />
              <Bar dataKey="cargas" fill="#8039F4" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </MiniCard>

        <MiniCard title="Uso QR vs otros medios" subtitle="Nivel de control">
          <ResponsiveContainer width="100%" height={260}>
            <PieChart>
              <Pie data={medioPie} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={50} outerRadius={90} paddingAngle={2}>
                {medioPie.map((_, i) => <Cell key={i} fill={BRAND_COLORS[i % BRAND_COLORS.length]} />)}
              </Pie>
              <Tooltip contentStyle={{ borderRadius: 8, fontSize: 12 }} />
              <Legend wrapperStyle={{ fontSize: 11, fontWeight: 600 }} />
            </PieChart>
          </ResponsiveContainer>
        </MiniCard>
      </div>

      <MiniCard title="Cargas por día de la semana" subtitle="Identificar días críticos">
        <ResponsiveContainer width="100%" height={240}>
          <BarChart data={data.cargas_por_dia} margin={{ top: 10, right: 20, left: 0, bottom: 10 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" vertical={false} />
            <XAxis dataKey="dia" tick={{ fontSize: 12, fontWeight: 700 }} stroke="#525252" />
            <YAxis tick={{ fontSize: 11 }} stroke="#a3a3a3" allowDecimals={false} />
            <Tooltip contentStyle={{ borderRadius: 8, fontSize: 12 }} />
            <Bar dataKey="cargas" fill="#8039F4" radius={[6, 6, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </MiniCard>
    </div>
  );
}
