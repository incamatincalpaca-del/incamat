/**
 * Transfiere la información operativa desde MariaDB local hacia el Worker
 * público de INCAMAT en lotes controlados. No elimina ni modifica MariaDB.
 *
 * Uso dentro del contenedor backend:
 *   INCAMAT_MIGRATION_KEY=<clave> node scripts/migrarD1Publico.js
 */
const pool = require("../config/database");

const baseUrl = (process.env.INCAMAT_PUBLIC_URL || "https://incamat.incamat-incalpaca.workers.dev").replace(/\/$/, "");
const key = process.env.INCAMAT_MIGRATION_KEY;
const onlyHistory = process.argv.includes("--solo-historial");
const chunk = (rows, size = 100) => Array.from({ length: Math.ceil(rows.length / size) }, (_, index) => rows.slice(index * size, index * size + size));

const send = async (collection, records) => {
  for (const [index, batch] of chunk(records).entries()) {
    const response = await fetch(`${baseUrl}/api/migracion-inicial`, {
      method: "POST",
      headers: { "content-type": "application/json", "x-incamat-migration-key": key },
      body: JSON.stringify({ collection, records: batch })
    });
    const result = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(`${collection}, lote ${index + 1}: ${result.error || response.statusText}`);
    console.log(`${collection}: ${Math.min((index + 1) * 100, records.length)}/${records.length}`);
  }
};

(async () => {
  if (!key) throw new Error("Falta INCAMAT_MIGRATION_KEY.");
  let conn;
  try {
    conn = await pool.getConnection();
    if (onlyHistory) {
      const historial = await conn.query(`SELECT id_registro,id_maquina,codigo_maquina_origen,maquina_origen,fecha,tecnicos,tipo_original,ot,codigo_mantenimiento,duracion_original,detalles,repuestos_materiales,foto_evidencia,revisado,id_importacion,creado_en,actualizado_en
        FROM historial_mantenimiento_excel ORDER BY id`);
      await send("historial_mantenimiento_excel", historial);
      console.log(JSON.stringify({ success: true, historial_mantenimiento_excel: historial.length }));
      return;
    }
    const [areas, maquinas, repuestos, relaciones, fallas, mantenimientos] = await Promise.all([
      conn.query("SELECT id,codigo,nombre,descripcion,responsable,estado FROM areas ORDER BY id"),
      conn.query("SELECT id,codigo,nombre,id_area,marca,modelo,descripcion_corta,estado,qr_token FROM maquinas ORDER BY id"),
      conn.query("SELECT id,codigo,descripcion,familia_tecnica,criticidad,stock_actual,stock_minimo,stock_verificado,unidad_medida AS unidad,ubicacion_almacen AS ubicacion,costo_ultimo,fecha_ultima_solicitud FROM repuestos ORDER BY id"),
      conn.query("SELECT id_repuesto,id_area FROM repuesto_areas ORDER BY id_repuesto,id_area"),
      conn.query("SELECT id,id_maquina,prioridad,descripcion,estado,fecha_reporte,fecha_resolucion FROM fallas ORDER BY id"),
      conn.query("SELECT id,id_maquina,id_falla,tipo,modalidad,estado,fecha_programada,fecha_realizacion,responsable,descripcion,observacion,checklist FROM mantenimientos ORDER BY id")
    ]);

    // D1 recibe datos simples; MariaDB entrega el checklist como arreglo u objeto.
    const mantenimientosNormalizados = mantenimientos.map((mantenimiento) => ({
      ...mantenimiento,
      checklist:
        mantenimiento.checklist == null
          ? null
          : typeof mantenimiento.checklist === "string"
            ? mantenimiento.checklist
            : JSON.stringify(mantenimiento.checklist)
    }));

    // El orden conserva las relaciones y los códigos originales.
    for (const [name, rows] of [["areas", areas], ["maquinas", maquinas], ["repuestos", repuestos], ["repuestos_areas", relaciones], ["fallas", fallas], ["mantenimientos", mantenimientosNormalizados]]) await send(name, rows);
    console.log(JSON.stringify({ success: true, areas: areas.length, maquinas: maquinas.length, repuestos: repuestos.length, relaciones: relaciones.length, fallas: fallas.length, mantenimientos: mantenimientosNormalizados.length }));
  } finally {
    conn?.release();
    await pool.end();
  }
})().catch((error) => { console.error(error.message || error); process.exitCode = 1; });
