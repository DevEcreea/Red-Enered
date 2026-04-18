import React, { useEffect, useState } from "react";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid, ResponsiveContainer,
  PieChart, Pie, Cell, Legend, LineChart, Line,
} from "recharts";
import {
  Fuel, DollarSign, TrendingDown, Package, AlertTriangle, CheckCircle2, AlertCircle,
} from "lucide-react";
import { api } from "../lib/api";
import { formatSoles, formatNumber, BRAND_COLORS } from "../lib/utils";
import { useAuth } from "../context/AuthContext";

const ALERT_STYLES = {
  red: { bg: "bg-red-50", text: "text-red-700", border: "border-red-200", Icon: AlertCircle, dot: "bg-red-500" },
  yellow: { bg: "bg-yellow-50", text: "text-yellow-700", border: "border-yellow-200", Icon: AlertTriangle, dot: "bg-yellow-500" },
  green: { bg: "bg-green-50", text: "text-green-700", border: "border-green-200", Icon: CheckCircle2, dot: "bg-green-500" },
};

function KPICard({ label, value, sub, icon: Icon, testid }) {
  return (
    <div className="kpi-card" data-testid={testid}>
      <div className="flex items-start justify-between">
        <div>
          <div className="text-[10px] font-bold uppercase tracking-widest text-neutral-500 mb-2">{label}</div>
          <div className="font-cabinet font-black text-3xl text-neutral-900 leading-none">{value}</div>
          {sub && <div className="text-xs text-neutral-500 mt-2 font-semibold">{sub}</div>}
        </div>
        <div className="w-10 h-10 rounded-md bg-brand-50 border border-brand-100 flex items-center justify-center">
          <Icon className="w-5 h-5 text-brand" strokeWidth={2.5} />
        </div>
      </div>
    </div>
  );
}

function ChartCard({ title, subtitle, children, testid, className = "" }) {
  return (
    <div className={`chart-card ${className}`} data-testid={testid}>
      <div className="mb-5 pb-4 border-b border-neutral-100">
        <div className="font-cabinet font-bold text-lg text-neutral-900">{title}</div>
        {subtitle && <div className="text-xs text-neutral-500 mt-1 font-semibold">{subtitle}</div>}
      </div>
      <div className="w-full">{children}</div>
    </div>
  );
}

