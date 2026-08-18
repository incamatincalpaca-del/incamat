const XLSX = require("xlsx");
const pool = require("../config/database");

const normalize = (value) => String(value || "").trim().toUpperCase().replace(/\s+/g, " ");
const key = (machine, brand, model) => [normalize(machine), normalize(brand), normalize(model)].join("|");

async function main() {
  const file = process.argv[2];
  const apply = process.argv.includes("--aplicar");
  if (!file) throw new Error("Indica la ruta del Excel.");
  const workbook = XLSX.readFile(file);
  const records = XLSX.utils.sheet_to_json(workbook.Sheets.Hoja1, { defval: "" });
  const assignments = new Map(records.map((row) => [key(row.Equipo, row.Marca, row.Modelo), normalize(row.Area)]));
  const conn = await pool.getConnection();
  const machines = await conn.query("SELECT id, nombre, marca, modelo FROM maquinas ORDER BY id");
  const areas = await conn.query("SELECT id, nombre FROM areas");
  const areaIds = new Map(areas.map((area) => [normalize(area.nombre), area.id]));
  const unmatched = machines.filter((machine) => !assignments.has(key(machine.nombre, machine.marca, machine.modelo)));
  const missingAreas = [...new Set(assignments.values())].filter((area) => !areaIds.has(area));
  console.log(`Excel: ${records.length} | Máquinas BD: ${machines.length} | Sin coincidencia: ${unmatched.length} | Áreas faltantes: ${missingAreas.length}`);
  if (unmatched.length || missingAreas.length) {
    console.log(JSON.stringify({ sinCoincidencia: unmatched.slice(0, 10), areasFaltantes: missingAreas }, null, 2));
    conn.release(); await pool.end(); process.exit(2);
  }
  if (apply) {
    await conn.beginTransaction();
    for (const machine of machines) {
      const area = assignments.get(key(machine.nombre, machine.marca, machine.modelo));
      await conn.query("UPDATE maquinas SET id_area = ? WHERE id = ?", [areaIds.get(area), machine.id]);
    }
    await conn.commit();
    console.log("Asignación aplicada a las 703 máquinas.");
  } else console.log("Validación correcta. Ejecuta con --aplicar para guardar.");
  conn.release();
  await pool.end();
}
main().catch(async (error) => { console.error(error); process.exit(1); });
