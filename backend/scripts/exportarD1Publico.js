/**
 * Exporta la informaciÃ³n operativa de MariaDB a SQL compatible con Cloudflare D1.
 * Se ejecuta dentro del contenedor backend y no realiza escrituras en MariaDB.
 */
const fs = require("fs");
const path = require("path");
const pool = require("../config/database");

const sql = (value) => {
  if (value === null || value === undefined || value === "") return "NULL";
  if (typeof value === "number") return String(value);
  return `'${String(value).replaceAll("'", "''")}'`;
};
const insert = (table, columns, rows) => rows.map((row) =>
  `INSERT OR REPLACE INTO ${table} (${columns.join(", ")}) VALUES (${columns.map((column) => sql(row[column])).join(", ")});`
).join("\n");

(async () => {
  let conn;
  try {
    conn = await pool.getConnection();
    const [areas, maquinas, repuestos, relaciones, fallas, mantenimientos] = await Promise.all([
      conn.query("SELECT id,codigo,nombre,descripcion,responsable,estado FROM areas ORDER BY id"),
      conn.query("SELECT id,codigo,nombre,id_area,marca,modelo,descripcion_corta,estado,qr_token FROM maquinas ORDER BY id"),
      conn.query("SELECT id,codigo,descripcion,familia_tecnica,criticidad,stock_actual,stock_minimo,stock_verificado,unidad_medida,ubicacion_almacen,costo_ultimo,fecha_ultima_solicitud FROM repuestos ORDER BY id"),
      conn.query("SELECT id_repuesto,id_area FROM repuesto_areas ORDER BY id_repuesto,id_area"),
      conn.query("SELECT id,id_maquina,prioridad,descripcion,estado,fecha_reporte,fecha_resolucion FROM fallas ORDER BY id"),
      conn.query("SELECT id,id_maquina,id_falla,tipo,modalidad,estado,fecha_programada,fecha_realizacion,responsable,descripcion,observacion,checklist FROM mantenimientos ORDER BY id")
    ]);
    const content = [
      "-- INCAMAT: migraciÃ³n generada desde MariaDB local.",
      "-- Ejecutar Ãºnicamente en una base D1 creada para INCAMAT.",
      "PRAGMA foreign_keys = OFF;\nBEGIN TRANSACTION;",
      insert("areas", ["id", "codigo", "nombre", "descripcion", "responsable", "estado"], areas),
      insert("maquinas", ["id", "codigo", "nombre", "id_area", "marca", "modelo", "descripcion_corta", "estado", "qr_token"], maquinas),
      insert("repuestos", ["id", "codigo", "descripcion", "familia_tecnica", "criticidad", "stock_actual", "stock_minimo", "stock_verificado", "unidad", "ubicacion", "costo_ultimo", "fecha_ultima_solicitud"], repuestos),
      insert("repuestos_areas", ["id_repuesto", "id_area"], relaciones),
      insert("fallas", ["id", "id_maquina", "prioridad", "descripcion", "estado", "fecha_reporte", "fecha_resolucion"], fallas),
      insert("mantenimientos", ["id", "id_maquina", "id_falla", "tipo", "modalidad", "estado", "fecha_programada", "fecha_realizacion", "responsable", "descripcion", "observacion", "checklist"], mantenimientos),
      "COMMIT;\nPRAGMA foreign_keys = ON;"
    ].filter(Boolean).join("\n\n");
    const target = path.join(__dirname, "..", "exports", "incamat-d1.sql");
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.writeFileSync(target, `${content}\n`, "utf8");
    console.log(JSON.stringify({ archivo: target, areas: areas.length, maquinas: maquinas.length, repuestos: repuestos.length, relaciones: relaciones.length, fallas: fallas.length, mantenimientos: mantenimientos.length }));
  } finally {
    conn?.release();
    await pool.end();
  }
})().catch((error) => { console.error(error); process.exitCode = 1; });

