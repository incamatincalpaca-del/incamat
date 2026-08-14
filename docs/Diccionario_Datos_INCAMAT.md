# Diccionario de datos — INCAMAT

| Entidad | Propósito | Datos principales |
|---|---|---|
| `usuarios` | Control de acceso | nombre, usuario, correo, rol, estado, password_hash |
| `areas` | Organización de planta | código, nombre, descripción, responsable |
| `localizaciones` | Jerarquía física | nivel, nombre, localización padre |
| `maquinas` | Activos industriales | código, nombre, área, marca, modelo, estado, qr_token |
| `fallas` | Incidencias y órdenes correctivas | máquina, prioridad, descripción, fechas, diagnóstico, causa, evidencias, estado |
| `mantenimientos` | Preventivos y checklist | máquina, tipo, fecha programada/real, responsable, estado, checklist |
| `historial_mantenimiento_excel` | Historial importado | id de registro, máquina, fecha, tipo original, técnicos, OT, duración, detalles |
| `repuestos` | Catálogo e inventario | código, descripción, familia, criticidad, stock, ubicación, costo y reposición |
| `movimientos_repuestos` | Trazabilidad de inventario | repuesto, máquina, fecha, cantidad, vale, estado, autorización |
| `solicitudes_repuestos` | Flujo de abastecimiento | área, máquina opcional, repuesto, prioridad, solicitante, estado |
| `importaciones` | Auditoría de cargas Excel | módulo, archivo, importador, fechas, creados, actualizados, errores, estado |

Las fotografías se almacenan como evidencia asociada a la incidencia. La clasificación de datos, retención, respaldo y permisos finales son definidos por TIC según la política vigente.
