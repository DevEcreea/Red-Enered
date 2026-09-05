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
      const hadController = !!navigator.serviceWorker.controller;
      let recargado = false;
      navigator.serviceWorker.addEventListener("controllerchange", () => {
        if (!hadController || recargado) return;
        recargado = true;
        window.location.reload();
      });
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
