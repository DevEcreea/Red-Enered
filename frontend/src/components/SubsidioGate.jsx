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
  const isAdminEnered = user.role === "admin_enered";

  if (isAdminEnered) return children;

  // 1. Cliente de subsidio: acceso PERMANENTE a sus módulos incluidos, aunque su
  //    expediente aún esté en revisión. La mejor experiencia es que pueda usar su
  //    panel y sus datos desde el primer momento.
  //    Incluidos: Mi Panel (Dashboard), Combustible, Gestión de Gastos (Cuenta),
  //    Vehículos, Documentación. (Mi Flota no usa Gated, siempre accesible.)
  if (esSubsidio) {
    const MODULOS_CLIENTE = ["Dashboard", "Combustible", "Cuenta", "Gestión Gastos", "Vehículos", "Documentación"];
    if (MODULOS_CLIENTE.includes(titulo)) return children;
    // El resto de módulos quedan visibles pero bloqueados (upsell a demo).
    return (
      <ModuloBloqueado
        variant="demo"
        titulo={titulo}
        descripcion="Este módulo no está incluido en tu plan actual. Descubre todo el potencial de ENERED agendando una demostración gratuita."
      />
    );
  }

  // 2. Resto de roles (administrador, logística, contabilidad): lógica premium por servicios.
  //    Módulos liberados por defecto:
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
