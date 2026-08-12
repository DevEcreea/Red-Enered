import React, { useEffect, useState, useCallback } from "react";
import { api } from "../lib/api";
import { FileText, RefreshCw, Search } from "lucide-react";
import { MODULOS } from "../lib/modulos";

const ACCION_BADGE = {
  crear: "bg-green-50 text-green-700 border-green-200",
  editar: "bg-amber-50 text-amber-700 border-amber-200",
  borrar: "bg-red-50 text-red-700 border-red-200",
};

const MODULOS_UNICOS = [...new Set(MODULOS.map((m) => m.label))];

function fmt(at) {
  if (!at) return "—";
  try {
    const d = new Date(at);
    return d.toLocaleString("es-PE", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });
  } catch {
    return String(at).slice(0, 19).replace("T", " ");
  }
}

export default function Bitacora() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");
  const [modulo, setModulo] = useState("");
  const [accion, setAccion] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (q) params.set("q", q);
      if (modulo) params.set("modulo", modulo);
      if (accion) params.set("accion", accion);
      params.set("limit", "300");
      const { data } = await api.get(`/admin/audit-log?${params.toString()}`);
      setItems(data.items || []);
    } catch (e) {
      console.error("Error cargando bitácora:", e);
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, [q, modulo, accion]);

  useEffect(() => { load(); }, [modulo, accion]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="space-y-6">
      <div>
        <div className="text-[11px] font-bold uppercase tracking-widest text-brand mb-2">Administración</div>
        <h1 className="font-cabinet font-black text-3xl md:text-4xl text-neutral-900 flex items-center gap-3">
          <FileText className="w-8 h-8 text-brand" /> Bitácora
        </h1>
        <p className="text-neutral-500 mt-1 text-sm">Registro de acciones del equipo: quién creó, editó o borró y cuándo.</p>
      </div>

      {/* Filtros */}
      <div className="bg-white border border-border rounded-lg p-4 flex flex-wrap items-end gap-3">
        <div className="flex-1 min-w-[220px]">
          <label className="block text-[11px] font-bold text-neutral-500 uppercase mb-1">Buscar</label>
          <div className="flex gap-2">
            <input value={q} onChange={(e) => setQ(e.target.value)} onKeyDown={(e) => e.key === "Enter" && load()}
              placeholder="Usuario, empresa, ruta…" className="h-10 px-3 border border-border rounded-md text-sm w-full" />
            <button onClick={load} className="btn-brand px-3"><Search className="w-4 h-4" /></button>
          </div>
        </div>
        <div>
          <label className="block text-[11px] font-bold text-neutral-500 uppercase mb-1">Módulo</label>
          <select value={modulo} onChange={(e) => setModulo(e.target.value)} className="h-10 px-3 border border-border rounded-md text-sm">
            <option value="">Todos</option>
            {MODULOS_UNICOS.map((m) => <option key={m} value={m}>{m}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-[11px] font-bold text-neutral-500 uppercase mb-1">Acción</label>
          <select value={accion} onChange={(e) => setAccion(e.target.value)} className="h-10 px-3 border border-border rounded-md text-sm">
            <option value="">Todas</option>
            <option value="crear">Crear</option>
            <option value="editar">Editar</option>
            <option value="borrar">Borrar</option>
          </select>
        </div>
        <button onClick={load} className="btn-ghost text-sm flex items-center gap-1.5 h-10">
          <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} /> Actualizar
        </button>
      </div>

      {/* Tabla */}
      <div className="bg-white border border-border rounded-lg overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-neutral-50 border-b border-border text-left text-xs font-bold text-neutral-500 uppercase tracking-wider">
              <th className="p-3">Fecha</th>
              <th className="p-3">Usuario</th>
              <th className="p-3">Acción</th>
              <th className="p-3">Módulo</th>
              <th className="p-3">Empresa</th>
              <th className="p-3">Detalle (ruta)</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={6} className="text-center py-12 text-brand font-semibold">Cargando…</td></tr>
            ) : items.length === 0 ? (
              <tr><td colSpan={6} className="text-center py-12 text-neutral-400">Sin registros para los filtros.</td></tr>
            ) : items.map((it) => (
              <tr key={it.id} className="border-b border-divider hover:bg-neutral-50/50">
                <td className="p-3 whitespace-nowrap text-neutral-600">{fmt(it.at)}</td>
                <td className="p-3">
                  <div className="font-medium text-neutral-800">{it.user_name || "—"}</div>
                  <div className="text-xs text-neutral-400">{it.user_email}</div>
                </td>
                <td className="p-3">
                  <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${ACCION_BADGE[it.action] || "bg-neutral-100 text-neutral-600 border-neutral-200"}`}>
                    {(it.action || "—").toUpperCase()}
                  </span>
                </td>
                <td className="p-3 whitespace-nowrap font-medium text-neutral-700">{it.modulo || "—"}</td>
                <td className="p-3 whitespace-nowrap text-neutral-600">{it.empresa || "—"}</td>
                <td className="p-3 font-mono text-xs text-neutral-500 truncate max-w-[280px]" title={`${it.method} ${it.path}`}>
                  <span className="font-bold text-neutral-400">{it.method}</span> {it.path}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="text-xs text-neutral-400">{items.length} registro(s) · máximo 300 más recientes.</div>
    </div>
  );
}
