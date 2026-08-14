const express = require("express");
const multer = require("multer");
const path = require("path");
const pool = require("../../config/database");

const router = express.Router();
const storage = multer.diskStorage({
  destination: path.join(__dirname, "../../uploads"),
  filename: (_req, file, cb) => cb(null, `falla-${Date.now()}${path.extname(file.originalname).toLowerCase()}`),
});
const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => cb(null, /^image\/(jpeg|png|webp)$/.test(file.mimetype)),
});
const details = "SELECT f.*,m.nombre AS maquina,a.nombre AS area FROM fallas f JOIN maquinas m ON m.id=f.id_maquina JOIN areas a ON a.id=m.id_area";

router.get("/", async (_req, res) => {
  let conn;
  try { conn = await pool.getConnection(); res.json(await conn.query(`${details} ORDER BY FIELD(f.estado,'Reportada','En atencion','Resuelta'),f.fecha_ocurrencia DESC`)); }
  catch (_error) { res.status(500).json({ error: "No fue posible obtener incidencias." }); }
  finally { if (conn) conn.release(); }
});

router.get("/pendientes", async (_req, res) => {
  let conn;
  try { conn = await pool.getConnection(); res.json(await conn.query(`${details} WHERE f.estado IN ('Reportada','En atencion','Esperando repuesto','Pendiente de validacion') ORDER BY FIELD(f.prioridad,'Critica','Alta','Media','Baja'),f.fecha_ocurrencia ASC`)); }
  catch (_error) { res.status(500).json({ error: "No fue posible obtener órdenes." }); }
  finally { if (conn) conn.release(); }
});

router.post("/", upload.single("evidencia"), async (req, res) => {
  const { id_maquina, prioridad = "Media", descripcion, reportado_por = null, fecha_ocurrencia = null } = req.body;
  if (!id_maquina || !descripcion) return res.status(400).json({ error: "Máquina y descripción son obligatorias." });
  let conn;
  try {
    conn = await pool.getConnection();
    const pic = req.file ? `/uploads/${req.file.filename}` : null;
    const result = await conn.query("INSERT INTO fallas (id_maquina,prioridad,descripcion,evidencia_url,reportado_por,fecha_ocurrencia) VALUES (?,?,?,?,?,COALESCE(?,NOW()))", [id_maquina, prioridad, descripcion, pic, reportado_por, fecha_ocurrencia || null]);
    await conn.query("UPDATE maquinas SET estado='Detenida' WHERE id=?", [id_maquina]);
    res.status(201).json({ id: Number(result.insertId), mensaje: "Incidencia enviada a Mantenimiento." });
  } catch (error) { console.error(error); res.status(500).json({ error: "No fue posible reportar la incidencia." }); }
  finally { if (conn) conn.release(); }
});

router.patch("/:id/iniciar", async (req, res) => {
  const { atendido_por } = req.body;
  if (!String(atendido_por || "").trim()) return res.status(400).json({ error: "Indica el técnico responsable." });
  let conn;
  try {
    conn = await pool.getConnection();
    const rows = await conn.query("SELECT id_maquina FROM fallas WHERE id=?", [req.params.id]);
    if (!rows[0]) return res.status(404).json({ error: "Incidencia no encontrada." });
    await conn.query("UPDATE fallas SET estado='En atencion',atendido_por=?,fecha_atencion=NOW() WHERE id=?", [atendido_por.trim(), req.params.id]);
    await conn.query("UPDATE maquinas SET estado='Detenida' WHERE id=?", [rows[0].id_maquina]);
    res.json({ mensaje: "Hora de inicio registrada." });
  } catch (_error) { res.status(500).json({ error: "No fue posible iniciar la orden." }); }
  finally { if (conn) conn.release(); }
});

