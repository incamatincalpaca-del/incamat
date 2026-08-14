ALTER TABLE maquinas ADD COLUMN IF NOT EXISTS qr_token VARCHAR(80) NULL UNIQUE AFTER codigo;
UPDATE maquinas SET qr_token = CONCAT('INCAMAT-', id, '-', SUBSTRING(MD5(CONCAT(codigo, id)), 1, 10)) WHERE qr_token IS NULL;

CREATE TABLE IF NOT EXISTS fallas (
  id INT AUTO_INCREMENT PRIMARY KEY,
  id_maquina INT NOT NULL,
  prioridad ENUM('Baja', 'Media', 'Alta', 'Crítica') NOT NULL DEFAULT 'Media',
  estado ENUM('Reportada', 'En atención', 'Resuelta') NOT NULL DEFAULT 'Reportada',
  descripcion TEXT NOT NULL,
  reportado_por VARCHAR(120) NULL,
  fecha_reporte DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  fecha_resolucion DATETIME NULL,
  creado_en TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_fallas_maquina FOREIGN KEY (id_maquina) REFERENCES maquinas(id)
);

ALTER TABLE mantenimientos ADD COLUMN IF NOT EXISTS id_falla INT NULL AFTER id_maquina;
ALTER TABLE mantenimientos ADD CONSTRAINT fk_mantenimientos_falla FOREIGN KEY (id_falla) REFERENCES fallas(id) ON DELETE SET NULL;
