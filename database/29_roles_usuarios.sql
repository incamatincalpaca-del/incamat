-- Perfiles de acceso para INCAMAT.
ALTER TABLE usuarios
  MODIFY rol ENUM('Administrador', 'Supervisor', 'Tecnico', 'Técnico', 'Ingeniero', 'Operario') NOT NULL;

-- Los usuarios se crean desde INCAMAT por un Administrador autorizado.
-- No se distribuyen contraseñas iniciales en archivos SQL.
