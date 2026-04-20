import React, { useEffect, useMemo, useState } from "react";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid, ResponsiveContainer,
  PieChart, Pie, Cell, Legend, LineChart, Line, ComposedChart,
} from "recharts";
import { TrendingUp, Zap, PieChart as PieIcon, Grid3X3, Filter, X } from "lucide-react";
import { api } from "../lib/api";
import { formatSoles, formatNumber, BRAND_COLORS } from "../lib/utils";
import { useAuth } from "../context/AuthContext";

export default function Analitica() {
  const { user } = useAuth();
  const [data, setData] = useState(null);
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
    api.get("/analytics/fleet", { params }).then((r) => setData(r.data)).finally(() => setLoading(false));
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
            <YAxis yAxisId="right" orientation="right" domain={[0, 100]} tick={{ fontSize: 10 }} stroke="#9933FF" unit="%" />
            <Tooltip contentStyle={{ borderRadius: 8, fontSize: 12 }} formatter={(v, n) => n === "pct_acum" ? `${v}%` : `S/ ${formatNumber(v, 2)}`} />
            <Legend wrapperStyle={{ fontSize: 11, fontWeight: 600 }} />
            <Bar yAxisId="left" dataKey="gasto" fill="#9933FF" name="Gasto (S/)" radius={[4, 4, 0, 0]} />
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
    </div>
  );
}
