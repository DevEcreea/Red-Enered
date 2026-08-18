import React from "react";
import { Lock, MessageCircle, Sparkles, BellRing } from "lucide-react";

const WSP = "51997389536";
const MSG = encodeURIComponent(
  "Hola ENERED, quiero enterarme más sobre el subsidio DU 007 y que me avisen cuando esté disponible."
);

/**
 * Subsidio DU 007 — próximamente. Bloqueado: solo informa y convierte por WhatsApp.
 */
export default function SubsidioDU007() {
  return (
    <div className="min-h-[70vh] flex items-center justify-center">
      <div className="bg-white border border-neutral-200 rounded-2xl shadow-sm max-w-xl w-full p-10 text-center relative overflow-hidden">
        <div className="absolute -right-8 -top-8 opacity-[0.06]">
          <Sparkles className="w-44 h-44 text-brand" />
        </div>

        <div className="w-16 h-16 mx-auto rounded-2xl bg-brand/10 flex items-center justify-center">
          <Lock className="w-8 h-8 text-brand" />
        </div>

        <div className="inline-flex items-center gap-2 bg-brand/10 text-brand text-[11px] font-black tracking-widest uppercase px-3 py-1 rounded-full mt-5">
          <BellRing className="w-3.5 h-3.5" /> Próximamente
        </div>

        <h1 className="font-cabinet font-black text-3xl text-neutral-900 mt-3">Subsidio DU 007</h1>
        <p className="text-neutral-500 text-sm mt-3 max-w-md mx-auto leading-relaxed">
          Un nuevo subsidio viene en camino y en ENERED ya nos estamos preparando para que
          seas de los primeros en reclamarlo — con tu expediente listo desde el día uno,
          igual que con el DU 004.
        </p>

        <a
          href={`https://wa.me/${WSP}?text=${MSG}`}
          target="_blank"
          rel="noreferrer"
          className="mt-7 inline-flex items-center gap-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-black px-7 py-3.5 rounded-xl text-[15px] transition-colors shadow-lg shadow-emerald-600/25"
          data-testid="du007-wsp"
        >
          <MessageCircle className="w-5 h-5" /> Entérate aquí · más información
        </a>

        <p className="text-[11px] text-neutral-400 mt-5">
          Te avisaremos por WhatsApp apenas se publiquen los requisitos oficiales.
        </p>
      </div>
    </div>
  );
}
