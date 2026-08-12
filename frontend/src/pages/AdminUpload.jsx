import React, { useEffect, useState, useRef, useMemo } from "react";
import { api } from "../lib/api";
import { formatApiError, formatDate, formatSoles } from "../lib/utils";
import {
  Upload, FileSpreadsheet, Trash2, CheckCircle2, AlertCircle, FileText,
  Cloud, RefreshCw, Clock, ExternalLink, Receipt, QrCode, ScanLine, Loader2, AlertTriangle,
  Search, Edit3, Save, X, Eye, FileUp, ChevronDown, ChevronUp
} from "lucide-react";


const REQUIRED_COLS = ["FECHA", "EMPRESA", "PLACA", "CIUDAD", "ESTACION", "PRODUCTO", "CANTIDAD_GL", "IMPORTE_TOTAL"];

function toIsoDateString(val) {
  if (!val) return "";
  let s = String(val).trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
  if (/^\d{1,2}\/\d{1,2}\/\d{4}$/.test(s)) {
    const p = s.split("/");
    const d = p[0].padStart(2, "0");
    const m = p[1].padStart(2, "0");
    const y = p[2];
    return `${y}-${m}-${d}`;
  }
  try {
    const dt = new Date(s);
    if (!isNaN(dt.getTime())) return dt.toISOString().split("T")[0];
  } catch {}
  return "";
}

