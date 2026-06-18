import React, { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  ArrowLeft,
  Plus,
  Trash2,
  Pencil,
  Truck,
  Fuel,
  Wallet,
  TrendingUp,
  CheckCircle2,
  Clock,
  FileCheck2,
  Send,
  AlertCircle,
  LogOut,
  Search,
  Download,
} from "lucide-react";
import {
  VEHICLE_CATEGORIES,
  calculateSubsidy,
  formatSoles,
  formatSolesInt,
  formatGalones,
  MESES,
  SUBSIDIO_GL,
} from "../lib/calculatorData";

// ---------- Storage helpers ----------
const STORAGE_KEY = "enered_client_session";

const loadClient = () => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch {
    return null;
  }
};

const saveClient = (data) => {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
};

// ---------- Trámite stages ----------
const TRAMITE_STAGES = [
  { id: "registro", label: "Registro de flota", icon: Truck },
  { id: "documentos", label: "Documentos cargados", icon: FileCheck2 },
  { id: "presentado", label: "Solicitud presentada", icon: Send },
  { id: "aprobado", label: "Aprobado por MTC", icon: CheckCircle2 },
  { id: "pagado", label: "Devolución pagada", icon: Wallet },
];

// ---------- Sub-components ----------
const KpiCard = ({ icon: Icon, label, value, sub, tone = "brand", testId }) => {
  const tones = {
    brand: "from-brand-50 to-white text-brand border-brand-100",
    emerald: "from-emerald-50 to-white text-emerald-700 border-emerald-100",
    amber: "from-amber-50 to-white text-amber-700 border-amber-100",
    sky: "from-sky-50 to-white text-sky-700 border-sky-100",
  };
  return (
    <div
      data-testid={testId}
      className={`rounded-2xl border bg-gradient-to-br ${tones[tone]} p-5 transition hover:shadow-lg hover:-translate-y-0.5`}
    >
      <div className="flex items-start justify-between mb-3">
        <div className="h-10 w-10 rounded-xl bg-white/80 grid place-items-center shadow-sm">
          <Icon className="h-5 w-5" />
        </div>
      </div>
      <div className="text-xs font-semibold uppercase tracking-wider text-neutral-500 mb-1">
        {label}
      </div>
      <div className="text-2xl font-extrabold font-cabinet text-neutral-900 leading-tight">
        {value}
      </div>
      {sub && <div className="text-xs text-neutral-500 mt-1">{sub}</div>}
    </div>
  );
};

