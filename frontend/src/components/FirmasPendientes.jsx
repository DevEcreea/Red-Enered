import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ShieldAlert } from "lucide-react";
import { api } from "../lib/api";

/* Son DOS declaraciones juradas distintas: la del DU 004 (una sola) y la del DU 007 (una por
   periodo). Este aviso muestra lo que falta firmar en AMBOS decretos, esté donde esté el cliente,
   y lo lleva a la pantalla correcta. `actual` = decreto de la página donde se muestra. */
export function rutaFirmaPendiente(f) {
  if (!f) return null;
  // Primero la página de la DJ pendiente (la constancia se acepta en cualquiera de las dos).
  if (f.du004?.pendiente) return "/subsidio/documentos";
  if ((f.du007?.periodos_pendientes || []).length > 0) return "/subsidio/du007";
  if (!f.constancia) return "/subsidio/documentos";
  return null;
}

export default function FirmasPendientes({ actual, onCargado }) {
  const [f, setF] = useState(null);
  const navigate = useNavigate();
  useEffect(() => {
    let vivo = true;
    api.get("/subsidio/firmas").then(({ data }) => { if (vivo) { setF(data); onCargado?.(data); } }).catch(() => {});
    return () => { vivo = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  if (!f) return null;
  const items = [];
  if (!f.constancia) items.push({ k: "constancia", txt: "Constancia de términos del servicio", to: "/subsidio/documentos" });
  if (f.du004?.pendiente) items.push({ k: "du004", txt: `Declaración jurada DU 004 (${f.du004.facturas} factura${f.du004.facturas === 1 ? "" : "s"} cargada${f.du004.facturas === 1 ? "" : "s"})`, to: "/subsidio/documentos" });
  for (const p of (f.du007?.periodos_pendientes || [])) items.push({ k: `du007_p${p}`, txt: `Declaración jurada DU 007 · Periodo ${p}`, to: "/subsidio/du007" });
  if (items.length === 0) return null;
  return (
    <div className="bg-red-50 border border-red-200 rounded-2xl p-4 flex items-start gap-3" data-testid="firmas-pendientes">
      <ShieldAlert className="w-5 h-5 text-red-600 mt-0.5 flex-shrink-0" />
      <div className="text-sm text-red-900 flex-1">
        <div className="font-bold">Tienes {items.length} firma{items.length === 1 ? "" : "s"} pendiente{items.length === 1 ? "" : "s"}</div>
        <div className="text-red-800 mt-0.5">Sin la declaración jurada tus facturas no se presentan a la ATU. Fírmala para que tu consumo cuente.</div>
        <ul className="mt-2 space-y-1">
          {items.map((it) => {
            // La constancia se acepta en la etapa de Declaración de cualquiera de los dos decretos.
            const aqui = it.k === "constancia" || (actual === "du004" && it.to === "/subsidio/documentos") || (actual === "du007" && it.to === "/subsidio/du007");
            return (
              <li key={it.k} className="flex items-center gap-2 flex-wrap">
                <span>• {it.txt}</span>
                {aqui
                  ? <span className="text-xs font-bold text-red-700">→ fírmala aquí, en la etapa de Declaración</span>
                  : <button onClick={() => navigate(it.to)} className="text-xs font-bold underline text-red-700 hover:text-red-900">Ir a firmar →</button>}
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
}
