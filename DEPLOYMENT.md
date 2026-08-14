# Publicar INCAMAT en Internet

Esta guía permite ejecutar INCAMAT en un servidor, sin depender de Docker Desktop ni de la laptop de desarrollo.

## 1. Requisitos del servidor

- Servidor Linux (Ubuntu LTS recomendado), con Docker Engine y Docker Compose.
- Un dominio o subdominio, por ejemplo `incamat.tuempresa.com`.
- Acceso SSH para el responsable de TI.

## 2. Preparar el proyecto

1. Copiar el repositorio al servidor.
2. Copiar `.env.production.example` a `.env`.
3. Reemplazar todas las claves de ejemplo por contraseñas largas y únicas.
4. Definir `CORS_ORIGIN` con la dirección HTTPS definitiva.

## 3. Iniciar la aplicación

```bash
docker compose -f docker-compose.production.yml up -d --build
```

La aplicación se expone solo por el puerto 80. MariaDB queda en la red interna de Docker y no se publica a Internet.

## 4. Migrar los datos actuales

En la computadora actual, generar un respaldo de la base de datos:

```powershell
docker exec incamant-db mariadb-dump -ualyson -palyson123 incamant > incamant_respaldo.sql
```

Copiar ese archivo al servidor y restaurarlo antes de usar INCAMAT en producción:

```bash
docker compose -f docker-compose.production.yml exec -T mariadb mariadb -uincamant_app -p incamant < incamant_respaldo.sql
```

También se deben copiar las evidencias fotográficas desde `backend/uploads` al volumen `uploads_data` del servidor.

## 5. HTTPS y dominio

Un responsable de TI debe apuntar el DNS del dominio al servidor y colocar un proxy HTTPS (Nginx Proxy Manager, Caddy o Nginx con Certbot) delante de INCAMAT. No uses el sistema por Internet hasta habilitar HTTPS.

## 6. Respaldo periódico

Configurar una tarea diaria en el servidor para exportar MariaDB y guardar el archivo fuera del servidor. Probar periódicamente la restauración.

## Importante

Esta configuración quita la dependencia de la laptop, pero el servidor y sus respaldos pasan a ser responsabilidad de TI. Antes de acceso externo real debe reforzarse el inicio de sesión: contraseñas cifradas, sesiones autenticadas y permisos validados también por el backend.
