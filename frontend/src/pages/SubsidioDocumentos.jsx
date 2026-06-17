import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Loader2, Upload, CheckCircle2, AlertTriangle, AlertCircle,
  Trash2, Plus, ChevronDown, ChevronUp, Building2, Truck, Fuel,
  Banknote, FileText, Save
} from "lucide-react";
import { api } from "../lib/api";
import { useAuth } from "../context/AuthContext";

const LOGO_IMG = "https://customer-assets.emergentagent.com/job_enered-insight/artifacts/hrbrugb8_image.png";

export default function SubsidioDocumentos() {
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [openSection, setOpenSection] = useState("empresa");
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
      navigate("/subsidio/finalizado", { replace: true });
    } catch (e) {
      setFinalizeError(e?.response?.data?.detail || "Faltan documentos");
    } finally {
      setFinalizing(false);
    }
  };

  if (loading) return <div className="min-h-screen flex items-center justify-center"><Loader2 className="w-8 h-8 animate-spin text-brand" /></div>;
  if (!data) return null;

  const { calculation, ahorro_estimado, ahorro_reconocido, checklist, progress, vehicles, bank_account, can_finalize } = data;

  return (
    <div className="min-h-screen bg-neutral-50">
      {/* Header */}
      <div className="bg-white border-b border-neutral-200">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
          <img src={LOGO_IMG} alt="ENERED" className="h-8" />
          <div className="flex items-center gap-3">
            <div className="hidden sm:block text-xs text-neutral-600 text-right">
              <div>Ahorro estimado</div>
              <div className="font-bold text-brand text-base">S/ {Number(ahorro_estimado).toLocaleString("es-PE", { maximumFractionDigits: 0 })}</div>
            </div>
            <button onClick={logout} className="text-sm text-neutral-500 hover:text-neutral-900" data-testid="subsidio-signout">Salir</button>
          </div>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-4 sm:px-6 py-8">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <span className="text-xs uppercase tracking-widest font-bold text-neutral-500">Carga de documentos · Capa 2</span>
            <h1 className="font-cabinet text-3xl sm:text-4xl font-bold tracking-tight mt-1">
              Sube los documentos de tu expediente
            </h1>
            <p className="text-neutral-600 mt-2 max-w-2xl text-sm">
              Cada documento queda guardado en tu plataforma Enered. Los de flota encienden tus indicadores y alertas de vencimiento.
            </p>
          </div>
          <span className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-emerald-50 text-emerald-700 rounded-full text-xs font-bold">
            <CheckCircle2 className="w-3.5 h-3.5" /> Guardado automático
          </span>
        </div>

        {/* Savings comparison */}
        <div className="mt-6 bg-white border border-brand/20 rounded-2xl p-6 shadow-sm">
          <h3 className="font-bold text-lg flex items-center gap-2">
            <span className="text-brand">📊</span> Tu ahorro: estimado vs. reconocido
          </h3>
          <div className="grid sm:grid-cols-2 gap-4 mt-4">
            <StatCard label="Ahorro estimado (calculadora)" value={ahorro_estimado} muted />
            <StatCard label="Ahorro reconocido (con documentos validados)" value={ahorro_reconocido} highlight />
          </div>
          {progress.pct < 100 && (
            <div className="mt-4 flex gap-2 items-start text-sm bg-amber-50 border border-amber-200 text-amber-900 rounded-xl p-3">
              <AlertTriangle className="w-4 h-4 mt-0.5 flex-shrink-0" />
              <div>El monto reconocido se confirma cuando subas y validemos todos los documentos. Te faltan <strong>{progress.total_required - progress.total_done}</strong> de <strong>{progress.total_required}</strong>.</div>
            </div>
          )}
          <div className="mt-5">
            <div className="flex justify-between text-xs font-bold text-neutral-600 uppercase tracking-widest">
              <span>Progreso del expediente</span><span>{progress.pct}%</span>
            </div>
            <div className="mt-2 h-2 bg-neutral-100 rounded-full overflow-hidden">
              <div className="h-full bg-brand transition-all duration-700" style={{ width: `${progress.pct}%` }} />
            </div>
          </div>
        </div>

        {/* Sections */}
        <div className="mt-6 space-y-4">
          <Section
            n={1} id="empresa"
            open={openSection === "empresa"}
            onToggle={() => setOpenSection(openSection === "empresa" ? "" : "empresa")}
            title="Datos de la empresa"
            sub="Identidad, autorización y cuenta de depósito"
            icon={<Building2 className="w-5 h-5" />}
            tag={`${checklist.empresa.filter(d => d.uploaded).length}/${checklist.empresa.length}`}
          >
            <EmpresaSection items={checklist.empresa} bank={bank_account} onChange={load} />
          </Section>

          <Section
            n={2} id="flota"
            open={openSection === "flota"}
            onToggle={() => setOpenSection(openSection === "flota" ? "" : "flota")}
            title="Documentos de flota"
            sub="Por cada unidad habilitada"
            icon={<Truck className="w-5 h-5" />}
            tag={vehicles.length === 0 ? "Agrega placas" : `${checklist.flota.filter(d => d.uploaded).length}/${checklist.flota.length}`}
          >
            <FlotaSection items={checklist.flota} vehicles={vehicles} onChange={load} />
          </Section>

          <Section
            n={3} id="combustible"
            open={openSection === "combustible"}
            onToggle={() => setOpenSection(openSection === "combustible" ? "" : "combustible")}
            title="Comprobantes de combustible"
            sub="Facturas electrónicas · junio y julio 2026"
            icon={<Fuel className="w-5 h-5" />}
            tag={`${checklist.combustible.filter(d => d.uploaded).length}/${checklist.combustible.length}`}
          >
            <CombustibleSection items={checklist.combustible} onChange={load} />
          </Section>
        </div>

        {/* Finalize */}
        <div className="mt-8 bg-white border-2 border-brand rounded-2xl p-6 shadow-sm">
          <div className="flex items-center justify-between flex-wrap gap-3">
            <div>
              <h3 className="font-cabinet text-xl font-bold">Finalizar carga del expediente</h3>
              <p className="text-sm text-neutral-600 mt-1">
                Cuando termines de subir todos los documentos, envía el expediente para revisión.
              </p>
            </div>
            <button
              onClick={handleFinalize}
              disabled={!can_finalize || finalizing}
              className="px-6 py-3 bg-brand hover:bg-brand-hover text-white font-bold rounded-xl flex items-center gap-2 disabled:opacity-50"
              data-testid="subsidio-finalize"
            >
              {finalizing ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
              Finalizar carga →
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
    </div>
  );
}

