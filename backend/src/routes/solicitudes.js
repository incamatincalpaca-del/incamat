const express = require("express");
const pool = require("../../config/database");
const router = express.Router();

const estados = ["Solicitada", "Aprobada", "Entregada", "Rechazada"];

router.get("/", async (_req, res) => {
  let conn;
  try {
    conn = await pool.getConnection();
    const rows = await conn.query(`SELECT s.*, a.nombre AS area, m.nombre AS maquina, r.codigo AS codigo_repuesto, r.descripcion AS repuesto, r.criticidad AS criticidad_repuesto, r.stock_actual, r.stock_verificado
      FROM solicitudes_repuestos s
      JOIN areas a ON a.id=s.id_area
      LEFT JOIN maquinas m ON m.id=s.id_maquina
      JOIN repuestos r ON r.id=s.id_repuesto
      ORDER BY s.fecha_solicitud DESC`);
    res.json(rows);
  } catch (error) { console.error(error); res.status(500).json({ error: "No fue posible obtener las solicitudes." }); }
  finally { if (conn) conn.release(); }
});

router.get("/reporte.csv", async (_req, res) => {
  let conn;
  try {
    conn = await pool.getConnection();
    const rows = await conn.query(`SELECT s.numero, a.nombre AS area, m.nombre AS maquina, r.codigo, r.descripcion AS repuesto, s.cantidad_solicitada, s.prioridad, s.solicitado_por, s.estado, s.fecha_solicitud, s.aprobado_por, s.entregado_por, s.fecha_entrega, s.observacion_decision FROM solicitudes_repuestos s JOIN areas a ON a.id=s.id_area LEFT JOIN maquinas m ON m.id=s.id_maquina JOIN repuestos r ON r.id=s.id_repuesto ORDER BY s.fecha_solicitud DESC`);
    const quote = (value) => `"${String(value == null ? "" : value).replaceAll('"', '""')}"`;
    const csv = [["Número","Área","Máquina","Código","Repuesto","Cantidad","Prioridad","Solicitado por","Estado","Fecha solicitud","Aprobado por","Entregado por","Fecha entrega","Observación"], ...rows.map((row) => [row.numero,row.area,row.maquina,row.codigo,row.repuesto,row.cantidad_solicitada,row.prioridad,row.solicitado_por,row.estado,row.fecha_solicitud,row.aprobado_por,row.entregado_por,row.fecha_entrega,row.observacion_decision])].map((row) => row.map(quote).join(";")).join("\n");
    res.setHeader("Content-Type", "text/csv; charset=utf-8"); res.setHeader("Content-Disposition", "attachment; filename=solicitudes_repuestos.csv"); res.send(`\uFEFF${csv}`);
  } catch (error) { res.status(500).json({ error: "No fue posible generar el reporte." }); }
  finally { if (conn) conn.release(); }
});

router.get("/indicadores", async (_req, res) => {
  let conn;
  try {
    conn = await pool.getConnection();
    const [resumen] = await conn.query(`SELECT COUNT(*) total, SUM(estado='Solicitada') pendientes, SUM(estado='Aprobada') aprobadas, SUM(estado='Entregada') entregadas FROM solicitudes_repuestos`);
    const porArea = await conn.query(`SELECT a.nombre, COUNT(*) solicitudes, COALESCE(SUM(s.cantidad_solicitada),0) cantidad FROM solicitudes_repuestos s JOIN areas a ON a.id=s.id_area GROUP BY a.id,a.nombre ORDER BY solicitudes DESC, cantidad DESC LIMIT 6`);
    const porRepuesto = await conn.query(`SELECT r.descripcion, r.codigo, COUNT(*) solicitudes, COALESCE(SUM(s.cantidad_solicitada),0) cantidad FROM solicitudes_repuestos s JOIN repuestos r ON r.id=s.id_repuesto GROUP BY r.id,r.descripcion,r.codigo ORDER BY solicitudes DESC, cantidad DESC LIMIT 6`);
    res.json({ resumen: { total: Number(resumen.total || 0), pendientes: Number(resumen.pendientes || 0), aprobadas: Number(resumen.aprobadas || 0), entregadas: Number(resumen.entregadas || 0) }, por_area: porArea, por_repuesto: porRepuesto });
  } catch (error) { console.error(error); res.status(500).json({ error: "No fue posible calcular indicadores." }); }
  finally { if (conn) conn.release(); }
});

