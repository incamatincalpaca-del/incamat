CREATE TABLE IF NOT EXISTS usuarios (
    id INT AUTO_INCREMENT PRIMARY KEY,
    nombre VARCHAR(100) NOT NULL,
    usuario VARCHAR(50) UNIQUE NOT NULL,
    correo VARCHAR(120),
    password VARCHAR(255) NULL,
    rol ENUM('Administrador','Supervisor','Tecnico','Técnico','Ingeniero','Operario') NOT NULL,
    estado BOOLEAN DEFAULT TRUE,
    creado TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
