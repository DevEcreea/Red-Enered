import React, { useEffect, useState, useMemo } from "react";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid, ResponsiveContainer,
  LineChart, Line, Area, AreaChart, ComposedChart, Legend, Cell, ScatterChart, Scatter, ZAxis,
} from "recharts";
import {
  Gauge, Droplets, Coins, Zap, Calendar, TrendingUp, Award, AlertTriangle, Info,
} from "lucide-react";
import { api } from "../lib/api";
import { formatSoles, formatNumber } from "../lib/utils";
import { useAuth } from "../context/AuthContext";

const DIAS = ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"];

function KPI({ label, value, sub, icon: Icon, color = "brand", testid }) {
  const ring = {
    brand: "bg-brand-50 border-brand-100 text-brand",
    green: "bg-green-50 border-green-100 text-green-600",
    amber: "bg-amber-50 border-amber-100 text-amber-600",
    blue: "bg-blue-50 border-blue-100 text-blue-600",
  }[color];
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

function Card({ title, subtitle, children, right, testid, className = "" }) {
  return (
    <div className={`chart-card ${className}`} data-testid={testid}>
      <div className="mb-5 pb-4 border-b border-neutral-100 flex items-start justify-between gap-3">
        <div>
          <div className="font-cabinet font-bold text-lg text-neutral-900">{title}</div>
          {subtitle && <div className="text-xs text-neutral-500 mt-1 font-semibold">{subtitle}</div>}
        </div>
        {right}
      </div>
      <div>{children}</div>
    </div>
  );
}

export default function Analitica() {
  const { user } = useAuth();
  const [data, setData] = useState(null);
  const [empresas, setEmpresas] = useState([]);
  const [empresa, setEmpresa] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (user?.role === "admin_enered") api.get("/empresas").then((r) => setEmpresas(r.data)).catch(() => {});
  }, [user]);

  useEffect(() => {
    setLoading(true);
    const params = empresa ? { empresa } : {};
    api.get("/analytics/fleet", { params })
      .then((r) => setData(r.data))
      .finally(() => setLoading(false));
  }, [empresa]);

  const efficient = useMemo(() => (data?.rendimiento || []).filter((r) => r.km_por_gal), [data]);
  const topEfficient = efficient.slice(0, 10);
  const worstEfficient = [...efficient].reverse().slice(0, 5);

  // Heatmap normalization
  const heatmapMax = useMemo(() => Math.max(1, ...(data?.heatmap || []).map((c) => c.count)), [data]);
  const heatmapByDayHour = useMemo(() => {
    const m = {};
    (data?.heatmap || []).forEach((c) => { m[`${c.dia}-${c.hora}`] = c.count; });
    return m;
  }, [data]);

  if (loading || !data) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="w-10 h-10 border-4 border-brand border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const { kpis, pareto, precio_estaciones, tendencia_precio, productos_pct, top_tarjetas } = data;
  const hasData = efficient.length > 0 || kpis.cargas_por_dia > 0;
  const paretoChart = pareto.slice(0, 15);
  const precioBarato = precio_estaciones.slice(0, 10);
  const precioCaro = [...precio_estaciones].reverse().slice(0, 10);

  return (
    <div className="space-y-8">
      <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-4">
        <div>
          <div className="text-[11px] font-bold uppercase tracking-widest text-brand mb-2">Inteligencia de flota</div>
          <h1 className="font-cabinet font-black text-3xl md:text-4xl text-neutral-900">Analítica avanzada</h1>
          <p className="text-neutral-500 mt-1 text-sm">Decisiones basadas en rendimiento, costos y patrones de consumo.</p>
        </div>
        {user?.role === "admin_enered" && empresas.length > 0 && (
          <select
            value={empresa}
            onChange={(e) => setEmpresa(e.target.value)}
            className="h-11 px-3 border border-border rounded-md bg-white text-sm font-semibold"
          >
            <option value="">Todas las empresas</option>
            {empresas.map((e) => <option key={e} value={e}>{e}</option>)}
          </select>
        )}
      </div>

      {/* KPIs avanzados */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4 md:gap-5">
        <KPI label="Ahorro efectivo" value={`${kpis.ahorro_pct}%`} sub="vs precio pizarra" icon={Coins} color="green" testid="kpi-ahorro-pct" />
        <KPI label="Rendimiento prom." value={`${formatNumber(kpis.rendimiento_prom, 2)} km/gal`} sub="media de la flota" icon={Gauge} color="brand" testid="kpi-rendimiento" />
        <KPI label="Gal / carga" value={formatNumber(kpis.galones_por_carga, 2)} sub="tamaño típico de tanqueo" icon={Droplets} color="blue" testid="kpi-gal-carga" />
        <KPI label="S/ / carga" value={formatSoles(kpis.costo_por_carga)} sub="gasto medio" icon={Zap} color="amber" testid="kpi-costo-carga" />
        <KPI label="Cargas / día" value={formatNumber(kpis.cargas_por_dia, 2)} sub="frecuencia" icon={Calendar} color="brand" testid="kpi-cargas-dia" />
      </div>

      {!hasData && (
        <div className="chart-card text-center py-12">
          <AlertTriangle className="w-12 h-12 text-amber-500 mx-auto mb-3" />
          <div className="font-bold text-lg text-neutral-900">Sin datos suficientes</div>
          <div className="text-sm text-neutral-500 mt-1">Sincroniza desde Google Sheets o sube un archivo para ver el análisis.</div>
        </div>
      )}

      {/* Rendimiento km/gal: top + worst */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card
          title="Top 10 placas más eficientes"
          subtitle="km recorridos por galón consumido"
          testid="chart-top-efficient"
          right={<span className="px-2.5 py-1 rounded-full text-[10px] font-bold bg-green-50 text-green-700 border border-green-100 uppercase tracking-wider">Excelencia</span>}
        >
          <ResponsiveContainer width="100%" height={340}>
            <BarChart data={topEfficient} layout="vertical" margin={{ top: 5, right: 30, left: 10, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" horizontal={false} />
              <XAxis type="number" tick={{ fontSize: 11, fontWeight: 600 }} stroke="#a3a3a3" />
              <YAxis type="category" dataKey="placa" tick={{ fontSize: 11, fontWeight: 700 }} width={70} stroke="#525252" />
              <Tooltip formatter={(v, n) => n === "km_por_gal" ? `${v} km/gal` : v} contentStyle={{ borderRadius: 8, fontSize: 12 }} />
              <Bar dataKey="km_por_gal" fill="#16A34A" radius={[0, 4, 4, 0]}>
                {topEfficient.map((_, i) => <Cell key={i} fill={`hsl(142, ${60 + (40 - i * 4)}%, ${35 + i * 2}%)`} />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </Card>

        <Card
          title="Placas con menor eficiencia"
          subtitle="Candidatas a revisión mecánica o auditoría"
          testid="chart-worst-efficient"
          right={<span className="px-2.5 py-1 rounded-full text-[10px] font-bold bg-red-50 text-red-700 border border-red-100 uppercase tracking-wider">Atención</span>}
        >
          <ResponsiveContainer width="100%" height={340}>
            <BarChart data={worstEfficient} layout="vertical" margin={{ top: 5, right: 30, left: 10, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" horizontal={false} />
              <XAxis type="number" tick={{ fontSize: 11, fontWeight: 600 }} stroke="#a3a3a3" />
              <YAxis type="category" dataKey="placa" tick={{ fontSize: 11, fontWeight: 700 }} width={70} stroke="#525252" />
              <Tooltip formatter={(v) => `${v} km/gal`} contentStyle={{ borderRadius: 8, fontSize: 12 }} />
              <Bar dataKey="km_por_gal" fill="#DC2626" radius={[0, 4, 4, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </Card>
      </div>

      {/* Scatter: costo S//km vs km/gal */}
      <Card
        title="Mapa de flota: rendimiento vs costo"
        subtitle="Cada burbuja = una placa · tamaño = galones consumidos · meta: esquina inferior derecha"
        testid="chart-fleet-scatter"
      >
        <ResponsiveContainer width="100%" height={360}>
          <ScatterChart margin={{ top: 10, right: 30, bottom: 30, left: 10 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
            <XAxis type="number" dataKey="km_por_gal" name="km/gal" tick={{ fontSize: 11, fontWeight: 600 }} stroke="#525252"
              label={{ value: "Rendimiento (km/gal)", position: "insideBottom", offset: -15, fontSize: 11, fontWeight: 700 }} />
            <YAxis type="number" dataKey="costo_km" name="S/ por km" tick={{ fontSize: 11, fontWeight: 600 }} stroke="#525252"
              label={{ value: "S/ por km", angle: -90, position: "insideLeft", fontSize: 11, fontWeight: 700 }} />
            <ZAxis type="number" dataKey="gal" range={[50, 500]} />
            <Tooltip cursor={{ strokeDasharray: "3 3" }}
              formatter={(v, n) => n === "km_por_gal" ? `${v} km/gal` : n === "costo_km" ? formatSoles(v) : v}
              contentStyle={{ borderRadius: 8, fontSize: 12 }}
              labelFormatter={(_, p) => p?.[0]?.payload?.placa || ""} />
            <Scatter data={efficient} fill="#9933FF" />
          </ScatterChart>
        </ResponsiveContainer>
      </Card>

      {/* Pareto + Evolución precio */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card
          title="Pareto de gasto"
          subtitle="¿Qué % de placas concentra el 80% del gasto?"
          testid="chart-pareto"
        >
          <ResponsiveContainer width="100%" height={340}>
            <ComposedChart data={paretoChart} margin={{ top: 10, right: 30, left: 0, bottom: 40 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" vertical={false} />
              <XAxis dataKey="placa" tick={{ fontSize: 10, fontWeight: 700 }} stroke="#525252" angle={-45} textAnchor="end" height={60} />
              <YAxis yAxisId="left" tick={{ fontSize: 10, fontWeight: 600 }} stroke="#a3a3a3" />
              <YAxis yAxisId="right" orientation="right" domain={[0, 100]} tick={{ fontSize: 10, fontWeight: 600 }} stroke="#9933FF" />
              <Tooltip contentStyle={{ borderRadius: 8, fontSize: 12 }} formatter={(v, n) => n === "pct_acum" ? `${v}%` : formatSoles(v)} />
              <Legend wrapperStyle={{ fontSize: 11, fontWeight: 600 }} />
              <Bar yAxisId="left" dataKey="gasto" fill="#9933FF" name="Gasto (S/)" radius={[4, 4, 0, 0]} />
              <Line yAxisId="right" type="monotone" dataKey="pct_acum" stroke="#DC2626" strokeWidth={2} dot={{ r: 3 }} name="% acumulado" />
            </ComposedChart>
          </ResponsiveContainer>
        </Card>

        <Card
          title="Evolución del precio unitario"
          subtitle="Precio promedio ponderado por galones, día a día"
          testid="chart-price-trend"
        >
          <ResponsiveContainer width="100%" height={340}>
            <AreaChart data={tendencia_precio} margin={{ top: 10, right: 20, left: 0, bottom: 10 }}>
              <defs>
                <linearGradient id="priceGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#9933FF" stopOpacity={0.4} />
                  <stop offset="100%" stopColor="#9933FF" stopOpacity={0.02} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis dataKey="fecha" tick={{ fontSize: 10, fontWeight: 600 }} stroke="#a3a3a3" />
              <YAxis tick={{ fontSize: 11, fontWeight: 600 }} stroke="#a3a3a3" domain={["auto", "auto"]} />
              <Tooltip contentStyle={{ borderRadius: 8, fontSize: 12 }} formatter={(v) => `S/ ${v}`} />
              <Area type="monotone" dataKey="precio_prom" stroke="#9933FF" strokeWidth={2.5} fill="url(#priceGrad)" name="S/ / gal" />
            </AreaChart>
          </ResponsiveContainer>
        </Card>
      </div>

      {/* Estaciones más baratas / más caras */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card
          title="Estaciones más económicas"
          subtitle="Top 10 por precio unitario promedio ponderado"
          testid="chart-cheapest-stations"
          right={<Award className="w-5 h-5 text-green-600" />}
        >
          <ResponsiveContainer width="100%" height={320}>
            <BarChart data={precioBarato} layout="vertical" margin={{ top: 5, right: 30, left: 10, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" horizontal={false} />
              <XAxis type="number" tick={{ fontSize: 10, fontWeight: 600 }} stroke="#a3a3a3" domain={["auto", "auto"]} />
              <YAxis type="category" dataKey="estacion" tick={{ fontSize: 10, fontWeight: 700 }} width={130} stroke="#525252" />
              <Tooltip formatter={(v) => `S/ ${v}/gal`} contentStyle={{ borderRadius: 8, fontSize: 12 }} />
              <Bar dataKey="precio_prom" fill="#16A34A" radius={[0, 4, 4, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </Card>

        <Card
          title="Estaciones más caras"
          subtitle="Revisar si el ahorro compensa el precio"
          testid="chart-expensive-stations"
          right={<AlertTriangle className="w-5 h-5 text-red-600" />}
        >
          <ResponsiveContainer width="100%" height={320}>
            <BarChart data={precioCaro} layout="vertical" margin={{ top: 5, right: 30, left: 10, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" horizontal={false} />
              <XAxis type="number" tick={{ fontSize: 10, fontWeight: 600 }} stroke="#a3a3a3" domain={["auto", "auto"]} />
              <YAxis type="category" dataKey="estacion" tick={{ fontSize: 10, fontWeight: 700 }} width={130} stroke="#525252" />
              <Tooltip formatter={(v) => `S/ ${v}/gal`} contentStyle={{ borderRadius: 8, fontSize: 12 }} />
              <Bar dataKey="precio_prom" fill="#DC2626" radius={[0, 4, 4, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </Card>
      </div>

      {/* Heatmap día × hora */}
      <Card
        title="Patrón de cargas: día de la semana × hora"
        subtitle="Identifica picos operativos. Celdas más oscuras = más cargas."
        testid="chart-heatmap"
      >
        <div className="overflow-x-auto">
          <div className="inline-block min-w-full">
            {/* Header horas */}
            <div className="flex text-[9px] font-bold text-neutral-500 pl-10 mb-1">
              {Array.from({ length: 24 }).map((_, h) => (
                <div key={h} style={{ width: 28 }} className="text-center">{h}</div>
              ))}
            </div>
            {DIAS.map((dia) => (
              <div key={dia} className="flex items-center mb-1">
                <div className="w-10 text-[11px] font-bold text-neutral-700">{dia}</div>
                {Array.from({ length: 24 }).map((_, h) => {
                  const count = heatmapByDayHour[`${dia}-${h}`] || 0;
                  const intensity = count / heatmapMax;
                  const bg = count === 0 ? "#f5f5f5" : `rgba(153, 51, 255, ${0.15 + intensity * 0.85})`;
                  return (
                    <div
                      key={h}
                      style={{ width: 26, height: 26, background: bg }}
                      className="mr-0.5 rounded-sm flex items-center justify-center text-[9px] font-bold"
                      title={`${dia} ${h}:00 — ${count} cargas`}
                    >
                      {count > 0 && intensity > 0.4 ? <span className="text-white">{count}</span> : count > 0 ? <span className="text-neutral-700">{count}</span> : null}
                    </div>
                  );
                })}
              </div>
            ))}
          </div>
        </div>
        <div className="flex items-center gap-2 mt-4 text-xs text-neutral-500">
          <Info className="w-3 h-3" /> Hora del día (0-23)
        </div>
      </Card>

      {/* Bottom: Productos + Tarjetas */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card title="Distribución por producto" subtitle="Mezcla de combustibles usada por la flota" testid="chart-products-pct">
          <div className="space-y-3">
            {productos_pct.map((p, i) => (
              <div key={p.producto}>
                <div className="flex justify-between text-sm mb-1">
                  <span className="font-bold text-neutral-900">{p.producto}</span>
                  <span className="font-mono text-neutral-600">{formatNumber(p.galones, 2)} gal · {p.pct}%</span>
                </div>
                <div className="h-2 bg-neutral-100 rounded-full overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all"
                    style={{ width: `${p.pct}%`, background: ["#9933FF", "#F59E0B", "#3B82F6", "#16A34A", "#EC4899"][i % 5] }}
                  />
                </div>
              </div>
            ))}
          </div>
        </Card>

        <Card title="Top medios de identificación" subtitle="Concentración de consumo por tarjeta / medio" testid="chart-top-cards">
          <div className="overflow-x-auto">
            <table className="enered-table">
              <thead>
                <tr><th>Medio / Tarjeta</th><th className="text-right">Cargas</th><th className="text-right">Galones</th><th className="text-right">Gasto</th></tr>
              </thead>
              <tbody>
                {top_tarjetas.map((t, i) => (
                  <tr key={i}>
                    <td className="font-mono font-bold">{t.tarjeta}</td>
                    <td className="text-right">{t.cargas}</td>
                    <td className="text-right">{formatNumber(t.gal, 2)}</td>
                    <td className="text-right font-bold">{formatSoles(t.gasto)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      </div>

      {/* Info note */}
      <div className="bg-brand-50 border border-brand-100 rounded-md p-4 flex items-start gap-3 text-sm">
        <Info className="w-4 h-4 text-brand mt-0.5 flex-shrink-0" />
        <div className="text-neutral-700">
          <b>Cálculo de rendimiento:</b> se calcula como la suma de diferencias consecutivas válidas de kilometraje (máx. 3,000 km entre cargas) dividida entre el total de galones. Esto descarta lecturas erróneas o reinicios de odómetro.
        </div>
      </div>
    </div>
  );
}
