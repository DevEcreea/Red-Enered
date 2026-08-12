import axios from "axios";

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
export const API = `${BACKEND_URL}/api`;

export const api = axios.create({
  baseURL: API,
  withCredentials: true,
  timeout: 120000, // 2 min por si Render (free) está en cold-start
});

// ---------------- Auth token ----------------
api.interceptors.request.use((config) => {
  const t = localStorage.getItem("enered_token");
  if (t) {
    config.headers = config.headers || {};
    config.headers.Authorization = `Bearer ${t}`;
  }
  // Impersonación: si un admin eligió "entrar como empresa", scopeamos todas las llamadas.
  const imp = localStorage.getItem("enered_impersonate");
  if (imp) {
    config.headers = config.headers || {};
    config.headers["X-Impersonate-Empresa"] = imp;
  }
  return config;
});

// ---------------- "Waking up server" banner ----------------
// Emite un evento cuando un request tarda más de 5s (probable cold-start Render).
let _slowTimers = new WeakMap();
let _inflight = 0;

const _emit = (type, detail) => {
  try { window.dispatchEvent(new CustomEvent(type, { detail })); } catch (_) { /* noop */ }
};

api.interceptors.request.use((config) => {
  _inflight += 1;
  const t = setTimeout(() => _emit("api:slow", { url: config.url }), 5000);
  _slowTimers.set(config, t);
  return config;
});

const _clear = (config) => {
  const t = config && _slowTimers.get(config);
  if (t) { clearTimeout(t); _slowTimers.delete(config); }
  _inflight = Math.max(0, _inflight - 1);
  if (_inflight === 0) _emit("api:idle", {});
};

api.interceptors.response.use(
  (resp) => { _clear(resp.config); return resp; },
  (err)  => { _clear(err.config || {}); return Promise.reject(err); }
);

// ---------------- Keep-alive (evita cold-start Render free) ----------------
// Hace ping ligero cada 10 min mientras la pestaña esté activa.
let _keepAliveTimer = null;
export const startKeepAlive = () => {
  if (_keepAliveTimer) return;
  const ping = () => {
    if (document.visibilityState === "hidden") return;
    fetch(`${API}/health`, { method: "GET", credentials: "include", cache: "no-store" })
      .catch(() => {});
  };
  ping(); // warm-up inmediato al montar la app
  _keepAliveTimer = setInterval(ping, 10 * 60 * 1000); // cada 10 min
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible") ping();
  });
};
