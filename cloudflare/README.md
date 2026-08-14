# INCAMAT en Cloudflare: migración controlada

La aplicación actual se ejecuta con tres servicios: React/Vite, API Express y MariaDB. Cloudflare Workers no ejecuta directamente Express ni MariaDB, por lo que la publicación completa requiere una migración de la API a Workers y de los datos a D1.

## Lo que se conserva

- La instalación local con Docker y MariaDB permanece como entorno de respaldo.
- Los archivos Excel y la base de datos local no se incorporan al repositorio público.
- La migración debe cargar los datos a una base D1 privada, nunca al código fuente.

## Publicación segura

1. Crear una base D1 privada llamada `incamat-db` en la cuenta institucional de Cloudflare.
2. Crear el Worker `incamat` desde este repositorio.
3. Vincular D1 al Worker con el binding `DB`.
4. Ejecutar la migración y la carga inicial desde un equipo autorizado.
5. Confirmar que login, áreas, máquinas, órdenes, repuestos e importaciones respondan antes de distribuir el enlace.

> No se debe usar el botón Deploy con un `wrangler deploy` genérico hasta que el Worker y el binding D1 estén listos; hacerlo solo publicaría una interfaz sin la API completa.
