// Lugares reales de OpenStreetMap. Los precios se registran manualmente por ID.
(function () {
  "use strict";
  const $ = id => document.getElementById(id);
  const list = $("lugares-lista"), status = $("lugares-estado");
  const cache = new Map();
  let campus = null, places = [], controller = null, version = 0, state = "initial";
  const labels = { mercado: "Mercado", restaurante: "Restaurante / comida", comedor: "Olla / comedor comunitario" };

  function distance(a, b) {
    const rad = Math.PI / 180;
    const h = Math.sin((b.lat - a.lat) * rad / 2) ** 2 +
      Math.cos(a.lat * rad) * Math.cos(b.lat * rad) * Math.sin((b.lon - a.lon) * rad / 2) ** 2;
    return 6371000 * 2 * Math.atan2(Math.sqrt(h), Math.sqrt(Math.max(0, 1 - h)));
  }
  function category(tags) {
    if (tags.disused === "yes" || tags.abandoned === "yes" || tags.access === "no") return null;
    const name = window.AllsumaqModelo.normalizar(tags.name);
    if (tags.social_facility === "soup_kitchen" || /\b(ollas? comun(?:es)?|comedor (popular|comunitario))\b/.test(name)) return "comedor";
    if (tags.amenity === "marketplace") return "mercado";
    if (["restaurant", "fast_food", "food_court", "cafe"].includes(tags.amenity)) return "restaurante";
    return null;
  }
  function parse(data, origin, radius) {
    if (!Array.isArray(data.elements)) throw new Error("Respuesta cartográfica no válida");
    const result = new Map();
    for (const element of data.elements) {
      if (!["node", "way", "relation"].includes(element.type) || !Number.isSafeInteger(element.id)) continue;
      const tags = element.tags || {}, tipo = category(tags), point = element.center || element;
      if (!tipo || !Number.isFinite(point.lat) || !Number.isFinite(point.lon)) continue;
      const distancia = distance(origin, point);
      if (distancia > radius) continue;
      const id = element.type + "/" + element.id;
      result.set(id, {
        id, tipo, lat: point.lat, lon: point.lon, distancia,
        nombre: tags.name || labels[tipo] + " sin nombre en OSM",
        direccion: [tags["addr:street"], tags["addr:housenumber"], tags["addr:suburb"]].filter(Boolean).join(" "),
        horario: tags.opening_hours || "", fuente: "https://www.openstreetmap.org/" + id,
      });
    }
    return [...result.values()].sort((a, b) => a.distancia - b.distancia);
  }
  function query(origin, radius) {
    const around = `(around:${radius},${origin.lat},${origin.lon})`;
    return '[out:json][timeout:25];(' +
      `nwr["amenity"~"^(marketplace|restaurant|fast_food|food_court|cafe)$"]${around};` +
      `nwr["amenity"="social_facility"]["social_facility"="soup_kitchen"]${around};` +
      `nwr["name"~"olla(s)? com[uú]n(es)?|comedor popular|comedor comunitario",i]${around};` +
      ');out center tags;';
  }
  // Solo precios por plato con fuente, fecha e ID exacto. No se deducen del nombre.
  function priceFor(id) {
    return (window.ALLSUMAQ_PRECIOS_LUGARES || []).find(p => p.osmId === id &&
      Number.isFinite(p.min) && Number.isFinite(p.max) && p.min >= 0 && p.max >= p.min &&
      p.plato && p.fecha && /^https?:\/\//.test(p.fuente || ""));
  }
  function text(tag, value, className) {
    const node = document.createElement(tag);
    node.textContent = value;
    if (className) node.className = className;
    return node;
  }
  function selectCard(id, focus = false) {
    list.querySelectorAll(".nearby-card").forEach(card => {
      const active = card.dataset.lugar === id;
      card.classList.toggle("selected", active);
      card.querySelector("button").setAttribute("aria-pressed", String(active));
      if (active && focus) { card.scrollIntoView({ block: "nearest", behavior: "smooth" }); card.querySelector("button").focus({ preventScroll: true }); }
    });
  }
  function render() {
    list.replaceChildren();
    if (state !== "ready") { window.AllsumaqMapa.setLugares([]); return; }
    const raw = $("filtros").elements.presupuesto.value;
    const max = raw === "" ? null : Number(raw);
    const tipo = $("lugares-tipo").value, showPending = $("lugares-pendientes").checked;
    const matches = places.filter(p => !tipo || p.tipo === tipo);
    const within = matches.filter(p => { const price = priceFor(p.id); return price && (max === null || price.max <= max); });
    const pending = matches.filter(p => !priceFor(p.id));
    const shown = max === null ? matches : matches.filter(p => within.includes(p) || (showPending && !priceFor(p.id)));
    status.textContent = `${matches.length} lugares registrados en este radio. ` +
      (max === null ? "Ordenados por distancia." : `${within.length} con precio registrado hasta S/ ${max}.`) +
      (pending.length ? ` ${pending.length} con precio por confirmar${max !== null && !showPending ? " (ocultos; puedes mostrarlos con la casilla)" : ""}.` : "");
    if (!shown.length) list.appendChild(text("p", matches.length ? "No hay opciones con precio registrado que cumplan estos filtros. Puedes ampliar el presupuesto o consultar los lugares con precio por confirmar." : "No encontramos lugares de este tipo registrados en este radio. Prueba otro tipo o amplía el radio; puede faltar información en OpenStreetMap.", "field-help"));
    for (const place of shown) {
      const card = document.createElement("article");
      card.className = "nearby-card";
      card.dataset.lugar = place.id;
      const price = priceFor(place.id);
      card.append(text("small", `${labels[place.tipo]} · ${Math.round(place.distancia)} m en línea recta`), text("h4", place.nombre));
      if (place.direccion) card.appendChild(text("p", place.direccion));
      card.appendChild(text("p", price ? `${price.plato}: S/ ${price.min === price.max ? price.max : price.min + "–" + price.max} · ${price.estimado ? "Estimado" : "Precio registrado"}` : "Precio por confirmar", "nearby-price"));
      if (max !== null && !price) card.appendChild(text("p", "No se puede confirmar que cumpla tu presupuesto.", "field-help"));
      if (place.tipo === "comedor") card.appendChild(text("p", "Confirma los requisitos de acceso, la disponibilidad y si existe un cobro.", "field-help"));
      if (place.horario) card.appendChild(text("p", "Horario registrado en OSM: " + place.horario, "field-help"));
      const actions = document.createElement("div"); actions.className = "button-row";
      const button = text("button", "Ver en el mapa", "text-button"); button.type = "button";
      button.setAttribute("aria-pressed", "false");
      button.onclick = () => {
        if ($("mapa-real").hidden) document.querySelector('[data-mode="mapa"]').click();
        window.AllsumaqMapa.seleccionarLugar(place.id);
        selectCard(place.id);
        $("mapa-lienzo").scrollIntoView({ block: "center", behavior: "smooth" });
      };
      const link = text("a", "Ubicación y fuente ↗"); link.href = place.fuente; link.target = "_blank"; link.rel = "noopener noreferrer";
      actions.append(button, link); card.appendChild(actions);
      if (price) {
        const source = text("a", `Fuente del precio · ${price.fecha}`); source.href = price.fuente; source.target = "_blank"; source.rel = "noopener noreferrer";
        card.appendChild(source);
      }
      list.appendChild(card);
    }
    window.AllsumaqMapa.setLugares(shown);
  }
  async function load() {
    if (!campus) return;
    controller?.abort();
    const token = ++version, origin = { ...campus }, radius = Number($("lugares-radio").value);
    const key = `${origin.id}:${origin.lat}:${origin.lon}:${radius}`;
    $("lugares-sede").textContent = `${origin.nombre} · ${radius < 1000 ? radius + " m" : radius / 1000 + " km"} desde el punto de la sede.`;
    $("lugares-reintentar").hidden = true;
    const cached = cache.get(key);
    if (cached && Date.now() - cached.time < 15 * 60000) { places = cached.places; state = "ready"; list.setAttribute("aria-busy", "false"); render(); return; }
    state = "loading"; places = []; render(); list.setAttribute("aria-busy", "true");
    status.textContent = "Buscando mercados, restaurantes y comedores en OpenStreetMap…";
    const request = controller = new AbortController();
    try {
      let data;
      const config = window.ALLSUMAQ_SERVICIOS.mapa;
      for (const endpoint of [config.overpass, config.overpassAlternativo].filter(Boolean)) {
        const attempt = new AbortController();
        const cancel = () => attempt.abort();
        request.signal.addEventListener("abort", cancel, { once: true });
        const timeout = setTimeout(cancel, 28000);
        try {
          const response = await fetch(endpoint, {
            method: "POST", body: new URLSearchParams({ data: query(origin, radius) }), signal: attempt.signal,
          });
          if (!response.ok) throw new Error("Servicio no disponible");
          data = await response.json();
          if (data.remark || !Array.isArray(data.elements)) throw new Error("Consulta incompleta");
          break;
        } catch (error) {
          data = null;
          if (request.signal.aborted || token !== version) throw error;
        } finally {
          clearTimeout(timeout);
          request.signal.removeEventListener("abort", cancel);
        }
      }
      if (!data) throw new Error("Servicio no disponible");
      if (token !== version) return;
      places = parse(data, origin, radius);
      cache.set(key, { time: Date.now(), places });
      if (cache.size > 12) cache.delete(cache.keys().next().value);
      state = "ready"; render();
    } catch (error) {
      if (token !== version) return;
      state = "error"; places = []; render();
      status.textContent = "No pudimos consultar los lugares. Comprueba tu conexión y vuelve a intentarlo. Esto no significa que no haya establecimientos cerca.";
      $("lugares-reintentar").hidden = false;
    } finally {
      if (token === version) list.setAttribute("aria-busy", "false");
    }
  }
  document.addEventListener("allsumaq:universidad-seleccionada", event => { campus = event.detail; load(); });
  document.addEventListener("allsumaq:lugar-seleccionado", event => selectCard(event.detail, true));
  $("lugares-radio").addEventListener("change", load);
  $("lugares-tipo").addEventListener("change", render);
  $("lugares-pendientes").addEventListener("change", render);
  $("lugares-reintentar").addEventListener("click", load);
  $("filtros").addEventListener("input", render);
  $("filtros").addEventListener("change", render);
  $("filtros").addEventListener("reset", () => requestAnimationFrame(render));
  window.AllsumaqLugares = { distancia: distance, interpretar: parse, consulta: query };
})();
