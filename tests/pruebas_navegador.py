"""Pruebas funcionales con el Chrome instalado y Python estándar.

No instala dependencias. Usa un perfil aislado dentro de tests/.chrome-profile.
El proyecto web funciona sin ejecutar este archivo.
"""

from pathlib import Path
from http.server import ThreadingHTTPServer, SimpleHTTPRequestHandler
from urllib.request import urlopen
from urllib.parse import urlparse
import base64
import functools
import json
import os
import socket
import struct
import subprocess
import sys
import threading
import time

ROOT = Path(__file__).resolve().parent.parent
OUTPUT = ROOT / "docs" / "verificacion"
OUTPUT.mkdir(parents=True, exist_ok=True)
PROFILE = ROOT / "tests" / ".chrome-profile"
CHROME = Path(r"C:\Program Files\Google\Chrome\Application\chrome.exe")
checks = []
http_errors = []


class Handler(SimpleHTTPRequestHandler):
    def do_GET(self):
        # El servidor estático de pruebas representa un Worker sin OAuth activado.
        if self.path in ["/api/auth/session", "/api/auth/config"]:
            body = json.dumps(
                {"authenticated": False}
                if self.path.endswith("session")
                else {"configured": False, "googleClientId": None}
            ).encode()
            self.send_response(200)
            self.send_header("Content-Type", "application/json")
            self.send_header("Content-Length", str(len(body)))
            self.end_headers()
            self.wfile.write(body)
            return
        super().do_GET()

    def log_message(self, message, *args):
        if str(args[1]).startswith(("4", "5")) if len(args) > 1 else False:
            http_errors.append(message % args)


class CDP:
    def __init__(self, url):
        parsed = urlparse(url)
        self.sock = socket.create_connection((parsed.hostname, parsed.port), timeout=15)
        self.sock.settimeout(20)
        key = base64.b64encode(os.urandom(16)).decode()
        request = (
            f"GET {parsed.path} HTTP/1.1\r\nHost: {parsed.netloc}\r\n"
            f"Upgrade: websocket\r\nConnection: Upgrade\r\nSec-WebSocket-Key: {key}\r\nSec-WebSocket-Version: 13\r\n\r\n"
        )
        self.sock.sendall(request.encode())
        response = b""
        while b"\r\n\r\n" not in response:
            response += self.sock.recv(1)
        assert response.startswith(b"HTTP/1.1 101 "), response
        self.seq = 0
        self.events = []

    def exact(self, length):
        data = b""
        while len(data) < length:
            chunk = self.sock.recv(length - len(data))
            if not chunk:
                raise ConnectionError("Chrome closed the connection")
            data += chunk
        return data

    def send(self, payload, opcode=1):
        payload = payload.encode() if isinstance(payload, str) else payload
        mask = os.urandom(4)
        size = len(payload)
        header = bytes([0x80 | opcode])
        if size < 126:
            header += bytes([0x80 | size])
        elif size < 65536:
            header += bytes([0xFE]) + struct.pack("!H", size)
        else:
            header += bytes([0xFF]) + struct.pack("!Q", size)
        body = bytes(b ^ mask[i % 4] for i, b in enumerate(payload))
        self.sock.sendall(header + mask + body)

    def receive(self):
        while True:
            first, second = self.exact(2)
            opcode = first & 15
            size = second & 127
            if size == 126:
                size = struct.unpack("!H", self.exact(2))[0]
            elif size == 127:
                size = struct.unpack("!Q", self.exact(8))[0]
            mask = self.exact(4) if second & 128 else None
            payload = self.exact(size)
            if mask:
                payload = bytes(b ^ mask[i % 4] for i, b in enumerate(payload))
            if opcode == 9:
                self.send(payload, 10)
            elif opcode == 1:
                return json.loads(payload)
            elif opcode == 8:
                raise ConnectionError("Chrome closed the websocket")

    def call(self, method, params=None):
        self.seq += 1
        seq = self.seq
        self.send(json.dumps({"id": seq, "method": method, "params": params or {}}))
        while True:
            data = self.receive()
            if data.get("id") == seq:
                if "error" in data:
                    raise RuntimeError(data["error"])
                return data.get("result", {})
            self.events.append(data)

    def js(self, expression):
        result = self.call(
            "Runtime.evaluate",
            {"expression": expression, "returnByValue": True, "awaitPromise": True},
        )
        if "exceptionDetails" in result:
            raise AssertionError(result["exceptionDetails"])
        return result.get("result", {}).get("value")


def assert_js(cdp, expression, label):
    assert cdp.js(expression), label
    checks.append(label)
    print("OK:", label, flush=True)


def wait_ready(cdp):
    for _ in range(100):
        if cdp.js("document.documentElement.dataset.appReady === 'true'"):
            return
        time.sleep(0.1)
    raise AssertionError("Application did not initialize")


def screenshot(cdp, filename, width, height):
    cdp.call(
        "Emulation.setDeviceMetricsOverride",
        {"width": width, "height": height, "deviceScaleFactor": 1, "mobile": False},
    )
    cdp.js("window.scrollTo({top:0,behavior:'instant'})")
    time.sleep(0.2)
    assert_js(
        cdp,
        f"document.documentElement.scrollWidth <= {width}",
        f"Sin desbordamiento horizontal a {width}px",
    )
    image = cdp.call(
        "Page.captureScreenshot", {"format": "png", "captureBeyondViewport": False}
    )
    (OUTPUT / filename).write_bytes(base64.b64decode(image["data"]))


