import React, { useEffect, useMemo, useState } from "react";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid, ResponsiveContainer,
  AreaChart, Area, PieChart, Pie, Cell,
} from "recharts";
import {
  Siren, Truck, Fuel, CreditCard, Droplet, Banknote, MapPin,
  Activity, TrendingUp, Gauge, Calendar, Wrench, FileText, Users,
  Filter, X, Clock, Info, ChevronRight, Lock, Sparkles,
} from "lucide-react";
import { api } from "../lib/api";
import { formatSoles, formatNumber } from "../lib/utils";
import { useAuth } from "../context/AuthContext";
import TrackerSubsidio from "../components/TrackerSubsidio";

const MAPS_LINK = "https://maps.app.goo.gl/LZpyBqYs54LazZtV7";
const UPGRADE_WA = "https://wa.me/51900000000?text=Hola%2C%20quiero%20mejorar%20mi%20plan%20ENERED";

/* ============================================================
   Locked KPI Card — blurred data + small "Mejorar Plan" overlay + Premium tooltip on hover
   ============================================================ */
function LockedKpiCard({ icon: Icon, label, value, subtitle, tooltip, testid }) {
  const openUpgrade = () => window.open(UPGRADE_WA, "_blank", "noopener,noreferrer");
  return (
    <div className="group relative" data-testid={testid}>
      <div className="bg-white border border-neutral-200 border-l-4 border-l-brand rounded-2xl px-3.5 py-3 flex flex-col justify-between min-h-[120px] w-full transition-all hover:shadow-lg hover:-translate-y-0.5 overflow-hidden">
        {/* Header (label + icon) — always crisp */}
        <div className="flex items-start justify-between gap-2 relative z-10">
          <div className="text-[10.5px] font-bold uppercase tracking-wider text-neutral-500 leading-tight line-clamp-2">
            {label}
          </div>
          {Icon && <Icon className="w-4 h-4 flex-shrink-0 text-brand-300" strokeWidth={2} />}
        </div>

        {/* Blurred data behind */}
        <div className="relative flex-1 flex flex-col justify-end">
          <div className="select-none pointer-events-none" style={{ filter: "blur(3.5px)", opacity: 0.9 }}>
            <div className="font-cabinet font-black text-2xl leading-none text-neutral-900">{value}</div>
            <div className="text-[10.5px] font-semibold text-neutral-500 mt-1">{subtitle}</div>
          </div>

          {/* Small overlay button - centered */}
          <div className="absolute inset-0 flex items-center justify-center">
            <button
              onClick={openUpgrade}
              className="h-7 px-2.5 rounded-full bg-brand text-white text-[10px] font-black hover:bg-brand-hover transition-colors shadow-md flex items-center gap-1"
            >
              <Lock className="w-3 h-3" strokeWidth={2.5} />
              Mejorar Plan
            </button>
          </div>
        </div>
      </div>

      {/* Tooltip on hover — Premium Plus style */}
      <div className="absolute left-1/2 -translate-x-1/2 top-full mt-2 w-[260px] z-50 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all pointer-events-none">
        <div className="relative bg-white border-2 border-brand-100 rounded-xl px-4 py-3 shadow-xl">
          <div className="absolute -top-1.5 left-1/2 -translate-x-1/2 w-3 h-3 bg-white border-l-2 border-t-2 border-brand-100 rotate-45" />
          <div className="flex items-center gap-1.5 mb-1.5">
            <Sparkles className="w-3.5 h-3.5 text-brand" strokeWidth={2.5} />
            <span className="text-xs font-black text-brand uppercase tracking-wide">Premium Plus</span>
          </div>
          <div className="text-[11px] font-medium leading-relaxed text-neutral-700">
            {tooltip}
          </div>
        </div>
      </div>
    </div>
  );
}

/* ============================================================
   ROW 1 — Mini KPI Card (8 cards, single row)
   ============================================================ */
