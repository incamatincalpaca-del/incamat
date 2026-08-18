ALTER TABLE repuestos
  ADD COLUMN familia_tecnica ENUM('Mecanico','Electrico','Electronico','Sin clasificar') NOT NULL DEFAULT 'Sin clasificar' AFTER descripcion,
  ADD COLUMN subfamilia_tecnica VARCHAR(100) NULL AFTER familia_tecnica,
  ADD COLUMN estado_clasificacion ENUM('Pendiente','Sugerida','Validada') NOT NULL DEFAULT 'Pendiente' AFTER subfamilia_tecnica;

CREATE INDEX idx_repuestos_familia_tecnica ON repuestos(familia_tecnica, estado_clasificacion);
