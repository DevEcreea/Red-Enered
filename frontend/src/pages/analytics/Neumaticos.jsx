import React, { useState } from "react";
import {
  BarChart, Bar, ComposedChart, Line, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LabelList,
} from "recharts";

const COLORS = {
  r0: "#5FD0BA",
  r1: "#8039F4",
  r2: "#2D0A4E",
  r3: "#F4C97D",
};

const TABS = [
  { key: "estado",      label: "Estado Operativo" },
  { key: "rendimiento", label: "Rendimiento" },
  { key: "desgaste",    label: "Desgaste" },
];

/* ========================= MOCK DATA ========================= */
const KPIS = [
  { value: "13.4",   label: "PROMEDIO PROFUNDIDAD (MM)" },
  { value: "86.6",   label: "PROMEDIO PRESION (PSI)" },
  { value: "14,625", label: "CANTIDAD LLANTAS NUEVAS ACTIVAS" },
  { value: "5,236",  label: "CANTIDAD LLANTAS RECAPADAS ACTIVAS" },
];

const PROF_PRES = [
  { rec: "0", profundidad: 14.0, presion: 0 },
  { rec: "1", profundidad: 12.2, presion: 85000 },
  { rec: "2", profundidad: 12.9, presion: 0 },
  { rec: "3", profundidad: 12.3, presion: 0 },
];

const CLASE = [
  { tipo: "TRANSPORTE", r0: 9500, r1: 3500, r2: 800, r3: 200, total: "14K" },
  { tipo: "LIVIANO",    r0: 2500, r1: 500,  r2: 0,   r3: 0,   total: "3K" },
  { tipo: "OTR",        r0: 2000, r1: 0,    r2: 0,   r3: 0,   total: "2K" },
];

const OPERATIVO = [
  { tipo: "TRACCION",  r0: 6400, r1: 2100, r2: 500, r3: 0,   total: "9K" },
  { tipo: "DIRECCION", r0: 3300, r1: 0,    r2: 0,   r3: 0,   total: "3K" },
  { tipo: "FLOTANTE",  r0: 0,    r1: 1000, r2: 0,   r3: 0,   total: "1K" },
  { tipo: "REPUESTO",  r0: 200,  r1: 0,    r2: 0,   r3: 0,   total: "0K" },
];

const DISTRIB = [
  { name: "Recapada 0", value: 15000, color: COLORS.r0, label: "15K (73.64%)" },
  { name: "Recapada 1", value: 5000,  color: COLORS.r1, label: "5K (23.15%)" },
  { name: "Recapada 2", value: 1000,  color: COLORS.r2, label: "1K (2.93%)" },
];

const UBICACION = [
  { reg: "COSTA RICA",   r0: 3200, r1: 1300, r2: 0,   r3: 0,   total: "5K" },
  { reg: "ATLÁNTICA",    r0: 2400, r1: 600,  r2: 0,   r3: 0,   total: "3K" },
  { reg: "METROPOLITANA", r0: 1800, r1: 200, r2: 0,   r3: 0,   total: "2K" },
  { reg: "PACÍFICO NIC", r0: 800,  r1: 200,  r2: 0,   r3: 0,   total: "1K" },
  { reg: "CENTRAL ES",   r0: 700,  r1: 300,  r2: 0,   r3: 0,   total: "1K" },
  { reg: "CENTRAL PAN",  r0: 400,  r1: 0,    r2: 0,   r3: 0,   total: "0K" },
  { reg: "OCCIDENTAL",   r0: 300,  r1: 0,    r2: 0,   r3: 0,   total: "0K" },
  { reg: "CENTRAL NIC",  r0: 250,  r1: 0,    r2: 0,   r3: 0,   total: "0K" },
  { reg: "CARIBE",       r0: 200,  r1: 0,    r2: 0,   r3: 0,   total: "0K" },
];

const MARCAS = [
  { marca: "DUNLOP",      r0: 2200, r1: 1100, r2: 0,   r3: 0, total: "3K" },
  { marca: "BRIDGESTONE", r0: 2200, r1: 700,  r2: 100, r3: 0, total: "3K" },
  { marca: "HANKOOK",     r0: 1900, r1: 1000, r2: 100, r3: 0, total: "3K" },
  { marca: "MICHELIN",    r0: 1600, r1: 400,  r2: 0,   r3: 0, total: "2K" },
  { marca: "GOODYEAR",    r0: 1100, r1: 900,  r2: 0,   r3: 0, total: "2K" },
  { marca: "FIRESTONE",   r0: 900,  r1: 100,  r2: 0,   r3: 0, total: "1K" },
  { marca: "SUMITOMO",    r0: 900,  r1: 100,  r2: 0,   r3: 0, total: "1K" },
  { marca: "FALKEN",      r0: 600,  r1: 400,  r2: 0,   r3: 0, total: "1K" },
  { marca: "FENIX WAY",   r0: 600,  r1: 400,  r2: 0,   r3: 0, total: "1K" },
];

