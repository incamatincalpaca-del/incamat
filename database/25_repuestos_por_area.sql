ALTER TABLE repuestos
  MODIFY COLUMN familia_tecnica ENUM('Mecanico','Electrico','Electronico','Consumible','Sin clasificar') NOT NULL DEFAULT 'Sin clasificar';

CREATE TABLE IF NOT EXISTS repuesto_areas (
  id_repuesto INT NOT NULL,
  id_area INT NOT NULL,
  movimientos_historicos INT NOT NULL DEFAULT 0,
  cantidad_consumida DECIMAL(16,2) NOT NULL DEFAULT 0,
  costo_acumulado DECIMAL(16,2) NOT NULL DEFAULT 0,
  maquinas_origen TEXT NULL,
  archivos_origen TEXT NULL,
  actualizado_en TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id_repuesto, id_area),
  CONSTRAINT fk_repuesto_areas_repuesto FOREIGN KEY (id_repuesto) REFERENCES repuestos(id) ON DELETE CASCADE,
  CONSTRAINT fk_repuesto_areas_area FOREIGN KEY (id_area) REFERENCES areas(id) ON DELETE CASCADE
);
