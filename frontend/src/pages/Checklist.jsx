import React, { useEffect, useMemo, useState, useCallback } from "react";
import { api } from "../lib/api";
import {
  ClipboardCheck, Loader2, CheckCircle2, AlertTriangle, Truck, Camera, X, Settings, Save, Plus, Trash2, Smartphone, Copy, Check,
} from "lucide-react";

const fmtFechaHora = (s) => {
  if (!s) return "—";
  const d = new Date(s);
  return isNaN(d) ? s : d.toLocaleString("es-PE", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });
};

const card = { background: "#fff", border: "1px solid #E5E7EB", borderRadius: 16, padding: 20, boxShadow: "0 1px 2px rgba(0,0,0,.04)" };
const th = { textAlign: "left", fontSize: 11, letterSpacing: ".06em", textTransform: "uppercase", color: "#9CA3AF", fontWeight: 700, padding: "10px 12px", borderBottom: "1px solid #E5E7EB", whiteSpace: "nowrap" };
const td = { padding: "12px 12px", borderBottom: "1px solid #F3F4F6", fontSize: 13, color: "#111827", verticalAlign: "top" };
const btnP = { background: "#8039F4", color: "#fff", border: "none", borderRadius: 10, padding: "9px 14px", fontSize: 13, fontWeight: 700, cursor: "pointer", display: "inline-flex", alignItems: "center", gap: 6 };
const btnS = { background: "#fff", color: "#374151", border: "1px solid #D1D5DB", borderRadius: 10, padding: "9px 14px", fontSize: 13, fontWeight: 600, cursor: "pointer", display: "inline-flex", alignItems: "center", gap: 6 };
const inp = { width: "100%", height: 38, border: "1px solid #E5E7EB", borderRadius: 8, padding: "0 12px", fontSize: 13, color: "#374151", boxSizing: "border-box", outline: "none", background: "#fff" };

const ConformeChip = ({ conforme }) => conforme ? (
  <span style={{ display: "inline-flex", alignItems: "center", gap: 6, background: "#DCFCE7", color: "#15803D", borderRadius: 999, padding: "4px 10px", fontSize: 12, fontWeight: 700 }}>
    <CheckCircle2 size={12} /> Conforme
  </span>
) : (
  <span style={{ display: "inline-flex", alignItems: "center", gap: 6, background: "#FEF2F2", color: "#B91C1C", borderRadius: 999, padding: "4px 10px", fontSize: 12, fontWeight: 700 }}>
    <AlertTriangle size={12} /> Con fallas
  </span>
);

function FotoItem({ itemKey }) {
  const [url, setUrl] = useState(null);
  const [err, setErr] = useState(false);
  useEffect(() => {
    if (!itemKey) return;
    let active = true;
    api.get(`/checklist/foto/${itemKey}`, { responseType: "blob" })
      .then((r) => { if (!active) return; setUrl(URL.createObjectURL(new Blob([r.data], { type: r.headers["content-type"] }))); })
      .catch(() => active && setErr(true));
    return () => { active = false; };
  }, [itemKey]);
  if (err) return <div style={{ fontSize: 11, color: "#9CA3AF" }}>No se pudo cargar la foto</div>;
  if (!url) return <div style={{ width: 90, height: 90, borderRadius: 8, background: "#F3F4F6", display: "flex", alignItems: "center", justifyContent: "center" }}><Loader2 size={16} className="animate-spin" color="#9CA3AF" /></div>;
  return <img src={url} alt="evidencia" style={{ width: 90, height: 90, objectFit: "cover", borderRadius: 8, border: "1px solid #E5E7EB", cursor: "pointer" }} onClick={() => window.open(url, "_blank")} />;
}

function EnlaceConductor() {
  const [copiado, setCopiado] = useState(false);
  const link = `${window.location.origin}/conductor`;
  const copiar = async () => {
    try { await navigator.clipboard.writeText(link); setCopiado(true); setTimeout(() => setCopiado(false), 2000); }
    catch { /* clipboard no disponible, el link ya está visible para copiar a mano */ }
  };
  return (
    <div style={{ ...card, padding: 14, display: "flex", alignItems: "center", gap: 12, background: "#8039F40D", borderColor: "#8039F433", flexWrap: "wrap" }}>
      <div style={{ width: 36, height: 36, borderRadius: 10, background: "#8039F4", color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}><Smartphone size={17} /></div>
      <div style={{ flex: 1, minWidth: 220 }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: "#111827" }}>App del conductor</div>
        <div style={{ fontSize: 12, color: "#6B7280" }}>Compártela con tus choferes: ingresan solo con su DNI, eligen la unidad y el viaje, y llenan el checklist con fotos.</div>
      </div>
      <code style={{ fontSize: 12, background: "#fff", border: "1px solid #E5E7EB", borderRadius: 8, padding: "6px 10px", color: "#374151" }}>{link}</code>
      <button style={btnS} onClick={copiar}>{copiado ? <Check size={14} color="#16A34A" /> : <Copy size={14} />} {copiado ? "Copiado" : "Copiar link"}</button>
      <a href="/conductor" target="_blank" rel="noreferrer" style={{ ...btnP, textDecoration: "none" }}>Abrir</a>
    </div>
  );
}

