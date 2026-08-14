/*
 * Uso (con MariaDB y la API ya levantadas):
 * DB_HOST=localhost node scripts/importarCargaInicial.js "C:\ruta\EXCEL.xlsx" "C:\ruta\CTP 7000.xlsx"
 */
const XLSX = require("xlsx");
const pool = require("../config/database");

const [estructuraPath, valesPath] = process.argv.slice(2);
if (!estructuraPath || !valesPath) {
  console.error("Indica: archivo de estructura y archivo de vales.");
  process.exit(1);
}

const clean = (value) => String(value ?? "").trim().replace(/\s+/g, " ");
const key = (value) => clean(value).toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
const slug = (value) => key(value).replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "").slice(0, 34);
const rows = (book, sheet, options = {}) => XLSX.utils.sheet_to_json(book.Sheets[sheet], { defval: "", ...options }).map((row) => Object.fromEntries(Object.entries(row).map(([name, value]) => [key(name), value])));

async function getId(conn, table, column, value) {
  const result = await conn.query(`SELECT id FROM ${table} WHERE ${column} = ? LIMIT 1`, [value]);
  return result[0]?.id ?? null;
}

async function ensureLocation(conn, names) {
  let parentId = null;
  let path = "";
  for (let index = 0; index < names.length; index += 1) {
    const name = clean(names[index]);
    if (!name) continue;
    path = path ? `${path} > ${name}` : name;
    await conn.query("INSERT IGNORE INTO localizaciones (nombre, nivel, id_padre, ruta) VALUES (?, ?, ?, ?)", [name, index + 1, parentId, path]);
    parentId = await getId(conn, "localizaciones", "ruta", path);
  }
  return parentId;
}

async function importStructure(conn) {
  const book = XLSX.readFile(estructuraPath, { cellDates: true });
  const locations = rows(book, "Localizacion por nivel");
  const areas = rows(book, "Areas");
  const machines = rows(book, "maquinas");
  for (const row of locations) await ensureLocation(conn, Object.values(row));

  const existingLocations = await conn.query("SELECT id, nombre FROM localizaciones");
  const locationByName = new Map(existingLocations.map((item) => [key(item.nombre), item.id]));
  const locationArea = new Map();
  for (const row of areas) {
    const areaName = clean(row.area);
    if (!areaName) continue;
    const areaCode = `AREA-${slug(areaName).toUpperCase().slice(0, 25)}`;
    await conn.query("INSERT INTO areas (codigo, nombre) VALUES (?, ?) ON DUPLICATE KEY UPDATE nombre = VALUES(nombre)", [areaCode, areaName]);
    const areaId = await getId(conn, "areas", "codigo", areaCode);
    const levels = Object.values(row).slice(1).map(clean).filter(Boolean);
    const locationId = locationByName.get(key(levels.at(-1))) || await ensureLocation(conn, levels);
    if (locationId) {
      await conn.query("INSERT IGNORE INTO area_localizaciones (id_area, id_localizacion) VALUES (?, ?)", [areaId, locationId]);
      locationArea.set(locationId, areaId);
    }
  }

  const locationsDb = await conn.query("SELECT id, nombre, id_padre FROM localizaciones");
  const byName = new Map(locationsDb.map((item) => [key(item.nombre), item]));
  const byId = new Map(locationsDb.map((item) => [item.id, item]));
  await conn.query("INSERT INTO areas (codigo, nombre) VALUES ('AREA-SIN-CLASIFICAR', 'Sin clasificar') ON DUPLICATE KEY UPDATE nombre = VALUES(nombre)");
  const defaultAreaId = await getId(conn, "areas", "codigo", "AREA-SIN-CLASIFICAR");
  const rootLocation = locationsDb.find((item) => key(item.nombre) === "planta de incalpaca");
  const serials = new Map(); let created = 0; let updated = 0;
  for (const row of machines) {
    const name = clean(row.maquina);
    if (!name) continue;
    let location = byName.get(key(row.area));
    if (!location && rootLocation) {
      const generatedLocationId = await ensureLocation(conn, [rootLocation.nombre, clean(row.area)]);
      const generated = await conn.query("SELECT id, nombre, id_padre FROM localizaciones WHERE id = ?", [generatedLocationId]);
      location = generated[0]; byName.set(key(row.area), location); byId.set(location.id, location);
    }
    if (!location) continue;
    let current = location; let areaId = null;
    while (current && !areaId) { areaId = locationArea.get(current.id) || null; current = byId.get(current.id_padre); }
    areaId = areaId || defaultAreaId;
    const identity = `${key(row.area)}|${key(name)}`; const serial = (serials.get(identity) || 0) + 1; serials.set(identity, serial);
    const suffix = `-${String(serial).padStart(3, "0")}`;
    const baseCode = `M-${slug(row.area).toUpperCase()}-${slug(name).toUpperCase()}`;
    const legacyCode = `${baseCode}${suffix}`.slice(0, 50);
    const code = `${baseCode.slice(0, 50 - suffix.length)}${suffix}`;
    let exists = await getId(conn, "maquinas", "codigo", code);
    if (!exists && code !== legacyCode && serial === 1) {
      const legacyId = await getId(conn, "maquinas", "codigo", legacyCode);
      if (legacyId) {
        await conn.query("UPDATE maquinas SET codigo = ? WHERE id = ?", [code, legacyId]);
        exists = legacyId;
      }
    }
    await conn.query("INSERT INTO maquinas (codigo, nombre, id_area, id_localizacion, marca, modelo, estado) VALUES (?, ?, ?, ?, ?, ?, ?) ON DUPLICATE KEY UPDATE nombre=VALUES(nombre), id_area=VALUES(id_area), id_localizacion=VALUES(id_localizacion), marca=VALUES(marca), modelo=VALUES(modelo), estado=VALUES(estado)", [code, name, areaId, location.id, clean(row.marca) || null, clean(row.modelo) || null, clean(row.estado) === "OPERATIVO" ? "Operativa" : "Detenida"]);
    if (exists) updated += 1; else created += 1;
  }
  return { created, updated, errors: 0 };
}

