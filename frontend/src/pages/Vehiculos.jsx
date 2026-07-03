import React, { useEffect, useMemo, useState } from "react";
import { useAuth } from "../context/AuthContext";
import ModuloBloqueado from "./ModuloBloqueado";
import { api } from "../lib/api";
import {
  Car, AlertTriangle, Plus, Search, Pencil, Trash2, X,
  FileSpreadsheet, FileDown, Eye, Check, ChevronDown, ChevronUp,
  Cpu, MapPin, Cog, Warehouse, FileText, UserCheck, Fuel,
  Compass, Link2, Wifi, WifiOff, Unlink, Info
} from "lucide-react";
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from "recharts";
import * as XLSX from "xlsx";
import jsPDF from "jspdf";

// ---------- helpers ----------
const fmtS = (n) => `S/ ${Number(n || 0).toLocaleString("es-PE", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const fmtDate = (d) => (d ? new Date(d).toLocaleDateString("es-PE") : "");
const cls = (...a) => a.filter(Boolean).join(" ");

function Kpi({ label, value, sub, tone = "brand", icon: Icon = Car }) {
  const toneCls = {
    brand: "bg-brand-50 text-brand",
    amber: "bg-amber-50 text-amber-600",
    emerald: "bg-emerald-50 text-emerald-600",
    blue: "bg-blue-50 text-blue-600",
    rose: "bg-rose-50 text-rose-600",
    teal: "bg-teal-50 text-teal-600",
  }[tone];
  return (
    <div className="bg-white border border-neutral-200 rounded-2xl p-5 hover:shadow-md transition-all duration-200">
      <div className="flex items-center gap-3">
        <div className={cls("w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0", toneCls)}>
          <Icon className="w-5 h-5" strokeWidth={2.5} />
        </div>
        <div>
          <p className="text-xs text-neutral-500 uppercase tracking-wide font-bold">{label}</p>
          <p className="font-cabinet font-black text-2xl text-neutral-900 leading-tight">{value}</p>
        </div>
      </div>
      {sub && <p className="text-xs text-neutral-400 mt-2 font-medium">{sub}</p>}
    </div>
  );
}

function Modal({ open, onClose, title, children, width = "max-w-lg" }) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div className={cls("bg-white rounded-2xl shadow-xl w-full", width)} onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between p-5 border-b border-neutral-200">
          <h3 className="font-cabinet font-black text-xl text-neutral-900">{title}</h3>
          <button onClick={onClose} className="text-neutral-500 hover:text-neutral-900 transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="p-5">{children}</div>
      </div>
    </div>
  );
}

function Field({ label, children, required }) {
  return (
    <label className="block">
      <span className="text-xs font-bold text-neutral-700 uppercase tracking-wide">
        {label} {required && <span className="text-rose-500">*</span>}
      </span>
      <div className="mt-1">{children}</div>
    </label>
  );
}

const inputCls = "w-full px-3 py-2 border border-neutral-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand/30 focus:border-brand";

export default function Vehiculos() {
  const { user } = useAuth();
  const isAdmin = user?.role === "admin_enered" || user?.role === "administrador" || user?.role === "logistica";

  const [tab, setTab] = useState("vehiculos");
  const [catTab, setCatTab] = useState("Marcas");

  // API states
  const [vehiculos, setVehiculos] = useState([]);
  const [conductores, setConductores] = useState([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [errMsg, setErrMsg] = useState("");

  // UI state
  const [q, setQ] = useState("");
  const [showFilters, setShowFilters] = useState(false);
  const [expandedRow, setExpandedRow] = useState(null);
  const [selectedPlacas, setSelectedPlacas] = useState({});

  // Filter fields
  const [filterMarca, setFilterMarca] = useState("");
  const [filterEstado, setFilterEstado] = useState("");
  const [filterUnidad, setFilterUnidad] = useState("");
  const [filterChasis, setFilterChasis] = useState("");
  const [filterTipo, setFilterTipo] = useState("");
  const [filterBase, setFilterBase] = useState("");
  const [filterTitular, setFilterTitular] = useState("");
  const [filterCC, setFilterCC] = useState("");
  const [filterMedidorMin, setFilterMedidorMin] = useState("");
  const [filterMedidorMax, setFilterMedidorMax] = useState("");
  const [filterVerInactivos, setFilterVerInactivos] = useState(false);

  // Modals state
  const [modal, setModal] = useState(null); // { type: 'create' | 'edit', editing?: obj }
  const [form, setForm] = useState({});

  // Mock static data
  const [costoComp] = useState([
    { name: "Correctivo", value: 78.1, color: "#8039F4" },
    { name: "Infracciones", value: 10.8, color: "#EF4444" },
    { name: "Aditivo", value: 5.8, color: "#A78BFA" },
    { name: "Preventivo", value: 3.2, color: "#3B82F6" },
    { name: "Combustibles", value: 1.3, color: "#F59E0B" },
    { name: "Hospedaje", value: 0.6, color: "#10B981" },
    { name: "Vencimiento", value: 0.3, color: "#EC4899" },
  ]);

  const [marcas, setMarcas] = useState([
    { marca: "Chevrolet", n: 128, estado: "Activo" },
    { marca: "Ford", n: 96, estado: "Activo" },
    { marca: "Mercedes-Benz", n: 42, estado: "Activo" },
    { marca: "Kenworth", n: 30, estado: "Activo" },
    { marca: "Volvo", n: 24, estado: "Activo" },
    { marca: "International", n: 18, estado: "Activo" }
  ]);

  const [modelos, setModelos] = useState([
    { modelo: "Corsa", marca: "Chevrolet", tipo: "Sedán", n: 64 },
    { modelo: "F-150 XL 4x4", marca: "Ford", tipo: "Pick Up", n: 40 },
    { modelo: "T800", marca: "Kenworth", tipo: "Tractomula", n: 30 },
    { modelo: "Sprinter", marca: "Mercedes-Benz", tipo: "Furgón", n: 22 },
    { modelo: "FH", marca: "Volvo", tipo: "Tractomula", n: 18 }
  ]);

  const [tiposVeh, setTiposVeh] = useState([
    { tipo: "Sedán", configuracion: "2 ejes · 4 neumáticos", n: 210 },
    { tipo: "Pick Up", configuracion: "2 ejes · 4 neumáticos", n: 88 },
    { tipo: "Tractomula", configuracion: "3 ejes · 10 neumáticos", n: 60 },
    { tipo: "Furgón", configuracion: "2 ejes · 6 neumáticos", n: 34 },
    { tipo: "Autobús", configuracion: "2 ejes · 6 neumáticos", n: 20 }
  ]);

  const [dispositivos, setDispositivos] = useState([
    { imei: "356938035201801", modelo: "Teltonika FMC150", sim: "900 123 456 · Claro", estado: "Reportando", asignado: "chevrolet 16 · T-151116", fecha: "hace 2 min" },
    { imei: "356938035201802", modelo: "Teltonika FMC150", sim: "900 123 457 · Movistar", estado: "Reportando", asignado: "567 · BB265GT", fecha: "hace 5 min" },
    { imei: "356938035201803", modelo: "Teltonika FMB920", sim: "900 123 458 · Claro", estado: "No reporta", asignado: "123_1 · AE456OK", fecha: "hace 3 días" },
    { imei: "356938035201804", modelo: "Queclink GV75", sim: "900 123 459 · Entel", estado: "Reportando", asignado: "504 · AA265GQ", fecha: "hace 1 min" },
    { imei: "356938035201805", modelo: "Teltonika FMC150", sim: "— sin SIM", estado: "Sin asignar", asignado: "—", fecha: "—" },
  ]);

  const [dispKpis] = useState([
    { label: "Dispositivos", value: "199", tone: "brand", icon: Cpu },
    { label: "Reportando", value: "191", tone: "emerald", icon: Wifi },
    { label: "No reportan", value: "5", tone: "rose", icon: WifiOff },
    { label: "Sin asignar", value: "3", tone: "amber", icon: Unlink }
  ]);

  async function loadAll() {
    setLoading(true);
    try {
      const [v, c] = await Promise.all([
        api.get("/vehiculos"),
        api.get("/conductores").catch(() => ({ data: [] }))
      ]);
      setVehiculos(v.data || []);
      setConductores(c.data || []);
    } catch (e) {
      console.error("Error al cargar datos de vehículos", e);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadAll();
  }, []);

  // Filtering vehicles
  const vehFiltrados = useMemo(() => {
    const query = q.trim().toLowerCase();
    return vehiculos.filter((v) => {
      // General search query
      if (query) {
        const text = `${v.placa || ""} ${v.marca || ""} ${v.modelo || ""} ${v.empresa || ""}`.toLowerCase();
        if (!text.includes(query)) return false;
      }
      // Specific filters
      if (filterMarca && (v.marca || "").toLowerCase() !== filterMarca.toLowerCase()) return false;
      if (filterEstado) {
        const est = (v.estado || "OPERATIVO").toLowerCase();
        if (est !== filterEstado.toLowerCase()) return false;
      }
      if (filterUnidad && !(v.unidad || "").toLowerCase().includes(filterUnidad.toLowerCase())) return false;
      if (filterChasis && !(v.chasis || "").toLowerCase().includes(filterChasis.toLowerCase())) return false;
      if (filterTipo && !(v.tipo || "").toLowerCase().includes(filterTipo.toLowerCase())) return false;
      if (filterBase && !(v.base || "").toLowerCase().includes(filterBase.toLowerCase())) return false;
      if (filterTitular && !(v.titular || "").toLowerCase().includes(filterTitular.toLowerCase())) return false;
      if (filterCC && !(v.cc || "").toLowerCase().includes(filterCC.toLowerCase())) return false;
      if (filterMedidorMin && Number(v.medidor || 0) < Number(filterMedidorMin)) return false;
      if (filterMedidorMax && Number(v.medidor || 0) > Number(filterMedidorMax)) return false;
      if (!filterVerInactivos && (v.estado || "OPERATIVO").toLowerCase() === "inactivo") return false;

      return true;
    });
  }, [
    vehiculos, q, filterMarca, filterEstado, filterUnidad, filterChasis,
    filterTipo, filterBase, filterTitular, filterCC, filterMedidorMin,
    filterMedidorMax, filterVerInactivos
  ]);

  // Exports
  function exportExcel() {
    let rows = [];
    if (tab === "vehiculos") {
      rows = vehFiltrados.map((v) => ({
        Placa: v.placa,
        Marca: v.marca || "",
        Modelo: v.modelo || "",
        Año: v.año || "",
        Estado: v.estado || "OPERATIVO",
        Empresa: v.empresa || "",
        Unidad: v.unidad || "",
        Chasis: v.chasis || "",
        Tipo: v.tipo || "",
        Base: v.base || "",
        Titular: v.titular || "",
        "Centro de Costos": v.cc || "",
        Medidor: v.medidor || 0
      }));
    } else if (tab === "catalogos") {
      rows = catTab === "Marcas" ? marcas : catTab === "Modelos" ? modelos : tiposVeh;
    } else {
      rows = dispositivos.map(d => ({
        IMEI: d.imei, Modelo: d.modelo, SIM: d.sim, Estado: d.estado, Asignado: d.asignado, "Última comunicación": d.fecha
      }));
    }

    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, tab);
    XLSX.writeFile(wb, `reporte_${tab}_${new Date().toISOString().slice(0, 10)}.xlsx`);
  }

  function exportPDF() {
    const doc = new jsPDF({ orientation: "landscape" });
    doc.setFontSize(16);
    doc.text(`ENERED — Administración de Vehículos`, 14, 16);
    doc.setFontSize(9);
    doc.text(new Date().toLocaleString("es-PE"), 14, 22);

    let y = 32;
    const line = (cols, bold) => {
      if (bold) doc.setFont(undefined, "bold");
      else doc.setFont(undefined, "normal");
      cols.forEach((c, idx) => doc.text(String(c ?? ""), 14 + idx * 38, y));
      y += 6;
      if (y > 195) { doc.addPage(); y = 16; }
    };

    if (tab === "vehiculos") {
      line(["Placa", "Marca", "Modelo", "Año", "Estado", "Empresa"], true);
      vehFiltrados.forEach((v) => line([v.placa, v.marca || "", v.modelo || "", v.año || "", v.estado || "OPERATIVO", v.empresa || ""]));
    } else if (tab === "catalogos") {
      if (catTab === "Marcas") {
        line(["Marca", "Vehículos", "Estado"], true);
        marcas.forEach(m => line([m.marca, m.n, m.estado]));
      } else if (catTab === "Modelos") {
        line(["Modelo", "Marca", "Tipo", "Vehículos"], true);
        modelos.forEach(m => line([m.modelo, m.marca, m.tipo, m.n]));
      } else {
        line(["Tipo", "Configuración", "Vehículos"], true);
        tiposVeh.forEach(t => line([t.tipo, t.configuracion, t.n]));
      }
    } else {
      line(["IMEI", "Modelo", "SIM / Operador", "Estado", "Asignado"], true);
      dispositivos.forEach(d => line([d.imei, d.modelo, d.sim.split("·")[0], d.estado, d.asignado.split("·")[0]]));
    }
    doc.save(`reporte_${tab}_${new Date().toISOString().slice(0, 10)}.pdf`);
  }

  // Modals operations
  function openCreate() {
    setErrMsg("");
    setForm({ estado: "OPERATIVO" });
    setModal({ type: "create" });
  }

  function openEdit(obj) {
    setErrMsg("");
    setForm({ ...obj });
    setModal({ type: "edit", editing: obj });
  }

  async function handleSave(e) {
    e.preventDefault();
    setSaving(true);
    setErrMsg("");
    try {
      const isEdit = modal.type === "edit";
      const id = modal.editing?.id;
      const body = { ...form };
      if (body.año) body.año = parseInt(body.año, 10);
      if (body.medidor) body.medidor = parseFloat(body.medidor);

      if (isEdit) {
        await api.put(`/vehiculos/${id}`, body);
      } else {
        await api.post("/vehiculos", body);
      }
      setModal(null);
      setForm({});
      await loadAll();
    } catch (e2) {
      setErrMsg(e2?.response?.data?.detail || "Error al guardar el vehículo");
    } finally {
      setSaving(false);
    }
  }

  async function handleRemove(id) {
    if (!window.confirm("¿Estás seguro de que deseas eliminar este vehículo?")) return;
    try {
      await api.delete(`/vehiculos/${id}`);
      await loadAll();
    } catch (e) {
      alert(e?.response?.data?.detail || "Error al eliminar el vehículo");
    }
  }

  // Selection toggles
  function toggleSelectAll() {
    if (Object.keys(selectedPlacas).length === vehFiltrados.length) {
      setSelectedPlacas({});
    } else {
      const nSel = {};
      vehFiltrados.forEach((v) => { nSel[v.placa] = true; });
      setSelectedPlacas(nSel);
    }
  }

  function toggleSelect(placa) {
    setSelectedPlacas((prev) => {
      const copy = { ...prev };
      if (copy[placa]) delete copy[placa];
      else copy[placa] = true;
      return copy;
    });
  }

  // Clear filters
  function clearFilters() {
    setFilterMarca("");
    setFilterEstado("");
    setFilterUnidad("");
    setFilterChasis("");
    setFilterTipo("");
    setFilterBase("");
    setFilterTitular("");
    setFilterCC("");
    setFilterMedidorMin("");
    setFilterMedidorMax("");
    setFilterVerInactivos(false);
    setQ("");
  }

  return (
    <div className="p-4 md:p-6 max-w-7xl mx-auto space-y-6" data-testid="page-vehiculos">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="font-cabinet font-black text-3xl text-neutral-900 flex items-center gap-2.5">
            <Car className="w-8 h-8 text-brand" /> Vehículos
          </h1>
          <p className="text-neutral-500 text-sm mt-1">
            Administración completa de unidades, configuraciones de flotas y dispositivos GPS en tiempo real.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={exportExcel} className="inline-flex items-center gap-2 px-3 py-2 bg-white border border-neutral-200 rounded-lg text-sm font-bold text-neutral-700 hover:bg-neutral-50 shadow-sm transition-colors">
            <FileSpreadsheet className="w-4 h-4 text-emerald-600" /> Excel
          </button>
          <button onClick={exportPDF} className="inline-flex items-center gap-2 px-3 py-2 bg-white border border-neutral-200 rounded-lg text-sm font-bold text-neutral-700 hover:bg-neutral-50 shadow-sm transition-colors">
            <FileDown className="w-4 h-4 text-rose-600" /> PDF
          </button>
          {isAdmin && (
            <button onClick={openCreate} className="inline-flex items-center gap-2 px-4 py-2 bg-brand text-white rounded-lg text-sm font-bold hover:bg-brand-hover shadow-sm transition-all">
              <Plus className="w-4 h-4" /> Agregar Unidad
            </button>
          )}
        </div>
      </div>

      {/* Main Tabs */}
      <div className="flex border-b border-neutral-200 gap-6">
        {[
          { id: "vehiculos", label: "Vehículos", icon: Car },
          { id: "catalogos", label: "Catálogos", icon: Compass },
          { id: "dispositivos", label: "Dispositivos GPS", icon: Cpu }
        ].map((t) => {
          const Icon = t.icon;
          const isActive = tab === t.id;
          return (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={cls(
                "pb-3 text-sm font-bold flex items-center gap-2 border-b-2 transition-all",
                isActive ? "border-brand text-brand font-black" : "border-transparent text-neutral-500 hover:text-neutral-900"
              )}
            >
              <Icon className="w-4 h-4" />
              {t.label}
            </button>
          );
        })}
      </div>

      {/* Content for VEHICULOS */}
      {tab === "vehiculos" && (
        <div className="space-y-4">
          {/* KPIs */}
          <div className="grid grid-cols-2 lg:grid-cols-6 gap-3">
            <Kpi label="GPS Activos" value={vehiculos.filter(v => v.gps !== false).length} tone="teal" icon={MapPin} sub={`${vehiculos.filter(v => v.gps === false).length} sin reportar`} />
            <Kpi label="En Taller" value="40" tone="rose" icon={Warehouse} />
            <Kpi label="Docs Vencidos" value="107" tone="rose" icon={FileText} />
            <Kpi label="Docs Chofer Venc." value="39" tone="rose" icon={UserCheck} />
            <Kpi label="Infracciones" value="33" tone="rose" icon={AlertTriangle} />
            <Kpi label="Cargas Inválidas" value="2" tone="rose" icon={Fuel} />
          </div>

          {/* Filter Trigger / Quick Search Bar */}
          <div className="bg-white border border-neutral-200 rounded-2xl p-4 shadow-sm flex flex-col md:flex-row items-center justify-between gap-4">
            <div className="relative w-full max-w-md">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400" />
              <input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Buscar por placa, marca, modelo, empresa..."
                className={cls(inputCls, "pl-9")}
              />
            </div>
            <div className="flex gap-2 w-full md:w-auto justify-end">
              <button
                onClick={() => setShowFilters(!showFilters)}
                className={cls(
                  "px-4 py-2 border rounded-lg text-sm font-bold shadow-sm transition-all flex items-center gap-2",
                  showFilters ? "bg-brand text-white border-brand" : "bg-white text-neutral-700 border-neutral-200 hover:bg-neutral-50"
                )}
              >
                <Cog className="w-4 h-4" /> Filtros Avanzados {showFilters ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
              </button>
            </div>
          </div>

          {/* Collapsible Filters Panel */}
          {showFilters && (
            <div className="bg-white border border-neutral-200 rounded-2xl p-5 shadow-sm space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
                <Field label="Marca">
                  <input value={filterMarca} onChange={e => setFilterMarca(e.target.value)} className={inputCls} placeholder="Ej: Chevrolet" />
                </Field>
                <Field label="Estado">
                  <select value={filterEstado} onChange={e => setFilterEstado(e.target.value)} className={inputCls}>
                    <option value="">Todos</option>
                    <option value="OPERATIVO">OPERATIVO</option>
                    <option value="OEM">OEM</option>
                    <option value="TALLER">TALLER</option>
                    <option value="INACTIVO">INACTIVO</option>
                  </select>
                </Field>
                <Field label="Código Unidad">
                  <input value={filterUnidad} onChange={e => setFilterUnidad(e.target.value)} className={inputCls} placeholder="Ej: 567" />
                </Field>
                <Field label="Chasis / VIN">
                  <input value={filterChasis} onChange={e => setFilterChasis(e.target.value)} className={inputCls} placeholder="Ingrese Chasis" />
                </Field>
                <Field label="Tipo Carrocería">
                  <input value={filterTipo} onChange={e => setFilterTipo(e.target.value)} className={inputCls} placeholder="Ej: Sedán, Pick Up" />
                </Field>
                <Field label="Base Operativa">
                  <input value={filterBase} onChange={e => setFilterBase(e.target.value)} className={inputCls} placeholder="Ej: Central" />
                </Field>
                <Field label="Titular / Propietario">
                  <input value={filterTitular} onChange={e => setFilterTitular(e.target.value)} className={inputCls} placeholder="Ej: APYMSA" />
                </Field>
                <Field label="Centro de Costos">
                  <input value={filterCC} onChange={e => setFilterCC(e.target.value)} className={inputCls} placeholder="Ej: Sede Norte" />
                </Field>
                <div className="sm:col-span-2">
                  <span className="text-xs font-bold text-neutral-700 uppercase tracking-wide">Rango Medidor (Kms)</span>
                  <div className="grid grid-cols-2 gap-2 mt-1">
                    <input type="number" placeholder="Min Kms" value={filterMedidorMin} onChange={e => setFilterMedidorMin(e.target.value)} className={inputCls} />
                    <input type="number" placeholder="Max Kms" value={filterMedidorMax} onChange={e => setFilterMedidorMax(e.target.value)} className={inputCls} />
                  </div>
                </div>
                <div className="flex items-center gap-4 sm:col-span-2 mt-5">
                  <label className="flex items-center gap-2 cursor-pointer select-none">
                    <input type="checkbox" checked={filterVerInactivos} onChange={e => setFilterVerInactivos(e.target.checked)} className="rounded text-brand border-neutral-300 w-4 h-4 focus:ring-brand" />
                    <span className="text-sm font-semibold text-neutral-700">Ver unidades inactivas</span>
                  </label>
                </div>
              </div>
              <div className="flex justify-between items-center border-t border-neutral-100 pt-4 mt-2">
                <button onClick={clearFilters} className="text-sm font-bold text-neutral-500 hover:text-neutral-900 transition-colors">
                  Limpiar todos los filtros
                </button>
                <button onClick={() => setShowFilters(false)} className="px-5 py-2 bg-neutral-900 hover:bg-neutral-800 text-white rounded-lg text-sm font-bold shadow-sm transition-all">
                  Aplicar filtros
                </button>
              </div>
            </div>
          )}

          {/* Table Container */}
          <div className="bg-white border border-neutral-200 rounded-3xl overflow-hidden shadow-sm">
            {loading ? (
              <div className="p-16 text-center text-neutral-500">Cargando unidades...</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-neutral-900 text-white text-xs uppercase tracking-wider font-bold">
                    <tr>
                      <th className="px-4 py-3.5 text-left w-12">
                        <input
                          type="checkbox"
                          checked={vehFiltrados.length > 0 && Object.keys(selectedPlacas).length === vehFiltrados.length}
                          onChange={toggleSelectAll}
                          className="rounded text-brand border-neutral-300 focus:ring-brand w-4 h-4"
                        />
                      </th>
                      <th className="px-4 py-3.5 text-left">Marca</th>
                      <th className="px-4 py-3.5 text-left">Estado</th>
                      <th className="px-4 py-3.5 text-left">Unidad</th>
                      <th className="px-4 py-3.5 text-left">Placa</th>
                      <th className="px-4 py-3.5 text-left">Modelo</th>
                      <th className="px-4 py-3.5 text-left">Año</th>
                      <th className="px-4 py-3.5 text-left">Empresa</th>
                      <th className="px-4 py-3.5 text-left">Medidor</th>
                      <th className="px-4 py-3.5 text-right">Acciones</th>
                    </tr>
                  </thead>
                  <tbody>
                    {vehFiltrados.length === 0 ? (
                      <tr>
                        <td colSpan="10" className="p-12 text-center text-neutral-400 font-medium">
                          Sin unidades registradas que coincidan con la búsqueda.
                        </td>
                      </tr>
                    ) : (
                      vehFiltrados.map((v) => {
                        const isExpanded = expandedRow === v.id;
                        const isSelected = !!selectedPlacas[v.placa];
                        const statusColors = {
                          operativo: "bg-emerald-100 text-emerald-700 border-emerald-200",
                          oem: "bg-teal-100 text-teal-700 border-teal-200",
                          taller: "bg-rose-100 text-rose-700 border-rose-200",
                          inactivo: "bg-neutral-100 text-neutral-600 border-neutral-200",
                        }[String(v.estado || "OPERATIVO").toLowerCase()] || "bg-neutral-100 text-neutral-600 border-neutral-200";

                        return (
                          <React.Fragment key={v.id}>
                            <tr className={cls("border-t border-neutral-100 transition-colors", isExpanded ? "bg-neutral-50/70" : "hover:bg-neutral-50/40")}>
                              <td className="px-4 py-3">
                                <input
                                  type="checkbox"
                                  checked={isSelected}
                                  onChange={() => toggleSelect(v.placa)}
                                  className="rounded text-brand border-neutral-300 focus:ring-brand w-4 h-4"
                                />
                              </td>
                              <td className="px-4 py-3 font-semibold text-neutral-800">
                                <div className="flex items-center gap-2">
                                  <button
                                    onClick={() => setExpandedRow(isExpanded ? null : v.id)}
                                    className="p-1 text-neutral-400 hover:text-brand transition-colors"
                                    title="Ver Detalles de Costos"
                                  >
                                    <ChevronDown className={cls("w-4 h-4 transform transition-transform", isExpanded && "rotate-180")} />
                                  </button>
                                  <div className="w-8 h-8 rounded-lg bg-neutral-100 flex items-center justify-center flex-shrink-0">
                                    <Car className="w-4 h-4 text-brand" />
                                  </div>
                                  <span>{v.marca || "—"}</span>
                                </div>
                              </td>
                              <td className="px-4 py-3">
                                <span className={cls("inline-flex px-2 py-0.5 rounded-full text-xs font-bold ring-1", statusColors)}>
                                  {v.estado || "OPERATIVO"}
                                </span>
                              </td>
                              <td className="px-4 py-3 font-semibold text-neutral-700">{v.unidad || "—"}</td>
                              <td className="px-4 py-3 font-bold text-neutral-900 tracking-wide font-mono uppercase">{v.placa}</td>
                              <td className="px-4 py-3 text-neutral-600 font-medium">{v.modelo || "—"}</td>
                              <td className="px-4 py-3 text-neutral-600">{v.año || "—"}</td>
                              <td className="px-4 py-3 text-xs text-neutral-500 font-medium">{v.empresa || "—"}</td>
                              <td className="px-4 py-3 text-neutral-600 font-mono text-xs">{v.medidor ? `${v.medidor.toLocaleString()} Kms` : "0 Kms"}</td>
                              <td className="px-4 py-3 text-right space-x-1.5 whitespace-nowrap">
                                {isAdmin && (
                                  <>
                                    <button onClick={() => openEdit(v)} className="p-1.5 text-neutral-400 hover:text-brand hover:bg-brand-50 rounded-lg transition-all" title="Editar">
                                      <Pencil className="w-4.5 h-4.5" />
                                    </button>
                                    <button onClick={() => handleRemove(v.id)} className="p-1.5 text-neutral-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-all" title="Eliminar">
                                      <Trash2 className="w-4.5 h-4.5" />
                                    </button>
                                  </>
                                )}
                              </td>
                            </tr>

                            {/* Row Expansion */}
                            {isExpanded && (
                              <tr>
                                <td colSpan="10" className="bg-neutral-50/50 p-0 border-t border-neutral-100">
                                  <div className="p-6 grid grid-cols-1 lg:grid-cols-2 gap-8">
                                    {/* Cost Analysis Graph */}
                                    <div>
                                      <div className="flex items-center justify-between mb-4 border-b border-neutral-200/60 pb-2">
                                        <h4 className="font-cabinet font-black text-base text-neutral-800">Costo Total del Vehículo</h4>
                                        <span className="text-xs text-neutral-400 font-bold">Histórico Completo</span>
                                      </div>
                                      <div className="flex flex-col sm:flex-row items-center gap-6">
                                        {/* Recharts PieChart */}
                                        <div className="w-36 h-36 relative flex-shrink-0">
                                          <ResponsiveContainer width="100%" height="100%">
                                            <PieChart>
                                              <Pie
                                                data={costoComp}
                                                cx="50%"
                                                cy="50%"
                                                innerRadius={40}
                                                outerRadius={56}
                                                paddingAngle={2}
                                                dataKey="value"
                                              >
                                                {costoComp.map((entry, index) => (
                                                  <Cell key={`cell-${index}`} fill={entry.color} />
                                                ))}
                                              </Pie>
                                              <Tooltip formatter={(value) => `${value}%`} />
                                            </PieChart>
                                          </ResponsiveContainer>
                                          <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                                            <span className="text-[10px] text-neutral-400 font-bold uppercase leading-none">Total</span>
                                            <span className="text-sm font-black text-neutral-800 mt-1 leading-none">S/ 190.2k</span>
                                          </div>
                                        </div>
                                        {/* Legend Grid */}
                                        <div className="grid grid-cols-2 gap-x-6 gap-y-2 flex-1 w-full">
                                          {costoComp.map((c, i) => (
                                            <div key={i} className="flex items-center justify-between text-xs border-b border-neutral-100 pb-1 w-full">
                                              <span className="flex items-center gap-2 text-neutral-500 font-medium">
                                                <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: c.color }} />
                                                {c.name}
                                              </span>
                                              <span className="font-bold text-neutral-800">{c.value}%</span>
                                            </div>
                                          ))}
                                        </div>
                                      </div>
                                    </div>

                                    {/* Stats and Controls */}
                                    <div className="border-t lg:border-t-0 lg:border-l border-neutral-200/60 pt-6 lg:pt-0 lg:pl-8 flex flex-col justify-between">
                                      <div className="grid grid-cols-3 gap-3 mb-6">
                                        <div className="bg-white border border-neutral-200 rounded-xl p-3.5 text-center">
                                          <p className="text-xl font-cabinet font-black text-neutral-800 leading-tight">S/ 0.85</p>
                                          <p className="text-[10px] text-neutral-400 uppercase tracking-wider font-bold mt-1">Costo / Km</p>
                                        </div>
                                        <div className="bg-white border border-neutral-200 rounded-xl p-3.5 text-center">
                                          <p className="text-xl font-cabinet font-black text-neutral-800 leading-tight">145 Kms</p>
                                          <p className="text-[10px] text-neutral-400 uppercase tracking-wider font-bold mt-1">Promedio Km/Día</p>
                                        </div>
                                        <div className="bg-white border border-neutral-200 rounded-xl p-3.5 text-center">
                                          <p className="text-xl font-cabinet font-black text-neutral-800 leading-tight">191,089</p>
                                          <p className="text-[10px] text-neutral-400 uppercase tracking-wider font-bold mt-1">Recorrido Total</p>
                                        </div>
                                      </div>

                                      <div className="space-y-3">
                                        <div className="text-xs font-bold text-neutral-500 uppercase tracking-wider">Controles Rápidos del Vehículo</div>
                                        <div className="flex flex-wrap gap-2.5">
                                          {[
                                            { icon: MapPin, label: "GPS Tracking", tone: "text-teal-600 hover:bg-teal-50" },
                                            { icon: Cog, label: "Ajustes", tone: "text-blue-600 hover:bg-blue-50" },
                                            { icon: Warehouse, label: "Taller / Mant.", tone: "text-rose-600 hover:bg-rose-50" },
                                            { icon: FileText, label: "Documentos", tone: "text-emerald-600 hover:bg-emerald-50" },
                                            { icon: UserCheck, label: "Asignar Conductor", tone: "text-violet-600 hover:bg-violet-50" },
                                            { icon: Fuel, label: "Historial Comb.", tone: "text-amber-600 hover:bg-amber-50" },
                                          ].map((ctrl, ci) => {
                                            const CIcon = ctrl.icon;
                                            return (
                                              <button key={ci} className={cls("flex items-center gap-1.5 px-3 py-2 border border-neutral-200 bg-white rounded-xl text-xs font-bold transition-all shadow-sm active:scale-95", ctrl.tone)}>
                                                <CIcon className="w-4 h-4" /> {ctrl.label}
                                              </button>
                                            );
                                          })}
                                        </div>
                                      </div>
                                    </div>
                                  </div>
                                </td>
                              </tr>
                            )}
                          </React.Fragment>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            )}
            <div className="p-4 bg-neutral-50 border-t border-neutral-100 flex items-center justify-between text-xs text-neutral-500 font-medium">
              <span>Fila por página: 10</span>
              <span>Mostrando {vehFiltrados.length} de {vehiculos.length} vehículos</span>
            </div>
          </div>
        </div>
      )}

      {/* Content for CATALOGOS */}
      {tab === "catalogos" && (
        <div className="space-y-4">
          <div className="flex items-center justify-between flex-wrap gap-3 mb-2">
            <div className="flex bg-neutral-100 rounded-xl p-1 w-fit border border-neutral-200">
              {["Marcas", "Modelos", "Tipos de vehículo"].map((x) => (
                <button
                  key={x}
                  onClick={() => setCatTab(x)}
                  className={cls(
                    "px-4 py-1.5 rounded-lg text-xs font-bold transition-all",
                    catTab === x ? "bg-white text-brand shadow-sm" : "text-neutral-600 hover:text-neutral-900"
                  )}
                >
                  {x}
                </button>
              ))}
            </div>
            <button className="px-4 py-2 bg-brand text-white rounded-lg text-sm font-bold hover:bg-brand-hover shadow-sm">
              <Plus className="w-4 h-4 inline mr-1" /> Agregar {catTab.slice(0, -1).toLowerCase()}
            </button>
          </div>

          <div className="bg-white/60 border border-brand/20 bg-brand-50/10 rounded-xl p-4 flex items-start gap-3">
            <Info className="w-5 h-5 text-brand mt-0.5 flex-shrink-0" />
            <p className="text-xs text-neutral-600 leading-normal">
              Estos catálogos son tablas de autocompletado y referencia: al registrar una placa con su número VIN, la marca y el modelo se autocompletarán. También puedes agregarlos al vuelo.
            </p>
          </div>

          <div className="bg-white border border-neutral-200 rounded-2xl overflow-hidden shadow-sm">
            {catTab === "Marcas" && (
              <table className="w-full text-sm">
                <thead className="bg-neutral-900 text-white text-xs uppercase font-bold">
                  <tr>
                    <th className="px-6 py-3">Marca</th>
                    <th className="px-6 py-3">N° de Vehículos</th>
                    <th className="px-6 py-3">Estado</th>
                    <th className="px-6 py-3 text-right">Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {marcas.map((m, idx) => (
                    <tr key={idx} className="border-t border-neutral-100 hover:bg-neutral-50">
                      <td className="px-6 py-3 font-semibold text-neutral-800">
                        <div className="flex items-center gap-2.5">
                          <span className="w-7 h-7 rounded-lg bg-neutral-100 flex items-center justify-center"><Car className="w-4 h-4 text-brand" /></span>
                          {m.marca}
                        </div>
                      </td>
                      <td className="px-6 py-3 text-neutral-600 font-bold">{m.n}</td>
                      <td className="px-6 py-3">
                        <span className="inline-flex px-2 py-0.5 rounded-full text-xs font-bold bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200">
                          {m.estado}
                        </span>
                      </td>
                      <td className="px-6 py-3 text-right space-x-2">
                        <button className="text-neutral-400 hover:text-brand p-1.5"><Pencil className="w-4 h-4" /></button>
                        <button className="text-neutral-400 hover:text-rose-600 p-1.5"><Trash2 className="w-4 h-4" /></button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}

            {catTab === "Modelos" && (
              <table className="w-full text-sm">
                <thead className="bg-neutral-900 text-white text-xs uppercase font-bold">
                  <tr>
                    <th className="px-6 py-3">Modelo</th>
                    <th className="px-6 py-3">Marca</th>
                    <th className="px-6 py-3">Tipo Carrocería</th>
                    <th className="px-6 py-3">Vehículos</th>
                    <th className="px-6 py-3 text-right">Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {modelos.map((m, idx) => (
                    <tr key={idx} className="border-t border-neutral-100 hover:bg-neutral-50">
                      <td className="px-6 py-3 font-semibold text-neutral-800">{m.modelo}</td>
                      <td className="px-6 py-3 text-neutral-600">{m.marca}</td>
                      <td className="px-6 py-3">
                        <span className="inline-flex px-2 py-0.5 rounded-full text-xs font-bold bg-brand-50 text-brand">
                          {m.tipo}
                        </span>
                      </td>
                      <td className="px-6 py-3 text-neutral-600 font-bold">{m.n}</td>
                      <td className="px-6 py-3 text-right space-x-2">
                        <button className="text-neutral-400 hover:text-brand p-1.5"><Pencil className="w-4 h-4" /></button>
                        <button className="text-neutral-400 hover:text-rose-600 p-1.5"><Trash2 className="w-4 h-4" /></button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}

            {catTab === "Tipos de vehículo" && (
              <table className="w-full text-sm">
                <thead className="bg-neutral-900 text-white text-xs uppercase font-bold">
                  <tr>
                    <th className="px-6 py-3">Tipo de Vehículo</th>
                    <th className="px-6 py-3">Configuración de Flota</th>
                    <th className="px-6 py-3">Vehículos</th>
                    <th className="px-6 py-3 text-right">Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {tiposVeh.map((t, idx) => (
                    <tr key={idx} className="border-t border-neutral-100 hover:bg-neutral-50">
                      <td className="px-6 py-3 font-semibold text-neutral-800">{t.tipo}</td>
                      <td className="px-6 py-3 text-neutral-500 font-medium">{t.configuracion}</td>
                      <td className="px-6 py-3 text-neutral-600 font-bold">{t.n}</td>
                      <td className="px-6 py-3 text-right space-x-2">
                        <button className="text-neutral-400 hover:text-brand p-1.5"><Pencil className="w-4 h-4" /></button>
                        <button className="text-neutral-400 hover:text-rose-600 p-1.5"><Trash2 className="w-4 h-4" /></button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      )}

      {/* Content for GPS DEVICES */}
      {tab === "dispositivos" && (
        <div className="space-y-4">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            {dispKpis.map((k, idx) => {
              const KIcon = k.icon;
              return <Kpi key={idx} label={k.label} value={k.value} tone={k.tone} icon={KIcon} />;
            })}
          </div>

          <div className="flex justify-end">
            <button className="px-4 py-2 bg-brand text-white rounded-lg text-sm font-bold hover:bg-brand-hover shadow-sm transition-colors">
              <Plus className="w-4 h-4 inline mr-1" /> Registrar GPS
            </button>
          </div>

          <div className="bg-white border border-neutral-200 rounded-2xl overflow-hidden shadow-sm">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-neutral-900 text-white text-xs uppercase font-bold">
                  <tr>
                    <th className="px-4 py-3.5 text-left">Serie / IMEI</th>
                    <th className="px-4 py-3.5 text-left">Modelo de GPS</th>
                    <th className="px-4 py-3.5 text-left">SIM / Operador</th>
                    <th className="px-4 py-3.5 text-left">Estado Conexión</th>
                    <th className="px-4 py-3.5 text-left">Vehículo Asignado</th>
                    <th className="px-4 py-3.5 text-left">Último Reporte</th>
                    <th className="px-4 py-3.5 text-right">Acción</th>
                  </tr>
                </thead>
                <tbody>
                  {dispositivos.map((d, idx) => {
                    const statusStyles = {
                      reportando: "bg-emerald-50 text-emerald-700 ring-emerald-200",
                      "no reporta": "bg-rose-50 text-rose-700 ring-rose-200",
                      "sin asignar": "bg-amber-50 text-amber-700 ring-amber-200"
                    }[d.estado.toLowerCase()] || "bg-neutral-50 text-neutral-600 ring-neutral-200";

                    const dotColors = {
                      reportando: "bg-emerald-500",
                      "no reporta": "bg-rose-500",
                      "sin asignar": "bg-amber-500"
                    }[d.estado.toLowerCase()] || "bg-neutral-400";

                    return (
                      <tr key={idx} className="border-t border-neutral-100 hover:bg-neutral-50">
                        <td className="px-4 py-3 font-semibold text-neutral-800">
                          <div className="flex items-center gap-2">
                            <Cpu className="w-4 h-4 text-brand flex-shrink-0" />
                            <span className="font-mono text-xs">{d.imei}</span>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-neutral-600">{d.modelo}</td>
                        <td className="px-4 py-3 text-xs text-neutral-500">{d.sim}</td>
                        <td className="px-4 py-3">
                          <span className={cls("inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-bold ring-1", statusStyles)}>
                            <span className={cls("w-1.5 h-1.5 rounded-full", dotColors)} />
                            {d.estado}
                          </span>
                        </td>
                        <td className="px-4 py-3 font-semibold text-neutral-700">{d.asignado}</td>
                        <td className="px-4 py-3 text-xs text-neutral-500 font-medium">{d.fecha}</td>
                        <td className="px-4 py-3 text-right">
                          <button className="px-2.5 py-1 text-xs font-bold text-brand bg-brand-50 hover:bg-brand-100 rounded-lg transition-colors">
                            {d.estado === "Sin asignar" ? "Asignar" : "Reasignar"}
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
      )}

      {/* CRUD Modal */}
      <Modal open={!!modal} onClose={() => setModal(null)} title={modal?.type === "edit" ? "Editar Unidad Vehicular" : "Registrar Unidad Vehicular"}>
        <form onSubmit={handleSave} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2">
              <Field label="Placa" required>
                <input
                  required
                  placeholder="Ej: ABC-123"
                  maxLength={7}
                  value={form.placa || ""}
                  onChange={e => setForm({ ...form, placa: e.target.value.toUpperCase().trim() })}
                  className={inputCls}
                />
              </Field>
            </div>
            <Field label="Marca">
              <input
                placeholder="Ej: Chevrolet"
                value={form.marca || ""}
                onChange={e => setForm({ ...form, marca: e.target.value })}
                className={inputCls}
              />
            </Field>
            <Field label="Modelo">
              <input
                placeholder="Ej: Corsa"
                value={form.modelo || ""}
                onChange={e => setForm({ ...form, modelo: e.target.value })}
                className={inputCls}
              />
            </Field>
            <Field label="Año">
              <input
                type="number"
                placeholder="Ej: 2024"
                value={form.año || ""}
                onChange={e => setForm({ ...form, año: e.target.value })}
                className={inputCls}
              />
            </Field>
            <Field label="Código Unidad">
              <input
                placeholder="Ej: 567"
                value={form.unidad || ""}
                onChange={e => setForm({ ...form, unidad: e.target.value })}
                className={inputCls}
              />
            </Field>
            <div className="col-span-2">
              <Field label="Conductor Principal">
                <select
                  value={form.conductor_principal_id || ""}
                  onChange={e => setForm({ ...form, conductor_principal_id: e.target.value })}
                  className={inputCls}
                >
                  <option value="">Seleccione Conductor</option>
                  {conductores.map((c) => (
                    <option key={c.id} value={c.id}>{c.nombre} {c.apellidos}</option>
                  ))}
                </select>
              </Field>
            </div>
            <div className="col-span-2">
              <Field label="Empresa">
                <input
                  placeholder="Ej: Sede Central"
                  value={form.empresa || ""}
                  onChange={e => setForm({ ...form, empresa: e.target.value })}
                  className={inputCls}
                />
              </Field>
            </div>
            <div className="col-span-2">
              <Field label="Medidor Kilómetros">
                <input
                  type="number"
                  placeholder="Ej: 150000"
                  value={form.medidor || ""}
                  onChange={e => setForm({ ...form, medidor: e.target.value })}
                  className={inputCls}
                />
              </Field>
            </div>
            <Field label="Estado">
              <select
                value={form.estado || "OPERATIVO"}
                onChange={e => setForm({ ...form, estado: e.target.value })}
                className={inputCls}
              >
                <option value="OPERATIVO">OPERATIVO</option>
                <option value="OEM">OEM</option>
                <option value="TALLER">TALLER</option>
                <option value="INACTIVO">INACTIVO</option>
              </select>
            </Field>
          </div>

          {errMsg && <div className="text-rose-600 text-xs font-bold">{errMsg}</div>}

          <div className="flex gap-2 justify-end border-t border-neutral-100 pt-4 mt-2">
            <button type="button" onClick={() => setModal(null)} className="px-4 py-2 border border-neutral-200 text-neutral-700 hover:bg-neutral-50 rounded-lg text-sm font-bold transition-all">
              Cancelar
            </button>
            <button type="submit" disabled={saving} className="px-5 py-2 bg-brand hover:bg-brand-hover text-white rounded-lg text-sm font-bold shadow-sm transition-all disabled:opacity-50">
              {saving ? "Guardando..." : "Guardar"}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
