CREATE TABLE IF NOT EXISTS historial_mantenimiento_excel (
  id INT AUTO_INCREMENT PRIMARY KEY,
  id_registro VARCHAR(80) NOT NULL,
  id_maquina INT NULL,
  codigo_maquina_origen VARCHAR(80) NULL,
  maquina_origen VARCHAR(180) NOT NULL,
  fecha DATE NOT NULL,
  tecnicos VARCHAR(255) NULL,
  tipo_original VARCHAR(80) NOT NULL,
  ot VARCHAR(80) NULL,
  codigo_mantenimiento VARCHAR(120) NULL,
  duracion_original VARCHAR(80) NULL,
  detalles TEXT NULL,
  repuestos_materiales TEXT NULL,
  foto_evidencia VARCHAR(500) NULL,
  revisado VARCHAR(120) NULL,
  id_importacion INT NULL,
  creado_en TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  actualizado_en TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uq_historial_mantenimiento_registro (id_registro),
  KEY idx_historial_mantenimiento_fecha (fecha),
  KEY idx_historial_mantenimiento_tipo (tipo_original),
  KEY idx_historial_mantenimiento_maquina (id_maquina),
  CONSTRAINT fk_historial_mantenimiento_maquina FOREIGN KEY (id_maquina) REFERENCES maquinas(id) ON DELETE SET NULL,
  CONSTRAINT fk_historial_mantenimiento_importacion FOREIGN KEY (id_importacion) REFERENCES importaciones(id) ON DELETE SET NULL
);

ALTER TABLE importaciones
  MODIFY COLUMN modulo ENUM('Areas','Maquinas','Componentes','Mantenimientos','Estructura','Repuestos','Movimientos de repuestos','MantenimientoSRequest','MantenimientoHistorico') NOT NULL;
