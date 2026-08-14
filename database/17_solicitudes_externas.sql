CREATE TABLE IF NOT EXISTS solicitudes_externas (
  id INT AUTO_INCREMENT PRIMARY KEY,
  numero_solicitud VARCHAR(40) NOT NULL UNIQUE,
  urgente BOOLEAN NOT NULL DEFAULT FALSE,
  fecha_reporte DATETIME NULL,
  tiene_foto BOOLEAN NOT NULL DEFAULT FALSE,
  descripcion TEXT NOT NULL,
  empresa_origen VARCHAR(160) NULL,
  departamento_origen VARCHAR(180) NULL,
  usuario_solicitante VARCHAR(160) NULL,
  estado_origen VARCHAR(100) NULL,
  fecha_inicio DATETIME NULL,
  fecha_termino DATETIME NULL,
  tiene_qr BOOLEAN NOT NULL DEFAULT FALSE,
  id_area INT NULL,
  ruta_localizacion VARCHAR(800) NULL,
  estado_incamat VARCHAR(50) NOT NULL DEFAULT 'Reportada',
  creado_en DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  actualizado_en DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_solicitud_externa_area FOREIGN KEY (id_area) REFERENCES areas(id) ON DELETE SET NULL
);

CREATE INDEX idx_solicitudes_externas_area ON solicitudes_externas(id_area);
