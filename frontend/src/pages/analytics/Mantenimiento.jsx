import React, { useState } from "react";
import {
  LineChart, Line, AreaChart, Area, BarChart, Bar, ComposedChart,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend, LabelList,
} from "recharts";

const C_CORR = "#8039F4";
const C_PREV = "#5FD0BA";

const TABS = [
  { key: "correctivos",  label: "Correctivos vs Preventivos" },
  { key: "performance",  label: "Performance Tickets" },
  { key: "servicios",    label: "Servicios Realizados" },
  { key: "arbol",        label: "Arbol de Gastos" },
  { key: "apego",        label: "Apego Preventivos" },
];

/* ========================= MOCK DATA ========================= */
const KPIS = [
  { value: "S/ 2.54",        label: "COSTO KM MANTENIMIENTOS" },
  { value: "S/ 10,588,295",  label: "COSTO TOTAL MANTENIMIENTOS" },
  { value: "1,610",          label: "CANTIDAD MANTENIMIENTOS" },
  { value: "1.3",            label: "TASA CORRECTIVOS VS PREVENTIVOS" },
];

const COSTO_FECHA = [
  { mes: "ene", correctivo: 0.85, preventivo: 0.30 },
  { mes: "feb", correctivo: 0.65, preventivo: 0.35 },
  { mes: "mar", correctivo: 0.95, preventivo: 0.40 },
  { mes: "abr", correctivo: 0.70, preventivo: 0.45 },
  { mes: "may", correctivo: 0.40, preventivo: 0.35 },
  { mes: "jun", correctivo: 0.55, preventivo: 0.30 },
  { mes: "jul", correctivo: 0.55, preventivo: 0.30 },
  { mes: "ago", correctivo: 0.40, preventivo: 0.25 },
  { mes: "sep", correctivo: 0.70, preventivo: 0.30 },
  { mes: "oct", correctivo: 0.55, preventivo: 0.25 },
  { mes: "nov", correctivo: 0.75, preventivo: 0.20 },
  { mes: "dic", correctivo: 0.90, preventivo: 0.15 },
];

const DIST_PCT = COSTO_FECHA.map((d) => {
  const t = d.correctivo + d.preventivo;
  return { mes: d.mes, correctivo: +(d.correctivo / t * 100).toFixed(1), preventivo: +(d.preventivo / t * 100).toFixed(1) };
});

const PROMEDIO = [
  { mes: "ene", correctivo: 10149, preventivo: 5853,  cantCorr: 68, cantPrev: 89 },
  { mes: "feb", correctivo: 9134,  preventivo: 5554,  cantCorr: 54, cantPrev: 81 },
  { mes: "mar", correctivo: 11389, preventivo: 4932,  cantCorr: 57, cantPrev: 81 },
  { mes: "abr", correctivo: 7717,  preventivo: 4664,  cantCorr: 52, cantPrev: 75 },
  { mes: "may", correctivo: 5810,  preventivo: 4691,  cantCorr: 58, cantPrev: 68 },
  { mes: "jun", correctivo: 4630,  preventivo: 4310,  cantCorr: 54, cantPrev: 76 },
  { mes: "jul", correctivo: 3170,  preventivo: 3810,  cantCorr: 58, cantPrev: 86 },
  { mes: "ago", correctivo: 4080,  preventivo: 3813,  cantCorr: 58, cantPrev: 82 },
  { mes: "sep", correctivo: 4995,  preventivo: 3819,  cantCorr: 56, cantPrev: 91 },
  { mes: "oct", correctivo: 4513,  preventivo: 4286,  cantCorr: 59, cantPrev: 75 },
  { mes: "nov", correctivo: 8321,  preventivo: 5239,  cantCorr: 68, cantPrev: 81 },
  { mes: "dic", correctivo: 12874, preventivo: 3744,  cantCorr: 62, cantPrev: 63 },
];

const UBI_TOTAL = [
  { tipo: "PICKUP",         correctivo: 6.4, preventivo: 2.8 },
  { tipo: "FURGON LIVIANO", correctivo: 0.7, preventivo: 0.1 },
  { tipo: "SEDAN",          correctivo: 0.4, preventivo: 0.1 },
  { tipo: "MOTOCICLETA",    correctivo: 0.1, preventivo: 0.0 },
  { tipo: "SEDAN HIBRIDO",  correctivo: 0.0, preventivo: 0.0 },
];

