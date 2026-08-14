CREATE TABLE IF NOT EXISTS solicitudes_repuestos (
  id INT AUTO_INCREMENT PRIMARY KEY,
  numero VARCHAR(32) NOT NULL UNIQUE,
  id_area INT NOT NULL,
  id_maquina INT NULL,
  id_repuesto INT NOT NULL,
  cantidad_solicitada DECIMAL(12,2) NOT NULL,
  prioridad ENUM('Baja','Media','Alta','Crítica') NOT NULL DEFAULT 'Media',
  motivo VARCHAR(500) NULL,
  solicitado_por VARCHAR(120) NOT NULL,
  estado ENUM('Solicitada','Aprobada','Entregada','Rechazada') NOT NULL DEFAULT 'Solicitada',
  aprobado_por VARCHAR(120) NULL,
  entregado_por VARCHAR(120) NULL,
  fecha_solicitud DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  fecha_aprobacion DATETIME NULL,
  fecha_entrega DATETIME NULL,
  observacion_decision VARCHAR(500) NULL,
  creado_en DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  actualizado_en DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_solicitud_area FOREIGN KEY (id_area) REFERENCES areas(id),
  CONSTRAINT fk_solicitud_maquina FOREIGN KEY (id_maquina) REFERENCES maquinas(id) ON DELETE SET NULL,
  CONSTRAINT fk_solicitud_repuesto FOREIGN KEY (id_repuesto) REFERENCES repuestos(id)
);

CREATE INDEX idx_solicitudes_estado ON solicitudes_repuestos(estado);
CREATE INDEX idx_solicitudes_area_fecha ON solicitudes_repuestos(id_area, fecha_solicitud);
