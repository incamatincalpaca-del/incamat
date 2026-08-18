const express = require("express");
const pool = require("../../config/database");
const router = express.Router();

router.get("/", async (req, res) => {
  let conn;
  try {
    conn = await pool.getConnection();
    const rows = await conn.query(`SELECT c.*, a.nombre AS area, m.nombre AS maquina, (c.stock_actual <= c.stock_minimo) AS stock_bajo FROM componentes c JOIN areas a ON a.id = c.id_area LEFT JOIN maquinas m ON m.id = c.id_maquina ORDER BY c.descripcion`);
    res.json(rows);
  } catch (error) { res.status(500).json({ error: "No fue posible obtener los componentes." }); }
  finally { if (conn) conn.release(); }
});

router.post("/", async (req, res) => {
  const { codigo, descripcion, tipo, id_area, id_maquina = null, criticidad = "Media", stock_actual = 0, stock_minimo = 0, unidad_medida = "unidad", frecuencia_solicitud = "Según falla", fecha_ultima_solicitud = null, tiempo_reposicion_dias = null, ubicacion_almacen = null } = req.body;
  if (!codigo || !descripcion || !tipo || !id_area) return res.status(400).json({ error: "Código, descripción, tipo y área son obligatorios." });
  let conn;
  try {
    conn = await pool.getConnection();
    const result = await conn.query(`INSERT INTO componentes (codigo, descripcion, tipo, id_area, id_maquina, criticidad, stock_actual, stock_minimo, unidad_medida, frecuencia_solicitud, fecha_ultima_solicitud, tiempo_reposicion_dias, ubicacion_almacen) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`, [codigo.trim(), descripcion.trim(), tipo, id_area, id_maquina || null, criticidad, stock_actual, stock_minimo, unidad_medida, frecuencia_solicitud, fecha_ultima_solicitud || null, tiempo_reposicion_dias || null, ubicacion_almacen || null]);
    res.status(201).json({ id: Number(result.insertId), mensaje: "Componente registrado." });
  } catch (error) {
    res.status(error.code === "ER_DUP_ENTRY" ? 409 : 500).json({ error: error.code === "ER_DUP_ENTRY" ? "El código de componente ya existe." : "No fue posible registrar el componente." });
  } finally { if (conn) conn.release(); }
});
module.exports = router;
