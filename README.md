# INCAMAT

Sistema de apoyo al mantenimiento industrial de Incalpaca TPX. Centraliza áreas, máquinas, componentes/repuestos, niveles de criticidad, stock y cargas masivas desde Excel.

## Flujo de importación

1. Seleccionar el módulo y el archivo Excel.
2. Revisar una vista previa y las columnas requeridas.
3. Confirmar la importación.
4. Crear o actualizar registros usando `codigo` como identificador único.
5. Consultar el historial de importaciones.

Los módulos disponibles son `Areas`, `Maquinas` y `Componentes`.

### Columnas de Excel

| Módulo | Columnas obligatorias |
| --- | --- |
| Áreas | `codigo`, `nombre` |
| Máquinas | `codigo`, `nombre`, `area` |
| Componentes | `codigo`, `descripcion`, `tipo`, `area` |

En componentes también se admiten: `maquina`, `criticidad`, `stock_actual`, `stock_minimo`, `unidad_medida`, `frecuencia_solicitud`, `fecha_ultima_solicitud`, `tiempo_reposicion_dias` y `ubicacion_almacen`.

## Base de datos

La estructura se encuentra en `database/02_incamat_schema.sql`, `database/03_repuestos_y_localizaciones.sql` y `database/04_migrar_maquinas_legacy.sql`. En una instalación nueva de MariaDB con Docker se ejecutará automáticamente junto con `01_usuarios.sql`.

1. Copia `.env.example` como `.env` y cambia las claves.
2. Inicia los servicios con `docker compose up --build`.
3. La API quedará disponible en `http://localhost:3000/api`.

> Si la base de datos ya fue creada antes de añadir `02_incamat_schema.sql`, ejecuta ese archivo una vez dentro de MariaDB. Los scripts de inicialización de Docker solo se ejecutan cuando el volumen se crea por primera vez.

## Endpoints iniciales

- `GET`, `POST` `/api/areas`
- `GET`, `POST` `/api/maquinas`
- `GET`, `POST` `/api/componentes`
- `POST` `/api/importaciones/preview`
- `POST` `/api/importaciones/procesar`
- `GET` `/api/importaciones`
