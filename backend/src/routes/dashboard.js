const express = require("express");
const pool = require("../../config/database");
const router = express.Router();

router.get("/", async (req, res) => {
  let conn;
  try {
    conn = await pool.getConnection();
    const allowedPeriods = new Set(["dia", "semana", "mes", "anio", "todo"]);
    const periodo = allowedPeriods.has(req.query.periodo) ? req.query.periodo : "todo";
    const fechaReferencia = /^\d{4}-\d{2}-\d{2}$/.test(req.query.fecha || "") ? req.query.fecha : new Date().toISOString().slice(0, 10);
    const toDate = (value) => new Date(`${value}T12:00:00Z`);
    const formatDate = (date) => date.toISOString().slice(0, 10);
    const addDays = (date, days) => { const copy = new Date(date); copy.setUTCDate(copy.getUTCDate() + days); return copy; };
    const reference = toDate(fechaReferencia);
    let historyWhere = "";
    let historyParams = [];
    if (periodo !== "todo") {
      let start = reference;
      let end;
      if (periodo === "semana") {
        start = addDays(reference, -((reference.getUTCDay() + 6) % 7));
        end = addDays(start, 7);
      } else if (periodo === "mes") {
        start = new Date(Date.UTC(reference.getUTCFullYear(), reference.getUTCMonth(), 1));
        end = new Date(Date.UTC(reference.getUTCFullYear(), reference.getUTCMonth() + 1, 1));
      } else if (periodo === "anio") {
        start = new Date(Date.UTC(reference.getUTCFullYear(), 0, 1));
        end = new Date(Date.UTC(reference.getUTCFullYear() + 1, 0, 1));
      } else end = addDays(start, 1);
      historyWhere = " WHERE fecha >= ? AND fecha < ?";
      historyParams = [formatDate(start), formatDate(end)];
    }
    const [machines, spares, consumption, recent, maintenanceAlerts, failures, maintenanceKpis, maintenanceSummary, failureKpis, areaKpis, requestsKpis, requestsByArea] = await Promise.all([
      conn.query(`SELECT CAST(COUNT(*) AS UNSIGNED) AS total,
        CAST(SUM(estado = 'Operativa') AS UNSIGNED) AS operativas,
        CAST(SUM(estado = 'Mantenimiento') AS UNSIGNED) AS mantenimiento,
        CAST(SUM(estado = 'Detenida') AS UNSIGNED) AS detenidas,
        CAST(SUM(estado IN ('Detenida','Mantenimiento')) AS UNSIGNED) AS paradas,
        (SELECT CAST(COUNT(DISTINCT id_maquina) AS UNSIGNED) FROM fallas WHERE estado = 'Esperando repuesto') AS espera_repuesto,
        (SELECT CAST(COUNT(DISTINCT id_maquina) AS UNSIGNED) FROM fallas WHERE estado IN ('Reportada','En atencion','Pendiente de validacion')) AS pendientes_atencion
        FROM maquinas`),
      conn.query("SELECT CAST(COUNT(*) AS UNSIGNED) AS total, CAST(SUM(criticidad = 'Sin evaluar') AS UNSIGNED) AS sin_criticidad, CAST(SUM(stock_verificado = FALSE) AS UNSIGNED) AS sin_inventario, CAST(SUM(stock_verificado = TRUE AND stock_actual <= stock_minimo) AS UNSIGNED) AS bajo_minimo, CAST(SUM(stock_verificado = TRUE AND stock_actual = 0) AS UNSIGNED) AS sin_stock FROM repuestos"),
      conn.query("SELECT CAST(COUNT(*) AS UNSIGNED) AS movimientos_30_dias FROM movimientos_repuestos WHERE fecha_movimiento >= CURDATE() - INTERVAL 30 DAY"),
      conn.query("SELECT r.descripcion, r.codigo, m.fecha_movimiento, m.cantidad, m.numero_vale FROM movimientos_repuestos m JOIN repuestos r ON r.id = m.id_repuesto ORDER BY m.fecha_movimiento DESC LIMIT 5"),
      conn.query("SELECT CAST(SUM(fecha_programada < CURDATE() AND estado IN ('Programado','En proceso')) AS UNSIGNED) AS vencidos, CAST(SUM(fecha_programada = CURDATE() AND estado='Programado') AS UNSIGNED) AS hoy, CAST(SUM(fecha_programada BETWEEN CURDATE() + INTERVAL 1 DAY AND CURDATE() + INTERVAL 7 DAY AND estado='Programado') AS UNSIGNED) AS proximos FROM mantenimientos"),
      conn.query("SELECT CAST(SUM(estado <> 'Resuelta') AS UNSIGNED) AS abiertas FROM fallas"),
      conn.query("SELECT CAST(COUNT(*) AS UNSIGNED) AS total, CAST(SUM(estado='Completado') AS UNSIGNED) AS completados FROM mantenimientos WHERE fecha_programada <= CURDATE()"),
      conn.query(`SELECT
        CAST(SUM(UPPER(TRIM(tipo_original)) = 'CORRECTIVO') AS UNSIGNED) AS correctivo,
        CAST(SUM(UPPER(TRIM(tipo_original)) IN ('PREVENTIVO','PREV GENERAL','PREVENTIVO MEC')) AS UNSIGNED) AS preventivo,
        CAST(SUM(UPPER(TRIM(tipo_original)) = 'RUTINARIO') AS UNSIGNED) AS rutinario,
        CAST(SUM(UPPER(TRIM(tipo_original)) = 'LIMPIEZA') AS UNSIGNED) AS limpieza,
        CAST(SUM(UPPER(TRIM(tipo_original)) = 'PROYECTO') AS UNSIGNED) AS proyecto,
        CAST(SUM(UPPER(TRIM(tipo_original)) = 'MEJORA') AS UNSIGNED) AS mejora,
        CAST(SUM(UPPER(TRIM(tipo_original)) = 'SEGURIDAD') AS UNSIGNED) AS seguridad,
        CAST(SUM(UPPER(TRIM(tipo_original)) = 'APOYO') AS UNSIGNED) AS apoyo,
        CAST(SUM(UPPER(TRIM(tipo_original)) NOT IN ('CORRECTIVO','PREVENTIVO','PREV GENERAL','PREVENTIVO MEC','RUTINARIO','LIMPIEZA','PROYECTO','MEJORA','SEGURIDAD','APOYO')) AS UNSIGNED) AS otros
        FROM historial_mantenimiento_excel${historyWhere}`, historyParams),
      conn.query("SELECT AVG(TIMESTAMPDIFF(MINUTE, fecha_reporte, fecha_resolucion)) AS mttr_minutos FROM fallas WHERE estado='Resuelta' AND fecha_resolucion IS NOT NULL"),
      conn.query(`SELECT a.id, a.nombre,
        COUNT(m.id) AS maquinas,
        COALESCE(SUM(m.estado = 'Operativa'), 0) AS operativas,
        COALESCE(SUM(m.estado = 'Detenida'), 0) AS detenidas,
        COALESCE(f.abiertas, 0) AS fallas_abiertas,
        COALESCE(mt.vencidos, 0) AS preventivos_vencidos,
        COALESCE(mt.pendientes, 0) AS preventivos_pendientes,
        COALESCE(mt.completados, 0) AS preventivos_completados
        FROM areas a
        LEFT JOIN maquinas m ON m.id_area = a.id
        LEFT JOIN (
          SELECT mq.id_area, COUNT(*) AS abiertas
          FROM fallas f JOIN maquinas mq ON mq.id = f.id_maquina
          WHERE f.estado <> 'Resuelta' GROUP BY mq.id_area
        ) f ON f.id_area = a.id
        LEFT JOIN (
          SELECT mq.id_area,
            SUM(mt.fecha_programada < CURDATE() AND mt.estado IN ('Programado', 'En proceso')) AS vencidos,
            SUM(mt.fecha_programada <= CURDATE() AND mt.estado <> 'Completado' AND mt.estado <> 'Cancelado') AS pendientes,
            SUM(mt.estado = 'Completado' AND mt.fecha_programada <= CURDATE()) AS completados
          FROM mantenimientos mt JOIN maquinas mq ON mq.id = mt.id_maquina
          GROUP BY mq.id_area
        ) mt ON mt.id_area = a.id
        GROUP BY a.id, a.nombre, f.abiertas, mt.vencidos, mt.pendientes, mt.completados
        HAVING COUNT(m.id) > 0 OR COALESCE(f.abiertas, 0) > 0 OR COALESCE(mt.pendientes, 0) > 0
        ORDER BY fallas_abiertas DESC, preventivos_vencidos DESC, detenidas DESC, a.nombre`),
      conn.query("SELECT CAST(COUNT(*) AS UNSIGNED) AS total, CAST(SUM(estado='Solicitada') AS UNSIGNED) AS pendientes, CAST(SUM(estado='Aprobada') AS UNSIGNED) AS aprobadas, CAST(SUM(estado='Entregada') AS UNSIGNED) AS entregadas FROM solicitudes_repuestos"),
      conn.query("SELECT id_area, COUNT(*) AS solicitudes_area, SUM(estado='Solicitada') AS solicitudes_pendientes FROM solicitudes_repuestos GROUP BY id_area"),
    ]);
    const machineValues = Object.fromEntries(Object.entries(machines[0]).map(([key, value]) => [key, Number(value || 0)]));
    const spareValues = Object.fromEntries(Object.entries(spares[0]).map(([key, value]) => [key, Number(value || 0)]));
    const maintenanceAlertValues = Object.fromEntries(Object.entries(maintenanceAlerts[0]).map(([key, value]) => [key, Number(value || 0)]));
    const maintenanceValues = Object.fromEntries(Object.entries(maintenanceKpis[0]).map(([key, value]) => [key, Number(value || 0)]));
    const maintenanceSummaryValues = Object.fromEntries(Object.entries(maintenanceSummary[0]).map(([key, value]) => [key, Number(value || 0)]));
    const areaValues = areaKpis.map((row) => Object.fromEntries(Object.entries(row).map(([key, value]) => [key, typeof value === "bigint" ? Number(value) : value == null ? 0 : Number.isNaN(Number(value)) ? value : Number(value)])));
    const requestMap = new Map(requestsByArea.map((row) => [Number(row.id_area), { solicitudes_area: Number(row.solicitudes_area || 0), solicitudes_pendientes: Number(row.solicitudes_pendientes || 0) }]));
    const areasWithRequests = areaValues.map((area) => ({ ...area, ...(requestMap.get(Number(area.id)) || { solicitudes_area: 0, solicitudes_pendientes: 0 }) }));
    const requestValues = Object.fromEntries(Object.entries(requestsKpis[0]).map(([key, value]) => [key, Number(value || 0)]));
    res.json({ maquinas: machineValues, repuestos: spareValues, mantenimientos: maintenanceAlertValues, resumen_mantenimiento: maintenanceSummaryValues, historial_periodo: { periodo, fecha: fechaReferencia }, solicitudes: requestValues, fallas_abiertas: Number(failures[0].abiertas || 0), kpis: { disponibilidad: machineValues.total ? Number((machineValues.operativas * 100 / machineValues.total).toFixed(1)) : null, cumplimiento_preventivo: maintenanceValues.total ? Number((maintenanceValues.completados * 100 / maintenanceValues.total).toFixed(1)) : null, stock_verificado: spareValues.total ? Number(((spareValues.total - spareValues.sin_inventario) * 100 / spareValues.total).toFixed(1)) : null, mttr_horas: failureKpis[0].mttr_minutos == null ? null : Number((Number(failureKpis[0].mttr_minutos) / 60).toFixed(1)) }, areas_kpi: areasWithRequests, movimientos_30_dias: Number(consumption[0].movimientos_30_dias || 0), recientes: recent, actualizado_en: new Date().toISOString() });
  } catch (error) { console.error(error); res.status(500).json({ error: "No fue posible calcular los indicadores." }); }
  finally { if (conn) conn.release(); }
});
module.exports = router;