router.post("/", async (req, res) => {
  const { id_area, id_maquina = null, id_repuesto, cantidad_solicitada, prioridad = "Media", motivo = null, solicitado_por } = req.body;
  if (!id_area || !id_repuesto || !Number(cantidad_solicitada) || Number(cantidad_solicitada) <= 0 || !String(solicitado_por || "").trim()) return res.status(400).json({ error: "Área, repuesto, cantidad y solicitante son obligatorios." });
  let conn;
  try {
    conn = await pool.getConnection();
    const numero = `SOL-${new Date().toISOString().slice(0, 10).replace(/-/g, "")}-${Date.now().toString().slice(-6)}`;
    const result = await conn.query("INSERT INTO solicitudes_repuestos (numero,id_area,id_maquina,id_repuesto,cantidad_solicitada,prioridad,motivo,solicitado_por) VALUES (?,?,?,?,?,?,?,?)", [numero, id_area, id_maquina || null, id_repuesto, Number(cantidad_solicitada), prioridad, motivo || null, String(solicitado_por).trim()]);
    res.status(201).json({ id: Number(result.insertId), numero, mensaje: "Solicitud registrada para aprobación." });
  } catch (error) { console.error(error); res.status(500).json({ error: "No fue posible registrar la solicitud." }); }
  finally { if (conn) conn.release(); }
});

router.patch("/:id/estado", async (req, res) => {
  const { estado, usuario, observacion_decision = null } = req.body;
  if (!estados.includes(estado)) return res.status(400).json({ error: "Estado no válido." });
  let conn;
  try {
    conn = await pool.getConnection(); await conn.beginTransaction();
    const rows = await conn.query("SELECT * FROM solicitudes_repuestos WHERE id=? FOR UPDATE", [req.params.id]);
    if (!rows[0]) throw new Error("Solicitud no encontrada.");
    const current = rows[0];
    if (estado === "Entregada" && current.estado !== "Aprobada") throw new Error("Solo las solicitudes aprobadas pueden entregarse.");
    if (estado === "Rechazada" && !String(observacion_decision || "").trim()) throw new Error("Registra el motivo del rechazo.");
    if (estado === "Entregada") {
      const stock = await conn.query("SELECT stock_actual,stock_verificado FROM repuestos WHERE id=? FOR UPDATE", [current.id_repuesto]);
      if (!stock[0]?.stock_verificado) throw new Error("El stock físico del repuesto debe verificarse antes de entregar.");
      if (Number(stock[0].stock_actual) < Number(current.cantidad_solicitada)) throw new Error("Stock insuficiente para entregar esta solicitud.");
      await conn.query("UPDATE repuestos SET stock_actual=stock_actual-?,fecha_ultima_solicitud=CURDATE() WHERE id=?", [current.cantidad_solicitada, current.id_repuesto]);
      await conn.query("INSERT INTO movimientos_repuestos (id_repuesto,id_area,id_maquina,numero_vale,fecha_movimiento,cantidad,estado,autorizado_por,observaciones) VALUES (?,?,?,?,CURDATE(),?,'Salida',?,?)", [current.id_repuesto, current.id_area, current.id_maquina, current.numero, current.cantidad_solicitada, usuario || null, `Entrega por solicitud ${current.numero}`]);
    }
    const fields = estado === "Aprobada" ? "estado=?, aprobado_por=?, fecha_aprobacion=NOW(), observacion_decision=?" : estado === "Entregada" ? "estado=?, entregado_por=?, fecha_entrega=NOW(), observacion_decision=?" : "estado=?, observacion_decision=?";
    const params = estado === "Aprobada" || estado === "Entregada" ? [estado, usuario || null, observacion_decision, req.params.id] : [estado, observacion_decision, req.params.id];
    await conn.query(`UPDATE solicitudes_repuestos SET ${fields} WHERE id=?`, params);
    await conn.commit(); res.json({ mensaje: `Solicitud ${estado.toLowerCase()}.` });
  } catch (error) { if (conn) await conn.rollback(); res.status(422).json({ error: error.message || "No fue posible actualizar la solicitud." }); }
  finally { if (conn) conn.release(); }
});

module.exports = router;
