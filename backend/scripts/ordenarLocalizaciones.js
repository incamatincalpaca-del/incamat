const XLSX = require("xlsx");
const pool = require("../config/database");
const normalizeRoute = (value) => String(value).replace(/\s+/g, " ").trim();

async function main() {
  const file = process.argv[2];
  if (!file) throw new Error("Indica la ruta del Excel.");
  const workbook = XLSX.readFile(file);
  const rows = XLSX.utils.sheet_to_json(workbook.Sheets["Localizacion por nivel"], { defval: "" });
  const orderByRoute = new Map();
  rows.forEach((row, rowIndex) => {
    const names = Object.values(row).map((value) => String(value || "").trim()).filter(Boolean);
    names.forEach((_, levelIndex) => {
      const route = normalizeRoute(names.slice(0, levelIndex + 1).join(" > "));
      if (!orderByRoute.has(route)) orderByRoute.set(route, rowIndex * 10 + levelIndex + 1);
    });
  });
  const conn = await pool.getConnection();
  await conn.query("ALTER TABLE localizaciones ADD COLUMN IF NOT EXISTS orden INT NOT NULL DEFAULT 9999 AFTER nivel");
  await conn.beginTransaction();
  const locations = await conn.query("SELECT id, ruta FROM localizaciones WHERE ruta LIKE 'PLANTA DE INCALPACA%'");
  for (const location of locations) {
    const order = orderByRoute.get(normalizeRoute(location.ruta));
    if (order) await conn.query("UPDATE localizaciones SET orden = ? WHERE id = ?", [order, location.id]);
  }
  await conn.commit();
  const result = await conn.query("SELECT COUNT(*) AS total FROM localizaciones WHERE ruta LIKE 'PLANTA DE INCALPACA%' AND orden < 9999");
  conn.release();
  await pool.end();
  console.log(`Ubicaciones ordenadas: ${result[0].total}`);
}
main().catch(async (error) => { console.error(error); process.exit(1); });
