import React, { useEffect, useState } from "react";
import { NavLink, useNavigate, useLocation } from "react-router-dom";
import {
  LayoutDashboard, Fuel, Satellite, BarChart3, Receipt, ShieldCheck, GraduationCap,
  LifeBuoy, Users, Database, QrCode, LogOut, Menu, Search, Bell, Mail,
  FileText, Wrench, Disc, AlertTriangle,
  Wallet, Calendar, Ticket, ClipboardCheck, Car, Route, ChevronDown,
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
  { to: "/subsidio/documentos", label: "Mi Expediente DU 004-2026", icon: FolderCheck, roles: ["cliente_subsidio"], testid: "nav-expediente", badge: "DU 004", badgeColor: "cyan" },
  { to: "/dashboard", label: "Dashboard", iconImg: `${ICON_BASE}/dashboard.png`, icon: LayoutDashboard, roles: ALL_REGULAR_ROLES, testid: "nav-dashboard" },
  { to: "/analitica", label: "Analytics BI", iconImg: `${ICON_BASE}/analitica.png`, icon: BarChart3, roles: ALL_REGULAR_ROLES, testid: "nav-analitica", badge: "NUEVO", badgeColor: "amber"},
  { to: "/monitoreo", label: "Monitoreo", iconImg: `${ICON_BASE}/centro-monitoreo.png`, icon: Satellite, roles: ALL_REGULAR_ROLES, testid: "nav-monitoreo", badge: "PRÓXIMO", badgeColor: "cyan" },
  { to: "/flotas", label: "Combustible", iconImg: `${ICON_BASE}/flotas.png`, icon: Fuel, roles: ALL_REGULAR_ROLES, testid: "nav-flotas" },
  { to: "/facturacion", label: "Cuenta", iconImg: `${ICON_BASE}/estado-cuenta.png`, icon: Receipt, roles: ["admin_enered", "administrador", "contabilidad", "cliente_subsidio"], testid: "nav-estado" },
  { to: "/gestion-gastos", label: "Gestión Gastos", icon: Wallet, roles: ALL_REGULAR_ROLES, testid: "nav-gestion-gastos", badge: "NUEVO", badgeColor: "amber", disabled: true },
  { to: "/calendario", label: "Calendario", icon: Calendar, roles: ALL_REGULAR_ROLES, testid: "nav-calendario", badge: "NUEVO", badgeColor: "amber" },
  { to: "/tickets", label: "Tickets", icon: Ticket, roles: ALL_REGULAR_ROLES, testid: "nav-tickets", badge: "NUEVO", badgeColor: "amber" },
  { to: "/mantenimiento", label: "Mantenimiento", iconImg: `${ICON_BASE}/mantenimiento.png`, icon: Wrench, roles: ALL_REGULAR_ROLES, testid: "nav-mantenimiento" },
  { to: "/checklist", label: "Checklist", icon: ClipboardCheck, roles: ALL_REGULAR_ROLES, testid: "nav-checklist", badge: "NUEVO", badgeColor: "amber"},
  { to: "/infracciones", label: "Infracciones", iconImg: `${ICON_BASE}/infracciones.png`, icon: AlertTriangle, roles: ALL_REGULAR_ROLES, testid: "nav-infracciones" },
  { to: "/vehiculos", label: "Vehículos", icon: Car, roles: ALL_REGULAR_ROLES, testid: "nav-vehiculos", badge: "NUEVO", badgeColor: "amber" },
  { to: "/neumaticos", label: "Neumáticos", iconImg: `${ICON_BASE}/neumaticos.png`, icon: Disc, roles: ALL_REGULAR_ROLES, testid: "nav-neumaticos" },
  { to: "/viajes", label: "Viajes", icon: Route, roles: ALL_REGULAR_ROLES, testid: "nav-viajes", badge: "NUEVO", badgeColor: "amber" },
  { to: "/documentacion", label: "Documentación", iconImg: `${ICON_BASE}/documentacion.png`, icon: FileText, roles: ALL_REGULAR_ROLES, testid: "nav-documentacion" },
  { to: "/soporte", label: "Soporte", iconImg: `${ICON_BASE}/soporte.png`, icon: LifeBuoy, roles: ALL_REGULAR_ROLES, testid: "nav-soporte" },
];

const ADMIN_ITEMS = [
  { to: "/admin/users", label: "Usuarios", icon: Users, testid: "nav-users" },
  { to: "/admin/upload", label: "Datos", icon: Database, testid: "nav-upload" },
  { to: "/admin/qr", label: "QR", icon: QrCode, testid: "nav-qr-admin" },
];

