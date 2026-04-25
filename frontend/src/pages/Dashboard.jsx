import React, { useEffect, useMemo, useState } from "react";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid, ResponsiveContainer,
  PieChart, Pie, Cell, Legend, LineChart, Line,
} from "recharts";
import {
  Fuel, DollarSign, TrendingDown, Package, AlertTriangle, CheckCircle2, AlertCircle,
  Gauge, Coins, Droplets, CalendarClock, Receipt, Zap, Filter, X,
  Truck, Fuel as FuelIcon, Building2, ArrowUpRight, Info, XCircle, ExternalLink, Clock,
} from "lucide-react";
import { api } from "../lib/api";
import { formatSoles, formatNumber, BRAND_COLORS } from "../lib/utils";
import { useAuth } from "../context/AuthContext";

const MAPS_LINK = "https://maps.app.goo.gl/LZpyBqYs54LazZtV7";

function OverviewSection({ overview, alerts }) {
  const { linea_credito, ahorro, consumo, promedios, cargas, unidades_contratadas, red_estaciones, ultima_sincronizacion } = overview;
  const pctUsado = linea_credito.total > 0 ? (linea_credito.utilizada / linea_credito.total) * 100 : 0;
  const syncFmt = ultima_sincronizacion
    ? new Date(ultima_sincronizacion).toLocaleString("es-PE", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit", second: "2-digit" })
    : "—";

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-2 text-xs text-neutral-500 font-semibold justify-end">
        <Clock className="w-3.5 h-3.5" />
        Información generada el <span className="font-bold text-neutral-800">{syncFmt}</span>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        {/* Estado General */}
        <div className="lg:col-span-4 bg-white border border-neutral-200 rounded-2xl p-6" data-testid="estado-general">
          <div className="flex items-center gap-2.5 mb-5">
            <div className="w-9 h-9 rounded-lg bg-brand-50 text-brand flex items-center justify-center">
              <AlertCircle className="w-5 h-5" />
            </div>
            <h3 className="font-cabinet font-bold text-lg text-neutral-900">Estado General</h3>
          </div>
          {alerts.length === 0 ? (
            <div className="flex items-start gap-3 bg-green-50 border border-green-100 rounded-lg p-4">
              <CheckCircle2 className="w-5 h-5 text-green-600 mt-0.5 flex-shrink-0" />
              <div>
                <div className="font-bold text-green-800 text-sm">Felicitaciones</div>
                <div className="text-green-700 text-xs mt-0.5">La configuración está completa</div>
              </div>
            </div>
          ) : (
            <div className="space-y-2.5 max-h-[260px] overflow-y-auto pr-1">
              {alerts.slice(0, 6).map((a, i) => {
                const col = a.nivel === "red" ? { bg: "bg-red-50", bd: "border-red-100", tx: "text-red-700", Ic: XCircle }
                  : a.nivel === "green" ? { bg: "bg-green-50", bd: "border-green-100", tx: "text-green-700", Ic: CheckCircle2 }
                  : { bg: "bg-amber-50", bd: "border-amber-100", tx: "text-amber-700", Ic: AlertTriangle };
                const Ic = col.Ic;
                return (
                  <div key={i} className={`flex items-start gap-2.5 ${col.bg} border ${col.bd} rounded-lg p-3`}>
                    <Ic className={`w-4 h-4 ${col.tx} mt-0.5 flex-shrink-0`} />
                    <div className="text-xs leading-snug">
                      <div className={`font-bold ${col.tx}`}>{a.titulo}</div>
                      <div className="text-neutral-700 mt-0.5">{a.mensaje}</div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Línea de Crédito */}
        <div className="lg:col-span-4 rounded-2xl p-6 text-white relative overflow-hidden" style={{ background: "linear-gradient(135deg, #9933FF 0%, #6B23B1 100%)" }} data-testid="linea-credito">
          <div className="flex items-center gap-2.5 mb-5">
            <Coins className="w-6 h-6" />
            <h3 className="font-cabinet font-bold text-lg">Línea de Crédito</h3>
          </div>

          <div className="grid grid-cols-3 gap-3 mb-5">
            <div>
              <div className="text-[11px] uppercase tracking-widest text-white/70 font-bold mb-1">Total</div>
              <div className="font-cabinet font-black text-xl lg:text-2xl leading-tight">{formatSoles(linea_credito.total)}</div>
            </div>
            <div>
              <div className="text-[11px] uppercase tracking-widest text-white/70 font-bold mb-1">Disponible</div>
              <div className="font-cabinet font-black text-xl lg:text-2xl leading-tight text-cyan-200">{formatSoles(linea_credito.disponible)}</div>
            </div>
            <div>
              <div className="text-[11px] uppercase tracking-widest text-white/70 font-bold mb-1">Utilizada</div>
              <div className="font-cabinet font-black text-xl lg:text-2xl leading-tight text-amber-200">{formatSoles(linea_credito.utilizada)}</div>
            </div>
          </div>

          <div className="h-2 bg-white/15 rounded-full overflow-hidden">
            <div className="h-full rounded-full bg-amber-300 transition-all" style={{ width: `${Math.min(100, pctUsado)}%` }} />
          </div>
          <div className="mt-2 text-[11px] font-semibold text-white/70">
            {pctUsado.toFixed(1)}% utilizado · {linea_credito.total === 0 ? "sin línea configurada" : "de tu línea aprobada"}
          </div>
        </div>

        {/* Ahorro + Consumo */}
        <div className="lg:col-span-4 rounded-2xl p-6 text-white relative overflow-hidden" style={{ background: "linear-gradient(135deg, #6B23B1 0%, #4A148C 100%)" }} data-testid="ahorro-consumo">
          <div className="flex items-center gap-2.5 mb-5">
            <TrendingDown className="w-6 h-6" />
            <h3 className="font-cabinet font-bold text-lg">Ahorro & Consumo</h3>
          </div>

          <div className="mb-5">
            <div className="text-[11px] uppercase tracking-widest text-cyan-300 font-bold mb-1">Ahorro</div>
            <div className="flex items-baseline gap-3 flex-wrap">
              <span className="font-cabinet font-black text-2xl lg:text-3xl leading-tight text-cyan-200">{formatSoles(ahorro.soles)}</span>
              <span className="text-sm text-white/80 font-bold">{formatNumber(ahorro.galones, 2)} gal</span>
            </div>
          </div>

          <div className="border-t border-white/20 pt-4">
            <div className="text-[11px] uppercase tracking-widest text-white/70 font-bold mb-1">Consumo</div>
            <div className="flex items-baseline gap-3 flex-wrap">
              <span className="font-cabinet font-black text-2xl lg:text-3xl leading-tight">{formatSoles(consumo.soles)}</span>
              <span className="text-sm text-white/70 font-bold">{formatNumber(consumo.galones, 2)} gal</span>
            </div>
          </div>
        </div>
      </div>

      {/* Mini metrics row (6 cards horizontal) */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        <MiniMetric label="Ticket Prom." value={formatSoles(promedios.ticket)} testid="mini-ticket" />
        <MiniMetric label="Carga Prom." value={`${formatNumber(promedios.carga_gal, 0)} gal`} testid="mini-carga" />
        <MiniMetric label="Precio Prom." value={`S/${formatNumber(promedios.precio, 2)}`} testid="mini-precio" />
        <MiniMetric label="Unidades" value={formatNumber(unidades_contratadas, 0)} icon={Truck} testid="mini-unidades" />
        <MiniMetric label="Cargas" value={formatNumber(cargas, 0)} icon={FuelIcon} testid="mini-cargas" />
        <MiniMetric label="Red" value={formatNumber(red_estaciones, 0)} icon={Building2} cyan onClick={() => window.open(MAPS_LINK, "_blank")} testid="mini-red" />
      </div>
    </div>
  );
}

function MiniMetric({ label, value, icon: Icon, cyan = false, onClick, testid }) {
  const base = "rounded-xl p-4 flex flex-col justify-between min-h-[100px] transition-all";
  const cls = cyan
    ? "bg-cyan-300 text-[#1e1b4b] border border-cyan-300 hover:bg-cyan-400 hover:-translate-y-0.5 cursor-pointer"
    : "bg-[#2B1C4A] text-white border border-[#2B1C4A]";
  const Wrapper = onClick ? "button" : "div";
  return (
    <Wrapper onClick={onClick} data-testid={testid} className={`${base} ${cls} ${onClick ? "text-left" : ""}`}>
      <div className="flex items-center justify-between">
        <div className={`text-[11px] uppercase tracking-widest font-bold ${cyan ? "text-[#1e1b4b]/70" : "text-white/60"}`}>{label}</div>
        {Icon && <Icon className={`w-4 h-4 ${cyan ? "text-[#1e1b4b]/70" : "text-white/50"}`} />}
      </div>
      <div className="font-cabinet font-black text-2xl leading-tight mt-2">{value}</div>
      {cyan && onClick && <div className="text-[10px] font-bold text-[#1e1b4b]/70 mt-1 flex items-center gap-0.5">Cobertura <ArrowUpRight className="w-3 h-3" /></div>}
    </Wrapper>
  );
}

const ALERT_STYLES = {
  red: { bg: "bg-red-50", text: "text-red-700", border: "border-red-200", Icon: AlertCircle, dot: "bg-red-500" },
  yellow: { bg: "bg-yellow-50", text: "text-yellow-700", border: "border-yellow-200", Icon: AlertTriangle, dot: "bg-yellow-500" },
  green: { bg: "bg-green-50", text: "text-green-700", border: "border-green-200", Icon: CheckCircle2, dot: "bg-green-500" },
};

const SECTION_COLORS = {
  brand: "bg-brand-50 text-brand border-brand-100",
  green: "bg-green-50 text-green-700 border-green-200",
  amber: "bg-amber-50 text-amber-700 border-amber-200",
  blue: "bg-blue-50 text-blue-700 border-blue-200",
  pink: "bg-pink-50 text-pink-700 border-pink-200",
  slate: "bg-slate-50 text-slate-700 border-slate-200",
};

function SectionHeader({ label, title, color = "brand" }) {
  return (
    <div className="flex items-baseline gap-3 mb-5 mt-2">
      <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-widest border ${SECTION_COLORS[color]}`}>
        {label}
      </span>
      <h2 className="font-cabinet font-bold text-xl text-neutral-900">{title}</h2>
    </div>
  );
}

function KPI({ label, value, sub, icon: Icon, testid, accent = "brand" }) {
  const ring = {
    brand: "bg-brand-50 border-brand-100 text-brand",
    green: "bg-green-50 border-green-100 text-green-600",
    amber: "bg-amber-50 border-amber-100 text-amber-600",
    blue: "bg-blue-50 border-blue-100 text-blue-600",
  }[accent];
  return (
    <div className="kpi-card" data-testid={testid}>
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

function Card({ title, subtitle, children, testid, className = "" }) {
  return (
    <div className={`chart-card ${className}`} data-testid={testid}>
      <div className="mb-4 pb-3 border-b border-neutral-100">
        <div className="font-cabinet font-bold text-base text-neutral-900">{title}</div>
        {subtitle && <div className="text-[11px] text-neutral-500 mt-0.5 font-semibold">{subtitle}</div>}
      </div>
      {children}
    </div>
  );
}

export default function Dashboard() {
  const { user } = useAuth();
  const [data, setData] = useState(null);
  const [overview, setOverview] = useState(null);
  const [alerts, setAlerts] = useState([]);
  const [empresas, setEmpresas] = useState([]);
  const [options, setOptions] = useState({ placas: [], semanas: [], estaciones: [], productos: [] });
  const [filters, setFilters] = useState({ empresa: "", placa: "", semana: "", estacion: "", producto: "" });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (user?.role === "admin_enered") api.get("/empresas").then((r) => setEmpresas(r.data)).catch(() => {});
    api.get("/dashboard/filter-options").then((r) => setOptions(r.data)).catch(() => {});
  }, [user]);

  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const params = Object.fromEntries(Object.entries(filters).filter(([_, v]) => v));
        const ovParams = filters.empresa ? { empresa: filters.empresa } : {};
        const [k, a, o] = await Promise.all([
          api.get("/dashboard/kpis", { params }),
          api.get("/dashboard/alerts", { params: ovParams }),
          api.get("/dashboard/overview", { params: ovParams }),
        ]);
        setData(k.data);
        setAlerts(a.data);
        setOverview(o.data);
      } finally {
        setLoading(false);
      }
    })();
  }, [filters]);

  const activeFiltersCount = useMemo(() => Object.values(filters).filter(Boolean).length, [filters]);

  if (loading || !data) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="w-10 h-10 border-4 border-brand border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const t = data.totals;
  const productosPie = data.consumo_producto.map((p) => ({ name: p.producto, value: p.galones }));
  const medioPie = data.medio_identificacion.map((m) => ({ name: m.medio, value: m.cargas }));

  return (
    <div className="space-y-8">
      {/* Header + título */}
      <div>
        <div className="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-4 mb-4">
          <div>
            <div className="text-[11px] font-bold uppercase tracking-widest text-brand mb-2">Panel operativo</div>
            <h1 className="font-cabinet font-black text-3xl md:text-4xl text-neutral-900">Resumen de consumo</h1>
            <p className="text-neutral-500 mt-1 text-sm">Decisiones claras a partir de cada carga de combustible.</p>
          </div>
          {user?.role === "admin_enered" && empresas.length > 0 && (
            <select
              value={filters.empresa}
              onChange={(e) => setFilters({ ...filters, empresa: e.target.value })}
              className="h-11 px-3 border border-border rounded-md bg-white text-sm font-semibold min-w-[220px]"
              data-testid="empresa-filter"
            >
              <option value="">Todas las empresas</option>
              {empresas.map((e) => <option key={e} value={e}>{e}</option>)}
            </select>
          )}
        </div>
      </div>

      {/* ========== OVERVIEW (Estado General + Línea Crédito + Ahorro) ========== */}
      {overview && <OverviewSection overview={overview} alerts={alerts} />}

      {/* Filtros globales (movidos después del overview) */}
      <div className="bg-white border border-border rounded-lg p-3 md:p-4 flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-2 text-xs font-bold text-neutral-600 uppercase tracking-wider">
          <Filter className="w-4 h-4" /> Filtros
        </div>
        <select value={filters.placa} onChange={(e) => setFilters({ ...filters, placa: e.target.value })}
          className="h-10 px-3 border border-border rounded-md bg-white text-sm font-semibold min-w-[140px]" data-testid="filter-placa">
          <option value="">Placa</option>
          {options.placas.map((v) => <option key={v}>{v}</option>)}
        </select>
        <select value={filters.semana} onChange={(e) => setFilters({ ...filters, semana: e.target.value })}
          className="h-10 px-3 border border-border rounded-md bg-white text-sm font-semibold min-w-[140px]" data-testid="filter-semana">
          <option value="">Semana</option>
          {options.semanas.map((v) => <option key={v}>{v}</option>)}
        </select>
        <select value={filters.estacion} onChange={(e) => setFilters({ ...filters, estacion: e.target.value })}
          className="h-10 px-3 border border-border rounded-md bg-white text-sm font-semibold min-w-[180px]" data-testid="filter-estacion">
          <option value="">Estación</option>
          {options.estaciones.map((v) => <option key={v}>{v}</option>)}
        </select>
        <select value={filters.producto} onChange={(e) => setFilters({ ...filters, producto: e.target.value })}
          className="h-10 px-3 border border-border rounded-md bg-white text-sm font-semibold min-w-[160px]" data-testid="filter-producto">
          <option value="">Producto</option>
          {options.productos.map((v) => <option key={v}>{v}</option>)}
        </select>
        {activeFiltersCount > 0 && (
          <button
            onClick={() => setFilters({ empresa: filters.empresa, placa: "", semana: "", estacion: "", producto: "" })}
            className="h-10 px-3 border border-border rounded-md text-xs font-bold flex items-center gap-1 hover:bg-neutral-50"
            data-testid="filter-clear"
          >
            <X className="w-3 h-3" /> Limpiar ({activeFiltersCount})
          </button>
        )}
      </div>


      {/* ========== CONSUMO ========== */}
      <SectionHeader label="1 · Consumo" title="Volumen operativo" color="brand" />
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 md:gap-5">
        <KPI label="Consumo total" value={`${formatNumber(t.total_gal, 2)} gal`} icon={Fuel} testid="kpi-total-gal" />
        <KPI label="Nº cargas" value={formatNumber(t.cargas, 0)} icon={Package} testid="kpi-cargas" />
        <KPI label="Gal / carga" value={formatNumber(t.gal_por_carga, 2)} sub="promedio" icon={Droplets} accent="blue" />
        <KPI label="Ticket prom." value={formatSoles(t.ticket_prom)} sub="S/ por carga" icon={Receipt} accent="amber" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <Card title="Consumo en el tiempo" subtitle="Galones por semana" testid="chart-consumo-tiempo">
          <ResponsiveContainer width="100%" height={280}>
            <LineChart data={data.series_semana} margin={{ top: 10, right: 20, left: 0, bottom: 10 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis dataKey="semana" tick={{ fontSize: 10, fontWeight: 700 }} stroke="#525252" />
              <YAxis tick={{ fontSize: 11 }} stroke="#a3a3a3" />
              <Tooltip contentStyle={{ borderRadius: 8, fontSize: 12 }} formatter={(v) => `${formatNumber(v, 2)} gal`} />
              <Line type="monotone" dataKey="consumo" stroke="#9933FF" strokeWidth={3} dot={{ r: 3 }} name="Galones" />
            </LineChart>
          </ResponsiveContainer>
        </Card>

        <Card title="Top 5 placas por consumo" subtitle="Galones · unidades a revisar" testid="chart-top-placas">
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={data.top_placas_consumo} layout="vertical" margin={{ top: 5, right: 20, left: 10, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" horizontal={false} />
              <XAxis type="number" tick={{ fontSize: 11 }} stroke="#a3a3a3" />
              <YAxis type="category" dataKey="placa" tick={{ fontSize: 12, fontWeight: 700 }} width={80} stroke="#525252" />
              <Tooltip formatter={(v) => `${formatNumber(v, 2)} gal`} contentStyle={{ borderRadius: 8, fontSize: 12 }} />
              <Bar dataKey="galones" fill="#9933FF" radius={[0, 4, 4, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <Card title="Consumo por ciudad" subtitle="Galones · zonas críticas" testid="chart-ciudad">
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={data.consumo_ciudad} margin={{ top: 5, right: 10, left: 0, bottom: 40 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" vertical={false} />
              <XAxis dataKey="ciudad" tick={{ fontSize: 10, fontWeight: 700 }} stroke="#525252" angle={-30} textAnchor="end" height={55} />
              <YAxis tick={{ fontSize: 11 }} stroke="#a3a3a3" />
              <Tooltip formatter={(v) => `${formatNumber(v, 2)} gal`} contentStyle={{ borderRadius: 8, fontSize: 12 }} />
              <Bar dataKey="galones" fill="#9933FF" radius={[6, 6, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </Card>

        <Card title="Consumo por estación" subtitle="Top 10 · dependencia operativa" testid="chart-estacion-consumo">
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={data.consumo_estacion} layout="vertical" margin={{ top: 5, right: 20, left: 10, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" horizontal={false} />
              <XAxis type="number" tick={{ fontSize: 10 }} stroke="#a3a3a3" />
              <YAxis type="category" dataKey="estacion" tick={{ fontSize: 10, fontWeight: 700 }} width={140} stroke="#525252" />
              <Tooltip formatter={(v) => `${formatNumber(v, 2)} gal`} contentStyle={{ borderRadius: 8, fontSize: 12 }} />
              <Bar dataKey="galones" fill="#9933FF" radius={[0, 4, 4, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </Card>
      </div>

      {/* ========== GASTO ========== */}
      <SectionHeader label="2 · Gasto" title="Control financiero" color="amber" />
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 md:gap-5">
        <KPI label="Gasto total" value={formatSoles(t.total_gasto)} icon={DollarSign} accent="amber" testid="kpi-total-gasto" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <Card title="Gasto en el tiempo" subtitle="S/ por semana" testid="chart-gasto-tiempo">
          <ResponsiveContainer width="100%" height={280}>
            <LineChart data={data.series_semana} margin={{ top: 10, right: 20, left: 0, bottom: 10 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis dataKey="semana" tick={{ fontSize: 10, fontWeight: 700 }} stroke="#525252" />
              <YAxis tick={{ fontSize: 11 }} stroke="#a3a3a3" />
              <Tooltip contentStyle={{ borderRadius: 8, fontSize: 12 }} formatter={(v) => formatSoles(v)} />
              <Line type="monotone" dataKey="gasto" stroke="#F59E0B" strokeWidth={3} dot={{ r: 3 }} name="S/" />
            </LineChart>
          </ResponsiveContainer>
        </Card>

        <Card title="Gasto por placa" subtitle="Top 10 unidades más costosas" testid="chart-gasto-placa">
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={data.gasto_placa} layout="vertical" margin={{ top: 5, right: 20, left: 10, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" horizontal={false} />
              <XAxis type="number" tick={{ fontSize: 10 }} stroke="#a3a3a3" />
              <YAxis type="category" dataKey="placa" tick={{ fontSize: 11, fontWeight: 700 }} width={80} stroke="#525252" />
              <Tooltip formatter={(v) => formatSoles(v)} contentStyle={{ borderRadius: 8, fontSize: 12 }} />
              <Bar dataKey="gasto" fill="#F59E0B" radius={[0, 4, 4, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </Card>
      </div>

      {/* ========== AHORRO ========== */}
      <SectionHeader label="3 · Ahorro" title="El diferencial ENERED" color="green" />
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 md:gap-5">
        <KPI label="Ahorro total" value={formatSoles(t.total_ahorro)} icon={TrendingDown} accent="green" testid="kpi-total-ahorro" />
        <KPI label="Ahorro %" value={`${t.ahorro_pct}%`} sub="vs precio pizarra" icon={Coins} accent="green" />
        <KPI label="Precio ENERED" value={`S/ ${t.precio_enered}`} sub="prom ponderado" icon={Fuel} accent="brand" />
        <KPI label="Precio pizarra" value={`S/ ${t.precio_pizarra}`} sub="de referencia" icon={Fuel} accent="amber" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <Card title="Ahorro en el tiempo" subtitle="S/ por semana · valor entregado" testid="chart-ahorro-tiempo">
          <ResponsiveContainer width="100%" height={280}>
            <LineChart data={data.series_semana} margin={{ top: 10, right: 20, left: 0, bottom: 10 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis dataKey="semana" tick={{ fontSize: 10, fontWeight: 700 }} stroke="#525252" />
              <YAxis tick={{ fontSize: 11 }} stroke="#a3a3a3" />
              <Tooltip contentStyle={{ borderRadius: 8, fontSize: 12 }} formatter={(v) => formatSoles(v)} />
              <Line type="monotone" dataKey="ahorro" stroke="#16A34A" strokeWidth={3} dot={{ r: 3 }} name="Ahorro S/" />
            </LineChart>
          </ResponsiveContainer>
        </Card>

        <Card title="Ahorro por estación" subtitle="Top 10 · dónde conviene cargar" testid="chart-ahorro-estacion">
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={data.ahorro_estacion} layout="vertical" margin={{ top: 5, right: 20, left: 10, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" horizontal={false} />
              <XAxis type="number" tick={{ fontSize: 10 }} stroke="#a3a3a3" />
              <YAxis type="category" dataKey="estacion" tick={{ fontSize: 10, fontWeight: 700 }} width={140} stroke="#525252" />
              <Tooltip formatter={(v) => formatSoles(v)} contentStyle={{ borderRadius: 8, fontSize: 12 }} />
              <Bar dataKey="ahorro" fill="#16A34A" radius={[0, 4, 4, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </Card>
      </div>

      <Card title="Precio ENERED vs Pizarra" subtitle="Comparación por tipo de combustible · ahorro visible" testid="chart-precio-comparacion">
        <ResponsiveContainer width="100%" height={300}>
          <BarChart data={data.precio_comparacion_producto} margin={{ top: 10, right: 20, left: 0, bottom: 10 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" vertical={false} />
            <XAxis dataKey="producto" tick={{ fontSize: 11, fontWeight: 700 }} stroke="#525252" />
            <YAxis tick={{ fontSize: 11 }} stroke="#a3a3a3" domain={["auto", "auto"]} />
            <Tooltip formatter={(v) => `S/ ${v}`} contentStyle={{ borderRadius: 8, fontSize: 12 }} />
            <Legend wrapperStyle={{ fontSize: 12, fontWeight: 600 }} />
            <Bar dataKey="pizarra" fill="#F59E0B" radius={[4, 4, 0, 0]} name="Precio Pizarra" />
            <Bar dataKey="enered" fill="#9933FF" radius={[4, 4, 0, 0]} name="Precio ENERED" />
          </BarChart>
        </ResponsiveContainer>
      </Card>

      {/* ========== OPERATIVOS ========== */}
      <SectionHeader label="4 · Operativos" title="Eficiencia del abastecimiento" color="blue" />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <Card title="Cargas en el tiempo" subtitle="Frecuencia de abastecimiento por semana" testid="chart-cargas-tiempo">
          <ResponsiveContainer width="100%" height={260}>
            <LineChart data={data.series_semana} margin={{ top: 10, right: 20, left: 0, bottom: 10 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis dataKey="semana" tick={{ fontSize: 10, fontWeight: 700 }} stroke="#525252" />
              <YAxis tick={{ fontSize: 11 }} stroke="#a3a3a3" allowDecimals={false} />
              <Tooltip contentStyle={{ borderRadius: 8, fontSize: 12 }} />
              <Line type="monotone" dataKey="cargas" stroke="#3B82F6" strokeWidth={3} dot={{ r: 3 }} name="Cargas" />
            </LineChart>
          </ResponsiveContainer>
        </Card>

        <Card title="Cargas por placa" subtitle="Top 10 · unidades que cargan demasiado" testid="chart-cargas-placa">
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={data.cargas_placa} layout="vertical" margin={{ top: 5, right: 20, left: 10, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" horizontal={false} />
              <XAxis type="number" tick={{ fontSize: 10 }} stroke="#a3a3a3" allowDecimals={false} />
              <YAxis type="category" dataKey="placa" tick={{ fontSize: 11, fontWeight: 700 }} width={80} stroke="#525252" />
              <Tooltip contentStyle={{ borderRadius: 8, fontSize: 12 }} />
              <Bar dataKey="cargas" fill="#3B82F6" radius={[0, 4, 4, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <Card title="Ticket promedio en el tiempo" subtitle="S/ por carga · evolución semanal" testid="chart-ticket">
          <ResponsiveContainer width="100%" height={240}>
            <LineChart data={data.series_semana} margin={{ top: 10, right: 20, left: 0, bottom: 10 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis dataKey="semana" tick={{ fontSize: 10, fontWeight: 700 }} stroke="#525252" />
              <YAxis tick={{ fontSize: 11 }} stroke="#a3a3a3" />
              <Tooltip contentStyle={{ borderRadius: 8, fontSize: 12 }} formatter={(v) => formatSoles(v)} />
              <Line type="monotone" dataKey="ticket_prom" stroke="#EC4899" strokeWidth={2.5} dot={{ r: 3 }} name="Ticket" />
            </LineChart>
          </ResponsiveContainer>
        </Card>

        <Card title="Galones promedio por carga" subtitle="Cargas pequeñas = posible ineficiencia" testid="chart-gal-carga">
          <ResponsiveContainer width="100%" height={240}>
            <LineChart data={data.series_semana} margin={{ top: 10, right: 20, left: 0, bottom: 10 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis dataKey="semana" tick={{ fontSize: 10, fontWeight: 700 }} stroke="#525252" />
              <YAxis tick={{ fontSize: 11 }} stroke="#a3a3a3" />
              <Tooltip contentStyle={{ borderRadius: 8, fontSize: 12 }} formatter={(v) => `${v} gal`} />
              <Line type="monotone" dataKey="gal_por_carga" stroke="#06B6D4" strokeWidth={2.5} dot={{ r: 3 }} name="Gal/carga" />
            </LineChart>
          </ResponsiveContainer>
        </Card>
      </div>

      {/* ========== PRODUCTO ========== */}
      <SectionHeader label="5 · Producto" title="Mezcla de combustibles" color="pink" />
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <Card title="Consumo por producto" subtitle="Galones · mix utilizado" testid="chart-producto-dona">
          <ResponsiveContainer width="100%" height={300}>
            <PieChart>
              <Pie data={productosPie} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={60} outerRadius={110} paddingAngle={2}>
                {productosPie.map((_, i) => <Cell key={i} fill={BRAND_COLORS[i % BRAND_COLORS.length]} />)}
              </Pie>
              <Tooltip formatter={(v) => `${formatNumber(v, 2)} gal`} contentStyle={{ borderRadius: 8, fontSize: 12 }} />
              <Legend wrapperStyle={{ fontSize: 12, fontWeight: 600 }} />
            </PieChart>
          </ResponsiveContainer>
        </Card>

        <Card title="Gasto por producto" subtitle="S/ · cuál pesa más en el presupuesto" testid="chart-gasto-producto">
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={data.gasto_producto} margin={{ top: 10, right: 20, left: 0, bottom: 10 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" vertical={false} />
              <XAxis dataKey="producto" tick={{ fontSize: 11, fontWeight: 700 }} stroke="#525252" />
              <YAxis tick={{ fontSize: 11 }} stroke="#a3a3a3" />
              <Tooltip formatter={(v) => formatSoles(v)} contentStyle={{ borderRadius: 8, fontSize: 12 }} />
              <Bar dataKey="gasto" fill="#EC4899" radius={[6, 6, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </Card>
      </div>

      {/* ========== COMPORTAMIENTO ========== */}
      <SectionHeader label="6 · Comportamiento" title="Patrones operativos" color="slate" />
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        <Card title="Cargas por hora" subtitle="Horarios operativos" testid="chart-cargas-hora" className="lg:col-span-2">
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={data.cargas_por_hora} margin={{ top: 10, right: 10, left: 0, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" vertical={false} />
              <XAxis dataKey="hora" tick={{ fontSize: 10, fontWeight: 700 }} stroke="#525252" />
              <YAxis tick={{ fontSize: 11 }} stroke="#a3a3a3" allowDecimals={false} />
              <Tooltip contentStyle={{ borderRadius: 8, fontSize: 12 }} />
              <Bar dataKey="cargas" fill="#9933FF" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </Card>

        <Card title="Uso QR vs otros medios" subtitle="Nivel de control" testid="chart-medio">
          <ResponsiveContainer width="100%" height={260}>
            <PieChart>
              <Pie data={medioPie} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={50} outerRadius={90} paddingAngle={2}>
                {medioPie.map((_, i) => <Cell key={i} fill={BRAND_COLORS[i % BRAND_COLORS.length]} />)}
              </Pie>
              <Tooltip contentStyle={{ borderRadius: 8, fontSize: 12 }} />
              <Legend wrapperStyle={{ fontSize: 11, fontWeight: 600 }} />
            </PieChart>
          </ResponsiveContainer>
        </Card>
      </div>

      <Card title="Cargas por día de la semana" subtitle="Identificar días críticos" testid="chart-cargas-dia">
        <ResponsiveContainer width="100%" height={240}>
          <BarChart data={data.cargas_por_dia} margin={{ top: 10, right: 20, left: 0, bottom: 10 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" vertical={false} />
            <XAxis dataKey="dia" tick={{ fontSize: 12, fontWeight: 700 }} stroke="#525252" />
            <YAxis tick={{ fontSize: 11 }} stroke="#a3a3a3" allowDecimals={false} />
            <Tooltip contentStyle={{ borderRadius: 8, fontSize: 12 }} />
            <Bar dataKey="cargas" fill="#9933FF" radius={[6, 6, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </Card>

      {/* ========== ALERTAS (movidas a Estado General arriba) ========== */}
    </div>
  );
}
