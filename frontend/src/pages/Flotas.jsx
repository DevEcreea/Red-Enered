import React, { useEffect, useMemo, useState } from "react";
import { ClipboardList, FileBarChart, QrCode } from "lucide-react";
import ControlIntegral from "./ControlIntegral";
import ReportesConsumo from "./ReportesConsumo";
import QRDescarga from "./QRDescarga";
import { api } from "../lib/api";
import { formatSoles, formatNumber } from "../lib/utils";

const TABS = [
  { id: "consumo", label: "Reportes Consumo", icon: FileBarChart, Component: ReportesConsumo, testid: "tab-reportes-consumo" },
  { id: "control", label: "Control Integral", icon: ClipboardList, Component: ControlIntegral, testid: "tab-control-integral" },
  { id: "qr", label: "Descarga tus QR", icon: QrCode, Component: QRDescarga, testid: "tab-qr" },
];

function SmallKpi({ label, value, accent }) {
  const txt = accent === "green" ? "text-green-600" : "text-neutral-900";
  return (
    <div className="bg-white border border-border rounded-xl p-4">
      <div className="text-[10px] uppercase tracking-widest font-bold text-neutral-500 mb-1">{label}</div>
      <div className={`font-cabinet font-black text-2xl ${txt}`}>{value}</div>
    </div>
  );
}

export default function Flotas() {
  const [active, setActive] = useState("consumo");
  const Current = TABS.find((t) => t.id === active)?.Component || ReportesConsumo;

  const [rows, setRows] = useState([]);
  useEffect(() => {
    api.get("/consumptions").then((r) => setRows(r.data || [])).catch(() => {});
  }, []);

  const totals = useMemo(() => {
    let gal = 0, gasto = 0, ahorro = 0;
    rows.forEach((r) => {
      gal += parseFloat(r.CANTIDAD_GL || 0);
      gasto += parseFloat(r.IMPORTE_TOTAL || 0);
      ahorro += parseFloat(r.AHORRO || 0);
    });
    return { gal, gasto, ahorro, n: rows.length };
  }, [rows]);

  return (
    <div className="space-y-6" data-testid="flotas-page">
      {/* KPIs (siempre arriba) */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3" data-testid="flotas-kpis">
        <SmallKpi label="Cargas" value={formatNumber(totals.n, 0)} />
        <SmallKpi label="Galones" value={formatNumber(totals.gal, 2)} />
        <SmallKpi label="Gasto" value={formatSoles(totals.gasto)} />
        <SmallKpi label="Ahorro" value={formatSoles(totals.ahorro)} accent="green" />
      </div>

      {/* Tabs */}
      <div className="bg-white border border-border rounded-2xl p-1.5 flex flex-wrap gap-1.5" data-testid="flotas-tabs">
        {TABS.map((t) => {
          const Ic = t.icon;
          const isActive = active === t.id;
          return (
            <button
              key={t.id}
              onClick={() => setActive(t.id)}
              data-testid={t.testid}
              className={`flex-1 min-w-[180px] h-12 px-4 rounded-xl text-sm font-bold flex items-center justify-center gap-2 transition-all ${
                isActive
                  ? "bg-brand text-white shadow-md"
                  : "text-neutral-600 hover:bg-neutral-50"
              }`}
            >
              <Ic className="w-4 h-4" strokeWidth={2} />
              {t.label}
            </button>
          );
        })}
      </div>

      {/* Active module */}
      <div data-testid={`flotas-content-${active}`}>
        <Current />
      </div>
    </div>
  );
}
