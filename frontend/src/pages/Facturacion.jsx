import React, { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from "recharts";
import {
  Download, FileText, Mail, Search, BookOpen, MessageCircle,
  Clock, AlertCircle, FileSpreadsheet, Eye, Trash2, X, Loader2, Edit3, Upload,
} from "lucide-react";
import { api, API } from "../lib/api";
import { formatSoles, formatDate } from "../lib/utils";
import { useAuth } from "../context/AuthContext";
import { toast } from "sonner";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import PdfViewerModal from "../components/PdfViewerModal";

const WA_LINK = "https://wa.me/message/VDUNDBHSQ47SC1";

const ESTADO_BADGE = {
  // Nuevos
  vencida: "bg-red-100 text-red-700 border-red-200",
  pendiente: "bg-amber-50 text-amber-700 border-amber-200",
  pagada: "bg-green-50 text-green-700 border-green-200",
  TERCERO: "bg-blue-50 text-blue-700 border-blue-200",
  // Legacy (datos antiguos)
  vencido: "bg-red-100 text-red-700 border-red-200",
  por_vencer: "bg-amber-50 text-amber-700 border-amber-200",
  pagado: "bg-green-50 text-green-700 border-green-200",
};

const ESTADO_LABEL = {
  vencida: "VENCIDA", pendiente: "PENDIENTE", pagada: "PAGADA", TERCERO: "TERCERO",
  vencido: "VENCIDA", por_vencer: "PENDIENTE", pagado: "PAGADA",
};

function calculateAtrasoDias(inv) {
  const st = (inv?.estado || "").toLowerCase().trim();
  if (st !== "vencida" && st !== "vencido") {
    return 0;
  }
  const fvStr = inv?.f_vencimiento || inv?.fecha_vencimiento;
  if (!fvStr) return 0;
  try {
    let str = String(fvStr).trim();
    if (str.length > 10 && str.includes("T")) str = str.split("T")[0];
    let fvDate = null;
    if (str.includes("-")) {
      const p = str.split("-");
      fvDate = new Date(parseInt(p[0]), parseInt(p[1]) - 1, parseInt(p[2]));
    } else if (str.includes("/")) {
      const p = str.split("/");
      fvDate = new Date(parseInt(p[2]), parseInt(p[1]) - 1, parseInt(p[0]));
    } else {
      fvDate = new Date(str);
    }
    if (!fvDate || isNaN(fvDate.getTime())) return 0;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    fvDate.setHours(0, 0, 0, 0);
    const diffTime = today.getTime() - fvDate.getTime();
    const diffDays = Math.floor(diffTime / (1000 * 3600 * 24));
    return Math.max(0, diffDays);
  } catch {
    return 0;
  }
}

export default function Facturacion() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [state, setState] = useState(null);
  const [invoices, setInvoices] = useState([]);
  const [empresas, setEmpresas] = useState([]);
  const [empresa, setEmpresa] = useState("");
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [historial, setHistorial] = useState([]);
  const [activeTab, setActiveTab] = useState("facturas");
  const [comingSoon, setComingSoon] = useState(false);
  const [emailInput, setEmailInput] = useState("");
  const [viewerOpen, setViewerOpen] = useState(false);
  const [viewerUrl, setViewerUrl] = useState(null);
  const [viewerTitle, setViewerTitle] = useState("");
  const [viewerDoc, setViewerDoc] = useState(null);
  const [abonoModalOpen, setAbonoModalOpen] = useState(false);
  const [editingInv, setEditingInv] = useState(null);
  const [uploadingInv, setUploadingInv] = useState(null);
  const PAGE_SIZE = 10;

  useEffect(() => {
    if (user?.role === "admin_enered") api.get("/empresas").then((r) => setEmpresas(r.data)).catch(() => {});
  }, [user]);

  useEffect(() => {
    setLoading(true);
    const params = empresa ? { empresa } : {};
    Promise.all([
      api.get("/account-state", { params }),
      api.get("/invoices", { params }),
      api.get("/abonos/historial", { params }).catch(() => ({ data: { data: [] } })),
    ])
      .then(([s, i, h]) => { 
        setState(s.data); 
        setInvoices(i.data); 
        setHistorial(h.data?.data || []);
        setPage(1); 
      })
      .catch((err) => console.error("Error loading Facturacion:", err))
      .finally(() => setLoading(false));
  }, [empresa]);

  const totalPages = Math.max(1, Math.ceil(invoices.length / PAGE_SIZE));
  const pageRows = invoices.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  // Donut: total = línea_credito; segmentos = facturas pendientes + notas despacho + disponible
  const donutData = useMemo(() => {
    if (!state) return [];
    const out = [];
    if (state.disponible > 0) out.push({ name: "Disponible", value: state.disponible, color: "#1E1B4B" });
    if (state.facturas_pendientes > 0) out.push({ name: "Facturas pendientes", value: state.facturas_pendientes, color: "#7C3AED" });
    if (state.notas_despacho > 0) out.push({ name: "Notas de despacho", value: state.notas_despacho, color: "#22D3EE" });
    return out;
  }, [state]);

  const downloadStatePDF = () => {
    if (!state) return;
    const doc = new jsPDF();
    doc.setFillColor(153, 51, 255); doc.rect(0, 0, 210, 30, "F");
    doc.setTextColor(255); doc.setFontSize(20); doc.text("ENERED", 14, 18);
    doc.setFontSize(10); doc.text("Estado de Cuenta", 14, 25);
    doc.setTextColor(0);

    doc.setFontSize(13); doc.text(`Empresa: ${state.empresa || "—"}`, 14, 42);
    if (state.ruc) doc.text(`RUC: ${state.ruc}`, 14, 49);
    doc.setFontSize(9); doc.setTextColor(120);
    doc.text(`Generado: ${new Date().toLocaleString("es-PE")}`, 14, 56);
    doc.setTextColor(0);

    const summary = [
      ["Línea de Crédito Total", formatSoles(state.linea_credito_total)],
      ["Disponible (Libre)", formatSoles(state.disponible)],
      ["Línea de Crédito Utilizada", formatSoles(state.linea_credito_utilizada)],
      ["Notas de Despacho", formatSoles(state.notas_despacho)],
      ["Total Facturado", formatSoles(state.total_facturado)],
      ["% Línea Utilizada", `${state.pct_utilizada}%`],
      ["Total Vencido", formatSoles(state.total_vencido)],
      ["Condición de Crédito", `${state.dias_credito} días`],
    ];
    autoTable(doc, {
      startY: 64,
      body: summary,
      theme: "plain",
      styles: { fontSize: 10, cellPadding: 2 },
      columnStyles: { 0: { fontStyle: "bold", cellWidth: 80 }, 1: { halign: "right" } },
    });

    autoTable(doc, {
      startY: doc.lastAutoTable.finalY + 8,
      head: [["N° Doc", "Tipo", "F. Emisión", "F. Vencim.", "Atraso", "Monto", "Saldo", "Estado"]],
      body: invoices.map((i) => [
        i.n_doc, i.tipo_doc || "—", i.f_emision || "—", i.f_vencimiento || "—",
        `${i.atraso_dias || 0} d`, formatSoles(i.monto_total), formatSoles(i.saldo),
        (i.estado || "").toUpperCase(),
      ]),
      headStyles: { fillColor: [30, 27, 75] },
      styles: { fontSize: 8 },
    });

    doc.save(`Estado_Cuenta_${state.empresa || "ENERED"}_${Date.now()}.pdf`);
    toast.success("Estado de cuenta descargado");
  };

  const downloadInvoice = async (inv, kind) => {
    const docId = inv.id || inv.n_doc || inv.numero_documento;
    if (!docId) {
      toast.error("Identificador de factura no válido");
      return;
    }
    try {
      const r = await api.get(`/invoices/${encodeURIComponent(docId)}/download/${kind}`, { responseType: "blob" });
      const type = r.headers["content-type"] || (kind === "xml" ? "text/xml" : "application/pdf");
      const blob = new Blob([r.data], { type });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${inv.n_doc || docId}.${kind}`;
      document.body.appendChild(a); a.click(); a.remove();
      URL.revokeObjectURL(url);
    } catch (err) {
      let msg = `No se encontró el ${kind.toUpperCase()} de la factura`;
      if (err.response?.data instanceof Blob) {
        try {
          const text = await err.response.data.text();
          const json = JSON.parse(text);
          if (json.detail) msg = json.detail;
        } catch (_) {}
      } else if (err.response?.data?.detail) {
        msg = err.response.data.detail;
      }
      toast.error(msg);
    }
  };

  const generateFallbackPdfUrl = (inv) => {
    try {
      const doc = new jsPDF();
      doc.setFont("helvetica", "bold");
      doc.setFontSize(18);
      doc.text("RED ENERED - COMPROBANTE DE PAGO", 14, 22);
      
      doc.setFont("helvetica", "normal");
      doc.setFontSize(10);
      doc.text("Plataforma Integral de Gestión de Combustible", 14, 28);
      doc.setDrawColor(200, 200, 200);
      doc.line(14, 32, 196, 32);

      const nDoc = inv.n_doc || inv.numero_documento || inv.id || "Factura";
      doc.setFont("helvetica", "bold");
      doc.setFontSize(12);
      doc.text(`Documento N°: ${nDoc}`, 14, 42);

      doc.setFont("helvetica", "normal");
      doc.setFontSize(10);
      doc.text(`Cliente / Empresa: ${inv.empresa || inv.cliente || "—"}`, 14, 50);
      doc.text(`Producto / Servicio: ${inv.producto || "DIESEL / COMBUSTIBLE"}`, 14, 56);
      doc.text(`Fecha Emisión: ${inv.f_emision || inv.fecha || "—"}`, 14, 62);
      doc.text(`Fecha Vencimiento: ${inv.f_vencimiento || "—"}`, 14, 68);
      doc.text(`Estado: ${(inv.estado || "pendiente").toUpperCase()}`, 14, 74);

      doc.line(14, 80, 196, 80);

      const rawMonto = inv.monto_total ?? inv.monto ?? inv.importe_total ?? 0;
      const numMonto = typeof rawMonto === "number" ? rawMonto : parseFloat(String(rawMonto).replace(/[^\d.-]/g, "")) || 0;
      const rawSaldo = inv.saldo !== undefined ? inv.saldo : numMonto;
      const numSaldo = typeof rawSaldo === "number" ? rawSaldo : parseFloat(String(rawSaldo).replace(/[^\d.-]/g, "")) || 0;

      autoTable(doc, {
        startY: 86,
        head: [["Concepto", "Importe Total", "Saldo Pendiente", "Moneda"]],
        body: [[
          inv.producto || "Facturación de Consumo de Combustible",
          `S/ ${numMonto.toFixed(2)}`,
          `S/ ${numSaldo.toFixed(2)}`,
          inv.moneda || "PEN"
        ]],
        theme: "striped",
        headStyles: { fillColor: [139, 61, 255] }
      });

      const finalY = (doc.lastAutoTable?.finalY || 120) + 15;
      doc.setFontSize(9);
      doc.setFont("helvetica", "italic");
      doc.text("Documento electrónico generado por la Plataforma Enered.", 14, finalY);

      const blob = doc.output("blob");
      return URL.createObjectURL(blob);
    } catch (e) {
      console.error("Error al generar PDF local:", e);
      return null;
    }
  };

  const viewInvoice = async (inv, kind = "pdf") => {
    const docId = inv.id || inv.n_doc || inv.numero_documento;
    if (!docId) {
      toast.error("Identificador de factura no válido");
      return;
    }
    const toastId = toast.loading(`Cargando previsualización de ${inv.n_doc || docId}...`);
    try {
      const r = await api.get(`/invoices/${encodeURIComponent(docId)}/download/${kind}`, { responseType: "blob" });
      toast.dismiss(toastId);
      const type = r.headers["content-type"] || (kind === "xml" ? "text/xml" : "application/pdf");
      const blob = new Blob([r.data], { type });
      const url = URL.createObjectURL(blob);
      setViewerUrl(url);
      setViewerTitle(`Factura ${inv.n_doc || docId}`);
      setViewerDoc({ inv, kind });
      setViewerOpen(true);
    } catch (err) {
      toast.dismiss(toastId);
      if (kind === "pdf") {
        const localUrl = generateFallbackPdfUrl(inv);
        if (localUrl) {
          setViewerUrl(localUrl);
          setViewerTitle(`Factura ${inv.n_doc || docId}`);
          setViewerDoc({ inv, kind });
          setViewerOpen(true);
          return;
        }
      }
      toast.error(`No se pudo cargar la previsualización de la factura ${inv.n_doc || docId}`);
    }
  };

  const handleDelete = async (inv) => {
    const docId = inv.id || inv.n_doc || inv.numero_documento;
    if (!docId) return;
    if (!window.confirm(`¿Seguro de que deseas eliminar la factura ${inv.n_doc}?`)) return;
    try {
      await api.delete(`/invoices/${encodeURIComponent(docId)}`);
      setInvoices((prev) => prev.filter((x) => (x.id || x.n_doc) !== docId && x.n_doc !== inv.n_doc));
      toast.success(`Factura ${inv.n_doc} eliminada.`);
      const params = empresa ? { empresa } : {};
      api.get("/account-state", { params }).then((r) => setState(r.data)).catch(() => {});
    } catch (err) {
      toast.error("Error al eliminar la factura: " + (err.response?.data?.detail || err.message));
    }
  };


  if (loading || !state) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="w-10 h-10 border-4 border-brand border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6" data-testid="estado-cuenta-page">
      {/* Header con filtro empresa para admin */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-2 text-xs text-neutral-500 font-semibold">
          <Clock className="w-3.5 h-3.5" />
          Información generada el <span className="font-bold text-neutral-800">{new Date().toLocaleString("es-PE")}</span>
        </div>
        {user?.role === "admin_enered" && empresas.length > 0 && (
          <select
            value={empresa}
            onChange={(e) => setEmpresa(e.target.value)}
            className="h-10 px-3 border border-border rounded-md bg-white text-sm font-semibold min-w-[220px]"
            data-testid="ec-empresa-filter"
          >
            <option value="">Todas las empresas</option>
            {empresas.map((e) => <option key={e} value={e}>{e}</option>)}
          </select>
        )}
      </div>

      {/* CARD PRINCIPAL: KPIs + Donut a la izquierda · botones violetas verticales a la derecha */}
      <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1500px)_280px] gap-5">
        <div className="bg-white border border-neutral-200 rounded-2xl p-7 w-full">
          <h2 className="font-cabinet font-black text-[32px] text-brand mb-6 leading-tight">Estado de Cuenta</h2>

          <div className="grid grid-cols-1 lg:grid-cols-[1fr_400px] gap-6 items-center">
            {/* KPIs en 2 columnas con divisores */}
            <div className="space-y-5">
              <div className="grid grid-cols-2 gap-x-10">
                <KpiRow label="Línea de Crédito Total" value={formatSoles(state.linea_credito_total)} testid="ec-linea-total" />
                <KpiRow label="Disponible (Libre)" value={formatSoles(state.disponible)} testid="ec-disponible" highlight />
              </div>
              <div className="border-t border-neutral-200" />
              <div className="grid grid-cols-2 gap-x-10">
                <KpiRow label="Línea de Crédito Utilizada" value={formatSoles(state.linea_credito_utilizada)} testid="ec-utilizada" />
                <KpiRow label="Notas de Despacho" value={formatSoles(state.notas_despacho)} testid="ec-notas-despacho" />
              </div>
              <div className="border-t border-neutral-200" />
              <div className="grid grid-cols-2 gap-x-10">
                <KpiRow label="Total Facturado" value={formatSoles(state.total_facturado)} testid="ec-total-facturado" />
                <KpiRow label="% Línea Utilizada" value={`${state.pct_utilizada}%`} testid="ec-pct" />
              </div>
              <div className="border-t border-neutral-200" />
              <div className="grid grid-cols-2 gap-x-10">
                <KpiRow label="Total Vencido" value={formatSoles(state.total_vencido)} testid="ec-vencido" danger={state.total_vencido > 0} />
                <KpiRow label="Condición de Pago Crédito" value={`${state.dias_credito} días`} testid="ec-dias-credito" />
              </div>
            </div>

            {/* Donut a la derecha del card */}
            <div className="w-full" data-testid="ec-donut">
              {donutData.length === 0 ? (
                <div className="text-sm text-neutral-400 text-center pt-20">Sin datos</div>
              ) : (
                <>
                  <div className="relative w-full h-[280px]">
                    <ResponsiveContainer width="100%" height={280}>
                      <PieChart>
                        <Pie
                          data={donutData}
                          dataKey="value"
                          nameKey="name"
                          cx="50%"
                          cy="50%"
                          innerRadius={92}
                          outerRadius={135}
                          paddingAngle={2}
                          startAngle={90}
                          endAngle={-270}
                          stroke="#fff"
                          strokeWidth={2}
                        >
                          {donutData.map((d, i) => <Cell key={i} fill={d.color} />)}
                        </Pie>
                        <Tooltip formatter={(v) => formatSoles(v)} contentStyle={{ borderRadius: 8, fontSize: 12 }} />
                      </PieChart>
                    </ResponsiveContainer>
                    {/* Label centrado en el hueco del donut */}
                    <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                      <div className="text-[10px] uppercase tracking-widest text-neutral-400 font-bold">Línea Total</div>
                      <div className="font-cabinet font-black text-[24px] text-neutral-900 leading-tight mt-1">
                        {formatSoles(state.linea_credito_total)}
                      </div>
                    </div>
                  </div>
                  {/* Leyenda limpia debajo del donut */}
                  <div className="mt-3 space-y-1.5 px-1">
                    {donutData.map((d) => (
                      <div key={d.name} className="flex items-center justify-between text-xs">
                        <div className="flex items-center gap-2 min-w-0">
                          <span className="w-3 h-3 rounded-sm flex-shrink-0" style={{ background: d.color }} />
                          <span className="text-neutral-600 font-semibold truncate">{d.name}</span>
                        </div>
                        <span className="font-bold text-neutral-900 ml-2 flex-shrink-0">{formatSoles(d.value)}</span>
                      </div>
                    ))}
                  </div>
                </>
              )}
            </div>
          </div>
        </div>

        {/* Acciones laterales (columna vertical) */}
        <div className="flex flex-col gap-4">
          <ActionCard onClick={downloadStatePDF} icon={Download} title="Descarga tu" subtitle="estado de cuenta" testid="ec-action-download" />
          <ActionCardLarge onClick={() => navigate("/facturacion/historial")} icon={Search} title="Consulta tu historial" body="Consulta y descarga documentos de tipo pdf, Excel, etc." cta="Consultar" testid="ec-action-historial" />
          <ActionCardLarge onClick={() => setAbonoModalOpen(true)} icon={FileSpreadsheet} title="Registrar un abono" body="Sube tu comprobante de pago para pagar facturas o cargar saldo prepago." cta="Registrar" testid="ec-action-abono" />
          <ActionCardLarge onClick={() => window.open(WA_LINK, "_blank")} icon={BookOpen} title="Aprende a realizar el pago masivo de tus facturas" body="Conoce cómo hacerlo paso a paso" cta="Aprende cómo" testid="ec-action-aprende" />
        </div>
      </div>
      
      {/* TABS: Facturas vs Historial de Movimientos */}
      <div className="flex items-center gap-4 border-b border-neutral-200">
        <button
          onClick={() => setActiveTab("facturas")}
          className={`pb-3 font-semibold text-sm transition-colors relative ${activeTab === "facturas" ? "text-brand" : "text-neutral-500 hover:text-neutral-700"}`}
        >
          Documentos Pendientes
          {activeTab === "facturas" && <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-brand rounded-t-full" />}
        </button>
        <button
          onClick={() => setActiveTab("historial")}
          className={`pb-3 font-semibold text-sm transition-colors relative ${activeTab === "historial" ? "text-brand" : "text-neutral-500 hover:text-neutral-700"}`}
        >
          Historial de Movimientos
          {activeTab === "historial" && <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-brand rounded-t-full" />}
        </button>
      </div>

      {activeTab === "facturas" && (
        <div className="rounded-2xl overflow-hidden border border-brand/30">
          <div className="bg-brand text-white px-5 py-4 text-sm font-semibold space-y-1">
            <div>Detalle de los documentos pendientes de pago (vencido y por vencer)</div>
            <div className="text-xs text-white/80">(*) Monto total incluye IGV y/o percepción (según corresponda).</div>
          </div>
          <div className="overflow-x-auto bg-white">
            <table className="w-full text-sm" data-testid="ec-table">
              <thead className="bg-[#1E1B4B] text-white">
                <tr className="text-[11px] font-bold uppercase tracking-wider">
                  {user?.role === "admin_enered" && <th className="px-3 py-3 text-left">Cliente / Empresa</th>}
                  <th className="px-3 py-3 text-left">Producto</th>
                  <th className="px-3 py-3 text-left">Tipo Doc</th>
                  <th className="px-3 py-3 text-left">N° Doc</th>
                  <th className="px-3 py-3 text-left">F. Emisión</th>
                  <th className="px-3 py-3 text-left">F. Vencimiento</th>
                  <th className="px-3 py-3 text-right">Atraso</th>
                  <th className="px-3 py-3 text-center">Moneda</th>
                  <th className="px-3 py-3 text-right">Monto Total</th>
                  <th className="px-3 py-3 text-right">Saldo</th>
                  <th className="px-3 py-3 text-center">Estado</th>
                  <th className="px-3 py-3 text-center">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-100">
                {pageRows.length === 0 ? (
                  <tr><td colSpan={user?.role === "admin_enered" ? 12 : 11} className="text-center py-12 text-neutral-400">
                    <FileText className="w-10 h-10 mx-auto mb-2 text-neutral-300" />
                    Sin documentos pendientes
                  </td></tr>
                ) : (
                  pageRows.map((inv) => (
                    <tr key={inv.id || inv.n_doc} className="hover:bg-neutral-50">
                      {user?.role === "admin_enered" && (
                        <td className="px-3 py-2.5 font-semibold text-neutral-800 truncate max-w-[160px]" title={inv.empresa}>
                          {inv.empresa || "—"}
                        </td>
                      )}
                      <td className="px-3 py-2.5 truncate max-w-[150px]">{inv.producto || "—"}</td>
                      <td className="px-3 py-2.5">{inv.tipo_doc || "—"}</td>
                      <td className="px-3 py-2.5 font-mono font-bold text-brand">{inv.n_doc}</td>
                      <td className="px-3 py-2.5">{formatDate(inv.f_emision) || "—"}</td>
                      <td className="px-3 py-2.5">{formatDate(inv.f_vencimiento) || "—"}</td>
                      <td className="px-3 py-2.5 text-right">{calculateAtrasoDias(inv)} días</td>
                      <td className="px-3 py-2.5 text-center text-xs font-bold">{inv.moneda || "PEN"}</td>
                      <td className="px-3 py-2.5 text-right font-bold">{formatSoles(inv.monto_total)}</td>
                      <td className="px-3 py-2.5 text-right font-bold">{formatSoles(inv.saldo)}</td>
                      <td className="px-3 py-2.5 text-center">
                        {user?.role === "admin_enered" ? (
                          <EstadoEditor
                            inv={inv}
                            onUpdated={(newEstado) => {
                              setInvoices((prev) => prev.map((x) => x.n_doc === inv.n_doc ? { ...x, estado: newEstado } : x));
                              const params = empresa ? { empresa } : {};
                              api.get("/account-state", { params }).then((r) => setState(r.data)).catch(() => {});
                            }}
                          />
                        ) : (
                          <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${ESTADO_BADGE[inv.estado] || "bg-neutral-100 text-neutral-600 border-neutral-200"}`}>
                            {ESTADO_LABEL[inv.estado] || (inv.estado || "—").toUpperCase().replace("_", " ")}
                          </span>
                        )}
                      </td>
                      <td className="px-3 py-2.5">
                        <div className="flex items-center justify-center gap-1.5">
                          <button onClick={() => viewInvoice(inv, "pdf")} className="p-1.5 hover:bg-brand-50 text-brand rounded-md" title="Visualizar PDF" data-testid={`ec-view-pdf-${inv.n_doc}`}>
                            <Eye className="w-4 h-4" />
                          </button>
                          <button onClick={() => downloadInvoice(inv, "pdf")} className="p-1.5 hover:bg-brand-50 text-brand rounded-md" title="Descargar PDF" data-testid={`ec-download-pdf-${inv.n_doc}`}>
                            <FileText className="w-4 h-4" />
                          </button>
                          {inv.xml_filename && (
                            <button onClick={() => downloadInvoice(inv, "xml")} className="p-1.5 hover:bg-cyan-50 text-cyan-600 rounded-md" title="Descargar XML" data-testid={`ec-download-xml-${inv.n_doc}`}>
                              <FileSpreadsheet className="w-4 h-4" />
                            </button>
                          )}
                          {user?.role === "admin_enered" && (
                            <>
                              <button onClick={() => setEditingInv(inv)} className="p-1.5 hover:bg-amber-50 text-amber-600 rounded-md" title="Editar Factura" data-testid={`ec-edit-invoice-${inv.n_doc}`}>
                                <Edit3 className="w-4 h-4" />
                              </button>
                              <button onClick={() => setUploadingInv(inv)} className="p-1.5 hover:bg-blue-50 text-blue-600 rounded-md" title="Volver a Cargar Documento (PDF/XML)" data-testid={`ec-upload-doc-${inv.n_doc}`}>
                                <Upload className="w-4 h-4" />
                              </button>
                              <button onClick={() => handleDelete(inv)} className="p-1.5 hover:bg-red-50 text-red-600 rounded-md" title="Eliminar Factura" data-testid={`ec-delete-invoice-${inv.n_doc}`}>
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
          {invoices.length > 0 && (
            <div className="flex items-center justify-between px-4 py-3 border-t border-neutral-100 bg-neutral-50 text-xs">
              <div className="text-neutral-500 font-semibold">
                {(page - 1) * PAGE_SIZE + 1}-{Math.min(page * PAGE_SIZE, invoices.length)} de {invoices.length} registros
              </div>
              <div className="flex items-center gap-2">
                <button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1} className="px-2 py-1 border border-border rounded font-bold disabled:opacity-30">‹</button>
                <span className="font-bold">{page}/{totalPages}</span>
                <button onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={page === totalPages} className="px-2 py-1 border border-border rounded font-bold disabled:opacity-30">›</button>
              </div>
            </div>
          )}
        </div>
      )}

      {activeTab === "historial" && (
        <div className="rounded-2xl overflow-hidden border border-neutral-200">
          <div className="bg-neutral-100 text-neutral-800 px-5 py-4 text-sm font-semibold space-y-1">
            <div>Historial de Transacciones y Abonos</div>
          </div>
          <div className="overflow-x-auto bg-white">
            <table className="w-full text-left text-sm whitespace-nowrap">
              <thead className="bg-neutral-50 text-neutral-500 font-semibold border-b border-neutral-200">
                <tr>
                  <th className="px-5 py-3">Fecha</th>
                  <th className="px-5 py-3">Tipo</th>
                  <th className="px-5 py-3">Descripción</th>
                  <th className="px-5 py-3">Monto (S/)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-100">
                {historial.map((h) => (
                  <tr key={h.id} className="hover:bg-neutral-50 transition-colors">
                    <td className="px-5 py-4 text-neutral-500 font-medium">{new Date(h.created_at).toLocaleString("es-PE")}</td>
                    <td className="px-5 py-4 font-bold text-neutral-700">{h.tipo.replace(/_/g, " ")}</td>
                    <td className="px-5 py-4 text-neutral-600">{h.descripcion}</td>
                    <td className="px-5 py-4 font-bold text-brand">{formatSoles(h.monto)}</td>
                  </tr>
                ))}
                {historial.length === 0 && (
                  <tr>
                    <td colSpan={4} className="px-5 py-10 text-center text-neutral-400 font-medium">No hay movimientos registrados.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Modal "Próximamente" */}
      {comingSoon && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={() => setComingSoon(false)}>
          <div className="bg-white rounded-2xl p-6 max-w-md w-full" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center gap-3 mb-3">
              <div className="w-10 h-10 rounded-full bg-cyan-100 text-cyan-600 flex items-center justify-center">
                {comingSoon === "email" ? <Mail className="w-5 h-5" /> : <Search className="w-5 h-5" />}
              </div>
              <h3 className="font-cabinet font-bold text-lg">Próximamente</h3>
            </div>
            <p className="text-sm text-neutral-600 mb-4">
              {comingSoon === "email"
                ? "El envío automático por correo de tu estado de cuenta estará disponible muy pronto. Mientras tanto puedes descargarlo en PDF."
                : "El historial avanzado de documentos llegará en la próxima versión. Por ahora todo se ve en la tabla principal."}
            </p>
            {comingSoon === "email" && (
              <input
                type="email"
                placeholder="tucorreo@empresa.com"
                value={emailInput}
                onChange={(e) => setEmailInput(e.target.value)}
                className="w-full h-10 px-3 border border-border rounded-md text-sm mb-3"
              />
            )}
            <div className="flex justify-end gap-2">
              <a href={WA_LINK} target="_blank" rel="noreferrer" className="text-xs font-bold text-brand hover:underline flex items-center gap-1 mr-auto">
                <MessageCircle className="w-3 h-3" /> Hablar con un asesor
              </a>
              <button onClick={() => setComingSoon(false)} className="btn-brand text-sm">Entendido</button>
            </div>
          </div>
        </div>
      )}
      
      <AbonoModal 
        open={abonoModalOpen} 
        onClose={() => setAbonoModalOpen(false)} 
        onSuccess={() => {
          const params = empresa ? { empresa } : {};
          api.get("/account-state", { params }).then(r => setState(r.data));
        }} 
      />

      {editingInv && (
        <EditInvoiceModal
          inv={editingInv}
          empresas={empresas}
          onClose={() => setEditingInv(null)}
          onSaved={() => {
            const params = empresa ? { empresa } : {};
            api.get("/account-state", { params }).then((r) => setState(r.data)).catch(() => {});
            api.get("/invoices", { params }).then((r) => setInvoices(r.data)).catch(() => {});
          }}
        />
      )}

      {uploadingInv && (
        <ReuploadDocumentModal
          inv={uploadingInv}
          onClose={() => setUploadingInv(null)}
          onSaved={() => {
            const params = empresa ? { empresa } : {};
            api.get("/invoices", { params }).then((r) => setInvoices(r.data)).catch(() => {});
          }}
        />
      )}

      <PdfViewerModal
        open={viewerOpen}
        url={viewerUrl}
        title={viewerTitle}
        onClose={() => {
          setViewerOpen(false);
          if (viewerUrl) URL.revokeObjectURL(viewerUrl);
          setViewerUrl("");
        }}
        onDownload={() => {
          if (viewerDoc?.inv) {
            downloadInvoice(viewerDoc.inv, viewerDoc.kind || "pdf");
          }
        }}
      />
    </div>
  );
}

