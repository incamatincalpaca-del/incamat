ALTER TABLE movimientos_repuestos
  ADD COLUMN id_area INT NULL AFTER id_repuesto,
  ADD CONSTRAINT fk_movimientos_area FOREIGN KEY (id_area) REFERENCES areas(id) ON DELETE SET NULL;

CREATE INDEX idx_movimientos_area_fecha ON movimientos_repuestos(id_area, fecha_movimiento);
