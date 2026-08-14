const express = require("express");
const pool = require("../../config/database");
const { hashPassword } = require("../utils/passwords");
const { authenticate, requireRole } = require("../utils/auth");

const router = express.Router();
const roles = ["Administrador", "Supervisor", "Tecnico", "Técnico", "Ingeniero", "Operario"];

router.use(authenticate, requireRole("Administrador"));

router.get("/", async (_req, res) => {
  let conn;
  try {
    conn = await pool.getConnection();
    const rows = await conn.query("SELECT id, nombre, usuario, correo, rol, estado, creado FROM usuarios ORDER BY nombre");
    res.json(rows.map((row) => ({ ...row, estado: Boolean(row.estado) })));
  } catch (error) {
    res.status(500).json({ error: "No fue posible obtener los usuarios." });
  } finally { if (conn) conn.release(); }
});

router.post("/", async (req, res) => {
  const { nombre, usuario, correo = null, password, rol } = req.body;
  if (!nombre || !usuario || !password || !rol) return res.status(400).json({ error: "Nombre, usuario, contraseña y rol son obligatorios." });
  if (!roles.includes(rol)) return res.status(400).json({ error: "El rol seleccionado no es válido." });
  let conn;
  try {
    conn = await pool.getConnection();
    const passwordHash = await hashPassword(password);
    const result = await conn.query("INSERT INTO usuarios (nombre, usuario, correo, password, password_hash, rol, estado) VALUES (?, ?, ?, NULL, ?, ?, TRUE)", [nombre.trim(), usuario.trim().toLowerCase(), correo?.trim() || null, passwordHash, rol]);
    res.status(201).json({ id: Number(result.insertId), mensaje: "Usuario creado correctamente." });
  } catch (error) {
    res.status(error.code === "ER_DUP_ENTRY" ? 409 : 500).json({ error: error.code === "ER_DUP_ENTRY" ? "Ese usuario ya existe." : "No fue posible crear el usuario." });
  } finally { if (conn) conn.release(); }
});

router.patch("/:id", async (req, res) => {
  const { nombre, correo = null, password = "", rol, estado } = req.body;
  if (!nombre || !rol || !roles.includes(rol)) return res.status(400).json({ error: "Completa un nombre y un rol válido." });
  if (Number(req.params.id) === Number(req.user.id) && (!estado || rol !== "Administrador")) {
    return res.status(400).json({ error: "No puedes desactivar tu propia cuenta ni quitarte el rol de administrador." });
  }
  const fields = ["nombre = ?", "correo = ?", "rol = ?", "estado = ?"];
  const values = [nombre.trim(), correo?.trim() || null, rol, estado ? 1 : 0];
  if (password) { fields.push("password = NULL", "password_hash = ?"); values.push(await hashPassword(password)); }
  values.push(req.params.id);
  let conn;
  try {
    conn = await pool.getConnection();
    const result = await conn.query(`UPDATE usuarios SET ${fields.join(", ")} WHERE id = ?`, values);
    if (!result.affectedRows) return res.status(404).json({ error: "Usuario no encontrado." });
    res.json({ mensaje: "Usuario actualizado." });
  } catch (_error) {
    res.status(500).json({ error: "No fue posible actualizar el usuario." });
  } finally { if (conn) conn.release(); }
});

module.exports = router;
