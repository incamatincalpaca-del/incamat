CREATE TABLE IF NOT EXISTS areas (
    id INT AUTO_INCREMENT PRIMARY KEY,
    codigo VARCHAR(30) NOT NULL UNIQUE,
    nombre VARCHAR(100) NOT NULL UNIQUE,
    descripcion VARCHAR(255) NULL,
    responsable VARCHAR(120) NULL,
    estado ENUM('Activa', 'Inactiva') NOT NULL DEFAULT 'Activa',
    creado_en TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    actualizado_en TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS maquinas (
    id INT AUTO_INCREMENT PRIMARY KEY,
    codigo VARCHAR(50) NOT NULL UNIQUE,
    nombre VARCHAR(150) NOT NULL,
    id_area INT NOT NULL,
    marca VARCHAR(100) NULL,
    modelo VARCHAR(100) NULL,
    estado ENUM('Operativa', 'Mantenimiento', 'Detenida') NOT NULL DEFAULT 'Operativa',
    creado_en TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    actualizado_en TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    CONSTRAINT fk_maquinas_area FOREIGN KEY (id_area) REFERENCES areas(id)
);

CREATE TABLE IF NOT EXISTS componentes (
    id INT AUTO_INCREMENT PRIMARY KEY,
    codigo VARCHAR(60) NOT NULL UNIQUE,
    descripcion VARCHAR(180) NOT NULL,
    tipo ENUM('Mecánico', 'Eléctrico', 'Electrónico') NOT NULL,
    id_area INT NOT NULL,
    id_maquina INT NULL,
    criticidad ENUM('Crítica', 'Alta', 'Media', 'Baja') NOT NULL DEFAULT 'Media',
    stock_actual DECIMAL(12,2) NOT NULL DEFAULT 0,
    stock_minimo DECIMAL(12,2) NOT NULL DEFAULT 0,
    unidad_medida VARCHAR(30) NOT NULL DEFAULT 'unidad',
    frecuencia_solicitud ENUM('Mensual', 'Trimestral', 'Semestral', 'Anual', 'Según falla') NOT NULL DEFAULT 'Según falla',
    fecha_ultima_solicitud DATE NULL,
    tiempo_reposicion_dias INT NULL,
    ubicacion_almacen VARCHAR(100) NULL,
    creado_en TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    actualizado_en TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    CONSTRAINT fk_componentes_area FOREIGN KEY (id_area) REFERENCES areas(id),
    CONSTRAINT fk_componentes_maquina FOREIGN KEY (id_maquina) REFERENCES maquinas(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS solicitudes_componentes (
    id INT AUTO_INCREMENT PRIMARY KEY,
    id_componente INT NOT NULL,
    cantidad DECIMAL(12,2) NOT NULL,
    fecha_solicitud DATE NOT NULL,
    estado ENUM('Solicitada', 'Aprobada', 'Atendida', 'Anulada') NOT NULL DEFAULT 'Solicitada',
    solicitante VARCHAR(120) NULL,
    observacion TEXT NULL,
    creado_en TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_solicitudes_componente FOREIGN KEY (id_componente) REFERENCES componentes(id)
);

CREATE TABLE IF NOT EXISTS mantenimientos (
    id INT AUTO_INCREMENT PRIMARY KEY,
    id_maquina INT NOT NULL,
    tipo ENUM('Preventivo', 'Correctivo', 'Predictivo') NOT NULL,
    estado ENUM('Programado', 'En proceso', 'Completado', 'Cancelado') NOT NULL DEFAULT 'Programado',
    fecha_programada DATE NOT NULL,
    fecha_realizacion DATE NULL,
    responsable VARCHAR(120) NULL,
    descripcion TEXT NULL,
    observacion TEXT NULL,
    creado_en TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    actualizado_en TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    CONSTRAINT fk_mantenimientos_maquina FOREIGN KEY (id_maquina) REFERENCES maquinas(id)
);

CREATE TABLE IF NOT EXISTS importaciones (
    id INT AUTO_INCREMENT PRIMARY KEY,
    modulo ENUM('Areas', 'Maquinas', 'Componentes', 'Mantenimientos') NOT NULL,
    nombre_archivo VARCHAR(255) NOT NULL,
    usuario_importador VARCHAR(120) NULL,
    registros_creados INT NOT NULL DEFAULT 0,
    registros_actualizados INT NOT NULL DEFAULT 0,
    registros_error INT NOT NULL DEFAULT 0,
    estado ENUM('Procesado', 'Con errores', 'Fallido') NOT NULL DEFAULT 'Procesado',
    creado_en TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

INSERT IGNORE INTO areas (codigo, nombre, descripcion, responsable) VALUES
('ACA', 'Acabados', 'Área de acabados', 'Mantenimiento central'),
('CAL', 'Calidad', 'Área de control de calidad', 'Control de calidad');
