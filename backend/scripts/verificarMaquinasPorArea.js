const XLSX = require("xlsx");
const pool = require("../config/database");

const normalize = (value) => String(value || "").trim().toUpperCase().replace(/\s+/g, " ");

async function main() {
  const file = process.argv[2];
  if (!file) throw new Error("Indica la ruta del Excel.");
  const workbook = XLSX.readFile(file);
  const rows = XLSX.utils.sheet_to_json(workbook.Sheets.maquinas, { defval: "" });
  const expected = new Map();
  rows.forEach((row) => {
    const area = normalize(row["Área"]);
    expected.set(area, (expected.get(area) || 0) + 1);
  });
  const conn = await pool.getConnection();
  const database = await conn.query(`SELECT resultado.area, COUNT(*) AS total FROM (
    SELECT CASE l.nombre
      WHEN 'PLANTA CONFECCION DE TEJIDO PLANO' THEN 'PLANTA CONFECCION TEJIDO PLANO'
      WHEN 'ACADADO FINAL' THEN 'ACABADO FINAL'
      WHEN 'AREA DE PRECARGADO' THEN 'AREA DE PRECARDADO'
      WHEN 'Planta de Tintoreria' THEN 'PLANTA TINTORERIA'
      ELSE COALESCE(l.nombre, a.nombre)
      END AS area
    FROM maquinas m JOIN areas a ON a.id = m.id_area
    LEFT JOIN localizaciones l ON l.id = m.id_localizacion
  ) resultado GROUP BY resultado.area`);
  conn.release();
  const actual = new Map(database.map((row) => [normalize(row.area), Number(row.total)]));
  console.log("AREA|EXCEL|BASE|DIFERENCIA");
  [...new Set([...expected.keys(), ...actual.keys()])].sort().forEach((area) => console.log([area, expected.get(area) || 0, actual.get(area) || 0, (actual.get(area) || 0) - (expected.get(area) || 0)].join("|")));

  const machineRows = await pool.query(`SELECT m.nombre, m.marca, m.modelo, CASE l.nombre
    WHEN 'PLANTA CONFECCION DE TEJIDO PLANO' THEN 'PLANTA CONFECCION TEJIDO PLANO'
    WHEN 'ACADADO FINAL' THEN 'ACABADO FINAL'
    WHEN 'AREA DE PRECARGADO' THEN 'AREA DE PRECARDADO'
    WHEN 'Planta de Tintoreria' THEN 'PLANTA TINTORERIA'
    ELSE COALESCE(l.nombre, a.nombre)
    END AS area FROM maquinas m JOIN areas a ON a.id = m.id_area LEFT JOIN localizaciones l ON l.id = m.id_localizacion`);
  const key = (machine, area, brand, model) => [normalize(machine), normalize(area), normalize(brand), normalize(model)].join("|");
  const sourceKeys = new Set(rows.map((row) => key(row["Máquina"], row["Área"], row["Marca"], row["Modelo"])));
  const databaseKeys = new Set(machineRows.map((row) => key(row.nombre, row.area, row.marca, row.modelo)));
  const missing = [...sourceKeys].filter((item) => !databaseKeys.has(item));
  console.log(`RESUMEN_EQUIPOS|excel=${rows.length}|base=${machineRows.length}|faltantes=${[...sourceKeys].filter((item) => !databaseKeys.has(item)).length}|adicionales=${[...databaseKeys].filter((item) => !sourceKeys.has(item)).length}`);
  missing.slice(0, 10).forEach((item) => console.log(`FALTANTE|${item}`));
  await pool.end();
}
main().catch((error) => { console.error(error); process.exit(1); });
