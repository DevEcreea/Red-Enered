import React from "react";
import { Globe, MessageCircle } from "lucide-react";

/**
 * Branding footer for EMAY TECH.
 *
 * Variants:
 *  - "card"    : large card for Login — dark navy/purple gradient, pill CTAs.
 *  - "compact" : same visual language, shorter — used inside main Layout.
 */
const EMAY_WEB = "https://www.emay.space";
const EMAY_WA = "https://wa.me/51920485878";
const EMAY_PHONE_DISPLAY = "+51 920 485 878";
const EMAY_YEAR = new Date().getFullYear();

// Diagonal dark navy → deep purple (matches EMAY brand gradient)
const EMAY_GRADIENT =
  "linear-gradient(135deg, #030447 0%, #14094d 45%, #340b5b 100%)";

function CTAWhite({ href, icon: Icon, children, testid }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      data-testid={testid}
      className="group inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-full bg-white text-[#030447] text-sm font-bold shadow-md hover:shadow-xl hover:scale-[1.04] active:scale-[0.98] transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-cyan-300 focus:ring-offset-2 focus:ring-offset-[#030447] whitespace-nowrap"
    >
      <Icon className="w-4 h-4 text-[#030447] group-hover:text-brand transition-colors" strokeWidth={2.5} />
      <span>{children}</span>
    </a>
  );
}

function CTAGreen({ href, icon: Icon, children, testid }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      data-testid={testid}
      className="group inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-full bg-[#25D366] text-white text-sm font-bold shadow-md hover:shadow-xl hover:bg-[#20BA5A] hover:scale-[1.04] active:scale-[0.98] transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-emerald-300 focus:ring-offset-2 focus:ring-offset-[#030447] whitespace-nowrap"
    >
      <Icon className="w-4 h-4" strokeWidth={2.5} />
      <span>{children}</span>
    </a>
  );
}

export default function EmayFooter({ variant = "compact" }) {
  // --------------------------------------------------------------------
  // CARD variant (Login)
  // --------------------------------------------------------------------
  if (variant === "card") {
    return (
      <div
        className="mt-6 rounded-2xl overflow-hidden shadow-lg"
        style={{ background: EMAY_GRADIENT }}
        data-testid="emay-branding-card"
      >
        <div className="px-6 py-7 md:px-8 md:py-8 text-center">
          <div className="text-[10.5px] uppercase tracking-[0.28em] text-cyan-300 font-bold">
            Tecnología desarrollada por
          </div>

          <div
            className="mt-1 text-white font-black leading-none"
            style={{
              fontSize: "2.25rem",
              letterSpacing: "0.18em",
              textShadow: "0 2px 12px rgba(0,0,0,0.35)",
              fontFamily:
                '"Cabinet Grotesk", "Inter", system-ui, -apple-system, sans-serif',
            }}
          >
            EMAY TECH
          </div>

          <p className="mt-3 text-white/85 text-[13px] leading-relaxed max-w-md mx-auto">
            <span className="font-semibold">
              Integraciones &amp; Automatizaciones
            </span>
            <span className="mx-2 text-cyan-300/70">·</span>
            Solicita tu solución a medida
          </p>

          <div className="mt-5 flex flex-wrap gap-3 justify-center">
            <CTAWhite href={EMAY_WEB} icon={Globe} testid="emay-web-cta">
              www.emay.space
            </CTAWhite>
            <CTAGreen href={EMAY_WA} icon={MessageCircle} testid="emay-wa-cta">
              {EMAY_PHONE_DISPLAY}
            </CTAGreen>
          </div>
        </div>

        <div className="px-6 py-2.5 bg-black/30 border-t border-white/10 text-center text-[10.5px] text-white/65 tracking-wide">
          © {EMAY_YEAR} EMAY TECH · Integraciones &amp; Automatizaciones · Todos
          los derechos reservados
        </div>
      </div>
    );
  }

  // --------------------------------------------------------------------
  // COMPACT variant (inside app Layout, after each page)
  // --------------------------------------------------------------------
  return (
    <footer
      className="mt-10 rounded-2xl overflow-hidden shadow-md"
      style={{ background: EMAY_GRADIENT }}
      data-testid="emay-footer-compact"
    >
      <div className="px-5 py-4 md:px-6 md:py-5 flex flex-col md:flex-row items-center justify-between gap-4">
        <div className="text-center md:text-left">
          <div className="text-[10px] uppercase tracking-[0.25em] text-cyan-300 font-bold">
            Tecnología desarrollada por
          </div>
          <div
            className="mt-0.5 text-white font-black"
            style={{
              fontSize: "1.25rem",
              letterSpacing: "0.16em",
              fontFamily:
                '"Cabinet Grotesk", "Inter", system-ui, -apple-system, sans-serif',
            }}
          >
            EMAY TECH
          </div>
          <div className="text-white/80 text-xs mt-1">
            <span className="font-semibold">
              Integraciones &amp; Automatizaciones
            </span>
            <span className="mx-1.5 text-cyan-300/70">·</span>
            Solicita tu solución a medida
          </div>
        </div>

        <div className="flex flex-wrap gap-2.5 justify-center">
          <CTAWhite
            href={EMAY_WEB}
            icon={Globe}
            testid="emay-web-cta-compact"
          >
            www.emay.space
          </CTAWhite>
          <CTAGreen
            href={EMAY_WA}
            icon={MessageCircle}
            testid="emay-wa-cta-compact"
          >
            {EMAY_PHONE_DISPLAY}
          </CTAGreen>
        </div>
      </div>
      <div className="px-5 py-2 bg-black/30 border-t border-white/10 text-center text-[10px] text-white/65 tracking-wide">
        © {EMAY_YEAR} EMAY TECH · Integraciones &amp; Automatizaciones · Todos
        los derechos reservados
      </div>
    </footer>
  );
}
