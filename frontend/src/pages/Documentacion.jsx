import React, { useMemo, useState } from "react";
import {
  FileText, CheckCircle2, Clock, AlertTriangle, Plus, Download, ChevronDown,
  Calendar, Users, Truck, Tag, User, Activity, FilePlus,
} from "lucide-react";

const MOCK_DOCS = [
  { id: "20001", tab: "vehiculos", tipo: "Administración", documento: "Tarjeta de propiedad", emision: "2024-01-15", vencimiento: "2027-01-15", creadoPor: "Admin", grupo: "Flota Norte", vehiculo: "ABC-123" },
  { id: "20002", tab: "vehiculos", tipo: "Administración", documento: "SOAT", emision: "2025-04-28", vencimiento: "2026-04-28", creadoPor: "Logística", grupo: "Flota Sur", vehiculo: "DEF-456" },
  { id: "20003", tab: "vehiculos", tipo: "Operación", documento: "Revisión Técnica", emision: "2025-06-10", vencimiento: "2026-06-10", creadoPor: "Admin", grupo: "Flota Norte", vehiculo: "GHI-789" },
  { id: "20004", tab: "vehiculos", tipo: "Administración", documento: "Seguro Vehicular", emision: "2026-01-01", vencimiento: "2027-02-01", creadoPor: "Admin", grupo: "Flota Norte", vehiculo: "ABC-123" },
  { id: "20005", tab: "vehiculos", tipo: "Operación", documento: "Permiso de circulación", emision: "2025-06-03", vencimiento: "2026-06-03", creadoPor: "Logística", grupo: "Flota Sur", vehiculo: "JKL-012" },
  { id: "20006", tab: "vehiculos", tipo: "Operación", documento: "Inspección técnica", emision: "2024-03-15", vencimiento: "2025-03-15", creadoPor: "Admin", grupo: "Flota Norte", vehiculo: "MNO-345" },
  { id: "20011", tab: "personal", tipo: "Conductor", documento: "Licencia de conducir A2B", emision: "2024-04-15", vencimiento: "2027-04-15", creadoPor: "RRHH", grupo: "Conductores", vehiculo: "—" },
  { id: "20012", tab: "personal", tipo: "Conductor", documento: "Examen médico", emision: "2025-03-01", vencimiento: "2026-03-01", creadoPor: "RRHH", grupo: "Conductores", vehiculo: "—" },
  { id: "20013", tab: "personal", tipo: "Conductor", documento: "Licencia de conducir", emision: "2024-03-15", vencimiento: "2026-03-15", creadoPor: "RRHH", grupo: "Conductores", vehiculo: "—" },
  { id: "20014", tab: "personal", tipo: "Capacitación", documento: "Certificado MERCOSUR", emision: "2025-01-10", vencimiento: "2027-01-10", creadoPor: "RRHH", grupo: "Conductores", vehiculo: "—" },
  { id: "20015", tab: "personal", tipo: "Capacitación", documento: "Manejo defensivo", emision: "2025-06-01", vencimiento: "2026-07-01", creadoPor: "RRHH", grupo: "Conductores", vehiculo: "—" },
  { id: "20021", tab: "combustibles", tipo: "Administración", documento: "Seguro Vehicular", emision: "2026-01-01", vencimiento: "2027-02-01", creadoPor: "Admin", grupo: "Flota Norte", vehiculo: "ABC-123" },
  { id: "20022", tab: "combustibles", tipo: "Operación", documento: "Revisión Técnica", emision: "2025-06-10", vencimiento: "2026-06-10", creadoPor: "Admin", grupo: "Flota Norte", vehiculo: "GHI-789" },
  { id: "20023", tab: "combustibles", tipo: "Administración", documento: "SOAT", emision: "2025-04-28", vencimiento: "2026-04-28", creadoPor: "Admin", grupo: "Flota Sur", vehiculo: "DEF-456" },
  { id: "20024", tab: "combustibles", tipo: "Conductor", documento: "Licencia de conducir", emision: "2024-03-15", vencimiento: "2026-03-15", creadoPor: "RRHH", grupo: "Conductores", vehiculo: "—" },
  { id: "20025", tab: "combustibles", tipo: "Operación", documento: "Permiso de circulación", emision: "2025-06-03", vencimiento: "2026-06-03", creadoPor: "Logística", grupo: "Flota Sur", vehiculo: "JKL-012" },
  { id: "20031", tab: "infracciones", tipo: "Multa", documento: "Papeleta SAT", emision: "2025-05-12", vencimiento: "2026-06-12", creadoPor: "Admin", grupo: "Flota Norte", vehiculo: "ABC-123" },
  { id: "20032", tab: "infracciones", tipo: "Multa", documento: "Acta de infracción", emision: "2025-06-01", vencimiento: "2026-07-01", creadoPor: "Admin", grupo: "Flota Sur", vehiculo: "DEF-456" },
  { id: "20033", tab: "infracciones", tipo: "Apelación", documento: "Recurso de reconsideración", emision: "2024-12-10", vencimiento: "2025-12-10", creadoPor: "Legal", grupo: "Flota Norte", vehiculo: "GHI-789" },
  { id: "20041", tab: "otro", tipo: "General", documento: "Contrato con cliente", emision: "2025-01-15", vencimiento: "2027-01-15", creadoPor: "Admin", grupo: "Administrativo", vehiculo: "—" },
  { id: "20042", tab: "otro", tipo: "General", documento: "Acuerdo de confidencialidad", emision: "2024-08-20", vencimiento: "2026-08-20", creadoPor: "Legal", grupo: "Administrativo", vehiculo: "—" },
];

