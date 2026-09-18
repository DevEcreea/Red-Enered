import React, { useEffect, useMemo, useState, useCallback } from "react";
import { api } from "../lib/api";
import {
  Route, Plus, Loader2, Pencil, Trash2, MapPin, Truck, PlayCircle, CheckCircle2, XCircle, Clock, Search,
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
const seccion = { gridColumn: "1 / -1", fontSize: 12, fontWeight: 800, color: "#8039F4", textTransform: "uppercase", letterSpacing: ".04em", marginTop: 8, paddingTop: 8, borderTop: "1px solid #F0F0F0" };

const MOTIVOS_TRASLADO = [
  { v: "01", l: "01 · Venta" },
  { v: "02", l: "02 · Compra" },
  { v: "04", l: "04 · Traslado entre establecimientos de la misma empresa" },
  { v: "08", l: "08 · Importación" },
  { v: "09", l: "09 · Exportación" },
  { v: "13", l: "13 · Otros" },
  { v: "14", l: "14 · Venta sujeta a confirmación del comprador" },
];

export default function Viajes() {
  const [viajes, setViajes] = useState([]);
  const [flota, setFlota] = useState([]);
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
  useEffect(() => {
    api.get("/vehiculos").then(({ data }) => setFlota(Array.isArray(data) ? data : []))
      .catch(() => setFlota([]));
  }, []);
  const placasFlota = useMemo(() => {
    const vistas = new Set();
    const out = [];
    for (const v of flota) {
      const p = (v.placa || v.veh || "").toUpperCase().replace(/[^A-Z0-9]/g, "");
      if (!p || vistas.has(p)) continue;
      vistas.add(p);
      out.push({ placa: p, marca: v.marca || "", modelo: v.modelo || "" });
    }
    return out.sort((a, b) => a.placa.localeCompare(b.placa));
  }, [flota]);

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

      {modal && <ModalViaje init={modal} placasFlota={placasFlota} onClose={() => setModal(null)} onSaved={(m) => { setModal(null); aviso(m); cargar(); }} />}
      {toast && <div style={{ position: "fixed", bottom: 24, right: 24, background: "#111827", color: "#fff", padding: "10px 16px", borderRadius: 10, fontSize: 13, zIndex: 60 }}>{toast}</div>}
    </div>
  );
}