router.patch("/:id/cerrar", upload.single("evidencia_final"), async (req, res) => {
  const { diagnostico, causa_tipo, trabajo_realizado, prueba_final = "Probada y operativa", repuestos = "[]" } = req.body;
  if (!String(diagnostico || "").trim() || !String(trabajo_realizado || "").trim()) return res.status(400).json({ error: "Diagnóstico y trabajo realizado son obligatorios." });
  let conn;
  try {
    const used = JSON.parse(repuestos); conn = await pool.getConnection(); await conn.beginTransaction();
    const fault = (await conn.query("SELECT * FROM fallas WHERE id=? FOR UPDATE", [req.params.id]))[0];
    if (!fault) throw Error("Incidencia no encontrada.");
    for (const item of used) {
      if (!item.id_repuesto || !Number(item.cantidad)) continue;
      const spare = (await conn.query("SELECT * FROM repuestos WHERE id=? FOR UPDATE", [item.id_repuesto]))[0];
      if (!spare?.stock_verificado) throw Error(`Verifica el stock de ${spare?.descripcion || "repuesto"}.`);
      if (Number(spare.stock_actual) < Number(item.cantidad)) throw Error(`Stock insuficiente de ${spare.descripcion}.`);
      await conn.query("INSERT INTO movimientos_repuestos (id_repuesto,id_maquina,numero_vale,fecha_movimiento,cantidad,estado,autorizado_por,observaciones) VALUES (?,?,?,CURDATE(),?,'Salida',?,?)", [spare.id, fault.id_maquina, `FAL-${fault.id}-${Date.now().toString().slice(-6)}`, Number(item.cantidad), fault.atendido_por, `Usado en incidencia #${fault.id}`]);
      await conn.query("UPDATE repuestos SET stock_actual=stock_actual-?,fecha_ultima_solicitud=CURDATE() WHERE id=?", [Number(item.cantidad), spare.id]);
    }
    const finalPic = req.file ? `/uploads/${req.file.filename}` : null;
    const estado = prueba_final === "Probada y operativa" ? "Resuelta" : "Pendiente de validacion";
    await conn.query("UPDATE fallas SET estado=?,diagnostico=?,causa_tipo=?,trabajo_realizado=?,evidencia_final_url=COALESCE(?,evidencia_final_url),observacion_decision=?,fecha_resolucion=IF(?='Resuelta',NOW(),NULL) WHERE id=?", [estado, diagnostico, causa_tipo || null, trabajo_realizado, finalPic, prueba_final, estado, fault.id]);
    await conn.query("UPDATE maquinas SET estado=? WHERE id=?", [estado === "Resuelta" ? "Operativa" : "Mantenimiento", fault.id_maquina]);
    await conn.commit(); res.json({ mensaje: estado === "Resuelta" ? "Orden cerrada y máquina operativa." : "Orden pendiente de validación." });
  } catch (error) { if (conn) await conn.rollback(); res.status(422).json({ error: error.message || "No fue posible cerrar la orden." }); }
  finally { if (conn) conn.release(); }
});

router.patch("/:id/estado-operativo", async (req, res) => {
  const { estado } = req.body;
  if (!["Esperando repuesto", "Pendiente de validacion", "Resuelta"].includes(estado)) return res.status(400).json({ error: "Estado no válido." });
  let conn;
  try {
    conn = await pool.getConnection(); const row = (await conn.query("SELECT id_maquina FROM fallas WHERE id=?", [req.params.id]))[0];
    if (!row) return res.status(404).json({ error: "Orden no encontrada." });
    await conn.query("UPDATE fallas SET estado=?,fecha_resolucion=IF(?='Resuelta',NOW(),fecha_resolucion) WHERE id=?", [estado, estado, req.params.id]);
    await conn.query("UPDATE maquinas SET estado=? WHERE id=?", [estado === "Resuelta" ? "Operativa" : "Mantenimiento", row.id_maquina]);
    res.json({ mensaje: "Estado actualizado." });
  } catch (_error) { res.status(500).json({ error: "No fue posible actualizar la orden." }); }
  finally { if (conn) conn.release(); }
});

module.exports = router;
