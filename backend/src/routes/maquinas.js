const express = require("express");
const QRCode = require("qrcode");
const pool = require("../../config/database");
const router = express.Router();

router.get("/", async (req, res) => {
  let conn;
  try {
    conn = await pool.getConnection();
    const rows = await conn.query(`SELECT m.id, m.codigo, m.nombre, m.marca, m.modelo, m.descripcion_corta, m.estado, m.id_area, a.nombre AS area,
      (SELECT f.estado FROM fallas f WHERE f.id_maquina=m.id AND f.estado <> 'Resuelta' ORDER BY f.fecha_reporte DESC LIMIT 1) AS estado_falla,
      (SELECT f.descripcion FROM fallas f WHERE f.id_maquina=m.id AND f.estado <> 'Resuelta' ORDER BY f.fecha_reporte DESC LIMIT 1) AS motivo_parada
      FROM maquinas m JOIN areas a ON a.id = m.id_area ORDER BY a.nombre, m.nombre`);
    res.json(rows);
  } catch (error) { res.status(500).json({ error: "No fue posible obtener las máquinas." }); }
  finally { if (conn) conn.release(); }
});

router.get("/paradas/resumen", async (_req, res) => {
  let conn;
  try {
    conn = await pool.getConnection();
    const rows = await conn.query(`SELECT a.nombre AS area, COUNT(m.id) AS paradas,
      SUM(m.estado='Detenida') AS detenidas, SUM(m.estado='Mantenimiento') AS en_mantenimiento,
      COALESCE(SUM(f.espera_repuesto), 0) AS espera_repuesto,
      COALESCE(SUM(f.pendiente_atencion), 0) AS pendiente_atencion
      FROM maquinas m JOIN areas a ON a.id=m.id_area
      LEFT JOIN (SELECT id_maquina,
        MAX(estado='Esperando repuesto') AS espera_repuesto,
        MAX(estado IN ('Reportada','En atencion','Pendiente de validacion')) AS pendiente_atencion
        FROM fallas WHERE estado <> 'Resuelta' GROUP BY id_maquina) f ON f.id_maquina=m.id
      WHERE m.estado IN ('Detenida','Mantenimiento')
      GROUP BY a.id,a.nombre ORDER BY paradas DESC,a.nombre`);
    const totals = rows.reduce((acc, row) => ({ paradas: acc.paradas + Number(row.paradas || 0), espera_repuesto: acc.espera_repuesto + Number(row.espera_repuesto || 0), pendiente_atencion: acc.pendiente_atencion + Number(row.pendiente_atencion || 0), en_mantenimiento: acc.en_mantenimiento + Number(row.en_mantenimiento || 0) }), { paradas: 0, espera_repuesto: 0, pendiente_atencion: 0, en_mantenimiento: 0 });
    res.json({ totals, areas: rows.map((row) => Object.fromEntries(Object.entries(row).map(([key, value]) => [key, typeof value === "string" ? value : Number(value || 0)]))) });
  } catch (error) { res.status(500).json({ error: "No fue posible calcular las paradas por área." }); }
  finally { if (conn) conn.release(); }
});

router.post("/", async (req, res) => {
  const { codigo, nombre, id_area, marca = null, modelo = null, descripcion_corta = null, estado = "Operativa" } = req.body;
  if (!codigo || !nombre || !id_area) return res.status(400).json({ error: "Código, nombre y área son obligatorios." });
  let conn;
  try {
    conn = await pool.getConnection();
    const result = await conn.query("INSERT INTO maquinas (codigo, nombre, id_area, marca, modelo, descripcion_corta, estado) VALUES (?, ?, ?, ?, ?, ?, ?)", [codigo.trim(), nombre.trim(), id_area, marca || null, modelo || null, descripcion_corta || null, estado]);
    res.status(201).json({ id: Number(result.insertId), mensaje: "Máquina registrada." });
  } catch (error) {
    const status = error.code === "ER_DUP_ENTRY" ? 409 : 500;
    res.status(status).json({ error: status === 409 ? "El código de máquina ya existe." : "No fue posible registrar la máquina." });
  } finally { if (conn) conn.release(); }
});

router.get("/por-qr/:token", async (req, res) => {
  let conn;
  try { conn = await pool.getConnection(); const rows = await conn.query("SELECT m.id,m.codigo,m.nombre,m.estado,a.nombre AS area FROM maquinas m JOIN areas a ON a.id=m.id_area WHERE m.qr_token=? OR m.codigo=?", [req.params.token, req.params.token]); if (!rows[0]) return res.status(404).json({ error: "Código QR no reconocido." }); res.json(rows[0]); }
  catch (error) { res.status(500).json({ error: "No fue posible identificar la máquina." }); }
  finally { if (conn) conn.release(); }
});

router.get("/:id/qr", async (req, res) => {
  let conn;
  try {
    conn = await pool.getConnection();
    const rows = await conn.query("SELECT id, codigo, qr_token FROM maquinas WHERE id=?", [req.params.id]);
    if (!rows[0]) return res.status(404).json({ error: "Máquina no encontrada." });
    const machine = rows[0];
    const value = `http://localhost:5173/reportar/${encodeURIComponent(machine.qr_token || machine.codigo)}`;
    const image = await QRCode.toDataURL(value, { width: 360, margin: 2, errorCorrectionLevel: "M" });
    res.json({ valor: value, imagen: image, token: machine.qr_token || machine.codigo });
  } catch (error) { console.error(error); res.status(500).json({ error: "No fue posible generar el QR." }); }
  finally { if (conn) conn.release(); }
});

router.get("/:id/qr.png", async (req, res) => {
  let conn;
  try {
    conn = await pool.getConnection();
    const rows = await conn.query("SELECT codigo, qr_token FROM maquinas WHERE id=?", [req.params.id]);
    if (!rows[0]) return res.status(404).end();
    const machine = rows[0];
    const value = `http://localhost:5173/reportar/${encodeURIComponent(machine.qr_token || machine.codigo)}`;
    const image = await QRCode.toBuffer(value, { type: "png", width: 360, margin: 2, errorCorrectionLevel: "M" });
    res.type("png").send(image);
  } catch (error) { res.status(500).end(); }
  finally { if (conn) conn.release(); }
});

router.get("/:id/historial", async (req, res) => {
  let conn;
  try {
    conn = await pool.getConnection();
    const [mantenimientos, fallas, repuestos] = await Promise.all([
      conn.query("SELECT id,tipo,estado,fecha_programada,fecha_realizacion,responsable,descripcion FROM mantenimientos WHERE id_maquina=? ORDER BY fecha_programada DESC LIMIT 20", [req.params.id]),
      conn.query("SELECT id,prioridad,estado,descripcion,fecha_reporte,fecha_resolucion FROM fallas WHERE id_maquina=? ORDER BY fecha_reporte DESC LIMIT 20", [req.params.id]),
      conn.query("SELECT r.codigo,r.descripcion,m.cantidad,m.fecha_movimiento,m.numero_vale FROM movimientos_repuestos m JOIN repuestos r ON r.id=m.id_repuesto WHERE m.id_maquina=? ORDER BY m.fecha_movimiento DESC LIMIT 20", [req.params.id]),
    ]);
    res.json({ mantenimientos, fallas, repuestos });
  } catch (error) { res.status(500).json({ error: "No fue posible obtener el historial." }); }
  finally { if (conn) conn.release(); }
});

module.exports = router;
