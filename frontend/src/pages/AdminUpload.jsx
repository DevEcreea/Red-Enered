import React, { useState } from "react";
import { api } from "../lib/api";
import { formatApiError } from "../lib/utils";
import { Upload, FileSpreadsheet, Trash2, CheckCircle2, AlertCircle, FileText } from "lucide-react";

const REQUIRED_COLS = ["FECHA", "EMPRESA", "PLACA", "CIUDAD", "ESTACION", "PRODUCTO", "CANTIDAD_GL", "IMPORTE_TOTAL"];

export default function AdminUpload() {
  const [file, setFile] = useState(null);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [err, setErr] = useState("");

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

  return (
    <div className="space-y-6">
      <div>
        <div className="text-[11px] font-bold uppercase tracking-widest text-brand mb-2">Administración</div>
        <h1 className="font-cabinet font-black text-3xl md:text-4xl text-neutral-900">Subir consumos</h1>
        <p className="text-neutral-500 mt-1 text-sm">Carga datos consolidados desde CSV o Excel exportado de Google Sheets.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="chart-card lg:col-span-2">
          <h3 className="font-cabinet font-bold text-lg mb-4 flex items-center gap-2">
            <Upload className="w-5 h-5 text-brand" /> Carga masiva
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
            Columnas opcionales: HORA, NRO_DE_TARJETA, UNIDAD, PRECIO_UNITARIO, PRECIO_PIZARRA, AHORRO, NOTA_DE_DESPACHO, KILOMETRAJE, MEDIO_DE_IDENTIFICACION, SEMANA.
          </div>
          <div className="mt-4 p-3 bg-brand-50 border border-brand-100 rounded-md text-xs text-brand">
            <b>Tip Google Sheets:</b> Archivo → Descargar → Valores separados por comas (.csv)
          </div>
        </div>
      </div>
    </div>
  );
}
