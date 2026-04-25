import React, { useEffect, useRef, useState } from "react";
import { QrCode, Upload, CheckCircle2, AlertCircle, Trash2, RefreshCw } from "lucide-react";
import { api } from "../lib/api";
import { toast } from "sonner";

export default function AdminQRUpload() {
  const [empresas, setEmpresas] = useState([]);
  const [empresa, setEmpresa] = useState("");
  const [files, setFiles] = useState([]);
  const [uploading, setUploading] = useState(false);
  const [result, setResult] = useState(null);
  const [list, setList] = useState([]);
  const inputRef = useRef(null);

  useEffect(() => {
    api.get("/empresas").then((r) => setEmpresas(r.data)).catch(() => {});
  }, []);

  useEffect(() => {
    if (!empresa) { setList([]); return; }
    refreshList();
    // eslint-disable-next-line
  }, [empresa]);

  const refreshList = async () => {
    try {
      const r = await api.get("/qr/list", { params: { empresa } });
      setList(r.data || []);
    } catch (e) {
      // ignore
    }
  };

  const handleFiles = (selected) => {
    setFiles(Array.from(selected || []));
    setResult(null);
  };

  const handleUpload = async () => {
    if (!empresa) { toast.error("Selecciona una empresa"); return; }
    if (files.length === 0) { toast.error("Selecciona al menos un archivo"); return; }
    setUploading(true);
    setResult(null);
    try {
      const fd = new FormData();
      fd.append("empresa", empresa);
      files.forEach((f) => fd.append("files", f));
      const r = await api.post("/admin/qr/upload-bulk", fd, { headers: { "Content-Type": "multipart/form-data" } });
      setResult(r.data);
      toast.success(`${r.data.uploaded} QR cargados`);
      setFiles([]);
      if (inputRef.current) inputRef.current.value = "";
      refreshList();
    } catch (e) {
      toast.error(e.response?.data?.detail || "Error en la carga");
    } finally {
      setUploading(false);
    }
  };

  const handleDelete = async (placa) => {
    if (!window.confirm(`¿Eliminar QR de la placa ${placa}?`)) return;
    try {
      await api.delete(`/admin/qr/${placa}`, { params: { empresa } });
      toast.success("QR eliminado");
      refreshList();
    } catch (e) {
      toast.error("No se pudo eliminar");
    }
  };

  return (
    <div className="space-y-6" data-testid="admin-qr-page">
      <div>
        <div className="text-[11px] font-bold uppercase tracking-widest text-brand mb-2">Admin · Carga masiva</div>
        <h1 className="font-cabinet font-black text-3xl md:text-4xl text-neutral-900">Carga masiva de códigos QR</h1>
        <p className="text-neutral-500 mt-1 text-sm">Sube múltiples imágenes <b>.png/.jpg/.svg</b> nombradas como <code className="bg-neutral-100 px-1.5 py-0.5 rounded text-xs">PLACA.png</code>. Cada archivo se asocia automáticamente a la unidad correspondiente.</p>
      </div>

      <div className="bg-white border border-border rounded-2xl p-6 space-y-5">
        <div>
          <label className="text-xs font-bold uppercase tracking-widest text-neutral-500 mb-2 block">Empresa destino</label>
          <select
            value={empresa}
            onChange={(e) => setEmpresa(e.target.value)}
            className="h-11 px-3 border border-border rounded-md bg-white text-sm font-semibold w-full max-w-md"
            data-testid="qr-admin-empresa"
          >
            <option value="">— Selecciona empresa —</option>
            {empresas.map((e) => <option key={e} value={e}>{e}</option>)}
          </select>
        </div>

        <div>
          <label className="text-xs font-bold uppercase tracking-widest text-neutral-500 mb-2 block">Archivos QR</label>
          <div
            onClick={() => inputRef.current?.click()}
            onDrop={(e) => { e.preventDefault(); handleFiles(e.dataTransfer.files); }}
            onDragOver={(e) => e.preventDefault()}
            className="border-2 border-dashed border-brand/30 rounded-xl bg-brand/5 hover:bg-brand/10 px-6 py-10 text-center cursor-pointer transition-colors"
            data-testid="qr-dropzone"
          >
            <Upload className="w-8 h-8 text-brand mx-auto mb-2" />
            <div className="font-cabinet font-bold text-neutral-700">Arrastra archivos o haz click</div>
            <div className="text-xs text-neutral-500 mt-1">Hasta 5MB por archivo · png, jpg, svg, webp</div>
            <input
              ref={inputRef}
              type="file"
              multiple
              accept="image/png,image/jpeg,image/webp,image/svg+xml"
              onChange={(e) => handleFiles(e.target.files)}
              className="hidden"
              data-testid="qr-file-input"
            />
          </div>
          {files.length > 0 && (
            <div className="mt-3 text-sm font-semibold text-neutral-700">
              {files.length} archivo(s) seleccionado(s):
              <div className="mt-2 max-h-40 overflow-y-auto space-y-1">
                {files.slice(0, 20).map((f, i) => (
                  <div key={i} className="flex items-center gap-2 text-xs font-mono bg-neutral-50 rounded px-2 py-1">
                    <QrCode className="w-3 h-3 text-brand" /> {f.name} <span className="text-neutral-400">({Math.round(f.size / 1024)}KB)</span>
                  </div>
                ))}
                {files.length > 20 && <div className="text-xs text-neutral-400 italic">… y {files.length - 20} más</div>}
              </div>
            </div>
          )}
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={handleUpload}
            disabled={uploading || !empresa || files.length === 0}
            className="h-11 px-5 rounded-md bg-brand text-white text-sm font-bold flex items-center gap-2 hover:bg-brand-hover disabled:opacity-40"
            data-testid="qr-upload-btn"
          >
            {uploading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
            {uploading ? "Subiendo…" : `Subir ${files.length || ""} archivo(s)`}
          </button>
        </div>

        {result && (
          <div className="bg-neutral-50 border border-neutral-200 rounded-xl p-4 space-y-2">
            <div className="flex items-center gap-2 text-sm">
              <CheckCircle2 className="w-4 h-4 text-green-600" />
              <span className="font-bold text-green-700">{result.uploaded} archivos cargados correctamente</span>
            </div>
            {result.skipped?.length > 0 && (
              <div>
                <div className="flex items-center gap-2 text-sm">
                  <AlertCircle className="w-4 h-4 text-amber-600" />
                  <span className="font-bold text-amber-700">{result.skipped.length} omitidos</span>
                </div>
                <div className="mt-1 text-xs text-neutral-600 space-y-0.5">
                  {result.skipped.map((s, i) => (
                    <div key={i}>• <b>{s.file}</b>: {s.reason}</div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* QR existentes */}
      {empresa && (
        <div className="bg-white border border-border rounded-2xl p-5" data-testid="qr-admin-list">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-cabinet font-bold text-lg text-neutral-900">QR existentes ({list.length})</h3>
            <button onClick={refreshList} className="text-xs font-bold text-brand hover:underline flex items-center gap-1">
              <RefreshCw className="w-3 h-3" /> Refrescar
            </button>
          </div>
          {list.length === 0 ? (
            <div className="text-center py-8 text-sm text-neutral-500">Sin QR cargados para esta empresa.</div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-3">
              {list.map((q) => (
                <div key={q.placa} className="border border-neutral-200 rounded-lg p-3 flex flex-col items-center gap-2">
                  <QrCode className="w-8 h-8 text-brand" strokeWidth={1.5} />
                  <div className="font-mono font-bold text-sm">{q.placa}</div>
                  <button
                    onClick={() => handleDelete(q.placa)}
                    className="text-[10px] text-red-600 hover:underline flex items-center gap-1"
                  >
                    <Trash2 className="w-3 h-3" /> Eliminar
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
