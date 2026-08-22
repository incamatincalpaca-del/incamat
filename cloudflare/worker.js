const json = (body, init = {}) => new Response(JSON.stringify(body), {
  ...init,
  headers: { "content-type": "application/json; charset=utf-8", ...(init.headers || {}) }
});

const readBody = async (request) => {
  try { return await request.json(); } catch { return {}; }
};

const bytesToBase64 = (bytes) => btoa(String.fromCharCode(...new Uint8Array(bytes)));
const base64ToBytes = (value) => Uint8Array.from(atob(value), (char) => char.charCodeAt(0));

const DEFAULT_USERS = [
  { nombre: "Administrador", usuario: "admin", correo: "admin@incamat.local", rol: "Administrador", secret: "INCAMAT_ADMIN_PASSWORD", legacySecret: "INCAMAT_ADMIN_PASS" },
  { nombre: "Ingeniero de mantenimiento", usuario: "ingeniero", correo: "ingeniero@incamat.local", rol: "Ingeniero", secret: "INCAMAT_INGENIERO_PASSWORD", legacySecret: "INCAMAT_INGENIERO_PASS" },
  { nombre: "Técnico de mantenimiento", usuario: "tecnico", correo: "tecnico@incamat.local", rol: "Técnico", secret: "INCAMAT_TECNICO_PASSWORD", legacySecret: "INCAMAT_TECNICO_PASS" },
  { nombre: "Operario de planta", usuario: "operario", correo: "operario@incamat.local", rol: "Operario", secret: "INCAMAT_OPERARIO_PASSWORD", legacySecret: "INCAMAT_OPERARIO_PASS" },
];

async function passwordHash(password, saltText) {
  const salt = new TextEncoder().encode(saltText);
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(password), "PBKDF2", false, ["deriveBits"]);
  // Cloudflare Workers admite hasta 100 000 iteraciones para PBKDF2.
  // Este valor conserva una derivación robusta y permite iniciar sesión
  // desde cualquier navegador, incluido el móvil.
  const iterations = 100000;
  const bits = await crypto.subtle.deriveBits({ name: "PBKDF2", hash: "SHA-256", salt, iterations }, key, 256);
  return `pbkdf2$${iterations}$${bytesToBase64(salt)}$${bytesToBase64(bits)}`;
}

async function verifyPassword(password, stored) {
  // Formato de migración: pbkdf2$iteraciones$saltBase64$hashBase64.
  const [algorithm, iterations, salt, expected] = String(stored || "").split("$");
  if (algorithm !== "pbkdf2" || !iterations || !salt || !expected) return false;
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(password), "PBKDF2", false, ["deriveBits"]);
  const bits = await crypto.subtle.deriveBits({ name: "PBKDF2", hash: "SHA-256", salt: base64ToBytes(salt), iterations: Number(iterations) }, key, 256);
  return bytesToBase64(bits) === expected;
}

const requireDb = (env) => {
  if (!env.DB) throw new Error("La base de datos D1 aún no está vinculada al Worker.");
  return env.DB;
};

