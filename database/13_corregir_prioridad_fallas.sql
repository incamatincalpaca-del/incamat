ALTER TABLE fallas MODIFY COLUMN prioridad ENUM('Baja','Media','Alta','Crítica') NOT NULL DEFAULT 'Media';
