import React, { useEffect, useState } from "react";
import { api } from "../lib/api";
import { toast } from "sonner";
import {
  Building2, Server, Fuel, MapPin, ShieldCheck, KeyRound,
  CheckCircle2, XCircle, Loader2, Trash2, Edit3, Save, X, Plus, RefreshCw
} from "lucide-react";

const SERVICE_META = {
  plataforma:  { label: "Plataforma", color: "#8B3DFF", icon: Server,     desc: "Acceso a la plataforma web (siempre activo)" },
  combustible: { label: "Combustible", color: "#10B981", icon: Fuel,      desc: "Consume combustible con ENERED (data automática, ahorro real)" },
  gps:         { label: "GPS · Wialon", color: "#3B82F6", icon: MapPin,   desc: "Monitoreo satelital con Wialon (mapa + KM + sensores)" },
};

export default function AdminEmpresas() {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editEmpresa, setEditEmpresa] = useState(null);   // servicios modal
  const [wialonEmpresa, setWialonEmpresa] = useState(null); // wialon modal

  async function load() {
    setLoading(true);
    try {
      const { data } = await api.get("/empresas-config");
      setRows(data || []);
    } catch (e) {
      toast.error("Error cargando empresas");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  return (
    <div style={{ padding: "24px 28px", background: "#F5F7FA", minHeight: "100%" }} data-testid="admin-empresas-page">
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
        <div>
          <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: ".08em", color: "#8B3DFF", textTransform: "uppercase" }}>Administración</div>
          <div style={{ fontSize: 26, fontWeight: 700, color: "#111827" }}>Empresas & Servicios</div>
          <div style={{ color: "#6b7280", fontSize: 13.5, marginTop: 4 }}>
            Configura qué servicios (Plataforma / Combustible / GPS) tiene cada empresa cliente, y el tipo de cliente.
          </div>
        </div>
        <button onClick={load} style={btn.secondary}><RefreshCw style={{ width: 15, height: 15 }} />Refrescar</button>
      </div>

      <div style={{ background: "#fff", borderRadius: 14, boxShadow: "0 2px 8px rgba(0,0,0,.05)", overflow: "hidden" }}>
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr style={{ background: "#241B4A" }}>
              {["Empresa", "RUC", "Tipo", "Plataforma", "Combustible", "GPS · Wialon", "Acciones"].map((h) => (
                <th key={h} style={styles.th}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading && (
              <tr><td colSpan={7} style={{ padding: 30, textAlign: "center", color: "#9ca3af" }}><Loader2 style={{ width: 22, height: 22, display: "inline", animation: "spin 1s linear infinite" }} /> Cargando...</td></tr>
            )}
            {!loading && rows.length === 0 && (
              <tr><td colSpan={7} style={{ padding: 30, textAlign: "center", color: "#9ca3af" }}>
                No hay empresas configuradas. Se crearán automáticamente al primer login de sus usuarios.
              </td></tr>
            )}
            {rows.map((r) => {
              const s = r.servicios || {};
              const w = r.wialon || {};
              return (
                <tr key={r.empresa} style={{ borderBottom: "1px solid #EEF0F5" }}>
                  <td style={{ ...styles.td, fontWeight: 600, color: "#111827" }}>
                    <Building2 style={{ width: 15, height: 15, color: "#8B3DFF", display: "inline", verticalAlign: -2, marginRight: 6 }} />
                    {r.empresa}
                  </td>
                  <td style={styles.td}>{r.ruc || "—"}</td>
                  <td style={styles.td}>
                    <span style={{ ...pill.base, background: r.tipo_cliente === "subsidio" ? "#FEF3C7" : "#EDE7FA", color: r.tipo_cliente === "subsidio" ? "#B45309" : "#6B21A8" }}>
                      {r.tipo_cliente === "subsidio" ? "Subsidio DU 004" : "ENERED"}
                    </span>
                  </td>
                  <td style={styles.td}><Dot on={s.plataforma !== false} /></td>
                  <td style={styles.td}><Dot on={!!s.combustible} /></td>
                  <td style={styles.td}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <Dot on={!!s.gps} />
                      {s.gps && w.configurado && (
                        <span style={{ fontSize: 11, color: "#059669", fontFamily: "monospace" }}>{w.token_mask}</span>
                      )}
                      {s.gps && !w.configurado && (
                        <span style={{ fontSize: 11, color: "#DC2626", fontWeight: 600 }}>sin token</span>
                      )}
                    </div>
                  </td>
                  <td style={styles.td}>
                    <div style={{ display: "flex", gap: 6 }}>
                      <button onClick={() => setEditEmpresa(r)} style={btn.iconEdit} title="Editar servicios" data-testid={`btn-edit-servicios-${r.empresa}`}>
                        <Edit3 style={{ width: 14, height: 14 }} />
                      </button>
                      <button onClick={() => setWialonEmpresa(r)} style={btn.iconWialon} title="Configurar Wialon" data-testid={`btn-wialon-${r.empresa}`}>
                        <KeyRound style={{ width: 14, height: 14 }} />
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {editEmpresa && (
        <ServiciosModal
          empresa={editEmpresa}
          onClose={() => setEditEmpresa(null)}
          onSaved={() => { setEditEmpresa(null); load(); }}
        />
      )}
      {wialonEmpresa && (
        <WialonModal
          empresa={wialonEmpresa}
          onClose={() => setWialonEmpresa(null)}
          onSaved={() => { setWialonEmpresa(null); load(); }}
        />
      )}
    </div>
  );
}

// ─── Servicios Modal ─────────────────────────────────────────────────────────
function ServiciosModal({ empresa, onClose, onSaved }) {
  const [servicios, setServicios] = useState({
    plataforma: empresa.servicios?.plataforma !== false,
    combustible: !!empresa.servicios?.combustible,
    gps: !!empresa.servicios?.gps,
  });
  const [tipoCliente, setTipoCliente] = useState(empresa.tipo_cliente || "enered");
  const [saving, setSaving] = useState(false);

  async function save() {
    setSaving(true);
    try {
      await api.put(`/admin/empresas/${encodeURIComponent(empresa.empresa)}/servicios`, {
        servicios,
        tipo_cliente: tipoCliente,
      });
      toast.success("Servicios actualizados");
      onSaved();
    } catch (e) {
      toast.error(e.response?.data?.detail || "Error al guardar");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal onClose={onClose} testid="modal-servicios">
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 18 }}>
        <div>
          <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: ".08em", color: "#8B3DFF", textTransform: "uppercase" }}>Servicios contratados</div>
          <div style={{ fontSize: 22, fontWeight: 700, color: "#111827" }}>{empresa.empresa}</div>
        </div>
        <button onClick={onClose} style={btn.close}><X style={{ width: 22, height: 22 }} /></button>
      </div>

      {/* Tipo de cliente */}
      <div style={{ marginBottom: 18 }}>
        <label style={styles.label}>Tipo de cliente</label>
        <div style={{ display: "flex", gap: 10, marginTop: 6 }}>
          {["enered", "subsidio"].map(t => (
            <button key={t} onClick={() => setTipoCliente(t)} data-testid={`tipo-${t}`}
              style={{
                flex: 1, padding: "12px 16px", border: `2px solid ${tipoCliente === t ? "#8B3DFF" : "#E5E7EB"}`,
                background: tipoCliente === t ? "#EDE7FA" : "#fff", color: "#111827",
                borderRadius: 12, cursor: "pointer", fontSize: 14, fontWeight: 600, textAlign: "left"
              }}>
              {t === "enered" ? "Cliente ENERED" : "Cliente Subsidio DU 004"}
              <div style={{ fontSize: 12, color: "#6b7280", fontWeight: 400, marginTop: 2 }}>
                {t === "enered" ? "Cliente regular con o sin combustible/GPS" : "Beneficiario del subsidio de combustible"}
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Servicios */}
      <div>
        <label style={styles.label}>Servicios activos</label>
        {Object.entries(SERVICE_META).map(([key, meta]) => {
          const Icon = meta.icon;
          const disabled = key === "plataforma";  // plataforma siempre true
          const active = servicios[key];
          return (
            <div key={key} data-testid={`servicio-${key}`}
              style={{
                display: "flex", alignItems: "center", gap: 14, padding: "14px 16px",
                border: `2px solid ${active ? meta.color : "#E5E7EB"}`, borderRadius: 12, marginTop: 10,
                background: active ? `${meta.color}0A` : "#fff", cursor: disabled ? "default" : "pointer",
                opacity: disabled ? 0.7 : 1,
              }}
              onClick={() => !disabled && setServicios(p => ({ ...p, [key]: !p[key] }))}
            >
              <div style={{ width: 44, height: 44, borderRadius: 10, background: `${meta.color}20`, display: "flex", alignItems: "center", justifyContent: "center" }}>
                <Icon style={{ width: 20, height: 20, color: meta.color }} />
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 700, color: "#111827" }}>{meta.label}{disabled && <span style={{ fontSize: 11, color: "#9ca3af", marginLeft: 8 }}>(siempre activo)</span>}</div>
                <div style={{ fontSize: 12.5, color: "#6b7280" }}>{meta.desc}</div>
              </div>
              <div style={{
                width: 44, height: 24, borderRadius: 12, background: active ? meta.color : "#E5E7EB",
                position: "relative", transition: "background .2s"
              }}>
                <div style={{
                  position: "absolute", top: 2, left: active ? 22 : 2, width: 20, height: 20,
                  borderRadius: "50%", background: "#fff", boxShadow: "0 1px 3px rgba(0,0,0,.2)", transition: "left .2s"
                }} />
              </div>
            </div>
          );
        })}
      </div>

      {servicios.gps && (
        <div style={{ marginTop: 14, padding: "12px 14px", background: "#EFF6FF", border: "1px solid #DBEAFE", borderRadius: 10, fontSize: 13, color: "#1E40AF" }}>
          <ShieldCheck style={{ width: 15, height: 15, display: "inline", verticalAlign: -2, marginRight: 6 }} />
          El módulo <strong>Monitoreo</strong> se habilitará. Configura el token Wialon desde el botón <KeyRound style={{ width: 12, height: 12, display: "inline", verticalAlign: -1 }} /> en la tabla.
        </div>
      )}

      <div style={{ display: "flex", gap: 10, justifyContent: "flex-end", marginTop: 22 }}>
        <button onClick={onClose} style={btn.secondary}>Cancelar</button>
        <button onClick={save} disabled={saving} data-testid="btn-save-servicios" style={{ ...btn.primary, opacity: saving ? 0.7 : 1 }}>
          {saving ? <Loader2 style={{ width: 16, height: 16, animation: "spin 1s linear infinite" }} /> : <Save style={{ width: 16, height: 16 }} />}
          Guardar
        </button>
      </div>
    </Modal>
  );
}

// ─── Wialon Modal ────────────────────────────────────────────────────────────
function WialonModal({ empresa, onClose, onSaved }) {
  const [token, setToken] = useState("");
  const [host, setHost] = useState(empresa.wialon?.host || "hst-api.wialon.com");
  const [testing, setTesting] = useState(false);
  const [saving, setSaving] = useState(false);
  const [testResult, setTestResult] = useState(null);
  const isConfigured = !!empresa.wialon?.configurado;

  async function test() {
    if (!token.trim()) { toast.error("Ingresa un token"); return; }
    setTesting(true); setTestResult(null);
    try {
      const { data } = await api.post(`/admin/empresas/${encodeURIComponent(empresa.empresa)}/wialon/test`, { token, host });
      setTestResult(data);
    } catch (e) {
      setTestResult({ ok: false, error: e.response?.data?.detail || "Error de prueba" });
    } finally {
      setTesting(false);
    }
  }

  async function save() {
    if (!token.trim()) { toast.error("Ingresa un token"); return; }
    setSaving(true);
    try {
      await api.put(`/admin/empresas/${encodeURIComponent(empresa.empresa)}/wialon`, { token, host });
      toast.success("Token Wialon guardado (encriptado)");
      onSaved();
    } catch (e) {
      toast.error(e.response?.data?.detail || "Error al guardar");
    } finally {
      setSaving(false);
    }
  }

  async function remove() {
    if (!window.confirm("¿Eliminar el token Wialon de esta empresa?")) return;
    try {
      await api.delete(`/admin/empresas/${encodeURIComponent(empresa.empresa)}/wialon`);
      toast.success("Token eliminado");
      onSaved();
    } catch (e) {
      toast.error("Error al eliminar");
    }
  }

  return (
    <Modal onClose={onClose} testid="modal-wialon">
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 18 }}>
        <div>
          <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: ".08em", color: "#3B82F6", textTransform: "uppercase" }}>GPS · Wialon</div>
          <div style={{ fontSize: 22, fontWeight: 700, color: "#111827" }}>{empresa.empresa}</div>
        </div>
        <button onClick={onClose} style={btn.close}><X style={{ width: 22, height: 22 }} /></button>
      </div>

      {isConfigured && (
        <div style={{ padding: "10px 12px", background: "#ECFDF5", border: "1px solid #A7F3D0", borderRadius: 10, fontSize: 13, color: "#065F46", marginBottom: 14 }}>
          <CheckCircle2 style={{ width: 14, height: 14, display: "inline", verticalAlign: -2, marginRight: 4 }} />
          Ya hay un token configurado: <span style={{ fontFamily: "monospace" }}>{empresa.wialon.token_mask}</span>
        </div>
      )}

      <div style={{ display: "grid", gap: 12 }}>
        <div>
          <label style={styles.label}>Host Wialon</label>
          <input value={host} onChange={e => setHost(e.target.value)} style={styles.input} placeholder="hst-api.wialon.com" data-testid="wialon-host"/>
        </div>
        <div>
          <label style={styles.label}>Token de acceso (72 caracteres)</label>
          <textarea value={token} onChange={e => setToken(e.target.value)} rows={3} style={{ ...styles.input, height: "auto", padding: "10px 14px", fontFamily: "monospace", fontSize: 12 }} placeholder={isConfigured ? "Pega un nuevo token para reemplazar el actual" : "f3a001e8ee89236df602c639476e01e1..."} data-testid="wialon-token"/>
          <div style={{ fontSize: 12, color: "#6b7280", marginTop: 4 }}>
            Genera el token en tu cuenta Wialon → Usuario → Ajustes → Acceso.
          </div>
        </div>

        {testResult && (
          <div style={{
            padding: "12px 14px", borderRadius: 10, fontSize: 13,
            background: testResult.ok ? "#ECFDF5" : "#FEF2F2",
            border: `1px solid ${testResult.ok ? "#A7F3D0" : "#FECACA"}`,
            color: testResult.ok ? "#065F46" : "#991B1B",
          }} data-testid="wialon-test-result">
            {testResult.ok ? (
              <>
                <CheckCircle2 style={{ width: 15, height: 15, display: "inline", verticalAlign: -2, marginRight: 6 }} />
                Conexión OK — Usuario: <strong>{testResult.user}</strong> · <strong>{testResult.total_unidades}</strong> unidades detectadas
              </>
            ) : (
              <>
                <XCircle style={{ width: 15, height: 15, display: "inline", verticalAlign: -2, marginRight: 6 }} />
                {testResult.error}
              </>
            )}
          </div>
        )}
      </div>

      <div style={{ display: "flex", gap: 10, justifyContent: "space-between", marginTop: 22 }}>
        <div>
          {isConfigured && (
            <button onClick={remove} style={{ ...btn.secondary, color: "#DC2626", borderColor: "#FCA5A5" }} data-testid="btn-wialon-remove">
              <Trash2 style={{ width: 15, height: 15 }} />Quitar token
            </button>
          )}
        </div>
        <div style={{ display: "flex", gap: 10 }}>
          <button onClick={test} disabled={testing || !token} style={{ ...btn.secondary, opacity: (testing || !token) ? 0.6 : 1 }} data-testid="btn-wialon-test">
            {testing ? <Loader2 style={{ width: 15, height: 15, animation: "spin 1s linear infinite" }} /> : <ShieldCheck style={{ width: 15, height: 15 }} />}
            Probar
          </button>
          <button onClick={save} disabled={saving || !token} data-testid="btn-wialon-save" style={{ ...btn.primary, opacity: (saving || !token) ? 0.6 : 1 }}>
            {saving ? <Loader2 style={{ width: 15, height: 15, animation: "spin 1s linear infinite" }} /> : <Save style={{ width: 15, height: 15 }} />}
            Guardar
          </button>
        </div>
      </div>
    </Modal>
  );
}

