ALTER TABLE solicitudes_externas
  ADD COLUMN id_importacion INT NULL,
  ADD CONSTRAINT fk_solicitudes_externas_importacion
    FOREIGN KEY (id_importacion) REFERENCES importaciones(id) ON DELETE SET NULL;

CREATE INDEX idx_solicitudes_externas_importacion
  ON solicitudes_externas(id_importacion);
