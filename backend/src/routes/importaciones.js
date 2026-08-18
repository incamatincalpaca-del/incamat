const express = require("express");
const multer = require("multer");
const XLSX = require("xlsx");
const fs = require("fs/promises");
const path = require("path");
const pool = require("../../config/database");

const router = express.Router();
const upload = multer({ dest: path.join(__dirname, "../../uploads") });

const schemas = {
  Areas: { required: ["codigo", "nombre"], allowed: ["codigo", "nombre", "descripcion", "responsable"] },
  Maquinas: { required: ["codigo", "nombre", "area"], allowed: ["codigo", "nombre", "area", "marca", "modelo", "estado"] },
  Repuestos: { required: ["codigo", "descripcion"], allowed: ["codigo", "descripcion", "criticidad", "stock_actual", "stock_minimo", "unidad_medida", "frecuencia_solicitud", "fecha_ultima_solicitud", "tiempo_reposicion_dias", "ubicacion_almacen", "costo_ultimo"] },
  MantenimientoSRequest: { required: ["solicitud", "fecha_y_hora", "descripcion_de_la_solicitud", "estado"], allowed: ["solicitud", "urgente", "fecha_y_hora", "foto", "descripcion_de_la_solicitud", "area", "empresa", "departamento", "usuario_que_solicita", "estado", "fecha_y_hora_de_inicio", "fecha_y_hora_de_termino", "informacion_qr_del_equipo"] },
  MantenimientoHistorico: { required: ["id_registro", "maquina", "fecha", "tipo_mantenimiento"], allowed: ["id_registro", "id_maquina", "maquina", "fecha", "tecnicos", "tipo_mantenimiento", "ot", "codigo_mantenimiento", "duracion", "detalles_de_intervencion", "repuestos_materiales", "foto_evidencia", "revisado"] },
};

router.get("/plantilla/:modulo", async (req, res) => {
  if (req.params.modulo === "MantenimientoHistorico") {
    const workbook = XLSX.utils.book_new();
    const sheet = XLSX.utils.json_to_sheet([{ ID_Registro: "HIST-0001", ID_Maquina: "MAQ-0001", Maquina: "NOMBRE DE MAQUINA", Fecha: "2026-08-13", "Técnicos": "NOMBRE DEL TÉCNICO", Tipo_Mantenimiento: "Correctivo", OT: "OT-0001", "Código_Mantenimiento": "COD-MANT-001", "Duración": "02:30", "Detalles de intervención": "Descripción breve de la intervención", "Repuestos/Materiales": "CÓDIGO REPUESTO x 1", Foto_evidencia: "ruta o referencia de foto", Revisado: "Supervisor" }]);
    XLSX.utils.book_append_sheet(workbook, sheet, "Historial_Mantenimiento");
    const buffer = XLSX.write(workbook, { type: "buffer", bookType: "xlsx" });
    res.setHeader("Content-Disposition", "attachment; filename=plantilla-Historial-Mantenimientos.xlsx");
    return res.type("application/vnd.openxmlformats-officedocument.spreadsheetml.sheet").send(buffer);
  }
  const schema = schemas[req.params.modulo];
  if (!schema) return res.status(404).json({ error: "Módulo no válido." });
  const example = req.params.modulo === "MantenimientoSRequest" ? { Solicitud: "2101", Urgente: "No", "Fecha y hora": "12/08/2026 08:30:00", Foto: "No", "Descripción de la solicitud": "Describa el problema", AREA: "ACABADO TELAS", Departamento: "MANTTO. MECANICO - NOMBRE", "Usuario que solicita": "NOMBRE USUARIO", Estado: "SOLICITUD REPORTADA", "Fecha y hora de inicio": "", "Fecha y hora de término": "", "Información QR del equipo": "No" } : req.params.modulo === "Maquinas" ? { codigo: "MAQ-0001", nombre: "NOMBRE DE MAQUINA", area: "AREA OFICIAL", marca: "MARCA", modelo: "MODELO", estado: "Operativa" } : req.params.modulo === "Repuestos" ? { codigo: "REP-0001", descripcion: "DESCRIPCION DEL REPUESTO", criticidad: "Media", stock_actual: 0, stock_minimo: 0, unidad_medida: "unidad", ubicacion_almacen: "ALMACEN" } : { codigo: "AREA-001", nombre: "NOMBRE DEL AREA" };
  const workbook = XLSX.utils.book_new(); const sheet = XLSX.utils.json_to_sheet([example]); XLSX.utils.book_append_sheet(workbook, sheet, req.params.modulo);
  const buffer = XLSX.write(workbook, { type: "buffer", bookType: "xlsx" });
  res.setHeader("Content-Disposition", `attachment; filename=plantilla-${req.params.modulo}.xlsx`); res.type("application/vnd.openxmlformats-officedocument.spreadsheetml.sheet").send(buffer);
});

