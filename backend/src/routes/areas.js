const express = require("express");
const pool = require("../../config/database");
const router = express.Router();

router.get("/", async (req, res) => {
  let conn;
  try {
    conn = await pool.getConnection();
    const rows = await conn.query(`SELECT a.id, a.codigo, a.nombre, a.descripcion, a.responsable, a.estado, CAST(COUNT(m.id) AS UNSIGNED) AS maquinas FROM areas a LEFT JOIN maquinas m ON m.id_area = a.id GROUP BY a.id, a.codigo, a.nombre, a.descripcion, a.responsable, a.estado ORDER BY a.nombre`);
    res.json(rows.map((area) => ({ ...area, maquinas: Number(area.maquinas) })));
  } catch (error) { res.status(500).json({ error: "No fue posible obtener las áreas." }); }
  finally { if (conn) conn.release(); }
});

router.get("/:id/maquinas", async (req, res) => {
  let conn;
  try {
    conn = await pool.getConnection();
    const rows = await conn.query("SELECT id, codigo, nombre, marca, modelo, descripcion_corta, estado FROM maquinas WHERE id_area = ? ORDER BY nombre, marca, modelo", [req.params.id]);
    res.json(rows);
  } catch (error) { res.status(500).json({ error: "No fue posible obtener las máquinas del área." }); }
  finally { if (conn) conn.release(); }
});

router.post("/", async (req, res) => {
  const { codigo, nombre, descripcion = null, responsable = null } = req.body;
  if (!codigo || !nombre) return res.status(400).json({ error: "Código y nombre son obligatorios." });
  let conn;
  try {
    conn = await pool.getConnection();
    const result = await conn.query("INSERT INTO areas (codigo, nombre, descripcion, responsable) VALUES (?, ?, ?, ?)", [codigo.trim(), nombre.trim(), descripcion, responsable]);
    res.status(201).json({ id: Number(result.insertId), mensaje: "Área registrada." });
  } catch (error) {
    res.status(error.code === "ER_DUP_ENTRY" ? 409 : 500).json({ error: error.code === "ER_DUP_ENTRY" ? "El código o nombre ya existe." : "No fue posible registrar el área." });
  } finally { if (conn) conn.release(); }
});
module.exports = router;
