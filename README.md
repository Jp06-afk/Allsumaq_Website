# Allsumaq

Primera entrega de la web del proyecto TikrAI. HTML, CSS y JavaScript nativo.
Funciona con recursos locales, sin instalar paquetes y sin compilación.

## Abrir la web

Abre `index.html` con Chrome, Edge, Brave o Firefox actualizado. La portada,
los catálogos y los registros funcionan directamente desde esa carpeta.

Opcionalmente, si ya tienes Python instalado, puedes servir la carpeta:

```powershell
python -m http.server 8000 --bind 127.0.0.1
```

Abre `http://127.0.0.1:8000`. Detén el servidor con Ctrl+C.
Abrir el archivo y usar un servidor son orígenes distintos: cada uno tendrá
sus propios registros locales. Usa siempre el mismo navegador y origen para
seguir viendo tu actividad.

## Publicación prevista: Cloudflare Pages

El destino de alojamiento acordado es **Cloudflare**. GitHub conserva el código
y permite conectar el repositorio a Cloudflare Pages para publicar la web.
La aplicación continúa siendo HTML/CSS/JavaScript estático, sin paquetes ni
compilación. No requiere GitHub Pages.

Cuando llegue el momento de publicar, conecta el repositorio de GitHub a un
proyecto de Cloudflare Pages con esta configuración para la estructura actual:

| Opción | Valor |
| --- | --- |
| Rama de producción | `main` |
| Framework | Ninguno / None |
| Comando de build | `exit 0` |
| Directorio de salida | `.` (la raíz que contiene `index.html`) |
| Directorio raíz avanzado | Dejar sin modificar si `allsumaq` es la raíz del repositorio |

`exit 0` no compila la aplicación: únicamente indica que los archivos ya están
listos. La integración Git permite publicar automáticamente los cambios que
se suban a la rama de producción. Por ahora no se ha desplegado la web.

Las rutas de CSS, JavaScript, imágenes y fuentes son relativas, y las vistas
internas usan fragmentos `#...`; no necesitan un servidor de rutas adicional.
Los registros seguirán guardándose en el navegador también al alojar la web
en Cloudflare. La actividad del archivo local no se transfiere al dominio web.

