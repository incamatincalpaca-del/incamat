const crypto = require("crypto");

const secret = () => process.env.AUTH_SECRET || "incamat-desarrollo-cambiar-en-produccion";
const encode = (value) => Buffer.from(value).toString("base64url");
const sign = (value) => crypto.createHmac("sha256", secret()).update(value).digest("base64url");

function createToken(user) {
  const payload = encode(JSON.stringify({ id: user.id, rol: user.rol, exp: Date.now() + (12 * 60 * 60 * 1000) }));
  return `${payload}.${sign(payload)}`;
}

function authenticate(req, res, next) {
  const token = req.headers.authorization?.replace(/^Bearer\s+/i, "");
  if (!token || !token.includes(".")) return res.status(401).json({ error: "Inicia sesión para continuar." });
  const [payload, signature] = token.split(".");
  const expected = sign(payload);
  if (signature.length !== expected.length || !crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected))) return res.status(401).json({ error: "Sesión no válida." });
  try {
    const user = JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));
    if (!user.exp || user.exp < Date.now()) return res.status(401).json({ error: "Tu sesión expiró. Ingresa nuevamente." });
    req.user = user;
    return next();
  } catch (_error) { return res.status(401).json({ error: "Sesión no válida." }); }
}

function requireRole(...roles) {
  return (req, res, next) => roles.includes(req.user?.rol) ? next() : res.status(403).json({ error: "No tienes permiso para esta acción." });
}

module.exports = { createToken, authenticate, requireRole };
