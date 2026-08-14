const mariadb = require("mariadb");

const pool = mariadb.createPool({
    host: process.env.DB_HOST || "mariadb",
    port: Number(process.env.DB_PORT || 3306),
    user: process.env.DB_USER || "alyson",
    password: process.env.DB_PASSWORD || "alyson123",
    database: process.env.DB_NAME || "incamant",
    connectionLimit: 10
});

module.exports = pool;
