import React from "react";
import { Globe, MessageCircle, ArrowUpRight } from "lucide-react";

/**
 * Branding footer for EMAY TECH.
 *
 * Variants:
 *  - "card"    : big card for the Login screen (below the form).
 *  - "compact" : thin one-line footer for the main layout.
 */
const EMAY_LOGO = "/emay-logo.png";
const EMAY_WEB = "https://www.emay.space";
const EMAY_WA = "https://wa.me/51920485878";
const EMAY_PHONE_DISPLAY = "+51 920 485 878";
const EMAY_YEAR = new Date().getFullYear();

export default function EmayFooter({ variant = "compact" }) {
  if (variant === "card") {
    return (
      <div
        className="mt-6 rounded-2xl overflow-hidden border border-indigo-200/50 shadow-md"
        style={{
          background:
            "linear-gradient(135deg, #1a0a4a 0%, #2D0A4E 45%, #3b1575 100%)",
        }}
        data-testid="emay-branding-card"
      >
        <div className="px-5 py-5 md:px-6 md:py-6 flex flex-col md:flex-row items-center gap-4">
          {/* Logo */}
          <div className="flex-shrink-0">
            <img
              src={EMAY_LOGO}
              alt="EMAY TECH"
              className="h-14 md:h-16 w-auto object-contain drop-shadow"
              loading="lazy"
            />
          </div>

          {/* Copy */}
          <div className="flex-1 text-center md:text-left">
            <div className="text-[11px] uppercase tracking-[0.22em] text-cyan-300/80 font-bold">
              Tecnología desarrollada por
            </div>
            <div className="text-white text-lg md:text-xl font-bold leading-tight mt-0.5">
              EMAY TECH
            </div>
            <p className="text-white/75 text-[12.5px] leading-snug mt-1.5 max-w-md">
              Software a medida, automatización de procesos y transformación
              digital para empresas. Control operativo y analítica en tiempo
              real.
            </p>

            <div className="mt-3 flex flex-wrap gap-2 justify-center md:justify-start">
              <a
                href={EMAY_WEB}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white text-[#2D0A4E] text-xs font-bold hover:bg-cyan-300 transition-colors shadow-sm"
                data-testid="emay-web-cta"
              >
                <Globe className="w-3.5 h-3.5" strokeWidth={2.5} />
                www.emay.space
                <ArrowUpRight className="w-3 h-3" strokeWidth={2.5} />
              </a>
              <a
                href={EMAY_WA}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-emerald-400 text-emerald-950 text-xs font-bold hover:bg-emerald-300 transition-colors shadow-sm"
                data-testid="emay-wa-cta"
              >
                <MessageCircle className="w-3.5 h-3.5" strokeWidth={2.5} />
                {EMAY_PHONE_DISPLAY}
              </a>
            </div>
          </div>
        </div>
        <div className="px-5 py-2 bg-black/20 border-t border-white/10 text-center text-[10.5px] text-white/60 tracking-wide">
          © {EMAY_YEAR} EMAY TECH · Integraciones & Automatizaciones · Todos los
          derechos reservados
        </div>
      </div>
    );
  }

  // Compact variant — footer inline used inside the main app Layout.
  return (
    <footer
      className="mt-10 pt-4 border-t border-neutral-200"
      data-testid="emay-footer-compact"
    >
      <div className="flex flex-col md:flex-row items-center justify-between gap-2 text-[11.5px] text-neutral-500">
        <div className="flex items-center gap-2 flex-wrap justify-center md:justify-start">
          <img
            src={EMAY_LOGO}
            alt="EMAY"
            className="h-5 w-auto object-contain opacity-90"
            loading="lazy"
          />
          <span className="text-neutral-400">·</span>
          <span className="font-semibold text-neutral-700">
            Desarrollado por EMAY TECH
          </span>
          <span className="hidden md:inline text-neutral-300">—</span>
          <span className="hidden md:inline">
            Integraciones &amp; Automatizaciones
          </span>
        </div>
        <div className="flex items-center gap-3">
          <a
            href={EMAY_WEB}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 hover:text-brand transition-colors"
          >
            <Globe className="w-3 h-3" />
            emay.space
          </a>
          <a
            href={EMAY_WA}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 hover:text-emerald-600 transition-colors"
          >
            <MessageCircle className="w-3 h-3" />
            {EMAY_PHONE_DISPLAY}
          </a>
          <span className="text-neutral-400">© {EMAY_YEAR}</span>
        </div>
      </div>
    </footer>
  );
}
