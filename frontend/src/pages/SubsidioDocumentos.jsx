import React, { useEffect, useMemo, useState, useRef } from "react";
import { useNavigate } from "react-router-dom";
import {
  FileText, CheckCircle2, ChevronRight, Upload, Trash2, ShieldCheck, Download, 
  MapPin, Phone, Building2, User, Loader2, PlayCircle, Lock, LockOpen, ArrowRight, X, Image as ImgIcon, File, Fuel, Save, AlertCircle, AlertTriangle, Send, Plus
} from "lucide-react";

// --- Subcomponente para cada factura editable ---
function InvoiceRow({ item, setField, saveRow, deleteRow, vehicles, saving }) {
  const isVehicleOk = vehicles.some((v) => v.placa === item.placa);
  const placaColor = !item.placa ? "border-red-300 bg-red-50" : isVehicleOk ? "border-green-300 bg-green-50" : "border-yellow-300 bg-yellow-50";

  return (
    <div className="bg-white border border-neutral-200 rounded-xl p-4 shadow-sm mb-4 relative">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2 truncate">
          <FileText className="w-4 h-4 text-neutral-400" />
          <span className="font-medium text-sm text-neutral-800 truncate" title={item.factura_filename}>{item.factura_filename}</span>
        </div>
        <button onClick={() => deleteRow(item.id)} className="text-neutral-400 hover:text-red-500" title="Eliminar archivo">
          <Trash2 className="w-4 h-4" />
        </button>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3 text-sm">
        <div>
          <label className="block text-[10px] font-bold text-neutral-500 uppercase mb-1">Proveedor</label>
          <input type="text" className="w-full border border-neutral-300 rounded p-1.5 focus:border-brand focus:outline-none" value={item.estacion || ""} onChange={(e) => setField(item.id, "estacion", e.target.value)} />
        </div>
        <div>
          <label className="block text-[10px] font-bold text-neutral-500 uppercase mb-1">Fecha Emisión</label>
          <input type="text" placeholder="YYYY-MM-DD" className="w-full border border-neutral-300 rounded p-1.5 focus:border-brand focus:outline-none" value={item.fecha || ""} onChange={(e) => setField(item.id, "fecha", e.target.value)} />
        </div>
        <div>
          <label className="block text-[10px] font-bold text-neutral-500 uppercase mb-1">Placa</label>
          <input type="text" className={`w-full border rounded p-1.5 focus:outline-none ${placaColor}`} value={item.placa || ""} onChange={(e) => setField(item.id, "placa", e.target.value)} />
        </div>
        <div>
          <label className="block text-[10px] font-bold text-neutral-500 uppercase mb-1">Producto</label>
          <input type="text" className="w-full border border-neutral-300 rounded p-1.5 focus:border-brand focus:outline-none" value={item.producto || ""} onChange={(e) => setField(item.id, "producto", e.target.value)} />
        </div>
        <div>
          <label className="block text-[10px] font-bold text-neutral-500 uppercase mb-1">Cant (Gal)</label>
          <input type="number" step="0.01" className="w-full border border-neutral-300 rounded p-1.5 focus:border-brand focus:outline-none" value={item.galones ?? ""} onChange={(e) => setField(item.id, "galones", e.target.value)} />
        </div>
        <div>
          <label className="block text-[10px] font-bold text-neutral-500 uppercase mb-1">Precio Uni</label>
          <input type="number" step="0.01" className="w-full border border-neutral-300 rounded p-1.5 focus:border-brand focus:outline-none" value={item.precio_unitario ?? ""} onChange={(e) => setField(item.id, "precio_unitario", e.target.value)} />
        </div>
        <div>
          <label className="block text-[10px] font-bold text-neutral-500 uppercase mb-1">Importe</label>
          <input type="number" step="0.01" className="w-full border border-neutral-300 rounded p-1.5 focus:border-brand focus:outline-none" value={item.importe_total ?? ""} onChange={(e) => setField(item.id, "importe_total", e.target.value)} />
        </div>
      </div>

      {item._dirty && (
        <div className="mt-3 flex justify-end">
          <button
            onClick={() => saveRow(item)}
            disabled={saving}
            className="px-3 py-1.5 bg-brand hover:bg-brand-hover text-white text-xs font-bold rounded flex items-center gap-2 disabled:opacity-50"
          >
            {saving ? <Loader2 className="w-3 h-3 animate-spin" /> : <Save className="w-3 h-3" />}
            Guardar cambios
          </button>
        </div>
      )}
    </div>
  );
}

import { api } from "../lib/api";
import { useAuth } from "../context/AuthContext";

const ETAPAS = [
  { id: "empresa",      n: 1, label: "Documentos de la empresa", icon: Building2,  short: "Empresa",      hint: "Solo PDF" },
  { id: "flota",        n: 2, label: "Documentos de flota",      icon: Truck,      short: "Flota",        hint: "PDF, PNG o JPG" },
  { id: "combustible",  n: 3, label: "Facturas de combustible",  icon: Fuel,       short: "Combustible",  hint: "Solo PDF · OCR" },
  { id: "declaracion",  n: 4, label: "Declaración jurada",       icon: ShieldCheck,short: "Declaración",  hint: "Firma electrónica" },
];

const PRODUCTOS = ["DIESEL B5", "DIESEL B20", "DIESEL B5 S50"];
const TARGET_DATE = new Date("2026-07-28T23:59:59");

