import React from "react";

/**
 * Minimal footer for EMAY TECH branding.
 *
 *  - "card"    : fine horizontal bar at the bottom of Login.
 *  - "compact" : thin inline footer at the bottom of every module.
 *
 * Both variants share the same one-line look to keep the UI uncluttered.
 */
const EMAY_WEB = "https://www.emay.space";
const EMAY_WA = "https://wa.me/51920485878";
const EMAY_PHONE = "+51 920 485 878";
const YEAR = new Date().getFullYear();

function InlineFooter({ className = "" }) {
  return (
    <div
      className={`text-[11px] text-neutral-500 flex flex-wrap items-center justify-center gap-x-2 gap-y-1 ${className}`}
      data-testid="emay-footer"
    >
      <span>© {YEAR} Enered</span>
      <span className="text-neutral-300">·</span>
      <span>
        Desarrollado por{" "}
        <span className="font-semibold tracking-wide text-neutral-700">
          EMAY TECH
        </span>
      </span>
      <span className="text-neutral-300">·</span>
      <a
        href={EMAY_WEB}
        target="_blank"
        rel="noopener noreferrer"
        className="text-brand hover:underline font-medium"
      >
        www.emay.space
      </a>
      <span className="text-neutral-300">·</span>
      <a
        href={EMAY_WA}
        target="_blank"
        rel="noopener noreferrer"
        className="text-emerald-600 hover:underline font-medium"
      >
        {EMAY_PHONE}
      </a>
    </div>
  );
}

export default function EmayFooter({ variant = "compact" }) {
  if (variant === "card") {
    return <InlineFooter className="mt-6" />;
  }
  return (
    <footer className="mt-10 pt-4 border-t border-neutral-200">
      <InlineFooter />
    </footer>
  );
}
