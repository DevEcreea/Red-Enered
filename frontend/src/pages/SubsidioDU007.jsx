import React, { useEffect, useRef, useState } from "react";
import { api } from "../lib/api";
import { useAuth } from "../context/AuthContext";
import Etapa0Card from "../components/Etapa0Card";
import ComprobantesTabla from "../components/ComprobantesTabla";
import {
  Search, Fuel, FileCheck2, Loader2, Upload, CheckCircle2, AlertTriangle,
  MessageCircle, Lock, ShieldCheck,
} from "lucide-react";

const WSP = "51997389536";
const fmtNum = (n) => (Number(n) || 0).toLocaleString("es-PE", { maximumFractionDigits: 2 });

/* Las 3 etapas del DU 007. La carga de combustible funciona igual que en el DU 004,
   pero en su propio bucket (programa=du007) y validada contra los 3 periodos del decreto. */
const ETAPAS = [
  { id: "diagnostico", n: "Etapa 1", titulo: "Diagnóstico", sub: "Cálculo del subsidio 007", icon: Search },
  { id: "combustible", n: "Etapa 2", titulo: "Combustible", sub: "Solo PDF · por periodo", icon: Fuel },
  { id: "declaracion", n: "Etapa 3", titulo: "Declaración", sub: "Una por periodo", icon: FileCheck2 },
];

const PERIODOS_INFO = {
  1: { consumo: "16 ago – 15 set", presenta: "16 set – 15 oct" },
  2: { consumo: "16 set – 15 oct", presenta: "16 oct – 15 nov" },
  3: { consumo: "16 oct – 15 nov", presenta: "16 nov – 15 dic" },
};

