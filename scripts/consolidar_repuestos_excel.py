from pathlib import Path
import json
import re
from collections import defaultdict
import pandas as pd

SOURCE = Path(r"C:\excel completo")
OUTPUT = Path(r"C:\IncaMant\tmp\consolidado_repuestos.json")

AREA_BY_FILE = {
    "3100 HILANDERIA.xlsx": "HILANDERÍA", "3101 GARNET HILANDERIA.xlsx": "HILANDERÍA", "3103 SALA DE MEZCLAS HILANDERIA.xlsx": "HILANDERÍA", "3104 CARDADO HILANDERIA.xlsx": "HILANDERÍA", "3105 HILAT. CONTINUA - HILANDERIA.xlsx": "HILANDERÍA", "3106 RETORCIDO HILANDERIA.xlsx": "HILANDERÍA", "3107 MADEJADO DEVANADO HILANDERIA.xlsx": "HILANDERÍA", "3108 HILANDERIA CARDADA .xlsx": "HILANDERÍA",
    "3400 ACABADOS TELA.xlsx": "Acabado de Telas", "3403 LAVADORA EN CUERDA ACABADOS TELA.xlsx": "Acabado de Telas", "3405 BATANADO ACABADOS TELA.xlsx": "Acabado de Telas", "3406 CENTRIFUGA Y FOULARD ACABADOS TELA.xlsx": "Acabado de Telas", "3407 SECADORA ACABADOS TELA.xlsx": "Acabado de Telas", "3408 PERCHA METALICA ACABADOS TELA.xlsx": "Acabado de Telas", "3409 PERCHA CARDO ACABADOS TELA.xlsx": "Acabado de Telas",
    "ALFOMBRAS.xlsx": "CTP", "CTP 7000 (1).xlsx": "CTP", "CTP 7010.xlsx": "CTP", "CTP 7020.xlsx": "CTP", "CTP 7030.xlsx": "CTP",
    "REPUESTOS SHIMA MAFER 2026... (1).xlsx": "TEJIDO PUNTO", "TELARES.xlsx": "TEJIDO PLANO", "ZURCIDO.xlsx": "ZURCIDO",
}

FAMILIES = [
    ("Electronico", "Control y automatización", ["plc", "tarjeta", "transistor", "mosfet", "sensor", "encoder", "variador", "inverter", "display", "cpu", "modulo", "módulo", "controlador", "driver", "fotocelula", "fotocélula", "cronometro digital", "cronómetro digital", "key card", "chip", "circuito", "microprocesador"]),
    ("Electrico", "Potencia y maniobra", ["motor", "contactor", "rele", "relé", "arrancador", "transformador", "cable", "fusible", "interruptor", "switch", "breaker", "guardamotor", "bobina", "electrovalvula", "electroválvula", "conector", "conduit", "termico", "térmico", "solenoide", "condensador", "capacitor", "balastro", "socket", "tomacorriente", "resistencia", "lampara", "lámpara", "fluor", "terminal electrico", "terminal eléctrico"]),
    ("Mecanico", "Transmisión y elementos mecánicos", ["rodaje", "rodamiento", "bearing", "correa", "cadena", "engran", "gear", "valvula", "válvula", "aguja", "needle", "cuchilla", "blade", "carrete", "prensatela", "trampa", "buje", "eje", "polea", "resorte", "sello", "empaque", "filtro", "piston", "pistón", "cilindro", "faja", "belt", "timing", "stitch", "presser", "brush", "tobera", "barra", "tensor", "tension", "guia", "guía", "goma", "oring", "o-ring", "rubber", "impel", "mola", "acoplamiento", "coupling", "gancho", "hook", "lanza", "peine", "pin", "jack", "slider", "spacer", "espaciador", "washer", "arandela", "reten", "retén", "cabeza", "cuerpo", "tapa", "cap", "pivote", "pivot", "racord", "raccord", "llave", "teflon", "teflón", "lubricacion", "lubricación", "dispositivo"]),
]

def norm(value):
    return re.sub(r"\s+", " ", str(value or "").strip())

def article_code(value):
    """Conserva el código fuente sin agregar decimales al leer celdas numéricas."""
    if isinstance(value, float) and value.is_integer():
        return str(int(value))
    return norm(value)

def canon(value):
    return norm(value).lower().replace("á", "a").replace("é", "e").replace("í", "i").replace("ó", "o").replace("ú", "u")

def safe_number(value):
    try:
        number = float(value)
        return number if number == number else 0
    except (ValueError, TypeError):
        return 0

