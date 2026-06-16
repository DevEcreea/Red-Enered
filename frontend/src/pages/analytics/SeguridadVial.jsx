import React, { useState } from "react";
import {
  ComposedChart, Line, Bar, BarChart, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LabelList,
} from "recharts";

const C_PURPLE = "#8039F4";
const C_PURPLE_LIGHT = "#D8C6FA";
const C_DARK = "#2D0A4E";

const TABS = [
  { key: "general", label: "General" },
];

/* ========================= MOCK DATA ========================= */
const KPIS = [
  { value: "S/ 1.22",         label: "COSTO POR KM" },
  { value: "S/ 10,357,269",   label: "COSTO TOTAL" },
  { value: "S/ 27,842",       label: "COSTO PROMEDIO POR INFRACCION" },
  { value: "372",             label: "CANTIDAD INFRACCIONES" },
];

const FECHA = [
  { mes: "ene", periodo: "T1 2020", cant: 8,  costo: 0.03 },
  { mes: "feb", periodo: "",        cant: 15, costo: 0.05 },
  { mes: "mar", periodo: "",        cant: 8,  costo: 0.05 },
  { mes: "abr", periodo: "T2",      cant: 2,  costo: 0.04 },
  { mes: "may", periodo: "",        cant: 9,  costo: 0.05 },
  { mes: "jun", periodo: "",        cant: 4,  costo: 0.11 },
  { mes: "jul", periodo: "T3",      cant: 5,  costo: 0.11 },
  { mes: "ago", periodo: "",        cant: 8,  costo: 0.11 },
  { mes: "sep", periodo: "",        cant: 9,  costo: 0.11 },
  { mes: "oct", periodo: "T4",      cant: 6,  costo: 0.04 },
  { mes: "nov", periodo: "",        cant: 4,  costo: 0.14 },
  { mes: "dic", periodo: "",        cant: 6,  costo: 0.14 },
  { mes: "ene", periodo: "T1 2021", cant: 11, costo: 0.38 },
  { mes: "feb", periodo: "",        cant: 7,  costo: 0.25 },
  { mes: "mar", periodo: "",        cant: 10, costo: 0.17 },
  { mes: "abr", periodo: "T2",      cant: 7,  costo: 0.17 },
  { mes: "may", periodo: "",        cant: 5,  costo: 0.12 },
  { mes: "jun", periodo: "",        cant: 2,  costo: 0.02 },
  { mes: "jul", periodo: "T3",      cant: 11, costo: 0.31 },
  { mes: "ago", periodo: "",        cant: 10, costo: 0.11 },
  { mes: "sep", periodo: "",        cant: 7,  costo: 0.07 },
  { mes: "oct", periodo: "T4",      cant: 8,  costo: 0.17 },
  { mes: "nov", periodo: "",        cant: 6,  costo: 0.07 },
  { mes: "dic", periodo: "",        cant: 3,  costo: 0.05 },
  { mes: "ene", periodo: "T1 2022", cant: 4,  costo: 0.05 },
  { mes: "feb", periodo: "",        cant: 4,  costo: 0.07 },
  { mes: "mar", periodo: "",        cant: 5,  costo: 0.07 },
  { mes: "abr", periodo: "T2",      cant: 3,  costo: 0.31 },
  { mes: "may", periodo: "",        cant: 2,  costo: 0.05 },
  { mes: "jun", periodo: "",        cant: 5,  costo: 0.05 },
];

// Ubicaciones mock (porcentaje x e y dentro del SVG) — siluetas de Perú
const UBICACIONES = [
  { x: 35, y: 8,  r: 9, op: 0.55 },
  { x: 78, y: 12, r: 10, op: 0.65 },
  { x: 30, y: 22, r: 11, op: 0.55 },
  { x: 22, y: 28, r: 8, op: 0.5 },
  { x: 32, y: 32, r: 9, op: 0.45 },
  { x: 40, y: 35, r: 14, op: 0.7 },
  { x: 18, y: 42, r: 10, op: 0.4 },
  { x: 50, y: 45, r: 12, op: 0.6 },
  { x: 35, y: 52, r: 9, op: 0.5 },
  { x: 60, y: 50, r: 10, op: 0.65 },
  { x: 25, y: 58, r: 14, op: 0.7 },
  { x: 48, y: 62, r: 11, op: 0.55 },
  { x: 38, y: 70, r: 9, op: 0.45 },
  { x: 30, y: 78, r: 12, op: 0.6 },
  { x: 58, y: 80, r: 9, op: 0.5 },
  { x: 22, y: 85, r: 11, op: 0.55 },
  { x: 40, y: 90, r: 13, op: 0.7 },
];

