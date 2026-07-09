import React from "react";
import { useAuth } from "../context/AuthContext";
import ModuloBloqueado from "../pages/ModuloBloqueado";

/**
 * Wrapper que muestra un overlay "Completa tu expediente" para usuarios
 * cliente_subsidio que aún no han terminado de subir sus documentos.
 * Para los demás roles deja pasar el contenido sin tocar.
 */
export default function SubsidioGate({ children, titulo = "Tu Módulo" }) {
  const { user } = useAuth();
  if (!user) return null;

  const esSubsidio = user.role === "cliente_subsidio";
  const expedienteOk = user.expediente_status === "confirmed" || user.expediente_status === "submitted" || user.documentos_completos === true;
  const isAdminEnered = user.role === "admin_enered";

  // Si no es admin_enered y la empresa no tiene activa la plataforma de gestión de flotas,
  // se le bloquea el acceso a cualquier módulo clásico (excepto el Dashboard / Panel Subsidio).
  if (!isAdminEnered && user.servicios && !user.servicios.plataforma && titulo !== "Dashboard") {
    return (
      <ModuloBloqueado
        variant="subsidio"
        titulo={titulo}
        descripcion="Este módulo de gestión de flotas no está disponible para tu plan de solo subsidio. Contáctanos para migrar al control total."
        ctaTexto="Ver mi expediente"
        ctaTo="/subsidio/documentos"
      />
    );
  }

  // Se reactivó la protección para los clientes con expediente pendiente,
  // permitiendo únicamente al rol admin_enered saltarse este bloqueo para ver el contenido.
  if (!isAdminEnered && esSubsidio && !expedienteOk) {
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

  return children;
}
