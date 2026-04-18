import React, { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Fuel, Mail, Lock, Loader2 } from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { formatApiError } from "../lib/utils";

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
    <div className="min-h-screen flex">
      {/* Left - Brand panel */}
      <div className="hidden lg:flex lg:w-1/2 bg-gradient-to-br from-[#2D0A4E] via-[#4A148C] to-[#9933FF] relative overflow-hidden">
        <div className="absolute inset-0 opacity-20"
          style={{
            backgroundImage: "radial-gradient(circle at 20% 30%, white 1px, transparent 1px), radial-gradient(circle at 80% 70%, white 1px, transparent 1px)",
            backgroundSize: "60px 60px, 80px 80px",
          }}
        />
        <div className="relative z-10 flex flex-col justify-between p-12 text-white w-full">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-md bg-white/15 backdrop-blur flex items-center justify-center border border-white/20">
              <Fuel className="w-6 h-6" strokeWidth={2.5} />
            </div>
            <div>
              <div className="font-cabinet font-black text-2xl leading-none">ENERED</div>
              <div className="text-[11px] font-bold uppercase tracking-widest text-white/70 mt-1">Fuel Intelligence</div>
            </div>
          </div>

          <div className="max-w-md">
            <div className="text-[11px] font-bold uppercase tracking-widest text-white/70 mb-3">Plataforma multi-empresa</div>
            <h1 className="font-cabinet font-black text-5xl leading-tight mb-4">
              Control total de tu consumo de combustible.
            </h1>
            <p className="text-white/80 text-lg font-medium">
              Visualiza, analiza y decide con datos precisos sobre cada carga, placa y estación.
            </p>
          </div>

          <div className="grid grid-cols-3 gap-6 pt-8 border-t border-white/20">
            <div>
              <div className="text-[10px] font-bold uppercase tracking-widest text-white/60">Galones/mes</div>
              <div className="font-cabinet font-black text-2xl mt-1">+250K</div>
            </div>
            <div>
              <div className="text-[10px] font-bold uppercase tracking-widest text-white/60">Empresas</div>
              <div className="font-cabinet font-black text-2xl mt-1">25+</div>
            </div>
            <div>
              <div className="text-[10px] font-bold uppercase tracking-widest text-white/60">Ahorro</div>
              <div className="font-cabinet font-black text-2xl mt-1">S/ 1.2M</div>
            </div>
          </div>
        </div>
      </div>

      {/* Right - Form */}
      <div className="flex-1 flex items-center justify-center p-6 lg:p-12 bg-white">
        <div className="w-full max-w-md">
          <div className="lg:hidden flex items-center gap-3 mb-8">
            <div className="w-11 h-11 rounded-md bg-brand flex items-center justify-center">
              <Fuel className="w-6 h-6 text-white" strokeWidth={2.5} />
            </div>
            <div>
              <div className="font-cabinet font-black text-2xl leading-none text-neutral-900">ENERED</div>
              <div className="text-[11px] font-bold uppercase tracking-widest text-neutral-500 mt-1">Fuel Intelligence</div>
            </div>
          </div>

          <div className="text-[11px] font-bold uppercase tracking-widest text-brand mb-3">Ingreso seguro</div>
          <h2 className="font-cabinet font-black text-4xl text-neutral-900 mb-2">Bienvenido</h2>
          <p className="text-neutral-500 mb-8">Accede a tu panel de control.</p>

          <form onSubmit={onSubmit} className="space-y-4" data-testid="login-form">
            <div>
              <label className="text-xs font-bold uppercase tracking-wider text-neutral-700 block mb-2">Correo</label>
              <div className="relative">
                <Mail className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400" />
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="tu@empresa.com"
                  className="w-full h-11 pl-10 pr-3 border border-border rounded-md focus:outline-none focus:ring-2 focus:ring-brand focus:border-brand bg-white text-sm font-medium"
                  data-testid="login-email"
                />
              </div>
            </div>

            <div>
              <label className="text-xs font-bold uppercase tracking-wider text-neutral-700 block mb-2">Contraseña</label>
              <div className="relative">
                <Lock className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400" />
                <input
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full h-11 pl-10 pr-3 border border-border rounded-md focus:outline-none focus:ring-2 focus:ring-brand focus:border-brand bg-white text-sm font-medium"
                  data-testid="login-password"
                />
              </div>
            </div>

            {error && (
              <div className="text-sm font-semibold text-red-600 bg-red-50 border border-red-100 rounded-md px-3 py-2" data-testid="login-error">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full h-11 btn-brand text-sm flex items-center justify-center gap-2 disabled:opacity-60"
              data-testid="login-submit"
            >
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
              Ingresar
            </button>

            <div className="text-center">
              <Link to="/forgot-password" className="text-sm font-semibold text-brand hover:text-brand-hover">
                ¿Olvidaste tu contraseña?
              </Link>
            </div>
          </form>

          <div className="mt-8 p-4 bg-neutral-50 border border-border rounded-md">
            <div className="text-[10px] font-bold uppercase tracking-widest text-neutral-500 mb-2">Cuentas demo</div>
            <div className="text-xs space-y-1 text-neutral-600 font-mono">
              <div>admin@enered.com / admin123 <span className="text-brand font-bold">Admin ENERED</span></div>
              <div>administrador@lima.com / demo123</div>
              <div>logistica@lima.com / demo123</div>
              <div>contabilidad@lima.com / demo123</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
