const express = require("express");
const pool = require("../../config/database");
const router = express.Router();

router.get("/historial-exportable", async (_req, res) => {
  let conn;
  try {
    conn = await pool.getConnection();
    const rows = await conn.query(`SELECT mt.id,mt.fecha_programada,mt.fecha_realizacion,mt.tipo,mt.estado,mt.responsable,mt.descripcion,mt.observacion,m.nombre AS maquina,a.nombre AS area,
      f.descripcion AS falla_reportada,f.diagnostico,f.trabajo_realizado,f.evidencia_url,
      GROUP_CONCAT(CONCAT(r.codigo, ' · ', r.descripcion, ' x', mv.cantidad) SEPARATOR ' | ') AS repuestos_usados
      FROM mantenimientos mt JOIN maquinas m ON m.id=mt.id_maquina JOIN areas a ON a.id=m.id_area
      LEFT JOIN fallas f ON f.id=mt.id_falla
      LEFT JOIN movimientos_repuestos mv ON mv.id_maquina=mt.id_maquina AND f.id IS NOT NULL AND mv.observaciones LIKE CONCAT('%falla #', f.id, '%')
      LEFT JOIN repuestos r ON r.id=mv.id_repuesto
      GROUP BY mt.id,mt.fecha_programada,mt.fecha_realizacion,mt.tipo,mt.estado,mt.responsable,mt.descripcion,mt.observacion,m.nombre,a.nombre,f.descripcion,f.diagnostico,f.trabajo_realizado,f.evidencia_url
      ORDER BY mt.fecha_programada DESC`);
    res.json(rows);
  } catch (error) { console.error(error); res.status(500).json({ error: "No fue posible preparar el historial para exportación." }); }
  finally { if (conn) conn.release(); }
});

// Consulta didáctica del historial importado: no crea órdenes ni altera estados.
router.get("/historial-excel", async (req, res) => {
  const filters = {
    correctivo: "UPPER(TRIM(h.tipo_original)) = 'CORRECTIVO'",
    preventivo: "UPPER(TRIM(h.tipo_original)) IN ('PREVENTIVO','PREV GENERAL','PREVENTIVO MEC')",
    rutinario: "UPPER(TRIM(h.tipo_original)) = 'RUTINARIO'",
    limpieza: "UPPER(TRIM(h.tipo_original)) = 'LIMPIEZA'",
    proyecto: "UPPER(TRIM(h.tipo_original)) = 'PROYECTO'",
    mejora: "UPPER(TRIM(h.tipo_original)) = 'MEJORA'",
    seguridad: "UPPER(TRIM(h.tipo_original)) = 'SEGURIDAD'",
    apoyo: "UPPER(TRIM(h.tipo_original)) = 'APOYO'",
    otros: "UPPER(TRIM(h.tipo_original)) NOT IN ('CORRECTIVO','PREVENTIVO','PREV GENERAL','PREVENTIVO MEC','RUTINARIO','LIMPIEZA','PROYECTO','MEJORA','SEGURIDAD','APOYO')"
  };
  const type = String(req.query.tipo || "").toLowerCase();
  if (!filters[type]) return res.status(400).json({ error: "Tipo de historial no válido." });
  let conn;
  try {
    conn = await pool.getConnection();
    const where = filters[type];
    const [countRows, statusRows, rows] = await Promise.all([
      conn.query(`SELECT COUNT(*) AS total FROM historial_mantenimiento_excel h WHERE ${where}`),
      conn.query(`SELECT COALESCE(m.estado, 'Sin vincular') AS estado, COUNT(*) AS total FROM historial_mantenimiento_excel h LEFT JOIN maquinas m ON m.id=h.id_maquina WHERE ${where} GROUP BY COALESCE(m.estado, 'Sin vincular')`),
      conn.query(`SELECT h.id_registro,h.fecha,h.maquina_origen,h.tipo_original,h.tecnicos,h.ot,h.detalles,h.repuestos_materiales, COALESCE(m.nombre,h.maquina_origen) AS maquina, COALESCE(a.nombre,'Sin área vinculada') AS area, COALESCE(m.estado,'Sin vincular') AS estado_maquina FROM historial_mantenimiento_excel h LEFT JOIN maquinas m ON m.id=h.id_maquina LEFT JOIN areas a ON a.id=m.id_area WHERE ${where} ORDER BY h.fecha DESC, h.id DESC LIMIT 60`)
    ]);
    res.json({ total: Number(countRows[0]?.total || 0), estados: statusRows.map((row) => ({ estado: row.estado, total: Number(row.total || 0) })), registros: rows });
  } catch (error) { console.error(error); res.status(500).json({ error: "No fue posible consultar el historial importado." }); }
  finally { if (conn) conn.release(); }
});