def run(cdp, url):
    cdp.call("Page.enable")
    cdp.call("Runtime.enable")
    cdp.call("Network.enable")
    cdp.call("Page.navigate", {"url": url})
    wait_ready(cdp)
    cdp.js("localStorage.clear(); location.reload()")
    time.sleep(0.4)
    wait_ready(cdp)
    cdp.js("document.fonts.ready")
    assert_js(
        cdp,
        "[...document.querySelectorAll('.main-nav a')].map(a=>a.textContent).join('|')==='Inicio|Mapa|Registrar|Progreso|Perfil'",
        "Cinco entradas, con el orden requerido",
    )
    assert_js(
        cdp,
        "document.querySelectorAll('.quick-card').length===4 && ALLSUMAQ_ALIMENTOS.length===10 && ALLSUMAQ_RECETAS.length===10",
        "Cuatro accesos, diez alimentos y diez recetas",
    )
    assert_js(
        cdp,
        "[...document.images].every(i=>i.complete && i.naturalWidth>0)",
        "Imágenes locales cargadas",
    )
    assert_js(
        cdp, "document.fonts.check('16px Inter')", "Fuente Inter cargada localmente"
    )
    for width, height, name in [
        (1440, 1000, "inicio-desktop.png"),
        (768, 1024, "inicio-tablet.png"),
        (390, 844, "inicio-mobile.png"),
        (320, 740, "inicio-320.png"),
    ]:
        screenshot(cdp, name, width, height)
    cdp.call(
        "Emulation.setDeviceMetricsOverride",
        {"width": 1440, "height": 1000, "deviceScaleFactor": 1, "mobile": False},
    )
    assert_js(
        cdp,
        "AllsumaqModelo.filtrar(ALLSUMAQ_ALIMENTOS,{consulta:'RINONES'}).length===1",
        "Búsqueda sin distinguir tildes ni mayúsculas",
    )
    assert_js(
        cdp,
        "AllsumaqModelo.filtrar(ALLSUMAQ_ALIMENTOS,{presupuesto:15}).length===5",
        "Presupuesto aplicado al extremo superior del rango",
    )
    assert_js(
        cdp,
        "!AllsumaqModelo.filtrar(ALLSUMAQ_ALIMENTOS,{presupuesto:40}).some(a=>a.id==='ALI-002')",
        "El gasto por persona no se presenta como precio de plato",
    )
    cdp.js(
        "document.querySelector('#buscar').value='sangrecita'; document.querySelector('#filtro-distrito').value='Los Olivos'; document.querySelector('#buscar').dispatchEvent(new Event('input',{bubbles:true}))"
    )
    assert_js(
        cdp,
        "document.querySelectorAll('.food-card').length===1",
        "Búsqueda y distrito funcionan conjuntamente",
    )
    cdp.js("document.querySelector('[data-alimento=\"ALI-001\"]').click()")
    assert_js(
        cdp,
        "document.querySelector('dialog').open && location.hash==='#alimento=ALI-001'",
        "Detalle de alimento con URL propia",
    )
    cdp.js("document.querySelector('[data-dialog-close]').click()")
    time.sleep(0.2)
    assert_js(
        cdp,
        "!document.querySelector('dialog').open && document.querySelector('#buscar').value==='sangrecita' && document.querySelector('#filtro-distrito').value==='Los Olivos'",
        "Regreso conserva búsqueda y distrito",
    )
    cdp.js("document.querySelector('[data-favorito=\"ALI-001\"]').click()")
    assert_js(
        cdp,
        "document.querySelectorAll('.favorite-row').length===1",
        "Favorito reflejado en Perfil",
    )
    cdp.js(
        "document.querySelector('#buscar').value='plato inexistente'; document.querySelector('#buscar').dispatchEvent(new Event('input',{bubbles:true}))"
    )
    assert_js(
        cdp,
        "document.querySelector('#alimentos-grid').textContent.includes('No encontramos coincidencias')",
        "Estado sin coincidencias recuperable",
    )
    cdp.js("document.querySelector('[data-reset-filters]').click()")
    assert_js(
        cdp,
        "document.querySelectorAll('.food-card').length===10",
        "Limpiar filtros recupera el catálogo",
    )
    cdp.js("document.querySelector('[data-open=recetas]').click()")
    assert_js(
        cdp,
        "document.querySelectorAll('.recipe-card').length===10 && document.querySelector('dialog').open",
        "Acceso de Inicio abre las diez recetas",
    )
    cdp.js(
        "document.querySelector('#buscar-receta').value='tarwi'; document.querySelector('#buscar-receta').dispatchEvent(new Event('input',{bubbles:true}))"
    )
    assert_js(
        cdp,
        "document.querySelectorAll('.recipe-card').length===2",
        "Búsqueda por nombre e ingrediente en recetas",
    )
    cdp.js("document.querySelector('[data-receta=\"REC-009\"]').click()")
    assert_js(
        cdp,
        "document.querySelectorAll('.detail-columns li').length===14",
        "Detalle de receta muestra ocho ingredientes y seis pasos",
    )
    cdp.call(
        "Page.captureScreenshot", {"format": "png", "captureBeyondViewport": False}
    )
    cdp.js("document.querySelector('[data-dialog-back]').click()")
    time.sleep(0.2)
    # The list URL is restored; catalogue food filters remain in their DOM.
    assert_js(
        cdp,
        "location.hash==='#recetas' && document.querySelector('#buscar-receta').value==='tarwi' && document.querySelectorAll('.recipe-card').length===2",
        "Atrás conserva la búsqueda de recetas",
    )
    cdp.call(
        "Input.dispatchKeyEvent",
        {
            "type": "keyDown",
            "key": "Escape",
            "code": "Escape",
            "windowsVirtualKeyCode": 27,
        },
    )
    time.sleep(0.2)
    assert_js(
        cdp,
        "!document.querySelector('dialog').open",
        "Escape cierra la vista y recupera el contexto",
    )
    cdp.js(
        "document.querySelector('.main-nav a[href=\"#registrar\"]').click(); document.querySelector('#registro-form').requestSubmit()"
    )
    assert_js(
        cdp,
        "document.querySelector('#registro-elemento').getAttribute('aria-invalid')==='true' && !localStorage.getItem('allsumaq:actividad:v1').includes('REG-')",
        "Registro incompleto muestra error sin guardar",
    )
    cdp.js(
        "document.querySelector('#registro-elemento').value='ALI-001'; document.querySelector('#registro-momento').value='Almuerzo'; document.querySelector('#registro-form').requestSubmit()"
    )
    assert_js(
        cdp,
        "document.querySelector('dialog').open && document.querySelector('#dialog-titulo').textContent.includes('Registro guardado')",
        "Consumo válido muestra confirmación",
    )
    assert_js(
        cdp,
        "JSON.parse(localStorage.getItem('allsumaq:actividad:v1')).registros.length===1",
        "El consumo se persiste en localStorage",
    )
    cdp.js("document.querySelector('#dialog-contenido a[href=\"#progreso\"]').click()")
    time.sleep(0.3)
    assert_js(
        cdp,
        "document.querySelector('#estadisticas strong').textContent==='1' && document.querySelectorAll('.history-row').length===1",
        "Progreso e historial se derivan del consumo guardado",
    )
    cdp.js(
        "document.querySelector('.main-nav a[href=\"#registrar\"]').click(); document.querySelector('#registro-elemento').value='BEB-001'; document.querySelector('#registro-momento').value='Cena'; document.querySelector('#registro-form').requestSubmit()"
    )
    assert_js(
        cdp,
        "JSON.parse(localStorage.getItem('allsumaq:actividad:v1')).registros.length===2",
        "Registro de bebidas independiente",
    )
    cdp.js("document.querySelector('#dialog-contenido a[href=\"#progreso\"]').click()")
    time.sleep(0.2)
    assert_js(
        cdp,
        "[...document.querySelectorAll('#estadisticas strong')].map(n=>n.textContent).join(',')==='2,1,1,1'",
        "Resumen distingue comidas, bebidas y días con actividad",
    )
    cdp.js(
        "document.querySelector('.main-nav a[href=\"#perfil\"]').click(); document.querySelector('#perfil-zona').value='Rímac'; document.querySelector('#zona-form').requestSubmit()"
    )
    assert_js(
        cdp,
        "document.querySelector('#filtro-distrito').value==='Rímac' && document.querySelectorAll('.food-card').length===2",
        "Zona guardada aplicada al catálogo",
    )
    cdp.call("Page.reload")
    time.sleep(0.4)
    wait_ready(cdp)
    assert_js(
        cdp,
        "document.querySelectorAll('.history-row').length===2 && document.querySelectorAll('.favorite-row').length===1 && document.querySelector('#perfil-zona').value==='Rímac'",
        "Recarga conserva registros, favorito y zona",
    )
    cdp.js(
        "document.querySelector('.main-nav a[href=\"#registrar\"]').click(); window.originalSetItem=Storage.prototype.setItem; Storage.prototype.setItem=function(){throw new Error('storage blocked')}; document.querySelector('#registro-elemento').value='ALI-001'; document.querySelector('#registro-momento').value='Cena'; document.querySelector('#registro-form').requestSubmit(); Storage.prototype.setItem=window.originalSetItem"
    )
    assert_js(
        cdp,
        "JSON.parse(localStorage.getItem('allsumaq:actividad:v1')).registros.length===2 && !document.querySelector('dialog').open && !document.querySelector('#toast').hidden",
        "Fallo de almacenamiento no produce confirmación falsa",
    )
    assert_js(
        cdp,
        "Object.keys(AllsumaqModelo.validarRegistro({elemento:'ALI-001',fecha:'2026-02-30',momento:'Cena'},ALLSUMAQ_ALIMENTOS,'2026-10-31')).includes('fecha')",
        "Fecha inexistente rechazada",
    )
    assert_js(
        cdp,
        "Object.keys(AllsumaqModelo.validarRegistro({elemento:'ALI-001',fecha:'2099-01-01',momento:'Cena'},ALLSUMAQ_ALIMENTOS,'2026-10-31')).includes('fecha')",
        "Fecha futura rechazada",
    )
    cdp.call("Page.navigate", {"url": url + "#receta=REC-009"})
    time.sleep(0.3)
    wait_ready(cdp)
    assert_js(
        cdp,
        "document.querySelector('dialog').open && document.querySelector('#dialog-titulo').textContent.includes('Anchoveta')",
        "Enlace directo a una receta",
    )
    cdp.call(
        "Emulation.setDeviceMetricsOverride",
        {"width": 390, "height": 844, "deviceScaleFactor": 1, "mobile": False},
    )
    assert_js(
        cdp,
        "document.querySelector('dialog').scrollWidth<=document.querySelector('dialog').clientWidth",
        "Detalle de receta sin desbordamiento en móvil",
    )
    image = cdp.call(
        "Page.captureScreenshot", {"format": "png", "captureBeyondViewport": False}
    )
    (OUTPUT / "receta-mobile.png").write_bytes(base64.b64decode(image["data"]))
    errors = [e for e in cdp.events if e.get("method") == "Runtime.exceptionThrown"]
    assert not errors, errors
    assert not http_errors, http_errors
    checks.append("Sin errores JavaScript ni recursos HTTP fallidos")


