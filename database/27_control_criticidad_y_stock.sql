ALTER TABLE repuestos
  ADD COLUMN impacto_produccion TINYINT NULL AFTER criticidad,
  ADD COLUMN tiempo_reposicion_nivel TINYINT NULL AFTER impacto_produccion,
  ADD COLUMN disponibilidad_alternativa TINYINT NULL AFTER tiempo_reposicion_nivel,
  ADD COLUMN impacto_economico TINYINT NULL AFTER disponibilidad_alternativa,
  ADD COLUMN puntaje_criticidad TINYINT NULL AFTER impacto_economico,
  ADD COLUMN criticidad_validada_por VARCHAR(120) NULL AFTER puntaje_criticidad,
  ADD COLUMN criticidad_validada_en DATETIME NULL AFTER criticidad_validada_por,
  ADD COLUMN stock_verificado_por VARCHAR(120) NULL AFTER stock_verificado,
  ADD COLUMN stock_verificado_en DATETIME NULL AFTER stock_verificado_por;

CREATE INDEX idx_repuestos_criticidad_puntaje ON repuestos (criticidad, puntaje_criticidad);
