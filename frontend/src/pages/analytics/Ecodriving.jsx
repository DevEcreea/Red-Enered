import React, { useState } from "react";
import {
  BarChart, Bar, ComposedChart, Line, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LabelList,
} from "recharts";

const C_TEAL = "#5FD0BA";
const C_PURPLE = "#8039F4";
const C_DARK = "#2D0A4E";
const C_ORANGE = "#D6541E";

const TABS = [
  { key: "ranking",    label: "Ranking" },
  { key: "dispersion", label: "Gráficos Dispersión" },
];

/* ========================= MOCK DATA ========================= */
const SLIDERS = [
  { label: "Porcentaje Mantenimientos", value: 35 },
  { label: "Porcentaje Combustibles",   value: 60 },
  { label: "Porcentaje Infracciones",   value: 25 },
];

const RANKING = [
  { chofer: "Medrano Gamero Edua...", pInfr: 100, pComb: 38.91, pMttos: 36.16, pFinal: 50, cInfr: 0,  iInfr: 0,     cCargas: 20, cLitros: 16604, cMttos: 23, costoMttos: 158265, costoTotal: 174869 },
  { chofer: "Griselia Gonzalo",      pInfr: 60.66, pComb: 100,  pMttos: 1,    pFinal: 56.1, cInfr: 1,  iInfr: 6206,  cCargas: 0,  cLitros: 0,     cMttos: 63, costoMttos: 205052, costoTotal: 211259 },
  { chofer: "Griselia Gonzalo Nahuel", pInfr: 74.67, pComb: 95.22, pMttos: 5, pFinal: 58.16, cInfr: 1, iInfr: 2510, cCargas: 3,  cLitros: 749,   cMttos: 71, costoMttos: 177685, costoTotal: 180943 },
  { chofer: "Contrera Emilio Angel..", pInfr: 100, pComb: 30, pMttos: 100, pFinal: 60, cInfr: 0,  iInfr: 0,     cCargas: 31, cLitros: 27850, cMttos: 0,  costoMttos: 0,      costoTotal: 27850 },
  { chofer: "Moya Abel Gaston",      pInfr: 100, pComb: 27.21, pMttos: 76.40, pFinal: 62.62, cInfr: 0, iInfr: 0,  cCargas: 22, cLitros: 20691, cMttos: 5,  costoMttos: 45821, costoTotal: 66312 },
  { chofer: "Roman Pablo Antonio",   pInfr: 100, pComb: 33.13, pMttos: 70.33, pFinal: 62.87, cInfr: 0, iInfr: 0,  cCargas: 21, cLitros: 18519, cMttos: 15, costoMttos: 66312, costoTotal: 84829 },
  { chofer: "Abboud Mauricio Jorge", pInfr: 1.96, pComb: 86.52, pMttos: 81.70, pFinal: 65.10, cInfr: 2, iInfr: 15164, cCargas: 10, cLitros: 1514, cMttos: 3, costoMttos: 51209, costoTotal: 67887 },
  { chofer: "Salto Paz Pablo Martin", pInfr: 100, pComb: 17.95, pMttos: 100,   pFinal: 67.02, cInfr: 0, iInfr: 0,  cCargas: 24, cLitros: 23565, cMttos: 0,  costoMttos: 0,     costoTotal: 23565 },
  { chofer: "Albarran Briceño Leon..", pInfr: 15.59, pComb: 100, pMttos: 74.80, pFinal: 69.93, cInfr: 1, iInfr: 9742, cCargas: 0, cLitros: 0,    cMttos: 19, costoMttos: 55609, costoTotal: 65351 },
  { chofer: "Taboada Ernesto Raul",  pInfr: 100, pComb: 50.94, pMttos: 74.88, pFinal: 71.56, cInfr: 0, iInfr: 0,    cCargas: 25, cLitros: 9894,  cMttos: 19, costoMttos: 47918, costoTotal: 57812 },
  { chofer: "Vidal Armijo Miguel An..", pInfr: 57.80, pComb: 60.57, pMttos: 95.70, pFinal: 72.12, cInfr: 1, iInfr: 5502, cCargas: 13, cLitros: 10682, cMttos: 2, costoMttos: 10347, costoTotal: 26531 },
  { chofer: "Villarreal Cristian Rod..", pInfr: 100, pComb: 31.66, pMttos: 100,   pFinal: 72.65, cInfr: 0, iInfr: 0, cCargas: 21, cLitros: 19113, cMttos: 0,  costoMttos: 0,    costoTotal: 19113 },
  { chofer: "Sanchez Vanrell Leand..", pInfr: 100, pComb: 33.18, pMttos: 100,   pFinal: 73.27, cInfr: 0, iInfr: 0,  cCargas: 19, cLitros: 19271, cMttos: 0,  costoMttos: 0,    costoTotal: 19271 },
];

