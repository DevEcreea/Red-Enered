import React, { useState } from "react";
import { Link } from "react-router-dom";
import { Mail, Loader2, ArrowLeft } from "lucide-react";
import { api } from "../lib/api";
import { formatApiError } from "../lib/utils";

export default function ForgotPassword() {
  const [email, setEmail] = useState("");
  const [msg, setMsg] = useState("");
  const [err, setErr] = useState("");
  const [loading, setLoading] = useState(false);

  const onSubmit = async (e) => {
    e.preventDefault();
    setErr(""); setMsg(""); setLoading(true);
    try {
      const { data } = await api.post("/auth/forgot-password", { email });
      setMsg(data.message);
    } catch (e2) {
      setErr(formatApiError(e2.response?.data?.detail));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-neutral-50 p-6">
      <div className="w-full max-w-md bg-white rounded-lg border border-border p-8">
        <div className="flex items-center gap-3 mb-8">
          <img
            src="https://customer-assets.emergentagent.com/job_enered-insight/artifacts/hrbrugb8_image.png"
            alt="ENERED"
            className="h-8 w-auto"
          />
        </div>

        <h2 className="font-cabinet font-black text-3xl text-neutral-900 mb-2">Recuperar acceso</h2>
        <p className="text-neutral-500 mb-6 text-sm">Te enviaremos un enlace para crear una nueva contraseña.</p>

        <form onSubmit={onSubmit} className="space-y-4">
          <div>
            <label className="text-xs font-bold uppercase tracking-wider text-neutral-700 block mb-2">Correo</label>
            <div className="relative">
              <Mail className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400" />
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full h-11 pl-10 pr-3 border border-border rounded-md focus:outline-none focus:ring-2 focus:ring-brand"
                data-testid="forgot-email"
              />
            </div>
          </div>

          {msg && <div className="text-sm text-green-700 bg-green-50 border border-green-100 rounded-md px-3 py-2" data-testid="forgot-msg">{msg}</div>}
          {err && <div className="text-sm text-red-600 bg-red-50 border border-red-100 rounded-md px-3 py-2">{err}</div>}

          <button type="submit" disabled={loading} className="w-full h-11 btn-brand flex items-center justify-center gap-2 disabled:opacity-60" data-testid="forgot-submit">
            {loading && <Loader2 className="w-4 h-4 animate-spin" />} Enviar enlace
          </button>

          <Link to="/login" className="flex items-center justify-center gap-2 text-sm font-semibold text-neutral-600 hover:text-brand">
            <ArrowLeft className="w-4 h-4" /> Volver al ingreso
          </Link>
        </form>
      </div>
    </div>
  );
}
