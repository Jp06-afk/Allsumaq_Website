"""Actualiza las sedes universitarias de Lima desde OpenStreetMap.

Opcional: solo para actualizar la copia de datos, no para ejecutar la web.
Python estándar, sin paquetes adicionales. No descarga imágenes del mapa.
"""
from pathlib import Path
from urllib.request import Request, urlopen
from urllib.parse import urlencode
from datetime import datetime, timezone
import json
import re

ROOT = Path(__file__).resolve().parent.parent
QUERY = '[out:json][timeout:25];nwr["amenity"="university"](-12.50,-77.25,-11.65,-76.60);out center tags;'
ENDPOINTS = ["https://overpass.private.coffee/api/interpreter", "https://overpass-api.de/api/interpreter"]


def main():
    data = None
    for endpoint in ENDPOINTS:
        try:
            request = Request(endpoint + "?" + urlencode({"data": QUERY}), headers={"User-Agent": "Allsumaq-AcademicMap/1.0 (+https://allsumaq-website.jpfj-06.workers.dev/)"})
            with urlopen(request, timeout=40) as response:
                data = json.load(response)
            if not data.get("elements") or data.get("remark"):
                raise ValueError("Consulta incompleta o sin resultados")
            break
        except Exception as exc:
            print(endpoint, type(exc).__name__, flush=True)
    if not data or not data.get("elements") or data.get("remark"):
        raise RuntimeError("No se reemplazaron los datos: el proveedor no respondió correctamente.")
    rows = []
    for element in data["elements"]:
        tags = element.get("tags", {})
        name = tags.get("name", "")
        center = element.get("center", element)
        if not re.search(r"universidad|university", name, re.I) or not all(key in center for key in ["lat", "lon"]):
            continue
        if tags.get("disused") == "yes" or tags.get("abandoned") == "yes":
            continue
        rows.append({"id": f"{element['type']}-{element['id']}", "nombre": name, "sigla": tags.get("short_name", ""), "lat": center["lat"], "lon": center["lon"], "direccion": " ".join(filter(None, [tags.get("addr:street"), tags.get("addr:housenumber")])), "distrito": tags.get("addr:district", tags.get("addr:suburb", "")), "fuente": f"https://www.openstreetmap.org/{element['type']}/{element['id']}"})
    rows.sort(key=lambda row: row["nombre"])
    if len(rows) < 10:
        raise RuntimeError("Resultados insuficientes; no se reemplazaron los archivos.")
    result = {"fuente": "OpenStreetMap / Overpass API", "consultado": datetime.now(timezone.utc).isoformat(), "fechaDatos": data.get("osm3s", {}).get("timestamp_osm_base"), "limites": [-12.5, -77.25, -11.65, -76.6], "sedes": rows}
    (ROOT / "assets/data").mkdir(exist_ok=True)
    (ROOT / "assets/data/universidades-fuente.json").write_text(json.dumps({"query": QUERY, "endpoint": endpoint, "osm3s": data.get("osm3s"), "elements": data["elements"]}, ensure_ascii=False, indent=2), encoding="utf-8")
    (ROOT / "js/universidades-datos.js").write_text("// Sedes de OpenStreetMap. Ver scripts/actualizar_universidades.py.\nwindow.ALLSUMAQ_UNIVERSIDADES = " + json.dumps(result, ensure_ascii=False, indent=2) + ";\n", encoding="utf-8")
    print(f"{len(rows)} sedes con coordenadas obtenidas de OpenStreetMap.")


if __name__ == "__main__":
    main()
