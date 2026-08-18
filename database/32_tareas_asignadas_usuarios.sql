-- Asignación administrativa de tareas a ingenieros y personal técnico.
-- Esta migración es aditiva: no modifica usuarios ni registros existentes.
CREATE TABLE IF NOT EXISTS tareas_asignadas (
  id INT AUTO_INCREMENT PRIMARY KEY,
  codigo VARCHAR(40) NOT NULL UNIQUE,
  id_usuario INT NOT NULL,
  id_area INT NULL,
  tarea VARCHAR(255) NOT NULL,
  prioridad ENUM('Baja','Media','Alta','Critica') NOT NULL DEFAULT 'Media',
  fecha_asignacion DATE NOT NULL,
  fecha_limite DATE NULL,
  estado ENUM('Asignada','En progreso','Completada','Cancelada') NOT NULL DEFAULT 'Asignada',
  observaciones TEXT NULL,
  asignado_por VARCHAR(120) NOT NULL,
  creado_en TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  actualizado_en TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_tareas_usuario FOREIGN KEY (id_usuario) REFERENCES usuarios(id),
  CONSTRAINT fk_tareas_area FOREIGN KEY (id_area) REFERENCES areas(id) ON DELETE SET NULL,
  INDEX idx_tareas_usuario_estado (id_usuario, estado, fecha_limite),
  INDEX idx_tareas_area (id_area)
);
