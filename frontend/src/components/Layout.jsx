import React, { useState } from "react";
import { NavLink, useNavigate } from "react-router-dom";
import {
  LayoutDashboard, FileBarChart, Receipt, ShieldCheck, GraduationCap,
  LifeBuoy, Users, Upload, LogOut, Menu, X, Fuel, Gauge,
} from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { ROLE_LABEL } from "../lib/utils";

const ALL_ITEMS = [
  { to: "/dashboard", label: "Dashboard", icon: LayoutDashboard, roles: ["admin_enered", "administrador", "logistica", "contabilidad"], testid: "nav-dashboard" },
  { to: "/analitica", label: "Analítica", icon: Gauge, roles: ["admin_enered", "administrador", "logistica", "contabilidad"], testid: "nav-analitica" },
  { to: "/reportes", label: "Reportes", icon: FileBarChart, roles: ["admin_enered", "administrador", "logistica", "contabilidad"], testid: "nav-reportes" },
  { to: "/facturacion", label: "Facturación", icon: Receipt, roles: ["admin_enered", "administrador", "contabilidad"], testid: "nav-facturacion" },
  { to: "/control", label: "Control Integral", icon: ShieldCheck, roles: ["admin_enered", "administrador", "logistica"], testid: "nav-control" },
  { to: "/capacitacion", label: "Capacitación", icon: GraduationCap, roles: ["admin_enered", "administrador", "logistica", "contabilidad"], testid: "nav-capacitacion" },
  { to: "/soporte", label: "Soporte", icon: LifeBuoy, roles: ["admin_enered", "administrador", "logistica", "contabilidad"], testid: "nav-soporte" },
];

const ADMIN_ITEMS = [
  { to: "/admin/users", label: "Usuarios", icon: Users, testid: "nav-users" },
  { to: "/admin/upload", label: "Subir Consumos", icon: Upload, testid: "nav-upload" },
];

export default function Layout({ children }) {
  const { user, logout } = useAuth();
  const [mobileOpen, setMobileOpen] = useState(false);
  const navigate = useNavigate();

  if (!user) return null;

  const items = ALL_ITEMS.filter((i) => i.roles.includes(user.role));
  const isAdmin = user.role === "admin_enered";

  const handleLogout = async () => {
    await logout();
    navigate("/login");
  };

  const SidebarContent = () => (
    <>
      <div className="px-6 py-6 border-b border-border">
        <div className="flex items-center gap-2">
          <div className="w-9 h-9 rounded-md bg-brand flex items-center justify-center">
            <Fuel className="w-5 h-5 text-white" strokeWidth={2.5} />
          </div>
          <div>
            <div className="font-cabinet font-black text-xl text-neutral-900 leading-none">ENERED</div>
            <div className="text-[10px] font-bold uppercase tracking-widest text-neutral-500 mt-1">Fuel Intelligence</div>
          </div>
        </div>
      </div>

      <nav className="flex-1 px-3 py-6 space-y-1 overflow-y-auto" data-testid="sidebar-nav">
        {items.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            onClick={() => setMobileOpen(false)}
            className={({ isActive }) => `nav-link ${isActive ? "active" : ""}`}
            data-testid={item.testid}
          >
            <item.icon className="w-5 h-5" strokeWidth={2} />
            {item.label}
          </NavLink>
        ))}

        {isAdmin && (
          <>
            <div className="pt-6 pb-2 px-3 text-[10px] font-bold uppercase tracking-widest text-neutral-400">
              Administración
            </div>
            {ADMIN_ITEMS.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                onClick={() => setMobileOpen(false)}
                className={({ isActive }) => `nav-link ${isActive ? "active" : ""}`}
                data-testid={item.testid}
              >
                <item.icon className="w-5 h-5" strokeWidth={2} />
                {item.label}
              </NavLink>
            ))}
          </>
        )}
      </nav>

      <div className="p-4 border-t border-border">
        <div className="flex items-center gap-3 p-2 rounded-md">
          <div className="w-9 h-9 rounded-full bg-brand-50 border border-brand-100 text-brand font-bold flex items-center justify-center text-sm">
            {(user.name || user.email).slice(0, 1).toUpperCase()}
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-sm font-bold text-neutral-900 truncate">{user.name || "Usuario"}</div>
            <div className="text-[10px] font-bold uppercase tracking-wider text-neutral-500 truncate">{ROLE_LABEL[user.role]}</div>
          </div>
          <button
            onClick={handleLogout}
            className="p-2 rounded-md hover:bg-neutral-100 text-neutral-500 hover:text-red-600 transition-colors"
            data-testid="logout-btn"
            title="Cerrar sesión"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </div>
    </>
  );

  return (
    <div className="min-h-screen bg-[#F9FAFB]">
      {/* Desktop sidebar */}
      <aside className="hidden md:flex fixed inset-y-0 left-0 w-64 bg-white border-r border-border flex-col z-40">
        <SidebarContent />
      </aside>

      {/* Mobile sidebar overlay */}
      {mobileOpen && (
        <>
          <div
            className="fixed inset-0 bg-black/40 z-50 md:hidden"
            onClick={() => setMobileOpen(false)}
          />
          <aside className="fixed inset-y-0 left-0 w-72 bg-white z-50 flex flex-col md:hidden animate-fade-in">
            <SidebarContent />
          </aside>
        </>
      )}

      {/* Header */}
      <header
        className="md:ml-64 h-16 bg-white/80 backdrop-blur-md border-b border-border sticky top-0 z-30 flex items-center justify-between px-4 md:px-8"
      >
        <div className="flex items-center gap-3">
          <button
            className="md:hidden p-2 rounded-md hover:bg-neutral-100"
            onClick={() => setMobileOpen(true)}
            data-testid="mobile-menu-toggle"
          >
            {mobileOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
          <div>
            <div className="text-[11px] font-bold uppercase tracking-widest text-neutral-500">Bienvenido</div>
            <div className="font-cabinet font-black text-lg text-neutral-900 leading-tight">
              {user.name || "Usuario"}
            </div>
          </div>
        </div>
        <div className="hidden sm:flex items-center gap-2">
          <span className="px-3 py-1 rounded-full bg-brand-50 text-brand text-xs font-bold uppercase tracking-wider border border-brand-100">
            {ROLE_LABEL[user.role]}
          </span>
        </div>
      </header>

      <main className="md:ml-64 p-4 md:p-8 space-y-8 page-enter">{children}</main>
    </div>
  );
}
