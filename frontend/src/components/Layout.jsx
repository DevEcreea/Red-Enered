import React, { useEffect, useState } from "react";
import { NavLink, useNavigate, useLocation } from "react-router-dom";
import {
  LayoutDashboard, Fuel, Satellite, BarChart3, Receipt, ShieldCheck, GraduationCap,
  LifeBuoy, Users, Database, QrCode, LogOut, Menu, Search, Bell, Mail,
  FileText, Wrench, Disc, AlertTriangle,
  Wallet, Calendar, Ticket, ClipboardCheck, Car, Route, ChevronDown, ChevronLeft, ChevronRight,
  FolderCheck,
} from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { api } from "../lib/api";
import { ROLE_LABEL } from "../lib/utils";
import EmayFooter from "./EmayFooter";

const LOGO_IMG = "/assets/enered-logo.png";
const WA_LINK = "https://wa.me/message/VDUNDBHSQ47SC1";

const ICON_BASE = "/assets/icons";

const ALL_REGULAR_ROLES = ["admin_enered", "administrador", "logistica", "contabilidad", "cliente_subsidio"];

const MENU = [
  { to: "/subsidio/documentos", label: "Mi Flota", icon: FolderCheck, roles: ["cliente_subsidio"], testid: "nav-expediente", badge: "DU 004", badgeColor: "cyan" },
  { to: "/dashboard", label: "Dashboard", icon: LayoutDashboard, roles: ALL_REGULAR_ROLES, testid: "nav-dashboard" },
  { to: "/dashboard-subsidio", label: "Panel Subsidio", icon: LayoutDashboard, roles: ["admin_enered", "cliente_subsidio", "administrador", "logistica", "contabilidad"], testid: "nav-dashboard-subsidio", requiresSubsidio: true },
  { to: "/analitica", label: "Analytics BI", icon: BarChart3, roles: ALL_REGULAR_ROLES, testid: "nav-analitica" },
  { to: "/monitoreo", label: "Monitoreo", icon: Satellite, roles: ALL_REGULAR_ROLES, testid: "nav-monitoreo" },
  { to: "/flotas", label: "Combustible", icon: Fuel, roles: ALL_REGULAR_ROLES, testid: "nav-flotas" },
  { to: "/facturacion", label: "Cuenta", icon: Receipt, roles: ["admin_enered", "administrador", "contabilidad", "cliente_subsidio"], testid: "nav-estado" },
  { to: "/gestion-gastos", label: "Gestión Gastos", icon: Wallet, roles: ALL_REGULAR_ROLES, testid: "nav-gestion-gastos" },
  { to: "/mantenimiento", label: "Mantenimiento", icon: Wrench, roles: ALL_REGULAR_ROLES, testid: "nav-mantenimiento" },
  { to: "/checklist", label: "Checklist", icon: ClipboardCheck, roles: ALL_REGULAR_ROLES, testid: "nav-checklist" },
  { to: "/infracciones", label: "Infracciones", icon: AlertTriangle, roles: ALL_REGULAR_ROLES, testid: "nav-infracciones" },
  { to: "/vehiculos", label: "Vehículos", icon: Car, roles: ALL_REGULAR_ROLES, testid: "nav-vehiculos" },
  { to: "/neumaticos", label: "Neumáticos", icon: Disc, roles: ALL_REGULAR_ROLES, testid: "nav-neumaticos" },
  { to: "/viajes", label: "Viajes", icon: Route, roles: ALL_REGULAR_ROLES, testid: "nav-viajes" },
  { to: "/documentacion", label: "Documentación", icon: FileText, roles: ALL_REGULAR_ROLES, testid: "nav-documentacion" },
];

const ADMIN_ITEMS = [
  { to: "/admin/users", label: "Usuarios", icon: Users, testid: "nav-users" },
  { to: "/admin/empresas", label: "Empresas & Servicios", icon: FolderCheck, testid: "nav-empresas" },
  { to: "/admin/upload", label: "Datos", icon: Database, testid: "nav-upload" },
  { to: "/admin/subsidio", label: "Subsidio DU 004", icon: FolderCheck, testid: "nav-subsidio-admin" },
];