const PUNTAJE_CONDUCTOR = [
  { nombre: "Medrano Gamer.",  v: 53 },
  { nombre: "Griselia Gonzalo", v: 56 },
  { nombre: "Griselia Gonzal.", v: 59 },
  { nombre: "Contrera Emilio.", v: 60 },
  { nombre: "Moya Abel Gast.", v: 63 },
  { nombre: "Roman Pablo A.",  v: 63 },
  { nombre: "Abboud Maurici.", v: 65 },
  { nombre: "Salto Paz Pablo.", v: 67 },
];

const COSTO_FECHA = [
  { mes: "ene", costo: 0.60, km: 0.06 },
  { mes: "feb", costo: 1.00, km: 0.23 },
  { mes: "mar", costo: 0.99, km: 0.29 },
  { mes: "abr", costo: 1.03, km: 0.45 },
  { mes: "may", costo: 0.65, km: 0.60 },
  { mes: "jun", costo: 1.20, km: 0.41 },
  { mes: "jul", costo: 1.50, km: 0.40 },
  { mes: "ago", costo: 0.95, km: 0.40 },
  { mes: "sep", costo: 0.82, km: 0.39 },
  { mes: "oct", costo: 0.66, km: 0.40 },
  { mes: "nov", costo: 0.40, km: 0.40 },
];

const DIST_COSTO = [
  { name: "Mantenimiento", value: 9,    color: C_TEAL,   label: "S/ 9M (65.73%)" },
  { name: "Infracciones",  value: 4.5,  color: C_PURPLE, label: "S/ 4M (32.62%)" },
  { name: "Combustible",   value: 0.2,  color: C_DARK,   label: "S/ 0M (1.65%)" },
];

const PUNTAJE_VEHICULO = [
  { placa: "AD966RO", v: 50 },
  { placa: "AC796TJ", v: 55 },
  { placa: "AC796TO", v: 55 },
  { placa: "AC0472I", v: 58 },
  { placa: "AD959JR", v: 58 },
  { placa: "AC929AI", v: 60 },
  { placa: "AC796TA", v: 62 },
  { placa: "AE067NU", v: 62 },
];

const FILTROS = ["Fecha","Unidad de medida","Placa","Tipo de Vehiculo","Marca","Modelo","Dominio","Departamento","Ciudad","Centro de Costos","Cedis"];

