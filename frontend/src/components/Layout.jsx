import React, { useEffect, useState } from "react";
import { NavLink, useNavigate, useLocation } from "react-router-dom";
import {
  LayoutDashboard, ClipboardList, FileBarChart, QrCode, Satellite, PieChart, Receipt, ShieldCheck, GraduationCap,
  LifeBuoy, Users, Upload, LogOut, Menu, Search, Bell, Mail,
} from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { api } from "../lib/api";
import { ROLE_LABEL } from "../lib/utils";

const LOGO_IMG = "/assets/enered-logo.png";
const WA_LINK = "https://wa.me/message/VDUNDBHSQ47SC1";

const MENU = [
  { to: "/dashboard", label: "Dashboard", icon: LayoutDashboard, roles: ["admin_enered", "administrador", "logistica", "contabilidad"], testid: "nav-dashboard" },
  { to: "/reportes", label: "Control Integral", icon: ClipboardList, roles: ["admin_enered", "administrador", "logistica", "contabilidad"], testid: "nav-control-integral" },
  { to: "/reportes-consumo", label: "Reportes Consumo", icon: FileBarChart, roles: ["admin_enered", "administrador", "logistica", "contabilidad"], testid: "nav-reportes-consumo" },
  { to: "/qr", label: "Descarga tus QR", icon: QrCode, roles: ["admin_enered", "administrador", "logistica", "contabilidad"], testid: "nav-qr" },
  { to: "/centro-monitoreo", label: "Centro Monitoreo", icon: Satellite, roles: ["admin_enered", "administrador", "logistica", "contabilidad"], testid: "nav-monitoreo", badge: "PRÓXIMO", badgeColor: "cyan", disabled: true },
  { to: "/analitica", label: "Analítica", icon: PieChart, roles: ["admin_enered", "administrador", "logistica", "contabilidad"], testid: "nav-analitica", badge: "NUEVO", badgeColor: "amber" },
  { to: "/facturacion", label: "Estado Cuenta", icon: Receipt, roles: ["admin_enered", "administrador", "contabilidad"], testid: "nav-estado" },
  { to: "/control", label: "Seguridad", icon: ShieldCheck, roles: ["admin_enered", "administrador", "logistica"], testid: "nav-seguridad" },
  { to: "/capacitacion", label: "Capacitación", icon: GraduationCap, roles: ["admin_enered", "administrador", "logistica", "contabilidad"], testid: "nav-capacitacion" },
  { to: "/soporte", label: "Soporte", icon: LifeBuoy, roles: ["admin_enered", "administrador", "logistica", "contabilidad"], testid: "nav-soporte" },
];

const ADMIN_ITEMS = [
  { to: "/admin/users", label: "Usuarios", icon: Users, testid: "nav-users" },
  { to: "/admin/upload", label: "Fuente Datos", icon: Upload, testid: "nav-upload" },
  { to: "/admin/qr", label: "Carga QR", icon: QrCode, testid: "nav-qr-admin" },
];

const ROUTE_TITLES = {
  "/dashboard": "Dashboard",
  "/reportes": "Control Integral",
  "/reportes-consumo": "Reportes de Consumo",
  "/qr": "Descarga tus QR",
  "/centro-monitoreo": "Centro Monitoreo",
  "/analitica": "Analítica",
  "/facturacion": "Estado de Cuenta",
  "/control": "Seguridad",
  "/capacitacion": "Capacitación",
  "/soporte": "Soporte",
  "/admin/users": "Usuarios",
  "/admin/upload": "Fuente de Datos",
  "/admin/qr": "Carga Masiva de QR",
};

function SidebarLink({ item, onClick }) {
  const Ic = item.icon;
  const content = (active) => (
    <>
      <div className="relative">
        <Ic className={`w-5 h-5 mb-0.5 ${active ? "text-cyan-300" : "text-white/90"}`} strokeWidth={1.75} />
      </div>
      <span className={`text-[9.5px] font-semibold leading-tight text-center ${active ? "text-cyan-300" : "text-white/95"}`}>{item.label}</span>
      {item.badge && (
        <span className={`mt-0.5 px-1 py-0.5 rounded-full text-[7px] font-black tracking-wider ${
          item.badgeColor === "cyan" ? "bg-cyan-400 text-[#2D0A4E]" : "bg-amber-400 text-[#2D0A4E]"
        }`}>
          {item.badge}
        </span>
      )}
    </>
  );

  if (item.disabled) {
    return (
      <div
        className="flex flex-col items-center justify-center py-1.5 px-1.5 rounded-lg opacity-60 cursor-not-allowed"
        data-testid={item.testid}
      >
        {content(false)}
      </div>
    );
  }

  return (
    <NavLink
      to={item.to}
      onClick={onClick}
      data-testid={item.testid}
      className={({ isActive }) =>
        `flex flex-col items-center justify-center py-1.5 px-1.5 rounded-lg transition-all ${
          isActive ? "bg-white/15 shadow-inner" : "hover:bg-white/10"
        }`
      }
    >
      {({ isActive }) => content(isActive)}
    </NavLink>
  );
}

