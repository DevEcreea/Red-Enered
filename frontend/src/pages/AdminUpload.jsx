import React, { useEffect, useState } from "react";
import { api } from "../lib/api";
import { formatApiError, formatDate, formatSoles } from "../lib/utils";
import {
  Upload, FileSpreadsheet, Trash2, CheckCircle2, AlertCircle, FileText,
  Cloud, RefreshCw, Clock, ExternalLink, Settings, Save, Building2, Receipt,
} from "lucide-react";
import { Link } from "react-router-dom";

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
        <p className="text-neutral-500 mt-1 text-sm">Sincroniza desde Google Sheets, configura empresas y gestiona facturación.</p>
      </div>

      <EmpresaConfigManager />

      <InvoicesBulkUpload />

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

const PLAN_OPTIONS = [
  { value: "tracking", label: "Plan Tracking" },
  { value: "advanced", label: "Plan Advanced" },
  { value: "integral", label: "Plan Integral" },
];

function EmpresaConfigManager() {
  const [items, setItems] = useState([]);
  const [empresasDisponibles, setEmpresasDisponibles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ empresa: "", ruc: "", plan: "tracking", linea_credito: 0, unidades_contratadas: 0, dias_credito: 0 });
  const [err, setErr] = useState("");
  const [editing, setEditing] = useState(null);

  const load = async () => {
    setLoading(true);
    try {
      const [a, b] = await Promise.all([api.get("/empresas-config"), api.get("/empresas")]);
      setItems(a.data); setEmpresasDisponibles(b.data);
    } finally { setLoading(false); }
  };

  useEffect(() => { load(); }, []);

  const openNew = () => {
    setEditing(null);
    setForm({ empresa: "", ruc: "", plan: "tracking", linea_credito: 0, unidades_contratadas: 0, dias_credito: 0 });
    setShowForm(true); setErr("");
  };

  const openEdit = (cfg) => {
    setEditing(cfg.empresa);
    setForm({
      empresa: cfg.empresa,
      ruc: cfg.ruc || "",
      plan: cfg.plan || "tracking",
      linea_credito: cfg.linea_credito || 0,
      unidades_contratadas: cfg.unidades_contratadas || 0,
      dias_credito: cfg.dias_credito ?? 0,
    });
    setShowForm(true); setErr("");
  };

  const submit = async (e) => {
    e.preventDefault(); setErr("");
    const dc = parseInt(form.dias_credito, 10);
    if (isNaN(dc) || dc < 0) { setErr("Condición de crédito (días) es obligatoria. Mínimo 0."); return; }
    try {
      setSaving(form.empresa);
      await api.post("/empresas-config", {
        ...form,
        linea_credito: parseFloat(form.linea_credito) || 0,
        unidades_contratadas: parseInt(form.unidades_contratadas) || 0,
        dias_credito: dc,
      });
      setShowForm(false);
      load();
    } catch (e2) { setErr(formatApiError(e2.response?.data?.detail)); }
    finally { setSaving(null); }
  };

  return (
    <div className="chart-card border-l-4 border-l-amber-400" data-testid="empresa-config-card">
      <div className="flex items-start justify-between gap-4 mb-5 pb-4 border-b border-neutral-100">
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-md bg-amber-50 border border-amber-100 flex items-center justify-center">
            <Settings className="w-5 h-5 text-amber-600" strokeWidth={2.5} />
          </div>
          <div>
            <h3 className="font-cabinet font-bold text-lg text-neutral-900">Configuración por empresa</h3>
            <p className="text-xs text-neutral-500 mt-1">Plan contratado · línea de crédito · unidades · RUC</p>
          </div>
        </div>
        <button onClick={openNew} className="btn-brand text-sm flex items-center gap-2" data-testid="empresa-config-new-btn">
          + Nueva configuración
        </button>
      </div>

      {showForm && (
        <form onSubmit={submit} className="bg-neutral-50 border border-border rounded-lg p-4 mb-5 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3" data-testid="empresa-config-form">
          {editing ? (
            <input value={form.empresa} disabled className="h-10 px-3 border border-border rounded-md text-sm bg-white font-mono" />
          ) : (
            <select required value={form.empresa} onChange={(e) => setForm({ ...form, empresa: e.target.value })} className="h-10 px-3 border border-border rounded-md text-sm bg-white">
              <option value="">Empresa (del sheet)</option>
              {empresasDisponibles.map((e) => <option key={e}>{e}</option>)}
            </select>
          )}
          <input placeholder="RUC" value={form.ruc} onChange={(e) => setForm({ ...form, ruc: e.target.value })} className="h-10 px-3 border border-border rounded-md text-sm font-mono" />
          <select value={form.plan} onChange={(e) => setForm({ ...form, plan: e.target.value })} className="h-10 px-3 border border-border rounded-md text-sm bg-white">
            {PLAN_OPTIONS.map((p) => <option key={p.value} value={p.value}>{p.label}</option>)}
          </select>
          <input type="number" step="0.01" placeholder="Línea de crédito (S/)" value={form.linea_credito} onChange={(e) => setForm({ ...form, linea_credito: e.target.value })} className="h-10 px-3 border border-border rounded-md text-sm" />
          <input type="number" placeholder="Unidades contratadas" value={form.unidades_contratadas} onChange={(e) => setForm({ ...form, unidades_contratadas: e.target.value })} className="h-10 px-3 border border-border rounded-md text-sm" />
          <input
            required
            type="number"
            min="0"
            placeholder="Días de crédito (ej. 15)"
            value={form.dias_credito}
            onChange={(e) => setForm({ ...form, dias_credito: e.target.value })}
            className="h-10 px-3 border border-border rounded-md text-sm"
            data-testid="empresa-config-dias-credito"
          />
          {err && <div className="md:col-span-3 text-sm text-red-600 bg-red-50 border border-red-100 rounded-md px-3 py-2">{err}</div>}
          <div className="md:col-span-3 flex gap-2">
            <button type="submit" disabled={saving} className="btn-brand text-sm flex items-center gap-2 disabled:opacity-60" data-testid="empresa-config-save">
              <Save className="w-4 h-4" /> {editing ? "Guardar cambios" : "Crear configuración"}
            </button>
            <button type="button" onClick={() => setShowForm(false)} className="btn-ghost text-sm">Cancelar</button>
          </div>
        </form>
      )}

      <div className="overflow-x-auto">
        <table className="enered-table" data-testid="empresa-config-table">
          <thead>
            <tr>
              <th>Empresa</th><th>RUC</th><th>Plan</th>
              <th className="text-right">Línea de crédito</th>
              <th className="text-right">Unidades</th>
              <th className="text-right">Días Créd.</th>
              <th className="text-right">Acciones</th>
            </tr>
          </thead>
          <tbody>
            {loading ? <tr><td colSpan={7} className="text-center py-6 text-neutral-500">Cargando...</td></tr>
              : items.length === 0 ? <tr><td colSpan={7} className="text-center py-6 text-neutral-500">Sin empresas configuradas</td></tr>
              : items.map((cfg) => (
                <tr key={cfg.empresa}>
                  <td className="font-bold flex items-center gap-2"><Building2 className="w-3.5 h-3.5 text-brand" />{cfg.empresa}</td>
                  <td className="font-mono text-xs">{cfg.ruc || "—"}</td>
                  <td><span className="text-xs font-bold px-2 py-1 bg-brand-50 text-brand rounded-full border border-brand-100 capitalize">{cfg.plan}</span></td>
                  <td className="text-right font-bold">{formatSoles(cfg.linea_credito)}</td>
                  <td className="text-right font-bold">{cfg.unidades_contratadas}</td>
                  <td className="text-right font-bold">{cfg.dias_credito ?? 0}</td>
                  <td className="text-right">
                    <button onClick={() => openEdit(cfg)} className="text-xs font-bold text-brand hover:underline" data-testid={`empresa-config-edit-${cfg.empresa}`}>Editar</button>
                  </td>
                </tr>
              ))}
          </tbody>
        </table>
      </div>

      <div className="mt-4 flex items-center gap-3 p-3 bg-brand-50 border border-brand-100 rounded-md text-xs text-brand">
        <Receipt className="w-4 h-4 flex-shrink-0" />
        <span><b>Facturas pendientes de pago</b> se gestionan en el módulo <Link to="/facturacion" className="font-bold underline">Estado de Cuenta</Link>. La línea utilizada se calcula automáticamente sumando facturas con estado <b>pendiente</b> o <b>vencida</b>.</span>
      </div>
    </div>
  );
}


