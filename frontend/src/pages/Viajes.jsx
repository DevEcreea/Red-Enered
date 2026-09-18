import React, { useEffect, useMemo, useState, useCallback } from "react";
import { api } from "../lib/api";
import {
  Route, Plus, Loader2, Pencil, Trash2, MapPin, Truck, PlayCircle, CheckCircle2, XCircle, Clock,
} from "lucide-react";

const fmtFecha = (s) => {
  if (!s) return "—";
  const d = new Date(s.length === 10 ? s + "T12:00:00" : s);
  return isNaN(d) ? s : d.toLocaleDateString("es-PE", { day: "2-digit", month: "2-digit", year: "numeric" });
};
const hoyIso = () => new Date().toISOString().slice(0, 10);

const ESTADO = {
  planificado: { label: "Planificado", bg: "#EFF6FF", fg: "#1D4ED8", dot: "#3B82F6", icon: Clock },
  en_curso: { label: "En curso", bg: "#FEF3C7", fg: "#B45309", dot: "#F59E0B", icon: PlayCircle },
  finalizado: { label: "Finalizado", bg: "#DCFCE7", fg: "#15803D", dot: "#22C55E", icon: CheckCircle2 },
  cancelado: { label: "Cancelado", bg: "#F3F4F6", fg: "#6B7280", dot: "#9CA3AF", icon: XCircle },
};
const Chip = ({ estado }) => {
  const e = ESTADO[estado] || ESTADO.planificado;
  const I = e.icon;
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 6, background: e.bg, color: e.fg, borderRadius: 999, padding: "4px 10px", fontSize: 12, fontWeight: 700, whiteSpace: "nowrap" }}>
      <I size={12} /> {e.label}
    </span>
  );
};

const card = { background: "#fff", border: "1px solid #E5E7EB", borderRadius: 16, padding: 20, boxShadow: "0 1px 2px rgba(0,0,0,.04)" };
const th = { textAlign: "left", fontSize: 11, letterSpacing: ".06em", textTransform: "uppercase", color: "#9CA3AF", fontWeight: 700, padding: "10px 12px", borderBottom: "1px solid #E5E7EB", whiteSpace: "nowrap" };
const td = { padding: "12px 12px", borderBottom: "1px solid #F3F4F6", fontSize: 13, color: "#111827", verticalAlign: "top" };
const btnP = { background: "#8039F4", color: "#fff", border: "none", borderRadius: 10, padding: "9px 14px", fontSize: 13, fontWeight: 700, cursor: "pointer", display: "inline-flex", alignItems: "center", gap: 6 };
const btnS = { background: "#fff", color: "#374151", border: "1px solid #D1D5DB", borderRadius: 10, padding: "9px 14px", fontSize: 13, fontWeight: 600, cursor: "pointer", display: "inline-flex", alignItems: "center", gap: 6 };
const inp = { width: "100%", height: 38, border: "1px solid #E5E7EB", borderRadius: 8, padding: "0 12px", fontSize: 13, color: "#374151", boxSizing: "border-box", outline: "none", background: "#fff" };
const lbl = { fontSize: 11, color: "#6B7280", marginBottom: 4, display: "block", fontWeight: 600 };

