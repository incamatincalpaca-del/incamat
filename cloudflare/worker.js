const json = (body, init = {}) => new Response(JSON.stringify(body), {
  ...init,
  headers: { "content-type": "application/json; charset=utf-8", ...(init.headers || {}) }
});

const readBody = async (request) => {
  try { return await request.json(); } catch { return {}; }
};

const bytesToBase64 = (bytes) => btoa(String.fromCharCode(...new Uint8Array(bytes)));
const base64ToBytes = (value) => Uint8Array.from(atob(value), (char) => char.charCodeAt(0));

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

async function api(request, env, url) {
  const db = requireDb(env);
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

  if (path === "/login" && request.method === "POST") {
    const { usuario, password } = await readBody(request);
    const account = await db.prepare("SELECT id,nombre,usuario,correo,rol,password_hash FROM usuarios WHERE usuario=? AND estado=1").bind(usuario || "").first();
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
