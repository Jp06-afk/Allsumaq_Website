# Trazabilidad inicial · 30 HU core

Fuente: documento de 48 HU, versión 2.1, entregado por el equipo.
Esta matriz registra alcance y pendientes; no certifica que se hayan cumplido
todos los CA/Gherkin de una historia por tener un componente visible.

Revisión del mapa y las fichas: 1 de noviembre de 2026. Se conserva el alcance
informativo del Word. MK-02 muestra mapa y establecimientos juntos; MK-05 y MK-06
son vistas internas por clic con rutas y regreso. La simulación de pedido queda
en un apartado opcional, fuera del recorrido principal y de las 30 HU core.

| HU | Componente o acceso | Resultado y verificación inicial | Estado / pendiente |
| --- | --- | --- | --- |
| HU-001 | Mapa → elegir sede → establecimientos | 52 ubicaciones OSM guardadas; marcadores y fichas. Catálogo visible sin consulta externa y alternativa de lista probados. | Parcial: ampliar y revisar catálogo comercial; no todos los locales tienen platos asociados. |
| HU-002 | Inicio → Explorar alimentos → Buscar | Consulta parcial, mayúsculas/tildes, limpiar y estado vacío probados. | Funcional en la base; falta revisión visual MK-03. |
| HU-003 | Radio desde la sede | 500 m inicial, ampliable a 1/2/3 km. Distancia en línea recta; actualización y ampliación probadas. | Implementada para ubicaciones cargadas; aceptación completa del equipo pendiente. |
| HU-004 | Presupuesto máximo | Rango máximo, precios faltantes y gasto por persona probados. | Funcional en la base; validar datos y alcance final. |
| HU-005 | Hierro documentado | Sin clasificación inventada. | Pendiente fuente, porción y regla de clasificación. |
| HU-006 | Buscar + Distrito + Presupuesto + Radio | Los filtros afectan los establecimientos y platos vinculados; reinicio probado. | Parcial: falta hierro documentado y retirada individual de filtros. |
| HU-007 | Ordenar | Cercanos ordenados por distancia; opciones por nombre y precio máximo; desconocidos al final. | Parcial: falta criterio de hierro documentado. |
| HU-008 | Comparador | Sin controles decorativos de comparación. | Pendiente MK-04 completo y selección de al menos dos opciones. |
| HU-010 | Lista / Mapa | Los mismos establecimientos y filtros en ambas vistas; universidades en selector separado. | Funcional para el catálogo cargado; ampliar cobertura y aceptación final. |
| HU-012 | Local → ficha MK-05 | Nombre, dirección disponible, horario o ausencia, tipo, fuente, distancia y regreso. Ruta y recarga probadas. | Funcional en los datos cargados; no se garantiza horario/atención en tiempo real. Fidelidad final pendiente de aprobación. |
| HU-013 | Comida registrada → ficha MK-06 | Precio referencial, ingredientes, porción, tiempo y fuente; datos faltantes explícitos. Enlace al local y recarga probados. | Parcial: faltan datos de ingredientes/porción y fuentes nutricionales de los platos. |
| HU-014 | Ficha breve → Tiempo de obtención | Ausencia indicada, sin confundir con caminata. | Parcial: falta escenario con estimación documentada. |
| HU-015 | Ficha breve → Fuente nutricional | Indica fuente pendiente, sin inventar cifras. | Pendiente referencias y método de cálculo. |
| HU-017 | Origen del hierro | No se publica una clasificación sin documentarla. | Pendiente explicación y evidencia por ingrediente. |
| HU-020 | Distrito / Perfil → Zona de referencia | Elección manual, persistencia y catálogo actualizados probados. | Parcial: falta relación con un mapa georreferenciado. |
| HU-021 | Inicio → Recetas saludables | Diez fichas accesibles desde el listado. | Parcial: verificar referencias y layout MK-07. |
| HU-023 | Receta → Ingredientes y Preparación | Cantidades y pasos recibidos transcritos; receta de anchoveta comprobada. | Funcional en la base; aceptación del resto de recetas y layout pendientes. |
| HU-024 | Receta → Hierro por porción | Ausencia de estimación identificada. | Parcial: falta método, fuente y cálculo por porción. |
| HU-025 | Receta → Tiempo | Muestra minutos aproximados de las fichas recibidas. | Funcional en la base; revisión de diez recetas y layout pendientes. |
| HU-026 | Receta → Costo | Indica pendiente de cálculo. | Parcial: falta costo con base y referencia documentadas. |
| HU-027 | Refrigerios transportables | Sin categorías ni conservación inventadas. | Pendiente catálogo específico y documentación de transporte. |
| HU-028 | Combinaciones económicas | Sin precios totales ficticios. | Pendiente MK-09 y combinaciones documentadas. |
| HU-029 | Sugerencias por tiempo y presupuesto | Tiempos presentes, costos ausentes. | Pendiente datos de costos y reglas de selección. |
| HU-031 | Orientador | No implementado en este grupo. | Pendiente reglas documentadas y MK-10. |
| HU-032 | Advertencia de café/té | No implementada en este grupo. | Pendiente fuente, disparador contextual y MK-11/A03. |
| HU-034 | Acompañamientos con vitamina C | No implementados en este grupo. | Pendiente catálogo y fuente revisada. |
| HU-035 | Alternativas educativas | No implementadas en este grupo. | Pendiente reglas, opciones y regreso sin bloqueo. |
| HU-037 | Consejos con fuentes | No publicados sin referencias completas. | Pendiente módulo, fuentes y trazabilidad de consultas. |
| HU-040 | Registrar → Guardar → Confirmación | Validación, conservación de campos, guardado y fallo de almacenamiento probados. | Funcional en la base; layout MK-12/A04/A05 pendiente. |
| HU-048 | Progreso → Periodo / Historial | Cantidades reales, días, comidas/bebidas, estado vacío y recarga probados. | Parcial: falta actividad de consejos y layout MK-13. |

