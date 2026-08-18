const express = require("express");
const cors = require("cors");
const path = require("path");
const pool = require("../config/database");
const { hashPassword, verifyPassword } = require("./utils/passwords");
const { createToken } = require("./utils/auth");

const maquinasRoutes = require("./routes/maquinas");
const areasRoutes = require("./routes/areas");
const componentesRoutes = require("./routes/componentes");
const importacionesRoutes = require("./routes/importaciones");
const repuestosRoutes = require("./routes/repuestos");
const localizacionesRoutes = require("./routes/localizaciones");
const dashboardRoutes = require("./routes/dashboard");
const mantenimientosRoutes = require("./routes/mantenimientos");
const fallasRoutes = require("./routes/fallas");
const solicitudesRoutes = require("./routes/solicitudes");
const solicitudesExternasRoutes = require("./routes/solicitudesExternas");
const usuariosRoutes = require("./routes/usuarios");
const anunciosRoutes = require("./routes/anuncios");

const app = express();

const allowedOrigins = (process.env.CORS_ORIGIN || "http://localhost:5173").split(",").map((origin) => origin.trim()).filter(Boolean);
app.use(cors({
    origin: (origin, callback) => {
        return !origin || allowedOrigins.includes(origin) ? callback(null, true) : callback(new Error("Origen no permitido"));
    },
    credentials: true
}));

app.use(express.json());
// Los catálogos y usuarios se actualizan con frecuencia; evitamos que el
// navegador conserve listas antiguas después de una corrección o importación.
app.use("/api", (_req, res, next) => {
    res.set("Cache-Control", "no-store, no-cache, must-revalidate, max-age=0");
    next();
});
app.use("/uploads", express.static(path.join(__dirname, "../uploads")));

// Rutas de máquinas
app.use("/api/areas", areasRoutes);
app.use("/api/maquinas", maquinasRoutes);
app.use("/api/componentes", componentesRoutes);
app.use("/api/importaciones", importacionesRoutes);
app.use("/api/repuestos", repuestosRoutes);
app.use("/api/localizaciones", localizacionesRoutes);
app.use("/api/dashboard", dashboardRoutes);
app.use("/api/mantenimientos", mantenimientosRoutes);
app.use("/api/fallas", fallasRoutes);
app.use("/api/solicitudes", solicitudesRoutes);
app.use("/api/solicitudes-externas", solicitudesExternasRoutes);
app.use("/api/usuarios", usuariosRoutes);
app.use("/api/anuncios", anunciosRoutes);

// Verificar API
app.get("/api", async (req, res) => {

    try {

        const conn = await pool.getConnection();

        await conn.query("SELECT 1");

        conn.release();

        res.json({
            sistema: "INCAMAT",
            estado: "Online",
            baseDatos: "Conectada"
        });

    } catch (error) {

        console.error(error);

        res.status(500).json({
            error: "Error de conexión con MariaDB"
        });

    }

});

// Login
app.post("/api/login", async (req, res) => {

    const { usuario, password } = req.body;

    try {

        const conn = await pool.getConnection();

        const rows = await conn.query(
            "SELECT id, nombre, usuario, correo, rol, password, password_hash FROM usuarios WHERE usuario=? AND estado=TRUE",
            [usuario]
        );

        const account = rows[0];
        const validPassword = account && (account.password_hash
            ? await verifyPassword(password, account.password_hash)
            : account.password === password);

        if (validPassword) {
            if (!account.password_hash) {
                await conn.query("UPDATE usuarios SET password_hash=?, password=NULL WHERE id=?", [await hashPassword(password), account.id]);
            }
            conn.release();

            return res.json({
                success: true,
                usuario: { id: account.id, nombre: account.nombre, usuario: account.usuario, correo: account.correo, rol: account.rol },
                token: createToken(account)
            });

        }

        conn.release();

        res.status(401).json({
            success: false,
            mensaje: "Usuario o contraseña incorrectos"
        });

    } catch (error) {

        console.error(error);

        res.status(500).json({
            success: false,
            mensaje: "Error del servidor"
        });

    }

});

module.exports = app;