export default function AdminUpload() {
  const [file, setFile] = useState(null);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [err, setErr] = useState("");

  const [sheetsStatus, setSheetsStatus] = useState(null);
  const [sheetsLoading, setSheetsLoading] = useState(false);
  const [sheetsErr, setSheetsErr] = useState("");
  const [sheetsResult, setSheetsResult] = useState(null);
  const [syncMode, setSyncMode] = useState("replace");

  const loadStatus = async () => {
    try { const { data } = await api.get("/admin/sheets/status"); setSheetsStatus(data); }
    catch {}
  };

  useEffect(() => { loadStatus(); }, []);

  const syncNow = async () => {
    setSheetsLoading(true); setSheetsErr(""); setSheetsResult(null);
    try {
      const { data } = await api.post("/admin/sheets/sync", { mode: syncMode });
      setSheetsResult(data);
      await loadStatus();
    } catch (e) { setSheetsErr(formatApiError(e.response?.data?.detail)); }
    finally { setSheetsLoading(false); }
  };

  const onSubmit = async (e) => {
    e.preventDefault(); if (!file) return;
    setLoading(true); setErr(""); setResult(null);
    const fd = new FormData(); fd.append("file", file);
    try {
      const { data } = await api.post("/admin/consumptions/upload", fd, { headers: { "Content-Type": "multipart/form-data" } });
      setResult(data);
    } catch (e2) { setErr(formatApiError(e2.response?.data?.detail)); }
    finally { setLoading(false); }
  };

  const wipe = async () => {
    if (!window.confirm("¿Eliminar TODOS los consumos? Esta acción es irreversible.")) return;
    await api.delete("/admin/consumptions"); setResult({ deleted: true });
  };

  const last = sheetsStatus?.last_sync;

  return (
    <div className="space-y-6">
      <div>
        <div className="text-[11px] font-bold uppercase tracking-widest text-brand mb-2">Administración</div>
        <h1 className="font-cabinet font-black text-3xl md:text-4xl text-neutral-900">Datos</h1>
        <p className="text-neutral-500 mt-1 text-sm">Sincroniza consumos desde Google Sheets, carga facturas y gestiona códigos QR de clientes.</p>
      </div>

      <QRManager />

      <InvoicesBulkUpload />

      <InvoicesManager />

      {/* Google Sheets Sync */}

      <div className="chart-card border-l-4 border-l-brand" data-testid="sheets-sync-card">
        <div className="flex items-start justify-between gap-4 mb-5 pb-4 border-b border-neutral-100">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-md bg-brand-50 border border-brand-100 flex items-center justify-center">
              <Cloud className="w-5 h-5 text-brand" strokeWidth={2.5} />
            </div>
            <div>
              <h3 className="font-cabinet font-bold text-lg text-neutral-900">Google Sheets</h3>
              <p className="text-xs text-neutral-500 mt-1">Sincronización directa con tu archivo consolidado</p>
            </div>
          </div>
          {sheetsStatus?.sheet_id && (
            <a
              href={`https://docs.google.com/spreadsheets/d/${sheetsStatus.sheet_id}/edit`}
              target="_blank" rel="noreferrer"
              className="text-xs font-bold text-brand hover:text-brand-hover flex items-center gap-1"
            >
              Abrir sheet <ExternalLink className="w-3 h-3" />
            </a>
          )}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-5">
          <div>
            <div className="text-[10px] font-bold uppercase tracking-widest text-neutral-500 mb-1">Pestaña</div>
            <div className="text-sm font-bold">{sheetsStatus?.tab || "—"}</div>
          </div>
          <div className="md:col-span-2">
            <div className="text-[10px] font-bold uppercase tracking-widest text-neutral-500 mb-1">Cuenta de servicio</div>
            <div className="text-xs font-mono text-neutral-700 break-all">{sheetsStatus?.service_account || "—"}</div>
          </div>
        </div>

        {last && (
          <div className="bg-neutral-50 border border-border rounded-md p-4 mb-4 flex items-start gap-3" data-testid="sheets-last-sync">
            <Clock className="w-4 h-4 text-neutral-500 mt-0.5 flex-shrink-0" />
            <div className="flex-1 grid grid-cols-2 md:grid-cols-4 gap-3">
              <div>
                <div className="text-[10px] font-bold uppercase tracking-widest text-neutral-500">Última sync</div>
                <div className="text-sm font-bold">{formatDate(last.finished_at)} {new Date(last.finished_at).toLocaleTimeString("es-PE")}</div>
              </div>
              <div>
                <div className="text-[10px] font-bold uppercase tracking-widest text-neutral-500">Modo</div>
                <div className="text-sm font-bold capitalize">{last.mode}</div>
              </div>
              <div>
                <div className="text-[10px] font-bold uppercase tracking-widest text-neutral-500">Insertados</div>
                <div className="text-sm font-bold text-green-700">{last.rows_inserted}</div>
              </div>
              <div>
                <div className="text-[10px] font-bold uppercase tracking-widest text-neutral-500">Leídos</div>
                <div className="text-sm font-bold">{last.rows_read}</div>
              </div>
            </div>
          </div>
        )}

        <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center">
          <div className="flex items-center gap-3 text-sm">
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="radio" checked={syncMode === "replace"} onChange={() => setSyncMode("replace")} className="accent-brand" />
              <span className="font-semibold">Reemplazar todo</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="radio" checked={syncMode === "append"} onChange={() => setSyncMode("append")} className="accent-brand" />
              <span className="font-semibold">Agregar</span>
            </label>
          </div>
          <div className="flex-1" />
          <button onClick={syncNow} disabled={sheetsLoading} className="btn-brand text-sm flex items-center gap-2 disabled:opacity-60" data-testid="sheets-sync-btn">
            <RefreshCw className={`w-4 h-4 ${sheetsLoading ? "animate-spin" : ""}`} />
            {sheetsLoading ? "Sincronizando..." : "Sincronizar ahora"}
          </button>
        </div>

        {sheetsErr && (
          <div className="mt-4 text-sm text-red-600 bg-red-50 border border-red-100 rounded-md px-3 py-2 flex items-start gap-2" data-testid="sheets-error">
            <AlertCircle className="w-4 h-4 mt-0.5" />
            <div>
              <div className="font-bold">Error al sincronizar</div>
              <div>{sheetsErr}</div>
              <div className="mt-1 text-xs text-red-500">
                Verifica que el Sheet esté compartido con <b>{sheetsStatus?.service_account}</b> (permiso Lector).
              </div>
            </div>
          </div>
        )}
        {sheetsResult && (
          <div className="mt-4 text-sm text-green-700 bg-green-50 border border-green-100 rounded-md px-3 py-2 flex items-start gap-2" data-testid="sheets-success">
            <CheckCircle2 className="w-4 h-4 mt-0.5" />
            <div>
              <div className="font-bold">Sincronización completa</div>
              <div>
                {sheetsResult.rows_inserted} registros insertados · {sheetsResult.rows_read} leídos
                {sheetsResult.rows_deleted > 0 && ` · ${sheetsResult.rows_deleted} eliminados`}
                {sheetsResult.rows_skipped > 0 && ` · ${sheetsResult.rows_skipped} omitidos`}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Manual CSV/Excel Upload */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="chart-card lg:col-span-2">
          <h3 className="font-cabinet font-bold text-lg mb-4 flex items-center gap-2">
            <Upload className="w-5 h-5 text-brand" /> Carga manual (CSV / Excel)
          </h3>
          <form onSubmit={onSubmit} className="space-y-4">
            <label className="block border-2 border-dashed border-border rounded-lg p-8 text-center hover:border-brand hover:bg-brand-50/50 transition-colors cursor-pointer">
              <FileSpreadsheet className="w-10 h-10 text-brand mx-auto mb-2" />
              <div className="font-bold text-sm">
                {file ? file.name : "Haz clic o arrastra un archivo CSV / XLSX"}
              </div>
              <div className="text-xs text-neutral-500 mt-1">Tamaño máx. recomendado: 20MB</div>
              <input type="file" accept=".csv,.xlsx,.xls" onChange={(e) => setFile(e.target.files[0])} className="hidden" data-testid="upload-file" />
            </label>

            <div className="flex flex-wrap gap-2">
              <button type="submit" disabled={!file || loading} className="btn-brand text-sm disabled:opacity-50" data-testid="upload-submit">
                {loading ? "Procesando..." : "Cargar archivo"}
              </button>
              <button type="button" onClick={wipe} className="btn-ghost text-sm text-red-600 flex items-center gap-2">
                <Trash2 className="w-4 h-4" /> Limpiar TODO
              </button>
            </div>

            {err && <div className="text-sm text-red-600 bg-red-50 border border-red-100 rounded-md px-3 py-2 flex items-start gap-2">
              <AlertCircle className="w-4 h-4 mt-0.5" />{err}
            </div>}
            {result?.inserted !== undefined && <div className="text-sm text-green-700 bg-green-50 border border-green-100 rounded-md px-3 py-2 flex items-center gap-2" data-testid="upload-success">
              <CheckCircle2 className="w-4 h-4" /> {result.inserted} registros insertados.
            </div>}
            {result?.deleted && <div className="text-sm text-red-700 bg-red-50 border border-red-100 rounded-md px-3 py-2">Base limpia.</div>}
          </form>
        </div>

        <div className="chart-card">
          <h3 className="font-cabinet font-bold text-lg mb-3 flex items-center gap-2">
            <FileText className="w-5 h-5 text-brand" /> Formato
          </h3>
          <div className="text-xs font-bold uppercase tracking-wider text-neutral-500 mb-2">Columnas requeridas</div>
          <div className="space-y-1 text-xs font-mono">
            {REQUIRED_COLS.map((c) => (
              <div key={c} className="flex items-center gap-2 text-neutral-700"><CheckCircle2 className="w-3 h-3 text-brand" /> {c}</div>
            ))}
          </div>
          <div className="text-xs text-neutral-500 mt-4 leading-relaxed">
            Se aceptan nombres con tildes, paréntesis y espacios: <code className="bg-neutral-100 px-1 rounded">CANTIDAD (GL)</code>, <code className="bg-neutral-100 px-1 rounded">ESTACIÓN</code>, etc.
          </div>
          <div className="mt-4 p-3 bg-brand-50 border border-brand-100 rounded-md text-xs text-brand">
            <b>Tip Google Sheets:</b> Archivo → Descargar → CSV. O mejor: usa la sincronización directa de arriba ⬆
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── QR Manager ──────────────────────────────────────────────────────────────
function QRManager() {
  const [empresas, setEmpresas] = useState([]);
  const [empresa, setEmpresa] = useState("");
  const [files, setFiles] = useState([]);
  const [uploading, setUploading] = useState(false);
  const [result, setResult] = useState(null);
  const [list, setList] = useState([]);
  const inputRef = React.useRef(null);

  useEffect(() => {
    api.get("/empresas").then((r) => setEmpresas(r.data)).catch(() => {});
  }, []);

  useEffect(() => {
    if (!empresa) { setList([]); return; }
    refreshList();
    // eslint-disable-next-line
  }, [empresa]);

  const refreshList = async () => {
    try { const r = await api.get("/qr/list", { params: { empresa } }); setList(r.data || []); }
    catch {}
  };

  const handleFiles = (selected) => { setFiles(Array.from(selected || [])); setResult(null); };

  const handleUpload = async () => {
    if (!empresa) { alert("Selecciona una empresa"); return; }
    if (files.length === 0) { alert("Selecciona al menos un archivo"); return; }
    setUploading(true); setResult(null);
    try {
      const fd = new FormData();
      fd.append("empresa", empresa);
      files.forEach((f) => fd.append("files", f));
      const r = await api.post("/admin/qr/upload-bulk", fd, { headers: { "Content-Type": "multipart/form-data" } });
      setResult(r.data);
      setFiles([]);
      if (inputRef.current) inputRef.current.value = "";
      refreshList();
    } catch (e) {
      alert(e.response?.data?.detail || "Error en la carga");
    } finally { setUploading(false); }
  };

  const handleDelete = async (placa) => {
    if (!window.confirm(`¿Eliminar QR de la placa ${placa}?`)) return;
    try { await api.delete(`/admin/qr/${placa}`, { params: { empresa } }); refreshList(); }
    catch { alert("No se pudo eliminar"); }
  };

  return (
    <div className="chart-card border-l-4 border-l-violet-400" data-testid="qr-manager-card">
      <div className="flex items-start gap-3 mb-5 pb-4 border-b border-neutral-100">
        <div className="w-10 h-10 rounded-md bg-violet-50 border border-violet-100 flex items-center justify-center">
          <QrCode className="w-5 h-5 text-violet-600" strokeWidth={2.5} />
        </div>
        <div>
          <h3 className="font-cabinet font-bold text-lg text-neutral-900">Códigos QR por empresa</h3>
          <p className="text-xs text-neutral-500 mt-1">Sube imágenes <b>.png/.jpg/.svg</b> nombradas como <code className="bg-neutral-100 px-1 rounded text-xs">PLACA.png</code>. Se asignan automáticamente a cada unidad.</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
        <div>
          <label className="text-xs font-bold uppercase tracking-widest text-neutral-500 mb-2 block">Empresa destino</label>
          <select
            value={empresa}
            onChange={(e) => setEmpresa(e.target.value)}
            className="h-10 px-3 border border-border rounded-md bg-white text-sm font-semibold w-full"
            data-testid="qr-empresa-select"
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
            className="border-2 border-dashed border-violet-200 rounded-xl bg-violet-50/40 hover:bg-violet-50 px-4 py-4 text-center cursor-pointer transition-colors"
            data-testid="qr-dropzone"
          >
            <Upload className="w-6 h-6 text-violet-500 mx-auto mb-1" />
            <div className="text-sm font-semibold text-neutral-700">
              {files.length > 0 ? `${files.length} archivo(s) seleccionado(s)` : "Haz click o arrastra imágenes"}
            </div>
            <div className="text-xs text-neutral-500 mt-0.5">PNG, JPG, SVG — hasta 5 MB c/u</div>
            <input ref={inputRef} type="file" multiple accept="image/png,image/jpeg,image/webp,image/svg+xml" onChange={(e) => handleFiles(e.target.files)} className="hidden" data-testid="qr-file-input" />
          </div>
        </div>
      </div>

      <div className="flex items-center gap-3 mb-4">
        <button
          onClick={handleUpload}
          disabled={uploading || !empresa || files.length === 0}
          className="btn-brand text-sm flex items-center gap-2 disabled:opacity-50"
          data-testid="qr-upload-btn"
        >
          {uploading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
          {uploading ? "Subiendo..." : `Subir ${files.length || ""} archivo(s)`}
        </button>
        {files.length > 0 && <button onClick={() => setFiles([])} className="btn-ghost text-sm">Limpiar</button>}
      </div>

      {result && (
        <div className="text-sm text-green-700 bg-green-50 border border-green-100 rounded-md px-3 py-2 flex items-center gap-2 mb-4">
          <CheckCircle2 className="w-4 h-4" /> {result.uploaded} QR cargado(s) correctamente.
        </div>
      )}

      {empresa && list.length > 0 && (
        <div>
          <div className="flex items-center justify-between mb-3">
            <div className="text-xs font-bold uppercase tracking-widest text-neutral-500">QR existentes — {empresa} ({list.length})</div>
            <button onClick={refreshList} className="text-xs font-bold text-brand hover:underline flex items-center gap-1"><RefreshCw className="w-3 h-3" /> Refrescar</button>
          </div>
          <div className="grid grid-cols-3 sm:grid-cols-6 lg:grid-cols-8 gap-2">
            {list.map((q) => (
              <div key={q.placa} className="border border-neutral-200 rounded-lg p-2 flex flex-col items-center gap-1.5">
                <QrCode className="w-7 h-7 text-brand" strokeWidth={1.5} />
                <div className="font-mono font-bold text-xs text-center">{q.placa}</div>
                <button onClick={() => handleDelete(q.placa)} className="text-[10px] text-red-500 hover:underline flex items-center gap-0.5">
                  <Trash2 className="w-2.5 h-2.5" /> Eliminar
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
      {empresa && list.length === 0 && (
        <div className="text-center py-6 text-sm text-neutral-400">Sin QR cargados para esta empresa.</div>
      )}
    </div>
  );
}

function InvoicesBulkUpload() {
  const [files, setFiles] = useState([]);
  const [dragActive, setDragActive] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [empresas, setEmpresas] = useState([]);
  const [estadoOverride, setEstadoOverride] = useState("auto");
  const [items, setItems] = useState([]);
  const [confirming, setConfirming] = useState(false);
  const [result, setResult] = useState(null);
  const [err, setErr] = useState("");

  const fileInputRef = React.useRef(null);

  useEffect(() => {
    api.get("/empresas-config").then((r) => setEmpresas((r.data || []).map((c) => c.empresa))).catch(() => {});
  }, []);

  const handleFiles = (selected) => {
    const arr = Array.from(selected || []);
    setFiles(arr);
    setResult(null);
    setErr("");
  };

  const onDragOver = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (!dragActive) setDragActive(true);
  };
  const onDragLeave = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
  };
  const onDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleFiles(e.dataTransfer.files);
    }
  };

  const uploadForPreview = async () => {
    if (files.length === 0) return;
    setUploading(true); setResult(null); setErr(""); setItems([]);
    try {
      const fd = new FormData();
      files.forEach((f) => fd.append("files", f));
      const { data } = await api.post("/admin/invoices/ocr-preview", fd, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      setItems(data.items || []);
    } catch (e) { setErr(formatApiError(e.response?.data?.detail)); }
    finally { setUploading(false); }
  };

  const setItemField = (id, field, val) => {
    setItems((prev) => prev.map((it) => it.id === id ? { ...it, [field]: val } : it));
  };

  const deleteItem = (id) => {
    setItems((prev) => prev.filter((it) => it.id !== id));
  };

  const confirmAll = async () => {
    if (items.length === 0) return;
    setConfirming(true); setErr(""); setResult(null);
    try {
      const payload = { items, estado_override: estadoOverride === "auto" ? "" : estadoOverride };
      const { data } = await api.post("/admin/invoices/confirm-ocr", payload);
      setResult({ saved: data.saved });
      setItems([]);
      setFiles([]);
    } catch (e) { setErr(formatApiError(e.response?.data?.detail)); }
    finally { setConfirming(false); }
  };

  const ESTADO_OPTS = [
    { v: "auto", label: "Auto (por fecha de vencimiento)", color: "bg-neutral-100 text-neutral-700 border-neutral-300" },
    { v: "pagada", label: "Pagada", color: "bg-green-50 text-green-700 border-green-300" },
    { v: "pendiente", label: "Pendiente (no vencida)", color: "bg-amber-50 text-amber-700 border-amber-300" },
    { v: "vencida", label: "Vencida", color: "bg-red-50 text-red-700 border-red-300" },
  ];

  return (
    <div className="chart-card border-l-4 border-l-cyan-400" data-testid="invoices-upload-card">
      <div className="flex items-start gap-3 mb-5 pb-4 border-b border-neutral-100">
        <div className="w-10 h-10 rounded-md bg-cyan-50 border border-cyan-100 flex items-center justify-center">
          <Receipt className="w-5 h-5 text-cyan-600" strokeWidth={2.5} />
        </div>
        <div>
          <h3 className="font-cabinet font-bold text-lg text-neutral-900">Carga masiva de facturas (OCR)</h3>
          <p className="text-xs text-neutral-500 mt-1">Sube los <b>PDFs</b> de las facturas que emites. La IA extraerá los datos y te permitirá confirmarlos antes de guardarlos en el Estado de Cuenta.</p>
        </div>
      </div>

      {items.length === 0 ? (
        <>
          <div
            onClick={() => fileInputRef.current?.click()}
            onDragOver={onDragOver}
            onDragEnter={onDragOver}
            onDragLeave={onDragLeave}
            onDrop={onDrop}
            className={`block border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-colors ${
              dragActive ? "border-brand bg-brand-50/50" : "border-cyan-200 bg-cyan-50/40 hover:bg-cyan-50"
            }`}
          >
            <Upload className={`w-8 h-8 mx-auto mb-2 ${dragActive ? "text-brand" : "text-cyan-600"}`} />
            <div className="font-bold text-sm text-neutral-700">
              {files.length > 0
                ? `${files.length} archivo(s) PDF seleccionados`
                : dragActive ? "Suelta los archivos aquí…" : "Selecciona o arrastra facturas PDF"}
            </div>
            <input
              ref={fileInputRef}
              type="file"
              multiple
              accept=".pdf,application/pdf"
              onChange={(e) => handleFiles(e.target.files)}
              className="hidden"
            />
          </div>

          <div className="flex items-center gap-2 mt-4">
            <button onClick={uploadForPreview} disabled={uploading || files.length === 0} className="btn-brand text-sm flex items-center gap-2 disabled:opacity-50">
              {uploading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <ScanLine className="w-4 h-4" />}
              {uploading ? "Procesando con IA…" : `Leer ${files.length || ""} factura(s)`}
            </button>
            {files.length > 0 && (
              <button onClick={() => setFiles([])} className="btn-ghost text-sm">Limpiar selección</button>
            )}
          </div>
        </>
      ) : (
        <div className="space-y-4">
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-sm text-amber-900 flex items-start gap-2">
            <AlertTriangle className="w-4 h-4 mt-0.5 flex-shrink-0" />
            <div>
              <strong>Revisa los datos extraídos por la IA.</strong> Si la empresa no se auto-detectó, puedes elegirla manualmente.
            </div>
          </div>

          <div>
            <label className="text-xs font-bold uppercase tracking-widest text-neutral-500 mb-2 block">
              Forzar estado de todas las facturas
            </label>
            <div className="flex flex-wrap gap-1.5 mb-4">
              {ESTADO_OPTS.map((o) => (
                <button
                  key={o.v}
                  type="button"
                  onClick={() => setEstadoOverride(o.v)}
                  className={`px-2.5 h-9 rounded-md border text-xs font-bold transition ${
                    estadoOverride === o.v ? `${o.color} ring-2 ring-offset-1 ring-brand` : "bg-white text-neutral-500 border-neutral-200 hover:border-neutral-400"
                  }`}
                >
                  {o.label}
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-4">
            {items.map((it) => (
              <div key={it.id} className="bg-white border border-neutral-200 rounded-xl p-4 shadow-sm relative">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2 truncate">
                    <FileText className="w-4 h-4 text-neutral-400" />
                    <span className="font-medium text-sm text-neutral-800 truncate" title={it.factura_filename}>{it.factura_filename}</span>
                    {it.error && <span className="text-xs text-red-500 font-bold ml-2">Error: {it.error}</span>}
                  </div>
                  <button onClick={() => deleteItem(it.id)} className="text-neutral-400 hover:text-red-500" title="Descartar">
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
                {!it.error && (
                  <div className="grid grid-cols-2 lg:grid-cols-7 gap-3 text-sm">
                    <div>
                      <label className="block text-[10px] font-bold text-neutral-500 uppercase mb-1">Empresa Destino</label>
                      <select
                        className={`w-full border rounded p-1.5 focus:border-brand focus:outline-none ${!it.empresa && !it.override_empresa ? "border-red-300 bg-red-50" : "border-neutral-300"}`}
                        value={it.override_empresa || it.empresa || ""}
                        onChange={(e) => setItemField(it.id, "override_empresa", e.target.value)}
                      >
                        <option value="">— Seleccionar —</option>
                        {empresas.map((e) => <option key={e} value={e}>{e}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold text-neutral-500 uppercase mb-1">N° Documento</label>
                      <input type="text" className="w-full border border-neutral-300 rounded p-1.5 focus:border-brand focus:outline-none" value={it.n_doc || ""} onChange={(e) => setItemField(it.id, "n_doc", e.target.value)} />
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold text-neutral-500 uppercase mb-1">Placa</label>
                      <input type="text" className="w-full border border-neutral-300 rounded p-1.5 focus:border-brand focus:outline-none" value={it.placa || ""} onChange={(e) => setItemField(it.id, "placa", e.target.value)} />
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold text-neutral-500 uppercase mb-1">Producto</label>
                      <input type="text" className="w-full border border-neutral-300 rounded p-1.5 focus:border-brand focus:outline-none" value={it.producto || ""} onChange={(e) => setItemField(it.id, "producto", e.target.value)} />
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold text-neutral-500 uppercase mb-1">F. Emisión 📅</label>
                      <input type="date" className="w-full border border-neutral-300 rounded p-1.5 focus:border-brand focus:outline-none text-xs" value={toIsoDateString(it.f_emision)} onChange={(e) => setItemField(it.id, "f_emision", e.target.value)} />
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold text-neutral-500 uppercase mb-1">F. Vencimiento 📅</label>
                      <input type="date" className="w-full border border-neutral-300 rounded p-1.5 focus:border-brand focus:outline-none text-xs" value={toIsoDateString(it.f_vencimiento)} onChange={(e) => setItemField(it.id, "f_vencimiento", e.target.value)} />
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold text-neutral-500 uppercase mb-1">Importe Total</label>
                      <input type="number" step="0.01" className="w-full border border-neutral-300 rounded p-1.5 focus:border-brand focus:outline-none" value={it.importe_total ?? ""} onChange={(e) => setItemField(it.id, "importe_total", e.target.value)} />
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>

          <div className="flex items-center gap-2 mt-4">
            <button onClick={confirmAll} disabled={confirming} className="btn-brand text-sm flex items-center gap-2 disabled:opacity-50">
              {confirming ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
              {confirming ? "Guardando…" : "Confirmar Facturas"}
            </button>
            <button onClick={() => { setItems([]); setFiles([]); }} disabled={confirming} className="btn-ghost text-sm">
              Cancelar
            </button>
          </div>
        </div>
      )}

      {err && (
        <div className="mt-4 text-sm text-red-600 bg-red-50 border border-red-100 rounded-md px-3 py-2 flex items-start gap-2">
          <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" /> <div>{err}</div>
        </div>
      )}
      {result && (
        <div className="mt-4 bg-green-50 border border-green-200 rounded-xl p-4 flex items-center gap-2">
          <CheckCircle2 className="w-5 h-5 text-green-600" />
          <span className="font-bold text-green-700">{result.saved} factura(s) confirmadas y guardadas en el Estado de Cuenta.</span>
        </div>
      )}
    </div>
  );
}

// ─── InvoicesManager ─────────────────────────────────────────────────────────
const ESTADO_BADGE = {
  pagada:    "bg-green-100 text-green-700 border-green-200",
  pendiente: "bg-amber-100 text-amber-700 border-amber-200",
  vencida:   "bg-red-100  text-red-700  border-red-200",
  pagado:    "bg-green-100 text-green-700 border-green-200",
  por_vencer:"bg-amber-100 text-amber-700 border-amber-200",
  vencido:   "bg-red-100  text-red-700  border-red-200",
  tercero:   "bg-blue-100 text-blue-700 border-blue-200",
};
const ESTADO_LABEL = {
  pagada:"PAGADA", pendiente:"PENDIENTE", vencida:"VENCIDA", tercero:"TERCERO",
  pagado:"PAGADA", por_vencer:"PENDIENTE", vencido:"VENCIDA",
};

function InvoicesManager() {
  const [empresas, setEmpresas]       = useState([]);
  const [empresa, setEmpresa]         = useState("");
  const [invoices, setInvoices]       = useState([]);
  const [loading, setLoading]         = useState(false);
  const [search, setSearch]           = useState("");
  const [editInv, setEditInv]         = useState(null);   // factura en edición
  const [sortField, setSortField]     = useState("f_emision");
  const [sortDir, setSortDir]         = useState("desc");

  useEffect(() => {
    api.get("/empresas-config")
      .then(r => setEmpresas((r.data || []).map(c => c.empresa)))
      .catch(() => {});
  }, []);

  const load = async (emp) => {
    if (!emp) { setInvoices([]); return; }
    setLoading(true);
    try {
      const { data } = await api.get("/invoices", { params: { empresa: emp } });
      // Filtrar solo facturas propias (no las de subsidio dinámico que no tienen ID permanente)
      setInvoices((data || []).filter(i => i.id && i.created_via !== "subsidio_dynamic"));
    } catch { setInvoices([]); }
    finally { setLoading(false); }
  };

  useEffect(() => { load(empresa); }, [empresa]);

  const handleSort = (field) => {
    if (sortField === field) setSortDir(d => d === "asc" ? "desc" : "asc");
    else { setSortField(field); setSortDir("asc"); }
  };

  const filtered = useMemo(() => {
    let rows = invoices;
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      rows = rows.filter(i =>
        (i.n_doc || "").toLowerCase().includes(q) ||
        (i.tipo_doc || "").toLowerCase().includes(q) ||
        (i.producto || "").toLowerCase().includes(q)
      );
    }
    return [...rows].sort((a, b) => {
      const av = a[sortField] ?? "";
      const bv = b[sortField] ?? "";
      const cmp = String(av).localeCompare(String(bv), "es", { numeric: true });
      return sortDir === "asc" ? cmp : -cmp;
    });
  }, [invoices, search, sortField, sortDir]);

  const handleDelete = async (inv) => {
    if (!window.confirm(`¿Eliminar la factura ${inv.n_doc}?\nEsta acción no se puede deshacer.`)) return;
    try {
      await api.delete(`/invoices/${inv.id}`);
      setInvoices(prev => prev.filter(x => x.id !== inv.id));
    } catch (e) {
      alert("Error al eliminar: " + (e.response?.data?.detail || e.message));
    }
  };

  const SortIcon = ({ field }) => {
    if (sortField !== field) return <ChevronDown className="w-3 h-3 opacity-30 inline ml-1" />;
    return sortDir === "asc"
      ? <ChevronUp   className="w-3 h-3 text-brand inline ml-1" />
      : <ChevronDown className="w-3 h-3 text-brand inline ml-1" />;
  };

  const montoWarn = (inv) => parseFloat(inv.monto_total || 0) === 0;
  const sinArchivos = (inv) => !inv.pdf_filename && !inv.xml_filename;

  const alertCount = filtered.filter(i => montoWarn(i) || sinArchivos(i)).length;

  return (
    <div className="chart-card border-l-4 border-l-emerald-400" data-testid="invoices-manager-card">
      {/* Header */}
      <div className="flex items-start gap-3 mb-5 pb-4 border-b border-neutral-100">
        <div className="w-10 h-10 rounded-md bg-emerald-50 border border-emerald-100 flex items-center justify-center flex-shrink-0">
          <FileText className="w-5 h-5 text-emerald-600" strokeWidth={2.5} />
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="font-cabinet font-bold text-lg text-neutral-900">Gestión de Facturas por Cliente</h3>
          <p className="text-xs text-neutral-500 mt-0.5">
            Edita, elimina o re-sube archivos de facturas individuales. Las facturas con&nbsp;
            <span className="font-bold text-amber-600">S/ 0.00</span> o sin archivos adjuntos se resaltan automáticamente.
          </p>
        </div>
        {empresa && !loading && (
          <button onClick={() => load(empresa)} className="p-2 rounded-lg border border-neutral-200 hover:border-brand text-neutral-500 hover:text-brand transition-colors" title="Refrescar">
            <RefreshCw className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* Controles */}
      <div className="flex flex-col sm:flex-row gap-3 mb-4">
        <div className="flex-1">
          <label className="text-[10px] font-bold uppercase tracking-widest text-neutral-500 mb-1 block">Empresa</label>
          <select
            value={empresa}
            onChange={e => setEmpresa(e.target.value)}
            className="h-10 w-full px-3 border border-border rounded-md bg-white text-sm font-semibold focus:border-brand focus:ring-1 focus:ring-brand outline-none"
            data-testid="inv-manager-empresa"
          >
            <option value="">— Selecciona una empresa —</option>
            {empresas.map(e => <option key={e} value={e}>{e}</option>)}
          </select>
        </div>
        <div className="flex-1">
          <label className="text-[10px] font-bold uppercase tracking-widest text-neutral-500 mb-1 block">Buscar</label>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-400" />
            <input
              type="text"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="N° Doc, tipo, producto…"
              className="h-10 w-full pl-9 pr-3 border border-border rounded-md bg-white text-sm focus:border-brand focus:ring-1 focus:ring-brand outline-none"
              data-testid="inv-manager-search"
            />
          </div>
        </div>
      </div>

      {/* Alertas */}
      {empresa && !loading && alertCount > 0 && (
        <div className="mb-4 flex items-start gap-2 px-4 py-3 bg-amber-50 border border-amber-200 rounded-xl">
          <AlertTriangle className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
          <p className="text-xs text-amber-800 font-semibold">
            {alertCount} factura{alertCount !== 1 ? "s" : ""} requiere{alertCount === 1 ? "" : "n"} atención: monto en S/ 0.00 o sin archivos adjuntos.
          </p>
        </div>
      )}

      {/* Estados vacíos */}
      {!empresa && (
        <div className="text-center py-14 text-neutral-400">
          <FileText className="w-12 h-12 mx-auto mb-3 opacity-30" />
          <p className="text-sm font-medium">Selecciona una empresa para ver sus facturas</p>
        </div>
      )}
      {empresa && loading && (
        <div className="text-center py-14 text-neutral-400">
          <RefreshCw className="w-8 h-8 mx-auto mb-3 animate-spin opacity-40" />
          <p className="text-sm">Cargando facturas…</p>
        </div>
      )}
      {empresa && !loading && filtered.length === 0 && (
        <div className="text-center py-14 text-neutral-400">
          <FileText className="w-12 h-12 mx-auto mb-3 opacity-30" />
          <p className="text-sm font-medium">{search ? "Sin resultados para esa búsqueda" : "Esta empresa no tiene facturas registradas"}</p>
        </div>
      )}

      {/* Tabla */}
      {empresa && !loading && filtered.length > 0 && (
        <>
          <div className="flex items-center justify-between mb-3">
            <p className="text-xs text-neutral-500 font-semibold">
              {filtered.length} factura{filtered.length !== 1 ? "s" : ""}
              {search && ` (filtradas de ${invoices.length})`}
            </p>
          </div>
          <div className="overflow-x-auto rounded-xl border border-neutral-200">
            <table className="w-full text-sm" data-testid="inv-manager-table">
              <thead className="bg-[#1E1B4B] text-white">
                <tr className="text-[10px] font-bold uppercase tracking-wider">
                  {[
                    { label: "N° Doc",        field: "n_doc" },
                    { label: "Tipo",          field: "tipo_doc" },
                    { label: "F. Emisión",    field: "f_emision" },
                    { label: "F. Vencimiento",field: "f_vencimiento" },
                    { label: "Monto Total",   field: "monto_total" },
                    { label: "Saldo",         field: "saldo" },
                    { label: "Estado",        field: "estado" },
                    { label: "Archivos",      field: null },
                    { label: "Acciones",      field: null },
                  ].map(({ label, field }) => (
                    <th
                      key={label}
                      onClick={() => field && handleSort(field)}
                      className={`px-3 py-3 text-left whitespace-nowrap ${field ? "cursor-pointer hover:bg-white/10 select-none" : ""}`}
                    >
                      {label}{field && <SortIcon field={field} />}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-100">
                {filtered.map(inv => {
                  const warn0 = montoWarn(inv);
                  const warnNoFiles = sinArchivos(inv);
                  const rowCls = warn0 || warnNoFiles ? "bg-amber-50/40 hover:bg-amber-50" : "hover:bg-neutral-50";
                  const estadoCls = ESTADO_BADGE[inv.estado] || "bg-neutral-100 text-neutral-600 border-neutral-200";
                  return (
                    <tr key={inv.id} className={`transition-colors ${rowCls}`}>
                      <td className="px-3 py-2.5 font-mono font-bold text-brand whitespace-nowrap">
                        {inv.n_doc}
                        {warn0 && <span className="ml-1.5 inline-flex items-center gap-0.5 text-[9px] font-bold bg-amber-100 text-amber-700 border border-amber-200 rounded-full px-1.5 py-0.5"><AlertTriangle className="w-2.5 h-2.5" />S/0</span>}
                      </td>
                      <td className="px-3 py-2.5 text-neutral-600 text-xs whitespace-nowrap">{inv.tipo_doc || "—"}</td>
                      <td className="px-3 py-2.5 text-neutral-600 whitespace-nowrap">{formatDate(inv.f_emision) || "—"}</td>
                      <td className="px-3 py-2.5 text-neutral-600 whitespace-nowrap">{formatDate(inv.f_vencimiento) || "—"}</td>
                      <td className={`px-3 py-2.5 text-right font-bold whitespace-nowrap ${warn0 ? "text-amber-600" : "text-neutral-900"}`}>
                        {formatSoles(inv.monto_total)}
                      </td>
                      <td className="px-3 py-2.5 text-right text-neutral-700 whitespace-nowrap">{formatSoles(inv.saldo)}</td>
                      <td className="px-3 py-2.5">
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${estadoCls}`}>
                          {ESTADO_LABEL[inv.estado] || (inv.estado || "—").toUpperCase()}
                        </span>
                      </td>
                      <td className="px-3 py-2.5">
                        <div className="flex items-center gap-1">
                          {inv.pdf_filename
                            ? <span className="inline-flex items-center gap-0.5 text-[10px] font-bold bg-red-50 text-red-600 border border-red-200 rounded px-1.5 py-0.5">PDF</span>
                            : <span className="inline-flex items-center gap-0.5 text-[10px] font-bold bg-neutral-100 text-neutral-400 border border-neutral-200 rounded px-1.5 py-0.5">Sin PDF</span>
                          }
                          {inv.xml_filename
                            ? <span className="inline-flex items-center gap-0.5 text-[10px] font-bold bg-blue-50 text-blue-600 border border-blue-200 rounded px-1.5 py-0.5">XML</span>
                            : <span className="inline-flex items-center gap-0.5 text-[10px] font-bold bg-neutral-100 text-neutral-400 border border-neutral-200 rounded px-1.5 py-0.5">Sin XML</span>
                          }
                        </div>
                      </td>
                      <td className="px-3 py-2.5">
                        <div className="flex items-center gap-1">
                          <button
                            onClick={() => setEditInv({ ...inv })}
                            className="p-1.5 rounded-md hover:bg-brand/10 text-brand transition-colors"
                            title="Editar factura"
                            data-testid={`inv-edit-${inv.n_doc}`}
                          >
                            <Edit3 className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleDelete(inv)}
                            className="p-1.5 rounded-md hover:bg-red-50 text-red-500 transition-colors"
                            title="Eliminar factura"
                            data-testid={`inv-delete-${inv.n_doc}`}
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </>
      )}

      {/* Modal de edición */}
      {editInv && (
        <InvoiceEditModal
          inv={editInv}
          onClose={() => setEditInv(null)}
          onSaved={(updated) => {
            setInvoices(prev => prev.map(x => x.id === updated.id ? updated : x));
            setEditInv(null);
          }}
        />
      )}
    </div>
  );
}

// ─── Modal de edición de factura ─────────────────────────────────────────────
function InvoiceEditModal({ inv, onClose, onSaved }) {
  const [form, setForm] = useState({
    n_doc:          inv.n_doc          || "",
    tipo_doc:       inv.tipo_doc       || "Factura Ventas",
    producto:       inv.producto       || "",
    f_emision:      inv.f_emision      || "",
    f_vencimiento:  inv.f_vencimiento  || "",
    moneda:         inv.moneda         || "PEN",
    monto_total:    inv.monto_total    ?? 0,
    saldo:          inv.saldo          ?? 0,
    estado:         inv.estado         || "pendiente",
  });
  const [pdfFile, setPdfFile]   = useState(null);
  const [xmlFile, setXmlFile]   = useState(null);
  const [saving, setSaving]     = useState(false);
  const [err, setErr]           = useState("");
  const pdfRef = useRef(null);
  const xmlRef = useRef(null);

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const handleSave = async (e) => {
    e.preventDefault();
    setErr(""); setSaving(true);
    try {
      // 1. Actualizar campos de texto
      const patch = {
        tipo_doc:      form.tipo_doc,
        producto:      form.producto,
        f_emision:     form.f_emision || null,
        f_vencimiento: form.f_vencimiento || null,
        moneda:        form.moneda,
        monto_total:   parseFloat(form.monto_total) || 0,
        saldo:         parseFloat(form.saldo) || 0,
        estado:        form.estado,
      };
      const { data: updated } = await api.put(`/invoices/${inv.id}`, patch);

      // 2. Re-subir archivos si se seleccionaron
      let finalInv = updated;
      if (pdfFile || xmlFile) {
        const fd = new FormData();
        if (pdfFile) fd.append("pdf", pdfFile);
        if (xmlFile) fd.append("xml", xmlFile);
        const { data: fileRes } = await api.post(
          `/admin/invoices/${inv.id}/upload-file`, fd,
          { headers: { "Content-Type": "multipart/form-data" } }
        );
        finalInv = fileRes.invoice || updated;
      }

      onSaved(finalInv);
    } catch (ex) {
      setErr(formatApiError(ex.response?.data?.detail) || ex.message);
    } finally { setSaving(false); }
  };

  const TIPO_OPTS = ["Factura Ventas", "Boleta Ventas", "Nota de Crédito", "Nota de Débito"];
  const ESTADO_OPTS = [
    { v: "pagada",    l: "PAGADA",    cls: "bg-green-50 text-green-700 border-green-200" },
    { v: "pendiente", l: "PENDIENTE", cls: "bg-amber-50 text-amber-700 border-amber-200" },
    { v: "vencida",   l: "VENCIDA",   cls: "bg-red-50  text-red-700  border-red-200" },
    { v: "tercero",   l: "TERCERO",   cls: "bg-blue-50 text-blue-700 border-blue-200" },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-neutral-900/60 p-4 overflow-y-auto" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl my-4 overflow-hidden">
        {/* Header */}
        <div className="flex justify-between items-center px-6 py-4 border-b border-neutral-100 bg-[#1E1B4B]">
          <div>
            <h3 className="font-cabinet font-bold text-lg text-white">Editar Factura</h3>
            <p className="text-xs text-white/60 mt-0.5 font-mono">{inv.n_doc} · {inv.empresa}</p>
          </div>
          <button onClick={onClose} className="p-2 rounded-full hover:bg-white/10 text-white/70 hover:text-white transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSave} className="px-6 py-5 space-y-5">

          {/* Fila 1: N° Doc (readonly) + Tipo */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-[10px] font-bold uppercase tracking-widest text-neutral-500 mb-1">N° Documento</label>
              <input value={form.n_doc} disabled className="w-full h-10 px-3 border border-neutral-200 rounded-lg text-sm bg-neutral-50 text-neutral-400 font-mono cursor-not-allowed" />
            </div>
            <div>
              <label className="block text-[10px] font-bold uppercase tracking-widest text-neutral-500 mb-1">Tipo de Documento</label>
              <select value={form.tipo_doc} onChange={e => set("tipo_doc", e.target.value)} className="w-full h-10 px-3 border border-neutral-200 rounded-lg text-sm focus:ring-2 focus:ring-brand outline-none">
                {TIPO_OPTS.map(t => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
          </div>

          {/* Fila 2: Producto */}
          <div>
            <label className="block text-[10px] font-bold uppercase tracking-widest text-neutral-500 mb-1">Producto / Descripción</label>
            <input
              type="text" value={form.producto}
              onChange={e => set("producto", e.target.value)}
              placeholder="ej. DIESEL B5 S-50"
              className="w-full h-10 px-3 border border-neutral-200 rounded-lg text-sm focus:ring-2 focus:ring-brand outline-none"
            />
          </div>

          {/* Fila 3: Fechas */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-[10px] font-bold uppercase tracking-widest text-neutral-500 mb-1">Fecha de Emisión</label>
              <input type="date" value={form.f_emision} onChange={e => set("f_emision", e.target.value)} className="w-full h-10 px-3 border border-neutral-200 rounded-lg text-sm focus:ring-2 focus:ring-brand outline-none" />
            </div>
            <div>
              <label className="block text-[10px] font-bold uppercase tracking-widest text-neutral-500 mb-1">Fecha de Vencimiento</label>
              <input type="date" value={form.f_vencimiento} onChange={e => set("f_vencimiento", e.target.value)} className="w-full h-10 px-3 border border-neutral-200 rounded-lg text-sm focus:ring-2 focus:ring-brand outline-none" />
            </div>
          </div>

          {/* Fila 4: Monto + Saldo + Moneda */}
          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className="block text-[10px] font-bold uppercase tracking-widest text-neutral-500 mb-1">Monto Total (S/)</label>
              <input
                type="number" step="0.01" min="0"
                value={form.monto_total}
                onChange={e => set("monto_total", e.target.value)}
                className="w-full h-10 px-3 border border-neutral-200 rounded-lg text-sm focus:ring-2 focus:ring-brand outline-none font-bold"
              />
            </div>
            <div>
              <label className="block text-[10px] font-bold uppercase tracking-widest text-neutral-500 mb-1">Saldo Pendiente (S/)</label>
              <input
                type="number" step="0.01" min="0"
                value={form.saldo}
                onChange={e => set("saldo", e.target.value)}
                className="w-full h-10 px-3 border border-neutral-200 rounded-lg text-sm focus:ring-2 focus:ring-brand outline-none"
              />
            </div>
            <div>
              <label className="block text-[10px] font-bold uppercase tracking-widest text-neutral-500 mb-1">Moneda</label>
              <select value={form.moneda} onChange={e => set("moneda", e.target.value)} className="w-full h-10 px-3 border border-neutral-200 rounded-lg text-sm focus:ring-2 focus:ring-brand outline-none">
                <option value="PEN">PEN (Soles)</option>
                <option value="USD">USD (Dólares)</option>
              </select>
            </div>
          </div>

          {/* Fila 5: Estado */}
          <div>
            <label className="block text-[10px] font-bold uppercase tracking-widest text-neutral-500 mb-2">Estado</label>
            <div className="flex gap-2">
              {ESTADO_OPTS.map(o => (
                <button
                  key={o.v} type="button"
                  onClick={() => set("estado", o.v)}
                  className={`px-4 h-9 rounded-full border text-xs font-bold transition-all ${
                    form.estado === o.v ? `${o.cls} ring-2 ring-offset-1 ring-brand` : "bg-white text-neutral-400 border-neutral-200 hover:border-neutral-400"
                  }`}
                >
                  {o.l}
                </button>
              ))}
            </div>
          </div>

          {/* Fila 6: Re-subida de archivos */}
          <div className="rounded-xl border border-dashed border-neutral-300 bg-neutral-50 p-4 space-y-3">
            <div className="flex items-center gap-2 text-sm font-bold text-neutral-700">
              <FileUp className="w-4 h-4 text-brand" />
              Re-subir archivos (opcional)
            </div>
            <div className="grid grid-cols-2 gap-3">
              {/* PDF */}
              <div>
                <div className="flex items-center gap-2 mb-1.5">
                  <span className="text-[10px] font-bold uppercase tracking-widest text-neutral-500">PDF</span>
                  {inv.pdf_filename
                    ? <span className="text-[10px] text-green-600 font-semibold">✓ Archivo existente</span>
                    : <span className="text-[10px] text-amber-600 font-semibold">⚠ Sin archivo</span>
                  }
                </div>
                <div
                  onClick={() => pdfRef.current?.click()}
                  className={`border-2 border-dashed rounded-lg p-3 text-center cursor-pointer transition-colors ${pdfFile ? "border-brand bg-brand/5" : "border-neutral-200 hover:border-brand/50 hover:bg-brand/5"}`}
                >
                  <FileText className={`w-5 h-5 mx-auto mb-1 ${pdfFile ? "text-brand" : "text-neutral-400"}`} />
                  <div className="text-[11px] font-semibold text-neutral-600 truncate">
                    {pdfFile ? pdfFile.name : "Click para seleccionar PDF"}
                  </div>
                  <input ref={pdfRef} type="file" accept=".pdf,application/pdf" className="hidden" onChange={e => setPdfFile(e.target.files[0] || null)} data-testid="inv-edit-pdf" />
                </div>
                {pdfFile && (
                  <button type="button" onClick={() => { setPdfFile(null); if (pdfRef.current) pdfRef.current.value = ""; }} className="text-[10px] text-red-500 hover:underline mt-1">
                    × Quitar PDF
                  </button>
                )}
              </div>
              {/* XML */}
              <div>
                <div className="flex items-center gap-2 mb-1.5">
                  <span className="text-[10px] font-bold uppercase tracking-widest text-neutral-500">XML</span>
                  {inv.xml_filename
                    ? <span className="text-[10px] text-green-600 font-semibold">✓ Archivo existente</span>
                    : <span className="text-[10px] text-amber-600 font-semibold">⚠ Sin archivo</span>
                  }
                </div>
                <div
                  onClick={() => xmlRef.current?.click()}
                  className={`border-2 border-dashed rounded-lg p-3 text-center cursor-pointer transition-colors ${xmlFile ? "border-blue-400 bg-blue-50/50" : "border-neutral-200 hover:border-blue-300 hover:bg-blue-50/30"}`}
                >
                  <FileSpreadsheet className={`w-5 h-5 mx-auto mb-1 ${xmlFile ? "text-blue-600" : "text-neutral-400"}`} />
                  <div className="text-[11px] font-semibold text-neutral-600 truncate">
                    {xmlFile ? xmlFile.name : "Click para seleccionar XML"}
                  </div>
                  <input ref={xmlRef} type="file" accept=".xml,text/xml,application/xml" className="hidden" onChange={e => setXmlFile(e.target.files[0] || null)} data-testid="inv-edit-xml" />
                </div>
                {xmlFile && (
                  <button type="button" onClick={() => { setXmlFile(null); if (xmlRef.current) xmlRef.current.value = ""; }} className="text-[10px] text-red-500 hover:underline mt-1">
                    × Quitar XML
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* Error */}
          {err && (
            <div className="flex items-start gap-2 px-3 py-2.5 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
              <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
              <span>{err}</span>
            </div>
          )}

          {/* Footer botones */}
          <div className="flex justify-end gap-3 pt-2 border-t border-neutral-100">
            <button type="button" onClick={onClose} className="h-10 px-5 rounded-lg border border-neutral-200 text-sm font-semibold text-neutral-600 hover:border-neutral-400 transition-colors">
              Cancelar
            </button>
            <button
              type="submit" disabled={saving}
              className="h-10 px-6 rounded-lg bg-brand text-white text-sm font-bold hover:bg-brand/90 transition-colors disabled:opacity-50 flex items-center gap-2"
              data-testid="inv-edit-save"
            >
              {saving ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              {saving ? "Guardando…" : "Guardar cambios"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
