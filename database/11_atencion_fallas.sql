ALTER TABLE fallas ADD COLUMN IF NOT EXISTS diagnostico TEXT NULL AFTER descripcion;
ALTER TABLE fallas ADD COLUMN IF NOT EXISTS trabajo_realizado TEXT NULL AFTER diagnostico;
ALTER TABLE fallas ADD COLUMN IF NOT EXISTS atendido_por VARCHAR(120) NULL AFTER reportado_por;
ALTER TABLE fallas ADD COLUMN IF NOT EXISTS fecha_atencion DATETIME NULL AFTER fecha_reporte;