function normalize(value) {
  return String(value ?? "").trim().toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[\s-]+/g, "_");
}

function getRows(filePath) {
  const workbook = XLSX.readFile(filePath);
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  return XLSX.utils.sheet_to_json(sheet, { defval: "" }).map((row) => Object.fromEntries(Object.entries(row).map(([key, value]) => [normalize(key), value])));
}

function validateRows(module, rows) {
  const schema = schemas[module];
  if (!schema) return { errors: [{ fila: 0, error: "Módulo no válido." }], valid: [] };
  const valid = [];
  const errors = [];
  rows.forEach((row, index) => {
    const missing = schema.required.filter((field) => !String(row[field] ?? "").trim());
    if (missing.length) errors.push({ fila: index + 2, error: `Faltan columnas o valores: ${missing.join(", ")}` });
    else valid.push(row);
  });
  return { valid, errors };
}

function withUploadedFile(handler) {
  return async (req, res) => {
    if (!req.file) return res.status(400).json({ error: "Selecciona un archivo Excel." });
    try { await handler(req, res); }
    catch (error) { console.error("Error de importación:", error); res.status(500).json({ error: "No fue posible procesar el archivo." }); }
    finally { await fs.unlink(req.file.path).catch(() => undefined); }
  };
}

router.post("/preview", upload.single("archivo"), withUploadedFile(async (req, res) => {
  const module = req.body.modulo;
  const rows = getRows(req.file.path);
  const result = validateRows(module, rows);
  res.json({ modulo: module, nombreArchivo: req.file.originalname, total: rows.length, validos: result.valid.length, errores: result.errors, columnas: rows[0] ? Object.keys(rows[0]) : [], muestra: result.valid.slice(0, 20) });
}));

async function findId(conn, table, value) {
  if (!value) return null;
  const rows = await conn.query(`SELECT id FROM ${table} WHERE nombre = ? OR codigo = ? LIMIT 1`, [String(value).trim(), String(value).trim()]);
  return rows[0]?.id ?? null;
}

async function upsertArea(conn, row) {
  const exists = await conn.query("SELECT id FROM areas WHERE codigo = ?", [row.codigo]);
  await conn.query("INSERT INTO areas (codigo, nombre, descripcion, responsable) VALUES (?, ?, ?, ?) ON DUPLICATE KEY UPDATE nombre = VALUES(nombre), descripcion = VALUES(descripcion), responsable = VALUES(responsable)", [row.codigo, row.nombre, row.descripcion || null, row.responsable || null]);
  return exists.length ? "actualizado" : "creado";
}

async function upsertMachine(conn, row) {
  const areaId = await findId(conn, "areas", row.area);
  if (!areaId) throw new Error(`El área '${row.area}' no existe.`);
  const exists = await conn.query("SELECT id FROM maquinas WHERE codigo = ?", [row.codigo]);
  await conn.query("INSERT INTO maquinas (codigo, nombre, id_area, marca, modelo, estado) VALUES (?, ?, ?, ?, ?, ?) ON DUPLICATE KEY UPDATE nombre = VALUES(nombre), id_area = VALUES(id_area), marca = VALUES(marca), modelo = VALUES(modelo), estado = VALUES(estado)", [row.codigo, row.nombre, areaId, row.marca || null, row.modelo || null, row.estado || "Operativa"]);
  return exists.length ? "actualizado" : "creado";
}

