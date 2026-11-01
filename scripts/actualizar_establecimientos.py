"""Copia opcional de lugares OSM para mostrar el mapa sin esperar una búsqueda.

Solo Python estándar. No es necesario ejecutar este script para usar la web.
Las asociaciones de platos se mantienen en js/datos.js, no se deducen de OSM.
"""
from pathlib import Path
from urllib.request import Request, urlopen
from urllib.parse import urlencode
from datetime import datetime, timezone
import json

ROOT = Path(__file__).resolve().parent.parent
CAMPUSES = [
    ("relation-6252388", -12.056448, -77.0838353),  # UNMSM
    ("way-387031740", -12.0692133, -77.080548),  # PUCP
    ("way-436795846", -12.0598987, -77.1334602),  # UNAC, oficinas
]
QUERY = '[out:json][timeout:25];(' + ''.join(
    f'nwr["amenity"~"^(marketplace|restaurant|fast_food|food_court|cafe)$"](around:500,{lat},{lon});'
    for _, lat, lon in CAMPUSES
) + 'nwr["name"~"Conzac|Ciudad y Campo|Ciudad de Dios|Modelo.*San Miguel|APROMEC",i]["amenity"="marketplace"](-12.50,-77.25,-11.65,-76.60););out center tags;'


def main():
    data = None
    for endpoint in ["https://overpass-api.de/api/interpreter", "https://overpass.private.coffee/api/interpreter"]:
        try:
            request = Request(endpoint + '?' + urlencode({'data': QUERY}), headers={
                'User-Agent': 'Allsumaq-AcademicMap/1.0 (+https://allsumaq-website.jpfj-06.workers.dev/)'
            })
            with urlopen(request, timeout=40) as response:
                data = json.load(response)
            if not data.get('elements') or data.get('remark'):
                raise ValueError('Consulta incompleta')
            break
        except Exception as error:
            data = None
            print(type(error).__name__, endpoint, flush=True)
    if not data:
        raise RuntimeError('No se modificó la copia local: proveedor no disponible.')
    places = []
    for element in data['elements']:
        tags = element.get('tags', {})
        point = element.get('center', element)
        if not tags.get('name') or 'lat' not in point or tags.get('disused') == 'yes' or tags.get('abandoned') == 'yes':
            continue
        kind = {'marketplace': 'mercado', 'fast_food': 'puesto'}.get(tags.get('amenity'), 'restaurante')
        places.append({
            'id': f"{element['type']}/{element['id']}", 'nombre': tags['name'],
            'tipo': kind, 'lat': point['lat'], 'lon': point['lon'],
            'direccion': ' '.join(filter(None, [tags.get('addr:street'), tags.get('addr:housenumber')])),
            'distrito': tags.get('addr:district', tags.get('addr:suburb', '')),
            'horario': tags.get('opening_hours', ''),
            'fuente': f"https://www.openstreetmap.org/{element['type']}/{element['id']}",
            'cartaUrl': tags.get('website:menu', ''),
        })
    if len(places) < 3:
        raise RuntimeError('Datos insuficientes; no se modificó la copia local.')
    result = {'consultado': datetime.now(timezone.utc).isoformat(),
              'fechaDatos': data.get('osm3s', {}).get('timestamp_osm_base'),
              'fuente': endpoint, 'lugares': places}
    (ROOT / 'js/establecimientos-datos.js').write_text(
        '// Ubicaciones reales OSM. Actualización opcional: scripts/actualizar_establecimientos.py\n'
        + 'window.ALLSUMAQ_ESTABLECIMIENTOS = ' + json.dumps(result, ensure_ascii=False, indent=2) + ';\n', encoding='utf-8')
    print(f'{len(places)} lugares documentados guardados.', flush=True)
    for place in places:
        if place['tipo'] == 'mercado':
            print(place['id'], place['nombre'], place['lat'], place['lon'], flush=True)


if __name__ == '__main__':
    main()
