import React from "react";
import ModuloBloqueado from "./ModuloBloqueado";
import AnalyticsMantenimiento from "./analytics/Mantenimiento";
import { useAuth } from "../context/AuthContext";

export default function Mantenimiento() {
  const { user } = useAuth();
  const isAdmin = user?.role === "admin_enered" || user?.role === "administrador";

  if (!isAdmin) {
    return (
      <ModuloBloqueado
        titulo="Mantenimiento"
        descripcion="Programa mantenimientos preventivos y correctivos, recibe alertas proactivas y reduce el costo por kilómetro de tu flota. Menos paradas imprevistas y más vehículos disponibles. Pruébalo gratis 30 días y configúralo a tu medida."
      />
    );
  }

  return <AnalyticsMantenimiento />;
}
