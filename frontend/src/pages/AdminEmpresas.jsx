// Force update for Netlify deploy - delete button and finance config
import React, { useEffect, useState } from "react";
import { api } from "../lib/api";
import { toast } from "sonner";
import {
  Building2, Server, Fuel, MapPin, ShieldCheck, KeyRound,
  CheckCircle2, XCircle, Loader2, Trash2, Edit3, Save, X, Plus, RefreshCw, AlertTriangle, Banknote
} from "lucide-react";

const SERVICE_META = {
  plataforma:  { label: "Plataforma", color: "#8B3DFF", icon: Server,     desc: "Acceso a la plataforma web" },
  combustible: { label: "Combustible", color: "#10B981", icon: Fuel,      desc: "Consume combustible con ENERED (data automática, ahorro real)" },
  gps:         { label: "GPS · Wialon", color: "#3B82F6", icon: MapPin,   desc: "Monitoreo satelital con Wialon (mapa + KM + sensores)" },
  subsidio:    { label: "Subsidio DU 004", color: "#F59E0B", icon: ShieldCheck, desc: "Expediente DU 004-2026: Mi Flota + Dashboard Subsidio" },
};

export default function AdminEmpresas() {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editEmpresa, setEditEmpresa] = useState(null);   // servicios modal
  const [wialonEmpresa, setWialonEmpresa] = useState(null); // wialon modal
  const [deleteEmpresa, setDeleteEmpresa] = useState(null); // delete confirm modal
  const [finanzasEmpresa, setFinanzasEmpresa] = useState(null); // finanzas modal
  const [createEmpresa, setCreateEmpresa] = useState(false); // crear modal

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
        <div style={{ display: "flex", gap: 10 }}>
          <button onClick={load} style={btn.secondary}><RefreshCw style={{ width: 15, height: 15 }} />Refrescar</button>
          <button onClick={() => setCreateEmpresa(true)} style={btn.primary}><Plus style={{ width: 15, height: 15 }} />Crear Empresa</button>
        </div>
      </div>

      <div style={{ background: "#fff", borderRadius: 14, boxShadow: "0 2px 8px rgba(0,0,0,.05)", overflow: "hidden" }}>
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr style={{ background: "#241B4A" }}>
              {["Empresa", "RUC", "Tipo", "Plataforma", "Combustible", "GPS · Wialon", "Subsidio DU 004", "Plan", "Crédito", "Días", "Acciones"].map((h) => (
                <th key={h} style={styles.th}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading && (
              <tr><td colSpan={8} style={{ padding: 30, textAlign: "center", color: "#9ca3af" }}><Loader2 style={{ width: 22, height: 22, display: "inline", animation: "spin 1s linear infinite" }} /> Cargando...</td></tr>
            )}
            {!loading && rows.length === 0 && (
              <tr><td colSpan={8} style={{ padding: 30, textAlign: "center", color: "#9ca3af" }}>
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
                  <td style={styles.td}><Dot on={!!s.subsidio} /></td>
                  <td style={styles.td}>
                    <span style={{ fontSize: 11, fontWeight: 700, padding: "3px 8px", borderRadius: 6, background: "#EDE7FA", color: "#6B21A8", textTransform: "capitalize" }}>
                      {r.plan || "tracking"}
                    </span>
                  </td>
                  <td style={{ ...styles.td, fontWeight: 600, color: "#111827" }}>
                    {((r.linea_credito || 0) > 0 ? r.linea_credito : 1).toLocaleString("es-PE", { style: "currency", currency: "PEN", minimumFractionDigits: 0 })}
                  </td>
                  <td style={{ ...styles.td, textAlign: "center" }}>{r.dias_credito ?? 0}d</td>
                  <td style={styles.td}>
                    <div style={{ display: "flex", gap: 6 }}>
                      <button onClick={() => setEditEmpresa(r)} style={btn.iconEdit} title="Editar servicios" data-testid={`btn-edit-servicios-${r.empresa}`}>
                        <Edit3 style={{ width: 14, height: 14 }} />
                      </button>
                      <button onClick={() => setWialonEmpresa(r)} style={btn.iconWialon} title="Configurar Wialon" data-testid={`btn-wialon-${r.empresa}`}>
                        <KeyRound style={{ width: 14, height: 14 }} />
                      </button>
                      <button onClick={() => setFinanzasEmpresa(r)} style={btn.iconFinanzas} title="Config. financiera" data-testid={`btn-finanzas-${r.empresa}`}>
                        <Banknote style={{ width: 14, height: 14 }} />
                      </button>
                      <button onClick={() => setDeleteEmpresa(r)} style={btn.iconDelete} title="Eliminar empresa" data-testid={`btn-delete-${r.empresa}`}>
                        <Trash2 style={{ width: 14, height: 14 }} />
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
      {deleteEmpresa && (
        <DeleteModal
          empresa={deleteEmpresa}
          onClose={() => setDeleteEmpresa(null)}
          onDeleted={() => { setDeleteEmpresa(null); load(); }}
        />
      )}
      {finanzasEmpresa && (
        <FinanzasModal
          empresa={finanzasEmpresa}
          onClose={() => setFinanzasEmpresa(null)}
          onSaved={() => { setFinanzasEmpresa(null); load(); }}
        />
      )}
      {createEmpresa && (
        <CrearEmpresaModal
          onClose={() => setCreateEmpresa(false)}
          onSaved={() => { setCreateEmpresa(false); load(); }}
        />
      )}
    </div>
  );
}

// ─── Delete Modal ────────────────────────────────────────────────────────────
function DeleteModal({ empresa, onClose, onDeleted }) {
  const [confirmText, setConfirmText] = useState("");
  const [deleting, setDeleting] = useState(false);
  const canDelete = confirmText.trim() === empresa.empresa;

  async function doDelete() {
    if (!canDelete) return;
    setDeleting(true);
    try {
      const { data } = await api.delete(`/admin/empresas/${encodeURIComponent(empresa.empresa)}`);
      const total = Object.values(data.deleted || {}).reduce((a,b) => a+b, 0);
      toast.success(`Empresa eliminada · ${total} registros borrados en cascada`);
      onDeleted();
    } catch (e) {
      toast.error(e.response?.data?.detail || "Error al eliminar");
    } finally {
      setDeleting(false);
    }
  }

  return (
    <Modal onClose={onClose} testid="modal-delete-empresa">
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 18 }}>
        <div>
          <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: ".08em", color: "#DC2626", textTransform: "uppercase" }}>Zona peligrosa</div>
          <div style={{ fontSize: 22, fontWeight: 700, color: "#111827" }}>Eliminar empresa</div>
        </div>
        <button onClick={onClose} style={btn.close}><X style={{ width: 22, height: 22 }} /></button>
      </div>

      <div style={{ padding: "16px 18px", background: "#FEF2F2", border: "1px solid #FECACA", borderRadius: 10, color: "#991B1B", fontSize: 14, marginBottom: 16 }}>
        <div style={{ display: "flex", alignItems: "flex-start", gap: 10 }}>
          <AlertTriangle style={{ width: 20, height: 20, flexShrink: 0, marginTop: 2 }} />
          <div>
            <div style={{ fontWeight: 700, marginBottom: 6 }}>Esta acción es irreversible.</div>
            <div>Se eliminarán TODOS los datos relacionados con <strong>{empresa.empresa}</strong>:</div>
            <ul style={{ margin: "8px 0 0 20px", padding: 0, fontSize: 13 }}>
              <li>Configuración de servicios y token Wialon</li>
              <li>Todos los usuarios de la empresa</li>
              <li>Consumos de combustible + facturas</li>
              <li>QR de facturas y códigos</li>
              <li>Expedientes de subsidio (flota, documentos, cuentas bancarias, declaraciones)</li>
              <li>Consumos DU 004 asociados a sus usuarios</li>
            </ul>
          </div>
        </div>
      </div>

      <div>
        <label style={{ display: "block", fontSize: 13, color: "#374151", fontWeight: 500, marginBottom: 6 }}>
          Para confirmar, escribe exactamente el nombre de la empresa: <br/>
          <code style={{ background: "#F3F4F6", padding: "2px 8px", borderRadius: 4, fontSize: 13, marginTop: 6, display: "inline-block" }}>{empresa.empresa}</code>
        </label>
        <input
          value={confirmText}
          onChange={(e) => setConfirmText(e.target.value)}
          data-testid="delete-confirm-input"
          placeholder="Escribe el nombre exacto"
          style={{ width: "100%", height: 42, border: `1px solid ${canDelete ? "#DC2626" : "#E5E7EB"}`, borderRadius: 10, padding: "0 14px", fontSize: 14, background: "#fff", outline: "none", boxSizing: "border-box" }}
        />
      </div>

      <div style={{ display: "flex", gap: 10, justifyContent: "flex-end", marginTop: 22 }}>
        <button onClick={onClose} style={btn.secondary}>Cancelar</button>
        <button onClick={doDelete} disabled={!canDelete || deleting} data-testid="btn-confirm-delete"
          style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "0 20px", height: 40, border: "none", borderRadius: 10,
            background: (!canDelete || deleting) ? "#FCA5A5" : "#DC2626", color: "#fff", fontSize: 14, fontWeight: 600,
            cursor: (!canDelete || deleting) ? "not-allowed" : "pointer",
            boxShadow: canDelete ? "0 4px 12px rgba(220,38,38,.25)" : "none" }}>
          {deleting ? <Loader2 style={{ width: 16, height: 16, animation: "spin 1s linear infinite" }} /> : <Trash2 style={{ width: 16, height: 16 }} />}
          Eliminar definitivamente
        </button>
      </div>
    </Modal>
  );
}

