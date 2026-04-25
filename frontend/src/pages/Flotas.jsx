import React, { useState } from "react";
import { ClipboardList, FileBarChart, QrCode } from "lucide-react";
import Reportes from "./Reportes";
import ReportesConsumo from "./ReportesConsumo";
import QRDescarga from "./QRDescarga";

const TABS = [
  { id: "control", label: "Control Integral", icon: ClipboardList, Component: Reportes, testid: "tab-control-integral" },
  { id: "consumo", label: "Reportes Consumo", icon: FileBarChart, Component: ReportesConsumo, testid: "tab-reportes-consumo" },
  { id: "qr", label: "Descarga tus QR", icon: QrCode, Component: QRDescarga, testid: "tab-qr" },
];

export default function Flotas() {
  const [active, setActive] = useState("control");
  const Current = TABS.find((t) => t.id === active)?.Component || Reportes;

  return (
    <div className="space-y-6" data-testid="flotas-page">
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