function PlanCard({ label, title, color = "violet", testid, onClick, active = false, wide = false }) {
  const base = "rounded-2xl px-4 py-3 border flex flex-col justify-center transition-all " + (wide ? "min-w-[200px]" : "min-w-[140px]");
  const styles = {
    gray: "bg-neutral-100 text-neutral-800 border-neutral-200",
    violet: "bg-brand text-white border-brand hover:bg-brand-hover cursor-pointer hover:shadow-lg hover:-translate-y-0.5",
    violetDark: "bg-[#6B23B1] text-white border-[#6B23B1] hover:bg-[#5A1E96] cursor-pointer hover:shadow-lg hover:-translate-y-0.5",
    cyan: "bg-cyan-300 text-[#1e1b4b] border-cyan-300 hover:bg-cyan-400 cursor-pointer hover:shadow-lg hover:-translate-y-0.5",
  }[color];

  const activeRing = active ? "ring-4 ring-cyan-300 ring-offset-2 ring-offset-white shadow-lg scale-105" : "";

  const content = (
    <>
      <div className={`text-[10px] font-semibold uppercase tracking-wider ${color === "gray" ? "text-neutral-500" : color === "cyan" ? "text-[#1e1b4b]/70" : "text-white/75"}`}>
        {label}
      </div>
      <div className={`font-bold text-sm mt-0.5 leading-tight ${color === "cyan" ? "text-[#1e1b4b]" : ""}`}>{title}</div>
      {active && <div className="text-[9px] font-black uppercase tracking-widest text-cyan-300 mt-1">● Tu Plan</div>}
    </>
  );

  if (onClick) {
    return (
      <button onClick={onClick} data-testid={testid} className={`${base} ${styles} ${activeRing} text-left`}>
        {content}
      </button>
    );
  }
  return <div className={`${base} ${styles}`} data-testid={testid}>{content}</div>;
}