const CHOFERES = [
  { name: "(Blank)",    v: 6.4 },
  { name: "chofer 753", v: 0.5 },
  { name: "chofer 521", v: 0.4 },
  { name: "chofer 571", v: 0.2 },
  { name: "chofer 784", v: 0.2 },
  { name: "chofer 573", v: 0.1 },
  { name: "chofer 838", v: 0.1 },
  { name: "chofer 554", v: 0.1 },
  { name: "chofer 791", v: 0.1 },
  { name: "chofer 686", v: 0.1 },
  { name: "chofer 508", v: 0.1 },
];

const REGION = [
  { sub: "ABETO",     cant: 186, costo: 27000 },
  { sub: "SAUCE",     cant: 117, costo: 30000 },
  { sub: "CIPRÉS",    cant: 33,  costo: 29000 },
  { sub: "NOGAL",     cant: 11,  costo: 14000 },
  { sub: "ACACIA",    cant: 10,  costo: 21000 },
  { sub: "CAOBA",     cant: 10,  costo: 25000 },
  { sub: "EUCALIPTO", cant: 3,   costo: 85000 },
  { sub: "HAYA",      cant: 2,   costo: 26000 },
];

const TIPOS_PALETTE = ["#8039F4","#0F0F12","#67D6B9","#B26429","#5E2BD9","#3B3BB0","#5FD0BA","#3CAE94","#F3E2C5","#D4D4D8","#F2D2B6","#74B3D4","#A99DCB","#9CE5C6","#E8A33D"];
const TIPOS = [
  { name: "Por no respetar los...",         v: 128, pct: "34.41%" },
  { name: "No respetar luces...",           v: 23,  pct: "6.18%" },
  { name: "Por no detenerse a...",          v: 13,  pct: "3.49%" },
  { name: "Prohib. circular seg...",        v: 8,   pct: "2.15%" },
  { name: "exceso velocidad d...",          v: 4,   pct: "1.08%" },
  { name: "Carriles o vías pro...",         v: 3,   pct: "0.81%" },
  { name: "Forzar barrera/eva...",          v: 2,   pct: "0.54%" },
  { name: "Forzar barrera/eva...",          v: 2,   pct: "0.54%" },
  { name: "Circular a una velo...",         v: 1,   pct: "0.27%" },
  { name: "Exceso de velocida...",          v: 1,   pct: "0.27%" },
  { name: "No llevar encendid...",          v: 1,   pct: "0.27%" },
  { name: "Otros",                          v: 186, pct: "50.00%" },
];

const FILTROS = ["Fecha","Unidad de medida","Placa","Tipo de Vehiculo","Marca","Modelo","Dominio","Departamento","Ciudad","Centro de Costos","Cedis"];

/* ========================= UI HELPERS ========================= */
function KpiPill({ value, label, testid }) {
  return (
    <div className="bg-white rounded-2xl border border-neutral-200 px-4 py-4 flex flex-col items-start justify-center min-h-[100px] shadow-sm" data-testid={testid}>
      <div className="text-[10px] font-bold uppercase tracking-wide text-neutral-500 leading-tight">{label}</div>
      <div className="font-cabinet font-black text-neutral-900 leading-none text-2xl xl:text-3xl mt-2">{value}</div>
    </div>
  );
}

function ChartCard({ title, legend, children, testid, className }) {
  return (
    <div className={`bg-white rounded-2xl border border-neutral-200 shadow-sm p-4 flex flex-col ${className || ""}`} data-testid={testid}>
      {title && <div className="text-xs font-semibold text-neutral-700 mb-1">{title}</div>}
      {legend}
      {children}
    </div>
  );
}

/* Render labels purple-tagged */
const LabelTag = ({ x, y, value }) => {
  if (value == null) return null;
  return (
    <g>
      <rect x={x - 12} y={y - 14} width={24} height={12} rx={2} fill={C_PURPLE_LIGHT} />
      <text x={x} y={y - 5} textAnchor="middle" fontSize={9} fontWeight={700} fill={C_PURPLE}>{value}</text>
    </g>
  );
};
const LabelTagDark = ({ x, y, value }) => {
  if (value == null) return null;
  const text = `S/ ${Number(value).toFixed(2)}M`;
  return (
    <g>
      <rect x={x - 22} y={y - 14} width={44} height={12} rx={2} fill="#525252" />
      <text x={x} y={y - 5} textAnchor="middle" fontSize={9} fontWeight={700} fill="#fff">{text}</text>
    </g>
  );
};

