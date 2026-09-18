import React, { useEffect, useMemo, useState, useCallback } from "react";
import { api } from "../lib/api";
import {
  CircleDot, Plus, Loader2, Pencil, Trash2, Truck, AlertTriangle, CheckCircle2, PackageSearch,
  Wrench, Recycle, XCircle, ChevronDown, ChevronRight, Ruler,
} from "lucide-react";

const fmtFecha = (s) => {
  if (!s) return "—";
  const d = new Date(s);
  return isNaN(d) ? s : d.toLocaleDateString("es-PE", { day: "2-digit", month: "2-digit", year: "numeric" });
};
const fmtMm = (n) => (n == null ? "—" : `${Number(n).toFixed(1)} mm`);

const ALERTA = {
  critico: { label: "Crítico", bg: "#FEE2E2", fg: "#B91C1C", dot: "#DC2626" },
  proximo: { label: "Por cambiar", bg: "#FEF3C7", fg: "#B45309", dot: "#F59E0B" },
  ok: { label: "Bien", bg: "#DCFCE7", fg: "#15803D", dot: "#22C55E" },
  "—": { label: "Sin dato", bg: "#F3F4F6", fg: "#6B7280", dot: "#9CA3AF" },
};
const ESTADO_LABEL = {
  en_uso: "En uso", reencauchada: "Reencauchada", almacen: "En almacén", desechada: "Desechada",
};
const Chip = ({ alerta }) => {
  const a = ALERTA[alerta] || ALERTA["—"];
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 6, background: a.bg, color: a.fg, borderRadius: 999, padding: "3px 9px", fontSize: 11, fontWeight: 700, whiteSpace: "nowrap" }}>
      <span style={{ width: 7, height: 7, borderRadius: 99, background: a.dot }} /> {a.label}
    </span>
  );
};

const card = { background: "#fff", border: "1px solid #E5E7EB", borderRadius: 16, padding: 20, boxShadow: "0 1px 2px rgba(0,0,0,.04)" };
const th = { textAlign: "left", fontSize: 11, letterSpacing: ".06em", textTransform: "uppercase", color: "#9CA3AF", fontWeight: 700, padding: "10px 12px", borderBottom: "1px solid #E5E7EB", whiteSpace: "nowrap" };
const td = { padding: "10px 12px", borderBottom: "1px solid #F3F4F6", fontSize: 13, color: "#111827", verticalAlign: "top" };
const btnP = { background: "#8039F4", color: "#fff", border: "none", borderRadius: 10, padding: "9px 14px", fontSize: 13, fontWeight: 700, cursor: "pointer", display: "inline-flex", alignItems: "center", gap: 6 };
const btnS = { background: "#fff", color: "#374151", border: "1px solid #D1D5DB", borderRadius: 10, padding: "9px 14px", fontSize: 13, fontWeight: 600, cursor: "pointer", display: "inline-flex", alignItems: "center", gap: 6 };
const btnMini = { ...btnS, padding: "5px 8px", fontSize: 12 };
const inp = { width: "100%", height: 38, border: "1px solid #E5E7EB", borderRadius: 8, padding: "0 12px", fontSize: 13, color: "#374151", boxSizing: "border-box", outline: "none", background: "#fff" };
const lbl = { fontSize: 11, color: "#6B7280", marginBottom: 4, display: "block", fontWeight: 600 };

const POSICIONES = ["1-Izq", "1-Der", "2-Izq-Ext", "2-Izq-Int", "2-Der-Ext", "2-Der-Int", "3-Izq-Ext", "3-Izq-Int", "3-Der-Ext", "3-Der-Int", "Repuesto"];