export default function Layout({ children }) {
  const { user, logout } = useAuth();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [overview, setOverview] = useState(null);
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    if (user) api.get("/dashboard/overview").then((r) => setOverview(r.data)).catch(() => {});
  }, [user?.id]);

  if (!user) return null;

  const items = MENU.filter((i) => i.roles.includes(user.role));
  const isAdmin = user.role === "admin_enered";

  const handleLogout = async () => {
    await logout();
    navigate("/login");
  };

  const pageTitle = ROUTE_TITLES[location.pathname] || "";
  const initials = (user.name || user.email).split(" ").map((p) => p[0]).slice(0, 2).join("").toUpperCase();
  const currentPlan = overview?.plan || "tracking";
  const clienteLabel = overview && overview.ruc
    ? `${overview.empresa} - ${overview.ruc}`
    : (overview?.empresa || user.empresa || "ENERED PERÚ");
  const openWA = () => window.open(WA_LINK, "_blank");

  const SidebarContent = () => (
    <>
      {/* Logo + tagline */}
      <div className="px-2 pt-3 pb-2 text-center flex-shrink-0">
        <div className="w-20 h-20 mx-auto rounded-xl overflow-hidden bg-white/0 flex items-center justify-center">
          <img
            src={LOGO_IMG}
            alt="ENERED"
            className="w-full h-full object-contain"
          />
        </div>
      </div>

      {/* Divider */}
      <div className="mx-5 h-px bg-white/15 mb-1 flex-shrink-0" />

      <nav className="flex-1 px-2 py-1 space-y-0.5 overflow-y-auto" data-testid="sidebar-nav">
        {items.map((item) => (
          <SidebarLink key={item.to} item={item} onClick={() => setMobileOpen(false)} />
        ))}

        {isAdmin && (
          <>
            <div className="mx-2 mt-2 mb-1 pt-2 border-t border-white/15 text-[8px] font-bold uppercase tracking-widest text-white/60 text-center">
              Admin
            </div>
            {ADMIN_ITEMS.map((item) => (
              <SidebarLink key={item.to} item={item} onClick={() => setMobileOpen(false)} />
            ))}
          </>
        )}
      </nav>

      {/* Logout */}
      <div className="px-2 py-2 border-t border-white/15 flex-shrink-0">
        <button
          onClick={handleLogout}
          className="w-full flex flex-col items-center justify-center py-2 rounded-lg hover:bg-white/10 transition-colors"
          data-testid="logout-btn"
        >
          <LogOut className="w-4 h-4 text-white/80 mb-0.5" strokeWidth={1.75} />
          <span className="text-[10px] font-semibold text-white/90">Salir</span>
        </button>
      </div>
    </>
  );

  return (
    <div className="min-h-screen bg-[#F6F7FB]">
      {/* Desktop sidebar */}
      <aside
        className="hidden md:flex fixed inset-y-0 left-0 w-28 flex-col z-40"
        style={{ background: "linear-gradient(180deg, #9933FF 0%, #7A2AD3 100%)" }}
      >
        <SidebarContent />
      </aside>

      {/* Mobile sidebar overlay */}
      {mobileOpen && (
        <>
          <div className="fixed inset-0 bg-black/40 z-50 md:hidden" onClick={() => setMobileOpen(false)} />
          <aside
            className="fixed inset-y-0 left-0 w-28 z-50 flex flex-col md:hidden animate-fade-in"
            style={{ background: "linear-gradient(180deg, #9933FF 0%, #7A2AD3 100%)" }}
          >
            <SidebarContent />
          </aside>
        </>
      )}

      {/* Header */}
      <header className="md:ml-28 h-20 bg-white sticky top-0 z-30 flex items-center justify-between px-4 md:px-8 border-b border-neutral-100">
        <div className="flex items-center gap-3 min-w-0">
          <button
            className="md:hidden p-2 rounded-md hover:bg-neutral-100"
            onClick={() => setMobileOpen(true)}
            data-testid="mobile-menu-toggle"
          >
            <Menu className="w-5 h-5" />
          </button>
          <h1 className="font-cabinet font-bold text-2xl md:text-3xl text-neutral-900 truncate" data-testid="page-title">
            {pageTitle}
          </h1>
        </div>

        <div className="flex items-center gap-3 md:gap-5">
          <div className="hidden md:flex items-center h-10 w-64 lg:w-80 bg-neutral-50 rounded-full px-4 border border-neutral-200" data-testid="header-search">
            <Search className="w-4 h-4 text-neutral-400" />
            <input
              type="text"
              placeholder="Buscar"
              className="flex-1 ml-3 bg-transparent outline-none text-sm placeholder:text-neutral-400"
            />
          </div>
          <button className="hidden md:flex w-10 h-10 rounded-full bg-neutral-50 border border-neutral-200 items-center justify-center hover:bg-neutral-100 relative" data-testid="header-bell">
            <Bell className="w-4 h-4 text-neutral-700" strokeWidth={1.75} />
            <span className="absolute top-2 right-2.5 w-1.5 h-1.5 bg-brand rounded-full" />
          </button>
          <button className="hidden md:flex w-10 h-10 rounded-full bg-neutral-50 border border-neutral-200 items-center justify-center hover:bg-neutral-100" data-testid="header-mail">
            <Mail className="w-4 h-4 text-neutral-700" strokeWidth={1.75} />
          </button>

          <div className="flex items-center gap-3">
            <div className="hidden sm:block text-right">
              <div className="text-[11px] text-neutral-500 font-medium leading-tight">Hola,</div>
              <div className="text-sm font-bold text-neutral-900 leading-tight truncate max-w-[160px]">{user.name || "Usuario"}</div>
              <div className="text-[10px] text-neutral-500 font-semibold leading-tight">{ROLE_LABEL[user.role]}</div>
            </div>
            <div
              className="w-11 h-11 rounded-full bg-gradient-to-br from-brand to-[#6B23B1] text-white font-black flex items-center justify-center text-sm border-2 border-white shadow-md"
              data-testid="header-avatar"
            >
              {initials}
            </div>
          </div>
        </div>
      </header>

      {/* Planes row */}
      <div className="md:ml-28 px-4 md:px-8 py-4 bg-white border-b border-neutral-100">
        <div className="flex gap-3 overflow-x-auto pb-1" data-testid="plan-cards">
          <PlanCard label="Cliente" title={clienteLabel} color="gray" testid="plan-cliente" wide />
          <PlanCard label="Tipo de Producto" title="Flotas" color="gray" testid="plan-producto" wide />
          <PlanCard label="Ahorro Combustible" title="Plan Tracking" color="violet" testid="plan-tracking" onClick={openWA} active={currentPlan === "tracking"} />
          <PlanCard label="Ahorro Integral" title="Plan Advanced" color="violetDark" testid="plan-advanced" onClick={openWA} active={currentPlan === "advanced"} />
          <PlanCard label="Control Total 360" title="Plan Integral" color="violet" testid="plan-integral" onClick={openWA} active={currentPlan === "integral"} />
          <PlanCard label="Prueba Gratis" title="¡Optimiza tu Flota!" color="cyan" testid="plan-prueba" onClick={openWA} />
        </div>
      </div>

      <main className="md:ml-28 p-4 md:p-8 space-y-8 page-enter">{children}</main>
    </div>
  );
}