/* Mapa fake de Perú: silueta SVG + burbujas */
function PeruMap() {
  return (
    <div className="relative w-full h-full bg-neutral-100 rounded-xl overflow-hidden">
      <svg viewBox="0 0 100 100" className="w-full h-full" preserveAspectRatio="none">
        {/* silueta aproximada */}
        <path d="M30,6 Q42,4 50,8 Q60,10 65,18 Q72,22 70,32 Q72,42 65,48 Q70,55 62,62 Q58,72 50,78 Q44,86 36,90 Q28,94 22,86 Q16,72 20,58 Q16,46 22,32 Q24,18 30,6 Z"
          fill="#e5e7eb" stroke="#cbd5e1" strokeWidth="0.3" />
        <text x="48" y="56" fontSize="3" fontWeight="700" fill="#94a3b8">PERU</text>
        <text x="56" y="62" fontSize="2.4" fontWeight="600" fill="#94a3b8">Lima</text>
        <text x="74" y="20" fontSize="2.4" fontWeight="600" fill="#94a3b8">ACRE</text>
        {UBICACIONES.map((u, i) => (
          <g key={i}>
            <circle cx={u.x} cy={u.y} r={u.r/4} fill={C_PURPLE} opacity={u.op} />
            <circle cx={u.x} cy={u.y} r={u.r/6} fill={C_DARK} opacity={u.op * 0.6} />
          </g>
        ))}
      </svg>
      <div className="absolute bottom-1 right-2 text-[8px] text-neutral-400">© 2024 OpenStreetMap</div>
    </div>
  );
}

