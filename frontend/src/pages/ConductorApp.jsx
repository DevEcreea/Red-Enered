import React, { useEffect, useState, useRef } from "react";
import { api } from "../lib/api";
import {
  Truck, MapPin, Camera, CheckCircle2, XCircle, Loader2, ArrowRight, LogOut,
  ClipboardCheck, AlertTriangle, ChevronLeft, Plus, Trash2,
} from "lucide-react";

const LOGO_IMG = "/assets/enered-logo.png";
const MORADO = "#8039F4";

// ── estilos base (mobile-first) ──────────────────────────────────────────
const wrap = { minHeight: "100vh", background: "#F6F5FA", display: "flex", flexDirection: "column" };
const header = { display: "flex", alignItems: "center", gap: 10, padding: "16px 18px", background: "#fff", borderBottom: "1px solid #E5E7EB", position: "sticky", top: 0, zIndex: 5 };
const main = { flex: 1, padding: 16, display: "flex", flexDirection: "column", gap: 14, maxWidth: 520, width: "100%", margin: "0 auto", boxSizing: "border-box" };
const card = { background: "#fff", border: "1px solid #E5E7EB", borderRadius: 16, padding: 18, boxSizing: "border-box" };
const inp = { width: "100%", height: 46, border: "1px solid #D1D5DB", borderRadius: 10, padding: "0 14px", fontSize: 15, boxSizing: "border-box", outline: "none" };
const lbl = { fontSize: 12, fontWeight: 700, color: "#6B7280", marginBottom: 5, display: "block" };
const btnP = { background: MORADO, color: "#fff", border: "none", borderRadius: 12, height: 50, fontSize: 15, fontWeight: 800, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 8, width: "100%" };
const btnS = { background: "#fff", color: "#374151", border: "1px solid #D1D5DB", borderRadius: 12, height: 44, fontSize: 14, fontWeight: 700, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 8, width: "100%" };

function TOKEN_KEY() { return "enered_token"; }

