import React from "react";
import { useNavigate } from "react-router-dom";
import { CheckCircle2, ArrowRight, Mail } from "lucide-react";

const LOGO_IMG = "https://customer-assets.emergentagent.com/job_enered-insight/artifacts/hrbrugb8_image.png";

export default function SubsidioFinalizado() {
  const navigate = useNavigate();
  return (
    <div className="min-h-screen bg-gradient-to-br from-brand/5 to-neutral-50 flex items-center justify-center px-4 py-10">
      <div className="bg-white rounded-3xl shadow-lg border border-neutral-200 p-8 sm:p-12 max-w-xl text-center">
        <img src={LOGO_IMG} alt="ENERED" className="h-10 mx-auto mb-8" />
        <div className="w-20 h-20 rounded-full bg-emerald-100 text-emerald-600 mx-auto flex items-center justify-center">
          <CheckCircle2 className="w-12 h-12" />
        </div>
        <h1 className="font-cabinet text-4xl font-bold tracking-tight mt-6">¡Expediente enviado!</h1>
        <p className="text-neutral-600 mt-3">
          Recibimos tus documentos del DU 004-2026. Nuestro equipo Enered los está revisando.
          Te avisaremos por correo cuando esté validado.
        </p>

        <div className="mt-6 bg-neutral-50 rounded-2xl p-4 text-sm text-neutral-700 text-left flex gap-3 items-start">
          <Mail className="w-5 h-5 text-brand flex-shrink-0 mt-0.5" />
          <div>
            Mientras tanto ya puedes explorar tu plataforma — los datos de tus facturas
            están alimentando los módulos de <strong>Flotas</strong> y <strong>Control de costos</strong>.
          </div>
        </div>

        <button
          onClick={() => navigate("/dashboard")}
          className="mt-8 w-full px-6 py-4 bg-brand hover:bg-brand-hover text-white font-bold rounded-2xl flex items-center justify-center gap-2"
          data-testid="finalizado-go-dashboard"
        >
          Ir a mi Dashboard <ArrowRight className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}
