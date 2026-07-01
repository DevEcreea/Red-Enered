import React from "react";
import ModuloBloqueado from "./ModuloBloqueado";
import AnalyticsNeumaticos from "./analytics/Neumaticos";
import { useAuth } from "../context/AuthContext";

export default function Neumaticos() {
  const { user } = useAuth();
  const isAdmin = user?.role === "admin_enered" || user?.role === "administrador";

  if (!isAdmin) {
    return (
      <ModuloBloqueado
        titulo="Llantas"
        descripcion="Gestiona tus neumáticos con gemelo digital: posición, profundidad, presión y costo por kilómetro de cada llanta. Rota a tiempo, evita pinchazos en ruta y alarga su vida útil reduciendo tu CPK. Pruébalo gratis 30 días."
      />
    );
  }

  return <AnalyticsNeumaticos />;
}
