import React from "react";
import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

export default function ProtectedRoute({ children, roles }) {
  const { user, checking } = useAuth();
  const location = useLocation();
  if (checking) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-neutral-50">
        <div className="w-10 h-10 border-4 border-brand border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }
  if (!user) return <Navigate to="/login" replace />;
  // Cliente subsidio: si aún no completó documentos y trata de entrar a /subsidio/documentos,
  // que pase. Si trata de entrar a /subsidio/* sin terminar, también pasa. Pero ya NO forzamos
  // redirect duro: los módulos se gatean con <SubsidioGate>, no con redirect.
  if (roles && !roles.includes(user.role)) return <Navigate to="/dashboard" replace />;
  return children;
}
