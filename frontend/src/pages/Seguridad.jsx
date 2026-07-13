import React, { useEffect, useMemo, useState } from "react";
import { Search, X, Upload, FileText, Trash2, Plus, Inbox, Eye, Download } from "lucide-react";
import { api } from "../lib/api";
import { useAuth } from "../context/AuthContext";
import { toast } from "sonner";
import PdfViewerModal from "../components/PdfViewerModal";

const formatFecha = (iso) => {
  if (!iso) return "—";
  try {
    const d = new Date(iso);
    return `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}/${d.getFullYear()} ${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}:${String(d.getSeconds()).padStart(2, "0")}`;
  } catch { return iso; }
};

export default function Seguridad() {
  const { user } = useAuth();
  const isAdmin = user?.role === "admin_enered";
  const [docs, setDocs] = useState([]);
  const [loading, setLoading] = useState(false);
  const [query, setQuery] = useState("");
  const [active, setActive] = useState("");
  const [showUpload, setShowUpload] = useState(false);
  const [viewerOpen, setViewerOpen] = useState(false);
  const [viewerUrl, setViewerUrl] = useState(null);
  const [viewerTitle, setViewerTitle] = useState("");
  const [viewerDoc, setViewerDoc] = useState(null);

  // Filtros (Buscar/Limpiar)
  const fetchDocs = async (q = "") => {
    setLoading(true);
    try {
      const { data } = await api.get("/security-docs", { params: q ? { q } : {} });
      setDocs(data || []);
    } catch {
      setDocs([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchDocs(); }, []);

  const buscar = () => { setActive(query); fetchDocs(query); };
  const limpiar = () => { setQuery(""); setActive(""); fetchDocs(""); };

  const downloadPDF = async (doc) => {
    try {
      const res = await api.get(`/security-docs/${doc.id}/download`, { responseType: "blob" });
      const url = URL.createObjectURL(res.data);
      const a = document.createElement("a");
      a.href = url;
      a.download = doc.filename_original || `${doc.codigo}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      toast.error("Error al descargar el documento");
    }
  };

  const viewPDF = async (doc) => {
    try {
      const res = await api.get(`/security-docs/${doc.id}/download`, { responseType: "blob" });
      const url = URL.createObjectURL(res.data);
      setViewerUrl(url);
      setViewerTitle(doc.filename_original || `${doc.codigo}.pdf`);
      setViewerDoc(doc);
      setViewerOpen(true);
    } catch {
      toast.error("Error al visualizar el documento");
    }
  };

  const deleteDoc = async (doc) => {
    if (!window.confirm(`¿Eliminar el documento "${doc.nombre}"?`)) return;
    try {
      await api.delete(`/admin/security-docs/${doc.id}`);
      toast.success("Documento eliminado");
      fetchDocs(active);
    } catch {
      toast.error("Error al eliminar");
    }
  };

  return (
    <div className="space-y-6 p-6">
      {/* Título */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h1 className="font-cabinet font-black text-[32px] text-brand leading-tight">
          Consulta documentos de Seguridad
        </h1>
        {isAdmin && (
          <button
            onClick={() => setShowUpload(true)}
            className="h-11 px-5 rounded-md bg-brand hover:bg-brand-700 text-white text-sm font-bold flex items-center gap-2 transition-colors"
            data-testid="seguridad-btn-upload"
          >
            <Plus className="w-4 h-4" />
            CARGAR DOCUMENTO
          </button>
        )}
      </div>

      {/* Buscador */}
      <div className="bg-white border border-neutral-200 rounded-2xl p-5 shadow-sm">
        <div className="flex flex-wrap items-center gap-3">
          <input
            type="text"
            placeholder="Ingresa un texto"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && buscar()}
            className="flex-1 min-w-[260px] h-11 px-4 border border-neutral-300 rounded-lg text-sm font-semibold focus:border-brand focus:ring-1 focus:ring-brand outline-none"
            data-testid="seguridad-search-input"
          />
          <button
            onClick={buscar}
            className="h-11 px-6 rounded-md bg-brand hover:bg-brand-700 text-white text-sm font-bold flex items-center gap-2 transition-colors"
            data-testid="seguridad-btn-buscar"
          >
            <Search className="w-4 h-4" />
            Buscar
          </button>
          <button
            onClick={limpiar}
            className="h-11 px-5 rounded-md bg-white border border-neutral-300 text-neutral-700 hover:border-brand hover:text-brand text-sm font-bold flex items-center gap-2 transition-colors"
            data-testid="seguridad-btn-limpiar"
          >
            <X className="w-4 h-4" />
            Limpiar
          </button>
        </div>
      </div>

      {/* Tabla */}
      <div className="bg-white border border-neutral-200 rounded-2xl shadow-sm overflow-hidden">
        {loading ? (
          <div className="p-16 text-center text-sm text-neutral-500">Cargando documentos…</div>
        ) : docs.length === 0 ? (
          <div className="p-16 text-center" data-testid="seguridad-empty">
            <Inbox className="w-16 h-16 text-neutral-300 mx-auto mb-3" />
            <h3 className="font-cabinet font-bold text-lg text-neutral-700 mb-1">Sin documentos</h3>
            <p className="text-sm text-neutral-500">
              {active ? "No se encontraron documentos con ese criterio." : isAdmin ? "Carga el primer documento usando el botón superior." : "Aún no hay documentos disponibles."}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm" data-testid="seguridad-table">
              <thead style={{ background: "#1E1B4B" }} className="text-white">
                <tr className="text-[12px] font-bold uppercase tracking-wider">
                  <th className="px-4 py-4 text-left">↓ Código</th>
                  <th className="px-4 py-4 text-left">Nombre</th>
                  <th className="px-4 py-4 text-left">Descripción</th>
                  <th className="px-4 py-4 text-left">Archivos</th>
                  <th className="px-4 py-4 text-left">Fecha Modificación</th>
                  <th className="px-4 py-4 text-center">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {docs.map((doc) => (
                  <tr key={doc.id} className="border-b border-neutral-100 hover:bg-brand/5 transition-colors">
                    <td className="px-4 py-3.5 font-bold text-neutral-700">{doc.codigo}</td>
                    <td className="px-4 py-3.5 text-neutral-800 font-semibold">{doc.nombre}</td>
                    <td className="px-4 py-3.5 text-neutral-600 text-sm">{doc.descripcion || "—"}</td>
                    <td className="px-4 py-3.5">
                      <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-neutral-700">
                        <FileText className="w-3.5 h-3.5 text-red-600" />
                        Manual PDF
                      </span>
                    </td>
                    <td className="px-4 py-3.5 text-neutral-600 text-xs">{formatFecha(doc.updated_at || doc.created_at)}</td>
                    <td className="px-4 py-3.5">
                      <div className="flex items-center justify-center gap-2">
                        <button
                          onClick={() => viewPDF(doc)}
                          title="Visualizar PDF"
                          className="w-9 h-9 rounded-md bg-brand/10 text-brand hover:bg-brand/20 flex items-center justify-center transition-colors"
                        >
                          <Eye className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => downloadPDF(doc)}
                          title="Descargar PDF"
                          className="w-9 h-9 rounded-md bg-red-50 text-red-700 hover:bg-red-100 flex items-center justify-center transition-colors"
                          data-testid={`seguridad-download-${doc.codigo}`}
                        >
                          <Download className="w-4 h-4" />
                        </button>
                        {isAdmin && (
                          <button
                            onClick={() => deleteDoc(doc)}
                            title="Eliminar"
                            className="w-9 h-9 rounded-md bg-neutral-50 text-neutral-500 hover:bg-red-50 hover:text-red-600 flex items-center justify-center transition-colors"
                            data-testid={`seguridad-delete-${doc.codigo}`}
                          >
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
        )}
      </div>

      <PdfViewerModal open={viewerOpen} url={viewerUrl} title={viewerTitle} onClose={() => setViewerOpen(false)} onDownload={() => downloadPDF(viewerDoc)} />

      {/* Modal Upload (solo admin) */}
      {showUpload && isAdmin && (
        <UploadModal
          onClose={() => setShowUpload(false)}
          onUploaded={() => { setShowUpload(false); fetchDocs(active); }}
        />
      )}
    </div>
  );
}

/* ---------------- Modal de Upload ---------------- */
function UploadModal({ onClose, onUploaded }) {
  const [nombre, setNombre] = useState("");
  const [descripcion, setDescripcion] = useState("");
  const [file, setFile] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [dragActive, setDragActive] = useState(false);
  const fileInputRef = React.useRef(null);

  const onDragOver = (e) => { e.preventDefault(); e.stopPropagation(); setDragActive(true); };
  const onDragLeave = (e) => { e.preventDefault(); e.stopPropagation(); setDragActive(false); };
  const onDrop = (e) => {
    e.preventDefault(); e.stopPropagation(); setDragActive(false);
    if (e.dataTransfer.files?.length) {
      const f = e.dataTransfer.files[0];
      if (f.type === "application/pdf" || f.name.toLowerCase().endsWith(".pdf")) {
        setFile(f);
      } else {
        toast.error("Solo se permiten archivos PDF");
      }
    }
  };

  const submit = async () => {
    if (!nombre.trim()) { toast.error("Ingresa un nombre"); return; }
    if (!file) { toast.error("Selecciona un archivo PDF"); return; }
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append("nombre", nombre);
      fd.append("descripcion", descripcion);
      fd.append("file", file);
      await api.post("/admin/security-docs", fd, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      toast.success("Documento cargado");
      onUploaded();
    } catch (e) {
      toast.error(e.response?.data?.detail || "Error al cargar");
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div
        className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="p-6 border-b border-neutral-200 flex items-center justify-between">
          <h3 className="font-cabinet font-black text-xl text-brand">Cargar documento de Seguridad</h3>
          <button onClick={onClose} className="w-8 h-8 rounded-full hover:bg-neutral-100 flex items-center justify-center">
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="p-6 space-y-4">
          <div>
            <label className="text-xs font-bold uppercase tracking-widest text-neutral-500 mb-1 block">Nombre *</label>
            <input
              type="text"
              value={nombre}
              onChange={(e) => setNombre(e.target.value)}
              placeholder="Ej. Manual de uso de la plataforma"
              className="h-11 w-full px-3 border border-neutral-300 rounded-md text-sm font-semibold focus:border-brand focus:ring-1 focus:ring-brand outline-none"
              data-testid="upload-nombre"
            />
          </div>
          <div>
            <label className="text-xs font-bold uppercase tracking-widest text-neutral-500 mb-1 block">Descripción</label>
            <textarea
              value={descripcion}
              onChange={(e) => setDescripcion(e.target.value)}
              rows={2}
              placeholder="Breve descripción del documento (opcional)"
              className="w-full px-3 py-2 border border-neutral-300 rounded-md text-sm font-semibold focus:border-brand focus:ring-1 focus:ring-brand outline-none"
              data-testid="upload-descripcion"
            />
          </div>
          <div>
            <label className="text-xs font-bold uppercase tracking-widest text-neutral-500 mb-1 block">Archivo PDF *</label>
            <div
              onClick={() => fileInputRef.current?.click()}
              onDragOver={onDragOver}
              onDragEnter={onDragOver}
              onDragLeave={onDragLeave}
              onDrop={onDrop}
              className={`border-2 border-dashed rounded-xl p-6 text-center cursor-pointer transition-colors ${
                dragActive ? "border-brand bg-brand/5" : file ? "border-green-300 bg-green-50" : "border-neutral-300 bg-neutral-50 hover:bg-neutral-100"
              }`}
              data-testid="upload-dropzone"
            >
              <Upload className={`w-8 h-8 mx-auto mb-2 ${file ? "text-green-600" : "text-neutral-400"}`} />
              <div className="font-bold text-sm text-neutral-700">
                {file ? file.name : dragActive ? "Suelta el PDF aquí…" : "Arrastra o selecciona un archivo PDF"}
              </div>
              {file && <div className="text-xs text-neutral-500 mt-1">{(file.size / 1024).toFixed(0)} KB</div>}
              <input
                ref={fileInputRef}
                type="file"
                accept=".pdf,application/pdf"
                onChange={(e) => setFile(e.target.files?.[0] || null)}
                className="hidden"
                data-testid="upload-file-input"
              />
            </div>
          </div>
        </div>
        <div className="p-6 border-t border-neutral-200 flex items-center justify-end gap-2">
          <button
            onClick={onClose}
            disabled={uploading}
            className="h-10 px-4 rounded-md bg-white border border-neutral-300 hover:border-neutral-400 text-neutral-700 text-sm font-bold disabled:opacity-50"
          >
            Cancelar
          </button>
          <button
            onClick={submit}
            disabled={uploading || !nombre.trim() || !file}
            className="h-10 px-5 rounded-md bg-brand hover:bg-brand-700 text-white text-sm font-bold disabled:opacity-50 flex items-center gap-2"
            data-testid="upload-submit"
          >
            <Upload className="w-4 h-4" />
            {uploading ? "Cargando…" : "Cargar"}
          </button>
        </div>
      </div>
    </div>
  );
}
