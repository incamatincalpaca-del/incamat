const fs = require("fs");
const path = require("path");
const XLSX = require("xlsx");
const pool = require("../config/database");

const files = process.argv.slice(2);
if (!files.length) throw new Error("Indica uno o más archivos de historial.");
const sheets = ["Historial_Mantenimiento", "Historial_Mantenimiento_Shima", "Historial_Mantenimiento_CTP"];
const text = (value) => value == null || String(value).trim() === "" ? null : String(value).trim();
const asDate = (value) => {
  if (value instanceof Date && !Number.isNaN(value.getTime())) return value.toISOString().slice(0, 10);
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString().slice(0, 10);
};

async function machineId(conn, code, name) {
  if (code) {
    const byCode = await conn.query("SELECT id FROM maquinas WHERE codigo=? LIMIT 1", [code]);
    if (byCode[0]) return byCode[0].id;
  }
  if (name) {
    const byName = await conn.query("SELECT id FROM maquinas WHERE UPPER(TRIM(nombre))=UPPER(TRIM(?)) LIMIT 1", [name]);
    if (byName[0]) return byName[0].id;
  }
  return null;
}

async function importFile(conn, file) {
  const book = XLSX.readFile(file, { cellDates: true });
  const history = await conn.query("INSERT INTO importaciones (modulo,nombre_archivo,usuario_importador,estado) VALUES ('MantenimientoHistorico',?,'Administrador','Procesado')", [path.basename(file)]);
  const importId = Number(history.insertId);
  let created = 0; let updated = 0; let errors = 0;
  for (const sheet of sheets.filter((name) => book.SheetNames.includes(name))) {
    const rows = XLSX.utils.sheet_to_json(book.Sheets[sheet], { defval: null, raw: true });
    for (const row of rows) {
      const id = text(row.ID_Registro);
      const machineName = text(row.Maquina);
      const date = asDate(row.Fecha);
      if (!id || !machineName || !date) { errors += 1; continue; }
      const code = text(row.ID_Maquina);
      const exists = await conn.query("SELECT id FROM historial_mantenimiento_excel WHERE id_registro=?", [id]);
      const idMachine = await machineId(conn, code, machineName);
      await conn.query(`INSERT INTO historial_mantenimiento_excel
        (id_registro,id_maquina,codigo_maquina_origen,maquina_origen,fecha,tecnicos,tipo_original,ot,codigo_mantenimiento,duracion_original,detalles,repuestos_materiales,foto_evidencia,revisado,id_importacion)
        VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
        ON DUPLICATE KEY UPDATE id_maquina=VALUES(id_maquina), codigo_maquina_origen=VALUES(codigo_maquina_origen), maquina_origen=VALUES(maquina_origen), fecha=VALUES(fecha), tecnicos=VALUES(tecnicos), tipo_original=VALUES(tipo_original), ot=VALUES(ot), codigo_mantenimiento=VALUES(codigo_mantenimiento), duracion_original=VALUES(duracion_original), detalles=VALUES(detalles), repuestos_materiales=VALUES(repuestos_materiales), foto_evidencia=VALUES(foto_evidencia), revisado=VALUES(revisado), actualizado_en=NOW()`,
        [id, idMachine, code, machineName, date, text(row["Técnicos"]), text(row.Tipo_Mantenimiento) || "Otros", text(row.OT), text(row["Código_Mantenimiento"]), text(row["Duración"]), text(row["Detalles de intervención"]), text(row["Repuestos/Materiales"]), text(row.Foto_evidencia), text(row.Revisado), importId]);
      if (exists[0]) updated += 1; else created += 1;
    }
  }
  await conn.query("UPDATE importaciones SET registros_creados=?,registros_actualizados=?,registros_error=?,estado=? WHERE id=?", [created, updated, errors, errors ? "Con errores" : "Procesado", importId]);
  return { file: path.basename(file), created, updated, errors };
}

(async () => {
  let conn;
  try {
    conn = await pool.getConnection();
    await conn.beginTransaction();
    await conn.query("DELETE FROM solicitudes_externas WHERE id_importacion IN (SELECT id FROM importaciones WHERE modulo='MantenimientoSRequest')");
    await conn.query("DELETE FROM importaciones WHERE modulo='MantenimientoSRequest'");
    const results = [];
    for (const file of files) results.push(await importFile(conn, file));
    await conn.commit();
    console.log(JSON.stringify(results));
  } catch (error) {
    if (conn) await conn.rollback();
    console.error(error); process.exitCode = 1;
  } finally {
    if (conn) conn.release();
    await pool.end();
  }
})();
