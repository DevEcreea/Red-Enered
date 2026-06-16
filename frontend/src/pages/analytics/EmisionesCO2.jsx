import React, { useState } from "react";
import {
  ComposedChart, Bar, Line, BarChart,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LabelList,
} from "recharts";
import { Cloud } from "lucide-react";

const C_TEAL = "#5FD0BA";        // Diésel / Real
const C_GASOLINA = "#2D0A4E";    // Gasolina (morado oscuro)
const C_PURPLE = "#8039F4";      // Promedio / Esperado
const C_LILAC = "#C9B6F8";       // Barras claras en tabla
const C_LILAC_BG = "#E9DDFB";
const C_BORDER = "#8039F4";

const TABS = [
  { key: "emisiones", label: "Emisiones" },
  { key: "rendimiento", label: "Rendimiento KM/GL" },
];

/* ========================= MOCK DATA ========================= */

const KPIS = [
  { key: "total",     label: "TN CO2 emitido total",                 value: 2905.62 },
  { key: "promedio",  label: "TN CO2 emitido promedio por vehículo", value: 5.02    },
  { key: "disminuid", label: "TN CO2 emisiones disminuidas",         value: 0.00    },
  { key: "aumentad",  label: "TN CO2 emisiones aumentadas",          value: 491.05  },
];

// Stacked bars: Diésel + Gasolina por año; línea de promedio (eje derecho)
const EVOLUCION = [
  { anio: "2020", diesel: 492.77, gasolina:  97.47, total: 590.24, promedio: 3.26 },
  { anio: "2021", diesel: 361.89, gasolina: 108.83, total: 470.72, promedio: null },
  { anio: "2022", diesel: 770.15, gasolina: 187.23, total: 957.38, promedio: 2.88 },
  { anio: "2023", diesel: 538.84, gasolina:  81.03, total: 619.87, promedio: 1.70 },
  { anio: "2024", diesel: 228.51, gasolina:  38.91, total: 267.42, promedio: 1.03 },
];

const POR_TIPO_TOTAL = [
  { tipo: "PICKUP",       real: 2285.22, esperado: 1745.03 },
  { tipo: "FURGON LIV...", real:  371.10, esperado:  400.78 },
  { tipo: "SEDAN",        real:  246.23, esperado:  198.55 },
  { tipo: "FURGON",       real:  198.40, esperado:  225.10 },
  { tipo: "CAMIONETA",    real:  155.92, esperado:  170.30 },
];

const POR_TIPO_PROM = [
  { tipo: "PICKUP",          v: 5.87 },
  { tipo: "FURGON LIVIANO",  v: 4.70 },
  { tipo: "SEDAN",           v: 2.56 },
  { tipo: "FURGON",          v: 3.20 },
  { tipo: "CAMIONETA",       v: 2.10 },
];

const TABLA = [
  { region: "CENTR...", subregion: "ABETO",    base: "DIAMANTE", dominio: "PLG287",  total: 13.95, esperado: 24.85, diff: -10.90 },
  { region: "CENTR...", subregion: "ABETO",    base: "DIAMANTE", dominio: "NJB887",  total: 11.82, esperado: 20.76, diff:  -8.94 },
  { region: "CENTR...", subregion: "ABETO",    base: "DIAMANTE", dominio: "LQR110",  total:  8.06, esperado: 15.80, diff:  -7.74 },
  { region: "CENTR...", subregion: "ABETO",    base: "DIAMANTE", dominio: "AB205GR", total: 17.10, esperado: 23.03, diff:  -5.93 },
  { region: "CENTR...", subregion: "ABETO",    base: "ESPINELA", dominio: "AA860TR", total:  9.99, esperado: 15.46, diff:  -5.47 },
  { region: "CENTR...", subregion: "SAUCE",    base: "RUBI",     dominio: "LQR114",  total:  9.51, esperado: 14.65, diff:  -5.15 },
  { region: "CENTR...", subregion: "SAUCE",    base: "RUBI",     dominio: "AC655IH", total:  7.23, esperado: 12.19, diff:  -4.96 },
  { region: "CENTR...", subregion: "SAUCE",    base: "ZAFIRO",   dominio: "LBS912",  total:  6.40, esperado: 11.05, diff:  -4.65 },
  { region: "CENTR...", subregion: "ALAMO",    base: "TOPACIO",  dominio: "GTR740",  total:  5.88, esperado: 10.22, diff:  -4.34 },
  { region: "NORTE",    subregion: "PINO",     base: "ESMERALDA", dominio: "AC966RO", total: 12.50, esperado: 16.80, diff:  -4.30 },
  { region: "NORTE",    subregion: "PINO",     base: "ESMERALDA", dominio: "AC796TJ", total:  8.92, esperado: 13.05, diff:  -4.13 },
  { region: "NORTE",    subregion: "CEDRO",    base: "OPALO",    dominio: "AD959JR", total:  7.10, esperado: 10.80, diff:  -3.70 },
  { region: "SUR",      subregion: "ROBLE",    base: "JADE",     dominio: "AE067NU", total:  6.85, esperado:  9.95, diff:  -3.10 },
];