const FILTROS = ["Fecha","Unidad de medida","Placa","Tipo de Vehiculo","Marca","Modelo","Dominio","Departamento","Ciudad","Centro de Costos","Cedis"];

/* ========================= UI HELPERS ========================= */
function KpiPill({ value, label, testid }) {
  return (
    <div className="bg-white rounded-2xl border-2 border-[#8039F4]/50 px-4 py-4 flex flex-col items-start justify-center min-h-[100px] shadow-sm" data-testid={testid}>
      <div className="text-[10px] font-bold uppercase tracking-wide text-neutral-500 leading-tight">{label}</div>
      <div className="font-cabinet font-black text-neutral-900 leading-none text-2xl xl:text-3xl mt-2">{value}</div>
    </div>
  );
}

function RecapadaLegend() {
  return (
    <div className="flex items-center gap-2 text-[10px] font-semibold text-neutral-600 mb-2">
      <span className="text-neutral-500">Recapadas</span>
      <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full" style={{ background: COLORS.r0 }} />0</span>
      <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full" style={{ background: COLORS.r1 }} />1</span>
      <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full" style={{ background: COLORS.r2 }} />2</span>
      <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full" style={{ background: COLORS.r3 }} />3</span>
    </div>
  );
}

function ChartCard({ title, legend, children, testid }) {
  return (
    <div className="bg-white rounded-2xl border border-neutral-200 shadow-sm p-4 flex flex-col" data-testid={testid}>
      {title && <div className="text-xs font-semibold text-neutral-700 mb-1">{title}</div>}
      {legend}
      {children}
    </div>
  );
}

