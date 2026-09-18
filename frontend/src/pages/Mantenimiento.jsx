import React, { useEffect, useMemo, useState, useCallback } from "react";
import { api } from "../lib/api";
import { useAuth } from "../context/AuthContext";
import {
  Wrench, RefreshCw, Plus, ClipboardList, Gauge, AlertTriangle, CheckCircle2, Clock, X, Trash2,
  Satellite, Loader2, Settings2, Receipt, ChevronDown, ChevronRight, Sparkles, Pencil,
} from "lucide-react";

// ─── helpers ───────────────────────────────────────────────────────────────
const fmtKm = (n) => (n == null ? "—" : Math.round(Number(n)).toLocaleString("es-PE") + " km");
const fmtSol = (n) => "S/ " + Number(n || 0).toLocaleString("es-PE", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const fmtFecha = (s) => {
  if (!s) return "—";
  const d = new Date(s.length === 10 ? s + "T12:00:00" : s);
  return isNaN(d) ? s : d.toLocaleDateString("es-PE", { day: "2-digit", month: "2-digit", year: "numeric" });
};
const hace = (iso) => {
  if (!iso) return "";
  const diff = Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
  if (diff < 1) return "ahora";
  if (diff < 60) return `hace ${diff} min`;
  if (diff < 1440) return `hace ${Math.floor(diff / 60)} h`;
  return `hace ${Math.floor(diff / 1440)} d`;
};
const hoyIso = () => new Date().toISOString().slice(0, 10);

const ESTADO = {
  vencido:  { label: "Vencido",   bg: "#FEE2E2", fg: "#B91C1C", dot: "#DC2626" },
  pronto:   { label: "Por vencer", bg: "#FEF3C7", fg: "#B45309", dot: "#F59E0B" },
  ok:       { label: "Al día",    bg: "#DCFCE7", fg: "#15803D", dot: "#22C55E" },
  sin_dato: { label: "Sin registro", bg: "#F3F4F6", fg: "#6B7280", dot: "#9CA3AF" },
};
const Chip = ({ estado, small }) => {
  const e = ESTADO[estado] || ESTADO.sin_dato;
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 6, background: e.bg, color: e.fg, borderRadius: 999,
      padding: small ? "2px 8px" : "4px 10px", fontSize: small ? 11 : 12, fontWeight: 700, whiteSpace: "nowrap" }}>
      <span style={{ width: 7, height: 7, borderRadius: 99, background: e.dot }} /> {e.label}
    </span>
  );
};
const ORDEN_ESTADO = { planificado: "Planificado", en_taller: "En taller", hecho: "Realizado" };

// ─── estilos base (mismos que Documentación/Vehículos) ──────────────────────
const card = { background: "#fff", border: "1px solid #E5E7EB", borderRadius: 16, padding: 20, boxShadow: "0 1px 2px rgba(0,0,0,.04)" };
const th = { textAlign: "left", fontSize: 11, letterSpacing: ".06em", textTransform: "uppercase", color: "#9CA3AF", fontWeight: 700, padding: "10px 12px", borderBottom: "1px solid #E5E7EB", whiteSpace: "nowrap" };
const td = { padding: "12px 12px", borderBottom: "1px solid #F3F4F6", fontSize: 13, color: "#111827", verticalAlign: "top" };
const btnP = { background: "#8039F4", color: "#fff", border: "none", borderRadius: 10, padding: "9px 14px", fontSize: 13, fontWeight: 700, cursor: "pointer", display: "inline-flex", alignItems: "center", gap: 6 };
const btnS = { background: "#fff", color: "#374151", border: "1px solid #D1D5DB", borderRadius: 10, padding: "9px 14px", fontSize: 13, fontWeight: 600, cursor: "pointer", display: "inline-flex", alignItems: "center", gap: 6 };
const inp = { width: "100%", height: 38, border: "1px solid #E5E7EB", borderRadius: 8, padding: "0 12px", fontSize: 13, color: "#374151", boxSizing: "border-box", outline: "none", background: "#fff" };
const lbl = { fontSize: 11, color: "#6B7280", marginBottom: 4, display: "block", fontWeight: 600 };

