import { clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs) {
  return twMerge(clsx(inputs));
}

export function formatSoles(n) {
  if (n === null || n === undefined || isNaN(n)) return "S/ 0.00";
  return "S/ " + Number(n).toLocaleString("es-PE", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export function formatNumber(n, d = 2) {
  if (n === null || n === undefined || isNaN(n)) return "0";
  return Number(n).toLocaleString("es-PE", { minimumFractionDigits: d, maximumFractionDigits: d });
}

export function formatDate(s) {
  if (!s || s === "Invalid Date") return "—";
  try {
    let str = String(s).trim();
    if (str.length > 10 && str.includes("T")) str = str.split("T")[0];

    // Check DD/MM/YYYY format
    if (/^\d{1,2}\/\d{1,2}\/\d{4}$/.test(str)) {
      const parts = str.split("/");
      const day = parseInt(parts[0], 10);
      const month = parseInt(parts[1], 10) - 1;
      const year = parseInt(parts[2], 10);
      const d = new Date(year, month, day);
      if (!isNaN(d.getTime())) {
        return d.toLocaleDateString("es-PE", { year: "numeric", month: "short", day: "numeric" });
      }
    }

    // Check YYYY-MM-DD format
    if (/^\d{4}-\d{2}-\d{2}$/.test(str)) {
      const parts = str.split("-");
      const year = parseInt(parts[0], 10);
      const month = parseInt(parts[1], 10) - 1;
      const day = parseInt(parts[2], 10);
      const d = new Date(year, month, day);
      if (!isNaN(d.getTime())) {
        return d.toLocaleDateString("es-PE", { year: "numeric", month: "short", day: "numeric" });
      }
    }

    const d = new Date(str);
    if (!isNaN(d.getTime())) {
      return d.toLocaleDateString("es-PE", { year: "numeric", month: "short", day: "numeric" });
    }
  } catch {}
  return s || "—";
}

export function formatApiError(detail) {
  if (detail == null) return "Ocurrió un error. Intenta nuevamente.";
  if (typeof detail === "string") return detail;
  if (Array.isArray(detail))
    return detail.map((e) => (e && typeof e.msg === "string" ? e.msg : JSON.stringify(e))).join(" ");
  if (detail && typeof detail.msg === "string") return detail.msg;
  return String(detail);
}

export const ROLE_LABEL = {
  admin_enered: "Admin ENERED",
  administrador: "Administrador",
  logistica: "Logística",
  contabilidad: "Contabilidad",
};

export const BRAND_COLORS = ["#8039F4", "#16A34A", "#F59E0B", "#3B82F6", "#EC4899", "#06B6D4", "#EF4444"];
