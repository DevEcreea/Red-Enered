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

  // Se desactivó temporalmente la protección de expediente para mostrar el contenido real de los módulos que lo tengan.
  /*
  if (esSubsidio && !expedienteOk) {
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
  */

  return children;
}
