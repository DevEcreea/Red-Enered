import React, { useState } from "react";
import {
  LineChart, Line, BarChart, Bar,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend, ReferenceLine, LabelList,
} from "recharts";

const C_SALIDA  = "#8039F4";
const C_ENTRADA = "#5FD0BA";

const TABS = [
  { key: "fallas",    label: "Fallas y Adherencia" },
  { key: "preguntas", label: "Preguntas desaprobadas" },
];

/* ========================= MOCK DATA ========================= */
const KPIS = [
  { value: "35.0 %", label: "PORCENTAJE CHECKLISTS SIN FALLAS" },
  { value: "157",    label: "CANTIDAD CHECKLISTS REALIZADOS" },
  { value: "0.0 %",  label: "% ADHERENCIA CHECKLISTS SALIDA" },
  { value: "--",     label: "% ADHERENCIA CHECKLISTS ENTRADA" },
];

const SIN_FALLAS = [
  { fecha: "mar T1\n2021", val: 100 },
  { fecha: "sep T3",       val: 75 },
  { fecha: "oct T4",       val: 28.6 },
  { fecha: "nov",          val: 20 },
  { fecha: "dic",          val: 56.5 },
  { fecha: "ene\n2022",    val: 28 },
  { fecha: "feb",          val: 30 },
  { fecha: "mar",          val: 27.3 },
  { fecha: "abr",          val: 33.3 },
  { fecha: "may",          val: 65.5 },
  { fecha: "jun T2",       val: 80 },
  { fecha: "jul T3",       val: 25 },
  { fecha: "ago\n2024",    val: 50 },
];

const ADHERENCIA = [
  { fecha: "16 feb", entrada: 0, salida: 1.9 },
  { fecha: "17 feb", entrada: 0, salida: 1.4 },
  { fecha: "18 feb", entrada: 0, salida: 1.2 },
  { fecha: "7 mar",  entrada: 0, salida: 0.7 },
  { fecha: "10 mar", entrada: 0, salida: 2.8 },
  { fecha: "14 mar", entrada: 0, salida: 3.0 },
  { fecha: "4 abr",  entrada: 0, salida: 0.6 },
  { fecha: "5 abr",  entrada: 0, salida: 0.5 },
  { fecha: "28 abr", entrada: 0, salida: 0.5 },
  { fecha: "6 may",  entrada: 0, salida: 1.2 },
  { fecha: "11 may", entrada: 0, salida: 0.4 },
  { fecha: "13 may", entrada: 0, salida: 0.6 },
  { fecha: "17 may", entrada: 0, salida: 0.6 },
];

const PREGUNTAS = [
  { tipo: "Sistema de doble tracción", cant: 44 },
  { tipo: "Guantes",                   cant: 39 },
  { tipo: "Botiquín de primeros au...", cant: 26 },
  { tipo: "Chaleco",                   cant: 26 },
  { tipo: "Antena de radio",           cant: 17 },
  { tipo: "Parachoques delanteros",    cant: 15 },
  { tipo: "Autorización de B.V para...", cant: 14 },
  { tipo: "Matafuego cargado",         cant: 11 },
  { tipo: "Baliza de emergencia",      cant: 10 },
  { tipo: "Ópticas traseras (presen.)", cant: 9 },
];

const TABLA = [
  { dom: "195NM1...", cedis: "DIAMANTE", entrada: "",  salida: 1, km: 31.41,  fecha: "16/2/22" },
  { dom: "117NW1...", cedis: "DIAMANTE", entrada: "",  salida: 1, km: 105.94, fecha: "17/2/22" },
  { dom: "187LQ11..", cedis: "DIAMANTE", entrada: "",  salida: 1, km: 82.39,  fecha: "18/2/22" },
  { dom: "175AC11..", cedis: "DIAMANTE", entrada: "",  salida: 1, km: 61.79,  fecha: "7/3/22" },
  { dom: "261MG11..", cedis: "DIAMANTE", entrada: "",  salida: 1, km: 92.42,  fecha: "10/3/22" },
  { dom: "158PL11..", cedis: "DIAMANTE", entrada: "",  salida: 1, km: 45.75,  fecha: "14/3/22" },
  { dom: "185LQ11..", cedis: "DIAMANTE", entrada: "",  salida: 1, km: 71.09,  fecha: "4/4/22" },
  { dom: "126NZ11..", cedis: "DIAMANTE", entrada: "",  salida: 1, km: 42.79,  fecha: "5/4/22" },
  { dom: "147PH11..", cedis: "DIAMANTE", entrada: "",  salida: 1, km: 56.30,  fecha: "5/4/22" },
  { dom: "187LQ11..", cedis: "DIAMANTE", entrada: "",  salida: 1, km: 40.56,  fecha: "6/4/22" },
  { dom: "261MG11..", cedis: "DIAMANTE", entrada: "",  salida: 1, km: 71.16,  fecha: "6/4/22" },
  { dom: "131011/16", cedis: "RUBI",     entrada: "",  salida: 1, km: 64.11,  fecha: "6/4/22" },
  { dom: "252AB11..", cedis: "RUBI",     entrada: "",  salida: 1, km: 69.17,  fecha: "6/4/22" },
];

