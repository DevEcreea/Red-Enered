import React, { useEffect, useMemo, useState } from "react";
import { api } from "../lib/api";
import { useAuth } from "../context/AuthContext";
import {
  Building2, CheckCircle2, Clock, AlertTriangle, RefreshCw, Loader2,
  Truck, FileText, Info, Search, ShieldCheck,
} from "lucide-react";

/* Vista TESTING: réplica de la "Verificación del Transportista" del padrón ATU,
   con formato ENERED y alimentada por el diagnóstico real (/subsidio/resumen). */

const PLAZO = { ini: "29/05/2026", fin: "29/07/2026" };

function Chip({ ok = true, children }) {
  return (
    <span className={`text-[10px] font-black px-2.5 py-1 rounded-full border ${
      ok ? "bg-emerald-50 text-emerald-700 border-emerald-200" : "bg-red-50 text-red-600 border-red-200"}`}>
      {children}
    </span>
  );
}

function Card({ titulo, extra, children }) {
  return (
    <div className="bg-white border border-neutral-200 rounded-2xl shadow-sm overflow-hidden">
      {titulo && (
        <div className="px-5 py-3 border-b border-neutral-100 bg-neutral-50/60 flex items-center justify-between flex-wrap gap-2">
          <span className="text-[11px] font-black uppercase tracking-widest text-neutral-500">{titulo}</span>
          {extra}
        </div>
      )}
      {children}
    </div>
  );
}

