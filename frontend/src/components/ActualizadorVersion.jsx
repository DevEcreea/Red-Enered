import { useEffect, useRef } from "react";
import { useLocation } from "react-router-dom";

/* La app es de una sola página: si el cliente dejó la pestaña abierta (o el navegador cacheó el
   index), sigue corriendo el JavaScript ANTERIOR aunque ya se haya publicado una versión nueva —
   y no ve los cambios (p. ej. el emergente de firma obligatoria). Aquí, en cada cambio de ruta
   (máximo una vez por minuto), se compara el bundle publicado con el cargado y, si difieren,
   se recarga la página una sola vez. */
const RE_BUNDLE = /static\/js\/main\.[a-z0-9]+\.js/;

function bundleCargado() {
  for (const s of Array.from(document.scripts)) {
    const m = (s.src || "").match(RE_BUNDLE);
    if (m) return m[0];
  }
  return null;
}

export default function ActualizadorVersion() {
  const loc = useLocation();
  const ultima = useRef(0);
  useEffect(() => {
    const actual = bundleCargado();
    if (!actual) return;                       // dev server (sin hash) → nada que comparar
    const ahora = Date.now();
    if (ahora - ultima.current < 60000) return;
    ultima.current = ahora;
    fetch(`/index.html?v=${ahora}`, { cache: "no-store" })
      .then((r) => (r.ok ? r.text() : ""))
      .then((html) => {
        const m = html.match(RE_BUNDLE);
        if (m && m[0] !== actual) {
          let ya = false;
          try { ya = sessionStorage.getItem("recarga_version") === m[0]; } catch (_) {}
          if (!ya) {
            try { sessionStorage.setItem("recarga_version", m[0]); } catch (_) {}
            window.location.reload();
          }
        }
      })
      .catch(() => {});
  }, [loc.pathname]);
  return null;
}