export default function Checklist() {
  const [envios, setEnvios] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [filtroPlaca, setFiltroPlaca] = useState("");
  const [filtroConforme, setFiltroConforme] = useState("");
  const [expandido, setExpandido] = useState(null);
  const [plantillaAbierta, setPlantillaAbierta] = useState(false);

  const cargar = useCallback(async () => {
    setLoading(true); setError("");
    try {
      const params = {};
      if (filtroPlaca) params.placa = filtroPlaca.toUpperCase().replace(/[^A-Z0-9]/g, "");
      if (filtroConforme) params.conforme = filtroConforme;
      const { data } = await api.get("/checklist/envios", { params });
      setEnvios(data.envios || []);
    } catch (e) { setError(e.response?.data?.detail || e.message); }
    finally { setLoading(false); }
  }, [filtroPlaca, filtroConforme]);
  useEffect(() => { cargar(); }, [cargar]);

  const kpis = useMemo(() => ({
    total: envios.length,
    conformes: envios.filter((e) => e.conforme).length,
    fallas: envios.filter((e) => !e.conforme).length,
  }), [envios]);

  if (loading) return (
    <div style={{ minHeight: 320, display: "flex", alignItems: "center", justifyContent: "center", color: "#8039F4" }}>
      <Loader2 className="w-8 h-8 animate-spin" />
    </div>
  );

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 18 }} data-testid="checklist">
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 12 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <div style={{ width: 44, height: 44, borderRadius: 12, background: "#8039F41A", color: "#8039F4", display: "flex", alignItems: "center", justifyContent: "center" }}><ClipboardCheck size={22} /></div>
          <div>
            <div className="font-cabinet" style={{ fontSize: 22, fontWeight: 800, color: "#111827", lineHeight: 1.1 }}>Checklist</div>
            <div style={{ fontSize: 12, color: "#6B7280" }}>Inspecciones enviadas por los conductores desde la app móvil</div>
          </div>
        </div>
        <button style={btnS} onClick={() => setPlantillaAbierta(true)}><Settings size={15} /> Editar plantilla</button>
      </div>

      <EnlaceConductor />

      {error && <div style={{ ...card, borderColor: "#FCA5A5", background: "#FEF2F2", color: "#B91C1C", fontSize: 13 }}>{error}</div>}

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: 12 }}>
        {[
          { label: "Total enviados", value: kpis.total, icon: ClipboardCheck, color: "#8039F4" },
          { label: "Conformes", value: kpis.conformes, icon: CheckCircle2, color: "#16A34A" },
          { label: "Con fallas", value: kpis.fallas, icon: AlertTriangle, color: "#DC2626" },
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
          <select style={{ ...inp, width: 170 }} value={filtroConforme} onChange={(e) => setFiltroConforme(e.target.value)}>
            <option value="">Todos</option>
            <option value="1">Solo conformes</option>
            <option value="0">Solo con fallas</option>
          </select>
        </div>
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 860 }}>
            <thead><tr>
              <th style={th}>Unidad</th><th style={th}>Conductor</th><th style={th}>Fecha</th><th style={th}>Tipo</th>
              <th style={th}>Km</th><th style={th}>Estado</th><th style={{ ...th, textAlign: "right" }}>Detalle</th>
            </tr></thead>
            <tbody>
              {envios.length === 0 && <tr><td colSpan={7} style={{ ...td, color: "#9CA3AF", textAlign: "center", padding: 30 }}>No hay checklists enviados aún.</td></tr>}
              {envios.map((e) => (
                <React.Fragment key={e.id}>
                  <tr>
                    <td style={{ ...td, fontWeight: 800 }}><Truck size={13} style={{ marginRight: 4, verticalAlign: -2 }} color="#6B7280" />{e.placa}</td>
                    <td style={td}>{e.conductor_nombre || e.conductor_dni || "—"}</td>
                    <td style={td}>{fmtFechaHora(e.created_at)}</td>
                    <td style={{ ...td, textTransform: "capitalize" }}>{e.tipo || "pre-viaje"}</td>
                    <td style={td}>{e.km ?? "—"}</td>
                    <td style={td}><ConformeChip conforme={e.conforme} /></td>
                    <td style={{ ...td, textAlign: "right" }}>
                      <button style={{ ...btnS, padding: "5px 8px" }} onClick={() => setExpandido(expandido === e.id ? null : e.id)}>
                        {expandido === e.id ? "Ocultar" : "Ver ítems"}
                      </button>
                    </td>
                  </tr>
                  {expandido === e.id && (
                    <tr>
                      <td colSpan={7} style={{ ...td, background: "#FAFAFA" }}>
                        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                          {(e.items || []).map((it) => (
                            <div key={it.id} style={{ display: "flex", alignItems: "flex-start", gap: 12, padding: "8px 0", borderBottom: "1px solid #F0F0F0" }}>
                              <div style={{ width: 18 }}>{it.ok ? <CheckCircle2 size={16} color="#16A34A" /> : <AlertTriangle size={16} color="#DC2626" />}</div>
                              <div style={{ flex: 1 }}>
                                <div style={{ fontWeight: 700, fontSize: 13 }}>{it.label}</div>
                                {it.nota && <div style={{ fontSize: 12, color: "#6B7280", marginTop: 2 }}>{it.nota}</div>}
                                {!it.ok && <div style={{ fontSize: 11, color: "#8039F4", marginTop: 4, display: "flex", alignItems: "center", gap: 4 }}><AlertTriangle size={11} /> Genera orden de mantenimiento reactivo</div>}
                              </div>
                              {it.foto_key && <div style={{ display: "flex", alignItems: "center", gap: 4 }}><Camera size={13} color="#9CA3AF" /><FotoItem itemKey={it.foto_key} /></div>}
                            </div>
                          ))}
                        </div>
                      </td>
                    </tr>
                  )}
                </React.Fragment>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {plantillaAbierta && <ModalPlantilla onClose={() => setPlantillaAbierta(false)} />}
    </div>
  );
}

function ModalPlantilla({ onClose }) {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    api.get("/checklist/plantilla").then(({ data }) => setItems(data.items || []))
      .catch((e) => setError(e.response?.data?.detail || e.message))
      .finally(() => setLoading(false));
  }, []);

  const setItem = (i, patch) => setItems((p) => p.map((it, idx) => idx === i ? { ...it, ...patch } : it));
  const agregar = () => setItems((p) => [...p, { id: `item_${Date.now()}`, label: "", foto_si_falla: true }]);
  const quitar = (i) => setItems((p) => p.filter((_, idx) => idx !== i));

  const guardar = async () => {
    const limpio = items.filter((it) => (it.label || "").trim());
    if (limpio.length === 0) return alert("Agrega al menos un ítem");
    setSaving(true);
    try {
      await api.put("/checklist/plantilla", { items: limpio });
      onClose();
    } catch (e) { alert(e.response?.data?.detail || e.message); }
    finally { setSaving(false); }
  };

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(17,24,39,.45)", zIndex: 50, display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }} onClick={onClose}>
      <div style={{ background: "#fff", borderRadius: 16, width: 560, maxWidth: "100%", maxHeight: "88vh", overflow: "auto", boxShadow: "0 20px 50px rgba(0,0,0,.2)" }} onClick={(ev) => ev.stopPropagation()}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "16px 20px", borderBottom: "1px solid #E5E7EB" }}>
          <div style={{ fontWeight: 800, fontSize: 16 }}>Plantilla del checklist</div>
          <button style={{ background: "none", border: "none", cursor: "pointer", color: "#6B7280" }} onClick={onClose}><X size={18} /></button>
        </div>
        <div style={{ padding: 20 }}>
          {loading ? <Loader2 className="animate-spin" color="#8039F4" /> : (
            <>
              {error && <div style={{ color: "#B91C1C", fontSize: 13, marginBottom: 10 }}>{error}</div>}
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {items.map((it, i) => (
                  <div key={it.id || i} style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <input style={{ ...inp, flex: 1 }} value={it.label} placeholder="Ítem a inspeccionar…" onChange={(e) => setItem(i, { label: e.target.value })} />
                    <label style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 11, color: "#6B7280", whiteSpace: "nowrap" }}>
                      <input type="checkbox" checked={!!it.foto_si_falla} onChange={(e) => setItem(i, { foto_si_falla: e.target.checked })} /> foto si falla
                    </label>
                    <button style={{ ...btnS, padding: "6px 8px", color: "#DC2626" }} onClick={() => quitar(i)}><Trash2 size={13} /></button>
                  </div>
                ))}
              </div>
              <button style={{ ...btnS, marginTop: 12 }} onClick={agregar}><Plus size={14} /> Agregar ítem</button>
            </>
          )}
        </div>
        <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, padding: "14px 20px", borderTop: "1px solid #E5E7EB" }}>
          <button style={btnS} onClick={onClose}>Cancelar</button>
          <button style={btnP} onClick={guardar} disabled={saving || loading}>{saving && <Loader2 size={15} className="animate-spin" />} <Save size={14} /> Guardar plantilla</button>
        </div>
      </div>
    </div>
  );
}
