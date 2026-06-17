import React, { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Loader2, Upload, CheckCircle2, AlertTriangle, AlertCircle,
  Trash2, Plus, Building2, Truck, Fuel,
  Banknote, FileText, Save, ScanLine, ArrowRight,
} from "lucide-react";
import { api } from "../lib/api";

const CAPAS = [
  { id: "empresa",     n: 1, label: "Datos de la empresa",       icon: Building2, sub: "Identidad, autorización y depósito" },
  { id: "flota",       n: 2, label: "Flota",                     icon: Truck,     sub: "Placas, habilitación y propiedad" },
  { id: "combustible", n: 3, label: "Combustible",               icon: Fuel,      sub: "Facturas con OCR Gemini Vision" },
];

export default function SubsidioDocumentos() {
  const navigate = useNavigate();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeCapa, setActiveCapa] = useState("empresa");
  const [finalizing, setFinalizing] = useState(false);
  const [finalizeError, setFinalizeError] = useState(null);

  const load = async () => {
    try {
      const { data } = await api.get("/subsidio/dashboard");
      setData(data);
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => { load(); }, []);

  const handleFinalize = async () => {
    setFinalizing(true);
    setFinalizeError(null);
    try {
      await api.post("/subsidio/finalize");
      await api.get("/auth/me").catch(() => {});
      navigate("/subsidio/verificar", { replace: true });
    } catch (e) {
      setFinalizeError(e?.response?.data?.detail || "Faltan documentos");
    } finally {
      setFinalizing(false);
    }
  };

  // Stats por capa (memoizadas, antes del early-return para no romper hooks)
  const capaStats = useMemo(() => {
    if (!data) return { empresa: { done: 0, total: 1, pct: 0 }, flota: { done: 0, total: 1, pct: 0 }, combustible: { done: 0, total: 1, pct: 0 } };
    const c = data.checklist || { empresa: [], flota: [], combustible: [] };
    const eDone = c.empresa.filter((x) => x.uploaded).length + (data.bank_account ? 1 : 0);
    const eTot = c.empresa.length + 1;
    const fDone = c.flota.filter((x) => x.uploaded).length;
    const fTot = Math.max(c.flota.length, 1);
    const kDone = c.combustible.filter((x) => x.uploaded).length;
    const kTot = c.combustible.length;
    return {
      empresa:     { done: eDone, total: eTot, pct: Math.round((eDone / Math.max(eTot, 1)) * 100) },
      flota:       { done: fDone, total: fTot, pct: Math.round((fDone / Math.max(fTot, 1)) * 100) },
      combustible: { done: kDone, total: kTot, pct: Math.round((kDone / Math.max(kTot, 1)) * 100) },
    };
  }, [data]);

  if (loading) return <div className="min-h-[400px] flex items-center justify-center"><Loader2 className="w-8 h-8 animate-spin text-brand" /></div>;
  if (!data) return null;

  const { calculation, ahorro_estimado, ahorro_reconocido, checklist, progress, vehicles, bank_account, can_finalize } = data;
  const currentStep = (progress?.total_done || 0) + 1;
  const totalSteps = progress?.total_required || 0;

  return (
    <div className="space-y-6" data-testid="subsidio-documentos">
      {/* HEADER + stepper de capas */}
      <div className="bg-white border border-neutral-200 rounded-2xl p-6 shadow-sm">
        <div className="flex items-start justify-between flex-wrap gap-4">
          <div>
            <span className="text-[10px] uppercase tracking-widest font-bold text-brand">Asistente de subsidio · DU 004-2026</span>
            <h2 className="font-cabinet text-2xl font-bold tracking-tight mt-1">Mi Flota</h2>
            <p className="text-neutral-500 mt-1 max-w-2xl text-sm">
              Tu ruta para cobrar el subsidio. Completa las 3 capas: datos de la empresa, flota y comprobantes de combustible.
            </p>
          </div>
          <div className="flex items-center gap-3">
            <div className="px-4 py-2.5 bg-emerald-50 border border-emerald-200 rounded-xl">
              <div className="text-[10px] uppercase tracking-widest font-bold text-emerald-700">Ahorro estimado</div>
              <div className="font-cabinet font-black text-xl text-emerald-700">
                S/ {Number(ahorro_estimado).toLocaleString("es-PE", { maximumFractionDigits: 0 })}
              </div>
            </div>
            <div className="px-4 py-2.5 bg-brand/10 border border-brand/30 rounded-xl">
              <div className="text-[10px] uppercase tracking-widest font-bold text-brand">Ahorro reconocido</div>
              <div className="font-cabinet font-black text-xl text-brand">
                S/ {Number(ahorro_reconocido).toLocaleString("es-PE", { maximumFractionDigits: 0 })}
              </div>
            </div>
          </div>
        </div>

        {/* Paso X de N */}
        <div className="flex items-center justify-between mt-6 mb-3">
          <div className="text-sm">
            <span className="font-cabinet font-black text-brand text-2xl">Paso {String(Math.min(currentStep, totalSteps)).padStart(2, "0")}</span>
            <span className="text-neutral-500 ml-2">de {totalSteps} · {progress.pct}% completado</span>
          </div>
          <div className="text-xs text-neutral-400 uppercase tracking-widest font-bold">Tu ruta para cobrar</div>
        </div>

        {/* 3 capas (progress bars horizontales) */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          {CAPAS.map((capa) => {
            const Ic = capa.icon;
            const st = capaStats[capa.id];
            const isActive = activeCapa === capa.id;
            const isDone = st.pct === 100;
            return (
              <button
                key={capa.id}
                onClick={() => setActiveCapa(capa.id)}
                data-testid={`capa-tab-${capa.id}`}
                className={`text-left p-4 rounded-xl border-2 transition-all ${
                  isActive
                    ? "border-brand bg-brand/5 shadow-md"
                    : isDone
                    ? "border-emerald-300 bg-emerald-50/40 hover:border-emerald-400"
                    : "border-neutral-200 bg-white hover:border-neutral-300"
                }`}
              >
                <div className="flex items-center justify-between mb-2">
                  <div className={`text-[10px] uppercase tracking-widest font-bold ${isActive ? "text-brand" : "text-neutral-400"}`}>
                    Capa {capa.n}
                  </div>
                  <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${
                    isDone ? "bg-emerald-100 text-emerald-700" : isActive ? "bg-brand text-white" : "bg-neutral-100 text-neutral-500"
                  }`}>
                    {isDone ? <CheckCircle2 className="w-4 h-4" /> : <Ic className="w-4 h-4" />}
                  </div>
                </div>
                <div className="font-cabinet font-bold text-base text-neutral-900">{capa.label}</div>
                <div className="text-xs text-neutral-500 mt-0.5">{capa.sub}</div>
                <div className="mt-3 flex items-center gap-2">
                  <div className="flex-1 h-1.5 bg-neutral-100 rounded-full overflow-hidden">
                    <div
                      className={`h-full transition-all duration-700 ${isDone ? "bg-emerald-500" : "bg-brand"}`}
                      style={{ width: `${st.pct}%` }}
                    />
                  </div>
                  <span className={`text-[11px] font-bold ${isDone ? "text-emerald-600" : "text-neutral-600"}`}>
                    {st.done}/{st.total}
                  </span>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* CONTENIDO de la capa activa */}
      <div className="bg-white border border-neutral-200 rounded-2xl p-6 shadow-sm" data-testid={`capa-content-${activeCapa}`}>
        {activeCapa === "empresa" && (
          <EmpresaCapa items={checklist.empresa} bank={bank_account} onChange={load} />
        )}
        {activeCapa === "flota" && (
          <FlotaCapa items={checklist.flota} vehicles={vehicles} onChange={load} />
        )}
        {activeCapa === "combustible" && (
          <CombustibleCapa items={checklist.combustible} navigate={navigate} />
        )}

        {/* Navegación entre capas */}
        <div className="flex items-center justify-between mt-6 pt-5 border-t border-neutral-100">
          <button
            onClick={() => {
              const idx = CAPAS.findIndex((c) => c.id === activeCapa);
              if (idx > 0) setActiveCapa(CAPAS[idx - 1].id);
            }}
            disabled={activeCapa === CAPAS[0].id}
            className="px-4 py-2 text-sm font-bold text-neutral-600 hover:bg-neutral-100 rounded-lg disabled:opacity-30 disabled:cursor-not-allowed"
          >
            ← Capa anterior
          </button>
          <button
            onClick={() => {
              const idx = CAPAS.findIndex((c) => c.id === activeCapa);
              if (idx < CAPAS.length - 1) setActiveCapa(CAPAS[idx + 1].id);
            }}
            disabled={activeCapa === CAPAS[CAPAS.length - 1].id}
            className="px-4 py-2 text-sm font-bold text-brand hover:bg-brand/5 rounded-lg disabled:opacity-30 disabled:cursor-not-allowed flex items-center gap-1.5"
          >
            Siguiente capa <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* FINALIZAR */}
      <div className="bg-white border-2 border-brand rounded-2xl p-6 shadow-sm">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <h3 className="font-cabinet text-xl font-bold">Finalizar expediente</h3>
            <p className="text-sm text-neutral-600 mt-1">
              Cuando termines las 3 capas, pasa al OCR para escanear tus facturas y desbloquear el dashboard del subsidio.
            </p>
          </div>
          <button
            onClick={handleFinalize}
            disabled={!can_finalize || finalizing}
            className="px-6 py-3 bg-brand hover:bg-brand-hover text-white font-bold rounded-xl flex items-center gap-2 disabled:opacity-50"
            data-testid="subsidio-finalize"
          >
            {finalizing ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
            Finalizar y verificar →
          </button>
        </div>
        {finalizeError && (
          <div className="mt-4 bg-red-50 border border-red-200 text-red-700 rounded-xl p-3 text-sm">
            {typeof finalizeError === "string" ? finalizeError : (
              <>
                <strong>{finalizeError.message}:</strong>
                <ul className="list-disc pl-5 mt-1">
                  {(finalizeError.missing || []).map((m, i) => <li key={i}>{m}</li>)}
                </ul>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

/* ============================================================
   DocItem reutilizable (subida estándar a /subsidio/documents)
   ============================================================ */
function DocItem({ item, onChange, hint }) {
  const [busy, setBusy] = useState(false);
  const handleUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setBusy(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      fd.append("categoria", item.categoria);
      if (item.placa) fd.append("placa", item.placa);
      await api.post("/subsidio/documents", fd, { headers: { "Content-Type": "multipart/form-data" } });
      onChange?.();
    } catch (err) {
      alert(err?.response?.data?.detail || "Error al subir");
    } finally { setBusy(false); }
  };

  const handleDelete = async (docId) => {
    if (!window.confirm("¿Eliminar este documento?")) return;
    setBusy(true);
    try {
      await api.delete(`/subsidio/documents/${docId}`);
      onChange?.();
    } finally { setBusy(false); }
  };

  return (
    <div className="bg-neutral-50 border border-neutral-200 rounded-xl p-4">
      <div className="flex items-start gap-3">
        <span className={`w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 ${item.uploaded ? "bg-emerald-100 text-emerald-700" : "bg-red-100 text-red-600"}`}>
          {item.uploaded ? <CheckCircle2 className="w-4 h-4" /> : <AlertCircle className="w-4 h-4" />}
        </span>
        <div className="flex-1 min-w-0">
          <div className="font-bold text-neutral-900 text-sm">{item.label}</div>
          {hint && <div className="text-xs text-neutral-500 mt-0.5">{hint}</div>}
          {item.files?.length > 0 && (
            <ul className="mt-2 space-y-1">
              {item.files.map((f) => (
                <li key={f.id} className="flex items-center justify-between bg-white rounded-lg px-3 py-1.5 text-xs">
                  <span className="truncate flex items-center gap-2"><FileText className="w-3.5 h-3.5 text-neutral-400" />{f.filename}</span>
                  <button onClick={() => handleDelete(f.id)} disabled={busy} className="text-neutral-400 hover:text-red-500" aria-label="Eliminar">
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
        <label className="px-3 py-1.5 border border-neutral-300 bg-white rounded-lg text-xs font-bold cursor-pointer hover:bg-neutral-50 flex items-center gap-1.5">
          {busy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Upload className="w-3.5 h-3.5" />}
          {item.uploaded ? "Reemplazar" : "Subir"}
          <input type="file" hidden onChange={handleUpload} accept=".pdf,.jpg,.jpeg,.png,.xml" />
        </label>
      </div>
    </div>
  );
}

function Field({ label, children, full }) {
  return (
    <div className={full ? "sm:col-span-2" : ""}>
      <label className="block text-xs font-bold text-neutral-700 mb-1">{label}</label>
      {children}
    </div>
  );
}

const FIELD_CSS = `
  .field-input { width:100%; height:42px; padding:0 12px; border:1px solid #d4d4d4; border-radius:10px; background:#fff; font-size:14px; }
  .field-input:focus { outline:none; border-color:#7c3aed; box-shadow:0 0 0 3px rgba(124,58,237,0.1); }
`;

/* ============================================================
   CAPA 1 — Empresa: docs en 2 columnas + cuenta bancaria a la derecha
   ============================================================ */
function EmpresaCapa({ items, bank, onChange }) {
  const hints = {
    ficha_ruc: "PDF descargado de SUNAT",
    resolucion_autorizacion: "MTC / Gobierno Regional / Municipalidad · Art. 3.4.1",
    dni_representante: "Ambas caras · firma la declaración jurada",
  };
  return (
    <div>
      <div className="flex items-center gap-3 mb-5">
        <span className="w-10 h-10 rounded-lg bg-brand/10 text-brand flex items-center justify-center"><Building2 className="w-5 h-5" /></span>
        <div>
          <span className="text-[10px] uppercase tracking-widest font-bold text-brand">Capa 01</span>
          <h3 className="font-cabinet text-xl font-bold">Datos de la empresa</h3>
        </div>
      </div>
      <div className="grid lg:grid-cols-2 gap-5">
        <div className="space-y-3">
          {items.map((it) => <DocItem key={it.categoria} item={it} hint={hints[it.categoria]} onChange={onChange} />)}
        </div>
        <BankAccountCard bank={bank} onSaved={onChange} />
      </div>
    </div>
  );
}

function BankAccountCard({ bank, onSaved }) {
  const [ba, setBa] = useState(() => bank || {
    es_banco_nacion: true, banco: "Banco de la Nación",
    tipo_cuenta: "ahorros", numero_cuenta: "", moneda: "PEN", cci: ""
  });
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(false);

  const save = async () => {
    setBusy(true); setSaved(false);
    try {
      await api.put("/subsidio/bank-account", ba);
      setSaved(true); onSaved?.();
    } catch (e) {
      alert(e?.response?.data?.detail || "Error al guardar");
    } finally {
      setBusy(false);
      setTimeout(() => setSaved(false), 2000);
    }
  };

  return (
    <div className="bg-neutral-50 border border-neutral-200 rounded-xl p-4">
      <div className="flex items-center gap-2 mb-1">
        <Banknote className="w-5 h-5 text-brand" />
        <h4 className="font-cabinet font-bold text-base">Cuenta para el depósito del subsidio</h4>
        {ba.es_banco_nacion && <span className="ml-auto px-2 py-0.5 bg-brand/10 text-brand text-[10px] font-bold rounded-full">Recomendada</span>}
      </div>
      <p className="text-xs text-neutral-500 mb-3">Con Banco de la Nación el depósito es directo y no requiere CCI.</p>

      <div className="grid sm:grid-cols-2 gap-3">
        <Field label="Banco">
          <select className="field-input" value={ba.es_banco_nacion ? "BN" : "OTRO"}
            onChange={(e) => {
              const isBN = e.target.value === "BN";
              setBa({ ...ba, es_banco_nacion: isBN, banco: isBN ? "Banco de la Nación" : "" });
            }} data-testid="bank-select">
            <option value="BN">Banco de la Nación</option>
            <option value="OTRO">Otro banco</option>
          </select>
        </Field>
        {!ba.es_banco_nacion && (
          <Field label="Nombre del banco">
            <input className="field-input" value={ba.banco} onChange={(e) => setBa({ ...ba, banco: e.target.value })} />
          </Field>
        )}
        <Field label="Tipo de cuenta">
          <select className="field-input" value={ba.tipo_cuenta} onChange={(e) => setBa({ ...ba, tipo_cuenta: e.target.value })}>
            <option value="ahorros">Ahorros</option>
            <option value="corriente">Corriente</option>
          </select>
        </Field>
        <Field label="N° de cuenta">
          <input className="field-input" value={ba.numero_cuenta} onChange={(e) => setBa({ ...ba, numero_cuenta: e.target.value })} />
        </Field>
        <Field label="Moneda">
          <select className="field-input" value={ba.moneda} onChange={(e) => setBa({ ...ba, moneda: e.target.value })}>
            <option value="PEN">PEN (Soles)</option>
            <option value="USD">USD (Dólares)</option>
          </select>
        </Field>
        {!ba.es_banco_nacion && (
          <Field label="CCI (20 dígitos)" full>
            <input className="field-input" value={ba.cci || ""} onChange={(e) => setBa({ ...ba, cci: e.target.value })} />
          </Field>
        )}
      </div>
      <div className="mt-4 flex items-center justify-end gap-3">
        {saved && <span className="text-emerald-600 text-sm font-bold">Guardado ✓</span>}
        <button onClick={save} disabled={busy} className="px-4 py-2 bg-brand hover:bg-brand-hover text-white font-bold rounded-lg flex items-center gap-2 text-sm">
          {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />} Guardar cuenta
        </button>
      </div>
      <style>{FIELD_CSS}</style>
    </div>
  );
}

/* ============================================================
   CAPA 2 — Flota: lista de placas con sus 2 documentos por unidad
   ============================================================ */
function FlotaCapa({ items, vehicles, onChange }) {
  const [adding, setAdding] = useState(false);
  const [placa, setPlaca] = useState("");
  const [categoria, setCategoria] = useState("N2");
  const [error, setError] = useState(null);

  const addVehicle = async () => {
    setError(null);
    if (!placa.trim()) return;
    try {
      await api.post("/subsidio/vehicles", { placa: placa.toUpperCase(), categoria });
      setPlaca(""); setAdding(false); onChange();
    } catch (e) { setError(e?.response?.data?.detail || "Error"); }
  };

  const removeVehicle = async (p) => {
    if (!window.confirm(`¿Quitar placa ${p}? Se borrarán también sus documentos.`)) return;
    await api.delete(`/subsidio/vehicles/${p}`);
    onChange();
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-5 flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <span className="w-10 h-10 rounded-lg bg-brand/10 text-brand flex items-center justify-center"><Truck className="w-5 h-5" /></span>
          <div>
            <span className="text-[10px] uppercase tracking-widest font-bold text-brand">Capa 02</span>
            <h3 className="font-cabinet text-xl font-bold">Flota · {vehicles.length} unidad{vehicles.length === 1 ? "" : "es"}</h3>
          </div>
        </div>
        <button onClick={() => setAdding(!adding)} className="px-3 py-2 border border-neutral-300 rounded-lg text-sm font-bold flex items-center gap-1.5 hover:bg-neutral-50" data-testid="flota-toggle-add">
          <Plus className="w-4 h-4" /> {adding ? "Cancelar" : "Agregar unidad"}
        </button>
      </div>

      {adding && (
        <div className="bg-white border-2 border-brand/30 rounded-xl p-4 mb-4 flex flex-wrap gap-3 items-end">
          <div className="flex-1 min-w-[140px]">
            <label className="block text-xs font-bold text-neutral-700 mb-1">Placa</label>
            <input className="field-input" placeholder="ABC-123" value={placa} onChange={(e) => setPlaca(e.target.value.toUpperCase())} data-testid="flota-add-placa" />
          </div>
          <div className="flex-1 min-w-[140px]">
            <label className="block text-xs font-bold text-neutral-700 mb-1">Categoría</label>
            <select className="field-input" value={categoria} onChange={(e) => setCategoria(e.target.value)} data-testid="flota-add-cat">
              {["M2","M3","N1","N2","N3"].map(c => <option key={c}>{c}</option>)}
            </select>
          </div>
          <button onClick={addVehicle} className="h-[42px] px-4 bg-brand hover:bg-brand-hover text-white font-bold rounded-lg" data-testid="flota-add-confirm">Agregar</button>
          {error && <div className="w-full text-sm text-red-600">{error}</div>}
        </div>
      )}

      {vehicles.length === 0 && !adding && (
        <div className="text-center text-sm text-neutral-500 bg-neutral-50 border-2 border-dashed border-neutral-300 rounded-xl p-8">
          Aún no has registrado unidades. Agrega tus placas para subir habilitaciones y tarjetas de propiedad.
        </div>
      )}

      <div className="grid md:grid-cols-2 gap-3">
        {vehicles.map((v) => (
          <div key={v.placa} className="bg-neutral-50 border border-neutral-200 rounded-xl p-4">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <Truck className="w-4 h-4 text-brand" />
                <strong className="font-cabinet">{v.placa}</strong>
                <span className="px-2 py-0.5 bg-white border border-neutral-200 rounded-full text-xs font-bold">{v.categoria}</span>
              </div>
              <button onClick={() => removeVehicle(v.placa)} className="text-neutral-400 hover:text-red-500"><Trash2 className="w-4 h-4" /></button>
            </div>
            <div className="space-y-2">
              {items.filter((it) => it.placa === v.placa).map((it) => (
                <DocItem
                  key={it.categoria + "-" + it.placa} item={it} onChange={onChange}
                  hint={it.categoria === "tarjeta_habilitacion" ? "Art. 3.4.2 — habilita la unidad para servicio público" : "Define la categoría (M/N)"}
                />
              ))}
            </div>
          </div>
        ))}
      </div>

      <p className="text-xs text-neutral-500 mt-4">↳ Estos documentos encienden tu módulo de <strong>Gestión de flota</strong> y las alertas de vencimiento.</p>
      <style>{FIELD_CSS}</style>
    </div>
  );
}

/* ============================================================
   CAPA 3 — Combustible: link al OCR (no usa /subsidio/documents)
   ============================================================ */
function CombustibleCapa({ items, navigate }) {
  return (
    <div>
      <div className="flex items-center justify-between mb-5 flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <span className="w-10 h-10 rounded-lg bg-brand/10 text-brand flex items-center justify-center"><Fuel className="w-5 h-5" /></span>
          <div>
            <span className="text-[10px] uppercase tracking-widest font-bold text-brand">Capa 03</span>
            <h3 className="font-cabinet text-xl font-bold">Combustible · facturas electrónicas</h3>
          </div>
        </div>
      </div>

      <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 mb-4 text-sm text-amber-900">
        <div className="flex gap-2 items-start">
          <AlertTriangle className="w-4 h-4 mt-0.5 flex-shrink-0" />
          <div>
            <strong>Requisitos exactos (Art. 3.3 y 4.2)</strong>
            <ul className="mt-2 list-disc pl-5 space-y-1">
              <li>Comprobante de pago <strong>electrónico</strong> (no físico)</li>
              <li>Debe consignar la <strong>placa</strong> del vehículo</li>
              <li>Diésel <strong>B5 o B20, azufre ≤50 ppm</strong></li>
              <li>Fecha entre <strong>29 mayo y 28 julio 2026</strong></li>
              <li>Grifo con <strong>Registro Osinergmin vigente</strong></li>
            </ul>
          </div>
        </div>
      </div>

      <div className="bg-gradient-to-br from-brand/10 to-emerald-50 border-2 border-brand/30 rounded-2xl p-6">
        <div className="flex items-start gap-4">
          <div className="w-12 h-12 rounded-xl bg-brand text-white flex items-center justify-center flex-shrink-0">
            <ScanLine className="w-6 h-6" />
          </div>
          <div className="flex-1">
            <h4 className="font-cabinet font-bold text-lg">OCR Gemini Vision · subida masiva</h4>
            <p className="text-sm text-neutral-600 mt-1 max-w-xl">
              Sube tus facturas (JPG, PNG, WEBP o PDF). El OCR extrae fecha, placa, galones, importe y RUC automáticamente. Luego verificas y confirmas.
            </p>
            <button
              onClick={() => navigate("/subsidio/verificar")}
              className="mt-4 px-5 py-3 bg-brand hover:bg-brand-hover text-white font-bold rounded-xl flex items-center gap-2"
              data-testid="combustible-go-ocr"
            >
              <Upload className="w-4 h-4" />
              Subir y verificar facturas →
            </button>
          </div>
        </div>
      </div>

      {items?.length > 0 && (
        <div className="mt-4 grid sm:grid-cols-2 gap-3">
          {items.map((it) => (
            <div key={it.categoria} className="bg-neutral-50 border border-neutral-200 rounded-xl p-3 flex items-center gap-3">
              <span className={`w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 ${it.uploaded ? "bg-emerald-100 text-emerald-700" : "bg-neutral-200 text-neutral-500"}`}>
                {it.uploaded ? <CheckCircle2 className="w-4 h-4" /> : <FileText className="w-4 h-4" />}
              </span>
              <div className="flex-1 min-w-0">
                <div className="font-bold text-neutral-900 text-sm">{it.label}</div>
                <div className="text-xs text-neutral-500">{it.uploaded ? `${it.files.length} archivo(s)` : "Pendiente"}</div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
