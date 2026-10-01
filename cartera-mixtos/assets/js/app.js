/**
 * app.js
 * Orquesta la carga de datos y conecta filtros, mapa, gráficos, lista
 * y panel de detalle. Es el único archivo que conoce la aplicación
 * completa; los demás módulos son independientes entre sí.
 *
 * Requiere: shared/text-utils.js, shared/dialog.js y el resto de
 * módulos de assets/js (data, map, charts, filters, ui).
 */
(function () {
  let allProjects = [];
  let projectsById = new Map();

  const els = {
    loader: document.getElementById("loader"),
    loaderText: document.getElementById("loader-text"),
    search: document.getElementById("search-input"),
    filterBtn: document.getElementById("filter-btn"),
    filterCount: document.getElementById("filter-count"),
    filters: document.getElementById("filters"),
    filterOptions: document.getElementById("filter-options"),
    filterClear: document.getElementById("filter-clear"),
    filterApply: document.getElementById("filter-apply"),
    detail: document.getElementById("detail"),
    detailBody: document.getElementById("detail-body"),
    mapEmpty: document.getElementById("map-empty"),
    tabbarBtns: Array.from(document.querySelectorAll(".tabbar__btn")),
    toast: document.getElementById("toast"),
    rankingHint: document.getElementById("ranking-hint"),
  };

  // Espera tras la última tecla antes de volver a filtrar y redibujar
  // (gráficas, mapa y lista se reconstruyen en cada render).
  const SEARCH_DEBOUNCE_MS = 150;

  function render() {
    const filtered = window.AppFilters.apply(allProjects);

    window.AppUI.renderKPIs("kpis", filtered);
    window.AppCharts.renderGrupoChart("chart-grupo", filtered);
    window.AppCharts.renderTecnologiaChart("chart-tecnologia", filtered);
    window.AppCharts.renderRanking("ranking", filtered, openDetail);
    window.AppUI.renderProjectList("project-list", "list-count", filtered, openDetail);
    window.AppMap.renderProjects(filtered);

    const geoCount = filtered.filter((p) => p.geo).length;
    els.mapEmpty.style.display = geoCount === 0 ? "block" : "none";
    els.mapEmpty.textContent =
      geoCount === 0
        ? "Ningún proyecto filtrado tiene ubicación vinculada en el KML."
        : "";

    const count = window.AppFilters.activeCount();
    els.filterCount.textContent = count;
    els.filterCount.style.display = count ? "inline-flex" : "none";
  }

  function openDetail(projectId) {
    const project = projectsById.get(projectId);
    if (!project) return;
    window.AppUI.renderDetail("detail-body", project);
    window.Dialog.open(els.detail);

    const mapBtn = els.detailBody.querySelector("[data-view-on-map]");
    if (mapBtn) {
      mapBtn.addEventListener("click", () => {
        closeDetail();
        switchTab("mapa");
        setTimeout(() => window.AppMap.highlight(projectId), 250);
      });
    }
  }

  function closeDetail() {
    window.Dialog.close(els.detail);
  }

  /** Redibuja los chips de filtro; "focus" = {field, value} a re-enfocar. */
  function renderFilters(focus) {
    window.AppUI.renderFilterOptions(
      "filter-options",
      window.AppFilters.buildFilterOptions(allProjects),
      window.AppFilters.state,
      (field, value) => {
        window.AppFilters.toggle(field, value);
        renderFilters({ field, value }); // chips con el nuevo estado activo
        render();
      }
    );
    // Al redibujar se pierde el chip enfocado; se recupera para que quien
    // usa teclado no salga despedido al inicio de la página.
    if (focus) {
      const chip = Array.from(els.filterOptions.querySelectorAll(".chip")).find(
        (c) => c.dataset.field === focus.field && c.dataset.value === focus.value
      );
      if (chip) chip.focus();
    }
  }

  function openFilters() {
    renderFilters();
    window.Dialog.open(els.filters);
  }

  function closeFilters() {
    window.Dialog.close(els.filters);
  }

  function switchTab(name) {
    document.querySelectorAll(".tabgroup").forEach((el) => el.classList.remove("is-active"));
    document.getElementById("group-" + name).classList.add("is-active");
    els.tabbarBtns.forEach((btn) => btn.classList.toggle("is-active", btn.dataset.tab === name));
    if (name === "mapa") {
      setTimeout(() => window.AppMap.refit(), 50);
    }
  }

  function wireEvents() {
    const renderDebounced = window.TextUtils.debounce(render, SEARCH_DEBOUNCE_MS);
    els.search.addEventListener("input", (e) => {
      window.AppFilters.setSearch(e.target.value);
      renderDebounced();
    });

    els.filterBtn.addEventListener("click", openFilters);
    els.filters.querySelector(".filters__scrim").addEventListener("click", closeFilters);
    els.filterApply.addEventListener("click", closeFilters);
    els.filterClear.addEventListener("click", () => {
      window.AppFilters.clearAll();
      els.search.value = "";
      renderFilters();
      render();
    });

    els.detail.querySelector(".detail__scrim").addEventListener("click", closeDetail);
    els.detailBody.addEventListener("click", (e) => {
      if (e.target.closest("[data-close-detail]")) closeDetail();
    });

    els.tabbarBtns.forEach((btn) => {
      btn.addEventListener("click", () => switchTab(btn.dataset.tab));
    });

    window.AppMap.setOnMarkerSelect(openDetail);

    window.addEventListener("resize", () => window.AppMap.invalidateSize());
  }

  async function bootstrap() {
    try {
      els.rankingHint.textContent = `Top ${window.AppCharts.RANKING_TOP_N}`;
      window.AppMap.initMap("map");
      wireEvents();

      const { projects, warnings } = await window.AppData.loadDataset();
      allProjects = projects;
      projectsById = new Map(projects.map((p) => [p.id, p]));

      render();
      els.loader.classList.add("is-hidden");
      // Asegura un encuadre correcto también en escritorio (el mapa ya es
      // visible desde el inicio ahí, pero por si el layout se asienta
      // después de la primera pintura).
      setTimeout(() => window.AppMap.refit(), 100);

      // Los avisos de vinculación quedan en la consola para diagnóstico;
      // el toast visible sigue desactivado a propósito.
      if (warnings.length) {
        console.warn("Avisos de vinculación Excel ↔ KML:\n" + warnings.join("\n"));
      }
      //if (warnings.length) {
      //  window.AppUI.showToast(
      //    "toast",
      //    `${warnings.length} proyecto(s) sin vínculo geográfico exacto. Ver consola para detalle.`
      //  );
      //}
    } catch (err) {
      console.error(err);
      els.loaderText.textContent =
        "No se pudieron cargar los datos. Verifica que data/DATOS_MIXTOS.xlsx y los KML estén publicados junto a este HTML. Detalle: " +
        err.message;
    }
  }

  document.addEventListener("DOMContentLoaded", bootstrap);
})();
