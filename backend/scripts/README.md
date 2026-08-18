# Primera carga de datos

Los dos archivos iniciales se importan en etapas:

1. `EXCEL.xlsx` crea la jerarquía de localizaciones, vincula áreas con localizaciones y registra máquinas.
2. `CTP 7000.xlsx` crea o actualiza repuestos y registra sus vales de consumo históricos.

Cuando MariaDB esté disponible en tu equipo, desde la carpeta `backend` se ejecutará:

```powershell
$env:DB_HOST = 'localhost'
node scripts/importarCargaInicial.js 'C:\Users\Admin\Downloads\EXCEL.xlsx' 'C:\Users\Admin\Downloads\CTP 7000.xlsx'
```

## Regla importante para máquinas

El archivo inicial de máquinas no incluye un código único de máquina. Durante la primera carga el sistema debe generar un código interno. Para futuras actualizaciones, el Excel deberá incluir la columna `codigo` para que cada máquina se actualice sin ambigüedad.

## Criterio de criticidad de repuestos

La carga histórica aporta frecuencia, última solicitud y costo. La criticidad se mantiene como una evaluación separada, porque también depende del impacto de una parada, stock disponible, tiempo de reposición y posibilidad de sustitución.
