import React, { useState } from "react";
import { NavLink, useNavigate, useLocation } from "react-router-dom";
import {
  LayoutDashboard, Truck, Satellite, PieChart, Receipt, ShieldCheck, GraduationCap,
  LifeBuoy, Users, Upload, LogOut, Menu, X, Search, Bell, Mail, ChevronRight,
} from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { ROLE_LABEL } from "../lib/utils";

const LOGO_IMG = "https://customer-assets.emergentagent.com/job_enered-insight/artifacts/hrbrugb8_image.png";

const MENU = [
  { to: "/dashboard", label: "Dashboard", icon: LayoutDashboard, roles: ["admin_enered", "administrador", "logistica", "contabilidad"], testid: "nav-dashboard" },
  { to: "/reportes", label: "Flotas", icon: Truck, roles: ["admin_enered", "administrador", "logistica", "contabilidad"], testid: "nav-flotas" },
  { to: "/centro-monitoreo", label: "Centro Monitoreo", icon: Satellite, roles: ["admin_enered", "administrador", "logistica", "contabilidad"], testid: "nav-monitoreo", badge: "PRÓXIMAMENTE", badgeColor: "cyan", disabled: true },
  { to: "/analitica", label: "Analítics", icon: PieChart, roles: ["admin_enered", "administrador", "logistica", "contabilidad"], testid: "nav-analitica", badge: "NUEVO", badgeColor: "amber" },
  { to: "/facturacion", label: "Estado de Cuenta", icon: Receipt, roles: ["admin_enered", "administrador", "contabilidad"], testid: "nav-estado" },
  { to: "/control", label: "Seguridad", icon: ShieldCheck, roles: ["admin_enered", "administrador", "logistica"], testid: "nav-seguridad" },
  { to: "/capacitacion", label: "Capacitación", icon: GraduationCap, roles: ["admin_enered", "administrador", "logistica", "contabilidad"], testid: "nav-capacitacion" },
  { to: "/soporte", label: "Soporte", icon: LifeBuoy, roles: ["admin_enered", "administrador", "logistica", "contabilidad"], testid: "nav-soporte" },
];

const ADMIN_ITEMS = [
  { to: "/admin/users", label: "Usuarios", icon: Users, testid: "nav-users" },
  { to: "/admin/upload", label: "Fuente de Datos", icon: Upload, testid: "nav-upload" },
];

const ROUTE_TITLES = {
  "/dashboard": "Dashboard",
  "/reportes": "Flotas",
  "/centro-monitoreo": "Centro Monitoreo",
  "/analitica": "Analítics",
  "/facturacion": "Estado de Cuenta",
  "/control": "Seguridad",
  "/capacitacion": "Capacitación",
  "/soporte": "Soporte",
  "/admin/users": "Usuarios",
  "/admin/upload": "Fuente de Datos",
};

