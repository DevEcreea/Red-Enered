import React from "react";
import ModuloBloqueado from "./ModuloBloqueado";
import AnalyticsChecklist from "./analytics/Checklist";
import { useAuth } from "../context/AuthContext";

export default function Checklist() {
  const { user } = useAuth();
  const isAdmin = user?.role === "admin_enered" || user?.role === "administrador";

  if (!isAdmin) {
    return (
      <ModuloBloqueado
        titulo="Checklist"
        descripcion="Digitaliza las inspecciones pre-viaje y de mantenimiento con checklists configurables desde el celular. Detecta fallas antes de salir a ruta, deja evidencia fotográfica y cumple con SUTRAN sin papeleo. Actívalo gratis por 30 días."
      />
    );
  }

  return <AnalyticsChecklist />;
}