const HISTORIC_TYPES = ["correctivo", "preventivo", "rutinario", "limpieza", "proyecto", "mejora", "seguridad", "apoyo", "otros"];
const normalizeHistoricType = (value) => {
  const text = String(value || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
  if (text.includes("correct")) return "correctivo";
  if (text.includes("prevent")) return "preventivo";
  if (text.includes("rutin")) return "rutinario";
  if (text.includes("limp")) return "limpieza";
  if (text.includes("proyect")) return "proyecto";
  if (text.includes("mejor")) return "mejora";
  if (text.includes("segur")) return "seguridad";
  if (text.includes("apoyo")) return "apoyo";
  return "otros";
};

const withUtf8 = (response, request) => {
  const headers = new Headers(response.headers);
  const pathname = new URL(request.url).pathname.toLowerCase();
  const typeByExtension = pathname.endsWith(".js") ? "text/javascript"
    : pathname.endsWith(".css") ? "text/css"
      : pathname.endsWith(".json") ? "application/json"
        : pathname.endsWith(".svg") ? "image/svg+xml"
          : "text/html";
  const contentType = headers.get("content-type") || typeByExtension;
  // La declaración explícita evita que navegadores móviles muestren Ã±, Ã¡ o Ã­.
  if (/^(text\/|application\/(javascript|json))/.test(contentType)) {
    headers.set("content-type", `${contentType.replace(/;\s*charset=[^;]+/i, "")}; charset=utf-8`);
  }
  // Evita que la pantalla de acceso previa quede almacenada después de publicar.
  if (!pathname.startsWith("/assets/")) headers.set("cache-control", "no-store");
  return new Response(response.body, { status: response.status, statusText: response.statusText, headers });
};

// La primera llamada deja la estructura lista en una D1 nueva. Los datos
// operativos se cargan después mediante la migración protegida, sin depender
// de que alguien tenga que crear tablas manualmente desde el panel.
let schemaReady;
async function ensureSchema(db) {
  if (!schemaReady) {
    schemaReady = db.batch([
      db.prepare("CREATE TABLE IF NOT EXISTS usuarios (id INTEGER PRIMARY KEY AUTOINCREMENT, nombre TEXT NOT NULL, usuario TEXT NOT NULL UNIQUE, correo TEXT, rol TEXT NOT NULL, password_hash TEXT NOT NULL, estado INTEGER NOT NULL DEFAULT 1, creado TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP)"),
      db.prepare("CREATE TABLE IF NOT EXISTS areas (id INTEGER PRIMARY KEY AUTOINCREMENT, codigo TEXT NOT NULL UNIQUE, nombre TEXT NOT NULL UNIQUE, descripcion TEXT, responsable TEXT, estado TEXT NOT NULL DEFAULT 'Activa', creado_en TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP)"),
      db.prepare("CREATE TABLE IF NOT EXISTS maquinas (id INTEGER PRIMARY KEY AUTOINCREMENT, codigo TEXT NOT NULL UNIQUE, nombre TEXT NOT NULL, id_area INTEGER NOT NULL, marca TEXT, modelo TEXT, descripcion_corta TEXT, estado TEXT NOT NULL DEFAULT 'Operativa', qr_token TEXT UNIQUE)"),
      db.prepare("CREATE TABLE IF NOT EXISTS repuestos (id INTEGER PRIMARY KEY AUTOINCREMENT, codigo TEXT NOT NULL UNIQUE, descripcion TEXT NOT NULL, familia_tecnica TEXT, criticidad TEXT NOT NULL DEFAULT 'Sin evaluar', stock_actual REAL NOT NULL DEFAULT 0, stock_minimo REAL NOT NULL DEFAULT 0, stock_verificado INTEGER NOT NULL DEFAULT 0, unidad TEXT, ubicacion TEXT, costo_ultimo REAL, fecha_ultima_solicitud TEXT)"),
      db.prepare("CREATE TABLE IF NOT EXISTS repuestos_areas (id_repuesto INTEGER NOT NULL, id_area INTEGER NOT NULL, PRIMARY KEY(id_repuesto,id_area))"),
      db.prepare("CREATE TABLE IF NOT EXISTS fallas (id INTEGER PRIMARY KEY AUTOINCREMENT, id_maquina INTEGER NOT NULL, prioridad TEXT NOT NULL DEFAULT 'Media', descripcion TEXT NOT NULL, estado TEXT NOT NULL DEFAULT 'Reportada', fecha_reporte TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, fecha_resolucion TEXT)"),
      db.prepare("CREATE TABLE IF NOT EXISTS mantenimientos (id INTEGER PRIMARY KEY AUTOINCREMENT, id_maquina INTEGER NOT NULL, id_falla INTEGER, tipo TEXT NOT NULL, modalidad TEXT, estado TEXT NOT NULL DEFAULT 'Programado', fecha_programada TEXT NOT NULL, fecha_realizacion TEXT, responsable TEXT, descripcion TEXT, observacion TEXT, checklist TEXT)"),
      db.prepare("CREATE TABLE IF NOT EXISTS historial_mantenimiento_excel (id INTEGER PRIMARY KEY AUTOINCREMENT, id_registro TEXT NOT NULL UNIQUE, id_maquina INTEGER, codigo_maquina_origen TEXT, maquina_origen TEXT NOT NULL, fecha TEXT NOT NULL, tecnicos TEXT, tipo_original TEXT NOT NULL, ot TEXT, codigo_mantenimiento TEXT, duracion_original TEXT, detalles TEXT, repuestos_materiales TEXT, foto_evidencia TEXT, revisado TEXT, id_importacion INTEGER, creado_en TEXT DEFAULT CURRENT_TIMESTAMP, actualizado_en TEXT)")
    ]);
  }
  await schemaReady;
}

async function ensureDefaultUsers(db, env) {
  for (const item of DEFAULT_USERS) {
    // Las contraseñas viven únicamente en Secrets de Cloudflare y nunca en
    // el código público. Se acepta el nombre anterior *_PASS por compatibilidad.
    const password = String(env[item.secret] || env[item.legacySecret] || "");
    if (!password) continue;
    const hash = await passwordHash(password, `incamat-${item.usuario}-v1`);
    // Estas cuentas se sincronizan con los secretos seguros de Cloudflare.
    await db.prepare(`INSERT INTO usuarios (nombre, usuario, correo, rol, password_hash, estado)
      VALUES (?, ?, ?, ?, ?, 1)
      ON CONFLICT(usuario) DO UPDATE SET
        nombre=excluded.nombre,
        correo=excluded.correo,
        rol=excluded.rol,
        password_hash=excluded.password_hash,
        estado=1`).bind(item.nombre, item.usuario, item.correo, item.rol, hash).run();
  }
}

// Ruta temporal y protegida para copiar los datos operativos desde la base
// local. Solo funciona mientras exista la clave secreta en Cloudflare; no se
// publica ninguna credencial ni se expone en la interfaz de la aplicación.
const migrationAllowed = (request, env) => {
  const key = request.headers.get("x-incamat-migration-key") || "";
  return Boolean(env.INCAMAT_MIGRATION_KEY) && key === env.INCAMAT_MIGRATION_KEY;
};

const migrationStatements = (db, collection, records) => {
  const statements = [];
  for (const row of records) {
    if (collection === "areas") statements.push(db.prepare(`INSERT OR REPLACE INTO areas
      (id,codigo,nombre,descripcion,responsable,estado) VALUES (?,?,?,?,?,?)`).bind(
      row.id, row.codigo, row.nombre, row.descripcion, row.responsable, row.estado));
    if (collection === "maquinas") statements.push(db.prepare(`INSERT OR REPLACE INTO maquinas
      (id,codigo,nombre,id_area,marca,modelo,descripcion_corta,estado,qr_token) VALUES (?,?,?,?,?,?,?,?,?)`).bind(
      row.id, row.codigo, row.nombre, row.id_area, row.marca, row.modelo, row.descripcion_corta, row.estado, row.qr_token));
    if (collection === "repuestos") statements.push(db.prepare(`INSERT OR REPLACE INTO repuestos
      (id,codigo,descripcion,familia_tecnica,criticidad,stock_actual,stock_minimo,stock_verificado,unidad,ubicacion,costo_ultimo,fecha_ultima_solicitud) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)`).bind(
      row.id, row.codigo, row.descripcion, row.familia_tecnica, row.criticidad, row.stock_actual, row.stock_minimo, row.stock_verificado, row.unidad, row.ubicacion, row.costo_ultimo, row.fecha_ultima_solicitud));
    if (collection === "repuestos_areas") statements.push(db.prepare(`INSERT OR REPLACE INTO repuestos_areas
      (id_repuesto,id_area) VALUES (?,?)`).bind(row.id_repuesto, row.id_area));
    if (collection === "fallas") statements.push(db.prepare(`INSERT OR REPLACE INTO fallas
      (id,id_maquina,prioridad,descripcion,estado,fecha_reporte,fecha_resolucion) VALUES (?,?,?,?,?,?,?)`).bind(
      row.id, row.id_maquina, row.prioridad, row.descripcion, row.estado, row.fecha_reporte, row.fecha_resolucion));
    if (collection === "mantenimientos") statements.push(db.prepare(`INSERT OR REPLACE INTO mantenimientos
      (id,id_maquina,id_falla,tipo,modalidad,estado,fecha_programada,fecha_realizacion,responsable,descripcion,observacion,checklist) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)`).bind(
      row.id, row.id_maquina, row.id_falla, row.tipo, row.modalidad, row.estado, row.fecha_programada, row.fecha_realizacion, row.responsable, row.descripcion, row.observacion, row.checklist));
    if (collection === "historial_mantenimiento_excel") statements.push(db.prepare(`INSERT INTO historial_mantenimiento_excel
      (id_registro,id_maquina,codigo_maquina_origen,maquina_origen,fecha,tecnicos,tipo_original,ot,codigo_mantenimiento,duracion_original,detalles,repuestos_materiales,foto_evidencia,revisado,id_importacion,creado_en,actualizado_en)
      VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
      ON CONFLICT(id_registro) DO UPDATE SET
        id_maquina=excluded.id_maquina,codigo_maquina_origen=excluded.codigo_maquina_origen,maquina_origen=excluded.maquina_origen,fecha=excluded.fecha,tecnicos=excluded.tecnicos,tipo_original=excluded.tipo_original,ot=excluded.ot,codigo_mantenimiento=excluded.codigo_mantenimiento,duracion_original=excluded.duracion_original,detalles=excluded.detalles,repuestos_materiales=excluded.repuestos_materiales,foto_evidencia=excluded.foto_evidencia,revisado=excluded.revisado,id_importacion=excluded.id_importacion,actualizado_en=excluded.actualizado_en`).bind(
      row.id_registro, row.id_maquina, row.codigo_maquina_origen, row.maquina_origen, row.fecha, row.tecnicos, row.tipo_original, row.ot, row.codigo_mantenimiento, row.duracion_original, row.detalles, row.repuestos_materiales, row.foto_evidencia, row.revisado, row.id_importacion, row.creado_en, row.actualizado_en));
  }
  return statements;
};

async function api(request, env, url) {
  const db = requireDb(env);
  await ensureSchema(db);
  const path = url.pathname.replace(/^\/api/, "") || "/";

  if (path === "/" && request.method === "GET") return json({ sistema: "INCAMAT", estado: "Online", baseDatos: "D1" });

  if (path === "/migracion-inicial" && request.method === "POST") {
    if (!migrationAllowed(request, env)) return json({ error: "No autorizado para la migración inicial." }, { status: 403 });
    const { collection, records } = await readBody(request);
    const allowed = new Set(["areas", "maquinas", "repuestos", "repuestos_areas", "fallas", "mantenimientos", "historial_mantenimiento_excel"]);
    if (!allowed.has(collection) || !Array.isArray(records) || records.length === 0 || records.length > 100) {
      return json({ error: "Lote de migración no válido." }, { status: 400 });
    }
    await db.batch(migrationStatements(db, collection, records));
    return json({ success: true, collection, registros: records.length });
  }

  if (path === "/areas" && request.method === "GET") {
    const result = await db.prepare(`SELECT a.id,a.codigo,a.nombre,a.descripcion,a.responsable,a.estado,COUNT(m.id) AS maquinas
      FROM areas a LEFT JOIN maquinas m ON m.id_area=a.id
      GROUP BY a.id ORDER BY a.nombre`).all();
    return json(result.results || []);
  }

  if (path === "/maquinas" && request.method === "GET") {
    const result = await db.prepare(`SELECT m.*,a.nombre AS area,
      (SELECT f.estado FROM fallas f WHERE f.id_maquina=m.id AND f.estado <> 'Resuelta' ORDER BY f.fecha_reporte DESC LIMIT 1) AS estado_falla,
      (SELECT f.descripcion FROM fallas f WHERE f.id_maquina=m.id AND f.estado <> 'Resuelta' ORDER BY f.fecha_reporte DESC LIMIT 1) AS motivo_parada
      FROM maquinas m JOIN areas a ON a.id=m.id_area ORDER BY a.nombre,m.nombre`).all();
    return json(result.results || []);
  }

  if (path.startsWith("/maquinas/por-qr/") && request.method === "GET") {
    const token = decodeURIComponent(path.slice("/maquinas/por-qr/".length));
    const machine = await db.prepare(`SELECT m.*, a.nombre AS area
      FROM maquinas m JOIN areas a ON a.id=m.id_area
      WHERE m.qr_token=? OR m.codigo=? LIMIT 1`).bind(token, token).first();
    if (!machine) return json({ error: "No se encontró una máquina para este código QR." }, { status: 404 });
    return json(machine);
  }

  if (path === "/repuestos" && request.method === "GET") {
    const result = await db.prepare(`SELECT r.*,GROUP_CONCAT(DISTINCT a.nombre) AS areas
      FROM repuestos r LEFT JOIN repuestos_areas ra ON ra.id_repuesto=r.id LEFT JOIN areas a ON a.id=ra.id_area
      GROUP BY r.id ORDER BY r.descripcion`).all();
    return json(result.results || []);
  }

  if (path === "/mantenimientos" && request.method === "GET") {
    const result = await db.prepare(`SELECT mt.*,m.nombre AS maquina,a.nombre AS area,f.estado AS estado_falla
      FROM mantenimientos mt JOIN maquinas m ON m.id=mt.id_maquina JOIN areas a ON a.id=m.id_area
      LEFT JOIN fallas f ON f.id=mt.id_falla
      ORDER BY CASE mt.estado WHEN 'En proceso' THEN 1 WHEN 'Programado' THEN 2 ELSE 3 END,mt.fecha_programada`).all();
    return json(result.results || []);
  }

  if (path === "/mantenimientos/historial-excel" && request.method === "GET") {
    const requestedType = url.searchParams.get("tipo");
    const result = await db.prepare(`SELECT h.id_registro,h.fecha,h.tecnicos,h.detalles,h.tipo_original,
      COALESCE(m.nombre,h.maquina_origen) AS maquina,COALESCE(a.nombre,'Sin área asignada') AS area,
      COALESCE(m.estado,'Histórico') AS estado_maquina
      FROM historial_mantenimiento_excel h
      LEFT JOIN maquinas m ON m.id=h.id_maquina
      LEFT JOIN areas a ON a.id=m.id_area
      ORDER BY h.fecha DESC,h.id DESC`).all();
    const registros = (result.results || []).filter((row) => !requestedType || normalizeHistoricType(row.tipo_original) === normalizeHistoricType(requestedType));
    const estados = {};
    for (const row of registros) estados[row.estado_maquina] = (estados[row.estado_maquina] || 0) + 1;
    return json({ total: registros.length, estados, registros: registros.slice(0, 100) });
  }

  // Estos catálogos son opcionales en la interfaz. Devolver una colección
  // vacía permite que el panel principal siga cargando aunque todavía no se
  // hayan migrado las localizaciones o el historial de importaciones.
  if ((path === "/importaciones" || path === "/localizaciones") && request.method === "GET") {
    return json([]);
  }

  if (path === "/fallas" && request.method === "GET") {
    const result = await db.prepare(`SELECT f.*,m.nombre AS maquina,a.nombre AS area
      FROM fallas f
      JOIN maquinas m ON m.id=f.id_maquina
      JOIN areas a ON a.id=m.id_area
      ORDER BY f.fecha_reporte DESC`).all();
    return json(result.results || []);
  }

  if (path === "/fallas" && request.method === "POST") {
    const form = await request.formData();
    const idMaquina = Number(form.get("id_maquina"));
    const descripcion = String(form.get("descripcion") || "").trim();
    const prioridad = String(form.get("prioridad") || "Media").trim();
    const fecha = String(form.get("fecha_ocurrencia") || new Date().toISOString());
    if (!idMaquina || !descripcion) return json({ error: "Indica la máquina y la descripción de la incidencia." }, { status: 400 });
    const exists = await db.prepare("SELECT id FROM maquinas WHERE id=?").bind(idMaquina).first();
    if (!exists) return json({ error: "La máquina ya no está registrada." }, { status: 404 });
    const insert = await db.prepare(`INSERT INTO fallas (id_maquina, prioridad, descripcion, estado, fecha_reporte)
      VALUES (?, ?, ?, 'Reportada', ?)`)
      .bind(idMaquina, prioridad, descripcion, fecha).run();
    await db.prepare("UPDATE maquinas SET estado='Detenida' WHERE id=?").bind(idMaquina).run();
    return json({ success: true, id: insert.meta?.last_row_id, mensaje: "Incidencia enviada a Mantenimiento." }, { status: 201 });
  }

  if (path === "/dashboard" && request.method === "GET") {
    const [machines, spares, failures, historic] = await db.batch([
      db.prepare("SELECT COUNT(*) AS total,SUM(estado='Operativa') AS operativas,SUM(estado IN ('Detenida','Mantenimiento')) AS paradas FROM maquinas"),
      db.prepare("SELECT COUNT(*) AS total,SUM(stock_verificado=0) AS sin_inventario,SUM(stock_verificado=1 AND stock_actual<=stock_minimo) AS bajo_minimo FROM repuestos"),
      db.prepare("SELECT COUNT(*) AS abiertas FROM fallas WHERE estado <> 'Resuelta'"),
      db.prepare("SELECT tipo_original,COUNT(*) AS total FROM historial_mantenimiento_excel GROUP BY tipo_original")
    ]);
    const m = machines.results?.[0] || {}; const r = spares.results?.[0] || {}; const f = failures.results?.[0] || {};
    const resumen_mantenimiento = Object.fromEntries(HISTORIC_TYPES.map((type) => [type, 0]));
    for (const row of historic.results || []) {
      const type = normalizeHistoricType(row.tipo_original);
      resumen_mantenimiento[type] += Number(row.total || 0);
    }
    return json({
      maquinas: { total: Number(m.total || 0), operativas: Number(m.operativas || 0), paradas: Number(m.paradas || 0) },
      repuestos: { total: Number(r.total || 0), sin_inventario: Number(r.sin_inventario || 0), bajo_minimo: Number(r.bajo_minimo || 0) },
      fallas_abiertas: Number(f.abiertas || 0),
      resumen_mantenimiento,
      actualizado_en: new Date().toISOString()
    });
  }

  // Diagnóstico sin datos sensibles: permite confirmar que los secretos de
  // acceso están disponibles en el Worker sin revelar sus valores.
  if (path === "/configuracion/accesos" && request.method === "GET") {
    return json({
      secretos_configurados: Object.fromEntries(DEFAULT_USERS.map((item) => [item.usuario, Boolean(env[item.secret] || env[item.legacySecret])]))
    });
  }

  // El formulario web usa /auth/login, mientras que las primeras pruebas
  // de la API usaban /login. Mantenemos ambas rutas para no interrumpir
  // ningún acceso existente.
  if ((path === "/login" || path === "/auth/login") && request.method === "POST") {
    const { usuario, password } = await readBody(request);
    await ensureDefaultUsers(db, env);
    const identity = String(usuario || "").trim().toLowerCase();
    const account = await db.prepare("SELECT id,nombre,usuario,correo,rol,password_hash FROM usuarios WHERE (LOWER(usuario)=? OR LOWER(correo)=?) AND estado=1").bind(identity, identity).first();
    const enteredPassword = String(password || "");
    const storedPasswordIsValid = account && await verifyPassword(enteredPassword, account.password_hash);
    if (!account || !storedPasswordIsValid) return json({ success: false, mensaje: "Usuario o contraseña incorrectos" }, { status: 401 });
    return json({ success: true, usuario: { id: account.id, nombre: account.nombre, usuario: account.usuario, correo: account.correo, rol: account.rol }, token: crypto.randomUUID() });
  }

  return json({ error: "Ruta aún no disponible durante la migración a Cloudflare." }, { status: 501 });
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    try {
      if (url.pathname === "/api" || url.pathname.startsWith("/api/")) return await api(request, env, url);
      return withUtf8(await env.ASSETS.fetch(request), request);
    } catch (error) {
      return json({ error: error.message || "No fue posible procesar la solicitud." }, { status: 500 });
    }
  }
};

