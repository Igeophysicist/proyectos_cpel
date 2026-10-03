/**
 * url-state.js
 * Guarda en la dirección de la página lo que se está viendo, para poder
 * compartir un enlace que abra exactamente esa vista:
 *
 *   ?proyecto=san-simon-solar          ficha de un proyecto abierta
 *   &q=solar                            texto de búsqueda
 *   &tecnologia=FV%20-%20Fotovoltaica   filtros (se repiten si hay varios)
 *   &estado=…&socio=…&grupo=A&cod=2029
 *   &tab=mapa                           pestaña (en celular)
 *   &orden=global                       orden del listado (ver orden.js)
 *
 * El proyecto se identifica por su nombre ("TÍTULO 2"/"TÍTULO 1")
 * convertido con TextUtils.slugify, no por su posición en el Excel, así
 * el enlace sigue sirviendo aunque se agreguen o reordenen filas.
 *
 * Expone: window.AppUrlState.read(), window.AppUrlState.write(view)
 */
(function (global) {
  // Campo de filtro en filters.js -> nombre del parámetro en la dirección.
  const FILTER_PARAMS = {
    tecnologia: "tecnologia",
    estado: "estado",
    socio: "socio",
    grupo: "grupo",
    codAnio: "cod",
  };
  const TABS = ["proyectos", "mapa", "resumen"];

  /** Lee la vista pedida en la dirección actual. */
  function read() {
    const params = new URLSearchParams(global.location.search);
    const filters = {};
    Object.entries(FILTER_PARAMS).forEach(([field, param]) => {
      const values = params.getAll(param).filter(Boolean);
      if (values.length) filters[field] = values;
    });
    const tab = params.get("tab");
    return {
      search: params.get("q") || "",
      filters,
      tab: TABS.includes(tab) ? tab : null,
      proyecto: params.get("proyecto") || null,
      orden: params.get("orden") || null,
    };
  }

  /**
   * Escribe la vista en la dirección sin agregar entradas al historial
   * (el botón "atrás" sigue saliendo de la página, como antes).
   * view = { search, state (AppFilters.state), tab, proyecto, orden }
   */
  function write({ search, state, tab, proyecto, orden }) {
    const params = new URLSearchParams();
    if (proyecto) params.set("proyecto", proyecto);
    if (search && search.trim()) params.set("q", search.trim());
    Object.entries(FILTER_PARAMS).forEach(([field, param]) => {
      (state[field] ? Array.from(state[field]) : []).forEach((v) => params.append(param, v));
    });
    if (tab && tab !== TABS[0]) params.set("tab", tab);
    if (orden && orden !== "excel") params.set("orden", orden);
    const query = params.toString();
    const url = global.location.pathname + (query ? "?" + query : "") + global.location.hash;
    global.history.replaceState(null, "", url);
  }

  global.AppUrlState = { read, write };
})(window);