function KpiRow({ label, value, highlight = false, danger = false, testid }) {
  return (
    <div data-testid={testid}>
      <div className="text-sm text-neutral-600 font-medium">{label}</div>
      <div className={`font-cabinet font-black text-2xl mt-0.5 ${danger ? "text-red-600" : highlight ? "text-brand" : "text-neutral-900"}`}>
        {value}
      </div>
    </div>
  );
}

function ActionCard({ onClick, icon: Icon, title, subtitle, testid }) {
  return (
    <button
      onClick={onClick}
      data-testid={testid}
      className="bg-brand text-white rounded-2xl p-5 flex items-start justify-between gap-3 hover:bg-brand-hover transition-all hover:-translate-y-0.5 shadow-sm hover:shadow-md text-left min-h-[110px]"
    >
      <div>
        <div className="font-cabinet font-bold text-base leading-tight">{title}</div>
        <div className="text-sm text-white/85 leading-tight mt-0.5">{subtitle}</div>
      </div>
      <Icon className="w-7 h-7 text-white/95 flex-shrink-0" strokeWidth={1.75} />
    </button>
  );
}

function ActionCardEmail({ onClick, testid }) {
  const [email, setEmail] = React.useState("");
  return (
    <div data-testid={testid} className="bg-brand text-white rounded-2xl p-5 min-h-[110px]">
      <div className="font-cabinet font-bold text-base leading-tight mb-3">Enviar estado de cuenta</div>
      <div className="flex items-stretch gap-0 rounded-md overflow-hidden bg-white/10">
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="Ingresa el Correo"
          className="flex-1 h-9 px-3 bg-white text-neutral-800 text-xs font-medium outline-none placeholder:text-neutral-400"
        />
        <button
          onClick={() => onClick && onClick(email)}
          className="px-3 h-9 bg-[#5A1E96] text-white text-xs font-bold hover:bg-[#4A1880]"
        >
          Enviar
        </button>
      </div>
    </div>
  );
}

