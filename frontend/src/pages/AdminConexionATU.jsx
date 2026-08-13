import React, { useEffect, useState } from "react";
import { api } from "../lib/api";
import { toast } from "sonner";
import {
  PlugZap, CheckCircle2, XCircle, Loader2, AlertTriangle, ExternalLink,
  RefreshCw, KeyRound, ShieldCheck, Clock,
} from "lucide-react";

const ATU_LOGIN = "https://soluciones.atu.gob.pe/subsidio_transportista_du004/login";

export default function AdminConexionATU() {
  const [estado, setEstado] = useState(null);
  const [access, setAccess] = useState("");
  const [refresh, setRefresh] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [probando, setProbando] = useState(false);
  const [prueba, setPrueba] = useState(null);

  async function cargar() {
    try { const { data } = await api.get("/atu/maestra"); setEstado(data); }
    catch { setEstado({ conectada: false }); }
  }
  useEffect(() => { cargar(); const t = setInterval(cargar, 60000); return () => clearInterval(t); }, []);

  async function conectar() {
    if (!access.trim()) { setErr("Pega el access_token"); return; }
    setBusy(true); setErr("");
    try {
      await api.post("/atu/maestra", { access_token: access.trim(), refresh_token: refresh.trim() || undefined });
      toast.success("Cuenta maestra conectada");
      setAccess(""); setRefresh("");
      cargar();
    } catch (e) { setErr(e?.response?.data?.detail || "No se pudo conectar"); }
    finally { setBusy(false); }
  }

  async function probar() {
    setProbando(true); setPrueba(null);
    try {
      const { data } = await api.get("/atu/analisis", { params: { ruc: "20482372407" } });
      setPrueba(data);
    } catch (e) { setPrueba({ error: e?.response?.data?.detail || "error" }); }
    finally { setProbando(false); }
  }

  const conectada = estado?.conectada;
  const min = estado?.min_refresh ?? estado?.min_access;
  const viva = conectada && min != null && min > 0;

  return (
    <div style={{ padding: "24px 28px", maxWidth: 820 }} data-testid="admin-atu-page">
      <div style={{ marginBottom: 4, fontSize: 11, fontWeight: 800, letterSpacing: ".1em", color: "#1D4ED8", textTransform: "uppercase" }}>ATU · Cuenta maestra</div>
      <h1 style={{ fontSize: 24, fontWeight: 800, color: "#111827", margin: "0 0 6px" }}>Conexión ATU</h1>
      <p style={{ color: "#6b7280", fontSize: 14, marginTop: 0, marginBottom: 22 }}>
        Conecta <b>una</b> cuenta ATU de ENERED. Con ella, el módulo de transportistas puede diagnosticar el RUC que sea.
        La sesión se mantiene viva sola (~2 h) mientras haya actividad.
      </p>

      {/* Estado */}
      <div style={{ background: viva ? "#ECFDF5" : "#FEF2F2", border: `1px solid ${viva ? "#A7F3D0" : "#FECACA"}`, borderRadius: 14, padding: 20, marginBottom: 20 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          {viva ? <CheckCircle2 style={{ width: 30, height: 30, color: "#059669" }} /> : <XCircle style={{ width: 30, height: 30, color: "#DC2626" }} />}
          <div>
            <div style={{ fontSize: 17, fontWeight: 800, color: "#111827" }}>
              {viva ? "Cuenta maestra conectada y activa" : conectada ? "La sesión expiró — reconéctala abajo" : "Sin cuenta maestra conectada"}
            </div>
            {conectada && (
              <div style={{ fontSize: 13, color: "#4B5563", marginTop: 3, display: "flex", alignItems: "center", gap: 6 }}>
                <Clock style={{ width: 14, height: 14 }} />
                {min != null ? `Sesión válida ~${min} min` : "sin datos de expiración"}
                {estado?.actualizado ? ` · conectada el ${new Date(estado.actualizado).toLocaleString("es-PE")}` : ""}
              </div>
            )}
          </div>
        </div>
        {viva && (
          <div style={{ marginTop: 14 }}>
            <button onClick={probar} disabled={probando} style={btnGhost}>
              {probando ? <Loader2 style={sp} /> : <ShieldCheck style={{ width: 15, height: 15 }} />} Probar con RUC de RAPESA
            </button>
            {prueba && (
              <span style={{ marginLeft: 12, fontSize: 13.5, fontWeight: 600, color: prueba.error ? "#DC2626" : "#065F46" }}>
                {prueba.error ? `✗ ${prueba.error}`
                  : prueba.maestra_vencida ? "✗ sesión vencida"
                  : prueba.no_inscrito ? "RUC no inscrito"
                  : `✓ ${prueba.total_unidades} unidades, ${prueba.con_problema} sin TUC`}
              </span>
            )}
          </div>
        )}
      </div>

      {/* Formulario de conexión */}
      <div style={{ background: "#fff", border: "1px solid #E5E7EB", borderRadius: 14, padding: 22 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 9, marginBottom: 4 }}>
          <PlugZap style={{ width: 20, height: 20, color: "#1D4ED8" }} />
          <div style={{ fontSize: 16, fontWeight: 800, color: "#111827" }}>{conectada ? "Actualizar / reconectar sesión" : "Conectar cuenta maestra"}</div>
        </div>
        <ol style={{ fontSize: 13.5, color: "#374151", lineHeight: 1.7, paddingLeft: 18, margin: "10px 0 16px" }}>
          <li>Inicia sesión en la ATU con la cuenta de ENERED: <a href={ATU_LOGIN} target="_blank" rel="noreferrer" style={{ color: "#1D4ED8", fontWeight: 700 }}>abrir ATU <ExternalLink style={{ width: 12, height: 12, verticalAlign: -1 }} /></a></li>
          <li>Pulsa <b>F12</b> → pestaña <b>Application</b> → <b>Cookies</b> → <code>https://api.atu.gob.pe</code></li>
          <li>Copia los valores de <b>access_token</b> y <b>refresh_token</b> y pégalos aquí abajo:</li>
        </ol>

        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          <div>
            <label style={lbl}><KeyRound style={{ width: 12, height: 12 }} /> access_token</label>
            <input value={access} onChange={(e) => setAccess(e.target.value)} placeholder="eyJhbGciOi…" style={{ ...inp, fontFamily: "monospace", fontSize: 12 }} />
          </div>
          <div>
            <label style={lbl}><RefreshCw style={{ width: 12, height: 12 }} /> refresh_token <span style={{ color: "#9CA3AF", fontWeight: 500, textTransform: "none" }}>(recomendado — mantiene la sesión viva)</span></label>
            <input value={refresh} onChange={(e) => setRefresh(e.target.value)} placeholder="eyJhbGciOi…" style={{ ...inp, fontFamily: "monospace", fontSize: 12 }} />
          </div>
        </div>
        {err && <div style={{ marginTop: 10, color: "#991B1B", fontSize: 13, fontWeight: 500 }}><AlertTriangle style={{ width: 14, height: 14, verticalAlign: -2 }} /> {err}</div>}

        <button onClick={conectar} disabled={busy} style={{ marginTop: 16, padding: "11px 22px", background: busy ? "#93C5FD" : "#1D4ED8", color: "#fff", border: "none", borderRadius: 9, cursor: busy ? "wait" : "pointer", fontSize: 15, fontWeight: 700, display: "inline-flex", alignItems: "center", gap: 8 }}>
          {busy ? <Loader2 style={sp} /> : <PlugZap style={{ width: 16, height: 16 }} />} {conectada ? "Reconectar" : "Conectar cuenta maestra"}
        </button>
      </div>

      <div style={{ marginTop: 16, fontSize: 12.5, color: "#9CA3AF" }}>
        🔒 Los tokens se guardan cifrados. La sesión sirve para consultar cualquier RUC en el módulo de transportistas.
      </div>
    </div>
  );
}

const lbl = { display: "flex", alignItems: "center", gap: 5, fontSize: 11.5, fontWeight: 700, color: "#6b7280", textTransform: "uppercase", letterSpacing: ".03em", marginBottom: 5 };
const inp = { width: "100%", padding: "10px 12px", border: "1px solid #E5E7EB", borderRadius: 9, fontSize: 14, outline: "none", fontWeight: 600, boxSizing: "border-box" };
const btnGhost = { padding: "8px 14px", background: "#fff", border: "1px solid #A7F3D0", borderRadius: 8, cursor: "pointer", fontSize: 13, fontWeight: 700, color: "#065F46", display: "inline-flex", alignItems: "center", gap: 6 };
const sp = { width: 15, height: 15, animation: "spin 1s linear infinite" };