async function upsertComponent(conn, row) {
  const areaId = await findId(conn, "areas", row.area);
  if (!areaId) throw new Error(`El área '${row.area}' no existe.`);
  const machineId = row.maquina ? await findId(conn, "maquinas", row.maquina) : null;
  if (row.maquina && !machineId) throw new Error(`La máquina '${row.maquina}' no existe.`);
  const exists = await conn.query("SELECT id FROM componentes WHERE codigo = ?", [row.codigo]);
  await conn.query(`INSERT INTO componentes (codigo, descripcion, tipo, id_area, id_maquina, criticidad, stock_actual, stock_minimo, unidad_medida, frecuencia_solicitud, fecha_ultima_solicitud, tiempo_reposicion_dias, ubicacion_almacen) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?) ON DUPLICATE KEY UPDATE descripcion = VALUES(descripcion), tipo = VALUES(tipo), id_area = VALUES(id_area), id_maquina = VALUES(id_maquina), criticidad = VALUES(criticidad), stock_actual = VALUES(stock_actual), stock_minimo = VALUES(stock_minimo), unidad_medida = VALUES(unidad_medida), frecuencia_solicitud = VALUES(frecuencia_solicitud), fecha_ultima_solicitud = VALUES(fecha_ultima_solicitud), tiempo_reposicion_dias = VALUES(tiempo_reposicion_dias), ubicacion_almacen = VALUES(ubicacion_almacen)`, [row.codigo, row.descripcion, row.tipo, areaId, machineId, row.criticidad || "Media", Number(row.stock_actual || 0), Number(row.stock_minimo || 0), row.unidad_medida || "unidad", row.frecuencia_solicitud || "Según falla", row.fecha_ultima_solicitud || null, row.tiempo_reposicion_dias ? Number(row.tiempo_reposicion_dias) : null, row.ubicacion_almacen || null]);
  return exists.length ? "actualizado" : "creado";
}

async function upsertSpare(conn, row) {
  const exists = await conn.query("SELECT id FROM repuestos WHERE codigo = ?", [row.codigo]);
  await conn.query(`INSERT INTO repuestos (codigo, descripcion, unidad_medida, criticidad, stock_actual, stock_minimo, frecuencia_solicitud, fecha_ultima_solicitud, tiempo_reposicion_dias, ubicacion_almacen, costo_ultimo)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON DUPLICATE KEY UPDATE descripcion = VALUES(descripcion), unidad_medida = VALUES(unidad_medida), criticidad = VALUES(criticidad), stock_actual = VALUES(stock_actual), stock_minimo = VALUES(stock_minimo), frecuencia_solicitud = VALUES(frecuencia_solicitud), fecha_ultima_solicitud = VALUES(fecha_ultima_solicitud), tiempo_reposicion_dias = VALUES(tiempo_reposicion_dias), ubicacion_almacen = VALUES(ubicacion_almacen), costo_ultimo = VALUES(costo_ultimo)`,
    [row.codigo, row.descripcion, row.unidad_medida || "unidad", row.criticidad || "Sin evaluar", Number(row.stock_actual || 0), Number(row.stock_minimo || 0), row.frecuencia_solicitud || "Según falla", row.fecha_ultima_solicitud || null, row.tiempo_reposicion_dias ? Number(row.tiempo_reposicion_dias) : null, row.ubicacion_almacen || null, row.costo_ultimo ? Number(row.costo_ultimo) : null]);
  return exists.length ? "actualizado" : "creado";
}

function asBoolean(value) {
  return ["si", "sí", "yes", "true", "1"].includes(String(value ?? "").trim().toLowerCase());
}

function asDateTime(value) {
  if (!value) return null;
  if (value instanceof Date && !Number.isNaN(value.getTime())) return value;
  if (typeof value === "number") {
    const parsed = XLSX.SSF.parse_date_code(value);
    if (parsed) return new Date(parsed.y, parsed.m - 1, parsed.d, parsed.H || 0, parsed.M || 0, parsed.S || 0);
  }
  const text = String(value).trim();
  const match = text.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})(?:\s+(\d{1,2}):(\d{2})(?::(\d{2}))?)?$/);
  if (match) {
    const year = Number(match[3].length === 2 ? `20${match[3]}` : match[3]);
    return new Date(year, Number(match[2]) - 1, Number(match[1]), Number(match[4] || 0), Number(match[5] || 0), Number(match[6] || 0));
  }
  const parsed = new Date(text);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

const officialAreaMap = {
  "acabado telas": "Acabado de Telas", "acabado de telas": "Acabado de Telas",
  "calidad": "Calidad", "ctp": "CTP", "estampados": "ESTAMPADOS",
  "hilanderia": "HILANDERÍA", "hilandería": "HILANDERÍA", "mantenimiento": "MANTENIMIENTO",
  "pre almacen": "PRE ALMACEN", "pre almacén": "PRE ALMACEN",
  "tejido plano": "TEJIDO PLANO", "tejido punto": "TEJIDO PUNTO",
  "tintoreria": "TINTORERÍA", "tintorería": "TINTORERÍA", "zurcido": "ZURCIDO",
  "almacenes": "Almacenes", "confeccion prendas": "CONFECCION PRENDAS", "confección prendas": "CONFECCION PRENDAS"
};

