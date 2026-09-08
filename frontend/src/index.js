import React from "react";
import ReactDOM from "react-dom/client";
import "@/index.css";
import App from "@/App";

const root = ReactDOM.createRoot(document.getElementById("root"));
root.render(
  <>
    <App />
  </>,
);

// PWA: registra el service worker SOLO en producción (instalable en celular/escritorio).
// En desarrollo se desregistra activamente: su caché servía bundles viejos en localhost
// y las rutas/cambios nuevos "no aparecían" hasta forzar recargas.
if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    if (process.env.NODE_ENV === "production") {
      // Si ya había un SW controlando la página y entra uno nuevo (deploy), recargar una
      // sola vez para no quedarse con el bundle anterior en caché.
      // Cuando entra un deploy nuevo NO se recarga de inmediato (interrumpía formularios a
      // medio llenar): se recarga cuando la pestaña deja de estar visible o al cambiar de
      // ruta, y como máximo una vez.
      const hadController = !!navigator.serviceWorker.controller;
      let pendiente = false;
      const recargarSiToca = () => {
        if (!pendiente) return;
        pendiente = false;
        window.location.reload();
      };
      navigator.serviceWorker.addEventListener("controllerchange", () => {
        if (!hadController) return;
        pendiente = true;
        if (document.visibilityState === "hidden") recargarSiToca();
      });
      document.addEventListener("visibilitychange", () => { if (document.visibilityState === "hidden") recargarSiToca(); });
      window.addEventListener("popstate", recargarSiToca);
      const _push = window.history.pushState.bind(window.history);
      window.history.pushState = function (...args) { const r = _push(...args); setTimeout(recargarSiToca, 0); return r; };
      navigator.serviceWorker.register("/sw.js").then((reg) => {
        // Buscar actualización del SW en cada apertura de la app (no solo cada 24 h).
        try { reg.update(); } catch (_) {}
      }).catch(() => {});
    } else {
      navigator.serviceWorker.getRegistrations()
        .then((rs) => rs.forEach((r) => r.unregister()))
        .catch(() => {});
      if (window.caches?.keys) {
        caches.keys().then((ks) => ks.forEach((k) => caches.delete(k))).catch(() => {});
      }
    }
  });
}
