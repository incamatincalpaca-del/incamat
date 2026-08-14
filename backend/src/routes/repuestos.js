const express = require("express");
const pool = require("../../config/database");
const router = express.Router();

router.get("/", async (req, res) => {
  let conn;
  try {
    conn = await pool.getConnection();
    const rows = await conn.query(`SELECT r.*, CAST(COUNT(DISTINCT m.id) AS UNSIGNED) AS solicitudes, COALESCE((SELECT SUM(m2.cantidad) FROM movimientos_repuestos m2 WHERE m2.id_repuesto = r.id), 0) AS cantidad_solicitada, GROUP_CONCAT(DISTINCT a.nombre ORDER BY a.nombre SEPARATOR ' · ') AS areas_uso, MAX(ra.ultima_solicitud) AS ultima_solicitud_historica, COALESCE(SUM(ra.movimientos_historicos), 0) AS solicitudes_historicas, COALESCE(SUM(ra.costo_acumulado), 0) AS costo_historico FROM repuestos r LEFT JOIN movimientos_repuestos m ON m.id_repuesto = r.id LEFT JOIN repuesto_areas ra ON ra.id_repuesto = r.id LEFT JOIN areas a ON a.id = ra.id_area GROUP BY r.id, r.codigo, r.descripcion, r.unidad_medida, r.criticidad, r.impacto_produccion, r.tiempo_reposicion_nivel, r.disponibilidad_alternativa, r.impacto_economico, r.puntaje_criticidad, r.criticidad_validada_por, r.criticidad_validada_en, r.stock_actual, r.stock_minimo, r.stock_verificado, r.stock_verificado_por, r.stock_verificado_en, r.familia_tecnica, r.subfamilia_tecnica, r.estado_clasificacion, r.frecuencia_solicitud, r.fecha_ultima_solicitud, r.tiempo_reposicion_dias, r.ubicacion_almacen, r.costo_ultimo, r.creado_en, r.actualizado_en ORDER BY r.descripcion`);
    res.json(rows.map((item) => ({ ...item, solicitudes: Number(item.solicitudes), cantidad_solicitada: Number(item.cantidad_solicitada) })));
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "No fue posible obtener los repuestos." });
  } finally { if (conn) conn.release(); }
});

router.patch("/:id/clasificacion", async (req, res) => {
  const { familia_tecnica, subfamilia_tecnica = "", estado_clasificacion = "Validada" } = req.body;
  const families = ["Mecanico", "Electrico", "Electronico", "Consumible", "Sin clasificar"];
  const states = ["Pendiente", "Sugerida", "Validada"];
  if (!families.includes(familia_tecnica) || !states.includes(estado_clasificacion)) return res.status(400).json({ error: "Familia o estado de clasificación no válido." });
  let conn;
  try {
    conn = await pool.getConnection();
    const result = await conn.query("UPDATE repuestos SET familia_tecnica = ?, subfamilia_tecnica = ?, estado_clasificacion = ? WHERE id = ?", [familia_tecnica, String(subfamilia_tecnica || "").trim() || null, estado_clasificacion, req.params.id]);
    if (!result.affectedRows) return res.status(404).json({ error: "Repuesto no encontrado." });
    res.json({ mensaje: "Clasificación técnica actualizada." });
  } catch (error) { res.status(500).json({ error: "No fue posible actualizar la clasificación." }); }
  finally { if (conn) conn.release(); }
});

router.patch("/:id/criticidad", async (req, res) => {
  const { impacto_produccion, tiempo_reposicion_nivel, disponibilidad_alternativa, impacto_economico, usuario } = req.body;
  const values = [impacto_produccion, tiempo_reposicion_nivel, disponibilidad_alternativa, impacto_economico].map(Number);
  if (!values.every((value) => Number.isInteger(value) && value >= 1 && value <= 5)) return res.status(400).json({ error: "Cada criterio debe evaluarse de 1 a 5." });
  const score = values.reduce((total, value) => total + value, 0);
  const criticidad = score >= 17 ? "Crítica" : score >= 13 ? "Alta" : score >= 9 ? "Media" : "Baja";
  let conn;
  try {
    conn = await pool.getConnection();
    const result = await conn.query("UPDATE repuestos SET impacto_produccion=?, tiempo_reposicion_nivel=?, disponibilidad_alternativa=?, impacto_economico=?, puntaje_criticidad=?, criticidad=?, criticidad_validada_por=?, criticidad_validada_en=NOW() WHERE id=?", [...values, score, criticidad, String(usuario || "Técnico responsable").trim(), req.params.id]);
    if (!result.affectedRows) return res.status(404).json({ error: "Repuesto no encontrado." });
    res.json({ mensaje: "Criticidad evaluada.", criticidad, puntaje: score });
  } catch (error) { res.status(500).json({ error: "No fue posible guardar la criticidad." }); }
  finally { if (conn) conn.release(); }
});

