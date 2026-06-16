import React from "react";
import { useNavigate } from "react-router-dom";
import { Fuel, Wrench, Truck, ClipboardCheck, Wallet, ShieldCheck, Circle, Leaf, Cloud, Bus, FileText, Settings } from "lucide-react";

const MODULES = [
  { to: "/analitica/combustible", label: "Combustible", icon: Fuel },
  { to: "/analitica/mantenimiento", label: "Mantenimiento", icon: Wrench },
  { to: "/analitica/flota", label: "Gestión de Flota", icon: Truck, disabled: true },
  { to: "/analitica/checklist", label: "Checklist", icon: ClipboardCheck },
  { to: "/analitica/gastos", label: "Gestión de Gastos", icon: Wallet, disabled: true },
  { to: "/analitica/seguridad", label: "Seguridad Vial", icon: ShieldCheck },
  { to: "/analitica/neumaticos", label: "Neumáticos", icon: Circle },
  { to: "/analitica/ecodriving", label: "Ecodriving", icon: Leaf },
  { to: "/analitica/emisiones", label: "Emisiones CO2", icon: Cloud },
  { to: "/analitica/parque", label: "Parque Vehicular", icon: Bus, disabled: true },
  { to: "/analitica/log", label: "Log de Uso", icon: FileText, disabled: true },
  { to: "/analitica/personalizacion", label: "Personalización", icon: Settings, disabled: true },
];

export default function AnalyticsIndex() {
  const navigate = useNavigate();

  return (
    <div className="space-y-8 pb-12">
      <div className="text-center pt-6">
        <h1 className="font-cabinet font-black text-2xl md:text-3xl text-neutral-800">
          Impulsa aquí tus decisiones con datos
        </h1>
        <p className="text-neutral-400 mt-1 text-sm">Selecciona un módulo</p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 max-w-5xl mx-auto px-4">
        {MODULES.map((mod) => {
          const Icon = mod.icon;
          return (
            <button
              key={mod.to}
              onClick={() => !mod.disabled && navigate(mod.to)}
              disabled={mod.disabled}
              className={`flex flex-col items-center justify-center gap-3 py-10 px-4 rounded-xl transition-all ${
                mod.disabled
                  ? "bg-white border border-neutral-200 text-neutral-400 cursor-not-allowed"
                  : "bg-brand text-white hover:bg-brand-hover hover:-translate-y-1 shadow-md"
              }`}
            >
              <Icon className="w-7 h-7" strokeWidth={1.5} />
              <span className="font-semibold text-sm text-center">{mod.label}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
