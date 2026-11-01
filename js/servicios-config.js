// Proveedores públicos. No pongas contraseñas ni claves privadas en este archivo.
window.ALLSUMAQ_SERVICIOS = {
  mapa: {
    centro: { lat: -12.055, lon: -77.045 },
    zoomInicial: 12,
    zoomMinimo: 10,
    zoomMaximo: 18,
    tiles: "https://tile.openstreetmap.org/{z}/{x}/{y}.png",
    overpass: "https://overpass-api.de/api/interpreter",
    overpassAlternativo: "https://overpass.private.coffee/api/interpreter",
    consulta:
      '[out:json][timeout:25];nwr["amenity"="university"](-12.50,-77.25,-11.65,-76.60);out center tags;',
  },
};
