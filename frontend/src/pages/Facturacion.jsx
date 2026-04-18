import React, { useEffect, useState } from "react";
import { api } from "../lib/api";
import { formatSoles, formatDate, formatApiError } from "../lib/utils";
import { useAuth } from "../context/AuthContext";
import { Plus, FileText, Download, FileSpreadsheet, Trash2 } from "lucide-react";
import * as XLSX from "xlsx";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

const ESTADO_STYLE = {
  pendiente: "bg-yellow-100 text-yellow-700 border-yellow-200",
  pagada: "bg-green-100 text-green-700 border-green-200",
  vencida: "bg-red-100 text-red-700 border-red-200",
};

export default function Facturacion() {
  const { user } = useAuth();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [empresas, setEmpresas] = useState([]);
  const [form, setForm] = useState({ empresa: "", numero: "", fecha_emision: "", fecha_vencimiento: "", monto: "", estado: "pendiente" });
  const [err, setErr] = useState("");

  const load = async () => {
    setLoading(true);
    try { const { data } = await api.get("/invoices"); setItems(data); }
    finally { setLoading(false); }
  };

  useEffect(() => {
    load();
    if (user?.role === "admin_enered") api.get("/empresas").then((r) => setEmpresas(r.data));
  }, [user]);

  const create = async (e) => {
    e.preventDefault(); setErr("");
    try {
      await api.post("/invoices", { ...form, monto: parseFloat(form.monto) });
      setShowForm(false); setForm({ empresa: "", numero: "", fecha_emision: "", fecha_vencimiento: "", monto: "", estado: "pendiente" });
      load();
    } catch (e2) { setErr(formatApiError(e2.response?.data?.detail)); }
  };

  const setEstado = async (inv, estado) => {
    await api.put(`/invoices/${inv.id}`, { estado });
    load();
  };

  const remove = async (inv) => {
    if (!window.confirm(`Eliminar factura ${inv.numero}?`)) return;
    await api.delete(`/invoices/${inv.id}`);
    load();
  };

  const generatePDF = (inv) => {
    const doc = new jsPDF();
    doc.setFillColor(153, 51, 255); doc.rect(0, 0, 210, 35, "F");
    doc.setTextColor(255); doc.setFontSize(22); doc.text("ENERED", 15, 20);
    doc.setFontSize(10); doc.text("Fuel Intelligence", 15, 27);
    doc.setTextColor(0); doc.setFontSize(18); doc.text("FACTURA", 15, 55);
    doc.setFontSize(11);
    doc.text(`N° ${inv.numero}`, 15, 65);
    doc.text(`Empresa: ${inv.empresa}`, 15, 75);
    doc.text(`Fecha emisión: ${formatDate(inv.fecha_emision)}`, 15, 85);
    doc.text(`Fecha vencimiento: ${formatDate(inv.fecha_vencimiento)}`, 15, 95);
    doc.text(`Estado: ${inv.estado.toUpperCase()}`, 15, 105);
    doc.setFontSize(16); doc.text(`Monto: ${formatSoles(inv.monto)}`, 15, 125);
    doc.setFontSize(9); doc.setTextColor(120);
    doc.text("Documento generado automáticamente por la plataforma ENERED.", 15, 280);
    doc.save(`Factura_${inv.numero}.pdf`);
  };

  const exportExcel = () => {
    const data = items.map((i) => ({
      Empresa: i.empresa, "N°": i.numero, Emisión: i.fecha_emision,
      Vencimiento: i.fecha_vencimiento, Monto: i.monto, Estado: i.estado,
    }));
    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Facturas");
    XLSX.writeFile(wb, `ENERED_facturas_${Date.now()}.xlsx`);
  };

  const exportPDFList = () => {
    const doc = new jsPDF();
    doc.setFontSize(16); doc.text("ENERED — Listado de Facturas", 14, 15);
    autoTable(doc, {
      startY: 22,
      head: [["Empresa", "N°", "Emisión", "Vencimiento", "Monto", "Estado"]],
      body: items.map((i) => [i.empresa, i.numero, i.fecha_emision, i.fecha_vencimiento, formatSoles(i.monto), i.estado]),
      headStyles: { fillColor: [153, 51, 255] },
      styles: { fontSize: 9 },
    });
    doc.save(`ENERED_facturas_${Date.now()}.pdf`);
  };

  const isAdmin = user?.role === "admin_enered";

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-4">
        <div>
          <div className="text-[11px] font-bold uppercase tracking-widest text-brand mb-2">Gestión financiera</div>
          <h1 className="font-cabinet font-black text-3xl md:text-4xl text-neutral-900">Facturación</h1>
          <p className="text-neutral-500 mt-1 text-sm">Consulta, descarga y gestiona tus facturas.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button onClick={exportExcel} className="btn-ghost text-sm flex items-center gap-2" data-testid="invoices-export-excel">
            <FileSpreadsheet className="w-4 h-4" /> Excel
          </button>
          <button onClick={exportPDFList} className="btn-ghost text-sm flex items-center gap-2">
            <FileText className="w-4 h-4" /> PDF
          </button>
          {isAdmin && (
            <button onClick={() => setShowForm(true)} className="btn-brand text-sm flex items-center gap-2" data-testid="invoice-new-btn">
              <Plus className="w-4 h-4" /> Nueva factura
            </button>
          )}
        </div>
      </div>

      {showForm && isAdmin && (
        <div className="bg-white border border-border rounded-lg p-6">
          <h3 className="font-cabinet font-bold text-lg mb-4">Nueva factura</h3>
          <form onSubmit={create} className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <select required value={form.empresa} onChange={(e) => setForm({ ...form, empresa: e.target.value })} className="h-10 px-3 border border-border rounded-md text-sm">
              <option value="">Empresa</option>{empresas.map((e) => <option key={e}>{e}</option>)}
            </select>
            <input required placeholder="N° factura" value={form.numero} onChange={(e) => setForm({ ...form, numero: e.target.value })} className="h-10 px-3 border border-border rounded-md text-sm" />
            <input required type="number" step="0.01" placeholder="Monto S/" value={form.monto} onChange={(e) => setForm({ ...form, monto: e.target.value })} className="h-10 px-3 border border-border rounded-md text-sm" />
            <input required type="date" value={form.fecha_emision} onChange={(e) => setForm({ ...form, fecha_emision: e.target.value })} className="h-10 px-3 border border-border rounded-md text-sm" />
            <input required type="date" value={form.fecha_vencimiento} onChange={(e) => setForm({ ...form, fecha_vencimiento: e.target.value })} className="h-10 px-3 border border-border rounded-md text-sm" />
            <select value={form.estado} onChange={(e) => setForm({ ...form, estado: e.target.value })} className="h-10 px-3 border border-border rounded-md text-sm">
              <option value="pendiente">Pendiente</option><option value="pagada">Pagada</option><option value="vencida">Vencida</option>
            </select>
            {err && <div className="md:col-span-3 text-red-600 text-sm">{err}</div>}
            <div className="md:col-span-3 flex gap-2">
              <button type="submit" className="btn-brand text-sm">Crear</button>
              <button type="button" onClick={() => setShowForm(false)} className="btn-ghost text-sm">Cancelar</button>
            </div>
          </form>
        </div>
      )}

      <div className="bg-white border border-border rounded-lg overflow-hidden">
        <div className="overflow-x-auto">
          <table className="enered-table" data-testid="invoices-table">
            <thead>
              <tr>
                <th>Empresa</th><th>N° Factura</th><th>Emisión</th><th>Vencimiento</th>
                <th className="text-right">Monto</th><th>Estado</th><th className="text-right">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {loading ? <tr><td colSpan={7} className="text-center py-8">Cargando...</td></tr>
                : items.length === 0 ? <tr><td colSpan={7} className="text-center py-8 text-neutral-500">Sin facturas</td></tr>
                : items.map((inv) => (
                  <tr key={inv.id}>
                    <td className="font-semibold">{inv.empresa}</td>
                    <td className="font-mono">{inv.numero}</td>
                    <td>{formatDate(inv.fecha_emision)}</td>
                    <td>{formatDate(inv.fecha_vencimiento)}</td>
                    <td className="text-right font-bold">{formatSoles(inv.monto)}</td>
                    <td>
                      {isAdmin ? (
                        <select value={inv.estado} onChange={(e) => setEstado(inv, e.target.value)}
                          className={`text-xs font-bold px-2 py-1 rounded-full border ${ESTADO_STYLE[inv.estado]}`}>
                          <option value="pendiente">Pendiente</option>
                          <option value="pagada">Pagada</option>
                          <option value="vencida">Vencida</option>
                        </select>
                      ) : (
                        <span className={`px-3 py-1 rounded-full text-xs font-bold border ${ESTADO_STYLE[inv.estado]}`}>
                          {inv.estado.toUpperCase()}
                        </span>
                      )}
                    </td>
                    <td className="text-right">
                      <div className="flex gap-2 justify-end">
                        <button onClick={() => generatePDF(inv)} className="p-2 hover:bg-brand-50 text-brand rounded-md" title="Descargar PDF" data-testid={`invoice-pdf-${inv.numero}`}>
                          <Download className="w-4 h-4" />
                        </button>
                        {isAdmin && (
                          <button onClick={() => remove(inv)} className="p-2 hover:bg-red-50 text-red-600 rounded-md">
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
