import React, { useEffect, useMemo, useState } from "react";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid, ResponsiveContainer, LineChart, Line, Legend,
} from "recharts";
import {
  AlertTriangle, CheckCircle2, AlertCircle, Coins, TrendingDown,
  Truck, Fuel as FuelIcon, Building2, ArrowUpRight, XCircle, Clock, Filter, X,
} from "lucide-react";
import { api } from "../lib/api";
import { formatSoles, formatNumber } from "../lib/utils";
import { useAuth } from "../context/AuthContext";

const MAPS_LINK = "https://maps.app.goo.gl/LZpyBqYs54LazZtV7";

/* ---------------- Overview ---------------- */
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

        {/* Línea de Crédito + Ahorro/Consumo (en una sola card destacada) */}
        <div className="lg:col-span-5 rounded-2xl p-6 text-white relative overflow-hidden" style={{ background: "linear-gradient(135deg, #9933FF 0%, #6B23B1 100%)" }} data-testid="linea-credito">
          <div className="flex items-center gap-2.5 mb-5">
            <Coins className="w-6 h-6" />
            <h3 className="font-cabinet font-bold text-lg">Línea de Crédito</h3>
          </div>

          <div className="grid grid-cols-3 gap-3 mb-4">
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

          <div className="h-2 bg-white/15 rounded-full overflow-hidden mb-4">
            <div className="h-full rounded-full bg-amber-300 transition-all" style={{ width: `${Math.min(100, pctUsado)}%` }} />
          </div>

          <div className="border-t border-white/20 pt-4 grid grid-cols-2 gap-4">
            <div>
              <div className="text-[11px] uppercase tracking-widest text-cyan-300 font-bold mb-1">Ahorro</div>
              <div className="font-cabinet font-black text-lg lg:text-xl leading-tight text-cyan-200">{formatSoles(ahorro.soles)}</div>
              <div className="text-xs text-white/70 font-bold">{formatNumber(ahorro.galones, 0)} GAL</div>
            </div>
            <div>
              <div className="text-[11px] uppercase tracking-widest text-white/70 font-bold mb-1">Consumo</div>
              <div className="font-cabinet font-black text-lg lg:text-xl leading-tight">{formatSoles(consumo.soles)}</div>
              <div className="text-xs text-white/70 font-bold">{formatNumber(consumo.galones, 0)} GAL</div>
            </div>
          </div>
        </div>

        {/* Mini KPIs (Ticket / Carga / Precio + Unidades / Cargas / Red) - 2 columnas x 3 filas */}
        <div className="lg:col-span-3 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-2 gap-3 auto-rows-fr">
          <MiniMetric label="Ticket" value={formatSoles(promedios.ticket)} testid="mini-ticket" small />
          <MiniMetric label="Unidades" value={formatNumber(unidades_contratadas, 0)} icon={Truck} testid="mini-unidades" white small />
          <MiniMetric label="Carga" value={`${formatNumber(promedios.carga_gal, 0)} GAL`} testid="mini-carga" small />
          <MiniMetric label="Cargas" value={formatNumber(cargas, 0)} icon={FuelIcon} testid="mini-cargas" white small />
          <MiniMetric label="Precio" value={`S/${formatNumber(promedios.precio, 2)}`} testid="mini-precio" small />
          <MiniMetric label="Red" value={formatNumber(red_estaciones, 0)} icon={Building2} cyan onClick={() => window.open(MAPS_LINK, "_blank")} testid="mini-red" small />
        </div>
      </div>
    </div>
  );
}

