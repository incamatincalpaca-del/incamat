const express = require("express");
const XLSX = require("xlsx");
const pool = require("../../config/database");
const { hashPassword } = require("../utils/passwords");
const { authenticate, requireRole } = require("../utils/auth");

const router = express.Router();
const roles = ["Administrador", "Supervisor", "Tecnico", "Técnico", "Ingeniero", "Operario"];
const validPassword = (value) => typeof value === "string" && value.length >= 12 && /[a-z]/.test(value) && /[A-Z]/.test(value) && /\d/.test(value) && /[^A-Za-z0-9]/.test(value);

router.get("/mis-asignaciones", authenticate, requireRole("Ingeniero", "Tecnico", "T\u00e9cnico"), async (req, res) => {
  let conn;
  try {
    conn = await pool.getConnection();
    const rows = await conn.query(`SELECT t.id,t.codigo,t.tarea,t.prioridad,t.fecha_asignacion,t.fecha_limite,t.estado,t.observaciones,t.asignado_por,a.nombre AS area
      FROM tareas_asignadas t LEFT JOIN areas a ON a.id=t.id_area WHERE t.id_usuario=?
      ORDER BY FIELD(t.estado,'Asignada','En progreso','Completada','Cancelada'), t.fecha_limite IS NULL, t.fecha_limite, t.creado_en DESC`, [req.user.id]);
    res.json(rows.map((row) => ({ ...row, id: Number(row.id) })));
  } catch (_error) { res.status(500).json({ error: "No fue posible cargar tus tareas." }); }
  finally { if (conn) conn.release(); }
});
router.patch("/mis-asignaciones/:id", authenticate, requireRole("Ingeniero", "Tecnico", "T\u00e9cnico"), async (req, res) => {
  const { estado } = req.body;
  const states = ["Asignada", "En progreso", "Completada"];
  if (!states.includes(estado)) return res.status(400).json({ error: "El estado no es v\u00e1lido." });
  let conn;
  try {
    conn = await pool.getConnection();
    const result = await conn.query("UPDATE tareas_asignadas SET estado=? WHERE id=? AND id_usuario=?", [estado, req.params.id, req.user.id]);
    if (!result.affectedRows) return res.status(404).json({ error: "Tarea no encontrada." });
    res.json({ mensaje: "Avance actualizado." });
  } catch (_error) { res.status(500).json({ error: "No fue posible actualizar la tarea." }); }
  finally { if (conn) conn.release(); }
});
router.use(authenticate, requireRole("Administrador"));
router.get("/plantilla/asignaciones.xlsx", (_req, res) => {
  const workbook = XLSX.utils.book_new();
  const sheet = XLSX.utils.json_to_sheet([{
    Codigo_Tarea: "TAR-ING-0001",
    Codigo_Usuario: "jramirez",
    Usuario: "Juan Ramirez",
    Cargo: "Ingeniero",
    Area: "ACABADO TELAS",
    Tarea: "Revisar plan preventivo de la semana",
    Prioridad: "Alta",
    Fecha_Asignacion: "2026-08-17",
    Fecha_Limite: "2026-08-20",
    Estado: "Asignada",
    Observaciones: "Coordinar con el supervisor del area"
  }]);
  sheet["!cols"] = [14, 18, 28, 16, 24, 46, 14, 18, 16, 18, 42].map((wch) => ({ wch }));
  XLSX.utils.book_append_sheet(workbook, sheet, "Asignacion_Tareas");
  const buffer = XLSX.write(workbook, { type: "buffer", bookType: "xlsx" });
  res.setHeader("Content-Disposition", "attachment; filename=plantilla-asignacion-tareas.xlsx");
  res.type("application/vnd.openxmlformats-officedocument.spreadsheetml.sheet").send(buffer);
});
router.get("/asignaciones", async (_req, res) => {
  let conn;
  try {
    conn = await pool.getConnection();
    const rows = await conn.query(`SELECT t.id,t.codigo,t.tarea,t.prioridad,t.fecha_asignacion,t.fecha_limite,t.estado,t.observaciones,t.asignado_por,
      u.id AS id_usuario,u.nombre AS usuario,u.usuario AS codigo_usuario,u.rol AS cargo,a.id AS id_area,a.nombre AS area
      FROM tareas_asignadas t JOIN usuarios u ON u.id=t.id_usuario LEFT JOIN areas a ON a.id=t.id_area
      ORDER BY FIELD(t.estado,'Asignada','En progreso','Completada','Cancelada'), t.fecha_limite IS NULL, t.fecha_limite, t.creado_en DESC`);
    res.json(rows.map((row) => ({ ...row, id: Number(row.id), id_usuario: Number(row.id_usuario), id_area: row.id_area ? Number(row.id_area) : null })));
  } catch (_error) { res.status(500).json({ error: "No fue posible cargar las tareas asignadas." }); }
  finally { if (conn) conn.release(); }
});
router.post("/asignaciones", async (req, res) => {
  const { codigo, id_usuario, id_area = null, tarea, prioridad = "Media", fecha_asignacion, fecha_limite = null, estado = "Asignada", observaciones = null } = req.body;
  const priorities = ["Baja", "Media", "Alta", "Critica"];
  const states = ["Asignada", "En progreso", "Completada", "Cancelada"];
  if (!codigo || !id_usuario || !tarea || !fecha_asignacion) return res.status(400).json({ error: "Código, responsable, tarea y fecha de asignación son obligatorios." });
  if (!priorities.includes(prioridad) || !states.includes(estado)) return res.status(400).json({ error: "La prioridad o el estado no son válidos." });
  let conn;
  try {
    conn = await pool.getConnection();
    const result = await conn.query("INSERT INTO tareas_asignadas (codigo,id_usuario,id_area,tarea,prioridad,fecha_asignacion,fecha_limite,estado,observaciones,asignado_por) VALUES (?,?,?,?,?,?,?,?,?,?)", [String(codigo).trim().toUpperCase(), Number(id_usuario), Number(id_area) || null, String(tarea).trim(), prioridad, fecha_asignacion, fecha_limite || null, estado, observaciones?.trim() || null, req.user.nombre || req.user.usuario || "Administrador"]);
    res.status(201).json({ id: Number(result.insertId), mensaje: "Tarea asignada correctamente." });
  } catch (error) { res.status(error.code === "ER_DUP_ENTRY" ? 409 : 500).json({ error: error.code === "ER_DUP_ENTRY" ? "Ese código de tarea ya existe." : "No fue posible asignar la tarea." }); }
  finally { if (conn) conn.release(); }
});
router.patch("/asignaciones/:id", async (req, res) => {
  const { estado, observaciones = null, fecha_limite = null } = req.body;
  const states = ["Asignada", "En progreso", "Completada", "Cancelada"];
  if (!states.includes(estado)) return res.status(400).json({ error: "El estado no es válido." });
  let conn;
  try {
    conn = await pool.getConnection();
    const result = await conn.query("UPDATE tareas_asignadas SET estado=?, observaciones=?, fecha_limite=? WHERE id=?", [estado, observaciones?.trim() || null, fecha_limite || null, req.params.id]);
    if (!result.affectedRows) return res.status(404).json({ error: "Tarea no encontrada." });
    res.json({ mensaje: "Tarea actualizada." });
  } catch (_error) { res.status(500).json({ error: "No fue posible actualizar la tarea." }); }
  finally { if (conn) conn.release(); }
});
router.get("/", async (_req, res) => { let conn; try { conn = await pool.getConnection(); const rows = await conn.query("SELECT u.id,u.nombre,u.usuario,u.correo,u.rol,u.id_area,a.nombre AS area,u.estado,u.creado FROM usuarios u LEFT JOIN areas a ON a.id=u.id_area ORDER BY u.nombre"); res.json(rows.map((row) => ({ ...row, id_area: row.id_area ? Number(row.id_area) : null, estado: Boolean(row.estado) }))); } catch (_error) { res.status(500).json({ error: "No fue posible obtener los usuarios." }); } finally { if (conn) conn.release(); } });
router.post("/", async (req, res) => {
  const { nombre, usuario, correo = null, password, rol, id_area = null } = req.body;
  if (!nombre || !usuario || !password || !rol) return res.status(400).json({ error: "Nombre, usuario, contraseña y rol son obligatorios." });
  if (!roles.includes(rol)) return res.status(400).json({ error: "El rol seleccionado no es válido." });
  if (!validPassword(password)) return res.status(400).json({ error: "La contraseña debe tener al menos 12 caracteres, mayúscula, minúscula, número y símbolo." });
  let conn; try { conn = await pool.getConnection(); const result = await conn.query("INSERT INTO usuarios (nombre,usuario,correo,password,password_hash,rol,id_area,estado) VALUES (?, ?, ?, NULL, ?, ?, ?, TRUE)", [nombre.trim(), usuario.trim().toLowerCase(), correo?.trim() || null, await hashPassword(password), rol, Number(id_area) || null]); res.status(201).json({ id: Number(result.insertId), mensaje: "Usuario creado correctamente." }); } catch (error) { res.status(error.code === "ER_DUP_ENTRY" ? 409 : 500).json({ error: error.code === "ER_DUP_ENTRY" ? "Ese usuario ya existe." : "No fue posible crear el usuario." }); } finally { if (conn) conn.release(); }
});
router.patch("/:id", async (req, res) => {
  const { nombre, correo = null, password = "", rol, estado, id_area = null } = req.body;
  if (!nombre || !roles.includes(rol)) return res.status(400).json({ error: "Completa un nombre y un rol válido." });
  if (Number(req.params.id) === Number(req.user.id) && (!estado || rol !== "Administrador")) return res.status(400).json({ error: "No puedes desactivar tu propia cuenta ni quitarte el rol de administrador." });
  if (password && !validPassword(password)) return res.status(400).json({ error: "La contraseña debe tener al menos 12 caracteres, mayúscula, minúscula, número y símbolo." });
  const fields = ["nombre=?", "correo=?", "rol=?", "id_area=?", "estado=?"]; const values = [nombre.trim(), correo?.trim() || null, rol, Number(id_area) || null, estado ? 1 : 0];
  if (password) { fields.push("password=NULL", "password_hash=?"); values.push(await hashPassword(password)); }
  values.push(req.params.id); let conn; try { conn = await pool.getConnection(); const result = await conn.query(`UPDATE usuarios SET ${fields.join(", ")} WHERE id=?`, values); if (!result.affectedRows) return res.status(404).json({ error: "Usuario no encontrado." }); res.json({ mensaje: "Usuario actualizado." }); } catch (_error) { res.status(500).json({ error: "No fue posible actualizar el usuario." }); } finally { if (conn) conn.release(); }
});

module.exports = router;
