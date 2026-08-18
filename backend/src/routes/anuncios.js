const express = require("express");
const pool = require("../../config/database");
const { authenticate, requireRole } = require("../utils/auth");

const router = express.Router();
const validDestinations = ["Todos", "Operario", "Tecnico", "Técnico"];
const validPriorities = ["Informativo", "Importante", "Urgente"];
const normalizeRole = (role) => role === "Técnico" ? "Tecnico" : role;

router.use(authenticate);

router.get("/", async (req, res) => {
  let conn;
  try {
    conn = await pool.getConnection();
    const role = normalizeRole(req.user.rol);
    const isAdmin = role === "Administrador";
    const rows = await conn.query(isAdmin
      ? `SELECT n.*, a.nombre AS area FROM anuncios n LEFT JOIN areas a ON a.id=n.id_area ORDER BY FIELD(n.estado,'Publicado','Borrador','Archivado'), FIELD(n.prioridad,'Urgente','Importante','Informativo'), n.publicado_en DESC`
      : `SELECT n.*, a.nombre AS area FROM anuncios n LEFT JOIN areas a ON a.id=n.id_area INNER JOIN usuarios u ON u.id=? WHERE n.estado='Publicado' AND (n.fecha_fin IS NULL OR n.fecha_fin >= CURDATE()) AND (n.destino='Todos' OR n.destino=?) AND (n.id_area IS NULL OR n.id_area=u.id_area) ORDER BY FIELD(n.prioridad,'Urgente','Importante','Informativo'), n.publicado_en DESC`, isAdmin ? [] : [req.user.id, role]);
    res.json(rows.map((row) => ({ ...row, id: Number(row.id), id_area: row.id_area ? Number(row.id_area) : null })));
  } catch (error) { console.error(error); res.status(500).json({ error: "No fue posible cargar los anuncios." }); }
  finally { if (conn) conn.release(); }
});

router.post("/", requireRole("Administrador"), async (req, res) => {
  const { titulo, mensaje, destino = "Todos", id_area = null, prioridad = "Informativo", fecha_fin = null, estado = "Publicado" } = req.body;
  if (!titulo?.trim() || !mensaje?.trim()) return res.status(400).json({ error: "El título y el mensaje son obligatorios." });
  if (!validDestinations.includes(destino) || !validPriorities.includes(prioridad) || !["Publicado", "Borrador"].includes(estado)) return res.status(400).json({ error: "La configuración del anuncio no es válida." });
  let conn;
  try {
    conn = await pool.getConnection();
    const userRows = await conn.query("SELECT nombre FROM usuarios WHERE id=?", [req.user.id]);
    const result = await conn.query("INSERT INTO anuncios (titulo,mensaje,destino,id_area,prioridad,publicado_por,fecha_fin,estado) VALUES (?, ?, ?, ?, ?, ?, ?, ?)", [titulo.trim(), mensaje.trim(), destino, id_area || null, prioridad, userRows[0]?.nombre || "Administrador", fecha_fin || null, estado]);
    res.status(201).json({ id: Number(result.insertId), mensaje: estado === "Borrador" ? "Borrador guardado." : "Anuncio publicado correctamente." });
  } catch (error) { console.error(error); res.status(500).json({ error: "No fue posible publicar el anuncio." }); }
  finally { if (conn) conn.release(); }
});

router.patch("/:id", requireRole("Administrador"), async (req, res) => {
  const { estado } = req.body;
  if (!["Publicado", "Borrador", "Archivado"].includes(estado)) return res.status(400).json({ error: "Estado no válido." });
  let conn;
  try { conn = await pool.getConnection(); const result = await conn.query("UPDATE anuncios SET estado=? WHERE id=?", [estado, req.params.id]); if (!result.affectedRows) return res.status(404).json({ error: "Anuncio no encontrado." }); res.json({ mensaje: `Anuncio ${estado.toLowerCase()}.` }); }
  catch (_error) { res.status(500).json({ error: "No fue posible actualizar el anuncio." }); }
  finally { if (conn) conn.release(); }
});

router.delete("/:id", requireRole("Administrador"), async (req, res) => {
  let conn;
  try { conn = await pool.getConnection(); const result = await conn.query("DELETE FROM anuncios WHERE id=?", [req.params.id]); if (!result.affectedRows) return res.status(404).json({ error: "Anuncio no encontrado." }); res.json({ mensaje: "Anuncio eliminado." }); }
  catch (_error) { res.status(500).json({ error: "No fue posible eliminar el anuncio." }); }
  finally { if (conn) conn.release(); }
});

module.exports = router;
