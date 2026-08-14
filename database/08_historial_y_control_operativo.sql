ALTER TABLE mantenimientos ADD COLUMN IF NOT EXISTS checklist JSON NULL AFTER descripcion;
ALTER TABLE mantenimientos ADD COLUMN IF NOT EXISTS evidencia_url VARCHAR(500) NULL AFTER checklist;
ALTER TABLE movimientos_repuestos ADD COLUMN IF NOT EXISTS id_maquina INT NULL AFTER id_repuesto;
ALTER TABLE movimientos_repuestos ADD COLUMN IF NOT EXISTS id_mantenimiento INT NULL AFTER id_maquina;
ALTER TABLE movimientos_repuestos ADD CONSTRAINT fk_movimientos_maquina FOREIGN KEY (id_maquina) REFERENCES maquinas(id) ON DELETE SET NULL;
ALTER TABLE movimientos_repuestos ADD CONSTRAINT fk_movimientos_mantenimiento FOREIGN KEY (id_mantenimiento) REFERENCES mantenimientos(id) ON DELETE SET NULL;
