// Lugares reales de OpenStreetMap. Los precios se registran manualmente por ID.
(function () {
  "use strict";
  const $ = (id) => document.getElementById(id);
  const list = $("lugares-lista"),
    status = $("lugares-estado");
  const cache = new Map();
  const localData = window.ALLSUMAQ_ESTABLECIMIENTOS || { lugares: [] };
  const savedPlaces = new Map(localData.lugares.map((p) => [p.id, p]));
  let campus = null,
    places = [],
    controller = null,
    version = 0,
    state = "initial";
  const labels = {
    mercado: "Mercado",
    restaurante: "Restaurante / comida",
    puesto: "Puesto / comida rápida",
    comedor: "Olla / comedor comunitario",
  };

  function distance(a, b) {
    const rad = Math.PI / 180;
    const h =
      Math.sin(((b.lat - a.lat) * rad) / 2) ** 2 +
      Math.cos(a.lat * rad) *
        Math.cos(b.lat * rad) *
        Math.sin(((b.lon - a.lon) * rad) / 2) ** 2;
    return (
      6371000 * 2 * Math.atan2(Math.sqrt(h), Math.sqrt(Math.max(0, 1 - h)))
    );
  }
  function category(tags) {
    if (
      tags.disused === "yes" ||
      tags.abandoned === "yes" ||
      tags.access === "no"
    )
      return null;
    const name = window.AllsumaqModelo.normalizar(tags.name);
    if (
      tags.social_facility === "soup_kitchen" ||
      /\b(ollas? comun(?:es)?|comedor (popular|comunitario))\b/.test(name)
    )
      return "comedor";
    if (tags.amenity === "marketplace") return "mercado";
    if (tags.amenity === "fast_food") return "puesto";
    if (
      ["restaurant", "fast_food", "food_court", "cafe"].includes(tags.amenity)
    )
      return "restaurante";
    return null;
  }
  function parse(data, origin, radius) {
    if (!Array.isArray(data.elements))
      throw new Error("Respuesta cartográfica no válida");
    const result = new Map();
    for (const element of data.elements) {
      if (
        !["node", "way", "relation"].includes(element.type) ||
        !Number.isSafeInteger(element.id)
      )
        continue;
      const tags = element.tags || {},
        tipo = category(tags),
        point = element.center || element;
      if (!tipo || !Number.isFinite(point.lat) || !Number.isFinite(point.lon))
        continue;
      const distancia = distance(origin, point);
      if (distancia > radius) continue;
      const id = element.type + "/" + element.id;
      result.set(id, {
        id,
        tipo,
        lat: point.lat,
        lon: point.lon,
        distancia,
        nombre: tags.name || labels[tipo] + " sin nombre en OSM",
        direccion: [
          tags["addr:street"],
          tags["addr:housenumber"],
          tags["addr:suburb"],
        ]
          .filter(Boolean)
          .join(" "),
        horario: tags.opening_hours || "",
        fuente: "https://www.openstreetmap.org/" + id,
        cartaUrl: /^https?:\/\//.test(tags["website:menu"] || "")
          ? tags["website:menu"]
          : "",
      });
    }
    return [...result.values()].sort((a, b) => a.distancia - b.distancia);
  }
  function query(origin, radius) {
    const around = `(around:${radius},${origin.lat},${origin.lon})`;
    return (
      "[out:json][timeout:25];(" +
      `nwr["amenity"~"^(marketplace|restaurant|fast_food|food_court|cafe)$"]${around};` +
      `nwr["amenity"="social_facility"]["social_facility"="soup_kitchen"]${around};` +
      `nwr["name"~"olla(s)? com[uú]n(es)?|comedor popular|comedor comunitario",i]${around};` +
      ");out center tags;"
    );
  }
  // Solo precios por plato con fuente, fecha e ID exacto. No se deducen del nombre.
  function pricesFor(id) {
    return (window.ALLSUMAQ_PRECIOS_LUGARES || []).filter(
      (p) =>
        p.osmId === id &&
        Number.isFinite(p.min) &&
        Number.isFinite(p.max) &&
        p.min >= 0 &&
        p.max >= p.min &&
        typeof p.plato === "string" &&
        p.plato.trim() &&
        p.fecha &&
        /^https?:\/\//.test(p.fuente || ""),
    );
  }
  function dishesFor(id) {
    const fromTeam = window.ALLSUMAQ_ALIMENTOS.filter(
      (a) => window.ALLSUMAQ_VINCULOS_ESTABLECIMIENTOS?.[a.id] === id,
    );
    const fromMenu = pricesFor(id).map((p, i) => ({
      id: "local-" + i,
      nombre: p.plato,
      precioMin: p.min,
      precioMax: p.max,
      precioTipo: p.estimado ? "estimado" : "registrado",
      fuentePrecio: p.fuente,
      fechaPrecio: p.fecha,
      descripcion: p.descripcion,
      puesto: p.puesto,
      ingredientes: p.ingredientes || null,
      porcion: p.porcion || null,
      hierroMg: null,
      fuenteNutricional: null,
      tiempoObtencion: null,
    }));
    return [...fromTeam, ...fromMenu];
  }
  function comparablePrice(id) {
    return dishesFor(id)
      .filter((a) => a.precioTipo !== "persona" && Number.isFinite(a.precioMax))
      .sort((a, b) => a.precioMax - b.precioMax)[0];
  }
  function text(tag, value, className) {
    const node = document.createElement(tag);
    node.textContent = value;
    if (className) node.className = className;
    return node;
  }
  function selectCard(id) {
    list.querySelectorAll(".nearby-card").forEach((card) => {
      const active = card.dataset.lugar === id;
      card.classList.toggle("selected", active);
      card.querySelector("button").setAttribute("aria-pressed", String(active));
    });
  }
  function render() {
    list.replaceChildren();
    if (state !== "ready") {
      window.AllsumaqMapa.setLugares([]);
      return;
    }
    const raw = $("filtros").elements.presupuesto.value;
    const max = raw === "" ? null : Number(raw);
    const tipo = $("lugares-tipo").value,
      showPending = $("lugares-pendientes").checked;
    const filters = $("filtros").elements;
    const term = window.AllsumaqModelo.normalizar(
      filters.consulta.value,
    ).trim();
    const matches = places.filter(
      (p) =>
        (!tipo || p.tipo === tipo) &&
        (!term ||
          window.AllsumaqModelo.normalizar(
            [p.nombre, ...dishesFor(p.id).map((a) => a.nombre)].join(" "),
          ).includes(term)) &&
        (!filters.distrito.value ||
          p.distrito === filters.distrito.value ||
          dishesFor(p.id).some((a) =>
            a.distritos?.includes(filters.distrito.value),
          )),
    );
    const within = matches.filter((p) => {
      const price = comparablePrice(p.id);
      return price && (max === null || price.precioMax <= max);
    });
    const pending = matches.filter((p) => !comparablePrice(p.id));
    const shown =
      max === null
        ? matches
        : matches.filter(
            (p) =>
              within.includes(p) || (showPending && !comparablePrice(p.id)),
          );
    if (filters.orden.value === "nombre")
      shown.sort((a, b) => a.nombre.localeCompare(b.nombre, "es"));
    if (filters.orden.value === "precio")
      shown.sort(
        (a, b) =>
          (comparablePrice(a.id)?.precioMax ?? Infinity) -
          (comparablePrice(b.id)?.precioMax ?? Infinity),
      );
    status.textContent =
      `${matches.length} lugares registrados en este radio. ` +
      (max === null
        ? "Ordenados por distancia."
        : `${within.length} con precio registrado hasta S/ ${max}.`) +
      (pending.length
        ? ` ${pending.length} con precio por confirmar${max !== null && !showPending ? " (ocultos; puedes mostrarlos con la casilla)" : ""}.`
        : "");
    if (!shown.length)
      list.appendChild(
        text(
          "p",
          matches.length
            ? "No hay opciones con precio registrado que cumplan estos filtros. Puedes ampliar el presupuesto o consultar los lugares con precio por confirmar."
            : "No hay lugares cargados que coincidan con este radio y estos filtros. Amplía el radio, cambia la sede o pulsa «Buscar más lugares en OpenStreetMap».",
          "field-help",
        ),
      );
    for (const place of shown) {
      const card = document.createElement("article");
      card.className = "nearby-card";
      card.dataset.lugar = place.id;
      const price = comparablePrice(place.id);
      card.append(
        text(
          "small",
          `${labels[place.tipo]} · ${Math.round(place.distancia)} m en línea recta`,
        ),
        text("h4", place.nombre),
      );
      if (place.direccion) card.appendChild(text("p", place.direccion));
      card.appendChild(
        text(
          "p",
          price
            ? `${price.nombre}: S/ ${price.precioMin === price.precioMax ? price.precioMax : price.precioMin + "–" + price.precioMax} · Referencial`
            : "Precio por confirmar",
          "nearby-price",
        ),
      );
      if (max !== null && !price)
        card.appendChild(
          text(
            "p",
            "No se puede confirmar que cumpla tu presupuesto.",
            "field-help",
          ),
        );
      if (place.tipo === "comedor")
        card.appendChild(
          text(
            "p",
            "Confirma los requisitos de acceso, la disponibilidad y si existe un cobro.",
            "field-help",
          ),
        );
      if (place.horario)
        card.appendChild(
          text(
            "p",
            "Horario registrado en OSM: " + place.horario,
            "field-help",
          ),
        );
      const actions = document.createElement("div");
      actions.className = "button-row";
      const menuButton = text(
        "button",
        "Ver establecimiento",
        "button button--primary",
      );
      menuButton.type = "button";
      menuButton.setAttribute(
        "aria-label",
        "Ver establecimiento: " + place.nombre,
      );
      menuButton.setAttribute("aria-pressed", "false");
      menuButton.onclick = () => openPlace(place);
      const button = text("button", "Ver en el mapa", "text-button");
      button.type = "button";
      button.setAttribute("aria-pressed", "false");
      button.onclick = () => {
        if ($("mapa-real").dataset.modo === "lista")
          document.querySelector('[data-mode="mapa"]').click();
        window.AllsumaqMapa.seleccionarLugar(place.id);
        selectCard(place.id);
        $("mapa-lienzo").scrollIntoView({
          block: "center",
          behavior: "smooth",
        });
      };
      const link = text("a", "Ubicación y fuente ↗");
      link.href = place.fuente;
      link.target = "_blank";
      link.rel = "noopener noreferrer";
      actions.append(menuButton, button, link);
      card.appendChild(actions);
      if (price?.fuentePrecio) {
        const source = text("a", `Fuente del precio · ${price.fechaPrecio}`);
        source.href = price.fuentePrecio;
        source.target = "_blank";
        source.rel = "noopener noreferrer";
        card.appendChild(source);
      }
      list.appendChild(card);
    }
    window.AllsumaqMapa.setLugares(shown);
    if (menuDialog.open) renderMenu();
  }
  const menuDialog = $("carta-dialog"),
    selections = new Map();
  let currentPlace = null,
    demoCounter = 0,
    currentOrder = null;
  function openPlace(place) {
    currentPlace = place;
    savedPlaces.set(place.id, place);
    $("abrir-demo").disabled = !pricesFor(place.id).length;
    window.AllsumaqMapa.seleccionarLugar(place.id);
    selectCard(place.id);
    window.AllsumaqNavegacion.abrir(
      "#establecimiento=" + encodeURIComponent(place.id),
    );
  }
  $("abrir-demo").onclick = () => {
    if (currentPlace) openMenu(currentPlace);
  };
  const money = (amount) =>
    new Intl.NumberFormat("es-PE", {
      style: "currency",
      currency: "PEN",
    }).format(amount);
  const range = (min, max) =>
    min === max ? money(max) : money(min) + "–" + money(max);
  function maximum() {
    const raw = $("filtros").elements.presupuesto.value;
    return raw === "" ? null : Number(raw);
  }
  function selection() {
    if (!selections.has(currentPlace.id))
      selections.set(currentPlace.id, new Map());
    return selections.get(currentPlace.id);
  }
  function openMenu(place) {
    currentPlace = place;
    $("carta-titulo").textContent = place.nombre;
    $("carta-ubicacion").textContent = [
      labels[place.tipo],
      place.direccion,
      Math.round(place.distancia) + " m desde la sede",
    ]
      .filter(Boolean)
      .join(" · ");
    renderMenu();
    if (!menuDialog.open) menuDialog.showModal();
    document.body.classList.add("dialog-open");
    $("carta-titulo").focus();
  }
  function renderMenu() {
    if (!currentPlace) return;
    $("pedido-confirmacion").hidden = true;
    const container = $("carta-platos");
    container.replaceChildren();
    const dishes = pricesFor(currentPlace.id);
    $("carta-aviso").textContent = dishes.length
      ? "Platos incorporados para este local. Revisa la fuente y fecha de cada precio. El presupuesto se aplica por plato; el resumen también compara tu selección completa."
      : "Todavía no tenemos la carta de este establecimiento. Su ubicación está registrada, pero falta incorporar sus platos y precios. Puedes elegir otro local.";
    if (!dishes.length)
      container.appendChild(
        text("p", "Carta pendiente de incorporar.", "venue-menu-empty"),
      );
    if (currentPlace.cartaUrl) {
      const officialMenu = text(
        "a",
        "Consultar la carta enlazada por el establecimiento ↗",
        "text-button",
      );
      officialMenu.href = currentPlace.cartaUrl;
      officialMenu.target = "_blank";
      officialMenu.rel = "noopener noreferrer";
      container.appendChild(officialMenu);
    }
    const cart = selection();
    const validKeys = new Set(dishes.map((dish, i) => String(dish.id || i)));
    for (const key of cart.keys()) if (!validKeys.has(key)) cart.delete(key);
    dishes.forEach((dish, index) => {
      const key = String(dish.id || index),
        row = document.createElement("article");
      row.className = "venue-dish";
      row.dataset.plato = key;
      const details = document.createElement("div");
      details.appendChild(text("h3", dish.plato));
      if (dish.puesto)
        details.appendChild(text("p", "Puesto: " + dish.puesto, "field-help"));
      if (dish.descripcion) details.appendChild(text("p", dish.descripcion));
      details.appendChild(
        text(
          "p",
          range(dish.min, dish.max) +
            " por porción" +
            (dish.estimado ? " · Estimado" : ""),
          "nearby-price",
        ),
      );
      const priceLink = text("a", "Fuente del precio · " + dish.fecha);
      priceLink.href = dish.fuente;
      priceLink.target = "_blank";
      priceLink.rel = "noopener noreferrer";
      details.appendChild(priceLink);
      if (dish.disponible === false) {
        details.appendChild(text("p", "No disponible", "field-help"));
        cart.delete(key);
      }
      const budget = maximum();
      if (budget !== null && dish.max > budget)
        details.appendChild(
          text(
            "p",
            "Este plato supera tu presupuesto máximo.",
            "venue-budget-warning",
          ),
        );
      const controls = document.createElement("div");
      controls.className = "dish-quantity";
      const minus = text("button", "−"),
        quantity = text("output", String(cart.get(key) || 0)),
        plus = text("button", "+");
      minus.type = plus.type = "button";
      minus.setAttribute("aria-label", "Quitar una porción de " + dish.plato);
      plus.setAttribute("aria-label", "Añadir una porción de " + dish.plato);
      quantity.setAttribute("aria-label", "Porciones de " + dish.plato);
      quantity.setAttribute("aria-live", "polite");
      const update = (delta) => {
        $("pedido-confirmacion").hidden = true;
        const count = Math.max(0, Math.min(20, (cart.get(key) || 0) + delta));
        if (count) cart.set(key, count);
        else cart.delete(key);
        quantity.textContent = String(count);
        minus.disabled = count === 0 || dish.disponible === false;
        plus.disabled = count >= 20 || dish.disponible === false;
        renderOrder();
      };
      minus.onclick = () => update(-1);
      plus.onclick = () => update(1);
      update(0);
      controls.append(minus, quantity, plus);
      row.append(details, controls);
      container.appendChild(row);
    });
    $("carta-pedido").hidden = !dishes.length;
    renderOrder();
  }
  function renderOrder() {
    if (!currentPlace) return;
    const cart = selection(),
      lines = $("pedido-lineas");
    lines.replaceChildren();
    let minCents = 0,
      maxCents = 0,
      count = 0;
    const items = [];
    pricesFor(currentPlace.id).forEach((dish, index) => {
      if (dish.disponible === false) return;
      const quantity = cart.get(String(dish.id || index)) || 0;
      if (!quantity) return;
      count += quantity;
      minCents += Math.round(dish.min * 100) * quantity;
      maxCents += Math.round(dish.max * 100) * quantity;
      const description = `${quantity} × ${dish.plato}${dish.puesto ? " (" + dish.puesto + ")" : ""} · ${range((Math.round(dish.min * 100) * quantity) / 100, (Math.round(dish.max * 100) * quantity) / 100)}`;
      items.push(description);
      lines.appendChild(text("p", description));
    });
    if (!count)
      lines.appendChild(
        text(
          "p",
          "Elige las porciones con los botones + de la carta.",
          "field-help",
        ),
      );
    $("pedido-total").textContent =
      `Total de ${count} ${count === 1 ? "porción" : "porciones"}: ${range(minCents / 100, maxCents / 100)}`;
    const budget = maximum(),
      exceeded = budget !== null && maxCents > Math.round(budget * 100);
    $("pedido-presupuesto").textContent =
      budget === null
        ? "Puedes fijar un presupuesto máximo en los filtros del mapa."
        : exceeded
          ? `El total máximo supera tu presupuesto de ${money(budget)}. Reduce las porciones o cambia tu selección.`
          : `El total máximo está dentro de tu presupuesto de ${money(budget)}.`;
    $("pedido-presupuesto").classList.toggle("venue-budget-warning", exceeded);
    $("pedido-vaciar").disabled = count === 0;
    $("pedido-confirmar").disabled = count === 0 || exceeded;
    currentOrder = {
      local: currentPlace.nombre,
      items,
      min: minCents / 100,
      max: maxCents / 100,
      count,
    };
  }
  $("pedido-confirmar").onclick = () => {
    renderOrder();
    if ($("pedido-confirmar").disabled) return;
    const receipt = $("pedido-confirmado-detalle");
    receipt.replaceChildren();
    receipt.appendChild(
      text(
        "p",
        `DEMO-${String(++demoCounter).padStart(4, "0")} · ${currentOrder.local}`,
      ),
    );
    receipt.appendChild(
      text(
        "p",
        new Intl.DateTimeFormat("es-PE", {
          dateStyle: "medium",
          timeStyle: "short",
          timeZone: "America/Lima",
        }).format(new Date()),
        "field-help",
      ),
    );
    currentOrder.items.forEach((line) => receipt.appendChild(text("p", line)));
    receipt.appendChild(
      text(
        "p",
        "Total: " + range(currentOrder.min, currentOrder.max),
        "nearby-price",
      ),
    );
    $("pedido-confirmacion").hidden = false;
    $("pedido-confirmado-titulo").focus();
  };
  $("pedido-continuar").onclick = () => menuDialog.close();
  $("pedido-vaciar").onclick = () => {
    selection().clear();
    renderMenu();
  };
  $("carta-volver").onclick = $("carta-cerrar").onclick = () =>
    menuDialog.close();
  menuDialog.addEventListener("close", () => {
    document.body.classList.toggle(
      "dialog-open",
      !!document.querySelector("dialog[open]"),
    );
  });

  function localAround(origin, radius) {
    return localData.lugares
      .map((p) => ({ ...p, distancia: distance(origin, p) }))
      .filter((p) => p.distancia <= radius)
      .sort((a, b) => a.distancia - b.distancia);
  }
  function load() {
    if (!campus) return;
    if (menuDialog.open) menuDialog.close();
    controller?.abort();
    version++;
    const origin = { ...campus },
      radius = Number($("lugares-radio").value);
    const key = `${origin.id}:${origin.lat}:${origin.lon}:${radius}`;
    $("lugares-sede").textContent =
      `${origin.nombre} · ${radius < 1000 ? radius + " m" : radius / 1000 + " km"} desde el punto de la sede.`;
    $("sede-actual").textContent = origin.nombre;
    $("universidades-selector").open = false;
    $("lugares-reintentar").hidden = true;
    $("lugares-actualizar").disabled = false;
    list.setAttribute("aria-busy", "false");
    const cached = cache.get(key);
    const fresh = cached && Date.now() - cached.time < 15 * 60000;
    places = fresh ? cached.places : localAround(origin, radius);
    state = "ready";
    render();
    $("lugares-origen").textContent = fresh
      ? "Última consulta de esta visita."
      : "Catálogo local · ubicaciones OSM consultadas el " +
        new Intl.DateTimeFormat("es-PE", { dateStyle: "short" }).format(
          new Date(localData.consultado),
        ) +
        ". Puedes buscar más lugares si faltan opciones.";
  }
  async function requestPlaces() {
    if (!campus) return;
    controller?.abort();
    const token = ++version,
      origin = { ...campus },
      radius = Number($("lugares-radio").value);
    const key = `${origin.id}:${origin.lat}:${origin.lon}:${radius}`;
    list.setAttribute("aria-busy", "true");
    $("lugares-actualizar").disabled = true;
    $("lugares-reintentar").hidden = true;
    status.textContent =
      "Consultando lugares adicionales en OpenStreetMap. El catálogo cargado sigue disponible…";
    const request = (controller = new AbortController());
    try {
      let data;
      const config = window.ALLSUMAQ_SERVICIOS.mapa;
      for (const endpoint of [
        config.overpass,
        config.overpassAlternativo,
      ].filter(Boolean)) {
        const attempt = new AbortController();
        const cancel = () => attempt.abort();
        request.signal.addEventListener("abort", cancel, { once: true });
        const timeout = setTimeout(cancel, 28000);
        try {
          const response = await fetch(endpoint, {
            method: "POST",
            body: new URLSearchParams({ data: query(origin, radius) }),
            signal: attempt.signal,
          });
          if (!response.ok) throw new Error("Servicio no disponible");
          data = await response.json();
          if (data.remark || !Array.isArray(data.elements))
            throw new Error("Consulta incompleta");
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
      places = [
        ...new Map(
          [...localAround(origin, radius), ...parse(data, origin, radius)].map(
            (p) => [p.id, p],
          ),
        ).values(),
      ].sort((a, b) => a.distancia - b.distancia);
      places.forEach((p) => savedPlaces.set(p.id, p));
      cache.set(key, { time: Date.now(), places });
      if (cache.size > 12) cache.delete(cache.keys().next().value);
      state = "ready";
      render();
      $("lugares-origen").textContent =
        "Catálogo local y consulta de OpenStreetMap de esta visita. La información puede estar incompleta.";
    } catch (error) {
      if (token !== version) return;
      state = "ready";
      render();
      status.textContent =
        "No pudimos consultar lugares adicionales. El catálogo local sigue disponible; puedes ampliar el radio o volver a intentarlo.";
      $("lugares-reintentar").hidden = false;
    } finally {
      if (token === version) {
        list.setAttribute("aria-busy", "false");
        $("lugares-actualizar").disabled = false;
      }
    }
  }
  document.addEventListener("allsumaq:universidad-seleccionada", (event) => {
    campus = event.detail;
    load();
  });
  document.addEventListener("allsumaq:lugar-seleccionado", (event) => {
    selectCard(event.detail);
    const place =
      places.find((p) => p.id === event.detail) ||
      savedPlaces.get(event.detail);
    if (place) openPlace(place);
  });
  $("lugares-radio").addEventListener("change", load);
  $("lugares-tipo").addEventListener("change", render);
  $("lugares-pendientes").addEventListener("change", render);
  $("lugares-reintentar").addEventListener("click", requestPlaces);
  $("lugares-actualizar").addEventListener("click", requestPlaces);
  document.addEventListener("allsumaq:filtros", render);
  $("filtros").addEventListener("reset", () => requestAnimationFrame(render));
  window.AllsumaqLugares = {
    distancia: distance,
    interpretar: parse,
    consulta: query,
    obtener: (id) => places.find((p) => p.id === id) || savedPlaces.get(id),
    platos: dishesFor,
    verEnMapa(id) {
      const place = savedPlaces.get(id) || places.find((p) => p.id === id);
      if (!place) return;
      window.AllsumaqMapa.enfocarLugar(place);
      $("mapa-lienzo").scrollIntoView({ block: "center", behavior: "smooth" });
    },
    prepararFicha(place) {
      currentPlace = place;
      $("abrir-demo").disabled = !pricesFor(place.id).length;
    },
  };
})();