const TABS = [
  { key: "vehiculos", label: "Vehículos" },
  { key: "personal", label: "Personal" },
  { key: "combustibles", label: "Combustibles" },
  { key: "infracciones", label: "Infracciones" },
  { key: "otro", label: "Otro" },
];

const DAY_MS = 24 * 60 * 60 * 1000;

function getStatus(vencimiento) {
  const today = new Date(); today.setHours(0,0,0,0);
  const venc = new Date(vencimiento + "T00:00:00");
  const diffDays = Math.floor((venc - today) / DAY_MS);
  if (diffDays < 0) return { state: "vencido", days: diffDays };
  if (diffDays <= 19) return { state: "proximo", days: diffDays };
  return { state: "vigente", days: diffDays };
}

function formatAtraso(days) {
  if (days >= 0) return "—";
  const abs = Math.abs(days);
  if (abs < 30) return `${abs} día${abs !== 1 ? "s" : ""}`;
  const months = Math.floor(abs / 30);
  return `${months} mes${months !== 1 ? "es" : ""}`;
}

function formatDate(iso) {
  if (!iso) return "—";
  const d = new Date(iso + "T00:00:00");
  return `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}/${String(d.getFullYear()).slice(2)}`;
}

function KpiCard({ icon: Icon, value, label, iconBg, iconColor, valueColor }) {
  return (
    <div className="bg-white border border-neutral-200 rounded-2xl p-5 flex items-center gap-4 hover:shadow-md transition-shadow">
      <div className={`w-14 h-14 rounded-2xl ${iconBg} flex items-center justify-center flex-shrink-0`}>
        <Icon className={`w-7 h-7 ${iconColor}`} strokeWidth={2} />
      </div>
      <div className="flex-1 min-w-0">
        <div className={`font-cabinet font-black text-4xl leading-none ${valueColor || "text-neutral-900"}`}>{value}</div>
        <div className="text-xs font-semibold text-neutral-500 mt-1.5 uppercase tracking-wide">{label}</div>
      </div>
    </div>
  );
}

function FilterDropdown({ icon: Icon, label }) {
  return (
    <button className="h-10 px-3 bg-white border border-neutral-200 rounded-xl flex items-center gap-2 text-xs font-semibold text-neutral-600 hover:border-brand hover:text-brand transition-colors min-w-[140px]">
      <Icon className="w-3.5 h-3.5" strokeWidth={2.2} />
      <span className="flex-1 text-left">{label}</span>
      <ChevronDown className="w-3.5 h-3.5" strokeWidth={2.2} />
    </button>
  );
}