const fmt = (v, d = 2) =>
  v.toLocaleString("es-PE", { minimumFractionDigits: d, maximumFractionDigits: d });

// Máx absoluto para escalas de barras en la tabla
const TABLA_MAX = Math.max(...TABLA.map((r) => Math.max(r.total, r.esperado)));
const DIFF_MAX  = Math.max(...TABLA.map((r) => Math.abs(r.diff)));

/* ========================= COMPONENTES ========================= */

function KpiCard({ label, value, testid }) {
  return (
    <div
      data-testid={testid}
      className="bg-white rounded-md p-4 flex flex-col gap-2"
      style={{
        // borde "doble" sutil como en la referencia
        boxShadow: `0 0 0 1px ${C_BORDER}55, 0 0 0 4px #ffffff, 0 0 0 5px ${C_BORDER}55`,
      }}
    >
      <span className="text-[10px] font-semibold uppercase tracking-wider text-neutral-500 leading-tight">
        {label}
      </span>
      <div className="text-3xl font-bold text-neutral-900 leading-none mt-1">
        {fmt(value)}
      </div>
    </div>
  );
}

function Card({ title, children, testid, action }) {
  return (
    <div
      className="bg-white rounded-2xl border border-neutral-200 shadow-sm p-4 flex flex-col"
      data-testid={testid}
    >
      <div className="flex items-start justify-between mb-2">
        <h3 className="text-[13px] font-semibold text-neutral-700">{title}</h3>
        {action}
      </div>
      {children}
    </div>
  );
}

// Etiqueta "burbuja" arriba de las barras (total apilado y promedio)
function PillLabel({ x, y, width, value, fill = "#e5e5e5", color = "#404040" }) {
  if (value == null) return null;
  const cx = x + width / 2;
  return (
    <g>
      <rect
        x={cx - 22}
        y={y - 18}
        width={44}
        height={16}
        rx={4}
        fill={fill}
      />
      <text
        x={cx}
        y={y - 6}
        textAnchor="middle"
        style={{ fontSize: 10, fontWeight: 700, fill: color }}
      >
        {typeof value === "number" ? fmt(value) : value}
      </text>
    </g>
  );
}

const TotalPillLabel = (props) => (
  <PillLabel {...props} value={props.value} fill="#e5e5e5" color="#404040" />
);

const PromedioPillLabel = (props) => {
  if (props.value == null) return null;
  return (
    <g>
      <rect
        x={props.x - 18}
        y={props.y - 18}
        width={36}
        height={14}
        rx={3}
        fill={C_TEAL}
      />
      <text
        x={props.x}
        y={props.y - 7}
        textAnchor="middle"
        style={{ fontSize: 10, fontWeight: 700, fill: "#0f3a31" }}
      >
        {fmt(props.value, 2)}
      </text>
    </g>
  );
};

