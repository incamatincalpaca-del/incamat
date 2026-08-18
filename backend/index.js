const app = require("./src/app");
const pool = require("./config/database");
const { hashPassword } = require("./src/utils/passwords");

const PORT = process.env.PORT || 3000;
const validPassword = (value) => typeof value === "string" && value.length >= 12 && /[a-z]/.test(value) && /[A-Z]/.test(value) && /\d/.test(value) && /[^A-Za-z0-9]/.test(value);

async function bootstrapInitialAdmin() {
  const conn = await pool.getConnection();
  try {
    const rows = await conn.query("SELECT COUNT(*) AS total FROM usuarios");
    if (Number(rows[0]?.total || 0) > 0) return;
    const { INITIAL_ADMIN_NAME, INITIAL_ADMIN_USERNAME, INITIAL_ADMIN_PASSWORD, INITIAL_ADMIN_EMAIL } = process.env;
    if (!INITIAL_ADMIN_NAME || !INITIAL_ADMIN_USERNAME || !validPassword(INITIAL_ADMIN_PASSWORD)) throw new Error("No hay usuarios. Define las variables privadas INITIAL_ADMIN_* con una contraseña segura.");
    await conn.query("INSERT INTO usuarios (nombre,usuario,correo,password,password_hash,rol,estado) VALUES (?, ?, ?, NULL, ?, 'Administrador', TRUE)", [INITIAL_ADMIN_NAME, INITIAL_ADMIN_USERNAME.toLowerCase(), INITIAL_ADMIN_EMAIL || null, await hashPassword(INITIAL_ADMIN_PASSWORD)]);
    console.log("Administrador inicial creado de forma segura.");
  } finally { conn.release(); }
}

bootstrapInitialAdmin().then(() => app.listen(PORT, () => {
  console.log(`INCAMAT API iniciada en el puerto ${PORT}`);
})).catch((error) => { console.error("No se pudo iniciar INCAMAT:", error.message); process.exit(1); });
