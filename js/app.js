(function () {
  "use strict";
  const $ = (selector, parent = document) => parent.querySelector(selector);
  const $$ = (selector, parent = document) => [...parent.querySelectorAll(selector)];
  const alimentos = window.ALLSUMAQ_ALIMENTOS;
  const recetas = window.ALLSUMAQ_RECETAS;
  const bebidas = window.ALLSUMAQ_BEBIDAS;
  const modelo = window.AllsumaqModelo;
  const elementos = [...alimentos, ...recetas, ...bebidas];
  const distritos = [...new Set(alimentos.flatMap((a) => a.distritos))].sort((a, b) => a.localeCompare(b, "es"));
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

  const esc = (value) => String(value ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const icon = (nombre) => `<svg class="icon" aria-hidden="true"><use href="#i-${nombre}"/></svg>`;
  const hoy = () => new Intl.DateTimeFormat("en-CA", { timeZone: "America/Lima", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
  const fechaBonita = (fecha) => new Intl.DateTimeFormat("es-PE", { day: "numeric", month: "short", year: "numeric", timeZone: "America/Lima" }).format(new Date(fecha + "T12:00:00Z"));
  const numero = (n) => new Intl.NumberFormat("es-PE", { minimumFractionDigits: Number.isInteger(n) ? 0 : 2, maximumFractionDigits: 2 }).format(n);

  function leerEstado() {
    const vacio = { registros: [], favoritos: [], zona: "" };
    try {
      const dato = JSON.parse(localStorage.getItem(storageKey));
      if (!dato || typeof dato !== "object") return vacio;
      const registros = Array.isArray(dato.registros) ? dato.registros.filter((r) => r && typeof r.id === "string" && typeof r.nombre === "string" && /^\d{4}-\d{2}-\d{2}$/.test(r.fecha || "") && !Number.isNaN(new Date(r.fecha + "T12:00:00Z").getTime()) && typeof r.momento === "string").slice(0, 5000) : [];
      const favoritos = Array.isArray(dato.favoritos) ? [...new Set(dato.favoritos.filter((id) => alimentos.some((a) => a.id === id)))] : [];
      return { registros, favoritos, zona: distritos.includes(dato.zona) ? dato.zona : "" };
    } catch (_) { return vacio; }
  }

  function persistir(siguiente) {
    try {
      localStorage.setItem(storageKey, JSON.stringify(siguiente));
      estado = siguiente;
      return true;
    } catch (_) {
      avisar("No se pudo guardar. Revisa el permiso de almacenamiento de este navegador.");
      return false;
    }
  }

  function avisar(mensaje) {
    clearTimeout(toastTimer);
    $("#toast").textContent = mensaje;
    $("#toast").hidden = false;
    toastTimer = setTimeout(() => { $("#toast").hidden = true; }, 4500);
  }

  function precio(a) {
    if (a.precioMin === null || a.precioMax === null) return "Precio por confirmar";
    const rango = a.precioMin === a.precioMax ? numero(a.precioMin) : `${numero(a.precioMin)}–${numero(a.precioMax)}`;
    return `S/ ${rango}`;
  }

  function notaPrecio(a) {
    if (a.precioTipo === "persona") return "Gasto referencial por persona";
    if (a.precioTipo === "publicado") return "Publicado · fuente y fecha por confirmar";
    if (a.precioTipo === "pendiente") return "Consulta con el establecimiento";
    return "Precio estimado por plato";
  }

  function imagenLocal(ruta, nombre) {
    return typeof ruta === "string" && /^assets\/[\w\s./-]+\.(?:png|jpe?g|webp|avif)$/i.test(ruta) ? `<img class="food-photo" src="${esc(ruta)}" alt="${esc(nombre)}" loading="lazy">` : "";
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

  function filtrosActuales() { return Object.fromEntries(new FormData(filtrosForm)); }

  function renderAlimentos() {
    const filtros = filtrosActuales();
    const resultados = modelo.filtrar(alimentos, filtros);
    $("#resultados-conteo").textContent = `${resultados.length} ${resultados.length === 1 ? "opción encontrada" : "opciones encontradas"}${filtros.distrito ? " en " + filtros.distrito : ""}`;
    $("#alimentos-grid").innerHTML = resultados.length ? resultados.map(foodCard).join("") : empty("No encontramos coincidencias", "Prueba otro nombre, cambia el distrito o amplía el presupuesto.", '<button type="button" class="button button--light" data-reset-filters>Limpiar filtros</button>');
  }

  function establecerModo(nuevo) {
    modo = nuevo;
    $("#mapa-real").hidden = modo !== "mapa";
    window.AllsumaqMapa?.setVisible(modo === "mapa");
    $$("[data-mode]").forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.mode === modo)));
  }

  function limpiarFiltros() {
    filtrosForm.reset();
    renderAlimentos();
    $("#buscar").focus({ preventScroll: true });
  }

  function toggleFavorito(id) {
    if (!alimentos.some((a) => a.id === id)) return;
    const existia = estado.favoritos.includes(id);
    const favoritos = existia ? estado.favoritos.filter((a) => a !== id) : [...estado.favoritos, id];
    if (!persistir({ ...estado, favoritos })) return;
    // Update the existing controls so the keyboard user's focus stays in place.
    $$(`[data-favorito="${id}"]`).forEach((b) => {
      b.setAttribute("aria-pressed", String(!existia));
      b.setAttribute("aria-label", `${existia ? "Añadir a" : "Quitar de"} favoritos: ${alimentos.find((a) => a.id === id).nombre}`);
      if (b.classList.contains("button")) b.innerHTML = icon("heart") + (existia ? "Guardar en favoritos" : "Guardado en favoritos");
    });
    renderFavoritos();
    avisar(existia ? "Plato retirado de tus favoritos." : "Plato añadido a tus favoritos.");
  }

  function renderFavoritos() {
    const favoritos = alimentos.filter((a) => estado.favoritos.includes(a.id));
    $("#favoritos").innerHTML = favoritos.length ? favoritos.map((a) => `<div class="favorite-row"><button type="button" data-alimento="${esc(a.id)}">${esc(a.nombre)}</button><button type="button" class="icon-button" data-remove-favorite="${esc(a.id)}" aria-label="Quitar de favoritos: ${esc(a.nombre)}">${icon("close")}</button></div>`).join("") : empty("Tu próxima elección", "Guarda un plato con el corazón del catálogo para encontrarlo aquí.", '<a class="text-button" href="#mapa">Explorar alimentos →</a>');
  }

  function renderProgreso() {
    const fin = hoy();
    const periodo = $("#periodo").value;
    const fechaInicio = new Date(fin + "T12:00:00Z");
    if (periodo !== "todo") fechaInicio.setUTCDate(fechaInicio.getUTCDate() - Number(periodo) + 1);
    const inicio = periodo === "todo" ? "0000-00-00" : fechaInicio.toISOString().slice(0, 10);
    const resumen = modelo.resumir(estado.registros, inicio, fin);
    $("#periodo-descripcion").textContent = periodo === "todo" ? `Hasta el ${fechaBonita(fin)}` : `${fechaBonita(inicio)} – ${fechaBonita(fin)}`;
    const stats = [["calendar", "Consumos registrados", resumen.total], ["plate", "Comidas", resumen.comidas], ["cup", "Bebidas", resumen.bebidas], ["chart", "Días con registros", resumen.dias]];
    $("#estadisticas").innerHTML = stats.map(([nombreIcono, nombre, total]) => `<div class="stat"><span class="feature-icon">${icon(nombreIcono)}</span><div><p>${nombre}</p><strong>${total}</strong></div></div>`).join("");
    $("#historial").innerHTML = resumen.total ? [...resumen.entradas].sort((a, b) => b.fecha.localeCompare(a.fecha) || b.id.localeCompare(a.id)).map((r) => `<article class="history-row"><span class="feature-icon">${icon(r.tipo === "bebida" ? "cup" : "plate")}</span><div><h4>${esc(r.nombre)}</h4><p>${esc(r.momento)}${r.notas ? " · " + esc(r.notas) : ""}</p></div><time datetime="${esc(r.fecha)}">${esc(fechaBonita(r.fecha))}</time></article>`).join("") : empty("Tu historia empieza con un registro", "Aún no hay consumos guardados para este periodo. Puedes comenzar cuando quieras.", '<a class="button button--light" href="#registrar">Registrar mi primer consumo →</a>');
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
    history.replaceState({ ...(history.state || {}), app: true, scroll: window.scrollY, dialogScroll: dialog.scrollTop }, "", location.href);
  }

  function abrir(hash) {
    recordarPosicion();
    if (!dialog.open) focoOrigen = document.activeElement;
    history.pushState({ app: true, interno: true, scroll: window.scrollY }, "", hash);
    renderRuta();
  }

  function volver() {
    if (history.state?.interno) history.back();
    else {
      const seccion = location.hash.startsWith("#alimento") ? "mapa" : location.hash.startsWith("#guardado") ? "registrar" : "inicio";
      history.replaceState({ app: true }, "", "#" + seccion);
      renderRuta();
    }
  }

  function irSeccion(id, focoBusqueda = false) {
    recordarPosicion();
    history.pushState({ app: true }, "", "#" + id);
    if (dialog.open) dialog.close();
    document.body.classList.remove("dialog-open");
    const seccion = document.getElementById(id);
    seccion?.scrollIntoView({ behavior: matchMedia("(prefers-reduced-motion: reduce)").matches ? "instant" : "smooth" });
    marcarSeccion(id);
    if (focoBusqueda) $("#buscar").focus({ preventScroll: true });
  }

  function detalleAlimento(a) {
    return `<div class="dialog-header"><p class="eyebrow">PLATO DEL CATÁLOGO</p><h2 id="dialog-titulo">${esc(a.nombre)}</h2><p>${esc(a.establecimiento)} · ${esc(a.distritos.join(" / "))}</p></div>
      ${imagenLocal(a.imagen, a.nombre)}
      <dl class="detail-facts"><div class="detail-fact"><dt>Precio</dt><dd>${esc(precio(a))}<span class="price-note">${esc(notaPrecio(a))}</span></dd></div><div class="detail-fact"><dt>Porción</dt><dd>${esc(a.porcion || "Dato no disponible")}</dd></div><div class="detail-fact"><dt>Tiempo de obtención</dt><dd>${esc(a.tiempoObtencion || "Dato no disponible")}</dd></div></dl>
      <div class="detail-columns"><div><h3>Información del establecimiento</h3><p class="field-help">${esc(a.establecimiento)}</p><p class="field-help">Distrito: ${esc(a.distritos.join(" / "))}</p><p class="field-help">${esc(a.direccion || "Dirección y puesto específico pendientes de confirmar.")}</p><p class="field-help">${esc(a.notaUbicacion || "Horarios y disponibilidad pendientes de confirmar.")}</p></div><div><h3>Información del alimento</h3><p class="field-help">Ingredientes: ${esc(a.ingredientes ? a.ingredientes.join(", ") : "lista completa pendiente de confirmar")}</p><p class="field-help">Hierro por porción: ${esc(a.hierroMg === null ? "dato no disponible" : a.hierroMg + " mg estimados")}</p><p class="field-help">Fuente nutricional: ${esc(a.fuenteNutricional || "pendiente de documentar")}</p></div></div>
      <div class="notice">${icon("info")}<p>Los datos comerciales proceden de la tabla del equipo y necesitan confirmación con el establecimiento. Las cifras de hierro requieren porción, fuente y método documentados.</p></div>
      <div class="button-row" style="margin-top:22px"><button class="button button--primary" type="button" data-register-item="${esc(a.id)}">Registrar consumo${icon("plus")}</button><button class="button button--light" type="button" data-favorito="${esc(a.id)}" aria-pressed="${estado.favoritos.includes(a.id)}">${icon("heart")}Guardar en favoritos</button></div>`;
  }

  function listadoRecetas() {
    return `<div class="dialog-header"><p class="eyebrow">RECETAS PARA TU DÍA A DÍA</p><h2 id="dialog-titulo">Cocina algo bueno.<br><span class="text-sage">Empieza con una receta.</span></h2><p>Diez adaptaciones domésticas del catálogo del equipo. Ingredientes, cantidades y pasos en un solo lugar.</p></div><label class="recipe-search"><span>Buscar una receta</span><input id="buscar-receta" type="search" placeholder="Nombre o ingrediente…" autocomplete="off"></label><p id="recetas-conteo" class="field-help" role="status" style="margin-bottom:14px"></p><div id="recetas-lista" class="recipe-list"></div>`;
  }

  function renderListaRecetas() {
    busquedaRecetas = $("#buscar-receta").value;
    const busqueda = modelo.normalizar(busquedaRecetas).trim();
    const lista = recetas.filter((r) => modelo.normalizar(r.nombre + " " + r.ingredientes.join(" ")).includes(busqueda));
    $("#recetas-conteo").textContent = `${lista.length} recetas encontradas`;
    $("#recetas-lista").innerHTML = lista.length ? lista.map((r) => `<article class="recipe-card"><span class="feature-icon">${icon("book")}</span><div><h3>${esc(r.nombre)}</h3><p>${icon("clock")} ${r.minutos} min aprox. · ${esc(r.porciones)} porciones · ${esc(r.dificultad)}</p></div><button type="button" data-receta="${esc(r.id)}" aria-label="Ver receta de ${esc(r.nombre)}">${icon("arrow")}</button></article>`).join("") : empty("No encontramos esa receta", "Prueba otro nombre o busca un ingrediente como quinua.");
  }

  function detalleReceta(r) {
    return `<div class="dialog-header"><p class="eyebrow">RECETA · ${esc(r.nota)}</p><h2 id="dialog-titulo">${esc(r.nombre)}</h2><p>${esc(r.descripcion)}</p></div><dl class="detail-facts"><div class="detail-fact"><dt>Preparación</dt><dd>${r.minutos} min aprox.</dd></div><div class="detail-fact"><dt>Porciones</dt><dd>${esc(r.porciones)}</dd></div><div class="detail-fact"><dt>Dificultad</dt><dd>${esc(r.dificultad)}</dd></div></dl><div class="detail-columns"><div><h3>Ingredientes</h3><ul>${r.ingredientes.map((i) => `<li>${esc(i)}</li>`).join("")}</ul></div><div><h3>Preparación</h3><ol>${r.pasos.map((p) => `<li>${esc(p)}</li>`).join("")}</ol></div></div><div class="notice">${icon("info")}<p>Costo estimado y hierro por porción: pendientes de cálculo documentado. Las cantidades y pasos son adaptaciones orientativas del equipo.</p></div><p class="detail-source">${esc(r.fuenteTexto)} Enlace a la publicación original pendiente de verificar.</p><button type="button" class="button button--primary" data-register-item="${esc(r.id)}">Registrar que la consumí${icon("plus")}</button>`;
  }

  function confirmacion(r) {
    return `<div class="success-heading"><span class="feature-icon">${icon("check")}</span><div><p class="eyebrow eyebrow--sage">GUARDADO CORRECTAMENTE</p><h2 id="dialog-titulo">¡Registro guardado<br><span class="text-sage">con éxito!</span></h2></div></div><p class="field-help">Tu consumo ya aparece en el historial de este navegador.</p><div class="success-details"><h3>${esc(r.nombre)}</h3><p>${esc(fechaBonita(r.fecha))} · ${esc(r.momento)}</p>${r.notas ? `<p style="margin-top:8px">${esc(r.notas)}</p>` : ""}</div><div class="button-row"><a class="button button--primary" href="#progreso">${icon("chart")}Ver mi progreso${icon("arrow")}</a><a class="button button--light" href="#registrar">${icon("plus")}Registrar otro consumo</a></div>`;
  }

  function renderRuta(restaurar = false) {
    const hash = location.hash.slice(1);
    const [vista, id] = hash.split("=");
    let contenido = "";
    if (vista === "recetas") contenido = listadoRecetas();
    if (vista === "alimento") {
      const a = alimentos.find((a) => a.id === id);
      if (a) contenido = detalleAlimento(a);
    }
    if (vista === "receta") {
      const r = recetas.find((r) => r.id === id);
      if (r) contenido = detalleReceta(r);
    }
    if (vista === "guardado") {
      const r = estado.registros.find((r) => r.id === id);
      if (r) contenido = confirmacion(r);
    }
    if (!contenido && ["alimento", "receta", "guardado"].includes(vista)) contenido = '<div class="dialog-header"><h2 id="dialog-titulo">No encontramos esta información</h2><p>El enlace no corresponde a un registro disponible en este navegador.</p></div><a class="button button--primary" href="#inicio">Volver a Inicio</a>';
    if (contenido) {
      dialogBody.innerHTML = contenido;
      if (vista === "recetas") {
        $("#buscar-receta").value = busquedaRecetas;
        renderListaRecetas();
      }
      if (!dialog.open) dialog.showModal();
      document.body.classList.add("dialog-open");
      marcarSeccion(vista === "alimento" ? "mapa" : vista === "guardado" ? "registrar" : "inicio");
      dialog.scrollTop = restaurar ? history.state?.dialogScroll || 0 : 0;
      $("[data-dialog-back]").focus({ preventScroll: true });
      return;
    }
    if (dialog.open) {
      dialog.close();
      document.body.classList.remove("dialog-open");
      if (focoOrigen?.isConnected) focoOrigen.focus({ preventScroll: true });
    }
    if (restaurar && Number.isFinite(history.state?.scroll)) {
      window.scrollTo({ top: history.state.scroll, behavior: "instant" });
    } else if (["inicio", "mapa", "registrar", "progreso", "perfil"].includes(vista)) {
      document.getElementById(vista).scrollIntoView({ behavior: "instant" });
    }
  }

  function guardarRegistro(event) {
    event.preventDefault();
    const formulario = event.currentTarget;
    const datos = Object.fromEntries(new FormData(formulario));
    const errores = modelo.validarRegistro(datos, elementos, hoy());
    ["elemento", "fecha", "momento", "notas"].forEach((campo) => {
      $("#error-" + campo).textContent = errores[campo] || "";
      if (errores[campo]) formulario.elements[campo].setAttribute("aria-invalid", "true");
      else formulario.elements[campo].removeAttribute("aria-invalid");
    });
    $("#registro-errores").hidden = Object.keys(errores).length === 0;
    if (Object.keys(errores).length) {
      $("#registro-errores").textContent = "Revisa los campos indicados. Tus datos válidos se han conservado.";
      formulario.elements[Object.keys(errores)[0]].focus();
      return;
    }
    const elemento = elementos.find((e) => e.id === datos.elemento);
    const registro = { id: "REG-" + (window.crypto?.randomUUID ? crypto.randomUUID() : Date.now() + "-" + Math.random().toString(36).slice(2)), elemento: elemento.id, nombre: elemento.nombre, fecha: datos.fecha, momento: datos.momento, notas: datos.notas.trim(), tipo: elemento.id.startsWith("BEB") ? "bebida" : "comida" };
    if (!persistir({ ...estado, registros: [...estado.registros, registro] })) return;
    renderProgreso();
    formulario.reset();
    $("#registro-fecha").value = hoy();
    abrir("#guardado=" + registro.id);
  }

  function inicializar() {
    const inicio = window.ALLSUMAQ_CONTENIDO.inicio;
    Object.entries({ "inicio-etiqueta": inicio.etiqueta, "inicio-titulo": inicio.titulo, "inicio-destacado": inicio.destacado, "inicio-descripcion": inicio.descripcion, "inicio-nota": inicio.nota }).forEach(([id, texto]) => { document.getElementById(id).textContent = texto; });
    $("#inicio-etiqueta").style.whiteSpace = "pre-line";
    $("#inicio-nota").style.whiteSpace = "pre-line";
    const opciones = distritos.map((d) => `<option value="${esc(d)}">${esc(d)}</option>`).join("");
    $("#filtro-distrito").insertAdjacentHTML("beforeend", opciones);
    $("#perfil-zona").insertAdjacentHTML("beforeend", opciones);
    $("#perfil-zona").value = estado.zona;
    $("#filtro-distrito").value = estado.zona;
    const grupos = [["Alimentos", alimentos], ["Recetas preparadas", recetas], ["Bebidas", bebidas]];
    $("#registro-elemento").insertAdjacentHTML("beforeend", grupos.map(([titulo, lista]) => `<optgroup label="${titulo}">${lista.map((a) => `<option value="${esc(a.id)}">${esc(a.nombre)}</option>`).join("")}</optgroup>`).join(""));
    $("#registro-fecha").value = hoy();
    $("#registro-fecha").max = hoy();
    renderAlimentos();
    renderFavoritos();
    renderProgreso();
    establecerModo(modo);
    renderRuta();
    if (!history.state) history.replaceState({ app: true, scroll: window.scrollY }, "", location.href);
    document.documentElement.dataset.appReady = "true";
  }

  filtrosForm.addEventListener("submit", (e) => { e.preventDefault(); renderAlimentos(); });
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
      avisar(zona ? "Zona guardada: " + zona + "." : "Preferencia de zona restablecida.");
    }
  });
  document.addEventListener("input", (e) => { if (e.target.id === "buscar-receta") renderListaRecetas(); });
  document.addEventListener("click", (e) => {
    const control = e.target.closest("button, a");
    if (!control) return;
    if (control.matches("[data-open='recetas']")) { e.preventDefault(); abrir("#recetas"); }
    else if (control.dataset.alimento) abrir("#alimento=" + control.dataset.alimento);
    else if (control.dataset.receta) abrir("#receta=" + control.dataset.receta);
    else if (control.dataset.favorito) toggleFavorito(control.dataset.favorito);
    else if (control.dataset.removeFavorite) toggleFavorito(control.dataset.removeFavorite);
    else if (control.hasAttribute("data-reset-filters")) limpiarFiltros();
    else if (control.dataset.mode) establecerModo(control.dataset.mode);
    else if (control.hasAttribute("data-dialog-close") || control.hasAttribute("data-dialog-back")) volver();
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
  dialog.addEventListener("cancel", (e) => { e.preventDefault(); volver(); });
  window.addEventListener("popstate", () => renderRuta(true));
  window.addEventListener("storage", (e) => {
    if (e.key !== storageKey && e.key !== null) return;
    estado = leerEstado();
    renderAlimentos(); renderFavoritos(); renderProgreso();
    $("#perfil-zona").value = estado.zona;
  });
  document.addEventListener("allsumaq:sesion", (event) => {
    const user = event.detail?.user;
    const nextKey = user?.sub && /^\d+$/.test(user.sub) ? guestStorageKey + ":google:" + user.sub : guestStorageKey;
    if (nextKey === storageKey) return;
    storageKey = nextKey;
    estado = leerEstado();
    renderAlimentos(); renderFavoritos(); renderProgreso();
    $("#perfil-zona").value = estado.zona;
    $("#filtro-distrito").value = estado.zona;
    renderAlimentos();
    $("#registro-form").reset();
    $("#registro-fecha").value = hoy();
  });
  if ("IntersectionObserver" in window) {
    const observer = new IntersectionObserver(() => {
      if (dialog.open) return;
      const line = window.innerHeight * .35;
      const visibles = $$(".observed-section").filter((s) => s.getBoundingClientRect().top <= line && s.getBoundingClientRect().bottom > line);
      if (visibles.length) marcarSeccion(visibles[0].id);
    }, { rootMargin: "-20% 0px -45% 0px", threshold: [0, .1, .5, 1] });
    $$(".observed-section").forEach((s) => observer.observe(s));
  }
  inicializar();
}());