def classification(description, area="", code=""):
    text = canon(description)
    if any(word in text for word in ["tessilina", "parafina", "carton", "cartón", "tk clean", "artileim", "corcho", "conos carton", "frasco", "quimico", "químico", "detergente", "lubricante", "aceite", "hilo", "cinta adhesiva"]):
        return "Consumible", "Material operativo", "Sugerida", "Regla de consumible por descripción"
    for family, subfamily, words in FAMILIES:
        if any(word in text for word in words):
            return family, subfamily, "Sugerida", "Regla por descripción"
    numeric_code = re.sub(r"\D", "", str(code))
    # Códigos OEM repetidos de Shima y telares: son piezas de máquina cuando no contienen una señal eléctrica/electrónica.
    if area == "TEJIDO PUNTO" and numeric_code.startswith(("13", "14")):
        return "Mecanico", "Pieza OEM de tejido de punto", "Sugerida", "Regla por área y código OEM"
    if area == "TEJIDO PLANO" and numeric_code.startswith(("45", "70", "94", "95")):
        return "Mecanico", "Pieza OEM de telar", "Sugerida", "Regla por área y código OEM"
    if area == "TEJIDO PLANO" and numeric_code.startswith(("87", "88")):
        return "Electrico", "Componente eléctrico de telar", "Sugerida", "Regla por área y código OEM"
    if area == "HILANDERÍA" and numeric_code.startswith(("94", "95")):
        return "Mecanico", "Transmisión y sellado", "Sugerida", "Regla por área y código OEM"
    return "Mecanico", "Pieza OEM por validar", "Sugerida", "Asignación provisional por contexto de mantenimiento"

def header_index(frame):
    expected = ["articulo", "descripcion", "cant", "costo", "nrovale", "maq"]
    best = (0, 0)
    for index, row in frame.head(20).iterrows():
        cells = [canon(value) for value in row.tolist() if pd.notna(value)]
        score = sum(any(word in cell for cell in cells) for word in expected)
        if score > best[0]: best = (score, index)
    return best[1]

movements = []
for path in sorted(SOURCE.glob("*.xlsx")):
    area = AREA_BY_FILE.get(path.name, "POR VALIDAR")
    workbook = pd.ExcelFile(path)
    for sheet in workbook.sheet_names:
        raw = pd.read_excel(path, sheet_name=sheet, header=None)
        if raw.empty: continue
        index = header_index(raw)
        headers = [canon(value) for value in raw.iloc[index].tolist()]
        data = raw.iloc[index + 1:].copy(); data.columns = headers
        for _, row in data.iterrows():
            code = article_code(row.get("articulo"))
            description = norm(row.get("descripcion"))
            if not code or code.lower() == "nan": continue
            family, subfamily, status, source = classification(description, area, code)
            movements.append({
                "area": area, "archivo_origen": path.name, "hoja_origen": sheet, "vale": norm(row.get("nrovale")), "fecha": norm(row.get("fecest")), "codigo": code,
                "descripcion": description, "unidad": norm(row.get("um")), "cantidad": safe_number(row.get("cant")), "costo_unitario": safe_number(row.get("costo")), "costo_total": safe_number(row.get("tot")),
                "maquina_origen": norm(row.get("maq")), "familia_tecnica": family, "subfamilia_tecnica": subfamily, "estado_clasificacion": status, "origen_clasificacion": source,
            })

catalog = {}
for row in movements:
    key = (row["area"], row["codigo"])
    current = catalog.setdefault(key, {"area": row["area"], "codigo": row["codigo"], "descripcion": row["descripcion"], "unidad": row["unidad"], "familia_tecnica": row["familia_tecnica"], "subfamilia_tecnica": row["subfamilia_tecnica"], "estado_clasificacion": row["estado_clasificacion"], "origen_clasificacion": row["origen_clasificacion"], "movimientos": 0, "cantidad_consumida": 0, "costo_acumulado": 0, "costo_ultimo": 0, "maquinas": set(), "archivos": set()})
    current["movimientos"] += 1; current["cantidad_consumida"] += row["cantidad"]; current["costo_acumulado"] += row["costo_total"]; current["costo_ultimo"] = row["costo_unitario"] or current["costo_ultimo"]
    date_text = str(row.get("fecha") or "")[:10]
    if re.match(r"^\d{4}-\d{2}-\d{2}$", date_text) and date_text > str(current.get("ultima_solicitud") or ""):
        current["ultima_solicitud"] = date_text
    if row["maquina_origen"]: current["maquinas"].add(row["maquina_origen"])
    current["archivos"].add(row["archivo_origen"])

catalog_rows = []
for row in catalog.values():
    row["maquinas_asociadas"] = " | ".join(sorted(row.pop("maquinas")))
    row["archivos_origen"] = " | ".join(sorted(row.pop("archivos")))
    catalog_rows.append(row)
catalog_rows.sort(key=lambda item: (item["area"], item["familia_tecnica"], item["descripcion"], item["codigo"]))

summary = defaultdict(lambda: {"area": "", "familia_tecnica": "", "repuestos": 0, "movimientos": 0, "costo_acumulado": 0, "pendientes": 0})
for row in catalog_rows:
    key = (row["area"], row["familia_tecnica"]); current = summary[key]; current["area"], current["familia_tecnica"] = key
    current["repuestos"] += 1; current["movimientos"] += row["movimientos"]; current["costo_acumulado"] += row["costo_acumulado"]; current["pendientes"] += int(row["estado_clasificacion"] != "Sugerida")

OUTPUT.parent.mkdir(parents=True, exist_ok=True)
OUTPUT.write_text(json.dumps({"movimientos": movements, "catalogo": catalog_rows, "resumen": sorted(summary.values(), key=lambda x: (x["area"], x["familia_tecnica"]))}, ensure_ascii=False, default=list), encoding="utf-8")
print(json.dumps({"movimientos": len(movements), "catalogo_area_codigo": len(catalog_rows), "resumen": len(summary), "pendientes": sum(1 for row in catalog_rows if row["estado_clasificacion"] == "Pendiente")}, ensure_ascii=False))