export default function Viajes() {
  const [viajes, setViajes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [filtroPlaca, setFiltroPlaca] = useState("");
  const [filtroEstado, setFiltroEstado] = useState("");
  const [modal, setModal] = useState(null);
  const [toast, setToast] = useState("");

  const aviso = (m) => { setToast(m); setTimeout(() => setToast(""), 2600); };

  const cargar = useCallback(async () => {
    setLoading(true); setError("");
    try {
      const { data } = await api.get("/viajes");
      setViajes(data.viajes || []);
    } catch (e) { setError(e.response?.data?.detail || e.message); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => { cargar(); }, [cargar]);

  const filtrados = useMemo(() => viajes.filter((v) => {
    if (filtroPlaca && v.placa !== filtroPlaca.toUpperCase().replace(/[^A-Z0-9]/g, "")) return false;
    if (filtroEstado && v.estado !== filtroEstado) return false;
    return true;
  }), [viajes, filtroPlaca, filtroEstado]);

  const kpis = useMemo(() => ({
    planificado: viajes.filter((v) => v.estado === "planificado").length,
    en_curso: viajes.filter((v) => v.estado === "en_curso").length,
    finalizado_hoy: viajes.filter((v) => v.estado === "finalizado" && (v.finalizado_en || "").startsWith(hoyIso())).length,
    total: viajes.length,
  }), [viajes]);

  const cambiarEstado = async (v, estado) => {
    try { await api.put(`/viajes/${v.id}`, { ...v, estado }); aviso("Estado actualizado"); cargar(); }
    catch (e) { alert(e.response?.data?.detail || e.message); }
  };
  const borrar = async (v) => {
    if (!window.confirm(`¿Eliminar el viaje ${v.origen} → ${v.destino}?`)) return;
    try { await api.delete(`/viajes/${v.id}`); aviso("Viaje eliminado"); cargar(); }
    catch (e) { alert(e.response?.data?.detail || e.message); }
  };

  if (loading) return (
    <div style={{ minHeight: 320, display: "flex", alignItems: "center", justifyContent: "center", color: "#8039F4" }}>
      <Loader2 className="w-8 h-8 animate-spin" />
    </div>
  );

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 18 }} data-testid="viajes">
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 12 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <div style={{ width: 44, height: 44, borderRadius: 12, background: "#8039F41A", color: "#8039F4", display: "flex", alignItems: "center", justifyContent: "center" }}><Route size={22} /></div>
          <div>
            <div className="font-cabinet" style={{ fontSize: 22, fontWeight: 800, color: "#111827", lineHeight: 1.1 }}>Viajes</div>
            <div style={{ fontSize: 12, color: "#6B7280" }}>Registrados desde el panel o por el conductor desde su celular</div>
          </div>
        </div>
        <button style={btnP} onClick={() => setModal({})} data-testid="viajes-nuevo"><Plus size={15} /> Nuevo viaje</button>
      </div>

      {error && <div style={{ ...card, borderColor: "#FCA5A5", background: "#FEF2F2", color: "#B91C1C", fontSize: 13 }}>{error}</div>}

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: 12 }}>
        {[
          { label: "Planificados", value: kpis.planificado, icon: Clock, color: "#3B82F6" },
          { label: "En curso", value: kpis.en_curso, icon: PlayCircle, color: "#F59E0B" },
          { label: "Finalizados hoy", value: kpis.finalizado_hoy, icon: CheckCircle2, color: "#16A34A" },
          { label: "Total", value: kpis.total, icon: Route, color: "#8039F4" },
        ].map((k) => (
          <div key={k.label} style={{ ...card, padding: 16, display: "flex", gap: 12, alignItems: "center" }}>
            <div style={{ width: 38, height: 38, borderRadius: 10, background: k.color + "1A", color: k.color, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}><k.icon size={18} /></div>
            <div>
              <div style={{ fontSize: 11, color: "#6B7280", fontWeight: 600, textTransform: "uppercase", letterSpacing: ".04em" }}>{k.label}</div>
              <div className="font-cabinet" style={{ fontSize: 22, fontWeight: 800, color: "#111827", lineHeight: 1.1 }}>{k.value}</div>
            </div>
          </div>
        ))}
      </div>

      <div style={{ ...card, padding: 0, overflow: "hidden" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "14px 16px", flexWrap: "wrap" }}>
          <input style={{ ...inp, width: 180 }} placeholder="Filtrar por placa…" value={filtroPlaca} onChange={(e) => setFiltroPlaca(e.target.value)} />
          <select style={{ ...inp, width: 170 }} value={filtroEstado} onChange={(e) => setFiltroEstado(e.target.value)}>
            <option value="">Todos los estados</option>
            {Object.entries(ESTADO).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
          </select>
        </div>
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 960 }}>
            <thead><tr>
              <th style={th}>Ruta</th><th style={th}>Unidad</th><th style={th}>Conductor</th><th style={th}>Salida</th>
              <th style={th}>Guía</th><th style={th}>Estado</th><th style={{ ...th, textAlign: "right" }}>Acciones</th>
            </tr></thead>
            <tbody>
              {filtrados.length === 0 && <tr><td colSpan={7} style={{ ...td, color: "#9CA3AF", textAlign: "center", padding: 30 }}>No hay viajes registrados.</td></tr>}
              {filtrados.map((v) => (
                <tr key={v.id}>
                  <td style={td}>
                    <div style={{ fontWeight: 700, display: "flex", alignItems: "center", gap: 6 }}><MapPin size={13} color="#8039F4" /> {v.origen} → {v.destino}</div>
                    {v.notas && <div style={{ fontSize: 11, color: "#9CA3AF", marginTop: 2 }}>{v.notas}</div>}
                  </td>
                  <td style={{ ...td, fontWeight: 800 }}><Truck size={13} style={{ marginRight: 4, verticalAlign: -2 }} color="#6B7280" />{v.placa}</td>
                  <td style={td}>{v.conductor_nombre || <span style={{ color: "#9CA3AF" }}>—</span>}{v.conductor_dni && <div style={{ fontSize: 11, color: "#9CA3AF" }}>DNI {v.conductor_dni}</div>}</td>
                  <td style={td}>{fmtFecha(v.fecha_salida)}{v.hora_salida ? ` · ${v.hora_salida}` : ""}</td>
                  <td style={td}>{v.guia_remision || "—"}</td>
                  <td style={td}><Chip estado={v.estado} /></td>
                  <td style={{ ...td, textAlign: "right", whiteSpace: "nowrap" }}>
                    {v.estado === "en_curso" && <button style={{ ...btnS, padding: "5px 8px", marginRight: 6, fontSize: 12 }} onClick={() => cambiarEstado(v, "finalizado")}>Finalizar</button>}
                    {v.estado === "planificado" && <button style={{ ...btnS, padding: "5px 8px", marginRight: 6, fontSize: 12 }} onClick={() => cambiarEstado(v, "en_curso")}>Iniciar</button>}
                    <button style={{ ...btnS, padding: "5px 8px", marginRight: 6 }} onClick={() => setModal(v)} title="Editar"><Pencil size={13} /></button>
                    <button style={{ ...btnS, padding: "5px 8px", color: "#DC2626" }} onClick={() => borrar(v)} title="Eliminar"><Trash2 size={13} /></button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {modal && <ModalViaje init={modal} onClose={() => setModal(null)} onSaved={(m) => { setModal(null); aviso(m); cargar(); }} />}
      {toast && <div style={{ position: "fixed", bottom: 24, right: 24, background: "#111827", color: "#fff", padding: "10px 16px", borderRadius: 10, fontSize: 13, zIndex: 60 }}>{toast}</div>}
    </div>
  );
}

function ModalViaje({ init, onClose, onSaved }) {
  const [f, setF] = useState({
    placa: init.placa || "", conductor_dni: init.conductor_dni || "", conductor_nombre: init.conductor_nombre || "",
    origen: init.origen || "", destino: init.destino || "", fecha_salida: init.fecha_salida || hoyIso(),
    hora_salida: init.hora_salida || "", guia_remision: init.guia_remision || "", notas: init.notas || "",
    estado: init.estado || "planificado",
  });
  const [saving, setSaving] = useState(false);
  const set = (k, v) => setF((p) => ({ ...p, [k]: v }));

  const guardar = async () => {
    if (!f.placa.trim()) return alert("Indica la placa");
    if (!f.origen.trim() || !f.destino.trim()) return alert("Indica origen y destino");
    setSaving(true);
    try {
      if (init.id) await api.put(`/viajes/${init.id}`, f); else await api.post("/viajes", f);
      onSaved(init.id ? "Viaje actualizado" : "Viaje creado");
    } catch (err) { alert(err.response?.data?.detail || err.message); }
    finally { setSaving(false); }
  };

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(17,24,39,.45)", zIndex: 50, display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }} onClick={onClose}>
      <div style={{ background: "#fff", borderRadius: 16, width: 640, maxWidth: "100%", maxHeight: "92vh", overflow: "auto", boxShadow: "0 20px 50px rgba(0,0,0,.2)" }} onClick={(ev) => ev.stopPropagation()}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "16px 20px", borderBottom: "1px solid #E5E7EB" }}>
          <div style={{ fontWeight: 800, fontSize: 16 }}>{init.id ? "Editar viaje" : "Nuevo viaje"}</div>
          <div style={{ display: "flex", gap: 8 }}><button style={btnS} onClick={onClose}>Cancelar</button><button style={btnP} onClick={guardar} disabled={saving}>{saving && <Loader2 size={15} className="animate-spin" />} Guardar</button></div>
        </div>
        <div style={{ padding: 20, display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
          <div><label style={lbl}>Placa *</label><input style={inp} value={f.placa} onChange={(e) => set("placa", e.target.value.toUpperCase())} /></div>
          <div><label style={lbl}>Estado</label>
            <select style={inp} value={f.estado} onChange={(e) => set("estado", e.target.value)}>
              {Object.entries(ESTADO).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
            </select></div>
          <div><label style={lbl}>Origen *</label><input style={inp} value={f.origen} onChange={(e) => set("origen", e.target.value)} /></div>
          <div><label style={lbl}>Destino *</label><input style={inp} value={f.destino} onChange={(e) => set("destino", e.target.value)} /></div>
          <div><label style={lbl}>Fecha de salida</label><input type="date" style={inp} value={f.fecha_salida} onChange={(e) => set("fecha_salida", e.target.value)} /></div>
          <div><label style={lbl}>Hora de salida</label><input type="time" style={inp} value={f.hora_salida} onChange={(e) => set("hora_salida", e.target.value)} /></div>
          <div><label style={lbl}>Conductor (DNI)</label><input style={inp} value={f.conductor_dni} onChange={(e) => set("conductor_dni", e.target.value.replace(/\D/g, "").slice(0, 8))} /></div>
          <div><label style={lbl}>Conductor (nombre)</label><input style={inp} value={f.conductor_nombre} onChange={(e) => set("conductor_nombre", e.target.value)} /></div>
          <div><label style={lbl}>Guía de remisión</label><input style={inp} value={f.guia_remision} onChange={(e) => set("guia_remision", e.target.value)} /></div>
          <div style={{ gridColumn: "1 / -1" }}><label style={lbl}>Notas</label><textarea style={{ ...inp, height: 60, padding: 10 }} value={f.notas} onChange={(e) => set("notas", e.target.value)} /></div>
        </div>
      </div>
    </div>
  );
}