function MiniMetric({ label, value, icon: Icon, cyan = false, white = false, onClick, testid, small = false }) {
  const base = "rounded-xl p-4 flex flex-col justify-between transition-all";
  const minH = small ? "min-h-[80px]" : "min-h-[100px]";
  const cls = cyan
    ? "bg-cyan-300 text-[#1e1b4b] border border-cyan-300 hover:bg-cyan-400 hover:-translate-y-0.5 cursor-pointer"
    : white
    ? "bg-white text-[#1e1b4b] border border-neutral-200"
    : "bg-[#2B1C4A] text-white border border-[#2B1C4A]";
  const Wrapper = onClick ? "button" : "div";
  return (
    <Wrapper onClick={onClick} data-testid={testid} className={`${base} ${minH} ${cls} ${onClick ? "text-left" : ""}`}>
      <div className="flex items-center justify-between">
        <div className={`text-[11px] uppercase tracking-widest font-bold ${cyan ? "text-[#1e1b4b]/70" : white ? "text-neutral-500" : "text-white/60"}`}>{label}</div>
        {Icon && <Icon className={`w-4 h-4 ${cyan ? "text-[#1e1b4b]/70" : white ? "text-neutral-400" : "text-white/50"}`} />}
      </div>
      <div className={`font-cabinet font-black leading-tight mt-1 ${small ? "text-xl" : "text-2xl"}`}>{value}</div>
      {cyan && onClick && <div className="text-[10px] font-bold text-[#1e1b4b]/70 mt-1 flex items-center gap-0.5">Cobertura <ArrowUpRight className="w-3 h-3" /></div>}
    </Wrapper>
  );
}

/* ---------------- Toggle Galones / Soles ---------------- */
function UnitToggle({ units, setUnits }) {
  const isOn = (k) => units.includes(k);
  const toggle = (k) => {
    if (isOn(k)) {
      // No permitir quitar el último activo
      if (units.length === 1) return;
      setUnits(units.filter((u) => u !== k));
    } else {
      setUnits([...units, k]);
    }
  };
  const baseBtn = "px-3 py-1 rounded-full text-[11px] font-bold uppercase tracking-wider transition-all";
  return (
    <div className="flex items-center gap-1.5 bg-neutral-100 rounded-full p-0.5" data-testid="unit-toggle">
      <button
        type="button"
        onClick={() => toggle("galones")}
        data-testid="toggle-galones"
        className={`${baseBtn} ${isOn("galones") ? "bg-fuchsia-500 text-white shadow-sm" : "text-neutral-500 hover:text-neutral-700"}`}
      >
        Galones
      </button>
      <button
        type="button"
        onClick={() => toggle("soles")}
        data-testid="toggle-soles"
        className={`${baseBtn} ${isOn("soles") ? "bg-fuchsia-500 text-white shadow-sm" : "text-neutral-500 hover:text-neutral-700"}`}
      >
        Soles
      </button>
    </div>
  );
}

/* ---------------- Card chart wrapper ---------------- */
function ChartCard({ title, subtitle, units, setUnits, children, testid }) {
  return (
    <div className="chart-card" data-testid={testid}>
      <div className="mb-4 pb-3 border-b border-neutral-100 flex items-start justify-between gap-3">
        <div>
          <div className="font-cabinet font-bold text-base text-neutral-900">{title}</div>
          {subtitle && <div className="text-[11px] text-neutral-500 mt-0.5 font-semibold">{subtitle}</div>}
        </div>
        <UnitToggle units={units} setUnits={setUnits} />
      </div>
      {children}
    </div>
  );
}

/* ---------------- Helpers para combinar series ---------------- */
const G_COLOR = "#9933FF";
const S_COLOR = "#10B981"; // verde-cyan, similar al mockup

const fmtVal = (v, k) => k === "soles" ? formatSoles(v) : `${formatNumber(v, 2)} gal`;