router.get("/", async (_req, res) => {
  let conn;
  try { conn = await pool.getConnection(); const rows = await conn.query(`SELECT mt.*,m.nombre AS maquina,a.nombre AS area,f.estado AS estado_falla FROM mantenimientos mt JOIN maquinas m ON m.id=mt.id_maquina JOIN areas a ON a.id=m.id_area LEFT JOIN fallas f ON f.id=mt.id_falla ORDER BY FIELD(mt.estado,'En proceso','Programado','Completado','Cancelado'),mt.fecha_programada ASC`); res.json(rows); }
  catch (error) { console.error(error); res.status(500).json({ error: "No fue posible obtener mantenimientos." }); }
  finally { if (conn) conn.release(); }
});

router.post("/", async (req, res) => {
  const { id_maquina, tipo, modalidad = null, fecha_programada, responsable = null, descripcion = null, id_falla = null, checklist = [] } = req.body;
  if (!id_maquina || !tipo || !fecha_programada) return res.status(400).json({ error: "Máquina, tipo y fecha son obligatorios." });
  if (!["Preventivo", "Correctivo", "Predictivo", "Proactivo"].includes(tipo)) return res.status(400).json({ error: "Tipo de mantenimiento no válido." });
  if (tipo === "Preventivo" && !["Planificado", "Autónomo"].includes(modalidad)) return res.status(400).json({ error: "El preventivo debe ser planificado o autónomo." });
  if (tipo === "Correctivo" && !id_falla) return res.status(422).json({ error: "Los correctivos deben registrarse desde Incidencias para conservar la evidencia y el diagnóstico." });
  let conn;
  try {
    conn = await pool.getConnection(); await conn.beginTransaction();
    let fallaId = id_falla || null;
    if (tipo === "Correctivo" && !fallaId) {
      const fault = await conn.query("INSERT INTO fallas (id_maquina,prioridad,descripcion,reportado_por) VALUES (?, 'Media', ?, ?)", [id_maquina, descripcion || "Falla atendida mediante mantenimiento correctivo.", responsable || "Mantenimiento"]);
      fallaId = Number(fault.insertId);
      await conn.query("UPDATE maquinas SET estado='Detenida' WHERE id=?", [id_maquina]);
    }
    const list = checklist.map((item) => typeof item === "string" ? { tarea: item, completado: false } : item);
    const result = await conn.query("INSERT INTO mantenimientos (id_maquina,id_falla,tipo,modalidad,fecha_programada,responsable,descripcion,checklist) VALUES (?,?,?,?,?,?,?,?)", [id_maquina, fallaId, tipo, tipo === "Preventivo" ? modalidad : null, fecha_programada, responsable, descripcion, JSON.stringify(list)]);
    await conn.commit(); res.status(201).json({ id: Number(result.insertId), id_falla: fallaId, mensaje: tipo === "Correctivo" ? "Correctivo programado y falla reportada." : "Mantenimiento programado." });
  } catch (error) { if (conn) await conn.rollback(); console.error(error); res.status(500).json({ error: "No fue posible programar el mantenimiento." }); }
  finally { if (conn) conn.release(); }
});

router.patch("/:id/estado", async (req, res) => {
  const { estado, observacion = null } = req.body;
  if (!["Programado", "En proceso", "Completado", "Cancelado"].includes(estado)) return res.status(400).json({ error: "Estado no válido." });
  let conn;
  try {
    conn = await pool.getConnection(); await conn.beginTransaction();
    const rows = await conn.query("SELECT id_maquina,id_falla,tipo FROM mantenimientos WHERE id=? FOR UPDATE", [req.params.id]);
    if (!rows[0]) throw new Error("Mantenimiento no encontrado.");
    const item = rows[0];
    await conn.query("UPDATE mantenimientos SET estado=?,observacion=?,fecha_realizacion=IF(?='Completado',CURDATE(),fecha_realizacion) WHERE id=?", [estado, observacion, estado, req.params.id]);
    if (item.id_falla) {
      if (estado === "En proceso") { await conn.query("UPDATE fallas SET estado='En atención' WHERE id=?", [item.id_falla]); await conn.query("UPDATE maquinas SET estado='Detenida' WHERE id=?", [item.id_maquina]); }
      if (estado === "Completado") { await conn.query("UPDATE fallas SET estado='Resuelta',fecha_resolucion=NOW() WHERE id=?", [item.id_falla]); await conn.query("UPDATE maquinas SET estado='Operativa' WHERE id=?", [item.id_maquina]); }
    }
    await conn.commit(); res.json({ mensaje: "Estado actualizado." });
  } catch (error) { if (conn) await conn.rollback(); res.status(422).json({ error: error.message || "No fue posible actualizar el mantenimiento." }); }
  finally { if (conn) conn.release(); }
});

router.patch("/:id/checklist", async (req, res) => { const { checklist } = req.body; if (!Array.isArray(checklist)) return res.status(400).json({ error: "Checklist no válido." }); let conn; try { conn = await pool.getConnection(); await conn.query("UPDATE mantenimientos SET checklist=? WHERE id=?", [JSON.stringify(checklist), req.params.id]); res.json({ mensaje: "Checklist actualizado." }); } catch (error) { res.status(500).json({ error: "No fue posible actualizar el checklist." }); } finally { if (conn) conn.release(); } });
module.exports = router;