/* ========================= UI HELPERS ========================= */
function SliderCard({ label, value, testid }) {
  return (
    <div className="bg-white rounded-2xl border border-neutral-200 px-4 py-4 shadow-sm" data-testid={testid}>
      <div className="text-[11px] text-neutral-600 font-semibold">{label}</div>
      <div className="text-xl font-cabinet font-black text-neutral-900 mt-1">{value} %</div>
      <div className="relative mt-3 h-1.5 bg-neutral-200 rounded-full">
        <div className="absolute top-0 left-0 h-full rounded-full bg-[#8039F4]" style={{ width: `${value}%` }} />
        <div className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 w-4 h-4 rounded-full bg-white border-2 border-[#8039F4] shadow"
             style={{ left: `${value}%` }} />
      </div>
    </div>
  );
}

function TotalCard({ value, testid }) {
  return (
    <div className="rounded-2xl px-4 py-4 flex flex-col items-center justify-center min-h-[110px] shadow-sm" style={{ background: "#BFE9DC" }} data-testid={testid}>
      <div className="text-3xl font-cabinet font-black text-[#0F5A4A]">{value} %</div>
      <div className="text-xs font-semibold text-[#0F5A4A] mt-1">Porcentaje Total</div>
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

const HEAT = (v) => {
  if (v == null || v === 0) return "transparent";
  if (v >= 90) return "#FEEFE5";
  if (v >= 70) return "#F5D9A8";
  if (v >= 60) return "#EFB36E";
  if (v >= 40) return "#E08A4A";
  return "#D6541E";
};
const HEAT_FINAL = (v) => {
  if (v >= 70) return "#F5D9A8";
  if (v >= 60) return "#E8A33D";
  return "#D6541E";
};
const fmt = (n) => n.toLocaleString("es-PE", { maximumFractionDigits: 2 });
const fmt$ = (n) => `S/ ${fmt(n)}`;

/* ========================= MAIN ========================= */
export default function Ecodriving() {
  const [tab, setTab] = useState("ranking");

  return (
    <div className="space-y-5" data-testid="ecodriving-page">
      {/* Tabs */}
      <div className="flex flex-wrap items-center gap-6 border-b border-neutral-200" data-testid="ecodriving-tabs">
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

      {tab === "ranking" ? (
        <div className="flex gap-4">
          <div className="flex-1 min-w-0 space-y-4">
            {/* FILA 1 */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3" data-testid="eco-row-1">
              {SLIDERS.map((s, i) => <SliderCard key={s.label} {...s} testid={`slider-${i}`} />)}
              <TotalCard value={100} testid="kpi-total" />
            </div>

            {/* FILA 2 — Ranking table + bar chart */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-3" data-testid="eco-row-2">
              <div className="lg:col-span-2 bg-white rounded-2xl border border-neutral-200 shadow-sm overflow-hidden" data-testid="ranking-table">
                <div className="overflow-x-auto max-h-[420px] overflow-y-auto">
                  <table className="w-full text-[11px]">
                    <thead className="bg-neutral-50 sticky top-0">
                      <tr className="text-[9px] font-bold text-neutral-500 uppercase">
                        <th className="px-2 py-2 text-left">Chofer</th>
                        <th className="px-2 py-2 text-center">Puntaje<br/>Infr</th>
                        <th className="px-2 py-2 text-center">Puntaje<br/>Comb</th>
                        <th className="px-2 py-2 text-center">Puntaje<br/>Mttos</th>
                        <th className="px-2 py-2 text-center">Puntaje<br/>Final ▲</th>
                        <th className="px-2 py-2 text-center">Cantidad<br/>Infracciones</th>
                        <th className="px-2 py-2 text-right">Importe<br/>Infracciones</th>
                        <th className="px-2 py-2 text-center">Cantidad Cargas<br/>Invalidas</th>
                        <th className="px-2 py-2 text-right">Costo Litros<br/>Excedentes</th>
                        <th className="px-2 py-2 text-center">Cantidad<br/>Mttos</th>
                        <th className="px-2 py-2 text-right">Costo<br/>Mttos</th>
                        <th className="px-2 py-2 text-right">Costo Total</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-neutral-100">
                      {RANKING.map((r, i) => (
                        <tr key={i}>
                          <td className="px-2 py-1.5 text-neutral-800 whitespace-nowrap">{r.chofer}</td>
                          <td className="px-2 py-1.5 text-center font-semibold" style={{ background: HEAT(r.pInfr), color: r.pInfr < 60 ? "#fff" : "#333" }}>{r.pInfr.toFixed(2)}</td>
                          <td className="px-2 py-1.5 text-center font-semibold" style={{ background: HEAT(r.pComb), color: r.pComb < 60 ? "#fff" : "#333" }}>{r.pComb.toFixed(2)}</td>
                          <td className="px-2 py-1.5 text-center font-semibold" style={{ background: HEAT(r.pMttos), color: r.pMttos < 60 ? "#fff" : "#333" }}>{r.pMttos.toFixed(2)}</td>
                          <td className="px-2 py-1.5 text-center font-semibold" style={{ background: HEAT_FINAL(r.pFinal), color: r.pFinal < 60 ? "#fff" : "#333" }}>{r.pFinal.toFixed(2)}</td>
                          <td className="px-2 py-1.5 text-center">
                            {r.cInfr > 0 && <span className="inline-block w-12 h-3 rounded-sm" style={{ background: C_TEAL, opacity: 0.7 }} title={r.cInfr} />}
                            <span className="ml-1">{r.cInfr || ""}</span>
                          </td>
                          <td className="px-2 py-1.5 text-right">{r.iInfr ? `S/ ${fmt(r.iInfr)}` : ""}</td>
                          <td className="px-2 py-1.5 text-center">
                            {r.cCargas > 0 && <span className="inline-block w-10 h-3 rounded-sm mr-1" style={{ background: C_TEAL, opacity: 0.5 }} />}
                            {r.cCargas || ""}
                          </td>
                          <td className="px-2 py-1.5 text-right">{r.cLitros ? `S/ ${fmt(r.cLitros)}` : ""}</td>
                          <td className="px-2 py-1.5 text-center">
                            {r.cMttos > 0 && <span className="inline-block w-10 h-3 rounded-sm mr-1" style={{ background: C_TEAL, opacity: 0.5 }} />}
                            {r.cMttos || ""}
                          </td>
                          <td className="px-2 py-1.5 text-right">{r.costoMttos ? `S/ ${fmt(r.costoMttos)}` : ""}</td>
                          <td className="px-2 py-1.5 text-right font-bold" style={{ background: r.costoTotal > 100000 ? "#F5C09A" : "#FCE6CC" }}>${fmt(r.costoTotal)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              <ChartCard title="Puntaje Final Conductor" testid="chart-puntaje-conductor">
                <div className="h-[420px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart layout="vertical" data={PUNTAJE_CONDUCTOR} margin={{ top: 8, right: 36, left: 16, bottom: 8 }}>
                      <CartesianGrid stroke="#f3f4f6" />
                      <XAxis type="number" tick={{ fontSize: 10 }} domain={[0, 100]} ticks={[0, 50, 100]} />
                      <YAxis type="category" dataKey="nombre" tick={{ fontSize: 10 }} width={110} />
                      <Tooltip />
                      <Bar dataKey="v" fill={C_ORANGE} barSize={20}>
                        <LabelList dataKey="v" position="right" style={{ fontSize: 10, fontWeight: 700, fill: "#525252" }} />
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </ChartCard>
            </div>

            {/* FILA 3 */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-3" data-testid="eco-row-3">
              <ChartCard
                title="Costo Total por Fecha"
                legend={
                  <div className="flex items-center gap-3 text-[10px] font-semibold text-neutral-600 mb-2">
                    <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full" style={{ background: C_PURPLE }} />Costo Total</span>
                    <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full bg-black" />Kilometros Recorridos</span>
                  </div>
                }
                testid="chart-costo-fecha"
              >
                <div className="h-[320px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <ComposedChart data={COSTO_FECHA} margin={{ top: 24, right: 8, left: -8, bottom: 24 }}>
                      <CartesianGrid stroke="#f3f4f6" vertical={false} />
                      <XAxis dataKey="mes" tick={{ fontSize: 10 }} label={{ value: "mes", position: "insideBottom", offset: -8, fontSize: 10, fill: "#737373" }} />
                      <YAxis tick={{ fontSize: 10 }} domain={[0, 1.6]} ticks={[0, 0.5, 1.0, 1.5]} tickFormatter={(v) => `S/ ${v.toFixed(1)}M`} />
                      <Tooltip />
                      <Bar dataKey="costo" fill={C_PURPLE} barSize={28}>
                        <LabelList dataKey="costo" position="top" formatter={(v) => `S/ ${v.toFixed(2)}M`} style={{ fontSize: 9, fontWeight: 700, fill: "#525252" }} />
                      </Bar>
                      <Line type="monotone" dataKey="km" stroke={C_DARK} strokeWidth={1.5} strokeDasharray="3 3" dot={{ r: 2, fill: C_DARK }}>
                        <LabelList dataKey="km" position="bottom" formatter={(v) => `${v.toFixed(2)}M`} style={{ fontSize: 9, fontWeight: 700, fill: "#525252" }} />
                      </Line>
                    </ComposedChart>
                  </ResponsiveContainer>
                </div>
              </ChartCard>

              <ChartCard
                title="Distribucion del Costo Total"
                legend={
                  <div className="flex items-center gap-3 text-[10px] font-semibold text-neutral-600 mb-2">
                    <span className="text-neutral-500">Costo</span>
                    <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full" style={{ background: C_TEAL }} />Mantenimiento</span>
                    <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full" style={{ background: C_PURPLE }} />Infracciones</span>
                    <span className="flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full" style={{ background: C_DARK }} />Combustible</span>
                  </div>
                }
                testid="chart-dist-costo"
              >
                <div className="h-[320px] relative">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie data={DIST_COSTO} dataKey="value" innerRadius={70} outerRadius={115} paddingAngle={0} stroke="#fff" strokeWidth={2}
                        label={({ payload }) => payload.label}
                        labelLine={{ stroke: "#9ca3af", strokeWidth: 1 }}
                      >
                        {DIST_COSTO.map((d, i) => <Cell key={i} fill={d.color} />)}
                      </Pie>
                      <Tooltip />
                    </PieChart>
                  </ResponsiveContainer>
                  <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                    <div className="font-cabinet font-black text-3xl text-neutral-900">S/ 11M</div>
                    <div className="text-[11px] text-neutral-500 font-semibold">Costo Total</div>
                  </div>
                </div>
              </ChartCard>

              <ChartCard title="Puntaje Final Vehiculo" testid="chart-puntaje-vehiculo">
                <div className="h-[320px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart layout="vertical" data={PUNTAJE_VEHICULO} margin={{ top: 8, right: 36, left: 16, bottom: 8 }}>
                      <CartesianGrid stroke="#f3f4f6" />
                      <XAxis type="number" tick={{ fontSize: 10 }} domain={[0, 100]} ticks={[0, 50, 100]} />
                      <YAxis type="category" dataKey="placa" tick={{ fontSize: 10 }} width={70} label={{ value: "Placa", angle: -90, position: "insideLeft", fontSize: 10, fill: "#737373" }} />
                      <Tooltip />
                      <Bar dataKey="v" fill={C_ORANGE} barSize={18}>
                        <LabelList dataKey="v" position="right" style={{ fontSize: 10, fontWeight: 700, fill: "#525252" }} />
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </ChartCard>
            </div>
          </div>

          {/* Filtros */}
          <aside className="hidden xl:block w-56 flex-shrink-0 space-y-3" data-testid="eco-filtros">
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