export default function Dashboard() {
  const { user } = useAuth();
  const [data, setData] = useState(null);
  const [alerts, setAlerts] = useState([]);
  const [empresas, setEmpresas] = useState([]);
  const [empresa, setEmpresa] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (user?.role === "admin_enered") {
      api.get("/empresas").then((r) => setEmpresas(r.data)).catch(() => {});
    }
  }, [user]);

  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const params = empresa ? { empresa } : {};
        const [k, a] = await Promise.all([
          api.get("/dashboard/kpis", { params }),
          api.get("/dashboard/alerts", { params }),
        ]);
        setData(k.data);
        setAlerts(a.data);
      } finally {
        setLoading(false);
      }
    })();
  }, [empresa]);

  if (loading || !data) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="w-10 h-10 border-4 border-brand border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const { kpis, top_placas, ciudades, productos, estaciones, tendencia } = data;

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-4">
        <div>
          <div className="text-[11px] font-bold uppercase tracking-widest text-brand mb-2">Panel operativo</div>
          <h1 className="font-cabinet font-black text-3xl md:text-4xl text-neutral-900">Resumen de consumo</h1>
          <p className="text-neutral-500 mt-1 text-sm">Decisiones claras a partir de cada carga de combustible.</p>
        </div>
        {user?.role === "admin_enered" && empresas.length > 0 && (
          <select
            value={empresa}
            onChange={(e) => setEmpresa(e.target.value)}
            className="h-11 px-3 border border-border rounded-md bg-white text-sm font-semibold"
            data-testid="empresa-filter"
          >
            <option value="">Todas las empresas</option>
            {empresas.map((e) => <option key={e} value={e}>{e}</option>)}
          </select>
        )}
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6">
        <KPICard label="Consumo total" value={`${formatNumber(kpis.total_gal, 2)} gal`} icon={Fuel} testid="kpi-total-gal" />
        <KPICard label="Gasto total" value={formatSoles(kpis.total_gasto)} icon={DollarSign} testid="kpi-total-cost" />
        <KPICard label="Ahorro total" value={formatSoles(kpis.total_ahorro)} sub="vs precio pizarra" icon={TrendingDown} testid="kpi-total-savings" />
        <KPICard label="Nº de cargas" value={formatNumber(kpis.cargas, 0)} icon={Package} testid="kpi-loads-count" />
      </div>

      {/* Charts row 1 */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <ChartCard title="Top 5 placas" subtitle="Mayor consumo en galones" testid="chart-top-plates" className="lg:col-span-2">
          <ResponsiveContainer width="100%" height={320}>
            <BarChart data={top_placas} layout="vertical" margin={{ top: 5, right: 20, left: 10, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" horizontal={false} />
              <XAxis type="number" tick={{ fontSize: 11, fontWeight: 600 }} stroke="#a3a3a3" />
              <YAxis type="category" dataKey="placa" tick={{ fontSize: 12, fontWeight: 700 }} stroke="#525252" width={80} />
              <Tooltip formatter={(v) => `${formatNumber(v, 2)} gal`} contentStyle={{ borderRadius: 8, border: "1px solid #e5e5e5", fontSize: 12 }} />
              <Bar dataKey="galones" fill="#9933FF" radius={[0, 4, 4, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard title="Consumo por producto" subtitle="Distribución por tipo" testid="chart-product-donut">
          <ResponsiveContainer width="100%" height={320}>
            <PieChart>
              <Pie data={productos} dataKey="galones" nameKey="producto" cx="50%" cy="50%" innerRadius={60} outerRadius={100} paddingAngle={2}>
                {productos.map((_, i) => <Cell key={i} fill={BRAND_COLORS[i % BRAND_COLORS.length]} />)}
              </Pie>
              <Tooltip formatter={(v) => `${formatNumber(v, 2)} gal`} contentStyle={{ borderRadius: 8, fontSize: 12 }} />
              <Legend wrapperStyle={{ fontSize: 11, fontWeight: 600 }} />
            </PieChart>
          </ResponsiveContainer>
        </ChartCard>
      </div>

      {/* Charts row 2 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <ChartCard title="Consumo por ciudad" subtitle="Top 10 ciudades" testid="chart-city-consumption">
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={ciudades} margin={{ top: 5, right: 10, left: 0, bottom: 30 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" vertical={false} />
              <XAxis dataKey="ciudad" tick={{ fontSize: 10, fontWeight: 700 }} stroke="#525252" angle={-30} textAnchor="end" height={50} />
              <YAxis tick={{ fontSize: 11, fontWeight: 600 }} stroke="#a3a3a3" />
              <Tooltip formatter={(v) => `${formatNumber(v, 2)} gal`} contentStyle={{ borderRadius: 8, fontSize: 12 }} />
              <Bar dataKey="galones" fill="#9933FF" radius={[6, 6, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard title="Ahorro por estación" subtitle="Top 10 estaciones con más ahorro" testid="chart-savings-station">
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={estaciones} margin={{ top: 5, right: 10, left: 0, bottom: 30 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" vertical={false} />
              <XAxis dataKey="estacion" tick={{ fontSize: 10, fontWeight: 700 }} stroke="#525252" angle={-30} textAnchor="end" height={50} />
              <YAxis tick={{ fontSize: 11, fontWeight: 600 }} stroke="#a3a3a3" />
              <Tooltip formatter={(v) => formatSoles(v)} contentStyle={{ borderRadius: 8, fontSize: 12 }} />
              <Bar dataKey="ahorro" fill="#16A34A" radius={[6, 6, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>
      </div>

      {/* Tendencia */}
      <ChartCard title="Tendencia semanal" subtitle="Consumo, gasto y ahorro por semana" testid="chart-weekly-trend">
        <ResponsiveContainer width="100%" height={340}>
          <LineChart data={tendencia} margin={{ top: 10, right: 20, left: 0, bottom: 10 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
            <XAxis dataKey="semana" tick={{ fontSize: 11, fontWeight: 700 }} stroke="#525252" />
            <YAxis tick={{ fontSize: 11, fontWeight: 600 }} stroke="#a3a3a3" />
            <Tooltip contentStyle={{ borderRadius: 8, fontSize: 12 }} />
            <Legend wrapperStyle={{ fontSize: 12, fontWeight: 600 }} />
            <Line type="monotone" dataKey="consumo" stroke="#9933FF" strokeWidth={3} dot={{ r: 3 }} name="Consumo (gal)" />
            <Line type="monotone" dataKey="gasto" stroke="#3B82F6" strokeWidth={2} dot={{ r: 3 }} name="Gasto (S/)" />
            <Line type="monotone" dataKey="ahorro" stroke="#16A34A" strokeWidth={2} dot={{ r: 3 }} name="Ahorro (S/)" />
          </LineChart>
        </ResponsiveContainer>
      </ChartCard>

      {/* Alertas */}
      <div className="chart-card" data-testid="alerts-list">
        <div className="mb-5 pb-4 border-b border-neutral-100 flex items-center justify-between">
          <div>
            <div className="font-cabinet font-bold text-lg text-neutral-900">Alertas inteligentes</div>
            <div className="text-xs text-neutral-500 mt-1 font-semibold">Patrones detectados automáticamente</div>
          </div>
          <span className="px-3 py-1 rounded-full bg-brand-50 text-brand text-xs font-bold border border-brand-100">
            {alerts.length} alerta{alerts.length !== 1 ? "s" : ""}
          </span>
        </div>

        {alerts.length === 0 ? (
          <div className="text-center py-10 text-neutral-500 text-sm font-semibold">
            <CheckCircle2 className="w-10 h-10 text-green-500 mx-auto mb-3" />
            Sin alertas activas. Todo en orden.
          </div>
        ) : (
          <div className="space-y-3">
            {alerts.map((a, i) => {
              const s = ALERT_STYLES[a.nivel] || ALERT_STYLES.yellow;
              const Ic = s.Icon;
              return (
                <div key={i} className={`flex items-start gap-3 p-4 rounded-md border ${s.bg} ${s.border}`}>
                  <span className={`w-2 h-2 rounded-full mt-2 ${s.dot}`} />
                  <Ic className={`w-5 h-5 flex-shrink-0 ${s.text}`} />
                  <div className="flex-1">
                    <div className={`font-bold text-sm ${s.text}`}>{a.titulo}</div>
                    <div className="text-sm text-neutral-700 mt-0.5">{a.mensaje}</div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
