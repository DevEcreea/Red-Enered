import React, { useEffect, useRef, useState } from "react";
import QRCode from "qrcode";
import { api } from "../lib/api";
import { Smartphone, Loader2, X, Copy, CheckCircle2, AlertTriangle, Clock } from "lucide-react";

/* Botón "Subir desde tu celular": genera un enlace temporal (QR). El cliente lo escanea,
   toma fotos de sus facturas y estas entran al mismo OCR/validador que la carga normal.
   Mientras el modal está abierto, la PC consulta cada 3 s cuántas fotos llegaron y avisa
   al padre (onNuevas) para que refresque su lista de borradores. */
export default function QrSubidaCelular({ programa = "du004", onNuevas, label = "Subir desde tu celular", className = "" }) {
  const [open, setOpen] = useState(false);
  const [sesion, setSesion] = useState(null);
  const [qr, setQr] = useState(null);
  const [estado, setEstado] = useState({ recibidas: 0, items: [], vencido: false });
  const [err, setErr] = useState(null);
  const [copiado, setCopiado] = useState(false);
  const vistas = useRef(0);
  const url = sesion ? `${window.location.origin}/captura/${sesion.token}` : "";

  const abrir = async () => {
    setOpen(true); setErr(null); setEstado({ recibidas: 0, items: [], vencido: false }); vistas.current = 0; setQr(null);
    try {
      const { data } = await api.post("/subsidio/captura/sesion", { programa });
      setSesion(data);
      setQr(await QRCode.toDataURL(`${window.location.origin}/captura/${data.token}`, { width: 280, margin: 1 }));
    } catch (e) { setErr(e?.response?.data?.detail || "No se pudo generar el QR. Intenta de nuevo."); }
  };
  const cerrar = async () => {
    setOpen(false);
    if (sesion) { try { await api.post(`/subsidio/captura/${sesion.token}/cerrar`); } catch { /* nada */ } }
    setSesion(null); setQr(null);
  };
  const copiar = async () => { try { await navigator.clipboard.writeText(url); setCopiado(true); setTimeout(() => setCopiado(false), 1500); } catch { /* nada */ } };

  useEffect(() => {
    if (!open || !sesion) return;
    const t = setInterval(async () => {
      try {
        const { data } = await api.get(`/subsidio/captura/${sesion.token}/estado`);
        setEstado(data);
        if ((data.recibidas || 0) > vistas.current) { vistas.current = data.recibidas; onNuevas?.(); }
        if (data.vencido) clearInterval(t);
      } catch { /* silencioso */ }
    }, 3000);
    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, sesion]);

  const minutos = sesion ? Math.max(0, Math.round((new Date(sesion.expires_at) - Date.now()) / 60000)) : 0;

  return (
    <>
      <button type="button" onClick={abrir} data-testid="qr-subir-celular"
        className={`px-4 py-2.5 border-2 border-brand text-brand hover:bg-brand/5 font-bold rounded-lg flex items-center gap-2 text-sm ${className}`}>
        <Smartphone className="w-4 h-4" /> {label}
      </button>

      {open && (
        <div className="fixed inset-0 z-[9998] bg-black/55 backdrop-blur-sm flex items-center justify-center p-4" role="dialog" aria-modal="true">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl overflow-hidden">
            <div className="flex items-center justify-between px-5 py-4 border-b border-neutral-200">
              <div className="flex items-center gap-2 font-cabinet font-bold text-lg text-neutral-900">
                <Smartphone className="w-5 h-5 text-brand" /> Sube tus facturas desde el celular
              </div>
              <button onClick={cerrar} className="p-1.5 rounded-lg hover:bg-neutral-100" aria-label="Cerrar"><X className="w-5 h-5" /></button>
            </div>

            <div className="grid md:grid-cols-2 gap-5 p-5">
              <div className="flex flex-col items-center text-center">
                {err ? (
                  <div className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg p-3">{err}</div>
                ) : qr ? (
                  <>
                    <img src={qr} alt="Código QR para subir desde el celular" className="w-[260px] h-[260px] rounded-xl border border-neutral-200" />
                    <div className="mt-2 text-[11px] text-neutral-500 flex items-center gap-1"><Clock className="w-3 h-3" /> Vence en {minutos} min</div>
                    <button onClick={copiar} className="mt-2 text-xs font-bold text-brand flex items-center gap-1">
                      <Copy className="w-3.5 h-3.5" /> {copiado ? "Enlace copiado" : "Copiar enlace para enviarlo por WhatsApp"}
                    </button>
                  </>
                ) : (
                  <div className="w-[260px] h-[260px] flex items-center justify-center"><Loader2 className="w-8 h-8 animate-spin text-brand" /></div>
                )}
              </div>

              <div className="text-sm text-neutral-700">
                <ol className="space-y-2.5 list-none">
                  <li className="flex gap-2.5"><span className="w-6 h-6 rounded-full bg-brand text-white text-xs font-bold flex items-center justify-center flex-shrink-0">1</span><span>Abre la <b>cámara</b> de tu celular y apunta al código QR.</span></li>
                  <li className="flex gap-2.5"><span className="w-6 h-6 rounded-full bg-brand text-white text-xs font-bold flex items-center justify-center flex-shrink-0">2</span><span>Toca el enlace: se abre una página para <b>tomar fotos</b> de tus facturas. No necesitas iniciar sesión.</span></li>
                  <li className="flex gap-2.5"><span className="w-6 h-6 rounded-full bg-brand text-white text-xs font-bold flex items-center justify-center flex-shrink-0">3</span><span>Pulsa <b>Enviar</b>. Las facturas aparecen aquí solas, ya leídas.</span></li>
                </ol>
                <p className="mt-3 text-[11px] text-neutral-500">Consejo: que se vea completa la factura y nítido el <b>código QR de SUNAT</b> que trae impreso. Así se lee todo sin errores.</p>

                <div className={`mt-4 rounded-xl border p-3 ${estado.recibidas > 0 ? "bg-emerald-50 border-emerald-200" : "bg-neutral-50 border-neutral-200"}`} data-testid="qr-estado">
                  <div className="font-bold text-neutral-900 flex items-center gap-2">
                    {estado.recibidas > 0 ? <CheckCircle2 className="w-4 h-4 text-emerald-600" /> : <Loader2 className="w-4 h-4 animate-spin text-neutral-400" />}
                    {estado.recibidas > 0 ? `${estado.recibidas} factura${estado.recibidas === 1 ? "" : "s"} recibida${estado.recibidas === 1 ? "" : "s"}` : "Esperando fotos del celular…"}
                  </div>
                  {estado.items?.length > 0 && (
                    <ul className="mt-2 space-y-1 max-h-32 overflow-y-auto text-xs">
                      {estado.items.slice().reverse().map((it, i) => (
                        <li key={it.id || i} className="flex items-center gap-2">
                          {it.ok ? <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 flex-shrink-0" /> : <AlertTriangle className="w-3.5 h-3.5 text-amber-600 flex-shrink-0" />}
                          <span className="font-mono font-bold">{it.numero || "sin número"}</span>
                          <span className="text-neutral-500">{it.placa || "—"} · {it.galones ?? "—"} gal · {it.estado || "leída"}</span>
                        </li>
                      ))}
                    </ul>
                  )}
                  {estado.vencido && <div className="mt-2 text-xs text-amber-700">El enlace venció. Cierra y genera otro si necesitas seguir.</div>}
                </div>
              </div>
            </div>

            <div className="px-5 py-3 border-t border-neutral-200 flex justify-end">
              <button onClick={cerrar} className="px-5 py-2.5 bg-brand hover:bg-brand-hover text-white font-bold rounded-lg text-sm">Listo</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
