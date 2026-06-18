import React from "react";
import "@/index.css";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { Toaster } from "sonner";
import { AuthProvider } from "./context/AuthContext";
import ProtectedRoute from "./components/ProtectedRoute";
import Layout from "./components/Layout";
import SubsidioGate from "./components/SubsidioGate";
import Login from "./pages/Login";
import ForgotPassword from "./pages/ForgotPassword";
import Dashboard from "./pages/Dashboard";
import DashboardSubsidioView from "./pages/DashboardSubsidioView";
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
import RegistroSubsidio from "./pages/RegistroSubsidio";
import SubsidioDocumentos from "./pages/SubsidioDocumentos";
import SubsidioVerificar from "./pages/SubsidioVerificar";
import SubsidioFinalizado from "./pages/SubsidioFinalizado";
import SubsidioAdmin from "./pages/SubsidioAdmin";
import { useAuth } from "./context/AuthContext";

function Shell({ children, roles }) {
  return (
    <ProtectedRoute roles={roles}>
      <Layout>{children}</Layout>
    </ProtectedRoute>
  );
}

/** Envuelve una página dentro de Layout y la "gatea" para cliente_subsidio si no tiene expediente. */
function Gated({ children, titulo, roles }) {
  return (
    <ProtectedRoute roles={roles}>
      <Layout>
        <SubsidioGate titulo={titulo}>{children}</SubsidioGate>
      </Layout>
    </ProtectedRoute>
  );
}

/** Render distinto del Dashboard según rol. */
function DashboardRouter() {
  const { user } = useAuth();
  if (user?.role === "cliente_subsidio") return <DashboardSubsidioView />;
  return <Dashboard />;
}

/** Dashboard route: gateado para todos excepto cliente_subsidio (su dashboard es su vista principal). */
function DashboardRoute() {
  const { user } = useAuth();
  if (user?.role === "cliente_subsidio") {
    return (
      <ProtectedRoute>
        <Layout>
          <DashboardSubsidioView />
        </Layout>
      </ProtectedRoute>
    );
  }
  return (
    <Gated titulo="Dashboard">
      <DashboardRouter />
    </Gated>
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
          <Route path="/registro-subsidio" element={<RegistroSubsidio />} />
          {/* Subsidio: páginas DENTRO del Shell (sidebar visible) y NO gateadas */}
          <Route path="/subsidio/documentos" element={<Shell roles={["cliente_subsidio"]}><SubsidioDocumentos /></Shell>} />
          <Route path="/subsidio/verificar" element={<Shell roles={["cliente_subsidio"]}><SubsidioVerificar /></Shell>} />
          <Route path="/subsidio/finalizado" element={<ProtectedRoute roles={["cliente_subsidio"]}><SubsidioFinalizado /></ProtectedRoute>} />
          <Route path="/" element={<Navigate to="/dashboard" replace />} />
          {/* Dashboard: router por rol; gateado para subsidio */}
          <Route path="/dashboard" element={<DashboardRoute />} />
          <Route path="/flotas" element={<Gated titulo="Combustible"><Flotas /></Gated>} />
          <Route path="/reportes" element={<Navigate to="/flotas" replace />} />
          <Route path="/reportes-consumo" element={<Navigate to="/flotas" replace />} />
          <Route path="/qr" element={<Navigate to="/flotas" replace />} />
          {/* Analytics BI - submódulos */}
          <Route path="/analitica" element={<Gated titulo="Analytics BI"><AnalyticsIndex /></Gated>} />
          <Route path="/analitica/combustible" element={<Gated titulo="Analytics BI"><AnalyticsCombustible /></Gated>} />
          <Route path="/analitica/ecodriving" element={<Gated titulo="Analytics BI"><AnalyticsEcodriving /></Gated>} />
          <Route path="/analitica/emisiones" element={<Gated titulo="Analytics BI"><AnalyticsEmisionesCO2 /></Gated>} />
          <Route path="/analitica/mantenimiento" element={<Gated titulo="Analytics BI"><AnalyticsMantenimiento /></Gated>} />
          <Route path="/analitica/neumaticos" element={<Gated titulo="Analytics BI"><AnalyticsNeumaticos /></Gated>} />
          <Route path="/analitica/seguridad" element={<Gated titulo="Analytics BI"><AnalyticsSeguridadVial /></Gated>} />
          <Route path="/analitica/checklist" element={<Gated titulo="Analytics BI"><AnalyticsChecklist /></Gated>} />
          <Route path="/facturacion" element={<Gated titulo="Cuenta" roles={["admin_enered", "administrador", "contabilidad", "cliente_subsidio"]}><Facturacion /></Gated>} />
          <Route path="/facturacion/historial" element={<Gated titulo="Cuenta" roles={["admin_enered", "administrador", "contabilidad", "cliente_subsidio"]}><EstadoCuentaHistorial /></Gated>} />
          <Route path="/control" element={<Navigate to="/flotas" replace />} />
          <Route path="/seguridad" element={<Gated titulo="Seguridad"><Seguridad /></Gated>} />
          <Route path="/monitoreo" element={<Gated titulo="Monitoreo"><Monitoreo /></Gated>} />
          <Route path="/capacitacion" element={<Gated titulo="Capacitación"><Capacitacion /></Gated>} />
          <Route path="/documentacion" element={<Gated titulo="Documentación"><Documentacion /></Gated>} />
          <Route path="/mantenimiento" element={<Gated titulo="Mantenimiento"><Mantenimiento /></Gated>} />
          <Route path="/neumaticos" element={<Gated titulo="Neumáticos"><Neumaticos /></Gated>} />
          <Route path="/calendario" element={<Gated titulo="Calendario"><Calendario /></Gated>} />
          <Route path="/tickets" element={<Gated titulo="Tickets"><Tickets /></Gated>} />
          <Route path="/checklist" element={<Gated titulo="Checklist"><Checklist /></Gated>} />
          <Route path="/viajes" element={<Gated titulo="Viajes"><Viajes /></Gated>} />
          <Route path="/infracciones" element={<Gated titulo="Infracciones"><Infracciones /></Gated>} />
          <Route path="/soporte" element={<Shell><Soporte /></Shell>} />
          <Route path="/admin/users" element={<Shell roles={["admin_enered"]}><AdminUsers /></Shell>} />
          <Route path="/admin/upload" element={<Shell roles={["admin_enered"]}><AdminUpload /></Shell>} />
          <Route path="/admin/qr" element={<Shell roles={["admin_enered"]}><AdminQRUpload /></Shell>} />
          <Route path="/admin/subsidio" element={<Shell roles={["admin_enered"]}><SubsidioAdmin /></Shell>} />
          <Route path="*" element={<Navigate to="/dashboard" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}
 
export default App;