export default function ConductorApp() {
  const [paso, setPaso] = useState("login"); // login | elegir | nuevoViaje | checklist | enviado
  const [dni, setDni] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [conductor, setConductor] = useState(null);
  const [ctx, setCtx] = useState(null); // {vehiculos, viajes_abiertos, plantilla}
  const [placa, setPlaca] = useState("");
  const [viaje, setViaje] = useState(null);
  const [nuevoViaje, setNuevoViaje] = useState({ origen: "", destino: "", guia_remision: "" });
  const [resultado, setResultado] = useState(null);

  useEffect(() => {
    const saved = localStorage.getItem("conductor_data");
    if (saved && localStorage.getItem(TOKEN_KEY())) {
      try {
        const d = JSON.parse(saved);
        setConductor(d);
        cargarContexto();
      } catch {}
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const cargarContexto = async () => {
    setLoading(true); setError("");
    try {
      const { data } = await api.get("/conductor/contexto");
      setCtx(data);
      setPaso("elegir");
    } catch (e) {
      setError(e?.response?.data?.detail || "No se pudo cargar tu información");
      salir();
    } finally { setLoading(false); }
  };

  const entrar = async () => {
    const d = dni.replace(/\D/g, "");
    if (d.length !== 8) { setError("El DNI debe tener 8 dígitos"); return; }
    setLoading(true); setError("");
    try {
      const { data } = await api.post("/conductor/entrar", { dni: d });
      if (data.access_token) localStorage.setItem(TOKEN_KEY(), data.access_token);
      localStorage.setItem("conductor_data", JSON.stringify(data.conductor));
      setConductor(data.conductor);
      await cargarContexto();
    } catch (e) {
      setError(e?.response?.data?.detail || "No se pudo ingresar");
    } finally { setLoading(false); }
  };

  const salir = () => {
    localStorage.removeItem(TOKEN_KEY());
    localStorage.removeItem("conductor_data");
    setConductor(null); setCtx(null); setPaso("login"); setDni(""); setPlaca(""); setViaje(null);
  };

  const crearViaje = async () => {
    if (!placa) { setError("Elige tu unidad"); return; }
    if (!nuevoViaje.origen.trim() || !nuevoViaje.destino.trim()) { setError("Indica origen y destino"); return; }
    setLoading(true); setError("");
    try {
      const { data } = await api.post("/conductor/viajes", { placa, ...nuevoViaje });
      setViaje(data);
      setPaso("checklist");
    } catch (e) { setError(e?.response?.data?.detail || "No se pudo crear el viaje"); }
    finally { setLoading(false); }
  };

  const elegirViajeExistente = (v) => {
    setPlaca(v.placa);
    setViaje(v);
    setPaso("checklist");
  };

  if (paso === "login") {
    return (
      <div style={wrap}>
        <div style={{ ...main, justifyContent: "center", minHeight: "100vh" }}>
          <div style={{ textAlign: "center", marginBottom: 10 }}>
            <img src={LOGO_IMG} alt="ENERED" style={{ height: 40, margin: "0 auto 18px" }} />
            <div style={{ width: 64, height: 64, borderRadius: 18, background: MORADO + "1A", color: MORADO, display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 14px" }}>
              <ClipboardCheck size={30} />
            </div>
            <div style={{ fontSize: 22, fontWeight: 800, color: "#111827" }}>Checklist del conductor</div>
            <div style={{ fontSize: 13.5, color: "#6B7280", marginTop: 4 }}>Ingresa con tu DNI, sin contraseña</div>
          </div>
          <div style={card}>
            <label style={lbl}>DNI (8 dígitos)</label>
            <input style={{ ...inp, fontSize: 20, letterSpacing: 2, textAlign: "center", fontWeight: 700 }}
              inputMode="numeric" maxLength={8} value={dni} placeholder="00000000"
              onChange={(e) => { setDni(e.target.value.replace(/\D/g, "").slice(0, 8)); setError(""); }}
              onKeyDown={(e) => e.key === "Enter" && entrar()} data-testid="conductor-dni" />
            {error && <div style={{ marginTop: 10, fontSize: 13, color: "#B91C1C", background: "#FEF2F2", border: "1px solid #FCA5A5", borderRadius: 10, padding: "8px 12px" }}>{error}</div>}
            <button style={{ ...btnP, marginTop: 14 }} onClick={entrar} disabled={loading} data-testid="conductor-entrar">
              {loading ? <Loader2 size={18} className="animate-spin" /> : <ArrowRight size={18} />} Ingresar
            </button>
          </div>
          <div style={{ textAlign: "center", fontSize: 12, color: "#9CA3AF", marginTop: 16 }}>
            Si tu DNI no aparece, pide a tu empresa que te registre en Personal.
          </div>
        </div>
      </div>
    );
  }

  if (loading && !ctx) {
    return <div style={{ ...wrap, alignItems: "center", justifyContent: "center" }}><Loader2 size={30} className="animate-spin" color={MORADO} /></div>;
  }

  return (
    <div style={wrap}>
      <div style={header}>
        <button onClick={() => (paso === "checklist" || paso === "nuevoViaje") ? setPaso("elegir") : salir()}
          style={{ background: "none", border: "none", cursor: "pointer", color: "#6B7280", display: "flex" }}>
          <ChevronLeft size={22} />
        </button>
        <div style={{ flex: 1 }}>
          <div style={{ fontWeight: 800, fontSize: 15, color: "#111827" }}>{conductor?.nombre}</div>
          <div style={{ fontSize: 11.5, color: "#9CA3AF" }}>{conductor?.empresa}</div>
        </div>
        <button onClick={salir} style={{ background: "none", border: "none", cursor: "pointer", color: "#9CA3AF" }} title="Salir"><LogOut size={18} /></button>
      </div>

      <div style={main}>
        {error && <div style={{ fontSize: 13, color: "#B91C1C", background: "#FEF2F2", border: "1px solid #FCA5A5", borderRadius: 10, padding: "8px 12px" }}>{error}</div>}

        {paso === "elegir" && (
          <>
            <div style={card}>
              <div style={{ fontWeight: 800, fontSize: 15, marginBottom: 10, display: "flex", alignItems: "center", gap: 8 }}><Truck size={17} color={MORADO} /> Tu unidad</div>
              <select style={inp} value={placa} onChange={(e) => setPlaca(e.target.value)} data-testid="conductor-placa">
                <option value="">Elige la placa…</option>
                {(ctx?.vehiculos || []).map((v) => <option key={v.placa} value={v.placa}>{v.placa}{v.marca ? ` · ${v.marca} ${v.modelo || ""}` : ""}</option>)}
              </select>
            </div>

            {(ctx?.viajes_abiertos || []).length > 0 && (
              <div style={card}>
                <div style={{ fontWeight: 800, fontSize: 15, marginBottom: 10, display: "flex", alignItems: "center", gap: 8 }}><MapPin size={17} color={MORADO} /> Viajes abiertos</div>
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  {ctx.viajes_abiertos.map((v) => (
                    <button key={v.id} onClick={() => elegirViajeExistente(v)}
                      style={{ textAlign: "left", border: "1px solid #E5E7EB", borderRadius: 12, padding: 12, background: v.conductor_dni === conductor?.dni ? "#F5F3FF" : "#fff", cursor: "pointer" }}>
                      <div style={{ fontWeight: 700, fontSize: 14 }}>{v.origen} → {v.destino}</div>
                      <div style={{ fontSize: 12, color: "#6B7280", marginTop: 2 }}>{v.placa} · {v.fecha_salida} {v.hora_salida || ""}{v.conductor_dni === conductor?.dni ? " · asignado a ti" : ""}</div>
                    </button>
                  ))}
                </div>
              </div>
            )}

            <button style={btnP} onClick={() => placa ? setPaso("nuevoViaje") : setError("Elige tu unidad primero")} data-testid="conductor-nuevo-viaje">
              <Plus size={18} /> Registrar nuevo viaje
            </button>
          </>
        )}

        {paso === "nuevoViaje" && (
          <div style={card}>
            <div style={{ fontWeight: 800, fontSize: 15, marginBottom: 12 }}>Nuevo viaje · {placa}</div>
            <div style={{ marginBottom: 10 }}>
              <label style={lbl}>Origen</label>
              <input style={inp} value={nuevoViaje.origen} onChange={(e) => setNuevoViaje((p) => ({ ...p, origen: e.target.value }))} placeholder="Ej. Lima" />
            </div>
            <div style={{ marginBottom: 10 }}>
              <label style={lbl}>Destino</label>
              <input style={inp} value={nuevoViaje.destino} onChange={(e) => setNuevoViaje((p) => ({ ...p, destino: e.target.value }))} placeholder="Ej. Trujillo" />
            </div>
            <div style={{ marginBottom: 14 }}>
              <label style={lbl}>Guía de remisión (opcional)</label>
              <input style={inp} value={nuevoViaje.guia_remision} onChange={(e) => setNuevoViaje((p) => ({ ...p, guia_remision: e.target.value }))} />
            </div>
            <button style={btnP} onClick={crearViaje} disabled={loading} data-testid="conductor-crear-viaje">
              {loading ? <Loader2 size={18} className="animate-spin" /> : <ArrowRight size={18} />} Continuar al checklist
            </button>
          </div>
        )}

        {paso === "checklist" && (
          <ChecklistForm
            placa={placa} viaje={viaje} plantilla={ctx?.plantilla || []}
            onDone={(res) => { setResultado(res); setPaso("enviado"); }}
            onError={setError}
          />
        )}

        {paso === "enviado" && (
          <div style={{ ...card, textAlign: "center", padding: 30 }}>
            <CheckCircle2 size={48} color="#16A34A" style={{ margin: "0 auto 14px" }} />
            <div style={{ fontWeight: 800, fontSize: 18 }}>Checklist enviado</div>
            <div style={{ fontSize: 13.5, color: "#6B7280", marginTop: 6 }}>
              {resultado?.envio?.conforme
                ? "Todo conforme. Buen viaje."
                : `${resultado?.ordenes_creadas || 0} observación(es) reportada(s) — el equipo de mantenimiento ya las tiene en su tablero.`}
            </div>
            <button style={{ ...btnP, marginTop: 20 }} onClick={() => { setViaje(null); setResultado(null); cargarContexto(); }}>
              Hacer otro checklist
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Formulario de checklist con fotos ────────────────────────────────────
function ChecklistForm({ placa, viaje, plantilla, onDone, onError }) {
  const [items, setItems] = useState(() => plantilla.map((p) => ({ ...p, ok: true, nota: "", foto: null, fotoPreview: null })));
  const [km, setKm] = useState("");
  const [enviando, setEnviando] = useState(false);
  const fileRefs = useRef({});

  const set = (id, patch) => setItems((prev) => prev.map((it) => (it.id === id ? { ...it, ...patch } : it)));

  const onFoto = (id, file) => {
    if (!file) return;
    set(id, { foto: file, fotoPreview: URL.createObjectURL(file) });
  };

  const fallas = items.filter((i) => !i.ok);

  const enviar = async () => {
    const sinFoto = fallas.find((f) => !f.foto);
    if (sinFoto) { onError(`Adjunta una foto de la falla: "${sinFoto.label}"`); return; }
    setEnviando(true); onError("");
    try {
      const fd = new FormData();
      fd.append("viaje_id", viaje?.id || "");
      fd.append("placa", placa);
      fd.append("km", km || "");
      fd.append("tipo", "pre-viaje");
      fd.append("items", JSON.stringify(items.map((i) => ({ id: i.id, label: i.label, ok: i.ok, nota: i.nota }))));
      const fileIds = [];
      items.forEach((i) => { if (i.foto) { fd.append("files", i.foto); fileIds.push(i.id); } });
      fd.append("file_item_ids", JSON.stringify(fileIds));
      const { data } = await api.post("/conductor/checklist", fd, { headers: { "Content-Type": "multipart/form-data" }, timeout: 120000 });
      onDone(data);
    } catch (e) {
      onError(e?.response?.data?.detail || "No se pudo enviar el checklist");
    } finally { setEnviando(false); }
  };

  return (
    <>
      <div style={card}>
        <div style={{ fontWeight: 800, fontSize: 15 }}>{placa} · {viaje?.origen} → {viaje?.destino}</div>
        <div style={{ marginTop: 10 }}>
          <label style={lbl}>Kilometraje actual (opcional)</label>
          <input style={inp} inputMode="numeric" value={km} onChange={(e) => setKm(e.target.value.replace(/\D/g, ""))} placeholder="Ej. 84200" />
        </div>
      </div>

      {items.map((it) => (
        <div key={it.id} style={{ ...card, borderColor: it.ok ? "#E5E7EB" : "#FCA5A5", background: it.ok ? "#fff" : "#FEF2F2" }}>
          <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 10 }}>{it.label}</div>
          <div style={{ display: "flex", gap: 8 }}>
            <button onClick={() => set(it.id, { ok: true })} style={{ ...btnS, flex: 1, background: it.ok ? "#DCFCE7" : "#fff", borderColor: it.ok ? "#22C55E" : "#D1D5DB", color: it.ok ? "#15803D" : "#6B7280" }}>
              <CheckCircle2 size={16} /> OK
            </button>
            <button onClick={() => set(it.id, { ok: false })} style={{ ...btnS, flex: 1, background: !it.ok ? "#FEE2E2" : "#fff", borderColor: !it.ok ? "#DC2626" : "#D1D5DB", color: !it.ok ? "#B91C1C" : "#6B7280" }}>
              <XCircle size={16} /> Falla
            </button>
          </div>
          {!it.ok && (
            <div style={{ marginTop: 10 }}>
              <textarea style={{ ...inp, height: 60, padding: 10, resize: "vertical" }} placeholder="Describe la falla…" value={it.nota} onChange={(e) => set(it.id, { nota: e.target.value })} />
              <input ref={(el) => (fileRefs.current[it.id] = el)} type="file" accept="image/*" capture="environment" hidden onChange={(e) => onFoto(it.id, e.target.files?.[0])} />
              {it.fotoPreview ? (
                <div style={{ marginTop: 8, position: "relative", width: 90 }}>
                  <img src={it.fotoPreview} alt="" style={{ width: 90, height: 90, objectFit: "cover", borderRadius: 10, border: "1px solid #E5E7EB" }} />
                  <button onClick={() => set(it.id, { foto: null, fotoPreview: null })} style={{ position: "absolute", top: -6, right: -6, background: "#DC2626", color: "#fff", border: "none", borderRadius: "50%", width: 22, height: 22, cursor: "pointer" }}><Trash2 size={12} /></button>
                </div>
              ) : (
                <button style={{ ...btnS, marginTop: 8, width: "auto", padding: "8px 14px", color: "#B91C1C", borderColor: "#FCA5A5" }} onClick={() => fileRefs.current[it.id]?.click()}>
                  <Camera size={16} /> Adjuntar foto (obligatoria)
                </button>
              )}
            </div>
          )}
        </div>
      ))}

      {fallas.length > 0 && (
        <div style={{ fontSize: 12.5, color: "#B45309", background: "#FFFBEB", border: "1px solid #FDE68A", borderRadius: 10, padding: "8px 12px", display: "flex", gap: 8, alignItems: "flex-start" }}>
          <AlertTriangle size={15} style={{ flexShrink: 0, marginTop: 1 }} /> {fallas.length} ítem(s) con falla — se creará una orden de mantenimiento por cada una.
        </div>
      )}

      <button style={btnP} onClick={enviar} disabled={enviando} data-testid="conductor-enviar-checklist">
        {enviando ? <Loader2 size={18} className="animate-spin" /> : <ClipboardCheck size={18} />} Enviar checklist
      </button>
    </>
  );
}
