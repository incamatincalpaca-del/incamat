-- Comunicacion operativa: avisos por perfil y area. Esta migracion solo agrega estructura.
ALTER TABLE usuarios ADD COLUMN IF NOT EXISTS id_area INT NULL;
ALTER TABLE usuarios ADD CONSTRAINT fk_usuarios_area FOREIGN KEY (id_area) REFERENCES areas(id);

CREATE TABLE IF NOT EXISTS anuncios (
  id INT AUTO_INCREMENT PRIMARY KEY,
  titulo VARCHAR(140) NOT NULL,
  mensaje TEXT NOT NULL,
  destino ENUM('Todos','Operario','Tecnico') NOT NULL DEFAULT 'Todos',
  id_area INT NULL,
  prioridad ENUM('Informativo','Importante','Urgente') NOT NULL DEFAULT 'Informativo',
  publicado_por VARCHAR(120) NOT NULL,
  publicado_en TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  fecha_fin DATE NULL,
  estado ENUM('Publicado','Borrador','Archivado') NOT NULL DEFAULT 'Publicado',
  CONSTRAINT fk_anuncios_area FOREIGN KEY (id_area) REFERENCES areas(id) ON DELETE SET NULL
);
CREATE INDEX idx_anuncios_visibilidad ON anuncios (estado, destino, id_area, publicado_en);
