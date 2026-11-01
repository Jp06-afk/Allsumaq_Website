// Edita aquí los textos de Inicio y los diez alimentos. No requiere compilación.
// Las rutas de imagen son relativas a index.html. Usa null para datos ausentes.
window.ALLSUMAQ_CONTENIDO = {
  inicio: {
    etiqueta: "ALIMENTACIÓN INTELIGENTE\nPARA TU DÍA A DÍA",
    titulo: "Come mejor hoy,",
    destacado: "vive mejor siempre.",
    descripcion:
      "Encuentra opciones de comida rica en hierro, accesibles y cerca de ti. Mejora tu alimentación de forma simple y práctica.",
    nota: "Buena comida,\nmás energía\npara tus ideas.",
  },
};

window.ALLSUMAQ_ALIMENTOS = [
  {
    id: "ALI-001",
    nombre: "Sangrecita salteada con papas",
    precioMin: 6,
    precioMax: 10,
    precioTipo: "estimado",
    distritos: ["Los Olivos"],
    establecimiento: "Mercado Conzac",
    ingredientes: null,
    porcion: null,
    imagen: null,
  },
  {
    id: "ALI-002",
    nombre: "Anticuchos de corazón",
    precioMin: 20,
    precioMax: 40,
    precioTipo: "persona",
    distritos: ["Los Olivos"],
    establecimiento: "Anticuchería D’Kyara",
    ingredientes: null,
    porcion: null,
    imagen: null,
  },
  {
    id: "ALI-003",
    nombre: "Hígado de pollo encebollado",
    precioMin: 9,
    precioMax: 14,
    precioTipo: "estimado",
    distritos: ["Rímac"],
    establecimiento: "Mercado Cooperativa Ciudad y Campo",
    ingredientes: null,
    porcion: null,
    imagen: null,
  },
  {
    id: "ALI-004",
    nombre: "Bazo de res encebollado",
    precioMin: 10,
    precioMax: 15,
    precioTipo: "estimado",
    distritos: ["Rímac"],
    establecimiento: "Mercado Ciudad y Campo",
    ingredientes: null,
    porcion: null,
    imagen: null,
  },
  {
    id: "ALI-005",
    nombre: "Cau cau de bofe",
    precioMin: 10,
    precioMax: 15,
    precioTipo: "estimado",
    distritos: ["Ate"],
    establecimiento: "Mercado Real Plaza APROMEC Vitarte",
    ingredientes: null,
    porcion: null,
    imagen: null,
  },
  {
    id: "ALI-006",
    nombre: "Anticuchos con rachi",
    precioMin: null,
    precioMax: null,
    precioTipo: "pendiente",
    distritos: ["San Juan de Lurigancho"],
    establecimiento: "Bossanova, la esquina del anticucho",
    ingredientes: null,
    porcion: null,
    imagen: null,
  },
  {
    id: "ALI-007",
    nombre: "Riñones de res al ajillo",
    precioMin: 10,
    precioMax: 15,
    precioTipo: "estimado",
    distritos: ["San Juan de Miraflores"],
    establecimiento: "Mercado Ciudad de Dios",
    ingredientes: null,
    porcion: null,
    imagen: null,
  },
  {
    id: "ALI-008",
    nombre: "Anticuchos con papas",
    precioMin: null,
    precioMax: null,
    precioTipo: "pendiente",
    distritos: ["Villa El Salvador"],
    establecimiento: "Papa Lucho Anticuchería",
    ingredientes: null,
    porcion: null,
    imagen: null,
  },
  {
    id: "ALI-009",
    nombre: "Hígado encebollado con papas",
    precioMin: 18.5,
    precioMax: 18.5,
    precioTipo: "publicado",
    distritos: ["Surco", "San Isidro", "Miraflores"],
    establecimiento: "D’Casa Food",
    notaUbicacion: "Dirección presencial por confirmar.",
    ingredientes: null,
    porcion: null,
    imagen: null,
  },
  {
    id: "ALI-010",
    nombre: "Pescado a la plancha",
    precioMin: 12,
    precioMax: 18,
    precioTipo: "estimado",
    distritos: ["San Miguel"],
    establecimiento: "Mercado Modelo de San Miguel",
    ingredientes: null,
    porcion: null,
    imagen: null,
  },
].map(function (alimento) {
  return Object.assign(
    {
      direccion: null,
      coordenadas: null,
      hierroMg: null,
      fuenteNutricional: null,
      tiempoObtencion: null,
      fechaPrecio: null,
    },
    alimento,
  );
});

window.ALLSUMAQ_BEBIDAS = [
  { id: "BEB-001", nombre: "Agua" },
  { id: "BEB-002", nombre: "Limonada" },
  { id: "BEB-003", nombre: "Café" },
  { id: "BEB-004", nombre: "Té" },
];
// Precios por plato de los lugares del mapa. Completar solo tras verificar el local.
// El ID se obtiene del enlace «Ubicación y fuente» (ejemplo de formato: node/123).
// Cada plato: { id: "plato-1", osmId, plato, min, max, fuente: "https://...", fecha: "AAAA-MM-DD", estimado: false }.
// Repite osmId para añadir varios platos a la carta de un mismo establecimiento.
// Opcionales: descripcion, puesto (nombre del puesto dentro del mercado), disponible: false.
// min y max son precios por porción. Para un precio exacto usa el mismo valor.
// Los importes del catálogo sin ubicación verificada no se vinculan automáticamente.
window.ALLSUMAQ_PRECIOS_LUGARES = [];

// Platos de referencia de la tabla del equipo, vinculados a ubicaciones OSM.
// Esto NO confirma que un puesto concreto los venda ni su disponibilidad actual.
window.ALLSUMAQ_VINCULOS_ESTABLECIMIENTOS = {
  "ALI-003": "way/835626705", // Mercado Cooperativa Ciudad y Campo
  "ALI-004": "node/4407164831", // Mercado de Ciudad y Campo
  "ALI-007": "way/584178252", // Mercado Ciudad de Dios
};