// ─── página ─────────────────────────────────────────────────────────────────
export default function Mantenimiento() {
  const { user } = useAuth();
  const [tab, setTab] = useState("tablero");
  const [tablero, setTablero] = useState(null);
  const [intervalos, setIntervalos] = useState([]);
  const [servicios, setServicios] = useState([]);
  const [resumen, setResumen] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [modal, setModal] = useState(null);      // { placa, intervalo }
  const [modalItv, setModalItv] = useState(null); // intervalo a editar / null nuevo
  const [abierta, setAbierta] = useState({});
  const [filtroPlaca, setFiltroPlaca] = useState("");
  const [toast, setToast] = useState("");

  const aviso = (m) => { setToast(m); setTimeout(() => setToast(""), 2600); };

  const cargar = useCallback(async (silencioso = false) => {
    if (!silencioso) setLoading(true);
    setError("");
    try {
      const [t, i, s, r] = await Promise.all([
        api.get("/mantenimiento/tablero"),
        api.get("/mantenimiento/intervalos"),
        api.get("/mantenimiento/servicios"),
        api.get("/mantenimiento/resumen"),
      ]);
      setTablero(t.data); setIntervalos(i.data.intervalos || []); setServicios(s.data.servicios || []); setResumen(r.data);
    } catch (e) {
      setError(e.response?.data?.detail || e.message);
    } finally { setLoading(false); }
  }, []);
  useEffect(() => { cargar(); }, [cargar]);

  const unidades = useMemo(() => {
    const list = tablero?.unidades || [];
    const f = filtroPlaca.trim().toUpperCase().replace(/[^A-Z0-9]/g, "");
    return f ? list.filter(u => u.placa_norm.includes(f)) : list;
  }, [tablero, filtroPlaca]);

  const cargarPlanEstandar = async () => {
    try { const { data } = await api.post("/mantenimiento/intervalos/plan-estandar"); aviso(`Plan estándar cargado (${data.agregados} tareas nuevas)`); cargar(true); }
    catch (e) { alert(e.response?.data?.detail || e.message); }
  };
  const borrarIntervalo = async (it) => {
    if (!window.confirm(`¿Quitar "${it.nombre}" del plan?`)) return;
    await api.delete(`/mantenimiento/intervalos/${it.id}`); aviso("Tarea quitada del plan"); cargar(true);
  };
  const borrarServicio = async (s) => {
    if (!window.confirm("¿Eliminar este servicio del historial?")) return;
    await api.delete(`/mantenimiento/servicios/${s.id}`); aviso("Servicio eliminado"); cargar(true);
  };
  const marcarHecho = async (s) => {
    const km = window.prompt("Kilometraje al momento del servicio", s.km || "");
    if (km === null) return;
    await api.put(`/mantenimiento/servicios/${s.id}`, { ...s, estado: "hecho", km: km ? Number(km) : s.km, fecha: hoyIso() });
    aviso("Servicio marcado como realizado"); cargar(true);
  };

  if (loading) return (
    <div style={{ minHeight: 320, display: "flex", alignItems: "center", justifyContent: "center", color: "#8039F4" }} data-testid="mtto-loading">
      <Loader2 className="w-8 h-8 animate-spin" />
    </div>
  );

  const res = tablero?.resumen || {};
  const kpis = [
    { label: "Unidades", value: tablero?.total_unidades ?? 0, sub: `${tablero?.con_km_wialon ?? 0} con km de Wialon`, icon: Gauge, color: "#8039F4" },
    { label: "Vencidos", value: res.vencido ?? 0, sub: "atender ya", icon: AlertTriangle, color: "#DC2626" },
    { label: "Por vencer", value: res.pronto ?? 0, sub: "próximos por km o fecha", icon: Clock, color: "#F59E0B" },
    { label: "Al día", value: res.ok ?? 0, sub: `${res.sin_dato ?? 0} sin registro inicial`, icon: CheckCircle2, color: "#16A34A" },
    { label: "Gasto del mes", value: fmtSol(resumen?.mes_actual), sub: `${fmtSol(resumen?.total)} acumulado`, icon: Receipt, color: "#0EA5E9" },
  ];

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 18 }} data-testid="mantenimiento">
      {/* Encabezado */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 12 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <div style={{ width: 44, height: 44, borderRadius: 12, background: "#8039F41A", color: "#8039F4", display: "flex", alignItems: "center", justifyContent: "center" }}><Wrench size={22} /></div>
          <div>
            <div className="font-cabinet" style={{ fontSize: 22, fontWeight: 800, color: "#111827", lineHeight: 1.1 }}>Mantenimiento</div>
            <div style={{ fontSize: 12, color: "#6B7280" }}>
              {tablero?.empresa} · km en vivo desde Wialon · actualizado {hace(tablero?.actualizado_en)}
            </div>
          </div>
        </div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <button style={btnS} onClick={() => cargar(true)} data-testid="mtto-refresh"><RefreshCw size={15} /> Actualizar km</button>
          <button style={btnP} onClick={() => setModal({ placa: "", intervalo: null })} data-testid="mtto-nuevo-servicio"><Plus size={15} /> Registrar servicio</button>
        </div>
      </div>

      {error && <div style={{ ...card, borderColor: "#FCA5A5", background: "#FEF2F2", color: "#B91C1C", fontSize: 13 }}>{error}</div>}

      {/* KPIs */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(170px, 1fr))", gap: 12 }}>
        {kpis.map(k => (
          <div key={k.label} style={{ ...card, padding: 16, display: "flex", gap: 12, alignItems: "center" }}>
            <div style={{ width: 38, height: 38, borderRadius: 10, background: k.color + "1A", color: k.color, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}><k.icon size={18} /></div>
            <div style={{ minWidth: 0 }}>
              <div style={{ fontSize: 11, color: "#6B7280", fontWeight: 600, textTransform: "uppercase", letterSpacing: ".04em" }}>{k.label}</div>
              <div className="font-cabinet" style={{ fontSize: 22, fontWeight: 800, color: "#111827", lineHeight: 1.1 }}>{k.value}</div>
              <div style={{ fontSize: 11, color: "#9CA3AF" }}>{k.sub}</div>
            </div>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div style={{ display: "flex", gap: 6, borderBottom: "1px solid #E5E7EB" }}>
        {[["tablero", "Tablero de flota", Gauge], ["plan", "Plan de mantenimiento", Settings2], ["servicios", "Servicios e historial", ClipboardList], ["costos", "Costos", Receipt]].map(([k, l, I]) => (
          <button key={k} onClick={() => setTab(k)} data-testid={`mtto-tab-${k}`}
            style={{ background: "none", border: "none", borderBottom: tab === k ? "2px solid #8039F4" : "2px solid transparent", color: tab === k ? "#8039F4" : "#6B7280", padding: "10px 12px", fontSize: 13, fontWeight: 700, cursor: "pointer", display: "inline-flex", alignItems: "center", gap: 6 }}>
            <I size={15} /> {l}
          </button>
        ))}
      </div>

      {/* ── TABLERO ── */}
      {tab === "tablero" && (
        <div style={{ ...card, padding: 0, overflow: "hidden" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "14px 16px", gap: 12, flexWrap: "wrap" }}>
            <input style={{ ...inp, width: 240 }} placeholder="Buscar placa…" value={filtroPlaca} onChange={e => setFiltroPlaca(e.target.value)} />
            {intervalos.length === 0 && (
              <div style={{ display: "flex", alignItems: "center", gap: 10, fontSize: 13, color: "#B45309", background: "#FFFBEB", border: "1px solid #FDE68A", borderRadius: 10, padding: "8px 12px" }}>
                <Sparkles size={15} /> Aún no hay plan de mantenimiento.
                <button style={{ ...btnP, padding: "6px 10px", fontSize: 12 }} onClick={cargarPlanEstandar}>Cargar plan estándar</button>
              </div>
            )}
          </div>
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 900 }}>
              <thead><tr>
                <th style={{ ...th, width: 36 }}></th>
                <th style={th}>Unidad</th>
                <th style={th}>Km actual</th>
                <th style={th}>Estado</th>
                <th style={th}>Próximos servicios</th>
                <th style={{ ...th, textAlign: "right" }}>Acciones</th>
              </tr></thead>
              <tbody>
                {unidades.length === 0 && <tr><td colSpan={6} style={{ ...td, color: "#9CA3AF", textAlign: "center", padding: 30 }}>No hay unidades registradas en Vehículos ni en Wialon.</td></tr>}
                {unidades.map(u => {
                  const open = !!abierta[u.placa_norm];
                  const prox = u.items.filter(i => i.estado !== "sin_dato").slice(0, 2);
                  const sinReg = u.items.filter(i => i.estado === "sin_dato").length;
                  return (
                    <React.Fragment key={u.placa_norm}>
                      <tr style={{ background: open ? "#F5F3FF" : "#fff", cursor: "pointer" }} onClick={() => setAbierta(p => ({ ...p, [u.placa_norm]: !open }))} data-testid={`mtto-unidad-${u.placa_norm}`}>
                        <td style={{ ...td, color: "#9CA3AF" }}>{open ? <ChevronDown size={16} /> : <ChevronRight size={16} />}</td>
                        <td style={td}>
                          <div style={{ fontWeight: 800, fontSize: 14 }}>{u.placa}</div>
                          <div style={{ fontSize: 11, color: "#6B7280" }}>{[u.tipo, u.marca, u.modelo, u.anio].filter(Boolean).join(" · ") || (u.solo_wialon ? "Solo en Wialon" : "Sin datos de unidad")}</div>
                        </td>
                        <td style={td}>
                          <div style={{ fontWeight: 700 }}>{fmtKm(u.km_actual)}</div>
                          <div style={{ fontSize: 11, color: "#6B7280", display: "flex", alignItems: "center", gap: 4 }}>
                            {(u.km_fuente || "").startsWith("Wialon") ? <Satellite size={11} color="#16A34A" /> : null}
                            {u.km_fuente || "sin km"}{u.km_en ? ` · ${hace(u.km_en)}` : ""}{u.encendido ? " · encendido" : ""}
                          </div>
                        </td>
                        <td style={td}><Chip estado={u.estado} />{u.vencidos > 0 && <div style={{ fontSize: 11, color: "#B91C1C", marginTop: 4 }}>{u.vencidos} vencido{u.vencidos > 1 ? "s" : ""}</div>}</td>
                        <td style={td}>
                          {prox.length === 0
                            ? <span style={{ fontSize: 12, color: "#9CA3AF" }}>{sinReg > 0 ? `${sinReg} tareas sin registro inicial: registra el último servicio hecho` : "Sin tareas"}</span>
                            : prox.map(i => (
                              <div key={i.intervalo_id} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12, marginBottom: 3 }}>
                                <Chip estado={i.estado} small />
                                <span style={{ fontWeight: 600 }}>{i.nombre}</span>
                                <span style={{ color: "#6B7280" }}>
                                  {i.restante_km != null ? (i.restante_km < 0 ? `hace ${fmtKm(-i.restante_km)}` : `en ${fmtKm(i.restante_km)}`) : ""}
                                  {i.restante_km != null && i.restante_dias != null ? " · " : ""}
                                  {i.restante_dias != null ? (i.restante_dias < 0 ? `hace ${-i.restante_dias} d` : `en ${i.restante_dias} d`) : ""}
                                </span>
                              </div>
                            ))}
                        </td>
                        <td style={{ ...td, textAlign: "right" }}>
                          <button style={{ ...btnS, padding: "6px 10px", fontSize: 12 }} onClick={(e) => { e.stopPropagation(); setModal({ placa: u.placa_norm, intervalo: null, km: u.km_actual }); }}>
                            <Plus size={13} /> Servicio
                          </button>
                        </td>
                      </tr>
                      {open && (
                        <tr><td colSpan={6} style={{ padding: 0, background: "#FAFAFA", borderBottom: "1px solid #E5E7EB" }}>
                          <table style={{ width: "100%", borderCollapse: "collapse" }}>
                            <thead><tr>
                              <th style={{ ...th, paddingLeft: 52 }}>Tarea</th><th style={th}>Cada</th><th style={th}>Último</th><th style={th}>Próximo</th><th style={th}>Falta</th><th style={th}>Estado</th><th style={th}></th>
                            </tr></thead>
                            <tbody>
                              {u.items.map(i => (
                                <tr key={i.intervalo_id}>
                                  <td style={{ ...td, paddingLeft: 52 }}><div style={{ fontWeight: 600 }}>{i.nombre}</div><div style={{ fontSize: 11, color: "#9CA3AF" }}>{i.categoria}</div></td>
                                  <td style={td}>{[i.cada_km ? fmtKm(i.cada_km) : null, i.cada_dias ? `${i.cada_dias} d` : null].filter(Boolean).join(" o ") || "—"}</td>
                                  <td style={td}>{i.ultimo_km != null || i.ultima_fecha ? <>{fmtKm(i.ultimo_km)}<div style={{ fontSize: 11, color: "#6B7280" }}>{fmtFecha(i.ultima_fecha)}</div></> : <span style={{ color: "#9CA3AF" }}>sin registro</span>}</td>
                                  <td style={td}>{i.proximo_km != null ? fmtKm(i.proximo_km) : ""}{i.proxima_fecha ? <div style={{ fontSize: 11, color: "#6B7280" }}>{fmtFecha(i.proxima_fecha)}</div> : null}{i.proximo_km == null && !i.proxima_fecha ? "—" : ""}</td>
                                  <td style={{ ...td, fontWeight: 700, color: i.estado === "vencido" ? "#B91C1C" : i.estado === "pronto" ? "#B45309" : "#111827" }}>
                                    {i.restante_km != null ? (i.restante_km < 0 ? `-${fmtKm(-i.restante_km)}` : fmtKm(i.restante_km)) : ""}
                                    {i.restante_dias != null ? <div style={{ fontSize: 11, fontWeight: 500 }}>{i.restante_dias < 0 ? `vencido hace ${-i.restante_dias} d` : `${i.restante_dias} días`}</div> : null}
                                    {i.restante_km == null && i.restante_dias == null ? "—" : ""}
                                  </td>
                                  <td style={td}><Chip estado={i.estado} small />{i.orden_abierta && <div style={{ fontSize: 11, color: "#6B7280", marginTop: 3 }}>{ORDEN_ESTADO[i.orden_abierta.estado]} · {fmtFecha(i.orden_abierta.fecha)}</div>}</td>
                                  <td style={{ ...td, textAlign: "right" }}>
                                    <button style={{ ...btnS, padding: "5px 9px", fontSize: 12 }} onClick={() => setModal({ placa: u.placa_norm, intervalo: i, km: u.km_actual })}>
                                      {i.estado === "sin_dato" ? "Registrar último" : "Registrar"}
                                    </button>
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </td></tr>
                      )}
                    </React.Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── PLAN ── */}
      {tab === "plan" && (
        <div style={card}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 10, marginBottom: 12 }}>
            <div>
              <div style={{ fontWeight: 800, fontSize: 15 }}>Tareas e intervalos</div>
              <div style={{ fontSize: 12, color: "#6B7280" }}>Cada tarea se repite cada X km o X días, lo que llegue primero. Aplica a toda la flota salvo que indiques placas.</div>
            </div>
            <div style={{ display: "flex", gap: 8 }}>
              <button style={btnS} onClick={cargarPlanEstandar}><Sparkles size={15} /> Cargar plan estándar</button>
              <button style={btnP} onClick={() => setModalItv({})}><Plus size={15} /> Nueva tarea</button>
            </div>
          </div>
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 760 }}>
              <thead><tr><th style={th}>Tarea</th><th style={th}>Categoría</th><th style={th}>Cada km</th><th style={th}>Cada días</th><th style={th}>Aviso</th><th style={th}>Aplica a</th><th style={th}></th></tr></thead>
              <tbody>
                {intervalos.length === 0 && <tr><td colSpan={7} style={{ ...td, color: "#9CA3AF", textAlign: "center", padding: 30 }}>Sin tareas. Carga el plan estándar o crea la primera.</td></tr>}
                {intervalos.map(it => (
                  <tr key={it.id}>
                    <td style={{ ...td, fontWeight: 700 }}>{it.nombre}{it.activo === false && <span style={{ marginLeft: 8, fontSize: 11, color: "#9CA3AF" }}>(inactiva)</span>}</td>
                    <td style={td}>{it.categoria}</td>
                    <td style={td}>{it.cada_km ? fmtKm(it.cada_km) : "—"}</td>
                    <td style={td}>{it.cada_dias ? `${it.cada_dias} d` : "—"}</td>
                    <td style={{ ...td, color: "#6B7280" }}>{[it.aviso_km ? `${fmtKm(it.aviso_km)} antes` : null, it.aviso_dias ? `${it.aviso_dias} d antes` : null].filter(Boolean).join(" · ") || "—"}</td>
                    <td style={td}>{(it.placas || []).length ? it.placas.join(", ") : "Toda la flota"}</td>
                    <td style={{ ...td, textAlign: "right", whiteSpace: "nowrap" }}>
                      <button style={{ ...btnS, padding: "5px 8px", marginRight: 6 }} onClick={() => setModalItv(it)} title="Editar"><Pencil size={13} /></button>
                      <button style={{ ...btnS, padding: "5px 8px", color: "#DC2626" }} onClick={() => borrarIntervalo(it)} title="Quitar"><Trash2 size={13} /></button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── SERVICIOS ── */}
      {tab === "servicios" && (
        <div style={{ ...card, padding: 0, overflow: "hidden" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "14px 16px", gap: 10, flexWrap: "wrap" }}>
            <input style={{ ...inp, width: 240 }} placeholder="Filtrar por placa…" value={filtroPlaca} onChange={e => setFiltroPlaca(e.target.value)} />
            <button style={btnP} onClick={() => setModal({ placa: "", intervalo: null })}><Plus size={15} /> Registrar servicio</button>
          </div>
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 900 }}>
              <thead><tr><th style={th}>Fecha</th><th style={th}>Unidad</th><th style={th}>Servicio</th><th style={th}>Km</th><th style={th}>Taller</th><th style={th}>Costo</th><th style={th}>Estado</th><th style={th}></th></tr></thead>
              <tbody>
                {servicios.filter(s => !filtroPlaca || s.placa.includes(filtroPlaca.toUpperCase().replace(/[^A-Z0-9]/g, ""))).map(s => (
                  <tr key={s.id}>
                    <td style={td}>{fmtFecha(s.fecha)}</td>
                    <td style={{ ...td, fontWeight: 800 }}>{s.placa}</td>
                    <td style={td}><div style={{ fontWeight: 600 }}>{s.nombre}</div>{(s.repuestos || []).length > 0 && <div style={{ fontSize: 11, color: "#6B7280" }}>{s.repuestos.map(r => `${r.cantidad > 1 ? r.cantidad + "× " : ""}${r.descripcion}`).join(", ")}</div>}{s.notas && <div style={{ fontSize: 11, color: "#9CA3AF" }}>{s.notas}</div>}</td>
                    <td style={td}>{fmtKm(s.km)}</td>
                    <td style={td}>{s.taller || "—"}</td>
                    <td style={{ ...td, fontWeight: 700 }}>{fmtSol(s.costo_total)}<div style={{ fontSize: 11, color: "#6B7280", fontWeight: 400 }}>MO {fmtSol(s.costo_mano_obra)} · rep. {fmtSol(s.costo_repuestos)}</div></td>
                    <td style={td}><span style={{ fontSize: 12, fontWeight: 700, color: s.estado === "hecho" ? "#15803D" : s.estado === "en_taller" ? "#B45309" : "#6B7280" }}>{ORDEN_ESTADO[s.estado] || s.estado}</span></td>
                    <td style={{ ...td, textAlign: "right", whiteSpace: "nowrap" }}>
                      {s.estado !== "hecho" && <button style={{ ...btnS, padding: "5px 8px", marginRight: 6, fontSize: 12 }} onClick={() => marcarHecho(s)}>Marcar hecho</button>}
                      <button style={{ ...btnS, padding: "5px 8px", marginRight: 6 }} onClick={() => setModal({ editar: s, placa: s.placa })} title="Editar"><Pencil size={13} /></button>
                      <button style={{ ...btnS, padding: "5px 8px", color: "#DC2626" }} onClick={() => borrarServicio(s)} title="Eliminar"><Trash2 size={13} /></button>
                    </td>
                  </tr>
                ))}
                {servicios.length === 0 && <tr><td colSpan={8} style={{ ...td, color: "#9CA3AF", textAlign: "center", padding: 30 }}>Aún no hay servicios registrados.</td></tr>}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── COSTOS ── */}
      {tab === "costos" && (
        <div style={card}>
          <div style={{ display: "flex", justifyContent: "space-between", flexWrap: "wrap", gap: 10, marginBottom: 12 }}>
            <div><div style={{ fontWeight: 800, fontSize: 15 }}>Costo por unidad</div><div style={{ fontSize: 12, color: "#6B7280" }}>Costo por km = gasto en servicios realizados ÷ km recorridos desde el primer servicio registrado (según Wialon).</div></div>
            <div className="font-cabinet" style={{ fontSize: 22, fontWeight: 800 }}>{fmtSol(resumen?.total)} <span style={{ fontSize: 12, color: "#6B7280", fontWeight: 500 }}>total</span></div>
          </div>
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 720 }}>
              <thead><tr><th style={th}>Unidad</th><th style={th}>Servicios</th><th style={th}>Mano de obra</th><th style={th}>Repuestos</th><th style={th}>Total</th><th style={th}>Km recorridos</th><th style={th}>Costo / km</th><th style={th}>Último servicio</th></tr></thead>
              <tbody>
                {(resumen?.unidades || []).map(u => (
                  <tr key={u.placa}>
                    <td style={{ ...td, fontWeight: 800 }}>{u.placa}</td>
                    <td style={td}>{u.servicios}</td>
                    <td style={td}>{fmtSol(u.mano_obra)}</td>
                    <td style={td}>{fmtSol(u.repuestos)}</td>
                    <td style={{ ...td, fontWeight: 700 }}>{fmtSol(u.costo_total)}</td>
                    <td style={td}>{u.km_recorridos != null ? fmtKm(u.km_recorridos) : "—"}</td>
                    <td style={{ ...td, fontWeight: 700 }}>{u.costo_por_km != null ? `S/ ${u.costo_por_km.toFixed(3)}` : "—"}</td>
                    <td style={td}>{u.ultimo ? <>{u.ultimo.nombre}<div style={{ fontSize: 11, color: "#6B7280" }}>{fmtFecha(u.ultimo.fecha)} · {fmtSol(u.ultimo.costo)}</div></> : "—"}</td>
                  </tr>
                ))}
                {(resumen?.unidades || []).length === 0 && <tr><td colSpan={8} style={{ ...td, color: "#9CA3AF", textAlign: "center", padding: 30 }}>Registra servicios realizados para ver los costos.</td></tr>}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {modal && <ModalServicio init={modal} unidades={tablero?.unidades || []} intervalos={intervalos} onClose={() => setModal(null)} onSaved={(m) => { setModal(null); aviso(m); cargar(true); }} />}
      {modalItv && <ModalIntervalo init={modalItv} unidades={tablero?.unidades || []} onClose={() => setModalItv(null)} onSaved={(m) => { setModalItv(null); aviso(m); cargar(true); }} />}
      {toast && <div style={{ position: "fixed", bottom: 24, right: 24, background: "#111827", color: "#fff", padding: "10px 16px", borderRadius: 10, fontSize: 13, zIndex: 60 }}>{toast}</div>}
    </div>
  );
}

// ─── Modal: registrar / editar servicio ────────────────────────────────────
function ModalServicio({ init, unidades, intervalos, onClose, onSaved }) {
  const e = init.editar || {};
  const [f, setF] = useState({
    placa: init.placa || e.placa || "",
    intervalo_id: init.intervalo?.intervalo_id || e.intervalo_id || "",
    nombre: init.intervalo?.nombre || e.nombre || "",
    estado: e.estado || "hecho",
    fecha: e.fecha || hoyIso(),
    km: e.km ?? (init.km != null ? Math.round(init.km) : ""),
    taller: e.taller || "",
    costo_mano_obra: e.costo_mano_obra ?? "",
    repuestos: e.repuestos?.length ? e.repuestos : [{ descripcion: "", cantidad: 1, costo: "" }],
    notas: e.notas || "",
  });
  const [saving, setSaving] = useState(false);
  const set = (k, v) => setF(p => ({ ...p, [k]: v }));
  const setRep = (i, k, v) => setF(p => ({ ...p, repuestos: p.repuestos.map((r, j) => j === i ? { ...r, [k]: v } : r) }));
  const totalRep = f.repuestos.reduce((a, r) => a + (Number(r.cantidad) || 1) * (Number(r.costo) || 0), 0);
  const total = (Number(f.costo_mano_obra) || 0) + totalRep;

  useEffect(() => {
    if (!f.placa || f.km !== "") return;
    const u = unidades.find(x => x.placa_norm === f.placa);
    if (u?.km_actual != null) set("km", Math.round(u.km_actual));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [f.placa]);

  const guardar = async () => {
    if (!f.placa) return alert("Elige la unidad");
    if (!f.nombre.trim()) return alert("Indica el servicio realizado");
    setSaving(true);
    try {
      const body = {
        placa: f.placa, intervalo_id: f.intervalo_id || null, nombre: f.nombre.trim(), estado: f.estado, fecha: f.fecha,
        km: f.km === "" ? null : Number(f.km), taller: f.taller, costo_mano_obra: Number(f.costo_mano_obra) || 0,
        repuestos: f.repuestos.filter(r => r.descripcion.trim()).map(r => ({ descripcion: r.descripcion.trim(), cantidad: Number(r.cantidad) || 1, costo: Number(r.costo) || 0 })),
        notas: f.notas,
      };
      if (e.id) await api.put(`/mantenimiento/servicios/${e.id}`, body); else await api.post("/mantenimiento/servicios", body);
      onSaved(e.id ? "Servicio actualizado" : f.estado === "hecho" ? "Servicio registrado" : "Orden de servicio creada");
    } catch (err) { alert(err.response?.data?.detail || err.message); }
    finally { setSaving(false); }
  };

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(17,24,39,.45)", zIndex: 50, display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }} onClick={onClose}>
      <div style={{ background: "#fff", borderRadius: 16, width: 720, maxWidth: "100%", maxHeight: "92vh", overflow: "auto", boxShadow: "0 20px 50px rgba(0,0,0,.2)" }} onClick={ev => ev.stopPropagation()} data-testid="mtto-modal-servicio">
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "16px 20px", borderBottom: "1px solid #E5E7EB" }}>
          <div style={{ fontWeight: 800, fontSize: 16 }}>{e.id ? "Editar servicio" : "Registrar servicio"}</div>
          <div style={{ display: "flex", gap: 8 }}>
            <button style={btnS} onClick={onClose}>Cancelar</button>
            <button style={btnP} onClick={guardar} disabled={saving}>{saving ? <Loader2 size={15} className="animate-spin" /> : null} Guardar</button>
          </div>
        </div>
        <div style={{ padding: 20, display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
          <div><label style={lbl}>Unidad *</label>
            <select style={inp} value={f.placa} onChange={ev => set("placa", ev.target.value)}>
              <option value="">Elige…</option>
              {unidades.map(u => <option key={u.placa_norm} value={u.placa_norm}>{u.placa}{u.km_actual != null ? ` · ${fmtKm(u.km_actual)}` : ""}</option>)}
            </select></div>
          <div><label style={lbl}>Tarea del plan</label>
            <select style={inp} value={f.intervalo_id} onChange={ev => { const it = intervalos.find(x => x.id === ev.target.value); set("intervalo_id", ev.target.value); if (it) set("nombre", it.nombre); }}>
              <option value="">Otro (escribe el nombre)</option>
              {intervalos.map(it => <option key={it.id} value={it.id}>{it.nombre}</option>)}
            </select></div>
          <div style={{ gridColumn: "1 / -1" }}><label style={lbl}>Servicio realizado *</label><input style={inp} value={f.nombre} onChange={ev => set("nombre", ev.target.value)} placeholder="Ej. Cambio de aceite y filtro" /></div>
          <div><label style={lbl}>Estado</label>
            <select style={inp} value={f.estado} onChange={ev => set("estado", ev.target.value)}>
              <option value="hecho">Realizado</option><option value="en_taller">En taller</option><option value="planificado">Planificado</option>
            </select></div>
          <div><label style={lbl}>Fecha</label><input type="date" style={inp} value={f.fecha} onChange={ev => set("fecha", ev.target.value)} /></div>
          <div><label style={lbl}>Kilometraje en el servicio</label><input type="number" style={inp} value={f.km} onChange={ev => set("km", ev.target.value)} placeholder="Se toma de Wialon" /></div>
          <div><label style={lbl}>Taller / proveedor</label><input style={inp} value={f.taller} onChange={ev => set("taller", ev.target.value)} /></div>
          <div><label style={lbl}>Mano de obra (S/)</label><input type="number" style={inp} value={f.costo_mano_obra} onChange={ev => set("costo_mano_obra", ev.target.value)} /></div>
          <div><label style={lbl}>Total</label><div style={{ ...inp, display: "flex", alignItems: "center", fontWeight: 800, background: "#F9FAFB" }}>{fmtSol(total)}</div></div>
          <div style={{ gridColumn: "1 / -1" }}>
            <label style={lbl}>Repuestos e insumos</label>
            {f.repuestos.map((r, i) => (
              <div key={i} style={{ display: "grid", gridTemplateColumns: "1fr 80px 120px 34px", gap: 8, marginBottom: 6 }}>
                <input style={inp} placeholder="Descripción" value={r.descripcion} onChange={ev => setRep(i, "descripcion", ev.target.value)} />
                <input type="number" style={inp} placeholder="Cant." value={r.cantidad} onChange={ev => setRep(i, "cantidad", ev.target.value)} />
                <input type="number" style={inp} placeholder="Costo S/" value={r.costo} onChange={ev => setRep(i, "costo", ev.target.value)} />
                <button style={{ ...btnS, padding: 0, justifyContent: "center", color: "#DC2626" }} onClick={() => setF(p => ({ ...p, repuestos: p.repuestos.filter((_, j) => j !== i) }))}><X size={14} /></button>
              </div>
            ))}
            <button style={{ ...btnS, padding: "6px 10px", fontSize: 12 }} onClick={() => setF(p => ({ ...p, repuestos: [...p.repuestos, { descripcion: "", cantidad: 1, costo: "" }] }))}><Plus size={13} /> Agregar repuesto</button>
          </div>
          <div style={{ gridColumn: "1 / -1" }}><label style={lbl}>Notas</label><textarea style={{ ...inp, height: 70, padding: 10 }} value={f.notas} onChange={ev => set("notas", ev.target.value)} /></div>
        </div>
      </div>
    </div>
  );
}

// ─── Modal: tarea del plan ─────────────────────────────────────────────────
function ModalIntervalo({ init, unidades, onClose, onSaved }) {
  const [f, setF] = useState({
    nombre: init.nombre || "", categoria: init.categoria || "General", cada_km: init.cada_km || "", cada_dias: init.cada_dias || "",
    aviso_km: init.aviso_km || "", aviso_dias: init.aviso_dias || "", placas: (init.placas || []).join(", "), activo: init.activo !== false,
  });
  const [saving, setSaving] = useState(false);
  const set = (k, v) => setF(p => ({ ...p, [k]: v }));
  const guardar = async () => {
    if (!f.nombre.trim()) return alert("Nombre de la tarea");
    if (!Number(f.cada_km) && !Number(f.cada_dias)) return alert("Indica cada cuántos km o cada cuántos días");
    setSaving(true);
    try {
      const body = { nombre: f.nombre.trim(), categoria: f.categoria || "General", cada_km: Number(f.cada_km) || 0, cada_dias: Number(f.cada_dias) || 0,
        aviso_km: Number(f.aviso_km) || 0, aviso_dias: Number(f.aviso_dias) || 0, activo: !!f.activo,
        placas: f.placas.split(",").map(x => x.trim()).filter(Boolean) };
      if (init.id) await api.put(`/mantenimiento/intervalos/${init.id}`, body); else await api.post("/mantenimiento/intervalos", body);
      onSaved(init.id ? "Tarea actualizada" : "Tarea agregada al plan");
    } catch (err) { alert(err.response?.data?.detail || err.message); }
    finally { setSaving(false); }
  };
  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(17,24,39,.45)", zIndex: 50, display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }} onClick={onClose}>
      <div style={{ background: "#fff", borderRadius: 16, width: 560, maxWidth: "100%", boxShadow: "0 20px 50px rgba(0,0,0,.2)" }} onClick={ev => ev.stopPropagation()} data-testid="mtto-modal-intervalo">
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "16px 20px", borderBottom: "1px solid #E5E7EB" }}>
          <div style={{ fontWeight: 800, fontSize: 16 }}>{init.id ? "Editar tarea" : "Nueva tarea del plan"}</div>
          <div style={{ display: "flex", gap: 8 }}><button style={btnS} onClick={onClose}>Cancelar</button><button style={btnP} onClick={guardar} disabled={saving}>Guardar</button></div>
        </div>
        <div style={{ padding: 20, display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
          <div style={{ gridColumn: "1 / -1" }}><label style={lbl}>Tarea *</label><input style={inp} value={f.nombre} onChange={ev => set("nombre", ev.target.value)} placeholder="Ej. Cambio de aceite" /></div>
          <div><label style={lbl}>Categoría</label><input style={inp} value={f.categoria} onChange={ev => set("categoria", ev.target.value)} placeholder="Motor, Frenos, Neumáticos…" /></div>
          <div><label style={lbl}>Activa</label><select style={inp} value={f.activo ? "1" : "0"} onChange={ev => set("activo", ev.target.value === "1")}><option value="1">Sí</option><option value="0">No</option></select></div>
          <div><label style={lbl}>Cada (km)</label><input type="number" style={inp} value={f.cada_km} onChange={ev => set("cada_km", ev.target.value)} placeholder="10000" /></div>
          <div><label style={lbl}>Cada (días)</label><input type="number" style={inp} value={f.cada_dias} onChange={ev => set("cada_dias", ev.target.value)} placeholder="180" /></div>
          <div><label style={lbl}>Avisar (km antes)</label><input type="number" style={inp} value={f.aviso_km} onChange={ev => set("aviso_km", ev.target.value)} placeholder="1000" /></div>
          <div><label style={lbl}>Avisar (días antes)</label><input type="number" style={inp} value={f.aviso_dias} onChange={ev => set("aviso_dias", ev.target.value)} placeholder="15" /></div>
          <div style={{ gridColumn: "1 / -1" }}><label style={lbl}>Solo para estas placas (vacío = toda la flota)</label><input style={inp} value={f.placas} onChange={ev => set("placas", ev.target.value)} placeholder={unidades.slice(0, 3).map(u => u.placa).join(", ")} /></div>
        </div>
      </div>
    </div>
  );
}
