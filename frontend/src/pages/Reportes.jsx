import React, { useEffect, useMemo, useState } from "react";
import { api } from "../lib/api";
import { formatSoles, formatNumber, formatDate } from "../lib/utils";
import { FileDown, FileSpreadsheet, Filter, Search } from "lucide-react";
import * as XLSX from "xlsx";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

export default function Reportes() {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState({ fecha_desde: "", fecha_hasta: "", placa: "", ciudad: "", estacion: "", producto: "" });
  const [search, setSearch] = useState("");

  const load = async () => {
    setLoading(true);
    try {
      const params = Object.fromEntries(Object.entries(filters).filter(([_, v]) => v));
      const { data } = await api.get("/consumptions", { params });
      setRows(data);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); /* eslint-disable-next-line */ }, []);

  const unique = (k) => [...new Set(rows.map((r) => r[k]).filter(Boolean))].sort();

  const filtered = useMemo(() => {
    if (!search) return rows;
    const s = search.toLowerCase();
    return rows.filter((r) =>
      Object.values(r).some((v) => v != null && String(v).toLowerCase().includes(s))
    );
  }, [rows, search]);

  const exportExcel = () => {
    const data = filtered.map((r) => ({
      FECHA: r.FECHA, HORA: r.HORA, CIUDAD: r.CIUDAD, ESTACION: r.ESTACION,
      PLACA: r.PLACA, PRODUCTO: r.PRODUCTO, "CANTIDAD GL": r.CANTIDAD_GL,
      "PRECIO UNIT": r.PRECIO_UNITARIO, "IMPORTE TOTAL": r.IMPORTE_TOTAL,
      AHORRO: r.AHORRO, EMPRESA: r.EMPRESA, KILOMETRAJE: r.KILOMETRAJE, SEMANA: r.SEMANA,
    }));
    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Reporte");
    XLSX.writeFile(wb, `ENERED_reporte_${Date.now()}.xlsx`);
  };

  const exportPDF = () => {
    const doc = new jsPDF({ orientation: "landscape" });
    doc.setFontSize(16); doc.text("ENERED — Reporte de Consumo", 14, 15);
    doc.setFontSize(9); doc.text(`Generado: ${new Date().toLocaleString("es-PE")}`, 14, 21);
    autoTable(doc, {
      startY: 26,
      head: [["Fecha", "Placa", "Ciudad", "Estación", "Producto", "Gal", "S/ Unit", "S/ Total", "Ahorro"]],
      body: filtered.slice(0, 500).map((r) => [
        r.FECHA || "", r.PLACA || "", r.CIUDAD || "", r.ESTACION || "", r.PRODUCTO || "",
        formatNumber(r.CANTIDAD_GL, 2), formatNumber(r.PRECIO_UNITARIO, 2),
        formatNumber(r.IMPORTE_TOTAL, 2), formatNumber(r.AHORRO, 2),
      ]),
      styles: { fontSize: 7 },
      headStyles: { fillColor: [153, 51, 255] },
    });
    doc.save(`ENERED_reporte_${Date.now()}.pdf`);
  };

  return (
    <div className="space-y-6">
      <div>
        <div className="text-[11px] font-bold uppercase tracking-widest text-brand mb-2">Datos detallados</div>
        <h1 className="font-cabinet font-black text-3xl md:text-4xl text-neutral-900">Reportes</h1>
        <p className="text-neutral-500 mt-1 text-sm">Consulta, filtra y exporta todo el historial de cargas.</p>
      </div>

      {/* Filters */}
      <div className="bg-white border border-border rounded-lg p-4 md:p-6" data-testid="reports-filters">
        <div className="flex items-center gap-2 text-sm font-bold text-neutral-700 mb-4">
          <Filter className="w-4 h-4" /> Filtros
        </div>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
          <input type="date" value={filters.fecha_desde} onChange={(e) => setFilters({ ...filters, fecha_desde: e.target.value })}
            className="h-10 px-3 border border-border rounded-md text-sm" data-testid="filter-from" />
          <input type="date" value={filters.fecha_hasta} onChange={(e) => setFilters({ ...filters, fecha_hasta: e.target.value })}
            className="h-10 px-3 border border-border rounded-md text-sm" data-testid="filter-to" />
          <select value={filters.placa} onChange={(e) => setFilters({ ...filters, placa: e.target.value })} className="h-10 px-3 border border-border rounded-md text-sm" data-testid="filter-placa">
            <option value="">Placa</option>{unique("PLACA").map((v) => <option key={v}>{v}</option>)}
          </select>
          <select value={filters.ciudad} onChange={(e) => setFilters({ ...filters, ciudad: e.target.value })} className="h-10 px-3 border border-border rounded-md text-sm" data-testid="filter-ciudad">
            <option value="">Ciudad</option>{unique("CIUDAD").map((v) => <option key={v}>{v}</option>)}
          </select>
          <select value={filters.estacion} onChange={(e) => setFilters({ ...filters, estacion: e.target.value })} className="h-10 px-3 border border-border rounded-md text-sm" data-testid="filter-estacion">
            <option value="">Estación</option>{unique("ESTACION").map((v) => <option key={v}>{v}</option>)}
          </select>
          <select value={filters.producto} onChange={(e) => setFilters({ ...filters, producto: e.target.value })} className="h-10 px-3 border border-border rounded-md text-sm" data-testid="filter-producto">
            <option value="">Producto</option>{unique("PRODUCTO").map((v) => <option key={v}>{v}</option>)}
          </select>
        </div>
        <div className="flex flex-wrap gap-2 mt-4">
          <button onClick={load} className="btn-brand text-sm" data-testid="apply-filters">Aplicar filtros</button>
          <button onClick={() => { setFilters({ fecha_desde: "", fecha_hasta: "", placa: "", ciudad: "", estacion: "", producto: "" }); setTimeout(load, 10); }} className="btn-ghost text-sm">Limpiar</button>
          <div className="flex-1" />
          <button onClick={exportExcel} className="btn-ghost text-sm flex items-center gap-2" data-testid="export-excel-btn">
            <FileSpreadsheet className="w-4 h-4" /> Excel
          </button>
          <button onClick={exportPDF} className="btn-ghost text-sm flex items-center gap-2" data-testid="export-pdf-btn">
            <FileDown className="w-4 h-4" /> PDF
          </button>
        </div>
      </div>

      {/* Search + table */}
      <div className="bg-white border border-border rounded-lg overflow-hidden">
        <div className="p-4 border-b border-border flex items-center justify-between gap-3">
          <div className="relative flex-1 max-w-md">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400" />
            <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Buscar en la tabla..."
              className="w-full h-10 pl-9 pr-3 border border-border rounded-md text-sm" data-testid="reports-search" />
          </div>
          <div className="text-xs font-bold text-neutral-500 uppercase tracking-wider">
            {filtered.length} registro{filtered.length !== 1 ? "s" : ""}
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="enered-table" data-testid="reports-table">
            <thead>
              <tr>
                <th>Fecha</th><th>Hora</th><th>Empresa</th><th>Placa</th><th>Ciudad</th>
                <th>Estación</th><th>Producto</th><th className="text-right">Gal</th>
                <th className="text-right">S/ Unit</th><th className="text-right">S/ Total</th>
                <th className="text-right">Ahorro</th><th>Km</th><th>Semana</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={13} className="text-center py-10 text-neutral-500">Cargando...</td></tr>
              ) : filtered.length === 0 ? (
                <tr><td colSpan={13} className="text-center py-10 text-neutral-500">Sin resultados</td></tr>
              ) : (
                filtered.slice(0, 500).map((r, i) => (
                  <tr key={r.id || i}>
                    <td>{formatDate(r.FECHA)}</td>
                    <td>{r.HORA || "—"}</td>
                    <td className="font-semibold">{r.EMPRESA || "—"}</td>
                    <td className="font-mono font-bold text-brand">{r.PLACA || "—"}</td>
                    <td>{r.CIUDAD || "—"}</td>
                    <td>{r.ESTACION || "—"}</td>
                    <td>{r.PRODUCTO || "—"}</td>
                    <td className="text-right font-semibold">{formatNumber(r.CANTIDAD_GL, 2)}</td>
                    <td className="text-right">{formatNumber(r.PRECIO_UNITARIO, 2)}</td>
                    <td className="text-right font-bold">{formatSoles(r.IMPORTE_TOTAL)}</td>
                    <td className="text-right text-green-600 font-semibold">{formatSoles(r.AHORRO)}</td>
                    <td>{r.KILOMETRAJE || "—"}</td>
                    <td className="text-xs text-neutral-500">{r.SEMANA || "—"}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        {filtered.length > 500 && (
          <div className="p-3 bg-neutral-50 text-center text-xs text-neutral-500 border-t border-border">
            Mostrando primeros 500 — usa los filtros o exporta para ver más.
          </div>
        )}
      </div>
    </div>
  );
}
