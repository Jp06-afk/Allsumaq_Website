(function () {
  "use strict";
  const config = window.ALLSUMAQ_SERVICIOS.mapa;
  const $ = (id) => document.getElementById(id);
  const surface = $("mapa-lienzo");
  const tilesLayer = $("mapa-tiles");
  const markersLayer = $("mapa-marcadores");
  const sourceKey = "allsumaq:universidades-osm:v1";
  const normalize = window.AllsumaqModelo.normalizar;
  let dataset = window.ALLSUMAQ_UNIVERSIDADES;
  let center = { ...config.centro };
  let zoom = config.zoomInicial;
  let selected = "";
  let query = "";
  let started = false;
  let visible = true;
  let frame = 0;
  let watchId = null;
  let currentPosition = null;
  let geoRequest = 0;
  let refreshInProgress = false;
  let lastAttempt = 0;
  let dragging = false;
  let moved = false;
  let pinch = null;
  const pointers = new Map();
  const tileNodes = new Map();
  const markerNodes = new Map();

  function validDataset(data) {
    return (
      data &&
      Array.isArray(data.sedes) &&
      data.sedes.length > 0 &&
      data.sedes.every(
        (item) =>
          item &&
          /^[a-z]+-\d+$/.test(item.id) &&
          typeof item.nombre === "string" &&
          Number.isFinite(item.lat) &&
          Number.isFinite(item.lon) &&
          item.lat >= -12.5 &&
          item.lat <= -11.65 &&
          item.lon >= -77.25 &&
          item.lon <= -76.6,
      )
    );
  }
  try {
    const saved = JSON.parse(localStorage.getItem(sourceKey));
    if (
      validDataset(saved) &&
      Date.parse(saved.consultado) > Date.parse(dataset.consultado)
    )
      dataset = saved;
  } catch (_) {
    /* La copia incluida sigue disponible si no hay almacenamiento. */
  }

  function project(point, level = zoom) {
    const size = 256 * 2 ** level;
    const latitude = Math.max(-85.0511, Math.min(85.0511, point.lat));
    const sin = Math.sin((latitude * Math.PI) / 180);
    return {
      x: ((point.lon + 180) / 360) * size,
      y: (0.5 - Math.log((1 + sin) / (1 - sin)) / (4 * Math.PI)) * size,
    };
  }
  function unproject(point, level = zoom) {
    const size = 256 * 2 ** level;
    return {
      lon: (point.x / size) * 360 - 180,
      lat:
        (Math.atan(Math.sinh(Math.PI * (1 - (2 * point.y) / size))) * 180) /
        Math.PI,
    };
  }
  function constrain(point) {
    return {
      lat: Math.max(-12.55, Math.min(-11.6, point.lat)),
      lon: Math.max(-77.35, Math.min(-76.5, point.lon)),
    };
  }
  function scheduleRender() {
    if (frame || !started || !visible) return;
    frame = requestAnimationFrame(() => {
      frame = 0;
      render();
    });
  }
  function matchingUniversities() {
    const term = normalize(query).trim();
    if (!term) return dataset.sedes;
    return dataset.sedes.filter((item) => {
      const text = normalize(
        item.nombre + " " + item.distrito + " " + item.sigla,
      );
      if (term.length > 4) return text.includes(term);
      const acronym = normalize(item.nombre)
        .split(/\s+/)
        .filter(
          (word) =>
            word &&
            !["de", "la", "del", "el", "las", "los", "y", "en"].includes(word),
        )
        .map((word) => word[0])
        .join("");
      return (
        normalize(item.sigla).includes(term) ||
        text.split(/[^\p{L}\p{N}]+/u).includes(term) ||
        acronym.startsWith(term)
      );
    });
  }

  function render() {
    const width = surface.clientWidth;
    const height = surface.clientHeight;
    if (!width || !height) return;
    const projected = project(center);
    const left = projected.x - width / 2;
    const top = projected.y - height / 2;
    const needed = new Set();
    const dimension = 2 ** zoom;
    for (
      let tileY = Math.floor(top / 256);
      tileY <= Math.floor((top + height) / 256);
      tileY++
    ) {
      for (
        let tileX = Math.floor(left / 256);
        tileX <= Math.floor((left + width) / 256);
        tileX++
      ) {
        if (tileY < 0 || tileY >= dimension) continue;
        const x = ((tileX % dimension) + dimension) % dimension;
        const key = `${zoom}/${x}/${tileY}`;
        needed.add(key);
        let tile = tileNodes.get(key);
        if (!tile) {
          tile = document.createElement("img");
          tile.className = "map-tile";
          tile.alt = "";
          tile.width = tile.height = 256;
          tile.draggable = false;
          tile.referrerPolicy = "strict-origin-when-cross-origin";
          tile.onload = () => {
            $("mapa-carga").hidden = true;
            surface.dataset.tilesLoaded = String(
              Number(surface.dataset.tilesLoaded || 0) + 1,
            );
          };
          tile.onerror = () => {
            $("mapa-estado").textContent =
              "Parte de la cartografía no pudo cargarse. Comprueba tu conexión; la lista de universidades sigue disponible.";
          };
          tile.src = config.tiles
            .replace("{z}", zoom)
            .replace("{x}", x)
            .replace("{y}", tileY);
          tileNodes.set(key, tile);
          tilesLayer.appendChild(tile);
        }
        tile.style.transform = `translate(${Math.round(tileX * 256 - left)}px, ${Math.round(tileY * 256 - top)}px)`;
      }
    }
    for (const [key, node] of tileNodes) {
      if (!needed.has(key)) {
        node.remove();
        tileNodes.delete(key);
      }
    }
    const markerIds = new Set();
    for (const uni of matchingUniversities()) {
      const point = project(uni);
      const x = point.x - left;
      const y = point.y - top;
      if (x < -30 || x > width + 30 || y < -30 || y > height + 50) continue;
      markerIds.add(uni.id);
      let marker = markerNodes.get(uni.id);
      if (!marker) {
        marker = document.createElement("button");
        marker.type = "button";
        marker.className = "university-marker";
        marker.dataset.universidad = uni.id;
        marker.setAttribute("aria-label", uni.nombre);
        marker.innerHTML =
          '<span class="university-pin"><svg class="icon" aria-hidden="true"><use href="#i-university"/></svg></span><span class="university-marker-label"></span>';
        marker.querySelector(".university-marker-label").textContent =
          uni.nombre;
        marker.addEventListener("click", () => selectUniversity(uni.id));
        markerNodes.set(uni.id, marker);
        markersLayer.appendChild(marker);
      }
      marker.style.left = x + "px";
      marker.style.top = y + "px";
      marker.classList.toggle("selected", uni.id === selected);
      marker.setAttribute("aria-pressed", String(uni.id === selected));
    }
    for (const [id, marker] of markerNodes) {
      if (!markerIds.has(id)) {
        marker.remove();
        markerNodes.delete(id);
      }
    }
    renderPlaces(left, top, width, height);
    renderUserPosition(left, top);
    $("mapa-acercar").disabled = zoom >= config.zoomMaximo;
    $("mapa-alejar").disabled = zoom <= config.zoomMinimo;
    surface.dataset.zoom = String(zoom);
    surface.dataset.ready = "true";
  }

  function renderUserPosition(left, top) {
    let marker = $("mapa-posicion-usuario");
    if (!currentPosition) {
      marker?.remove();
      return;
    }
    if (!marker) {
      marker = document.createElement("div");
      marker.id = "mapa-posicion-usuario";
      marker.className = "user-location-marker";
      marker.setAttribute("role", "img");
      marker.setAttribute("aria-label", "Tu ubicación aproximada");
      markersLayer.appendChild(marker);
    }
    const point = project(currentPosition);
    marker.style.left = point.x - left + "px";
    marker.style.top = point.y - top + "px";
  }

  function zoomTo(level, anchor = null) {
    const next = Math.max(
      config.zoomMinimo,
      Math.min(config.zoomMaximo, level),
    );
    if (next === zoom) return;
    if (anchor) {
      const oldCenter = project(center);
      const underMouse = unproject({
        x: oldCenter.x + anchor.x - surface.clientWidth / 2,
        y: oldCenter.y + anchor.y - surface.clientHeight / 2,
      });
      zoom = next;
      const newPoint = project(underMouse);
      center = constrain(
        unproject({
          x: newPoint.x - anchor.x + surface.clientWidth / 2,
          y: newPoint.y - anchor.y + surface.clientHeight / 2,
        }),
      );
    } else zoom = next;
    scheduleRender();
  }

  function updateList() {
    const list = $("universidades-lista");
    list.replaceChildren();
    const matches = matchingUniversities();
    $("universidades-conteo").textContent =
      `${matches.length} sedes universitarias registradas en OSM`;
    if (!matches.length) {
      const message = document.createElement("p");
      message.className = "field-help";
      message.textContent =
        "No encontramos esa sede. Prueba el nombre completo de la universidad.";
      list.appendChild(message);
    }
    for (const uni of matches) {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "university-list-item";
      button.dataset.universidad = uni.id;
      button.setAttribute("aria-pressed", String(uni.id === selected));
      const name = document.createElement("span");
      name.textContent = uni.nombre;
      const detail = document.createElement("small");
      detail.textContent =
        uni.distrito || uni.direccion || "Ver sede en el mapa";
      button.append(name, detail);
      button.addEventListener("click", () => selectUniversity(uni.id));
      list.appendChild(button);
    }
    $("universidades-fecha").textContent =
      "Fuente: OpenStreetMap. Consulta: " +
      new Intl.DateTimeFormat("es-PE", {
        dateStyle: "medium",
        timeZone: "America/Lima",
      }).format(new Date(dataset.consultado)) +
      ". Las sedes no representan disponibilidad ni tráfico en tiempo real.";
  }

  function selectUniversity(id, recenter = true) {
    const uni = dataset.sedes.find((item) => item.id === id);
    if (!uni) return;
    selected = id;
    if (recenter) {
      center = { lat: uni.lat, lon: uni.lon };
      zoom = 15;
    }
    const detail = $("universidad-detalle");
    detail.replaceChildren();
    const info = document.createElement("div");
    const title = document.createElement("h3");
    title.textContent = uni.nombre;
    const location = document.createElement("p");
    location.textContent =
      [uni.direccion, uni.distrito].filter(Boolean).join(" · ") ||
      "Coordenadas cartográficas de la sede según OpenStreetMap.";
    info.append(title, location);
    const link = document.createElement("a");
    link.href = uni.fuente;
    link.target = "_blank";
    link.rel = "noopener noreferrer";
    link.className = "button button--light";
    link.textContent = "Consultar ubicación y fuente ↗";
    detail.append(info, link);
    detail.hidden = false;
    document
      .querySelectorAll(".university-list-item")
      .forEach((button) =>
        button.setAttribute(
          "aria-pressed",
          String(button.dataset.universidad === selected),
        ),
      );
    scheduleRender();
    $("mapa-estado").textContent = "Sede seleccionada: " + uni.nombre + ".";
    document.dispatchEvent(new CustomEvent("allsumaq:universidad-seleccionada", { detail: { ...uni } }));
  }

  function stopLocation() {
    geoRequest++;
    if (watchId !== null) navigator.geolocation.clearWatch(watchId);
    watchId = null;
    $("mapa-ubicacion").classList.remove("tracking");
    $("mapa-ubicacion").setAttribute("aria-pressed", "false");
    $("mapa-ubicacion").querySelector("span").textContent = "Mi ubicación";
  }

  function locate() {
    if (watchId !== null) {
      stopLocation();
      currentPosition = null;
      scheduleRender();
      return;
    }
    if (!navigator.geolocation || !window.isSecureContext) {
      $("mapa-estado").textContent =
        "Este navegador no permite consultar la ubicación aquí. Puedes elegir una universidad manualmente.";
      return;
    }
    const request = ++geoRequest;
    let first = true;
    $("mapa-estado").textContent =
      "Esperando tu permiso para usar la ubicación…";
    watchId = navigator.geolocation.watchPosition(
      (position) => {
        if (request !== geoRequest) return;
        const lat = position.coords.latitude;
        const lon = position.coords.longitude;
        if (lat < -12.55 || lat > -11.6 || lon < -77.35 || lon > -76.5) {
          $("mapa-estado").textContent =
            "La ubicación recibida está fuera de la zona de Lima. Puedes explorar las universidades con el selector.";
          stopLocation();
          return;
        }
        currentPosition = { lat, lon, accuracy: position.coords.accuracy };
        if (first) {
          center = { lat, lon };
          zoom = 15;
          first = false;
        }
        $("mapa-ubicacion").classList.add("tracking");
        $("mapa-ubicacion").setAttribute("aria-pressed", "true");
        $("mapa-ubicacion").querySelector("span").textContent =
          "Detener ubicación";
        $("mapa-estado").textContent =
          `Ubicación actualizada. Precisión aproximada: ${Math.round(position.coords.accuracy)} m. Puedes detenerla cuando quieras.`;
        scheduleRender();
      },
      (error) => {
        if (request !== geoRequest) return;
        $("mapa-estado").textContent =
          error.code === 1
            ? "No diste permiso de ubicación. Puedes seguir explorando y elegir una sede manualmente."
            : "No pudimos obtener tu ubicación. Puedes seguir explorando el mapa manualmente.";
        stopLocation();
      },
      { enableHighAccuracy: true, maximumAge: 10000, timeout: 15000 },
    );
  }

  function overpassDataset(raw) {
    if (!raw || !Array.isArray(raw.elements) || raw.remark)
      throw new Error("Respuesta incompleta");
    const sedes = raw.elements
      .filter(
        (item) =>
          /universidad|university/i.test(item.tags?.name || "") &&
          item.tags?.disused !== "yes" &&
          item.tags?.abandoned !== "yes",
      )
      .map((item) => {
        const tags = item.tags;
        const point = item.center || item;
        return {
          id: item.type + "-" + item.id,
          nombre: tags.name,
          sigla: tags.short_name || "",
          lat: point.lat,
          lon: point.lon,
          direccion: [tags["addr:street"], tags["addr:housenumber"]]
            .filter(Boolean)
            .join(" "),
          distrito: tags["addr:district"] || tags["addr:suburb"] || "",
          fuente: "https://www.openstreetmap.org/" + item.type + "/" + item.id,
        };
      })
      .sort((a, b) => a.nombre.localeCompare(b.nombre, "es"));
    const next = {
      fuente: "OpenStreetMap / Overpass API",
      consultado: new Date().toISOString(),
      fechaDatos: raw.osm3s?.timestamp_osm_base || null,
      sedes,
    };
    if (!validDataset(next) || sedes.length < 10)
      throw new Error("Datos insuficientes");
    return next;
  }

  async function refresh() {
    if (refreshInProgress || Date.now() - lastAttempt < 60000) return;
    refreshInProgress = true;
    lastAttempt = Date.now();
    $("universidades-actualizar").disabled = true;
    $("mapa-estado").textContent = "Consultando las sedes de OpenStreetMap…";
    try {
      const response = await fetch(
        config.overpass + "?data=" + encodeURIComponent(config.consulta),
        { signal: AbortSignal.timeout(30000) },
      );
      if (!response.ok) throw new Error("Servicio no disponible");
      const next = overpassDataset(await response.json());
      dataset = next;
      try {
        localStorage.setItem(sourceKey, JSON.stringify(dataset));
      } catch (_) {
        /* Datos válidos en memoria. */
      }
      for (const marker of markerNodes.values()) marker.remove();
      markerNodes.clear();
      if (!dataset.sedes.some((uni) => uni.id === selected)) {
        selected = "";
        $("universidad-detalle").hidden = true;
      }
      updateList();
      scheduleRender();
      $("mapa-estado").textContent = "Sedes actualizadas desde OpenStreetMap.";
    } catch (_) {
      $("mapa-estado").textContent =
        "El proveedor no respondió. Conservamos las sedes de la última consulta disponible; puedes seguir usando el mapa.";
    } finally {
      refreshInProgress = false;
      setTimeout(
        () => {
          $("universidades-actualizar").disabled = false;
        },
        Math.max(0, 60000 - (Date.now() - lastAttempt)),
      );
    }
  }

  function start() {
    if (started || !visible) return;
    if (location.protocol === "file:") {
      $("mapa-carga").textContent =
        "Para cargar la cartografía, abre la web publicada o el servidor local. La lista de sedes está disponible aquí.";
      return;
    }
    started = true;
    $("mapa-carga").textContent = "Cargando el mapa de Lima…";
    scheduleRender();
    if (Date.now() - Date.parse(dataset.consultado) > 6 * 3600000) refresh();
  }

  $("mapa-acercar").addEventListener("click", () => zoomTo(zoom + 1));
  $("mapa-alejar").addEventListener("click", () => zoomTo(zoom - 1));
  $("mapa-centrar").addEventListener("click", () => {
    center = { ...config.centro };
    zoom = config.zoomInicial;
    scheduleRender();
  });
  $("mapa-ubicacion").addEventListener("click", locate);
  $("universidades-actualizar").addEventListener("click", refresh);
  $("buscar-universidad").addEventListener("input", (event) => {
    query = event.target.value;
    updateList();
    scheduleRender();
  });
  surface.addEventListener(
    "wheel",
    (event) => {
      if (!event.ctrlKey) return;
      event.preventDefault();
      const rect = surface.getBoundingClientRect();
      zoomTo(zoom + (event.deltaY < 0 ? 1 : -1), {
        x: event.clientX - rect.left,
        y: event.clientY - rect.top,
      });
    },
    { passive: false },
  );
  surface.addEventListener("keydown", (event) => {
    if (event.target !== surface) return;
    if (["+", "="].includes(event.key)) {
      event.preventDefault();
      zoomTo(zoom + 1);
    } else if (event.key === "-") {
      event.preventDefault();
      zoomTo(zoom - 1);
    } else if (
      ["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"].includes(event.key)
    ) {
      event.preventDefault();
      const point = project(center);
      point.x +=
        event.key === "ArrowRight" ? 80 : event.key === "ArrowLeft" ? -80 : 0;
      point.y +=
        event.key === "ArrowDown" ? 80 : event.key === "ArrowUp" ? -80 : 0;
      center = constrain(unproject(point));
      scheduleRender();
    }
  });
  surface.addEventListener("pointerdown", (event) => {
    if (event.target.closest("button, a") || event.button > 0) return;
    moved = false;
    dragging = true;
    surface.setPointerCapture(event.pointerId);
    pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
    if (pointers.size === 2) {
      const [a, b] = [...pointers.values()];
      pinch = { distance: Math.hypot(a.x - b.x, a.y - b.y), zoom };
    }
  });
  surface.addEventListener("pointermove", (event) => {
    if (!pointers.has(event.pointerId)) return;
    const previous = pointers.get(event.pointerId);
    pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
    const dx = event.clientX - previous.x;
    const dy = event.clientY - previous.y;
    if (Math.abs(dx) + Math.abs(dy) > 2) moved = true;
    if (pointers.size === 2 && pinch) {
      const [a, b] = [...pointers.values()];
      const ratio = Math.hypot(a.x - b.x, a.y - b.y) / pinch.distance;
      zoomTo(pinch.zoom + Math.round(Math.log2(ratio)));
    } else if (dragging && pointers.size === 1) {
      const point = project(center);
      center = constrain(unproject({ x: point.x - dx, y: point.y - dy }));
      scheduleRender();
    }
  });
  function endPointer(event) {
    pointers.delete(event.pointerId);
    if (pointers.size < 2) pinch = null;
    if (!pointers.size) dragging = false;
  }
  surface.addEventListener("pointerup", endPointer);
  surface.addEventListener("pointercancel", endPointer);
  document.addEventListener("visibilitychange", () => {
    if (document.hidden) stopLocation();
  });
  if ("ResizeObserver" in window)
    new ResizeObserver(scheduleRender).observe(surface);
  if ("IntersectionObserver" in window) {
    new IntersectionObserver((entries) => {
      if (entries[0].isIntersecting) start();
      else if (watchId !== null) stopLocation();
    }).observe(surface);
  }
  updateList();
  let nearbyPlaces = [], selectedPlace = "", focusedPlace = null;
  const placeNodes = new Map();
  function renderPlaces(left, top, width, height) {
    const visibleIds = new Set();
    const candidates = focusedPlace && !nearbyPlaces.some(p => p.id === focusedPlace.id) ? [...nearbyPlaces, focusedPlace] : nearbyPlaces;
    for (const place of candidates) {
      const point = project(place), x = point.x - left, y = point.y - top;
      if (x < -30 || x > width + 30 || y < -30 || y > height + 30) continue;
      visibleIds.add(place.id);
      let marker = placeNodes.get(place.id);
      if (!marker) {
        marker = document.createElement("button");
        marker.type = "button";
        marker.className = "venue-marker";
        marker.dataset.lugar = place.id;
        marker.innerHTML = '<svg class="icon" aria-hidden="true"><use href="#i-plate"/></svg>';
        marker.addEventListener("click", () => {
          window.AllsumaqMapa.seleccionarLugar(place.id);
          document.dispatchEvent(new CustomEvent("allsumaq:lugar-seleccionado", { detail: place.id }));
        });
        markersLayer.appendChild(marker);
        placeNodes.set(place.id, marker);
      }
      marker.title = place.nombre;
      marker.setAttribute("aria-label", "Lugar para comer: " + place.nombre);
      marker.setAttribute("aria-pressed", String(selectedPlace === place.id));
      marker.classList.toggle("selected", selectedPlace === place.id);
      marker.style.left = x + "px";
      marker.style.top = y + "px";
    }
    for (const [id, node] of placeNodes) if (!visibleIds.has(id)) { node.remove(); placeNodes.delete(id); }
  }
  window.AllsumaqMapa = {
    setLugares(places) { nearbyPlaces = places; focusedPlace = null; selectedPlace = ""; scheduleRender(); },
    enfocarLugar(place) {
      focusedPlace = place; selectedPlace = place.id;
      center = { lat: place.lat, lon: place.lon }; zoom = 16;
      $("mapa-estado").textContent = "Ubicación consultada: " + place.nombre + ". Los resultados conservan sus filtros.";
      scheduleRender();
    },
    seleccionarLugar(id) {
      const place = nearbyPlaces.find(item => item.id === id);
      if (!place) return;
      selectedPlace = id;
      center = { lat: place.lat, lon: place.lon };
      scheduleRender();
    },
    setVisible(value) {
      visible = value;
      if (value && surface.getBoundingClientRect().top < window.innerHeight)
        start();
      if (value) scheduleRender();
      else stopLocation();
    },
    seleccionar: selectUniversity,
    project,
    unproject,
    overpassDataset,
    get estado() {
      return {
        centro: { ...center },
        zoom,
        totalSedes: dataset.sedes.length,
        seleccion: selected,
        siguiendoUbicacion: watchId !== null,
      };
    },
  };
})();