async function resolveExternalArea(conn, value) {
  const raw = String(value ?? "").trim();
  if (!raw) return { id: null, name: null };
  const canonical = officialAreaMap[normalize(raw).replaceAll("_", " ")] || raw;
  const rows = await conn.query("SELECT id, nombre FROM areas WHERE LOWER(nombre) = LOWER(?) OR LOWER(codigo) = LOWER(?) LIMIT 1", [canonical, canonical]);
  return rows[0] ? { id: rows[0].id, name: rows[0].nombre } : { id: null, name: canonical };
}

async function upsertSRequest(conn, row, importId = null) {
  const areaSource = row.area || row.empresa;
  const area = await resolveExternalArea(conn, areaSource);
  const exists = await conn.query("SELECT id FROM solicitudes_externas WHERE numero_solicitud = ?", [String(row.solicitud).trim()]);
  await conn.query(`INSERT INTO solicitudes_externas
    (numero_solicitud, urgente, fecha_reporte, tiene_foto, descripcion, empresa_origen, departamento_origen, usuario_solicitante, estado_origen, fecha_inicio, fecha_termino, tiene_qr, id_area, ruta_localizacion, estado_incamat, id_importacion)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON DUPLICATE KEY UPDATE urgente=VALUES(urgente), fecha_reporte=VALUES(fecha_reporte), tiene_foto=VALUES(tiene_foto), descripcion=VALUES(descripcion), empresa_origen=VALUES(empresa_origen), departamento_origen=VALUES(departamento_origen), usuario_solicitante=VALUES(usuario_solicitante), estado_origen=VALUES(estado_origen), fecha_inicio=VALUES(fecha_inicio), fecha_termino=VALUES(fecha_termino), tiene_qr=VALUES(tiene_qr), id_area=VALUES(id_area), ruta_localizacion=VALUES(ruta_localizacion), id_importacion=VALUES(id_importacion), actualizado_en=NOW()`,
    [String(row.solicitud).trim(), asBoolean(row.urgente), asDateTime(row.fecha_y_hora), asBoolean(row.foto), String(row.descripcion_de_la_solicitud).trim(), areaSource || null, row.departamento || null, row.usuario_que_solicita || null, row.estado || null, asDateTime(row.fecha_y_hora_de_inicio), asDateTime(row.fecha_y_hora_de_termino), asBoolean(row.informacion_qr_del_equipo), area.id, area.name ? `PLANTA INCALPACA AREQUIPA > ${area.name}` : null, "Reportada", importId]);
  return exists.length ? "actualizado" : "creado";
}

async function findMachineForHistory(conn, code, name) {
  if (code) {
    const byCode = await conn.query("SELECT id FROM maquinas WHERE codigo = ? LIMIT 1", [String(code).trim()]);
    if (byCode[0]) return byCode[0].id;
  }
  const byName = await conn.query("SELECT id FROM maquinas WHERE UPPER(TRIM(nombre)) = UPPER(TRIM(?)) LIMIT 1", [String(name).trim()]);
  return byName[0]?.id || null;
}

