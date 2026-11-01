# Navegación de Allsumaq

La hotbar conserva el orden **Inicio / Mapa / Registrar / Progreso / Perfil**.

| Opción | Comportamiento |
| --- | --- |
| Inicio | Sección del recorrido por scroll. El clic salta a la portada. |
| Mapa | Segunda sección del recorrido por scroll. El clic salta a la exploración. |
| Registrar | Vista independiente abierta por clic o teclado. |
| Progreso | Vista independiente abierta por clic o teclado. |
| Perfil | Vista independiente abierta por clic o teclado. |

Inicio y Mapa aparecen juntos. Al terminar el mapa y el catálogo se llega al
pie de página. Registrar, Progreso y Perfil no aparecen debajo del catálogo:
solo se muestra uno de esos módulos al seleccionarlo.

El scrollspy del encabezado observa únicamente Inicio y Mapa. Dentro de una
vista personal se puede bajar para leer su contenido sin cambiar de módulo.

## Regreso y conservación del contexto

- **Volver a explorar** recupera la sección y posición anteriores de Inicio/Mapa.
- Las búsquedas, filtros, universidad seleccionada y vista del mapa se conservan
  al cambiar de módulo, mientras no se recargue toda la aplicación.
- Los campos del formulario de consumo se conservan al visitar Perfil o Progreso.
- Las entradas válidamente guardadas siguen persistiendo en el navegador.
- Atrás y Adelante recuperan la vista y el scroll de su entrada de historial.
- Los enlaces `#registrar`, `#progreso` y `#perfil` abren directamente su módulo.
- El acceso desde una ficha a Registrar conserva el alimento seleccionado.
- La confirmación de consumo permite abrir Progreso o registrar otro consumo.
- Recetas y fichas continúan siendo vistas internas accesibles por clic.
- La ubicación del dispositivo se detiene al ocultar la exploración del mapa.

La URL conserva los fragmentos anteriores; no se necesitan páginas HTML
separadas, paquetes, compilación ni cambios de configuración en Cloudflare.

## Verificación

La suite `python -X utf8 tests/pruebas_navegador.py --navegacion` comprueba
27 escenarios de navegación en Chrome. Resultados:
`docs/verificacion/resultados-navegacion.json`.

Incluye visibilidad de secciones, scrollspy, navegación por teclado,
Atrás/Adelante, borrador del formulario, retorno al catálogo, registro y
confirmación, acceso Google desde Perfil, enlaces directos y comportamiento
en móvil. La suite de 36 pruebas de la base también pasó después del cambio.
