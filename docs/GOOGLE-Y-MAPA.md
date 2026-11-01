# Google y mapa de universidades

Dirección prevista: https://allsumaq-website.jpfj-06.workers.dev

## Qué cambió

El mapa ilustrativo fue sustituido por cartografía de OpenStreetMap. Incluye
107 registros iniciales de sedes universitarias de Lima y alrededores, con
coordenadas obtenidas de Overpass, fuente individual, zoom, desplazamiento,
búsqueda y selección. No son 107 universidades distintas: una institución
puede tener varias sedes o registros cartográficos.

El usuario puede pedir su ubicación y detener el seguimiento. La posición no
se guarda en el historial ni se envía al servidor de Allsumaq. Las teselas se
solicitan al proveedor únicamente para la vista visible; no hay descarga masiva.

El acceso ahora utiliza Google Identity Services y un Worker que verifica la
credencial antes de emitir una cookie de sesión. El cliente oficial de Google
es la integración externa necesaria para el proveedor solicitado; el resto
del frontend sigue usando HTML, CSS y JavaScript sin frameworks.

La activación requiere configurar dos valores en tu cuenta de Cloudflare.
Todavía no se ha probado un acceso con una cuenta real porque falta el Client ID.

## 1. Crear el cliente de Google

1. Abre [Google Cloud Console](https://console.cloud.google.com/).
2. Crea o selecciona el proyecto Allsumaq.
3. En Google Auth Platform, completa Branding con el nombre de la aplicación
   y los correos de contacto. Configura Audience según los usuarios del proyecto.
4. En Clients, selecciona Create client y el tipo **Web application**.
5. En Authorized JavaScript origins agrega exactamente:

   ```text
   https://allsumaq-website.jpfj-06.workers.dev
   ```

   No agregues `/perfil`, rutas ni una barra final. Este flujo usa callback
   JavaScript en una ventana de Google; no necesita una redirect URI propia.
6. Copia el **Client ID**, que termina en `.apps.googleusercontent.com`.
7. Si tu configuración de prueba limita el acceso a usuarios de prueba,
   agrega los correos que usarán la demostración en Audience.

No hace falta el Client Secret de Google para este flujo. El Client ID es
público y se comunica al navegador para que Google identifique la aplicación.

Fuente: [configuración de Google Identity Services](https://developers.google.com/identity/gsi/web/guides/get-google-api-clientid).

## 2. Activar los valores en Cloudflare

En Workers & Pages → allsumaq-website → Settings → Variables and Secrets,
agrega estos dos valores como **Secret**:

| Nombre | Valor |
| --- | --- |
| `GOOGLE_CLIENT_ID` | Client ID de la aplicación web de Google |
| `SESSION_SECRET` | Cadena aleatoria de al menos 32 caracteres para firmar las sesiones |

El Client ID se puede guardar como Secret para conservar su configuración
entre despliegues de Wrangler, aunque no es información confidencial.

Para generar el SESSION_SECRET en tu terminal, si ya tienes Python:

```powershell
python -c "import secrets; print(secrets.token_urlsafe(48))"
```

Copia el resultado únicamente al campo Secret de Cloudflare. No lo pegues
en los archivos JS, en GitHub ni en el chat. No es una contraseña de Google.

`PUBLIC_ORIGIN` ya está configurado en `wrangler.jsonc` con el dominio publicado.
Si cambias a un dominio propio, actualiza ese valor y los orígenes del cliente
en Google. Guarda y despliega la nueva versión de variables/código.

Fuente: [Secrets en Cloudflare Workers](https://developers.cloudflare.com/workers/configuration/secrets/).

## 3. Subir la integración completa

Desde la carpeta `allsumaq`:

```powershell
git add .
git commit -m "Integrar mapa de universidades y acceso con Google"
git push
```

En Cloudflare, utiliza `npx wrangler deploy` como comando de despliegue. El
comando anterior con `--assets .` y `--compatibility-date 2026-10-23` también
puede leer el nuevo archivo de configuración, pero es imprescindible subir
`wrangler.jsonc` y la carpeta `worker/`: contienen el servicio de autenticación.

No se instala ninguna dependencia de la aplicación. Wrangler es la herramienta
que ejecuta Cloudflare para publicar el Worker y sus archivos.

## 4. Verificar la activación

1. Abre la web publicada y entra a Perfil → Iniciar sesión con Google.
2. Debe aparecer el botón oficial de Google. Si falta la configuración, se
   informa explícitamente; no se inventa una sesión.
3. Elige una cuenta de Google. Allsumaq valida firma RSA, emisor, audiencia,
   expiración, correo verificado y nonce del intento de acceso.
4. El perfil muestra el nombre y correo verificados. La sesión permanece
   mediante cookie HttpOnly, Secure y SameSite, con duración de 24 horas.
5. Cerrar sesión elimina la cookie. No elimina tus registros guardados.

Los registros y favoritos se guardan localmente, separados por el identificador
verificado `sub` de Google. No se sincronizan entre dispositivos ni se migran
automáticamente desde el visitante. Las contraseñas y los tokens de Google
no se guardan en localStorage.

Fuente: [verificación de credenciales de Google](https://developers.google.com/identity/gsi/web/guides/verify-google-id-token).

## Mapa: datos y actualización

- `js/universidades-datos.js`: copia inicial con nombre, coordenadas y enlace OSM.
- `assets/data/universidades-fuente.json`: respuesta de origen para trazabilidad.
- `js/servicios-config.js`: proveedor de imágenes, límites de zoom y consulta.
- `scripts/actualizar_universidades.py`: actualización opcional con Python estándar.
- El botón Actualizar consulta Overpass; la respuesta se conserva como última
  copia válida. Se espacian las consultas al menos un minuto.
- Al abrir el mapa con datos de más de seis horas se intenta actualizarlos.
  Si el proveedor no responde, se mantiene la copia anterior con su fecha.
- La cartografía no muestra tráfico en vivo, horarios de sedes ni matrícula
  universitaria actual. OpenStreetMap es una fuente colaborativa; consulta
  a la institución para confirmar su operación o acceso al campus.
- Los restaurantes del catálogo siguen sin coordenadas verificadas: se
  muestran por distrito y no se colocan puntos inventados junto a universidades.
- La atribución OSM es visible. No se habilitan descargas offline ni precarga
  de teselas. Servicio público de disponibilidad variable, sin SLA.

Fuentes: [política de teselas OSM](https://operations.osmfoundation.org/policies/tiles/),
[Overpass API](https://wiki.openstreetmap.org/wiki/Overpass_API).

## Pruebas

Se añadieron 39 comprobaciones: mapa real, búsqueda, zoom, selección, ubicación
simulada mediante permisos del navegador, responsive, aislamiento local de
cuentas y validación criptográfica del Worker. Los tokens de prueba se firman
con una clave RSA generada solo para la prueba, nunca con credenciales reales.

El navegador restringe Origin/Set-Cookie al ejecutar código de servidor. Las
pruebas del Worker reproducen sus objetos Request/Response y usan Web Crypto
real; no equivalen a un inicio de sesión real con Google ni a una ejecución
completa de Wrangler en el edge. La prueba final con tu cuenta queda pendiente
de configurar los valores y desplegar. Las pruebas anteriores de búsqueda,
recetas y registros también se volvieron a ejecutar.
