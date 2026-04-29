import React from "react";
import "@/index.css";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { Toaster } from "sonner";
import { AuthProvider } from "./context/AuthContext";
import ProtectedRoute from "./components/ProtectedRoute";
import Layout from "./components/Layout";
import Login from "./pages/Login";
import ForgotPassword from "./pages/ForgotPassword";
import Dashboard from "./pages/Dashboard";
import Reportes from "./pages/Reportes";
import Facturacion from "./pages/Facturacion";
import EstadoCuentaHistorial from "./pages/EstadoCuentaHistorial";
import ControlIntegral from "./pages/ControlIntegral";
import Capacitacion from "./pages/Capacitacion";
import Soporte from "./pages/Soporte";
import Analitica from "./pages/Analitica";
import AdminUsers from "./pages/AdminUsers";
import AdminUpload from "./pages/AdminUpload";
import AdminQRUpload from "./pages/AdminQRUpload";
import Flotas from "./pages/Flotas";

function Shell({ children, roles }) {
  return (
    <ProtectedRoute roles={roles}>
      <Layout>{children}</Layout>
    </ProtectedRoute>
  );
}

function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Toaster richColors position="top-right" />
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/forgot-password" element={<ForgotPassword />} />
          <Route path="/" element={<Navigate to="/dashboard" replace />} />
          <Route path="/dashboard" element={<Shell><Dashboard /></Shell>} />
          <Route path="/flotas" element={<Shell><Flotas /></Shell>} />
          <Route path="/reportes" element={<Navigate to="/flotas" replace />} />
          <Route path="/reportes-consumo" element={<Navigate to="/flotas" replace />} />
          <Route path="/qr" element={<Navigate to="/flotas" replace />} />
          <Route path="/analitica" element={<Shell><Analitica /></Shell>} />
          <Route path="/facturacion" element={<Shell roles={["admin_enered", "administrador", "contabilidad"]}><Facturacion /></Shell>} />
          <Route path="/facturacion/historial" element={<Shell roles={["admin_enered", "administrador", "contabilidad"]}><EstadoCuentaHistorial /></Shell>} />
          <Route path="/control" element={<Shell roles={["admin_enered", "administrador", "logistica"]}><ControlIntegral /></Shell>} />
          <Route path="/capacitacion" element={<Shell><Capacitacion /></Shell>} />
          <Route path="/soporte" element={<Shell><Soporte /></Shell>} />
          <Route path="/admin/users" element={<Shell roles={["admin_enered"]}><AdminUsers /></Shell>} />
          <Route path="/admin/upload" element={<Shell roles={["admin_enered"]}><AdminUpload /></Shell>} />
          <Route path="/admin/qr" element={<Shell roles={["admin_enered"]}><AdminQRUpload /></Shell>} />
          <Route path="*" element={<Navigate to="/dashboard" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}

export default App;
