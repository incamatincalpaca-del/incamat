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
  { nombre: "Administrador", usuario: "admin", correo: "admin@incamat.local", rol: "Administrador", secret: "INCAMAT_ADMIN_PASSWORD" },
  { nombre: "Ingeniero de mantenimiento", usuario: "ingeniero", correo: "ingeniero@incamat.local", rol: "Ingeniero", secret: "INCAMAT_INGENIERO_PASSWORD" },
  { nombre: "Técnico de mantenimiento", usuario: "tecnico", correo: "tecnico@incamat.local", rol: "Técnico", secret: "INCAMAT_TECNICO_PASSWORD" },
  { nombre: "Operario de planta", usuario: "operario", correo: "operario@incamat.local", rol: "Operario", secret: "INCAMAT_OPERARIO_PASSWORD" },
];

async function passwordHash(password, saltText) {
  const salt = new TextEncoder().encode(saltText);
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(password), "PBKDF2", false, ["deriveBits"]);
  const bits = await crypto.subtle.deriveBits({ name: "PBKDF2", hash: "SHA-256", salt, iterations: 120000 }, key, 256);
  return `pbkdf2$120000$${bytesToBase64(salt)}$${bytesToBase64(bits)}`;
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
      db.prepare("CREATE TABLE IF NOT EXISTS mantenimientos (id INTEGER PRIMARY KEY AUTOINCREMENT, id_maquina INTEGER NOT NULL, id_falla INTEGER, tipo TEXT NOT NULL, modalidad TEXT, estado TEXT NOT NULL DEFAULT 'Programado', fecha_programada TEXT NOT NULL, fecha_realizacion TEXT, responsable TEXT, descripcion TEXT, observacion TEXT, checklist TEXT)")
    ]);
  }
  await schemaReady;
}

async function ensureDefaultUsers(db, env) {
  for (const item of DEFAULT_USERS) {
    const password = env[item.secret];
    if (!password) continue;
    const hash = await passwordHash(password, `incamat-${item.usuario}-v1`);
    // Estas cuatro cuentas son las cuentas iniciales de la organización.
    // Se sincronizan con los secretos seguros de Cloudflare para que una
    // contraseña antigua de una prueba no impida volver a ingresar.
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

async function api(request, env, url) {
  const db = requireDb(env);
  await ensureSchema(db);
  const path = url.pathname.replace(/^\/api/, "") || "/";

  if (path === "/" && request.method === "GET") return json({ sistema: "INCAMAT", estado: "Online", baseDatos: "D1" });

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
    const [machines, spares, failures] = await db.batch([
      db.prepare("SELECT COUNT(*) AS total,SUM(estado='Operativa') AS operativas,SUM(estado IN ('Detenida','Mantenimiento')) AS paradas FROM maquinas"),
      db.prepare("SELECT COUNT(*) AS total,SUM(stock_verificado=0) AS sin_inventario,SUM(stock_verificado=1 AND stock_actual<=stock_minimo) AS bajo_minimo FROM repuestos"),
      db.prepare("SELECT COUNT(*) AS abiertas FROM fallas WHERE estado <> 'Resuelta'")
    ]);
    const m = machines.results?.[0] || {}; const r = spares.results?.[0] || {}; const f = failures.results?.[0] || {};
    return json({
      maquinas: { total: Number(m.total || 0), operativas: Number(m.operativas || 0), paradas: Number(m.paradas || 0) },
      repuestos: { total: Number(r.total || 0), sin_inventario: Number(r.sin_inventario || 0), bajo_minimo: Number(r.bajo_minimo || 0) },
      fallas_abiertas: Number(f.abiertas || 0),
      actualizado_en: new Date().toISOString()
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
    if (!account || !(await verifyPassword(password || "", account.password_hash))) return json({ success: false, mensaje: "Usuario o contraseña incorrectos" }, { status: 401 });
    return json({ success: true, usuario: { id: account.id, nombre: account.nombre, usuario: account.usuario, correo: account.correo, rol: account.rol }, token: crypto.randomUUID() });
  }

  return json({ error: "Ruta aún no disponible durante la migración a Cloudflare." }, { status: 501 });
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    try {
      if (url.pathname === "/api" || url.pathname.startsWith("/api/")) return await api(request, env, url);
      return env.ASSETS.fetch(request);
    } catch (error) {
      return json({ error: error.message || "No fue posible procesar la solicitud." }, { status: 500 });
    }
  }
};