function SidebarLink({ item, onClick }) {
  const Ic = item.icon;
  const content = (active) => (
    <>
      <div className="relative">
        <Ic className={`w-6 h-6 mb-1.5 ${active ? "text-cyan-300" : "text-white/90"}`} strokeWidth={1.75} />
      </div>
      <span className={`text-[11px] font-semibold leading-tight text-center ${active ? "text-cyan-300" : "text-white/95"}`}>{item.label}</span>
      {item.badge && (
        <span className={`mt-1.5 px-2 py-0.5 rounded-full text-[8px] font-black tracking-wider ${
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
        className="flex flex-col items-center justify-center py-3 px-2 rounded-xl opacity-60 cursor-not-allowed"
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
        `flex flex-col items-center justify-center py-3 px-2 rounded-xl transition-all ${
          isActive ? "bg-white/15 shadow-inner" : "hover:bg-white/10"
        }`
      }
    >
      {({ isActive }) => content(isActive)}
    </NavLink>
  );
}

function PlanCard({ label, title, color = "violet", testid }) {
  const styles = {
    gray: "bg-neutral-100 text-neutral-800 border-neutral-200",
    violet: "bg-brand text-white border-brand",
    violetDark: "bg-[#6B23B1] text-white border-[#6B23B1]",
    cyan: "bg-cyan-300 text-[#1e1b4b] border-cyan-300",
  }[color];
  return (
    <div className={`rounded-2xl px-4 py-3 border ${styles} min-w-[140px] flex flex-col justify-center`} data-testid={testid}>
      <div className={`text-[10px] font-semibold uppercase tracking-wider ${color === "gray" ? "text-neutral-500" : color === "cyan" ? "text-[#1e1b4b]/70" : "text-white/75"}`}>
        {label}
      </div>
      <div className={`font-bold text-sm mt-0.5 leading-tight ${color === "cyan" ? "text-[#1e1b4b]" : ""}`}>{title}</div>
    </div>
  );
}

export default function Layout({ children }) {
  const { user, logout } = useAuth();
  const [mobileOpen, setMobileOpen] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();

  if (!user) return null;

  const items = MENU.filter((i) => i.roles.includes(user.role));
  const isAdmin = user.role === "admin_enered";

  const handleLogout = async () => {
    await logout();
    navigate("/login");
  };

  const pageTitle = ROUTE_TITLES[location.pathname] || "";
  const initials = (user.name || user.email).split(" ").map((p) => p[0]).slice(0, 2).join("").toUpperCase();
  const clientCode = user.empresa || "ENERED PERÚ";

  const SidebarContent = () => (
    <>
      {/* Logo + tagline */}
      <div className="px-4 pt-7 pb-5 text-center">
        <img
          src={LOGO_IMG}
          alt="ENERED"
          className="h-9 w-auto mx-auto"
          style={{ filter: "brightness(0) invert(1)" }}
        />
        <div className="text-[9px] font-semibold uppercase tracking-[0.2em] text-white/70 mt-2">
          Red inteligente de energías
        </div>
      </div>

      {/* Divider */}
      <div className="mx-6 h-px bg-white/15 mb-3" />

      <nav className="flex-1 px-3 py-2 space-y-1 overflow-y-auto" data-testid="sidebar-nav">
        {items.map((item) => (
          <SidebarLink key={item.to} item={item} onClick={() => setMobileOpen(false)} />
        ))}

        {isAdmin && (
          <>
            <div className="mx-2 mt-4 mb-2 pt-4 border-t border-white/15 text-[9px] font-bold uppercase tracking-widest text-white/60 text-center">
              Administración
            </div>
            {ADMIN_ITEMS.map((item) => (
              <SidebarLink key={item.to} item={item} onClick={() => setMobileOpen(false)} />
            ))}
          </>
        )}
      </nav>

      {/* Logout */}
      <div className="px-3 py-3 border-t border-white/15">
        <button
          onClick={handleLogout}
          className="w-full flex flex-col items-center justify-center py-3 rounded-xl hover:bg-white/10 transition-colors"
          data-testid="logout-btn"
        >
          <LogOut className="w-5 h-5 text-white/80 mb-1" strokeWidth={1.75} />
          <span className="text-[11px] font-semibold text-white/90">Salir</span>
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
          <PlanCard label="Cliente" title={clientCode} color="gray" testid="plan-cliente" />
          <PlanCard label="Tipo de Producto" title="Flotas" color="gray" testid="plan-producto" />
          <PlanCard label="Ahorro Combustible" title="Plan Tracking" color="violet" testid="plan-tracking" />
          <PlanCard label="Ahorro Integral" title="Plan Advanced" color="violetDark" testid="plan-advanced" />
          <PlanCard label="Control Total 360" title="Plan Integral" color="violet" testid="plan-integral" />
          <PlanCard label="Prueba Gratis" title="¡Optimiza tu Flota!" color="cyan" testid="plan-prueba" />
        </div>
      </div>

      <main className="md:ml-28 p-4 md:p-8 space-y-8 page-enter">{children}</main>
    </div>
  );
}