function MiniKpiCard({
  icon: Icon,
  label,
  value,
  subtitle,
  borderColor,         // left border color
  valueColor,          // big number color
  subtitleColor,       // subtitle color
  iconColor,           // icon color (text class)
  bgColor = "bg-white",
  disabled = false,    // greyed/coming-soon
  onClick,
  testid,
}) {
  const Wrapper = onClick && !disabled ? "button" : "div";
  return (
    <div className="relative">
      <Wrapper
        onClick={!disabled ? onClick : undefined}
        data-testid={testid}
        className={`${bgColor} ${borderColor ? `border-l-4 ${borderColor}` : ""} border border-neutral-200 rounded-2xl px-3.5 py-3 flex flex-col justify-between min-h-[120px] w-full transition-all ${
          disabled ? "opacity-40 pointer-events-none select-none" : onClick ? "hover:shadow-md hover:-translate-y-0.5 cursor-pointer text-left" : ""
        }`}
      >
        <div className="flex items-start justify-between gap-2">
          <div className={`text-[10.5px] font-bold uppercase tracking-wider ${subtitleColor || "text-neutral-600"} leading-tight line-clamp-2`}>
            {label}
          </div>
          {Icon && <Icon className={`w-4 h-4 flex-shrink-0 ${iconColor || "text-neutral-400"}`} strokeWidth={2} />}
        </div>
        <div className={`font-cabinet font-black text-2xl leading-none mt-1 ${valueColor || "text-neutral-900"}`}>
          {value}
        </div>
        <div className={`text-[10.5px] font-semibold mt-1 ${subtitleColor || "text-neutral-500"} flex items-center gap-1`}>
          {subtitle}
        </div>
      </Wrapper>
      {disabled && (
        <div className="absolute top-1.5 right-1.5 px-1.5 py-0.5 rounded-full bg-neutral-200 text-neutral-600 text-[8px] font-black uppercase tracking-wider">
          Próx.
        </div>
      )}
    </div>
  );
}

/* ============================================================
   ROW 2 — Large cards with donuts
   ============================================================ */
function CardHeader({ icon: Icon, title, badge, badgeColor = "brand" }) {
  return (
    <div className="flex items-center justify-between mb-3">
      <div className="flex items-center gap-2">
        <div className="w-7 h-7 rounded-lg bg-brand-50 flex items-center justify-center">
          {Icon && <Icon className="w-4 h-4 text-brand" strokeWidth={2} />}
        </div>
        <h3 className="font-cabinet font-bold text-sm text-neutral-800">{title}</h3>
      </div>
      {badge && (
        <span className={`px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider ${
          badgeColor === "brand" ? "bg-brand text-white" : "bg-amber-400 text-amber-900"
        }`}>
          {badge}
        </span>
      )}
      {!badge && <Info className="w-3.5 h-3.5 text-neutral-300" />}
    </div>
  );
}

function LineaCreditoCard({ linea_credito }) {
  const total = linea_credito?.total || 0;
  const utilizada = linea_credito?.utilizada || 0;
  const disponible = linea_credito?.disponible || 0;
  const hasData = total > 0;
  const data = hasData
    ? [
        { name: "Utilizada", value: utilizada, color: "#8039F4" },
        { name: "Disponible", value: disponible, color: "#22D3EE" },
      ]
    : [{ name: "Sin línea", value: 1, color: "#F3F4F6" }];

  return (
    <div className="bg-white border border-neutral-200 rounded-2xl p-5 flex flex-col min-h-[280px]" data-testid="card-linea-credito">
      <CardHeader icon={CreditCard} title="Línea de crédito" />
      <div className="flex-1 flex items-center justify-center">
        <div className="relative w-[180px] h-[180px]">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={data}
                cx="50%" cy="50%"
                innerRadius={62} outerRadius={86}
                startAngle={90} endAngle={-270}
                dataKey="value"
                stroke="#fff"
                strokeWidth={2}
                paddingAngle={hasData ? 2 : 0}
                isAnimationActive={false}
              >
                {data.map((entry, idx) => (
                  <Cell key={`cell-${idx}`} fill={entry.color} />
                ))}
              </Pie>
            </PieChart>
          </ResponsiveContainer>
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <div className="text-[9px] font-bold uppercase tracking-wider text-neutral-400 leading-none">Línea total</div>
            <div className="font-cabinet font-black text-xl text-neutral-900 leading-none mt-1.5">{formatSoles(total)}</div>
          </div>
        </div>
      </div>
      <div className="space-y-1.5 mt-3 pt-3 border-t border-neutral-100">
        <div className="flex items-center gap-2">
          <span className="w-2.5 h-2.5 rounded-full bg-brand flex-shrink-0" />
          <div className="text-[11px] font-semibold text-neutral-600">Utilizada</div>
          <div className="ml-auto text-xs font-bold text-neutral-800">{formatSoles(utilizada)}</div>
        </div>
        <div className="flex items-center gap-2">
          <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: "#22D3EE" }} />
          <div className="text-[11px] font-semibold text-neutral-600">Disponible</div>
          <div className="ml-auto text-xs font-bold text-neutral-800">{formatSoles(disponible)}</div>
        </div>
      </div>
    </div>
  );
}

