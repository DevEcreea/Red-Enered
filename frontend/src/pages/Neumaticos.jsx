import React from "react";
import { Disc, Sparkles } from "lucide-react";

export default function Neumaticos() {
  return (
    <div className="p-6 max-w-5xl mx-auto">
      <div className="bg-white border border-neutral-200 rounded-2xl p-12 text-center" data-testid="page-neumaticos">
        <div className="w-16 h-16 rounded-2xl bg-brand-50 flex items-center justify-center mx-auto mb-4">
          <Disc className="w-8 h-8 text-brand" strokeWidth={2} />
        </div>
        <h1 className="font-cabinet font-black text-3xl text-neutral-900 mb-2">Neumáticos</h1>
        <p className="text-neutral-500 mb-6 max-w-md mx-auto">
          Controla el estado, rotación y vida útil de los neumáticos de tu flota para reducir costos y prevenir incidentes.
        </p>
        <div className="inline-flex items-center gap-2 bg-brand-50 text-brand px-4 py-2 rounded-full text-sm font-bold">
          <Sparkles className="w-4 h-4" strokeWidth={2.5} />
          Módulo en construcción
        </div>
      </div>
    </div>
  );
}
