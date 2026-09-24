import React, { useEffect, useRef, useState } from "react";
import QRCode from "qrcode";
import { api } from "../lib/api";
import { Smartphone, Loader2, X, Copy, CheckCircle2, AlertTriangle, Clock, ScanLine, Camera, Send } from "lucide-react";

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
  const [ahora, setAhora] = useState(Date.now());
  const vistas = useRef(0);
  const url = sesion ? `${window.location.origin}/captura/${sesion.token}` : "";

  const abrir = async () => {
    setOpen(true); setErr(null); setEstado({ recibidas: 0, items: [], vencido: false }); vistas.current = 0; setQr(null);
    try {
      const { data } = await api.post("/subsidio/captura/sesion", { programa });
      setSesion(data);
      setQr(await QRCode.toDataURL(`${window.location.origin}/captura/${data.token}`,
        { width: 320, margin: 1, color: { dark: "#2E1065", light: "#FFFFFF" } }));
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
      setAhora(Date.now());
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

  const restante = sesion ? Math.max(0, new Date(sesion.expires_at) - ahora) : 0;
  const mm = String(Math.floor(restante / 60000)).padStart(2, "0");
  const ss = String(Math.floor((restante % 60000) / 1000)).padStart(2, "0");
  const decreto = programa === "du007" ? "DU 007" : "DU 004";
  const chipEstado = (e) => e === "CONFORME" ? "bg-emerald-100 text-emerald-700" : e === "OBSERVADA" ? "bg-amber-100 text-amber-700" : e === "RECHAZADA" ? "bg-red-100 text-red-700" : "bg-neutral-100 text-neutral-600";

  return (
    <>
      <button type="button" onClick={abrir} data-testid="qr-subir-celular"
        className={`px-4 py-2.5 border-2 border-brand/70 text-brand hover:bg-brand hover:text-white transition-colors font-bold rounded-lg flex items-center gap-2 text-sm ${className}`}>
        <Smartphone className="w-4 h-4" /> {label}
      </button>

      {open && (
        <div className="fixed inset-0 z-[9998] bg-[#1c1826]/60 backdrop-blur-sm flex items-center justify-center p-4" role="dialog" aria-modal="true">
          <div className="bg-white rounded-3xl shadow-[0_30px_80px_rgba(46,16,101,.35)] w-full max-w-3xl overflow-hidden">
            {/* Cabecera */}
            <div className="relative px-6 py-5 text-white" style={{ background: "linear-gradient(120deg,#4C1D95 0%,#6D28D9 55%,#7C3AED 100%)" }}>
              <div className="text-[11px] font-bold tracking-[.18em] uppercase opacity-80">Subsidio {decreto} · Carga rápida</div>
              <div className="font-cabinet font-bold text-2xl mt-0.5 flex items-center gap-2"><Smartphone className="w-6 h-6" /> Sube tus facturas desde el celular</div>
              <div className="text-sm opacity-90 mt-1">Sin instalar nada y sin iniciar sesión en el teléfono.</div>
              <button onClick={cerrar} className="absolute top-4 right-4 p-2 rounded-full bg-white/15 hover:bg-white/25" aria-label="Cerrar"><X className="w-5 h-5" /></button>
            </div>

            <div className="grid md:grid-cols-[320px_1fr] gap-6 p-6">
              {/* QR */}
              <div className="flex flex-col items-center">
                <div className="rounded-2xl p-3 bg-white border-2 border-violet-100 shadow-[0_10px_30px_rgba(109,40,217,.15)]">
                  {err ? (
                    <div className="w-[280px] h-[280px] flex items-center justify-center text-sm text-red-700 text-center px-4">{err}</div>
                  ) : qr ? (
                    <img src={qr} alt="Código QR para subir desde el celular" className="w-[280px] h-[280px] rounded-xl" />
                  ) : (
                    <div className="w-[280px] h-[280px] flex items-center justify-center"><Loader2 className="w-9 h-9 animate-spin text-brand" /></div>
                  )}
                </div>
                {sesion && (
                  <div className="mt-3 inline-flex items-center gap-1.5 text-xs font-bold text-violet-800 bg-violet-50 border border-violet-200 rounded-full px-3 py-1">
                    <Clock className="w-3.5 h-3.5" /> Válido {mm}:{ss}
                  </div>
                )}
                <button onClick={copiar} disabled={!sesion} className="mt-2 text-xs font-bold text-brand hover:underline flex items-center gap-1 disabled:opacity-40">
                  <Copy className="w-3.5 h-3.5" /> {copiado ? "¡Enlace copiado!" : "Copiar enlace para mandarlo por WhatsApp"}
                </button>
              </div>

              {/* Pasos + estado */}
              <div>
                <div className="grid grid-cols-3 gap-2.5">
                  {[
                    [ScanLine, "Escanea", "Apunta la cámara del celular al QR y toca el enlace."],
                    [Camera, "Fotografía", "Toma una foto por factura, completa y con el QR de SUNAT nítido."],
                    [Send, "Envía", "Pulsa Enviar. Aparecen aquí solas, ya leídas."],
                  ].map(([Icon, t, d], i) => (
                    <div key={t} className="rounded-2xl border border-neutral-200 bg-neutral-50 p-3">
                      <div className="w-8 h-8 rounded-xl bg-brand text-white flex items-center justify-center mb-2"><Icon className="w-4 h-4" /></div>
                      <div className="text-[10px] font-bold tracking-widest text-brand uppercase">Paso {i + 1}</div>
                      <div className="font-cabinet font-bold text-neutral-900 text-sm">{t}</div>
                      <div className="text-[11.5px] text-neutral-600 leading-snug mt-0.5">{d}</div>
                    </div>
                  ))}
                </div>

                <div className={`mt-4 rounded-2xl border p-4 transition-colors ${estado.recibidas > 0 ? "bg-emerald-50 border-emerald-200" : "bg-neutral-50 border-neutral-200"}`} data-testid="qr-estado">
                  <div className="font-cabinet font-bold text-neutral-900 flex items-center gap-2">
                    {estado.recibidas > 0
                      ? <CheckCircle2 className="w-5 h-5 text-emerald-600" />
                      : <span className="relative flex h-3 w-3"><span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-brand opacity-60" /><span className="relative inline-flex rounded-full h-3 w-3 bg-brand" /></span>}
                    {estado.recibidas > 0 ? `${estado.recibidas} factura${estado.recibidas === 1 ? "" : "s"} recibida${estado.recibidas === 1 ? "" : "s"}` : "Esperando fotos del celular…"}
                  </div>
                  {estado.items?.length > 0 && (
                    <ul className="mt-3 space-y-1.5 max-h-36 overflow-y-auto pr-1">
                      {estado.items.slice().reverse().map((it, i) => (
                        <li key={it.id || i} className="flex items-center gap-2 text-xs bg-white rounded-lg px-2.5 py-1.5 border border-neutral-100">
                          {it.ok ? <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 flex-shrink-0" /> : <AlertTriangle className="w-3.5 h-3.5 text-amber-600 flex-shrink-0" />}
                          <span className="font-mono font-bold text-neutral-900">{it.numero || "sin número"}</span>
                          <span className="text-neutral-500">{it.placa || "—"} · {it.galones ?? "—"} gal</span>
                          {it.estado && <span className={`ml-auto px-1.5 py-0.5 rounded text-[10px] font-bold ${chipEstado(it.estado)}`}>{it.estado}</span>}
                        </li>
                      ))}
                    </ul>
                  )}
                  {estado.vencido && <div className="mt-2 text-xs text-amber-700 font-semibold">El enlace venció. Cierra y genera otro si necesitas seguir.</div>}
                </div>
              </div>
            </div>

            <div className="px-6 py-4 border-t border-neutral-100 flex items-center justify-between gap-3 bg-neutral-50/60">
              <p className="text-[11.5px] text-neutral-500">Las facturas quedan como borradores para que las revises antes de confirmar.</p>
              <button onClick={cerrar} className="px-6 py-2.5 bg-brand hover:bg-brand-hover text-white font-bold rounded-xl text-sm shadow-md shadow-brand/30">Listo</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
