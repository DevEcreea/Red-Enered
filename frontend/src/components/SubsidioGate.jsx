import React from "react";
import { useAuth } from "../context/AuthContext";
import ModuloBloqueado from "../pages/ModuloBloqueado";

/**
 * Wrapper que muestra overlays de bloqueo o upsell (Demo).
 */
export default function SubsidioGate({ children, titulo = "Tu Módulo" }) {
  const { user } = useAuth();
  if (!user) return null;

  const esSubsidio = user.role === "cliente_subsidio";
  const expedienteOk = user.expediente_status === "confirmed" || user.expediente_status === "submitted" || user.documentos_completos === true;
  const isAdminEnered = user.role === "admin_enered";

  if (isAdminEnered) return children;

  // 1. Bloqueo de Expediente Incompleto (Solo para Subsidio)
  // Si no ha terminado el expediente, NO puede ver nada excepto el Dashboard (y "Mi Flota" que no usa Gated).
  if (esSubsidio && !expedienteOk && titulo !== "Dashboard") {
    return (
      <ModuloBloqueado
        variant="subsidio"
        titulo={titulo}
        descripcion="Para activar este módulo necesitas terminar de subir y verificar los documentos de tu expediente DU 004-2026. Tus facturas y datos se cargarán automáticamente."
        ctaTexto="Completar mi expediente"
        ctaTo="/subsidio/documentos"
      />
    );
  }

  // 2. Lógica de Módulos Premium (Upsell a Demo)
  // Módulos liberados por defecto si el expediente está OK:
  const modulosLiberados = ["Dashboard", "Combustible", "Gestión Gastos", "Vehículos", "Documentación"];
  
  if (!modulosLiberados.includes(titulo)) {
    // Verificamos si tiene el servicio específico
    let tieneAcceso = false;

    if (titulo === "Monitoreo") {
      tieneAcceso = user.servicios?.gps === true;
    } else {
      // Para el resto de módulos (Analytics, Calendario, etc.), requiere "plataforma"
      tieneAcceso = user.servicios?.plataforma === true;
    }

    if (!tieneAcceso) {
      return (
        <ModuloBloqueado
          variant="demo"
          titulo={titulo}
          descripcion="Este módulo no está incluido en tu plan actual. Descubre todo el potencial de ENERED agendando una demostración gratuita."
        />
      );
    }
  }

  return children;
}
