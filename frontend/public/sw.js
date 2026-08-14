/* Service worker mínimo para PWA instalable (ENERED).
   Estrategia: network-first para la navegación (siempre datos frescos),
   con fallback al índice cacheado si no hay red. No cachea la API. */
const CACHE = "enered-pwa-v1";
const APP_SHELL = ["/", "/index.html", "/manifest.json", "/icon-192.png", "/icon-512.png"];

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(CACHE).then((c) => c.addAll(APP_SHELL)).catch(() => {}));
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
  );
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  // No interceptar API ni orígenes externos.
  if (url.pathname.startsWith("/api") || url.origin !== self.location.origin) return;

  // Navegación (rutas SPA): network-first con fallback al index cacheado.
  if (req.mode === "navigate") {
    event.respondWith(
      fetch(req).catch(() => caches.match("/index.html"))
    );
    return;
  }
  // Estáticos: cache-first con actualización en segundo plano.
  event.respondWith(
    caches.match(req).then((cached) =>
      cached || fetch(req).then((res) => {
        const copy = res.clone();
        caches.open(CACHE).then((c) => c.put(req, copy)).catch(() => {});
        return res;
      }).catch(() => cached)
    )
  );
});