async function importVouchers(conn) {
  const book = XLSX.readFile(valesPath, { cellDates: true });
  const vouchers = rows(book, "Sheet0", { range: 4 });
  let created = 0; let updated = 0;
  for (const row of vouchers) {
    const code = clean(row.articulo); const voucher = clean(row.nrovale);
    if (!code || !voucher) continue;
    const exists = await getId(conn, "repuestos", "codigo", code);
    await conn.query("INSERT INTO repuestos (codigo, descripcion, unidad_medida, fecha_ultima_solicitud, ubicacion_almacen, costo_ultimo) VALUES (?, ?, ?, ?, ?, ?) ON DUPLICATE KEY UPDATE descripcion=VALUES(descripcion), unidad_medida=VALUES(unidad_medida), fecha_ultima_solicitud=GREATEST(COALESCE(fecha_ultima_solicitud, '1900-01-01'), VALUES(fecha_ultima_solicitud)), ubicacion_almacen=COALESCE(VALUES(ubicacion_almacen), ubicacion_almacen), costo_ultimo=VALUES(costo_ultimo)", [code, clean(row.descripcion), clean(row.um) || "unidad", row.fecest || null, clean(row.ubicacion) || null, Number(row.costo || 0)]);
    const spareId = await getId(conn, "repuestos", "codigo", code);
    await conn.query("INSERT INTO movimientos_repuestos (id_repuesto, numero_vale, fecha_movimiento, cantidad, estado, pci, centro_costo, maquina_origen, autorizado_por, costo_unitario, costo_total, observaciones, ubicacion) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?) ON DUPLICATE KEY UPDATE cantidad=VALUES(cantidad), estado=VALUES(estado), costo_unitario=VALUES(costo_unitario), costo_total=VALUES(costo_total), observaciones=VALUES(observaciones), ubicacion=VALUES(ubicacion)", [spareId, voucher, row.fecest, Number(row.cant || 0), clean(row.estado) || null, clean(row.pci) || null, clean(row.pcides) || null, clean(row.maq) || null, clean(row.aut) || null, Number(row.costo || 0), Number(row.tot || 0), clean(row.observaciones) || null, clean(row.ubicacion) || null]);
    if (exists) updated += 1; else created += 1;
  }
  return { created, updated, errors: 0 };
}

async function main() {
  let conn;
  try {
    conn = await pool.getConnection();
    await conn.beginTransaction();
    const structure = await importStructure(conn);
    const vouchers = await importVouchers(conn);
    await conn.query("INSERT INTO importaciones (modulo, nombre_archivo, registros_creados, registros_actualizados, registros_error, estado) VALUES (?, ?, ?, ?, ?, ?)", ["Estructura", estructuraPath.split(/[\\/]/).pop(), structure.created, structure.updated, 0, "Procesado"]);
    await conn.query("INSERT INTO importaciones (modulo, nombre_archivo, registros_creados, registros_actualizados, registros_error, estado) VALUES (?, ?, ?, ?, ?, ?)", ["Movimientos de repuestos", valesPath.split(/[\\/]/).pop(), vouchers.created, vouchers.updated, 0, "Procesado"]);
    await conn.commit();
    console.log({ estructura: structure, vales: vouchers });
  } catch (error) { if (conn) await conn.rollback(); throw error; }
  finally { if (conn) conn.release(); await pool.end(); }
}

main().catch((error) => { console.error(error); process.exit(1); });
