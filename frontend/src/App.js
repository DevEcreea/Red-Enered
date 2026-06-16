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
import Seguridad from "./pages/Seguridad";
import ControlIntegral from "./pages/ControlIntegral";
import Calendario from "./pages/Calendario";
import Tickets from "./pages/Tickets";
import Checklist from "./pages/Checklist";
import Viajes from "./pages/Viajes";
import Capacitacion from "./pages/Capacitacion";
import Soporte from "./pages/Soporte";
// Analytics BI submódulos
import AnalyticsIndex from "./pages/analytics/index";
import AnalyticsCombustible from "./pages/analytics/Combustible";
import AnalyticsEcodriving from "./pages/analytics/Ecodriving";
import AnalyticsEmisionesCO2 from "./pages/analytics/EmisionesCO2";
import AnalyticsMantenimiento from "./pages/analytics/Mantenimiento";
import AnalyticsNeumaticos from "./pages/analytics/Neumaticos";
import AnalyticsSeguridadVial from "./pages/analytics/SeguridadVial";
import AnalyticsChecklist from "./pages/analytics/Checklist";
import Monitoreo from "./pages/Monitoreo";
import AdminUsers from "./pages/AdminUsers";
import AdminUpload from "./pages/AdminUpload";
import AdminQRUpload from "./pages/AdminQRUpload";
import Flotas from "./pages/Flotas";
import Documentacion from "./pages/Documentacion";
import Mantenimiento from "./pages/Mantenimiento";
import Neumaticos from "./pages/Neumaticos";
import Infracciones from "./pages/Infracciones";

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
          {/* Analytics BI - submódulos */}
          {/* Analytics BI - submódulos */}
          <Route path="/analitica" element={<Shell><AnalyticsIndex /></Shell>} />
          <Route path="/analitica/combustible" element={<Shell><AnalyticsCombustible /></Shell>} />
          <Route path="/analitica/ecodriving" element={<Shell><AnalyticsEcodriving /></Shell>} />
          <Route path="/analitica/emisiones" element={<Shell><AnalyticsEmisionesCO2 /></Shell>} />
          <Route path="/analitica/mantenimiento" element={<Shell><AnalyticsMantenimiento /></Shell>} />
          <Route path="/analitica/neumaticos" element={<Shell><AnalyticsNeumaticos /></Shell>} />
          <Route path="/analitica/seguridad" element={<Shell><AnalyticsSeguridadVial /></Shell>} />
          <Route path="/analitica/checklist" element={<Shell><AnalyticsChecklist /></Shell>} />  
          <Route path="/facturacion" element={<Shell roles={["admin_enered", "administrador", "contabilidad"]}><Facturacion /></Shell>} />
          <Route path="/facturacion/historial" element={<Shell roles={["admin_enered", "administrador", "contabilidad"]}><EstadoCuentaHistorial /></Shell>} />
          <Route path="/control" element={<Navigate to="/flotas" replace />} />
          <Route path="/seguridad" element={<Shell><Seguridad /></Shell>} />
          <Route path="/monitoreo" element={<Shell><Monitoreo /></Shell>} />
          <Route path="/capacitacion" element={<Shell><Capacitacion /></Shell>} />
          <Route path="/documentacion" element={<Shell><Documentacion /></Shell>} />
          <Route path="/mantenimiento" element={<Shell><Mantenimiento /></Shell>} />
          <Route path="/neumaticos" element={<Shell><Neumaticos /></Shell>} />
          <Route path="/calendario" element={<Shell><Calendario /></Shell>} />
          <Route path="/tickets" element={<Shell><Tickets /></Shell>} />
          <Route path="/checklist" element={<Shell><Checklist /></Shell>} />
          <Route path="/viajes" element={<Shell><Viajes /></Shell>} />
          <Route path="/infracciones" element={<Shell><Infracciones /></Shell>} />
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
