import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../lib/api";
import { useAuth } from "../context/AuthContext";
import { toast } from "sonner";
import { ShieldAlert, ShieldCheck, Loader2, AlertTriangle, Truck, Copy, Search, Building2, PlugZap, XCircle, Clock } from "lucide-react";

function useAuthSafe() { try { return useAuth(); } catch { return {}; } }

export default function DiagnosticoATU() {
  const { user } = useAuthSafe();
  const esAdmin = user?.role === "admin_enered";
  const navigate = useNavigate();
  const [ruc, setRuc] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [res, setRes] = useState(null);
  const [rucActivo, setRucActivo] = useState("");

  async function analizar(rucArg) {
    const r = (rucArg || ruc).trim();
    if (!/^\d{11}$/.test(r)) { setError("El RUC debe tener 11 dígitos"); return; }
    setLoading(true); setError(""); setRes(null); setExp(null); setRucActivo(r);
    try {
      const { data } = await api.get("/atu/analisis", { params: { ruc: r } });
      setRes(data);
    } catch (e) {
      setError(e?.response?.data?.detail || "No se pudo analizar el RUC");
    } finally { setLoading(false); }
    // El expediente va DESPUÉS del análisis (no en paralelo): ambos pueden renovar la
    // sesión ATU y el refresh_token es de un solo uso.
    if (esAdmin) {
      setExpLoading(true);
      try {
        const { data } = await api.get("/atu/expediente", { params: { ruc: r } });
        setExp(data);
      } catch (e) {
        setExp({ error: e?.response?.data?.detail || "No se pudo consultar el expediente" });
      } finally { setExpLoading(false); }
    }
  }

  return (
    <div style={{ padding: "22px 26px", background: "#F5F7FA", minHeight: "100%" }} data-testid="atu-page">
      <div style={{ marginBottom: 16 }}>
        <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: ".1em", color: "#1D4ED8", textTransform: "uppercase" }}>ATU · SUBSIDIO DU 004</div>
        <div style={{ fontSize: 22, fontWeight: 800, color: "#111827", marginTop: 2 }}>Diagnóstico del transportista</div>
        <div style={{ fontSize: 13, color: "#6b7280", marginTop: 2 }}>Pon cualquier RUC y ve las unidades que la ATU NO reconoce (sin TUC) — las que pierden subsidio.</div>
      </div>

      {/* Buscador de RUC */}
      <div style={{ marginTop: 14, background: "#fff", borderRadius: 12, boxShadow: "0 2px 8px rgba(0,0,0,.05)", padding: 18, display: "flex", gap: 12, alignItems: "flex-end", flexWrap: "wrap" }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 6, minWidth: 220 }}>
          <label style={lbl}><Building2 style={{ width: 13, height: 13 }} /> RUC del transportista</label>
          <input value={ruc} onChange={(e) => setRuc(e.target.value.replace(/\D/g, "").slice(0, 11))} placeholder="20482372407"
            onKeyDown={(e) => e.key === "Enter" && analizar()} data-testid="atu-ruc"
            style={{ padding: "11px 14px", border: "1px solid #E5E7EB", borderRadius: 9, fontSize: 16, outline: "none", fontWeight: 700, letterSpacing: ".04em" }} />
        </div>
        <button onClick={() => analizar()} disabled={loading} data-testid="atu-analizar"
          style={{ padding: "12px 22px", background: loading ? "#93C5FD" : "#1D4ED8", color: "#fff", border: "none", borderRadius: 9, cursor: loading ? "wait" : "pointer", fontSize: 15, fontWeight: 700, display: "inline-flex", alignItems: "center", gap: 8 }}>
          {loading ? <Loader2 style={{ width: 17, height: 17, animation: "spin 1s linear infinite" }} /> : <Search style={{ width: 17, height: 17 }} />}
          {loading ? "Analizando…" : "Analizar"}
        </button>
      </div>

      {error && <Banner tone="error"><AlertTriangle style={{ width: 18, height: 18 }} /> {error}</Banner>}

      {loading && (
        <div style={{ marginTop: 16, background: "#fff", borderRadius: 12, padding: 50, textAlign: "center", color: "#6b7280" }}>
          <Loader2 style={{ width: 30, height: 30, animation: "spin 1s linear infinite", color: "#1D4ED8", margin: "0 auto" }} />
          <div style={{ marginTop: 10, fontWeight: 600 }}>Consultando la ATU para {rucActivo}…</div>
        </div>
      )}

      {/* Estados del resultado */}
      {res && !loading && (res.sin_maestra || res.maestra_vencida) && (
        esAdmin
          ? <Banner tone="warn"><PlugZap style={{ width: 18, height: 18 }} /> {res.sin_maestra ? "No hay cuenta ATU maestra conectada." : "La sesión de la cuenta maestra expiró."} <button onClick={() => navigate("/admin/atu")} style={linkBtn}>Ir a Conexión ATU</button></Banner>
          : <Banner tone="warn"><Clock style={{ width: 18, height: 18 }} /> El servicio de verificación ATU no está disponible en este momento. Intenta de nuevo en unos minutos.</Banner>
      )}
      {res && !loading && res.conectado && !res.maestra_vencida && res.unidades && res.unidades.length > 0 && <Resultado data={res} />}
      {res && !loading && res.conectado && !res.maestra_vencida && res.unidades && res.unidades.length === 0 && (
        <Banner tone="info"><XCircle style={{ width: 18, height: 18 }} /> No encontramos unidades para el RUC {rucActivo} (ni en la ATU ni en el MTC).</Banner>
      )}
    </div>
  );
}