// ─── Helpers ─────────────────────────────────────────────────────────────────
function Modal({ children, onClose, testid }) {
  return (
    <div onClick={onClose} style={{ position: "fixed", inset: 0, background: "rgba(15,23,42,.55)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 100, padding: 20 }}>
      <div onClick={e => e.stopPropagation()} data-testid={testid} style={{ background: "#fff", borderRadius: 16, padding: 26, width: "100%", maxWidth: 620, maxHeight: "90vh", overflow: "auto", boxShadow: "0 20px 60px rgba(0,0,0,.3)" }}>
        {children}
      </div>
    </div>
  );
}

function Dot({ on }) {
  return (
    <span style={{
      display: "inline-flex", alignItems: "center", gap: 6,
      fontSize: 12.5, fontWeight: 600, color: on ? "#059669" : "#9ca3af"
    }}>
      <span style={{ width: 8, height: 8, borderRadius: "50%", background: on ? "#10B981" : "#D1D5DB" }} />
      {on ? "Sí" : "No"}
    </span>
  );
}

const styles = {
  th: { textAlign: "left", color: "#fff", fontWeight: 600, fontSize: 12.5, padding: "14px 14px", whiteSpace: "nowrap" },
  td: { padding: "14px", fontSize: 13.5, color: "#4b5563" },
  label: { display: "block", fontSize: 12, fontWeight: 700, color: "#6b7280", letterSpacing: ".04em", textTransform: "uppercase", marginBottom: 4 },
  input: { width: "100%", height: 42, border: "1px solid #E5E7EB", borderRadius: 10, padding: "0 14px", fontSize: 14, background: "#fff", outline: "none", boxSizing: "border-box" },
};

const btn = {
  primary: { display: "inline-flex", alignItems: "center", gap: 6, padding: "0 20px", height: 40, border: "none", borderRadius: 10, background: "#8B3DFF", color: "#fff", fontSize: 14, fontWeight: 600, cursor: "pointer", boxShadow: "0 4px 12px rgba(139,61,255,.25)" },
  secondary: { display: "inline-flex", alignItems: "center", gap: 6, padding: "0 16px", height: 40, border: "1px solid #E5E7EB", borderRadius: 10, background: "#fff", color: "#374151", fontSize: 14, fontWeight: 600, cursor: "pointer" },
  close: { background: "none", border: "none", cursor: "pointer", color: "#6b7280" },
  iconEdit: { width: 32, height: 32, borderRadius: 8, border: "1px solid #E5E7EB", background: "#fff", cursor: "pointer", display: "inline-flex", alignItems: "center", justifyContent: "center", color: "#8B3DFF" },
  iconWialon: { width: 32, height: 32, borderRadius: 8, border: "1px solid #E5E7EB", background: "#fff", cursor: "pointer", display: "inline-flex", alignItems: "center", justifyContent: "center", color: "#3B82F6" },
};

const pill = {
  base: { display: "inline-block", padding: "3px 10px", borderRadius: 999, fontSize: 11.5, fontWeight: 600 },
};