def run_file(cdp):
    cdp.call("Page.enable")
    cdp.call("Runtime.enable")
    cdp.call("Page.navigate", {"url": (ROOT / "index.html").as_uri()})
    wait_ready(cdp)
    cdp.js("localStorage.clear();location.reload()")
    time.sleep(0.3)
    wait_ready(cdp)
    cdp.js("document.fonts.ready")
    assert_js(
        cdp,
        "location.protocol==='file:' && document.querySelectorAll('.food-card').length===10",
        "Apertura directa de index.html sin servidor",
    )
    assert_js(
        cdp,
        "[...document.images].every(i=>i.complete && i.naturalWidth>0)",
        "Imágenes cargadas desde archivos locales",
    )
    cdp.call(
        "Emulation.setDeviceMetricsOverride",
        {"width": 1440, "height": 1000, "deviceScaleFactor": 1, "mobile": False},
    )
    for section in ["inicio", "mapa"]:
        cdp.js(
            f"document.getElementById('{section}').scrollIntoView({{behavior:'instant'}})"
        )
        time.sleep(0.15)
        assert_js(
            cdp,
            f"document.querySelector('.main-nav [aria-current]').hash==='#{section}'",
            f"Scrollspy activa {section}",
        )
    for section in ["progreso", "perfil", "registrar"]:
        cdp.js(f"document.querySelector('.main-nav a[href=\"#{section}\"]').click()")
        assert_js(
            cdp,
            f"!document.getElementById('{section}').hidden && document.querySelector('.main-nav [aria-current]').hash==='#{section}'",
            f"Clic abre {section} sin servidor",
        )
    cdp.js(
        "document.querySelector('#registro-elemento').value='ALI-001';document.querySelector('#registro-momento').value='Almuerzo';document.querySelector('#registro-form').requestSubmit()"
    )
    assert_js(
        cdp,
        "document.querySelector('dialog').open && JSON.parse(localStorage.getItem('allsumaq:actividad:v1')).registros.length===1",
        "Registro y guardado sin servidor",
    )
    cdp.js("document.querySelector('#dialog-contenido a[href=\"#progreso\"]').click()")
    time.sleep(0.15)
    assert_js(
        cdp,
        "document.querySelector('#estadisticas strong').textContent==='1'",
        "Progreso actualizado sin servidor",
    )
    cdp.js("document.querySelector('[data-open=recetas]').click()")
    cdp.call(
        "Input.dispatchKeyEvent",
        {"type": "keyDown", "key": "Tab", "code": "Tab", "windowsVirtualKeyCode": 9},
    )
    assert_js(
        cdp,
        "document.querySelector('dialog').contains(document.activeElement)",
        "Teclado mantiene el foco en la vista interna",
    )
    cdp.call(
        "Input.dispatchKeyEvent",
        {
            "type": "keyDown",
            "key": "Escape",
            "code": "Escape",
            "windowsVirtualKeyCode": 27,
        },
    )
    time.sleep(0.2)
    cdp.js("document.querySelector('.main-nav a[href=\"#inicio\"]').click()")
    time.sleep(0.4)
    screenshot(cdp, "inicio-desktop.png", 1440, 1000)
    screenshot(cdp, "inicio-mobile.png", 390, 844)
    assert not [e for e in cdp.events if e.get("method") == "Runtime.exceptionThrown"]


