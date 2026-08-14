ALTER TABLE fallas MODIFY COLUMN prioridad ENUM('Baja','Media','Alta','Critica') NOT NULL DEFAULT 'Media';
