-- Migración para instalaciones que ya tenían la tabla antigua de máquinas.
ALTER TABLE maquinas ADD COLUMN IF NOT EXISTS codigo VARCHAR(50) NULL AFTER id;
ALTER TABLE maquinas ADD COLUMN IF NOT EXISTS nombre VARCHAR(150) NULL AFTER codigo;
ALTER TABLE maquinas ADD COLUMN IF NOT EXISTS id_area INT NULL AFTER nombre;

UPDATE maquinas
SET nombre = COALESCE(NULLIF(TRIM(nombre), ''), maquina),
    codigo = COALESCE(NULLIF(TRIM(codigo), ''), CONCAT('M-LEGACY-', LPAD(id, 6, '0')))
WHERE nombre IS NULL OR nombre = '' OR codigo IS NULL OR codigo = '';

ALTER TABLE maquinas ADD UNIQUE KEY uq_maquinas_codigo (codigo);