def run_services(cdp, url):
    cdp.call("Page.enable")
    cdp.call("Runtime.enable")
    cdp.call("Page.navigate", {"url": url})
    wait_ready(cdp)
    cdp.call(
        "Emulation.setDeviceMetricsOverride",
        {"width": 1440, "height": 1000, "deviceScaleFactor": 1, "mobile": False},
    )
    assert_js(
        cdp,
        "ALLSUMAQ_UNIVERSIDADES.sedes.length>=100 && ALLSUMAQ_UNIVERSIDADES.sedes.every(s=>s.fuente.startsWith('https://www.openstreetmap.org/') && Number.isFinite(s.lat)&&Number.isFinite(s.lon))",
        "Sedes con coordenadas y enlaces de procedencia OSM",
    )
    cdp.js(
        "document.getElementById('mapa-lienzo').scrollIntoView({behavior:'instant',block:'center'})"
    )
    for _ in range(100):
        if cdp.js("document.getElementById('mapa-lienzo').dataset.ready==='true'"):
            break
        time.sleep(0.1)
    assert_js(
        cdp,
        "document.querySelectorAll('.university-marker').length>5",
        "Mapa de Lima con marcadores de universidades",
    )
    assert_js(
        cdp,
        "[...document.querySelectorAll('.map-tile')].every(t=>t.src.startsWith('https://tile.openstreetmap.org/'))",
        "Cartografía cargada desde el proveedor real",
    )
    cdp.js(
        "window.initialZoom=AllsumaqMapa.estado.zoom;document.getElementById('mapa-acercar').click()"
    )
    assert_js(
        cdp,
        "AllsumaqMapa.estado.zoom===window.initialZoom+1",
        "Control de zoom funcional",
    )
    cdp.js(
        "document.getElementById('mapa-centrar').click();document.getElementById('buscar-universidad').value='UNI';document.getElementById('buscar-universidad').dispatchEvent(new Event('input'))"
    )
    assert_js(
        cdp,
        "document.querySelectorAll('.university-list-item').length>0 && document.querySelectorAll('.university-list-item').length<20",
        "Buscar UNI no devuelve todas las universidades",
    )
    cdp.js("document.querySelector('.university-list-item').click()")
    time.sleep(0.1)
    assert_js(
        cdp,
        "AllsumaqMapa.estado.zoom===15 && !document.getElementById('universidad-detalle').hidden && Boolean(document.querySelector('.university-marker.selected'))",
        "Seleccionar sede la centra y resalta en el mapa",
    )
    cdp.js(
        "document.getElementById('buscar-universidad').value='zzzzzz-no-existe';document.getElementById('buscar-universidad').dispatchEvent(new Event('input'))"
    )
    assert_js(
        cdp,
        "document.querySelectorAll('.university-list-item').length===0 && document.getElementById('universidades-lista').textContent.includes('No encontramos')",
        "Estado sin coincidencias de universidades",
    )
    cdp.js(
        "document.getElementById('buscar-universidad').value='';document.getElementById('buscar-universidad').dispatchEvent(new Event('input'));document.getElementById('mapa-centrar').click()"
    )
    cdp.call(
        "Emulation.setGeolocationOverride",
        {"latitude": -12.056, "longitude": -77.084, "accuracy": 20},
    )
    cdp.call(
        "Browser.grantPermissions",
        {"permissions": ["geolocation"], "origin": url.split("/index.html")[0]},
    )
    cdp.js("document.getElementById('mapa-ubicacion').click()")
    time.sleep(0.3)
    assert_js(
        cdp,
        "AllsumaqMapa.estado.siguiendoUbicacion && document.getElementById('mapa-posicion-usuario') && document.getElementById('mapa-estado').textContent.includes('20 m')",
        "Geolocalización con permiso y precisión indicada",
    )
    cdp.js("document.getElementById('mapa-ubicacion').click()")
    assert_js(
        cdp,
        "!AllsumaqMapa.estado.siguiendoUbicacion",
        "El usuario puede detener su ubicación",
    )
    cdp.js(
        "document.getElementById('mapa-centrar').click();window.geoBefore=AllsumaqMapa.estado.centro;document.getElementById('mapa-lienzo').focus()"
    )
    cdp.call(
        "Input.dispatchKeyEvent",
        {
            "type": "keyDown",
            "key": "ArrowRight",
            "code": "ArrowRight",
            "windowsVirtualKeyCode": 39,
        },
    )
    assert_js(
        cdp,
        "AllsumaqMapa.estado.centro.lon>window.geoBefore.lon",
        "Desplazamiento del mapa por teclado",
    )
    cdp.js("document.getElementById('mapa-centrar').click()")
    # Esperar solo las teselas visibles; sin precarga ni descargas masivas.
    for _ in range(100):
        if cdp.js(
            "Number(document.getElementById('mapa-lienzo').dataset.tilesLoaded)>0"
        ):
            break
        time.sleep(0.1)
    assert_js(
        cdp,
        "Number(document.getElementById('mapa-lienzo').dataset.tilesLoaded)>0",
        "Se recibieron imágenes cartográficas reales",
    )
    image = cdp.call(
        "Page.captureScreenshot", {"format": "png", "captureBeyondViewport": False}
    )
    (OUTPUT / "mapa-universidades-desktop.png").write_bytes(
        base64.b64decode(image["data"])
    )
    cdp.call(
        "Emulation.setDeviceMetricsOverride",
        {"width": 390, "height": 844, "deviceScaleFactor": 1, "mobile": False},
    )
    time.sleep(0.15)
    assert_js(
        cdp,
        "document.documentElement.scrollWidth<=390 && document.getElementById('mapa-lienzo').clientWidth<=390",
        "Mapa y lista adaptados a móvil",
    )
    image = cdp.call(
        "Page.captureScreenshot", {"format": "png", "captureBeyondViewport": False}
    )
    (OUTPUT / "mapa-universidades-mobile.png").write_bytes(
        base64.b64decode(image["data"])
    )
    cdp.js(
        "document.querySelector('.main-nav a[href=\"#perfil\"]').click(); document.getElementById('abrir-acceso').click()"
    )
    time.sleep(0.2)
    assert_js(
        cdp,
        "document.getElementById('acceso-dialog').open && document.getElementById('acceso-mensaje').textContent.includes('pendiente de activación')",
        "Acceso Google informa configuración pendiente sin simular una cuenta",
    )
    assert_js(
        cdp,
        "document.getElementById('acceso-dialog').scrollWidth<=document.getElementById('acceso-dialog').clientWidth",
        "Acceso adaptado a móvil",
    )
    image = cdp.call(
        "Page.captureScreenshot", {"format": "png", "captureBeyondViewport": False}
    )
    (OUTPUT / "acceso-google-mobile.png").write_bytes(base64.b64decode(image["data"]))
    cdp.call(
        "Input.dispatchKeyEvent",
        {
            "type": "keyDown",
            "key": "Escape",
            "code": "Escape",
            "windowsVirtualKeyCode": 27,
        },
    )
    time.sleep(0.15)
    assert_js(
        cdp,
        "!document.getElementById('acceso-dialog').open",
        "Escape cierra el acceso Google",
    )
    cdp.js(
        "window.guestSaved=localStorage.getItem('allsumaq:actividad:v1');document.dispatchEvent(new CustomEvent('allsumaq:sesion',{detail:{user:{sub:'123456789012345'}}}))"
    )
    assert_js(
        cdp,
        "document.getElementById('estadisticas').textContent.includes('0') && document.getElementById('favoritos').textContent.includes('Tu próxima elección')",
        "Actividad separada para la cuenta identificada",
    )
    cdp.js(
        "document.dispatchEvent(new CustomEvent('allsumaq:sesion',{detail:{user:null}}))"
    )
    assert_js(
        cdp,
        "localStorage.getItem('allsumaq:actividad:v1')===window.guestSaved",
        "Cambiar de cuenta conserva la actividad del visitante",
    )
    auth_checks = cdp.js(
        "import('/tests/comprobar_auth.mjs').then(m=>m.runAuthChecks())"
    )
    checks.extend(auth_checks)
    for name in auth_checks:
        print("OK:", name, flush=True)
    assert not [e for e in cdp.events if e.get("method") == "Runtime.exceptionThrown"]