export default function TestingVerificacion() {
  const { user } = useAuth();
  const [ruc, setRuc] = useState(user?.ruc || "20440382003");
  const [rucInput, setRucInput] = useState(user?.ruc || "20440382003");
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [pag, setPag] = useState(1);
  const PORPAG = 5;

  const cargar = (r, refresh = 0) => {
    setLoading(true);
    api.get("/subsidio/resumen", { params: { ruc: r, ...(refresh ? { refresh: 1 } : {}) } })
      .then(({ data }) => setData(data))
      .catch(() => setData(null))
      .finally(() => setLoading(false));
  };
  useEffect(() => { cargar(ruc); setPag(1); /* eslint-disable-next-line */ }, [ruc]);

  const topePorCat = useMemo(() => {
    const m = {};
    for (const c of data?.subsidio?.por_categoria || []) m[c.categoria] = c.tope;
    return m;
  }, [data]);

  const unidades = data?.unidades || [];
  const totalPags = Math.max(1, Math.ceil(unidades.length / PORPAG));
  const visibles = unidades.slice((pag - 1) * PORPAG, pag * PORPAG);
  const auth0 = unidades.find((u) => u.numero_autorizacion);
  const rucOk = (data?.semaforo || []).find((s) => s.codigo === "RUC_ACTIVO")?.estado === "CUMPLE";

  const colorEstado = (e) =>
    e === "aceptada" ? "#0EA46B" : e === "por_verificar" ? "#D97706" : e === "no_subsidiable" ? "#9CA3AF" : "#DC2626";

  return (
    <div className="space-y-4 max-w-5xl mx-auto" data-testid="testing-verificacion">
      {/* Selector de RUC (solo para esta vista de prueba) */}
      <div className="flex items-center gap-2 flex-wrap">
        <div className="relative">
          <Search className="w-3.5 h-3.5 text-neutral-400 absolute left-3 top-2.5" />
          <input value={rucInput} onChange={(e) => setRucInput(e.target.value.replace(/\D/g, "").slice(0, 11))}
            onKeyDown={(e) => e.key === "Enter" && rucInput.length === 11 && setRuc(rucInput)}
            className="pl-8 pr-3 py-2 border border-neutral-300 rounded-lg text-sm font-mono w-44"
            placeholder="RUC" />
        </div>
        <button onClick={() => rucInput.length === 11 && setRuc(rucInput)}
          className="btn-brand text-xs px-4 py-2 rounded-lg font-bold">Consultar</button>
        <span className="text-[10px] uppercase tracking-widest font-bold text-neutral-400">Vista testing · formato ENERED</span>
      </div>

      {/* Plazo + beneficiario */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <div className="bg-white border-l-4 border-brand border border-neutral-200 rounded-2xl px-5 py-4 flex items-center justify-between gap-3 flex-wrap shadow-sm">
          <div className="flex items-center gap-3">
            <Clock className="w-4 h-4 text-brand" />
            <div>
              <div className="text-[10px] font-black uppercase tracking-widest text-neutral-400">Plazo de compra</div>
              <div className="font-cabinet font-black text-neutral-900">{PLAZO.ini} – {PLAZO.fin}</div>
            </div>
          </div>
          <span className="text-[10px] font-black px-2.5 py-1 rounded-full bg-brand/10 text-brand border border-brand/20">Plazo de Subsidio</span>
        </div>
        <div className="bg-white border border-neutral-200 rounded-2xl px-5 py-4 flex items-start gap-3 shadow-sm">
          <Info className="w-4 h-4 text-brand mt-0.5 flex-shrink-0" />
          <p className="text-xs text-neutral-600">
            El beneficiario es el <b className="text-neutral-900">transportista titular</b> de la autorización, no el dueño del vehículo.
          </p>
        </div>
      </div>

      {/* Título de sección */}
      <div>
        <div className="flex items-center gap-2">
          <span className="text-[10px] font-black uppercase tracking-widest bg-[#211A36] text-white px-2.5 py-1 rounded-md">Sección 1 · Verificación</span>
          <span className="text-[10px] font-bold uppercase tracking-widest text-neutral-400">Hoja 1 de 2</span>
        </div>
        <h1 className="font-cabinet font-black text-3xl text-neutral-900 mt-2">Verificación del Transportista</h1>
        <p className="text-sm text-neutral-500 mt-1">Datos de los registros oficiales. Revísalos; no son editables.</p>
      </div>

      {/* Avisos */}
      <div className="bg-brand/5 border border-brand/20 rounded-2xl px-5 py-3.5 flex items-start justify-between gap-3 flex-wrap">
        <div className="flex items-start gap-2.5 min-w-0 flex-1">
          <Info className="w-4 h-4 text-brand mt-0.5 flex-shrink-0" />
          <p className="text-xs text-neutral-700">
            La información que confirmes y que aún no esté validada continuará su validación con los datos remitidos
            oficialmente por las entidades al corte. Cada dato se contrasta con una fuente distinta.
          </p>
        </div>
        <span className="text-[11px] font-bold text-brand whitespace-nowrap">¿Quién valida cada dato?</span>
      </div>

      {loading ? (
        <div className="min-h-[300px] flex flex-col items-center justify-center gap-2 text-neutral-500">
          <Loader2 className="w-7 h-7 animate-spin text-brand" />
          <span className="text-sm font-semibold">Consultando registros oficiales…</span>
        </div>
      ) : !data ? (
        <div className="bg-white border border-neutral-200 rounded-2xl p-10 text-center text-neutral-400 text-sm">
          No se pudo consultar ese RUC. Intenta de nuevo.
        </div>
      ) : (<>

      {/* DATOS DEL TRANSPORTISTA */}
      <Card titulo="Datos del transportista"
        extra={<button onClick={() => cargar(ruc, 1)} className="text-[11px] font-bold text-brand flex items-center gap-1 hover:underline">
          <RefreshCw className="w-3 h-3" /> Actualizar datos</button>}>
        <div className="px-5 py-4">
          <div className="flex items-center gap-2.5 flex-wrap">
            <Building2 className="w-4 h-4 text-neutral-500" />
            <span className="font-cabinet font-black text-lg text-neutral-900">{data.razon_social || "—"}</span>
            <Chip ok={rucOk}>ACTIVO</Chip>
            <Chip ok={rucOk}>HABIDO</Chip>
          </div>
          <div className="mt-3 pt-3 border-t border-dashed border-neutral-200 flex gap-10 flex-wrap text-sm">
            <div>
              <div className="text-[10px] font-black uppercase tracking-widest text-neutral-400">RUC</div>
              <div className="font-mono font-bold text-neutral-900">{data.ruc}</div>
            </div>
            <div>
              <div className="text-[10px] font-black uppercase tracking-widest text-neutral-400">Tipo de entidad</div>
              <div className="font-semibold text-neutral-800">Persona Jurídica</div>
            </div>
          </div>
        </div>
      </Card>

      {/* AUTORIZACIONES */}
      <Card titulo="Autorizaciones del transportista"
        extra={<span className="text-[10px] font-black px-2.5 py-1 rounded-full bg-brand/10 text-brand">{auth0 ? "1 autorización" : "—"}</span>}>
        <div className="px-5 py-4">
          {auth0 ? (
            <div className="border-l-4 border-brand pl-4">
              <div className="flex items-center gap-2.5 flex-wrap">
                <FileText className="w-4 h-4 text-neutral-500" />
                <span className="font-mono font-black text-neutral-900">{auth0.numero_autorizacion}</span>
                <Chip>Vigente</Chip>
                <span className="ml-auto text-[10px] font-bold text-brand bg-brand/10 px-2.5 py-1 rounded-md font-mono">
                  # Servicio de Transporte de Mercancías
                </span>
              </div>
              <div className="mt-3 flex gap-10 flex-wrap text-sm">
                <div><div className="text-[10px] font-black uppercase tracking-widest text-neutral-400">Autoridad</div>
                  <div className="font-semibold">MTC</div></div>
                <div><div className="text-[10px] font-black uppercase tracking-widest text-neutral-400">Ámbito</div>
                  <div className="font-semibold">Nacional</div></div>
                <div><div className="text-[10px] font-black uppercase tracking-widest text-neutral-400">Vigencia</div>
                  <div className="font-mono font-bold">hasta {auth0.vigencia || "—"}</div></div>
              </div>
            </div>
          ) : (
            <p className="text-sm text-neutral-400">Sin autorizaciones registradas.</p>
          )}
        </div>
      </Card>

      {/* VEHÍCULOS HABILITADOS */}
      <Card titulo="Vehículos habilitados"
        extra={<span className="text-[10px] font-black px-2.5 py-1 rounded-full bg-brand/10 text-brand">{unidades.length} vehículo(s)</span>}>
        <div className="divide-y divide-neutral-100">
          {visibles.map((u) => (
            <div key={u.placa} className="px-4 py-2.5" style={{ borderLeft: `3px solid ${colorEstado(u.estado)}` }}>
              <div className="flex items-center gap-2">
                <Truck className="w-3.5 h-3.5 text-neutral-500" />
                <span className="font-cabinet font-black text-sm text-neutral-900">{u.placa}</span>
                <span className="text-[9px] font-black px-1.5 py-0.5 rounded-full border border-neutral-300 text-neutral-600">{u.categoria || "—"}</span>
                <span className="text-[9px] font-black px-1.5 py-0.5 rounded-full bg-sky-50 text-sky-600 border border-sky-200">MTC</span>
              </div>
              <div className="mt-1.5 flex items-center divide-x divide-neutral-200 overflow-x-auto text-[13px]">
                <div className="pr-4 flex-shrink-0">
                  <div className="text-[9px] font-black uppercase tracking-widest text-neutral-400">TUC</div>
                  <div className="flex items-center gap-1.5">
                    <span className="font-mono font-bold text-neutral-900">{u.tuc || "—"}</span>
                    {u.vigencia && <span className="text-[9px] font-black px-1.5 py-px rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">Vigente</span>}
                  </div>
                </div>
                <div className="px-4 flex-shrink-0">
                  <div className="text-[9px] font-black uppercase tracking-widest text-neutral-400">Tope galones</div>
                  <div className="font-mono font-bold">{topePorCat[u.categoria] ? topePorCat[u.categoria].toLocaleString("es-PE", { minimumFractionDigits: 2 }) : "—"}</div>
                </div>
                <div className="px-4 flex-shrink-0">
                  <div className="text-[9px] font-black uppercase tracking-widest text-neutral-400">Estado autorización</div>
                  <span className={`text-[9px] font-black px-1.5 py-px rounded-full border ${u.estado === "vencida" ? "bg-red-50 text-red-600 border-red-200" : "bg-emerald-50 text-emerald-700 border-emerald-200"}`}>
                    {u.estado === "vencida" ? "Vencida" : "Vigente"}
                  </span>
                </div>
                <div className="px-4 flex-shrink-0">
                  <div className="text-[9px] font-black uppercase tracking-widest text-neutral-400">Validación</div>
                  <div className="font-semibold text-xs">
                    {u.estado === "aceptada" ? <span className="text-emerald-600">✓ ATU</span>
                      : u.estado === "por_verificar" ? <span className="text-amber-600">Pendiente</span>
                      : <span className="text-neutral-400">—</span>}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
        <div className="px-5 py-3 border-t border-neutral-100 flex items-center justify-between flex-wrap gap-2 text-xs text-neutral-500">
          <span>Mostrando {(pag - 1) * PORPAG + 1}–{Math.min(pag * PORPAG, unidades.length)} de {unidades.length} registros</span>
          <div className="flex items-center gap-1">
            <button disabled={pag === 1} onClick={() => setPag((p) => p - 1)}
              className="px-2.5 py-1 border border-neutral-200 rounded-md bg-white disabled:opacity-40 font-bold">‹</button>
            {Array.from({ length: Math.min(totalPags, 5) }, (_, i) => i + 1).map((n) => (
              <button key={n} onClick={() => setPag(n)}
                className={`px-2.5 py-1 rounded-md font-bold ${n === pag ? "bg-brand text-white" : "border border-neutral-200 bg-white"}`}>{n}</button>
            ))}
            <button disabled={pag >= totalPags} onClick={() => setPag((p) => p + 1)}
              className="px-2.5 py-1 border border-neutral-200 rounded-md bg-white disabled:opacity-40 font-bold">›</button>
          </div>
        </div>
      </Card>

      {/* SEMÁFORO DE CONDICIONES */}
      <div>
        <div className="text-[11px] font-black uppercase tracking-widest text-neutral-500 mb-2 flex items-center gap-1.5">
          <ShieldCheck className="w-3.5 h-3.5 text-brand" /> Semáforo de condiciones
        </div>
        <div className="space-y-2.5">
          {(data.semaforo || []).map((s) => {
            const ok = s.estado === "CUMPLE";
            const pend = s.estado === "POR_VERIFICAR";
            return (
              <div key={s.codigo}
                className="bg-white border border-neutral-200 rounded-2xl px-5 py-3.5 flex items-start justify-between gap-3 shadow-sm"
                style={{ borderLeft: `4px solid ${ok ? "#0EA46B" : pend ? "#D97706" : "#DC2626"}` }}>
                <div className="flex items-start gap-3 min-w-0">
                  {ok ? <CheckCircle2 className="w-5 h-5 text-emerald-500 flex-shrink-0 mt-0.5" />
                    : pend ? <Clock className="w-5 h-5 text-amber-500 flex-shrink-0 mt-0.5" />
                    : <AlertTriangle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />}
                  <div className="min-w-0">
                    <div className="font-bold text-sm text-neutral-900">{s.nombre}</div>
                    <div className="text-xs text-neutral-500 mt-0.5">{s.descripcion}</div>
                  </div>
                </div>
                <span className={`text-[11px] font-black tracking-wider whitespace-nowrap ${ok ? "text-emerald-600" : pend ? "text-amber-600" : "text-red-600"}`}>
                  {ok ? "CUMPLE" : pend ? "POR VERIFICAR" : "NO CUMPLE"}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Cierre: veredicto grande de la validación */}
      {(() => {
        const checks = data.semaforo || [];
        const todos = checks.length > 0 && checks.every((s) => s.estado === "CUMPLE");
        const pendientes = checks.filter((s) => s.estado !== "CUMPLE").length;
        return todos ? (
          <div className="rounded-2xl p-8 text-center text-white shadow-lg"
            style={{ background: "linear-gradient(135deg,#059669 0%,#0EA46B 55%,#34D399 130%)" }}
            data-testid="veredicto-ok">
            <div className="w-16 h-16 mx-auto rounded-full bg-white/20 border-2 border-white/60 flex items-center justify-center">
              <CheckCircle2 className="w-9 h-9" />
            </div>
            <h2 className="font-cabinet font-black text-2xl mt-4">¡Validación exitosa!</h2>
            <p className="text-sm text-emerald-50 mt-1.5 max-w-lg mx-auto">
              Tu empresa cumple las 4 condiciones del subsidio: RUC activo, autorización vigente,
              vehículos habilitados y TUC al día.
            </p>
            <div className="mt-4 inline-flex items-center gap-2 bg-white/15 border border-white/30 rounded-full px-4 py-1.5 text-[11px] font-black tracking-widest uppercase">
              <ShieldCheck className="w-3.5 h-3.5" /> Verificado por ENERED · SUNAT + MTC + ATU
            </div>
          </div>
        ) : (
          <div className="rounded-2xl p-8 text-center text-white shadow-lg"
            style={{ background: "linear-gradient(135deg,#B45309 0%,#D97706 60%,#F59E0B 130%)" }}
            data-testid="veredicto-pend">
            <div className="w-16 h-16 mx-auto rounded-full bg-white/20 border-2 border-white/60 flex items-center justify-center">
              <AlertTriangle className="w-8 h-8" />
            </div>
            <h2 className="font-cabinet font-black text-2xl mt-4">Validación con observaciones</h2>
            <p className="text-sm text-amber-50 mt-1.5 max-w-lg mx-auto">
              {pendientes} punto(s) del semáforo aún no cumplen. ENERED te acompaña a regularizarlos
              para que no pierdas el subsidio.
            </p>
            <div className="mt-4 inline-flex items-center gap-2 bg-white/15 border border-white/30 rounded-full px-4 py-1.5 text-[11px] font-black tracking-widest uppercase">
              <ShieldCheck className="w-3.5 h-3.5" /> Verificado por ENERED · SUNAT + MTC + ATU
            </div>
          </div>
        );
      })()}
      </>)}
    </div>
  );
}