function ActionCardLarge({ onClick, icon: Icon, title, body, cta, testid }) {
  return (
    <div data-testid={testid} className="bg-brand text-white rounded-2xl p-5 min-h-[140px] flex flex-col">
      <div className="font-cabinet font-bold text-base leading-tight mb-1.5">{title}</div>
      <div className="text-xs text-white/80 leading-snug flex-1">{body}</div>
      <button
        onClick={onClick}
        className="mt-3 self-start h-8 px-3 rounded-md bg-[#5A1E96] hover:bg-[#4A1880] text-white text-xs font-bold flex items-center gap-1.5"
      >
        <Icon className="w-3.5 h-3.5" strokeWidth={2} />
        {cta}
      </button>
    </div>
  );
}


/* ---------------- Editor inline de estado (admin_enered) ---------------- */
function EstadoEditor({ inv, onUpdated }) {
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const ref = React.useRef(null);

  // Cerrar al click fuera
  React.useEffect(() => {
    if (!open) return;
    const onDoc = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [open]);

  const change = async (nuevo) => {
    if (nuevo === inv.estado) { setOpen(false); return; }
    const docId = inv.id || inv.n_doc || inv.numero_documento;
    if (!docId) return;
    setSaving(true);
    try {
      await api.put(`/invoices/${encodeURIComponent(docId)}`, { estado: nuevo });
      onUpdated && onUpdated(nuevo);
      toast.success(`Estado cambiado a ${nuevo.toUpperCase()}`);
    } catch (e) {
      toast.error("Error al cambiar estado: " + (e.response?.data?.detail || e.message));
    } finally {
      setSaving(false);
      setOpen(false);
    }
  };

  const opts = [
    { v: "pagada", label: "PAGADA", cls: "bg-green-50 text-green-700 border-green-200" },
    { v: "pendiente", label: "PENDIENTE", cls: "bg-amber-50 text-amber-700 border-amber-200" },
    { v: "vencida", label: "VENCIDA", cls: "bg-red-100 text-red-700 border-red-200" },
  ];
  const currentCls = ESTADO_BADGE[inv.estado] || "bg-neutral-100 text-neutral-600 border-neutral-200";
  const currentLbl = ESTADO_LABEL[inv.estado] || (inv.estado || "—").toUpperCase().replace("_", " ");

  return (
    <div className="relative inline-block" ref={ref}>
      <button
        onClick={(e) => { e.stopPropagation(); setOpen((o) => !o); }}
        disabled={saving}
        className={`px-2 py-0.5 rounded-full text-[10px] font-bold border cursor-pointer hover:ring-2 hover:ring-offset-1 hover:ring-brand transition disabled:opacity-50 ${currentCls}`}
        title="Cambiar estado"
      >
        {saving ? "..." : currentLbl} ▾
      </button>
      {open && (
        <div className="absolute z-20 mt-1 right-0 bg-white border border-neutral-200 rounded-lg shadow-lg py-1 min-w-[120px]">
          {opts.map((o) => (
            <button
              key={o.v}
              onClick={(e) => { e.stopPropagation(); change(o.v); }}
              className={`block w-full text-left px-3 py-1.5 text-[11px] font-bold hover:bg-neutral-50 ${
                inv.estado === o.v ? "ring-1 ring-inset ring-brand" : ""
              }`}
            >
              <span className={`inline-block px-2 py-0.5 rounded-full border text-[10px] ${o.cls}`}>{o.label}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

/* ---------------- Modal de Registro de Abono ---------------- */
export function AbonoModal({ open, onClose, onSuccess }) {
  const [monto, setMonto] = useState("");
  const [fecha, setFecha] = useState("");
  const [nroOp, setNroOp] = useState("");
  const [file, setFile] = useState(null);
  const [saving, setSaving] = useState(false);

  if (!open) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!monto || !fecha || !nroOp || !file) {
      toast.error("Por favor completa todos los campos y sube el voucher.");
      return;
    }
    setSaving(true);
    try {
      const fd = new FormData();
      fd.append("monto", monto);
      fd.append("fecha_deposito", fecha);
      fd.append("numero_operacion", nroOp);
      fd.append("file", file);

      await api.post("/abonos", fd, { headers: { "Content-Type": "multipart/form-data" } });
      toast.success("Abono registrado correctamente. En breve será validado.");
      onSuccess && onSuccess();
      onClose();
    } catch (err) {
      toast.error("Error al registrar el abono: " + (err.response?.data?.detail || err.message));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-neutral-900/50 p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden">
        <div className="flex justify-between items-center p-5 border-b border-neutral-100">
          <h3 className="font-cabinet font-bold text-lg text-brand">Registrar un Abono</h3>
          <button onClick={onClose} className="p-1 hover:bg-neutral-100 rounded-full text-neutral-400">
            <X className="w-5 h-5" />
          </button>
        </div>
        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          <div>
            <label className="block text-sm font-semibold text-neutral-700 mb-1">Monto depositado (S/)</label>
            <input type="number" step="0.01" min="0" required value={monto} onChange={e => setMonto(e.target.value)} className="w-full h-10 px-3 border border-neutral-200 rounded-lg text-sm focus:ring-2 focus:ring-brand focus:border-transparent outline-none" placeholder="0.00" />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-semibold text-neutral-700 mb-1">Fecha de pago</label>
              <input type="date" required value={fecha} onChange={e => setFecha(e.target.value)} className="w-full h-10 px-3 border border-neutral-200 rounded-lg text-sm focus:ring-2 focus:ring-brand outline-none" />
            </div>
            <div>
              <label className="block text-sm font-semibold text-neutral-700 mb-1">Nro. de Operación</label>
              <input type="text" required value={nroOp} onChange={e => setNroOp(e.target.value)} className="w-full h-10 px-3 border border-neutral-200 rounded-lg text-sm focus:ring-2 focus:ring-brand outline-none" placeholder="Ej. 1234567" />
            </div>
          </div>
          <div>
            <label className="block text-sm font-semibold text-neutral-700 mb-1">Voucher de Pago (PDF, JPG, PNG)</label>
            <input type="file" required accept=".pdf,image/*" onChange={e => setFile(e.target.files[0])} className="w-full text-sm text-neutral-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-brand/10 file:text-brand hover:file:bg-brand/20 outline-none" />
          </div>
          <button type="submit" disabled={saving} className="w-full mt-2 h-11 bg-brand text-white rounded-xl font-bold hover:bg-brand/90 transition-colors disabled:opacity-50 flex items-center justify-center">
            {saving ? <Loader2 className="w-5 h-5 animate-spin" /> : "Registrar Abono"}
          </button>
        </form>
      </div>
    </div>
  );
}

function EditInvoiceModal({ inv, empresas, onClose, onSaved }) {
  const toIsoDate = (d) => {
    if (!d) return "";
    let str = String(d).trim();
    if (str.length > 10 && str.includes("T")) str = str.split("T")[0];
    if (str.includes("/")) {
      const parts = str.split("/");
      if (parts.length === 3 && parts[2].length === 4) {
        return `${parts[2]}-${parts[1].padStart(2, '0')}-${parts[0].padStart(2, '0')}`;
      }
    }
    return str.slice(0, 10);
  };

  const [form, setForm] = useState({
    n_doc: inv.n_doc || inv.numero_documento || "",
    empresa: inv.empresa || "",
    f_emision: toIsoDate(inv.f_emision || inv.fecha),
    f_vencimiento: toIsoDate(inv.f_vencimiento || inv.fecha_vencimiento),
    monto_total: inv.monto_total || 0,
    saldo: inv.saldo || 0,
    estado: inv.estado || "pendiente",
    producto: inv.producto || "DIESEL B5 S-50",
  });
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    const docId = inv.id || inv.n_doc || inv.numero_documento;
    if (!docId) return;
    setSaving(true);
    try {
      await api.put(`/invoices/${encodeURIComponent(docId)}`, form);
      toast.success("Factura actualizada correctamente.");
      onSaved();
      onClose();
    } catch (err) {
      const detail = err.response?.data?.detail;
      const msg = detail ? (typeof detail === "string" ? detail : JSON.stringify(detail)) : err.message;
      toast.error("Error actualizando factura: " + msg);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-neutral-900/50 p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg overflow-hidden">
        <div className="flex justify-between items-center p-5 border-b border-neutral-100">
          <h3 className="font-cabinet font-bold text-lg text-brand">Editar Factura {inv.n_doc}</h3>
          <button onClick={onClose} className="p-1 hover:bg-neutral-100 rounded-full text-neutral-400">
            <X className="w-5 h-5" />
          </button>
        </div>
        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-neutral-700 mb-1">N° Documento</label>
              <input type="text" value={form.n_doc} onChange={e => setForm({ ...form, n_doc: e.target.value })} className="w-full h-10 px-3 border border-neutral-200 rounded-lg text-sm outline-none" required />
            </div>
            <div>
              <label className="block text-xs font-bold text-neutral-700 mb-1">Empresa / Cliente</label>
              <select value={form.empresa} onChange={e => setForm({ ...form, empresa: e.target.value })} className="w-full h-10 px-3 border border-neutral-200 rounded-lg text-sm bg-white font-medium outline-none" required>
                <option value="">Seleccionar empresa...</option>
                {empresas.map(e => <option key={e} value={e}>{e}</option>)}
              </select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-neutral-700 mb-1">F. Emisión</label>
              <input type="date" value={form.f_emision} onChange={e => setForm({ ...form, f_emision: e.target.value })} className="w-full h-10 px-3 border border-neutral-200 rounded-lg text-sm outline-none" />
            </div>
            <div>
              <label className="block text-xs font-bold text-neutral-700 mb-1">F. Vencimiento</label>
              <input type="date" value={form.f_vencimiento} onChange={e => setForm({ ...form, f_vencimiento: e.target.value })} className="w-full h-10 px-3 border border-neutral-200 rounded-lg text-sm outline-none" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-neutral-700 mb-1">Monto Total (S/)</label>
              <input type="number" step="0.01" value={form.monto_total} onChange={e => setForm({ ...form, monto_total: parseFloat(e.target.value) || 0 })} className="w-full h-10 px-3 border border-neutral-200 rounded-lg text-sm outline-none" required />
            </div>
            <div>
              <label className="block text-xs font-bold text-neutral-700 mb-1">Saldo (S/)</label>
              <input type="number" step="0.01" value={form.saldo} onChange={e => setForm({ ...form, saldo: parseFloat(e.target.value) || 0 })} className="w-full h-10 px-3 border border-neutral-200 rounded-lg text-sm outline-none" required />
            </div>
          </div>
          <div>
            <label className="block text-xs font-bold text-neutral-700 mb-1">Estado</label>
            <select value={form.estado} onChange={e => setForm({ ...form, estado: e.target.value })} className="w-full h-10 px-3 border border-neutral-200 rounded-lg text-sm bg-white font-medium outline-none">
              <option value="pendiente">PENDIENTE</option>
              <option value="pagada">PAGADA</option>
              <option value="vencida">VENCIDA</option>
              <option value="TERCERO">TERCERO</option>
            </select>
          </div>
          <button type="submit" disabled={saving} className="w-full mt-2 h-11 bg-brand text-white rounded-xl font-bold hover:bg-brand/90 transition-colors disabled:opacity-50 flex items-center justify-center">
            {saving ? <Loader2 className="w-5 h-5 animate-spin" /> : "Guardar Cambios"}
          </button>
        </form>
      </div>
    </div>
  );
}

function ReuploadDocumentModal({ inv, onClose, onSaved }) {
  const [kind, setKind] = useState("pdf");
  const [file, setFile] = useState(null);
  const [uploading, setUploading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!file) return toast.error("Por favor selecciona un archivo");
    const docId = inv.id || inv.n_doc || inv.numero_documento;
    if (!docId) return;
    setUploading(true);
    const fd = new FormData();
    fd.append("kind", kind);
    fd.append("file", file);

    try {
      await api.post(`/admin/invoices/${encodeURIComponent(docId)}/upload-file`, fd);
      toast.success(`Archivo ${kind.toUpperCase()} cargado y asociado a la factura ${inv.n_doc}.`);
      onSaved();
      onClose();
    } catch (err) {
      toast.error("Error al cargar documento: " + (err.response?.data?.detail || err.message));
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-neutral-900/50 p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden">
        <div className="flex justify-between items-center p-5 border-b border-neutral-100">
          <h3 className="font-cabinet font-bold text-lg text-brand">Reemplazar / Cargar Documento</h3>
          <button onClick={onClose} className="p-1 hover:bg-neutral-100 rounded-full text-neutral-400">
            <X className="w-5 h-5" />
          </button>
        </div>
        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          <div>
            <div className="text-xs font-bold text-neutral-500 mb-1">FACTURA</div>
            <div className="text-base font-bold text-neutral-800">{inv.n_doc} ({inv.empresa || "—"})</div>
          </div>
          <div>
            <label className="block text-xs font-bold text-neutral-700 mb-2">Tipo de Archivo</label>
            <div className="flex gap-4">
              <label className="flex items-center gap-2 cursor-pointer text-sm font-semibold text-neutral-700">
                <input type="radio" name="kind" value="pdf" checked={kind === "pdf"} onChange={() => setKind("pdf")} />
                Archivo PDF (.pdf)
              </label>
              <label className="flex items-center gap-2 cursor-pointer text-sm font-semibold text-neutral-700">
                <input type="radio" name="kind" value="xml" checked={kind === "xml"} onChange={() => setKind("xml")} />
                Archivo XML (.xml)
              </label>
            </div>
          </div>
          <div>
            <label className="block text-xs font-bold text-neutral-700 mb-1">Seleccionar Documento ({kind.toUpperCase()})</label>
            <input type="file" required accept={kind === "pdf" ? ".pdf" : ".xml"} onChange={e => setFile(e.target.files[0])} className="w-full text-sm text-neutral-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-brand/10 file:text-brand hover:file:bg-brand/20 outline-none" />
          </div>
          <button type="submit" disabled={uploading} className="w-full mt-2 h-11 bg-brand text-white rounded-xl font-bold hover:bg-brand/90 transition-colors disabled:opacity-50 flex items-center justify-center gap-2">
            {uploading ? <Loader2 className="w-5 h-5 animate-spin" /> : <><Upload className="w-4 h-4" /> Subir y Reemplazar Documento</>}
          </button>
        </form>
      </div>
    </div>
  );
}
