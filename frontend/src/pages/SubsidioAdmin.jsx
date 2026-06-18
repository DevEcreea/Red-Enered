import React, { useEffect, useState, useMemo } from "react";
import {
  Loader2, Search, Building2, Truck, Fuel, ShieldCheck, FileText,
  Download, ArrowLeft, CheckCircle2, Clock, AlertCircle, Banknote, Lock,
} from "lucide-react";
import { api } from "../lib/api";

const ESTADO_BADGE = {
  uploading:  { label: "En carga",   color: "bg-amber-100 text-amber-700 border-amber-200" },
  confirmed:  { label: "Confirmado", color: "bg-blue-100 text-blue-700 border-blue-200" },
  submitted:  { label: "Enviado ATU", color: "bg-emerald-100 text-emerald-700 border-emerald-200" },
};

const STAGES = [
  { key: "solicitud_enviada",  label: "Solicitud enviada" },
  { key: "evaluacion_atu",     label: "Evaluación ATU" },
  { key: "aprobada",           label: "Aprobada" },
  { key: "abonado_en_cuenta",  label: "Abonado en cuenta" },
];
const STAGE_LABEL = Object.fromEntries(STAGES.map(s => [s.key, s.label]));

export default function SubsidioAdmin() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");
  const [estado, setEstado] = useState("");
  const [selectedId, setSelectedId] = useState(null);

  const load = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (q) params.set("q", q);
      if (estado) params.set("estado", estado);
      const { data } = await api.get(`/admin/subsidio/expedientes?${params.toString()}`);
      setItems(data.items || []);
    } finally { setLoading(false); }
  };
  useEffect(() => { load(); /* eslint-disable-next-line */ }, [estado]);

  const stats = useMemo(() => {
    const total = items.length;
    const submitted = items.filter(i => i.expediente_status === "submitted").length;
    const ahorroEst = items.reduce((s, i) => s + (i.ahorro_estimado || 0), 0);
    const ahorroRec = items.reduce((s, i) => s + (i.ahorro_reconocido || 0), 0);
    return { total, submitted, ahorroEst, ahorroRec };
  }, [items]);

  if (selectedId) {
    return <ExpedienteDetalle userId={selectedId} onBack={() => setSelectedId(null)} />;
  }

  return (
    <div className="space-y-6" data-testid="subsidio-admin">
      {/* Header + KPIs */}
      <div className="bg-white border border-neutral-200 rounded-2xl p-6 shadow-sm">
        <div className="flex items-start justify-between mb-5 flex-wrap gap-3">
          <div>
            <span className="text-[10px] uppercase tracking-widest font-bold text-brand">Admin · DU 004-2026</span>
            <h2 className="font-cabinet text-2xl font-bold tracking-tight mt-1">Subsidio · Expedientes</h2>
            <p className="text-neutral-500 text-sm mt-1">Vista de todos los clientes del subsidio y su avance.</p>
          </div>
          <div className="grid grid-cols-4 gap-3">
            <Kpi label="Empresas" value={stats.total} />
            <Kpi label="Enviadas ATU" value={stats.submitted} color="emerald" />
            <Kpi label="Ahorro est." value={`S/ ${num(stats.ahorroEst)}`} color="violet" />
            <Kpi label="Ahorro reconocido" value={`S/ ${num(stats.ahorroRec)}`} color="emerald" />
          </div>
        </div>

        {/* Filtros */}
        <div className="flex gap-3 flex-wrap">
          <div className="relative flex-1 min-w-[260px]">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400" />
            <input
              data-testid="subsidio-admin-search"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && load()}
              placeholder="Buscar por razón social, RUC o email..."
              className="w-full h-10 pl-9 pr-3 border border-neutral-300 rounded-lg text-sm"
            />
          </div>
          <select
            value={estado}
            onChange={(e) => setEstado(e.target.value)}
            data-testid="subsidio-admin-estado"
            className="h-10 px-3 border border-neutral-300 rounded-lg text-sm bg-white"
          >
            <option value="">Todos los estados</option>
            <option value="uploading">En carga</option>
            <option value="confirmed">Confirmado</option>
            <option value="submitted">Enviado ATU</option>
          </select>
          <button onClick={load} className="h-10 px-4 bg-brand hover:bg-brand-hover text-white font-bold rounded-lg text-sm">
            Buscar
          </button>
        </div>
      </div>

      {/* Tabla */}
      <div className="bg-white border border-neutral-200 rounded-2xl overflow-hidden shadow-sm">
        {loading ? (
          <div className="py-16 text-center"><Loader2 className="w-6 h-6 animate-spin text-brand mx-auto" /></div>
        ) : items.length === 0 ? (
          <div className="py-16 text-center text-sm text-neutral-500">No se encontraron expedientes con esos criterios.</div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-neutral-50 text-[10px] uppercase tracking-widest font-bold text-neutral-500 border-b border-neutral-200">
              <tr>
                <th className="text-left px-4 py-3">Empresa</th>
                <th className="text-left px-4 py-3">RUC</th>
                <th className="text-left px-4 py-3">Estado</th>
                <th className="text-left px-4 py-3">Etapa DU 004</th>
                <th className="text-right px-4 py-3">Docs</th>
                <th className="text-right px-4 py-3">Flota</th>
                <th className="text-right px-4 py-3">Facturas</th>
                <th className="text-right px-4 py-3">Galones</th>
                <th className="text-right px-4 py-3">Ahorro est.</th>
                <th className="text-right px-4 py-3">Ahorro rec.</th>
                <th className="text-center px-4 py-3">DJ</th>
                <th className="px-2 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-100">
              {items.map((it) => {
                const badge = ESTADO_BADGE[it.expediente_status] || ESTADO_BADGE.uploading;
                return (
                  <tr key={it.user_id} className="hover:bg-neutral-50 cursor-pointer" onClick={() => setSelectedId(it.user_id)} data-testid={`exp-row-${it.user_id}`}>
                    <td className="px-4 py-3">
                      <div className="font-bold text-neutral-900">{it.empresa || "—"}</div>
                      <div className="text-xs text-neutral-500">{it.email}</div>
                    </td>
                    <td className="px-4 py-3 font-mono text-xs">{it.ruc || "—"}</td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-1 rounded-full text-[10px] font-bold border ${badge.color}`}>{badge.label}</span>
                    </td>
                    <td className="px-4 py-3">
                      {it.expediente_stage ? (
                        <span className="px-2 py-1 rounded-full text-[10px] font-bold bg-brand/10 text-brand border border-brand/20" data-testid={`exp-stage-${it.user_id}`}>
                          {STAGE_LABEL[it.expediente_stage] || it.expediente_stage}
                        </span>
                      ) : (
                        <span className="text-[10px] text-neutral-400">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right">{it.docs_count}</td>
                    <td className="px-4 py-3 text-right">{it.vehicles_count}</td>
                    <td className="px-4 py-3 text-right">
                      <span className="text-emerald-600 font-bold">{it.invoices.confirmed}</span>
                      {it.invoices.draft > 0 && <span className="text-amber-600 ml-1">+{it.invoices.draft}d</span>}
                    </td>
                    <td className="px-4 py-3 text-right">{num(it.galones_confirmados)}</td>
                    <td className="px-4 py-3 text-right text-violet-700 font-bold">S/ {num(it.ahorro_estimado)}</td>
                    <td className="px-4 py-3 text-right text-emerald-700 font-bold">S/ {num(it.ahorro_reconocido)}</td>
                    <td className="px-4 py-3 text-center">
                      {it.declaracion_firmada ? <CheckCircle2 className="w-4 h-4 text-emerald-600 inline" /> : <Clock className="w-4 h-4 text-neutral-300 inline" />}
                    </td>
                    <td className="px-2 py-3 text-right">
                      <span className="text-brand text-xs font-bold">Ver →</span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

/* ============================================================ */
/* DETALLE DEL EXPEDIENTE                                        */
/* ============================================================ */
function ExpedienteDetalle({ userId, onBack }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState("general");
  const [savingStage, setSavingStage] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const { data } = await api.get(`/admin/subsidio/expedientes/${userId}`);
        setData(data);
      } finally { setLoading(false); }
    })();
  }, [userId]);

  const updateStage = async (newStage) => {
    if (!data) return;
    if (!window.confirm(`¿Confirmas cambiar la etapa a "${STAGE_LABEL[newStage]}"?`)) return;
    setSavingStage(true);
    try {
      const { data: res } = await api.put(`/admin/subsidio/expedientes/${userId}/stage`, { stage: newStage });
      setData((d) => ({
        ...d,
        user: { ...d.user, expediente_stage: res.expediente_stage, expediente_stage_updated_at: res.updated_at },
      }));
    } catch (err) {
      alert(`No se pudo actualizar: ${err.response?.data?.detail || err.message}`);
    } finally {
      setSavingStage(false);
    }
  };

  if (loading) return <div className="py-16 text-center"><Loader2 className="w-8 h-8 animate-spin text-brand mx-auto" /></div>;
  if (!data) return <div className="py-16 text-center text-sm text-red-600">Expediente no encontrado.</div>;

  const { user, calculation, bank_account, documents, vehicles, invoices, declaracion, stats } = data;
  const badge = ESTADO_BADGE[user.expediente_status] || ESTADO_BADGE.uploading;

  const tabs = [
    { id: "general", label: "Datos generales", icon: Building2 },
    { id: "banco", label: "Cuenta bancaria", icon: Banknote },
    { id: "documentos", label: `Documentos (${stats.docs_count})`, icon: FileText },
    { id: "flota", label: `Flota (${stats.vehicles_count})`, icon: Truck },
    { id: "facturas", label: `Facturas (${stats.invoices_confirmed}/${stats.invoices_confirmed + stats.invoices_draft})`, icon: Fuel },
    { id: "declaracion", label: "Declaración jurada", icon: ShieldCheck },
  ];

  return (
    <div className="space-y-5" data-testid="expediente-detalle">
      <button onClick={onBack} className="text-sm text-neutral-600 hover:text-brand flex items-center gap-1.5 font-bold" data-testid="expediente-back">
        <ArrowLeft className="w-4 h-4" /> Volver al listado
      </button>

      {/* Header del expediente */}
      <div className="bg-white border border-neutral-200 rounded-2xl p-6 shadow-sm">
        <div className="flex items-start justify-between flex-wrap gap-3">
          <div>
            <span className="text-[10px] uppercase tracking-widest font-bold text-brand">Expediente DU 004-2026</span>
            <h2 className="font-cabinet text-2xl font-bold mt-1">{user.empresa || "—"}</h2>
            <p className="text-sm text-neutral-500 mt-1">RUC <span className="font-mono">{user.ruc}</span> · {user.email}</p>
          </div>
          <div className="flex items-center gap-3 flex-wrap">
            <span className={`px-3 py-1.5 rounded-full text-xs font-bold border ${badge.color}`}>{badge.label}</span>
            <Kpi label="Ahorro reconocido" value={`S/ ${num(stats.galones_confirmados * 1.5)}`} color="emerald" />
            <Kpi label="Galones confirm." value={num(stats.galones_confirmados)} color="violet" />
          </div>
        </div>

        {/* Control de etapas DU 004 (solo admin_enered) */}
        <StageController
          currentStage={user.expediente_stage}
          updatedAt={user.expediente_stage_updated_at}
          isSubmitted={user.expediente_status === "submitted"}
          onChange={updateStage}
          saving={savingStage}
        />

        {/* Tabs */}
        <div className="flex gap-1 mt-5 border-b border-neutral-200 -mb-px overflow-x-auto">
          {tabs.map((t) => {
            const Ic = t.icon;
            return (
              <button
                key={t.id}
                onClick={() => setTab(t.id)}
                data-testid={`detalle-tab-${t.id}`}
                className={`px-4 py-2.5 text-sm font-bold border-b-2 whitespace-nowrap flex items-center gap-1.5 ${
                  tab === t.id ? "border-brand text-brand" : "border-transparent text-neutral-500 hover:text-neutral-800"
                }`}
              >
                <Ic className="w-4 h-4" /> {t.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Contenido del tab */}
      <div className="bg-white border border-neutral-200 rounded-2xl p-6 shadow-sm">
        {tab === "general" && <TabGeneral user={user} calculation={calculation} />}
        {tab === "banco" && <TabBanco bank={bank_account} />}
        {tab === "documentos" && <TabDocumentos docs={documents} />}
        {tab === "flota" && <TabFlota vehicles={vehicles} />}
        {tab === "facturas" && <TabFacturas invoices={invoices} />}
        {tab === "declaracion" && <TabDeclaracion declaracion={declaracion} />}
      </div>
    </div>
  );
}

/* ====== Tabs del detalle ====== */
function TabGeneral({ user, calculation }) {
  return (
    <div className="grid md:grid-cols-2 gap-6">
      <div>
        <h4 className="font-cabinet font-bold mb-3">Datos de contacto</h4>
        <DefList items={[
          ["Razón social", user.empresa],
          ["RUC", user.ruc],
          ["Email", user.email],
          ["Representante", user.contacto || user.name],
          ["Teléfono", user.telefono],
          ["Registro", fmtDate(user.created_at)],
        ]} />
      </div>
      <div>
        <h4 className="font-cabinet font-bold mb-3">Cálculo del subsidio</h4>
        {!calculation ? <p className="text-sm text-neutral-500">Sin cálculo registrado.</p> : (
          <>
            <DefList items={[
              ["Califica", calculation.califica ? "Sí" : "No"],
              ["Total galones/mes", num(calculation.total_galones_mensuales)],
              ["Subsidio estimado", `S/ ${num(calculation.subsidio_estimado)}`],
              ["Canal de origen", calculation.canal_origen],
            ]} />
            {calculation.categorias?.length > 0 && (
              <table className="w-full text-xs mt-3 border border-neutral-200 rounded-lg overflow-hidden">
                <thead className="bg-neutral-50 text-[10px] uppercase font-bold text-neutral-500">
                  <tr><th className="px-3 py-2 text-left">Categoría</th><th className="px-3 py-2 text-right">Unidades</th><th className="px-3 py-2 text-right">Galones/mes</th></tr>
                </thead>
                <tbody className="divide-y divide-neutral-100">
                  {calculation.categorias.map((c, i) => (
                    <tr key={i}><td className="px-3 py-1.5 font-bold">{c.code}</td><td className="px-3 py-1.5 text-right">{c.cantidad}</td><td className="px-3 py-1.5 text-right">{num(c.galones_mensuales)}</td></tr>
                  ))}
                </tbody>
              </table>
            )}
          </>
        )}
      </div>
    </div>
  );
}

function TabBanco({ bank }) {
  if (!bank) return <Empty msg="El cliente aún no registró cuenta bancaria." />;
  return (
    <div>
      <h4 className="font-cabinet font-bold mb-3">Cuenta para depósito del subsidio</h4>
      <DefList items={[
        ["Banco", bank.banco + (bank.es_banco_nacion ? " (recomendada)" : "")],
        ["Tipo de cuenta", bank.tipo_cuenta],
        ["N° de cuenta", bank.numero_cuenta],
        ["Moneda", bank.moneda],
        ["CCI", bank.cci || "—"],
        ["Última actualización", fmtDate(bank.updated_at)],
      ]} />
      <div className="mt-4 bg-violet-50 border border-violet-200 rounded-lg p-3 flex gap-2 text-xs text-violet-900">
        <Lock className="w-4 h-4 mt-0.5 flex-shrink-0" />
        <p><strong>Seguridad bancaria:</strong> estos datos solo se usan para el depósito ATU. Ni Enered ni la ATU piden claves, PIN, tokens ni acceso a banca por internet.</p>
      </div>
    </div>
  );
}

function TabDocumentos({ docs }) {
  if (!docs?.length) return <Empty msg="Sin documentos subidos." />;
  const API_BASE = process.env.REACT_APP_BACKEND_URL || "";
  const downloadHref = (id) => `${API_BASE}/api/admin/subsidio/documents/${id}/download`;
  return (
    <table className="w-full text-sm">
      <thead className="bg-neutral-50 text-[10px] uppercase tracking-widest font-bold text-neutral-500 border-b">
        <tr>
          <th className="text-left px-4 py-2">Documento</th>
          <th className="text-left px-4 py-2">Archivo</th>
          <th className="text-left px-4 py-2">Placa</th>
          <th className="text-left px-4 py-2">Fecha</th>
          <th className="px-2 py-2" />
        </tr>
      </thead>
      <tbody className="divide-y divide-neutral-100">
        {docs.map((d) => (
          <tr key={d.id}>
            <td className="px-4 py-2 font-bold">{d.label}</td>
            <td className="px-4 py-2 text-xs"><FileText className="w-3.5 h-3.5 inline mr-1 text-neutral-400" />{d.filename}</td>
            <td className="px-4 py-2 font-mono text-xs">{d.placa || "—"}</td>
            <td className="px-4 py-2 text-xs">{fmtDate(d.created_at)}</td>
            <td className="px-2 py-2 text-right">
              <a href={downloadHref(d.id)} target="_blank" rel="noreferrer"
                 className="text-brand hover:text-brand-hover text-xs font-bold inline-flex items-center gap-1"
                 data-testid={`doc-download-${d.id}`}>
                <Download className="w-3.5 h-3.5" /> Descargar
              </a>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function TabFlota({ vehicles }) {
  if (!vehicles?.length) return <Empty msg="Sin unidades registradas." />;
  return (
    <table className="w-full text-sm">
      <thead className="bg-neutral-50 text-[10px] uppercase tracking-widest font-bold text-neutral-500 border-b">
        <tr><th className="text-left px-4 py-2">Placa</th><th className="text-left px-4 py-2">Categoría</th><th className="text-left px-4 py-2">Registrada</th></tr>
      </thead>
      <tbody className="divide-y divide-neutral-100">
        {vehicles.map((v) => (
          <tr key={v.placa}>
            <td className="px-4 py-2 font-mono font-bold">{v.placa}</td>
            <td className="px-4 py-2"><span className="px-2 py-0.5 bg-neutral-100 rounded text-xs font-bold">{v.categoria}</span></td>
            <td className="px-4 py-2 text-xs">{fmtDate(v.created_at)}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function TabFacturas({ invoices }) {
  if (!invoices?.length) return <Empty msg="Sin facturas cargadas." />;
  return (
    <div className="overflow-auto">
      <table className="w-full text-xs">
        <thead className="bg-neutral-50 text-[10px] uppercase tracking-widest font-bold text-neutral-500 border-b">
          <tr>
            <th className="text-left px-3 py-2">Estado</th>
            <th className="text-left px-3 py-2">Fecha</th>
            <th className="text-left px-3 py-2">Placa</th>
            <th className="text-left px-3 py-2">Producto</th>
            <th className="text-right px-3 py-2">Galones</th>
            <th className="text-right px-3 py-2">Importe</th>
            <th className="text-left px-3 py-2">RUC emisor</th>
            <th className="text-left px-3 py-2">Estación</th>
            <th className="text-left px-3 py-2">N° Doc</th>
            <th className="text-center px-3 py-2">OCR</th>
            <th className="text-left px-3 py-2">Archivo</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-neutral-100">
          {invoices.map((i) => (
            <tr key={i.id} data-testid={`invoice-row-${i.id}`}>
              <td className="px-3 py-1.5">
                <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${i.status === "confirmed" ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-700"}`}>
                  {i.status === "confirmed" ? "CONF" : "DRAFT"}
                </span>
              </td>
              <td className="px-3 py-1.5">{i.fecha || "—"}</td>
              <td className="px-3 py-1.5 font-mono">{i.placa || "—"}</td>
              <td className="px-3 py-1.5">{i.producto || "—"}</td>
              <td className="px-3 py-1.5 text-right">{i.galones ?? "—"}</td>
              <td className="px-3 py-1.5 text-right font-bold">{i.importe_total ? `S/ ${num(i.importe_total)}` : "—"}</td>
              <td className="px-3 py-1.5 font-mono">{i.ruc_emisor || "—"}</td>
              <td className="px-3 py-1.5 truncate max-w-[120px]" title={i.estacion}>{i.estacion || "—"}</td>
              <td className="px-3 py-1.5 font-mono">{i.numero_documento || "—"}</td>
              <td className="px-3 py-1.5 text-center">
                {i.ocr_ok ? <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 inline" /> : <AlertCircle className="w-3.5 h-3.5 text-red-500 inline" />}
              </td>
              <td className="px-3 py-1.5 truncate max-w-[140px] text-neutral-500" title={i.factura_filename}>{i.factura_filename || "—"}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function TabDeclaracion({ declaracion }) {
  if (!declaracion) return <Empty msg="El cliente aún no ha firmado la declaración jurada." />;
  return (
    <div className="space-y-4">
      <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4 flex items-start gap-2">
        <CheckCircle2 className="w-5 h-5 text-emerald-700 mt-0.5" />
        <div>
          <strong className="font-cabinet">Declaración firmada electrónicamente</strong>
          <p className="text-xs text-emerald-800 mt-1">Esta aceptación reemplaza la firma física para efectos de gestión con Enered.</p>
        </div>
      </div>
      <DefList items={[
        ["Fecha y hora", fmtDate(declaracion.accepted_at, true)],
        ["Empresa", declaracion.empresa],
        ["RUC", declaracion.ruc],
        ["Representante", declaracion.representante],
        ["IP origen", declaracion.ip || "—"],
        ["User-Agent", declaracion.user_agent || "—"],
      ]} />
      <div>
        <h5 className="text-[10px] uppercase tracking-widest font-bold text-neutral-500 mb-2">Texto firmado</h5>
        <blockquote className="bg-neutral-50 border-l-4 border-brand rounded-r-lg p-4 text-sm text-neutral-700 italic">
          {declaracion.texto}
        </blockquote>
      </div>
    </div>
  );
}

/* ====== Stage controller (admin) ====== */
function StageController({ currentStage, updatedAt, isSubmitted, onChange, saving }) {
  const idx = currentStage ? STAGES.findIndex(s => s.key === currentStage) : -1;
  return (
    <div className="mt-5 p-4 bg-gradient-to-br from-brand/5 to-emerald-50/30 border border-brand/20 rounded-xl" data-testid="stage-controller">
      <div className="flex items-center justify-between flex-wrap gap-2 mb-3">
        <div>
          <div className="text-[10px] uppercase tracking-widest font-bold text-brand">Avance del trámite ATU</div>
          <p className="text-xs text-neutral-500 mt-0.5">
            Solo el equipo Enered puede mover estas etapas.
            {updatedAt && <span className="ml-1">Última actualización: {fmtDate(updatedAt, true)}.</span>}
          </p>
        </div>
        {!isSubmitted && idx === -1 && (
          <span className="text-[10px] font-bold text-amber-700 bg-amber-100 px-2 py-1 rounded-full">
            El cliente aún no firma la declaración jurada
          </span>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-2">
        {STAGES.map((s, i) => {
          const isDone = idx >= 0 && i < idx;
          const isCurrent = i === idx;
          const isNext = i === idx + 1;
          const base = "w-full text-left px-3 py-2.5 rounded-lg border transition text-xs font-bold flex items-center justify-between gap-2 disabled:opacity-50";
          const cls = isCurrent
            ? "bg-brand text-white border-brand shadow-md cursor-default"
            : isDone
            ? "bg-emerald-100 border-emerald-200 text-emerald-700 hover:bg-emerald-200"
            : isNext
            ? "bg-white border-brand text-brand hover:bg-brand/5"
            : "bg-white border-neutral-200 text-neutral-500 hover:border-neutral-300";
          return (
            <button
              key={s.key}
              onClick={() => !isCurrent && onChange(s.key)}
              disabled={saving || isCurrent}
              data-testid={`stage-btn-${s.key}`}
              className={`${base} ${cls}`}
            >
              <span className="flex items-center gap-1.5">
                <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-black ${isCurrent ? "bg-white/30" : isDone ? "bg-emerald-500 text-white" : "bg-neutral-200 text-neutral-600"}`}>
                  {i + 1}
                </span>
                <span className="truncate">{s.label}</span>
              </span>
              {isCurrent && <CheckCircle2 className="w-3.5 h-3.5 flex-shrink-0" />}
            </button>
          );
        })}
      </div>
    </div>
  );
}

/* ====== UI helpers ====== */
function Kpi({ label, value, color = "neutral" }) {
  const palette = {
    neutral: "bg-neutral-50 border-neutral-200 text-neutral-900",
    emerald: "bg-emerald-50 border-emerald-200 text-emerald-700",
    violet: "bg-brand/10 border-brand/30 text-brand",
  }[color];
  return (
    <div className={`px-3 py-2 rounded-xl border ${palette}`}>
      <div className="text-[10px] uppercase tracking-widest font-bold opacity-70">{label}</div>
      <div className="font-cabinet font-black text-lg">{value}</div>
    </div>
  );
}

function DefList({ items }) {
  return (
    <dl className="space-y-2">
      {items.map(([k, v], i) => (
        <div key={i} className="flex gap-2 text-sm border-b border-neutral-100 pb-2">
          <dt className="font-bold text-neutral-600 min-w-[140px]">{k}</dt>
          <dd className="text-neutral-900 flex-1 break-all">{v ?? "—"}</dd>
        </div>
      ))}
    </dl>
  );
}

function Empty({ msg }) {
  return <div className="py-10 text-center text-sm text-neutral-500">{msg}</div>;
}

const num = (v) => Number(v || 0).toLocaleString("es-PE", { maximumFractionDigits: 2 });
const fmtDate = (s, withTime) => {
  if (!s) return "—";
  try {
    const d = new Date(s);
    return withTime ? d.toLocaleString("es-PE") : d.toLocaleDateString("es-PE");
  } catch { return s; }
};
