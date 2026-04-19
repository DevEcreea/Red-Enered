import React, { useEffect, useState } from "react";
import { api } from "../lib/api";
import { formatApiError, formatDate } from "../lib/utils";
import {
  Upload, FileSpreadsheet, Trash2, CheckCircle2, AlertCircle, FileText,
  Cloud, RefreshCw, Clock, ExternalLink,
} from "lucide-react";

const REQUIRED_COLS = ["FECHA", "EMPRESA", "PLACA", "CIUDAD", "ESTACION", "PRODUCTO", "CANTIDAD_GL", "IMPORTE_TOTAL"];

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
        <h1 className="font-cabinet font-black text-3xl md:text-4xl text-neutral-900">Fuente de datos</h1>
        <p className="text-neutral-500 mt-1 text-sm">Sincroniza desde Google Sheets o sube manualmente CSV / Excel.</p>
      </div>

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