function StatusBadge({ state }) {
  const styles = {
    vigente: "bg-emerald-50 text-emerald-700 border-emerald-200",
    proximo: "bg-amber-50 text-amber-700 border-amber-200",
    vencido: "bg-rose-50 text-rose-700 border-rose-200",
  };
  const labels = { vigente: "Vigente", proximo: "Próximo", vencido: "Vencido" };
  const dotColor = { vigente: "bg-emerald-500", proximo: "bg-amber-500", vencido: "bg-rose-500" };
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-[11px] font-bold ${styles[state]}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${dotColor[state]}`} />
      {labels[state]}
    </span>
  );
}

export default function Documentacion() {
  const [activeTab, setActiveTab] = useState("vehiculos");
  const docsInTab = useMemo(() => MOCK_DOCS.filter(d => d.tab === activeTab), [activeTab]);
  const stats = useMemo(() => {
    let documentos = docsInTab.length;
    let vigentes = 0, proximos = 0, vencidos = 0;
    docsInTab.forEach(d => {
      const s = getStatus(d.vencimiento).state;
      if (s === "vigente") vigentes++;
      else if (s === "proximo") proximos++;
      else vencidos++;
    });
    return { documentos, vigentes, proximos, vencidos };
  }, [docsInTab]);

  return (
    <div className="p-6 max-w-[1500px] mx-auto" data-testid="page-documentacion">
      <div className="flex items-center gap-1 border-b border-neutral-200 mb-6 overflow-x-auto">
        {TABS.map(t => (
          <button key={t.key} onClick={() => setActiveTab(t.key)} data-testid={`tab-${t.key}`}
            className={`px-4 py-3 text-sm font-bold transition-all border-b-2 whitespace-nowrap ${
              activeTab === t.key ? "text-brand border-brand" : "text-neutral-500 border-transparent hover:text-neutral-700"
            }`}>
            {t.label}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <KpiCard icon={FileText} value={stats.documentos} label="Documentos" iconBg="bg-brand-50" iconColor="text-brand" />
        <KpiCard icon={CheckCircle2} value={stats.vigentes} label="Vigentes" iconBg="bg-emerald-50" iconColor="text-emerald-600" valueColor="text-emerald-600" />
        <KpiCard icon={Clock} value={stats.proximos} label="Próximos" iconBg="bg-amber-50" iconColor="text-amber-600" valueColor="text-amber-600" />
        <KpiCard icon={AlertTriangle} value={stats.vencidos} label="Vencidos" iconBg="bg-rose-50" iconColor="text-rose-600" valueColor="text-rose-600" />
      </div>

      <div className="flex flex-wrap items-center gap-2 mb-5">
        <FilterDropdown icon={Calendar} label="Fecha de creación" />
        <FilterDropdown icon={Users} label="Grupos" />
        <FilterDropdown icon={Truck} label="Vehículos" />
        <FilterDropdown icon={Tag} label="Tipo" />
        <FilterDropdown icon={User} label="Creado por" />
        <FilterDropdown icon={Activity} label="Estado" />
        <div className="ml-auto flex items-center gap-2">
          <button className="h-10 px-4 bg-white border border-neutral-200 rounded-xl flex items-center gap-2 text-xs font-bold text-neutral-700 hover:border-brand hover:text-brand transition-colors" data-testid="btn-agregar-doc">
            <Plus className="w-4 h-4" strokeWidth={2.5} />
            Agregar documento
            <ChevronDown className="w-3.5 h-3.5" strokeWidth={2.2} />
          </button>
          <button className="h-10 px-4 bg-brand text-white rounded-xl flex items-center gap-2 text-xs font-bold hover:bg-brand-hover transition-colors shadow-sm" data-testid="btn-nueva-plantilla">
            <FilePlus className="w-4 h-4" strokeWidth={2.5} />
            Nueva plantilla
          </button>
        </div>
      </div>

      <div className="bg-white border border-neutral-200 rounded-2xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-neutral-900">
              <tr>
                {["N° DOC", "TIPO", "DOCUMENTO", "EMISIÓN", "VENCIMIENTO", "ATRASO", "ESTADO", "DESCARGAR"].map(h => (
                  <th key={h} className="text-left px-5 py-4 text-[11px] font-black text-white uppercase tracking-wider whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-100">
              {docsInTab.length === 0 && (
                <tr><td colSpan={8} className="px-5 py-10 text-center text-sm text-neutral-400">No hay documentos en esta categoría.</td></tr>
              )}
              {docsInTab.map(d => {
                const s = getStatus(d.vencimiento);
                return (
                  <tr key={d.id} className="hover:bg-neutral-50 transition-colors">
                    <td className="px-5 py-4 text-sm font-bold text-neutral-900 whitespace-nowrap">{d.id}</td>
                    <td className="px-5 py-4 text-sm text-neutral-600 whitespace-nowrap">{d.tipo}</td>
                    <td className="px-5 py-4 text-sm font-semibold text-neutral-800">{d.documento}</td>
                    <td className="px-5 py-4 text-sm text-neutral-600 whitespace-nowrap">{formatDate(d.emision)}</td>
                    <td className="px-5 py-4 text-sm text-neutral-600 whitespace-nowrap">{formatDate(d.vencimiento)}</td>
                    <td className={`px-5 py-4 text-sm font-bold whitespace-nowrap ${s.state === "vencido" ? "text-rose-600" : "text-neutral-400"}`}>
                      {formatAtraso(s.days)}
                    </td>
                    <td className="px-5 py-4"><StatusBadge state={s.state} /></td>
                    <td className="px-5 py-4">
                      <button className="w-9 h-9 rounded-lg bg-brand-50 hover:bg-brand-100 flex items-center justify-center transition-colors" title="Descargar PDF">
                        <Download className="w-4 h-4 text-brand" strokeWidth={2.5} />
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
