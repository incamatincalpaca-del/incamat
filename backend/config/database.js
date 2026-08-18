const mariadb = require("mariadb");

const required = (name) => {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Falta la variable de entorno obligatoria: ${name}`);
  }
  return value;
};

const pool = mariadb.createPool({
  host: required("DB_HOST"),
  port: Number(required("DB_PORT")),
  user: required("DB_USER"),
  password: required("DB_PASSWORD"),
  database: required("DB_NAME"),
    connectionLimit: 10
});

module.exports = pool;