const ROUTE_TITLES = {
  "/dashboard": "Dashboard",
  "/analitica": "Analytics BI",
  "/monitoreo": "Monitoreo",
  "/flotas": "Combustible",
  "/facturacion": "Cuenta",
  "/gestion-gastos": "Gestión Gastos",
  "/calendario": "Calendario",
  "/tickets": "Tickets",
  "/mantenimiento": "Mantenimiento",
  "/checklist": "Checklist",
  "/infracciones": "Infracciones",
  "/vehiculos": "Vehículos",
  "/neumaticos": "Neumáticos",
  "/viajes": "Viajes",
  "/documentacion": "Documentación",
  "/soporte": "Soporte",
  "/admin/users": "Usuarios",
  "/admin/empresas": "Empresas & Servicios",
  "/admin/subsidio": "Subsidio · Expedientes",
  "/admin/upload": "Datos",
  "/admin/qr": "QR",
};

function SidebarLink({ item, onClick, isCollapsed }) {
  const Ic = item.icon;
  const location = useLocation();
  const [expanded, setExpanded] = React.useState(false);
  const hasSubmenu = item.submenu && item.submenu.length > 0;
  const isSubmenuActive = hasSubmenu && item.submenu.some(sub => location.pathname === sub.to);
  
  React.useEffect(() => {
    if (isSubmenuActive && !expanded) setExpanded(true);
  }, [isSubmenuActive, expanded]);

  const content = (active) => (
    <>
      {active && <span className="absolute left-0 top-2 bottom-2 w-1 bg-cyan-300 rounded-r-full" />}
      {item.iconImg ? (
        <img
          src={item.iconImg}
          alt=""
          className="w-5 h-5 object-contain flex-shrink-0"
          style={active ? { filter: "brightness(0) saturate(100%) invert(78%) sepia(60%) saturate(427%) hue-rotate(135deg) brightness(102%) contrast(98%)" } : { filter: "brightness(0) invert(1)", opacity: 0.9 }}
        />
      ) : (
        <Ic className={`w-5 h-5 flex-shrink-0 ${active ? "text-cyan-300" : "text-white/90"}`} strokeWidth={2} />
      )}
      <span className={`text-sm font-semibold flex-1 text-left transition-opacity duration-300 whitespace-nowrap ${
        isCollapsed ? "opacity-0 pointer-events-none" : "opacity-100"
      } ${active ? "text-cyan-300" : "text-white/95"}`}>{item.label}</span>
      {item.badge && (
        <span className={`px-1.5 py-0.5 rounded-full text-[8px] font-black tracking-wider flex-shrink-0 transition-opacity duration-300 ${
          isCollapsed ? "opacity-0 pointer-events-none" : "opacity-100"
        } ${
          item.badgeColor === "cyan" ? "bg-cyan-400 text-[#2D0A4E]" : "bg-amber-400 text-[#2D0A4E]"
        }`}>
          {item.badge}
        </span>
      )}
      {hasSubmenu && (
        <ChevronDown className={`w-4 h-4 flex-shrink-0 transition-opacity duration-300 ${
          isCollapsed ? "opacity-0 pointer-events-none" : "opacity-100"
        } ${expanded ? "rotate-180" : ""} ${active || isSubmenuActive ? "text-cyan-300" : "text-white/70"}`} />
      )}
    </>
  );

  const baseCls = `relative flex items-center rounded-lg transition-all overflow-hidden gap-3 px-[14px] py-2.5`;

  if (item.disabled) {
    return (
      <div className={`${baseCls} opacity-60 cursor-not-allowed`} data-testid={item.testid}>
        {content(false)}
      </div>
    );
  }

  if (hasSubmenu) {
    return (
      <div>
        <button
          onClick={() => setExpanded(!expanded)}
          data-testid={item.testid}
          className={`${baseCls} w-full ${isSubmenuActive ? "bg-white/15" : "hover:bg-white/10"}`}
        >
          {content(isSubmenuActive)}
        </button>
        {!isCollapsed && expanded && (
          <div className="ml-6 mt-1 space-y-0.5 border-l border-white/20 pl-3">
            {item.submenu.map((sub) => (
              <NavLink
                key={sub.to}
                to={sub.to}
                onClick={onClick}
                data-testid={sub.testid}
                className={({ isActive }) =>
                  `block px-3 py-2 rounded-md text-xs font-medium transition-all ${
                    isActive ? "bg-white/15 text-cyan-300" : "text-white/80 hover:bg-white/10 hover:text-white"
                  }`
                }
              >
                {sub.label}
              </NavLink>
            ))}
          </div>
        )}
      </div>
    );
  }

  return (
    <NavLink
      to={item.to}
      onClick={onClick}
      data-testid={item.testid}
      className={({ isActive }) =>
        `${baseCls} ${isActive ? "bg-white/15" : "hover:bg-white/10"}`
      }
    >
      {({ isActive }) => content(isActive)}
    </NavLink>
  );
}

