ALTER TABLE repuesto_areas
  ADD COLUMN ultima_solicitud DATE NULL AFTER costo_acumulado;

CREATE INDEX idx_repuesto_areas_ultima_solicitud
  ON repuesto_areas (ultima_solicitud);