function InvoicesBulkUpload() {
  const [files, setFiles] = useState([]);
  const [uploading, setUploading] = useState(false);
  const [result, setResult] = useState(null);
  const [err, setErr] = useState("");

  const handleFiles = (selected) => {
    const arr = Array.from(selected || []);
    setFiles(arr);
    setResult(null);
    setErr("");
  };

  const submit = async () => {
    if (files.length === 0) return;
    setUploading(true); setResult(null); setErr("");
    try {
      const fd = new FormData();
      files.forEach((f) => fd.append("files", f));
      const { data } = await api.post("/admin/invoices/upload-bulk", fd, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      setResult(data);
      setFiles([]);
    } catch (e) { setErr(formatApiError(e.response?.data?.detail)); }
    finally { setUploading(false); }
  };

  const pdfCount = files.filter((f) => f.name.toLowerCase().endsWith(".pdf")).length;
  const xmlCount = files.filter((f) => f.name.toLowerCase().endsWith(".xml")).length;

  return (
    <div className="chart-card border-l-4 border-l-cyan-400" data-testid="invoices-upload-card">
      <div className="flex items-start gap-3 mb-5 pb-4 border-b border-neutral-100">
        <div className="w-10 h-10 rounded-md bg-cyan-50 border border-cyan-100 flex items-center justify-center">
          <Receipt className="w-5 h-5 text-cyan-600" strokeWidth={2.5} />
        </div>
        <div>
          <h3 className="font-cabinet font-bold text-lg text-neutral-900">Carga masiva de facturas</h3>
          <p className="text-xs text-neutral-500 mt-1">Adjunta los pares <b>PDF + XML</b> generados por tu facturador. Se parsea el XML SUNAT y se asigna a la empresa por <b>RUC</b>.</p>
        </div>
      </div>

      <label className="block border-2 border-dashed border-cyan-200 rounded-xl bg-cyan-50/40 hover:bg-cyan-50 p-8 text-center cursor-pointer transition-colors" data-testid="invoices-dropzone">
        <Upload className="w-8 h-8 text-cyan-600 mx-auto mb-2" />
        <div className="font-bold text-sm text-neutral-700">
          {files.length > 0 ? `${files.length} archivo(s): ${pdfCount} PDF · ${xmlCount} XML` : "Selecciona o arrastra archivos PDF y XML"}
        </div>
        <div className="text-xs text-neutral-500 mt-1">Cada par debe tener el mismo nombre base (ej. <code>F001-123.pdf</code> + <code>F001-123.xml</code>)</div>
        <input
          type="file"
          multiple
          accept=".pdf,.xml,application/pdf,text/xml,application/xml"
          onChange={(e) => handleFiles(e.target.files)}
          className="hidden"
          data-testid="invoices-file-input"
        />
      </label>

      <div className="flex items-center gap-2 mt-4">
        <button onClick={submit} disabled={uploading || files.length === 0} className="btn-brand text-sm flex items-center gap-2 disabled:opacity-50" data-testid="invoices-upload-btn">
          {uploading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
          {uploading ? "Procesando…" : `Cargar ${files.length || ""} archivo(s)`}
        </button>
        {files.length > 0 && (
          <button onClick={() => setFiles([])} className="btn-ghost text-sm">Limpiar selección</button>
        )}
      </div>

      {err && (
        <div className="mt-4 text-sm text-red-600 bg-red-50 border border-red-100 rounded-md px-3 py-2 flex items-start gap-2">
          <AlertCircle className="w-4 h-4 mt-0.5" /> {err}
        </div>
      )}
      {result && (
        <div className="mt-4 bg-neutral-50 border border-neutral-200 rounded-xl p-4 space-y-2">
          <div className="flex items-center gap-2 text-sm">
            <CheckCircle2 className="w-4 h-4 text-green-600" />
            <span className="font-bold text-green-700">{result.uploaded} factura(s) procesadas</span>
          </div>
          {result.saved?.length > 0 && (
            <div className="text-xs text-neutral-600 space-y-0.5 max-h-40 overflow-y-auto">
              {result.saved.map((s, i) => (
                <div key={i} className="font-mono">• <b>{s.n_doc}</b> → {s.empresa} <span className={`ml-2 ${s.estado === "vencido" ? "text-red-600" : "text-amber-600"}`}>[{s.estado}]</span></div>
              ))}
            </div>
          )}
          {result.skipped?.length > 0 && (
            <div>
              <div className="flex items-center gap-2 text-sm">
                <AlertCircle className="w-4 h-4 text-amber-600" />
                <span className="font-bold text-amber-700">{result.skipped.length} omitido(s)</span>
              </div>
              <div className="mt-1 text-xs text-neutral-600 space-y-0.5">
                {result.skipped.map((s, i) => (
                  <div key={i}>• <b>{s.base}</b>: {s.reason}</div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
