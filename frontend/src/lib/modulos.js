// Catálogo de módulos para permisos del equipo ENERED (admin_enered).
// key = identificador estable usado en user.permisos[] y en el filtro del sidebar.
// grupo: "operacion" (módulos generales) | "admin" (secciones de administración).

export const MODULOS = [
  // Operación
  { key: "dashboard",     label: "Dashboard",            grupo: "operacion" },
  { key: "analitica",     label: "Analytics BI",         grupo: "operacion" },
  { key: "monitoreo",     label: "Monitoreo (GPS)",      grupo: "operacion" },
  { key: "combustible",   label: "Combustible",          grupo: "operacion" },
  { key: "facturacion",   label: "Gestión de Gastos",    grupo: "operacion" },
  { key: "mantenimiento", label: "Mantenimiento",        grupo: "operacion" },
  { key: "checklist",     label: "Checklist",            grupo: "operacion" },
  { key: "infracciones",  label: "Infracciones",         grupo: "operacion" },
  { key: "vehiculos",     label: "Vehículos",            grupo: "operacion" },
  { key: "neumaticos",    label: "Neumáticos",           grupo: "operacion" },
  { key: "viajes",        label: "Viajes",               grupo: "operacion" },
  { key: "documentacion", label: "Documentación",        grupo: "operacion" },
  // Administración
  { key: "usuarios",      label: "Usuarios",             grupo: "admin" },
  { key: "empresas",      label: "Empresas & Servicios", grupo: "admin" },
  { key: "tesoreria",     label: "Tesorería",            grupo: "admin" },
  { key: "datos",         label: "Datos / Carga",        grupo: "admin" },
  { key: "subsidio",      label: "Subsidio DU 004",      grupo: "admin" },
  { key: "bitacora",      label: "Bitácora",             grupo: "admin" },
];

export const MODULO_KEYS = MODULOS.map((m) => m.key);

// ¿El usuario admin_enered puede ver un módulo? Sin `permisos` (null) = acceso total.
export function tienePermiso(user, key) {
  if (!user || user.role !== "admin_enered") return false;
  if (user.permisos == null) return true; // super-admin
  return user.permisos.includes(key);
}
