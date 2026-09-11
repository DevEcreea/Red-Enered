import React, { useEffect, useState } from "react";
import { api } from "../lib/api";
import { ShieldCheck, CheckCircle2, Loader2 } from "lucide-react";
import CONSTANCIA_V2 from "../data/constanciaV2";

// Apartado de la Constancia de Información y Condiciones del Servicio dentro de la
// sección "Declaración jurada y términos del servicio". Reemplaza a la ventana emergente.
// Informa el estado (aceptada/no) al padre para poder condicionar el firmado de la DJ.
const partirTit = (t) => { const i = t.indexOf(". "); return (i > 0 && i < 90) ? [t.slice(0, i + 1), t.slice(i + 2)] : ["", t]; };

export default function ConstanciaApartado({ onEstado }) {
  const [cst, setCst] = useState(null);
  const [acc, setAcc] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState(null);

  const ok = !!(cst && cst.aceptada && cst.aceptada.version === cst.version);

  useEffect(() => {
    let vivo = true;
    api.get("/constancia").then(({ data }) => { if (vivo) setCst(data); }).catch(() => {});
    return () => { vivo = false; };
  }, []);
  useEffect(() => { if (cst) onEstado?.(ok); /* eslint-disable-next-line */ }, [cst]);

  const aceptar = async () => {
    if (!acc || busy) return;
    setBusy(true); setErr(null);
    try {
      const { data } = await api.post("/constancia/aceptar", { no_volver_a_mostrar: false }, { timeout: 15000 });
      setCst((c) => ({ ...(c || {}), aceptada: data.aceptada }));
      onEstado?.(true);
    } catch (e) {
      setErr(e?.response?.data?.detail || "No se pudo registrar la aceptación. Intenta de nuevo.");
    } finally { setBusy(false); }
  };

  if (!cst) return null;

  if (ok) {
    return (
      <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4 text-sm mb-4" data-testid="constancia-apartado-ok">
        <div className="flex items-center gap-2"><CheckCircle2 className="w-5 h-5 text-emerald-700" /><strong className="font-cabinet">Constancia de Información y Condiciones del Servicio aceptada</strong></div>
        {cst?.aceptada?.at && <p className="text-emerald-900 mt-1">Registrada el {new Date(cst.aceptada.at).toLocaleString("es-PE")}.</p>}
      </div>
    );
  }

  const c = cst.cliente;
  let preamb = CONSTANCIA_V2.preamble;
  if (c) { if (c.representante) preamb = preamb.replace("[Nombre del representante legal]", c.representante); if (c.dni) preamb = preamb.replace("[DNI]", c.dni); if (c.cargo) preamb = preamb.replace("[cargo]", c.cargo); }

  return (
    <div className="bg-violet-50 border border-violet-200 rounded-xl p-4 mb-4" data-testid="constancia-apartado">
      <div className="flex items-center gap-2 mb-1"><ShieldCheck className="w-5 h-5 text-violet-700" /><strong className="font-cabinet text-base">Constancia de Información y Condiciones del Servicio</strong></div>
      <p className="text-sm text-neutral-700 mb-3">Lee y acepta la constancia del servicio. Deja registro de que fuiste informado de que ENERED gestiona tu expediente pero no garantiza el subsidio. Es requisito para firmar tu declaración jurada.</p>

      <div className="bg-white border border-violet-100 rounded-lg p-3 max-h-96 overflow-y-auto text-[12.5px] text-neutral-700 mb-3">
        {c && (<p className="font-semibold text-neutral-900 mb-1">Empresa (EL CLIENTE): {c.razon_social || "—"}{c.ruc ? ` · RUC: ${c.ruc}` : ""}<br/>Prestador (ENERED): ENERGIX PERÚ E.I.R.L. · RUC 20609304082</p>)}
        <p className="italic text-neutral-600 mb-2">{preamb}</p>
        {CONSTANCIA_V2.secciones.map((sec, si) => (
          <div key={si} className="mt-2">
            <div className="font-bold text-violet-900">{sec.titulo}</div>
            {sec.clausulas.map((cl) => { const [tit, resto] = partirTit(cl.texto); return (
              <p key={cl.n} className="mt-1"><span className="font-bold text-violet-700">{cl.n}.</span> {tit && <strong className="text-neutral-900">{tit}</strong>} {resto}</p>
            ); })}
          </div>
        ))}
        {CONSTANCIA_V2.declaracion && (<div className="mt-2"><div className="font-bold text-violet-900">DECLARACIÓN FINAL</div><p className="mt-1">{CONSTANCIA_V2.declaracion}</p></div>)}
      </div>

      <label className={`flex items-start gap-3 p-3 rounded-lg cursor-pointer border ${acc ? "bg-violet-100 border-violet-400" : "bg-white border-neutral-300"}`}>
        <input type="checkbox" checked={acc} onChange={(e) => setAcc(e.target.checked)} className="mt-1 w-5 h-5 accent-violet-600" data-testid="constancia-apartado-check" />
        <span className="text-sm text-neutral-800">Declaro que he leído y acepto de forma libre e íntegra esta Constancia de Información y Condiciones del Servicio. Entiendo que ENERED es una empresa privada que gestiona y presenta mi expediente, que <strong>no garantiza la aprobación ni el pago del subsidio</strong>, y que la decisión, el monto y la fecha del abono dependen exclusivamente de la ATU.</span>
      </label>
      {err && <div className="mt-2 bg-red-50 border border-red-200 text-red-700 rounded-lg p-2 text-sm">{err}</div>}
      <div className="mt-3 flex justify-end">
        <button onClick={aceptar} disabled={!acc || busy} className="px-4 py-2 bg-violet-700 hover:bg-violet-800 text-white font-bold rounded-lg flex items-center gap-2 disabled:opacity-50" data-testid="constancia-apartado-aceptar">
          {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <ShieldCheck className="w-4 h-4" />} Aceptar la constancia
        </button>
      </div>
    </div>
  );
}
