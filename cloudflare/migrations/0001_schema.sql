PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS usuarios (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  nombre TEXT NOT NULL, usuario TEXT NOT NULL UNIQUE, correo TEXT,
  rol TEXT NOT NULL, password_hash TEXT NOT NULL, estado INTEGER NOT NULL DEFAULT 1,
  creado TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS areas (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  codigo TEXT NOT NULL UNIQUE, nombre TEXT NOT NULL UNIQUE, descripcion TEXT,
  responsable TEXT, estado TEXT NOT NULL DEFAULT 'Activa', creado_en TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS maquinas (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  codigo TEXT NOT NULL UNIQUE, nombre TEXT NOT NULL, id_area INTEGER NOT NULL,
  marca TEXT, modelo TEXT, descripcion_corta TEXT, estado TEXT NOT NULL DEFAULT 'Operativa', qr_token TEXT UNIQUE,
  FOREIGN KEY (id_area) REFERENCES areas(id)
);

CREATE TABLE IF NOT EXISTS repuestos (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  codigo TEXT NOT NULL UNIQUE, descripcion TEXT NOT NULL, familia_tecnica TEXT,
  criticidad TEXT NOT NULL DEFAULT 'Sin evaluar', stock_actual REAL NOT NULL DEFAULT 0,
  stock_minimo REAL NOT NULL DEFAULT 0, stock_verificado INTEGER NOT NULL DEFAULT 0,
  unidad TEXT, ubicacion TEXT, costo_ultimo REAL, fecha_ultima_solicitud TEXT
);
CREATE TABLE IF NOT EXISTS repuestos_areas (
  id_repuesto INTEGER NOT NULL, id_area INTEGER NOT NULL,
  PRIMARY KEY(id_repuesto,id_area), FOREIGN KEY(id_repuesto) REFERENCES repuestos(id), FOREIGN KEY(id_area) REFERENCES areas(id)
);

CREATE TABLE IF NOT EXISTS fallas (
  id INTEGER PRIMARY KEY AUTOINCREMENT, id_maquina INTEGER NOT NULL, prioridad TEXT NOT NULL DEFAULT 'Media',
  descripcion TEXT NOT NULL, estado TEXT NOT NULL DEFAULT 'Reportada', fecha_reporte TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  fecha_resolucion TEXT, FOREIGN KEY(id_maquina) REFERENCES maquinas(id)
);
CREATE TABLE IF NOT EXISTS mantenimientos (
  id INTEGER PRIMARY KEY AUTOINCREMENT, id_maquina INTEGER NOT NULL, id_falla INTEGER, tipo TEXT NOT NULL,
  modalidad TEXT, estado TEXT NOT NULL DEFAULT 'Programado', fecha_programada TEXT NOT NULL,
  fecha_realizacion TEXT, responsable TEXT, descripcion TEXT, observacion TEXT, checklist TEXT,
  FOREIGN KEY(id_maquina) REFERENCES maquinas(id), FOREIGN KEY(id_falla) REFERENCES fallas(id)
);