/* ========================= MAIN ========================= */
export default function Neumaticos() {
  const [tab, setTab] = useState("estado");

  return (
    <div className="space-y-5" data-testid="neumaticos-page">
      {/* Tabs */}
      <div className="flex flex-wrap items-center gap-6 border-b border-neutral-200" data-testid="neumaticos-tabs">
        {TABS.map((t) => {
          const active = tab === t.key;
          return (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              data-testid={`tab-${t.key}`}
              className={`pb-3 -mb-px text-sm font-bold transition-colors border-b-2 ${
                active ? "text-[#8039F4] border-[#8039F4]" : "text-neutral-500 border-transparent hover:text-neutral-800"
              }`}
            >
              {t.label}
            </button>
          );
        })}
      </div>

      {tab === "estado" ? (
        <div className="flex gap-4">
          <div className="flex-1 min-w-0 space-y-4">
            {/* FILA 1 — KPIs */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3" data-testid="neu-row-1">
              {KPIS.map((k) => <KpiPill key={k.label} {...k} testid={`kpi-${k.label.toLowerCase().replace(/[^a-z0-9]+/g,"-")}`} />)}
            </div>

            {/* FILA 2 — 3 charts */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-3" data-testid="neu-row-2">
              <ChartCard
                title="Promedio Profundidad (mm) y Presion (psi) por Recapada"
                legend={
                  <div className="flex items-center gap-3 text-[10px] font-semibold text-neutral-600 mb-2">
                    <span className="text-neutral-500">Promedio</span>
                    <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full" style={{ background: COLORS.r1 }} />Profundidad (mm)</span>
                    <span className="flex items-center gap-1"><span className="w-3 h-0.5 border-t-2 border-dashed border-neutral-700" />Presion (psi)</span>
                  </div>
                }
                testid="chart-prof-pres"
              >
                <div className="h-[320px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <ComposedChart data={PROF_PRES} margin={{ top: 24, right: 8, left: -8, bottom: 16 }}>
                      <CartesianGrid stroke="#f3f4f6" vertical={false} />
                      <XAxis dataKey="rec" tick={{ fontSize: 10 }} label={{ value: "Recapadas", position: "insideBottom", offset: -8, fontSize: 10, fill: "#737373" }} />
                      <YAxis yAxisId="L" tick={{ fontSize: 10 }} domain={[0, 15]} ticks={[0, 5, 10, 15]} />
                      <YAxis yAxisId="R" orientation="right" tick={{ fontSize: 10 }} domain={[0, 100000]} ticks={[0, 50000, 100000]} tickFormatter={(v) => `${v/1000}K`} />
                      <Tooltip />
                      <Bar yAxisId="L" dataKey="profundidad" fill={COLORS.r1} barSize={50}>
                        <LabelList dataKey="profundidad" position="top" formatter={(v) => v.toFixed(1)} style={{ fontSize: 10, fontWeight: 700, fill: "#8039F4" }} />
                      </Bar>
                      <Line yAxisId="R" type="linear" dataKey="presion" stroke="#2D0A4E" strokeWidth={1.5} strokeDasharray="3 3" dot={{ r: 3, fill: "#2D0A4E" }}>
                        <LabelList dataKey="presion" position="top" formatter={(v) => v > 0 ? `${(v/1000).toFixed(0)}K` : "0K"} style={{ fontSize: 10, fontWeight: 700, fill: "#525252" }} />
                      </Line>
                    </ComposedChart>
                  </ResponsiveContainer>
                </div>
              </ChartCard>

              <ChartCard title="Cantidad de Llantas por Clase y Recapada" legend={<RecapadaLegend />} testid="chart-clase">
                <div className="h-[320px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={CLASE} margin={{ top: 24, right: 8, left: -8, bottom: 8 }}>
                      <CartesianGrid stroke="#f3f4f6" vertical={false} />
                      <XAxis dataKey="tipo" tick={{ fontSize: 10 }} />
                      <YAxis tick={{ fontSize: 10 }} domain={[0, 15000]} ticks={[0, 5000, 10000, 15000]} tickFormatter={(v) => `${v/1000}K`} />
                      <Tooltip />
                      <Bar dataKey="r0" stackId="a" fill={COLORS.r0} barSize={50}>
                        <LabelList dataKey="r0" position="inside" formatter={(v) => v >= 500 ? `${(v/1000).toFixed(1)}K` : ""} fill="#fff" style={{ fontSize: 10, fontWeight: 700 }} />
                      </Bar>
                      <Bar dataKey="r1" stackId="a" fill={COLORS.r1}>
                        <LabelList dataKey="r1" position="inside" formatter={(v) => v >= 500 ? `${(v/1000).toFixed(1)}K` : ""} fill="#fff" style={{ fontSize: 10, fontWeight: 700 }} />
                      </Bar>
                      <Bar dataKey="r2" stackId="a" fill={COLORS.r2} />
                      <Bar dataKey="r3" stackId="a" fill={COLORS.r3}>
                        <LabelList dataKey="total" position="top" style={{ fontSize: 10, fontWeight: 700, fill: "#525252" }} />
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </ChartCard>

              <ChartCard title="Cantidad de Llantas por Estado Operativo y Recapada" legend={<RecapadaLegend />} testid="chart-operativo">
                <div className="h-[320px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={OPERATIVO} margin={{ top: 24, right: 8, left: -8, bottom: 8 }}>
                      <CartesianGrid stroke="#f3f4f6" vertical={false} />
                      <XAxis dataKey="tipo" tick={{ fontSize: 10 }} />
                      <YAxis tick={{ fontSize: 10 }} domain={[0, 9000]} ticks={[0, 2000, 4000, 6000, 8000]} tickFormatter={(v) => `${v/1000}K`} />
                      <Tooltip />
                      <Bar dataKey="r0" stackId="a" fill={COLORS.r0} barSize={50}>
                        <LabelList dataKey="r0" position="inside" formatter={(v) => v >= 500 ? `${(v/1000).toFixed(1)}K` : ""} fill="#fff" style={{ fontSize: 10, fontWeight: 700 }} />
                      </Bar>
                      <Bar dataKey="r1" stackId="a" fill={COLORS.r1}>
                        <LabelList dataKey="r1" position="inside" formatter={(v) => v >= 500 ? `${(v/1000).toFixed(1)}K` : ""} fill="#fff" style={{ fontSize: 10, fontWeight: 700 }} />
                      </Bar>
                      <Bar dataKey="r2" stackId="a" fill={COLORS.r2} />
                      <Bar dataKey="r3" stackId="a" fill={COLORS.r3}>
                        <LabelList dataKey="total" position="top" style={{ fontSize: 10, fontWeight: 700, fill: "#525252" }} />
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </ChartCard>
            </div>

            {/* FILA 3 — Donut + 2 horizontal stacked */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-3" data-testid="neu-row-3">
              <ChartCard title="Distribucion Porcentual de Llantas por Recapada" legend={<RecapadaLegend />} testid="chart-distrib">
                <div className="h-[320px] relative">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie data={DISTRIB} dataKey="value" innerRadius={75} outerRadius={120} paddingAngle={0} stroke="#fff" strokeWidth={2}
                        label={({ payload }) => payload.label}
                        labelLine={{ stroke: "#9ca3af", strokeWidth: 1 }}
                      >
                        {DISTRIB.map((d, i) => <Cell key={i} fill={d.color} />)}
                      </Pie>
                      <Tooltip />
                    </PieChart>
                  </ResponsiveContainer>
                  <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                    <div className="font-cabinet font-black text-3xl text-neutral-900">19,861</div>
                    <div className="text-[11px] text-neutral-500 font-semibold">Llantas en Uso</div>
                  </div>
                </div>
              </ChartCard>

              <ChartCard title="Cantidad Llantas por Ubicacion, Tipo de Vehiculo, Dominio y Recapadas" legend={<RecapadaLegend />} testid="chart-ubicacion">
                <div className="h-[320px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart layout="vertical" data={UBICACION} margin={{ top: 8, right: 36, left: 24, bottom: 16 }}>
                      <CartesianGrid stroke="#f3f4f6" />
                      <XAxis type="number" tick={{ fontSize: 10 }} domain={[0, 5000]} ticks={[0, 2000, 4000]} tickFormatter={(v) => `${v/1000}K`} />
                      <YAxis type="category" dataKey="reg" tick={{ fontSize: 9 }} width={100} label={{ value: "Region", angle: -90, position: "insideLeft", fontSize: 10, fill: "#737373" }} />
                      <Tooltip />
                      <Bar dataKey="r0" stackId="a" fill={COLORS.r0} barSize={14}>
                        <LabelList dataKey="r0" position="inside" formatter={(v) => v >= 500 ? `${(v/1000).toFixed(1)}K` : ""} fill="#fff" style={{ fontSize: 9, fontWeight: 700 }} />
                      </Bar>
                      <Bar dataKey="r1" stackId="a" fill={COLORS.r1}>
                        <LabelList dataKey="r1" position="inside" formatter={(v) => v >= 500 ? `${(v/1000).toFixed(1)}K` : ""} fill="#fff" style={{ fontSize: 9, fontWeight: 700 }} />
                      </Bar>
                      <Bar dataKey="r2" stackId="a" fill={COLORS.r2} />
                      <Bar dataKey="r3" stackId="a" fill={COLORS.r3}>
                        <LabelList dataKey="total" position="right" style={{ fontSize: 9, fontWeight: 700, fill: "#525252" }} />
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </ChartCard>

              <ChartCard title="Cantidad Llantas por Marca, Modelo y Recapadas" legend={<RecapadaLegend />} testid="chart-marcas">
                <div className="h-[320px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart layout="vertical" data={MARCAS} margin={{ top: 8, right: 36, left: 24, bottom: 16 }}>
                      <CartesianGrid stroke="#f3f4f6" />
                      <XAxis type="number" tick={{ fontSize: 10 }} domain={[0, 4000]} ticks={[0, 2000]} tickFormatter={(v) => `${v/1000}K`} />
                      <YAxis type="category" dataKey="marca" tick={{ fontSize: 9 }} width={90} label={{ value: "Marca", angle: -90, position: "insideLeft", fontSize: 10, fill: "#737373" }} />
                      <Tooltip />
                      <Bar dataKey="r0" stackId="a" fill={COLORS.r0} barSize={14}>
                        <LabelList dataKey="r0" position="inside" formatter={(v) => v >= 500 ? `${(v/1000).toFixed(1)}K` : ""} fill="#fff" style={{ fontSize: 9, fontWeight: 700 }} />
                      </Bar>
                      <Bar dataKey="r1" stackId="a" fill={COLORS.r1}>
                        <LabelList dataKey="r1" position="inside" formatter={(v) => v >= 500 ? `${(v/1000).toFixed(1)}K` : ""} fill="#fff" style={{ fontSize: 9, fontWeight: 700 }} />
                      </Bar>
                      <Bar dataKey="r2" stackId="a" fill={COLORS.r2} />
                      <Bar dataKey="r3" stackId="a" fill={COLORS.r3}>
                        <LabelList dataKey="total" position="right" style={{ fontSize: 9, fontWeight: 700, fill: "#525252" }} />
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </ChartCard>
            </div>
          </div>

          {/* Filtros */}
          <aside className="hidden xl:block w-56 flex-shrink-0 space-y-3" data-testid="neu-filtros">
            {FILTROS.map((f) => (
              <div key={f} className="bg-white border border-neutral-200 rounded-xl px-3 py-2 shadow-sm">
                <div className="text-[10px] font-bold text-neutral-500 uppercase tracking-wide">{f}</div>
                <select className="w-full text-sm font-semibold text-neutral-700 outline-none bg-transparent mt-1" defaultValue="All">
                  <option value="All">All</option>
                </select>
              </div>
            ))}
          </aside>
        </div>
      ) : (
        <div className="min-h-[400px]" data-testid={`tab-content-${tab}`} />
      )}
    </div>
  );
}