router.patch("/:id/stock-verificado", async (req, res) => {
  const { stock_actual, stock_minimo, ubicacion_almacen, usuario } = req.body;
  if (!Number.isFinite(Number(stock_actual)) || Number(stock_actual) < 0 || !Number.isFinite(Number(stock_minimo)) || Number(stock_minimo) < 0 || !String(ubicacion_almacen || "").trim() || !String(usuario || "").trim()) return res.status(400).json({ error: "Indica stock actual, mínimo, ubicación y responsable." });
  let conn;
  try {
    conn = await pool.getConnection(); await conn.beginTransaction();
    const part = (await conn.query("SELECT stock_actual FROM repuestos WHERE id=? FOR UPDATE", [req.params.id]))[0];
    if (!part) throw Error("Repuesto no encontrado.");
    const delta = Number(stock_actual) - Number(part.stock_actual || 0);
    await conn.query("UPDATE repuestos SET stock_actual=?, stock_minimo=?, ubicacion_almacen=?, stock_verificado=TRUE, stock_verificado_por=?, stock_verificado_en=NOW() WHERE id=?", [Number(stock_actual), Number(stock_minimo), String(ubicacion_almacen).trim(), String(usuario).trim(), req.params.id]);
    if (delta !== 0) await conn.query("INSERT INTO movimientos_repuestos (id_repuesto,numero_vale,fecha_movimiento,cantidad,estado,autorizado_por,observaciones) VALUES (?, ?, CURDATE(), ?, 'Ajuste', ?, ?)", [req.params.id, `INV-${new Date().toISOString().slice(0,10).replace(/-/g,"")}-${req.params.id}`, delta, String(usuario).trim(), "Verificación física de inventario"]);
    await conn.commit(); res.json({ mensaje: "Inventario físico verificado.", ajuste: delta });
  } catch (error) { if (conn) await conn.rollback(); res.status(422).json({ error: error.message || "No fue posible verificar el stock." }); }
  finally { if (conn) conn.release(); }
});

router.get("/movimientos", async (_req, res) => {
  let conn;
  try {
    conn = await pool.getConnection();
    const rows = await conn.query(`SELECT m.*, r.codigo, r.descripcion, a.nombre AS area, mq.nombre AS maquina
      FROM movimientos_repuestos m
      JOIN repuestos r ON r.id = m.id_repuesto
      LEFT JOIN areas a ON a.id = m.id_area
      LEFT JOIN maquinas mq ON mq.id = m.id_maquina
      ORDER BY m.creado_en DESC, m.id DESC LIMIT 100`);
    res.json(rows);
  } catch (error) { res.status(500).json({ error: "No fue posible obtener el historial de movimientos." }); }
  finally { if (conn) conn.release(); }
});

router.post("/movimientos", async (req, res) => {
  const { id_repuesto, tipo, cantidad, stock_resultante, id_area = null, id_maquina = null, usuario, observaciones = "" } = req.body;
  if (!id_repuesto || !["Entrada", "Salida", "Ajuste"].includes(tipo) || !String(usuario || "").trim()) return res.status(400).json({ error: "Repuesto, tipo de movimiento y responsable son obligatorios." });
  if (tipo === "Ajuste" ? stock_resultante === "" || stock_resultante == null || Number(stock_resultante) < 0 : !Number(cantidad) || Number(cantidad) <= 0) return res.status(400).json({ error: tipo === "Ajuste" ? "Indica el stock físico resultante." : "Indica una cantidad válida." });
  if (tipo === "Salida" && !id_area) return res.status(400).json({ error: "Selecciona el área que recibe el repuesto." });
  let conn;
  try {
    conn = await pool.getConnection(); await conn.beginTransaction();
    const part = (await conn.query("SELECT * FROM repuestos WHERE id = ? FOR UPDATE", [id_repuesto]))[0];
    if (!part) throw Error("Repuesto no encontrado.");
    if (tipo === "Salida" && !part.stock_verificado) throw Error("Primero verifica el stock físico antes de registrar una salida.");
    const current = Number(part.stock_actual);
    const delta = tipo === "Entrada" ? Number(cantidad) : tipo === "Salida" ? -Number(cantidad) : Number(stock_resultante) - current;
    const next = current + delta;
    if (next < 0) throw Error("El movimiento dejaría el stock en negativo.");
    const vale = `${tipo.slice(0, 3).toUpperCase()}-${new Date().toISOString().slice(0, 10).replace(/-/g, "")}-${id_repuesto}-${Date.now().toString().slice(-5)}`;
    await conn.query("INSERT INTO movimientos_repuestos (id_repuesto,id_area,id_maquina,numero_vale,fecha_movimiento,cantidad,estado,autorizado_por,observaciones) VALUES (?,?,?, ?,CURDATE(),?,?,?,?)", [id_repuesto, id_area || null, id_maquina || null, vale, delta, tipo, String(usuario).trim(), String(observaciones || "").trim()]);
    await conn.query("UPDATE repuestos SET stock_actual = ?, stock_verificado = IF(? = 'Ajuste', TRUE, stock_verificado), fecha_ultima_solicitud = IF(? = 'Salida', CURDATE(), fecha_ultima_solicitud) WHERE id = ?", [next, tipo, tipo, id_repuesto]);
    await conn.commit(); res.status(201).json({ mensaje: "Movimiento registrado.", numero_vale: vale, stock_actual: next });
  } catch (error) { if (conn) await conn.rollback(); res.status(422).json({ error: error.message || "No fue posible registrar el movimiento." }); }
  finally { if (conn) conn.release(); }
});