function StatCard({ label, value, highlight }) {
  return (
    <div className={`rounded-xl p-4 border ${highlight ? "bg-brand text-white border-brand" : "bg-neutral-50 border-neutral-200"}`}>
      <div className={`text-xs font-bold uppercase tracking-widest ${highlight ? "text-white/80" : "text-neutral-500"}`}>{label}</div>
      <div className="font-cabinet text-3xl font-bold mt-1">
        S/ {Number(value).toLocaleString("es-PE", { maximumFractionDigits: 0 })}
      </div>
    </div>
  );
}

function Section({ n, id, title, sub, icon, tag, open, onToggle, children }) {
  return (
    <div className="bg-white border border-neutral-200 rounded-2xl overflow-hidden shadow-sm" data-testid={`subsidio-section-${id}`}>
      <button onClick={onToggle} className="w-full px-6 py-5 flex items-center gap-4 hover:bg-neutral-50 transition-colors text-left">
        <span className="w-10 h-10 rounded-lg bg-brand/10 text-brand flex items-center justify-center flex-shrink-0">{icon}</span>
        <div className="flex-1">
          <div className="flex items-baseline gap-3">
            <span className="text-xs font-bold text-neutral-400">{String(n).padStart(2, "0")}</span>
            <h3 className="font-cabinet text-xl font-bold">{title}</h3>
          </div>
          <p className="text-sm text-neutral-500 mt-0.5">{sub}</p>
        </div>
        <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-neutral-100 text-neutral-700">{tag}</span>
        {open ? <ChevronUp className="w-5 h-5 text-neutral-400" /> : <ChevronDown className="w-5 h-5 text-neutral-400" />}
      </button>
      {open && <div className="border-t border-neutral-100 p-5 bg-neutral-50/60">{children}</div>}
    </div>
  );
}

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
    } finally {
      setBusy(false);
    }
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
    <div className="bg-white border border-neutral-200 rounded-xl p-4">
      <div className="flex items-start gap-3">
        <span className={`w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 ${item.uploaded ? "bg-emerald-100 text-emerald-700" : "bg-red-100 text-red-600"}`}>
          {item.uploaded ? <CheckCircle2 className="w-4 h-4" /> : <AlertCircle className="w-4 h-4" />}
        </span>
        <div className="flex-1 min-w-0">
          <div className="font-bold text-neutral-900">{item.label}</div>
          {hint && <div className="text-xs text-neutral-500 mt-0.5">{hint}</div>}
          {item.files?.length > 0 && (
            <ul className="mt-3 space-y-1">
              {item.files.map((f) => (
                <li key={f.id} className="flex items-center justify-between bg-neutral-50 rounded-lg px-3 py-2 text-sm">
                  <span className="truncate flex items-center gap-2"><FileText className="w-4 h-4 text-neutral-400" />{f.filename}</span>
                  <button onClick={() => handleDelete(f.id)} disabled={busy} className="text-neutral-400 hover:text-red-500" aria-label="Eliminar">
                    <Trash2 className="w-4 h-4" />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
        <label className="px-3 py-2 border border-neutral-300 rounded-lg text-sm font-bold cursor-pointer hover:bg-neutral-50 flex items-center gap-1.5">
          {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
          {item.uploaded ? "Reemplazar" : "Subir"}
          <input type="file" hidden onChange={handleUpload} accept=".pdf,.jpg,.jpeg,.png,.xml" />
        </label>
      </div>
    </div>
  );
}

function EmpresaSection({ items, bank, onChange }) {
  const hints = {
    ficha_ruc: "PDF descargado de SUNAT",
    resolucion_autorizacion: "MTC / Gobierno Regional / Municipalidad · Art. 3.4.1",
    dni_representante: "Ambas caras · firma la declaración jurada",
  };
  return (
    <div className="space-y-3">
      {items.map((it) => <DocItem key={it.categoria} item={it} hint={hints[it.categoria]} onChange={onChange} />)}
      <BankAccountCard bank={bank} onSaved={onChange} />
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
      setSaved(true);
      onSaved?.();
    } catch (e) {
      alert(e?.response?.data?.detail || "Error al guardar");
    } finally {
      setBusy(false);
      setTimeout(() => setSaved(false), 2000);
    }
  };

  return (
    <div className="bg-white border border-neutral-200 rounded-xl p-4">
      <div className="flex items-center gap-2 mb-1">
        <Banknote className="w-5 h-5 text-brand" />
        <h4 className="font-cabinet font-bold text-lg">💳 Cuenta para el depósito del subsidio</h4>
        {ba.es_banco_nacion && <span className="ml-auto px-2 py-0.5 bg-brand/10 text-brand text-xs font-bold rounded-full">Recomendada</span>}
      </div>
      <p className="text-xs text-neutral-500 mb-3">Con Banco de la Nación el depósito es directo y no requiere CCI.</p>

      <div className="grid sm:grid-cols-2 gap-3">
        <Field label="Banco">
          <select className="field-input" value={ba.es_banco_nacion ? "BN" : "OTRO"}
            onChange={(e) => {
              const isBN = e.target.value === "BN";
              setBa({ ...ba, es_banco_nacion: isBN, banco: isBN ? "Banco de la Nación" : "" });
            }} data-testid="bank-select">
            <option value="BN">🏦 Banco de la Nación</option>
            <option value="OTRO">🏛️ Otro banco</option>
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
        <button onClick={save} disabled={busy} className="px-4 py-2 bg-brand hover:bg-brand-hover text-white font-bold rounded-lg flex items-center gap-2">
          {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />} Guardar cuenta
        </button>
      </div>
      <style>{`
        .field-input { width:100%; height:42px; padding:0 12px; border:1px solid #d4d4d4; border-radius:10px; background:#fff; font-size:14px; }
        .field-input:focus { outline:none; border-color:#7c3aed; box-shadow:0 0 0 3px rgba(124,58,237,0.1); }
      `}</style>
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

function FlotaSection({ items, vehicles, onChange }) {
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
      <div className="flex items-center justify-between mb-3">
        <div className="text-sm text-neutral-600">Unidades registradas: <strong>{vehicles.length}</strong></div>
        <button onClick={() => setAdding(!adding)} className="px-3 py-2 border border-neutral-300 rounded-lg text-sm font-bold flex items-center gap-1.5 hover:bg-white" data-testid="flota-toggle-add">
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
        <div className="text-center text-sm text-neutral-500 bg-white border-2 border-dashed border-neutral-300 rounded-xl p-8">
          Aún no has registrado unidades. Agrega tus placas para subir habilitaciones y tarjetas de propiedad.
        </div>
      )}

      <div className="space-y-3">
        {vehicles.map((v) => (
          <div key={v.placa} className="bg-white border border-neutral-200 rounded-xl p-4">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <Truck className="w-4 h-4 text-brand" />
                <strong className="font-cabinet">{v.placa}</strong>
                <span className="px-2 py-0.5 bg-neutral-100 rounded-full text-xs font-bold">{v.categoria}</span>
              </div>
              <button onClick={() => removeVehicle(v.placa)} className="text-neutral-400 hover:text-red-500"><Trash2 className="w-4 h-4" /></button>
            </div>
            <div className="space-y-2">
              {items.filter((it) => it.placa === v.placa).map((it) => (
                <DocItem
                  key={it.categoria + "-" + it.placa} item={it} onChange={onChange}
                  hint={it.categoria === "tarjeta_habilitacion" ? "Art. 3.4.2 — habilita la unidad para servicio público" : "Define la categoría (M/N) para el tope"}
                />
              ))}
            </div>
          </div>
        ))}
      </div>

      <p className="text-xs text-neutral-500 mt-4">↳ Estos documentos encienden tu módulo de <strong>Gestión de flota</strong> y las alertas de vencimiento. 🔔</p>

      <style>{`
        .field-input { width:100%; height:42px; padding:0 12px; border:1px solid #d4d4d4; border-radius:10px; background:#fff; font-size:14px; }
        .field-input:focus { outline:none; border-color:#7c3aed; box-shadow:0 0 0 3px rgba(124,58,237,0.1); }
      `}</style>
    </div>
  );
}

function CombustibleSection({ items, onChange }) {
  return (
    <div>
      <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 mb-4 text-sm text-amber-900">
        <div className="flex gap-2 items-start">
          <AlertTriangle className="w-4 h-4 mt-0.5 flex-shrink-0" />
          <div>
            <strong>⚠️ Importante: requisitos exactos del comprobante (Art. 3.3 y 4.2)</strong>
            <ul className="mt-2 list-disc pl-5 space-y-1">
              <li>Ser <strong>comprobante de pago electrónico</strong> (no físico)</li>
              <li>Consignar la <strong>placa del vehículo</strong></li>
              <li>Combustible: <strong>diésel B5 o B20, azufre ≤50ppm</strong></li>
              <li>Fecha entre <strong>29 mayo y 28 julio 2026</strong></li>
              <li>Grifo con <strong>Registro Osinergmin vigente</strong></li>
            </ul>
            Si falta la placa o el tipo de combustible, ese comprobante NO se cuenta.
          </div>
        </div>
      </div>
      <div className="space-y-3">
        {items.map((it) => <DocItem key={it.categoria} item={it} hint="XML o PDF · puedes subir varios" onChange={onChange} />)}
      </div>
      <p className="text-xs text-neutral-500 mt-4">↳ Tus comprobantes alimentan el módulo de <strong>Control de costos</strong> y el cálculo de galones reconocidos. ⛽</p>
    </div>
  );
}