export default function Neumaticos() {
  const [tab, setTab] = useState("unidad");
  const [neumaticos, setNeumaticos] = useState([]);
  const [kpis, setKpis] = useState(null);
  const [flota, setFlota] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [filtroPlaca, setFiltroPlaca] = useState("");
  const [filtroEstado, setFiltroEstado] = useState("");
  const [abierta, setAbierta] = useState({});
  const [modalNuevo, setModalNuevo] = useState(false);
  const [modalAccion, setModalAccion] = useState(null); // { tipo, neu }
  const [modalEditar, setModalEditar] = useState(null);
  const [toast, setToast] = useState("");

  const aviso = (m) => { setToast(m); setTimeout(() => setToast(""), 2600); };

  const cargar = useCallback(async () => {
    setLoading(true); setError("");
    try {
      const [n, k] = await Promise.all([api.get("/neumaticos"), api.get("/neumaticos/kpis")]);
      setNeumaticos(n.data.neumaticos || []); setKpis(k.data);
    } catch (e) { setError(e.response?.data?.detail || e.message); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => { cargar(); }, [cargar]);
  useEffect(() => {
    api.get("/vehiculos").then(({ data }) => setFlota(Array.isArray(data) ? data : [])).catch(() => setFlota([]));
  }, []);

  const placasFlota = useMemo(() => {
    const vistas = new Set(); const out = [];
    for (const v of flota) {
      const p = (v.placa || v.veh || "").toUpperCase().replace(/[^A-Z0-9]/g, "");
      if (!p || vistas.has(p)) continue;
      vistas.add(p); out.push(p);
    }
    return out.sort();
  }, [flota]);

  const porUnidad = useMemo(() => {
    const map = {};
    for (const n of neumaticos) {
      if (n.estado === "desechada" || !n.placa) continue;
      (map[n.placa] = map[n.placa] || []).push(n);
    }
    for (const p of placasFlota) if (!map[p]) map[p] = [];
    let placas = Object.keys(map);
    if (filtroPlaca) placas = placas.filter((p) => p.includes(filtroPlaca.toUpperCase().replace(/[^A-Z0-9]/g, "")));
    return placas.sort().map((p) => ({ placa: p, neus: map[p] }));
  }, [neumaticos, placasFlota, filtroPlaca]);

  const inventario = useMemo(() => neumaticos.filter((n) => {
    if (filtroPlaca && !(n.placa || "").includes(filtroPlaca.toUpperCase().replace(/[^A-Z0-9]/g, ""))) return false;
    if (filtroEstado && n.estado !== filtroEstado) return false;
    return true;
  }), [neumaticos, filtroPlaca, filtroEstado]);

  const borrar = async (n) => {
    if (!window.confirm(`¿Eliminar el neumático ${n.codigo}?`)) return;
    try { await api.delete(`/neumaticos/${n.id}`); aviso("Neumático eliminado"); cargar(); }
    catch (e) { alert(e.response?.data?.detail || e.message); }
  };

  if (loading) return (
    <div style={{ minHeight: 320, display: "flex", alignItems: "center", justifyContent: "center", color: "#8039F4" }}>
      <Loader2 className="w-8 h-8 animate-spin" />
    </div>
  );

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 18 }} data-testid="neumaticos">
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 12 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <div style={{ width: 44, height: 44, borderRadius: 12, background: "#8039F41A", color: "#8039F4", display: "flex", alignItems: "center", justifyContent: "center" }}><CircleDot size={22} /></div>
          <div>
            <div className="font-cabinet" style={{ fontSize: 22, fontWeight: 800, color: "#111827", lineHeight: 1.1 }}>Neumáticos</div>
            <div style={{ fontSize: 12, color: "#6B7280" }}>Control de profundidad, rotaciones y reencauches por unidad</div>
          </div>
        </div>
        <button style={btnP} onClick={() => setModalNuevo(true)} data-testid="neu-nuevo"><Plus size={15} /> Nuevo neumático</button>
      </div>

      {error && <div style={{ ...card, borderColor: "#FCA5A5", background: "#FEF2F2", color: "#B91C1C", fontSize: 13 }}>{error}</div>}

      {kpis && (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: 12 }}>
          {[
            { label: "En uso", value: kpis.en_uso, icon: CircleDot, color: "#8039F4" },
            { label: "Críticos", value: kpis.criticos, icon: AlertTriangle, color: "#DC2626" },
            { label: "Por cambiar", value: kpis.proximos, icon: Wrench, color: "#F59E0B" },
            { label: "En almacén", value: kpis.en_almacen, icon: PackageSearch, color: "#3B82F6" },
            { label: "Desechados", value: kpis.desechados, icon: XCircle, color: "#6B7280" },
          ].map((k) => (
            <div key={k.label} style={{ ...card, padding: 14, display: "flex", gap: 10, alignItems: "center" }}>
              <div style={{ width: 34, height: 34, borderRadius: 9, background: k.color + "1A", color: k.color, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}><k.icon size={16} /></div>
              <div>
                <div style={{ fontSize: 10, color: "#6B7280", fontWeight: 600, textTransform: "uppercase", letterSpacing: ".04em" }}>{k.label}</div>
                <div className="font-cabinet" style={{ fontSize: 20, fontWeight: 800, color: "#111827", lineHeight: 1.1 }}>{k.value}</div>
              </div>
            </div>
          ))}
        </div>
      )}

      <div style={{ display: "flex", gap: 8 }}>
        <button style={tab === "unidad" ? btnP : btnS} onClick={() => setTab("unidad")}>Por unidad</button>
        <button style={tab === "inventario" ? btnP : btnS} onClick={() => setTab("inventario")}>Inventario</button>
      </div>

      {tab === "unidad" ? (
        <div style={{ ...card, padding: 0, overflow: "hidden" }}>
          <div style={{ padding: "14px 16px" }}>
            <input style={{ ...inp, width: 220 }} placeholder="Filtrar por placa…" value={filtroPlaca} onChange={(e) => setFiltroPlaca(e.target.value)} />
          </div>
          {porUnidad.length === 0 && <div style={{ ...td, color: "#9CA3AF", textAlign: "center", padding: 30 }}>No hay unidades para mostrar.</div>}
          {porUnidad.map(({ placa, neus }) => {
            const abierto = !!abierta[placa];
            const peor = neus.some((n) => n.alerta === "critico") ? "critico" : neus.some((n) => n.alerta === "proximo") ? "proximo" : neus.length ? "ok" : "—";
            return (
              <div key={placa} style={{ borderTop: "1px solid #F0F0F0" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "12px 16px", cursor: "pointer", background: abierto ? "#F5F3FF" : "#fff" }} onClick={() => setAbierta((p) => ({ ...p, [placa]: !abierto }))}>
                  {abierto ? <ChevronDown size={15} color="#8039F4" /> : <ChevronRight size={15} color="#9CA3AF" />}
                  <Truck size={14} color="#6B7280" />
                  <div style={{ fontWeight: 800, fontSize: 14 }}>{placa}</div>
                  <div style={{ fontSize: 12, color: "#9CA3AF" }}>{neus.length} neumático{neus.length === 1 ? "" : "s"} instalado{neus.length === 1 ? "" : "s"}</div>
                  <div style={{ marginLeft: "auto" }}><Chip alerta={peor} /></div>
                </div>
                {abierto && (
                  <div style={{ padding: "0 16px 14px 40px" }}>
                    {neus.length === 0 ? (
                      <div style={{ fontSize: 12, color: "#9CA3AF", padding: "8px 0" }}>Sin neumáticos registrados en esta unidad. Usa "Instalar" desde el inventario.</div>
                    ) : (
                      <table style={{ width: "100%", borderCollapse: "collapse" }}>
                        <thead><tr><th style={th}>Posición</th><th style={th}>Código</th><th style={th}>Marca / medida</th><th style={th}>Profundidad</th><th style={th}>Estado</th><th style={{ ...th, textAlign: "right" }}>Acciones</th></tr></thead>
                        <tbody>
                          {neus.sort((a, b) => (a.posicion || "").localeCompare(b.posicion || "")).map((n) => (
                            <FilaNeumatico key={n.id} n={n} onAccion={(tipo) => setModalAccion({ tipo, neu: n })} onEditar={() => setModalEditar(n)} onBorrar={() => borrar(n)} />
                          ))}
                        </tbody>
                      </table>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      ) : (
        <div style={{ ...card, padding: 0, overflow: "hidden" }}>
          <div style={{ display: "flex", gap: 10, padding: "14px 16px", flexWrap: "wrap" }}>
            <input style={{ ...inp, width: 200 }} placeholder="Filtrar por placa…" value={filtroPlaca} onChange={(e) => setFiltroPlaca(e.target.value)} />
            <select style={{ ...inp, width: 180 }} value={filtroEstado} onChange={(e) => setFiltroEstado(e.target.value)}>
              <option value="">Todos los estados</option>
              {Object.entries(ESTADO_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
          </div>
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 900 }}>
              <thead><tr><th style={th}>Código</th><th style={th}>Marca / medida</th><th style={th}>Unidad</th><th style={th}>Profundidad</th><th style={th}>Reencauches</th><th style={th}>Estado</th><th style={{ ...th, textAlign: "right" }}>Acciones</th></tr></thead>
              <tbody>
                {inventario.length === 0 && <tr><td colSpan={7} style={{ ...td, color: "#9CA3AF", textAlign: "center", padding: 30 }}>No hay neumáticos registrados.</td></tr>}
                {inventario.map((n) => (
                  <FilaNeumatico key={n.id} n={n} inventario onAccion={(tipo) => setModalAccion({ tipo, neu: n })} onEditar={() => setModalEditar(n)} onBorrar={() => borrar(n)} />
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {modalNuevo && <ModalNuevo placasFlota={placasFlota} onClose={() => setModalNuevo(false)} onSaved={(m) => { setModalNuevo(false); aviso(m); cargar(); }} />}
      {modalEditar && <ModalEditar neu={modalEditar} onClose={() => setModalEditar(null)} onSaved={(m) => { setModalEditar(null); aviso(m); cargar(); }} />}
      {modalAccion && <ModalAccion tipo={modalAccion.tipo} neu={modalAccion.neu} placasFlota={placasFlota} onClose={() => setModalAccion(null)} onSaved={(m) => { setModalAccion(null); aviso(m); cargar(); }} />}
      {toast && <div style={{ position: "fixed", bottom: 24, right: 24, background: "#111827", color: "#fff", padding: "10px 16px", borderRadius: 10, fontSize: 13, zIndex: 60 }}>{toast}</div>}
    </div>
  );
}

function FilaNeumatico({ n, inventario, onAccion, onEditar, onBorrar }) {
  return (
    <tr>
      {inventario && <td style={{ ...td, fontWeight: 700 }}>{n.codigo}</td>}
      {!inventario && <><td style={{ ...td, fontWeight: 700 }}>{n.posicion || "—"}</td><td style={td}>{n.codigo}</td></>}
      <td style={td}>{n.marca || "—"}{n.medida ? ` · ${n.medida}` : ""}</td>
      {inventario && <td style={td}>{n.placa ? <><Truck size={12} style={{ marginRight: 4, verticalAlign: -1 }} color="#6B7280" />{n.placa}{n.posicion ? ` (${n.posicion})` : ""}</> : <span style={{ color: "#9CA3AF" }}>—</span>}</td>}
      <td style={td}>{fmtMm(n.profundidad_actual_mm)}</td>
      {inventario && <td style={td}>{n.reencauches || 0}</td>}
      <td style={td}>{inventario ? <span style={{ fontSize: 12, color: "#6B7280" }}>{ESTADO_LABEL[n.estado] || n.estado}</span> : <Chip alerta={n.alerta} />}</td>
      <td style={{ ...td, textAlign: "right", whiteSpace: "nowrap" }}>
        {n.estado !== "desechada" && <>
          <button style={{ ...btnMini, marginRight: 4 }} onClick={() => onAccion("medicion")} title="Registrar medición"><Ruler size={12} /></button>
          <button style={{ ...btnMini, marginRight: 4 }} onClick={() => onAccion("instalar")} title="Instalar / rotar">{n.placa ? <Truck size={12} /> : <Plus size={12} />}</button>
          <button style={{ ...btnMini, marginRight: 4 }} onClick={() => onAccion("reencauchar")} title="Reencauchar"><Recycle size={12} /></button>
          <button style={{ ...btnMini, marginRight: 4, color: "#B45309" }} onClick={() => onAccion("baja")} title="Dar de baja"><XCircle size={12} /></button>
        </>}
        <button style={{ ...btnMini, marginRight: 4 }} onClick={onEditar} title="Editar"><Pencil size={12} /></button>
        <button style={{ ...btnMini, color: "#DC2626" }} onClick={onBorrar} title="Eliminar"><Trash2 size={12} /></button>
      </td>
    </tr>
  );
}

function ModalNuevo({ placasFlota, onClose, onSaved }) {
  const [f, setF] = useState({ codigo: "", marca: "", medida: "", profundidad_inicial_mm: "", costo: "", proveedor: "", placa: "", posicion: "", km_instalacion: "" });
  const [saving, setSaving] = useState(false);
  const set = (k, v) => setF((p) => ({ ...p, [k]: v }));

  const guardar = async () => {
    if (!f.codigo.trim()) return alert("Indica el código / DOT del neumático");
    setSaving(true);
    try {
      const body = { ...f, profundidad_inicial_mm: f.profundidad_inicial_mm === "" ? null : Number(f.profundidad_inicial_mm),
        costo: f.costo === "" ? null : Number(f.costo), km_instalacion: f.km_instalacion === "" ? null : Number(f.km_instalacion),
        placa: f.placa || null, posicion: f.posicion || null };
      await api.post("/neumaticos", body);
      onSaved("Neumático registrado");
    } catch (err) { alert(err.response?.data?.detail || err.message); }
    finally { setSaving(false); }
  };

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(17,24,39,.45)", zIndex: 50, display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }} onClick={onClose}>
      <div style={{ background: "#fff", borderRadius: 16, width: 560, maxWidth: "100%", maxHeight: "92vh", overflow: "auto", boxShadow: "0 20px 50px rgba(0,0,0,.2)" }} onClick={(ev) => ev.stopPropagation()}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "16px 20px", borderBottom: "1px solid #E5E7EB" }}>
          <div style={{ fontWeight: 800, fontSize: 16 }}>Nuevo neumático</div>
          <div style={{ display: "flex", gap: 8 }}><button style={btnS} onClick={onClose}>Cancelar</button><button style={btnP} onClick={guardar} disabled={saving}>{saving && <Loader2 size={15} className="animate-spin" />} Guardar</button></div>
        </div>
        <div style={{ padding: 20, display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
          <div><label style={lbl}>Código / DOT *</label><input style={inp} value={f.codigo} onChange={(e) => set("codigo", e.target.value)} /></div>
          <div><label style={lbl}>Marca</label><input style={inp} value={f.marca} onChange={(e) => set("marca", e.target.value)} /></div>
          <div><label style={lbl}>Medida</label><input style={inp} value={f.medida} onChange={(e) => set("medida", e.target.value)} placeholder="295/80R22.5" /></div>
          <div><label style={lbl}>Profundidad inicial (mm)</label><input type="number" step="0.5" min="0" style={inp} value={f.profundidad_inicial_mm} onChange={(e) => set("profundidad_inicial_mm", e.target.value)} placeholder="ej. 16" /></div>
          <div><label style={lbl}>Costo (S/)</label><input type="number" step="0.01" min="0" style={inp} value={f.costo} onChange={(e) => set("costo", e.target.value)} /></div>
          <div><label style={lbl}>Proveedor</label><input style={inp} value={f.proveedor} onChange={(e) => set("proveedor", e.target.value)} /></div>
          <div style={{ gridColumn: "1 / -1", fontSize: 12, fontWeight: 700, color: "#8039F4", marginTop: 4 }}>Instalación inicial (opcional — déjalo vacío para guardarlo en almacén)</div>
          <div><label style={lbl}>Placa</label>
            <select style={inp} value={f.placa} onChange={(e) => set("placa", e.target.value)}>
              <option value="">— En almacén —</option>
              {placasFlota.map((p) => <option key={p} value={p}>{p}</option>)}
            </select></div>
          <div><label style={lbl}>Posición</label>
            <select style={inp} value={f.posicion} onChange={(e) => set("posicion", e.target.value)} disabled={!f.placa}>
              <option value="">Selecciona…</option>
              {POSICIONES.map((p) => <option key={p} value={p}>{p}</option>)}
            </select></div>
          <div style={{ gridColumn: "1 / -1" }}><label style={lbl}>Km al instalar</label><input type="number" min="0" style={inp} value={f.km_instalacion} onChange={(e) => set("km_instalacion", e.target.value)} disabled={!f.placa} /></div>
        </div>
      </div>
    </div>
  );
}

function ModalEditar({ neu, onClose, onSaved }) {
  const [f, setF] = useState({ codigo: neu.codigo || "", marca: neu.marca || "", medida: neu.medida || "", costo: neu.costo ?? "", proveedor: neu.proveedor || "" });
  const [saving, setSaving] = useState(false);
  const set = (k, v) => setF((p) => ({ ...p, [k]: v }));
  const guardar = async () => {
    setSaving(true);
    try {
      await api.put(`/neumaticos/${neu.id}`, { ...f, costo: f.costo === "" ? null : Number(f.costo) });
      onSaved("Neumático actualizado");
    } catch (err) { alert(err.response?.data?.detail || err.message); }
    finally { setSaving(false); }
  };
  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(17,24,39,.45)", zIndex: 50, display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }} onClick={onClose}>
      <div style={{ background: "#fff", borderRadius: 16, width: 480, maxWidth: "100%", boxShadow: "0 20px 50px rgba(0,0,0,.2)" }} onClick={(ev) => ev.stopPropagation()}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "16px 20px", borderBottom: "1px solid #E5E7EB" }}>
          <div style={{ fontWeight: 800, fontSize: 16 }}>Editar neumático</div>
          <div style={{ display: "flex", gap: 8 }}><button style={btnS} onClick={onClose}>Cancelar</button><button style={btnP} onClick={guardar} disabled={saving}>{saving && <Loader2 size={15} className="animate-spin" />} Guardar</button></div>
        </div>
        <div style={{ padding: 20, display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
          <div><label style={lbl}>Código / DOT</label><input style={inp} value={f.codigo} onChange={(e) => set("codigo", e.target.value)} /></div>
          <div><label style={lbl}>Marca</label><input style={inp} value={f.marca} onChange={(e) => set("marca", e.target.value)} /></div>
          <div><label style={lbl}>Medida</label><input style={inp} value={f.medida} onChange={(e) => set("medida", e.target.value)} /></div>
          <div><label style={lbl}>Costo (S/)</label><input type="number" step="0.01" style={inp} value={f.costo} onChange={(e) => set("costo", e.target.value)} /></div>
          <div style={{ gridColumn: "1 / -1" }}><label style={lbl}>Proveedor</label><input style={inp} value={f.proveedor} onChange={(e) => set("proveedor", e.target.value)} /></div>
        </div>
      </div>
    </div>
  );
}

const TITULOS_ACCION = { instalar: "Instalar / rotar neumático", medicion: "Registrar medición", reencauchar: "Registrar reencauche", baja: "Dar de baja" };

function ModalAccion({ tipo, neu, placasFlota, onClose, onSaved }) {
  const [placa, setPlaca] = useState(neu.placa || "");
  const [posicion, setPosicion] = useState(neu.posicion || "");
  const [km, setKm] = useState("");
  const [profundidad, setProfundidad] = useState(neu.profundidad_actual_mm ?? "");
  const [notas, setNotas] = useState("");
  const [proveedor, setProveedor] = useState("");
  const [costo, setCosto] = useState("");
  const [motivo, setMotivo] = useState("");
  const [saving, setSaving] = useState(false);

  const guardar = async () => {
    setSaving(true);
    try {
      if (tipo === "instalar") {
        if (!placa || !posicion) return alert("Elige placa y posición");
        await api.post(`/neumaticos/${neu.id}/instalar`, { placa, posicion, km: km === "" ? null : Number(km) });
      } else if (tipo === "medicion") {
        if (profundidad === "") return alert("Indica la profundidad medida");
        await api.post(`/neumaticos/${neu.id}/medicion`, { profundidad_mm: Number(profundidad), km: km === "" ? null : Number(km), notas });
      } else if (tipo === "reencauchar") {
        if (profundidad === "") return alert("Indica la profundidad tras el reencauche");
        await api.post(`/neumaticos/${neu.id}/reencauchar`, { profundidad_mm: Number(profundidad), proveedor, costo: costo === "" ? null : Number(costo) });
      } else if (tipo === "baja") {
        if (!motivo.trim()) return alert("Indica el motivo de la baja");
        await api.post(`/neumaticos/${neu.id}/baja`, { motivo });
      }
      onSaved("Listo");
    } catch (err) { alert(err.response?.data?.detail || err.message); }
    finally { setSaving(false); }
  };

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(17,24,39,.45)", zIndex: 50, display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }} onClick={onClose}>
      <div style={{ background: "#fff", borderRadius: 16, width: 440, maxWidth: "100%", boxShadow: "0 20px 50px rgba(0,0,0,.2)" }} onClick={(ev) => ev.stopPropagation()}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "16px 20px", borderBottom: "1px solid #E5E7EB" }}>
          <div style={{ fontWeight: 800, fontSize: 16 }}>{TITULOS_ACCION[tipo]} — {neu.codigo}</div>
          <div style={{ display: "flex", gap: 8 }}><button style={btnS} onClick={onClose}>Cancelar</button><button style={btnP} onClick={guardar} disabled={saving}>{saving && <Loader2 size={15} className="animate-spin" />} Confirmar</button></div>
        </div>
        <div style={{ padding: 20, display: "flex", flexDirection: "column", gap: 12 }}>
          {tipo === "instalar" && <>
            <div><label style={lbl}>Placa</label>
              <select style={inp} value={placa} onChange={(e) => setPlaca(e.target.value)}>
                <option value="">Selecciona una placa…</option>
                {placasFlota.map((p) => <option key={p} value={p}>{p}</option>)}
              </select></div>
            <div><label style={lbl}>Posición</label>
              <select style={inp} value={posicion} onChange={(e) => setPosicion(e.target.value)}>
                <option value="">Selecciona…</option>
                {POSICIONES.map((p) => <option key={p} value={p}>{p}</option>)}
              </select></div>
            <div><label style={lbl}>Km actual</label><input type="number" min="0" style={inp} value={km} onChange={(e) => setKm(e.target.value)} /></div>
          </>}
          {tipo === "medicion" && <>
            <div><label style={lbl}>Profundidad medida (mm)</label><input type="number" step="0.5" min="0" style={inp} value={profundidad} onChange={(e) => setProfundidad(e.target.value)} autoFocus /></div>
            <div><label style={lbl}>Km actual</label><input type="number" min="0" style={inp} value={km} onChange={(e) => setKm(e.target.value)} /></div>
            <div><label style={lbl}>Notas</label><input style={inp} value={notas} onChange={(e) => setNotas(e.target.value)} /></div>
          </>}
          {tipo === "reencauchar" && <>
            <div><label style={lbl}>Profundidad tras reencauche (mm)</label><input type="number" step="0.5" min="0" style={inp} value={profundidad} onChange={(e) => setProfundidad(e.target.value)} autoFocus /></div>
            <div><label style={lbl}>Proveedor</label><input style={inp} value={proveedor} onChange={(e) => setProveedor(e.target.value)} /></div>
            <div><label style={lbl}>Costo (S/)</label><input type="number" step="0.01" min="0" style={inp} value={costo} onChange={(e) => setCosto(e.target.value)} /></div>
          </>}
          {tipo === "baja" && <>
            <div><label style={lbl}>Motivo</label><textarea style={{ ...inp, height: 70, padding: 10 }} value={motivo} onChange={(e) => setMotivo(e.target.value)} autoFocus placeholder="Pinchazo irreparable, desgaste irregular, etc." /></div>
          </>}
        </div>
      </div>
    </div>
  );
}
