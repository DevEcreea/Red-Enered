import React, { useState, useEffect } from "react";
import { useNavigate, useSearchParams, Link } from "react-router-dom";
import { Loader2, ArrowRight, CheckCircle2, AlertCircle } from "lucide-react";
import { api } from "../lib/api";
import { useAuth } from "../context/AuthContext";

const LOGO_IMG = "https://customer-assets.emergentagent.com/job_enered-insight/artifacts/hrbrugb8_image.png";

export default function RegistroSubsidio() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const { setUser } = useAuth();
  const calcId = params.get("calc_id");

  const [calc, setCalc] = useState(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  const [form, setForm] = useState({
    ruc: "", razon_social: "", contacto: "", telefono: "",
    email: "", password: "", password2: "",
  });

  useEffect(() => {
    if (!calcId) {
      setLoading(false);
      return;
    }
    (async () => {
      try {
        const { data } = await api.get(`/calculations/${calcId}`);
        setCalc(data);
      } catch {
        setError("No encontramos tu cálculo. Vuelve a calcular en la calculadora.");
      } finally {
        setLoading(false);
      }
    })();
  }, [calcId]);

  const upd = (k, v) => setForm((p) => ({ ...p, [k]: v }));

  const valid =
    form.ruc.length === 11 &&
    form.razon_social.trim().length > 2 &&
    form.contacto.trim().length > 2 &&
    form.telefono.trim().length > 5 &&
    /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email) &&
    form.password.length >= 8 &&
    form.password === form.password2;

  const submit = async (e) => {
    e.preventDefault();
    if (!valid) return;
    setSubmitting(true);
    setError("");
    try {
      const { data } = await api.post("/auth/register-from-calculator", {
        calc_id: calcId,
        ruc: form.ruc,
        razon_social: form.razon_social,
        contacto: form.contacto,
        telefono: form.telefono,
        email: form.email,
        password: form.password,
      });
      if (data.access_token) localStorage.setItem("enered_token", data.access_token);
      setUser(data.user);
      navigate("/subsidio/documentos", { replace: true });
    } catch (e2) {
      setError(e2?.response?.data?.detail || "No se pudo crear la cuenta");
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center"><Loader2 className="w-8 h-8 animate-spin text-brand" /></div>;
  }
  if (!calcId || !calc) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-neutral-50 px-4">
        <div className="bg-white rounded-2xl shadow-sm border border-neutral-200 p-8 max-w-md text-center">
          <AlertCircle className="w-10 h-10 text-amber-500 mx-auto" />
          <h2 className="font-bold text-xl mt-3">Calcula primero tu subsidio</h2>
          <p className="text-neutral-600 text-sm mt-2">El registro solo está disponible después de usar la calculadora.</p>
          <Link to="/login" className="inline-block mt-5 text-brand font-bold hover:underline">Volver al login</Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-neutral-50 py-10 px-4">
      <div className="max-w-2xl mx-auto">
        <img src={LOGO_IMG} alt="ENERED" className="h-10 mb-6 mx-auto" />

        <div className="bg-gradient-to-br from-brand to-brand-hover text-white rounded-2xl p-6 mb-6 shadow-md">
          <div className="text-xs uppercase tracking-widest opacity-80">Tu subsidio recuperable</div>
          <div className="font-cabinet text-5xl font-bold mt-1">
            S/ {Number(calc.subsidio_estimado || 0).toLocaleString("es-PE", { maximumFractionDigits: 0 })}
          </div>
          <div className="text-sm opacity-90 mt-1">DU 004-2026 · Junio + Julio 2026</div>
        </div>

        <div className="bg-white rounded-2xl shadow-sm border border-neutral-200 p-6 md:p-8">
          <h1 className="font-cabinet text-3xl font-bold tracking-tight">Crea tu cuenta</h1>
          <p className="text-neutral-600 text-sm mt-2">Para continuar con el expediente DU 004-2026 necesitamos los datos de tu empresa.</p>

          <form onSubmit={submit} className="mt-6 space-y-4" data-testid="registro-subsidio-form">
            <Field label="RUC (11 dígitos)">
              <input
                className="field-input"
                placeholder="20123456789"
                maxLength={11}
                value={form.ruc}
                onChange={(e) => upd("ruc", e.target.value.replace(/\D/g, ""))}
                data-testid="reg-ruc"
              />
            </Field>
            <Field label="Razón social">
              <input className="field-input" value={form.razon_social}
                onChange={(e) => upd("razon_social", e.target.value)}
                data-testid="reg-razon" placeholder="Transportes Juan SAC" />
            </Field>
            <div className="grid sm:grid-cols-2 gap-4">
              <Field label="Nombre de contacto">
                <input className="field-input" value={form.contacto}
                  onChange={(e) => upd("contacto", e.target.value)} data-testid="reg-contacto" />
              </Field>
              <Field label="Teléfono">
                <input className="field-input" value={form.telefono}
                  onChange={(e) => upd("telefono", e.target.value)} data-testid="reg-telefono"
                  placeholder="+51 987 654 321" />
              </Field>
            </div>
            <Field label="Email">
              <input type="email" className="field-input" value={form.email}
                onChange={(e) => upd("email", e.target.value.trim())} data-testid="reg-email" />
            </Field>
            <div className="grid sm:grid-cols-2 gap-4">
              <Field label="Contraseña (mín. 8)">
                <input type="password" className="field-input" value={form.password}
                  onChange={(e) => upd("password", e.target.value)} data-testid="reg-password" minLength={8} />
              </Field>
              <Field label="Repite la contraseña">
                <input type="password" className="field-input" value={form.password2}
                  onChange={(e) => upd("password2", e.target.value)} data-testid="reg-password2" minLength={8} />
              </Field>
            </div>

            {error && (
              <div className="bg-red-50 border border-red-200 text-red-700 rounded-xl p-3 text-sm flex gap-2 items-start">
                <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" /> {error}
              </div>
            )}

            <button
              type="submit"
              disabled={!valid || submitting}
              className="w-full h-13 py-4 bg-brand hover:bg-brand-hover active:bg-brand-active text-white font-bold rounded-2xl flex items-center justify-center gap-2 disabled:opacity-50"
              data-testid="reg-submit"
            >
              {submitting ? <Loader2 className="w-5 h-5 animate-spin" /> : <CheckCircle2 className="w-5 h-5" />}
              {submitting ? "Creando cuenta..." : "Crear cuenta y continuar"}
            </button>

            <p className="text-center text-xs text-neutral-500 pt-2">
              Al continuar aceptas los Términos y la Política de Privacidad de Enered.
            </p>
          </form>
        </div>

        <div className="text-center mt-6 text-sm text-neutral-500">
          ¿Ya tienes cuenta?{" "}
          <Link to="/login" className="text-brand font-bold hover:underline">Inicia sesión</Link>
        </div>
      </div>

      <style>{`
        .field-input { width:100%; height:48px; padding:0 16px; border:1px solid #d4d4d4; border-radius:12px; background:#fff; transition:all .15s; font-size:15px; }
        .field-input:focus { outline:none; border-color:#7c3aed; box-shadow:0 0 0 3px rgba(124,58,237,0.1); }
      `}</style>
    </div>
  );
}

function Field({ label, children }) {
  return (
    <div>
      <label className="block text-sm font-bold text-neutral-800 mb-1.5">{label}</label>
      {children}
    </div>
  );
}
