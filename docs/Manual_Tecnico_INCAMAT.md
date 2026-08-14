# Manual técnico — INCAMAT

## Arquitectura

INCAMAT consta de React/Vite (interfaz), Express/Node.js (API), MariaDB (datos) y volúmenes Docker para base de datos y evidencias. El frontend se comunica con la API mediante `/api`; MariaDB no tiene puerto publicado.

## Seguridad implementada

- Sesiones firmadas con expiración de 12 horas.
- Contraseñas con hash scrypt y comparación segura.
- Creación de usuarios solo por Administrador autenticado.
- Regla de contraseña: mínimo 12 caracteres, mayúscula, minúscula, número y símbolo.
- CORS limitado a `CORS_ORIGIN`; sin túneles temporales admitidos.
- Límites de carga de evidencia: JPG, PNG o WEBP, máximo 5 MB.
- Cabeceras `X-Content-Type-Options`, `X-Frame-Options` y `Referrer-Policy`.
- QR basado en `PUBLIC_APP_URL`, destinado a la red interna.

## Variables privadas

`MARIADB_ROOT_PASSWORD`, `MARIADB_PASSWORD`, `AUTH_SECRET`, `INITIAL_ADMIN_*`, `CORS_ORIGIN` y `PUBLIC_APP_URL` se configuran exclusivamente en el servidor TIC. No deben incluirse en el repositorio ni compartirse por correo/chat.

## Operación

Usar `docker compose -f docker-compose.production.yml up -d --build` para iniciar y `docker compose -f docker-compose.production.yml ps` para verificar contenedores. Las actualizaciones deben respaldarse y pasar la validación TIC antes de aplicarse.
