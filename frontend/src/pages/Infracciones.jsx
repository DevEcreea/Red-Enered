import React, { useEffect, useMemo, useState } from "react";
import { useAuth } from "../context/AuthContext";
import ModuloBloqueado from "./ModuloBloqueado";
import { api } from "../lib/api";
import {
  AlertTriangle, Plus, Search, Pencil, Trash2, X,
  Car, User, FileSpreadsheet, FileDown
} from "lucide-react";
import * as XLSX from "xlsx";
import jsPDF from "jspdf";

// ---------- helpers ----------
const fmtS = (n) => `S/ ${Number(n || 0).toLocaleString("es-PE", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const fmtDate = (d) => (d ? new Date(d).toLocaleDateString("es-PE") : "");
const cls = (...a) => a.filter(Boolean).join(" ");

const ESTADO_BADGE = {
  pendiente: "bg-amber-50 text-amber-700 ring-amber-200",
  pagada: "bg-emerald-50 text-emerald-700 ring-emerald-200",
  impugnada: "bg-blue-50 text-blue-700 ring-blue-200",
  anulada: "bg-neutral-100 text-neutral-600 ring-neutral-200",
};

function Kpi({ label, value, sub, tone = "brand" }) {
  const toneCls = {
    brand: "bg-brand-50 text-brand",
    amber: "bg-amber-50 text-amber-600",
    emerald: "bg-emerald-50 text-emerald-600",
    blue: "bg-blue-50 text-blue-600",
  }[tone];
  return (
    <div className="bg-white border border-neutral-200 rounded-2xl p-5">
      <div className="flex items-center gap-3">
        <div className={cls("w-10 h-10 rounded-xl flex items-center justify-center", toneCls)}>
          <AlertTriangle className="w-5 h-5" strokeWidth={2.5} />
        </div>
        <div>
          <p className="text-xs text-neutral-500 uppercase tracking-wide font-bold">{label}</p>
          <p className="font-cabinet font-black text-2xl text-neutral-900 leading-tight">{value}</p>
        </div>
      </div>
      {sub && <p className="text-xs text-neutral-400 mt-2">{sub}</p>}
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
          <button onClick={onClose} className="text-neutral-500 hover:text-neutral-900">
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

export default function Infracciones() {
  const { user } = useAuth();
  const isAdmin = user?.role === "admin_enered" || user?.role === "administrador";
  const [tab, setTab] = useState("infracciones");
  const [vehiculos, setVehiculos] = useState([]);
  const [conductores, setConductores] = useState([]);
  const [infracciones, setInfracciones] = useState([]);
  const [stats, setStats] = useState({ total: 0, pendientes: 0, pagadas: 0, impugnadas: 0, monto_pendiente: 0, monto_pagado: 0 });
  const [loading, setLoading] = useState(false);

  const [q, setQ] = useState("");
  const [fEstado, setFEstado] = useState("");
  const [fPlaca, setFPlaca] = useState("");
  const [fConductor, setFConductor] = useState("");
  const [fDesde, setFDesde] = useState("");
  const [fHasta, setFHasta] = useState("");

  const [modal, setModal] = useState(null);
  const [form, setForm] = useState({});
  const [saving, setSaving] = useState(false);
  const [errMsg, setErrMsg] = useState("");

  async function loadAll() {
    setLoading(true);
    try {
      const [v, c, i, s] = await Promise.all([
        api.get("/vehiculos"),
        api.get("/conductores"),
        api.get("/infracciones"),
        api.get("/infracciones/dashboard/stats").catch(() => ({ data: null })),
      ]);
      setVehiculos(v.data || []);
      setConductores(c.data || []);
      setInfracciones(i.data || []);
      if (s.data) setStats(s.data);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => { loadAll(); }, []);

  const infFiltradas = useMemo(() => {
    const qq = q.trim().toLowerCase();
    return infracciones.filter((i) => {
      if (fEstado && i.estado !== fEstado) return false;
      if (fPlaca && (i.vehiculo_placa || "").toUpperCase() !== fPlaca.toUpperCase()) return false;
      if (fConductor && i.conductor_id !== fConductor) return false;
      if (fDesde && i.fecha < fDesde) return false;
      if (fHasta && i.fecha > fHasta) return false;
      if (qq) {
        const txt = `${i.codigo || ""} ${i.descripcion || ""} ${i.papeleta || ""} ${i.vehiculo_placa || ""} ${i.conductor_nombre || ""}`.toLowerCase();
        if (!txt.includes(qq)) return false;
      }
      return true;
    });
  }, [infracciones, q, fEstado, fPlaca, fConductor, fDesde, fHasta]);

  const vehFiltrados = useMemo(() => {
    const qq = q.trim().toLowerCase();
    if (!qq) return vehiculos;
    return vehiculos.filter((v) => `${v.placa} ${v.marca || ""} ${v.modelo || ""}`.toLowerCase().includes(qq));
  }, [vehiculos, q]);

  const conFiltrados = useMemo(() => {
    const qq = q.trim().toLowerCase();
    if (!qq) return conductores;
    return conductores.filter((c) => `${c.dni} ${c.nombre} ${c.apellidos} ${c.licencia || ""}`.toLowerCase().includes(qq));
  }, [conductores, q]);

  function exportExcel() {
    let rows = [];
    let sheetName = "Infracciones";
    if (tab === "infracciones") {
      rows = infFiltradas.map((i) => ({
        Fecha: i.fecha, Placa: i.vehiculo_placa || "", Conductor: i.conductor_nombre || "",
        Código: i.codigo, Descripción: i.descripcion, Papeleta: i.papeleta || "",
        Lugar: i.lugar || "", Monto: i.monto, Estado: i.estado, Observaciones: i.observaciones || "",
      }));
    } else if (tab === "vehiculos") {
      sheetName = "Vehículos";
      rows = vehFiltrados.map((v) => ({ Placa: v.placa, Marca: v.marca || "", Modelo: v.modelo || "", Año: v.año || "", Empresa: v.empresa || "" }));
    } else {
      sheetName = "Conductores";
      rows = conFiltrados.map((c) => ({ DNI: c.dni, Nombre: c.nombre, Apellidos: c.apellidos, Licencia: c.licencia || "", Teléfono: c.telefono || "", Email: c.email || "" }));
    }
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, sheetName);
    XLSX.writeFile(wb, `${sheetName.toLowerCase()}_${new Date().toISOString().slice(0, 10)}.xlsx`);
  }

  function exportPDF() {
    const doc = new jsPDF({ orientation: "landscape" });
    const title = tab === "infracciones" ? "Infracciones" : tab === "vehiculos" ? "Vehículos" : "Conductores";
    doc.setFontSize(16); doc.text(`ENERED — ${title}`, 14, 16);
    doc.setFontSize(9); doc.text(new Date().toLocaleString("es-PE"), 14, 22);
    let y = 32;
    const line = (cols, bold) => {
      if (bold) doc.setFont(undefined, "bold"); else doc.setFont(undefined, "normal");
      cols.forEach((c, idx) => doc.text(String(c ?? ""), 14 + idx * 38, y));
      y += 6;
      if (y > 195) { doc.addPage(); y = 16; }
    };
    if (tab === "infracciones") {
      line(["Fecha", "Placa", "Conductor", "Código", "Monto", "Estado", "Papeleta"], true);
      infFiltradas.forEach((i) => line([i.fecha, i.vehiculo_placa, (i.conductor_nombre || "").slice(0, 22), i.codigo, fmtS(i.monto), i.estado, i.papeleta || ""]));
    } else if (tab === "vehiculos") {
      line(["Placa", "Marca", "Modelo", "Año", "Empresa"], true);
      vehFiltrados.forEach((v) => line([v.placa, v.marca || "", v.modelo || "", v.año || "", v.empresa || ""]));
    } else {
      line(["DNI", "Nombre", "Apellidos", "Licencia", "Teléfono"], true);
      conFiltrados.forEach((c) => line([c.dni, c.nombre, c.apellidos, c.licencia || "", c.telefono || ""]));
    }
    doc.save(`${title.toLowerCase()}_${new Date().toISOString().slice(0, 10)}.pdf`);
  }

  function openCreate(type) {
    setErrMsg("");
    setForm(type === "inf" ? { estado: "pendiente", fecha: new Date().toISOString().slice(0, 10) } : {});
    setModal({ type });
  }
  function openEdit(type, obj) {
    setErrMsg("");
    setForm({ ...obj });
    setModal({ type, editing: obj });
  }

  async function save(e) {
    e.preventDefault();
    setSaving(true); setErrMsg("");
    try {
      const t = modal.type;
      const url = t === "inf" ? "/infracciones" : t === "veh" ? "/vehiculos" : "/conductores";
      const id = modal.editing?.id;
      const body = { ...form };
      if (body.año) body.año = parseInt(body.año, 10);
      if (body.monto !== undefined && body.monto !== "") body.monto = parseFloat(body.monto);
      if (id) await api.put(`${url}/${id}`, body);
      else await api.post(url, body);
      setModal(null); setForm({});
      await loadAll();
    } catch (e2) {
      setErrMsg(e2?.response?.data?.detail || "Error al guardar");
    } finally {
      setSaving(false);
    }
  }

  async function remove(type, id) {
    if (!window.confirm("¿Eliminar este registro?")) return;
    const url = type === "inf" ? "/infracciones" : type === "veh" ? "/vehiculos" : "/conductores";
    try { await api.delete(`${url}/${id}`); await loadAll(); }
    catch (e) { alert(e?.response?.data?.detail || "Error al eliminar"); }
  }

  if (!isAdmin) {
    return (
      <ModuloBloqueado
        titulo="Infracciones"
        descripcion="Controla las infracciones de tu flota por unidad y conductor, con ranking y alertas antes de que venzan. Reduce el gasto en papeletas y corrige a tiempo los malos hábitos de conducción. Disponible para ti — pruébalo sin costo."
      />
    );
  }

  return (
    <div className="p-4 md:p-6 max-w-7xl mx-auto" data-testid="page-infracciones">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 mb-6">
        <div>
          <h1 className="font-cabinet font-black text-3xl text-neutral-900 flex items-center gap-2">
            <AlertTriangle className="w-7 h-7 text-brand" /> Infracciones
          </h1>
          <p className="text-neutral-500 text-sm mt-1">Gestión de papeletas, vehículos y conductores de tu flota.</p>
        </div>
        <div className="flex gap-2">
          <button onClick={exportExcel} className="inline-flex items-center gap-2 px-3 py-2 bg-white border border-neutral-200 rounded-lg text-sm font-bold text-neutral-700 hover:bg-neutral-50">
            <FileSpreadsheet className="w-4 h-4" /> Excel
          </button>
          <button onClick={exportPDF} className="inline-flex items-center gap-2 px-3 py-2 bg-white border border-neutral-200 rounded-lg text-sm font-bold text-neutral-700 hover:bg-neutral-50">
            <FileDown className="w-4 h-4" /> PDF
          </button>
          <button onClick={() => openCreate(tab === "infracciones" ? "inf" : tab === "vehiculos" ? "veh" : "con")} className="inline-flex items-center gap-2 px-4 py-2 bg-brand text-white rounded-lg text-sm font-bold hover:bg-brand/90">
            <Plus className="w-4 h-4" /> Nuevo
          </button>
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
        <Kpi label="Total" value={stats.total} tone="brand" sub={`${vehiculos.length} vehículos · ${conductores.length} conductores`} />
        <Kpi label="Pendientes" value={stats.pendientes} tone="amber" sub={fmtS(stats.monto_pendiente)} />
        <Kpi label="Pagadas" value={stats.pagadas} tone="emerald" sub={fmtS(stats.monto_pagado)} />
        <Kpi label="Impugnadas" value={stats.impugnadas} tone="blue" />
      </div>

      <div className="flex gap-1 mb-4 bg-neutral-100 rounded-xl p-1 w-fit">
        {[
          { id: "infracciones", label: "Infracciones", Icon: AlertTriangle },
          { id: "vehiculos", label: "Vehículos", Icon: Car },
          { id: "conductores", label: "Conductores", Icon: User },
        ].map(({ id, label, Icon }) => (
          <button key={id} onClick={() => setTab(id)} data-testid={`tab-${id}`}
            className={cls("inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-bold transition", tab === id ? "bg-white text-brand shadow-sm" : "text-neutral-600 hover:text-neutral-900")}>
            <Icon className="w-4 h-4" /> {label}
          </button>
        ))}
      </div>

      <div className="bg-white border border-neutral-200 rounded-2xl p-4 mb-4">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-6 gap-2">
          <div className="lg:col-span-2 relative">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400" />
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar..." className={cls(inputCls, "pl-9")} />
          </div>
          {tab === "infracciones" && (
            <>
              <select value={fEstado} onChange={(e) => setFEstado(e.target.value)} className={inputCls}>
                <option value="">Todos los estados</option>
                <option value="pendiente">Pendiente</option>
                <option value="pagada">Pagada</option>
                <option value="impugnada">Impugnada</option>
                <option value="anulada">Anulada</option>
              </select>
              <select value={fPlaca} onChange={(e) => setFPlaca(e.target.value)} className={inputCls}>
                <option value="">Todas las placas</option>
                {vehiculos.map((v) => <option key={v.id} value={v.placa}>{v.placa}</option>)}
              </select>
              <input type="date" value={fDesde} onChange={(e) => setFDesde(e.target.value)} className={inputCls} title="Desde" />
              <input type="date" value={fHasta} onChange={(e) => setFHasta(e.target.value)} className={inputCls} title="Hasta" />
            </>
          )}
          {(fEstado || fPlaca || fConductor || fDesde || fHasta || q) && (
            <button onClick={() => { setQ(""); setFEstado(""); setFPlaca(""); setFConductor(""); setFDesde(""); setFHasta(""); }}
              className="text-xs text-brand font-bold underline lg:col-span-6 text-left">Limpiar filtros</button>
          )}
        </div>
      </div>

      <div className="bg-white border border-neutral-200 rounded-2xl overflow-hidden">
        {loading ? (
          <div className="p-12 text-center text-neutral-500">Cargando...</div>
        ) : (
          <div className="overflow-x-auto">
            {tab === "infracciones" && (
              <table className="w-full text-sm">
                <thead className="bg-neutral-50 text-neutral-600 text-xs uppercase tracking-wide">
                  <tr>
                    <th className="text-left px-4 py-3 font-bold">Fecha</th>
                    <th className="text-left px-4 py-3 font-bold">Placa</th>
                    <th className="text-left px-4 py-3 font-bold">Conductor</th>
                    <th className="text-left px-4 py-3 font-bold">Código</th>
                    <th className="text-left px-4 py-3 font-bold">Descripción</th>
                    <th className="text-right px-4 py-3 font-bold">Monto</th>
                    <th className="text-left px-4 py-3 font-bold">Estado</th>
                    <th className="text-right px-4 py-3 font-bold">Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {infFiltradas.length === 0 ? (
                    <tr><td colSpan="8" className="p-10 text-center text-neutral-400">Sin resultados</td></tr>
                  ) : infFiltradas.map((i) => (
                    <tr key={i.id} className="border-t border-neutral-100 hover:bg-neutral-50">
                      <td className="px-4 py-3 whitespace-nowrap">{fmtDate(i.fecha)}</td>
                      <td className="px-4 py-3 font-bold text-neutral-900">{i.vehiculo_placa || "—"}</td>
                      <td className="px-4 py-3">{i.conductor_nombre || "—"}</td>
                      <td className="px-4 py-3 font-mono text-xs">{i.codigo}</td>
                      <td className="px-4 py-3 max-w-xs truncate" title={i.descripcion}>{i.descripcion}</td>
                      <td className="px-4 py-3 text-right font-bold">{fmtS(i.monto)}</td>
                      <td className="px-4 py-3">
                        <span className={cls("inline-flex px-2 py-0.5 rounded-full text-xs font-bold ring-1", ESTADO_BADGE[i.estado] || "bg-neutral-100 text-neutral-600 ring-neutral-200")}>{i.estado}</span>
                      </td>
                      <td className="px-4 py-3 text-right whitespace-nowrap">
                        <button onClick={() => openEdit("inf", i)} className="text-neutral-500 hover:text-brand p-1"><Pencil className="w-4 h-4" /></button>
                        <button onClick={() => remove("inf", i.id)} className="text-neutral-500 hover:text-rose-600 p-1"><Trash2 className="w-4 h-4" /></button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}

            {tab === "vehiculos" && (
              <table className="w-full text-sm">
                <thead className="bg-neutral-50 text-neutral-600 text-xs uppercase tracking-wide">
                  <tr>
                    <th className="text-left px-4 py-3 font-bold">Placa</th>
                    <th className="text-left px-4 py-3 font-bold">Marca</th>
                    <th className="text-left px-4 py-3 font-bold">Modelo</th>
                    <th className="text-left px-4 py-3 font-bold">Año</th>
                    <th className="text-left px-4 py-3 font-bold">Empresa</th>
                    <th className="text-right px-4 py-3 font-bold">Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {vehFiltrados.length === 0 ? (
                    <tr><td colSpan="6" className="p-10 text-center text-neutral-400">Sin vehículos registrados</td></tr>
                  ) : vehFiltrados.map((v) => (
                    <tr key={v.id} className="border-t border-neutral-100 hover:bg-neutral-50">
                      <td className="px-4 py-3 font-bold text-neutral-900">{v.placa}</td>
                      <td className="px-4 py-3">{v.marca || "—"}</td>
                      <td className="px-4 py-3">{v.modelo || "—"}</td>
                      <td className="px-4 py-3">{v.año || "—"}</td>
                      <td className="px-4 py-3 text-xs text-neutral-500">{v.empresa || "—"}</td>
                      <td className="px-4 py-3 text-right whitespace-nowrap">
                        <button onClick={() => openEdit("veh", v)} className="text-neutral-500 hover:text-brand p-1"><Pencil className="w-4 h-4" /></button>
                        <button onClick={() => remove("veh", v.id)} className="text-neutral-500 hover:text-rose-600 p-1"><Trash2 className="w-4 h-4" /></button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}

            {tab === "conductores" && (
              <table className="w-full text-sm">
                <thead className="bg-neutral-50 text-neutral-600 text-xs uppercase tracking-wide">
                  <tr>
                    <th className="text-left px-4 py-3 font-bold">DNI</th>
                    <th className="text-left px-4 py-3 font-bold">Nombre</th>
                    <th className="text-left px-4 py-3 font-bold">Apellidos</th>
                    <th className="text-left px-4 py-3 font-bold">Licencia</th>
                    <th className="text-left px-4 py-3 font-bold">Teléfono</th>
                    <th className="text-left px-4 py-3 font-bold">Email</th>
                    <th className="text-right px-4 py-3 font-bold">Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {conFiltrados.length === 0 ? (
                    <tr><td colSpan="7" className="p-10 text-center text-neutral-400">Sin conductores registrados</td></tr>
                  ) : conFiltrados.map((c) => (
                    <tr key={c.id} className="border-t border-neutral-100 hover:bg-neutral-50">
                      <td className="px-4 py-3 font-mono">{c.dni}</td>
                      <td className="px-4 py-3 font-bold text-neutral-900">{c.nombre}</td>
                      <td className="px-4 py-3">{c.apellidos}</td>
                      <td className="px-4 py-3">{c.licencia || "—"}</td>
                      <td className="px-4 py-3">{c.telefono || "—"}</td>
                      <td className="px-4 py-3 text-xs text-neutral-500">{c.email || "—"}</td>
                      <td className="px-4 py-3 text-right whitespace-nowrap">
                        <button onClick={() => openEdit("con", c)} className="text-neutral-500 hover:text-brand p-1"><Pencil className="w-4 h-4" /></button>
                        <button onClick={() => remove("con", c.id)} className="text-neutral-500 hover:text-rose-600 p-1"><Trash2 className="w-4 h-4" /></button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        )}
      </div>

      <Modal open={!!modal} onClose={() => setModal(null)}
        title={modal ? `${modal.editing ? "Editar" : "Nuevo"} ${modal.type === "inf" ? "infracción" : modal.type === "veh" ? "vehículo" : "conductor"}` : ""}
        width="max-w-xl">
        {modal && (
          <form onSubmit={save} className="space-y-3">
            {modal.type === "veh" && (
              <>
                <Field label="Placa" required>
                  <input required value={form.placa || ""} onChange={(e) => setForm({ ...form, placa: e.target.value.toUpperCase() })} className={inputCls} maxLength={7} disabled={!!modal.editing} />
                </Field>
                <div className="grid grid-cols-2 gap-3">
                  <Field label="Marca"><input value={form.marca || ""} onChange={(e) => setForm({ ...form, marca: e.target.value })} className={inputCls} /></Field>
                  <Field label="Modelo"><input value={form.modelo || ""} onChange={(e) => setForm({ ...form, modelo: e.target.value })} className={inputCls} /></Field>
                </div>
                <Field label="Año"><input type="number" value={form.año || ""} onChange={(e) => setForm({ ...form, año: e.target.value })} className={inputCls} /></Field>
                <Field label="Conductor principal">
                  <select value={form.conductor_principal_id || ""} onChange={(e) => setForm({ ...form, conductor_principal_id: e.target.value || null })} className={inputCls}>
                    <option value="">— sin asignar —</option>
                    {conductores.map((c) => <option key={c.id} value={c.id}>{c.nombre} {c.apellidos} ({c.dni})</option>)}
                  </select>
                </Field>
              </>
            )}

            {modal.type === "con" && (
              <>
                <Field label="DNI" required>
                  <input required value={form.dni || ""} onChange={(e) => setForm({ ...form, dni: e.target.value })} className={inputCls} maxLength={8} disabled={!!modal.editing} />
                </Field>
                <div className="grid grid-cols-2 gap-3">
                  <Field label="Nombre" required><input required value={form.nombre || ""} onChange={(e) => setForm({ ...form, nombre: e.target.value })} className={inputCls} /></Field>
                  <Field label="Apellidos" required><input required value={form.apellidos || ""} onChange={(e) => setForm({ ...form, apellidos: e.target.value })} className={inputCls} /></Field>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <Field label="Licencia"><input value={form.licencia || ""} onChange={(e) => setForm({ ...form, licencia: e.target.value })} className={inputCls} /></Field>
                  <Field label="Vencimiento licencia"><input type="date" value={form.vencimiento_licencia || ""} onChange={(e) => setForm({ ...form, vencimiento_licencia: e.target.value })} className={inputCls} /></Field>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <Field label="Teléfono"><input value={form.telefono || ""} onChange={(e) => setForm({ ...form, telefono: e.target.value })} className={inputCls} /></Field>
                  <Field label="Email"><input type="email" value={form.email || ""} onChange={(e) => setForm({ ...form, email: e.target.value })} className={inputCls} /></Field>
                </div>
              </>
            )}

            {modal.type === "inf" && (
              <>
                <div className="grid grid-cols-2 gap-3">
                  <Field label="Vehículo" required>
                    <select required value={form.vehiculo_id || ""} onChange={(e) => setForm({ ...form, vehiculo_id: e.target.value })} className={inputCls} disabled={!!modal.editing}>
                      <option value="">— elegir placa —</option>
                      {vehiculos.map((v) => <option key={v.id} value={v.id}>{v.placa}</option>)}
                    </select>
                  </Field>
                  <Field label="Conductor">
                    <select value={form.conductor_id || ""} onChange={(e) => setForm({ ...form, conductor_id: e.target.value || null })} className={inputCls}>
                      <option value="">— sin asignar —</option>
                      {conductores.map((c) => <option key={c.id} value={c.id}>{c.nombre} {c.apellidos}</option>)}
                    </select>
                  </Field>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <Field label="Fecha" required><input required type="date" value={form.fecha || ""} onChange={(e) => setForm({ ...form, fecha: e.target.value })} className={inputCls} /></Field>
                  <Field label="Código" required><input required value={form.codigo || ""} onChange={(e) => setForm({ ...form, codigo: e.target.value })} className={inputCls} placeholder="M02, G28..." /></Field>
                  <Field label="Papeleta"><input value={form.papeleta || ""} onChange={(e) => setForm({ ...form, papeleta: e.target.value })} className={inputCls} /></Field>
                </div>
                <Field label="Descripción" required>
                  <input required value={form.descripcion || ""} onChange={(e) => setForm({ ...form, descripcion: e.target.value })} className={inputCls} />
                </Field>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <Field label="Monto (S/)" required><input required type="number" step="0.01" value={form.monto || ""} onChange={(e) => setForm({ ...form, monto: e.target.value })} className={inputCls} /></Field>
                  <Field label="Estado" required>
                    <select required value={form.estado || "pendiente"} onChange={(e) => setForm({ ...form, estado: e.target.value })} className={inputCls}>
                      <option value="pendiente">Pendiente</option>
                      <option value="pagada">Pagada</option>
                      <option value="impugnada">Impugnada</option>
                      <option value="anulada">Anulada</option>
                    </select>
                  </Field>
                  <Field label="Lugar"><input value={form.lugar || ""} onChange={(e) => setForm({ ...form, lugar: e.target.value })} className={inputCls} /></Field>
                </div>
                <Field label="Observaciones">
                  <textarea rows={2} value={form.observaciones || ""} onChange={(e) => setForm({ ...form, observaciones: e.target.value })} className={inputCls} />
                </Field>
              </>
            )}

            {errMsg && <div className="text-sm text-rose-600 bg-rose-50 px-3 py-2 rounded-lg">{errMsg}</div>}

            <div className="flex justify-end gap-2 pt-2">
              <button type="button" onClick={() => setModal(null)} className="px-4 py-2 text-sm font-bold text-neutral-600 hover:text-neutral-900">Cancelar</button>
              <button type="submit" disabled={saving} className="px-4 py-2 bg-brand text-white rounded-lg text-sm font-bold hover:bg-brand/90 disabled:opacity-50">
                {saving ? "Guardando..." : modal.editing ? "Guardar cambios" : "Crear"}
              </button>
            </div>
          </form>
        )}
      </Modal>
    </div>
  );
}
