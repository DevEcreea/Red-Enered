import React, { useEffect, useState, useRef } from "react";
import { useNavigate } from "react-router-dom";
import {
  Loader2, ArrowLeft, CheckCircle2, AlertTriangle, Trash2, Save, FileText, AlertCircle,
  Upload, ScanLine,
} from "lucide-react";
import { api } from "../lib/api";

const PRODUCTOS = [
  "DIESEL B5", "DIESEL B20", "DIESEL B5 S50",
];

export default function SubsidioVerificar() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [confirming, setConfirming] = useState(false);
  const [items, setItems] = useState([]);
  const [vehicles, setVehicles] = useState([]);
  const [savingId, setSavingId] = useState(null);
  const [error, setError] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState({ done: 0, total: 0 });
  const fileRef = useRef(null);

  const load = async () => {
    try {
      const { data } = await api.get("/subsidio/invoices/preview");
      setItems(data.items || []);
      setVehicles(data.vehicles || []);
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => { load(); }, []);

  const handleUpload = async (e) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;
    // Silent 40-file cap
    const capped = files.slice(0, 40);
    setUploading(true);
    setUploadProgress({ done: 0, total: capped.length });
    setError(null);
    try {
      // Subir en lotes de 5 para no saturar el OCR
      const batchSize = 5;
      for (let i = 0; i < capped.length; i += batchSize) {
        const batch = capped.slice(i, i + batchSize);
        const fd = new FormData();
        batch.forEach((f) => fd.append("files", f));
        await api.post("/subsidio/invoices/upload", fd, {
          headers: { "Content-Type": "multipart/form-data" },
        });
        setUploadProgress({ done: Math.min(i + batchSize, capped.length), total: capped.length });
      }
      await load();
    } catch (err) {
      setError(err?.response?.data?.detail || "Error al procesar las facturas");
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  const setField = (id, field, value) => {
    setItems((prev) => prev.map((it) => it.id === id ? { ...it, [field]: value, _dirty: true } : it));
  };

  const saveRow = async (item) => {
    setSavingId(item.id);
    try {
      const patch = {
        estacion: item.estacion, ciudad: item.ciudad,
        ruc_emisor: item.ruc_emisor, placa: item.placa,
        producto: item.producto,
        galones: item.galones === "" || item.galones == null ? null : Number(item.galones),
        precio_unitario: item.precio_unitario === "" || item.precio_unitario == null ? null : Number(item.precio_unitario),
        importe_total: item.importe_total === "" || item.importe_total == null ? null : Number(item.importe_total),
        numero_documento: item.numero_documento,
      };
      await api.put(`/subsidio/invoices/${item.id}`, patch);
      setItems((prev) => prev.map((it) => it.id === item.id ? { ...it, _dirty: false } : it));
    } catch (e) {
      alert(e?.response?.data?.detail || "Error al guardar");
    } finally {
      setSavingId(null);
    }
  };

  const deleteRow = async (id) => {
    if (!window.confirm("¿Eliminar esta factura?")) return;
    await api.delete(`/subsidio/invoices/${id}`);
    load();
  };

  const confirmAll = async () => {
    setError(null);
    const dirty = items.filter((it) => it._dirty);
    if (dirty.length > 0 && !window.confirm("Hay cambios sin guardar. ¿Confirmar de todos modos? (se perderán los cambios sin guardar)")) {
      return;
    }
    setConfirming(true);
    try {
      await api.post("/subsidio/invoices/confirm");
      await api.get("/auth/me").catch(() => {});
      // Forzar refresh para que el AuthProvider levante el nuevo expediente_status
      window.location.assign("/dashboard");
    } catch (e) {
      setError(e?.response?.data?.detail || "Error al confirmar");
    } finally {
      setConfirming(false);
    }
  };

  if (loading) {
    return <div className="min-h-[400px] flex items-center justify-center"><Loader2 className="w-8 h-8 animate-spin text-brand" /></div>;
  }

  return (
    <div className="space-y-6" data-testid="subsidio-verificar">
      <div className="flex items-center gap-3">
        <button onClick={() => navigate("/subsidio/documentos")} className="p-2 hover:bg-neutral-100 rounded-lg" data-testid="verificar-back">
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div className="flex-1">
          <span className="text-[10px] uppercase tracking-widest font-bold text-brand">Paso 2 · OCR Gemini Vision</span>
          <h2 className="font-cabinet text-2xl font-bold mt-1">Verifica los datos de tus facturas</h2>
          <p className="text-sm text-neutral-500 mt-1">
            Sube tus facturas de combustible. Extraemos los datos automáticamente. Revisa y confirma.
          </p>
        </div>
      </div>

      {/* Uploader */}
      <div className="bg-white border-2 border-dashed border-brand/40 rounded-2xl p-6">
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div className="flex items-start gap-3">
            <div className="w-12 h-12 bg-brand/10 rounded-xl flex items-center justify-center flex-shrink-0">
              <ScanLine className="w-6 h-6 text-brand" />
            </div>
            <div>
              <h3 className="font-cabinet font-bold text-lg">Subir facturas de combustible</h3>
              <p className="text-sm text-neutral-500">Acepta archivos PDF · máx 40 por carga</p>
            </div>
          </div>
          <label className={`px-5 py-3 ${uploading ? "bg-neutral-300" : "bg-brand hover:bg-brand-hover"} text-white font-bold rounded-xl flex items-center gap-2 cursor-pointer`}>
            {uploading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Procesando {uploadProgress.done}/{uploadProgress.total}…
              </>
            ) : (
              <>
                <Upload className="w-4 h-4" />
                Elegir archivos
              </>
            )}
            <input
              ref={fileRef}
              type="file"
              hidden
              multiple
              accept=".pdf"
              onChange={handleUpload}
              disabled={uploading}
              data-testid="subsidio-upload-input"
            />
          </label>
        </div>
        {uploading && uploadProgress.total > 0 && (
          <div className="mt-4 h-2 bg-neutral-100 rounded-full overflow-hidden">
            <div
              className="h-full bg-brand transition-all"
              style={{ width: `${(uploadProgress.done / uploadProgress.total) * 100}%` }}
            />
          </div>
        )}
      </div>

      {items.length === 0 ? (
        <div className="bg-white border-2 border-dashed border-neutral-300 rounded-2xl p-12 text-center">
          <FileText className="w-10 h-10 text-neutral-300 mx-auto mb-3" />
          <p className="text-neutral-500">Aún no has subido facturas. Empieza arriba ⬆️</p>
        </div>
      ) : (
        <>
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-sm text-amber-900 flex items-start gap-2">
            <AlertTriangle className="w-4 h-4 mt-0.5 flex-shrink-0" />
            <div>
              <strong>{items.length} factura(s)</strong> en revisión. Verifica especialmente <strong>placa, fecha, galones e importe</strong>.
              {vehicles.length > 0 && (
                <span> Tu flota: {vehicles.map(v => v.placa).join(", ")}.</span>
              )}
            </div>
          </div>

          <div className="space-y-3">
            {items.map((it) => (
              <InvoiceRow
                key={it.id}
                item={it}
                vehicles={vehicles}
                onChange={(field, value) => setField(it.id, field, value)}
                onSave={() => saveRow(it)}
                onDelete={() => deleteRow(it.id)}
                saving={savingId === it.id}
              />
            ))}
          </div>

          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 rounded-xl p-3 text-sm" data-testid="verificar-error">
              {typeof error === "string" ? error : JSON.stringify(error)}
            </div>
          )}

          <div className="bg-white border-2 border-brand rounded-2xl p-6 flex items-center justify-between flex-wrap gap-3">
            <div>
              <h3 className="font-cabinet text-lg font-bold">Confirmar todas las facturas</h3>
              <p className="text-sm text-neutral-600">Al confirmar se desbloquean los módulos del dashboard.</p>
            </div>
            <button
              onClick={confirmAll}
              disabled={confirming}
              className="px-6 py-3 bg-brand hover:bg-brand-hover text-white font-bold rounded-xl flex items-center gap-2 disabled:opacity-50"
              data-testid="verificar-confirm-all"
            >
              {confirming ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
              Confirmar {items.length} factura(s)
            </button>
          </div>
        </>
      )}
    </div>
  );
}

