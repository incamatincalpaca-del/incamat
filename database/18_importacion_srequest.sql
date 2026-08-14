ALTER TABLE importaciones
  MODIFY COLUMN modulo ENUM('Areas','Maquinas','Componentes','Mantenimientos','Estructura','Repuestos','Movimientos de repuestos','MantenimientoSRequest') NOT NULL;
