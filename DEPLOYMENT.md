# Instalación interna de INCAMAT

Este procedimiento es para el equipo TIC de Incalpaca. INCAMAT no debe publicarse desde una laptop, túnel temporal o cuenta personal.

## Alcance

- Servidor interno administrado por TIC, con Docker Engine y Docker Compose.
- Nombre interno definido por TIC, por ejemplo `http://incamat.incalpaca.local`.
- MariaDB no se expone a la red; únicamente se comunica con el backend en la red privada de Docker.
- El puerto 80 debe quedar disponible solo desde las redes y perfiles autorizados por TIC.

## Preparación segura

1. Copiar el código fuente aprobado a un repositorio corporativo o al servidor administrado por TIC.
2. Copiar `.env.production.example` como `.env` en el servidor. Ese archivo no se entrega ni se sube a ningún repositorio.
3. Definir claves únicas de al menos 12 caracteres para MariaDB y un `AUTH_SECRET` de 32 caracteres o más.
4. Definir `CORS_ORIGIN` y `PUBLIC_APP_URL` con el nombre interno definitivo. Los QR generados después de esto dirigirán a ese nombre.
5. Definir `INITIAL_ADMIN_*` una sola vez para la instalación vacía. Tras crear al administrador, TIC debe retirar `INITIAL_ADMIN_PASSWORD` del archivo de entorno.

## Inicio

```bash
docker compose -f docker-compose.production.yml up -d --build
docker compose -f docker-compose.production.yml ps
```

TIC debe verificar inicio de sesión, permisos por rol, importación, evidencia fotográfica, QR y restauración antes de publicar. La constancia se registra en el acta de verificación correspondiente.

## Migración de datos

El respaldo y la restauración los ejecuta TIC desde un terminal seguro; no se incluyen contraseñas en los comandos ni documentación pública. Además de la base MariaDB deben trasladarse las evidencias almacenadas en el volumen `uploads_data`.

## Respaldo y continuidad

- Programar respaldo diario de MariaDB y del volumen de evidencias hacia una ubicación corporativa separada.
- Restringir lectura del respaldo a TIC autorizado.
- Conservar la periodicidad definida por TIC y probar una restauración al menos una vez al año.
- Documentar cada prueba de restauración y cualquier cambio de acceso.

## No autorizado para producción

- Cloudflare Tunnel, enlaces `trycloudflare.com`, GitHub personal, Google Cloud personal o la laptop de la pasante.
- Contraseñas en archivos, chats, capturas o repositorios.
- Acceso a MariaDB por un puerto público o desde Internet.
