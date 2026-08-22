import React from "react";
import Etapa0Card from "../components/Etapa0Card";

/**
 * Subsidios → Diagnóstico: el análisis por RUC de los DOS subsidios abiertos
 * (DU 004 y DU 007) en su propia etapa, fuera de los módulos de expediente.
 */
export default function SubsidioDiagnostico() {
  return (
    <div className="space-y-5" data-testid="subsidio-diagnostico">
      <div className="bg-white border border-neutral-200 rounded-2xl p-6 shadow-sm">
        <div className="text-[11px] font-bold uppercase tracking-widest text-brand mb-1">Subsidios · Análisis por RUC</div>
        <h1 className="font-cabinet font-black text-3xl text-neutral-900">Diagnóstico</h1>
        <p className="text-neutral-500 mt-1 text-sm">
          Verificamos tu empresa en SUNAT, MTC y ATU y calculamos cuánto puedes reclamar
          en el DU 004-2026 y el DU 007-2026 según tu flota habilitada.
        </p>
      </div>
      <Etapa0Card />
    </div>
  );
}
