import React, { useState } from "react";
import { api } from "../lib/api";
import { Loader2, Search, Fuel, Building2, CheckCircle2, AlertTriangle, Landmark } from "lucide-react";

const fmtSoles = (n) => n != null ? "S/ " + Number(n).toLocaleString("es-PE", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : "—";

/**
 * Compras SUNAT (SIRE) — prueba de concepto.
 * Trae del API oficial de SUNAT todos los comprobantes que le emitieron al cliente
 * conectado y marca cuáles son de grifos (padrón OSINERGMIN). Solo lectura.
 */
export default function AdminSire() {
  const [periodo, setPeriodo] = useState("202606");
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");
  const [data, setData] = useState(null);
  const [rubro, setRubro] = useState("todos");

  const consultar = async () => {
    setLoading(true); setErr(""); setData(null);
    try {
      const { data } = await api.get("/admin/sire/compras", { params: { periodo }, timeout: 240000 });
      setData(data);
    } catch (e) {
      setErr(e?.response?.data?.detail || e.message || "Error consultando SUNAT");
    } finally { setLoading(false); }
  };

  const filas = (data?.comprobantes || []).filter((c) => rubro === "todos" || c.rubro === rubro);
  const totalGrifos = (data?.comprobantes || []).filter((c) => c.es_grifo)
    .reduce((a, c) => a + (c.total || 0), 0);

  return (
    <div className="space-y-6">
      <div>
        <div className="text-[11px] font-bold uppercase tracking-widest text-brand mb-2">Administración · Prueba de concepto</div>
        <h1 className="font-cabinet font-black text-3xl text-neutral-900 flex items-center gap-3">
          <Landmark className="w-8 h-8 text-brand" /> Compras SUNAT (SIRE)
        </h1>
        <p className="text-neutral-500 mt-1 text-sm max-w-2xl">
          Comprobantes que los proveedores le emitieron al cliente conectado, traídos directo del
          Registro de Compras (SUNAT). ENERED identifica automáticamente cuáles son de grifos.
        </p>
      </div>

      {/* Controles */}
      <div className="bg-white border border-neutral-200 rounded-xl p-4 flex flex-wrap items-end gap-3">
        <div>
          <label className="block text-[11px] font-bold text-neutral-600 mb-1">Periodo</label>
          <select value={periodo} onChange={(e) => setPeriodo(e.target.value)}
            className="h-10 px-3 border border-neutral-300 rounded-lg text-sm">
            <option value="202605">Mayo 2026</option>
            <option value="202606">Junio 2026</option>
            <option value="202607">Julio 2026</option>
            <option value="202608">Agosto 2026</option>
          </select>
        </div>
        <button onClick={consultar} disabled={loading}
          className="btn-brand h-10 px-5 rounded-lg text-sm font-bold flex items-center gap-2">
          {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
          {loading ? "Consultando SUNAT… (puede tardar ~1 min)" : "Traer comprobantes"}
        </button>
        {data && (
          <div className="ml-auto">
            <label className="block text-[11px] font-bold text-neutral-600 mb-1">Rubro del emisor</label>
            <select value={rubro} onChange={(e) => setRubro(e.target.value)}
              className="h-10 px-3 border border-neutral-300 rounded-lg text-sm">
              <option value="todos">Todos los rubros</option>
              {(data.rubros || []).map((r) => (
                <option key={r.rubro} value={r.rubro}>{r.rubro} ({r.cantidad})</option>
              ))}
            </select>
          </div>
        )}
      </div>

      {loading && (
        <div className="bg-brand/5 border border-brand/20 rounded-xl p-5 text-sm text-brand font-semibold flex items-center gap-3">
          <Loader2 className="w-5 h-5 animate-spin" />
          SUNAT genera el archivo en segundo plano (ticket) — normalmente tarda 20–60 segundos…
        </div>
      )}
      {err && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-sm text-red-700 flex items-start gap-2">
          <AlertTriangle className="w-4 h-4 mt-0.5 flex-shrink-0" /> {String(err)}
        </div>
      )}

      {data && (
        <>
          {/* KPIs */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="bg-white border border-neutral-200 rounded-xl p-4">
              <div className="text-2xl font-black">{data.total}</div>
              <div className="text-xs font-semibold text-neutral-500">Comprobantes recibidos · {data.ruc_cliente}</div>
            </div>
            <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4">
              <div className="text-2xl font-black text-emerald-700 flex items-center gap-2"><Fuel className="w-5 h-5" />{data.de_grifos}</div>
              <div className="text-xs font-semibold text-emerald-700">De grifos (OSINERGMIN) — candidatos al subsidio</div>
            </div>
            <div className="bg-white border border-neutral-200 rounded-xl p-4">
              <div className="text-2xl font-black text-brand">{fmtSoles(totalGrifos)}</div>
              <div className="text-xs font-semibold text-neutral-500">Total facturado por grifos en el periodo</div>
            </div>
          </div>

          {/* Rubros */}
          {(data.rubros || []).length > 0 && (
            <div className="flex flex-wrap gap-2">
              {data.rubros.map((r) => (
                <button key={r.rubro} onClick={() => setRubro(rubro === r.rubro ? "todos" : r.rubro)}
                  className={`px-3 py-1.5 rounded-full text-xs font-bold border transition-colors ${
                    rubro === r.rubro ? "bg-brand text-white border-brand"
                    : r.rubro === "Combustible" ? "bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100"
                    : "bg-white text-neutral-600 border-neutral-200 hover:bg-neutral-50"}`}>
                  {r.rubro === "Combustible" ? "⛽ " : ""}{r.rubro} · {r.cantidad} · {fmtSoles(r.total)}
                </button>
              ))}
            </div>
          )}

          {/* Tabla */}
          <div className="bg-white border border-neutral-200 rounded-xl overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse min-w-[780px]">
                <thead>
                  <tr className="bg-[#211A36] text-white text-[11px] uppercase tracking-wide">
                    <th className="px-4 py-3 font-semibold">Fecha</th>
                    <th className="px-4 py-3 font-semibold">Comprobante</th>
                    <th className="px-4 py-3 font-semibold">Proveedor</th>
                    <th className="px-4 py-3 font-semibold text-right">Total</th>
                    <th className="px-4 py-3 font-semibold">Rubro</th>
                  </tr>
                </thead>
                <tbody className="text-xs divide-y divide-neutral-100">
                  {filas.length === 0 && (
                    <tr><td colSpan={5} className="p-8 text-center text-neutral-400">Sin comprobantes para este filtro.</td></tr>
                  )}
                  {filas.map((c, i) => (
                    <tr key={i} className={c.es_grifo ? "bg-emerald-50/40" : ""}>
                      <td className="px-4 py-2.5 font-mono whitespace-nowrap">{c.fecha || "—"}</td>
                      <td className="px-4 py-2.5 font-bold text-neutral-900 whitespace-nowrap">{c.numero_documento || "—"}</td>
                      <td className="px-4 py-2.5">
                        <div className="font-semibold text-neutral-800 truncate max-w-[300px]">{c.razon_social || "—"}</div>
                        <div className="text-[11px] text-neutral-400">{c.ruc_emisor}
                          {c.grifo && <> · {[c.grifo.distrito, c.grifo.departamento].filter(Boolean).join(", ")}</>}
                        </div>
                      </td>
                      <td className="px-4 py-2.5 text-right font-mono font-bold whitespace-nowrap">{fmtSoles(c.total)}</td>
                      <td className="px-4 py-2.5">
                        {c.es_grifo
                          ? <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded-full"><Fuel className="w-3 h-3" /> Grifo OSINERGMIN</span>
                          : <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full ${c.rubro === "Otros" ? "bg-neutral-100 text-neutral-500" : "bg-brand/10 text-brand"}`}>{c.rubro}</span>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="text-[11px] text-neutral-400 flex items-center gap-2">
            <CheckCircle2 className="w-3.5 h-3.5" />
            Fuente: SUNAT · Registro de Compras Electrónico (API SIRE) · Solo lectura — ENERED nunca modifica el registro del cliente.
          </div>
        </>
      )}

      {!data && !loading && !err && (
        <div className="bg-neutral-50 border border-neutral-200 rounded-xl p-6 text-sm text-neutral-500 flex items-start gap-3">
          <Building2 className="w-5 h-5 mt-0.5 text-neutral-400" />
          <div>
            Conecta las credenciales del cliente en <code className="bg-white border border-neutral-200 rounded px-1">backend/.env</code>
            {" "}(SIRE_RUC, SIRE_USUARIO, SIRE_CLAVE) y presiona <b>Traer comprobantes</b>.
          </div>
        </div>
      )}
    </div>
  );
}