export default function SubsidioDocumentos() {
  const navigate = useNavigate();
  const { setUser } = useAuth();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [timeLeft, setTimeLeft] = useState({ days: 0, hours: 0, minutes: 0, seconds: 0 });
  const pad = (num) => String(num).padStart(2, '0');

  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      const diff = TARGET_DATE.getTime() - now.getTime();
      if (diff <= 0) {
        setTimeLeft({ days: 0, hours: 0, minutes: 0, seconds: 0 });
      } else {
        const days = Math.floor(diff / (1000 * 60 * 60 * 24));
        const hours = Math.floor((diff / (1000 * 60 * 60)) % 24);
        const minutes = Math.floor((diff / 1000 / 60) % 60);
        const seconds = Math.floor((diff / 1000) % 60);
        setTimeLeft({ days, hours, minutes, seconds });
      }
    };
    updateTime();
    const interval = setInterval(updateTime, 1000);
    return () => clearInterval(interval);
  }, []);
  const [activeEtapa, setActiveEtapa] = useState("empresa");
  const [showSuccessOverlay, setShowSuccessOverlay] = useState(false);
  const [createdDeclaracion, setCreatedDeclaracion] = useState(null);

  const load = async () => {
    try {
      const { data } = await api.get("/subsidio/dashboard");
      setData(data);
      // Auto-jump to first incomplete stage on first load
      if (loading) {
        const next = pickNextEtapa(data);
        if (next) setActiveEtapa(next);
      }
    } catch (err) {
      console.error("Error loading SubsidioDocumentos:", err);
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => { load(); /* eslint-disable-next-line */ }, []);

  // ---------- Progress totals (memoized; before early-return) ----------
  const totals = useMemo(() => calcTotals(data), [data]);

  if (loading) {
    return <div className="min-h-[400px] flex items-center justify-center"><Loader2 className="w-8 h-8 animate-spin text-brand" /></div>;
  }
  if (!data) return null;

  const { ahorro_estimado, ahorro_reconocido, checklist, vehicles, bank_account, declaracion } = data;

  const isComplete = (id) => totals.byEtapa[id]?.done >= totals.byEtapa[id]?.total && totals.byEtapa[id]?.total > 0;
  const enviado = !!declaracion;

  if (showSuccessOverlay) {
    const decl = createdDeclaracion || {};
    const expedNo = decl.id ? `DU-2026-${decl.id.slice(0, 8).toUpperCase()}` : "";
    return (
      <div className="min-h-[500px] flex items-center justify-center bg-[#F6F7FB] p-4 animate-fade-in" data-testid="envio-success">
        <div className="bg-white border border-neutral-200 rounded-2xl p-8 max-w-lg w-full text-center shadow-lg space-y-6">
          <div className="w-20 h-20 mx-auto rounded-full bg-emerald-500 text-white flex items-center justify-center mb-4">
            <CheckCircle2 className="w-10 h-10 animate-bounce" />
          </div>
          <h3 className="font-cabinet text-3xl font-bold text-neutral-900">¡Envío exitoso!</h3>
          <p className="text-sm text-neutral-600 max-w-md mx-auto">
            Tu expediente del subsidio DU 004-2026 quedó registrado y será presentado ante la ATU.
          </p>
          {expedNo && (
            <div className="inline-flex items-center gap-2 bg-neutral-50 border border-neutral-200 rounded-xl px-4 py-2 text-sm font-semibold text-neutral-700">
              N° de expediente: <span className="text-brand font-mono font-bold">{expedNo}</span>
            </div>
          )}
          <div className="pt-2 text-xs text-neutral-400 flex items-center justify-center gap-1.5">
            <Loader2 className="w-3.5 h-3.5 animate-spin text-brand" />
            Redirigiendo a tu dashboard en unos segundos...
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6" data-testid="subsidio-documentos">
      {/* HEADER */}
      <div className="bg-white border border-neutral-200 rounded-2xl p-6 shadow-sm">
        <div className="flex items-start justify-between flex-wrap gap-4 mb-6">
          <div>
            <span className="text-[10px] uppercase tracking-widest font-bold text-brand">Asistente de subsidio · DU 004-2026</span>
            <h2 className="font-cabinet text-2xl font-bold tracking-tight mt-1">Mi Flota</h2>
            <p className="text-neutral-500 mt-1 max-w-2xl text-sm">Completa las 5 etapas para enviar tu expediente a la ATU.</p>
          </div>
          <div className="flex items-center gap-3">
            <div className="px-4 py-2.5 bg-emerald-50 border border-emerald-200 rounded-xl">
              <div className="text-[10px] uppercase tracking-widest font-bold text-emerald-700">Ahorro estimado</div>
              <div className="font-cabinet font-black text-xl text-emerald-700">S/ {Number(ahorro_estimado).toLocaleString("es-PE", { maximumFractionDigits: 0 })}</div>
            </div>
            <div className="px-4 py-2.5 bg-brand/10 border border-brand/30 rounded-xl">
              <div className="text-[10px] uppercase tracking-widest font-bold text-brand">Ahorro reconocido</div>
              <div className="font-cabinet font-black text-xl text-brand">S/ {Number(ahorro_reconocido).toLocaleString("es-PE", { maximumFractionDigits: 0 })}</div>
            </div>
            {/* Reloj con cuenta regresiva resaltado en rojo */}
            <div className="bg-[#B91C1C] border border-red-500/25 rounded-[14px] p-[8px_16px] flex items-center shadow-[0_4px_20px_rgba(185,28,28,0.45)] text-white select-none">
              {/* Left Side: icon and deadline */}
              <div className="flex items-center gap-[6px]">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" className="text-white">
                  <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="2.2" />
                  <path d="M12 7v5l3 2" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" />
                </svg>
                <span className="text-[11px] font-black tracking-wider uppercase">28 JUL</span>
              </div>
              
              {/* Divider */}
              <div className="w-[1.5px] h-[26px] bg-white/20 mx-3.5" />
              
              {/* Countdown Numbers */}
              <div className="flex items-center gap-[5px]">
                {/* Days */}
                <div className="flex flex-col items-center min-w-[20px]">
                  <span className="font-cabinet text-[16px] font-black leading-none">{pad(timeLeft.days)}</span>
                  <span className="text-[9px] font-bold text-white/50 tracking-wider mt-[3px]">D</span>
                </div>
                <span className="text-[14px] font-bold text-white/50 relative top-[-3px]">:</span>
                {/* Hours */}
                <div className="flex flex-col items-center min-w-[20px]">
                  <span className="font-cabinet text-[16px] font-black leading-none">{pad(timeLeft.hours)}</span>
                  <span className="text-[9px] font-bold text-white/50 tracking-wider mt-[3px]">H</span>
                </div>
                <span className="text-[14px] font-bold text-white/50 relative top-[-3px]">:</span>
                {/* Minutes */}
                <div className="flex flex-col items-center min-w-[20px]">
                  <span className="font-cabinet text-[16px] font-black leading-none">{pad(timeLeft.minutes)}</span>
                  <span className="text-[9px] font-bold text-white/50 tracking-wider mt-[3px]">M</span>
                </div>
                <span className="text-[14px] font-bold text-white/50 relative top-[-3px]">:</span>
                {/* Seconds */}
                <div className="flex flex-col items-center min-w-[20px]">
                  <span className="font-cabinet text-[16px] font-black leading-none text-rose-300 animate-pulse">{pad(timeLeft.seconds)}</span>
                  <span className="text-[9px] font-bold text-white/50 tracking-wider mt-[3px]">S</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Línea de etapas */}
        <div className="grid grid-cols-4 gap-2 mb-3">
          {ETAPAS.map((e) => {
            const Ic = e.icon;
            const active = activeEtapa === e.id;
            const done = isComplete(e.id) || (e.id === "declaracion" && enviado);
            const canVisit = true;
            return (
              <button
                key={e.id}
                onClick={() => canVisit && setActiveEtapa(e.id)}
                disabled={!canVisit}
                data-testid={`etapa-tab-${e.id}`}
                className={`text-left p-3 rounded-xl border-2 transition-all min-h-[78px] ${
                  active ? "border-brand bg-brand/5 shadow-md" :
                  done ? "border-emerald-300 bg-emerald-50/40 hover:border-emerald-400" :
                  "border-neutral-200 bg-white hover:border-neutral-300"
                } ${!canVisit ? "opacity-40 cursor-not-allowed" : ""}`}
              >
                <div className="flex items-center justify-between mb-1.5">
                  <span className={`text-[10px] uppercase tracking-widest font-bold ${active ? "text-brand" : "text-neutral-400"}`}>Etapa {e.n}</span>
                  <span className={`w-6 h-6 rounded-md flex items-center justify-center ${
                    done ? "bg-emerald-100 text-emerald-700" : active ? "bg-brand text-white" : "bg-neutral-100 text-neutral-500"
                  }`}>
                    {done ? <CheckCircle2 className="w-3.5 h-3.5" /> : <Ic className="w-3.5 h-3.5" />}
                  </span>
                </div>
                <div className="font-bold text-[13px] text-neutral-900 leading-tight">{e.short}</div>
                <div className="text-[10px] text-neutral-500 mt-0.5">{e.hint}</div>
              </button>
            );
          })}
        </div>

        {/* Barra única continua */}
        <div className="mt-5">
          <div className="flex items-baseline justify-between mb-2">
            <div className="text-sm">
              <span className="font-cabinet font-black text-brand text-xl">{totals.pct}%</span>
              <span className="text-neutral-500 ml-2 text-xs">{totals.done} de {totals.total} ítems completados</span>
            </div>
            <div className="text-[10px] text-neutral-400 uppercase tracking-widest font-bold">Tu ruta para cobrar</div>
          </div>
          <div className="relative h-3 bg-neutral-100 rounded-full overflow-hidden">
            <div
              className="absolute inset-y-0 left-0 bg-gradient-to-r from-brand to-violet-500 rounded-full transition-all duration-700"
              style={{ width: `${totals.pct}%` }}
            />
          </div>
        </div>
      </div>

      {/* CONTENIDO de la etapa activa */}
      <div className="bg-white border border-neutral-200 rounded-2xl p-6 shadow-sm" data-testid={`etapa-content-${activeEtapa}`}>
        {activeEtapa === "empresa" && (
          <EmpresaEtapa items={checklist.empresa} bank={bank_account} onChange={load} />
        )}
        {activeEtapa === "flota" && (
          <FlotaEtapa items={checklist.flota} vehicles={vehicles} onChange={load} />
        )}
        {activeEtapa === "combustible" && (
          <CombustibleEtapa onAnyChange={load} confirmedCountFromDashboard={data?.invoices?.confirmed ?? 0} />
        )}
        {activeEtapa === "declaracion" && (
          <DeclaracionEtapa
            data={data}
            totals={totals}
            onAccepted={async (decl) => {
              setCreatedDeclaracion(decl);
              setShowSuccessOverlay(true);
              const me = await api.get("/auth/me").catch(() => null);
              if (me?.data?.user) setUser?.(me.data.user);
              setTimeout(() => {
                navigate("/dashboard");
              }, 3500);
            }}
          />
        )}

        {/* Navegación */}
        <div className="flex items-center justify-between mt-6 pt-5 border-t border-neutral-100">
          <button
            onClick={() => {
              const idx = ETAPAS.findIndex((c) => c.id === activeEtapa);
              if (idx > 0) setActiveEtapa(ETAPAS[idx - 1].id);
            }}
            disabled={activeEtapa === ETAPAS[0].id}
            className="px-4 py-2 text-sm font-bold text-neutral-600 hover:bg-neutral-100 rounded-lg disabled:opacity-30 disabled:cursor-not-allowed"
            data-testid="etapa-prev"
          >
            ← Etapa anterior
          </button>
          {activeEtapa !== "declaracion" && (
            <button
              onClick={() => {
                const idx = ETAPAS.findIndex((c) => c.id === activeEtapa);
                if (idx < ETAPAS.length - 1) {
                  setActiveEtapa(ETAPAS[idx + 1].id);
                }
              }}
              className="px-4 py-2 text-sm font-bold text-brand hover:bg-brand/5 rounded-lg"
              data-testid="etapa-next"
            >
              Siguiente etapa →
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

/* ============================================================ */
/* Helpers                                                       */
/* ============================================================ */
function calcTotals(data) {
  if (!data) return { pct: 0, done: 0, total: 1, byEtapa: {} };
  const c = data.checklist || { empresa: [], flota: [], combustible: [] };
  const empresaDone = c.empresa.filter((x) => x.uploaded).length + (data.bank_account ? 1 : 0);
  const empresaTot = c.empresa.length + 1;
  const flotaDone = c.flota.filter((x) => x.uploaded).length;
  const flotaTot = Math.max(c.flota.length, 1);
  // Combustible: contamos facturas confirmadas (drafts aún no se aceptan como completos)
  const confirmedCount = data?.invoices?.confirmed ?? 0;
  const combDone = confirmedCount > 0 ? 1 : 0;
  const combTot = 1;
  const declDone = data.declaracion ? 1 : 0;

  const byEtapa = {
    empresa: { done: empresaDone, total: empresaTot, pct: pct(empresaDone, empresaTot) },
    flota: { done: flotaDone, total: flotaTot, pct: pct(flotaDone, flotaTot) },
    combustible: { done: combDone, total: combTot, pct: combDone * 100, confirmedCount },
    declaracion: { done: declDone, total: 1, pct: declDone * 100 },
  };
  const done = empresaDone + flotaDone + combDone + declDone;
  const total = empresaTot + flotaTot + combTot + 1;
  return { pct: pct(done, total), done, total, byEtapa };
}
function pct(d, t) { return Math.round((d / Math.max(t, 1)) * 100); }

function pickNextEtapa(data) {
  const t = calcTotals(data);
  if (data.declaracion) return "declaracion";
  if (t.byEtapa.empresa.done < t.byEtapa.empresa.total) return "empresa";
  if (t.byEtapa.flota.done < t.byEtapa.flota.total) return "flota";
  if (t.byEtapa.combustible.done === 0) return "combustible";
  return "declaracion";
}

/* ============================================================ */
/* Etapa 1 — Empresa (PDF only) + cuenta bancaria + nota seguridad */
/* ============================================================ */
function EmpresaEtapa({ items, bank, onChange }) {
  const hints = {
    ficha_ruc: "PDF descargado de SUNAT",
    resolucion_autorizacion: "MTC / Gobierno Regional / Municipalidad · Art. 3.4.1",
    dni_representante: "Ambas caras · firma la declaración jurada",
  };
  return (
    <div>
      <EtapaHeader n={1} icon={Building2} title="Documentos de la empresa" subtitle="Identidad, autorización y cuenta bancaria · solo PDF" />
      <div className="grid lg:grid-cols-2 gap-5">
        <div className="space-y-3">
          {items.map((it) => (
            <DocItem key={it.categoria} item={it} hint={hints[it.categoria]} onChange={onChange} accept=".pdf" acceptLabel="PDF" />
          ))}
        </div>
        <BankAccountCard bank={bank} onSaved={onChange} />
      </div>
    </div>
  );
}

function BankAccountCard({ bank, onSaved }) {
  const [ba, setBa] = useState(() => bank || { es_banco_nacion: true, banco: "Banco de la Nación", tipo_cuenta: "ahorros", numero_cuenta: "", moneda: "PEN", cci: "" });
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(false);

  const save = async () => {
    setBusy(true); setSaved(false);
    try { await api.put("/subsidio/bank-account", ba); setSaved(true); onSaved?.(); }
    catch (e) { alert(e?.response?.data?.detail || "Error al guardar"); }
    finally { setBusy(false); setTimeout(() => setSaved(false), 2000); }
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
            onChange={(e) => { const isBN = e.target.value === "BN"; setBa({ ...ba, es_banco_nacion: isBN, banco: isBN ? "Banco de la Nación" : "" }); }} data-testid="bank-select">
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
            <option value="ahorros">Ahorros</option><option value="corriente">Corriente</option>
          </select>
        </Field>
        <Field label="N° de cuenta">
          <input className="field-input" value={ba.numero_cuenta} onChange={(e) => setBa({ ...ba, numero_cuenta: e.target.value })} data-testid="bank-numero" />
        </Field>
        <Field label="Moneda">
          <select className="field-input" value={ba.moneda} onChange={(e) => setBa({ ...ba, moneda: e.target.value })}>
            <option value="PEN">PEN (Soles)</option><option value="USD">USD (Dólares)</option>
          </select>
        </Field>
        {!ba.es_banco_nacion && (
          <Field label="CCI (20 dígitos)" full>
            <input className="field-input" value={ba.cci || ""} onChange={(e) => setBa({ ...ba, cci: e.target.value })} />
          </Field>
        )}
      </div>

      {/* Nota de seguridad bancaria */}
      <div className="mt-4 bg-violet-50 border border-violet-200 rounded-lg p-3 flex gap-2 text-xs text-violet-900">
        <Lock className="w-4 h-4 mt-0.5 flex-shrink-0" />
        <p>
          <strong>Seguridad Bancaria:</strong> Tus datos bancarios solo se usan para que la ATU te deposite el subsidio
          (vía Banco de la Nación u otro banco de tu preferencia). Ni Enered ni la ATU te pedirán nunca claves,
          contraseñas, PIN, datos de tarjeta, tokens ni acceso a tu banca por internet.
        </p>
      </div>

      <div className="mt-4 flex items-center justify-end gap-3">
        {saved && <span className="text-emerald-600 text-sm font-bold">Guardado ✓</span>}
        <button onClick={save} disabled={busy} className="px-4 py-2 bg-brand hover:bg-brand-hover text-white font-bold rounded-lg flex items-center gap-2 text-sm" data-testid="bank-save">
          {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />} Guardar cuenta
        </button>
      </div>
      <style>{FIELD_CSS}</style>
    </div>
  );
}

/* ============================================================ */
/* Etapa 2 — Flota (PDF/PNG/JPG)                                 */
/* ============================================================ */
function FlotaEtapa({ items, vehicles, onChange }) {
  const [adding, setAdding] = useState(false);
  const [placa, setPlaca] = useState("");
  const [categoria, setCategoria] = useState("N2");
  const [error, setError] = useState(null);

  const addVehicle = async () => {
    setError(null);
    if (!placa.trim()) return;
    try { await api.post("/subsidio/vehicles", { placa: placa.toUpperCase(), categoria }); setPlaca(""); setAdding(false); onChange(); }
    catch (e) { setError(e?.response?.data?.detail || "Error"); }
  };
  const removeVehicle = async (p) => {
    if (!window.confirm(`¿Quitar placa ${p}? Se borrarán también sus documentos.`)) return;
    await api.delete(`/subsidio/vehicles/${p}`); onChange();
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-5 flex-wrap gap-3">
        <EtapaHeader n={2} icon={Truck} title={`Documentos de flota · ${vehicles.length} unidad${vehicles.length === 1 ? "" : "es"}`} subtitle="Tarjetas de habilitación y propiedad · PDF, PNG o JPG" inline />
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
              {["M2", "M3", "N1", "N2", "N3"].map(c => <option key={c}>{c}</option>)}
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
                <DocItem key={it.categoria + "-" + it.placa} item={it} onChange={onChange} accept=".pdf,.jpg,.jpeg,.png" acceptLabel="PDF / JPG / PNG"
                  hint={it.categoria === "tarjeta_habilitacion" ? "Art. 3.4.2 — habilita la unidad para servicio público" : "Define la categoría (M/N)"} />
              ))}
            </div>
          </div>
        ))}
      </div>
      <style>{FIELD_CSS}</style>
    </div>
  );
}