const StatusBadge = ({ status }) => {
  const map = {
    activo: { text: "Activo", cls: "bg-emerald-50 text-emerald-700 border-emerald-200" },
    pendiente: { text: "Pendiente", cls: "bg-amber-50 text-amber-700 border-amber-200" },
    revision: { text: "En revisión", cls: "bg-sky-50 text-sky-700 border-sky-200" },
    excedido: { text: "Tope excedido", cls: "bg-rose-50 text-rose-700 border-rose-200" },
  };
  const s = map[status] || map.pendiente;
  return (
    <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full border text-[11px] font-semibold ${s.cls}`}>
      <span className="h-1.5 w-1.5 rounded-full bg-current" />
      {s.text}
    </span>
  );
};

const VehicleRow = ({ v, onEdit, onDelete }) => {
  const cat = VEHICLE_CATEGORIES.find((c) => c.id === v.categoryId);
  const consumoPeriodoUnidad = (v.consumo || 0) * MESES;
  const reconocidos = Math.min(consumoPeriodoUnidad, cat?.tope || 0) * (v.unidades || 0);
  const galonesBrutos = consumoPeriodoUnidad * (v.unidades || 0);
  const subsidio = reconocidos * SUBSIDIO_GL;
  const capped = consumoPeriodoUnidad > (cat?.tope || 0);

  return (
    <tr className="border-b border-neutral-100 hover:bg-brand-50/40 transition" data-testid={`fleet-row-${v.id}`}>
      <td className="px-4 py-4">
        <div className="flex items-center gap-3">
          <div className="h-9 w-9 rounded-xl bg-brand-50 text-brand grid place-items-center text-sm font-bold">
            {cat?.id || "—"}
          </div>
          <div>
            <div className="font-semibold text-sm text-neutral-900">{cat?.label || "Sin categoría"}</div>
            <div className="text-[11px] text-neutral-500">Placa: {v.placa || "—"}</div>
          </div>
        </div>
      </td>
      <td className="px-4 py-4 text-center">
        <span className="font-bold text-neutral-900">{v.unidades}</span>
      </td>
      <td className="px-4 py-4 text-right tabular-nums">
        <div className="text-sm font-semibold text-neutral-900">{formatGalones(v.consumo)}</div>
        <div className="text-[11px] text-neutral-500">gal/mes/unidad</div>
      </td>
      <td className="px-4 py-4 text-right tabular-nums">
        <div className="text-sm font-semibold text-neutral-900">{formatGalones(reconocidos)}</div>
        <div className="text-[11px] text-neutral-500">de {formatGalones(galonesBrutos)} gal</div>
      </td>
      <td className="px-4 py-4 text-right tabular-nums">
        <div className="text-base font-extrabold text-brand font-cabinet">{formatSolesInt(subsidio)}</div>
      </td>
      <td className="px-4 py-4">
        <StatusBadge status={capped ? "excedido" : "activo"} />
      </td>
      <td className="px-4 py-4">
        <div className="flex items-center gap-1 justify-end">
          <button
            onClick={() => onEdit(v)}
            data-testid={`edit-vehicle-${v.id}`}
            className="h-8 w-8 grid place-items-center rounded-lg hover:bg-neutral-100 text-neutral-600 transition"
            title="Editar"
          >
            <Pencil className="h-4 w-4" />
          </button>
          <button
            onClick={() => onDelete(v.id)}
            data-testid={`delete-vehicle-${v.id}`}
            className="h-8 w-8 grid place-items-center rounded-lg hover:bg-rose-50 text-rose-600 transition"
            title="Eliminar"
          >
            <Trash2 className="h-4 w-4" />
          </button>
        </div>
      </td>
    </tr>
  );
};

const VehicleModal = ({ open, initial, onClose, onSave }) => {
  const [form, setForm] = useState(
    initial || { id: "", categoryId: "M2", placa: "", unidades: 1, consumo: 0 }
  );
  useEffect(() => {
    if (open) setForm(initial || { id: "", categoryId: "M2", placa: "", unidades: 1, consumo: 0 });
  }, [open, initial]);

  if (!open) return null;
  const submit = (e) => {
    e.preventDefault();
    if (!form.placa.trim() || !form.consumo || !form.unidades) return;
    onSave({ ...form, id: form.id || `v_${Date.now()}` });
  };

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-neutral-900/50 backdrop-blur-sm p-4" data-testid="vehicle-modal">
      <form
        onSubmit={submit}
        className="w-full max-w-md bg-white rounded-2xl shadow-2xl border border-neutral-200 overflow-hidden animate-pop-in"
      >
        <div className="px-6 py-4 border-b border-neutral-100">
          <h3 className="font-cabinet font-extrabold text-lg text-neutral-900">
            {form.id ? "Editar vehículo" : "Agregar vehículo"}
          </h3>
        </div>
        <div className="px-6 py-5 space-y-4">
          <div>
            <label className="block text-xs font-semibold text-neutral-600 mb-1.5">Categoría</label>
            <select
              data-testid="vehicle-category-select"
              value={form.categoryId}
              onChange={(e) => setForm({ ...form, categoryId: e.target.value })}
              className="w-full rounded-xl border-[1.5px] border-neutral-200 px-3 py-2.5 text-sm focus:outline-none focus:ring-4 focus:ring-brand-50 focus:border-brand bg-white"
            >
              {VEHICLE_CATEGORIES.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.id} · {c.label} (tope {c.tope} gal)
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-semibold text-neutral-600 mb-1.5">Placa</label>
            <input
              type="text"
              data-testid="vehicle-placa-input"
              value={form.placa}
              onChange={(e) => setForm({ ...form, placa: e.target.value.toUpperCase() })}
              placeholder="ABC-123"
              className="w-full rounded-xl border-[1.5px] border-neutral-200 px-3 py-2.5 text-sm focus:outline-none focus:ring-4 focus:ring-brand-50 focus:border-brand"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-neutral-600 mb-1.5">Unidades</label>
              <input
                type="number"
                min="1"
                data-testid="vehicle-unidades-input"
                value={form.unidades}
                onChange={(e) => setForm({ ...form, unidades: Number(e.target.value) })}
                className="w-full rounded-xl border-[1.5px] border-neutral-200 px-3 py-2.5 text-sm focus:outline-none focus:ring-4 focus:ring-brand-50 focus:border-brand"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-neutral-600 mb-1.5">Consumo (gal/mes)</label>
              <input
                type="number"
                min="0"
                step="0.1"
                data-testid="vehicle-consumo-input"
                value={form.consumo}
                onChange={(e) => setForm({ ...form, consumo: Number(e.target.value) })}
                className="w-full rounded-xl border-[1.5px] border-neutral-200 px-3 py-2.5 text-sm focus:outline-none focus:ring-4 focus:ring-brand-50 focus:border-brand"
              />
            </div>
          </div>
        </div>
        <div className="px-6 py-4 border-t border-neutral-100 bg-neutral-50 flex items-center justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            data-testid="modal-cancel-btn"
            className="px-4 py-2 rounded-xl text-sm font-semibold text-neutral-700 hover:bg-neutral-200 transition"
          >
            Cancelar
          </button>
          <button
            type="submit"
            data-testid="modal-save-btn"
            className="px-5 py-2 rounded-xl text-sm font-bold text-white bg-brand hover:bg-brand-hover shadow-sm transition"
          >
            Guardar
          </button>
        </div>
      </form>
    </div>
  );
};

const TramiteTimeline = ({ currentStage }) => {
  const currentIdx = TRAMITE_STAGES.findIndex((s) => s.id === currentStage);
  return (
    <div className="bg-white rounded-2xl border border-neutral-200 p-6" data-testid="tramite-timeline">
      <div className="flex items-center justify-between mb-5">
        <div>
          <h3 className="font-cabinet font-extrabold text-lg text-neutral-900">Estado del trámite</h3>
          <p className="text-xs text-neutral-500 mt-0.5">Avance de tu solicitud DU 004-2026</p>
        </div>
        <div className="text-xs font-bold text-brand bg-brand-50 px-3 py-1.5 rounded-full">
          Etapa {Math.max(currentIdx + 1, 1)} de {TRAMITE_STAGES.length}
        </div>
      </div>
      <div className="relative">
        <div className="absolute left-0 right-0 top-5 h-0.5 bg-neutral-200" />
        <div
          className="absolute left-0 top-5 h-0.5 bg-brand transition-all duration-500"
          style={{ width: `${(currentIdx / (TRAMITE_STAGES.length - 1)) * 100}%` }}
        />
        <div className="relative grid grid-cols-5 gap-2">
          {TRAMITE_STAGES.map((s, i) => {
            const done = i <= currentIdx;
            const active = i === currentIdx;
            const Icon = s.icon;
            return (
              <div key={s.id} className="flex flex-col items-center text-center">
                <div
                  className={`h-10 w-10 rounded-full grid place-items-center border-2 transition ${
                    done
                      ? "bg-brand border-brand text-white shadow-md shadow-brand/30"
                      : "bg-white border-neutral-300 text-neutral-400"
                  } ${active ? "ring-4 ring-brand-100" : ""}`}
                >
                  <Icon className="h-4 w-4" />
                </div>
                <div className={`mt-2 text-[11px] font-semibold leading-tight ${done ? "text-neutral-900" : "text-neutral-400"}`}>
                  {s.label}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

// ---------- Empty state (no client) ----------
const EmptyState = () => (
  <div className="min-h-screen grid place-items-center bg-[#F7F6FB] p-6">
    <div className="max-w-md w-full bg-white rounded-3xl shadow-xl border border-neutral-200 p-8 text-center">
      <div className="h-14 w-14 rounded-2xl bg-brand-50 text-brand grid place-items-center mx-auto mb-4">
        <AlertCircle className="h-7 w-7" />
      </div>
      <h2 className="font-cabinet font-extrabold text-xl text-neutral-900 mb-2">
        No tienes una sesión activa
      </h2>
      <p className="text-sm text-neutral-500 mb-6">
        Para acceder a tu dashboard necesitas registrarte primero desde la calculadora de subsidio.
      </p>
      <Link
        to="/"
        data-testid="back-to-calculator-btn"
        className="inline-flex items-center gap-2 px-5 py-3 rounded-xl bg-brand text-white font-bold text-sm hover:bg-brand-hover transition"
      >
        <ArrowLeft className="h-4 w-4" />
        Ir a la calculadora
      </Link>
    </div>
  </div>
);

// ---------- Main Dashboard ----------
const Dashboard = () => {
  const navigate = useNavigate();
  const [client, setClient] = useState(() => loadClient());
  const [search, setSearch] = useState("");
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState(null);

  useEffect(() => {
    if (client) saveClient(client);
  }, [client]);

  const totals = useMemo(() => {
    if (!client) return null;
    return calculateSubsidy(client.fleet || [], client.precioDiesel || 16.5);
  }, [client]);

  const filteredFleet = useMemo(() => {
    if (!client) return [];
    const q = search.trim().toLowerCase();
    if (!q) return client.fleet || [];
    return (client.fleet || []).filter(
      (v) =>
        (v.placa || "").toLowerCase().includes(q) ||
        (v.categoryId || "").toLowerCase().includes(q)
    );
  }, [client, search]);

  if (!client) return <EmptyState />;

  const handleAdd = () => {
    setEditing(null);
    setModalOpen(true);
  };
  const handleEdit = (v) => {
    setEditing(v);
    setModalOpen(true);
  };
  const handleDelete = (id) => {
    if (!window.confirm("¿Eliminar este vehículo de tu flota?")) return;
    setClient({ ...client, fleet: (client.fleet || []).filter((v) => v.id !== id) });
  };
  const handleSave = (vehicle) => {
    const existing = (client.fleet || []).find((v) => v.id === vehicle.id);
    const newFleet = existing
      ? client.fleet.map((v) => (v.id === vehicle.id ? vehicle : v))
      : [...(client.fleet || []), vehicle];
    setClient({ ...client, fleet: newFleet });
    setModalOpen(false);
  };
  const handleLogout = () => {
    localStorage.removeItem(STORAGE_KEY);
    navigate("/");
  };
  const handleAdvanceStage = () => {
    const idx = TRAMITE_STAGES.findIndex((s) => s.id === (client.stage || "registro"));
    const next = TRAMITE_STAGES[Math.min(idx + 1, TRAMITE_STAGES.length - 1)];
    setClient({ ...client, stage: next.id });
  };

  return (
    <div className="min-h-screen bg-[#F7F6FB]">
      {/* Top Bar */}
      <header className="bg-gradient-to-r from-brand-700 via-brand to-brand-500 text-white">
        <div className="max-w-7xl mx-auto px-6 sm:px-8 py-5 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <img
              src="/assets/enered-logo.png"
              alt="Enered"
              className="h-8 w-auto drop-shadow"
              data-testid="dashboard-logo"
            />
            <div className="hidden sm:block h-6 w-px bg-white/30" />
            <div className="hidden sm:block">
              <div className="text-[11px] font-semibold uppercase tracking-wider text-white/70">Panel del cliente</div>
              <div className="text-sm font-bold">DU 004-2026 · Subsidio diésel</div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Link
              to="/"
              data-testid="back-link"
              className="hidden sm:inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold text-white/90 hover:bg-white/10 transition"
            >
              <ArrowLeft className="h-3.5 w-3.5" /> Calculadora
            </Link>
            <button
              onClick={handleLogout}
              data-testid="logout-btn"
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold bg-white/10 hover:bg-white/20 transition"
            >
              <LogOut className="h-3.5 w-3.5" /> Salir
            </button>
          </div>
        </div>

        <div className="max-w-7xl mx-auto px-6 sm:px-8 pb-8">
          <div className="flex items-end justify-between flex-wrap gap-4">
            <div>
              <div className="text-[11px] font-semibold uppercase tracking-wider text-white/70 mb-1">
                Bienvenido,
              </div>
              <h1 className="font-cabinet font-extrabold text-3xl sm:text-4xl leading-tight" data-testid="client-name">
                {client.empresa || client.nombre}
              </h1>
              <p className="text-white/80 text-sm mt-1">
                RUC {client.ruc || "—"} · {client.email || "sin correo"}
              </p>
            </div>
            <button
              onClick={handleAdvanceStage}
              data-testid="advance-stage-btn"
              className="hidden sm:inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-white text-brand font-bold text-sm shadow-lg hover:shadow-xl hover:-translate-y-0.5 transition"
            >
              <Send className="h-4 w-4" />
              Avanzar trámite
            </button>
          </div>
        </div>
      </header>

      {/* Content */}
      <main className="max-w-7xl mx-auto px-6 sm:px-8 -mt-6 pb-12 relative z-10">
        {/* KPIs */}
        <section className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6" data-testid="kpi-grid">
          <KpiCard
            icon={Wallet}
            label="Subsidio estimado"
            value={formatSolesInt(totals?.totalSubsidy || 0)}
            sub={`${MESES} meses · S/ ${SUBSIDIO_GL.toFixed(2)}/gal`}
            tone="brand"
            testId="kpi-subsidio"
          />
          <KpiCard
            icon={Truck}
            label="Vehículos en flota"
            value={(client.fleet || []).reduce((sum, v) => sum + (v.unidades || 0), 0)}
            sub={`${(client.fleet || []).length} categoría${(client.fleet || []).length === 1 ? "" : "s"}`}
            tone="sky"
            testId="kpi-flota"
          />
          <KpiCard
            icon={Fuel}
            label="Galones reconocidos"
            value={formatGalones(totals?.totalGallonsRecognized || 0)}
            sub={`de ${formatGalones(totals?.totalGallonsRaw || 0)} gal consumidos`}
            tone="emerald"
            testId="kpi-galones"
          />
          <KpiCard
            icon={TrendingUp}
            label="Cobertura del gasto"
            value={`${(totals?.coverage || 0).toFixed(1)}%`}
            sub={`gasto S/ ${formatGalones(totals?.totalExpense || 0)}`}
            tone="amber"
            testId="kpi-cobertura"
          />
        </section>

        {/* Timeline */}
        <section className="mb-6">
          <TramiteTimeline currentStage={client.stage || "registro"} />
        </section>

        {/* Fleet table */}
        <section className="bg-white rounded-2xl border border-neutral-200 overflow-hidden" data-testid="fleet-section">
          <div className="px-6 py-5 border-b border-neutral-100 flex items-center justify-between gap-3 flex-wrap">
            <div>
              <h2 className="font-cabinet font-extrabold text-lg text-neutral-900">Módulo de flota</h2>
              <p className="text-xs text-neutral-500 mt-0.5">
                Gestiona los vehículos que entran al subsidio. KPIs en tiempo real por fila.
              </p>
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-neutral-400" />
                <input
                  type="text"
                  data-testid="fleet-search-input"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Buscar placa o categoría..."
                  className="pl-9 pr-3 py-2 rounded-xl border-[1.5px] border-neutral-200 text-sm w-56 focus:outline-none focus:ring-4 focus:ring-brand-50 focus:border-brand"
                />
              </div>
              <button
                data-testid="export-fleet-btn"
                onClick={() => alert("Exportación CSV próximamente")}
                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border border-neutral-200 text-xs font-semibold text-neutral-700 hover:bg-neutral-50 transition"
              >
                <Download className="h-3.5 w-3.5" /> Exportar
              </button>
              <button
                onClick={handleAdd}
                data-testid="add-vehicle-btn"
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-brand text-white text-xs font-bold hover:bg-brand-hover shadow-sm transition"
              >
                <Plus className="h-3.5 w-3.5" /> Agregar vehículo
              </button>
            </div>
          </div>

          {(filteredFleet || []).length === 0 ? (
            <div className="px-6 py-16 text-center">
              <div className="h-14 w-14 rounded-2xl bg-neutral-100 grid place-items-center mx-auto mb-3">
                <Truck className="h-6 w-6 text-neutral-400" />
              </div>
              <div className="font-semibold text-neutral-900 mb-1">
                {search ? "No se encontraron vehículos" : "Tu flota está vacía"}
              </div>
              <div className="text-sm text-neutral-500 mb-5">
                {search ? "Prueba con otra placa o categoría." : "Agrega tu primer vehículo para comenzar."}
              </div>
              {!search && (
                <button
                  onClick={handleAdd}
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-brand text-white text-xs font-bold hover:bg-brand-hover"
                >
                  <Plus className="h-3.5 w-3.5" /> Agregar vehículo
                </button>
              )}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-neutral-50/70 text-[11px] font-bold uppercase tracking-wider text-neutral-500">
                  <tr>
                    <th className="px-4 py-3 text-left">Categoría / Placa</th>
                    <th className="px-4 py-3 text-center">Unid.</th>
                    <th className="px-4 py-3 text-right">Consumo</th>
                    <th className="px-4 py-3 text-right">Reconocidos (2 m)</th>
                    <th className="px-4 py-3 text-right">Subsidio</th>
                    <th className="px-4 py-3 text-left">Estado</th>
                    <th className="px-4 py-3"></th>
                  </tr>
                </thead>
                <tbody>
                  {filteredFleet.map((v) => (
                    <VehicleRow key={v.id} v={v} onEdit={handleEdit} onDelete={handleDelete} />
                  ))}
                </tbody>
                <tfoot className="bg-brand-50/40 font-bold">
                  <tr>
                    <td className="px-4 py-4 text-sm text-neutral-900" colSpan="4">
                      Total flota · {(client.fleet || []).length} categoría{(client.fleet || []).length === 1 ? "" : "s"}
                    </td>
                    <td className="px-4 py-4 text-right text-base text-brand font-cabinet">
                      {formatSolesInt(totals?.totalSubsidy || 0)}
                    </td>
                    <td className="px-4 py-4" colSpan="2"></td>
                  </tr>
                </tfoot>
              </table>
            </div>
          )}
        </section>

        {/* Footer hint */}
        <div className="mt-6 flex items-center gap-2 text-xs text-neutral-500">
          <Clock className="h-3.5 w-3.5" />
          Última actualización: {new Date().toLocaleString("es-PE")}
        </div>
      </main>

      <VehicleModal
        open={modalOpen}
        initial={editing}
        onClose={() => setModalOpen(false)}
        onSave={handleSave}
      />
    </div>
  );
};

export default Dashboard;

// Helper export so Calculator can create a session
export const createClientSession = (data) => {
  const session = {
    nombre: data.nombre || "",
    empresa: data.empresa || data.nombre || "Mi empresa",
    ruc: data.ruc || "",
    email: data.email || "",
    fleet: data.fleet || [],
    precioDiesel: data.precioDiesel || 16.5,
    stage: "registro",
    createdAt: new Date().toISOString(),
  };
  saveClient(session);
  return session;
};
