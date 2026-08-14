from pathlib import Path
import pandas as pd

folder = Path(r"C:\excel completo")
all_rows = []
for path in sorted(folder.glob("*.xlsx")):
    try:
        book = pd.ExcelFile(path)
        details = []
        for sheet in book.sheet_names:
            frame = pd.read_excel(path, sheet_name=sheet, header=None)
            terms = {"artículo", "articulo", "descripción", "descripcion", "costo", "cant", "máq", "maq", "nrovale", "vale"}
            scores = []
            for index, row in frame.head(20).iterrows():
                values = [str(v).strip().lower() for v in row.tolist() if pd.notna(v)]
                scores.append((sum(any(term in value for term in terms) for value in values), index, values))
            _, header_index, header_values = max(scores, default=(0, 0, []))
            data = frame.iloc[header_index + 1:].dropna(axis=0, how="all")
            headers = [str(v).strip().lower() for v in frame.iloc[header_index].tolist()]
            data.columns = headers
            for name in ["artículo", "descripcion", "descripción", "cant", "costo", "tot", "fecest", "máq", "maq"]:
                if name not in data.columns:
                    data[name] = None
            all_rows.append(data[["artículo", "descripcion", "descripción", "cant", "costo", "tot", "fecest", "máq", "maq"]])
            details.append(f"{sheet}: row={header_index + 1}; cols={header_values[:18]}; rows={len(data)}")
        print(f"FILE|{path.name}|SHEETS|{' || '.join(details)}")
    except Exception as error:
        print(f"ERROR|{path.name}|{error}")

if all_rows:
    full = pd.concat(all_rows, ignore_index=True)
    article = full["artículo"].dropna().astype(str).str.strip()
    print("SUMMARY|rows|%d|unique_articles|%d|with_date|%d|with_machine|%d|with_unit_cost|%d|with_total_cost|%d" % (
        len(full), article.nunique(), full["fecest"].notna().sum(), full[["máq", "maq"]].notna().any(axis=1).sum(), full["costo"].notna().sum(), full["tot"].notna().sum()))
