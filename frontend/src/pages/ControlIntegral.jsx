import React, { useEffect, useState } from "react";
import { api } from "../lib/api";
import { useAuth } from "../context/AuthContext";
import { formatDate, formatApiError } from "../lib/utils";
import { Plus, ShieldCheck, Clock, CheckCircle2, XCircle } from "lucide-react";

const TIPOS = [
  { v: "tope_mensual_galones", l: "Tope mensual de galones por placa" },
  { v: "tope_diario", l: "Tope por día" },
  { v: "estaciones_permitidas", l: "Estaciones permitidas" },
  { v: "ciudades_permitidas", l: "Ciudades permitidas" },
  { v: "combustible_permitido", l: "Tipo de combustible permitido" },
  { v: "limite_por_carga", l: "Límite por carga" },
];

const ESTADO_STYLE = {
  pendiente: { cls: "bg-yellow-100 text-yellow-700 border-yellow-200", Icon: Clock },
  realizada: { cls: "bg-green-100 text-green-700 border-green-200", Icon: CheckCircle2 },
  rechazada: { cls: "bg-red-100 text-red-700 border-red-200", Icon: XCircle },
};

export default function ControlIntegral() {
  const { user } = useAuth();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ tipo: "tope_mensual_galones", placa: "", detalle: "", valor: "" });
  const [err, setErr] = useState("");

  const load = async () => {
    setLoading(true);
    try { const { data } = await api.get("/control-requests"); setItems(data); }
    finally { setLoading(false); }
  };

  useEffect(() => { load(); }, []);

  const create = async (e) => {
    e.preventDefault(); setErr("");
    try {
      await api.post("/control-requests", form);
      setShowForm(false); setForm({ tipo: "tope_mensual_galones", placa: "", detalle: "", valor: "" });
      load();
    } catch (e2) { setErr(formatApiError(e2.response?.data?.detail)); }
  };

  const updateEstado = async (id, estado) => {
    await api.put(`/control-requests/${id}`, { estado });
    load();
  };

  const isAdmin = user?.role === "admin_enered";

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-4">
        <div>
          <div className="text-[11px] font-bold uppercase tracking-widest text-brand mb-2">Restricciones y controles</div>
          <h1 className="font-cabinet font-black text-3xl md:text-4xl text-neutral-900">Control Integral</h1>
          <p className="text-neutral-500 mt-1 text-sm">Solicita y gestiona restricciones operativas sobre tu flota.</p>
        </div>
        <button onClick={() => setShowForm(true)} className="btn-brand text-sm flex items-center gap-2" data-testid="control-new-btn">
          <Plus className="w-4 h-4" /> Nueva solicitud
        </button>
      </div>

      {showForm && (
        <div className="bg-white border border-border rounded-lg p-6">
          <h3 className="font-cabinet font-bold text-lg mb-4 flex items-center gap-2">
            <ShieldCheck className="w-5 h-5 text-brand" /> Nueva solicitud de control
          </h3>
          <form onSubmit={create} className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <select value={form.tipo} onChange={(e) => setForm({ ...form, tipo: e.target.value })} className="h-10 px-3 border border-border rounded-md text-sm">
              {TIPOS.map((t) => <option key={t.v} value={t.v}>{t.l}</option>)}
            </select>
            <input placeholder="Placa (opcional)" value={form.placa} onChange={(e) => setForm({ ...form, placa: e.target.value })} className="h-10 px-3 border border-border rounded-md text-sm" />
            <input placeholder="Valor / monto / lista (ej: 500 gal, LIMA,AREQUIPA)" value={form.valor} onChange={(e) => setForm({ ...form, valor: e.target.value })} className="h-10 px-3 border border-border rounded-md text-sm md:col-span-2" />
            <textarea required placeholder="Detalle de la solicitud" value={form.detalle} onChange={(e) => setForm({ ...form, detalle: e.target.value })} rows={3} className="px-3 py-2 border border-border rounded-md text-sm md:col-span-2" />
            {err && <div className="md:col-span-2 text-red-600 text-sm">{err}</div>}
            <div className="md:col-span-2 flex gap-2">
              <button type="submit" className="btn-brand text-sm">Enviar</button>
              <button type="button" onClick={() => setShowForm(false)} className="btn-ghost text-sm">Cancelar</button>
            </div>
          </form>
        </div>
      )}

      <div className="space-y-3">
        {loading ? <div className="text-neutral-500">Cargando...</div>
          : items.length === 0 ? (
            <div className="bg-white border border-border rounded-lg p-10 text-center text-neutral-500">
              <ShieldCheck className="w-12 h-12 text-neutral-300 mx-auto mb-3" />
              Sin solicitudes registradas. Crea una para empezar.
            </div>
          )
            : items.map((r) => {
              const s = ESTADO_STYLE[r.estado] || ESTADO_STYLE.pendiente;
              const Ic = s.Icon;
              const tipoL = TIPOS.find((t) => t.v === r.tipo)?.l || r.tipo;
              return (
                <div key={r.id} className="bg-white border border-border rounded-lg p-5 flex flex-col md:flex-row md:items-center gap-4" data-testid="control-item">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className={`px-2.5 py-1 rounded-full text-xs font-bold border flex items-center gap-1 ${s.cls}`}>
                        <Ic className="w-3 h-3" /> {r.estado.toUpperCase()}
                      </span>
                      <span className="font-bold text-sm text-neutral-900">{tipoL}</span>
                      {r.placa && <span className="font-mono text-xs bg-brand-50 text-brand px-2 py-0.5 rounded-full">{r.placa}</span>}
                    </div>
                    <div className="text-sm text-neutral-700 mt-2">{r.detalle}</div>
                    {r.valor && <div className="text-xs text-neutral-500 mt-1"><b>Valor:</b> {r.valor}</div>}
                    <div className="text-xs text-neutral-400 mt-2">Solicitado por {r.solicitante} · {formatDate(r.created_at)}</div>
                  </div>
                  {isAdmin && r.estado === "pendiente" && (
                    <div className="flex gap-2">
                      <button onClick={() => updateEstado(r.id, "realizada")} className="btn-brand text-xs" data-testid={`control-mark-done-${r.id}`}>Marcar realizada</button>
                      <button onClick={() => updateEstado(r.id, "rechazada")} className="btn-ghost text-xs text-red-600">Rechazar</button>
                    </div>
                  )}
                </div>
              );
            })}
      </div>
    </div>
  );
}
