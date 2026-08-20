import React, { useEffect, useState, useMemo } from "react";
import { useSearchParams } from "react-router-dom";
import {
  Loader2, Search, Building2, Truck, Fuel, ShieldCheck, FileText,
  Download, ArrowLeft, CheckCircle2, Clock, AlertCircle, Banknote, Lock,
  Pencil, Plus, Trash2, PlusCircle, X, ExternalLink, Upload,
} from "lucide-react";
import { api, API } from "../lib/api";

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
  // Expediente abierto persistido en la URL (?u=<userId>) para no perder el lugar al recargar.
  const [searchParams, setSearchParams] = useSearchParams();
  const selectedId = searchParams.get("u") || null;
  const setSelectedId = (id) => {
    const p = new URLSearchParams(searchParams);
    if (id) { p.set("u", id); } else { p.delete("u"); p.delete("tab"); }
    setSearchParams(p);
  };

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
    const ahorroRec = items.reduce((s, i) => s + ((i.galones_confirmados || 0) * 4), 0);
    return { total, submitted, ahorroEst, ahorroRec };
  }, [items]);

  const num = (v) => Number(v || 0).toLocaleString("es-PE", { maximumFractionDigits: 2 });

  const deleteExpediente = async (e, userId, empresa) => {
    e.stopPropagation();
    if (!window.confirm(`¿Estás seguro de que deseas eliminar permanentemente el expediente de ${empresa || 'este cliente'}? Esta acción no se puede deshacer y borrará documentos, facturas y configuraciones.`)) return;
    // Update optimista: quitamos el ítem de la lista al instante
    const prev = items;
    setItems((cur) => cur.filter((it) => it.user_id !== userId));
    try {
      const { data } = await api.delete(`/admin/subsidio/expedientes/${userId}`);
      // Refrescamos en segundo plano para confirmar
      load();
      if (data && data.deleted) {
        console.log("[deleteExpediente] borrado:", data.deleted);
      }
    } catch (err) {
      // Restauramos la lista si falló
      setItems(prev);
      alert(`Error al eliminar: ${err.response?.data?.detail || err.message}`);
    }
  };

  if (selectedId) {
    return <ExpedienteDetalle userId={selectedId} onBack={() => { setSelectedId(null); load(); }} />;
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
            <Kpi label="Ahorro recalculado" value={`S/ ${num(stats.ahorroRec)}`} color="emerald" />
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
                    <td className="px-4 py-3 text-right text-emerald-700 font-bold">S/ {num(it.galones_confirmados * 4)}</td>
                    <td className="px-4 py-3 text-center">
                      {it.declaracion_firmada ? <CheckCircle2 className="w-4 h-4 text-emerald-600 inline" /> : <Clock className="w-4 h-4 text-neutral-300 inline" />}
                    </td>
                    <td className="px-2 py-3 text-right whitespace-nowrap">
                      <button onClick={(e) => deleteExpediente(e, it.user_id, it.empresa || it.ruc)} className="text-red-500 hover:text-red-700 p-1 mr-2 transition-colors" title="Eliminar expediente">
                        <Trash2 className="w-4 h-4 inline" />
                      </button>
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
  // Pestaña activa persistida en la URL (?tab=) para no perder el lugar al recargar.
  const [tabParams, setTabParams] = useSearchParams();
  const tab = tabParams.get("tab") || "general";
  const setTab = (t) => {
    const p = new URLSearchParams(tabParams);
    p.set("tab", t);
    setTabParams(p);
  };
  const [savingStage, setSavingStage] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const { data } = await api.get(`/admin/subsidio/expedientes/${userId}`);
        setData(data);
      } finally { setLoading(false); }
    })();
  }, [userId]);

  const companyDocs = useMemo(() => {
    const docs = data?.documents || [];
    return docs.filter(d => ["ficha_ruc", "resolucion_autorizacion", "dni_representante"].includes(d.categoria || d.category));
  }, [data]);

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
  const deleteDoc = async (docId) => {
    if (!window.confirm("¿Estás seguro de que deseas eliminar este documento?")) return;
    try {
      await api.delete(`/admin/subsidio/documents/${docId}`);
      // Refresh the page data
      const { data: res } = await api.get(`/admin/subsidio/expedientes/${userId}`);
      setData(res);
    } catch (err) {
      alert(`Error al eliminar: ${err.response?.data?.detail || err.message}`);
    }
  };

  const deleteInvoice = async (invoiceId) => {
    if (!window.confirm("¿Estás seguro de que deseas eliminar esta factura? Esto la borrará del historial de combustible y descontará los galones.")) return;
    try {
      await api.delete(`/admin/subsidio/invoices/${invoiceId}`);
      // Refresh the page data
      const { data: res } = await api.get(`/admin/subsidio/expedientes/${userId}`);
      setData(res);
    } catch (err) {
      alert(`Error al eliminar: ${err.response?.data?.detail || err.message}`);
    }
  };

  const migrateToPlatform = async () => {
    if (!window.confirm("¿Confirmas la migración de este cliente a Empresas y Servicios (plataforma Enered)? Esto le dará rol de administrador y acceso total.")) return;
    try {
      await api.post(`/admin/subsidio/expedientes/${userId}/migrate`);
      alert("¡Cliente migrado exitosamente!");
      onBack(); // Go back to the list and reload
    } catch (err) {
      alert(`Error al migrar: ${err.response?.data?.detail || err.message}`);
    }
  };

  const tabs = [
    { id: "general", label: "Datos generales", icon: Building2 },
    { id: "banco", label: "Cuenta bancaria", icon: Banknote },
    { id: "documentos", label: `Documentos (${companyDocs.length})`, icon: FileText },
    { id: "flota", label: `Flota (${stats.vehicles_count})`, icon: Truck },
    { id: "facturas", label: `Facturas (${stats.invoices_confirmed}/${stats.invoices_confirmed + stats.invoices_draft})`, icon: Fuel },
    { id: "declaracion", label: "Declaración jurada", icon: ShieldCheck },
    { id: "editar", label: "Editar", icon: Pencil },
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
            <Kpi label="Ahorro recalculado" value={`S/ ${num(stats.galones_confirmados * 4)}`} color="emerald" />
            <Kpi label="Galones confirm." value={num(stats.galones_confirmados)} color="violet" />
            <button
              onClick={migrateToPlatform}
              className="px-4 py-2 bg-neutral-900 hover:bg-neutral-800 text-white text-sm font-bold rounded-lg transition-colors shadow-sm"
            >
              Migrar a Plataforma
            </button>
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
        {tab === "documentos" && <TabDocumentos docs={companyDocs} onDelete={deleteDoc} />}
        {tab === "flota" && <TabFlota vehicles={vehicles} docs={documents} onDelete={deleteDoc} />}
        {tab === "facturas" && <TabFacturas invoices={invoices} onDelete={deleteInvoice} />}
        {tab === "declaracion" && <TabDeclaracion declaracion={declaracion} />}
        {tab === "editar" && (
          <TabEditar
            user={user}
            vehicles={vehicles}
            invoices={invoices}
            documents={documents}
            onRefresh={async () => {
              const { data: res } = await api.get(`/admin/subsidio/expedientes/${userId}`);
              setData(res);
            }}
          />
        )}
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

function TabDocumentos({ docs, onDelete }) {
  if (!docs?.length) return <Empty msg="Sin documentos subidos." />;
  const API_BASE = process.env.REACT_APP_BACKEND_URL || "";
  const downloadHref = (id) => {
    const tk = localStorage.getItem("enered_token") || "";
    return `${API_BASE}/api/admin/subsidio/documents/${id}/download?t=${tk}`;
  };
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
            <td className="px-4 py-2 text-xs">{fmtDate(d.uploaded_at || d.created_at)}</td>
            <td className="px-2 py-2 text-right">
              <div className="flex items-center justify-end gap-3">
                <a href={downloadHref(d.id)} target="_blank" rel="noreferrer"
                   className="text-brand hover:text-brand-hover text-xs font-bold inline-flex items-center gap-1"
                   data-testid={`doc-download-${d.id}`}>
                  <Download className="w-3.5 h-3.5" /> Descargar
                </a>
                {onDelete && (
                  <button
                    onClick={() => onDelete(d.id)}
                    className="text-red-600 hover:text-red-700 text-xs font-bold inline-flex items-center gap-1 border border-red-200 hover:border-red-300 rounded px-2.5 py-1 bg-red-50 hover:bg-red-100/50 transition-colors"
                  >
                    Eliminar
                  </button>
                )}
              </div>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function TabFlota({ vehicles, docs = [], onDelete }) {
  if (!vehicles?.length) return <Empty msg="Sin unidades registradas." />;
  const API_BASE = process.env.REACT_APP_BACKEND_URL || "";
  const downloadHref = (id) => {
    const tk = localStorage.getItem("enered_token") || "";
    return `${API_BASE}/api/admin/subsidio/documents/${id}/download?t=${tk}`;
  };

  return (
    <table className="w-full text-sm">
      <thead className="bg-neutral-50 text-[10px] uppercase tracking-widest font-bold text-neutral-500 border-b">
        <tr>
          <th className="text-left px-4 py-2">Placa</th>
          <th className="text-left px-4 py-2">Categoría</th>
          <th className="text-left px-4 py-2">Registrada</th>
          <th className="text-left px-4 py-2">Tarjeta Habilitación</th>
          <th className="text-left px-4 py-2">Tarjeta Propiedad</th>
        </tr>
      </thead>
      <tbody className="divide-y divide-neutral-100">
        {vehicles.map((v) => {
          const docHabil = docs.find(
            (d) => d.placa?.toUpperCase() === v.placa?.toUpperCase() && (d.categoria || d.category) === "tarjeta_habilitacion"
          );
          const docProp = docs.find(
            (d) => d.placa?.toUpperCase() === v.placa?.toUpperCase() && (d.categoria || d.category) === "tarjeta_propiedad"
          );

          return (
            <tr key={v.placa}>
              <td className="px-4 py-2 font-mono font-bold">{v.placa}</td>
              <td className="px-4 py-2">
                <span className="px-2 py-0.5 bg-neutral-100 rounded text-xs font-bold">{v.categoria}</span>
              </td>
              <td className="px-4 py-2 text-xs">{fmtDate(v.created_at)}</td>
              <td className="px-4 py-2 text-xs">
                {docHabil ? (
                  <div className="flex items-center gap-2">
                    <a
                      href={downloadHref(docHabil.id)}
                      target="_blank"
                      rel="noreferrer"
                      className="text-brand hover:text-brand-hover font-bold inline-flex items-center gap-1"
                      data-testid={`vehicle-habil-${v.placa}`}
                    >
                      <Download className="w-3.5 h-3.5" /> Descargar
                    </a>
                    {onDelete && (
                      <button
                        onClick={() => onDelete(docHabil.id)}
                        className="text-red-600 hover:text-red-700 font-bold border border-red-200 hover:border-red-300 rounded px-1.5 py-0.5 bg-red-50 hover:bg-red-100/50 transition-colors text-[10px]"
                      >
                        Eliminar
                      </button>
                    )}
                  </div>
                ) : (
                  <span className="text-neutral-400">—</span>
                )}
              </td>
              <td className="px-4 py-2 text-xs">
                {docProp ? (
                  <div className="flex items-center gap-2">
                    <a
                      href={downloadHref(docProp.id)}
                      target="_blank"
                      rel="noreferrer"
                      className="text-brand hover:text-brand-hover font-bold inline-flex items-center gap-1"
                      data-testid={`vehicle-prop-${v.placa}`}
                    >
                      <Download className="w-3.5 h-3.5" /> Descargar
                    </a>
                    {onDelete && (
                      <button
                        onClick={() => onDelete(docProp.id)}
                        className="text-red-600 hover:text-red-700 font-bold border border-red-200 hover:border-red-300 rounded px-1.5 py-0.5 bg-red-50 hover:bg-red-100/50 transition-colors text-[10px]"
                      >
                        Eliminar
                      </button>
                    )}
                  </div>
                ) : (
                  <span className="text-neutral-400">—</span>
                )}
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}

function TabFacturas({ invoices, onDelete }) {
  if (!invoices?.length) return <Empty msg="Sin facturas cargadas." />;
  const API_BASE = process.env.REACT_APP_BACKEND_URL || "";
  const downloadHref = (id) => {
    const tk = localStorage.getItem("enered_token") || "";
    return `${API_BASE}/api/admin/subsidio/invoices/${id}/download?t=${tk}`;
  };

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
            <th className="text-center px-3 py-2">Acciones</th>
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
              <td className="px-3 py-1.5 text-center whitespace-nowrap">
                <div className="flex items-center justify-center gap-2">
                  {i.factura_filename ? (
                    <a
                      href={downloadHref(i.id)}
                      target="_blank"
                      rel="noreferrer"
                      className="text-brand hover:text-brand-hover font-bold inline-flex items-center gap-0.5 text-[11px]"
                    >
                      <Download className="w-3 h-3" /> Descargar
                    </a>
                  ) : (
                    <span className="text-neutral-400 text-[11px]">—</span>
                  )}
                  {onDelete && (
                    <button
                      onClick={() => onDelete(i.id)}
                      className="text-red-600 hover:text-red-700 font-bold border border-red-200 hover:border-red-300 rounded px-1.5 py-0.5 bg-red-50 hover:bg-red-100/50 transition-colors text-[10px]"
                    >
                      Eliminar
                    </button>
                  )}
                </div>
              </td>
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
    const isDateOnly = typeof s === 'string' && s.length === 10 && s.includes('-');
    const dateStr = isDateOnly ? s + "T12:00:00" : s;
    const d = new Date(dateStr);
    return withTime ? d.toLocaleString("es-PE") : d.toLocaleDateString("es-PE");
  } catch { return s; }
};


/* ============================================================ */
/* TAB EDITAR (EDICIÓN MANUAL)                                   */
/* ============================================================ */
function TabEditar({ user, vehicles, invoices, documents = [], onRefresh }) {
  // Archivos ORIGINALES que subió el cliente, en cualquier formato y por cualquier vía:
  // (a) documentos "comprobante_*" del expediente, y (b) facturas subidas con archivo real
  // (fotos/PDFs individuales). Sirven para cotejar una factura digitada a mano.
  const comprobantesCliente = documents.filter((d) => (d.categoria || "").startsWith("comprobante"));
  const facturasConArchivo = (invoices || []).filter(
    (i) => i.factura_storage_key || (i.factura_filename && !String(i.factura_filename).startsWith("manual_entry"))
  );
  // Previsualizar un archivo del cliente en el visor del panel (en vez de abrir otra pestaña).
  const [previewUrl, setPreviewUrl] = useState(null);

  // Vincula el archivo del cliente a la factura que se está editando (quedará como SU archivo).
  const vincularArchivo = async (invoiceId, origen) => {
    if (!window.confirm("¿Usar este archivo como el documento de esta factura? El visor lo mostrará siempre.")) return;
    try {
      await api.put(`/admin/subsidio/invoices/${invoiceId}/usar-archivo`, origen);
      setPreviewUrl(null);
      await onRefresh?.();
      alert("✅ Archivo vinculado a la factura.");
    } catch (e) {
      alert("Error: " + (e?.response?.data?.detail || e.message));
    }
  };
  const [subTab, setSubTab] = useState("empresa");

  // REPRESENTANTE STATE
  const [representante, setRepresentante] = useState(user.contacto || user.name || "");
  const [savingRep, setSavingRep] = useState(false);

  // VEHICLES STATE
  const [editingVehicle, setEditingVehicle] = useState(null);
  const [showVehicleForm, setShowVehicleForm] = useState(false);
  const [vehPlaca, setVehPlaca] = useState("");
  const [vehCategoria, setVehCategoria] = useState("M2");
  const [vehAnio, setVehAnio] = useState("");
  const [vehDesde, setVehDesde] = useState("");
  const [vehHasta, setVehHasta] = useState("");
  const [savingVeh, setSavingVeh] = useState(false);

  // INVOICES STATE
  const [editingInvoice, setEditingInvoice] = useState(null);
  const [showInvoiceForm, setShowInvoiceForm] = useState(false);
  const [invNumero, setInvNumero] = useState("");
  const [invFecha, setInvFecha] = useState("");
  const [invEstacion, setInvEstacion] = useState("");
  const [invRuc, setInvRuc] = useState("");
  const [invCiudad, setInvCiudad] = useState("");
  const [invPlaca, setInvPlaca] = useState("");
  const [invGalones, setInvGalones] = useState("");
  const [invPrecio, setInvPrecio] = useState("");
  const [invImporte, setInvImporte] = useState("");
  const [invProducto, setInvProducto] = useState("DIESEL B5");
  const [invIgv, setInvIgv] = useState(false);
  const [savingInv, setSavingInv] = useState(false);
  // Declarar factura como inválida (no se borra, solo se marca con motivo)
  const [invInvalida, setInvInvalida] = useState(false);
  const [invMotivos, setInvMotivos] = useState([]);
  const [invMotivoOtros, setInvMotivoOtros] = useState("");
  const toggleMotivo = (key) => {
    setInvMotivos((prev) => prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]);
  };

  // Checkbox "Agregar IGV (18%)": multiplica el precio unitario × 1.18 (o ÷ al desmarcar).
  // El Importe Total se recalcula solo (galones × precio) por el useEffect de arriba.
  const toggleIgv = (checked) => {
    setInvIgv(checked);
    const p = parseFloat(invPrecio);
    if (!isNaN(p) && p > 0) {
      setInvPrecio((checked ? p * 1.18 : p / 1.18).toFixed(4));
    }
  };

  // Auto-calculate Importe Total
  useEffect(() => {
    if (invGalones && invPrecio) {
      const g = parseFloat(invGalones);
      const p = parseFloat(invPrecio);
      if (!isNaN(g) && !isNaN(p)) {
        setInvImporte((g * p).toFixed(2));
      }
    }
  }, [invGalones, invPrecio]);

  // Auto-fetch Razón Social from SUNAT
  useEffect(() => {
    const ruc = invRuc.trim();
    if (ruc.length === 11) {
      api.get(`/sunat/ruc/${ruc}`).then(res => {
        if (res.data && res.data.razonSocial) {
          setInvEstacion(res.data.razonSocial);
        } else if (res.data && res.data.razon_social) {
          setInvEstacion(res.data.razon_social);
        } else if (res.data && res.data.nombre) {
          setInvEstacion(res.data.nombre);
        }
      }).catch(() => {});
    }
  }, [invRuc]);

  const saveRepresentante = async (e) => {
    e.preventDefault();
    if (!representante.trim()) return alert("El nombre del representante no puede estar vacío.");
    setSavingRep(true);
    try {
      await api.put(`/admin/subsidio/expedientes/${user.id}/representante`, { representante: representante.trim() });
      alert("Representante legal actualizado con éxito.");
      onRefresh();
    } catch (err) {
      alert(`Error al guardar: ${err.response?.data?.detail || err.message}`);
    } finally {
      setSavingRep(false);
    }
  };

  const startAddVehicle = () => {
    setEditingVehicle(null);
    setVehPlaca("");
    setVehCategoria("M2");
    setVehAnio("");
    setVehDesde("");
    setVehHasta("");
    setShowVehicleForm(true);
  };

  const startEditVehicle = (v) => {
    setEditingVehicle(v);
    setVehPlaca(v.placa || "");
    setVehCategoria(v.categoria || "M2");
    setVehAnio(v.anio_fabricacion || "");
    setVehDesde(v.vigente_desde || "");
    setVehHasta(v.vigente_hasta || "");
    setShowVehicleForm(true);
  };

  const saveVehicle = async (e) => {
    e.preventDefault();
    if (!vehPlaca.trim()) return alert("La placa es obligatoria.");
    setSavingVeh(true);
    try {
      const payload = {
        placa: vehPlaca.trim().toUpperCase(),
        categoria: vehCategoria,
        anio_fabricacion: vehAnio ? Number(vehAnio) : null,
        vigente_desde: vehDesde || null,
        vigente_hasta: vehHasta || null,
      };

      if (editingVehicle) {
        await api.put(`/admin/subsidio/expedientes/${user.id}/vehicles/${editingVehicle.id}`, payload);
      } else {
        await api.post(`/admin/subsidio/expedientes/${user.id}/vehicles`, payload);
      }
      alert("Vehículo guardado correctamente.");
      setShowVehicleForm(false);
      onRefresh();
    } catch (err) {
      alert(`Error al guardar vehículo: ${err.response?.data?.detail || err.message}`);
    } finally {
      setSavingVeh(false);
    }
  };

  const deleteVehicle = async (id) => {
    if (!window.confirm("¿Seguro de que deseas eliminar esta placa? Se borrarán también los documentos asociados.")) return;
    try {
      await api.delete(`/admin/subsidio/expedientes/${user.id}/vehicles/${id}`);
      alert("Vehículo eliminado.");
      onRefresh();
    } catch (err) {
      alert(`Error al eliminar vehículo: ${err.response?.data?.detail || err.message}`);
    }
  };

  const startAddInvoice = () => {
    setEditingInvoice(null);
    setInvNumero("");
    setInvFecha("");
    setInvEstacion("");
    setInvRuc("");
    setInvCiudad("");
    setInvPlaca(vehicles[0]?.placa || "");
    setInvGalones("");
    setInvPrecio("");
    setInvImporte("");
    setInvProducto("DIESEL B5");
    setInvIgv(false);
    setInvInvalida(false);
    setInvMotivos([]);
    setInvMotivoOtros("");
    setShowInvoiceForm(true);
  };

  const toIsoDate = (d) => {
    if (!d) return "";
    let str = String(d).trim();
    if (str.length > 10 && str.includes("T")) str = str.split("T")[0];
    if (str.includes("/")) {
      const parts = str.split("/");
      if (parts.length === 3 && parts[2].length === 4) {
        return `${parts[2]}-${parts[1].padStart(2, '0')}-${parts[0].padStart(2, '0')}`;
      }
    }
    return str.slice(0, 10);
  };

  const startEditInvoice = (inv) => {
    setEditingInvoice(inv);
    setInvNumero(inv.numero_documento || inv.n_doc || "");
    setInvFecha(toIsoDate(inv.fecha || inv.f_emision || ""));
    setInvEstacion(inv.estacion || "");
    setInvRuc(inv.ruc_emisor || "");
    setInvCiudad(inv.ciudad || "");
    setInvPlaca(inv.placa || "");
    setInvGalones(inv.galones || "");
    setInvPrecio(inv.precio_unitario || "");
    setInvImporte(inv.importe_total || inv.monto_total || "");
    setInvProducto(inv.producto || "DIESEL B5");
    setInvIgv(false);
    setInvInvalida(!!inv.invalida);
    setInvMotivos(inv.motivos_invalidez || []);
    setInvMotivoOtros(inv.motivo_invalidez_otros || "");
    setShowInvoiceForm(true);
  };

  const saveInvoice = async (e) => {
    e.preventDefault();
    // Al declarar inválida no exigimos los campos (ej. motivo "sin placa"), pero sí un motivo.
    if (invInvalida) {
      if (invMotivos.length === 0) return alert("Selecciona al menos un motivo de invalidez.");
      if (invMotivos.includes("otros") && !invMotivoOtros.trim()) return alert("Especifica el motivo en 'Otros'.");
    } else if (!invNumero.trim() || !invFecha || !invPlaca) {
      return alert("Número, fecha y placa son campos obligatorios.");
    }
    setSavingInv(true);
    try {
      const payload = {
        numero_documento: invNumero.trim(),
        fecha: invFecha,
        estacion: invEstacion.trim(),
        ruc_emisor: invRuc.trim(),
        ciudad: invCiudad.trim(),
        placa: invPlaca.trim().toUpperCase(),
        galones: Number(invGalones || 0),
        precio_unitario: Number(invPrecio || 0),
        importe_total: Number(invImporte || 0),
        producto: invProducto,
        invalida: invInvalida,
        motivos_invalidez: invInvalida ? invMotivos : [],
        motivo_invalidez_otros: invInvalida && invMotivos.includes("otros") ? invMotivoOtros.trim() : "",
      };

      if (editingInvoice) {
        await api.put(`/admin/subsidio/expedientes/${user.id}/invoices/${editingInvoice.id}`, payload);
      } else {
        await api.post(`/admin/subsidio/expedientes/${user.id}/invoices`, payload);
      }
      
      // En lugar de ocultar el form y correr el riesgo de perder foco o estado, 
      // limpiamos los campos si es nueva factura, o simplemente refrescamos.
      alert("Factura guardada correctamente.");
      
      if (!editingInvoice) {
        setInvNumero("");
        setInvFecha("");
        setInvGalones("");
        setInvPrecio("");
        setInvImporte("");
      }
      
      await onRefresh();
    } catch (err) {
      alert(`Error al guardar factura: ${err.response?.data?.detail || err.message}`);
    } finally {
      setSavingInv(false);
    }
  };

  const deleteInvoice = async (id) => {
    if (!window.confirm("¿Seguro de que deseas eliminar esta factura?")) return;
    try {
      await api.delete(`/admin/subsidio/invoices/${id}`);
      alert("Factura eliminada.");
      onRefresh();
    } catch (err) {
      alert(`Error al eliminar factura: ${err.response?.data?.detail || err.message}`);
    }
  };

  return (
    <div className="space-y-6" data-testid="tab-editar-panel">
      {/* Sub-tabs header */}
      <div className="flex gap-2 border-b border-neutral-100 pb-3">
        <button
          onClick={() => { setSubTab("empresa"); setShowVehicleForm(false); setShowInvoiceForm(false); }}
          className={`px-4 py-2 text-xs font-bold rounded-lg border transition-all ${
            subTab === "empresa" ? "bg-brand text-white border-brand shadow-sm" : "bg-neutral-50 border-neutral-200 text-neutral-600 hover:bg-neutral-100"
          }`}
        >
          Empresa
        </button>
        <button
          onClick={() => { setSubTab("placas"); setShowVehicleForm(false); setShowInvoiceForm(false); }}
          className={`px-4 py-2 text-xs font-bold rounded-lg border transition-all ${
            subTab === "placas" ? "bg-brand text-white border-brand shadow-sm" : "bg-neutral-50 border-neutral-200 text-neutral-600 hover:bg-neutral-100"
          }`}
        >
          Placas (Flota)
        </button>
        <button
          onClick={() => { setSubTab("facturas"); setShowVehicleForm(false); setShowInvoiceForm(false); }}
          className={`px-4 py-2 text-xs font-bold rounded-lg border transition-all ${
            subTab === "facturas" ? "bg-brand text-white border-brand shadow-sm" : "bg-neutral-50 border-neutral-200 text-neutral-600 hover:bg-neutral-100"
          }`}
        >
          Facturas
        </button>
      </div>

      {/* Sub-tab content */}
      <div className="mt-4">
        {/* SUBTAB EMPRESA */}
        {subTab === "empresa" && (
          <div className="max-w-xl space-y-4">
            <div>
              <h4 className="font-cabinet text-lg font-bold text-neutral-900">Representante Legal</h4>
              <p className="text-xs text-neutral-500 mt-1">Escribe o edita manualmente el nombre del representante legal asociado a este expediente.</p>
            </div>
            <form onSubmit={saveRepresentante} className="space-y-3">
              <div className="space-y-1">
                <label className="text-xs font-bold text-neutral-600">Nombre del Representante</label>
                <input
                  type="text"
                  value={representante}
                  onChange={(e) => setRepresentante(e.target.value)}
                  className="w-full h-10 px-3 border border-neutral-300 rounded-lg text-sm"
                  placeholder="Ej. Juan Pérez"
                />
              </div>
              <button
                type="submit"
                disabled={savingRep}
                className="h-10 px-4 bg-brand hover:bg-brand-hover text-white font-bold rounded-lg text-xs flex items-center justify-center gap-1.5 shadow-sm"
              >
                {savingRep ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : null}
                Guardar Representante
              </button>
            </form>
          </div>
        )}

        {/* SUBTAB PLACAS */}
        {subTab === "placas" && (
          <div className="space-y-4">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <div>
                <h4 className="font-cabinet text-lg font-bold text-neutral-900">Control de Placas (Flota)</h4>
                <p className="text-xs text-neutral-500 mt-1">Administra las unidades autorizadas de la empresa.</p>
              </div>
              {!showVehicleForm && (
                <button
                  onClick={startAddVehicle}
                  className="h-9 px-3 bg-brand hover:bg-brand-hover text-white font-bold rounded-lg text-xs flex items-center gap-1 shadow-sm"
                >
                  <Plus className="w-3.5 h-3.5" /> Agregar Placa
                </button>
              )}
            </div>

            {showVehicleForm && (
              <div className="bg-neutral-50 border border-neutral-200 rounded-xl p-5 max-w-2xl space-y-4">
                <div className="flex items-center justify-between border-b border-neutral-200 pb-2">
                  <h5 className="font-bold text-sm text-neutral-950">{editingVehicle ? "Editar Placa" : "Agregar Nueva Placa"}</h5>
                  <button onClick={() => setShowVehicleForm(false)} className="text-neutral-400 hover:text-neutral-600">
                    <X className="w-4 h-4" />
                  </button>
                </div>
                <form onSubmit={saveVehicle} className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-neutral-600">Placa *</label>
                    <input
                      type="text"
                      required
                      value={vehPlaca}
                      onChange={(e) => setVehPlaca(e.target.value)}
                      placeholder="Ej. ABC-123"
                      className="w-full h-10 px-3 border border-neutral-300 rounded-lg text-sm uppercase"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-neutral-600">Categoría *</label>
                    <select
                      value={vehCategoria}
                      onChange={(e) => setVehCategoria(e.target.value)}
                      className="w-full h-10 px-3 border border-neutral-300 rounded-lg text-sm bg-white"
                    >
                      <option value="M2">M2</option>
                      <option value="M3">M3</option>
                      <option value="N1">N1</option>
                      <option value="N2">N2</option>
                      <option value="N3">N3</option>
                    </select>
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-neutral-600">Año de Fabricación</label>
                    <input
                      type="number"
                      value={vehAnio}
                      onChange={(e) => setVehAnio(e.target.value)}
                      placeholder="Ej. 2020"
                      className="w-full h-10 px-3 border border-neutral-300 rounded-lg text-sm"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-neutral-600">Vigente Desde</label>
                    <input
                      type="date"
                      value={vehDesde}
                      onChange={(e) => setVehDesde(e.target.value)}
                      className="w-full h-10 px-3 border border-neutral-300 rounded-lg text-sm"
                    />
                  </div>
                  <div className="space-y-1 md:col-span-2">
                    <label className="text-xs font-bold text-neutral-600">Vigente Hasta</label>
                    <input
                      type="date"
                      value={vehHasta}
                      onChange={(e) => setVehHasta(e.target.value)}
                      className="w-full h-10 px-3 border border-neutral-300 rounded-lg text-sm"
                    />
                  </div>
                  <div className="md:col-span-2 flex justify-end gap-2 pt-2">
                    <button
                      type="button"
                      onClick={() => setShowVehicleForm(false)}
                      className="h-10 px-4 bg-white border border-neutral-300 hover:bg-neutral-50 font-bold rounded-lg text-xs"
                    >
                      Cancelar
                    </button>
                    <button
                      type="submit"
                      disabled={savingVeh}
                      className="h-10 px-4 bg-brand hover:bg-brand-hover text-white font-bold rounded-lg text-xs flex items-center justify-center gap-1.5 shadow-sm"
                    >
                      {savingVeh ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : null}
                      Guardar Placa
                    </button>
                  </div>
                </form>
              </div>
            )}

            <div className="border border-neutral-200 rounded-xl overflow-hidden shadow-sm">
              <table className="w-full text-xs">
                <thead className="bg-neutral-50 border-b border-neutral-200 text-neutral-500 uppercase tracking-widest font-bold">
                  <tr>
                    <th className="text-left px-4 py-3">Placa</th>
                    <th className="text-left px-4 py-3">Categoría</th>
                    <th className="text-left px-4 py-3">Año Fab.</th>
                    <th className="text-left px-4 py-3">Vigente Desde</th>
                    <th className="text-left px-4 py-3">Vigente Hasta</th>
                    <th className="text-center px-4 py-3">Acciones</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-100 bg-white">
                  {vehicles.length === 0 ? (
                    <tr><td colSpan="6" className="py-8 text-center text-neutral-500">No hay vehículos registrados.</td></tr>
                  ) : (
                    vehicles.map((v) => (
                      <tr key={v.id || v.placa} className="hover:bg-neutral-50/50">
                        <td className="px-4 py-3 font-mono font-bold text-neutral-900">{v.placa}</td>
                        <td className="px-4 py-3 font-bold text-neutral-800">{v.categoria}</td>
                        <td className="px-4 py-3 text-neutral-700">{v.anio_fabricacion || "—"}</td>
                        <td className="px-4 py-3 text-neutral-700">{v.vigente_desde ? fmtDate(v.vigente_desde) : "—"}</td>
                        <td className="px-4 py-3 text-neutral-700">{v.vigente_hasta ? fmtDate(v.vigente_hasta) : "—"}</td>
                        <td className="px-4 py-3 text-center">
                          <div className="flex justify-center gap-2">
                            <button
                              onClick={() => startEditVehicle(v)}
                              className="px-2.5 py-1 text-xs border border-neutral-200 hover:border-neutral-300 bg-neutral-50 text-neutral-700 font-bold rounded flex items-center gap-1 transition-colors"
                            >
                              <Pencil className="w-3 h-3 text-neutral-500" /> Editar
                            </button>
                            <button
                              onClick={() => deleteVehicle(v.id)}
                              className="px-2.5 py-1 text-xs border border-red-200 hover:border-red-300 bg-red-50 text-red-700 font-bold rounded flex items-center gap-1 transition-colors"
                            >
                              <Trash2 className="w-3 h-3" /> Eliminar
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* SUBTAB FACTURAS */}
        {subTab === "facturas" && (
          <div className="space-y-4">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <div>
                <h4 className="font-cabinet text-lg font-bold text-neutral-900">Control de Facturas de Combustible</h4>
                <p className="text-xs text-neutral-500 mt-1">Registra o edita consumos de combustible manualmente.</p>
              </div>
              {!showInvoiceForm && (
                <button
                  onClick={startAddInvoice}
                  className="h-9 px-3 bg-brand hover:bg-brand-hover text-white font-bold rounded-lg text-xs flex items-center gap-1 shadow-sm"
                >
                  <Plus className="w-3.5 h-3.5" /> Agregar Factura Manual
                </button>
              )}
            </div>

            {showInvoiceForm && (
              <div className="bg-neutral-50 border border-neutral-200 rounded-xl p-5 w-full space-y-4">
                <div className="flex items-center justify-between border-b border-neutral-200 pb-2">
                  <h5 className="font-bold text-sm text-neutral-950">{editingInvoice ? "Editar Factura" : "Agregar Nueva Factura Manual"}</h5>
                  <button onClick={() => setShowInvoiceForm(false)} className="text-neutral-400 hover:text-neutral-600">
                    <X className="w-4 h-4" />
                  </button>
                </div>
                
                <div className={`grid gap-6 ${editingInvoice?.factura_filename || editingInvoice?.pdf_filename || editingInvoice?.factura_storage_key ? "grid-cols-1 lg:grid-cols-2" : "grid-cols-1 max-w-3xl"}`}>
                  {/* Formulario */}
                  <form onSubmit={saveInvoice} className="grid grid-cols-1 md:grid-cols-3 gap-4 h-min">
                    <div className="space-y-1">
                      <label className="text-xs font-bold text-neutral-600">Número de Factura *</label>
                      <input
                        type="text"
                        required
                        value={invNumero}
                        onChange={(e) => setInvNumero(e.target.value)}
                        placeholder="Ej. F001-12345"
                        className="w-full h-10 px-3 border border-neutral-300 rounded-lg text-sm font-mono uppercase"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-xs font-bold text-neutral-600">Fecha de Emisión *</label>
                      <input
                        type="date"
                        required
                        value={invFecha}
                        onChange={(e) => setInvFecha(e.target.value)}
                        className="w-full h-10 px-3 border border-neutral-300 rounded-lg text-sm"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-xs font-bold text-neutral-600">Placa Vehículo *</label>
                      <select
                        value={invPlaca}
                        required
                        onChange={(e) => setInvPlaca(e.target.value)}
                        className="w-full h-10 px-3 border border-neutral-300 rounded-lg text-sm bg-white font-mono"
                      >
                        <option value="">Selecciona placa...</option>
                        {vehicles.map((v) => (
                          <option key={v.placa} value={v.placa}>{v.placa} ({v.categoria})</option>
                        ))}
                      </select>
                    </div>
                    <div className="space-y-1">
                      <label className="text-xs font-bold text-neutral-600">Proveedor (Razón Social)</label>
                      <input
                        type="text"
                        value={invEstacion}
                        onChange={(e) => setInvEstacion(e.target.value)}
                        placeholder="Ej. GRIFO PRIMAX S.A."
                        className="w-full h-10 px-3 border border-neutral-300 rounded-lg text-sm"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-xs font-bold text-neutral-600">RUC Proveedor</label>
                      <input
                        type="text"
                        value={invRuc}
                        onChange={(e) => setInvRuc(e.target.value)}
                        placeholder="Ej. 20601234567"
                        maxLength="11"
                        className="w-full h-10 px-3 border border-neutral-300 rounded-lg text-sm"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-xs font-bold text-neutral-600">Ciudad</label>
                      <input
                        type="text"
                        value={invCiudad}
                        onChange={(e) => setInvCiudad(e.target.value)}
                        placeholder="Ej. Lima"
                        className="w-full h-10 px-3 border border-neutral-300 rounded-lg text-sm"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-xs font-bold text-neutral-600">Combustible</label>
                      <select
                        value={invProducto}
                        onChange={(e) => setInvProducto(e.target.value)}
                        className="w-full h-10 px-3 border border-neutral-300 rounded-lg text-sm bg-white"
                      >
                        <option value="DIESEL B5">DIESEL B5</option>
                        <option value="DIESEL B20">DIESEL B20</option>
                        <option value="GASOHOL 90">GASOHOL 90</option>
                        <option value="GASOHOL 95">GASOHOL 95</option>
                        <option value="GASOHOL 97">GASOHOL 97</option>
                      </select>
                    </div>
                    <div className="space-y-1">
                      <label className="text-xs font-bold text-neutral-600">Cantidad (Galones)</label>
                      <input
                        type="number"
                        step="any"
                        value={invGalones}
                        onChange={(e) => setInvGalones(e.target.value)}
                        placeholder="0.00"
                        className="w-full h-10 px-3 border border-neutral-300 rounded-lg text-sm font-bold"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-xs font-bold text-neutral-600">Precio Unitario (S/)</label>
                      <input
                        type="number"
                        step="any"
                        value={invPrecio}
                        onChange={(e) => setInvPrecio(e.target.value)}
                        placeholder="0.00"
                        className="w-full h-10 px-3 border border-neutral-300 rounded-lg text-sm"
                      />
                      <label className="flex items-center gap-1.5 mt-1 text-[11px] font-medium text-neutral-600 cursor-pointer select-none">
                        <input
                          type="checkbox"
                          checked={invIgv}
                          onChange={(e) => toggleIgv(e.target.checked)}
                          className="accent-brand w-3.5 h-3.5"
                        />
                        Agregar IGV (18%)
                      </label>
                    </div>
                    <div className="space-y-1 md:col-span-3">
                      <label className="text-xs font-bold text-neutral-600">Importe Total (S/)</label>
                      <input
                        type="number"
                        step="any"
                        value={invImporte}
                        onChange={(e) => setInvImporte(e.target.value)}
                        placeholder="0.00"
                        className="w-full h-10 px-3 border border-neutral-300 rounded-lg text-sm font-bold text-brand"
                      />
                    </div>

                    {/* Declarar factura como inválida (no se borra, solo se marca) */}
                    <div className="md:col-span-3 border-t border-neutral-200 pt-3 mt-1">
                      <label className="flex items-center gap-2 text-sm font-bold text-neutral-700 cursor-pointer select-none">
                        <input
                          type="checkbox"
                          checked={invInvalida}
                          onChange={(e) => setInvInvalida(e.target.checked)}
                          className="accent-red-600 w-4 h-4"
                          data-testid="inv-invalida-toggle"
                        />
                        Declarar factura como inválida
                      </label>
                      {invInvalida && (
                        <div className="mt-2 bg-red-50 border border-red-200 rounded-lg p-3 space-y-2">
                          <p className="text-[11px] font-bold text-red-700 uppercase tracking-wide">Motivo (marca uno o más)</p>
                          <div className="flex flex-wrap gap-3">
                            {[
                              { key: "tipo_combustible", label: "Tipo de combustible" },
                              { key: "sin_placa", label: "Sin placa" },
                              { key: "otros", label: "Otros" },
                            ].map((m) => (
                              <label key={m.key} className="flex items-center gap-1.5 text-xs font-medium text-neutral-700 cursor-pointer select-none">
                                <input
                                  type="checkbox"
                                  checked={invMotivos.includes(m.key)}
                                  onChange={() => toggleMotivo(m.key)}
                                  className="accent-red-600 w-3.5 h-3.5"
                                  data-testid={`inv-motivo-${m.key}`}
                                />
                                {m.label}
                              </label>
                            ))}
                          </div>
                          {invMotivos.includes("otros") && (
                            <input
                              type="text"
                              value={invMotivoOtros}
                              onChange={(e) => setInvMotivoOtros(e.target.value)}
                              placeholder="Especifica el motivo…"
                              className="w-full h-9 px-3 border border-red-300 rounded-lg text-sm"
                              data-testid="inv-motivo-otros"
                            />
                          )}
                        </div>
                      )}
                    </div>

                    <div className="md:col-span-3 flex justify-end gap-2 pt-2">
                      <button
                        type="button"
                        onClick={() => setShowInvoiceForm(false)}
                        className="h-10 px-4 bg-white border border-neutral-300 hover:bg-neutral-50 font-bold rounded-lg text-xs"
                      >
                        Cancelar
                      </button>
                      <button
                        type="submit"
                        disabled={savingInv}
                        className="h-10 px-4 bg-brand hover:bg-brand-hover text-white font-bold rounded-lg text-xs flex items-center justify-center gap-1.5 shadow-sm"
                      >
                        {savingInv ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : null}
                        Guardar Factura
                      </button>
                    </div>
                  </form>

                  {/* Previsualización del PDF (o del archivo del cliente elegido abajo) */}
                  {(editingInvoice?.factura_filename || editingInvoice?.pdf_filename || editingInvoice?.factura_storage_key) && (
                    <div className="space-y-3">
                      <div className="bg-neutral-200 rounded-lg overflow-hidden border border-neutral-300 min-h-[420px] flex items-center justify-center">
                        <iframe
                          src={previewUrl || `${API}/admin/subsidio/invoices/${editingInvoice.id}/download?t=${localStorage.getItem("enered_token") || ""}`}
                          className="w-full h-full min-h-[420px] bg-white"
                          title="Previsualización de factura"
                        />
                      </div>
                      {previewUrl && (
                        <button onClick={() => setPreviewUrl(null)}
                          className="text-[11px] text-brand font-bold hover:underline">
                          ← Volver al registro de esta factura
                        </button>
                      )}
                      {/* Archivos originales del cliente (cualquier formato) para cotejar */}
                      {(comprobantesCliente.length > 0 || facturasConArchivo.length > 0) && (
                        <div className="bg-white border border-neutral-200 rounded-lg p-3">
                          <div className="text-[11px] font-bold text-neutral-600 uppercase tracking-wider mb-2">
                            Archivos subidos por el cliente ({comprobantesCliente.length + facturasConArchivo.length})
                          </div>
                          <div className="space-y-1.5 max-h-44 overflow-y-auto">
                            {comprobantesCliente.map((d) => {
                              const base = `${API}/admin/subsidio/documents/${d.id}/download?t=${localStorage.getItem("enered_token") || ""}`;
                              return (
                                <div key={d.id} className="flex items-center gap-2 text-xs">
                                  <span className="flex-1 truncate text-neutral-700">{d.filename || d.categoria}</span>
                                  <button onClick={() => setPreviewUrl(base)}
                                    className="text-brand font-bold hover:underline flex-shrink-0">Ver</button>
                                  <a href={`${base}&dl=1`}
                                    className="text-neutral-500 font-bold hover:underline flex-shrink-0">Descargar</a>
                                  <button onClick={() => vincularArchivo(editingInvoice.id, { doc_id: d.id })}
                                    className="text-emerald-600 font-bold hover:underline flex-shrink-0"
                                    title="Usar este archivo como el documento de esta factura">Vincular</button>
                                </div>
                              );
                            })}
                            {facturasConArchivo
                              .slice()
                              .sort((a, b) => {
                                // El archivo cuyo número coincide con la factura editada, primero.
                                const n = (editingInvoice?.numero_documento || "").toUpperCase();
                                const ma = n && (a.numero_documento || "").toUpperCase() === n ? 0 : 1;
                                const mb = n && (b.numero_documento || "").toUpperCase() === n ? 0 : 1;
                                return ma - mb;
                              })
                              .map((i) => {
                                const base = `${API}/admin/subsidio/invoices/${i.id}/download?t=${localStorage.getItem("enered_token") || ""}`;
                                const coincide = editingInvoice?.numero_documento &&
                                  (i.numero_documento || "").toUpperCase() === editingInvoice.numero_documento.toUpperCase() &&
                                  i.id !== editingInvoice.id;
                                return (
                                  <div key={i.id} className={`flex items-center gap-2 text-xs rounded px-1 ${coincide ? "bg-emerald-50 border border-emerald-200" : ""}`}>
                                    <span className="flex-1 truncate text-neutral-700">
                                      {coincide && <span className="text-emerald-700 font-bold">★ </span>}
                                      {i.factura_filename || i.numero_documento}
                                      <span className="text-neutral-400"> · {i.numero_documento || i.fecha || ""}</span>
                                    </span>
                                    <button onClick={() => setPreviewUrl(base)}
                                      className="text-brand font-bold hover:underline flex-shrink-0">Ver</button>
                                    <a href={`${base}&dl=1`}
                                      className="text-neutral-500 font-bold hover:underline flex-shrink-0">Descargar</a>
                                    {i.id !== editingInvoice?.id && (
                                      <button onClick={() => vincularArchivo(editingInvoice.id, { desde_invoice_id: i.id })}
                                        className="text-emerald-600 font-bold hover:underline flex-shrink-0"
                                        title="Usar este archivo como el documento de esta factura">Vincular</button>
                                    )}
                                  </div>
                                );
                              })}
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            )}

            <div className="border border-neutral-200 rounded-xl overflow-x-auto shadow-sm">
              <table className="w-full text-xs">
                <thead className="bg-neutral-50 border-b border-neutral-200 text-neutral-500 uppercase tracking-widest font-bold">
                  <tr>
                    <th className="text-left px-3 py-3">Estado</th>
                    <th className="text-left px-3 py-3">N° Factura</th>
                    <th className="text-left px-3 py-3">Fecha</th>
                    <th className="text-left px-3 py-3">Proveedor / RUC</th>
                    <th className="text-left px-3 py-3">Ciudad</th>
                    <th className="text-left px-3 py-3 font-mono">Placa</th>
                    <th className="text-left px-3 py-3">Combustible</th>
                    <th className="text-right px-3 py-3">Galones</th>
                    <th className="text-right px-3 py-3">P. Unitario</th>
                    <th className="text-right px-3 py-3">Importe</th>
                    <th className="text-center px-3 py-3">Acciones</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-100 bg-white">
                  {invoices.length === 0 ? (
                    <tr><td colSpan="11" className="py-8 text-center text-neutral-500">No hay facturas registradas.</td></tr>
                  ) : (
                    invoices.map((i) => (
                      <tr key={i.id} className="hover:bg-neutral-50/50" data-testid={`manual-invoice-row-${i.id}`}>
                        <td className="px-3 py-2 whitespace-nowrap">
                          <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${i.status === "confirmed" ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-700"}`}>
                            {i.status === "confirmed" ? "CONF" : "DRAFT"}
                          </span>
                        </td>
                        <td className="px-3 py-2 font-mono font-bold text-neutral-900">{i.numero_documento || "—"}</td>
                        <td className="px-3 py-2 text-neutral-700">{i.fecha ? fmtDate(i.fecha) : "—"}</td>
                        <td className="px-3 py-2">
                          <div className="font-bold text-neutral-800">{i.estacion || "—"}</div>
                          <div className="text-[10px] text-neutral-500 font-mono">{i.ruc_emisor}</div>
                        </td>
                        <td className="px-3 py-2 text-neutral-700">{i.ciudad || "—"}</td>
                        <td className="px-3 py-2 font-mono font-bold text-neutral-900">{i.placa || "—"}</td>
                        <td className="px-3 py-2 text-neutral-600">{i.producto || "—"}</td>
                        <td className="px-3 py-2 text-right font-bold text-neutral-800">{i.galones ?? "—"} GL</td>
                        <td className="px-3 py-2 text-right text-neutral-700">S/ {num(i.precio_unitario)}</td>
                        <td className="px-3 py-2 text-right font-bold text-brand">S/ {num(i.importe_total)}</td>
                        <td className="px-3 py-2 text-center">
                          <div className="flex justify-center gap-1 whitespace-nowrap">
                            <button
                              onClick={() => startEditInvoice(i)}
                              className="px-2 py-1 text-[11px] border border-neutral-200 hover:border-neutral-300 bg-neutral-50 text-neutral-700 font-bold rounded flex items-center gap-0.5 transition-colors"
                            >
                              <Pencil className="w-2.5 h-2.5 text-neutral-500" /> Editar
                            </button>
                            <button
                              onClick={() => deleteInvoice(i.id)}
                              className="px-2 py-1 text-[11px] border border-red-200 hover:border-red-300 bg-red-50 text-red-700 font-bold rounded flex items-center gap-0.5 transition-colors"
                            >
                              <Trash2 className="w-2.5 h-2.5" /> Borrar
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