function PlanCard({ label, title, color = "violet", testid, onClick, active = false, wide = false }) {
  // wide cards (Cliente, Tipo de Producto): 294 px ancho — 2 juntos + gap = 600 px (igual que Estado General)
  // tarjetas de plan (4): 200 x 60 px, border-radius 20 px
  const base = wide
    ? "rounded-2xl px-4 py-3 border flex flex-col justify-center transition-all w-[294px] flex-shrink-0"
    : "rounded-[20px] px-3 py-2 border flex flex-col justify-center transition-all w-[200px] h-[60px] flex-shrink-0";
  const styles = {
    gray: "bg-neutral-100 text-neutral-800 border-neutral-200",
    violet: "bg-brand text-white border-brand hover:bg-brand-hover cursor-pointer hover:shadow-lg hover:-translate-y-0.5",
    violetDark: "bg-[#6B23B1] text-white border-[#6B23B1] hover:bg-[#5A1E96] cursor-pointer hover:shadow-lg hover:-translate-y-0.5",
    cyan: "bg-cyan-300 text-[#1e1b4b] border-cyan-300 hover:bg-cyan-400 cursor-pointer hover:shadow-lg hover:-translate-y-0.5",
  }[color];

  const activeRing = "";

  const content = (
    <>
      <div className={`text-[10px] font-semibold uppercase tracking-wider truncate ${color === "gray" ? "text-neutral-500" : color === "cyan" ? "text-[#1e1b4b]/70" : "text-white/75"}`}>
        {label}
      </div>
      <div className={`font-bold text-sm mt-0.5 leading-tight truncate ${color === "cyan" ? "text-[#1e1b4b]" : ""}`} title={title}>{title}</div>
      {active && <div className="text-[9px] font-black uppercase tracking-widest text-cyan-300 mt-0.5">● Tu Plan</div>}
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
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [wakingUp, setWakingUp] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    if (user && user.role !== "cliente_subsidio") {
      api.get("/dashboard/overview").then((r) => setOverview(r.data)).catch(() => {});
    }
  }, [user?.id]);

  // Escucha los eventos que emite api.js cuando un request tarda >5s (cold-start Render).
  useEffect(() => {
    const onSlow = () => setWakingUp(true);
    const onIdle = () => setWakingUp(false);
    window.addEventListener("api:slow", onSlow);
    window.addEventListener("api:idle", onIdle);
    return () => {
      window.removeEventListener("api:slow", onSlow);
      window.removeEventListener("api:idle", onIdle);
    };
  }, []);

  if (!user) return null;

  const items = MENU.filter((i) => {
    // Eliminamos la restricción de ocultar items del menú para que todos los clientes 
    // (incluso los de solo subsidio) vean la plataforma completa y puedan recibir los upsells (Demos).

    if (!i.roles.includes(user.role)) {
      // "Mi Flota" también accesible si la empresa tiene servicios.subsidio activo
      if (i.to === "/subsidio/documentos" && user?.servicios?.subsidio) return true;
      return false;
    }
    // Panel Subsidio: Oculto si tiene plataforma activa (porque ya ve el tracker en el Dashboard general)
    if (i.requiresSubsidio) {
      if (user.role === "admin_enered") return true;
      if (user?.servicios?.plataforma) return false;
      if (user.role !== "cliente_subsidio" && !user?.servicios?.subsidio) return false;
    }
    // Condición: Ningún usuario de empresa ve Dashboard a menos que tengan el servicio plataforma
    if (i.to === "/dashboard" && user.role !== "admin_enered") {
      if (!user?.servicios?.plataforma) {
        return false;
      }
    }

    return true;
  }).map((i) => {
    // Si es Monitoreo y no tiene GPS, le ponemos el badge de DEMO GRATIS
    if (i.to === "/monitoreo" && user.role !== "admin_enered" && (!user?.servicios || !user.servicios.gps)) {
      return { ...i, badge: "DEMO GRATIS", badgeColor: "amber" };
    }
    return i;
  });
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

  const SidebarContent = ({ isCollapsed, onToggle }) => (
    <>
      {/* Logo */}
      <div className="px-5 pt-6 pb-5 flex-shrink-0 flex items-center justify-center min-h-[70px] relative">
        <img
          src={LOGO_IMG}
          alt="ENERED"
          className={`w-full max-w-[150px] mx-auto h-auto object-contain transition-all duration-300 ${
            isCollapsed ? "opacity-0 scale-75 w-0 pointer-events-none" : "opacity-100 scale-100"
          }`}
        />
        {isCollapsed && (
          <svg viewBox="0 0 24 24" fill="currentColor" className="absolute w-7 h-7 text-white animate-fade-in">
            <rect x="4" y="4" width="4" height="4" rx="1" />
            <rect x="10" y="4" width="4" height="4" rx="1" />
            <rect x="16" y="4" width="4" height="4" rx="1" />
            <rect x="4" y="10" width="4" height="4" rx="1" />
            <rect x="10" y="10" width="4" height="4" rx="1" />
            <rect x="16" y="10" width="4" height="4" rx="1" />
            <rect x="4" y="16" width="4" height="4" rx="1" />
            <rect x="10" y="16" width="4" height="4" rx="1" />
            <rect x="16" y="16" width="4" height="4" rx="1" />
          </svg>
        )}
      </div>

      {/* Divider */}
      <div className={`mx-5 h-px bg-white/15 mb-2 flex-shrink-0 transition-all duration-300 ${isCollapsed ? "mx-3" : "mx-5"}`} />

      <nav className="flex-1 px-3 py-2 flex flex-col space-y-1.5 overflow-y-auto overflow-x-hidden" data-testid="sidebar-nav">
        {items.map((item) => (
          <SidebarLink key={item.to} item={item} onClick={() => setMobileOpen(false)} isCollapsed={isCollapsed} />
        ))}

        {isAdmin && (
          <>
            <div className={`mx-3 mt-3 mb-1 pt-3 border-t border-white/15 text-[9px] font-bold uppercase tracking-widest text-white/60 transition-all duration-300 whitespace-nowrap overflow-hidden ${
              isCollapsed ? "opacity-0 h-0 mt-0 pt-0 border-t-0" : "opacity-100"
            }`}>
              Admin
            </div>
            {ADMIN_ITEMS.map((item) => (
              <SidebarLink key={item.to} item={item} onClick={() => setMobileOpen(false)} isCollapsed={isCollapsed} />
            ))}
          </>
        )}

        <div className="flex-1 min-h-[8px]" />

        {/* Toggle Sidebar Button */}
        {onToggle && (
          <button
            onClick={onToggle}
            className={`hidden md:flex w-full items-center rounded-lg hover:bg-white/10 transition-all duration-300 overflow-hidden gap-3 px-[14px] py-2.5`}
            title={isCollapsed ? "Expandir menú" : "Contraer menú"}
          >
            {isCollapsed ? <ChevronRight className="w-5 h-5 text-white/80 flex-shrink-0" strokeWidth={1.75} /> : <ChevronLeft className="w-5 h-5 text-white/80 flex-shrink-0" strokeWidth={1.75} />}
            <span className={`text-sm font-semibold flex-1 text-left text-white/90 transition-opacity duration-300 whitespace-nowrap ${
              isCollapsed ? "opacity-0 pointer-events-none" : "opacity-100"
            }`}>
              {isCollapsed ? "Expandir" : "Contraer"}
            </span>
          </button>
        )}
      </nav>

      {/* Logout */}
      <div className="px-3 py-3 border-t border-white/15 flex-shrink-0">
        <button
          onClick={handleLogout}
          className={`w-full flex items-center rounded-lg hover:bg-white/10 transition-all duration-300 overflow-hidden gap-3 px-[14px] py-2.5`}
          data-testid="logout-btn"
        >
          <LogOut className="w-5 h-5 text-white/80 flex-shrink-0" strokeWidth={1.75} />
          <span className={`text-sm font-semibold flex-1 text-left text-white/90 transition-opacity duration-300 whitespace-nowrap ${
            isCollapsed ? "opacity-0 pointer-events-none" : "opacity-100"
          }`}>
            Salir
          </span>
        </button>
      </div>
    </>
  );

  return (
    <div className="min-h-screen bg-[#F6F7FB]">
      {/* Banner "Reactivando servidor..." — se muestra si un request tarda >5s (cold-start Render free) */}
      {wakingUp && (
        <div className="fixed top-0 left-0 right-0 z-[100] bg-emerald-500 text-white text-xs font-semibold py-2 px-4 text-center shadow-lg flex items-center justify-center gap-2">
          <span className="inline-block w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin" />
          Preparando tu flota… cargando vehículos y datos.
        </div>
      )}
      {/* Desktop sidebar */}
      <aside
        className={`hidden md:flex fixed inset-y-0 left-0 flex-col z-40 transition-all duration-300 ease-in-out border-r border-white/10 ${
          isSidebarOpen ? "w-56" : "w-[72px]"
        }`}
        style={{ background: "linear-gradient(180deg, #8039F4 0%, #6B26DC 100%)" }}
      >
        <SidebarContent isCollapsed={!isSidebarOpen} onToggle={() => setIsSidebarOpen(!isSidebarOpen)} />
      </aside>

      {/* Mobile sidebar overlay */}
      {mobileOpen && (
        <>
          <div className="fixed inset-0 bg-black/40 z-50 md:hidden" onClick={() => setMobileOpen(false)} />
          <aside
            className="fixed inset-y-0 left-0 w-56 z-50 flex flex-col md:hidden animate-fade-in"
            style={{ background: "linear-gradient(180deg, #8039F4 0%, #6B26DC 100%)" }}
          >
            <SidebarContent isCollapsed={false} />
          </aside>
        </>
      )}

      {/* Header */}
      <header className={`${isSidebarOpen ? "md:ml-56" : "md:ml-[72px]"} h-20 bg-white sticky top-0 z-30 flex items-center justify-between px-4 md:px-8 border-b border-neutral-100 transition-all duration-300 ease-in-out`}>
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
              <div className="text-sm font-bold text-neutral-900 leading-tight truncate max-w-[260px]" data-testid="header-empresa" title={clienteLabel}>
                {clienteLabel}
              </div>
              <div className="text-xs font-bold text-brand leading-tight" data-testid="header-plan">
                Plan {currentPlan.charAt(0).toUpperCase() + currentPlan.slice(1)}
              </div>
            </div>
            <button
              onClick={openWA}
              title="Contactar a ENERED por WhatsApp"
              className="w-11 h-11 rounded-full bg-gradient-to-br from-brand to-[#6B23B1] text-white font-black flex items-center justify-center text-sm border-2 border-white shadow-md hover:scale-105 transition-transform"
              data-testid="header-avatar"
            >
              {initials}
            </button>
          </div>
        </div>
      </header>

      <main className={`${isSidebarOpen ? "md:ml-56" : "md:ml-[72px]"} p-4 md:p-8 space-y-8 page-enter transition-all duration-300 ease-in-out`}>
        {children}
        <EmayFooter variant="compact" />
      </main>
    </div>
  );
}