const ROUTE_TITLES = {
  "/dashboard": "Dashboard",
  "/analitica": "Analytics BI",
  "/centro-monitoreo": "Monitoreo",
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
  "/admin/upload": "Datos",
  "/admin/qr": "QR",
};

function SidebarLink({ item, onClick }) {
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
        <Ic className={`w-5 h-5 flex-shrink-0 ${active ? "text-cyan-300" : "text-white/90"}`} strokeWidth={1.75} />
      )}
      <span className={`text-sm font-semibold flex-1 ${active ? "text-cyan-300" : "text-white/95"}`}>{item.label}</span>
      {item.badge && (
        <span className={`px-1.5 py-0.5 rounded-full text-[8px] font-black tracking-wider flex-shrink-0 ${
          item.badgeColor === "cyan" ? "bg-cyan-400 text-[#2D0A4E]" : "bg-amber-400 text-[#2D0A4E]"
        }`}>
          {item.badge}
        </span>
      )}
      {hasSubmenu && (
        <ChevronDown className={`w-4 h-4 flex-shrink-0 transition-transform ${expanded ? "rotate-180" : ""} ${active || isSubmenuActive ? "text-cyan-300" : "text-white/70"}`} />
      )}
    </>
  );

  const baseCls = "relative flex items-center gap-3 px-4 py-2.5 rounded-lg transition-all";

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
        {expanded && (
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
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    if (user && user.role !== "cliente_subsidio") {
      api.get("/dashboard/overview").then((r) => setOverview(r.data)).catch(() => {});
    }
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
      {/* Logo */}
      <div className="px-5 pt-6 pb-5 flex-shrink-0">
        <img
          src={LOGO_IMG}
          alt="ENERED"
          className="w-full max-w-[150px] mx-auto h-auto object-contain"
        />
      </div>

      {/* Divider */}
      <div className="mx-5 h-px bg-white/15 mb-2 flex-shrink-0" />

      <nav className="flex-1 px-3 py-2 flex flex-col space-y-1 overflow-y-auto" data-testid="sidebar-nav">
        {items.map((item) => (
          <SidebarLink key={item.to} item={item} onClick={() => setMobileOpen(false)} />
        ))}

        {isAdmin && (
          <>
            <div className="mx-3 mt-3 mb-1 pt-3 border-t border-white/15 text-[9px] font-bold uppercase tracking-widest text-white/60">
              Admin
            </div>
            {ADMIN_ITEMS.map((item) => (
              <SidebarLink key={item.to} item={item} onClick={() => setMobileOpen(false)} />
            ))}
          </>
        )}
      </nav>

      {/* Logout */}
      <div className="px-3 py-3 border-t border-white/15 flex-shrink-0">
        <button
          onClick={handleLogout}
          className="w-full flex items-center gap-3 px-4 py-2.5 rounded-lg hover:bg-white/10 transition-colors"
          data-testid="logout-btn"
        >
          <LogOut className="w-5 h-5 text-white/80" strokeWidth={1.75} />
          <span className="text-sm font-semibold text-white/90">Salir</span>
        </button>
      </div>
    </>
  );

  return (
    <div className="min-h-screen bg-[#F6F7FB]">
      {/* Desktop sidebar */}
      <aside
        className="hidden md:flex fixed inset-y-0 left-0 w-56 flex-col z-40"
        style={{ background: "linear-gradient(180deg, #8039F4 0%, #6B26DC 100%)" }}
      >
        <SidebarContent />
      </aside>

      {/* Mobile sidebar overlay */}
      {mobileOpen && (
        <>
          <div className="fixed inset-0 bg-black/40 z-50 md:hidden" onClick={() => setMobileOpen(false)} />
          <aside
            className="fixed inset-y-0 left-0 w-56 z-50 flex flex-col md:hidden animate-fade-in"
            style={{ background: "linear-gradient(180deg, #8039F4 0%, #6B26DC 100%)" }}
          >
            <SidebarContent />
          </aside>
        </>
      )}

      {/* Header */}
      <header className="md:ml-56 h-20 bg-white sticky top-0 z-30 flex items-center justify-between px-4 md:px-8 border-b border-neutral-100">
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

      <main className="md:ml-56 p-4 md:p-8 space-y-8 page-enter">
        {children}
        <EmayFooter variant="compact" />
      </main>
    </div>
  );
}
