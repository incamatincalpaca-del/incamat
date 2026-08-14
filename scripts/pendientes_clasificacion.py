import json
from collections import Counter

data = json.load(open(r"C:\IncaMant\tmp\consolidado_repuestos.json", encoding="utf-8"))
pending = [row for row in data["catalogo"] if row["estado_clasificacion"] == "Pendiente"]
print("POR ÁREA", dict(Counter(row["area"] for row in pending)))
pending.sort(key=lambda row: (row["movimientos"], row["costo_acumulado"]), reverse=True)
for row in pending[:150]:
    print(f"{row['area']}|{row['codigo']}|{row['descripcion']}|mov={row['movimientos']}|costo={row['costo_acumulado']:.2f}")
