/**
 * filters.js
 * Detecta campos filtrables a partir de los datos disponibles y aplica
 * el estado de filtros (búsqueda + chips de selección múltiple) sobre
 * el arreglo de proyectos.
 */
(function (global) {
  const state = {
    search: "",
    tecnologia: new Set(),
    grupo: new Set(),
    estado: new Set(),
    socio: new Set(),
    // Año de COD (Fin de Construcción). Chip de selección múltiple, igual
    // que tecnología/estado/socio/grupo.
    codAnio: new Set(),
  };

  function uniqueValues(projects, field) {
    const set = new Set();
    projects.forEach((p) => {
      if (p[field]) set.add(p[field]);
    });
    return Array.from(set).sort((a, b) => a.localeCompare(b, "es"));
  }

  /** Determina qué grupos de filtro mostrar según los datos reales disponibles */
  function buildFilterOptions(projects) {
    const options = {};
    const tecnologia = uniqueValues(projects, "tecnologia");
    const estado = uniqueValues(projects, "estado");
    const socio = uniqueValues(projects, "socio");
    const grupo = ["A", "B", "C"].filter((g) => projects.some((p) => p.grupo === g));
    // Orden cronológico (no alfabético) para los años de COD.
    const codAnio = uniqueValues(projects, "codAnio").sort();

    if (tecnologia.length > 1) options.tecnologia = tecnologia;
    if (estado.length > 1) options.estado = estado;
    if (socio.length > 1) options.socio = socio;
    if (grupo.length) options.grupo = grupo;
    if (codAnio.length > 1) options.codAnio = codAnio;

    return options;
  }

  function toggle(field, value) {
    const set = state[field];
    if (!set) return;
    if (set.has(value)) set.delete(value);
    else set.add(value);
  }

  function setSearch(value) {
    state.search = normalize(value);
  }

  function normalize(str) {
    return (str || "")
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .trim();
  }

  function clearAll() {
    state.search = "";
    state.tecnologia.clear();
    state.grupo.clear();
    state.estado.clear();
    state.socio.clear();
    state.codAnio.clear();
  }

  function activeCount() {
    return (
      state.tecnologia.size +
      state.grupo.size +
      state.estado.size +
      state.socio.size +
      state.codAnio.size +
      (state.search ? 1 : 0)
    );
  }

  function matchesSearch(project) {
    if (!state.search) return true;
    const haystack = normalize(
      [project.nombre, project.socio, project.ubicacion, project.tecnologia].join(" ")
    );
    return haystack.includes(state.search);
  }

  function apply(projects) {
    return projects.filter((p) => {
      if (!matchesSearch(p)) return false;
      if (state.tecnologia.size && !state.tecnologia.has(p.tecnologia)) return false;
      if (state.grupo.size && !state.grupo.has(p.grupo)) return false;
      if (state.estado.size && !state.estado.has(p.estado)) return false;
      if (state.socio.size && !state.socio.has(p.socio)) return false;
      if (state.codAnio.size && !state.codAnio.has(p.codAnio)) return false;
      return true;
    });
  }

  global.AppFilters = {
    state,
    buildFilterOptions,
    toggle,
    setSearch,
    clearAll,
    activeCount,
    apply,
  };
})(window);
