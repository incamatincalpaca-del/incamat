import fs from "node:fs/promises";
import { Workbook, SpreadsheetFile } from "@oai/artifact-tool";

const root = "C:/IncaMant";
const source = JSON.parse(await fs.readFile(`${root}/tmp/consolidado_repuestos.json`, "utf8"));
const outputDir = `${root}/outputs/repuestos`;
await fs.mkdir(outputDir, { recursive: true });

const column = (index) => {
  let value = ""; let n = index + 1;
  while (n) { const remainder = (n - 1) % 26; value = String.fromCharCode(65 + remainder) + value; n = Math.floor((n - 1) / 26); }
  return value;
};
const headers = (sheet, values, width = 18) => {
  sheet.getRangeByIndexes(0, 0, 1, values.length).values = [values];
  const range = sheet.getRange(`A1:${column(values.length - 1)}1`);
  range.format = { fill: "#163C63", font: { bold: true, color: "#FFFFFF" }, horizontalAlignment: "center", verticalAlignment: "center", wrapText: true };
  range.format.rowHeight = 30;
  sheet.getRange(`A:${column(values.length - 1)}`).format.columnWidth = width;
  sheet.freezePanes.freezeRows(1);
  sheet.showGridLines = false;
};
const writeSheet = (workbook, name, cols, data, widths = {}) => {
  const sheet = workbook.worksheets.add(name);
  headers(sheet, cols.map((item) => item.label));
  const values = data.map((row) => cols.map((item) => row[item.key] ?? ""));
  if (values.length) sheet.getRangeByIndexes(1, 0, values.length, cols.length).values = values;
  cols.forEach((item, index) => { if (widths[item.key]) sheet.getRange(`${column(index)}:${column(index)}`).format.columnWidth = widths[item.key]; });
  sheet.getRange(`A1:${column(cols.length - 1)}${Math.max(1, values.length + 1)}`).format.borders = { preset: "insideHorizontal", style: "thin", color: "#DCE6F0" };
  return sheet;
};

const workbook = Workbook.create();
const overview = workbook.worksheets.add("Guía"); overview.showGridLines = false;
overview.getRange("A1:H1").merge(); overview.getRange("A1").values = [["CONSOLIDADO DE REPUESTOS POR ÁREA Y FAMILIA TÉCNICA"]]; overview.getRange("A1").format = { fill: "#163C63", font: { bold: true, color: "#FFFFFF", size: 16 }, horizontalAlignment: "center" }; overview.getRange("A1:H1").format.rowHeight = 34;
overview.getRange("A3:H3").merge(); overview.getRange("A3").values = [["Uso del archivo"]]; overview.getRange("A3").format = { fill: "#E1F1FA", font: { bold: true, color: "#1B537A" } };
overview.getRange("A4:H8").values = [
  ["1", "Resumen", "Revisa qué área concentra más consumo y cuántos repuestos quedan por validar."],
  ["2", "Catálogo por área", "Una fila por combinación área + código de repuesto. La familia técnica es una sugerencia basada en la descripción."],
  ["3", "Movimientos", "Trazabilidad completa de los vales, fechas, costos, máquinas y archivos de origen."],
  ["4", "Validación", "Solo las clasificaciones confirmadas por mantenimiento deben pasar a estado Validada en INCAMAT."],
  ["5", "Regla de seguridad", "No se asignó familia automática a descripciones ambiguas; quedaron como Pendiente."],
];
overview.getRange("A4:A8").format = { font: { bold: true, color: "#1479B0" } }; overview.getRange("B4:B8").format = { font: { bold: true, color: "#233F5F" } }; overview.getRange("C4:H8").merge(true); overview.getRange("A4:H8").format.wrapText = true; overview.getRange("A:C").format.columnWidth = 22; overview.getRange("C:H").format.columnWidth = 18;

writeSheet(workbook, "Resumen", [
  { key: "area", label: "Área" }, { key: "familia_tecnica", label: "Familia técnica" }, { key: "repuestos", label: "Repuestos únicos" }, { key: "movimientos", label: "Movimientos" }, { key: "costo_acumulado", label: "Costo acumulado" }, { key: "pendientes", label: "Por validar" },
], source.resumen, { area: 22, familia_tecnica: 20, costo_acumulado: 18 });
const summarySheet = workbook.worksheets.getItem("Resumen"); summarySheet.getRange(`E2:E${source.resumen.length + 1}`).format.numberFormat = '"S/" #,##0.00';
writeSheet(workbook, "Catálogo por área", [
  { key: "area", label: "Área" }, { key: "codigo", label: "Código" }, { key: "descripcion", label: "Descripción" }, { key: "familia_tecnica", label: "Familia técnica" }, { key: "subfamilia_tecnica", label: "Subfamilia" }, { key: "estado_clasificacion", label: "Estado clasificación" }, { key: "origen_clasificacion", label: "Origen clasificación" }, { key: "unidad", label: "UM" }, { key: "movimientos", label: "N.º movimientos" }, { key: "cantidad_consumida", label: "Cantidad consumida" }, { key: "costo_ultimo", label: "Costo último" }, { key: "costo_acumulado", label: "Costo acumulado" }, { key: "maquinas_asociadas", label: "Máquinas asociadas" }, { key: "archivos_origen", label: "Archivo(s) origen" },
], source.catalogo, { area: 20, codigo: 16, descripcion: 42, familia_tecnica: 18, subfamilia_tecnica: 28, estado_clasificacion: 18, origen_clasificacion: 24, maquinas_asociadas: 42, archivos_origen: 34 });
const catalogSheet = workbook.worksheets.getItem("Catálogo por área"); catalogSheet.getRange(`K2:L${source.catalogo.length + 1}`).format.numberFormat = '"S/" #,##0.00';
writeSheet(workbook, "Movimientos", [
  { key: "area", label: "Área" }, { key: "archivo_origen", label: "Archivo origen" }, { key: "hoja_origen", label: "Hoja" }, { key: "vale", label: "N.º vale" }, { key: "fecha", label: "Fecha" }, { key: "codigo", label: "Código" }, { key: "descripcion", label: "Descripción" }, { key: "unidad", label: "UM" }, { key: "cantidad", label: "Cantidad" }, { key: "costo_unitario", label: "Costo unitario" }, { key: "costo_total", label: "Costo total" }, { key: "maquina_origen", label: "Máquina" }, { key: "familia_tecnica", label: "Familia técnica" }, { key: "subfamilia_tecnica", label: "Subfamilia" }, { key: "estado_clasificacion", label: "Estado clasificación" },
], source.movimientos, { area: 20, archivo_origen: 38, descripcion: 42, maquina_origen: 26, familia_tecnica: 18, subfamilia_tecnica: 28, estado_clasificacion: 18 });
const movementSheet = workbook.worksheets.getItem("Movimientos"); movementSheet.getRange(`J2:K${source.movimientos.length + 1}`).format.numberFormat = '"S/" #,##0.00';

for (const name of ["Resumen", "Catálogo por área", "Movimientos"]) { const sheet = workbook.worksheets.getItem(name); const last = sheet.getUsedRange(); last.format.wrapText = false; }
const preview = await workbook.render({ sheetName: "Resumen", range: "A1:F26", scale: 1.4, format: "png" });
await fs.writeFile(`${outputDir}/resumen.png`, new Uint8Array(await preview.arrayBuffer()));
const file = await SpreadsheetFile.exportXlsx(workbook); await file.save(`${outputDir}/Repuestos_Consolidado_Areas_Familias.xlsx`);
console.log(JSON.stringify({ output: `${outputDir}/Repuestos_Consolidado_Areas_Familias.xlsx` }));
