# Allsumaq

Web del proyecto TikrAI. Frontend en HTML, CSS y JavaScript nativo, sin instalar
paquetes ni compilar. Cartografía de Lima con universidades en OpenStreetMap
y acceso con Google respaldado por un Cloudflare Worker.

**Activación de Google y actualización del mapa:** consulta
[`docs/GOOGLE-Y-MAPA.md`](docs/GOOGLE-Y-MAPA.md).

## Abrir la web

Abre `index.html` con Chrome, Edge, Brave o Firefox actualizado. La portada,
los catálogos y los registros funcionan directamente desde esa carpeta.
El mapa requiere abrir la web publicada o un servidor HTTP y conexión a
Internet. El acceso con Google requiere el Worker y sus valores de configuración.

Opcionalmente, si ya tienes Python instalado, puedes servir la carpeta:

```powershell
python -m http.server 8000 --bind 127.0.0.1
```

Abre `http://127.0.0.1:8000`. Detén el servidor con Ctrl+C.
Abrir el archivo y usar un servidor son orígenes distintos: cada uno tendrá
sus propios registros locales. Usa siempre el mismo navegador y origen para
seguir viendo tu actividad.

## Publicación: Cloudflare Workers con archivos estáticos

El destino de alojamiento es **Cloudflare**. El proyecto creado en el panel se
llama `allsumaq-website` y utiliza Workers con Static Assets, conectado a GitHub.
El frontend continúa siendo HTML/CSS/JavaScript estático. El módulo JavaScript
`worker/index.mjs` atiende las API de autenticación; no requiere dependencias.

Configuración del formulario de Workers para este repositorio:

| Opción | Valor |
| --- | --- |
| Rama de producción | `main` |
| Nombre del proyecto | `allsumaq-website` |
| Comando de build | Vacío |
| Comando de despliegue | `npx wrangler deploy` después de subir `wrangler.jsonc` |
| Preview builds | Desactivado para el primer despliegue |
| Directorio raíz avanzado | Dejar sin modificar si `allsumaq` es la raíz del repositorio |

`wrangler.jsonc` fija el nombre, el directorio de archivos y la fecha de
compatibilidad `2026-10-23`, siguiendo la fecha sugerida por el registro de error
del primer intento. Ahora también declara `main` y el binding `ASSETS` para
verificar Google y servir la web. `.assetsignore` excluye del contenido público
la documentación, las pruebas y los archivos de código del Worker.

Sube `wrangler.jsonc` y `worker/` junto con los demás cambios antes de desplegar.
El comando para el panel es:

```bash
npx wrangler deploy
```

El error `A compatibility_date is required when uploading a Worker` indica
que falta esa fecha; se resuelve con el archivo de configuración o el parámetro
explícito. Guarda el cambio del comando y vuelve a ejecutar el despliegue.

Las rutas de CSS, JavaScript, imágenes y fuentes son relativas, y las vistas
internas usan fragmentos `#...`; no necesitan un servidor de rutas adicional.
Los registros seguirán guardándose en el navegador también al alojar la web
en Cloudflare. La actividad del archivo local no se transfiere al dominio web.

Referencia oficial: [Static Assets en Workers](https://developers.cloudflare.com/workers/static-assets/) y [fechas de compatibilidad](https://developers.cloudflare.com/workers/configuration/compatibility-dates/).

## Qué incluye esta primera entrega

- Portada basada en MK-01: logo original, hero, cuatro accesos y cuatro pasos.
- Encabezado sticky con Inicio / Mapa / Registrar / Progreso / Perfil.
- Navegación por scroll y clic, foco visible y movimiento reducido.
- Diez platos con búsqueda por nombre, establecimiento y distrito.
- Filtros combinados por distrito y presupuesto; orden por precio o nombre.
- Mapa real de Lima con 107 sedes universitarias de OpenStreetMap, búsqueda,
  zoom, selección y ubicación del dispositivo con permiso.
- Ficha breve de cada plato con precio y condiciones de los datos.
- Diez recetas, buscador por ingrediente y detalle con cantidades y pasos.
- Registros de alimentos, recetas y bebidas; validación y confirmación.
- Historial, resumen por periodo, favoritos y preferencia de distrito locales.
- Vistas internas con Atrás/Adelante y enlaces directos.
- Acceso Google preparado, verificado en servidor y pendiente de activar con
  `GOOGLE_CLIENT_ID` y `SESSION_SECRET` en Cloudflare.

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
- Coordenadas, direcciones, horarios, porciones y disponibilidad verificadas
  de los establecimientos de alimentos. Las universidades ya tienen datos OSM.
- Fuentes completas de datos nutricionales y enlaces exactos a los recetarios.
- Comparador completo, filtros de distancia/hierro, orientación documentada,
  combinaciones y refrigerios. El acceso ahora utiliza la integración real de Google.
- Revisión visual de los demás mockups y pruebas de aceptación pendientes.

No se necesita cuenta para explorar o usar la base local. Google identifica
al usuario mediante el Worker; sus registros se almacenan en este navegador
separados por cuenta. No hay sincronización de registros entre dispositivos.
No se guardan contraseñas ni credenciales de Google en localStorage.

## Organización

```text
allsumaq/
├── index.html
├── css/                 # Variables, estilos y responsive
├── js/                  # Catálogos, reglas y comportamiento
├── assets/              # Logo, imágenes, Inter y licencia
├── worker/              # Verificación de Google y sesión en Cloudflare
├── wrangler.jsonc       # Configuración del despliegue
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

Se ejecutaron 87 comprobaciones con Chrome y un perfil aislado: 36 de la base,
12 de apertura directa del archivo y 39 adicionales de mapa, cuentas y
validación criptográfica. Resoluciones: 1440, 768, 390 y 320 px. Los resultados
están en `docs/verificacion/resultados.json`, `resultados-archivo.json` y
`resultados-servicios.json`. Hay capturas en esa carpeta. El acceso final con
una cuenta real de Google queda pendiente del Client ID y la configuración
de Cloudflare; las pruebas criptográficas usan claves generadas para la prueba.

Para repetirlas en este equipo, con Python y Chrome ya instalados:

```powershell
python -X utf8 tests/pruebas_navegador.py
python -X utf8 tests/pruebas_navegador.py --archivo
python -X utf8 tests/pruebas_navegador.py --servicios
```

La prueba crea sus propios registros en un perfil temporal aislado dentro de
`tests/.chrome-profile`. No accede a tu perfil personal de Chrome ni instala
bibliotecas. Las pruebas no sustituyen la revisión con usuarios, la evaluación
con lectores de pantalla ni la validación de los datos del catálogo.