const UBI_ADH = [
  { sub: "ABETO",  entrada: 0, salida: 0.2 },
  { sub: "SAUCE",  entrada: 0, salida: 0 },
  { sub: "ACACIA", entrada: 0, salida: 0 },
];

const REGION_CANT = [
  { sub: "ABETO",  cant: 109 },
  { sub: "SAUCE",  cant: 24 },
  { sub: "CIPRÉS", cant: 16 },
  { sub: "ACACIA", cant: 5 },
  { sub: "NOGAL",  cant: 3 },
  { sub: "CAOBA",  cant: 1 },
  { sub: "TEJO",   cant: 1 },
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

function ChartCard({ title, legend, children, testid }) {
  return (
    <div className="bg-white rounded-2xl border border-neutral-200 shadow-sm p-4 flex flex-col" data-testid={testid}>
      {title && <div className="text-xs font-semibold text-neutral-700 mb-1">{title}</div>}
      {legend && (
        <div className="flex items-center gap-4 text-[10px] font-semibold text-neutral-600 mb-2">
          {legend.map((l) => (
            <span key={l.label} className="flex items-center gap-1">
              <span className="w-2.5 h-2.5 rounded-full" style={{ background: l.color }} />{l.label}
            </span>
          ))}
        </div>
      )}
      {children}
    </div>
  );
}

const ValueTag = (props) => {
  const { x, y, value } = props;
  if (value === undefined || value === null) return null;
  return (
    <g>
      <rect x={x - 18} y={y - 16} width={36} height={14} rx={3} fill="#F3F0FF" />
      <text x={x} y={y - 6} textAnchor="middle" fontSize={10} fontWeight={700} fill="#8039F4">{value} %</text>
    </g>
  );
};

/* ========================= MAIN ========================= */
export default function Checklist() {
  const [tab, setTab] = useState("fallas");

  return (
    <div className="space-y-5" data-testid="checklist-page">
      {/* Tabs */}
      <div className="flex flex-wrap items-center gap-6 border-b border-neutral-200" data-testid="checklist-tabs">
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

      {tab === "fallas" ? (
        <div className="flex gap-4">
          <div className="flex-1 min-w-0 space-y-4">
            {/* FILA 1 — KPIs */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3" data-testid="chk-row-1">
              {KPIS.map((k) => <KpiPill key={k.label} {...k} testid={`kpi-${k.label.toLowerCase().replace(/[^a-z0-9]+/g,"-")}`} />)}
            </div>

            {/* FILA 2 — 3 charts */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-3" data-testid="chk-row-2">
              <ChartCard title="Porcentaje de Checklists sin Fallas Reportados por Fecha" testid="chart-sin-fallas">
                <div className="h-[320px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={SIN_FALLAS} margin={{ top: 16, right: 16, left: -8, bottom: 16 }}>
                      <CartesianGrid stroke="#f3f4f6" />
                      <XAxis dataKey="fecha" tick={{ fontSize: 9 }} interval={0} />
                      <YAxis tick={{ fontSize: 10 }} tickFormatter={(v) => `${v} %`} domain={[20,100]} ticks={[20,40,60,80,100]} />
                      <Tooltip formatter={(v) => `${v} %`} />
                      <ReferenceLine y={90} stroke="#FDBA74" strokeDasharray="4 4" label={{ value: "Objetivo: 90.0 %", position: "right", fill: "#F97316", fontSize: 10 }} />
                      <Line type="monotone" dataKey="val" stroke={C_SALIDA} strokeWidth={2} dot={{ r: 3, fill: C_SALIDA }}>
                        <LabelList dataKey="val" position="top" offset={8} formatter={(v) => `${v} %`} style={{ fontSize: 10, fontWeight: 700, fill: "#8039F4" }} />
                      </Line>
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </ChartCard>

              <ChartCard
                title="Porcentaje Adherencia Checklists por Fecha"
                legend={[{ label: "Checklist Entrada", color: C_ENTRADA }, { label: "Checklist Salida", color: C_SALIDA }]}
                testid="chart-adherencia"
              >
                <div className="h-[320px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={ADHERENCIA} margin={{ top: 16, right: 16, left: -8, bottom: 8 }}>
                      <CartesianGrid stroke="#f3f4f6" />
                      <XAxis dataKey="fecha" tick={{ fontSize: 9 }} interval={0} />
                      <YAxis tick={{ fontSize: 10 }} tickFormatter={(v) => `${v} %`} domain={[0, 100]} ticks={[0, 50, 100]} />
                      <Tooltip formatter={(v) => `${v} %`} />
                      <ReferenceLine y={90} stroke="#FDBA74" strokeDasharray="4 4" label={{ value: "Objetivo: 90.0 %", position: "right", fill: "#F97316", fontSize: 10 }} />
                      <Line type="monotone" dataKey="entrada" stroke={C_ENTRADA} strokeWidth={2} dot={{ r: 3, fill: C_ENTRADA }} />
                      <Line type="monotone" dataKey="salida"  stroke={C_SALIDA}  strokeWidth={2} dot={{ r: 3, fill: C_SALIDA }}>
                        <LabelList dataKey="salida" position="top" offset={8} formatter={(v) => `${v} %`} style={{ fontSize: 10, fontWeight: 700, fill: "#8039F4" }} />
                      </Line>
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </ChartCard>

              <ChartCard title="Cantidad Preguntas Desaprobadas por Tipo de Pregunta" testid="chart-preguntas">
                <div className="h-[320px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart layout="vertical" data={PREGUNTAS} margin={{ top: 8, right: 24, left: 110, bottom: 8 }}>
                      <CartesianGrid stroke="#f3f4f6" />
                      <XAxis type="number" tick={{ fontSize: 10 }} domain={[0, 50]} ticks={[0, 20, 40]} />
                      <YAxis type="category" dataKey="tipo" tick={{ fontSize: 9 }} width={110} />
                      <Tooltip />
                      <Bar dataKey="cant" fill={C_SALIDA} barSize={14}>
                        <LabelList dataKey="cant" position="right" style={{ fontSize: 10, fontWeight: 700, fill: "#525252" }} />
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </ChartCard>
            </div>

            {/* FILA 3 — Tabla + 2 charts */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-3" data-testid="chk-row-3">
              <div className="bg-white rounded-2xl border border-neutral-200 shadow-sm overflow-hidden" data-testid="chk-table">
                <div className="overflow-y-auto max-h-[340px]">
                  <table className="w-full text-[11px]">
                    <thead className="bg-neutral-50 sticky top-0">
                      <tr className="text-[10px] font-bold text-neutral-500 uppercase tracking-wide">
                        <th className="px-2 py-2 text-left">Dominio</th>
                        <th className="px-2 py-2 text-left">Cedis</th>
                        <th className="px-2 py-2 text-center">Checklist<br/>Entrada</th>
                        <th className="px-2 py-2 text-center">Checklist<br/>Salida ▼</th>
                        <th className="px-2 py-2 text-right">Kilometraje<br/>Recorrido</th>
                        <th className="px-2 py-2 text-right">Fecha</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-neutral-100">
                      {TABLA.map((r, i) => (
                        <tr key={i}>
                          <td className="px-2 py-1.5 text-neutral-800">{r.dom}</td>
                          <td className="px-2 py-1.5 text-neutral-700">{r.cedis}</td>
                          <td className="px-2 py-1.5 text-center">{r.entrada}</td>
                          <td className="px-2 py-1.5 text-center">{r.salida}</td>
                          <td className="px-2 py-1.5 text-right">{r.km.toFixed(2)}</td>
                          <td className="px-2 py-1.5 text-right">{r.fecha}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              <ChartCard
                title="Porcentaje Adherencia Checklists por Ubicacion y Tipo Vehiculo"
                legend={[{ label: "Checklist Entrada", color: C_ENTRADA }, { label: "Checklist Salida", color: C_SALIDA }]}
                testid="chart-ubi-adh"
              >
                <div className="h-[320px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={UBI_ADH} margin={{ top: 16, right: 12, left: -8, bottom: 24 }}>
                      <CartesianGrid stroke="#f3f4f6" />
                      <XAxis dataKey="sub" tick={{ fontSize: 10 }} label={{ value: "Subregion", position: "insideBottom", offset: -8, fontSize: 10, fill: "#737373" }} />
                      <YAxis tick={{ fontSize: 10 }} domain={[0, 0.25]} tickFormatter={(v) => `${v} %`} ticks={[0, 0.1, 0.2]} />
                      <Tooltip formatter={(v) => `${v} %`} />
                      <Bar dataKey="entrada" fill={C_ENTRADA} barSize={40} />
                      <Bar dataKey="salida"  fill={C_SALIDA}  barSize={40}>
                        <LabelList dataKey="salida" position="top" formatter={(v) => `${v} %`} style={{ fontSize: 10, fontWeight: 700, fill: "#8039F4" }} />
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </ChartCard>

              <ChartCard title="Cantidad de Checklists Realizados por Region, Subregion y Cedis" testid="chart-region-cant">
                <div className="h-[320px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart layout="vertical" data={REGION_CANT} margin={{ top: 8, right: 32, left: 24, bottom: 8 }}>
                      <CartesianGrid stroke="#f3f4f6" />
                      <XAxis type="number" tick={{ fontSize: 10 }} domain={[0, 110]} ticks={[0, 50, 100]} />
                      <YAxis type="category" dataKey="sub" tick={{ fontSize: 10 }} width={60} label={{ value: "Subregion", angle: -90, position: "insideLeft", fontSize: 10, fill: "#737373" }} />
                      <Tooltip />
                      <Bar dataKey="cant" fill={C_SALIDA} barSize={16}>
                        <LabelList dataKey="cant" position="right" style={{ fontSize: 10, fontWeight: 700, fill: "#525252" }} />
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </ChartCard>
            </div>
          </div>

          {/* Filtros */}
          <aside className="hidden xl:block w-56 flex-shrink-0 space-y-3" data-testid="chk-filtros">
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