/* ============================================================ */
/* Etapa 3 — Combustible: OCR inline (upload + draft preview + confirm) */
/* ============================================================ */
function CombustibleEtapa({ onAnyChange, confirmedCountFromDashboard }) {
  const [loading, setLoading] = useState(true);
  const [items, setItems] = useState([]);
  const [vehicles, setVehicles] = useState([]);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState({ done: 0, total: 0 });
  const [savingId, setSavingId] = useState(null);
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  const fileRef = useRef(null);
  const [confirmedList, setConfirmedList] = useState([]);

  const load = async () => {
    try {
      const [{ data: prev }, { data: conf }] = await Promise.all([
        api.get("/subsidio/invoices/preview").catch(() => ({ data: { items: [], vehicles: [] } })),
        api.get("/subsidio/invoices/confirmed").catch(() => ({ data: { items: [] } })),
      ]);
      setItems(prev.items || []);
      setVehicles(prev.vehicles || []);
      setConfirmedList(conf.items || []);
    } catch (err) {
      console.error("Error loading invoices data:", err);
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => { load(); }, []);
  const confirmedCount = confirmedList.length || confirmedCountFromDashboard || 0;

  const handleUpload = async (e) => {
    const files = Array.from(e.target.files || []);
    if (!files.length) return;
    const capped = files.slice(0, 40);
    setUploading(true); setUploadProgress({ done: 0, total: capped.length }); setError(null); setSuccess(null);
    try {
      const batch = 5;
      for (let i = 0; i < capped.length; i += batch) {
        const fd = new FormData();
        capped.slice(i, i + batch).forEach((f) => fd.append("files", f));
        await api.post("/subsidio/invoices/upload", fd, { headers: { "Content-Type": "multipart/form-data" } });
        setUploadProgress({ done: Math.min(i + batch, capped.length), total: capped.length });
      }
      await load();
      onAnyChange?.();
    } catch (err) {
      setError(err?.response?.data?.detail || "Error al procesar las facturas");
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  const setField = (id, field, value) =>
    setItems((prev) => prev.map((it) => (it.id === id ? { ...it, [field]: value, _dirty: true } : it)));

  const saveRow = async (item) => {
    setSavingId(item.id);
    try {
      await api.put(`/subsidio/invoices/${item.id}`, {
        fecha: item.fecha, hora: item.hora, estacion: item.estacion, ciudad: item.ciudad,
        ruc_emisor: item.ruc_emisor, placa: item.placa, producto: item.producto,
        galones: nz(item.galones), precio_unitario: nz(item.precio_unitario), importe_total: nz(item.importe_total),
        numero_documento: item.numero_documento,
      });
      setItems((prev) => prev.map((it) => (it.id === item.id ? { ...it, _dirty: false } : it)));
    } catch (e) { alert(e?.response?.data?.detail || "Error al guardar"); }
    finally { setSavingId(null); }
  };
  const deleteRow = async (id) => {
    if (!window.confirm("¿Eliminar esta factura?")) return;
    await api.delete(`/subsidio/invoices/${id}`); await load(); onAnyChange?.();
  };

  const enviarReporte = async () => {
    setError(null); setSuccess(null);

    const dirty = items.filter((it) => it._dirty);
    if (dirty.length > 0 && !window.confirm("Hay cambios sin guardar. ¿Confirmar de todos modos?")) return;
    setConfirming(true);
    try {
      await api.post("/subsidio/invoices/confirm");
      await load(); onAnyChange?.();
      setSuccess(`✅ Confirmaste ${items.length} factura(s). Pueden cargar más o continúa a la declaración jurada.`);
    } catch (e) {
      setError(e?.response?.data?.detail || "Error al confirmar");
    } finally { setConfirming(false); }
  };

  if (loading) return <div className="py-10 text-center"><Loader2 className="w-6 h-6 animate-spin text-brand mx-auto" /></div>;

  return (
    <div>
      <EtapaHeader n={3} icon={Fuel} title="Facturas de combustible" subtitle="Carga libre · Extracción OCR · Solo PDF" />

      <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 mb-4 text-xs text-amber-900 flex gap-2">
        <AlertTriangle className="w-4 h-4 mt-0.5 flex-shrink-0" />
        <div>
          <strong>Requisitos:</strong> comprobante electrónico, con placa, Diésel B5/B20 (azufre ≤50 ppm), fecha 29 may–28 jul 2026, grifo con Osinergmin vigente.
          {confirmedCount > 0 && <div className="mt-1 text-emerald-700 font-bold">✓ Llevas {confirmedCount} factura(s) confirmada(s) · {vehicles.length} placa(s) en flota: {vehicles.map(v => v.placa).join(", ")}</div>}
        </div>
      </div>

      {/* Uploader */}
      <div className="bg-white border-2 border-dashed border-brand/40 rounded-2xl p-5 mb-4">
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div className="flex items-start gap-3">
            <div className="w-11 h-11 bg-brand/10 rounded-xl flex items-center justify-center flex-shrink-0">
              <ScanLine className="w-5 h-5 text-brand" />
            </div>
            <div>
              <h4 className="font-cabinet font-bold">Carga tus facturas de combustible</h4>
              <p className="text-xs text-neutral-500">Sin meses · sin orden · sube todas juntas</p>
            </div>
          </div>
          <label className={`px-4 py-2.5 ${uploading ? "bg-neutral-300" : "bg-brand hover:bg-brand-hover"} text-white font-bold rounded-lg flex items-center gap-2 cursor-pointer text-sm`} data-testid="combustible-upload">
            {uploading ? (<><Loader2 className="w-4 h-4 animate-spin" /> Procesando {uploadProgress.done}/{uploadProgress.total}…</>) : (<><Upload className="w-4 h-4" /> {items.length === 0 ? "Subir facturas" : "Adjuntar más"}</>)}
            <input ref={fileRef} type="file" hidden multiple accept=".pdf" onChange={handleUpload} disabled={uploading} data-testid="combustible-upload-input" />
          </label>
        </div>
        {uploading && uploadProgress.total > 0 && (
          <div className="mt-3 h-2 bg-neutral-100 rounded-full overflow-hidden"><div className="h-full bg-brand transition-all" style={{ width: `${(uploadProgress.done / uploadProgress.total) * 100}%` }} /></div>
        )}
      </div>

      {items.length === 0 ? (
        confirmedCount > 0 ? (
          <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-5" data-testid="combustible-confirmadas">
            <div className="flex items-center gap-2 mb-3">
              <CheckCircle2 className="w-5 h-5 text-emerald-700" />
              <strong className="font-cabinet text-base">Ya tienes {confirmedCount} factura(s) confirmada(s)</strong>
            </div>
            <p className="text-xs text-emerald-900 mb-3">Estas facturas ya alimentan tus Reportes de Consumo. Puedes adjuntar más con el botón de arriba o pasar a la Etapa 4 (Declaración Jurada).</p>
            <ul className="space-y-1 text-xs bg-white border border-emerald-200 rounded-lg p-3 max-h-48 overflow-auto">
              {confirmedList.slice(0, 10).map((c) => (
                <li key={c.id} className="flex justify-between gap-2 py-1 border-b border-neutral-100 last:border-0">
                  <span className="truncate"><FileText className="w-3 h-3 inline mr-1 text-neutral-400" />{c.factura_filename || "factura"}</span>
                  <span className="font-mono text-neutral-600">{c.placa || "—"} · {c.galones ?? "?"} gl · S/ {c.importe_total ?? "?"}</span>
                </li>
              ))}
              {confirmedList.length > 10 && <li className="text-center text-neutral-500 pt-1">… y {confirmedList.length - 10} más</li>}
            </ul>
          </div>
        ) : (
          <div className="bg-neutral-50 border-2 border-dashed border-neutral-300 rounded-xl p-8 text-center">
            <FileText className="w-8 h-8 text-neutral-300 mx-auto mb-2" />
            <p className="text-sm text-neutral-500">No tienes facturas en borrador. Sube tus comprobantes arriba ⬆️</p>
          </div>
        )
      ) : (
        <>
          <div className="bg-blue-50 border border-blue-200 rounded-xl p-3 text-sm text-blue-900 flex gap-2 mb-3">
            <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
            <div>
              <strong>Tienes {items.length} factura(s) en borrador pendiente(s) de envío.</strong> Haz clic en "Enviar reporte" para registrarlas.
            </div>
          </div>
          <div className="space-y-2 mt-4">
            <h4 className="font-cabinet font-bold text-sm text-neutral-700">Comprobantes subidos: (Si falta algún dato, llénalo manualmente y guarda)</h4>
            <div>
              {items.map((it) => (
                <InvoiceRow 
                  key={it.id} 
                  item={it} 
                  setField={setField} 
                  saveRow={saveRow} 
                  deleteRow={deleteRow} 
                  vehicles={vehicles}
                  saving={savingId === it.id}
                />
              ))}
            </div>
          </div>
        </>
      )}

      {error && <div className="mt-4 bg-red-50 border border-red-200 text-red-700 rounded-xl p-3 text-sm" data-testid="combustible-error">{typeof error === "string" ? error : JSON.stringify(error)}</div>}
      {success && <div className="mt-4 bg-emerald-50 border border-emerald-200 text-emerald-700 rounded-xl p-3 text-sm">{success}</div>}

      {/* Actions footer */}
      <div className="mt-4 flex items-center justify-end gap-3 flex-wrap">
        <label className="px-4 py-2 border border-neutral-300 bg-white rounded-lg text-sm font-bold flex items-center gap-1.5 cursor-pointer hover:bg-neutral-50" data-testid="combustible-add-more">
          <Plus className="w-4 h-4" /> Adjuntar más
          <input type="file" hidden multiple accept=".pdf" onChange={handleUpload} disabled={uploading} />
        </label>
        <button onClick={enviarReporte} disabled={confirming || items.length === 0}
          className="px-5 py-2 bg-brand hover:bg-brand-hover text-white font-bold rounded-lg text-sm flex items-center gap-1.5 disabled:opacity-50"
          data-testid="combustible-enviar-reporte">
          {confirming ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
          Enviar reporte ({items.length})
        </button>
      </div>
    </div>
  );
}

/* ============================================================ */
/* Etapa 4 — Declaración jurada                                  */
/* ============================================================ */
function DeclaracionEtapa({ data, totals, onAccepted }) {
  const [accepted, setAccepted] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const already = data.declaracion;

  const empresa = data.user?.empresa || "[RAZÓN SOCIAL]";
  const repre = data.user?.contacto || data.user?.name || "[REPRESENTANTE LEGAL]";

  const empresaOk = totals.byEtapa.empresa.done === totals.byEtapa.empresa.total;
  const flotaOk = totals.byEtapa.flota.done === totals.byEtapa.flota.total;
  const combOk = totals.byEtapa.combustible.done > 0;
  const canSign = empresaOk && flotaOk && combOk;
  const missingList = [
    !empresaOk && `Etapa 1 · Empresa (${totals.byEtapa.empresa.done}/${totals.byEtapa.empresa.total})`,
    !flotaOk && `Etapa 2 · Flota (${totals.byEtapa.flota.done}/${totals.byEtapa.flota.total})`,
    !combOk && `Etapa 3 · al menos 1 factura confirmada`,
  ].filter(Boolean);

  const submit = async () => {
    setBusy(true); setError(null);
    try {
      const res = await api.post("/subsidio/declaracion", { accepted: true, representante: repre });
      onAccepted?.(res.data?.declaracion);
    } catch (e) {
      const d = e?.response?.data?.detail;
      setError(typeof d === "string" ? d : (d?.message || "Error al firmar"));
    } finally { setBusy(false); }
  };

  if (already) {
    return (
      <div>
        <EtapaHeader n={4} icon={ShieldCheck} title="Declaración jurada" subtitle="Firmada electrónicamente ✓" />
        <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-5 text-sm">
          <div className="flex items-center gap-2 mb-2"><CheckCircle2 className="w-5 h-5 text-emerald-700" /><strong className="font-cabinet text-base">Declaración firmada</strong></div>
          <ul className="space-y-1 text-emerald-900">
            <li><strong>Fecha y hora:</strong> {new Date(already.accepted_at).toLocaleString("es-PE")}</li>
            <li><strong>Empresa:</strong> {already.empresa} (RUC {already.ruc})</li>
            <li><strong>Representante:</strong> {already.representante}</li>
          </ul>
        </div>
      </div>
    );
  }

  return (
    <div>
      <EtapaHeader n={4} icon={ShieldCheck} title="Declaración jurada" subtitle="Antes de presentar tu solicitud a la ATU, necesitamos que confirmes que tu información es veraz" />

      {!canSign && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 text-sm text-amber-900 flex gap-2 mb-4" data-testid="declaracion-missing">
          <AlertTriangle className="w-4 h-4 mt-0.5 flex-shrink-0" />
          <div>
            <strong>Para firmar te falta completar:</strong>
            <ul className="list-disc pl-5 mt-1">
              {missingList.map((m, i) => <li key={i}>{m}</li>)}
            </ul>
          </div>
        </div>
      )}

      <div className="bg-neutral-50 border border-neutral-200 rounded-xl p-5">
        <h4 className="font-cabinet font-bold text-base mb-2">Declaración jurada de veracidad</h4>
        <p className="text-sm text-neutral-700 mb-3">
          Antes de presentar tu solicitud a la ATU, necesitamos que confirmes que tu información es veraz. La solicitud
          del subsidio tiene carácter de declaración jurada ante el Estado.
        </p>
        <blockquote className="bg-white border-l-4 border-brand rounded-r-lg p-4 text-sm text-neutral-700 italic mb-4">
          Declaro bajo juramento que la información, documentos y comprobantes presentados para acceder al subsidio
          económico del Decreto de Urgencia N.° 004-2026 son verdaderos, exactos y corresponden a unidades con
          habilitación vigente. Reconozco que la presentación de información falsa, adulterada o inexacta genera la
          pérdida automática del subsidio, sin perjuicio de las responsabilidades administrativas, civiles y penales
          que correspondan.
        </blockquote>

        <label className={`flex items-start gap-3 p-3 rounded-lg cursor-pointer border ${accepted ? "bg-brand/5 border-brand" : "bg-white border-neutral-300"} ${!canSign ? "opacity-50 cursor-not-allowed" : "hover:bg-brand/5"}`}>
          <input type="checkbox" checked={accepted} disabled={!canSign}
            onChange={(e) => setAccepted(e.target.checked)} className="mt-1 w-5 h-5 accent-violet-600"
            data-testid="declaracion-checkbox" />
          <span className="text-sm text-neutral-800">
            He leído y acepto la declaración de veracidad. Acepto en nombre de <strong>{empresa}</strong>, representada por <strong>{repre}</strong>.
          </span>
        </label>
        <p className="text-[11px] text-neutral-500 mt-2">
          Al marcar esta casilla, tu aceptación queda registrada con fecha, hora y usuario. Esto reemplaza la firma física
          para efectos de tu gestión con Enered.
        </p>

        {error && <div className="mt-3 bg-red-50 border border-red-200 text-red-700 rounded-lg p-3 text-sm" data-testid="declaracion-error">{error}</div>}

        <div className="mt-4 flex items-center justify-end">
          <button onClick={submit} disabled={!accepted || !canSign || busy}
            className="px-5 py-2.5 bg-brand hover:bg-brand-hover text-white font-bold rounded-lg flex items-center gap-2 disabled:opacity-50"
            data-testid="declaracion-submit">
            {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <ShieldCheck className="w-4 h-4" />}
            Firmar y enviar a la ATU
          </button>
        </div>
      </div>
    </div>
  );
}

// Etapa 5 eliminada y reubicada en overlay dinámico al firmar

/* ============================================================ */
/* UI helpers compartidos                                        */
/* ============================================================ */
function EtapaHeader({ n, icon: Ic, title, subtitle, inline }) {
  return (
    <div className={`flex items-center gap-3 ${inline ? "" : "mb-5"}`}>
      <span className="w-10 h-10 rounded-lg bg-brand/10 text-brand flex items-center justify-center"><Ic className="w-5 h-5" /></span>
      <div>
        <span className="text-[10px] uppercase tracking-widest font-bold text-brand">Etapa 0{n}</span>
        <h3 className="font-cabinet text-xl font-bold">{title}</h3>
        <p className="text-xs text-neutral-500">{subtitle}</p>
      </div>
    </div>
  );
}

function DocItem({ item, onChange, hint, accept, acceptLabel }) {
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState(null);
  const handleUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setBusy(true); setErr(null);
    try {
      const fd = new FormData();
      fd.append("file", file);
      fd.append("categoria", item.categoria);
      if (item.placa) fd.append("placa", item.placa);
      await api.post("/subsidio/documents", fd, { headers: { "Content-Type": "multipart/form-data" } });
      onChange?.();
    } catch (e2) {
      setErr(e2?.response?.data?.detail || "Error al subir");
    } finally { setBusy(false); }
  };
  const handleDelete = async (docId) => {
    if (!window.confirm("¿Eliminar este documento?")) return;
    setBusy(true);
    try { await api.delete(`/subsidio/documents/${docId}`); onChange?.(); }
    finally { setBusy(false); }
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
          <div className="text-[10px] text-neutral-400 mt-0.5 uppercase tracking-wider font-bold">Acepta: {acceptLabel}</div>
          {item.files?.length > 0 && (
            <ul className="mt-2 space-y-1">
              {item.files.map((f) => (
                <li key={f.id} className="flex items-center justify-between bg-white rounded-lg px-3 py-1.5 text-xs">
                  <span className="truncate flex items-center gap-2"><FileText className="w-3.5 h-3.5 text-neutral-400" />{f.filename}</span>
                  <button onClick={() => handleDelete(f.id)} disabled={busy} className="text-neutral-400 hover:text-red-500" aria-label="Eliminar"><Trash2 className="w-3.5 h-3.5" /></button>
                </li>
              ))}
            </ul>
          )}
          {err && <div className="mt-2 text-xs text-red-600">{err}</div>}
        </div>
        <label className="px-3 py-1.5 border border-neutral-300 bg-white rounded-lg text-xs font-bold cursor-pointer hover:bg-neutral-50 flex items-center gap-1.5">
          {busy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Upload className="w-3.5 h-3.5" />}
          {item.uploaded ? "Reemplazar" : "Subir"}
          <input type="file" hidden onChange={handleUpload} accept={accept} />
        </label>
      </div>
    </div>
  );
}

function Field({ label, children, full }) {
  return (
    <div className={full ? "col-span-2 md:col-span-2" : ""}>
      <label className="block text-[10px] font-bold text-neutral-700 uppercase tracking-wider mb-1">{label}</label>
      {children}
    </div>
  );
}

const FIELD_CSS = `.field-input{width:100%;height:42px;padding:0 12px;border:1px solid #d4d4d4;border-radius:10px;background:#fff;font-size:14px;}.field-input:focus{outline:none;border-color:#7c3aed;box-shadow:0 0 0 3px rgba(124,58,237,0.1);}`;
const nz = (v) => (v === "" || v == null ? null : Number(v));
