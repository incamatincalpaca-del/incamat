CREATE TABLE IF NOT EXISTS usuarios (

    id INT AUTO_INCREMENT PRIMARY KEY,

    nombre VARCHAR(100) NOT NULL,

    usuario VARCHAR(50) UNIQUE NOT NULL,

    correo VARCHAR(120),

    password VARCHAR(255) NOT NULL,

    rol ENUM('Administrador','Supervisor','Tecnico') NOT NULL,

    estado BOOLEAN DEFAULT TRUE,

    creado TIMESTAMP DEFAULT CURRENT_TIMESTAMP

);

INSERT INTO usuarios
(nombre,usuario,correo,password,rol)

VALUES
(
'Administrador',
'admin',
'admin@incamat.com',
'Admin123*',
'Administrador'
);