// ─── Servicios Modal ─────────────────────────────────────────────────────────
function ServiciosModal({ empresa, onClose, onSaved }) {
  const [servicios, setServicios] = useState({
    plataforma: empresa.servicios?.plataforma !== false,
    combustible: !!empresa.servicios?.combustible,
    gps: !!empresa.servicios?.gps,
    subsidio: !!empresa.servicios?.subsidio,
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
          const disabled = false;
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
                <div style={{ fontWeight: 700, color: "#111827" }}>{meta.label}</div>
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

// ─── Finanzas Modal ──────────────────────────────────────────────────────────
const PLAN_OPTIONS_FIN = [
  { value: "tracking", label: "Plan Tracking" },
  { value: "advanced", label: "Plan Advanced" },
  { value: "integral", label: "Plan Integral" },
];

function FinanzasModal({ empresa, onClose, onSaved }) {
  const [form, setForm] = useState({
    plan: empresa.plan || "tracking",
    linea_credito: empresa.linea_credito ?? 0,
    dias_credito: empresa.dias_credito ?? 0,
    unidades_contratadas: empresa.unidades_contratadas ?? 0,
  });
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState("");

  async function save() {
    setSaving(true);
    setErr("");
    const lc = parseFloat(form.linea_credito) || 0;
    try {
      await api.post("/empresas-config", {
        empresa: empresa.empresa,
        ruc: empresa.ruc || "",
        plan: form.plan,
        linea_credito: lc <= 0 ? 1.0 : lc,
        unidades_contratadas: parseInt(form.unidades_contratadas) || 0,
        dias_credito: parseInt(form.dias_credito, 10) || 0,
      });
      toast.success("Configuración financiera guardada");
      onSaved();
    } catch (e) {
      setErr(e.response?.data?.detail || "Error al guardar");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal onClose={onClose} testid="modal-finanzas">
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 18 }}>
        <div>
          <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: ".08em", color: "#D97706", textTransform: "uppercase" }}>Config. Financiera</div>
          <div style={{ fontSize: 22, fontWeight: 700, color: "#111827" }}>{empresa.empresa}</div>
        </div>
        <button onClick={onClose} style={btn.close}><X style={{ width: 22, height: 22 }} /></button>
      </div>

      <div style={{ display: "grid", gap: 14 }}>
        <div>
          <label style={styles.label}>Plan contratado</label>
          <select
            value={form.plan}
            onChange={(e) => setForm({ ...form, plan: e.target.value })}
            style={{ ...styles.input, cursor: "pointer" }}
            data-testid="finanzas-plan"
          >
            {PLAN_OPTIONS_FIN.map((p) => (
              <option key={p.value} value={p.value}>{p.label}</option>
            ))}
          </select>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          <div>
            <label style={styles.label}>Línea de crédito (S/)</label>
            <input
              type="number"
              step="0.01"
              min="0"
              value={form.linea_credito}
              onChange={(e) => setForm({ ...form, linea_credito: e.target.value })}
              style={styles.input}
              placeholder="0 = S/ 1.00 por defecto"
              data-testid="finanzas-linea"
            />
            <div style={{ fontSize: 11, color: "#9ca3af", marginTop: 4 }}>Si es 0, se guarda como S/ 1.00</div>
          </div>
          <div>
            <label style={styles.label}>Días de crédito</label>
            <input
              type="number"
              min="0"
              value={form.dias_credito}
              onChange={(e) => setForm({ ...form, dias_credito: e.target.value })}
              style={styles.input}
              placeholder="Ej. 15"
              data-testid="finanzas-dias"
            />
          </div>
        </div>
        <div>
          <label style={styles.label}>Unidades contratadas</label>
          <input
            type="number"
            min="0"
            value={form.unidades_contratadas}
            onChange={(e) => setForm({ ...form, unidades_contratadas: e.target.value })}
            style={styles.input}
            placeholder="Nº de vehículos / unidades"
            data-testid="finanzas-unidades"
          />
        </div>
      </div>

      {err && (
        <div style={{ marginTop: 12, padding: "10px 14px", background: "#FEF2F2", border: "1px solid #FECACA", borderRadius: 10, fontSize: 13, color: "#991B1B" }}>
          {err}
        </div>
      )}

      <div style={{ display: "flex", gap: 10, justifyContent: "flex-end", marginTop: 22 }}>
        <button onClick={onClose} style={btn.secondary}>Cancelar</button>
        <button
          onClick={save}
          disabled={saving}
          data-testid="btn-save-finanzas"
          style={{ ...btn.primary, background: "#D97706", boxShadow: "0 4px 12px rgba(217,119,6,.25)", opacity: saving ? 0.7 : 1 }}
        >
          {saving ? <Loader2 style={{ width: 16, height: 16, animation: "spin 1s linear infinite" }} /> : <Save style={{ width: 16, height: 16 }} />}
          Guardar
        </button>
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
  iconFinanzas: { width: 32, height: 32, borderRadius: 8, border: "1px solid #FDE68A", background: "#FFFBEB", cursor: "pointer", display: "inline-flex", alignItems: "center", justifyContent: "center", color: "#D97706" },
  iconDelete: { width: 32, height: 32, borderRadius: 8, border: "1px solid #FCA5A5", background: "#FEF2F2", cursor: "pointer", display: "inline-flex", alignItems: "center", justifyContent: "center", color: "#DC2626" },
};

const pill = {
  base: { display: "inline-block", padding: "3px 10px", borderRadius: 999, fontSize: 11.5, fontWeight: 600 },
};

// --- MODAL CREAR EMPRESA ---
function CrearEmpresaModal({ onClose, onSaved }) {
  const [form, setForm] = useState({ empresa: "", ruc: "", tipo_cliente: "enered", plan: "tracking" });
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState("");

  async function save() {
    if (!form.empresa.trim()) return setErr("El nombre de la empresa es requerido");
    setSaving(true);
    setErr("");
    try {
      await api.post("/empresas-config", form);
      toast.success("Empresa creada con éxito");
      onSaved();
    } catch (e) {
      setErr(e.response?.data?.detail || "Error al crear la empresa");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal onClose={onClose} testid="modal-crear-empresa">
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 18 }}>
        <div>
          <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: ".08em", color: "#8B3DFF", textTransform: "uppercase" }}>Nueva Empresa</div>
          <div style={{ fontSize: 22, fontWeight: 700, color: "#111827" }}>Crear Empresa</div>
        </div>
        <button onClick={onClose} style={btn.close}><X style={{ width: 22, height: 22 }} /></button>
      </div>

      <div style={{ display: "grid", gap: 14 }}>
        <div>
          <label style={styles.label}>Nombre de la Empresa</label>
          <input
            type="text"
            value={form.empresa}
            onChange={(e) => setForm({ ...form, empresa: e.target.value })}
            style={styles.input}
            placeholder="Ej. Mi Empresa S.A.C."
          />
        </div>
        <div>
          <label style={styles.label}>RUC (Opcional)</label>
          <input
            type="text"
            value={form.ruc}
            onChange={(e) => setForm({ ...form, ruc: e.target.value })}
            style={styles.input}
            placeholder="Ej. 20123456789"
          />
        </div>
        <div>
          <label style={styles.label}>Tipo de Cliente</label>
          <select
            value={form.tipo_cliente}
            onChange={(e) => setForm({ ...form, tipo_cliente: e.target.value })}
            style={{ ...styles.input, cursor: "pointer" }}
          >
            <option value="enered">ENERED (Regular)</option>
            <option value="subsidio">Subsidio DU 004</option>
          </select>
        </div>
        <div>
          <label style={styles.label}>Plan</label>
          <select
            value={form.plan}
            onChange={(e) => setForm({ ...form, plan: e.target.value })}
            style={{ ...styles.input, cursor: "pointer" }}
          >
            <option value="tracking">Tracking</option>
            <option value="advanced">Advanced</option>
            <option value="integral">Integral</option>
          </select>
        </div>
      </div>

      {err && (
        <div style={{ marginTop: 12, padding: "10px 14px", background: "#FEF2F2", border: "1px solid #FECACA", borderRadius: 10, fontSize: 13, color: "#991B1B" }}>
          {err}
        </div>
      )}

      <div style={{ display: "flex", gap: 10, justifyContent: "flex-end", marginTop: 22 }}>
        <button onClick={onClose} style={btn.secondary}>Cancelar</button>
        <button
          onClick={save}
          disabled={saving}
          style={{ ...btn.primary, opacity: saving ? 0.7 : 1 }}
        >
          {saving ? <Loader2 style={{ width: 16, height: 16, animation: "spin 1s linear infinite" }} /> : <Save style={{ width: 16, height: 16 }} />}
          Crear
        </button>
      </div>
    </Modal>
  );
}
