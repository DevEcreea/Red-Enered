import React, { useState } from "react";
import {
  LineChart, Line, AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceArea,
  Legend,
} from "recharts";

const TABS = [
  { key: "operacion",  label: "Operación General" },
  { key: "gestion",    label: "Gestión de Combustible" },
  { key: "cargas",     label: "Cargas Combustibles" },
  { key: "excedentes", label: "Costos Excedentes" },
];

/* =========================== MOCK DATA =========================== */
const KPIS = [
  { value: "02",    unit: "",    label: "VEHICULOS" },
  { value: "15,69", unit: "",    label: "RENDIMIENTO PROMEDIO KM/GALON" },
  { value: "10K",   unit: "",    label: "DISTANCIA RECORRIDA" },
  { value: "10",    unit: "GL",  label: "CONSUMO DE COMBUSTIBLE EN RALENTI" },
  { value: "0",     unit: "RPM", label: "SOBRE REVOLUCION" },
  { value: "0",     unit: "C°",  label: "SOBRE TEMPERATURA" },
  { value: "1",     unit: "GL",  label: "COMBUSTIBLE/HORA" },
  { value: "S/ 100", unit: "",   label: "COSTO TOTAL" },
  { value: "10",    unit: "GL",  label: "CONSUMO TOTAL" },
];

const RENDIMIENTO_DATA = [
  { fecha: "Ene 2",  val: 0 },
  { fecha: "Ene 9",  val: 0 },
  { fecha: "Ene 16", val: 17 },
  { fecha: "Ene 20", val: 13 },
  { fecha: "Ene 23", val: 19 },
  { fecha: "Ene 30", val: 0 },
  { fecha: "Feb 6",  val: 0 },
  { fecha: "Feb 13", val: 17 },
  { fecha: "Feb 20", val: 12 },
  { fecha: "Feb 27", val: 17 },
  { fecha: "Mar 6",  val: 14 },
  { fecha: "Mar 13", val: 13 },
  { fecha: "Mar 20", val: 18 },
];

const DIST_REND_BARS = [
  { placa: "BFY-758", distancia: 1500, rendimiento: 10 },
];

const HORAS_DATA = [
  { fecha: "Ene 2",  motor: 0,  ralenti: 0 },
  { fecha: "Ene 9",  motor: 4,  ralenti: 1 },
  { fecha: "Ene 16", motor: 13, ralenti: 5 },
  { fecha: "Ene 23", motor: 2,  ralenti: 0.5 },
  { fecha: "Ene 30", motor: 0,  ralenti: 0 },
  { fecha: "Feb 6",  motor: 0,  ralenti: 0 },
  { fecha: "Feb 13", motor: 2,  ralenti: 0.4 },
  { fecha: "Feb 20", motor: 0,  ralenti: 0 },
  { fecha: "Feb 27", motor: 8,  ralenti: 2 },
  { fecha: "Mar 6",  motor: 1,  ralenti: 0.2 },
  { fecha: "Mar 13", motor: 4,  ralenti: 1 },
  { fecha: "Mar 20", motor: 0,  ralenti: 0 },
];

const HORAS_STACK = [
  { placa: "BFY-758", motor: 56.36, ralenti: 12 },
];

const BANDAS = [
  { name: "Banda verde",     value: 51, color: "#7BA94E" },
  { name: "Bajo torque",     value: 44, color: "#E8A33D" },
  { name: "Banda potencia",  value: 4,  color: "#4A90D9" },
  { name: "Sobre revolución",value: 1,  color: "#D04B4B" },
];

const BANDAS_MES = [
  { mes: "Enero",   torque: 1.5, verde: 0.1,  potencia: 0.1,  sobre: 0 },
  { mes: " ",      torque: 3.2, verde: 0.2,  potencia: 0.1,  sobre: 0 },
  { mes: "Febrero", torque: 1.2, verde: 0.1,  potencia: 0.05, sobre: 0 },
  { mes: " ",     torque: 1.7, verde: 0.1,  potencia: 0.1,  sobre: 0 },
  { mes: "Marzo",   torque: 3.0, verde: 0.15, potencia: 0.1,  sobre: 0 },
];

const BANDAS_HORIZ = [
  { placa: "BFY-758", torque: 44, verde: 51, potencia: 4, sobre: 1 },
];

const TABLE = [
  { idx: 1, placa: "BFY-758", dist: 2344.00, consumo: 149.23, rend: 15.71, hora: 1.90, costo: 173.11, ralenti: 21.04, hi: "red" },
  { idx: 2, placa: "BCD-709", dist: 0.10,    consumo: 0.17,   rend: 0.59,  hora: 0.03, costo: 0.20,   ralenti: 0.14,  hi: "green" },
];

