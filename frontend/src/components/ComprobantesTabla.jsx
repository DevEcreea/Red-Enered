import React, { useState, useMemo, useRef, useEffect } from "react";
import { api } from "../lib/api";
import { UBIGEO_PERU, DEPARTAMENTOS_PERU } from "../lib/ubigeoPeru";
import {
  Search, Loader2, ChevronDown, ChevronRight, Pencil, Trash2, Download,
  Upload, FileSpreadsheet, CheckCircle2, AlertTriangle, XCircle, X, ExternalLink, FileText,
} from "lucide-react";

const OSINERGMIN_URL = "https://pvo.osinergmin.gob.pe/msfh5/busquedaRegistroHidrocarburos/init.action";

const ESTADOS = {
  CONFORME:  { txt: "Conforme",  cls: "bg-emerald-100 text-emerald-700 border-emerald-200", dot: "bg-emerald-500" },
  OBSERVADA: { txt: "Observada", cls: "bg-amber-100 text-amber-700 border-amber-200",       dot: "bg-amber-500" },
  RECHAZADA: { txt: "Rechazada", cls: "bg-red-100 text-red-700 border-red-200",             dot: "bg-red-500" },
};
const CATEGORIAS = ["M2", "M3", "N1", "N2", "N3"];
const COMBUSTIBLES = ["B5", "B20"];

const fmtGal = (g) => g != null ? `${Number(g).toLocaleString("es-PE", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} gal` : "—";
const fmtFecha = (f) => { try { return new Date(f + "T00:00:00").toLocaleDateString("es-PE"); } catch { return f || "—"; } };

