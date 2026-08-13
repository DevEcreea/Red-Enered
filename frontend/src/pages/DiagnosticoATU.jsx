import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../lib/api";
import { useAuth } from "../context/AuthContext";
import { toast } from "sonner";
import {
  ShieldAlert, ShieldCheck, Loader2, AlertTriangle, Truck, Copy, Search,
  FileWarning, Building2, PlugZap, XCircle, Clock,
} from "lucide-react";

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
    setLoading(true); setError(""); setRes(null); setRucActivo(r);
    try {
      const { data } = await api.get("/atu/analisis", { params: { ruc: r } });
      setRes(data);
    } catch (e) {
      setError(e?.response?.data?.detail || "No se pudo analizar el RUC");
    } finally { setLoading(false); }
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