function ConsumoAhorroCard({ consumo, ahorro }) {
  const consSoles = consumo?.soles || 0;
  const consGal = consumo?.galones || 0;
  const ahSoles = ahorro?.soles || 0;
  const ahGal = ahorro?.galones || 0;
  const ahPct = consSoles > 0 ? Math.round((ahSoles / consSoles) * 100) : 0;
  const consNeto = Math.max(consSoles - ahSoles, 0);
  const hasData = consSoles > 0;

  const data = hasData
    ? [
        { name: "Consumo", value: consNeto, color: "#8039F4" },
        { name: "Ahorro", value: ahSoles, color: "#10B981" },
      ]
    : [{ name: "Sin data", value: 1, color: "#F3F4F6" }];

  return (
    <div className="bg-white border border-neutral-200 rounded-2xl p-5 flex flex-col min-h-[280px]" data-testid="card-consumo-ahorro">
      <CardHeader icon={Activity} title="Consumo y ahorro" />
      <div className="flex-1 flex items-center justify-center">
        <div className="relative w-[180px] h-[180px]">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={data}
                cx="50%" cy="50%"
                innerRadius={62} outerRadius={86}
                startAngle={90} endAngle={-270}
                dataKey="value"
                stroke="#fff"
                strokeWidth={2}
                paddingAngle={hasData ? 2 : 0}
                isAnimationActive={false}
              >
                {data.map((entry, idx) => (
                  <Cell key={`cell-${idx}`} fill={entry.color} />
                ))}
              </Pie>
            </PieChart>
          </ResponsiveContainer>
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <div className="text-[9px] font-bold uppercase tracking-wider text-neutral-400 leading-none">Consumo total</div>
            <div className="font-cabinet font-black text-xl text-neutral-900 leading-none mt-1.5">{formatSoles(consSoles)}</div>
          </div>
        </div>
      </div>
      <div className="mt-3 pt-3 border-t border-neutral-100 flex items-center justify-between">
        <div>
          <div className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-emerald-500 flex-shrink-0" />
            <div className="text-[10px] font-semibold text-neutral-500">Ahorro</div>
          </div>
          <div className="font-cabinet font-black text-base text-emerald-600 mt-0.5">{formatSoles(ahSoles)}</div>
          <div className="text-[10px] text-emerald-600 font-bold">{formatNumber(ahGal, 0)} gal</div>
        </div>
        <div className="text-right">
          <div className="flex items-center gap-1.5 justify-end">
            <span className="w-2 h-2 rounded-full bg-brand flex-shrink-0" />
            <div className="text-[10px] font-semibold text-neutral-500">Consumo</div>
          </div>
          <div className="font-cabinet font-black text-base text-neutral-900 mt-0.5">{formatSoles(consSoles)}</div>
          <div className="text-[10px] text-neutral-500 font-bold">{formatNumber(consGal, 0)} gal</div>
        </div>
      </div>
    </div>
  );
}

/* ============================================================
   Locked Metric Card (blurred + Premium tooltip)
   ============================================================ */