export default function ComprobantesTabla({ items = [], vehicles = [], onChange }) {
  const [q, setQ] = useState("");
  const [fEstado, setFEstado] = useState("todos");
  const [fNC, setFNC] = useState("todas");
  const [fOrigen, setFOrigen] = useState("todos");
  const [abierta, setAbierta] = useState(null);
  const [editando, setEditando] = useState(null);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(5);
  const [borrando, setBorrando] = useState(null);

  const filtradas = useMemo(() => items.filter((it) => {
    if (fEstado !== "todos" && (it.validacion_estado || "") !== fEstado) return false;
    if (fNC === "con" && !it.tiene_nc) return false;
    if (fNC === "sin" && it.tiene_nc) return false;
    if (fOrigen !== "todos" && (it.origin || "individual") !== fOrigen) return false;
    if (q) {
      const t = q.toLowerCase();
      if (!`${it.numero_documento || ""} ${it.ruc_emisor || ""} ${it.placa || ""} ${it.estacion || ""} ${it.factura_filename || ""}`.toLowerCase().includes(t)) return false;
    }
    return true;
  }), [items, q, fEstado, fNC, fOrigen]);

  const totalPages = Math.max(1, Math.ceil(filtradas.length / pageSize));
  const pageRows = filtradas.slice((page - 1) * pageSize, page * pageSize);
  const placasTotal = new Set(items.map((i) => i.placa).filter(Boolean)).size;

  const borrar = async (it) => {
    if (!window.confirm(`¿Eliminar el comprobante ${it.numero_documento || it.factura_filename}?`)) return;
    setBorrando(it.id);
    try { await api.delete(`/subsidio/invoices/${it.id}`); onChange?.(); }
    catch (e) { alert(e?.response?.data?.detail || "No se pudo eliminar"); }
    finally { setBorrando(null); }
  };

  const selCls = "h-9 px-3 border border-neutral-200 rounded-lg text-sm text-neutral-700 bg-white";

  return (
    <div className="space-y-3">
      {/* Contadores */}
      <div className="flex items-center gap-5 text-xs font-bold text-neutral-500 uppercase tracking-wide">
        <span>Comprobantes registrados <span className="ml-1 px-2 py-0.5 bg-brand/10 text-brand rounded-full">{items.length}</span></span>
        <span>Placas asociadas <span className="ml-1 px-2 py-0.5 bg-brand/10 text-brand rounded-full">{placasTotal}</span></span>
      </div>

      {/* Filtros */}
      <div className="flex flex-wrap gap-2 items-center">
        <div className="relative flex-1 min-w-[220px]">
          <Search className="w-4 h-4 text-neutral-400 absolute left-3 top-2.5" />
          <input value={q} onChange={(e) => { setQ(e.target.value); setPage(1); }}
            placeholder="Buscar por comprobante, RUC del grifo, placa…"
            className="w-full h-9 pl-9 pr-3 border border-neutral-200 rounded-lg text-sm" />
        </div>
        <select value={fEstado} onChange={(e) => { setFEstado(e.target.value); setPage(1); }} className={selCls}>
          <option value="todos">Todos los estados</option>
          {Object.entries(ESTADOS).map(([k, v]) => <option key={k} value={k}>{v.txt}</option>)}
        </select>
        <select value={fNC} onChange={(e) => { setFNC(e.target.value); setPage(1); }} className={selCls}>
          <option value="todas">Todas las N/C</option>
          <option value="con">Con nota de crédito</option>
          <option value="sin">Sin nota de crédito</option>
        </select>
        <select value={fOrigen} onChange={(e) => { setFOrigen(e.target.value); setPage(1); }} className={selCls}>
          <option value="todos">Todos los orígenes</option>
          <option value="individual">Registro individual</option>
          <option value="carga_masiva">Carga masiva</option>
        </select>
      </div>

      {/* Tabla */}
      <div className="bg-white border border-neutral-200 rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse min-w-[900px]">
            <thead>
              <tr className="bg-[#211A36] text-white text-[11px] uppercase tracking-wide">
                <th className="px-3 py-3 w-8"></th>
                <th className="px-3 py-3 font-semibold">Comprobante</th>
                <th className="px-3 py-3 font-semibold">Fecha</th>
                <th className="px-3 py-3 font-semibold">RUC del grifo · ubigeo</th>
                <th className="px-3 py-3 font-semibold text-center">Placas</th>
                <th className="px-3 py-3 font-semibold text-right">Volumen de galones</th>
                <th className="px-3 py-3 font-semibold text-center">Nota de crédito</th>
                <th className="px-3 py-3 font-semibold">Origen</th>
                <th className="px-3 py-3 font-semibold text-center">Acciones</th>
              </tr>
            </thead>
            <tbody className="text-xs divide-y divide-neutral-100">
              {pageRows.length === 0 && (
                <tr><td colSpan={9} className="p-8 text-center text-neutral-400">No hay comprobantes para este filtro.</td></tr>
              )}
              {pageRows.map((it) => {
                const est = ESTADOS[it.validacion_estado];
                const open = abierta === it.id;
                return (
                  <React.Fragment key={it.id}>
                    <tr className="hover:bg-neutral-50/70">
                      <td className="px-3 py-3">
                        <button onClick={() => setAbierta(open ? null : it.id)} className="text-neutral-400 hover:text-brand">
                          {open ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                        </button>
                      </td>
                      <td className="px-3 py-3">
                        <div className="font-bold text-neutral-900">{it.numero_documento || "—"}</div>
                        <div className="flex items-center gap-1.5 mt-0.5">
                          <span className="text-[10px] text-neutral-400">Factura</span>
                          {est && <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full border ${est.cls}`}>{est.txt}</span>}
                        </div>
                      </td>
                      <td className="px-3 py-3 whitespace-nowrap">
                        <div className="text-[9px] font-bold text-neutral-400 uppercase">Emisión</div>
                        <div className="font-mono text-neutral-800">{fmtFecha(it.fecha)}</div>
                      </td>
                      <td className="px-3 py-3">
                        <div className="font-bold text-neutral-900">{it.ruc_emisor || "—"}</div>
                        {it.estacion && <div className="text-[11px] text-neutral-500 truncate max-w-[230px]">{it.estacion}</div>}
                        {(it.departamento || it.distrito) && (
                          <div className="text-[11px] text-neutral-400 truncate max-w-[230px]">
                            {[it.departamento, it.provincia, it.distrito].filter(Boolean).join(" / ")}
                          </div>
                        )}
                      </td>
                      <td className="px-3 py-3 text-center">
                        <span className="px-2 py-1 bg-neutral-100 rounded-lg font-bold text-neutral-700 whitespace-nowrap">
                          {it.placa || "Sin placa"}
                        </span>
                      </td>
                      <td className="px-3 py-3 text-right font-mono font-bold text-neutral-900 whitespace-nowrap">{fmtGal(it.galones)}</td>
                      <td className="px-3 py-3 text-center">
                        <span className={`text-[11px] px-2 py-1 rounded-lg ${it.tiene_nc ? "bg-amber-100 text-amber-700" : "bg-neutral-100 text-neutral-500"}`}>
                          {it.tiene_nc ? `${it.alcance_nc || "Sí"}` : "No tiene"}
                        </span>
                      </td>
                      <td className="px-3 py-3">
                        <span className="flex items-center gap-1.5 text-neutral-700">
                          <span className={`w-1.5 h-1.5 rounded-full ${it.origin === "carga_masiva" ? "bg-brand" : "bg-neutral-400"}`} />
                          {it.origin === "carga_masiva" ? "Carga masiva" : "Registro individual"}
                        </span>
                      </td>
                      <td className="px-3 py-3">
                        <div className="flex items-center justify-center gap-1">
                          <button onClick={() => setEditando(it)} title="Editar"
                            className="p-1.5 border border-neutral-200 rounded-lg hover:bg-neutral-50 text-neutral-600"><Pencil className="w-3.5 h-3.5" /></button>
                          <button onClick={() => borrar(it)} disabled={borrando === it.id} title="Eliminar"
                            className="p-1.5 border border-red-200 rounded-lg hover:bg-red-50 text-red-500">
                            {borrando === it.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
                          </button>
                        </div>
                      </td>
                    </tr>
                    {open && (
                      <tr className="bg-neutral-50/60">
                        <td colSpan={9} className="px-6 py-4">
                          <table className="w-full text-xs">
                            <thead>
                              <tr className="text-[10px] uppercase text-neutral-400 tracking-wide">
                                <th className="text-left pb-2 font-semibold">Categoría</th>
                                <th className="text-left pb-2 font-semibold">Combustible</th>
                                <th className="text-left pb-2 font-semibold">Archivo</th>
                                <th className="text-right pb-2 font-semibold">Volumen de galones</th>
                              </tr>
                            </thead>
                            <tbody>
                              <tr className="border-t border-neutral-200">
                                <td className="py-2 font-bold">{it.categoria || "—"}</td>
                                <td className="py-2">{it.producto || "—"}</td>
                                <td className="py-2 truncate max-w-[280px] text-neutral-500">{it.factura_filename || "—"}</td>
                                <td className="py-2 text-right font-mono font-bold">{fmtGal(it.galones)}</td>
                              </tr>
                            </tbody>
                          </table>
                          {(it.validacion?.motivos || []).length > 0 && (
                            <ul className="mt-3 space-y-1">
                              {it.validacion.motivos.map((m, i) => (
                                <li key={i} className="text-[11px] text-amber-800 flex items-start gap-1.5">
                                  <AlertTriangle className="w-3 h-3 mt-0.5 flex-shrink-0" />{m}
                                </li>
                              ))}
                            </ul>
                          )}
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Paginación */}
        <div className="px-4 py-3 border-t border-neutral-100 bg-neutral-50/50 flex items-center justify-between text-xs text-neutral-600">
          <span>Mostrando {filtradas.length ? (page - 1) * pageSize + 1 : 0}–{Math.min(page * pageSize, filtradas.length)} de {filtradas.length} registros</span>
          <div className="flex items-center gap-1.5">
            <button disabled={page === 1} onClick={() => setPage(1)} className="px-2 py-1 border border-neutral-200 rounded bg-white disabled:opacity-40">«</button>
            <button disabled={page === 1} onClick={() => setPage((p) => p - 1)} className="px-2 py-1 border border-neutral-200 rounded bg-white disabled:opacity-40">‹</button>
            <span className="px-3 py-1 font-bold text-brand bg-brand/10 rounded">{page}</span>
            <button disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)} className="px-2 py-1 border border-neutral-200 rounded bg-white disabled:opacity-40">›</button>
            <button disabled={page >= totalPages} onClick={() => setPage(totalPages)} className="px-2 py-1 border border-neutral-200 rounded bg-white disabled:opacity-40">»</button>
            <select value={pageSize} onChange={(e) => { setPageSize(Number(e.target.value)); setPage(1); }} className="ml-2 px-2 py-1 border border-neutral-200 rounded bg-white">
              {[5, 10, 25, 50].map((n) => <option key={n} value={n}>{n}</option>)}
            </select>
          </div>
        </div>
      </div>

      {editando && (
        <ModalEditar item={editando} vehicles={vehicles} onClose={() => setEditando(null)}
          onSaved={() => { setEditando(null); onChange?.(); }} />
      )}
    </div>
  );
}

/** Modal "Editar comprobante" — mismos campos que exige la ATU. */
function ModalEditar({ item, vehicles, onClose, onSaved }) {
  const [f, setF] = useState({
    serie: item.serie || (item.numero_documento || "").split("-")[0] || "",
    numero: item.numero || (item.numero_documento || "").split("-")[1] || "",
    fecha: item.fecha || "",
    ruc_emisor: item.ruc_emisor || "",
    departamento: item.departamento || "", provincia: item.provincia || "",
    distrito: item.distrito || "", direccion_grifo: item.direccion_grifo || "",
    placa: item.placa || "", categoria: item.categoria || "",
    producto: item.producto || "", galones: item.galones ?? "",
    tiene_nc: !!item.tiene_nc, serie_nc: item.serie_nc || "",
    numero_nc: item.numero_nc || "", alcance_nc: item.alcance_nc || "",
  });
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [grifo, setGrifo] = useState(null);
  const [buscando, setBuscando] = useState(false);
  // Previsualización del archivo subido, al costado del formulario (guía para completarlo).
  const [archivo, setArchivo] = useState({ url: null, esImagen: false, error: "" });
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });

  useEffect(() => {
    let vivo = true, url = null;
    setArchivo({ url: null, esImagen: false, error: "" });
    (async () => {
      try {
        const r = await api.get(`/subsidio/invoices/${item.id}/file`, { responseType: "blob" });
        if (!vivo) return;
        const tipo = r.headers?.["content-type"] || "application/pdf";
        url = URL.createObjectURL(new Blob([r.data], { type: tipo }));
        setArchivo({ url, esImagen: tipo.startsWith("image/"), error: "" });
      } catch {
        if (vivo) setArchivo({ url: null, esImagen: false,
          error: "Este comprobante no tiene archivo adjunto (por ejemplo, si vino de la carga masiva)." });
      }
    })();
    return () => { vivo = false; if (url) URL.revokeObjectURL(url); };
  }, [item.id]);

  // Ubigeo en cascada (mismo catálogo que usa el módulo de precios).
  // OSINERGMIN a veces nombra distinto (p. ej. "PROV. CONST. DEL CALLAO"): si el valor
  // recibido no está en el catálogo, se agrega como opción para no perderlo.
  const conActual = (lista, actual) => {
    const a = (actual || "").toUpperCase().trim();
    return a && !lista.includes(a) ? [a, ...lista] : lista;
  };
  const dpto = (f.departamento || "").toUpperCase();
  const departamentos = useMemo(() => conActual(DEPARTAMENTOS_PERU, f.departamento), [f.departamento]);
  const provincias = useMemo(
    () => conActual(Object.keys(UBIGEO_PERU[dpto] || {}), f.provincia), [dpto, f.provincia]);
  const distritos = useMemo(
    () => conActual((UBIGEO_PERU[dpto] || {})[(f.provincia || "").toUpperCase()] || [], f.distrito),
    [dpto, f.provincia, f.distrito]);

  // Direcciones del grifo (padrón OSINERGMIN), filtradas por el ubigeo elegido — como en la ATU.
  const direcciones = useMemo(() => {
    const locales = grifo?.locales || [];
    if (!locales.length) return [];
    const eq = (a, b) => !b || (a || "").toUpperCase().trim() === (b || "").toUpperCase().trim();
    let lista = locales.filter((l) =>
      eq(l.departamento, f.departamento) && eq(l.provincia, f.provincia) && eq(l.distrito, f.distrito));
    // Si el filtro deja todo fuera, mostrar todas para no bloquear al usuario.
    if (!lista.length) lista = locales;
    const dirs = [...new Set(lista.map((l) => l.direccion).filter(Boolean))].sort();
    return conActual(dirs, f.direccion_grifo);
  }, [grifo, f.departamento, f.provincia, f.distrito, f.direccion_grifo]);

  // El RUC se valida solo al completar los 11 dígitos (sin apretar nada).
  useEffect(() => {
    const ruc = (f.ruc_emisor || "").replace(/\D/g, "");
    if (ruc.length !== 11) { setGrifo(null); return; }
    let vivo = true;
    setBuscando(true);
    const t = setTimeout(async () => {
      try {
        const { data } = await api.get(`/subsidio/grifo/${ruc}`);
        if (!vivo) return;
        setGrifo(data);
        if (data.inscrito) {
          setF((p) => ({ ...p,
            departamento: data.departamento || p.departamento,
            provincia: data.provincia || p.provincia,
            distrito: data.distrito || p.distrito,
            direccion_grifo: data.direccion || p.direccion_grifo }));
        }
      } catch { if (vivo) setGrifo(null); }
      finally { if (vivo) setBuscando(false); }
    }, 500);
    return () => { vivo = false; clearTimeout(t); };
  }, [f.ruc_emisor]);

  const guardar = async () => {
    setBusy(true); setErr("");
    try {
      await api.put(`/subsidio/invoices/${item.id}`, {
        ...f, galones: f.galones === "" ? null : Number(f.galones),
        placa: (f.placa || "").toUpperCase() || null,
      });
      onSaved();
    } catch (e) { setErr(e?.response?.data?.detail || "No se pudo guardar"); setBusy(false); }
  };

  const inp = "w-full h-9 px-3 border border-neutral-300 rounded-lg text-sm";
  const lbl = "block text-[11px] font-bold text-neutral-600 mb-1";

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-start justify-center p-4 overflow-y-auto" onClick={onClose}>
      <div className="bg-white rounded-2xl w-full max-w-6xl my-8 shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-start justify-between p-5 border-b border-neutral-200">
          <div>
            <h3 className="font-cabinet font-bold text-lg">Editar comprobante</h3>
            <p className="text-xs text-neutral-500 mt-0.5">Completa los campos mirando tu factura — se valida contra SUNAT (que exista) y OSINERGMIN (grifo inscrito)</p>
          </div>
          <button onClick={onClose} className="p-1.5 hover:bg-neutral-100 rounded-lg"><X className="w-5 h-5" /></button>
        </div>

        <div className="lg:flex lg:items-stretch">
        <div className="lg:flex-1 min-w-0 flex flex-col">
        <div className="p-5 space-y-5">
          <section>
            <div className="text-[11px] font-bold text-brand uppercase tracking-wide mb-2">1 · Factura</div>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
              <div><label className={lbl}>Serie *</label><input className={inp} value={f.serie} onChange={set("serie")} placeholder="F001" /></div>
              <div><label className={lbl}>Número *</label><input className={inp} value={f.numero} onChange={set("numero")} placeholder="0001234" /></div>
              <div><label className={lbl}>Fecha de emisión *</label><input type="date" className={inp} value={f.fecha} onChange={set("fecha")} /></div>
            </div>
            <p className="text-[11px] text-neutral-400 mt-1.5">Fechas permitidas: 29/05/2026 – 29/07/2026</p>
          </section>

          <section>
            <div className="text-[11px] font-bold text-brand uppercase tracking-wide mb-2">2 · Grifo</div>
            <div className="flex gap-2 items-end mb-2">
              <div className="w-48"><label className={lbl}>RUC del grifo *</label>
                <input className={inp} value={f.ruc_emisor} maxLength={11} inputMode="numeric"
                  onChange={(e) => setF({ ...f, ruc_emisor: e.target.value.replace(/\D/g, "") })} /></div>
              <a href={OSINERGMIN_URL} target="_blank" rel="noreferrer"
                className="h-9 px-3 border-2 border-brand text-brand rounded-lg text-xs font-bold flex items-center gap-1.5 hover:bg-brand/5">
                <ExternalLink className="w-3.5 h-3.5" /> Consultar en OSINERGMIN
              </a>
            </div>
            {/* Se verifica solo al completar los 11 dígitos */}
            {buscando && (
              <div className="text-xs mb-2 flex items-center gap-1.5 text-neutral-500">
                <Loader2 className="w-3.5 h-3.5 animate-spin" /> Verificando en el padrón…
              </div>
            )}
            {!buscando && grifo && (
              <div className={`text-xs mb-2 flex items-center gap-1.5 ${grifo.inscrito ? "text-emerald-700" : "text-amber-700"}`}>
                {grifo.inscrito ? <CheckCircle2 className="w-4 h-4" /> : <AlertTriangle className="w-4 h-4" />}
                {grifo.inscrito
                  ? <>Inscrito en OSINERGMIN. <span className="text-neutral-500">{grifo.razon_social}</span></>
                  : <>No figura en el padrón de grifos. Puedes completar los datos manualmente.</>}
              </div>
            )}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div><label className={lbl}>Departamento</label>
                <select className={inp} value={(f.departamento || "").toUpperCase()}
                  onChange={(e) => setF({ ...f, departamento: e.target.value, provincia: "", distrito: "" })}>
                  <option value="">Elige…</option>
                  {departamentos.map((d) => <option key={d} value={d}>{d}</option>)}
                </select>
              </div>
              <div><label className={lbl}>Provincia</label>
                <select className={inp} value={(f.provincia || "").toUpperCase()} disabled={!provincias.length && !f.provincia}
                  onChange={(e) => setF({ ...f, provincia: e.target.value, distrito: "" })}>
                  <option value="">{provincias.length ? "Elige…" : "Elige departamento"}</option>
                  {provincias.map((p) => <option key={p} value={p}>{p}</option>)}
                </select>
              </div>
              <div><label className={lbl}>Distrito</label>
                <select className={inp} value={(f.distrito || "").toUpperCase()} disabled={!distritos.length && !f.distrito}
                  onChange={set("distrito")}>
                  <option value="">{distritos.length ? "Elige…" : "Elige provincia"}</option>
                  {distritos.map((d) => <option key={d} value={d}>{d}</option>)}
                </select>
              </div>
            </div>
            <div className="mt-3">
              <label className={lbl}>Dirección del grifo</label>
              {direcciones.length > 0 ? (
                <>
                  <select className={inp} value={f.direccion_grifo || ""}
                    onChange={(e) => {
                      // Al elegir la dirección, se toma el ubigeo de ese establecimiento.
                      const loc = (grifo?.locales || []).find((l) => l.direccion === e.target.value);
                      setF((p) => ({ ...p, direccion_grifo: e.target.value,
                        ...(loc ? { departamento: loc.departamento || p.departamento,
                                    provincia: loc.provincia || p.provincia,
                                    distrito: loc.distrito || p.distrito } : {}) }));
                    }}>
                    <option value="">Elige la dirección…</option>
                    {direcciones.map((d) => <option key={d} value={d}>{d}</option>)}
                  </select>
                  <p className="text-[11px] text-neutral-400 mt-1">
                    Las direcciones se filtran según el departamento, provincia y distrito seleccionados.
                    {grifo?.total_locales > 1 && ` Este RUC tiene ${grifo.total_locales} establecimientos.`}
                  </p>
                </>
              ) : (
                <input className={inp} value={f.direccion_grifo} onChange={set("direccion_grifo")}
                  placeholder={grifo && !grifo.inscrito ? "Escribe la dirección del grifo" : "—"} />
              )}
            </div>
          </section>

          <section>
            <div className="text-[11px] font-bold text-brand uppercase tracking-wide mb-2">3 · Vehículo y combustible</div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <div><label className={lbl}>Placa *</label>
                <select className={inp} value={f.placa} onChange={(e) => {
                  const v = vehicles.find((x) => x.placa === e.target.value);
                  setF({ ...f, placa: e.target.value, categoria: v?.categoria || f.categoria });
                }}>
                  <option value="">Elige…</option>
                  {vehicles.map((v) => <option key={v.placa} value={v.placa}>{v.placa}</option>)}
                </select>
              </div>
              <div><label className={lbl}>Categoría</label>
                <select className={inp} value={f.categoria} onChange={set("categoria")}>
                  <option value="">—</option>
                  {CATEGORIAS.map((c) => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
              <div><label className={lbl}>Combustible</label>
                <input className={inp} value={f.producto} onChange={set("producto")} placeholder="DIESEL B5 S-50" list="combustibles" />
                <datalist id="combustibles">{COMBUSTIBLES.map((c) => <option key={c} value={c} />)}</datalist>
              </div>
              <div><label className={lbl}>Volumen de galones *</label>
                <input type="number" step="0.01" className={inp} value={f.galones} onChange={set("galones")} /></div>
            </div>
          </section>

          <section>
            <div className="text-[11px] font-bold text-brand uppercase tracking-wide mb-2">4 · Nota de crédito</div>
            <div className="flex items-center gap-3 flex-wrap">
              <label className="flex items-center gap-2 text-sm cursor-pointer">
                <input type="checkbox" checked={f.tiene_nc} onChange={(e) => setF({ ...f, tiene_nc: e.target.checked })} className="w-4 h-4 accent-brand" />
                ¿Tiene nota de crédito?
              </label>
              {f.tiene_nc && (
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 flex-1 min-w-[300px]">
                  <div><label className={lbl}>Serie N/C</label><input className={inp} value={f.serie_nc} onChange={set("serie_nc")} /></div>
                  <div><label className={lbl}>Número N/C</label><input className={inp} value={f.numero_nc} onChange={set("numero_nc")} /></div>
                  <div><label className={lbl}>Alcance</label>
                    <select className={inp} value={f.alcance_nc} onChange={set("alcance_nc")}>
                      <option value="">—</option><option value="Total">Total</option><option value="Parcial">Parcial</option>
                    </select>
                  </div>
                </div>
              )}
            </div>
          </section>

          {err && <div className="text-xs text-red-600 font-semibold">{err}</div>}
        </div>

        <div className="flex justify-end gap-2 p-5 border-t border-neutral-200 mt-auto">
          <button onClick={onClose} className="px-4 py-2 text-sm font-semibold text-neutral-600 hover:bg-neutral-100 rounded-lg">Cancelar</button>
          <button onClick={guardar} disabled={busy} className="btn-brand px-5 py-2 text-sm rounded-lg font-bold flex items-center gap-2">
            {busy && <Loader2 className="w-4 h-4 animate-spin" />} Guardar cambios
          </button>
        </div>
        </div>

        {/* La factura subida, al costado: la guía real para completar el formulario */}
        <aside className="lg:w-[440px] flex-shrink-0 border-t lg:border-t-0 lg:border-l border-neutral-200 bg-neutral-50 p-4 rounded-b-2xl lg:rounded-bl-none lg:rounded-r-2xl">
          <div className="text-[11px] font-bold text-brand uppercase tracking-wide mb-2 flex items-center gap-1.5">
            <FileText className="w-3.5 h-3.5" /> Factura subida
          </div>
          {archivo.url ? (
            archivo.esImagen ? (
              <img src={archivo.url} alt="Factura subida"
                className="w-full max-h-[75vh] object-contain rounded-lg border border-neutral-200 bg-white" />
            ) : (
              <iframe title="Factura subida" src={archivo.url}
                className="w-full h-[75vh] rounded-lg border border-neutral-200 bg-white" />
            )
          ) : archivo.error ? (
            <div className="text-xs text-neutral-500 bg-white border border-dashed border-neutral-300 rounded-lg p-6 text-center">
              {archivo.error}
            </div>
          ) : (
            <div className="text-xs text-neutral-500 flex items-center justify-center gap-2 p-8">
              <Loader2 className="w-4 h-4 animate-spin" /> Cargando archivo…
            </div>
          )}
        </aside>
        </div>
      </div>
    </div>
  );
}

/** Carga masiva: descargar plantilla ENERED, subirla y previsualizar antes de guardar. */
export function CargaMasiva({ onDone }) {
  const [preview, setPreview] = useState(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const fileRef = useRef();
  // Paso 2: adjuntar los PDF a las filas ya guardadas por Excel.
  const [facturas, setFacturas] = useState(null); // { guardadas, pendientes, resultado }
  const pdfRef = useRef();

  const descargar = async () => {
    setBusy(true);
    try {
      const r = await api.get("/subsidio/carga-masiva/plantilla", { responseType: "blob" });
      const url = URL.createObjectURL(new Blob([r.data]));
      const a = document.createElement("a");
      a.href = url; a.download = "ENERED_carga_masiva.xlsx"; a.click();
      URL.revokeObjectURL(url);
    } catch { setErr("No se pudo descargar la plantilla"); }
    finally { setBusy(false); }
  };

  const subir = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setBusy(true); setErr(""); setPreview(null);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const { data } = await api.post("/subsidio/carga-masiva/previsualizar", fd,
        { headers: { "Content-Type": "multipart/form-data" } });
      setPreview(data);
    } catch (e2) { setErr(e2?.response?.data?.detail || "No se pudo leer la plantilla"); }
    finally { setBusy(false); e.target.value = ""; }
  };

  const confirmar = async () => {
    setBusy(true); setErr("");
    try {
      const { data } = await api.post("/subsidio/carga-masiva/confirmar", { filas: preview.filas });
      setPreview(null);
      onDone?.(data);
      // Pasar al paso de adjuntar los PDF a lo recién guardado.
      let pendientes = data.guardadas || 0;
      try {
        const p = await api.get("/subsidio/carga-masiva/pendientes-factura");
        pendientes = p.data?.total ?? pendientes;
      } catch { /* si falla, usamos el conteo de guardadas */ }
      setFacturas({ guardadas: data.guardadas || 0, pendientes, resultado: null });
    } catch (e2) { setErr(e2?.response?.data?.detail || "No se pudo guardar"); }
    finally { setBusy(false); }
  };

  const subirFacturas = async (e) => {
    const list = Array.from(e.target.files || []);
    if (!list.length) return;
    setBusy(true); setErr("");
    try {
      const fd = new FormData();
      list.forEach((f) => fd.append("files", f));
      const { data } = await api.post("/subsidio/carga-masiva/adjuntar-facturas", fd,
        { headers: { "Content-Type": "multipart/form-data" }, timeout: 300000 });
      setFacturas((prev) => ({
        ...prev,
        pendientes: Math.max(0, (prev?.pendientes || 0) - (data.adjuntadas || 0)),
        resultado: data,
      }));
      onDone?.({ guardadas: 0, omitidas: 0 }); // refresca la tabla del padre
    } catch (e2) { setErr(e2?.response?.data?.detail || "No se pudieron adjuntar las facturas"); }
    finally { setBusy(false); e.target.value = ""; }
  };

  const cerrarFacturas = () => { setFacturas(null); setErr(""); };

  const r = preview?.resumen || {};

  // ── Paso 2: adjuntar PDFs a los comprobantes cargados por Excel ──
  if (facturas) {
    const res = facturas.resultado;
    const sinMatch = (res?.resultados || []).filter((x) => !x.ok);
    return (
      <div className="bg-white border border-neutral-200 rounded-xl p-4">
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div>
            <div className="font-bold text-sm flex items-center gap-2">
              <FileText className="w-4 h-4 text-brand" /> Adjunta las facturas (PDF)
            </div>
            <p className="text-xs text-neutral-500 mt-0.5">
              Guardamos {facturas.guardadas} comprobante(s). Sube los PDF y los enganchamos por su
              número (QR/XML). Si una factura cubre varias placas, se adjunta a todas. {facturas.pendientes > 0
                ? `Faltan ${facturas.pendientes} por adjuntar.` : "¡Todos tienen su PDF! 🎉"}
            </p>
          </div>
          <div className="flex gap-2">
            <button onClick={() => pdfRef.current?.click()} disabled={busy}
              className="btn-brand px-3 py-2 rounded-lg text-xs font-bold flex items-center gap-1.5">
              {busy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Upload className="w-3.5 h-3.5" />} Subir facturas PDF
            </button>
            <input ref={pdfRef} type="file" hidden multiple accept="application/pdf,.pdf" onChange={subirFacturas} />
            <button onClick={cerrarFacturas}
              className="px-3 py-2 border border-neutral-300 rounded-lg text-xs font-bold hover:bg-neutral-50">
              {facturas.pendientes > 0 ? "Terminar luego" : "Listo"}
            </button>
          </div>
        </div>

        {err && <div className="mt-3 text-xs text-red-600 font-semibold">{err}</div>}

        {res && (
          <div className="mt-4">
            <div className="flex items-center gap-3 flex-wrap text-xs font-bold mb-2">
              {res.adjuntadas > 0 && <span className="px-2 py-1 bg-emerald-100 text-emerald-700 rounded-full flex items-center gap-1"><CheckCircle2 className="w-3 h-3" />{res.adjuntadas} adjuntada(s)</span>}
              {sinMatch.length > 0 && <span className="px-2 py-1 bg-amber-100 text-amber-700 rounded-full flex items-center gap-1"><AlertTriangle className="w-3 h-3" />{sinMatch.length} sin coincidencia</span>}
            </div>
            {sinMatch.length > 0 && (
              <div className="max-h-56 overflow-y-auto border border-neutral-200 rounded-lg">
                <table className="w-full text-xs">
                  <thead className="bg-neutral-50 sticky top-0">
                    <tr className="text-[10px] uppercase text-neutral-500">
                      <th className="px-3 py-2 text-left">Archivo</th>
                      <th className="px-3 py-2 text-left">Comprobante</th>
                      <th className="px-3 py-2 text-left">Motivo</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-neutral-100">
                    {sinMatch.map((x, i) => (
                      <tr key={i}>
                        <td className="px-3 py-2 truncate max-w-[180px]">{x.filename}</td>
                        <td className="px-3 py-2 font-bold">{x.numero_documento || "—"}</td>
                        <td className="px-3 py-2 text-amber-700">{x.error}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="bg-white border border-neutral-200 rounded-xl p-4">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <div className="font-bold text-sm flex items-center gap-2"><FileSpreadsheet className="w-4 h-4 text-brand" /> Carga masiva de comprobantes</div>
          <p className="text-xs text-neutral-500 mt-0.5">Descarga la plantilla con tus placas, complétala y súbela. Validamos cada fila antes de guardar.</p>
        </div>
        <div className="flex gap-2">
          <button onClick={descargar} disabled={busy}
            className="px-3 py-2 border border-neutral-300 rounded-lg text-xs font-bold flex items-center gap-1.5 hover:bg-neutral-50">
            <Download className="w-3.5 h-3.5" /> Descargar plantilla
          </button>
          <button onClick={() => fileRef.current?.click()} disabled={busy}
            className="btn-brand px-3 py-2 rounded-lg text-xs font-bold flex items-center gap-1.5">
            {busy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Upload className="w-3.5 h-3.5" />} Subir plantilla
          </button>
          <input ref={fileRef} type="file" hidden accept=".xlsx,.xls" onChange={subir} />
        </div>
      </div>

      {err && <div className="mt-3 text-xs text-red-600 font-semibold">{err}</div>}

      {preview && (
        <div className="mt-4">
          <div className="flex items-center gap-3 flex-wrap text-xs font-bold mb-2">
            <span className="text-neutral-600">{preview.total} filas leídas:</span>
            {r.CONFORME > 0 && <span className="px-2 py-1 bg-emerald-100 text-emerald-700 rounded-full flex items-center gap-1"><CheckCircle2 className="w-3 h-3" />{r.CONFORME} conformes</span>}
            {r.OBSERVADA > 0 && <span className="px-2 py-1 bg-amber-100 text-amber-700 rounded-full flex items-center gap-1"><AlertTriangle className="w-3 h-3" />{r.OBSERVADA} observadas</span>}
            {r.RECHAZADA > 0 && <span className="px-2 py-1 bg-red-100 text-red-700 rounded-full flex items-center gap-1"><XCircle className="w-3 h-3" />{r.RECHAZADA} rechazadas</span>}
          </div>
          <div className="max-h-72 overflow-y-auto border border-neutral-200 rounded-lg">
            <table className="w-full text-xs">
              <thead className="bg-neutral-50 sticky top-0">
                <tr className="text-[10px] uppercase text-neutral-500">
                  <th className="px-3 py-2 text-left">Fila</th>
                  <th className="px-3 py-2 text-left">Comprobante</th>
                  <th className="px-3 py-2 text-left">Fecha</th>
                  <th className="px-3 py-2 text-left">Placa</th>
                  <th className="px-3 py-2 text-right">Galones</th>
                  <th className="px-3 py-2 text-left">Grifo</th>
                  <th className="px-3 py-2 text-left">Estado</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-100">
                {preview.filas.map((x) => {
                  const e = ESTADOS[x.validacion_estado];
                  return (
                    <tr key={x.fila} className={x.validacion_estado === "RECHAZADA" ? "bg-red-50/40" : ""}>
                      <td className="px-3 py-2 text-neutral-400">{x.fila}</td>
                      <td className="px-3 py-2 font-bold">{x.numero_documento || "—"}</td>
                      <td className="px-3 py-2">{fmtFecha(x.fecha)}</td>
                      <td className="px-3 py-2 font-bold">{x.placa || "—"}</td>
                      <td className="px-3 py-2 text-right font-mono">{fmtGal(x.galones)}</td>
                      <td className="px-3 py-2 truncate max-w-[180px] text-neutral-500">{x.estacion || x.ruc_emisor || "—"}</td>
                      <td className="px-3 py-2">
                        <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full border ${e?.cls}`}>{e?.txt}</span>
                        {(x.validacion?.motivos || [])[0] && <div className="text-[10px] text-amber-700 mt-0.5">{x.validacion.motivos[0]}</div>}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <div className="flex justify-end gap-2 mt-3">
            <button onClick={() => setPreview(null)} className="px-4 py-2 text-xs font-semibold text-neutral-600 hover:bg-neutral-100 rounded-lg">Cancelar</button>
            <button onClick={confirmar} disabled={busy || !preview.listas_para_guardar}
              className="btn-brand px-4 py-2 rounded-lg text-xs font-bold flex items-center gap-1.5">
              {busy && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
              Guardar {preview.listas_para_guardar} comprobante(s)
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