## Funciones complementarias

HU-016 (no core): ficha del establecimiento → comidas registradas → ficha de
cada alimento. Vinculados tres platos de la tabla del equipo a mercados OSM:
ALI-003, ALI-004 y ALI-007. Esto documenta la asociación del catálogo, no confirma
un vendedor concreto ni stock. Los locales sin platos muestran estado vacío.
Los demás siete platos conservan su ubicación/asociación exacta pendiente.

Favoritos, búsqueda de recetas por ingrediente y preferencia de distrito son
ayudas funcionales de esta base. No sustituyen HU core pendientes.

## Referencias visuales

La integración posterior de mapa real y Google está registrada en
`GOOGLE-Y-MAPA.md`. Los marcadores de universidades son una funcionalidad
solicitada por el equipo; no certifican HU-001, que se refiere a establecimientos.
El acceso real continúa pendiente de activar con Client ID y secreto en Cloudflare.

## Prioridad de trabajo restante

1. Completar fuentes comerciales/nutricionales y las fichas de los diez platos.
2. HU-008 / MK-04: comparador de alternativas, pendiente.
3. HU-005/006/007/015/017: hierro con datos documentados y filtros coherentes.
4. Completar costos/combinaciones de recetas y orientador (MK-09 a MK-11).
5. Revisar fidelidad visual y cada CA/Gherkin de las 30 HU antes de declararlas
   aceptadas. Las pruebas de funcionamiento no sustituyen esta aceptación.

Se verificó la disponibilidad de MK-01 a MK-14 y MK-A01 a MK-A06. La copia de
MK-01 está en `referencias/MK-01.png`. Se conserva como fuente de comparación.
Los otros mockups permanecen en la carpeta original proporcionada por el equipo.

En las siguientes entregas se contrastará cada CA-01 a CA-04 y sus dos
escenarios Gherkin con una prueba de tarea; la tabla actual no los da por
aprobados automáticamente.
