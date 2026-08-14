ALTER TABLE mantenimientos
  MODIFY COLUMN tipo ENUM('Preventivo','Correctivo','Predictivo','Proactivo') NOT NULL;

ALTER TABLE mantenimientos
  ADD COLUMN IF NOT EXISTS modalidad VARCHAR(30) NULL AFTER tipo;

UPDATE mantenimientos
SET modalidad = 'Planificado'
WHERE tipo = 'Preventivo' AND modalidad IS NULL;