router.post("/", async (req, res) => {
  const {
    codigo,
    descripcion,
    unidad_medida = "unidad",
    criticidad = "Sin evaluar",
    stock_actual = 0,
    stock_minimo = 0,
    stock_verificado = false,
    frecuencia_solicitud = "Según falla",
    fecha_ultima_solicitud = null,
    tiempo_reposicion_dias = null,
    ubicacion_almacen = null,
    costo_ultimo = null,
  } = req.body;

  if (!String(codigo || "").trim() || !String(descripcion || "").trim()) {
    return res.status(400).json({ error: "El código y la descripción son obligatorios." });
  }

  let conn;
  try {
    conn = await pool.getConnection();
    const result = await conn.query(
      `INSERT INTO repuestos
        (codigo, descripcion, unidad_medida, criticidad, stock_actual, stock_minimo, stock_verificado,
         frecuencia_solicitud, fecha_ultima_solicitud, tiempo_reposicion_dias, ubicacion_almacen, costo_ultimo)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        String(codigo).trim(), String(descripcion).trim(), unidad_medida || "unidad", criticidad || "Sin evaluar",
        Number(stock_actual || 0), Number(stock_minimo || 0), Boolean(stock_verificado),
        frecuencia_solicitud || "Según falla", fecha_ultima_solicitud || null,
        tiempo_reposicion_dias === "" || tiempo_reposicion_dias == null ? null : Number(tiempo_reposicion_dias),
        ubicacion_almacen || null, costo_ultimo === "" || costo_ultimo == null ? null : Number(costo_ultimo),
      ],
    );
    res.status(201).json({ id: Number(result.insertId), mensaje: "Repuesto registrado." });
  } catch (error) {
    if (error.code === "ER_DUP_ENTRY") return res.status(409).json({ error: "Ya existe un repuesto con ese código." });
    console.error(error);
    res.status(500).json({ error: "No fue posible registrar el repuesto." });
  } finally { if (conn) conn.release(); }
});

router.post("/salidas", async (req, res) => {
  const { id_repuesto, cantidad, id_maquina, id_mantenimiento = null, observaciones = null, usuario = null } = req.body;
  if (!id_repuesto || !id_maquina || !Number(cantidad) || Number(cantidad) <= 0) return res.status(400).json({ error: "Repuesto, máquina y cantidad válida son obligatorios." });
  let conn;
  try {
    conn = await pool.getConnection(); await conn.beginTransaction();
    const repuestos = await conn.query("SELECT * FROM repuestos WHERE id=? FOR UPDATE", [id_repuesto]);
    if (!repuestos[0]) throw new Error("Repuesto no encontrado.");
    const repuesto = repuestos[0];
    if (!repuesto.stock_verificado) return res.status(422).json({ error: "Verifica el stock físico antes de registrar salidas." });
    if (Number(repuesto.stock_actual) < Number(cantidad)) return res.status(422).json({ error: "Stock insuficiente para esta salida." });
    const vale = `SAL-${new Date().toISOString().slice(0, 10).replace(/-/g, "")}-${id_repuesto}-${Date.now().toString().slice(-5)}`;
    await conn.query("INSERT INTO movimientos_repuestos (id_repuesto,id_maquina,id_mantenimiento,numero_vale,fecha_movimiento,cantidad,estado,autorizado_por,observaciones) VALUES (?,?,?,?,CURDATE(),?,'Salida',?,?)", [id_repuesto,id_maquina,id_mantenimiento||null,vale,Number(cantidad),usuario,observaciones]);
    await conn.query("UPDATE repuestos SET stock_actual=stock_actual-?, fecha_ultima_solicitud=CURDATE() WHERE id=?", [Number(cantidad),id_repuesto]);
    await conn.commit(); res.status(201).json({ mensaje:"Salida registrada.", numero_vale:vale });
  } catch (error) { if (conn) await conn.rollback(); res.status(error.message ? 422 : 500).json({ error: error.message || "No fue posible registrar la salida." }); }
  finally { if (conn) conn.release(); }
});

module.exports = router;
