import React, { useMemo, useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  Lock,
  Truck,
  CheckCircle2,
  Fuel,
  FileCheck2,
  AlertCircle,
  ArrowLeft,
  LogOut,
  TrendingDown,
  Wrench,
  MapPin,
  Calendar,
  Gauge,
  DollarSign,
  Activity,
} from "lucide-react";

// ============== Storage ==============
const STORAGE_KEY = "enered_client_session";
const loadClient = () => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
};

// ============== Demo data (fallback) ==============
const DEMO = {
  expediente: "ENR-2026-00001",
  expedienteAtu: "ATU-2026-048817",
  subsidio: 18240,
  gastoTotal: 129400,
  ahorroPct: 14.1,
  stage: "evaluacion", // enviada | evaluacion | aprobada | abonada
  fechas: {
    enviada: "02 ago 2026",
    evaluacion: "desde 05 ago",
    aprobada: "—",
    abonada: "—",
  },
  unidades: { incluidas: 12, total: 12, breakdown: "8 N3 · 4 N2" },
  habilitadas: { activas: 12, total: 12 },
  galones: { reconocidos: 4560, comprobOk: 181, comprobTotal: 184 },
  docs: { pct: 92, alert: "1 por vencer pronto" },
  flota: {
    gasto: 129400,
    galones: 12400,
    precioGal: 10.43,
    precioDelta: -0.22,
    costoUnidad: 10783,
    antiguedad: 7.2,
    masDeDiez: 3,
  },
  gastoSemanal: [
    { sem: "S1", val: 15800 },
    { sem: "S2", val: 16200 },
    { sem: "S3", val: 14500 },
    { sem: "S4", val: 16700 },
    { sem: "S5", val: 15400 },
    { sem: "S6", val: 18900, peak: true },
    { sem: "S7", val: 15600 },
    { sem: "S8", val: 14100 },
  ],
  estaciones: [
    { name: "Grifo Repsol · Av. Industrial", city: "Trujillo", precio: 10.55, total: 48200 },
    { name: "Primax · Panamericana Norte", city: "Chiclayo", precio: 10.31, total: 29900 },
    { name: "Petroperú · Vía Evitamiento", city: "Trujillo", precio: 10.62, total: 24300 },
    { name: "Repsol · Av. España", city: "Trujillo", precio: 10.48, total: 18800 },
  ],
  ciudades: [
    { name: "Trujillo", pct: 57, color: "#8039F4" },
    { name: "Chiclayo", pct: 28, color: "#B98AFE" },
    { name: "Otras", pct: 15, color: "#E6D4FF" },
  ],
  topUnidades: [
    { placa: "V1B-209", cat: "N3", anio: 2014, gasto: 14820, note: "Unidad más antigua de la flota", alert: true },
    { placa: "T2H-841", cat: "N3", anio: 2015, gasto: 12440, note: "Consumo sobre el promedio de su categoría" },
    { placa: "L9P-115", cat: "N2", anio: 2017, gasto: 11210, note: "Operación frecuente en ruta Trujillo-Chiclayo" },
    { placa: "M4R-307", cat: "N3", anio: 2018, gasto: 10980, note: "Consumo dentro del promedio" },
  ],
};