export default function SubsidioDU007() {
  const { user } = useAuth();
  const esGuest = !!user?.es_guest;
  const [etapa, setEtapa] = useState("diagnostico");
  const [items, setItems] = useState([]);
  const [vehicles, setVehicles] = useState([]);
  const [estado, setEstado] = useState(null);   // { periodos, declaraciones }
  const [subiendo, setSubiendo] = useState(false);
  const [aviso, setAviso] = useState(null);
  const fileRef = useRef(null);

  const load = async () => {
    if (esGuest) return;
    try {
      const [prev, est] = await Promise.all([
        api.get("/subsidio/invoices/preview", { params: { programa: "du007" } }),
        api.get("/subsidio/du007/estado"),
      ]);
      setItems(prev.data.items || []);
      setVehicles(prev.data.vehicles || []);
      setEstado(est.data);
    } catch { /* silencioso: el diagnóstico funciona igual */ }
  };
  useEffect(() => { load(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, []);

  const subir = async (fileList) => {
    const files = Array.from(fileList || []);
    if (!files.length) return;
    setSubiendo(true); setAviso(null);
    try {
      const fd = new FormData();
      files.forEach((f) => fd.append("files", f));
      fd.append("programa", "du007");
      const { data } = await api.post("/subsidio/invoices/upload", fd, { timeout: 300000 });
      const ok = (data.items || []).filter((x) => x.ok !== false).length;
      const mal = (data.items || []).filter((x) => x.ok === false);
      setAviso({
        tipo: mal.length ? "warn" : "ok",
        texto: `${ok} factura${ok === 1 ? "" : "s"} cargada${ok === 1 ? "" : "s"} al DU 007.` +
               (mal.length ? ` ${mal.length} con problema: ${mal.map((m) => m.error).join("; ")}` : ""),
      });
      await load();
    } catch (e) {
      setAviso({ tipo: "err", texto: e?.response?.data?.detail || "No se pudieron subir los archivos." });
    } finally {
      setSubiendo(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  const firmar = async (periodo) => {
    if (!window.confirm(
      `Vas a firmar la declaración jurada del PERIODO ${periodo} del DU 007.\n\n` +
      "Declaras que los consumos presentados son exactos y corresponden a unidades N1/N2/N3 " +
      "con habilitación vigente. ¿Confirmas?"
    )) return;
    try {
      const { data } = await api.post("/subsidio/du007/declaracion", { periodo });
      alert(`✅ Declaración del periodo ${periodo} firmada (${data.facturas_incluidas} facturas incluidas).`);
      await load();
    } catch (e) {
      alert(e?.response?.data?.detail || "No se pudo firmar la declaración.");
    }
  };

  const declaradaEl = (p) =>
    (estado?.declaraciones || []).find((d) => d.periodo === p)?.accepted_at;

  const wspMsg = encodeURIComponent(
    `Hola ENERED, soy ${user?.empresa || ""} (RUC ${user?.ruc || ""}). Quiero activar mi expediente del DU 007.`);

  const BloquGuest = ({ titulo }) => (
    <div className="bg-white border border-neutral-200 rounded-2xl p-10 text-center shadow-sm">
      <Lock className="w-10 h-10 text-brand mx-auto" />
      <h3 className="font-cabinet font-black text-xl text-neutral-900 mt-3">{titulo}</h3>
      <p className="text-sm text-neutral-500 mt-2 max-w-md mx-auto">
        Para cargar tu combustible y firmar la declaración del DU 007, activa tu cuenta con el equipo ENERED.
      </p>
      <a href={`https://wa.me/${WSP}?text=${wspMsg}`} target="_blank" rel="noreferrer"
        className="mt-5 inline-flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white font-black px-6 py-3 rounded-xl text-sm">
        <MessageCircle className="w-4 h-4" /> Activar por WhatsApp
      </a>
    </div>
  );

  return (
    <div className="space-y-5">
      {/* Encabezado + las 3 etapas */}
      <div className="bg-white border border-neutral-200 rounded-2xl p-6 shadow-sm">
        <div className="text-[11px] font-bold uppercase tracking-widest text-brand mb-1">Asistente de subsidio · DU 007-2026</div>
        <h1 className="font-cabinet font-black text-3xl text-neutral-900">Subsidio DU-007</h1>
        <p className="text-neutral-500 mt-1 text-sm">Tres periodos, una presentación por periodo. Completa las 3 etapas.</p>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mt-5">
          {ETAPAS.map((e) => {
            const Ic = e.icon;
            const activa = etapa === e.id;
            return (
              <button key={e.id} onClick={() => setEtapa(e.id)}
                className={`text-left border rounded-xl p-4 relative transition-all ${
                  activa ? "border-brand bg-brand/5 ring-4 ring-brand/10" : "border-neutral-200 bg-white hover:border-neutral-300"}`}
                data-testid={`du007-etapa-${e.id}`}>
                <div className="text-[10px] font-bold uppercase tracking-widest text-neutral-400">{e.n}</div>
                <div className={`font-bold mt-1 ${activa ? "text-brand" : "text-neutral-900"}`}>{e.titulo}</div>
                <div className="text-[11px] text-neutral-400 mt-0.5">{e.sub}</div>
                <span className={`absolute top-3.5 right-3.5 w-8 h-8 rounded-lg flex items-center justify-center ${
                  activa ? "bg-brand text-white" : "bg-neutral-100 text-neutral-400"}`}>
                  <Ic className="w-4 h-4" />
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* ETAPA 1 · Diagnóstico: SOLO la tarjeta del 007 */}
      {etapa === "diagnostico" && (
        <Etapa0Card solo="du007" />
      )}

      {/* ETAPA 2 · Combustible: misma modalidad de carga que el 004, bucket del 007 */}
      {etapa === "combustible" && (esGuest ? <BloquGuest titulo="Carga de combustible" /> : (
        <div className="space-y-4">
          <div className="bg-white border border-neutral-200 rounded-2xl p-6 shadow-sm">
            <div className="flex items-center justify-between flex-wrap gap-3">
              <div>
                <h3 className="font-cabinet font-bold text-lg text-neutral-900 flex items-center gap-2">
                  <Fuel className="w-5 h-5 text-brand" /> Combustible del DU 007
                </h3>
                <p className="text-xs text-neutral-500 mt-1">
                  Solo PDF. Cada factura se valida contra los 3 periodos del decreto
                  (P1: {PERIODOS_INFO[1].consumo} · P2: {PERIODOS_INFO[2].consumo} · P3: {PERIODOS_INFO[3].consumo})
                  y se asigna sola a su periodo. Solo unidades N1, N2 y N3.
                </p>
              </div>
              <input ref={fileRef} type="file" hidden multiple accept="application/pdf,.pdf"
                onChange={(e) => subir(e.target.files)} data-testid="du007-upload-input" />
              <button onClick={() => fileRef.current?.click()} disabled={subiendo}
                className="btn-brand px-5 py-3 rounded-xl text-sm font-bold flex items-center gap-2 disabled:opacity-60"
                data-testid="du007-upload-btn">
                {subiendo ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
                {subiendo ? "Leyendo facturas…" : "Subir facturas (PDF)"}
              </button>
            </div>
            {aviso && (
              <div className={`mt-3 text-sm rounded-lg px-4 py-2.5 font-semibold border ${
                aviso.tipo === "ok" ? "bg-emerald-50 border-emerald-200 text-emerald-800"
                : aviso.tipo === "warn" ? "bg-amber-50 border-amber-200 text-amber-800"
                : "bg-red-50 border-red-200 text-red-700"}`}>
                {aviso.texto}
              </div>
            )}
            {/* Resumen por periodo: solo facturas VÁLIDAS, agrupadas por su fecha de emisión */}
            {estado && (
              <>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mt-4">
                  {estado.periodos.map((p) => (
                    <div key={p.periodo} className="border border-neutral-200 rounded-xl p-3">
                      <div className="text-[11px] font-bold text-brand">PERIODO {p.periodo} <span className="text-neutral-400 font-medium">· consumo {PERIODOS_INFO[p.periodo].consumo}</span></div>
                      <div className="text-sm mt-1 text-neutral-700">
                        <b>{p.facturas}</b> factura{p.facturas === 1 ? "" : "s"} válida{p.facturas === 1 ? "" : "s"} · {fmtNum(p.galones)} gal · S/ {fmtNum(p.importe)}
                      </div>
                    </div>
                  ))}
                </div>
                {(estado.fuera_periodo > 0 || estado.rechazadas > 0) && (
                  <div className="mt-3 flex items-start gap-2 text-sm bg-red-50 border border-red-200 text-red-700 rounded-lg px-4 py-2.5 font-semibold">
                    <AlertTriangle className="w-4 h-4 mt-0.5 flex-shrink-0" />
                    <span>
                      {estado.fuera_periodo > 0 && (
                        <>{estado.fuera_periodo} factura{estado.fuera_periodo === 1 ? "" : "s"} con fecha de emisión
                        {" "}<b>fuera de los 3 periodos</b> del DU 007 — no cuentan para el subsidio.{" "}</>
                      )}
                      {estado.rechazadas > 0 && (
                        <>{estado.rechazadas} rechazada{estado.rechazadas === 1 ? "" : "s"} por otras observaciones.</>
                      )}
                    </span>
                  </div>
                )}
              </>
            )}
          </div>

          {items.length > 0 && <ComprobantesTabla items={items} vehicles={vehicles} onChange={load} />}
        </div>
      ))}

      {/* ETAPA 3 · Declaración: una por periodo */}
      {etapa === "declaracion" && (esGuest ? <BloquGuest titulo="Declaración jurada" /> : (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {(estado?.periodos || []).map((p) => {
            const firmada = declaradaEl(p.periodo);
            const puede = p.facturas > 0 && !firmada;
            return (
              <div key={p.periodo} className="bg-white border border-neutral-200 rounded-2xl p-5 shadow-sm flex flex-col">
                <div className="text-[11px] font-bold uppercase tracking-widest text-brand">Periodo {p.periodo}</div>
                <div className="text-xs text-neutral-500 mt-1">
                  Consumo {PERIODOS_INFO[p.periodo].consumo} · presentas {PERIODOS_INFO[p.periodo].presenta}
                </div>
                <div className="mt-4 text-sm text-neutral-700 space-y-1">
                  <div><b>{p.facturas}</b> factura{p.facturas === 1 ? "" : "s"} cargada{p.facturas === 1 ? "" : "s"}</div>
                  <div>{fmtNum(p.galones)} galones · S/ {fmtNum(p.importe)}</div>
                  <div className="text-emerald-700">{p.conformes} conforme{p.conformes === 1 ? "" : "s"}</div>
                </div>
                <div className="mt-auto pt-4">
                  {firmada ? (
                    <div className="flex items-center gap-2 text-emerald-700 text-sm font-bold bg-emerald-50 border border-emerald-200 rounded-lg px-3 py-2.5">
                      <ShieldCheck className="w-4 h-4" /> Firmada el {String(firmada).slice(0, 10)}
                    </div>
                  ) : (
                    <button onClick={() => firmar(p.periodo)} disabled={!puede}
                      className="w-full btn-brand py-2.5 rounded-lg text-sm font-bold disabled:opacity-50 flex items-center justify-center gap-2">
                      {puede ? <CheckCircle2 className="w-4 h-4" /> : <AlertTriangle className="w-4 h-4" />}
                      {p.facturas === 0 ? "Facturas pendientes de carga" : "Firmar declaración"}
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      ))}
    </div>
  );
}
