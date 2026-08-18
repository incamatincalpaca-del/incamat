ALTER TABLE fallas MODIFY COLUMN estado ENUM('Reportada','En atención','En atencion','Resuelta') NOT NULL DEFAULT 'Reportada';
ALTER TABLE fallas ADD COLUMN IF NOT EXISTS evidencia_url VARCHAR(500) NULL AFTER descripcion;
