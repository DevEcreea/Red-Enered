import ExcelJS from "exceljs";

/**
 * Descarga el "Reporte Consumo - ENERED" en Excel con el formato institucional:
 * título arriba, cabecera morada, filas de consumo y pie con la marca.
 */
export async function exportarReporteEnered(rows, { isAdmin = false, showAhorro = true } = {}) {
  const wb = new ExcelJS.Workbook();
  wb.creator = "ENERED";
  const ws = wb.addWorksheet("Reporte Consumo", {
    views: [{ state: "frozen", ySplit: 3 }],
    pageSetup: { orientation: "landscape", fitToPage: true, fitToWidth: 1, fitToHeight: 0 },
  });

  const COLS = [
    { h: "Fecha", w: 12, key: "fecha" },
    { h: "Hora", w: 10, key: "hora" },
    { h: "Ciudad", w: 16, key: "ciudad" },
    { h: "Estación", w: 26, key: "estacion" },
    ...(isAdmin ? [{ h: "Empresa", w: 26, key: "empresa" }] : []),
    { h: "N° Tarjeta", w: 24, key: "tarjeta" },
    { h: "Placa", w: 11, key: "placa" },
    { h: "Producto", w: 30, key: "producto" },
    { h: "Unidad de Medida", w: 15, key: "unidad" },
    { h: "Cantidad (GL)", w: 13, key: "galones", num: "#,##0.000" },
    { h: "Precio Unitario (S/)", w: 17, key: "precio", num: '"S/" #,##0.00' },
    { h: "Importe Total (S/)", w: 16, key: "importe", num: '"S/" #,##0.00' },
    { h: "Precio Pizarra", w: 14, key: "pizarra", num: '"S/" #,##0.00' },
    ...(showAhorro ? [{ h: "Ahorro (S/)", w: 13, key: "ahorro", num: '"S/" #,##0.00' }] : []),
    { h: "Kilometraje", w: 13, key: "km" },
    { h: "Documento", w: 18, key: "doc" },
  ];
  const nCols = COLS.length;
  ws.columns = COLS.map((c) => ({ key: c.key, width: c.w }));

  // ── Título
  ws.mergeCells(1, 1, 1, nCols);
  const title = ws.getCell(1, 1);
  title.value = "Reporte Consumo- ENERED";
  title.font = { name: "Calibri", size: 18, bold: true, color: { argb: "FF111827" } };
  title.alignment = { horizontal: "right", vertical: "middle" };
  ws.getRow(1).height = 34;
  ws.getRow(2).height = 6;

  // ── Cabecera morada
  const headerRow = ws.getRow(3);
  COLS.forEach((c, i) => {
    const cell = headerRow.getCell(i + 1);
    cell.value = c.h;
    cell.font = { name: "Calibri", size: 11, bold: true, color: { argb: "FFFFFFFF" } };
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFB026FF" } };
    cell.alignment = { horizontal: "center", vertical: "middle", wrapText: true };
    cell.border = { bottom: { style: "thin", color: { argb: "FF7C3AED" } } };
  });
  headerRow.height = 30;
  ws.autoFilter = { from: { row: 3, column: 1 }, to: { row: 3, column: nCols } };

  // ── Filas
  const num = (v) => { const n = parseFloat(v); return isNaN(n) ? null : n; };
  rows.forEach((r) => {
    const galones = num(r.CANTIDAD_GL) || 0;
    const importe = num(r.IMPORTE_TOTAL) || 0;
    const precio = num(r.PRECIO_UNITARIO) || (galones > 0 ? importe / galones : 0);
    const pizarra = num(r.PRECIO_PIZARRA);
    const ahorro = num(r.AHORRO) || 0;
    const d = r.FECHA_TRANSACCION ? new Date(r.FECHA_TRANSACCION) : null;
    const fecha = d && !isNaN(d) ? d.toLocaleDateString("es-PE", { year: "numeric", month: "2-digit", day: "2-digit" }) : (r.FECHA || "—");
    const hora = r.HORA || (d && !isNaN(d) ? d.toLocaleTimeString("es-PE", { hour12: false }) : "—");

    ws.addRow({
      fecha, hora,
      ciudad: r.CIUDAD || "—",
      estacion: r.ESTACION || "—",
      ...(isAdmin ? { empresa: r.EMPRESA || "—" } : {}),
      tarjeta: r.NRO_DE_TARJETA || r.MEDIO_DE_IDENTIFICACION || "—",
      placa: r.PLACA || "—",
      producto: r.COMBUSTIBLE || r.PRODUCTO || "—",
      unidad: "Galon",
      galones: galones || null,
      precio: precio || null,
      importe: importe || null,
      pizarra: pizarra || null,
      ...(showAhorro ? { ahorro: ahorro || null } : {}),
      km: r.KILOMETRAJE ? `${r.KILOMETRAJE} km` : "—",
      doc: r.NUMERO_DOCUMENTO || "—",
    });
  });

  // Formato de datos (zebra + números)
  const firstData = 4;
  const lastData = 3 + rows.length;
  for (let i = firstData; i <= lastData; i++) {
    const row = ws.getRow(i);
    row.height = 18;
    COLS.forEach((c, j) => {
      const cell = row.getCell(j + 1);
      cell.font = { name: "Calibri", size: 10.5, color: { argb: "FF1F2937" } };
      cell.alignment = { horizontal: c.num ? "right" : (["fecha", "hora", "unidad", "placa"].includes(c.key) ? "center" : "left"), vertical: "middle" };
      if (c.num) cell.numFmt = c.num;
      if (i % 2 === 1) cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFF8F5FF" } };
      cell.border = { bottom: { style: "hair", color: { argb: "FFE5E7EB" } } };
    });
    // Ahorro en verde
    if (showAhorro) {
      const idx = COLS.findIndex((c) => c.key === "ahorro") + 1;
      row.getCell(idx).font = { name: "Calibri", size: 10.5, bold: true, color: { argb: "FF059669" } };
    }
  }

  // ── Totales
  if (rows.length) {
    const tRow = ws.addRow({});
    const iGal = COLS.findIndex((c) => c.key === "galones") + 1;
    const iImp = COLS.findIndex((c) => c.key === "importe") + 1;
    tRow.getCell(1).value = "TOTALES";
    tRow.getCell(1).font = { name: "Calibri", size: 11, bold: true, color: { argb: "FF5B21B6" } };
    const sum = (k) => rows.reduce((a, r) => a + (parseFloat(r[k]) || 0), 0);
    tRow.getCell(iGal).value = sum("CANTIDAD_GL"); tRow.getCell(iGal).numFmt = "#,##0.000";
    tRow.getCell(iImp).value = sum("IMPORTE_TOTAL"); tRow.getCell(iImp).numFmt = '"S/" #,##0.00';
    if (showAhorro) {
      const iAh = COLS.findIndex((c) => c.key === "ahorro") + 1;
      tRow.getCell(iAh).value = sum("AHORRO"); tRow.getCell(iAh).numFmt = '"S/" #,##0.00';
      tRow.getCell(iAh).font = { name: "Calibri", size: 11, bold: true, color: { argb: "FF059669" } };
    }
    [iGal, iImp].forEach((i) => { tRow.getCell(i).font = { name: "Calibri", size: 11, bold: true, color: { argb: "FF111827" } }; });
    for (let j = 1; j <= nCols; j++) {
      tRow.getCell(j).border = { top: { style: "thin", color: { argb: "FFB026FF" } } };
      tRow.getCell(j).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFF3E8FF" } };
    }
    tRow.height = 22;
  }

  // ── Pie de marca
  const footStart = ws.rowCount + 2;
  ws.mergeCells(footStart, 1, footStart, nCols);
  const f1 = ws.getCell(footStart, 1);
  f1.value = {
    richText: [
      { text: "ENERED", font: { bold: true, size: 12, color: { argb: "FF7C3AED" }, name: "Calibri" } },
      { text: "  |  Red Virtual de Distribución  |  Control & Gestión Integral de Flotas", font: { size: 11, color: { argb: "FF374151" }, name: "Calibri" } },
    ],
  };
  f1.alignment = { horizontal: "left" };
  ws.mergeCells(footStart + 1, 1, footStart + 1, nCols);
  const f2 = ws.getCell(footStart + 1, 1);
  f2.value = `Copyright © ${new Date().getFullYear()} | Energix Peru EIRL | RUC 20609304082 | Todos los derechos son reservados.`;
  f2.font = { name: "Calibri", size: 10, color: { argb: "FF6B7280" } };

  const buf = await wb.xlsx.writeBuffer();
  const blob = new Blob([buf], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `Reporte_Consumo_ENERED_${new Date().toISOString().slice(0, 10)}.xlsx`;
  a.click();
  URL.revokeObjectURL(url);
}