// ---------- Resultado del diagnóstico ----------
function Resultado({ data }) {
  const noAcept = data.no_aceptadas || 0;
  const total = data.total_unidades || 0;
  const inscrito = data.inscrito;

  function copiarMensaje() {
    const placas = data.unidades.filter((u) => !u.aceptada).map((u) => u.placa).join(", ");
    const base = inscrito
      ? `Hola, revisamos tu situación en la ATU: de tus ${total} unidades, la ATU acepta ${data.aceptadas} y NO acepta ${noAcept} (${placas}).`
      : `Hola, aún no estás inscrito en el subsidio ATU. De tus ${total} unidades habilitadas, la ATU no acepta ninguna hasta que te registres (${placas}).`;
    navigator.clipboard.writeText(`${base} En ENERED te ayudamos a regularizar tu flota para que recibas el subsidio que te corresponde.`);
    toast.success("Mensaje para el transportista copiado");
  }

  return (
    <div style={{ marginTop: 16, display: "flex", flexDirection: "column", gap: 16 }}>
      {/* Resumen */}
      <div style={{ background: noAcept ? "linear-gradient(135deg,#FFF7ED,#FEF2F2)" : "#ECFDF5", border: `1px solid ${noAcept ? "#FED7AA" : "#A7F3D0"}`, borderRadius: 14, padding: 20 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 14 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            {noAcept ? <ShieldAlert style={{ width: 34, height: 34, color: "#EA580C" }} /> : <ShieldCheck style={{ width: 34, height: 34, color: "#059669" }} />}
            <div>
              <div style={{ display: "inline-flex", alignItems: "center", gap: 5, padding: "3px 10px", borderRadius: 999, fontSize: 11.5, fontWeight: 800, marginBottom: 6,
                background: inscrito ? "#ECFDF5" : "#FFFBEB", color: inscrito ? "#065F46" : "#92400E" }}>
                {inscrito ? <ShieldCheck style={{ width: 13, height: 13 }} /> : <AlertTriangle style={{ width: 13, height: 13 }} />}
                {inscrito ? "INSCRITO EN LA ATU" : "NO INSCRITO EN LA ATU"}
              </div>
              <div style={{ fontSize: 20, fontWeight: 800, color: "#111827" }}>
                La ATU acepta <span style={{ color: "#059669" }}>{data.aceptadas}</span> de <span>{total}</span> placas
              </div>
              <div style={{ fontSize: 13.5, color: "#6b7280", marginTop: 2 }}>
                RUC {data.ruc || "—"} · {noAcept > 0
                  ? <><b style={{ color: "#DC2626" }}>{noAcept} placa{noAcept !== 1 ? "s" : ""} sin subsidio</b> — revisa el motivo de cada una abajo.</>
                  : <>Todas tus placas están aceptadas por la ATU. ✓</>}
              </div>
            </div>
          </div>
          {noAcept > 0 && (
            <button onClick={copiarMensaje} style={{ padding: "10px 16px", background: "#fff", border: "1px solid #FDBA74", borderRadius: 9, cursor: "pointer", fontSize: 13.5, fontWeight: 700, color: "#C2410C", display: "inline-flex", alignItems: "center", gap: 7 }}>
              <Copy style={{ width: 15, height: 15 }} /> Copiar aviso para el transportista
            </button>
          )}
        </div>
      </div>

      {/* Tabla: todas las placas + aceptada/no + motivo */}
      <div style={{ background: "#fff", borderRadius: 12, boxShadow: "0 2px 8px rgba(0,0,0,.05)", overflow: "hidden" }}>
        <div style={{ padding: "12px 18px", borderBottom: "1px solid #F3F4F6", fontWeight: 800, color: "#111827", fontSize: 14, display: "flex", alignItems: "center", gap: 8 }}>
          <Truck style={{ width: 16, height: 16, color: "#1D4ED8" }} /> Todas las placas ({total})
        </div>
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
            <thead><tr>{["Placa", "Cat.", "TUC", "¿La ATU la acepta?", "Motivo", "Vigencia MTC"].map((h) => <th key={h} style={th}>{h}</th>)}</tr></thead>
            <tbody>
              {data.unidades.map((u, i) => (
                <tr key={i} style={{ borderBottom: "1px solid #F3F4F6", background: u.aceptada ? "#fff" : "#FFFBEB" }}>
                  <td style={{ ...td, fontWeight: 800, color: "#1D4ED8", letterSpacing: ".03em" }}>{u.placa}</td>
                  <td style={td}>{u.categoria || "—"}</td>
                  <td style={{ ...td, fontWeight: 700, color: u.tuc ? "#111827" : "#9CA3AF" }}>{u.tuc || "—"}</td>
                  <td style={td}>
                    {u.aceptada
                      ? <Badge color="#065F46" bg="#ECFDF5" icon={<ShieldCheck style={bi} />}>Aceptada</Badge>
                      : <Badge color="#991B1B" bg="#FEF2F2" icon={<XCircle style={bi} />}>No aceptada</Badge>}
                  </td>
                  <td style={{ ...td, color: u.aceptada ? "#9CA3AF" : "#B45309", whiteSpace: "normal", maxWidth: 300 }}>{u.aceptada ? "—" : u.motivo}</td>
                  <td style={td}>{u.vigencia || "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

// ---------- Expediente en la ATU: empresa, flota, comprobantes y lo que reclama ----------
const soles = (n) => `S/ ${Number(n || 0).toLocaleString("es-PE", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const gal = (n) => `${Number(n || 0).toLocaleString("es-PE", { maximumFractionDigits: 2 })} gal`;
const EST_COLOR = { CONFORME: ["#065F46", "#ECFDF5"], OBSERVADO: ["#991B1B", "#FEF2F2"], INHABILITADO: ["#7F1D1D", "#FEE2E2"], PENDIENTE: ["#92400E", "#FFFBEB"], SIN_VALIDACION: ["#92400E", "#FFFBEB"], VALIDANDO_SUNAT: ["#1E40AF", "#EFF6FF"], VALIDANDO_OSINERGMIN: ["#1E40AF", "#EFF6FF"] };

const PRE_BADGE = {
  aceptado: ["#065F46", "#ECFDF5", "Aceptado por la ATU"],
  ok: ["#065F46", "#ECFDF5", "Sin observaciones"],
  riesgo: ["#92400E", "#FFFBEB", "Riesgo"],
  rechazado: ["#991B1B", "#FEF2F2", "Observado / inhabilitado"],
};

function Expediente({ data, loading, ruc }) {
  const [verComp, setVerComp] = useState(false);
  const [comp, setComp] = useState(null);        // detalle + pre-chequeo ENERED
  const [compLoading, setCompLoading] = useState(false);
  const [pdfAbriendo, setPdfAbriendo] = useState("");

  async function cargarDetalle() {
    if (comp || compLoading) { setVerComp((v) => !v); return; }
    setVerComp(true); setCompLoading(true);
    try {
      const { data: d } = await api.get("/atu/expediente/comprobantes", { params: { ruc } });
      setComp(d);
    } catch (e) {
      toast.error(e?.response?.data?.detail || "No se pudo traer el detalle de comprobantes");
      setVerComp(false);
    } finally { setCompLoading(false); }
  }
  async function abrirPdf(k) {
    const a = (k.archivos || []).find((x) => x.tipo === "COMPROBANTE") || (k.archivos || [])[0];
    if (!a?.archivo_uuid) { toast.error("Este comprobante no tiene PDF en la ATU"); return; }
    setPdfAbriendo(k.uuid);
    try {
      const r = await api.get(`/atu/archivo/${a.archivo_uuid}`, { params: { ruc }, responseType: "blob" });
      const url = window.URL.createObjectURL(r.data);
      window.open(url, "_blank");
      setTimeout(() => window.URL.revokeObjectURL(url), 60000);
    } catch (e) {
      toast.error("No se pudo descargar el PDF desde la ATU");
    } finally { setPdfAbriendo(""); }
  }
  if (loading) {
    return (
      <div style={{ marginTop: 16, background: "#fff", borderRadius: 12, padding: 22, color: "#6b7280", display: "flex", alignItems: "center", gap: 10 }}>
        <Loader2 style={{ ...sp, color: "#1D4ED8" }} /> Consultando el expediente de {ruc} en la ATU…
      </div>
    );
  }
  if (!data) return null;
  if (data.error) return <Banner tone="error"><AlertTriangle style={{ width: 18, height: 18 }} /> Expediente ATU: {data.error}</Banner>;
  if (data.sin_maestra || data.maestra_vencida) return null; // ya lo avisa el diagnóstico
  if (!data.inscrito) {
    return <Banner tone="info"><FileText style={{ width: 18, height: 18 }} /> El RUC {ruc} <b>no tiene cuenta en la ATU</b> para el subsidio (no figura en su padrón).</Banner>;
  }
  const e = data.empresa || {};
  const c = data.comprobantes || {};
  const detalle = comp?.comprobantes || data.comprobantes_detalle || [];
  const rp = comp?.resumen_precheck;
  const flota = data.flota || [];
  const of = data.oficial;
  const reclamo = of ? of.subsidio_total : (data.subsidio_estimado_topado ?? data.subsidio_estimado);
  const pctFondo = data.fondo_du004 ? (reclamo / data.fondo_du004) * 100 : null;
  const djm = data.dj_manual;
  async function registrarDj() {
    const exp = window.prompt("N.° de expediente que la ATU le mostró al transportista (ej. 0035-2026-02-0012503):", djm?.numero_expediente || "");
    if (exp === null) return;
    const tk = window.prompt("N.° de ticket (orden de prelación, ej. 0010514):", djm?.numero_ticket || "");
    if (tk === null) return;
    try {
      const { data: r } = await api.put(`/atu/padron/${ruc}/dj`, { numero_expediente: exp, numero_ticket: tk, fecha: new Date().toISOString().slice(0, 10) });
      data.dj_manual = r.dj_manual; toast.success(r.dj_manual ? "DJ registrada en ENERED" : "Registro de DJ borrado");
      setVerComp((v) => v); // re-render
    } catch (e) { toast.error(e?.response?.data?.detail || "No se pudo registrar"); }
  }
  const sinComp = !detalle.length && !(c.total > 0);
  const kpi = (label, value, sub, color = "#111827") => (
    <div style={{ background: "#F8FAFC", border: "1px solid #E5E7EB", borderRadius: 10, padding: "12px 14px", minWidth: 150, flex: 1 }}>
      <div style={{ fontSize: 10.5, fontWeight: 800, color: "#6b7280", textTransform: "uppercase", letterSpacing: ".05em" }}>{label}</div>
      <div style={{ fontSize: 20, fontWeight: 800, color, marginTop: 2 }}>{value}</div>
      {sub && <div style={{ fontSize: 11.5, color: "#9CA3AF", marginTop: 2 }}>{sub}</div>}
    </div>
  );
  const si = (v) => v === true ? "Sí" : v === false ? "No" : "—";
  const cumpleBadge = (st) => st === "CUMPLE"
    ? <Badge color="#065F46" bg="#ECFDF5" icon={<ShieldCheck style={bi} />}>Cumple</Badge>
    : st === "CONSIDERACIONES"
      ? <Badge color="#92400E" bg="#FFFBEB" icon={<AlertTriangle style={bi} />}>Con observaciones</Badge>
      : <Badge color="#991B1B" bg="#FEF2F2" icon={<XCircle style={bi} />}>No cumple</Badge>;
  const secTitle = (icon, txt, extra) => (
    <div style={{ padding: "12px 18px", borderTop: "1px solid #F3F4F6", borderBottom: "1px solid #F3F4F6", background: "#FAFAFA", fontWeight: 800, color: "#111827", fontSize: 13.5, display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
      {icon}{txt}{extra}
    </div>
  );

  return (
    <div style={{ marginTop: 16, background: "#fff", borderRadius: 12, boxShadow: "0 2px 8px rgba(0,0,0,.05)", overflow: "hidden" }} data-testid="atu-expediente">
      <div style={{ padding: "12px 18px", fontWeight: 800, color: "#111827", fontSize: 14, display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
        <FileText style={{ width: 16, height: 16, color: "#1D4ED8" }} /> Expediente en la ATU
        <span style={{ fontWeight: 500, color: "#6b7280", fontSize: 12.5 }}>· {e.razon_social || ruc} · todo lo que la ATU registra de este RUC</span>
        <span style={{ marginLeft: "auto", display: "inline-flex", alignItems: "center", gap: 8 }}>
          {djm
            ? <Badge color="#065F46" bg="#ECFDF5" icon={<Send style={bi} />}>
                DJ presentada · Exp. {djm.numero_expediente || "—"}{djm.numero_ticket ? ` · Ticket ${djm.numero_ticket}` : ""}{djm.fecha ? ` · ${djm.fecha}` : ""}
              </Badge>
            : <Badge color="#475569" bg="#F1F5F9" icon={<Clock style={bi} />} >Envío de DJ: la ATU no lo expone por RUC</Badge>}
          <button onClick={registrarDj} style={{ ...linkBtn, fontSize: 12.5 }} title="Anota el N.° de expediente y ticket que la ATU le dio al transportista">{djm ? "Editar" : "Registrar N.° de expediente"}</button>
        </span>
      </div>

      {/* KPIs */}
      <div style={{ padding: "4px 16px 16px", display: "flex", gap: 12, flexWrap: "wrap" }}>
        {kpi("Comprobantes cargados", c.total || detalle.length || 0, `${c.conformes || 0} conformes · ${c.observados || 0} observados · ${c.pendientes || 0} pendientes${c.inhabilitados ? ` · ${c.inhabilitados} inhabilitados` : ""}`)}
        {kpi("Volumen cargado", gal(data.volumen_galones), data.periodo ? `Compras válidas del ${data.periodo.fechaInicio} al ${data.periodo.fechaFin}` : null)}
        {of
          ? kpi("Subsidio reconocido (cálculo oficial ATU)", soles(of.subsidio_total), `${of.galones_reconocidos.toLocaleString("es-PE")} gal reconocidos · ${of.galones_no_reconocidos.toLocaleString("es-PE")} gal NO reconocidos · ${of.vehiculos_subsidiables}/${of.vehiculos_procesados} unidades subsidiables`, "#059669")
          : kpi("Subsidio que reclama (estimado)", soles(reclamo), `S/ 4 × galón, topado a la flota reconocida (máx. ${soles(data.subsidio_maximo_flota)})`, "#059669")}
        {pctFondo != null && kpi("Peso en el fondo DU 004", `${pctFondo < 0.01 ? "<0.01" : pctFondo.toFixed(2)} %`, `Fondo total: ${soles(data.fondo_du004)}`, "#7C3AED")}
      </div>

      {of && (of.mensaje_forma_a || of.mensaje_forma_b) && (
        <div style={{ margin: "0 16px 14px", padding: "10px 14px", background: "#F0FDF4", border: "1px solid #BBF7D0", borderRadius: 10, fontSize: 12.5, color: "#166534" }}>
          <b>Motor de cálculo de la ATU:</b> {of.mensaje_forma_a}{of.mensaje_forma_b ? ` · Granel: ${of.mensaje_forma_b}` : ""}
          {of.galones_no_reconocidos > 0 && <span style={{ color: "#B45309" }}> · Ojo: {of.galones_no_reconocidos.toLocaleString("es-PE")} gal no serán pagados (exceden tope o placa no subsidiable).</span>}
        </div>
      )}

      {/* Empresa + cumplimiento */}
      {secTitle(<Building2 style={{ width: 15, height: 15, color: "#1D4ED8" }} />, "Empresa en la ATU")}
      <div style={{ padding: "12px 18px", display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 10, fontSize: 13 }}>
        {[["Razón social", e.razon_social || "—"], ["Estado en la ATU", e.estado_atu || "—"], ["En padrón del subsidio", si(e.registrado_en_padron)],
          ["SUNAT activo / habido", `${si(e.activo_sunat)} / ${si(e.habido_sunat)}`], ["Validado SUNAT", si(e.validado_sunat)], ["Autorizaciones", e.total_autorizaciones ?? "—"],
          ["Contacto registrado", e.contacto || "—"], ["Actualizaciones restantes", e.actualizaciones_restantes ?? "—"]].map(([k, v]) => (
          <div key={k}><div style={{ fontSize: 10.5, fontWeight: 800, color: "#9CA3AF", textTransform: "uppercase" }}>{k}</div><div style={{ fontWeight: 700, color: "#111827" }}>{v}</div></div>
        ))}
      </div>
      {data.cumplimiento?.length > 0 && (
        <div style={{ padding: "0 18px 14px", display: "flex", flexDirection: "column", gap: 6 }}>
          {data.cumplimiento.map((k) => (
            <div key={k.codigo} style={{ display: "flex", alignItems: "center", gap: 10, fontSize: 13, flexWrap: "wrap" }}>
              {cumpleBadge(k.estado)}<b style={{ color: "#111827" }}>{k.nombre}</b><span style={{ color: "#6b7280" }}>{k.descripcion}</span>
            </div>
          ))}
        </div>
      )}

      {/* Flota reconocida */}
      {secTitle(<Truck style={{ width: 15, height: 15, color: "#1D4ED8" }} />, `Flota reconocida por la ATU (${flota.length})`,
        <span style={{ fontWeight: 500, color: "#6b7280", fontSize: 12 }}>· tope total {gal(data.tope_flota_galones)} = máx. {soles(data.subsidio_maximo_flota)}</span>)}
      {flota.length === 0 ? <div style={{ padding: "12px 18px", color: "#6b7280", fontSize: 13 }}>La ATU no registra vehículos para este RUC.</div> : (
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
            <thead><tr>{["Placa", "Cat.", "TUC", "Autorización", "Estado", "Tope (gal)", "Acumulado", "% tope", "Registrada"].map((h) => <th key={h} style={th}>{h}</th>)}</tr></thead>
            <tbody>
              {flota.map((v, i) => (
                <tr key={i} style={{ borderBottom: "1px solid #F3F4F6", background: v.tuc_vigente && v.autorizacion_vigente ? "#fff" : "#FFFBEB" }}>
                  <td style={{ ...td, fontWeight: 800, color: "#1D4ED8" }}>{v.placa}</td>
                  <td style={td}>{v.categoria || "—"}</td>
                  <td style={{ ...td, color: v.tuc ? "#111827" : "#DC2626", fontWeight: 700 }}>{v.tuc || "SIN TUC"}</td>
                  <td style={td}>{v.autorizacion || "—"}{v.autorizacion_vigente === false && <span style={{ color: "#DC2626" }}> (vencida)</span>}</td>
                  <td style={td}>{v.estado || "—"}</td>
                  <td style={td}>{Number(v.tope_galones || 0).toLocaleString("es-PE")}</td>
                  <td style={td}>{gal(v.acumulado_galones)}</td>
                  <td style={td}>{v.porcentaje_tope != null ? `${v.porcentaje_tope}%` : "—"}{v.alerta ? ` · ${v.alerta}` : ""}</td>
                  <td style={td}>{v.fecha_registro ? v.fecha_registro.slice(0, 10) : "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Resumen por mes */}
      {data.por_mes?.length > 0 && (<>
        {secTitle(<FileText style={{ width: 15, height: 15, color: "#1D4ED8" }} />, "Carga por mes y forma")}
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
            <thead><tr>{["Forma", "Mes", "Comprobantes", "Conformes", "Observados", "Pendientes", "Galones", "S/ 4 × gal"].map((h) => <th key={h} style={th}>{h}</th>)}</tr></thead>
            <tbody>
              {data.por_mes.map((m, i) => (
                <tr key={i} style={{ borderBottom: "1px solid #F3F4F6" }}>
                  <td style={td}>{m.forma === "FORMA_B" ? "B · Granel" : "A · Surtido"}</td>
                  <td style={td}>{[m.mes, m.anio].filter(Boolean).join("/") || "—"}</td>
                  <td style={td}>{m.comprobantes}</td><td style={td}>{m.conformes}</td><td style={td}>{m.observados}</td><td style={td}>{m.pendientes}</td>
                  <td style={td}>{gal(m.galones)}</td>
                  <td style={{ ...td, fontWeight: 700, color: "#059669" }}>{soles(m.galones * 4)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </>)}

      {/* Comprobantes uno a uno */}
      {secTitle(<FileText style={{ width: 15, height: 15, color: "#1D4ED8" }} />, `Comprobantes en la ATU (${detalle.length})`,
        <span style={{ marginLeft: "auto", display: "inline-flex", alignItems: "center", gap: 10 }}>
          {rp && <span style={{ fontWeight: 600, fontSize: 12, color: "#6b7280" }}>
            Pre-chequeo ENERED: <b style={{ color: "#059669" }}>{rp.aceptado + rp.ok} sin observaciones</b>
            {rp.riesgo > 0 && <> · <b style={{ color: "#B45309" }}>{rp.riesgo} con riesgo</b></>}
            {rp.rechazado > 0 && <> · <b style={{ color: "#DC2626" }}>{rp.rechazado} observados</b></>}
          </span>}
          {detalle.length > 0 && <button onClick={cargarDetalle} style={{ ...linkBtn, fontSize: 13 }}>{compLoading ? "Cargando…" : verComp ? "Ocultar" : "Ver detalle y pre-chequeo"}</button>}
        </span>)}
      {sinComp && <div style={{ padding: "12px 18px", color: "#6b7280", fontSize: 13 }}>Todavía no ha cargado comprobantes: <b>no ha armado su expediente</b>.</div>}
      {compLoading && <div style={{ padding: "14px 18px", color: "#6b7280", fontSize: 13, display: "flex", gap: 8, alignItems: "center" }}><Loader2 style={{ ...sp, color: "#1D4ED8" }} /> Trayendo el detalle de {detalle.length} comprobantes desde la ATU y pre-chequeándolos…</div>}
      {verComp && !compLoading && detalle.length > 0 && (
        <div style={{ overflowX: "auto", maxHeight: 520, overflowY: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12.5 }}>
            <thead><tr>{["Fecha", "Forma", "Serie-N°", "Grifo / distribuidor", "Placa(s)", "Galones", "Estado ATU", "SUNAT", "Pre-chequeo ENERED", "PDF"].map((h) => <th key={h} style={th}>{h}</th>)}</tr></thead>
            <tbody>
              {detalle.map((k) => {
                const [fg, bg] = EST_COLOR[k.estado] || ["#374151", "#F3F4F6"];
                const pre = k.precheck; const pb = pre ? PRE_BADGE[pre.veredicto] : null;
                const placas = (k.placas && Array.isArray(k.placas)) ? k.placas.map((p) => p.placa).join(", ") : (k.placa || (k.placas ? `${k.placas} placa${k.placas > 1 ? "s" : ""}` : "—"));
                return (
                  <tr key={k.uuid} style={{ borderBottom: "1px solid #F3F4F6", background: pre?.veredicto === "riesgo" ? "#FFFBEB" : pre?.veredicto === "rechazado" ? "#FEF2F2" : "#fff" }}>
                    <td style={td}>{k.fecha || "—"}</td>
                    <td style={td}>{k.forma === "FORMA_B" ? "B" : "A"}</td>
                    <td style={{ ...td, fontWeight: 700 }}>{k.serie}-{k.numero}{k.nota_credito ? " (NC)" : ""}</td>
                    <td style={{ ...td, whiteSpace: "normal", maxWidth: 240 }}>{k.distribuidor || k.ruc_distribuidor || "—"}{k.grifo_osinergmin === false && <span style={{ color: "#DC2626" }}> · no en OSINERGMIN</span>}<div style={{ color: "#9CA3AF", fontSize: 11 }}>{k.departamento || ""}</div></td>
                    <td style={td}>{placas}</td>
                    <td style={td}>{gal(k.galones)}
                      {of && <div style={{ fontSize: 11, color: k.reconocido_atu ? (k.galones_reconocidos < k.galones ? "#B45309" : "#059669") : "#DC2626" }}>
                        {k.reconocido_atu ? `ATU reconoce ${Number(k.galones_reconocidos).toLocaleString("es-PE")}` : "ATU no lo considera"}</div>}
                      {k.azufre_ppm != null && <div style={{ color: "#9CA3AF", fontSize: 11 }}>{k.azufre_ppm} ppm</div>}</td>
                    <td style={td}><Badge color={fg} bg={bg}>{k.estado_nombre || k.estado}</Badge></td>
                    <td style={td}>{k.valida_sunat === true ? "✓" : (k.valida_sunat === false && k.fecha_validacion_sunat) ? "✗" : "pend."}</td>
                    <td style={{ ...td, whiteSpace: "normal", maxWidth: 320 }}>
                      {pb ? <Badge color={pb[0]} bg={pb[1]}>{pb[2]}</Badge> : "—"}
                      {pre?.avisos?.length > 0 && <ul style={{ margin: "4px 0 0", paddingLeft: 16, color: "#B45309", fontSize: 11.5 }}>{pre.avisos.map((a, i) => <li key={i}>{a}</li>)}</ul>}
                    </td>
                    <td style={td}>
                      {(k.archivos?.length || k.tiene_archivo)
                        ? <button onClick={() => abrirPdf(k)} disabled={pdfAbriendo === k.uuid} style={{ ...linkBtn, fontSize: 12.5 }}>{pdfAbriendo === k.uuid ? "Abriendo…" : "Ver PDF"}</button>
                        : <span style={{ color: "#DC2626" }}>Sin PDF</span>}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function Badge({ color, bg, icon, children }) {
  return <span style={{ display: "inline-flex", alignItems: "center", gap: 5, background: bg, color, padding: "3px 10px", borderRadius: 999, fontWeight: 700, fontSize: 12 }}>{icon}{children}</span>;
}
function Banner({ tone, children }) {
  const map = { error: { bg: "#FEF2F2", bd: "#FECACA", fg: "#991B1B" }, warn: { bg: "#FFFBEB", bd: "#FDE68A", fg: "#92400E" }, info: { bg: "#EFF6FF", bd: "#BFDBFE", fg: "#1E40AF" } };
  const c = map[tone] || map.info;
  return <div style={{ marginTop: 16, background: c.bg, border: `1px solid ${c.bd}`, borderRadius: 12, padding: "14px 18px", color: c.fg, fontSize: 14, fontWeight: 500, display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>{children}</div>;
}

const linkBtn = { background: "none", border: "none", color: "#1D4ED8", fontWeight: 700, cursor: "pointer", fontSize: 14, textDecoration: "underline", padding: 0 };
const lbl = { fontSize: 11.5, fontWeight: 700, color: "#6b7280", textTransform: "uppercase", letterSpacing: ".03em", display: "inline-flex", alignItems: "center", gap: 5 };
const inp = { padding: "10px 12px", border: "1px solid #E5E7EB", borderRadius: 9, fontSize: 14, outline: "none", fontWeight: 600 };
const sp = { width: 16, height: 16, animation: "spin 1s linear infinite" };
const th = { position: "sticky", top: 0, background: "#F8FAFC", padding: "9px 14px", textAlign: "left", fontWeight: 700, color: "#475569", borderBottom: "1px solid #E5E7EB", whiteSpace: "nowrap" };
const td = { padding: "9px 14px", color: "#374151", whiteSpace: "nowrap" };
const bi = { width: 12, height: 12 };