function InvoiceRow({ item, vehicles, onChange, onSave, onDelete, saving }) {
  const placaMatch = item.placa_match;
  const placaInFleet = item.placa && vehicles.some(v => v.placa === item.placa);
  const lowConf = (item.confianza ?? 0) < 0.5;

  return (
    <div className="bg-white border border-neutral-200 rounded-2xl p-4 shadow-sm" data-testid={`verificar-row-${item.id}`}>
      <div className="flex items-start justify-between gap-3 mb-3">
        <div className="flex items-center gap-2 min-w-0">
          <FileText className="w-4 h-4 text-neutral-400 flex-shrink-0" />
          <span className="truncate font-bold text-sm" title={item.factura_filename}>{item.factura_filename}</span>
          {!item.ocr_ok && (
            <span className="px-2 py-0.5 bg-red-100 text-red-700 text-[10px] font-bold rounded-full">OCR FALLÓ</span>
          )}
          {item.ocr_ok && lowConf && (
            <span className="px-2 py-0.5 bg-amber-100 text-amber-700 text-[10px] font-bold rounded-full">REVISAR</span>
          )}
          {placaMatch && (
            <span className="px-2 py-0.5 bg-emerald-100 text-emerald-700 text-[10px] font-bold rounded-full">PLACA OK</span>
          )}
        </div>
        <button onClick={onDelete} className="text-neutral-400 hover:text-red-500" data-testid={`verificar-delete-${item.id}`}>
          <Trash2 className="w-4 h-4" />
        </button>
      </div>

      {item.ocr_error && (
        <div className="bg-red-50 border border-red-200 text-red-700 rounded p-2 text-xs mb-3 flex gap-1.5">
          <AlertCircle className="w-4 h-4 flex-shrink-0" /> {item.ocr_error}
        </div>
      )}

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Field label="Fecha" full={false}>
          <input type="date" className="ocr-input" value={item.fecha || ""}
            onChange={(e) => onChange("fecha", e.target.value)} data-testid={`field-fecha-${item.id}`} />
          </Field>
        <Field label="Placa">
          {vehicles.length > 0 ? (
            <select className="ocr-input" value={item.placa || ""}
              onChange={(e) => onChange("placa", e.target.value)}
              data-testid={`field-placa-${item.id}`}
            >
              <option value="">— Seleccionar —</option>
              {vehicles.map(v => <option key={v.placa} value={v.placa}>{v.placa} ({v.categoria})</option>)}
              {item.placa && !placaInFleet && <option value={item.placa}>{item.placa} (fuera de flota)</option>}
            </select>
          ) : (
            <input className="ocr-input" value={item.placa || ""}
              onChange={(e) => onChange("placa", e.target.value.toUpperCase())} />
          )}
        </Field>
        <Field label="N° Documento">
          <input className="ocr-input" value={item.numero_documento || ""}
            onChange={(e) => onChange("numero_documento", e.target.value)} />
        </Field>
        <Field label="Estación">
          <input className="ocr-input" value={item.estacion || ""}
            onChange={(e) => onChange("estacion", e.target.value)} />
        </Field>
        <Field label="Ciudad">
          <input className="ocr-input" value={item.ciudad || ""}
            onChange={(e) => onChange("ciudad", e.target.value)} />
        </Field>
        <Field label="RUC emisor">
          <input className="ocr-input" value={item.ruc_emisor || ""}
            onChange={(e) => onChange("ruc_emisor", e.target.value)} />
        </Field>
        <Field label="Producto">
          <select className="ocr-input" value={item.producto || ""}
            onChange={(e) => onChange("producto", e.target.value)}>
            <option value="">—</option>
            {PRODUCTOS.map(p => <option key={p} value={p}>{p}</option>)}
            {item.producto && !PRODUCTOS.includes(item.producto) && (
              <option value={item.producto}>{item.producto}</option>
            )}
          </select>
        </Field>

        <Field label="Galones">
          <input type="number" step="0.01" className="ocr-input" value={item.galones ?? ""}
            onChange={(e) => onChange("galones", e.target.value)}
            data-testid={`field-galones-${item.id}`} />
        </Field>
        <Field label="Precio S/ por gl">
          <input type="number" step="0.01" className="ocr-input" value={item.precio_unitario ?? ""}
            onChange={(e) => onChange("precio_unitario", e.target.value)} />
        </Field>
        <Field label="Importe total S/" full>
          <input type="number" step="0.01" className="ocr-input" value={item.importe_total ?? ""}
            onChange={(e) => onChange("importe_total", e.target.value)}
            data-testid={`field-importe-${item.id}`} />
        </Field>
      </div>

      <div className="mt-3 flex items-center justify-end gap-2">
        {item._dirty && <span className="text-xs text-amber-600 font-bold">Sin guardar</span>}
        <button onClick={onSave} disabled={saving || !item._dirty}
          className="px-3 py-1.5 bg-brand text-white font-bold rounded-lg text-sm flex items-center gap-1.5 disabled:opacity-50"
          data-testid={`verificar-save-${item.id}`}
        >
          {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />} Guardar
        </button>
      </div>
      <style>{`
        .ocr-input { width:100%; height:38px; padding:0 10px; border:1px solid #d4d4d4; border-radius:8px; background:#fff; font-size:13px; }
        .ocr-input:focus { outline:none; border-color:#7c3aed; box-shadow:0 0 0 3px rgba(124,58,237,0.1); }
      `}</style>
    </div>
  );
}

function Field({ label, children, full }) {
  return (
    <div className={full ? "col-span-2" : ""}>
      <label className="block text-[10px] font-bold text-neutral-700 uppercase tracking-wider mb-1">{label}</label>
      {children}
    </div>
  );
}
