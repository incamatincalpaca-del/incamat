-- Extiende el modelo inicial con las entidades reales encontradas en los Excel.

CREATE TABLE IF NOT EXISTS localizaciones (
    id INT AUTO_INCREMENT PRIMARY KEY,
    nombre VARCHAR(150) NOT NULL,
    nivel TINYINT NOT NULL,
    id_padre INT NULL,
    ruta VARCHAR(800) NOT NULL UNIQUE,
    creado_en TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_localizaciones_padre FOREIGN KEY (id_padre) REFERENCES localizaciones(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS area_localizaciones (
    id_area INT NOT NULL,
    id_localizacion INT NOT NULL,
    PRIMARY KEY (id_area, id_localizacion),
    CONSTRAINT fk_area_localizaciones_area FOREIGN KEY (id_area) REFERENCES areas(id) ON DELETE CASCADE,
    CONSTRAINT fk_area_localizaciones_localizacion FOREIGN KEY (id_localizacion) REFERENCES localizaciones(id) ON DELETE CASCADE
);

ALTER TABLE maquinas ADD COLUMN IF NOT EXISTS id_localizacion INT NULL AFTER id_area;
ALTER TABLE maquinas ADD CONSTRAINT fk_maquinas_localizacion FOREIGN KEY (id_localizacion) REFERENCES localizaciones(id) ON DELETE SET NULL;

CREATE TABLE IF NOT EXISTS repuestos (
    id INT AUTO_INCREMENT PRIMARY KEY,
    codigo VARCHAR(60) NOT NULL UNIQUE,
    descripcion VARCHAR(180) NOT NULL,
    unidad_medida VARCHAR(30) NOT NULL DEFAULT 'unidad',
    criticidad ENUM('Crítica', 'Alta', 'Media', 'Baja') NOT NULL DEFAULT 'Media',
    stock_actual DECIMAL(12,2) NOT NULL DEFAULT 0,
    stock_minimo DECIMAL(12,2) NOT NULL DEFAULT 0,
    frecuencia_solicitud ENUM('Mensual', 'Trimestral', 'Semestral', 'Anual', 'Según falla') NOT NULL DEFAULT 'Según falla',
    fecha_ultima_solicitud DATE NULL,
    tiempo_reposicion_dias INT NULL,
    ubicacion_almacen VARCHAR(100) NULL,
    costo_ultimo DECIMAL(14,4) NULL,
    creado_en TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    actualizado_en TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS componente_repuestos (
    id_componente INT NOT NULL,
    id_repuesto INT NOT NULL,
    cantidad_referencial DECIMAL(12,2) NULL,
    PRIMARY KEY (id_componente, id_repuesto),
    CONSTRAINT fk_componente_repuestos_componente FOREIGN KEY (id_componente) REFERENCES componentes(id) ON DELETE CASCADE,
    CONSTRAINT fk_componente_repuestos_repuesto FOREIGN KEY (id_repuesto) REFERENCES repuestos(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS movimientos_repuestos (
    id INT AUTO_INCREMENT PRIMARY KEY,
    id_repuesto INT NOT NULL,
    numero_vale VARCHAR(50) NOT NULL,
    fecha_movimiento DATE NOT NULL,
    cantidad DECIMAL(12,2) NOT NULL,
    estado VARCHAR(60) NULL,
    pci VARCHAR(50) NULL,
    centro_costo VARCHAR(160) NULL,
    maquina_origen VARCHAR(160) NULL,
    autorizado_por VARCHAR(120) NULL,
    costo_unitario DECIMAL(14,4) NULL,
    costo_total DECIMAL(14,4) NULL,
    observaciones TEXT NULL,
    ubicacion VARCHAR(100) NULL,
    creado_en TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY uq_movimiento_vale_repuesto (numero_vale, id_repuesto),
    CONSTRAINT fk_movimientos_repuesto FOREIGN KEY (id_repuesto) REFERENCES repuestos(id)
);

ALTER TABLE importaciones MODIFY COLUMN modulo ENUM('Areas', 'Maquinas', 'Componentes', 'Mantenimientos', 'Estructura', 'Repuestos', 'Movimientos de repuestos') NOT NULL;
