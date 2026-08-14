ALTER TABLE maquinas ADD COLUMN IF NOT EXISTS descripcion_corta VARCHAR(280) NULL AFTER modelo;
UPDATE maquinas m JOIN areas a ON a.id=m.id_area SET m.descripcion_corta = CONCAT('Equipo de ', a.nombre, IF(m.marca IS NULL OR m.marca='', '', CONCAT('. Marca ', m.marca)), IF(m.modelo IS NULL OR m.modelo='', '', CONCAT(', modelo ', m.modelo)), '.') WHERE m.descripcion_corta IS NULL;
