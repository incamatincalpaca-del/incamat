const XLSX = require("xlsx");
const pool = require("../config/database");

const file = process.argv[2];
if (!file) throw new Error("Uso: node scripts/importarSRequest.js archivo.xls");
const norm = (v) => String(v || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toUpperCase().replace(/[^A-Z0-9]+/g, " ").trim();
const map = {
  "ACABADO TELAS": "Acabado de Telas", "ACABADO DE TELAS": "Acabado de Telas", "TEJIDO PUNTO": "TEJIDO PUNTO", "TEJEDURIA": "TEJIDO PLANO", "TINTORERIA": "TINTORERÍA", "HILANDERIA": "HILANDERÍA", "CONFECCION PRENDAS": "CONFECCION PRENDAS", "PRE ALMACEN": "PRE ALMACEN", "ZURCIDO": "ZURCIDO", "ESTAMPADOS": "ESTAMPADOS", "CTP": "CTP", "ALMACEN DE HILADOS": "Almacenes", "ALMACENES": "Almacenes", "MANTENIMIENTO": "MANTENIMIENTO", "CALIDAD": "Calidad"
};
const parseDate = (v) => { if (!v) return null; if (v instanceof Date && !Number.isNaN(v)) return v; const p = String(v).trim().match(/(\d{1,2})\/(\d{1,2})\/(\d{4})\s+(\d{1,2}):(\d{2}):(\d{2})/); return p ? new Date(`${p[3]}-${p[2].padStart(2,"0")}-${p[1].padStart(2,"0")}T${p[4].padStart(2,"0")}:${p[5]}:${p[6]}`) : null; };

async function main() {
  const wb = XLSX.readFile(file, { cellDates: true }); const rows = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { defval: "" });
  const conn = await pool.getConnection();
  try {
    const areas = await conn.query("SELECT id,nombre FROM areas"); const locations = await conn.query("SELECT nombre,ruta FROM localizaciones"); let created = 0, unmatched = 0;
    for (const row of rows) {
      // El formato corregido usa la columna AREA. Se conserva Empresa por compatibilidad.
      const company = row.AREA || row.Area || row.Empresa || ""; const canonical = map[norm(company)] || company || null; const area = canonical && areas.find((x) => norm(x.nombre) === norm(canonical));
      if (!area) unmatched++;
      const place = company && locations.find((x) => norm(x.nombre) === norm(company));
      const state = norm(row.Estado).includes("TERMIN") ? "Resuelta" : norm(row.Estado).includes("ATENC") ? "En atencion" : "Reportada";
      const result = await conn.query(`INSERT INTO solicitudes_externas (numero_solicitud,urgente,fecha_reporte,tiene_foto,descripcion,empresa_origen,departamento_origen,usuario_solicitante,estado_origen,fecha_inicio,fecha_termino,tiene_qr,id_area,ruta_localizacion,estado_incamat) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?) ON DUPLICATE KEY UPDATE urgente=VALUES(urgente),fecha_reporte=VALUES(fecha_reporte),tiene_foto=VALUES(tiene_foto),descripcion=VALUES(descripcion),empresa_origen=VALUES(empresa_origen),departamento_origen=VALUES(departamento_origen),usuario_solicitante=VALUES(usuario_solicitante),estado_origen=VALUES(estado_origen),fecha_inicio=VALUES(fecha_inicio),fecha_termino=VALUES(fecha_termino),tiene_qr=VALUES(tiene_qr),id_area=VALUES(id_area),ruta_localizacion=VALUES(ruta_localizacion),estado_incamat=VALUES(estado_incamat)`, [String(row.Solicitud), /SI|SÍ/i.test(row.Urgente), parseDate(row["Fecha y hora"]), /SI|SÍ/i.test(row.Foto), row["Descripción de la solicitud"] || "Sin descripción", company || null, row.Departamento || null, row["Usuario que solicita"] || null, row.Estado || null, parseDate(row["Fecha y hora de inicio"]), parseDate(row["Fecha y hora de término"]), /SI|SÍ/i.test(row["Información QR del equipo"]), area?.id || null, place?.ruta || null, state]);
      if (result.affectedRows === 1) created++;
    }
    console.log(JSON.stringify({ total: rows.length, creadas: created, sin_area_mapeada: unmatched }));
  } finally { conn.release(); await pool.end(); }
}
main().catch((error) => { console.error(error); process.exit(1); });