function MapaCO2() {
  // Hotspots simulados (porcentaje desde top-left del contenedor) — visualización placeholder
  const HOTSPOTS = [
    { top: "32%", left: "22%", size: 26, c: "#F59E0B" },
    { top: "28%", left: "28%", size: 18, c: "#F97316" },
    { top: "38%", left: "30%", size: 22, c: "#F59E0B" },
    { top: "46%", left: "33%", size: 32, c: "#EA580C" },
    { top: "52%", left: "38%", size: 20, c: "#F59E0B" },
    { top: "58%", left: "44%", size: 28, c: "#F97316" },
    { top: "62%", left: "48%", size: 38, c: C_PURPLE }, // CDMX
    { top: "60%", left: "55%", size: 18, c: "#F59E0B" },
    { top: "64%", left: "60%", size: 22, c: "#F97316" },
    { top: "70%", left: "62%", size: 20, c: "#EA580C" },
    { top: "70%", left: "70%", size: 24, c: "#F59E0B" },
    { top: "72%", left: "76%", size: 18, c: "#F97316" },
  ];
  return (
    <Card title="Mapa de Emisiones de CO2" testid="co2-map">
      <div className="relative h-[330px] rounded-lg overflow-hidden border border-neutral-200 bg-neutral-100">
        <iframe
          title="Mapa de emisiones CO2"
          src="https://www.openstreetmap.org/export/embed.html?bbox=-118%2C13%2C-84%2C33&layer=mapnik"
          className="absolute inset-0 w-full h-full"
          style={{ filter: "grayscale(0.4) saturate(0.7)" }}
          loading="lazy"
        />
        <div className="absolute inset-0 pointer-events-none">
          {HOTSPOTS.map((h, i) => (
            <span
              key={i}
              className="absolute rounded-full"
              style={{
                top: h.top,
                left: h.left,
                width: h.size,
                height: h.size,
                background: `radial-gradient(circle, ${h.c}cc 0%, ${h.c}00 70%)`,
                transform: "translate(-50%, -50%)",
              }}
            />
          ))}
        </div>
      </div>
    </Card>
  );
}

/* ========================= MAIN ========================= */