Referencia oficial: [desplegar HTML estático en Cloudflare Pages](https://developers.cloudflare.com/pages/framework-guides/deploy-anything/).

## Qué incluye esta primera entrega

- Portada basada en MK-01: logo original, hero, cuatro accesos y cuatro pasos.
- Encabezado sticky con Inicio / Mapa / Registrar / Progreso / Perfil.
- Navegación por scroll y clic, foco visible y movimiento reducido.
- Diez platos con búsqueda por nombre, establecimiento y distrito.
- Filtros combinados por distrito y presupuesto; orden por precio o nombre.
- Vista ilustrativa de mapa y lista por distrito, sin coordenadas inventadas.
- Ficha breve de cada plato con precio y condiciones de los datos.
- Diez recetas, buscador por ingrediente y detalle con cantidades y pasos.
- Registros de alimentos, recetas y bebidas; validación y confirmación.
- Historial, resumen por periodo, favoritos y preferencia de distrito locales.
- Vistas internas con Atrás/Adelante y enlaces directos.

MK-01 es el foco visual de la entrega. Los bloques de catálogo, registro,
progreso, perfil y detalles son una base funcional; su fidelidad a los demás
mockups se consolidará en las siguientes etapas. No representa las 30 HU
completas ni los 20 mockups terminados.

## Recorridos para revisar

1. Pulsa **Explorar alimentos**, escribe `sangrecita`, elige **Los Olivos**
   y un presupuesto de **S/ 10**. Abre la flecha del plato. Pulsa **Volver**:
   los filtros permanecen. Marca el corazón y consulta **Perfil**.
2. Desde Inicio, pulsa **Recetas saludables**, busca `tarwi` y abre la
   **Anchoveta dorada con ensalada de tarwi**. Revisa ingredientes y pasos;
   **Volver** recupera la búsqueda del catálogo de recetas.
3. En **Registrar**, intenta guardar sin elegir alimento: aparece un error.
   Completa alimento, fecha y momento, y guarda. Pulsa **Ver mi progreso**.
   El resumen refleja ese registro. Recarga: se mantiene la información.
4. En **Perfil**, guarda **Rímac** como zona. Vuelve a **Mapa**: se muestran
   sus dos platos. **Limpiar filtros** recupera las diez alternativas.
5. Recorre las cinco secciones mediante scroll. La opción activa del
   encabezado cambia sin tener que pulsarla.

## Editar textos, precios e imágenes

| Archivo | Qué puedes modificar |
| --- | --- |
| `index.html` | Textos de botones, títulos de secciones y explicaciones generales. |
| `js/datos.js` | Textos de Inicio, los diez platos, sus precios, distritos, establecimientos y bebidas. |
| `js/recetas-datos.js` | Las diez recetas: nombre, descripción, ingredientes, preparación, porciones y tiempo. |
| `css/variables.css` | Colores, fuente, radios y ancho general. |
| `assets/logo/allsumaq-horizontal.png` | Logo horizontal original. |
| `assets/img/` | Fotografías e ilustraciones de la portada. |

Ejemplo de cambio en `js/datos.js`:

```javascript
{
  id: "ALI-001",                        // Conserva el ID para los favoritos.
  nombre: "Sangrecita salteada con papas",
  precioMin: 6,
  precioMax: 10,
  precioTipo: "estimado",
  distritos: ["Los Olivos"],
  establecimiento: "Mercado Conzac",
  ingredientes: null,                    // O un arreglo: ["Sangrecita", ...].
  porcion: null,
  imagen: "assets/img/sangrecita.jpg"     // Copia primero la fotografía a esa ruta.
}
```

Se usan comas para separar propiedades y puntos para decimales: `18.5`.
`null` indica dato ausente; no lo reemplaces por cero. Los tipos de precio
admitidos son `estimado`, `publicado`, `persona` y `pendiente`.

El presupuesto filtra usando el máximo del rango registrado. Un plato de
S/ 12–18 queda fuera de un presupuesto de S/ 15. El gasto por persona de
D’Kyara no se trata como precio de plato y queda fuera del filtro de precio.
Las fichas sin precio también se excluyen al activar ese filtro.

Los ingredientes, pasos y tiempos de recetas se pueden editar directamente.
Los campos de costo, hierro e imagen de recetas están reservados para el
siguiente grupo visual: todavía no calculan ni publican cifras nuevas.

## Recursos y datos pendientes

- Fotografías independientes de los alimentos y recetas: visibles en el chat,
  pero falta su ubicación local. Esta entrega utiliza los recortes visuales de
  MK-01 en la portada y no atribuye esas fotos a los establecimientos.
- Coordenadas, direcciones, horarios, porciones y disponibilidad verificadas.
- Fuentes completas de datos nutricionales y enlaces exactos a los recetarios.
- Comparador completo, filtros de distancia/hierro, orientación documentada,
  combinaciones, refrigerios y acceso demostrativo MK-A06.
- Revisión visual de los demás mockups y pruebas de aceptación pendientes.

No se necesita cuenta para esta base. El almacenamiento es local: no hay
backend ni sincronización entre dispositivos. No se guardan contraseñas ni
se simula una autenticación segura.

## Organización

```text
allsumaq/
├── index.html
├── css/                 # Variables, estilos y responsive
├── js/                  # Catálogos, reglas y comportamiento
├── assets/              # Logo, imágenes, Inter y licencia
├── docs/
│   ├── PLAN.md
│   ├── ENTREGA-01.md
│   ├── TRAZABILIDAD.md
│   ├── referencias/     # MK-01 e indicaciones originales
│   └── verificacion/    # Capturas y resultados
└── tests/               # Prueba opcional con Chrome ya instalado
```

La fuente Inter se distribuye con su licencia SIL Open Font License en
`assets/fonts/LICENSE-Inter.txt`.

## Verificación

Se ejecutaron pruebas reales con Chrome sin ventana y un perfil aislado:
48 comprobaciones superadas: 36 sobre HTTP y 12 adicionales al abrir el
archivo directamente, incluyendo scrollspy y teclado. Resoluciones:
1440, 768, 390 y 320 px. Resultados en `docs/verificacion/resultados.json`,
`docs/verificacion/resultados-archivo.json` y capturas en esa carpeta.

Para repetirlas en este equipo, con Python y Chrome ya instalados:

```powershell
python -X utf8 tests/pruebas_navegador.py
python -X utf8 tests/pruebas_navegador.py --archivo
```

La prueba crea sus propios registros en un perfil temporal aislado dentro de
`tests/.chrome-profile`. No accede a tu perfil personal de Chrome ni instala
bibliotecas. Las pruebas no sustituyen la revisión con usuarios, la evaluación
con lectores de pantalla ni la validación de los datos del catálogo.
