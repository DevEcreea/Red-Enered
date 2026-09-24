import React, { useEffect, useRef, useState } from "react";
import { useParams } from "react-router-dom";
import { api } from "../lib/api";
import { Camera, Loader2, CheckCircle2, AlertTriangle, XCircle, Send, Trash2, Images } from "lucide-react";

/* Página MÓVIL pública (sin login): la abre el cliente al escanear el QR de la PC.
   El enlace temporal autoriza la subida; las fotos van al mismo OCR/validador de siempre. */
export default function CapturaMovil() {
  const { token } = useParams();
  const [info, setInfo] = useState(null);
  const [err, setErr] = useState(null);
  const [fotos, setFotos] = useState([]);          // [{file, url}]
  const [enviando, setEnviando] = useState(false);
  const [resultados, setResultados] = useState([]);
  const camRef = useRef(null);
  const galRef = useRef(null);

  useEffect(() => {
    api.get(`/captura/${token}`).then((r) => setInfo(r.data))
      .catch((e) => setErr(e?.response?.data?.detail || "Este enlace no es válido o ya venció. Genera un QR nuevo desde la computadora."));
  }, [token]);

  const agregar = (e) => {
    const fs = Array.from(e.target.files || []);
    setFotos((p) => [...p, ...fs.map((f) => ({ file: f, url: URL.createObjectURL(f) }))]);
    e.target.value = "";
  };
  const quitar = (i) => setFotos((p) => p.filter((_, k) => k !== i));

  const enviar = async () => {
    if (!fotos.length || enviando) return;
    setEnviando(true); setErr(null);
    try {
      const fd = new FormData();
      fotos.forEach((f, i) => fd.append("files", f.file, f.file.name || `foto-${i + 1}.jpg`));
      const { data } = await api.post(`/captura/${token}/fotos`, fd, { timeout: 300000 });
      setResultados((p) => [...(data.items || []), ...p]);
      setFotos([]);
    } catch (e) {
      setErr(e?.response?.data?.detail || "No se pudieron enviar las fotos. Revisa tu señal e intenta de nuevo.");
    } finally { setEnviando(false); }
  };

  const decreto = info?.programa === "du007" ? "DU 007" : "DU 004";

  return (
    <div className="min-h-screen bg-neutral-50 text-neutral-900" style={{ paddingBottom: 96 }}>
      <div className="bg-brand text-white px-4 py-4">
        <div className="text-[11px] font-bold tracking-widest uppercase opacity-80">ENERED · Subsidio {info ? decreto : ""}</div>
        <div className="font-cabinet font-bold text-xl mt-0.5">Fotografía tus facturas</div>
        {info?.empresa && <div className="text-sm opacity-90 mt-0.5 truncate">{info.empresa}</div>}
      </div>

      <div className="px-4 py-4 space-y-4">
        {err && !info && (
          <div className="bg-red-50 border border-red-200 text-red-800 rounded-xl p-4 text-sm flex gap-2"><XCircle className="w-5 h-5 flex-shrink-0" />{err}</div>
        )}

        {info && (
          <>
            <div className="bg-white border border-neutral-200 rounded-2xl p-4 text-sm text-neutral-700">
              <div className="font-bold text-neutral-900 mb-1">Cómo tomar la foto</div>
              <ul className="list-disc pl-5 space-y-1">
                <li>Que se vea la factura <b>completa</b> y sin sombras.</li>
                <li>Que el <b>código QR</b> impreso en la factura salga nítido.</li>
                <li>Una factura por foto. Puedes tomar varias y enviarlas juntas.</li>
              </ul>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <button onClick={() => camRef.current?.click()} disabled={enviando}
                className="bg-brand text-white rounded-2xl py-5 font-bold text-base flex flex-col items-center gap-2 active:scale-[0.98] disabled:opacity-60" data-testid="captura-tomar-foto">
                <Camera className="w-8 h-8" /> Tomar foto
              </button>
              <button onClick={() => galRef.current?.click()} disabled={enviando}
                className="bg-white border-2 border-brand text-brand rounded-2xl py-5 font-bold text-base flex flex-col items-center gap-2 active:scale-[0.98] disabled:opacity-60">
                <Images className="w-8 h-8" /> Elegir de galería
              </button>
              <input ref={camRef} type="file" accept="image/*" capture="environment" hidden onChange={agregar} />
              <input ref={galRef} type="file" accept="image/*,application/pdf" multiple hidden onChange={agregar} />
            </div>

            {fotos.length > 0 && (
              <div className="bg-white border border-neutral-200 rounded-2xl p-3">
                <div className="text-xs font-bold text-neutral-600 mb-2">{fotos.length} foto{fotos.length === 1 ? "" : "s"} lista{fotos.length === 1 ? "" : "s"} para enviar</div>
                <div className="grid grid-cols-3 gap-2">
                  {fotos.map((f, i) => (
                    <div key={i} className="relative aspect-[3/4] rounded-lg overflow-hidden border border-neutral-200 bg-neutral-100">
                      {f.file.type === "application/pdf"
                        ? <div className="w-full h-full flex items-center justify-center text-[11px] text-neutral-500 px-1 text-center">{f.file.name}</div>
                        : <img src={f.url} alt="" className="w-full h-full object-cover" />}
                      <button onClick={() => quitar(i)} className="absolute top-1 right-1 bg-black/60 text-white rounded-full p-1" aria-label="Quitar"><Trash2 className="w-3.5 h-3.5" /></button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {err && info && <div className="bg-red-50 border border-red-200 text-red-800 rounded-xl p-3 text-sm">{err}</div>}

            {resultados.length > 0 && (
              <div className="bg-white border border-neutral-200 rounded-2xl p-3">
                <div className="text-xs font-bold text-emerald-700 mb-2 flex items-center gap-1"><CheckCircle2 className="w-4 h-4" /> Enviadas a la plataforma ({resultados.length})</div>
                <ul className="space-y-1.5 text-sm">
                  {resultados.map((r, i) => (
                    <li key={r.id || i} className="flex items-start gap-2">
                      {r.ok ? <CheckCircle2 className="w-4 h-4 text-emerald-600 mt-0.5 flex-shrink-0" /> : <AlertTriangle className="w-4 h-4 text-amber-600 mt-0.5 flex-shrink-0" />}
                      <div>
                        <div className="font-mono font-bold">{r.numero || "No se pudo leer el número"}</div>
                        <div className="text-xs text-neutral-500">{r.placa || "sin placa"} · {r.galones ?? "—"} gal · {r.fecha || "sin fecha"}{r.estado ? ` · ${r.estado}` : ""}</div>
                      </div>
                    </li>
                  ))}
                </ul>
                <p className="text-[11px] text-neutral-500 mt-2">Ya aparecen en la computadora. Si algo no se leyó bien, se corrige allá.</p>
              </div>
            )}
          </>
        )}
      </div>

      {info && (
        <div className="fixed bottom-0 inset-x-0 bg-white border-t border-neutral-200 p-3">
          <button onClick={enviar} disabled={!fotos.length || enviando}
            className="w-full bg-emerald-600 disabled:bg-neutral-300 text-white rounded-2xl py-4 font-bold text-base flex items-center justify-center gap-2" data-testid="captura-enviar">
            {enviando ? <><Loader2 className="w-5 h-5 animate-spin" /> Leyendo facturas…</> : <><Send className="w-5 h-5" /> Enviar {fotos.length ? `${fotos.length} foto${fotos.length === 1 ? "" : "s"}` : ""}</>}
          </button>
        </div>
      )}
    </div>
  );
}
