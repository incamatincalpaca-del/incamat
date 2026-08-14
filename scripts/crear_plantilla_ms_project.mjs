import fs from "node:fs/promises";
import { SpreadsheetFile, Workbook } from "@oai/artifact-tool";

const outputDir = "C:/IncaMant/outputs/project-incamat";
const outputPath = `${outputDir}/Plantilla_INCAMAT_para_Microsoft_Project.xlsx`;

const tasks = [
  [1, "1", "Levantamiento de requerimientos y revisión de archivos Excel", "", "", "", "", "Alyson Noely Diaz Mamani", "Registrar fecha real de inicio y fin."],
  [2, "2", "Definición de estructura: planta, localizaciones, áreas y máquinas", "", "", "", "1", "Alyson Noely Diaz Mamani", "Incluye la organización de áreas y máquinas de Incalpaca."],
  [3, "3", "Diseño de base de datos y configuración Docker/MariaDB", "", "", "", "2", "Alyson Noely Diaz Mamani", "Registrar fechas reales del entorno de desarrollo."],
  [4, "4", "Desarrollo del módulo de localizaciones y máquinas", "", "", "", "3", "Alyson Noely Diaz Mamani", "Incluye consulta por área y ficha de máquinas."],
  [5, "5", "Implementación de ficha técnica y código QR por máquina", "", "", "", "4", "Alyson Noely Diaz Mamani", "QR asociado a la identificación del activo."],
  [6, "6", "Desarrollo de incidencias y órdenes de mantenimiento", "", "", "", "5", "Alyson Noely Diaz Mamani", "Registro, inicio, atención y cierre de orden."],
  [7, "7", "Implementación de importaciones, validación y exportación CSV", "", "", "", "6", "Alyson Noely Diaz Mamani", "Carga desde Excel con vista previa e historial."],
  [8, "8", "Clasificación de repuestos por área, familia y criticidad", "", "", "", "7", "Alyson Noely Diaz Mamani", "Familias mecánica, eléctrica y electrónica."],
  [9, "9", "Solicitudes, movimientos de stock y control de repuestos", "", "", "", "8", "Alyson Noely Diaz Mamani", "Incluye stock físico, solicitudes y consumo."],
  [10, "10", "Dashboard e indicadores de mantenimiento y repuestos", "", "", "", "9", "Alyson Noely Diaz Mamani", "Indicadores disponibles según información registrada."],
  [11, "11", "Pruebas funcionales, correcciones y mejora de interfaz", "", "", "", "10", "Alyson Noely Diaz Mamani", "Registrar resultados y fechas reales de prueba."],
  [12, "12", "Elaboración del informe, anexos y evidencias", "", "", "", "11", "Alyson Noely Diaz Mamani", "Incluye Gantt, bibliografía, organigrama y evidencias."],
];

const workbook = Workbook.create();
const sheet = workbook.worksheets.add("Importar a Project");
const guide = workbook.worksheets.add("Guía");

sheet.showGridLines = false;
sheet.getRange("A1:I1").merge();
sheet.getRange("A1").values = [["PLANTILLA DE CRONOGRAMA - PROYECTO INCAMAT"]];
sheet.getRange("A2:I2").merge();
sheet.getRange("A2").values = [["Completa únicamente duración, fecha de inicio y fecha de fin con información real. Luego importa esta hoja en Microsoft Project."]];
sheet.getRange("A4:I4").values = [["ID", "EDT", "Nombre de tarea", "Duración real", "Inicio real", "Fin real", "Predecesoras", "Responsable", "Observación"]];
sheet.getRange(`A5:I${4 + tasks.length}`).values = tasks;