def run_places(cdp, url):
    cdp.call("Page.enable")
    cdp.call("Runtime.enable")
    cdp.call("Page.navigate", {"url": url + "#mapa"})
    wait_ready(cdp)
    cdp.js("""window.placeRequests=[]; window.originalFetch=window.fetch;
      window.fetch=async (url, options)=>{
        if (!String(url).includes('/api/interpreter') || !String(options?.body).includes('around')) return originalFetch(url,options);
        placeRequests.push(String(options.body));
        const u=window.testCampus;
        return {ok:true,json:async()=>({elements:[
          {type:'node',id:1001,lat:u.lat+.001,lon:u.lon,tags:{amenity:'restaurant',name:'Restaurante de prueba'}},
          {type:'node',id:1002,lat:u.lat+.002,lon:u.lon,tags:{amenity:'marketplace',name:'Mercado de prueba'}},
          {type:'way',id:1003,center:{lat:u.lat+.003,lon:u.lon},tags:{amenity:'social_facility',social_facility:'soup_kitchen',name:'Comedor de prueba'}},
          {type:'node',id:1004,lat:u.lat+.02,lon:u.lon,tags:{amenity:'restaurant',name:'Fuera del radio'}},
          {type:'node',id:1005,lat:u.lat,lon:u.lon,tags:{amenity:'bank',name:'Banco'}}
        ]})};
      };
      window.testCampus=ALLSUMAQ_UNIVERSIDADES.sedes[0];
      AllsumaqMapa.seleccionar(testCampus.id);""")
    time.sleep(.3)
    assert_js(cdp, "document.querySelector('#lugares-radio').value==='500' && placeRequests[0].includes('500')", "Radio inicial de 500 m en la consulta real del cliente")
    assert_js(cdp, "document.querySelectorAll('.nearby-card').length===3", "Mercado, restaurante y comedor; descarta categorías ajenas y puntos fuera del radio")
    assert_js(cdp, "document.querySelector('.nearby-card').dataset.lugar==='node/1001'", "Orden de menor a mayor distancia")
    assert_js(cdp, "[...document.querySelectorAll('.nearby-card a')].every(a=>a.href.startsWith('https://www.openstreetmap.org/'))", "Cada lugar conserva el enlace al registro cartográfico")
    cdp.js("document.querySelector('[name=presupuesto]').value='10'; document.querySelector('#filtros').dispatchEvent(new Event('change'))")
    assert_js(cdp, "document.querySelectorAll('.nearby-card').length===0 && document.querySelector('#lugares-estado').textContent.includes('3 con precio por confirmar')", "Presupuesto excluye lugares sin precios sin confundirlos con ausencia de establecimientos")
    cdp.js("document.querySelector('#lugares-pendientes').click()")
    assert_js(cdp, "document.querySelectorAll('.nearby-card').length===3 && document.querySelector('.nearby-card').textContent.includes('No se puede confirmar')", "Opciones pendientes se muestran con aclaración de presupuesto")
    cdp.js("""ALLSUMAQ_PRECIOS_LUGARES.push(
      {osmId:'node/1001',plato:'Menú de prueba',min:8,max:10,fuente:'https://example.com/menu',fecha:'2026-10-31'},
      {osmId:'node/1002',plato:'Otro menú',min:8,max:12,fuente:'https://example.com/menu',fecha:'2026-10-31'});
      document.querySelector('#lugares-pendientes').click();""")
    assert_js(cdp, "document.querySelectorAll('.nearby-card').length===1 && document.querySelector('.nearby-card').textContent.includes('Menú de prueba')", "Filtro usa el máximo del precio por plato, incluida la igualdad del límite")
    cdp.js("document.querySelector('#lugares-tipo').value='comedor'; document.querySelector('#lugares-tipo').dispatchEvent(new Event('change'))")
    assert_js(cdp, "document.querySelectorAll('.nearby-card').length===0 && placeRequests.length===1", "Cambiar categoría o presupuesto no repite consultas externas")
    cdp.js("document.querySelector('#limpiar-filtros').click(); document.querySelector('#lugares-tipo').value=''; document.querySelector('#lugares-tipo').dispatchEvent(new Event('change'))")
    time.sleep(.2)
    assert_js(cdp, "document.querySelectorAll('.nearby-card').length===3", "Limpiar presupuesto restaura los lugares")
    cdp.js("AllsumaqMapa.seleccionar(testCampus.id)")
    time.sleep(.2)
    assert_js(cdp, "placeRequests.length===1", "Caché evita repetir la misma sede y radio")
    cdp.js("document.querySelector('#lugares-radio').value='1000'; document.querySelector('#lugares-radio').dispatchEvent(new Event('change'))")
    time.sleep(.2)
    assert_js(cdp, "placeRequests.length===2 && placeRequests[1].includes('1000')", "Cambiar radio realiza una consulta nueva")
    cdp.js("document.querySelector('[data-mode=lista]').click(); document.querySelector('.nearby-card button').click()")
    assert_js(cdp, "!document.querySelector('#mapa-real').hidden && document.querySelector('.nearby-card.selected').dataset.lugar==='node/1001'", "Ver lugar desde Lista abre el mapa y sincroniza la selección")
    cdp.js("document.querySelector('#mapa-lienzo').scrollIntoView(); AllsumaqMapa.setVisible(true)")
    time.sleep(.5)
    assert_js(cdp, "document.querySelectorAll('.venue-marker').length>0", "Lugares con marcadores propios en el mapa")
    cdp.js("document.querySelector('.venue-marker').click()")
    assert_js(cdp, "!!document.querySelector('.nearby-card.selected')", "Marcador selecciona su tarjeta")
    cdp.js("window.fetch=async()=>{throw new Error('Red simulada')}; document.querySelector('#lugares-radio').value='2000'; document.querySelector('#lugares-radio').dispatchEvent(new Event('change'))")
    time.sleep(.2)
    assert_js(cdp, "!document.querySelector('#lugares-reintentar').hidden && document.querySelectorAll('.nearby-card').length===0 && document.querySelector('#lugares-lista').getAttribute('aria-busy')==='false'", "Error de red muestra reintento y elimina resultados de la consulta anterior")
    # Respuestas fuera de orden no pueden reemplazar los resultados de otra sede.
    cdp.js("""window.pending=[]; window.fetch=(url,options)=>new Promise(resolve=>pending.push(resolve));
      AllsumaqMapa.seleccionar(ALLSUMAQ_UNIVERSIDADES.sedes[1].id);
      AllsumaqMapa.seleccionar(ALLSUMAQ_UNIVERSIDADES.sedes[2].id);
      pending[1]({ok:true,json:async()=>({elements:[]})});""")
    time.sleep(.1)
    cdp.js("pending[0]({ok:true,json:async()=>({elements:[{type:'node',id:999,lat:testCampus.lat,lon:testCampus.lon,tags:{amenity:'restaurant'}}]})})")
    time.sleep(.1)
    assert_js(cdp, "document.querySelectorAll('.nearby-card').length===0 && document.querySelector('#lugares-reintentar').hidden", "Una respuesta antigua no reemplaza la selección actual")
    cdp.js("""window.fallbackRequests=[]; window.fetch=async(url)=>{
      fallbackRequests.push(url);
      if (url===ALLSUMAQ_SERVICIOS.mapa.overpass) throw new Error('Proveedor principal no disponible');
      return {ok:true,json:async()=>({elements:[]})};
      };
      document.querySelector('#lugares-radio').value='1000';
      document.querySelector('#lugares-radio').dispatchEvent(new Event('change'));""")
    time.sleep(.2)
    assert_js(cdp, "fallbackRequests.length===2 && document.querySelector('#lugares-reintentar').hidden", "Proveedor alternativo recupera una consulta cuando falla el principal")
    cdp.call("Emulation.setDeviceMetricsOverride", {"width": 390, "height": 844, "deviceScaleFactor": 1, "mobile": True})
    cdp.js("document.querySelector('#lugares-cercanos').scrollIntoView({block:'start'})")
    time.sleep(.2)
    assert_js(cdp, "document.documentElement.scrollWidth<=innerWidth+1", "Panel de lugares sin desbordamiento horizontal en móvil")
    (OUTPUT / "lugares-mobile.png").write_bytes(base64.b64decode(cdp.call("Page.captureScreenshot", {"format": "png"})["data"]))
    if "--vivo" in sys.argv:
        cdp.js("window.fetch=originalFetch; document.querySelector('#lugares-radio').value='500'; AllsumaqMapa.seleccionar(testCampus.id)")
        # Primer radio está cacheado: usar otra sede para comprobar el proveedor real.
        cdp.js("AllsumaqMapa.seleccionar(ALLSUMAQ_UNIVERSIDADES.sedes[3].id)")
        for _ in range(125):
            if cdp.js("document.querySelector('#lugares-lista').getAttribute('aria-busy')==='false'"):
                break
            time.sleep(.5)
        assert_js(cdp, "document.querySelector('#lugares-reintentar').hidden && document.querySelector('#lugares-estado').textContent.includes('lugares registrados')", "Consulta al servicio público real completada")
        print("REAL:", cdp.js("document.querySelector('#lugares-sede').textContent+' '+document.querySelector('#lugares-estado').textContent"), flush=True)
    assert not [e for e in cdp.events if e.get("method") == "Runtime.exceptionThrown"]


