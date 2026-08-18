ALTER TABLE fallas ADD COLUMN IF NOT EXISTS fecha_ocurrencia DATETIME NULL AFTER fecha_reporte;
ALTER TABLE fallas ADD COLUMN IF NOT EXISTS causa_tipo VARCHAR(40) NULL AFTER diagnostico;
ALTER TABLE fallas ADD COLUMN IF NOT EXISTS evidencia_final_url VARCHAR(500) NULL AFTER evidencia_url;
ALTER TABLE fallas ADD COLUMN IF NOT EXISTS observacion_decision VARCHAR(500) NULL AFTER trabajo_realizado;
UPDATE fallas SET fecha_ocurrencia=fecha_reporte WHERE fecha_ocurrencia IS NULL;
