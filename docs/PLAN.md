# Allsumaq · plan de desarrollo

Tecnología: HTML5, CSS3 y JavaScript nativo, sin instalación ni compilación.
Referencia visual principal: MK-01 aprobado. Navegación: Inicio / Mapa /
Registrar / Progreso / Perfil. Los catálogos y detalles se abren por clic.

Navegación actual acordada: solo Inicio y Mapa forman el recorrido por scroll;
Registrar, Progreso y Perfil son vistas independientes abiertas por clic.
La especificación actual está en `docs/NAVEGACION.md` y sustituye la distribución
de cinco secciones apiladas del planteamiento inicial.

Destino de publicación: Cloudflare Workers con Static Assets conectado a GitHub,
rama de producción `main`. Mantener recursos locales y rutas relativas, sin
instalación ni compilación. La configuración prevista está en `README.md`.
Nombre del proyecto: `allsumaq-website`. La configuración está en
`wrangler.jsonc`; debe subirse a GitHub para que Cloudflare la pueda leer.

Prioridad solicitada después de la primera entrega: integrar acceso real con
Google y mapa real de Lima con universidades. Implementación y configuración
en `docs/GOOGLE-Y-MAPA.md`. El Client ID y el secreto de sesión aún requieren
activación en la cuenta del propietario. Las ubicaciones de restaurantes
siguen pendientes, aunque las sedes universitarias ya tienen fuente OSM.

## Entregas

1. Base visual y navegación + MK-01: variables, componentes, logo original,
   portada, accesos, scrollspy y adaptación a móvil. Preparar los catálogos
   editables y recorridos iniciales para comprobar las conexiones.
2. MK-02, MK-03, MK-04: exploración, filtros combinados y comparador.
3. MK-05, MK-06: fichas de establecimiento y alimento.
4. MK-07, MK-08: catálogo y detalle de las diez recetas.
5. MK-09, MK-10: combinaciones y orientación documentada.
6. MK-11: advertencias educativas, alternativas y fuentes.
7. MK-12, MK-13, MK-14: consolidar registro, resumen y perfil.
8. MK-A01/A02, MK-A03/A04 y MK-A05/A06: revisión de estados por parejas.
9. Revisión final de accesibilidad, responsive, navegación y aceptación.

Se revisará la fidelidad y el funcionamiento de cada grupo antes del siguiente.
Las primeras conexiones funcionales no equivalen a pantallas finales aprobadas
ni a las 30 HU completas.

## Datos y recursos

- Los precios proceden de la tabla entregada por el equipo, sin verificación
  comercial independiente. Se conserva su condición de estimados, publicados
  o pendientes. El gasto por persona de D’Kyara no es un precio de plato.
- No hay coordenadas verificadas. No se mostrarán marcadores geográficos,
  distancias ni rutas inventadas. El mapa inicial será ilustrativo.
- Las recetas son adaptaciones domésticas entregadas por el equipo. Las
  referencias generales todavía necesitan enlaces a las publicaciones exactas.
- Sin cifras inventadas de hierro, calorías, costos o absorción.
- Las fotografías del chat todavía necesitan rutas locales. Para la primera
  portada se recuperan únicamente fotografías e ilustraciones de MK-01. El
  texto, los controles y la maquetación se implementan con HTML y CSS.
- El logo se copia desde el PNG horizontal original, preservando transparencia.
- Persistencia: navegador del dispositivo. Sin cuentas reales ni contraseñas.

## Revisión de la primera entrega

- Portada comparada con MK-01 en escritorio y móvil.
- Cinco entradas de navegación sticky: Inicio/Mapa por scroll y clic,
  Registrar/Progreso/Perfil por clic, con estado activo según la vista.
- Accesos a alimentos, mapa, recetas y progreso conectados.
- Catálogo inicial y ficha breve conservan el término y la zona al cerrar.
- Registro local voluntario con validación, confirmación y resumen.
- Favoritos y zona de referencia locales como funciones complementarias.
- Trazabilidad y límites por HU en `docs/TRAZABILIDAD.md`.
