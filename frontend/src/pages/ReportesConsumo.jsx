import React, { useEffect, useMemo, useRef, useState } from "react";
import { Filter, X, FileBarChart, Download, Upload } from "lucide-react";
import { api } from "../lib/api";
import { formatSoles, formatNumber } from "../lib/utils";
import { useAuth } from "../context/AuthContext";

export default function ReportesConsumo() {
  const { user } = useAuth();
  const [rows, setRows] = useState([]);
  const [empresas, setEmpresas] = useState([]);
  const [options, setOptions] = useState({ placas: [], semanas: [], estaciones: [], productos: [] });
  const [filters, setFilters] = useState({ empresa: "", placa: "", semana: "", estacion: "", producto: "" });
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const PAGE_SIZE = 50;
  const fileInputRef = useRef(null);
  const [importing, setImporting] = useState(false);

  const isSubsidio = user?.role === "cliente_subsidio";

  const handleImport = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setImporting(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await api.post("/admin/consumptions/upload", fd, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      alert(`✅ Importación exitosa: ${res.data.inserted} registros agregados.`);
      // Refresh data
      const params = Object.fromEntries(Object.entries(filters).filter(([_, v]) => v));
      const r = await api.get("/consumptions", { params });
      setRows(r.data || []);
      setPage(1);
    } catch (err) {
      const msg = err.response?.data?.detail || err.message || "Error al importar";
      alert(`❌ Error: ${msg}`);
    } finally {
      setImporting(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  useEffect(() => {
    if (user?.role === "admin_enered") api.get("/empresas").then((r) => setEmpresas(r.data)).catch(() => {});
    api.get("/dashboard/filter-options").then((r) => setOptions(r.data)).catch(() => {});
  }, [user]);

  useEffect(() => {
    setLoading(true);
    const params = Object.fromEntries(Object.entries(filters).filter(([_, v]) => v));
    api.get("/consumptions", { params }).then((r) => {
      setRows(r.data || []);
      setPage(1);
    }).finally(() => setLoading(false));
  }, [filters]);

  const activeFilters = useMemo(() => Object.values(filters).filter(Boolean).length, [filters]);

  const totals = useMemo(() => {
    let gal = 0, gasto = 0, ahorro = 0;
    rows.forEach((r) => {
      gal += parseFloat(r.CANTIDAD_GL || 0);
      gasto += parseFloat(r.IMPORTE_TOTAL || 0);
      ahorro += parseFloat(r.AHORRO || 0);
    });
    return { gal, gasto, ahorro, n: rows.length };
  }, [rows]);

  const paginated = rows.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  const totalPages = Math.max(1, Math.ceil(rows.length / PAGE_SIZE));

  const exportCSV = () => {
    const headers = ["FECHA", "HORA", "EMPRESA", "PLACA", "CIUDAD", "ESTACION", "PRODUCTO", "CANTIDAD_GL", "PRECIO_UNITARIO", "IMPORTE_TOTAL", "PRECIO_PIZARRA", "AHORRO"];
    const csv = [headers.join(",")].concat(
      rows.map((r) => headers.map((h) => `"${(r[h] ?? "").toString().replace(/"/g, '""')}"`).join(","))
    ).join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `reporte_consumo_${Date.now()}.csv`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6" data-testid="reportes-consumo-page">
      <div className="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-4">
        <div>
          <div className="text-[11px] font-bold uppercase tracking-widest text-brand mb-2">Detalle transaccional</div>
          <h1 className="font-cabinet font-black text-3xl md:text-4xl text-neutral-900">Reportes de consumo</h1>
          <p className="text-neutral-500 mt-1 text-sm">Cada carga registrada por placa, estación y fecha. Exportable a CSV.</p>
        </div>
        <div className="flex items-center gap-2">
          {user?.role === "admin_enered" && (
            <>
              <input
                ref={fileInputRef}
                type="file"
                accept=".csv,.xlsx,.xls"
                className="hidden"
                onChange={handleImport}
                data-testid="import-file-input"
              />
              <button
                onClick={() => fileInputRef.current?.click()}
                disabled={importing}
                className="h-11 px-4 rounded-md bg-white border-2 border-brand text-brand text-sm font-bold flex items-center gap-2 hover:bg-brand-50 disabled:opacity-40"
                data-testid="import-consumo"
              >
                <Upload className="w-4 h-4" /> {importing ? "Importando..." : "Importar Consumo"}
              </button>
            </>
          )}
          <button
            onClick={exportCSV}
            disabled={rows.length === 0}
            className="h-11 px-4 rounded-md bg-brand text-white text-sm font-bold flex items-center gap-2 hover:bg-brand-hover disabled:opacity-40"
            data-testid="export-csv"
          >
            <Download className="w-4 h-4" /> Exportar CSV
          </button>
        </div>
      </div>

      {/* Filtros */}
      <div className="bg-white border border-border rounded-2xl p-3 md:p-4 flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-2 text-xs font-bold text-neutral-600 uppercase tracking-wider">
          <Filter className="w-4 h-4" /> Filtros
        </div>
        {user?.role === "admin_enered" && empresas.length > 0 && (
          <select value={filters.empresa} onChange={(e) => setFilters({ ...filters, empresa: e.target.value })}
            className="h-10 px-3 border border-border rounded-md bg-white text-sm font-semibold min-w-[180px]" data-testid="rc-empresa">
            <option value="">Empresa</option>
            {empresas.map((e) => <option key={e} value={e}>{e}</option>)}
          </select>
        )}
        <select value={filters.placa} onChange={(e) => setFilters({ ...filters, placa: e.target.value })}
          className="h-10 px-3 border border-border rounded-md bg-white text-sm font-semibold min-w-[140px]" data-testid="rc-placa">
          <option value="">Placa</option>
          {options.placas.map((v) => <option key={v}>{v}</option>)}
        </select>
        <select value={filters.semana} onChange={(e) => setFilters({ ...filters, semana: e.target.value })}
          className="h-10 px-3 border border-border rounded-md bg-white text-sm font-semibold min-w-[140px]" data-testid="rc-semana">
          <option value="">Semana</option>
          {options.semanas.map((v) => <option key={v}>{v}</option>)}
        </select>
        <select value={filters.estacion} onChange={(e) => setFilters({ ...filters, estacion: e.target.value })}
          className="h-10 px-3 border border-border rounded-md bg-white text-sm font-semibold min-w-[180px]" data-testid="rc-estacion">
          <option value="">Estación</option>
          {options.estaciones.map((v) => <option key={v}>{v}</option>)}
        </select>
        <select value={filters.producto} onChange={(e) => setFilters({ ...filters, producto: e.target.value })}
          className="h-10 px-3 border border-border rounded-md bg-white text-sm font-semibold min-w-[160px]" data-testid="rc-producto">
          <option value="">Producto</option>
          {options.productos.map((v) => <option key={v}>{v}</option>)}
        </select>
        {activeFilters > 0 && (
          <button
            onClick={() => setFilters({ empresa: "", placa: "", semana: "", estacion: "", producto: "" })}
            className="h-10 px-3 border border-border rounded-md text-xs font-bold flex items-center gap-1 hover:bg-neutral-50"
            data-testid="rc-clear"
          >
            <X className="w-3 h-3" /> Limpiar
          </button>
        )}
      </div>

      {/* Tabla */}
      <div className="bg-white border border-border rounded-2xl overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <div className="w-10 h-10 border-4 border-brand border-t-transparent rounded-full animate-spin" />
          </div>
        ) : rows.length === 0 ? (
          <div className="text-center py-16">
            <FileBarChart className="w-12 h-12 text-neutral-300 mx-auto mb-3" />
            <div className="font-cabinet font-bold text-neutral-700">Sin registros</div>
            <p className="text-sm text-neutral-500 mt-1">No hay cargas con los filtros actuales.</p>
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-sm" data-testid="rc-table">
                <thead className="bg-neutral-50">
                  <tr className="text-[11px] font-bold uppercase tracking-wider text-neutral-500">
                    <th className="px-3 py-3 text-left">Fecha</th>
                    {!isSubsidio && <th className="px-3 py-3 text-left">Hora</th>}
                    {user?.role === "admin_enered" && <th className="px-3 py-3 text-left">Empresa</th>}
                    <th className="px-3 py-3 text-left">Placa</th>
                    <th className="px-3 py-3 text-left">Ciudad</th>
                    <th className="px-3 py-3 text-left">Estación</th>
                    <th className="px-3 py-3 text-left">Producto</th>
                    <th className="px-3 py-3 text-right">Galones</th>
                    <th className="px-3 py-3 text-right">Precio</th>
                    <th className="px-3 py-3 text-right">Importe</th>
                    {!isSubsidio && <th className="px-3 py-3 text-right">Ahorro</th>}
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-100">
                  {paginated.map((r, i) => (
                    <tr key={i} className="hover:bg-neutral-50">
                      <td className="px-3 py-2 font-mono text-[12px]">{r.FECHA || "—"}</td>
                      {!isSubsidio && <td className="px-3 py-2 font-mono text-[12px] text-neutral-500">{r.HORA || "—"}</td>}
                      {user?.role === "admin_enered" && <td className="px-3 py-2 truncate max-w-[140px]">{r.EMPRESA || "—"}</td>}
                      <td className="px-3 py-2 font-mono font-bold text-neutral-900">{r.PLACA || "—"}</td>
                      <td className="px-3 py-2">{r.CIUDAD || "—"}</td>
                      <td className="px-3 py-2 truncate max-w-[160px]">{r.ESTACION || "—"}</td>
                      <td className="px-3 py-2 text-[12px]">{r.PRODUCTO || "—"}</td>
                      <td className="px-3 py-2 text-right font-bold">{formatNumber(parseFloat(r.CANTIDAD_GL || 0), 2)}</td>
                      <td className="px-3 py-2 text-right text-neutral-700">S/ {formatNumber(parseFloat(r.PRECIO_UNITARIO || 0), 2)}</td>
                      <td className="px-3 py-2 text-right font-bold text-neutral-900">{formatSoles(parseFloat(r.IMPORTE_TOTAL || 0))}</td>
                      {!isSubsidio && <td className="px-3 py-2 text-right font-bold text-green-600">{formatSoles(parseFloat(r.AHORRO || 0))}</td>}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {totalPages > 1 && (
              <div className="flex items-center justify-between px-4 py-3 border-t border-neutral-100 bg-neutral-50 text-sm">
                <div className="text-neutral-500">Mostrando {(page - 1) * PAGE_SIZE + 1} - {Math.min(page * PAGE_SIZE, rows.length)} de {rows.length}</div>
                <div className="flex items-center gap-2">
                  <button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1} className="px-3 py-1.5 border border-border rounded-md text-xs font-bold disabled:opacity-40">Anterior</button>
                  <span className="text-xs font-bold text-neutral-700">{page} / {totalPages}</span>
                  <button onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={page === totalPages} className="px-3 py-1.5 border border-border rounded-md text-xs font-bold disabled:opacity-40">Siguiente</button>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

function SmallKpi({ label, value, accent }) {
  const txt = accent === "green" ? "text-green-600" : "text-neutral-900";
  return (
    <div className="bg-white border border-border rounded-xl p-4">
      <div className="text-[10px] uppercase tracking-widest font-bold text-neutral-500 mb-1">{label}</div>
      <div className={`font-cabinet font-black text-2xl ${txt}`}>{value}</div>
    </div>
  );
}