/* ========================= MAIN ========================= */
export default function SeguridadVial() {
  const [tab, setTab] = useState("general");

  return (
    <div className="space-y-5" data-testid="seguridad-vial-page">
      {/* Tabs */}
      <div className="flex flex-wrap items-center gap-6 border-b border-neutral-200" data-testid="sv-tabs">
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

      <div className="flex gap-4">
        <div className="flex-1 min-w-0 space-y-4">
          {/* FILA 1 — KPIs */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3" data-testid="sv-row-1">
            {KPIS.map((k) => <KpiPill key={k.label} {...k} testid={`kpi-${k.label.toLowerCase().replace(/[^a-z0-9]+/g,"-")}`} />)}
          </div>

          {/* FILA 2 — Combo + Mapa */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-3" data-testid="sv-row-2">
            <ChartCard
              title="Costo Total y Cantidad de Infracciones por Fecha"
              legend={
                <div className="flex items-center gap-3 text-[10px] font-semibold text-neutral-600 mb-2">
                  <span className="flex items-center gap-1"><span className="w-3 h-0.5" style={{ background: C_PURPLE }} />Cantidad Infracciones</span>
                  <span className="flex items-center gap-1"><span className="w-3 h-0.5 bg-neutral-800" />Costo Total</span>
                </div>
              }
              testid="chart-fecha"
            >
              <div className="h-[360px]">
                <ResponsiveContainer width="100%" height="100%">
                  <ComposedChart data={FECHA} margin={{ top: 24, right: 36, left: -8, bottom: 24 }}>
                    <CartesianGrid stroke="#f3f4f6" />
                    <XAxis dataKey="mes" tick={{ fontSize: 9 }} interval={0} />
                    <YAxis yAxisId="L" tick={{ fontSize: 10 }} domain={[0, 15]} ticks={[0,5,10,15]} />
                    <YAxis yAxisId="R" orientation="right" tick={{ fontSize: 10 }} domain={[0, 1]} ticks={[0, 0.5, 1.0]} tickFormatter={(v) => `S/ ${v.toFixed(1)}M`} />
                    <Tooltip />
                    <Line yAxisId="L" type="monotone" dataKey="cant"  stroke={C_PURPLE} strokeWidth={2}  dot={{ r: 2, fill: C_PURPLE }}>
                      <LabelList dataKey="cant" content={LabelTag} />
                    </Line>
                    <Line yAxisId="R" type="monotone" dataKey="costo" stroke="#171717"  strokeWidth={1.5} dot={{ r: 2, fill: "#171717" }}>
                      <LabelList dataKey="costo" content={LabelTagDark} />
                    </Line>
                  </ComposedChart>
                </ResponsiveContainer>
              </div>
            </ChartCard>

            <ChartCard title="Cantidad Infracciones por Ubicacion" testid="chart-mapa">
              <div className="h-[360px]"><PeruMap /></div>
            </ChartCard>
          </div>

          {/* FILA 3 — Costo Chofer + Region + Donut */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-3" data-testid="sv-row-3">
            <ChartCard title="Costo Total por Chofer y Dominio" testid="chart-chofer">
              <div className="h-[340px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart layout="vertical" data={CHOFERES} margin={{ top: 8, right: 36, left: 16, bottom: 16 }}>
                    <CartesianGrid stroke="#f3f4f6" />
                    <XAxis type="number" tick={{ fontSize: 10 }} domain={[0, 7]} ticks={[0, 5]} tickFormatter={(v) => `S/ ${v}M`} />
                    <YAxis type="category" dataKey="name" tick={{ fontSize: 10 }} width={80} label={{ value: "Chofer", angle: -90, position: "insideLeft", fontSize: 10, fill: "#737373" }} />
                    <Tooltip formatter={(v) => `S/ ${v}M`} />
                    <Bar dataKey="v" fill={C_PURPLE} barSize={14}>
                      <LabelList dataKey="v" position="right" formatter={(v) => `S/ ${v.toFixed(1)}M`} style={{ fontSize: 9, fontWeight: 700, fill: "#525252" }} />
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </ChartCard>

            <ChartCard
              title="Cantidad de Infracciones y Costo Promedio por Region, Subregion"
              legend={
                <div className="flex items-center gap-3 text-[10px] font-semibold text-neutral-600 mb-2">
                  <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full" style={{ background: C_PURPLE }} />Cantidad de Infracciones</span>
                  <span className="flex items-center gap-1"><span className="w-3 h-0.5 border-t border-dashed border-neutral-800" />Costo Promedio</span>
                </div>
              }
              testid="chart-region"
            >
              <div className="h-[340px]">
                <ResponsiveContainer width="100%" height="100%">
                  <ComposedChart data={REGION} margin={{ top: 24, right: 24, left: -8, bottom: 32 }}>
                    <CartesianGrid stroke="#f3f4f6" />
                    <XAxis dataKey="sub" tick={{ fontSize: 9 }} angle={-30} textAnchor="end" interval={0} height={50} />
                    <YAxis yAxisId="L" tick={{ fontSize: 10 }} domain={[0, 200]} ticks={[0, 50, 100, 150, 200]} />
                    <YAxis yAxisId="R" orientation="right" tick={{ fontSize: 10 }} domain={[0, 100000]} ticks={[0, 50000, 100000]} tickFormatter={(v) => `S/ ${v/1000}K`} />
                    <Tooltip />
                    <Bar yAxisId="L" dataKey="cant" fill={C_PURPLE} barSize={26}>
                      <LabelList dataKey="cant" position="top" style={{ fontSize: 9, fontWeight: 700, fill: C_PURPLE }} />
                    </Bar>
                    <Line yAxisId="R" type="monotone" dataKey="costo" stroke="#171717" strokeWidth={1.5} strokeDasharray="4 4" dot={{ r: 3, fill: "#171717" }}>
                      <LabelList dataKey="costo" position="top" formatter={(v) => `S/ ${(v/1000).toFixed(0)}K`} style={{ fontSize: 9, fontWeight: 700, fill: "#fff", textShadow: "0 0 4px #525252" }} />
                    </Line>
                  </ComposedChart>
                </ResponsiveContainer>
              </div>
            </ChartCard>

            <ChartCard title="Distribucion Porcentual por Tipo de Infraccion" testid="chart-tipos">
              <div className="h-[340px] flex items-center gap-2">
                <div className="flex-shrink-0 w-1/2 h-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie data={TIPOS} dataKey="v" innerRadius={50} outerRadius={90} paddingAngle={0} stroke="#fff" strokeWidth={1}>
                        {TIPOS.map((t, i) => <Cell key={i} fill={TIPOS_PALETTE[i % TIPOS_PALETTE.length]} />)}
                      </Pie>
                      <Tooltip />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
                <div className="flex-1 overflow-y-auto max-h-full pr-1">
                  <div className="text-[10px] font-bold text-neutral-600 mb-1">Tipo Infraccion</div>
                  {TIPOS.map((t, i) => (
                    <div key={i} className="flex items-center gap-1.5 text-[10px] text-neutral-700 py-0.5">
                      <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: TIPOS_PALETTE[i % TIPOS_PALETTE.length] }} />
                      <span className="truncate flex-1">{t.name}</span>
                      <span className="text-neutral-500">{t.v} ({t.pct})</span>
                    </div>
                  ))}
                </div>
              </div>
            </ChartCard>
          </div>
        </div>

        {/* Filtros */}
        <aside className="hidden xl:block w-56 flex-shrink-0 space-y-3" data-testid="sv-filtros">
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
    </div>
  );
}
