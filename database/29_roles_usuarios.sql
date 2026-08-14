-- Perfiles de acceso para INCAMAT.
ALTER TABLE usuarios
  MODIFY rol ENUM('Administrador', 'Supervisor', 'Tecnico', 'Técnico', 'Ingeniero', 'Operario') NOT NULL;

INSERT INTO usuarios (nombre, usuario, correo, password, rol, estado)
VALUES
  ('Operario de planta', 'operario', 'operario@incamat.local', 'Operario*123', 'Operario', TRUE),
  ('Técnico de mantenimiento', 'tecnico', 'tecnico@incamat.local', 'Tecnico123*', 'Técnico', TRUE),
  ('Ingeniero de mantenimiento', 'ingeniero', 'ingeniero@incamat.local', 'Ingeniero123*', 'Ingeniero', TRUE)
ON DUPLICATE KEY UPDATE
  nombre = VALUES(nombre),
  correo = VALUES(correo),
  rol = VALUES(rol),
  estado = VALUES(estado);
