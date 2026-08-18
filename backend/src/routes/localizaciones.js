const express = require("express");
const pool = require("../../config/database");
const router = express.Router();

router.get("/", async (req, res) => {
  let conn;
  try {
    conn = await pool.getConnection();
    const rows = await conn.query(`SELECT l.id, l.nombre, l.nivel, l.id_padre, l.ruta, l.orden, CAST(COUNT(m.id) AS UNSIGNED) AS maquinas FROM localizaciones l LEFT JOIN maquinas m ON m.id_localizacion = l.id GROUP BY l.id, l.nombre, l.nivel, l.id_padre, l.ruta, l.orden ORDER BY l.nivel, l.orden, l.nombre`);
    res.json(rows.map((item) => ({ ...item, maquinas: Number(item.maquinas) })));
  } catch (error) { console.error(error); res.status(500).json({ error: "No fue posible obtener las localizaciones." }); }
  finally { if (conn) conn.release(); }
});

router.get("/:id/maquinas", async (req, res) => {
  let conn;
  try {
    conn = await pool.getConnection();
    const includeChildren = req.query.incluirDescendientes === "1";
    let rows;
    if (includeChildren) {
      const locations = await conn.query("SELECT ruta FROM localizaciones WHERE id = ?", [req.params.id]);
      if (!locations[0]) return res.status(404).json({ error: "Ubicación no encontrada." });
      rows = await conn.query("SELECT m.id, m.codigo, m.nombre, m.marca, m.modelo, m.estado, l.nombre AS ubicacion FROM maquinas m JOIN localizaciones l ON l.id = m.id_localizacion WHERE l.ruta = ? OR l.ruta LIKE ? ORDER BY l.nombre, m.nombre", [locations[0].ruta, `${locations[0].ruta} > %`]);
    } else {
      rows = await conn.query("SELECT m.id, m.codigo, m.nombre, m.marca, m.modelo, m.estado, l.nombre AS ubicacion FROM maquinas m JOIN localizaciones l ON l.id = m.id_localizacion WHERE m.id_localizacion = ? ORDER BY m.nombre", [req.params.id]);
    }
    res.json(rows);
  } catch (error) { res.status(500).json({ error: "No fue posible obtener las máquinas." }); }
  finally { if (conn) conn.release(); }
});
module.exports = router;