async function upsertMaintenanceHistory(conn, row, importId = null) {
  const existing = await conn.query("SELECT id FROM historial_mantenimiento_excel WHERE id_registro = ?", [String(row.id_registro).trim()]);
  const machineId = await findMachineForHistory(conn, row.id_maquina, row.maquina);
  const parsedDate = asDateTime(row.fecha);
  if (!parsedDate) throw new Error("La fecha del historial no es válida.");
  const date = `${parsedDate.getFullYear()}-${String(parsedDate.getMonth() + 1).padStart(2, "0")}-${String(parsedDate.getDate()).padStart(2, "0")}`;
  await conn.query(`INSERT INTO historial_mantenimiento_excel
    (id_registro, id_maquina, codigo_maquina_origen, maquina_origen, fecha, tecnicos, tipo_original, ot, codigo_mantenimiento, duracion_original, detalles, repuestos_materiales, foto_evidencia, revisado, id_importacion)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON DUPLICATE KEY UPDATE id_maquina=VALUES(id_maquina), codigo_maquina_origen=VALUES(codigo_maquina_origen), maquina_origen=VALUES(maquina_origen), fecha=VALUES(fecha), tecnicos=VALUES(tecnicos), tipo_original=VALUES(tipo_original), ot=VALUES(ot), codigo_mantenimiento=VALUES(codigo_mantenimiento), duracion_original=VALUES(duracion_original), detalles=VALUES(detalles), repuestos_materiales=VALUES(repuestos_materiales), foto_evidencia=VALUES(foto_evidencia), revisado=VALUES(revisado), id_importacion=VALUES(id_importacion), actualizado_en=NOW()`,
    [String(row.id_registro).trim(), machineId, row.id_maquina || null, String(row.maquina).trim(), date, row.tecnicos || null, row.tipo_mantenimiento || "Otros", row.ot || null, row.codigo_mantenimiento || null, row.duracion || null, row.detalles_de_intervencion || null, row.repuestos_materiales || null, row.foto_evidencia || null, row.revisado || null, importId]);
  return existing.length ? "actualizado" : "creado";
}

router.post("/procesar", upload.single("archivo"), withUploadedFile(async (req, res) => {
  const module = req.body.modulo;
  const rows = getRows(req.file.path);
  const result = validateRows(module, rows);
  if (!schemas[module]) return res.status(400).json({ error: "Módulo no válido." });
  if (result.errors.length) return res.status(422).json({ error: "El archivo contiene filas inválidas.", errores: result.errors });
  let conn;
  try {
    conn = await pool.getConnection();
    await conn.beginTransaction();
    const history = await conn.query("INSERT INTO importaciones (modulo, nombre_archivo, usuario_importador, registros_creados, registros_actualizados, registros_error, estado) VALUES (?, ?, ?, 0, 0, 0, ?)", [module, req.file.originalname, req.body.usuario || null, "Procesado"]);
    const importId = history.insertId;
    let created = 0; let updated = 0;
    for (const row of result.valid) {
      const status = module === "Areas" ? await upsertArea(conn, row) : module === "Maquinas" ? await upsertMachine(conn, row) : module === "MantenimientoSRequest" ? await upsertSRequest(conn, row, importId) : module === "MantenimientoHistorico" ? await upsertMaintenanceHistory(conn, row, importId) : await upsertSpare(conn, row);
      if (status === "creado") created += 1; else updated += 1;
    }
    await conn.query("UPDATE importaciones SET registros_creados = ?, registros_actualizados = ?, registros_error = 0, estado = 'Procesado' WHERE id = ?", [created, updated, importId]);
    await conn.commit();
    res.json({ mensaje: "Importación procesada.", creados: created, actualizados: updated, errores: 0 });
  } catch (error) {
    if (conn) await conn.rollback();
    throw error;
  } finally { if (conn) conn.release(); }
}));

router.get("/", async (req, res) => {
  let conn;
  try { conn = await pool.getConnection(); res.json(await conn.query("SELECT * FROM importaciones ORDER BY creado_en DESC LIMIT 50")); }
  catch (error) { res.status(500).json({ error: "No fue posible obtener el historial." }); }
  finally { if (conn) conn.release(); }
});

// Borra únicamente el registro del historial. Los datos que el Excel creó o actualizó se conservan.
router.delete("/:id", async (req, res) => {
  let conn;
  try {
    conn = await pool.getConnection();
    const history = await conn.query("SELECT modulo FROM importaciones WHERE id = ?", [req.params.id]);
    if (history[0]?.modulo === "MantenimientoSRequest") await conn.query("DELETE FROM solicitudes_externas WHERE id_importacion = ?", [req.params.id]);
    if (history[0]?.modulo === "MantenimientoHistorico") await conn.query("DELETE FROM historial_mantenimiento_excel WHERE id_importacion = ?", [req.params.id]);
    const result = await conn.query("DELETE FROM importaciones WHERE id = ?", [req.params.id]);
    if (!result.affectedRows) return res.status(404).json({ error: "No se encontró el archivo en el historial." });
    res.json({ mensaje: "Archivo eliminado del historial de importaciones." });
  } catch (error) { res.status(500).json({ error: "No fue posible eliminar el archivo del historial." }); }
  finally { if (conn) conn.release(); }
});

module.exports = router;
