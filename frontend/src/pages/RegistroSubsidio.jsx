import React, { useState, useEffect } from "react";
import { useNavigate, useSearchParams, Link } from "react-router-dom";
import { Loader2, CheckCircle2, AlertCircle, Globe } from "lucide-react";
import { api } from "../lib/api";
import { useAuth } from "../context/AuthContext";
import EmayFooter from "../components/EmayFooter";

const HERO_IMG = "https://customer-assets.emergentagent.com/job_ui-update-11/artifacts/mbmk49w0_WhatsApp%20Image%202026-06-10%20at%206.26.35%20PM.jpeg";
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
    <div className="min-h-screen flex flex-col lg:flex-row bg-white" data-testid="registro-subsidio">
      {/* Left - Hero image panel (idéntico al Login) */}
      <div
        className="hidden lg:block lg:w-1/2 xl:w-[55%] bg-black bg-cover bg-center"
        style={{ backgroundImage: `url(${HERO_IMG})` }}
        data-testid="registro-hero"
      />

      {/* Mobile hero (shorter) */}
      <div
        className="lg:hidden h-56 bg-cover bg-center"
        style={{ backgroundImage: `url(${HERO_IMG})` }}
      />

      {/* Right - Form panel */}
      <div className="flex-1 flex flex-col justify-between px-6 py-8 md:px-12 md:py-10 lg:px-16 xl:px-24 bg-white">
        <div className="w-full max-w-md mx-auto flex-1 flex flex-col justify-center">
          {/* Logo */}
          <div className="mb-8">
            <img src={LOGO_IMG} alt="ENERED" className="h-10 md:h-12 w-auto" />
          </div>

          {/* Subsidio recuperable card */}
          <div className="bg-gradient-to-br from-brand to-brand-hover text-white rounded-2xl p-5 mb-7 shadow-md">
            <div className="text-[10px] uppercase tracking-widest opacity-80 font-bold">Tu subsidio recuperable</div>
            <div className="font-cabinet text-4xl font-bold mt-1 leading-tight">
              S/ {Number(calc.subsidio_estimado || 0).toLocaleString("es-PE", { maximumFractionDigits: 0 })}
            </div>
            <div className="text-xs opacity-90 mt-1">DU 004-2026 · Junio + Julio 2026</div>
          </div>

          {/* Title */}
          <h1 className="text-brand text-3xl md:text-4xl font-bold font-cabinet mb-2" style={{ letterSpacing: "-0.01em" }}>
            Crea tu cuenta
          </h1>
          <p className="text-neutral-600 text-sm mb-7">
            Para continuar con el expediente DU 004-2026 necesitamos los datos de tu empresa.
          </p>

          <form onSubmit={submit} className="space-y-4" data-testid="registro-subsidio-form">
            <Field label="RUC (11 dígitos)">
              <input
                className="ru-input"
                placeholder="20123456789"
                maxLength={11}
                value={form.ruc}
                onChange={(e) => upd("ruc", e.target.value.replace(/\D/g, ""))}
                data-testid="reg-ruc"
              />
            </Field>
            <Field label="Razón social">
              <input className="ru-input" value={form.razon_social}
                onChange={(e) => upd("razon_social", e.target.value)}
                data-testid="reg-razon" placeholder="Transportes Juan SAC" />
            </Field>
            <div className="grid sm:grid-cols-2 gap-4">
              <Field label="Nombre de contacto">
                <input className="ru-input" value={form.contacto}
                  onChange={(e) => upd("contacto", e.target.value)} data-testid="reg-contacto" />
              </Field>
              <Field label="Teléfono">
                <input className="ru-input" value={form.telefono}
                  onChange={(e) => upd("telefono", e.target.value)} data-testid="reg-telefono"
                  placeholder="+51 987 654 321" />
              </Field>
            </div>
            <Field label="Email">
              <input type="email" className="ru-input" value={form.email}
                onChange={(e) => upd("email", e.target.value.trim())} data-testid="reg-email" />
            </Field>
            <div className="grid sm:grid-cols-2 gap-4">
              <Field label="Contraseña (mín. 8)">
                <input type="password" className="ru-input" value={form.password}
                  onChange={(e) => upd("password", e.target.value)} data-testid="reg-password" minLength={8} />
              </Field>
              <Field label="Repite la contraseña">
                <input type="password" className="ru-input" value={form.password2}
                  onChange={(e) => upd("password2", e.target.value)} data-testid="reg-password2" minLength={8} />
              </Field>
            </div>

            {error && (
              <div className="bg-red-50 border border-red-200 text-red-700 rounded-xl p-3 text-sm flex gap-2 items-start" data-testid="reg-error">
                <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" /> {error}
              </div>
            )}

            <button
              type="submit"
              disabled={!valid || submitting}
              className="w-full h-14 bg-brand hover:bg-brand-hover active:bg-brand-active text-white font-bold rounded-2xl text-base flex items-center justify-center gap-2 transition-all shadow-sm hover:shadow-md disabled:opacity-60"
              data-testid="reg-submit"
            >
              {submitting ? <Loader2 className="w-5 h-5 animate-spin" /> : <CheckCircle2 className="w-5 h-5" />}
              {submitting ? "Creando cuenta..." : "Crear cuenta y continuar"}
            </button>

            <p className="text-center text-xs text-neutral-500 pt-1">
              Al continuar aceptas los Términos y la Política de Privacidad de Enered.
            </p>

            <div className="text-center pt-2">
              <span className="text-sm text-neutral-500">¿Ya tienes cuenta? </span>
              <Link to="/login" className="text-sm font-medium text-brand hover:text-brand-hover hover:underline">
                Inicia sesión
              </Link>
            </div>
          </form>

          {/* Contact block */}
          <div className="mt-10 pt-8 border-t border-neutral-100 text-sm text-neutral-700 leading-relaxed">
            <p className="font-bold text-neutral-900 mb-2">¿Necesitas ayuda?</p>
            <div className="flex items-start gap-3">
              <div className="w-9 h-9 rounded-full bg-brand flex items-center justify-center flex-shrink-0">
                <Globe className="w-4 h-4 text-white" strokeWidth={2} />
              </div>
              <div className="flex-1 text-xs md:text-sm text-neutral-700 pt-1.5">
                (044) 659-3519 | +51 972 228 870 | <a href="mailto:hola@enered.pe" className="hover:text-brand">hola@enered.pe</a>
              </div>
            </div>
          </div>
        </div>

        {/* Footer ENERED */}
        <div className="w-full max-w-md mx-auto pt-8 space-y-3 text-center">
          <div className="text-xs text-neutral-600">
            <a href="#" className="hover:text-brand">Asistencia técnica</a>
            <span className="mx-2">•</span>
            <a href="#" className="hover:text-brand">Términos y condiciones</a>
            <span className="mx-2">•</span>
            <a href="#" className="hover:text-brand">Avisos de copyright</a>
          </div>
          <div className="text-xs text-neutral-500">
            <a href="https://www.energix.pe" target="_blank" rel="noreferrer" className="hover:text-brand">www.energix.pe</a>
          </div>
          <div className="text-[11px] text-neutral-400 pt-2 border-t border-neutral-100">
            ENERED | Soluciones en Energías | Copyright © {new Date().getFullYear()} | Energix Perú | Todos los derechos reservados.
          </div>
          <EmayFooter variant="card" />
        </div>
      </div>

      <style>{`
        .ru-input { width:100%; height:48px; padding:0 16px; border:1px solid #d4d4d4; border-radius:12px; background:#fff; transition:all .15s; font-size:15px; }
        .ru-input:focus { outline:none; border-color:#7c3aed; box-shadow:0 0 0 3px rgba(124,58,237,0.1); }
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
