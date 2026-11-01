(function () {
  "use strict";
  const $ = (selector, parent = document) => parent.querySelector(selector);
  const $$ = (selector, parent = document) => [
    ...parent.querySelectorAll(selector),
  ];
  const alimentos = window.ALLSUMAQ_ALIMENTOS;
  const recetas = window.ALLSUMAQ_RECETAS;
  const bebidas = window.ALLSUMAQ_BEBIDAS;
  const modelo = window.AllsumaqModelo;
  const elementos = [...alimentos, ...recetas, ...bebidas];
  const distritos = [...new Set(alimentos.flatMap((a) => a.distritos))].sort(
    (a, b) => a.localeCompare(b, "es"),
  );
  const guestStorageKey = "allsumaq:actividad:v1";
  let storageKey = guestStorageKey;
  const filtrosForm = $("#filtros");
  const dialog = $("#detalle-dialog");
  const dialogBody = $("#dialog-contenido");
  let estado = leerEstado();
  let modo = "mapa";
  let focoOrigen = null;
  let toastTimer;
  let busquedaRecetas = "";
  const seccionesScroll = ["inicio", "mapa"];
  const vistasClick = ["registrar", "progreso", "perfil"];
  let vistaPrincipal = "exploracion";
  let ultimaSeccionExploracion = "inicio";
  let retornoExploracion = { seccion: "inicio", scroll: 0 };

  const esc = (value) =>
    String(value ?? "").replace(
      /[&<>"']/g,
      (c) =>
        ({
          "&": "&amp;",
          "<": "&lt;",
          ">": "&gt;",
          '"': "&quot;",
          "'": "&#39;",
        })[c],
    );
  const icon = (nombre) =>
    `<svg class="icon" aria-hidden="true"><use href="#i-${nombre}"/></svg>`;
  const hoy = () =>
    new Intl.DateTimeFormat("en-CA", {
      timeZone: "America/Lima",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(new Date());
  const fechaBonita = (fecha) =>
    new Intl.DateTimeFormat("es-PE", {
      day: "numeric",
      month: "short",
      year: "numeric",
      timeZone: "America/Lima",
    }).format(new Date(fecha + "T12:00:00Z"));
  const numero = (n) =>
    new Intl.NumberFormat("es-PE", {
      minimumFractionDigits: Number.isInteger(n) ? 0 : 2,
      maximumFractionDigits: 2,
    }).format(n);

  function leerEstado() {
    const vacio = { registros: [], favoritos: [], zona: "" };
    try {
      const dato = JSON.parse(localStorage.getItem(storageKey));
      if (!dato || typeof dato !== "object") return vacio;
      const registros = Array.isArray(dato.registros)
        ? dato.registros
            .filter(
              (r) =>
                r &&
                typeof r.id === "string" &&
                typeof r.nombre === "string" &&
                /^\d{4}-\d{2}-\d{2}$/.test(r.fecha || "") &&
                !Number.isNaN(new Date(r.fecha + "T12:00:00Z").getTime()) &&
                typeof r.momento === "string",
            )
            .slice(0, 5000)
        : [];
      const favoritos = Array.isArray(dato.favoritos)
        ? [
            ...new Set(
              dato.favoritos.filter((id) => alimentos.some((a) => a.id === id)),
            ),
          ]
        : [];
      return {
        registros,
        favoritos,
        zona: distritos.includes(dato.zona) ? dato.zona : "",
      };
    } catch (_) {
      return vacio;
    }
  }

  function persistir(siguiente) {
    try {
      localStorage.setItem(storageKey, JSON.stringify(siguiente));
      estado = siguiente;
      return true;
    } catch (_) {
      avisar(
        "No se pudo guardar. Revisa el permiso de almacenamiento de este navegador.",
      );
      return false;
    }
  }

  function avisar(mensaje) {
    clearTimeout(toastTimer);
    $("#toast").textContent = mensaje;
    $("#toast").hidden = false;
    toastTimer = setTimeout(() => {
      $("#toast").hidden = true;
    }, 4500);
  }

  function precio(a) {
    if (a.precioMin === null || a.precioMax === null)
      return "Precio por confirmar";
    const rango =
      a.precioMin === a.precioMax
        ? numero(a.precioMin)
        : `${numero(a.precioMin)}–${numero(a.precioMax)}`;
    return `S/ ${rango}`;
  }

  function notaPrecio(a) {
    if (a.precioTipo === "persona") return "Gasto referencial por persona";
    if (a.precioTipo === "publicado")
      return "Publicado · fuente y fecha por confirmar";
    if (a.precioTipo === "pendiente") return "Consulta con el establecimiento";
    return "Precio estimado por plato";
  }

  function imagenLocal(ruta, nombre) {
    return typeof ruta === "string" &&
      /^assets\/[\w\s./-]+\.(?:png|jpe?g|webp|avif)$/i.test(ruta)
      ? `<img class="food-photo" src="${esc(ruta)}" alt="${esc(nombre)}" loading="lazy">`
      : "";
  }

  function empty(titulo, texto, accion = "") {
    return `<div class="empty-state"><span class="feature-icon">${icon("leaf")}</span><h3>${esc(titulo)}</h3><p>${esc(texto)}</p>${accion}</div>`;
  }

  function foodCard(a) {
    const guardado = estado.favoritos.includes(a.id);
    return `<article class="food-card">
      <div class="food-card-top"><span class="feature-icon">${icon("plate")}</span><button type="button" class="favorite-button" data-favorito="${esc(a.id)}" aria-label="${guardado ? "Quitar de" : "Añadir a"} favoritos: ${esc(a.nombre)}" aria-pressed="${guardado}">${icon("heart")}</button></div>
      ${imagenLocal(a.imagen, a.nombre)}<h3>${esc(a.nombre)}</h3><p class="establishment">${esc(a.establecimiento)}</p><p class="district">${icon("pin")}${esc(a.distritos.join(" · "))}</p>
      <div class="food-card-bottom"><p class="price">${esc(precio(a))}<span class="price-note">${esc(notaPrecio(a))}</span></p><button type="button" class="circle-arrow" data-alimento="${esc(a.id)}" aria-label="Ver detalle de ${esc(a.nombre)}">${icon("arrow")}</button></div>
    </article>`;
  }

  function filtrosActuales() {
    return Object.fromEntries(new FormData(filtrosForm));
  }

  function renderAlimentos() {
    const filtros = filtrosActuales();
    const resultados = modelo.filtrar(alimentos, filtros);
    $("#resultados-conteo").textContent =
      `${resultados.length} ${resultados.length === 1 ? "plato de referencia" : "platos de referencia"}${filtros.distrito ? " en " + filtros.distrito : ""}`;
    $("#alimentos-grid").innerHTML = resultados.length
      ? resultados.map(foodCard).join("")
      : empty(
          "No encontramos coincidencias",
          "Prueba otro nombre, cambia el distrito o amplía el presupuesto.",
          '<button type="button" class="button button--light" data-reset-filters>Limpiar filtros</button>',
        );
    document.dispatchEvent(new CustomEvent("allsumaq:filtros"));
  }

  function establecerModo(nuevo) {
    modo = nuevo;
    $("#mapa-real").hidden = false;
    $("#mapa-real").dataset.modo = modo;
    $("#mapa-real").classList.toggle("is-list-mode", modo === "lista");
    window.AllsumaqMapa?.setVisible(
      modo === "mapa" && vistaPrincipal === "exploracion",
    );
    $$("[data-mode]").forEach((b) =>
      b.setAttribute("aria-pressed", String(b.dataset.mode === modo)),
    );
  }

  function limpiarFiltros() {
    filtrosForm.reset();
    renderAlimentos();
    $("#buscar").focus({ preventScroll: true });
  }

  function toggleFavorito(id) {
    if (!alimentos.some((a) => a.id === id)) return;
    const existia = estado.favoritos.includes(id);
    const favoritos = existia
      ? estado.favoritos.filter((a) => a !== id)
      : [...estado.favoritos, id];
    if (!persistir({ ...estado, favoritos })) return;
    // Update the existing controls so the keyboard user's focus stays in place.
    $$(`[data-favorito="${id}"]`).forEach((b) => {
      b.setAttribute("aria-pressed", String(!existia));
      b.setAttribute(
        "aria-label",
        `${existia ? "Añadir a" : "Quitar de"} favoritos: ${alimentos.find((a) => a.id === id).nombre}`,
      );
      if (b.classList.contains("button"))
        b.innerHTML =
          icon("heart") +
          (existia ? "Guardar en favoritos" : "Guardado en favoritos");
    });
    renderFavoritos();
    avisar(
      existia
        ? "Plato retirado de tus favoritos."
        : "Plato añadido a tus favoritos.",
    );
  }

  function renderFavoritos() {
    const favoritos = alimentos.filter((a) => estado.favoritos.includes(a.id));
    $("#favoritos").innerHTML = favoritos.length
      ? favoritos
          .map(
            (a) =>
              `<div class="favorite-row"><button type="button" data-alimento="${esc(a.id)}">${esc(a.nombre)}</button><button type="button" class="icon-button" data-remove-favorite="${esc(a.id)}" aria-label="Quitar de favoritos: ${esc(a.nombre)}">${icon("close")}</button></div>`,
          )
          .join("")
      : empty(
          "Tu próxima elección",
          "Guarda un plato con el corazón del catálogo para encontrarlo aquí.",
          '<a class="text-button" href="#mapa">Explorar alimentos →</a>',
        );
  }

  function renderProgreso() {
    const fin = hoy();
    const periodo = $("#periodo").value;
    const fechaInicio = new Date(fin + "T12:00:00Z");
    if (periodo !== "todo")
      fechaInicio.setUTCDate(fechaInicio.getUTCDate() - Number(periodo) + 1);
    const inicio =
      periodo === "todo"
        ? "0000-00-00"
        : fechaInicio.toISOString().slice(0, 10);
    const resumen = modelo.resumir(estado.registros, inicio, fin);
    $("#periodo-descripcion").textContent =
      periodo === "todo"
        ? `Hasta el ${fechaBonita(fin)}`
        : `${fechaBonita(inicio)} – ${fechaBonita(fin)}`;
    const stats = [
      ["calendar", "Consumos registrados", resumen.total],
      ["plate", "Comidas", resumen.comidas],
      ["cup", "Bebidas", resumen.bebidas],
      ["chart", "Días con registros", resumen.dias],
    ];
    $("#estadisticas").innerHTML = stats
      .map(
        ([nombreIcono, nombre, total]) =>
          `<div class="stat"><span class="feature-icon">${icon(nombreIcono)}</span><div><p>${nombre}</p><strong>${total}</strong></div></div>`,
      )
      .join("");
    $("#historial").innerHTML = resumen.total
      ? [...resumen.entradas]
          .sort(
            (a, b) =>
              b.fecha.localeCompare(a.fecha) || b.id.localeCompare(a.id),
          )
          .map(
            (r) =>
              `<article class="history-row"><span class="feature-icon">${icon(r.tipo === "bebida" ? "cup" : "plate")}</span><div><h4>${esc(r.nombre)}</h4><p>${esc(r.momento)}${r.notas ? " · " + esc(r.notas) : ""}</p></div><time datetime="${esc(r.fecha)}">${esc(fechaBonita(r.fecha))}</time></article>`,
          )
          .join("")
      : empty(
          "Tu historia empieza con un registro",
          "Aún no hay consumos guardados para este periodo. Puedes comenzar cuando quieras.",
          '<a class="button button--light" href="#registrar">Registrar mi primer consumo →</a>',
        );
  }

  function marcarSeccion(id) {
    $$(".main-nav a").forEach((a) => {
      const activa = a.hash === "#" + id;
      a.classList.toggle("active", activa);
      if (activa) a.setAttribute("aria-current", "location");
      else a.removeAttribute("aria-current");
    });
  }

  function recordarPosicion() {
    if (vistaPrincipal === "exploracion") {
      if (!dialog.open) actualizarScrollspy();
      retornoExploracion = {
        seccion: ultimaSeccionExploracion,
        scroll: window.scrollY,
      };
    }
    history.replaceState(
      {
        ...(history.state || {}),
        app: true,
        principal: vistaPrincipal,
        scroll: window.scrollY,
        scrollSeccion: ultimaSeccionExploracion,
        dialogScroll: dialog.scrollTop,
        retornoExploracion,
      },
      "",
      location.href,
    );
  }

  function mostrarPrincipal(vista) {
    vistaPrincipal = vistasClick.includes(vista) ? vista : "exploracion";
    seccionesScroll.forEach((id) => {
      document.getElementById(id).hidden = vistaPrincipal !== "exploracion";
    });
    vistasClick.forEach((id) => {
      document.getElementById(id).hidden = vistaPrincipal !== id;
    });
    document.body.dataset.vista = vistaPrincipal;
    window.AllsumaqMapa?.setVisible(
      vistaPrincipal === "exploracion" && modo === "mapa",
    );
  }

  function actualizarScrollspy() {
    if (
      vistaPrincipal !== "exploracion" ||
      dialog.open ||
      $("#acceso-dialog").open
    )
      return;
    const line = window.innerHeight * 0.35;
    const seccion = $$(".observed-section").find(
      (s) =>
        !s.hidden &&
        s.getBoundingClientRect().top <= line &&
        s.getBoundingClientRect().bottom > line,
    );
    // Al final de Mapa, el footer puede ocupar la línea de referencia.
    const id =
      seccion?.id ||
      ($("#mapa").getBoundingClientRect().top < line ? "mapa" : "inicio");
    ultimaSeccionExploracion = id;
    marcarSeccion(id);
  }

  function abrir(hash) {
    recordarPosicion();
    if (!dialog.open) focoOrigen = document.activeElement;
    history.pushState(
      {
        app: true,
        interno: true,
        principal: vistaPrincipal,
        scroll: window.scrollY,
        scrollSeccion: ultimaSeccionExploracion,
        retornoExploracion,
      },
      "",
      hash,
    );
    renderRuta();
  }

  function volver() {
    if (history.state?.interno) history.back();
    else {
      const seccion = /^#(alimento|establecimiento|plato)=/.test(location.hash)
        ? "mapa"
        : location.hash.startsWith("#guardado")
          ? "registrar"
          : "inicio";
      history.replaceState({ app: true }, "", "#" + seccion);
      renderRuta();
    }
  }

  function irSeccion(id, focoBusqueda = false) {
    recordarPosicion();
    history.pushState(
      {
        app: true,
        principal: vistasClick.includes(id) ? id : "exploracion",
        retornoExploracion,
      },
      "",
      "#" + id,
    );
    renderRuta(false, { enfocar: true, suave: true });
    if (focoBusqueda) $("#buscar").focus({ preventScroll: true });
  }

  function volverAExplorar() {
    recordarPosicion();
    history.pushState(
      {
        app: true,
        principal: "exploracion",
        scroll: retornoExploracion.scroll,
        scrollSeccion: retornoExploracion.seccion,
        retornoExploracion,
      },
      "",
      "#" + retornoExploracion.seccion,
    );
    renderRuta(true, { enfocar: true });
  }

  function portadaDetalle(etiqueta, nombre, descripcion) {
    return `<div class="catalog-detail-hero"><div class="dialog-header"><p class="eyebrow">${esc(etiqueta)}</p><h2 id="dialog-titulo">${esc(nombre)}</h2><p>${esc(descripcion)}</p></div><figure><img src="assets/img/portada-plato.webp" alt="Plato de referencia de Allsumaq"><figcaption>Fotografía de referencia de Allsumaq</figcaption></figure></div>`;
  }
  function hecho(titulo, valor) {
    return `<div class="detail-fact"><dt>${esc(titulo)}</dt><dd>${esc(valor)}</dd></div>`;
  }
  function botonPlato(p, a) {
    return alimentos.some(item => item.id === a.id)
      ? `<button type="button" class="button button--light" data-alimento="${esc(a.id)}">Ver alimento ${icon("arrow")}</button>`
      : `<button type="button" class="button button--light" data-plato-local="${esc(p.id + "|" + a.id)}">Ver alimento ${icon("arrow")}</button>`;
  }
  function detalleEstablecimiento(p) {
    window.AllsumaqLugares.prepararFicha(p);
    const platos = window.AllsumaqLugares.platos(p.id);
    const distrito = p.distrito || platos.find(a => a.distritos?.length)?.distritos.join(" / ") || "Distrito no disponible";
    const tipos = { mercado: "Mercado / puestos de comida", restaurante: "Restaurante / comida", puesto: "Puesto / comida rápida", comedor: "Comedor comunitario" };
    return portadaDetalle("ESTABLECIMIENTO CERCANO", p.nombre, distrito) +
      `<div class="catalog-detail-grid"><section class="catalog-panel"><h3>${icon("pin")} Información del establecimiento</h3><dl class="detail-facts">${hecho("Distrito", distrito)}${hecho("Tipo de establecimiento", tipos[p.tipo] || "Lugar de comida")}${hecho("Horario registrado", p.horario || "Horario no disponible")}${hecho("Dirección", p.direccion || "Dirección no disponible; consulta el punto cartográfico")}${hecho("Distancia estimada", Number.isFinite(p.distancia) ? Math.round(p.distancia) + " m en línea recta desde la sede" : "Selecciona una sede para calcularla")}${hecho("Disponibilidad", "Por confirmar con el local")}</dl><p class="field-help">La ubicación procede de OpenStreetMap. Los horarios declarados pueden variar; no representan atención ni stock en tiempo real.</p></section>
      <aside class="catalog-panel"><h3>Acciones rápidas</h3><div class="catalog-actions"><button class="button button--light" type="button" data-ver-local-mapa="${esc(p.id)}">${icon("map")}Ver en mapa</button><a class="button button--light" href="${esc(p.fuente)}" target="_blank" rel="noopener noreferrer">Consultar ubicación y fuente ↗</a></div><p class="field-help">En mercados, confirma el puesto o vendedor específico antes de acudir.</p></aside></div>
      <section class="catalog-panel establishment-dishes"><h3>Comidas registradas</h3><p class="field-help">Platos de referencia vinculados a este lugar. La asociación del equipo no confirma que un puesto los venda actualmente.</p><div class="registered-dishes">${platos.length ? platos.map(a => `<article class="registered-dish">${icon("plate")}<div><h4>${esc(a.nombre)}</h4><p class="nearby-price">${esc(precio(a))}</p><p class="field-help">${esc(notaPrecio(a))}${a.puesto ? " · Puesto: " + esc(a.puesto) : " · Vendedor por confirmar"}</p></div>${botonPlato(p, a)}</article>`).join("") : '<p class="venue-menu-empty">Todavía no hay comidas registradas para este establecimiento.</p>'}</div></section>`;
  }
  function detalleAlimento(a, local = null) {
    const placeId = window.ALLSUMAQ_VINCULOS_ESTABLECIMIENTOS?.[a.id];
    const p = local || (placeId && window.AllsumaqLugares.obtener(placeId));
    const nombreLocal = p?.nombre || a.establecimiento || "Establecimiento por confirmar";
    return portadaDetalle("PLATO DEL CATÁLOGO", a.nombre, nombreLocal) +
      `<div class="catalog-food-toolbar"><div><span>Precio referencial</span><strong>${esc(precio(a))}</strong><small>${esc(notaPrecio(a))}</small></div><div><span>Establecimiento</span><strong>${esc(nombreLocal)}</strong></div>${p ? `<button type="button" class="button button--primary" data-establecimiento="${esc(p.id)}">Ver establecimiento ${icon("arrow")}</button>` : '<p class="field-help">Ubicación exacta pendiente de confirmar.</p>'}</div>
      <div class="catalog-food-columns"><section class="catalog-panel"><h3>${icon("plate")} Información del plato</h3><dl>${hecho("Porción", a.porcion || "Dato no disponible")}${hecho("Tiempo de obtención", a.tiempoObtencion || "Dato no disponible")}${hecho("Hierro por porción", a.hierroMg == null ? "Dato no disponible" : a.hierroMg + " mg estimados")}${hecho("Fuente nutricional", a.fuenteNutricional || "Pendiente de documentar")}</dl></section>
      <section class="catalog-panel"><h3>${icon("leaf")} Ingredientes principales</h3><p>${esc(a.ingredientes?.join(", ") || "Lista completa pendiente de confirmar.")}</p>${a.descripcion ? `<p>${esc(a.descripcion)}</p>` : ""}<p class="field-help">No se atribuyen aportes nutricionales sin porción, fuente y método documentados.</p></section>
      <section class="catalog-panel"><h3>${icon("info")} Información del establecimiento</h3><p>${esc(nombreLocal)}</p><p class="field-help">${esc(p?.direccion || a.direccion || "Dirección y puesto específico pendientes de confirmar.")}</p><p class="field-help">${esc(p?.horario || "Horario no disponible")}</p><p class="field-help">Precio, vendedor y disponibilidad por confirmar antes de acudir.</p>${alimentos.some(item => item.id === a.id) ? `<div class="catalog-actions"><button class="button button--light" type="button" data-favorito="${esc(a.id)}" aria-pressed="${estado.favoritos.includes(a.id)}">${icon("heart")}Guardar en favoritos</button><button class="text-button" type="button" data-register-item="${esc(a.id)}">Registrar consumo ${icon("plus")}</button></div>` : ""}</section></div>`;
  }

  function listadoRecetas() {
    return `<div class="dialog-header"><p class="eyebrow">RECETAS PARA TU DÍA A DÍA</p><h2 id="dialog-titulo">Cocina algo bueno.<br><span class="text-sage">Empieza con una receta.</span></h2><p>Diez adaptaciones domésticas del catálogo del equipo. Ingredientes, cantidades y pasos en un solo lugar.</p></div><label class="recipe-search"><span>Buscar una receta</span><input id="buscar-receta" type="search" placeholder="Nombre o ingrediente…" autocomplete="off"></label><p id="recetas-conteo" class="field-help" role="status" style="margin-bottom:14px"></p><div id="recetas-lista" class="recipe-list"></div>`;
  }

  function renderListaRecetas() {
    busquedaRecetas = $("#buscar-receta").value;
    const busqueda = modelo.normalizar(busquedaRecetas).trim();
    const lista = recetas.filter((r) =>
      modelo
        .normalizar(r.nombre + " " + r.ingredientes.join(" "))
        .includes(busqueda),
    );
    $("#recetas-conteo").textContent = `${lista.length} recetas encontradas`;
    $("#recetas-lista").innerHTML = lista.length
      ? lista
          .map(
            (r) =>
              `<article class="recipe-card"><span class="feature-icon">${icon("book")}</span><div><h3>${esc(r.nombre)}</h3><p>${icon("clock")} ${r.minutos} min aprox. · ${esc(r.porciones)} porciones · ${esc(r.dificultad)}</p></div><button type="button" data-receta="${esc(r.id)}" aria-label="Ver receta de ${esc(r.nombre)}">${icon("arrow")}</button></article>`,
          )
          .join("")
      : empty(
          "No encontramos esa receta",
          "Prueba otro nombre o busca un ingrediente como quinua.",
        );
  }

  function detalleReceta(r) {
    return `<div class="dialog-header"><p class="eyebrow">RECETA · ${esc(r.nota)}</p><h2 id="dialog-titulo">${esc(r.nombre)}</h2><p>${esc(r.descripcion)}</p></div><dl class="detail-facts"><div class="detail-fact"><dt>Preparación</dt><dd>${r.minutos} min aprox.</dd></div><div class="detail-fact"><dt>Porciones</dt><dd>${esc(r.porciones)}</dd></div><div class="detail-fact"><dt>Dificultad</dt><dd>${esc(r.dificultad)}</dd></div></dl><div class="detail-columns"><div><h3>Ingredientes</h3><ul>${r.ingredientes.map((i) => `<li>${esc(i)}</li>`).join("")}</ul></div><div><h3>Preparación</h3><ol>${r.pasos.map((p) => `<li>${esc(p)}</li>`).join("")}</ol></div></div><div class="notice">${icon("info")}<p>Costo estimado y hierro por porción: pendientes de cálculo documentado. Las cantidades y pasos son adaptaciones orientativas del equipo.</p></div><p class="detail-source">${esc(r.fuenteTexto)} Enlace a la publicación original pendiente de verificar.</p><button type="button" class="button button--primary" data-register-item="${esc(r.id)}">Registrar que la consumí${icon("plus")}</button>`;
  }

  function confirmacion(r) {
    return `<div class="success-heading"><span class="feature-icon">${icon("check")}</span><div><p class="eyebrow eyebrow--sage">GUARDADO CORRECTAMENTE</p><h2 id="dialog-titulo">¡Registro guardado<br><span class="text-sage">con éxito!</span></h2></div></div><p class="field-help">Tu consumo ya aparece en el historial de este navegador.</p><div class="success-details"><h3>${esc(r.nombre)}</h3><p>${esc(fechaBonita(r.fecha))} · ${esc(r.momento)}</p>${r.notas ? `<p style="margin-top:8px">${esc(r.notas)}</p>` : ""}</div><div class="button-row"><a class="button button--primary" href="#progreso">${icon("chart")}Ver mi progreso${icon("arrow")}</a><a class="button button--light" href="#registrar">${icon("plus")}Registrar otro consumo</a></div>`;
  }

  function renderRuta(restaurar = false, opciones = {}) {
    const hash = location.hash.slice(1);
    const [vista, rawId] = hash.split("=");
    let id = "";
    try { id = decodeURIComponent(rawId || ""); } catch (_) { /* Enlace inválido. */ }
    const recuerdo = history.state?.retornoExploracion;
    if (
      recuerdo &&
      seccionesScroll.includes(recuerdo.seccion) &&
      Number.isFinite(recuerdo.scroll)
    )
      retornoExploracion = recuerdo;
    let contenido = "";
    if (vista === "recetas") contenido = listadoRecetas();
    if (vista === "alimento") {
      const a = alimentos.find((a) => a.id === id);
      if (a) contenido = detalleAlimento(a);
    }
    if (vista === "establecimiento") {
      const p = window.AllsumaqLugares.obtener(id);
      if (p) contenido = detalleEstablecimiento(p);
    }
    if (vista === "plato") {
      const [placeId, dishId] = id.split("|");
      const p = window.AllsumaqLugares.obtener(placeId);
      const a = p && window.AllsumaqLugares.platos(placeId).find(item => item.id === dishId);
      if (a) contenido = detalleAlimento(a, p);
    }
    if (vista === "receta") {
      const r = recetas.find((r) => r.id === id);
      if (r) contenido = detalleReceta(r);
    }
    if (vista === "guardado") {
      const r = estado.registros.find((r) => r.id === id);
      if (r) contenido = confirmacion(r);
    }
    if (!contenido && ["alimento", "establecimiento", "plato", "receta", "guardado"].includes(vista))
      contenido =
        '<div class="dialog-header"><h2 id="dialog-titulo">No encontramos esta información</h2><p>El enlace no corresponde a un registro disponible en este navegador.</p></div><a class="button button--primary" href="#inicio">Volver a Inicio</a>';
    if (contenido) {
      const principal =
        vista === "guardado"
          ? "registrar"
          : vistasClick.includes(history.state?.principal)
            ? history.state.principal
            : "exploracion";
      mostrarPrincipal(principal);
      dialogBody.innerHTML = contenido;
      dialog.classList.toggle("catalog-detail-dialog", ["establecimiento", "alimento", "plato"].includes(vista));
      if (vista === "recetas") {
        $("#buscar-receta").value = busquedaRecetas;
        renderListaRecetas();
      }
      if (!dialog.open) dialog.showModal();
      document.body.classList.add("dialog-open");
      marcarSeccion(
        ["alimento", "establecimiento", "plato"].includes(vista)
          ? "mapa"
          : vista === "guardado"
            ? "registrar"
            : "inicio",
      );
      dialog.scrollTop = restaurar ? history.state?.dialogScroll || 0 : 0;
      $("[data-dialog-back]").focus({ preventScroll: true });
      return;
    }
    const cerrandoDialog = dialog.open;
    if (cerrandoDialog) {
      dialog.close();
      document.body.classList.remove("dialog-open");
    }
    const idPrincipal =
      vistasClick.includes(vista) || seccionesScroll.includes(vista)
        ? vista
        : "inicio";
    mostrarPrincipal(idPrincipal);
    const seccion = document.getElementById(idPrincipal);
    const scrollPrincipal = seccionesScroll.includes(idPrincipal);
    if (scrollPrincipal)
      ultimaSeccionExploracion =
        restaurar && seccionesScroll.includes(history.state?.scrollSeccion)
          ? history.state.scrollSeccion
          : idPrincipal;
    marcarSeccion(scrollPrincipal ? ultimaSeccionExploracion : idPrincipal);
    if (restaurar && Number.isFinite(history.state?.scroll)) {
      window.scrollTo({ top: history.state.scroll, behavior: "instant" });
    } else if (scrollPrincipal) {
      seccion.scrollIntoView({
        behavior:
          opciones.suave &&
          !matchMedia("(prefers-reduced-motion: reduce)").matches
            ? "smooth"
            : "instant",
      });
    } else {
      window.scrollTo({ top: 0, behavior: "instant" });
    }
    if (opciones.enfocar) {
      const titulo = $("#titulo-" + idPrincipal);
      titulo.tabIndex = -1;
      titulo.focus({ preventScroll: true });
    } else if (
      cerrandoDialog &&
      focoOrigen?.isConnected &&
      focoOrigen.getClientRects().length
    ) {
      focoOrigen.focus({ preventScroll: true });
    }
    if (cerrandoDialog) focoOrigen = null;
  }

  function guardarRegistro(event) {
    event.preventDefault();
    const formulario = event.currentTarget;
    const datos = Object.fromEntries(new FormData(formulario));
    const errores = modelo.validarRegistro(datos, elementos, hoy());
    ["elemento", "fecha", "momento", "notas"].forEach((campo) => {
      $("#error-" + campo).textContent = errores[campo] || "";
      if (errores[campo])
        formulario.elements[campo].setAttribute("aria-invalid", "true");
      else formulario.elements[campo].removeAttribute("aria-invalid");
    });
    $("#registro-errores").hidden = Object.keys(errores).length === 0;
    if (Object.keys(errores).length) {
      $("#registro-errores").textContent =
        "Revisa los campos indicados. Tus datos válidos se han conservado.";
      formulario.elements[Object.keys(errores)[0]].focus();
      return;
    }
    const elemento = elementos.find((e) => e.id === datos.elemento);
    const registro = {
      id:
        "REG-" +
        (window.crypto?.randomUUID
          ? crypto.randomUUID()
          : Date.now() + "-" + Math.random().toString(36).slice(2)),
      elemento: elemento.id,
      nombre: elemento.nombre,
      fecha: datos.fecha,
      momento: datos.momento,
      notas: datos.notas.trim(),
      tipo: elemento.id.startsWith("BEB") ? "bebida" : "comida",
    };
    if (!persistir({ ...estado, registros: [...estado.registros, registro] }))
      return;
    renderProgreso();
    formulario.reset();
    $("#registro-fecha").value = hoy();
    abrir("#guardado=" + registro.id);
  }

  function inicializar() {
    const inicio = window.ALLSUMAQ_CONTENIDO.inicio;
    Object.entries({
      "inicio-etiqueta": inicio.etiqueta,
      "inicio-titulo": inicio.titulo,
      "inicio-destacado": inicio.destacado,
      "inicio-descripcion": inicio.descripcion,
      "inicio-nota": inicio.nota,
    }).forEach(([id, texto]) => {
      document.getElementById(id).textContent = texto;
    });
    $("#inicio-etiqueta").style.whiteSpace = "pre-line";
    $("#inicio-nota").style.whiteSpace = "pre-line";
    const opciones = distritos
      .map((d) => `<option value="${esc(d)}">${esc(d)}</option>`)
      .join("");
    $("#filtro-distrito").insertAdjacentHTML("beforeend", opciones);
    $("#perfil-zona").insertAdjacentHTML("beforeend", opciones);
    $("#perfil-zona").value = estado.zona;
    $("#filtro-distrito").value = estado.zona;
    const grupos = [
      ["Alimentos", alimentos],
      ["Recetas preparadas", recetas],
      ["Bebidas", bebidas],
    ];
    $("#registro-elemento").insertAdjacentHTML(
      "beforeend",
      grupos
        .map(
          ([titulo, lista]) =>
            `<optgroup label="${titulo}">${lista.map((a) => `<option value="${esc(a.id)}">${esc(a.nombre)}</option>`).join("")}</optgroup>`,
        )
        .join(""),
    );
    $("#registro-fecha").value = hoy();
    $("#registro-fecha").max = hoy();
    renderAlimentos();
    renderFavoritos();
    renderProgreso();
    if ("scrollRestoration" in history) history.scrollRestoration = "manual";
    establecerModo(modo);
    renderRuta();
    if (!history.state) recordarPosicion();
    document.documentElement.dataset.appReady = "true";
  }

  filtrosForm.addEventListener("submit", (e) => {
    e.preventDefault();
    renderAlimentos();
  });
  filtrosForm.addEventListener("input", renderAlimentos);
  filtrosForm.addEventListener("change", renderAlimentos);
  $("#limpiar-filtros").addEventListener("click", limpiarFiltros);
  $("#registro-form").addEventListener("submit", guardarRegistro);
  $("#periodo").addEventListener("change", renderProgreso);
  $("#zona-form").addEventListener("submit", (e) => {
    e.preventDefault();
    const zona = $("#perfil-zona").value;
    if (persistir({ ...estado, zona })) {
      $("#filtro-distrito").value = zona;
      renderAlimentos();
      avisar(
        zona
          ? "Zona guardada: " + zona + "."
          : "Preferencia de zona restablecida.",
      );
    }
  });
  document.addEventListener("input", (e) => {
    if (e.target.id === "buscar-receta") renderListaRecetas();
  });
  document.addEventListener("click", (e) => {
    const control = e.target.closest("button, a");
    if (!control) return;
    if (control.matches("[data-open='recetas']")) {
      e.preventDefault();
      abrir("#recetas");
    } else if (control.dataset.alimento)
      abrir("#alimento=" + control.dataset.alimento);
    else if (control.dataset.establecimiento) abrir("#establecimiento=" + encodeURIComponent(control.dataset.establecimiento));
    else if (control.dataset.platoLocal) abrir("#plato=" + encodeURIComponent(control.dataset.platoLocal));
    else if (control.dataset.verLocalMapa) {
      establecerModo("mapa"); irSeccion("mapa");
      window.AllsumaqLugares.verEnMapa(control.dataset.verLocalMapa);
    }
    else if (control.dataset.receta) abrir("#receta=" + control.dataset.receta);
    else if (control.dataset.favorito) toggleFavorito(control.dataset.favorito);
    else if (control.dataset.removeFavorite)
      toggleFavorito(control.dataset.removeFavorite);
    else if (control.hasAttribute("data-reset-filters")) limpiarFiltros();
    else if (control.dataset.mode) establecerModo(control.dataset.mode);
    else if (control.hasAttribute("data-volver-explorar")) volverAExplorar();
    else if (
      control.hasAttribute("data-dialog-close") ||
      control.hasAttribute("data-dialog-back")
    )
      volver();
    else if (control.dataset.registerItem) {
      $("#registro-elemento").value = control.dataset.registerItem;
      irSeccion("registrar");
      $("#registro-elemento").focus({ preventScroll: true });
    } else if (control.matches("a[href^='#']")) {
      const id = control.hash.slice(1);
      if (["inicio", "mapa", "registrar", "progreso", "perfil"].includes(id)) {
        e.preventDefault();
        if (control.hasAttribute("data-map-link")) establecerModo("mapa");
        irSeccion(id, control.hasAttribute("data-focus-search"));
      }
    }
  });
  dialog.addEventListener("cancel", (e) => {
    e.preventDefault();
    volver();
  });
  window.addEventListener("popstate", () => renderRuta(true));
  window.addEventListener("storage", (e) => {
    if (e.key !== storageKey && e.key !== null) return;
    estado = leerEstado();
    renderAlimentos();
    renderFavoritos();
    renderProgreso();
    $("#perfil-zona").value = estado.zona;
  });
  document.addEventListener("allsumaq:sesion", (event) => {
    const user = event.detail?.user;
    const nextKey =
      user?.sub && /^\d+$/.test(user.sub)
        ? guestStorageKey + ":google:" + user.sub
        : guestStorageKey;
    if (nextKey === storageKey) return;
    storageKey = nextKey;
    estado = leerEstado();
    renderAlimentos();
    renderFavoritos();
    renderProgreso();
    $("#perfil-zona").value = estado.zona;
    $("#filtro-distrito").value = estado.zona;
    renderAlimentos();
    $("#registro-form").reset();
    $("#registro-fecha").value = hoy();
  });
  if ("IntersectionObserver" in window) {
    const observer = new IntersectionObserver(actualizarScrollspy, {
      rootMargin: "-20% 0px -45% 0px",
      threshold: [0, 0.1, 0.5, 1],
    });
    $$(".observed-section").forEach((s) => observer.observe(s));
  }
  window.AllsumaqNavegacion = { abrir, volver };
  inicializar();
})();