// ============== Formatters ==============
const fmtSoles = (n) => `S/ ${Number(n || 0).toLocaleString("es-PE", { maximumFractionDigits: 0 })}`;
const fmtSolesDec = (n) =>
  `S/ ${Number(n || 0).toLocaleString("es-PE", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

// ============== Stages ==============
const STAGES = [
  { id: "enviada", label: "Solicitud enviada", date: (d) => d.enviada },
  { id: "evaluacion", label: "En evaluación ATU", date: (d) => d.evaluacion },
  { id: "aprobada", label: "Aprobada", date: (d) => d.aprobada },
  { id: "abonada", label: "Abonado en cuenta", date: (d) => d.abonada },
];

// ============== Subcomponents ==============
const Hero = ({ data }) => {
  const currentIdx = STAGES.findIndex((s) => s.id === data.stage);
  const progressPct = (currentIdx / (STAGES.length - 1)) * 100;

  return (
    <section
      className="relative overflow-hidden rounded-3xl text-white p-7 sm:p-9 shadow-xl"
      style={{
        background: "linear-gradient(135deg, #8039F4 0%, #6B26DC 55%, #5A1FB8 100%)",
      }}
      data-testid="hero-subsidio"
    >
      {/* decorative blobs */}
      <div className="absolute -top-32 -right-20 h-80 w-80 rounded-full bg-white/10 blur-3xl pointer-events-none" />
      <div className="absolute -bottom-24 -left-12 h-64 w-64 rounded-full bg-white/5 blur-3xl pointer-events-none" />

      <div className="relative grid grid-cols-1 lg:grid-cols-[1fr_auto] gap-6 items-start">
        {/* Left: subsidy amount */}
        <div>
          <div className="inline-flex items-center gap-2 text-[11px] sm:text-xs font-semibold text-white/85 mb-3">
            <Lock className="h-3.5 w-3.5" />
            Tu subsidio reconocido · N.° {data.expediente}
          </div>
          <div className="font-cabinet font-extrabold leading-none text-[44px] sm:text-[56px] tracking-tight">
            {fmtSoles(data.subsidio)}
          </div>
          <div className="text-white/80 text-sm mt-2">
            Validado de tus comprobantes · expediente {data.expedienteAtu}
          </div>
        </div>

        {/* Right: % ahorro card */}
        <div className="bg-white/15 backdrop-blur-md border border-white/20 rounded-2xl p-5 w-full lg:w-[340px]">
          <div className="text-[10px] font-bold uppercase tracking-[0.15em] text-white/80 mb-2">
            % de ahorro del total consumido
          </div>
          <div className="font-cabinet font-extrabold text-5xl leading-none mb-2">
            {data.ahorroPct.toFixed(1)}%
          </div>
          <div className="text-[12px] text-white/85 leading-snug">
            De los {fmtSoles(data.gastoTotal)} que gastaste en diésel, el Estado te devuelve{" "}
            <span className="font-bold">{fmtSoles(data.subsidio)}</span>.
          </div>
        </div>
      </div>

      {/* Timeline */}
      <div className="relative mt-8">
        <div className="absolute left-[6%] right-[6%] top-[14px] h-[3px] bg-white/20 rounded-full" />
        <div
          className="absolute left-[6%] top-[14px] h-[3px] bg-white rounded-full transition-all duration-700"
          style={{ width: `calc(${progressPct}% * 0.88)` }}
        />
        <div className="relative grid grid-cols-4 gap-3">
          {STAGES.map((s, i) => {
            const done = i < currentIdx;
            const active = i === currentIdx;
            return (
              <div key={s.id} className="flex flex-col items-center text-center">
                <div
                  className={`relative h-8 w-8 rounded-full grid place-items-center transition ${
                    done
                      ? "bg-white text-brand"
                      : active
                      ? "bg-white text-brand ring-4 ring-white/40"
                      : "bg-white/25 text-white/60"
                  }`}
                >
                  {done ? (
                    <CheckCircle2 className="h-4 w-4" />
                  ) : active ? (
                    <div className="h-2.5 w-2.5 rounded-full bg-brand animate-pulse" />
                  ) : (
                    <div className="h-2 w-2 rounded-full bg-white/60" />
                  )}
                </div>
                <div className={`mt-2 text-[12px] font-bold ${done || active ? "text-white" : "text-white/60"}`}>
                  {s.label}
                </div>
                <div className={`text-[10px] mt-0.5 ${done || active ? "text-white/75" : "text-white/45"}`}>
                  {s.date(data.fechas)}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
};

const TopKpi = ({ icon, color, label, value, sub, subTone = "default", testId }) => {
  const subColors = {
    default: "text-neutral-500",
    success: "text-emerald-600 font-semibold",
    danger: "text-rose-600 font-semibold",
    muted: "text-neutral-500",
  };
  return (
    <div className="bg-white rounded-2xl border border-neutral-200/70 p-5 hover:shadow-md hover:-translate-y-0.5 transition" data-testid={testId}>
      <div className="flex items-center gap-2 text-[12px] font-semibold text-neutral-700 mb-3">
        <span className={`inline-grid place-items-center h-5 w-5 rounded-md`} style={{ background: color + "22", color }}>
          {icon}
        </span>
        {label}
      </div>
      <div className="font-cabinet font-extrabold text-[28px] leading-none text-neutral-900 mb-1.5">
        {value}
      </div>
      <div className={`text-[12px] ${subColors[subTone]}`}>{sub}</div>
    </div>
  );
};

const FleetKpi = ({ icon, color, label, value, sub, subTone = "default", testId }) => {
  const subColors = {
    default: "text-neutral-500",
    success: "text-emerald-600 font-semibold",
    danger: "text-rose-600 font-semibold",
  };
  return (
    <div className="bg-white rounded-2xl border border-neutral-200/70 p-5 hover:shadow-md hover:-translate-y-0.5 transition" data-testid={testId}>
      <div className="flex items-center gap-2 text-[12px] font-semibold text-neutral-700 mb-3">
        <span className="inline-grid place-items-center h-5 w-5 rounded-md" style={{ background: color + "22", color }}>
          {icon}
        </span>
        {label}
      </div>
      <div className="font-cabinet font-extrabold text-[28px] leading-none text-neutral-900 mb-1.5">
        {value}
      </div>
      <div className={`text-[12px] ${subColors[subTone]}`}>{sub}</div>
    </div>
  );
};

// ============== Bar chart (SVG, sin libs) ==============
const BarChart = ({ data }) => {
  const max = Math.max(...data.map((d) => d.val));
  const W = 640;
  const H = 240;
  const PAD = { l: 44, r: 16, t: 16, b: 32 };
  const innerW = W - PAD.l - PAD.r;
  const innerH = H - PAD.t - PAD.b;
  const barW = innerW / data.length / 1.6;
  const step = innerW / data.length;

  // Y-axis ticks (5 niveles)
  const yMax = Math.ceil(max / 4000) * 4000;
  const ticks = [0, yMax * 0.25, yMax * 0.5, yMax * 0.75, yMax];

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-auto" role="img" aria-label="Evolución semanal del gasto">
      {/* grid */}
      {ticks.map((t, i) => {
        const y = PAD.t + innerH - (t / yMax) * innerH;
        return (
          <g key={i}>
            <line x1={PAD.l} x2={W - PAD.r} y1={y} y2={y} stroke="#E5E7EB" strokeDasharray="3,4" />
            <text x={PAD.l - 8} y={y + 4} textAnchor="end" fontSize="10" fill="#9CA3AF" fontFamily="Manrope, sans-serif">
              S/{Math.round(t / 1000)}k
            </text>
          </g>
        );
      })}
      {/* bars */}
      {data.map((d, i) => {
        const h = (d.val / yMax) * innerH;
        const x = PAD.l + i * step + (step - barW) / 2;
        const y = PAD.t + innerH - h;
        const color = d.peak ? "#F43F5E" : "#8039F4";
        return (
          <g key={d.sem}>
            <rect x={x} y={y} width={barW} height={h} rx="6" fill={color}>
              <title>{`${d.sem}: ${fmtSoles(d.val)}`}</title>
            </rect>
            <text
              x={x + barW / 2}
              y={H - PAD.b + 18}
              textAnchor="middle"
              fontSize="11"
              fill="#6B7280"
              fontFamily="Manrope, sans-serif"
              fontWeight="600"
            >
              {d.sem}
            </text>
          </g>
        );
      })}
    </svg>
  );
};

// ============== Donut chart (SVG) ==============
const Donut = ({ data, size = 220 }) => {
  const cx = size / 2;
  const cy = size / 2;
  const r = size / 2 - 18;
  const inner = r - 28;
  const total = data.reduce((s, d) => s + d.pct, 0) || 1;
  let acc = 0;

  const arc = (start, end) => {
    const sa = (start / 100) * Math.PI * 2 - Math.PI / 2;
    const ea = (end / 100) * Math.PI * 2 - Math.PI / 2;
    const x1 = cx + r * Math.cos(sa);
    const y1 = cy + r * Math.sin(sa);
    const x2 = cx + r * Math.cos(ea);
    const y2 = cy + r * Math.sin(ea);
    const x3 = cx + inner * Math.cos(ea);
    const y3 = cy + inner * Math.sin(ea);
    const x4 = cx + inner * Math.cos(sa);
    const y4 = cy + inner * Math.sin(sa);
    const large = end - start > 50 ? 1 : 0;
    return `M ${x1} ${y1} A ${r} ${r} 0 ${large} 1 ${x2} ${y2} L ${x3} ${y3} A ${inner} ${inner} 0 ${large} 0 ${x4} ${y4} Z`;
  };

  return (
    <svg viewBox={`0 0 ${size} ${size}`} className="w-[220px] h-[220px]" role="img" aria-label="Concentración de carga por ciudad">
      {data.map((d, i) => {
        const start = (acc / total) * 100;
        acc += d.pct;
        const end = (acc / total) * 100;
        return <path key={i} d={arc(start, end)} fill={d.color}><title>{`${d.name}: ${d.pct}%`}</title></path>;
      })}
      <text x={cx} y={cy - 4} textAnchor="middle" fontSize="13" fill="#6B7280" fontFamily="Manrope, sans-serif" fontWeight="600">
        Top ciudad
      </text>
      <text x={cx} y={cy + 18} textAnchor="middle" fontSize="18" fontWeight="800" fill="#111827" fontFamily="Cabinet Grotesk, sans-serif">
        {data[0]?.name}
      </text>
    </svg>
  );
};

// ============== Lists ==============
const RankBar = ({ percent, color = "#8039F4" }) => (
  <div className="mt-2 h-1.5 w-full rounded-full bg-neutral-100 overflow-hidden">
    <div className="h-full rounded-full transition-all" style={{ width: `${percent}%`, background: color }} />
  </div>
);

const UnidadesList = ({ items }) => {
  const max = Math.max(...items.map((i) => i.gasto));
  return (
    <ol className="space-y-4" data-testid="lista-unidades">
      {items.map((u, idx) => (
        <li key={u.placa}>
          <div className="flex items-center gap-3">
            <span className="h-7 w-7 grid place-items-center rounded-lg bg-brand-50 text-brand text-sm font-extrabold flex-shrink-0">
              {idx + 1}
            </span>
            <div className="min-w-0 flex-1">
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2 min-w-0">
                  <span className={`font-bold text-sm truncate ${u.alert ? "text-rose-600" : "text-neutral-900"}`}>
                    {u.placa} · {u.cat} ({u.anio})
                  </span>
                </div>
                <span className={`font-cabinet font-extrabold text-sm tabular-nums ${u.alert ? "text-rose-600" : "text-neutral-900"}`}>
                  {fmtSoles(u.gasto)}
                </span>
              </div>
              <div className="text-[12px] text-neutral-500 mt-0.5">{u.note}</div>
              <RankBar percent={(u.gasto / max) * 100} color={u.alert ? "#F43F5E" : "#8039F4"} />
            </div>
          </div>
        </li>
      ))}
    </ol>
  );
};

const EstacionesList = ({ items }) => {
  const max = Math.max(...items.map((i) => i.total));
  return (
    <ol className="space-y-4" data-testid="lista-estaciones">
      {items.map((e, idx) => (
        <li key={e.name}>
          <div className="flex items-center gap-3">
            <span className="h-7 w-7 grid place-items-center rounded-lg bg-brand-50 text-brand text-sm font-extrabold flex-shrink-0">
              {idx + 1}
            </span>
            <div className="min-w-0 flex-1">
              <div className="flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <div className="font-bold text-sm text-neutral-900 truncate">{e.name}</div>
                  <div className="text-[12px] text-neutral-500">
                    {e.city} · {fmtSolesDec(e.precio)} por galón
                  </div>
                </div>
                <span className="font-cabinet font-extrabold text-sm tabular-nums text-neutral-900">
                  {fmtSoles(e.total)}
                </span>
              </div>
              <RankBar percent={(e.total / max) * 100} />
            </div>
          </div>
        </li>
      ))}
    </ol>
  );
};

// ============== Empty State ==============
const EmptyState = () => (
  <div className="min-h-screen grid place-items-center bg-[#F7F6FB] p-6">
    <div className="max-w-md w-full bg-white rounded-3xl shadow-xl border border-neutral-200 p-8 text-center">
      <div className="h-14 w-14 rounded-2xl bg-brand-50 text-brand grid place-items-center mx-auto mb-4">
        <AlertCircle className="h-7 w-7" />
      </div>
      <h2 className="font-cabinet font-extrabold text-xl text-neutral-900 mb-2">No tienes una sesión activa</h2>
      <p className="text-sm text-neutral-500 mb-6">
        Para acceder al panel del subsidio debes registrarte primero desde la calculadora.
      </p>
      <div className="flex flex-col gap-2">
        <Link
          to="/"
          data-testid="back-to-calculator-btn"
          className="inline-flex items-center justify-center gap-2 px-5 py-3 rounded-xl bg-brand text-white font-bold text-sm hover:bg-brand-hover transition"
        >
          <ArrowLeft className="h-4 w-4" />
          Ir a la calculadora
        </Link>
        <button
          onClick={() => {
            localStorage.setItem(STORAGE_KEY, JSON.stringify({ ...DEMO, _demo: true }));
            window.location.reload();
          }}
          data-testid="load-demo-btn"
          className="text-xs font-semibold text-brand hover:underline mt-2"
        >
          Ver demo del dashboard
        </button>
      </div>
    </div>
  </div>
);

// ============== Main Dashboard ==============
const Dashboard = () => {
  const navigate = useNavigate();
  const [client, setClient] = useState(() => loadClient());

  useEffect(() => {
    if (client && !client.subsidio && !client._demo) {
      // Cliente sin datos del subsidio. Marcamos con DEMO mientras tanto.
    }
  }, [client]);

  if (!client) return <EmptyState />;

  // Merge: si el cliente no trae todos los campos, usamos demo como fallback visual.
  const data = { ...DEMO, ...client };

  const handleLogout = () => {
    localStorage.removeItem(STORAGE_KEY);
    navigate("/");
  };

  return (
    <div className="min-h-screen bg-[#F7F6FB]">
      {/* Top bar */}
      <header className="border-b border-neutral-200/70 bg-white/80 backdrop-blur sticky top-0 z-20">
        <div className="max-w-7xl mx-auto px-5 sm:px-8 h-14 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <img src="/assets/enered-logo.png" alt="Enered" className="h-7 w-auto" data-testid="dashboard-logo" />
            <div className="hidden sm:flex items-center gap-2 text-xs">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
              <span className="font-semibold text-neutral-700">Panel del cliente subsidio</span>
            </div>
          </div>
          <div className="flex items-center gap-1">
            <Link
              to="/"
              data-testid="back-link"
              className="hidden sm:inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-neutral-600 hover:bg-neutral-100 transition"
            >
              <ArrowLeft className="h-3.5 w-3.5" /> Calculadora
            </Link>
            <button
              onClick={handleLogout}
              data-testid="logout-btn"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-rose-600 hover:bg-rose-50 transition"
            >
              <LogOut className="h-3.5 w-3.5" /> Salir
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-5 sm:px-8 py-7 space-y-6">
        {/* HERO */}
        <Hero data={data} />

        {/* TOP KPIs (4) */}
        <section className="grid grid-cols-2 lg:grid-cols-4 gap-4" data-testid="kpi-top">
          <TopKpi
            icon={<Truck className="h-3 w-3" />}
            color="#8039F4"
            label="Unidades incluidas"
            value={
              <span>
                {data.unidades.incluidas} <span className="text-neutral-400 text-lg font-bold">/ {data.unidades.total}</span>
              </span>
            }
            sub={data.unidades.breakdown}
            subTone="muted"
            testId="kpi-unidades"
          />
          <TopKpi
            icon={<CheckCircle2 className="h-3 w-3" />}
            color="#10B981"
            label="Habilitadas y activas"
            value={
              <span>
                {data.habilitadas.activas} <span className="text-neutral-400 text-lg font-bold">/ {data.habilitadas.total}</span>
              </span>
            }
            sub="100% operativas"
            subTone="success"
            testId="kpi-habilitadas"
          />
          <TopKpi
            icon={<Fuel className="h-3 w-3" />}
            color="#F43F5E"
            label="Galones reconocidos"
            value={data.galones.reconocidos.toLocaleString("es-PE")}
            sub={`${data.galones.comprobOk} de ${data.galones.comprobTotal} comprobantes`}
            subTone="muted"
            testId="kpi-galones"
          />
          <TopKpi
            icon={<FileCheck2 className="h-3 w-3" />}
            color="#6B7280"
            label="Documentos en regla"
            value={`${data.docs.pct}%`}
            sub={data.docs.alert}
            subTone="danger"
            testId="kpi-docs"
          />
        </section>

        {/* CONTROL DE FLOTA HEADER */}
        <section data-testid="control-flota">
          <div className="flex items-center gap-3 mb-1">
            <div className="h-9 w-9 grid place-items-center rounded-xl bg-brand-50 text-brand">
              <Gauge className="h-4.5 w-4.5" />
            </div>
            <h2 className="font-cabinet font-extrabold text-xl text-neutral-900">Control de Flota</h2>
            <span className="inline-flex items-center gap-1 text-[11px] font-bold px-2.5 py-1 rounded-full bg-emerald-100 text-emerald-700">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
              Activo · gratis
            </span>
          </div>
          <p className="text-sm text-neutral-500 max-w-3xl ml-12">
            Indicadores accionables de tu operación, a partir de tus comprobantes y documentos. Te ayudan a reducir costos y detectar unidades ineficientes.
          </p>
        </section>

        {/* FLEET KPIs (4) */}
        <section className="grid grid-cols-2 lg:grid-cols-4 gap-4" data-testid="kpi-flota">
          <FleetKpi
            icon={<DollarSign className="h-3 w-3" />}
            color="#10B981"
            label="Gasto total en diésel"
            value={fmtSoles(data.flota.gasto)}
            sub={`2 meses · ${data.flota.galones.toLocaleString("es-PE")} gal`}
            subTone="default"
            testId="kpi-gasto"
          />
          <FleetKpi
            icon={<Fuel className="h-3 w-3" />}
            color="#F59E0B"
            label="Precio promedio por galón"
            value={fmtSolesDec(data.flota.precioGal)}
            sub={
              <span className="inline-flex items-center gap-1">
                <TrendingDown className="h-3 w-3" />
                {fmtSolesDec(data.flota.precioDelta)} vs. mes anterior
              </span>
            }
            subTone="success"
            testId="kpi-precio"
          />
          <FleetKpi
            icon={<Activity className="h-3 w-3" />}
            color="#3B82F6"
            label="Costo promedio por unidad"
            value={fmtSoles(data.flota.costoUnidad)}
            sub="por unidad · 2 meses"
            testId="kpi-costo-unidad"
          />
          <FleetKpi
            icon={<Wrench className="h-3 w-3" />}
            color="#EF4444"
            label="Antigüedad de flota"
            value={
              <span>
                {data.flota.antiguedad} <span className="text-neutral-500 text-base font-bold">años prom.</span>
              </span>
            }
            sub={`${data.flota.masDeDiez} unidades +10 años`}
            subTone="danger"
            testId="kpi-antiguedad"
          />
        </section>

        {/* CHARTS ROW */}
        <section className="grid grid-cols-1 lg:grid-cols-[1.6fr_1fr] gap-4">
          <div className="bg-white rounded-2xl border border-neutral-200/70 p-6" data-testid="chart-gasto">
            <div className="flex items-end justify-between flex-wrap gap-2 mb-4">
              <div>
                <h3 className="font-cabinet font-extrabold text-base text-neutral-900">
                  Evolución semanal del gasto en diésel
                </h3>
                <p className="text-xs text-neutral-500">de tus comprobantes · detecta picos de consumo</p>
              </div>
              <div className="flex items-center gap-3 text-[11px] font-semibold">
                <span className="inline-flex items-center gap-1.5">
                  <span className="h-2.5 w-2.5 rounded-sm bg-brand" />
                  <span className="text-neutral-600">Semana</span>
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <span className="h-2.5 w-2.5 rounded-sm bg-rose-500" />
                  <span className="text-neutral-600">Pico</span>
                </span>
              </div>
            </div>
            <BarChart data={data.gastoSemanal} />
          </div>

          <div className="bg-white rounded-2xl border border-neutral-200/70 p-6" data-testid="chart-ciudades">
            <h3 className="font-cabinet font-extrabold text-base text-neutral-900">Dónde cargas combustible</h3>
            <p className="text-xs text-neutral-500 mb-3">por ciudad · concentración de compra</p>
            <div className="flex flex-col items-center">
              <Donut data={data.ciudades} />
              <div className="mt-3 flex flex-wrap items-center justify-center gap-3 text-[11px] font-semibold">
                {data.ciudades.map((c) => (
                  <span key={c.name} className="inline-flex items-center gap-1.5">
                    <span className="h-2.5 w-2.5 rounded-sm" style={{ background: c.color }} />
                    <span className="text-neutral-700">{c.name}</span>
                    <span className="text-neutral-400">{c.pct}%</span>
                  </span>
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* RANKINGS */}
        <section className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <div className="bg-white rounded-2xl border border-neutral-200/70 p-6">
            <h3 className="font-cabinet font-extrabold text-base text-neutral-900">Unidades que más gastan</h3>
            <p className="text-xs text-neutral-500 mb-5">
              revisa las primeras: posible problema mecánico o manejo ineficiente
            </p>
            <UnidadesList items={data.topUnidades} />
          </div>

          <div className="bg-white rounded-2xl border border-neutral-200/70 p-6">
            <h3 className="font-cabinet font-extrabold text-base text-neutral-900">Estaciones donde más cargas</h3>
            <p className="text-xs text-neutral-500 mb-5">
              negocia descuento por volumen donde concentras compra
            </p>
            <EstacionesList items={data.estaciones} />
          </div>
        </section>

        {/* Footer note */}
        <div className="flex items-center gap-2 text-xs text-neutral-500 pt-2">
          <Calendar className="h-3.5 w-3.5" />
          Última actualización: {new Date().toLocaleString("es-PE", { dateStyle: "long", timeStyle: "short" })}
          <span className="mx-2">·</span>
          <MapPin className="h-3.5 w-3.5" />
          Enered Perú
        </div>
      </main>
    </div>
  );
};

export default Dashboard;

// Helper exportado para que la calculadora pueda crear una sesión.
export const createClientSession = (data) => {
  const session = {
    nombre: data.nombre || "",
    empresa: data.empresa || data.nombre || "Mi empresa",
    ruc: data.ruc || "",
    email: data.email || "",
    ...data,
    createdAt: new Date().toISOString(),
  };
  localStorage.setItem(STORAGE_KEY, JSON.stringify(session));
  return session;
};
