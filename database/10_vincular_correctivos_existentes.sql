INSERT INTO fallas (id_maquina, prioridad, descripcion, reportado_por, estado, fecha_reporte, fecha_resolucion)
SELECT mt.id_maquina, 'Media', CONCAT('[Correctivo #', mt.id, '] ', COALESCE(mt.descripcion, 'Mantenimiento correctivo programado')), COALESCE(mt.responsable, 'Mantenimiento'),
       CASE WHEN mt.estado='Completado' THEN 'Resuelta' WHEN mt.estado='En proceso' THEN 'En atención' ELSE 'Reportada' END,
       mt.creado_en, CASE WHEN mt.estado='Completado' THEN COALESCE(mt.fecha_realizacion, NOW()) ELSE NULL END
FROM mantenimientos mt
WHERE mt.tipo='Correctivo' AND mt.id_falla IS NULL;

UPDATE mantenimientos mt
JOIN fallas f ON f.id_maquina=mt.id_maquina AND f.descripcion LIKE CONCAT('[Correctivo #', mt.id, ']%')
SET mt.id_falla=f.id
WHERE mt.tipo='Correctivo' AND mt.id_falla IS NULL;

UPDATE maquinas m
JOIN mantenimientos mt ON mt.id_maquina=m.id
SET m.estado='Detenida'
WHERE mt.tipo='Correctivo' AND mt.estado IN ('Programado','En proceso');
