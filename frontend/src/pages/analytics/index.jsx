import React from "react";
import { useNavigate } from "react-router-dom";
import { Fuel, Wrench, Car, ClipboardCheck, Wallet, Shield, Circle, Leaf, Cloud, Bus, FileText, Settings } from "lucide-react";

const MODULES = [
  { to: "/analitica/combustible", label: "Combustible", icon: Fuel },
  { to: "/analitica/mantenimiento", label: "Mantenimiento", icon: Wrench },
  { to: "/analitica/flota", label: "Gestión de Flota", icon: Car, disabled: true },
  { to: "/analitica/checklist", label: "Checklist", icon: ClipboardCheck },
  { to: "/analitica/gastos", label: "Gestión de Gastos", icon: Wallet, disabled: true },
  { to: "/analitica/seguridad", label: "Seguridad Vial", icon: Shield },
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
    <div className="space-y-8">
      <div className="text-center pt-8">
        <h1 className="font-cabinet font-black text-3xl md:text-4xl text-neutral-900">
          Impulsa aquí tus decisiones con datos
        </h1>
        <p className="text-neutral-500 mt-2">Selecciona un módulo</p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 max-w-5xl mx-auto px-4">
        {MODULES.map((mod) => {
          const Icon = mod.icon;
          return (
            <button
              key={mod.to}
              onClick={() => !mod.disabled && navigate(mod.to)}
              disabled={mod.disabled}
              className={`flex flex-col items-center justify-center gap-3 p-8 rounded-2xl transition-all ${
                mod.disabled
                  ? "bg-white border-2 border-neutral-200 text-neutral-400 cursor-not-allowed"
                  : "bg-brand text-white hover:bg-brand-hover hover:scale-105 shadow-lg"
              }`}
            >
              <Icon className="w-8 h-8" strokeWidth={1.5} />
              <span className="font-semibold text-sm">{mod.label}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
