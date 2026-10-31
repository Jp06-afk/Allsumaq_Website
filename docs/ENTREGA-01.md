# Entrega 01 · portada y base navegable

Fecha de revisión: 31 de octubre de 2026.

## Pantallas y alcance

Se desarrolló la estructura visual de MK-01, incluyendo logo, composición
de portada, cuatro tarjetas, explicación en cuatro pasos y encabezado sticky.
La maquetación usa texto real, SVG, CSS y fotografías: no es una captura
completa utilizada como página.

Se prepararon conexiones funcionales para las siguientes entregas: catálogo,
ficha breve, listado/detalle de recetas, formulario, resumen y perfil local.
Esas conexiones no se presentan como reproducciones finales de los otros
mockups. El comparador y el orientador todavía no están implementados.

## Accesos y destinos

| Punto de entrada | Acción | Destino |
| --- | --- | --- |
| Logo, Inicio | Clic | `#inicio` |
| Explorar alimentos, lupa, primera tarjeta | Clic | `#mapa`, foco en el buscador |
| Ver mapa cercano, tarjeta Mapa | Clic | `#mapa`, vista ilustrativa |
| Tarjeta Recetas saludables | Clic | `#recetas`, diálogo con las diez recetas |
| Tarjeta Tu progreso | Clic | `#progreso` |
| Navegación principal | Clic o scroll manual | Una de las cinco secciones |
| Flecha en plato | Clic | `#alimento=ALI-xxx`, ficha breve |
| Corazón en plato | Clic | Guarda o retira un favorito local |
| Flecha de receta | Clic | `#receta=REC-xxx`, ingredientes y preparación |
| Registrar consumo desde detalle | Clic | `#registrar`, selección conservada |
| Guardar registro válido | Enviar formulario | Confirmación `#guardado=REG-…` |
| Confirmación | Ver mi progreso | `#progreso`, resumen actualizado |
| Confirmación | Registrar otro consumo | `#registrar`, nuevo formulario |
| Perfil | Guardar zona | Aplica distrito al catálogo |

## Scroll y regreso

Las cinco secciones principales se recorren mediante scroll libre. Las fichas
y las recetas se abren por clic, en una vista interna con foco contenido por
el diálogo nativo. El diálogo tiene scroll propio, botón Volver y Escape.

Atrás/Adelante del navegador recuperan las vistas y el punto de scroll.
La consulta, el distrito, el presupuesto y el orden del catálogo permanecen
al cerrar una ficha. El buscador de recetas se conserva al volver del detalle.

Los registros, favoritos y zona sobreviven a una recarga si el navegador
permite `localStorage`. El formulario se limpia solo después de guardar
correctamente. El texto válido permanece al detectar errores.

## Criterios cubiertos y estados

- HU-002: nombres parciales y búsqueda independiente de mayúsculas/tildes;
  consulta vacía recuperable y mensaje sin coincidencias.
- HU-004: presupuesto en soles, rangos identificados como estimados y exclusión
  de opciones sin precio. El gasto por persona no equivale a un precio de plato.
- HU-006/007: filtros disponibles conjuntos y ordenamiento parcial;
  pendientes distancia e hierro documentados.
- HU-023/025: cantidades, secuencia de preparación y minutos aproximados de
  las diez adaptaciones entregadas por el equipo.
- HU-040: elemento y fecha válidos, confirmación y persistencia local. También
  se solicita el momento de consumo. No hay diagnósticos ni medición clínica.
- HU-048: cifras basadas en registros reales, periodos y estado vacío;
  pendiente el módulo de consejos consultados.

Los estados de búsqueda vacía, formulario inválido y guardado están conectados.
Sus layouts todavía deben revisarse frente a MK-A02/A04/A05. El mapa informa
que es ilustrativo y que no dispone de coordenadas verificadas. No se afirma
haber completado el estado MK-A01 ni el login MK-A06.

La matriz de las 30 HU y sus pendientes está en `TRAZABILIDAD.md`.

## Pruebas realizadas

48 comprobaciones en Chrome: 36 sobre HTTP y 12 al abrir `index.html`
directamente. Los resultados están guardados en `verificacion/resultados.json`
y `verificacion/resultados-archivo.json`. Se comprobaron carga de recursos locales,
resoluciones 1440/768/390/320 px, búsquedas, presupuesto, recuperación de
contexto, favoritos, recetas, fecha inválida/futura, registro, periodos,
persistencia tras recarga, navegación por scroll, foco de teclado y fallo
de almacenamiento sin confirmación falsa.

Se inspeccionaron las capturas de Inicio en escritorio, tablet y móvil y
el detalle de receta en móvil. No hubo errores JavaScript ni recursos HTTP
fallidos en las pruebas completadas.

Pendientes: pruebas con usuarios, evaluación completa WCAG AA, lectores de
pantalla, otros navegadores y comparación visual final de las siguientes
pantallas. No se declara conformidad WCAG a partir de estas comprobaciones.

## Siguiente grupo

Consolidar MK-02, MK-03 y MK-04: revisar maquetación del catálogo, preparar
selección y comparador, y mantener como pendientes los filtros que necesiten
datos geográficos o nutricionales. Incorporar las fotografías independientes
cuando el equipo indique sus rutas locales.