const UBI_KM = [
  { tipo: "MOTOCICLETA",    correctivo: 3.7, preventivo: 0.0 },
  { tipo: "PICKUP",         correctivo: 2.0, preventivo: 0.9 },
  { tipo: "FURGON LIVIANO", correctivo: 1.6, preventivo: 0.4 },
  { tipo: "SEDAN",          correctivo: 0.6, preventivo: 0.3 },
];

const FILTROS = ["Fecha","Unidad de medida","Placa","Tipo de Vehiculo","Marca","Modelo","Dominio","Departamento","Ciudad","Centro de Costos","Cedis"];

/* ========================= UI HELPERS ========================= */
function KpiPill({ value, label, testid }) {
  return (
    <div className="bg-white rounded-2xl border border-neutral-200 px-4 py-4 flex flex-col items-center justify-center text-center min-h-[100px] shadow-sm" data-testid={testid}>
      <div className="text-[10px] font-bold uppercase tracking-wide text-neutral-500 leading-tight">{label}</div>
      <div className="font-cabinet font-black text-neutral-900 leading-none text-2xl xl:text-3xl mt-2">{value}</div>
    </div>
  );
}

function ChartCard({ title, children, testid }) {
  return (
    <div className="bg-white rounded-2xl border border-neutral-200 shadow-sm p-4" data-testid={testid}>
      {title && <div className="text-xs font-semibold text-neutral-700 mb-2">{title}</div>}
      <div className="flex items-center gap-4 text-[10px] font-semibold text-neutral-600 mb-2">
        <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full" style={{ background: C_CORR }} />CORRECTIVO</span>
        <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full" style={{ background: C_PREV }} />PREVENTIVO</span>
      </div>
      {children}
    </div>
  );
}