function ModalViaje({ init, placasFlota, onClose, onSaved }) {
  const [f, setF] = useState({
    placa: init.placa || "", placa_carreta: init.placa_carreta || "",
    conductor_dni: init.conductor_dni || "", conductor_nombre: init.conductor_nombre || "", conductor_licencia: init.conductor_licencia || "",
    origen: init.origen || "", destino: init.destino || "", fecha_salida: init.fecha_salida || hoyIso(),
    hora_salida: init.hora_salida || "", guia_remision: init.guia_remision || "", notas: init.notas || "",
    estado: init.estado || "planificado",
    motivo_traslado: init.motivo_traslado || "04",
    remitente_ruc: init.remitente_ruc || "", remitente_razon_social: init.remitente_razon_social || "",
    destinatario_tipo_doc: init.destinatario_tipo_doc || "RUC", destinatario_num_doc: init.destinatario_num_doc || "",
    destinatario_razon_social: init.destinatario_razon_social || "",
    punto_partida_direccion: init.punto_partida_direccion || "", punto_partida_ubigeo: init.punto_partida_ubigeo || "",
    punto_llegada_direccion: init.punto_llegada_direccion || "", punto_llegada_ubigeo: init.punto_llegada_ubigeo || "",
    peso_bruto_kg: init.peso_bruto_kg ?? "", num_bultos: init.num_bultos ?? "",
    descripcion_bienes: init.descripcion_bienes || "", doc_relacionado: init.doc_relacionado || "",
  });
  const [saving, setSaving] = useState(false);
  const set = (k, v) => setF((p) => ({ ...p, [k]: v }));

  const guardar = async () => {
    if (!f.placa.trim()) return alert("Indica la placa");
    if (!f.origen.trim() || !f.destino.trim()) return alert("Indica origen y destino");
    setSaving(true);
    try {
      const body = { ...f, peso_bruto_kg: f.peso_bruto_kg === "" ? null : Number(f.peso_bruto_kg), num_bultos: f.num_bultos === "" ? null : Number(f.num_bultos) };
      if (init.id) await api.put(`/viajes/${init.id}`, body); else await api.post("/viajes", body);
      onSaved(init.id ? "Viaje actualizado" : "Viaje creado");
    } catch (err) { alert(err.response?.data?.detail || err.message); }
    finally { setSaving(false); }
  };

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(17,24,39,.45)", zIndex: 50, display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }} onClick={onClose}>
      <div style={{ background: "#fff", borderRadius: 16, width: 720, maxWidth: "100%", maxHeight: "92vh", overflow: "auto", boxShadow: "0 20px 50px rgba(0,0,0,.2)" }} onClick={(ev) => ev.stopPropagation()}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "16px 20px", borderBottom: "1px solid #E5E7EB", position: "sticky", top: 0, background: "#fff", zIndex: 1 }}>
          <div style={{ fontWeight: 800, fontSize: 16 }}>{init.id ? "Editar viaje" : "Nuevo viaje"}</div>
          <div style={{ display: "flex", gap: 8 }}><button style={btnS} onClick={onClose}>Cancelar</button><button style={btnP} onClick={guardar} disabled={saving}>{saving && <Loader2 size={15} className="animate-spin" />} Guardar</button></div>
        </div>
        <div style={{ padding: 20, display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
          <div style={seccion}>Datos del viaje</div>
          <div><label style={lbl}>Placa (unidad) *</label>
            <select style={inp} value={f.placa} onChange={(e) => set("placa", e.target.value)}>
              <option value="">Selecciona una placa…</option>
              {placasFlota.map((v) => <option key={v.placa} value={v.placa}>{v.placa}{v.marca ? ` · ${v.marca} ${v.modelo || ""}`.trimEnd() : ""}</option>)}
              {f.placa && !placasFlota.some((v) => v.placa === f.placa) && <option value={f.placa}>{f.placa} (no está en tu flota)</option>}
            </select></div>
          <div><label style={lbl}>Placa de carreta / semirremolque</label>
            <select style={inp} value={f.placa_carreta} onChange={(e) => set("placa_carreta", e.target.value)}>
              <option value="">— No aplica —</option>
              {placasFlota.filter((v) => v.placa !== f.placa).map((v) => <option key={v.placa} value={v.placa}>{v.placa}</option>)}
            </select></div>
          <div><label style={lbl}>Origen *</label><input style={inp} value={f.origen} onChange={(e) => set("origen", e.target.value)} placeholder="Ciudad / punto de partida" /></div>
          <div><label style={lbl}>Destino *</label><input style={inp} value={f.destino} onChange={(e) => set("destino", e.target.value)} placeholder="Ciudad / punto de llegada" /></div>
          <div><label style={lbl}>Fecha de salida</label><input type="date" style={inp} value={f.fecha_salida} onChange={(e) => set("fecha_salida", e.target.value)} /></div>
          <div><label style={lbl}>Hora de salida</label><input type="time" style={inp} value={f.hora_salida} onChange={(e) => set("hora_salida", e.target.value)} /></div>
          <div><label style={lbl}>Estado</label>
            <select style={inp} value={f.estado} onChange={(e) => set("estado", e.target.value)}>
              {Object.entries(ESTADO).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
            </select></div>
          <div><label style={lbl}>N° de guía de remisión</label><input style={inp} value={f.guia_remision} onChange={(e) => set("guia_remision", e.target.value)} placeholder="Serie-número, si ya la emitiste" /></div>

          <div style={seccion}>Conductor</div>
          <div><label style={lbl}>DNI</label><input style={inp} value={f.conductor_dni} onChange={(e) => set("conductor_dni", e.target.value.replace(/\D/g, "").slice(0, 8))} /></div>
          <div><label style={lbl}>Nombre completo</label><input style={inp} value={f.conductor_nombre} onChange={(e) => set("conductor_nombre", e.target.value)} /></div>
          <div style={{ gridColumn: "1 / -1" }}><label style={lbl}>N° de licencia de conducir</label><input style={inp} value={f.conductor_licencia} onChange={(e) => set("conductor_licencia", e.target.value)} /></div>

          <ContactoBox
            titulo="Remitente (punto de partida)" f={f} set={set} tipoDocFijo="RUC"
            numDocKey="remitente_ruc" razonSocialKey="remitente_razon_social"
            direccionKey="punto_partida_direccion" ubigeoKey="punto_partida_ubigeo" cortoKey="origen"
          />
          <ContactoBox
            titulo="Destinatario (punto de llegada)" f={f} set={set}
            tipoDocKey="destinatario_tipo_doc" numDocKey="destinatario_num_doc" razonSocialKey="destinatario_razon_social"
            direccionKey="punto_llegada_direccion" ubigeoKey="punto_llegada_ubigeo" cortoKey="destino"
          />

          <div style={seccion}>Carga transportada</div>
          <div><label style={lbl}>Motivo de traslado</label>
            <select style={inp} value={f.motivo_traslado} onChange={(e) => set("motivo_traslado", e.target.value)}>
              {MOTIVOS_TRASLADO.map((m) => <option key={m.v} value={m.v}>{m.l}</option>)}
            </select></div>
          <div><label style={lbl}>Documento relacionado</label><input style={inp} value={f.doc_relacionado} onChange={(e) => set("doc_relacionado", e.target.value)} placeholder="Factura / guía remitente" /></div>
          <div><label style={lbl}>Peso bruto total (kg)</label><input type="number" min="0" style={inp} value={f.peso_bruto_kg} onChange={(e) => set("peso_bruto_kg", e.target.value)} /></div>
          <div><label style={lbl}>N° de bultos</label><input type="number" min="0" style={inp} value={f.num_bultos} onChange={(e) => set("num_bultos", e.target.value)} /></div>
          <div style={{ gridColumn: "1 / -1" }}><label style={lbl}>Descripción de los bienes transportados</label><textarea style={{ ...inp, height: 54, padding: 10 }} value={f.descripcion_bienes} onChange={(e) => set("descripcion_bienes", e.target.value)} /></div>
          <div style={{ gridColumn: "1 / -1" }}><label style={lbl}>Notas internas</label><textarea style={{ ...inp, height: 54, padding: 10 }} value={f.notas} onChange={(e) => set("notas", e.target.value)} /></div>
        </div>
      </div>
    </div>
  );
}

/**
 * RUC/DNI + razón social + libreta de direcciones guardadas de ese contacto
 * (estilo Odoo): busca la ficha en SUNAT, deja elegir una dirección estándar
 * ya guardada o crear una nueva, que queda disponible para la próxima vez.
 */
function ContactoBox({ titulo, f, set, tipoDocFijo, tipoDocKey, numDocKey, razonSocialKey, direccionKey, ubigeoKey, cortoKey }) {
  const tipoDoc = tipoDocFijo || f[tipoDocKey] || "RUC";
  const [contacto, setContacto] = useState(null);
  const [buscando, setBuscando] = useState(false);
  const [modoNueva, setModoNueva] = useState(false);
  const [nEtiqueta, setNEtiqueta] = useState("");
  const [nDireccion, setNDireccion] = useState("");
  const [guardando, setGuardando] = useState(false);

  const buscar = async () => {
    const doc = (f[numDocKey] || "").trim();
    const largoOk = tipoDoc === "RUC" ? doc.length === 11 : doc.length === 8;
    if (!largoOk) return;
    setBuscando(true);
    if (tipoDoc === "RUC") {
      try {
        const { data } = await api.get(`/ruc/${doc}`);
        if (data.razon_social) set(razonSocialKey, data.razon_social);
      } catch { /* SUNAT no respondió a tiempo, se completa a mano */ }
    }
    try {
      const { data } = await api.get(`/contactos/${doc}`);
      setContacto(data);
    } catch { setContacto(null); }
    setBuscando(false);
  };

  const elegir = (d) => {
    set(direccionKey, d.direccion);
    if (ubigeoKey) set(ubigeoKey, d.ubigeo || "");
    if (cortoKey) set(cortoKey, d.etiqueta);
  };

  const guardarDireccion = async () => {
    const doc = (f[numDocKey] || "").trim();
    if (!doc) return alert(`Ingresa el ${tipoDoc} primero`);
    if (!(f[razonSocialKey] || "").trim()) return alert("Completa la razón social / nombre primero");
    if (!nEtiqueta.trim() || !nDireccion.trim()) return alert("Completa la etiqueta y la dirección");
    setGuardando(true);
    try {
      await api.post("/contactos", { tipo_doc: tipoDoc, num_doc: doc, razon_social: f[razonSocialKey] });
      const { data } = await api.post(`/contactos/${doc}/direcciones`, { etiqueta: nEtiqueta, direccion: nDireccion });
      setContacto((p) => ({ ...(p || { direcciones: [] }), direcciones: [...(((p || {}).direcciones) || []), data] }));
      elegir(data);
      setModoNueva(false); setNEtiqueta(""); setNDireccion("");
    } catch (err) { alert(err.response?.data?.detail || err.message); }
    finally { setGuardando(false); }
  };

  return (
    <>
      <div style={seccion}>{titulo}</div>
      {!tipoDocFijo && (
        <div><label style={lbl}>Tipo de documento</label>
          <select style={inp} value={f[tipoDocKey]} onChange={(e) => set(tipoDocKey, e.target.value)}>
            <option value="RUC">RUC</option><option value="DNI">DNI</option>
          </select></div>
      )}
      <div style={tipoDocFijo ? { gridColumn: "1 / -1" } : {}}>
        <label style={lbl}>{tipoDoc}</label>
        <div style={{ display: "flex", gap: 6 }}>
          <input style={inp} value={f[numDocKey]} onChange={(e) => set(numDocKey, e.target.value.replace(/\D/g, "").slice(0, tipoDoc === "RUC" ? 11 : 8))} onBlur={buscar} />
          <button type="button" style={{ ...btnS, padding: "0 12px" }} onClick={buscar} disabled={buscando}>{buscando ? <Loader2 size={13} className="animate-spin" /> : <Search size={13} />}</button>
        </div>
      </div>
      <div style={{ gridColumn: "1 / -1" }}><label style={lbl}>Razón social / nombre</label><input style={inp} value={f[razonSocialKey]} onChange={(e) => set(razonSocialKey, e.target.value)} /></div>
      <div style={{ gridColumn: "1 / -1" }}>
        <label style={lbl}>Dirección</label>
        <select style={inp} value="" onChange={(e) => {
          const v = e.target.value;
          if (!v) return;
          if (v === "__nueva__") setModoNueva(true);
          else { const d = (contacto?.direcciones || []).find((x) => x.id === v); if (d) elegir(d); }
        }}>
          <option value="">{(contacto?.direcciones || []).length ? "Elige una dirección guardada…" : "Sin direcciones guardadas todavía"}</option>
          {(contacto?.direcciones || []).map((d) => <option key={d.id} value={d.id}>{d.etiqueta} — {d.direccion}</option>)}
          <option value="__nueva__">+ Añadir otra dirección…</option>
        </select>
        {modoNueva && (
          <div style={{ display: "flex", flexDirection: "column", gap: 6, background: "#FAFAFA", padding: 10, borderRadius: 8, marginTop: 6 }}>
            <input style={inp} placeholder="Etiqueta (ej. Almacén Lima Norte)" value={nEtiqueta} onChange={(e) => setNEtiqueta(e.target.value)} />
            <input style={inp} placeholder="Dirección completa" value={nDireccion} onChange={(e) => setNDireccion(e.target.value)} />
            <div style={{ display: "flex", gap: 6 }}>
              <button type="button" style={btnP} onClick={guardarDireccion} disabled={guardando}>{guardando && <Loader2 size={13} className="animate-spin" />} Guardar dirección</button>
              <button type="button" style={btnS} onClick={() => { setModoNueva(false); setNEtiqueta(""); setNDireccion(""); }}>Cancelar</button>
            </div>
          </div>
        )}
        <input style={{ ...inp, marginTop: 6 }} placeholder="Dirección (puedes escribirla directamente)" value={f[direccionKey]} onChange={(e) => set(direccionKey, e.target.value)} />
      </div>
    </>
  );
}