export default function Dashboard() {
  const { user } = useAuth();
  const [data, setData] = useState(null);
  const [overview, setOverview] = useState(null);
  const [alerts, setAlerts] = useState([]);
  const [empresas, setEmpresas] = useState([]);
  const [options, setOptions] = useState({ placas: [], semanas: [], estaciones: [], productos: [] });
  const [filters, setFilters] = useState({ empresa: "", placa: "", semana: "", estacion: "", producto: "" });
  const [loading, setLoading] = useState(true);

  // Toggles independientes por gráfico
  const [unitsTiempo, setUnitsTiempo] = useState(["galones"]);
  const [unitsPlacas, setUnitsPlacas] = useState(["galones"]);
  const [unitsCiudad, setUnitsCiudad] = useState(["galones"]);
  const [unitsEstacion, setUnitsEstacion] = useState(["galones"]);

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

  // Series para el gráfico "Consumo en el tiempo": ya viene con consumo (gal) y gasto (S/)
  const tiempoData = data.series_semana.map((d) => ({
    semana: d.semana,
    galones: d.consumo,
    soles: d.gasto,
  }));

  // Top 5 placas: re-uso top_placas_consumo (gal) + gasto_placa (S/)
  const placasMap = {};
  (data.top_placas_consumo || []).forEach((p) => { placasMap[p.placa] = { placa: p.placa, galones: p.galones, soles: 0 }; });
  (data.gasto_placa || []).forEach((p) => {
    if (placasMap[p.placa]) placasMap[p.placa].soles = p.gasto;
    else placasMap[p.placa] = { placa: p.placa, galones: 0, soles: p.gasto };
  });
  const placasData = Object.values(placasMap)
    .sort((a, b) => (b.galones + b.soles) - (a.galones + a.soles))
    .slice(0, 5);

  // Consumo por ciudad (gal). Backend solo trae galones; calculamos soles por proporción si no hay
  const ciudadData = (data.consumo_ciudad || []).map((c) => ({
    ciudad: c.ciudad,
    galones: c.galones,
    soles: c.gasto || c.soles || (c.galones * (data.totals?.precio_enered || 0)),
  }));

  // Consumo por estación (gal). Igual que arriba
  const estacionData = (data.consumo_estacion || []).map((e) => ({
    estacion: e.estacion,
    galones: e.galones,
    soles: e.gasto || e.soles || (e.galones * (data.totals?.precio_enered || 0)),
  }));

  return (
    <div className="space-y-8">
      {/* Header — empresa filter only (admin) */}
      {user?.role === "admin_enered" && empresas.length > 0 && (
        <div className="flex justify-end">
          <select
            value={filters.empresa}
            onChange={(e) => setFilters({ ...filters, empresa: e.target.value })}
            className="h-11 px-3 border border-border rounded-md bg-white text-sm font-semibold min-w-[220px]"
            data-testid="empresa-filter"
          >
            <option value="">Todas las empresas</option>
            {empresas.map((e) => <option key={e} value={e}>{e}</option>)}
          </select>
        </div>
      )}

      {/* Overview */}
      {overview && <OverviewSection overview={overview} alerts={alerts} />}

      {/* Filtros */}
      <div className="bg-white border border-border rounded-2xl p-3 md:p-4 flex flex-wrap items-center gap-3">
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

      {/* ============== 4 GRÁFICOS PRINCIPALES ============== */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* 1. Consumo en el tiempo */}
        <ChartCard title="Consumo en el tiempo" subtitle="Por semana" units={unitsTiempo} setUnits={setUnitsTiempo} testid="chart-consumo-tiempo">
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={tiempoData} margin={{ top: 10, right: 20, left: 0, bottom: 10 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis dataKey="semana" tick={{ fontSize: 10, fontWeight: 700 }} stroke="#525252" />
              <YAxis yAxisId="left" tick={{ fontSize: 10 }} stroke="#a3a3a3" />
              {unitsTiempo.includes("soles") && unitsTiempo.includes("galones") && (
                <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 10 }} stroke="#a3a3a3" />
              )}
              <Tooltip
                contentStyle={{ borderRadius: 8, fontSize: 12 }}
                formatter={(v, name) => [fmtVal(v, name === "Galones" ? "galones" : "soles"), name]}
              />
              <Legend wrapperStyle={{ fontSize: 11, fontWeight: 600 }} />
              {unitsTiempo.includes("galones") && (
                <Line yAxisId="left" type="monotone" dataKey="galones" stroke={G_COLOR} strokeWidth={3} dot={{ r: 3 }} name="Galones" />
              )}
              {unitsTiempo.includes("soles") && (
                <Line
                  yAxisId={unitsTiempo.includes("galones") ? "right" : "left"}
                  type="monotone" dataKey="soles" stroke={S_COLOR} strokeWidth={3} dot={{ r: 3 }} name="Soles"
                />
              )}
            </LineChart>
          </ResponsiveContainer>
        </ChartCard>

        {/* 2. Top 5 placas por consumo */}
        <ChartCard title="Top 5 placas por consumo" subtitle="Unidades a revisar" units={unitsPlacas} setUnits={setUnitsPlacas} testid="chart-top-placas">
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={placasData} layout="vertical" margin={{ top: 5, right: 20, left: 10, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" horizontal={false} />
              <XAxis type="number" tick={{ fontSize: 11 }} stroke="#a3a3a3" />
              <YAxis type="category" dataKey="placa" tick={{ fontSize: 12, fontWeight: 700 }} width={80} stroke="#525252" />
              <Tooltip formatter={(v, name) => [fmtVal(v, name === "Galones" ? "galones" : "soles"), name]} contentStyle={{ borderRadius: 8, fontSize: 12 }} />
              <Legend wrapperStyle={{ fontSize: 11, fontWeight: 600 }} />
              {unitsPlacas.includes("galones") && (
                <Bar dataKey="galones" fill={G_COLOR} radius={[0, 4, 4, 0]} name="Galones" />
              )}
              {unitsPlacas.includes("soles") && (
                <Bar dataKey="soles" fill={S_COLOR} radius={[0, 4, 4, 0]} name="Soles" />
              )}
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>

        {/* 3. Consumo por ciudad */}
        <ChartCard title="Consumo por ciudad" subtitle="Zonas críticas" units={unitsCiudad} setUnits={setUnitsCiudad} testid="chart-ciudad">
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={ciudadData} margin={{ top: 5, right: 10, left: 0, bottom: 50 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" vertical={false} />
              <XAxis dataKey="ciudad" tick={{ fontSize: 10, fontWeight: 700 }} stroke="#525252" angle={-30} textAnchor="end" height={55} />
              <YAxis tick={{ fontSize: 11 }} stroke="#a3a3a3" />
              <Tooltip formatter={(v, name) => [fmtVal(v, name === "Galones" ? "galones" : "soles"), name]} contentStyle={{ borderRadius: 8, fontSize: 12 }} />
              <Legend wrapperStyle={{ fontSize: 11, fontWeight: 600 }} />
              {unitsCiudad.includes("galones") && (
                <Bar dataKey="galones" fill={G_COLOR} radius={[6, 6, 0, 0]} name="Galones" />
              )}
              {unitsCiudad.includes("soles") && (
                <Bar dataKey="soles" fill={S_COLOR} radius={[6, 6, 0, 0]} name="Soles" />
              )}
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>

        {/* 4. Consumo por estación */}
        <ChartCard title="Consumo por estación" subtitle="Top 10 dependencia operativa" units={unitsEstacion} setUnits={setUnitsEstacion} testid="chart-estacion-consumo">
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={estacionData} layout="vertical" margin={{ top: 5, right: 20, left: 10, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" horizontal={false} />
              <XAxis type="number" tick={{ fontSize: 10 }} stroke="#a3a3a3" />
              <YAxis type="category" dataKey="estacion" tick={{ fontSize: 10, fontWeight: 700 }} width={140} stroke="#525252" />
              <Tooltip formatter={(v, name) => [fmtVal(v, name === "Galones" ? "galones" : "soles"), name]} contentStyle={{ borderRadius: 8, fontSize: 12 }} />
              <Legend wrapperStyle={{ fontSize: 11, fontWeight: 600 }} />
              {unitsEstacion.includes("galones") && (
                <Bar dataKey="galones" fill={G_COLOR} radius={[0, 4, 4, 0]} name="Galones" />
              )}
              {unitsEstacion.includes("soles") && (
                <Bar dataKey="soles" fill={S_COLOR} radius={[0, 4, 4, 0]} name="Soles" />
              )}
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>
      </div>
    </div>
  );
}
