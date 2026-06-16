import React from "react";
import { Gift, CalendarCheck } from "lucide-react";

export default function ModuloBloqueado({ titulo, descripcion }) {
  const abrirWhatsApp = () => {
    window.open("https://wa.me/51972228870?text=Hola, quiero activar el demo de 30 días del módulo " + titulo, "_blank");
  };

  const agendarConfig = () => {
    window.open("https://wa.me/51972228870?text=Hola, quiero agendar la configuración del módulo " + titulo, "_blank");
  };

  return (
    <div className="relative min-h-[calc(100vh-120px)] flex items-center justify-center">
      {/* Fondo difuminado */}
      <div className="absolute inset-0 bg-gradient-to-br from-brand/5 via-white to-brand/10 blur-sm" />
      
      {/* Card central */}
      <div className="relative z-10 bg-white rounded-3xl shadow-xl border border-neutral-100 p-8 md:p-10 max-w-md w-full mx-4 text-center">
        {/* Icono */}
        <div className="mx-auto w-20 h-20 bg-brand rounded-full flex items-center justify-center mb-6 shadow-lg shadow-brand/30">
          <Gift className="w-9 h-9 text-white" strokeWidth={1.5} />
        </div>

        {/* Badge */}
        <div className="inline-flex items-center gap-2 bg-brand/10 text-brand px-4 py-1.5 rounded-full text-xs font-bold tracking-wide mb-6">
          <Gift className="w-4 h-4" />
          DEMO GRATIS • 30 DÍAS
        </div>

        {/* Título */}
        <h1 className="font-cabinet font-black text-2xl md:text-3xl text-neutral-900 mb-2">
          Módulo de {titulo}
        </h1>
        <p className="text-neutral-400 text-sm mb-6">
          Disponible para ti en tu plataforma
        </p>

        {/* Descripción */}
        <p className="text-neutral-600 text-sm leading-relaxed mb-8">
          {descripcion}
        </p>

        {/* Botones */}
        <button
          onClick={abrirWhatsApp}
          className="w-full bg-brand hover:bg-brand-hover text-white font-bold py-3.5 px-6 rounded-xl flex items-center justify-center gap-2 transition-all shadow-lg shadow-brand/20 mb-3"
        >
          <Gift className="w-5 h-5" />
          Activar demo de 30 días
        </button>

        <button
          onClick={agendarConfig}
          className="w-full bg-white hover:bg-neutral-50 text-neutral-600 font-semibold py-3.5 px-6 rounded-xl border border-neutral-200 flex items-center justify-center gap-2 transition-all"
        >
          <CalendarCheck className="w-5 h-5" />
          Agendar mi configuración
        </button>
      </div>
    </div>
  );
}
