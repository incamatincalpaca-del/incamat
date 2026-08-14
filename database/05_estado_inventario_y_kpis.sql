ALTER TABLE repuestos MODIFY COLUMN criticidad ENUM('Sin evaluar', 'Crítica', 'Alta', 'Media', 'Baja') NOT NULL DEFAULT 'Sin evaluar';
ALTER TABLE repuestos ADD COLUMN IF NOT EXISTS stock_verificado BOOLEAN NOT NULL DEFAULT FALSE AFTER stock_minimo;
UPDATE repuestos SET criticidad = 'Sin evaluar' WHERE criticidad = 'Media';