sheet.getRange("A1:I1").format = { fill: "#17365D", font: { bold: true, color: "#FFFFFF", size: 16 }, horizontalAlignment: "center", verticalAlignment: "center" };
sheet.getRange("A2:I2").format = { fill: "#D9EAF7", font: { italic: true, color: "#1F1F1F" }, wrapText: true };
sheet.getRange("A4:I4").format = { fill: "#D9D9D9", font: { bold: true, color: "#000000" }, horizontalAlignment: "center", verticalAlignment: "center", wrapText: true };
sheet.getRange(`A4:I${4 + tasks.length}`).format.borders = { preset: "all", style: "thin", color: "#D9D9D9" };
sheet.getRange(`A5:A${4 + tasks.length}`).format.horizontalAlignment = "center";
sheet.getRange(`B5:B${4 + tasks.length}`).format.horizontalAlignment = "center";
sheet.getRange(`D5:F${4 + tasks.length}`).format.fill = "#FFF2CC";
sheet.getRange(`D5:F${4 + tasks.length}`).format.horizontalAlignment = "center";
sheet.getRange(`D5:D${4 + tasks.length}`).dataValidation = { rule: { type: "custom", formula1: "=OR(D5=\"\",ISNUMBER(SEARCH(\"d\",D5)),ISNUMBER(SEARCH(\"sem\",D5)))" } };
sheet.getRange(`E5:F${4 + tasks.length}`).format.numberFormat = "yyyy-mm-dd";
sheet.getRange("A1:I1").format.rowHeight = 30;
sheet.getRange("A2:I2").format.rowHeight = 32;
sheet.getRange("A4:I4").format.rowHeight = 34;
sheet.getRange(`A5:I${4 + tasks.length}`).format.rowHeight = 42;
sheet.getRange("A:A").format.columnWidth = 8;
sheet.getRange("B:B").format.columnWidth = 8;
sheet.getRange("C:C").format.columnWidth = 48;
sheet.getRange("D:D").format.columnWidth = 16;
sheet.getRange("E:F").format.columnWidth = 15;
sheet.getRange("G:G").format.columnWidth = 15;
sheet.getRange("H:H").format.columnWidth = 26;
sheet.getRange("I:I").format.columnWidth = 42;
sheet.getRange(`C5:C${4 + tasks.length}`).format.wrapText = true;
sheet.getRange(`I5:I${4 + tasks.length}`).format.wrapText = true;
sheet.freezePanes.freezeRows(4);
sheet.tables.add(`A4:I${4 + tasks.length}`, true, "TareasIncamAt");

guide.showGridLines = false;
guide.getRange("A1:D1").merge();
guide.getRange("A1").values = [["CÓMO IMPORTAR ESTA PLANTILLA EN MICROSOFT PROJECT"]];
guide.getRange("A1:D1").format = { fill: "#17365D", font: { bold: true, color: "#FFFFFF", size: 15 }, horizontalAlignment: "center" };
guide.getRange("A3:B3").values = [["Paso", "Acción"]];
guide.getRange("A4:B8").values = [
  ["1", "Completa las columnas amarillas de la hoja “Importar a Project” con duración, inicio y fin reales."],
  ["2", "Abre Microsoft Project y selecciona Archivo > Abrir > Examinar. Elige este archivo Excel."],
  ["3", "En el asistente de importación, selecciona “Nuevo mapa” y vincula los campos: Nombre de tarea, Duración, Inicio, Fin, Predecesoras y Responsable."],
  ["4", "No importes la columna Observación como dato de programación; úsala solo como referencia."],
  ["5", "Revisa el diagrama de Gantt generado por Project y ajusta dependencias o duración únicamente con información validada."],
];
guide.getRange("A3:B3").format = { fill: "#D9D9D9", font: { bold: true }, horizontalAlignment: "center" };
guide.getRange("A3:B8").format.borders = { preset: "all", style: "thin", color: "#D9D9D9" };
guide.getRange("A4:A8").format.horizontalAlignment = "center";
guide.getRange("B4:B8").format.wrapText = true;
guide.getRange("A:A").format.columnWidth = 12;
guide.getRange("B:B").format.columnWidth = 105;
guide.getRange("A3:B3").format.rowHeight = 25;
guide.getRange("A4:B8").format.rowHeight = 45;
guide.getRange("A10:B10").merge();
guide.getRange("A10").values = [["Nota: el archivo no contiene fechas ni duraciones inventadas. Deben completarse con los datos reales de Alyson y del proyecto INCAMAT."]];
guide.getRange("A10:B10").format = { fill: "#FFF2CC", font: { italic: true }, wrapText: true };
guide.getRange("A10:B10").format.rowHeight = 36;

await fs.mkdir(outputDir, { recursive: true });
const preview = await workbook.render({ sheetName: "Importar a Project", range: "A1:I16", scale: 1.25, format: "png" });
await fs.writeFile(`${outputDir}/vista_previa.png`, new Uint8Array(await preview.arrayBuffer()));
const output = await SpreadsheetFile.exportXlsx(workbook);
await output.save(outputPath);
console.log(outputPath);