function LockedMetricCard({ icon: Icon, title, value, unit, deltaText, deltaPositive = true, badge, accentColor = "neutral", buttonText = "Optimizar flota", tooltip }) {
  const openUpgrade = () => window.open(UPGRADE_WA, "_blank", "noopener,noreferrer");
  const isAccent = accentColor === "brand";
  
  return (
    <div className="group relative" data-testid={`card-${title.toLowerCase().replace(/\s+/g, "-")}-locked`}>
      <div
        className={`${isAccent ? "bg-brand-50/60" : "bg-white"} border border-neutral-200 rounded-2xl p-5 flex flex-col min-h-[280px] transition-all hover:shadow-lg hover:-translate-y-0.5 overflow-hidden`}
      >
        {/* Header - always visible */}
        <div className="relative z-10">
          <CardHeader icon={Icon} title={title} badge={badge} />
        </div>
        
        {/* Blurred content */}
        <div className="relative flex-1 flex items-center justify-center">
          <div className="text-center select-none pointer-events-none" style={{ filter: "blur(3.5px)", opacity: 0.9 }}>
            <div className="flex items-baseline justify-center gap-1.5">
              <span className={`font-cabinet font-black text-5xl leading-none ${isAccent ? "text-brand" : "text-neutral-900"}`}>{value}</span>
              <span className="text-sm font-semibold text-neutral-500">{unit}</span>
            </div>
          </div>
          
          {/* Centered lock button */}
          <div className="absolute inset-0 flex items-center justify-center">
            <button
              onClick={openUpgrade}
              className="h-7 px-2.5 rounded-full bg-brand text-white text-[10px] font-black hover:bg-brand-hover transition-colors shadow-md flex items-center gap-1"
            >
              <Lock className="w-3 h-3" strokeWidth={2.5} />
              {buttonText}
            </button>
          </div>
        </div>
        
        {/* Blurred footer */}
        <div className="mt-3 pt-3 border-t border-neutral-100 select-none pointer-events-none" style={{ filter: "blur(3.5px)", opacity: 0.9 }}>
          <div className="flex items-center justify-between">
            <div className={`flex items-center gap-1.5 text-xs font-bold ${deltaPositive ? "text-emerald-600" : "text-rose-600"}`}>
              <TrendingUp className={`w-3.5 h-3.5 ${!deltaPositive && "rotate-180"}`} />
              {deltaText}
            </div>
            <span className="px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 text-[9px] font-black uppercase tracking-wider">
              Demo
            </span>
          </div>
        </div>
      </div>
      
      {/* Tooltip on hover - Premium Plus style */}
      {tooltip && (
        <div className="absolute left-1/2 -translate-x-1/2 bottom-full mb-2 w-[260px] z-50 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all pointer-events-none">
          <div className="relative bg-white border-2 border-brand-100 rounded-xl px-4 py-3 shadow-xl">
            <div className="absolute -bottom-1.5 left-1/2 -translate-x-1/2 w-3 h-3 bg-white border-r-2 border-b-2 border-brand-100 rotate-45" />
            <div className="flex items-center gap-1.5 mb-1.5">
              <Sparkles className="w-3.5 h-3.5 text-brand" strokeWidth={2.5} />
              <span className="text-xs font-black text-brand uppercase tracking-wide">Métrica Maestra</span>
            </div>
            <div className="text-[11px] font-medium leading-relaxed text-neutral-700">
              {tooltip}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function MetricDemoCard({ icon: Icon, title, value, unit, deltaText, deltaPositive = true, badge, accentColor = "neutral", isDemo = true }) {
  const isAccent = accentColor === "brand";
  return (
    <div
      className={`${isAccent ? "bg-brand-50/60" : "bg-white"} border border-neutral-200 rounded-2xl p-5 flex flex-col min-h-[280px]`}
      data-testid={`card-${title.toLowerCase().replace(/\s+/g, "-")}`}
    >
      <CardHeader icon={Icon} title={title} badge={badge} />
      <div className="flex-1 flex items-center justify-center">
        <div className="text-center">
          <div className="flex items-baseline justify-center gap-1.5">
            <span className={`font-cabinet font-black text-5xl leading-none ${isAccent ? "text-brand" : "text-neutral-900"}`}>{value}</span>
            <span className="text-sm font-semibold text-neutral-500">{unit}</span>
          </div>
        </div>
      </div>
      <div className="mt-3 pt-3 border-t border-neutral-100 flex items-center justify-between">
        <div className={`flex items-center gap-1.5 text-xs font-bold ${deltaPositive ? "text-emerald-600" : "text-rose-600"}`}>
          <TrendingUp className={`w-3.5 h-3.5 ${!deltaPositive && "rotate-180"}`} />
          {deltaText}
        </div>
        {isDemo && (
          <span className="px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 text-[9px] font-black uppercase tracking-wider">
            Demo
          </span>
        )}
      </div>
    </div>
  );
}

/* ============================================================
   ROW 3 — Charts with S/ | gal toggle
   ============================================================ */
function UnitTabs({ unit, setUnit, testid }) {
  return (
    <div className="flex bg-neutral-100 rounded-full p-0.5 text-[10px] font-bold" data-testid={testid}>
      <button
        type="button"
        onClick={() => setUnit("soles")}
        className={`px-2.5 py-1 rounded-full transition-all ${unit === "soles" ? "bg-brand text-white shadow-sm" : "text-neutral-500"}`}
      >
        S/
      </button>
      <button
        type="button"
        onClick={() => setUnit("galones")}
        className={`px-2.5 py-1 rounded-full transition-all ${unit === "galones" ? "bg-brand text-white shadow-sm" : "text-neutral-500"}`}
      >
        gal
      </button>
    </div>
  );
}

function ChartCard({ icon: Icon, title, unit, setUnit, children, testid }) {
  return (
    <div className="bg-white border border-neutral-200 rounded-2xl p-4 flex flex-col min-h-[300px]" data-testid={testid}>
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-brand-50 flex items-center justify-center">
            {Icon && <Icon className="w-4 h-4 text-brand" strokeWidth={2} />}
          </div>
          <h3 className="font-cabinet font-bold text-sm text-neutral-800">{title}</h3>
        </div>
        <UnitTabs unit={unit} setUnit={setUnit} testid={`${testid}-toggle`} />
      </div>
      <div className="flex-1">{children}</div>
    </div>
  );
}

const fmtAxis = (v, unit) => unit === "soles" ? `S/${formatNumber(v, 0)}` : formatNumber(v, 0);

/* ============================================================
   ROW 4 — Disabled donut cards (próximamente)
   ============================================================ */
function DisabledDonutCard({ icon: Icon, title, centerText, centerSub, items, tooltip, buttonText = "Mejorar Plan", testid }) {
  const openUpgrade = () => window.open(UPGRADE_WA, "_blank", "noopener,noreferrer");
  const data = [
    { name: "Al día", value: 70 },
    { name: "Por vencer", value: 20 },
    { name: "Vencido", value: 10 },
  ];
  return (
    <div className="group relative" data-testid={testid}>
      <div className="bg-white border border-neutral-200 border-l-4 border-l-brand rounded-2xl p-4 flex flex-col min-h-[280px] w-full transition-all hover:shadow-lg hover:-translate-y-0.5 overflow-hidden">
        <div className="relative z-10">
          <CardHeader icon={Icon} title={title} />
        </div>
        <div className="relative flex-1 flex items-center">
          <div className="flex-1 flex items-center gap-3 select-none pointer-events-none" style={{ filter: "blur(3.5px)", opacity: 0.9 }}>
            <div className="relative w-[120px] h-[120px] flex-shrink-0">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={data} cx="50%" cy="50%" innerRadius={38} outerRadius={56} dataKey="value" stroke="none" isAnimationActive={false}>
                    <Cell fill="#10B981" />
                    <Cell fill="#F59E0B" />
                    <Cell fill="#EF4444" />
                  </Pie>
                </PieChart>
              </ResponsiveContainer>
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <div className="font-cabinet font-black text-base text-neutral-800 leading-none">{centerText}</div>
                <div className="text-[9px] text-neutral-500 font-semibold mt-0.5">{centerSub}</div>
              </div>
            </div>
            <div className="flex-1 space-y-1.5 text-[10px]">
              {items.map((it, i) => (
                <div key={i} className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-1.5">
                    <span className={`w-1.5 h-1.5 rounded-full ${it.color}`} />
                    <span className="text-neutral-600">{it.label}</span>
                  </div>
                  <span className={`font-bold ${it.valueColor || "text-neutral-800"}`}>{it.value}</span>
                </div>
              ))}
            </div>
          </div>
          <div className="absolute inset-0 flex items-center justify-center">
            <button
              onClick={openUpgrade}
              className="h-7 px-2.5 rounded-full bg-brand text-white text-[10px] font-black hover:bg-brand-hover transition-colors shadow-md flex items-center gap-1"
            >
              <Lock className="w-3 h-3" strokeWidth={2.5} />
              {buttonText}
            </button>
          </div>
        </div>
      </div>
      {tooltip && (
        <div className="absolute left-1/2 -translate-x-1/2 bottom-full mb-2 w-[260px] z-50 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all pointer-events-none">
          <div className="relative bg-white border-2 border-brand-100 rounded-xl px-4 py-3 shadow-xl">
            <div className="absolute -bottom-1.5 left-1/2 -translate-x-1/2 w-3 h-3 bg-white border-r-2 border-b-2 border-brand-100 rotate-45" />
            <div className="flex items-center gap-1.5 mb-1.5">
              <Sparkles className="w-3.5 h-3.5 text-brand" strokeWidth={2.5} />
              <span className="text-xs font-black text-brand uppercase tracking-wide">Premium Plus</span>
            </div>
            <div className="text-[11px] font-medium leading-relaxed text-neutral-700">
              {tooltip}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/* ============================================================
   MAIN
   ============================================================ */
export default function Dashboard() {
  const { user } = useAuth();
  const [data, setData] = useState(null);
  const [overview, setOverview] = useState(null);
  const [alerts, setAlerts] = useState([]);
  const [empresas, setEmpresas] = useState([]);
  const [options, setOptions] = useState({ placas: [], semanas: [], estaciones: [], productos: [] });
  const [filters, setFilters] = useState({ empresa: "", placa: "", semana: "", estacion: "", producto: "" });
  const [loading, setLoading] = useState(true);

  // Toggles independientes por gráfico (single value: 'soles' | 'galones')
  const [unitTiempo, setUnitTiempo] = useState("galones");
  const [unitPlacas, setUnitPlacas] = useState("galones");
  const [unitCiudad, setUnitCiudad] = useState("galones");
  const [unitEstacion, setUnitEstacion] = useState("galones");

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
      } catch (err) {
        console.error("Error loading Dashboard:", err);
      } finally {
        setLoading(false);
      }
    })();
  }, [filters]);

  const activeFiltersCount = useMemo(
    () => ["placa", "semana", "estacion", "producto"].filter((k) => filters[k]).length,
    [filters]
  );

  if (loading || !data || !overview) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="w-10 h-10 border-4 border-brand border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const {
    linea_credito, ahorro, consumo, promedios, cargas, unidades_contratadas,
    red_estaciones, ultima_sincronizacion, servicios, unidades_activas,
    total_vehicles, cargas_semana, cargas_invalidas, rendimiento, costo_km, und_con_gps
  } = overview;

  const services = servicios || user?.servicios || { plataforma: true, combustible: true, gps: false };

  // KPI calculations
  const alertasCriticas = alerts.filter((a) => a.nivel === "red").length;
  const syncFmt = ultima_sincronizacion
    ? new Date(ultima_sincronizacion).toLocaleString("es-PE", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" })
    : "—";

  // Chart data: time series
  const tiempoData = (data.series_semana || []).map((d) => ({
    semana: d.semana,
    galones: d.consumo,
    soles: d.gasto,
    ahorro_galones: d.ahorro_galones || 0,
    ahorro_soles: d.ahorro || 0,
  }));

  // Top 5 placas
  const placasMap = {};
  (data.top_placas_consumo || []).forEach((p) => {
    placasMap[p.placa] = { placa: p.placa, galones: p.galones, soles: 0 };
  });
  (data.gasto_placa || []).forEach((p) => {
    if (placasMap[p.placa]) placasMap[p.placa].soles = p.gasto;
    else placasMap[p.placa] = { placa: p.placa, galones: 0, soles: p.gasto };
  });
  const placasData = Object.values(placasMap)
    .sort((a, b) => (b.galones + b.soles) - (a.galones + a.soles))
    .slice(0, 5);

  const ciudadData = (data.consumo_ciudad || []).map((c) => ({
    ciudad: c.ciudad,
    galones: c.galones,
    soles: c.gasto || c.soles || (c.galones * (data.totals?.precio_enered || 0)),
  }));

  const estacionData = (data.consumo_estacion || []).map((e) => ({
    estacion: e.estacion,
    galones: e.galones,
    soles: e.gasto || e.soles || (e.galones * (data.totals?.precio_enered || 0)),
  }));

  return (
    <div className="space-y-4">
      {/* Top bar: timestamp + admin empresa filter */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2 text-xs text-neutral-500 font-semibold">
          <Clock className="w-3.5 h-3.5" />
          Información generada el <span className="font-bold text-neutral-800">{syncFmt}</span>
        </div>
        {user?.role === "admin_enered" && empresas.length > 0 && (
          <select
            value={filters.empresa}
            onChange={(e) => setFilters({ ...filters, empresa: e.target.value })}
            className="h-9 px-3 border border-neutral-200 rounded-lg bg-white text-xs font-semibold min-w-[220px]"
            data-testid="empresa-filter"
          >
            <option value="">Todas las empresas</option>
            {empresas.map((e) => <option key={e} value={e}>{e}</option>)}
          </select>
        )}
      </div>

      {services.subsidio && <TrackerSubsidio />}

      {/* ================= ROW 1 — 8 mini KPI cards ================= */}
      <div className="grid grid-cols-2 sm:grid-cols-4 xl:grid-cols-8 gap-2.5" data-testid="row-1-kpis">
        <MiniKpiCard
          icon={Siren}
          label="Alertas críticas"
          value={alertasCriticas}
          subtitle="Atención inmediata"
          borderColor="border-rose-500"
          valueColor="text-rose-600"
          subtitleColor="text-rose-600"
          iconColor="text-rose-500"
          testid="kpi-alertas"
        />
        <MiniKpiCard
          icon={Truck}
          label="Unidades activas"
          value={`${unidades_activas || 0}/${total_vehicles || 0}`}
          subtitle={services.gps ? `${(total_vehicles || 0) - (unidades_activas || 0)} sin reporte GPS` : "Mapeado desde base"}
          borderColor="border-brand"
          valueColor="text-brand"
          subtitleColor="text-brand-600"
          iconColor="text-brand"
          testid="kpi-unidades-activas"
        />
        <MiniKpiCard
          icon={Fuel}
          label="Cargas inválidas"
          value={formatNumber(cargas_invalidas || 0, 0)}
          subtitle="Posible desvío"
          borderColor="border-rose-400"
          valueColor={(cargas_invalidas || 0) > 0 ? "text-rose-600" : "text-neutral-900"}
          subtitleColor="text-neutral-500"
          iconColor="text-rose-500"
          testid="kpi-cargas-invalidas"
        />
        <MiniKpiCard
          icon={CreditCard}
          label="Unidades habilitadas"
          value={formatNumber(und_con_gps || 0, 0)}
          subtitle={`de ${formatNumber(total_vehicles || 0, 0)} habilitadas`}
          iconColor="text-neutral-500"
          testid="kpi-unidades-habilitadas"
        />
        <MiniKpiCard
          icon={Droplet}
          label="Cargas / semana"
          value={formatNumber(cargas || 0, 0)}
          subtitle={`${formatNumber(cargas_semana || 0, 0)} esta semana`}
          iconColor="text-cyan-500"
          testid="kpi-cargas"
        />
        <MiniKpiCard
          icon={Fuel}
          label="Galones promedio"
          value={formatNumber(promedios.carga_gal, 1)}
          subtitle="gal por carga"
          iconColor="text-brand"
          testid="kpi-galones-prom"
        />
        <MiniKpiCard
          icon={Banknote}
          label="Precio promedio"
          value={`S/${formatNumber(promedios.precio, 2)}`}
          subtitle="por galón"
          iconColor="text-emerald-500"
          testid="kpi-precio-prom"
        />
        <MiniKpiCard
          icon={MapPin}
          label="Red de estaciones"
          value={`+${formatNumber(red_estaciones, 0)}`}
          subtitle={<span className="flex items-center gap-0.5 text-brand">Ver red <ChevronRight className="w-3 h-3" /></span>}
          valueColor="text-brand"
          subtitleColor="text-brand"
          iconColor="text-brand"
          bgColor="bg-brand-50/40"
          borderColor="border-brand"
          onClick={() => window.open(MAPS_LINK, "_blank")}
          testid="kpi-red"
        />
      </div>

      {/* ================= ROW 2 — 4 large cards ================= */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-3" data-testid="row-2-cards">
        <LineaCreditoCard linea_credito={linea_credito} />
        <ConsumoAhorroCard consumo={consumo} ahorro={ahorro} />
        <MetricDemoCard
          icon={Gauge}
          title="Rendimiento promedio"
          value={rendimiento > 0 ? formatNumber(rendimiento, 1) : "—"}
          unit="km/gal"
          deltaText={rendimiento > 0 ? "Calculado de cargas" : "Sin odómetros registrados"}
          deltaPositive={true}
          isDemo={!services.gps}
        />
        <MetricDemoCard
          icon={Activity}
          title="Costo por km · TCO"
          value={costo_km > 0 ? `S/ ${formatNumber(costo_km, 2)}` : "—"}
          unit="/km"
          deltaText={costo_km > 0 ? "Calculado de cargas" : "Sin odómetros registrados"}
          deltaPositive={true}
          isDemo={!services.gps}
        />
      </div>

      {/* Filters removed */}
      {/* ================= ROW 3 — 4 charts ================= */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-3" data-testid="row-3-charts">
        {/* Consumo y ahorro (área) */}
        <ChartCard icon={Activity} title="Consumo y ahorro" unit={unitTiempo} setUnit={setUnitTiempo} testid="chart-tiempo">
          <ResponsiveContainer width="100%" height={210}>
            <AreaChart data={tiempoData} margin={{ top: 5, right: 5, left: -20, bottom: 0 }}>
              <defs>
                <linearGradient id="gradMain" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#8039F4" stopOpacity={0.35} />
                  <stop offset="100%" stopColor="#8039F4" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="gradAhorro" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#10B981" stopOpacity={0.3} />
                  <stop offset="100%" stopColor="#10B981" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" vertical={false} />
              <XAxis dataKey="semana" tick={{ fontSize: 9, fontWeight: 700 }} stroke="#a3a3a3" />
              <YAxis tick={{ fontSize: 9 }} stroke="#a3a3a3" tickFormatter={(v) => fmtAxis(v, unitTiempo)} />
              <Tooltip
                contentStyle={{ borderRadius: 8, fontSize: 11 }}
                formatter={(v, name) => [unitTiempo === "soles" ? formatSoles(v) : `${formatNumber(v, 0)} gal`, name]}
              />
              <Area type="monotone" dataKey={unitTiempo} stroke="#8039F4" strokeWidth={2.5} fill="url(#gradMain)" name="Consumo" />
              <Area type="monotone" dataKey={`ahorro_${unitTiempo}`} stroke="#10B981" strokeWidth={2} fill="url(#gradAhorro)" name="Ahorro" />
            </AreaChart>
          </ResponsiveContainer>
        </ChartCard>

        {/* Top 5 placas (barras horizontales moradas) */}
        <ChartCard icon={Truck} title="Top 5 placas" unit={unitPlacas} setUnit={setUnitPlacas} testid="chart-placas">
          <ResponsiveContainer width="100%" height={210}>
            <BarChart data={placasData} layout="vertical" margin={{ top: 5, right: 10, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" horizontal={false} />
              <XAxis type="number" tick={{ fontSize: 9 }} stroke="#a3a3a3" tickFormatter={(v) => fmtAxis(v, unitPlacas)} />
              <YAxis type="category" dataKey="placa" tick={{ fontSize: 10, fontWeight: 700 }} width={70} stroke="#525252" />
              <Tooltip formatter={(v, name) => [unitPlacas === "soles" ? formatSoles(v) : `${formatNumber(v, 0)} gal`, name]} contentStyle={{ borderRadius: 8, fontSize: 11 }} />
              <Bar dataKey={unitPlacas} fill="#8039F4" radius={[0, 6, 6, 0]} name="Consumo" />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>

        {/* Por ciudad (barras verticales celestes) */}
        <ChartCard icon={MapPin} title="Por ciudad" unit={unitCiudad} setUnit={setUnitCiudad} testid="chart-ciudad">
          <ResponsiveContainer width="100%" height={210}>
            <BarChart data={ciudadData} margin={{ top: 5, right: 5, left: -20, bottom: 20 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" vertical={false} />
              <XAxis dataKey="ciudad" tick={{ fontSize: 9, fontWeight: 700 }} stroke="#525252" angle={-25} textAnchor="end" height={40} />
              <YAxis tick={{ fontSize: 9 }} stroke="#a3a3a3" tickFormatter={(v) => fmtAxis(v, unitCiudad)} />
              <Tooltip formatter={(v, name) => [unitCiudad === "soles" ? formatSoles(v) : `${formatNumber(v, 0)} gal`, name]} contentStyle={{ borderRadius: 8, fontSize: 11 }} />
              <Bar dataKey={unitCiudad} fill="#06B6D4" radius={[6, 6, 0, 0]} name="Consumo" />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>

        {/* Por estación (barras horizontales verdes) */}
        <ChartCard icon={Fuel} title="Por estación" unit={unitEstacion} setUnit={setUnitEstacion} testid="chart-estacion">
          <ResponsiveContainer width="100%" height={210}>
            <BarChart data={estacionData.slice(0, 5)} layout="vertical" margin={{ top: 5, right: 10, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" horizontal={false} />
              <XAxis type="number" tick={{ fontSize: 9 }} stroke="#a3a3a3" tickFormatter={(v) => fmtAxis(v, unitEstacion)} />
              <YAxis type="category" dataKey="estacion" tick={{ fontSize: 9, fontWeight: 700 }} width={90} stroke="#525252" />
              <Tooltip formatter={(v, name) => [unitEstacion === "soles" ? formatSoles(v) : `${formatNumber(v, 0)} gal`, name]} contentStyle={{ borderRadius: 8, fontSize: 11 }} />
              <Bar dataKey={unitEstacion} fill="#10B981" radius={[0, 6, 6, 0]} name="Consumo" />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>
      </div>

      {/* ================= ROW 4 — 4 disabled donut cards (próximamente) ================= */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-3" data-testid="row-4-disabled">
        <DisabledDonutCard
          icon={Calendar}
          title="Mant. preventivos"
          centerText="5/8"
          centerSub="venc/próx"
          items={[
            { label: "V2P-481", value: "Vencido", color: "bg-rose-500", valueColor: "text-rose-600" },
            { label: "B7T-022", value: "3 días", color: "bg-amber-400", valueColor: "text-amber-600" },
            { label: "C3K-915", value: "5 días", color: "bg-amber-400", valueColor: "text-amber-600" },
            { label: "+10 más", value: "", color: "bg-neutral-300" },
          ]}
          tooltip="Automatiza la programación de mantenimiento y recibe alertas proactivas para prevenir averías críticas"
          testid="card-mant-prev"
        />
        <DisabledDonutCard
          icon={Wrench}
          title="Mant. correctivos"
          centerText="3/4"
          centerSub="venc/próx"
          items={[
            { label: "D9L-307", value: "Vencido", color: "bg-rose-500", valueColor: "text-rose-600" },
            { label: "A4M-650", value: "2 días", color: "bg-amber-400", valueColor: "text-amber-600" },
            { label: "F1H-228", value: "6 días", color: "bg-amber-400", valueColor: "text-amber-600" },
            { label: "+4 más", value: "", color: "bg-neutral-300" },
          ]}
          tooltip="Mide el impacto de los costos de reparación y optimiza la eficiencia operativa de tu flota"
          buttonText="Mejorar eficiencia"
          testid="card-mant-corr"
        />
        <DisabledDonutCard
          icon={FileText}
          title="Doc. vehículos"
          centerText="12"
          centerSub="por vencer"
          items={[
            { label: "Al día", value: "92%", color: "bg-emerald-500", valueColor: "text-emerald-600" },
            { label: "Por vencer", value: "12", color: "bg-amber-400", valueColor: "text-amber-600" },
            { label: "Vencidos", value: "4", color: "bg-rose-500", valueColor: "text-rose-600" },
          ]}
          tooltip="Simplifica el cumplimiento y la gestión centralizada de toda la documentación de tu flota"
          buttonText="Optimizar gestión"
          testid="card-doc-veh"
        />
        <DisabledDonutCard
          icon={Users}
          title="Doc. personas"
          centerText="15"
          centerSub="por vencer"
          items={[
            { label: "Al día", value: "88%", color: "bg-emerald-500", valueColor: "text-emerald-600" },
            { label: "Por vencer", value: "15", color: "bg-amber-400", valueColor: "text-amber-600" },
            { label: "Vencidos", value: "6", color: "bg-rose-500", valueColor: "text-rose-600" },
          ]}
          tooltip="Asegura que todos los conductores tengan licencia y certificaciones válidas para evitar multas"
          buttonText="Optimizar gestión"
          testid="card-doc-per"
        />
      </div>
    </div>
  );
}
