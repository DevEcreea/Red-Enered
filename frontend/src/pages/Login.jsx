import React, { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { User, Lock, Loader2, Globe, Phone } from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { formatApiError } from "../lib/utils";
import EmayFooter from "../components/EmayFooter";

const HERO_IMG = "https://customer-assets.emergentagent.com/job_enered-insight/artifacts/0fc04sfs_image.png";
const LOGO_IMG = "https://customer-assets.emergentagent.com/job_enered-insight/artifacts/hrbrugb8_image.png";

export default function Login() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const onSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      await login(email, password);
      navigate("/dashboard");
    } catch (e2) {
      setError(formatApiError(e2.response?.data?.detail) || "Error al iniciar sesión");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col lg:flex-row bg-white">
      {/* Left - Hero image panel */}
      <div
        className="hidden lg:block lg:w-1/2 xl:w-[55%] bg-black bg-cover bg-center"
        style={{ backgroundImage: `url(${HERO_IMG})` }}
        data-testid="login-hero"
      >
        {/* image already has text baked in */}
      </div>

      {/* Mobile hero (shorter) */}
      <div
        className="lg:hidden h-56 bg-cover bg-center"
        style={{ backgroundImage: `url(${HERO_IMG})` }}
      />

      {/* Right - Form panel */}
      <div className="flex-1 flex flex-col justify-between px-6 py-8 md:px-12 md:py-10 lg:px-16 xl:px-24 bg-white">
        <div className="w-full max-w-md mx-auto flex-1 flex flex-col justify-center">
          {/* Logo */}
          <div className="mb-10">
            <img src={LOGO_IMG} alt="ENERED" className="h-10 md:h-12 w-auto" />
          </div>

          {/* Title */}
          <h1 className="text-brand text-3xl md:text-4xl font-bold font-cabinet mb-8" style={{ letterSpacing: "-0.01em" }}>
            Inicia Sesión
          </h1>

          <form onSubmit={onSubmit} className="space-y-5" data-testid="login-form">
            {/* Usuario */}
            <div className="relative">
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="Usuario"
                className="peer w-full h-14 px-5 pr-12 border border-neutral-300 rounded-2xl focus:outline-none focus:ring-2 focus:ring-brand focus:border-brand text-base bg-white transition"
                data-testid="login-email"
              />
              <User className="w-5 h-5 absolute right-5 top-1/2 -translate-y-1/2 text-neutral-400" strokeWidth={1.8} />
            </div>

            {/* Contraseña */}
            <div className="relative">
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Contraseña"
                className="peer w-full h-14 px-5 pr-12 border border-neutral-300 rounded-2xl focus:outline-none focus:ring-2 focus:ring-brand focus:border-brand text-base bg-white transition"
                data-testid="login-password"
              />
              <Lock className="w-5 h-5 absolute right-5 top-1/2 -translate-y-1/2 text-neutral-400" strokeWidth={1.8} />
            </div>

            {error && (
              <div className="text-sm font-semibold text-red-600 bg-red-50 border border-red-100 rounded-xl px-4 py-3" data-testid="login-error">
                {error}
              </div>
            )}

            {/* Submit */}
            <button
              type="submit"
              disabled={loading}
              className="w-full h-14 bg-brand hover:bg-brand-hover active:bg-brand-active text-white font-bold rounded-2xl text-base flex items-center justify-center gap-2 transition-all shadow-sm hover:shadow-md disabled:opacity-60"
              data-testid="login-submit"
            >
              {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : null}
              Ingresar
            </button>

            {/* Forgot */}
            <div className="text-center pt-2">
              <Link to="/forgot-password" className="text-sm font-medium text-brand hover:text-brand-hover hover:underline">
                ¿Has olvidado tu contraseña?
              </Link>
            </div>
          </form>

          {/* Contact block */}
          <div className="mt-10 pt-8 border-t border-neutral-100 text-sm text-neutral-700 leading-relaxed">
            <p className="font-bold text-neutral-900 mb-2">Para nuestros clientes:</p>
            <p className="text-neutral-600 mb-4">
              Si aún no tienes tu usuario y/o clave, por favor comunícate con nuestros ejecutivos corporativos, a los siguientes números y/o correos electrónicos:
            </p>
            <div className="flex items-start gap-3">
              <div className="w-9 h-9 rounded-full bg-brand flex items-center justify-center flex-shrink-0">
                <Globe className="w-4 h-4 text-white" strokeWidth={2} />
              </div>
              <div className="flex-1 text-xs md:text-sm text-neutral-700 pt-1.5">
                (044) 659-3519 | +51 972 228 870 | <a href="mailto:hola@enered.pe" className="hover:text-brand">hola@enered.pe</a>
              </div>
            </div>
          </div>

          {/* EMAY TECH branding card */}
          <EmayFooter variant="card" />
        </div>

        {/* Footer */}
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
        </div>
      </div>
    </div>
  );
}
