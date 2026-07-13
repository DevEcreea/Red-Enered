import React, { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Search, Download, ChevronDown, FileText, FileSpreadsheet, AlertCircle, Inbox } from "lucide-react";
import { api } from "../lib/api";
import { formatSoles, formatDate } from "../lib/utils";
import { useAuth } from "../context/AuthContext";
import { toast } from "sonner";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import * as XLSX from "xlsx";
import PdfViewerModal from "../components/PdfViewerModal";

const ESTADO_TEXT_COLOR = {
  pagada: "text-green-600",
  pendiente: "text-amber-600",
  vencida: "text-red-600",
  pagado: "text-green-600",
  por_vencer: "text-amber-600",
  vencido: "text-red-600",
};
const ESTADO_LABEL = {
  pagada: "PAGADO", pendiente: "POR VENCER", vencida: "VENCIDO",
  pagado: "PAGADO", por_vencer: "POR VENCER", vencido: "VENCIDO",
};

const TIPO_DOC_LABEL = {
  "01": "Factura",
  "03": "Boleta",
  "07": "Nota Crédito",
  "08": "Nota Débito",
};

export default function EstadoCuentaHistorial() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [empresas, setEmpresas] = useState([]);
  const [allInvoices, setAllInvoices] = useState([]);
  const [loading, setLoading] = useState(false);
  const [exportOpen, setExportOpen] = useState(false);
  const [viewerOpen, setViewerOpen] = useState(false);
  const [viewerUrl, setViewerUrl] = useState(null);
  const [viewerTitle, setViewerTitle] = useState("");
  const [viewerDoc, setViewerDoc] = useState(null);

  // Filtros
  const [fEmpresa, setFEmpresa] = useState("");
  const [fEstado, setFEstado] = useState("todos");
  const [fTipoDoc, setFTipoDoc] = useState("todos");
  const [fSerie, setFSerie] = useState("");
  const [fCorrelativo, setFCorrelativo] = useState("");
  const [fFechaIni, setFFechaIni] = useState("");
  const [fFechaFin, setFFechaFin] = useState("");
  const [resultadosVisibles, setResultadosVisibles] = useState(false);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [generatedAt, setGeneratedAt] = useState(null);

  useEffect(() => {
    if (user?.role === "admin_enered") {
      api.get("/empresas").then((r) => setEmpresas(r.data)).catch(() => {});
    }
  }, [user]);

  // Carga inicial de facturas (para tener el universo a filtrar)
  useEffect(() => {
    setLoading(true);
    const params = fEmpresa ? { empresa: fEmpresa } : {};
    api.get("/invoices", { params })
      .then((r) => setAllInvoices(r.data || []))
      .catch(() => setAllInvoices([]))
      .finally(() => setLoading(false));
  }, [fEmpresa]);

  // Aplica filtros client-side
  const filteredInvoices = useMemo(() => {
    return (allInvoices || []).filter((inv) => {
      // Estado
      if (fEstado !== "todos") {
        const e = (inv.estado || "").toLowerCase();
        const map = { pagada: ["pagada", "pagado"], pendiente: ["pendiente", "por_vencer"], vencida: ["vencida", "vencido"] };
        if (!(map[fEstado] || []).includes(e)) return false;
      }
      // Tipo doc
      if (fTipoDoc !== "todos") {
        if ((inv.tipo_doc || "01") !== fTipoDoc) return false;
      }
      // Serie + Correlativo: parsear inv.n_doc tipo "F003-00000217"
      const ndoc = (inv.n_doc || "").toUpperCase();
      const partes = ndoc.split("-");
      const serie = partes[0] || "";
      const corr = partes[1] || "";
      if (fSerie && !serie.includes(fSerie.toUpperCase())) return false;
      if (fCorrelativo && !corr.includes(fCorrelativo)) return false;
      // Fechas
      if (fFechaIni && inv.f_emision && inv.f_emision < fFechaIni) return false;
      if (fFechaFin && inv.f_emision && inv.f_emision > fFechaFin) return false;
      return true;
    });
  }, [allInvoices, fEstado, fTipoDoc, fSerie, fCorrelativo, fFechaIni, fFechaFin]);

  const consultar = () => {
    setResultadosVisibles(true);
    setPage(1);
    setGeneratedAt(new Date());
  };

  const limpiar = () => {
    setFEmpresa("");
    setFEstado("todos");
    setFTipoDoc("todos");
    setFSerie("");
    setFCorrelativo("");
    setFFechaIni("");
    setFFechaFin("");
    setResultadosVisibles(false);
  };

  const dataParaExportar = () => filteredInvoices.map((inv) => ({
    "Empresa": inv.empresa || "",
    "Tipo Doc": TIPO_DOC_LABEL[inv.tipo_doc] || inv.tipo_doc || "",
    "N° Doc": inv.n_doc || "",
    "F. Emisión": inv.f_emision || "",
    "F. Vencimiento": inv.f_vencimiento || "",
    "Moneda": inv.moneda || "PEN",
    "Monto Total": inv.monto_total || 0,
    "Saldo": inv.saldo || 0,
    "Estado": ESTADO_LABEL[inv.estado] || inv.estado || "",
  }));

  const exportarExcel = () => {
    if (filteredInvoices.length === 0) { toast.error("Sin datos para exportar"); return; }
    const ws = XLSX.utils.json_to_sheet(dataParaExportar());
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Historial");
    XLSX.writeFile(wb, `historial_estado_cuenta_${new Date().toISOString().slice(0, 10)}.xlsx`);
    toast.success("Excel descargado");
    setExportOpen(false);
  };

  const exportarPDF = () => {
    if (filteredInvoices.length === 0) { toast.error("Sin datos para exportar"); return; }
    const doc = new jsPDF("landscape");
    doc.setFillColor(128, 57, 244); doc.rect(0, 0, 297, 22, "F");
    doc.setTextColor(255); doc.setFontSize(16); doc.text("ENERED", 14, 14);
    doc.setFontSize(10); doc.text("Historial · Estado de Cuenta - Detalle", 14, 19);
    doc.setTextColor(0);
    autoTable(doc, {
      startY: 28,
      head: [["Empresa", "Tipo Doc", "N° Doc", "F. Emisión", "F. Venc.", "Moneda", "Monto", "Saldo", "Estado"]],
      body: filteredInvoices.map((inv) => [
        inv.empresa || "",
        TIPO_DOC_LABEL[inv.tipo_doc] || inv.tipo_doc || "",
        inv.n_doc || "",
        inv.f_emision || "",
        inv.f_vencimiento || "",
        inv.moneda || "PEN",
        formatSoles(inv.monto_total || 0),
        formatSoles(inv.saldo || 0),
        ESTADO_LABEL[inv.estado] || inv.estado || "",
      ]),
      headStyles: { fillColor: [30, 27, 75] },
      styles: { fontSize: 8 },
    });
    doc.save(`historial_estado_cuenta_${new Date().toISOString().slice(0, 10)}.pdf`);
    toast.success("PDF descargado");
    setExportOpen(false);
  };

  const downloadDoc = async (id, kind) => {
    try {
      const res = await api.get(`/invoices/${id}/download/${kind}`, { responseType: "blob" });
      const url = URL.createObjectURL(res.data);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${id}.${kind === "pdf" ? "pdf" : "xml"}`;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      toast.error(`No hay ${kind.toUpperCase()} disponible para esta factura`);
    }
  };

  const viewDoc = async (id, kind) => {
    try {
      const res = await api.get(`/invoices/${id}/download/${kind}`, { responseType: "blob" });
      const url = URL.createObjectURL(res.data);
      setViewerUrl(url);
      setViewerTitle(`${id}.${kind}`);
      setViewerDoc({ id, kind });
      setViewerOpen(true);
    } catch {
      toast.error(`No hay ${kind.toUpperCase()} disponible para visualizar`);
    }
  };

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <button
          onClick={() => navigate("/facturacion")}
          className="w-10 h-10 rounded-full bg-white border border-neutral-200 hover:border-brand hover:text-brand flex items-center justify-center transition-colors"
          data-testid="historial-back"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>
        <h1 className="font-cabinet font-black text-[32px] text-brand leading-tight">
          Estado de Cuenta · Detalle
        </h1>
      </div>

      {/* CARD FILTROS */}
      <div className="bg-white border border-neutral-200 rounded-2xl p-6 shadow-sm">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
          {/* Cliente / Empresa */}
          {user?.role === "admin_enered" && (
            <div>
              <label className="text-[10px] font-bold uppercase tracking-widest text-neutral-500 mb-1 block">Cliente</label>
              <select
                value={fEmpresa}
                onChange={(e) => setFEmpresa(e.target.value)}
                className="h-11 w-full px-3 border border-neutral-300 rounded-md bg-white text-sm font-semibold focus:border-brand focus:ring-1 focus:ring-brand outline-none"
                data-testid="historial-filter-empresa"
              >
                <option value="">— Todas las empresas —</option>
                {empresas.map((e) => <option key={e} value={e}>{e}</option>)}
              </select>
            </div>
          )}

          <div>
            <label className="text-[10px] font-bold uppercase tracking-widest text-neutral-500 mb-1 block">Estado</label>
            <select
              value={fEstado}
              onChange={(e) => setFEstado(e.target.value)}
              className="h-11 w-full px-3 border border-neutral-300 rounded-md bg-white text-sm font-semibold focus:border-brand focus:ring-1 focus:ring-brand outline-none"
              data-testid="historial-filter-estado"
            >
              <option value="todos">Todos</option>
              <option value="pagada">Pagada</option>
              <option value="pendiente">Pendiente</option>
              <option value="vencida">Vencida</option>
            </select>
          </div>

          <div>
            <label className="text-[10px] font-bold uppercase tracking-widest text-neutral-500 mb-1 block">Documentos</label>
            <select
              value={fTipoDoc}
              onChange={(e) => setFTipoDoc(e.target.value)}
              className="h-11 w-full px-3 border border-neutral-300 rounded-md bg-white text-sm font-semibold focus:border-brand focus:ring-1 focus:ring-brand outline-none"
              data-testid="historial-filter-tipo"
            >
              <option value="todos">Todos</option>
              <option value="01">Factura</option>
              <option value="03">Boleta</option>
              <option value="07">Nota Crédito</option>
              <option value="08">Nota Débito</option>
            </select>
          </div>

          <div>
            <label className="text-[10px] font-bold uppercase tracking-widest text-neutral-500 mb-1 block">N° Serie</label>
            <input
              type="text"
              value={fSerie}
              onChange={(e) => setFSerie(e.target.value)}
              placeholder="ej. F003"
              className="h-11 w-full px-3 border border-neutral-300 rounded-md bg-white text-sm font-semibold focus:border-brand focus:ring-1 focus:ring-brand outline-none"
              data-testid="historial-filter-serie"
            />
          </div>

          <div>
            <label className="text-[10px] font-bold uppercase tracking-widest text-neutral-500 mb-1 block">Correlativo</label>
            <input
              type="text"
              value={fCorrelativo}
              onChange={(e) => setFCorrelativo(e.target.value)}
              placeholder="ej. 217"
              className="h-11 w-full px-3 border border-neutral-300 rounded-md bg-white text-sm font-semibold focus:border-brand focus:ring-1 focus:ring-brand outline-none"
              data-testid="historial-filter-correlativo"
            />
          </div>

          <div>
            <label className="text-[10px] font-bold uppercase tracking-widest text-neutral-500 mb-1 block">Fecha Inicial</label>
            <input
              type="date"
              value={fFechaIni}
              onChange={(e) => setFFechaIni(e.target.value)}
              className="h-11 w-full px-3 border border-neutral-300 rounded-md bg-white text-sm font-semibold focus:border-brand focus:ring-1 focus:ring-brand outline-none"
              data-testid="historial-filter-fini"
            />
          </div>

          <div>
            <label className="text-[10px] font-bold uppercase tracking-widest text-neutral-500 mb-1 block">Fecha Final</label>
            <input
              type="date"
              value={fFechaFin}
              onChange={(e) => setFFechaFin(e.target.value)}
              className="h-11 w-full px-3 border border-neutral-300 rounded-md bg-white text-sm font-semibold focus:border-brand focus:ring-1 focus:ring-brand outline-none"
              data-testid="historial-filter-ffin"
            />
          </div>

          {/* Botones */}
          <div className="flex gap-2 items-end">
            <button
              onClick={consultar}
              className="h-11 px-5 rounded-md bg-brand hover:bg-brand-700 text-white text-sm font-bold flex items-center gap-2 transition-colors"
              data-testid="historial-btn-consultar"
            >
              <Search className="w-4 h-4" />
              CONSULTAR
            </button>
            <div className="relative">
              <button
                onClick={() => setExportOpen((o) => !o)}
                className="h-11 px-4 rounded-md bg-white border border-neutral-300 hover:border-brand text-neutral-700 text-sm font-bold flex items-center gap-2 transition-colors"
                data-testid="historial-btn-exportar"
              >
                <Download className="w-4 h-4" />
                EXPORTAR
                <ChevronDown className="w-3 h-3" />
              </button>
              {exportOpen && (
                <div className="absolute z-10 top-full mt-1 right-0 bg-white border border-neutral-200 rounded-lg shadow-lg py-1 min-w-[160px]">
                  <button onClick={exportarExcel} className="flex items-center gap-2 w-full px-3 py-2 text-left text-sm font-semibold hover:bg-neutral-50">
                    <FileSpreadsheet className="w-4 h-4 text-green-600" /> Excel (.xlsx)
                  </button>
                  <button onClick={exportarPDF} className="flex items-center gap-2 w-full px-3 py-2 text-left text-sm font-semibold hover:bg-neutral-50">
                    <FileText className="w-4 h-4 text-red-600" /> PDF
                  </button>
                </div>
              )}
            </div>
            <button
              onClick={limpiar}
              className="h-11 px-3 rounded-md text-neutral-500 text-xs font-bold hover:text-neutral-800 underline"
              data-testid="historial-btn-limpiar"
            >
              Limpiar
            </button>
          </div>
        </div>

        {/* Banner informativo */}
        <div className="mt-4 flex items-start gap-2 px-4 py-3 bg-amber-50 border border-amber-200 rounded-lg">
          <AlertCircle className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
          <p className="text-xs text-amber-800 font-semibold">
            Tenga en cuenta que para mejor rendimiento se recomienda usar rangos de fechas acotados al consultar grandes volúmenes.
          </p>
        </div>
        <PdfViewerModal open={viewerOpen} url={viewerUrl} title={viewerTitle} onClose={() => setViewerOpen(false)} onDownload={() => downloadDoc(viewerDoc?.id, viewerDoc?.kind)} />
      </div>

      {/* RESULTADOS */}
      {loading ? (
        <div className="bg-white border border-neutral-200 rounded-2xl p-16 text-center text-sm text-neutral-500 shadow-sm">Cargando…</div>
      ) : !resultadosVisibles ? (
        <div className="bg-white border border-neutral-200 rounded-2xl p-16 text-center shadow-sm" data-testid="historial-empty">
          <Inbox className="w-16 h-16 text-neutral-300 mx-auto mb-3" />
          <h3 className="font-cabinet font-bold text-lg text-neutral-700 mb-1">Sin resultados</h3>
          <p className="text-sm text-neutral-500">Realiza la consulta de tu historial usando los filtros en la parte superior.</p>
        </div>
      ) : filteredInvoices.length === 0 ? (
        <div className="bg-white border border-neutral-200 rounded-2xl p-16 text-center shadow-sm" data-testid="historial-noresults">
          <Inbox className="w-16 h-16 text-neutral-300 mx-auto mb-3" />
          <h3 className="font-cabinet font-bold text-lg text-neutral-700 mb-1">Sin resultados</h3>
          <p className="text-sm text-neutral-500">No se encontraron documentos con los filtros aplicados.</p>
        </div>
      ) : (
        // Frame morado brand alrededor de la tarjeta
        <div className="rounded-3xl p-3 shadow-sm" style={{ background: "#8039F4" }} data-testid="historial-results-frame">
          {/* Header morado dentro del frame: 2 líneas a cada lado */}
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-2 px-5 py-4 text-white">
            <div>
              <h3 className="font-cabinet font-bold text-base leading-tight">
                Detalle de los documentos pendientes de pago (vencido y por vencer)
              </h3>
              <p className="text-[11px] italic opacity-90 mt-1">(*) Monto total incluye IGV.</p>
            </div>
            <div className="text-right md:text-right text-xs">
              <p>
                Información generada el:{" "}
                <b className="font-bold">
                  {generatedAt ? `${generatedAt.toLocaleDateString("es-PE")} ${generatedAt.toLocaleTimeString("es-PE", { hour: "2-digit", minute: "2-digit", second: "2-digit" })}` : ""}
                </b>
              </p>
              <p className="opacity-90 mt-0.5">Se visualizan documentos con 1 año de antigüedad desde la fecha de consulta.</p>
            </div>
          </div>

          {/* Tabla con header navy */}
          <div className="bg-white rounded-2xl overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm" data-testid="historial-table">
                <thead style={{ background: "#1E1B4B" }} className="text-white">
                  <tr className="text-[11px] font-bold uppercase tracking-wider">
                    {user?.role === "admin_enered" && <th className="px-3 py-3 text-left">Empresa</th>}
                    <th className="px-3 py-3 text-left">Tipo Doc</th>
                    <th className="px-3 py-3 text-left">N° Doc</th>
                    <th className="px-3 py-3 text-left">F. Emisión</th>
                    <th className="px-3 py-3 text-left">F. Vencimiento</th>
                    <th className="px-3 py-3 text-center">Atraso</th>
                    <th className="px-3 py-3 text-center">Moneda</th>
                    <th className="px-3 py-3 text-right">Monto Total *</th>
                    <th className="px-3 py-3 text-right">Saldo</th>
                    <th className="px-3 py-3 text-center">Estado</th>
                    <th className="px-3 py-3 text-center">Descargar</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredInvoices
                    .slice((page - 1) * pageSize, page * pageSize)
                    .map((inv) => {
                      const colorEstado = ESTADO_TEXT_COLOR[inv.estado] || "text-neutral-600";
                      // Calcular atraso si está vencida
                      let atrasoDias = inv.atraso_dias || 0;
                      if (!atrasoDias && inv.f_vencimiento) {
                        const fv = new Date(inv.f_vencimiento);
                        const hoy = new Date();
                        const diff = Math.floor((hoy - fv) / (1000 * 60 * 60 * 24));
                        if (diff > 0) atrasoDias = diff;
                      }
                      return (
                        <tr key={inv.id} className="border-b border-neutral-100 hover:bg-brand/5 transition-colors">
                          {user?.role === "admin_enered" && <td className="px-3 py-2.5 text-xs font-semibold">{inv.empresa}</td>}
                          <td className="px-3 py-2.5 text-neutral-700">{TIPO_DOC_LABEL[inv.tipo_doc] || "Factura"}</td>
                          <td className="px-3 py-2.5 font-bold" style={{ color: "#1E1B4B" }}>{inv.n_doc}</td>
                          <td className="px-3 py-2.5 text-neutral-700">{formatDate(inv.f_emision)}</td>
                          <td className="px-3 py-2.5 text-neutral-700">{formatDate(inv.f_vencimiento)}</td>
                          <td className="px-3 py-2.5 text-center text-xs text-neutral-700">{atrasoDias} día{atrasoDias === 1 ? "" : "s"}</td>
                          <td className="px-3 py-2.5 text-center text-xs font-bold text-neutral-700">{inv.moneda || "PEN"}</td>
                          <td className="px-3 py-2.5 text-right font-bold text-neutral-900">{formatSoles(inv.monto_total).replace("S/ ", "")}</td>
                          <td className="px-3 py-2.5 text-right text-neutral-700">{formatSoles(inv.saldo).replace("S/ ", "")}</td>
                          <td className={`px-3 py-2.5 text-center text-[11px] font-bold ${colorEstado}`}>
                            {ESTADO_LABEL[inv.estado] || (inv.estado || "—").toUpperCase()}
                          </td>
                          <td className="px-3 py-2.5 text-center">
                            <div className="inline-flex gap-1.5">
                              <button
                                onClick={() => viewDoc(inv.id, "pdf")}
                                title="Visualizar PDF"
                                className="w-8 h-8 rounded-full bg-brand/10 text-brand flex items-center justify-center hover:bg-brand hover:text-white transition-colors"
                              >
                                <Eye className="w-4 h-4" />
                              </button>
                              <button
                                onClick={() => downloadDoc(inv.id, "pdf")}
                                title="Descargar PDF"
                                className="w-8 h-8 rounded-full bg-brand/10 text-brand flex items-center justify-center hover:bg-brand hover:text-white transition-colors"
                              >
                                <FileText className="w-4 h-4" />
                              </button>
                              <button
                                onClick={() => downloadDoc(inv.id, "xml")}
                                title="Descargar XML"
                                className="w-7 h-7 rounded-md bg-blue-50 text-blue-700 hover:bg-blue-100 flex items-center justify-center"
                              >
                                <FileSpreadsheet className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                </tbody>
              </table>
            </div>

            {/* Paginación al pie */}
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 px-5 py-3 border-t border-neutral-100 bg-neutral-50">
              <div className="flex items-center gap-2 text-xs text-neutral-700">
                <span className="font-semibold">Filas por página</span>
                <select
                  value={pageSize}
                  onChange={(e) => { setPageSize(Number(e.target.value)); setPage(1); }}
                  className="h-8 px-2 border border-neutral-300 rounded text-sm font-semibold bg-white focus:border-brand outline-none"
                  data-testid="historial-pagesize"
                >
                  {[10, 25, 50, 100].map((n) => <option key={n} value={n}>{n}</option>)}
                </select>
              </div>
              <div className="flex items-center gap-3 text-xs">
                <span className="text-neutral-700 font-semibold">
                  {(page - 1) * pageSize + 1}-{Math.min(page * pageSize, filteredInvoices.length)} de {filteredInvoices.length} registros
                </span>
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                    disabled={page === 1}
                    className="w-7 h-7 rounded-md border border-neutral-300 text-neutral-700 disabled:opacity-40 hover:border-brand hover:text-brand flex items-center justify-center"
                    data-testid="historial-prev"
                  >
                    ‹
                  </button>
                  <span className="px-2.5 h-7 inline-flex items-center font-bold text-brand text-sm">{page}</span>
                  <button
                    onClick={() => setPage((p) => Math.min(Math.ceil(filteredInvoices.length / pageSize), p + 1))}
                    disabled={page >= Math.ceil(filteredInvoices.length / pageSize)}
                    className="w-7 h-7 rounded-md border border-neutral-300 text-neutral-700 disabled:opacity-40 hover:border-brand hover:text-brand flex items-center justify-center"
                    data-testid="historial-next"
                  >
                    ›
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