const FILTROS = [
  { label: "Fecha" },
  { label: "Unidad de medida" },
  { label: "Placa" },
  { label: "Tipo de Vehiculo" },
  { label: "Marca" },
  { label: "Modelo" },
  { label: "Dominio" },
  { label: "Departamento" },
  { label: "Ciudad" },
  { label: "Centro de Costos" },
  { label: "Cedis" },
];

/* =========================== UI HELPERS =========================== */
function KpiPill({ value, unit, label }) {
  return (
    <div className="bg-white rounded-2xl border border-neutral-200 px-2 py-4 flex flex-col items-center justify-center text-center min-h-[110px] shadow-sm" data-testid={`kpi-${label.toLowerCase().replace(/\s+/g, "-")}`}>
      <div className="font-cabinet font-black text-neutral-900 leading-none text-xl xl:text-2xl">
        {value}{unit && <span className="text-base font-bold ml-1">{unit}</span>}
      </div>
      <div className="text-[9px] font-bold uppercase tracking-wide text-neutral-600 mt-2 leading-tight">
        {label}
      </div>
    </div>
  );
}

function MiniStat({ value, label }) {
  return (
    <div className="bg-white rounded-2xl border border-neutral-200 px-4 py-4 flex flex-col justify-center min-h-[90px] shadow-sm">
      <div className="font-cabinet font-black text-2xl text-neutral-900 leading-none">{value}</div>
      <div className="text-[11px] text-neutral-500 font-semibold mt-2">{label}</div>
    </div>
  );
}

function ChartCard({ title, children, testid, padded = true }) {
  return (
    <div className={`bg-white rounded-2xl border border-neutral-200 shadow-sm ${padded ? "p-4" : ""}`} data-testid={testid}>
      {title && <div className="text-sm font-bold text-neutral-700 mb-2 text-center">{title}</div>}
      {children}
    </div>
  );
}

