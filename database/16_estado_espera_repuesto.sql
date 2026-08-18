ALTER TABLE fallas MODIFY COLUMN estado ENUM('Reportada','En atencion','Esperando repuesto','Pendiente de validacion','Resuelta') NOT NULL DEFAULT 'Reportada';
