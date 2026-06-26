import React from "react";

/**
 * EMAY TECH branding — minimal, single-line footers.
 *
 *  - "card"    : inline line under the Login footer. Starts with "Desarrollado por".
 *  - "compact" : inline line at the bottom of each module. Adds tagline
 *                "Integraciones & Automatizaciones" since there's more space.
 */
const EMAY_WEB = "https://www.emay.space";
const EMAY_WA = "https://wa.me/51973982417";
const EMAY_PHONE = "+51 973 982 417";
const YEAR = new Date().getFullYear();

function BaseLine({ withTagline = false }) {
  return (
    <div
      className="text-[11px] text-neutral-500 flex flex-wrap items-center justify-center gap-x-2 gap-y-1"
      data-testid="emay-footer"
    >
      <span>
        Desarrollado por{" "}
        <span className="font-semibold tracking-wide text-neutral-700">
          EMAY TECH
        </span>
      </span>
      {withTagline && (
        <>
          <span className="text-neutral-300">·</span>
          <span className="italic">Integraciones &amp; Automatizaciones</span>
        </>
      )}
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
      <span className="text-neutral-300">·</span>
      <span className="text-neutral-400">© {YEAR}</span>
    </div>
  );
}

export default function EmayFooter({ variant = "compact" }) {
  if (variant === "card") {
    // Login — no tagline (tighter layout)
    return (
      <div className="mt-3">
        <BaseLine withTagline={false} />
      </div>
    );
  }
  // Modules — with tagline
  return (
    <footer className="mt-10 pt-4 border-t border-neutral-200">
      <BaseLine withTagline={true} />
    </footer>
  );
}