def run_navigation(cdp, url):
    cdp.call("Page.enable")
    cdp.call("Runtime.enable")
    cdp.call(
        "Emulation.setDeviceMetricsOverride",
        {"width": 1440, "height": 1000, "deviceScaleFactor": 1, "mobile": False},
    )
    cdp.call(
        "Emulation.setEmulatedMedia",
        {"features": [{"name": "prefers-reduced-motion", "value": "reduce"}]},
    )
    cdp.call("Page.navigate", {"url": url})
    wait_ready(cdp)
    cdp.js("localStorage.clear(); location.reload()")
    time.sleep(0.3)
    wait_ready(cdp)
    visible = "[...document.querySelectorAll('main > section')].filter(s=>!s.hidden).map(s=>s.id).join(',')"
    assert_js(
        cdp,
        visible + "==='inicio,mapa'",
        "Inicio y Mapa son las únicas secciones del recorrido por scroll",
    )
    assert_js(
        cdp,
        "document.querySelectorAll('.main-nav a').length===5 && document.querySelectorAll('.observed-section').length===2",
        "La hotbar conserva cinco opciones y observa solo las dos secciones de scroll",
    )
    cdp.js("document.getElementById('mapa').scrollIntoView({behavior:'instant'})")
    time.sleep(0.2)
    assert_js(
        cdp,
        "document.querySelector('.main-nav [aria-current]').hash==='#mapa'",
        "El scroll de Inicio a Mapa actualiza la hotbar",
    )
    cdp.js(
        "window.scrollTo({top:document.documentElement.scrollHeight,behavior:'instant'})"
    )
    time.sleep(0.15)
    assert_js(
        cdp,
        visible
        + "==='inicio,mapa' && document.querySelector('.main-nav [aria-current]').hash==='#mapa'",
        "Llegar al final no abre Registrar, Progreso ni Perfil",
    )
    cdp.js(
        "document.getElementById('buscar').value='sangrecita';document.getElementById('filtro-distrito').value='Los Olivos';document.getElementById('buscar').dispatchEvent(new Event('input',{bubbles:true}));document.getElementById('alimentos-grid').scrollIntoView({block:'center',behavior:'instant'})"
    )
    time.sleep(0.15)
    cdp.js(
        "window.explorationScroll=window.scrollY;document.querySelector('.main-nav a[href=\"#registrar\"]').click()"
    )
    assert_js(
        cdp,
        visible
        + "==='registrar' && window.scrollY===0 && document.activeElement.id==='titulo-registrar'",
        "Registrar abre una vista independiente y enfoca su título",
    )
    cdp.js(
        "document.getElementById('registro-elemento').value='ALI-001';document.getElementById('registro-momento').value='Almuerzo';document.getElementById('registro-notas').value='Borrador conservado';document.querySelector('.main-nav a[href=\"#perfil\"]').click()"
    )
    assert_js(
        cdp,
        visible
        + "==='perfil' && document.querySelector('.main-nav [aria-current]').hash==='#perfil'",
        "Perfil se abre por clic sin apilar otras vistas",
    )
    cdp.js("document.querySelector('.main-nav a[href=\"#progreso\"]').click()")
    assert_js(
        cdp,
        visible + "==='progreso'",
        "Progreso muestra únicamente su propio contenido",
    )
    cdp.js("history.back()")
    time.sleep(0.15)
    assert_js(cdp, visible + "==='perfil'", "Atrás del navegador recupera Perfil")
    cdp.js("history.back()")
    time.sleep(0.15)
    assert_js(
        cdp,
        visible
        + "==='registrar' && document.getElementById('registro-notas').value==='Borrador conservado' && document.getElementById('registro-elemento').value==='ALI-001'",
        "Atrás recupera Registrar con los datos del formulario intactos",
    )
    cdp.js("history.forward()")
    time.sleep(0.15)
    assert_js(
        cdp,
        visible + "==='perfil'",
        "Adelante del navegador recupera la vista correcta",
    )
    cdp.js("document.querySelector('#perfil [data-volver-explorar]').click()")
    assert_js(
        cdp,
        visible
        + "==='inicio,mapa' && Math.abs(window.scrollY-window.explorationScroll)<3 && document.getElementById('buscar').value==='sangrecita' && document.getElementById('filtro-distrito').value==='Los Olivos'",
        "Volver a explorar recupera filtros y posición exacta del catálogo",
    )
    cdp.js("history.back()")
    time.sleep(0.15)
    assert_js(
        cdp,
        visible + "==='perfil'",
        "Atrás también funciona después de Volver a explorar",
    )
    cdp.js("document.querySelector('.main-nav a[href=\"#inicio\"]').click()")
    assert_js(
        cdp,
        visible + "==='inicio,mapa' && window.scrollY===0",
        "Inicio desde una vista personal regresa a la portada",
    )
    cdp.js(
        "document.querySelector('.main-nav a[href=\"#mapa\"]').click();document.querySelector('[data-alimento=\"ALI-001\"]').click();document.querySelector('[data-register-item=\"ALI-001\"]').click()"
    )
    assert_js(
        cdp,
        visible
        + "==='registrar' && !document.querySelector('#detalle-dialog').open && document.getElementById('registro-elemento').value==='ALI-001'",
        "Registrar desde una ficha abre la vista personal con el plato seleccionado",
    )
    cdp.js("document.getElementById('registro-form').requestSubmit()")
    assert_js(
        cdp,
        "document.getElementById('detalle-dialog').open && document.body.dataset.vista==='registrar'",
        "Guardar abre la confirmación sobre la vista Registrar",
    )
    cdp.js("document.querySelector('#dialog-contenido a[href=\"#progreso\"]').click()")
    assert_js(
        cdp,
        visible
        + "==='progreso' && document.querySelector('#estadisticas strong').textContent==='1' && !document.querySelector('#detalle-dialog').open",
        "La confirmación lleva a Progreso y conserva el registro",
    )
    cdp.js(
        "window.scrollTo({top:document.documentElement.scrollHeight,behavior:'instant'})"
    )
    time.sleep(0.15)
    assert_js(
        cdp,
        "document.querySelector('.main-nav [aria-current]').hash==='#progreso'",
        "El scroll dentro de Progreso no cambia de módulo",
    )
    cdp.js("document.querySelector('.main-nav a[href=\"#perfil\"]').focus()")
    cdp.call(
        "Input.dispatchKeyEvent",
        {
            "type": "keyDown",
            "key": "Enter",
            "code": "Enter",
            "windowsVirtualKeyCode": 13,
        },
    )
    time.sleep(0.15)
    assert_js(
        cdp, visible + "==='perfil'", "Las vistas por clic también se abren con teclado"
    )
    cdp.js(
        "document.getElementById('abrir-acceso').focus();document.getElementById('abrir-acceso').click()"
    )
    assert_js(
        cdp,
        "document.getElementById('acceso-dialog').open && !document.getElementById('perfil').hidden",
        "El acceso Google se abre desde la vista Perfil",
    )
    cdp.call(
        "Input.dispatchKeyEvent",
        {
            "type": "keyDown",
            "key": "Escape",
            "code": "Escape",
            "windowsVirtualKeyCode": 27,
        },
    )
    time.sleep(0.15)
    assert_js(
        cdp,
        visible + "==='perfil' && document.activeElement.id==='abrir-acceso'",
        "Cerrar el acceso mantiene Perfil y devuelve el foco",
    )
    for section in ["registrar", "progreso", "perfil"]:
        cdp.call("Page.navigate", {"url": url + f"?vista-directa={section}#{section}"})
        time.sleep(0.2)
        wait_ready(cdp)
        assert_js(
            cdp,
            visible
            + f"==='{section}' && document.querySelector('.main-nav [aria-current]').hash==='#{section}'",
            f"Enlace directo y recarga de {section} muestran solo esa vista",
        )
    cdp.call(
        "Emulation.setDeviceMetricsOverride",
        {"width": 390, "height": 844, "deviceScaleFactor": 1, "mobile": False},
    )
    cdp.js("document.querySelector('.main-nav a[href=\"#registrar\"]').click()")
    assert_js(
        cdp,
        "document.documentElement.scrollWidth<=390 && document.body.dataset.vista==='registrar'",
        "Registrar se adapta a móvil como vista independiente",
    )
    image = cdp.call(
        "Page.captureScreenshot", {"format": "png", "captureBeyondViewport": False}
    )
    (OUTPUT / "navegacion-registrar-mobile.png").write_bytes(
        base64.b64decode(image["data"])
    )
    cdp.js(
        "document.querySelector('.main-nav a[href=\"#perfil\"]').click();window.scrollTo({top:document.documentElement.scrollHeight,behavior:'instant'})"
    )
    time.sleep(0.15)
    assert_js(
        cdp,
        visible
        + "==='perfil' && document.querySelector('.main-nav [aria-current]').hash==='#perfil' && document.documentElement.scrollWidth<=390",
        "En móvil, el scroll de Perfil conserva la vista activa",
    )
    cdp.js("document.querySelector('#perfil [data-volver-explorar]').click()")
    assert_js(
        cdp,
        visible + "==='inicio,mapa'",
        "El regreso desde móvil recupera el recorrido Inicio y Mapa",
    )
    assert not [
        event
        for event in cdp.events
        if event.get("method") == "Runtime.exceptionThrown"
    ]
    checks.append("Sin errores JavaScript en los recorridos de navegación")