/* =========================== MAIN =========================== */
export default function Combustible() {
  const [tab, setTab] = useState("operacion");

  return (
    <div className="space-y-5" data-testid="combustibles-page">
      {/* Tabs */}
      <div className="flex flex-wrap items-center gap-6 border-b border-neutral-200" data-testid="combustibles-tabs">
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

      {tab === "operacion" ? (
        <div className="flex gap-4">
          {/* CONTENIDO PRINCIPAL */}
          <div className="flex-1 min-w-0 space-y-4">
            {/* ===== FILA 1 — 9 KPI pills ===== */}
            <div className="grid grid-cols-3 sm:grid-cols-5 lg:grid-cols-9 gap-2.5" data-testid="comb-row-1">
              {KPIS.map((k) => <KpiPill key={k.label} {...k} />)}
            </div>

            {/* ===== FILA 2 — Rendimiento + mini stats + bars ===== */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-3" data-testid="comb-row-2">
              <ChartCard title="Rendimiento de combustible" testid="chart-rendimiento">
                <div className="relative h-[260px]">
                  <span className="absolute top-1 right-2 text-[10px] bg-neutral-100 border border-neutral-200 px-2 py-0.5 rounded-full font-semibold text-neutral-600 z-10">7,90 — 19,51</span>
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={RENDIMIENTO_DATA} margin={{ top: 16, right: 12, left: -10, bottom: 8 }}>
                      <CartesianGrid stroke="#f3f4f6" />
                      <XAxis dataKey="fecha" tick={{ fontSize: 10 }} interval="preserveStartEnd" />
                      <YAxis tick={{ fontSize: 10 }} domain={[0, 20]} ticks={[0, 5, 10, 15]} />
                      <Tooltip />
                      <ReferenceArea y1={7.9} y2={19.51} fill="#9ca3af" fillOpacity={0.18} />
                      <Line type="linear" dataKey="val" stroke="#4A90D9" strokeWidth={1.5} dot={false} />
                    </LineChart>
                  </ResponsiveContainer>
                  <div className="text-[10px] text-neutral-500 -mt-3 text-center">Rendimiento de combustible</div>
                </div>
              </ChartCard>

              <div className="grid grid-cols-2 gap-3">
                <MiniStat value="1,50 K" label="Kilómetros recorridos" />
                <MiniStat value="0,10 K" label="Consumo de combustible" />
                <div className="col-span-2">
                  <ChartCard testid="chart-dist-rend">
                    <div className="h-[180px]">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={DIST_REND_BARS} margin={{ top: 8, right: 24, left: -10, bottom: 8 }}>
                          <CartesianGrid stroke="#f3f4f6" vertical={false} />
                          <XAxis dataKey="placa" tick={{ fontSize: 10 }} />
                          <YAxis yAxisId="L" tick={{ fontSize: 10 }} />
                          <YAxis yAxisId="R" orientation="right" tick={{ fontSize: 10 }} />
                          <Tooltip />
                          <Legend wrapperStyle={{ fontSize: 10 }} />
                          <Bar yAxisId="L" dataKey="distancia" name="Distancia recorrida (km)" fill="#67A8C9" barSize={50} />
                          <Bar yAxisId="R" dataKey="rendimiento" name="Rendimiento de combustible" fill="#A1B962" barSize={50} />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  </ChartCard>
                </div>
              </div>
            </div>

            {/* ===== FILA 3 — Horas motor / ralentí ===== */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-3" data-testid="comb-row-3">
              <ChartCard title="Horas motor - Ralentí" testid="chart-horas">
                <div className="h-[260px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={HORAS_DATA} margin={{ top: 8, right: 12, left: -10, bottom: 8 }}>
                      <CartesianGrid stroke="#f3f4f6" />
                      <XAxis dataKey="fecha" tick={{ fontSize: 10 }} interval="preserveStartEnd" />
                      <YAxis tick={{ fontSize: 10 }} ticks={[0, 2, 4, 6, 8, 10, 12]} />
                      <Tooltip />
                      <Legend wrapperStyle={{ fontSize: 10 }} />
                      <Area type="monotone" dataKey="motor"   name="Horas motor"   stroke="#9DCBD2" fill="#9DCBD2" fillOpacity={0.4} />
                      <Area type="monotone" dataKey="ralenti" name="Horas ralentí" stroke="#3F6FB4" fill="#3F6FB4" fillOpacity={0.4} />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </ChartCard>

              <div className="grid grid-cols-2 gap-3">
                <MiniStat value="0,06 K" label="Horas motor" />
                <MiniStat value="0,02 K" label="Horas ralentí" />
                <div className="col-span-2">
                  <ChartCard testid="chart-horas-stack">
                    <div className="h-[180px]">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={HORAS_STACK} margin={{ top: 8, right: 24, left: -10, bottom: 8 }}>
                          <CartesianGrid stroke="#f3f4f6" vertical={false} />
                          <XAxis dataKey="placa" tick={{ fontSize: 10 }} />
                          <YAxis tick={{ fontSize: 10 }} />
                          <Tooltip />
                          <Legend wrapperStyle={{ fontSize: 10 }} />
                          <Bar dataKey="motor"   stackId="a" name="Horas motor"   fill="#67A8C9" barSize={80} />
                          <Bar dataKey="ralenti" stackId="a" name="Horas ralentí" fill="#D45F5F" barSize={80} />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  </ChartCard>
                </div>
              </div>
            </div>

            {/* ===== FILA 4 — Donut + Bandas mes + Horizontal ===== */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-3" data-testid="comb-row-4">
              <div className="grid grid-cols-1 gap-3">
                <ChartCard testid="chart-bandas-donut">
                  <div className="h-[200px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie data={BANDAS} dataKey="value" innerRadius={50} outerRadius={85} paddingAngle={1} stroke="#fff">
                          {BANDAS.map((b, i) => <Cell key={i} fill={b.color} />)}
                        </Pie>
                        <Tooltip />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                </ChartCard>
                <ChartCard testid="chart-bandas-horiz">
                  <div className="h-[120px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart layout="vertical" data={BANDAS_HORIZ} stackOffset="expand" margin={{ top: 8, right: 12, left: 8, bottom: 8 }}>
                        <CartesianGrid stroke="#f3f4f6" />
                        <XAxis type="number" tickFormatter={(v) => `${Math.round(v * 100)}%`} tick={{ fontSize: 10 }} domain={[0, 1]} ticks={[0, 0.2, 0.4, 0.6, 0.8, 1]} />
                        <YAxis type="category" dataKey="placa" tick={{ fontSize: 10 }} />
                        <Tooltip />
                        <Bar dataKey="torque"   stackId="a" fill="#E8A33D" />
                        <Bar dataKey="verde"    stackId="a" fill="#7BA94E" />
                        <Bar dataKey="potencia" stackId="a" fill="#4A90D9" />
                        <Bar dataKey="sobre"    stackId="a" fill="#D04B4B" />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </ChartCard>
              </div>

              <ChartCard testid="chart-bandas-mes">
                <div className="h-[300px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={BANDAS_MES} margin={{ top: 8, right: 12, left: -10, bottom: 8 }}>
                      <CartesianGrid stroke="#f3f4f6" />
                      <XAxis dataKey="mes" tick={{ fontSize: 10 }} />
                      <YAxis tick={{ fontSize: 10 }} />
                      <Tooltip />
                      <Area type="monotone" dataKey="torque"   name="Tiempo en bajo torque (Horas)"     stroke="#E8A33D" fill="#E8A33D" fillOpacity={0.55} />
                      <Area type="monotone" dataKey="verde"    name="Tiempo en banda verde (Horas)"     stroke="#7BA94E" fill="#7BA94E" fillOpacity={0.45} />
                      <Area type="monotone" dataKey="potencia" name="Tiempo en banda potencia (Horas)"  stroke="#4A90D9" fill="#4A90D9" fillOpacity={0.4} />
                      <Area type="monotone" dataKey="sobre"    name="Tiempo en sobre-revolución (Horas)" stroke="#D04B4B" fill="#D04B4B" fillOpacity={0.4} />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
                <div className="text-[10px] text-neutral-500 flex flex-wrap gap-x-3 gap-y-1 mt-2 justify-center">
                  <span><span className="inline-block w-2 h-2 rounded-full bg-[#E8A33D] mr-1" />Tiempo en bajo torque (Horas)</span>
                  <span><span className="inline-block w-2 h-2 rounded-full bg-[#7BA94E] mr-1" />Tiempo en banda verde (Horas)</span>
                  <span><span className="inline-block w-2 h-2 rounded-full bg-[#4A90D9] mr-1" />Tiempo en banda potencia (Horas)</span>
                  <span><span className="inline-block w-2 h-2 rounded-full bg-[#D04B4B] mr-1" />Tiempo en sobre-revolución (Horas)</span>
                </div>
              </ChartCard>
            </div>

            {/* ===== FILA 5 — Tabla Detalle ===== */}
            <div className="space-y-3" data-testid="comb-row-5">
              <h3 className="font-cabinet font-bold text-lg text-[#8039F4]">Detalle de Combustible</h3>
              <div className="bg-white rounded-2xl border border-neutral-200 shadow-sm overflow-x-auto">
                <table className="w-full text-sm" data-testid="table-detalle">
                  <thead className="bg-neutral-50 border-b border-neutral-200">
                    <tr className="text-[11px] font-bold text-neutral-500 uppercase tracking-wide">
                      <th className="px-4 py-3 text-left">#</th>
                      <th className="px-4 py-3 text-left">Placa</th>
                      <th className="px-4 py-3 text-right">Distancia recorrida (km) ↓</th>
                      <th className="px-4 py-3 text-right">Consumo total de combustible</th>
                      <th className="px-4 py-3 text-right">Rendimiento de combustible</th>
                      <th className="px-4 py-3 text-right">Combustible/Hora</th>
                      <th className="px-4 py-3 text-right">Costo total de combustible</th>
                      <th className="px-4 py-3 text-right">Tiempo en ralentí (horas)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-neutral-100">
                    {TABLE.map((r) => (
                      <tr key={r.idx} data-testid={`table-row-${r.placa}`}>
                        <td className="px-4 py-3 text-neutral-700">{r.idx}</td>
                        <td className="px-4 py-3 font-semibold text-neutral-900">{r.placa}</td>
                        <td className="px-4 py-3 text-right text-neutral-700">{r.dist.toLocaleString("es-PE", { minimumFractionDigits: 2 })}</td>
                        <td className={`px-4 py-3 text-right font-bold ${r.hi === "red" ? "bg-[#F2796E]/80 text-white" : "bg-[#5FBA8A]/80 text-white"}`}>
                          {r.consumo.toFixed(2)}
                        </td>
                        <td className="px-4 py-3 text-right text-neutral-700">{r.rend.toFixed(2)}</td>
                        <td className="px-4 py-3 text-right text-neutral-700">{r.hora.toFixed(2)}</td>
                        <td className="px-4 py-3 text-right text-neutral-700">{r.costo.toFixed(2)}</td>
                        <td className="px-4 py-3 text-right text-neutral-700">{r.ralenti.toFixed(2)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          {/* FILTROS DERECHA */}
          <aside className="hidden xl:block w-56 flex-shrink-0 space-y-3" data-testid="comb-filtros">
            {FILTROS.map((f) => (
              <div key={f.label} className="bg-white border border-neutral-200 rounded-xl px-3 py-2 shadow-sm">
                <div className="text-[10px] font-bold text-neutral-500 uppercase tracking-wide">{f.label}</div>
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
