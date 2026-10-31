// Reglas compartidas: se mantienen separadas de la presentación para verificarlas.
(function () {
  "use strict";
  const normalizar = (texto) => String(texto || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLocaleLowerCase("es");
  const precioComparable = (item) => item.precioTipo !== "persona" && Number.isFinite(item.precioMax);

  function filtrar(alimentos, filtros) {
    const consulta = normalizar(filtros.consulta).trim();
    const maximo = Number(filtros.presupuesto) || 0;
    const resultados = alimentos.filter((a) => {
      const texto = normalizar([a.nombre, a.establecimiento, ...a.distritos].join(" "));
      return (!consulta || texto.includes(consulta)) &&
        (!filtros.distrito || a.distritos.includes(filtros.distrito)) &&
        (!maximo || (precioComparable(a) && a.precioMax <= maximo));
    });
    if (filtros.orden === "precio") {
      resultados.sort((a, b) => (precioComparable(a) ? a.precioMax : Infinity) - (precioComparable(b) ? b.precioMax : Infinity));
    } else if (filtros.orden === "nombre") {
      resultados.sort((a, b) => a.nombre.localeCompare(b.nombre, "es"));
    }
    return resultados;
  }

  function validarRegistro(datos, elementos, hoy) {
    const errores = {};
    if (!elementos.some((e) => e.id === datos.elemento)) errores.elemento = "Selecciona un alimento o una bebida del catálogo.";
    if (!/^\d{4}-\d{2}-\d{2}$/.test(datos.fecha || "")) errores.fecha = "Selecciona una fecha válida.";
    else {
      const fecha = new Date(datos.fecha + "T12:00:00Z");
      if (Number.isNaN(fecha.getTime()) || fecha.toISOString().slice(0, 10) !== datos.fecha) errores.fecha = "La fecha indicada no existe.";
      else if (datos.fecha > hoy) errores.fecha = "Elige hoy o una fecha anterior para un consumo realizado.";
    }
    if (!["Desayuno", "Almuerzo", "Cena", "Refrigerio"].includes(datos.momento)) errores.momento = "Selecciona el momento del consumo.";
    if (String(datos.notas || "").length > 200) errores.notas = "Escribe un máximo de 200 caracteres.";
    return errores;
  }

  function resumir(registros, inicio, fin) {
    const entradas = registros.filter((r) => r.fecha >= inicio && r.fecha <= fin);
    return { entradas, total: entradas.length, dias: new Set(entradas.map((r) => r.fecha)).size,
      comidas: entradas.filter((r) => r.tipo !== "bebida").length,
      bebidas: entradas.filter((r) => r.tipo === "bebida").length };
  }

  window.AllsumaqModelo = { normalizar, filtrar, validarRegistro, resumir, precioComparable };
}());
