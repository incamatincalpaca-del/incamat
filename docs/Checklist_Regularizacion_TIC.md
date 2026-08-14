# Checklist de regularización TIC — INCAMAT

Estado técnico preparado; los campos de aprobación solo pueden ser completados por Incalpaca/TIC.

| Control | Evidencia entregable | Responsable | Estado |
|---|---|---|---|
| Notificación del desarrollo | FOR-GAD-TIC-001 completado y registro asignado | Dueño del proceso + TIC | Pendiente formal |
| Evaluación de herramientas | ACT-GAD-TIC-001 | TIC | Pendiente formal |
| Seguridad y publicación | ACT-GAD-TIC-002 | TIC | Pendiente formal |
| Código fuente | Repositorio corporativo o custodia TIC | TIC | Pendiente transferencia |
| Instalación | `docker-compose.production.yml` y `.env` privado | TIC | Preparado |
| Datos | Respaldo MariaDB y volumen de evidencias | TIC | Pendiente ejecución |
| Accesos | Usuarios y roles administrados desde INCAMAT | Administrador autorizado | Implementado |
| Contraseñas | Hash scrypt, regla mínima de 12 caracteres | INCAMAT/TIC | Implementado |
| Cuentas existentes | Rotar cualquier clave anterior que no cumpla la regla | Administrador autorizado | Pendiente operativo |
| QR | `PUBLIC_APP_URL` interno configurado | TIC | Pendiente hostname |
| Backup | Tarea diaria y prueba anual de restauración | TIC | Pendiente programación |
| Manual técnico/usuario | Documentos en `docs/` | Dueño del proceso + TIC | Preparado |

## Roles implementados

- **Operario:** reporta incidencias desde QR.
- **Técnico:** consulta equipos, incidencias, órdenes y repuestos; atiende/cierra órdenes y solicita repuestos.
- **Ingeniero:** administra planificación, activos, catálogo e importaciones.
- **Administrador:** además gestiona usuarios, permisos y eliminación de importaciones.

La interfaz oculta opciones no autorizadas y el backend valida los permisos en rutas operativas. TIC debe probar cada rol en la verificación previa a publicación.