server = ThreadingHTTPServer(
    ("127.0.0.1", 0), functools.partial(Handler, directory=str(ROOT))
)
threading.Thread(target=server.serve_forever, daemon=True).start()
url = f"http://127.0.0.1:{server.server_port}/index.html"
PROFILE.mkdir(parents=True, exist_ok=True)
active_port = PROFILE / "DevToolsActivePort"
if active_port.exists():
    active_port.unlink()
startup = subprocess.STARTUPINFO()
startup.dwFlags |= subprocess.STARTF_USESHOWWINDOW
startup.wShowWindow = 0
with (OUTPUT / "chrome.log").open("w", encoding="utf-8") as log:
    process = subprocess.Popen(
        [
            str(CHROME),
            "--headless=new",
            "--disable-gpu",
            "--no-first-run",
            "--no-default-browser-check",
            "--disable-background-networking",
            "--disable-extensions",
            "--disable-sync",
            "--remote-debugging-port=0",
            f"--user-data-dir={PROFILE}",
            "about:blank",
        ],
        stdout=log,
        stderr=log,
        startupinfo=startup,
    )
    try:
        for _ in range(150):
            if active_port.exists():
                break
            if process.poll() is not None:
                raise RuntimeError(
                    f"Chrome exited: {process.returncode}; see docs/verificacion/chrome.log"
                )
            time.sleep(0.1)
        port = active_port.read_text().splitlines()[0]
        targets = json.load(urlopen(f"http://127.0.0.1:{port}/json"))
        target = next(t for t in targets if t["type"] == "page")
        cdp = CDP(target["webSocketDebuggerUrl"])
        file_mode = "--archivo" in sys.argv
        services_mode = "--servicios" in sys.argv
        navigation_mode = "--navegacion" in sys.argv
        places_mode = "--lugares" in sys.argv
        if places_mode:
            run_places(cdp, url)
        elif navigation_mode:
            run_navigation(cdp, url)
        elif services_mode:
            run_services(cdp, url)
        elif file_mode:
            run_file(cdp)
        else:
            run(cdp, url)
        (
            OUTPUT
            / (
                "resultados-lugares.json" if places_mode else "resultados-navegacion.json"
                if navigation_mode
                else (
                    "resultados-servicios.json"
                    if services_mode
                    else "resultados-archivo.json" if file_mode else "resultados.json"
                )
            )
        ).write_text(
            json.dumps(
                {
                    "ok": True,
                    "pruebas": checks,
                    "fecha": time.strftime("%Y-%m-%d"),
                    "navegador": "Chrome headless, perfil aislado",
                    "limites": "No sustituye acceso real con Google, pruebas con lectores de pantalla ni aprobación de los siguientes mockups.",
                },
                ensure_ascii=False,
                indent=2,
            ),
            encoding="utf-8",
        )
        print(
            f"\n{len(checks)} comprobaciones superadas. Capturas en docs/verificacion."
        )
    finally:
        process.terminate()
        process.wait(timeout=15)
        server.shutdown()