export default function EmisionesCO2() {
  const [tab, setTab] = useState("emisiones");

  return (
    <div className="space-y-4" data-testid="co2-page">
      {/* Encabezado */}
      <div>
        <h2 className="font-cabinet font-bold text-2xl md:text-3xl text-neutral-900">
          Emisiones CO2
        </h2>
        <p className="text-sm text-neutral-500 mt-1">
          Indicadores ambientales y trazabilidad de huella de carbono de la flota.
        </p>
      </div>

      {/* Tabs */}
      <div className="flex gap-6 border-b border-neutral-200" data-testid="co2-tabs">
        {TABS.map((t) => {
          const active = t.key === tab;
          return (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              data-testid={`co2-tab-${t.key}`}
              className={`pb-3 -mb-px text-sm font-semibold border-b-2 transition-colors ${
                active
                  ? "text-[#8039F4] border-[#8039F4]"
                  : "text-neutral-500 border-transparent hover:text-neutral-800"
              }`}
            >
              {t.label}
            </button>
          );
        })}
      </div>

      {tab === "emisiones" ? (
        <div className="space-y-4">
          {/* FILA 1 — KPIs */}
          <div
            className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 pt-1"
            data-testid="co2-row-1"
          >
            {KPIS.map((k) => (
              <KpiCard key={k.key} {...k} testid={`co2-kpi-${k.key}`} />
            ))}
          </div>

          {/* FILA 2 — Evolución + Mapa */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-3" data-testid="co2-row-2">
            <Card
              title="Evolución de Toneladas de CO2 Emitido Total y Promedio por Vehículo"
              testid="co2-chart-evolucion"
              action={
                <div className="flex items-center gap-3 text-[10px] font-semibold text-neutral-600">
                  <span className="text-neutral-500">Emisiones</span>
                  <span className="flex items-center gap-1">
                    <span className="w-2.5 h-2.5 rounded-full" style={{ background: C_TEAL }} />
                    Diésel
                  </span>
                  <span className="flex items-center gap-1">
                    <span className="w-2.5 h-2.5 rounded-full" style={{ background: C_GASOLINA }} />
                    Gasolina
                  </span>
                  <span className="flex items-center gap-1">
                    <span className="w-4 h-0 border-t-2 border-dashed" style={{ borderColor: C_TEAL }} />
                    TN Emitidas Promedio
                  </span>
                </div>
              }
            >
              <div className="h-[330px]">
                <ResponsiveContainer width="100%" height="100%">
                  <ComposedChart
                    data={EVOLUCION}
                    margin={{ top: 28, right: 24, left: -4, bottom: 8 }}
                  >
                    <CartesianGrid stroke="#f3f4f6" vertical={false} />
                    <XAxis dataKey="anio" tick={{ fontSize: 11, fill: "#525252" }} />
                    <YAxis
                      yAxisId="left"
                      tick={{ fontSize: 11, fill: "#525252" }}
                      domain={[0, 1000]}
                      ticks={[0, 500, 1000]}
                    />
                    <YAxis
                      yAxisId="right"
                      orientation="right"
                      tick={{ fontSize: 11, fill: "#525252" }}
                      domain={[1, 3]}
                      ticks={[1, 2, 3]}
                    />
                    <Tooltip
                      formatter={(v, n) => {
                        if (v == null) return ["—", n];
                        const labels = {
                          diesel: "Diésel (TN)",
                          gasolina: "Gasolina (TN)",
                          total: "Total (TN)",
                          promedio: "Promedio / vehículo",
                        };
                        return [`${fmt(v, 2)}`, labels[n] || n];
                      }}
                    />
                    <Bar yAxisId="left" dataKey="diesel" stackId="a" fill={C_TEAL} barSize={56}>
                      <LabelList
                        dataKey="diesel"
                        position="center"
                        formatter={(v) => fmt(v, 2)}
                        style={{ fontSize: 10, fontWeight: 700, fill: "#0f3a31" }}
                      />
                    </Bar>
                    <Bar yAxisId="left" dataKey="gasolina" stackId="a" fill={C_GASOLINA} barSize={56}>
                      <LabelList
                        dataKey="gasolina"
                        position="center"
                        formatter={(v) => fmt(v, 2)}
                        style={{ fontSize: 10, fontWeight: 700, fill: "#fff" }}
                      />
                      {/* Etiqueta total como burbuja arriba */}
                      <LabelList
                        dataKey="total"
                        position="top"
                        content={TotalPillLabel}
                      />
                    </Bar>
                    <Line
                      yAxisId="right"
                      type="monotone"
                      dataKey="promedio"
                      stroke={C_TEAL}
                      strokeWidth={2}
                      strokeDasharray="5 4"
                      dot={{ r: 3, fill: C_TEAL, stroke: C_TEAL }}
                      connectNulls
                    >
                      <LabelList
                        dataKey="promedio"
                        position="top"
                        content={PromedioPillLabel}
                      />
                    </Line>
                  </ComposedChart>
                </ResponsiveContainer>
              </div>
            </Card>

            <MapaCO2 />
          </div>

          {/* FILA 3 — Total / Promedio / Tabla */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-3" data-testid="co2-row-3">
            <Card
              title="Total TN CO2 Emitido por Tipo Vehículo, Marca y Modelo"
              testid="co2-chart-total"
              action={
                <div className="flex items-center gap-2 text-[10px] font-semibold text-neutral-600">
                  <span className="text-neutral-500">Emisiones</span>
                  <span className="flex items-center gap-1">
                    <span className="w-2.5 h-2.5 rounded-full" style={{ background: C_TEAL }} />
                    Real
                  </span>
                  <span className="flex items-center gap-1">
                    <span className="w-2.5 h-2.5 rounded-full" style={{ background: C_PURPLE }} />
                    Esperado
                  </span>
                </div>
              }
            >
              <div className="h-[320px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    layout="vertical"
                    data={POR_TIPO_TOTAL}
                    margin={{ top: 8, right: 56, left: 8, bottom: 8 }}
                    barGap={3}
                  >
                    <CartesianGrid stroke="#f3f4f6" horizontal={false} />
                    <XAxis type="number" tick={{ fontSize: 10, fill: "#525252" }} hide />
                    <YAxis
                      type="category"
                      dataKey="tipo"
                      tick={{ fontSize: 11, fill: "#404040", fontWeight: 600 }}
                      width={90}
                    />
                    <Tooltip formatter={(v) => `${fmt(v, 2)} TN`} />
                    <Bar dataKey="real" fill={C_TEAL} barSize={14}>
                      <LabelList
                        dataKey="real"
                        position="insideRight"
                        formatter={(v) => fmt(v, 2)}
                        style={{ fontSize: 10, fontWeight: 700, fill: "#0f3a31" }}
                      />
                    </Bar>
                    <Bar dataKey="esperado" fill={C_PURPLE} barSize={14}>
                      <LabelList
                        dataKey="esperado"
                        position="insideRight"
                        formatter={(v) => fmt(v, 2)}
                        style={{ fontSize: 10, fontWeight: 700, fill: "#fff" }}
                      />
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </Card>

            <Card
              title="Promedio TN CO2 Emitido por Tipo Vehículo, Marca y Modelo"
              testid="co2-chart-promedio"
            >
              <div className="h-[320px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    layout="vertical"
                    data={POR_TIPO_PROM}
                    margin={{ top: 8, right: 48, left: 8, bottom: 8 }}
                  >
                    <CartesianGrid stroke="#f3f4f6" horizontal={false} />
                    <XAxis type="number" tick={{ fontSize: 10, fill: "#525252" }} hide />
                    <YAxis
                      type="category"
                      dataKey="tipo"
                      tick={{ fontSize: 11, fill: "#404040", fontWeight: 600 }}
                      width={110}
                    />
                    <Tooltip formatter={(v) => `${fmt(v, 2)} TN`} />
                    <Bar dataKey="v" fill={C_PURPLE} barSize={22}>
                      <LabelList
                        dataKey="v"
                        position="right"
                        formatter={(v) => fmt(v, 2)}
                        style={{ fontSize: 11, fontWeight: 700, fill: "#525252" }}
                      />
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </Card>

            <Card
              title="Detalle de Emisiones por Region, Subregión, Base y Dominio"
              testid="co2-table"
            >
              <div className="overflow-x-auto max-h-[320px] overflow-y-auto rounded-md border border-neutral-100">
                <table className="w-full text-[11px]">
                  <thead className="bg-white sticky top-0 z-10">
                    <tr className="text-[9px] font-bold uppercase text-neutral-500 border-b border-neutral-200">
                      <th className="px-2 py-2 text-left">Región</th>
                      <th className="px-2 py-2 text-left">Subregión</th>
                      <th className="px-2 py-2 text-left">Base</th>
                      <th className="px-2 py-2 text-left">Dominio</th>
                      <th className="px-2 py-2 text-right">CO2 Emitido<br/>Total [tn]</th>
                      <th className="px-2 py-2 text-right">CO2 Emitido<br/>Esperado [tn]</th>
                      <th className="px-2 py-2 text-right">Diferencia<br/>Emisiones [tn] ▲</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-neutral-100">
                    {TABLA.map((r, i) => {
                      const pctTotal = (r.total / TABLA_MAX) * 100;
                      const pctEsp = (r.esperado / TABLA_MAX) * 100;
                      const pctDiff = (Math.abs(r.diff) / DIFF_MAX) * 100;
                      return (
                        <tr key={i} data-testid={`co2-table-row-${i}`} className="hover:bg-neutral-50">
                          <td className="px-2 py-1 text-neutral-700 whitespace-nowrap">{r.region}</td>
                          <td className="px-2 py-1 text-neutral-700">{r.subregion}</td>
                          <td className="px-2 py-1 text-neutral-700">{r.base}</td>
                          <td className="px-2 py-1 font-mono text-neutral-800">{r.dominio}</td>
                          <td className="px-2 py-1">
                            <div className="flex items-center justify-end gap-1">
                              <div
                                className="rounded-sm h-3"
                                style={{ width: `${pctTotal * 0.55}%`, background: C_LILAC, minWidth: 4 }}
                              />
                              <span className="text-neutral-800 font-semibold w-10 text-right">{fmt(r.total)}</span>
                            </div>
                          </td>
                          <td className="px-2 py-1">
                            <div className="flex items-center justify-end gap-1">
                              <div
                                className="rounded-sm h-3"
                                style={{ width: `${pctEsp * 0.55}%`, background: C_LILAC_BG, minWidth: 4 }}
                              />
                              <span className="text-neutral-800 font-semibold w-10 text-right">{fmt(r.esperado)}</span>
                            </div>
                          </td>
                          <td className="px-2 py-1">
                            <div className="flex items-center justify-end gap-1">
                              <div
                                className="rounded-sm h-3"
                                style={{ width: `${pctDiff * 0.45}%`, background: C_TEAL, minWidth: 4 }}
                              />
                              <span
                                className="font-bold w-10 text-right"
                                style={{ color: r.diff < 0 ? "#0f7a63" : "#b14910" }}
                              >
                                {fmt(r.diff)}
                              </span>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </Card>
          </div>
        </div>
      ) : (
        <div
          className="bg-white rounded-2xl border border-neutral-200 shadow-sm p-16 flex flex-col items-center justify-center text-center"
          data-testid="co2-rendimiento-placeholder"
        >
          <div
            className="w-16 h-16 rounded-2xl flex items-center justify-center mb-4"
            style={{ background: `${C_PURPLE}14`, color: C_PURPLE }}
          >
            <Cloud className="w-8 h-8" strokeWidth={1.6} />
          </div>
          <h3 className="text-lg font-semibold text-neutral-800">Rendimiento KM/GL</h3>
          <p className="text-sm text-neutral-500 mt-2 max-w-md">
            Próximamente. Aquí se mostrarán los indicadores de rendimiento de
            kilómetros por galón por vehículo, marca y base.
          </p>
        </div>
      )}
    </div>
  );
}