/* ========================= MAIN ========================= */
export default function Mantenimiento() {
  const [tab, setTab] = useState("correctivos");

  return (
    <div className="space-y-5" data-testid="mtto-page">
      {/* Tabs */}
      <div className="flex flex-wrap items-center gap-6 border-b border-neutral-200" data-testid="mtto-tabs">
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

      {tab === "correctivos" ? (
        <div className="flex gap-4">
          <div className="flex-1 min-w-0 space-y-4">
            {/* FILA 1 — KPIs */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3" data-testid="mtto-row-1">
              {KPIS.map((k) => <KpiPill key={k.label} {...k} testid={`kpi-${k.label.toLowerCase().replace(/\s+/g,"-")}`} />)}
            </div>

            {/* FILA 2 — Costo Total + Distribución */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-3" data-testid="mtto-row-2">
              <ChartCard title="Costo Total por Fecha y Tipo de Mantenimiento" testid="chart-costo-fecha">
                <div className="h-[280px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={COSTO_FECHA} margin={{ top: 8, right: 12, left: -8, bottom: 8 }}>
                      <CartesianGrid stroke="#f3f4f6" />
                      <XAxis dataKey="mes" tick={{ fontSize: 10 }} />
                      <YAxis tick={{ fontSize: 10 }} tickFormatter={(v) => `$${v.toFixed(1)}M`} />
                      <Tooltip formatter={(v) => `S/ ${v}M`} />
                      <Line type="monotone" dataKey="correctivo" stroke={C_CORR} strokeWidth={2.5} dot={false} />
                      <Line type="monotone" dataKey="preventivo" stroke={C_PREV} strokeWidth={2.5} dot={false} />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </ChartCard>

              <ChartCard title="Distribucion Porcentual por Fecha y Tipo de Mantenimiento" testid="chart-dist-pct">
                <div className="h-[280px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={DIST_PCT} margin={{ top: 8, right: 12, left: -8, bottom: 8 }}>
                      <CartesianGrid stroke="#f3f4f6" />
                      <XAxis dataKey="mes" tick={{ fontSize: 10 }} />
                      <YAxis tick={{ fontSize: 10 }} tickFormatter={(v) => `${v}%`} domain={[0,100]} />
                      <Tooltip formatter={(v) => `${v}%`} />
                      <Area type="monotone" dataKey="correctivo" stackId="a" stroke={C_CORR} fill={C_CORR} fillOpacity={0.55} strokeWidth={2} />
                      <Area type="monotone" dataKey="preventivo" stackId="a" stroke={C_PREV} fill={C_PREV} fillOpacity={0.6} strokeWidth={2} />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </ChartCard>
            </div>

            {/* FILA 3 — Promedio + Ubicación total + Ubicación km */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-3" data-testid="mtto-row-3">
              <ChartCard title="Costo Promedio y Cantidad de Mantenimientos por Fecha" testid="chart-promedio">
                <div className="h-[320px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <ComposedChart data={PROMEDIO} margin={{ top: 8, right: 4, left: -8, bottom: 8 }}>
                      <CartesianGrid stroke="#f3f4f6" />
                      <XAxis dataKey="mes" tick={{ fontSize: 10 }} />
                      <YAxis yAxisId="L" tick={{ fontSize: 10 }} tickFormatter={(v) => `$${(v/1000).toFixed(0)}K`} />
                      <YAxis yAxisId="R" orientation="right" tick={{ fontSize: 10 }} domain={[40, 100]} />
                      <Tooltip />
                      <Bar yAxisId="L" dataKey="correctivo" stackId="a" fill={C_CORR} barSize={22} />
                      <Bar yAxisId="L" dataKey="preventivo" stackId="a" fill={C_PREV} barSize={22} />
                      <Line yAxisId="R" type="monotone" dataKey="cantCorr" stroke={C_CORR} strokeDasharray="3 3" strokeWidth={1.5} dot={{ r: 3, fill: C_CORR }} name="Cantidad Correctivos" />
                      <Line yAxisId="R" type="monotone" dataKey="cantPrev" stroke={C_PREV} strokeDasharray="3 3" strokeWidth={1.5} dot={{ r: 3, fill: C_PREV }} name="Cantidad Preventivos" />
                    </ComposedChart>
                  </ResponsiveContainer>
                </div>
              </ChartCard>

              <ChartCard title="Costo Total por Ubicacion y Vehiculo" testid="chart-ubi-total">
                <div className="h-[320px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart layout="vertical" data={UBI_TOTAL} margin={{ top: 8, right: 32, left: 32, bottom: 8 }}>
                      <CartesianGrid stroke="#f3f4f6" />
                      <XAxis type="number" tick={{ fontSize: 10 }} tickFormatter={(v) => `$${v}M`} />
                      <YAxis type="category" dataKey="tipo" tick={{ fontSize: 10 }} width={100} />
                      <Tooltip formatter={(v) => `S/ ${v}M`} />
                      <Bar dataKey="correctivo" stackId="a" fill={C_CORR}>
                        <LabelList dataKey="correctivo" position="inside" formatter={(v) => v >= 0.3 ? `$${v}M` : ""} fill="#fff" style={{ fontSize: 10, fontWeight: 700 }} />
                      </Bar>
                      <Bar dataKey="preventivo" stackId="a" fill={C_PREV}>
                        <LabelList dataKey="preventivo" position="inside" formatter={(v) => v >= 0.3 ? `$${v}M` : ""} fill="#fff" style={{ fontSize: 10, fontWeight: 700 }} />
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </ChartCard>

              <ChartCard title="Costo en Mantenimientos por Km por Ubicacion y Vehiculo" testid="chart-ubi-km">
                <div className="h-[320px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart layout="vertical" data={UBI_KM} margin={{ top: 8, right: 32, left: 32, bottom: 8 }}>
                      <CartesianGrid stroke="#f3f4f6" />
                      <XAxis type="number" tick={{ fontSize: 10 }} tickFormatter={(v) => `$${v}`} />
                      <YAxis type="category" dataKey="tipo" tick={{ fontSize: 10 }} width={100} />
                      <Tooltip formatter={(v) => `S/ ${v}`} />
                      <Bar dataKey="correctivo" stackId="a" fill={C_CORR}>
                        <LabelList dataKey="correctivo" position="inside" formatter={(v) => v > 0 ? `$${v}` : ""} fill="#fff" style={{ fontSize: 10, fontWeight: 700 }} />
                      </Bar>
                      <Bar dataKey="preventivo" stackId="a" fill={C_PREV}>
                        <LabelList dataKey="preventivo" position="inside" formatter={(v) => v >= 0.3 ? `$${v}` : ""} fill="#fff" style={{ fontSize: 10, fontWeight: 700 }} />
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </ChartCard>
            </div>
          </div>

          {/* FILTROS DERECHA */}
          <aside className="hidden xl:block w-56 flex-shrink-0 space-y-3" data-testid="mtto-filtros">
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
