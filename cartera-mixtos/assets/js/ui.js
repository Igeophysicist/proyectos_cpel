/**
 * ui.js
 * Renderizado de todas las piezas de interfaz que no son mapa ni charts:
 * KPIs, lista/tarjetas de proyectos, panel de detalle y hoja de filtros.
 */
(function (global) {
  const GRUPO_INFO = global.AppData.GRUPO_INFO;
  const { esc } = global.TextUtils;
  const fmtInt = new Intl.NumberFormat("es-MX", { maximumFractionDigits: 0 });
  // CAPEX en millones de dólares, con comas en los miles: "8,112.9 M"
  // (la moneda va en el título de la tarjeta).
  const fmtMillones = new Intl.NumberFormat("es-MX", { minimumFractionDigits: 1, maximumFractionDigits: 1 });

  // ---------------------------------------------------------------- KPIs
  function renderKPIs(elId, projects) {
    const total = projects.length;
    const geolocalizados = projects.filter((p) => p.geo).length;
    // Sin los proyectos de 2da ronda (ver kpis.js).
    const { capacidad: capacidadTotal, capex: capexTotal, avancePromedio, excluidos } = global.AppKpis.totales(projects);
    const sinRonda = excluidos ? " (sin 2da ronda)" : "";
    const enRiesgo = projects.filter((p) => p.grupo === "C").length;

    const cards = [
      { label: "Proyectos", value: fmtInt.format(total), meta: `${geolocalizados} de ${total} en mapa`, cls: "" },
      {
        label: "Capacidad total",
        value: capacidadTotal ? `${fmtInt.format(capacidadTotal)} MW` : "—",
        meta: "Suma reportada" + sinRonda,
        cls: "accent",
      },
      {
        label: "CAPEX total (USD)",
        value: capexTotal ? `${fmtMillones.format(capexTotal / 1e6)} M` : "—",
        meta: "Suma reportada" + sinRonda,
        cls: "accent",
      },
      {
        label: "Avance global promedio",
        value: avancePromedio !== null ? `${avancePromedio.toFixed(1)}%` : "—",
        meta: "Trámites y permisos" + sinRonda,
        cls: "",
      },
      {
        label: "Proyectos en Grupo C",
        value: fmtInt.format(enRiesgo),
        meta: `Parque menor a ${global.AppGrupo.LIMITES.B}%`,
        cls: "risk",
      },
    ];

    document.getElementById(elId).innerHTML = cards
      .map(
        (c) => `
      <div class="kpi ${c.cls ? "kpi--" + c.cls : ""}">
        <div class="kpi__label">${c.label}</div>
        <div class="kpi__value tabular">${c.value}</div>
        <div class="kpi__meta">${c.meta}</div>
      </div>`
      )
      .join("");
  }

  // --------------------------------------------------------- Lista/tarjetas
  function progressRow(label, pct) {
    if (pct === null || pct === undefined) return "";
    // "--pct" (en vez de un "width" fijo) es lo que permite que la barra
    // se anime creciendo desde 0 al pintarse (ver @keyframes bar-grow en
    // styles.css) en lugar de aparecer ya llena.
    return `
      <div class="pbar">
        <span class="pbar__label">${esc(label)}</span>
        <span class="pbar__track"><span class="pbar__fill" style="--pct:${Math.min(pct, 100)}%"></span></span>
        <span class="pbar__val tabular">${pct}%</span>
      </div>`;
  }

  const EVO_ICON = `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M3 3v18h18" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/><path d="M7 15l4-4 3 3 6-7" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
  const tieneEvolucion = (p) => global.AppEvolucion && global.AppEvolucion.tieneDatos(p);

  const PRIO_CHIP = `<span class="prio-chip">★ Prioritario</span>`;

  // ------------------------------------------------ Trámites (ficha y Resumen)
  const fmtPct = (v) => (v === null || v === undefined ? "—" : `${Math.round(v * 10) / 10}%`);
  const estadoTramite = (v) => (v === null ? "" : v >= 100 ? "ok" : v <= 0 ? "cero" : "medio");

  /** Barra pequeña de un avance (0–100) con su número. */
  function miniBarra(v, etiqueta) {
    const pct = v === null ? 0 : Math.max(0, Math.min(v, 100));
    return `<span class="tram-bar tram-bar--${estadoTramite(v)}" title="${esc(etiqueta)}: ${fmtPct(v)}">
        <span class="tram-bar__track"><span class="tram-bar__fill" style="--pct:${pct}%"></span></span>
        <span class="tram-bar__val tabular">${fmtPct(v)}</span>
      </span>`;
  }

  /**
   * Filas de trámites agrupadas como en el Excel (Derechos inmobiliarios,
   * Interconexión, Ambientales, Social, Dependencias). Los que cuentan
   * igual para Parque y LT ocupan las dos columnas.
   */
  function filasTramites(items, { conPeso = true } = {}) {
    let grupo = null;
    return items
      .map((t) => {
        const encabezado = t.grupo !== grupo && t.grupo !== t.nombre ? `<li class="tram-grupo">${esc(t.grupo)}</li>` : "";
        grupo = t.grupo;
        const peso = conPeso ? `<span class="tram-peso">${t.peso}%</span>` : "";
        const barras = t.compartido
          ? `<span class="tram-ambos">${miniBarra(t.avParque, "Parque y LT")}</span>`
          : `${miniBarra(t.avParque, "Parque")}${miniBarra(t.avLt, "LT")}`;
        return `${encabezado}<li class="tram-row"><span class="tram-name">${esc(t.nombre)}${peso}</span>${barras}</li>`;
      })
      .join("");
  }

  function seccionTramites(p) {
    const T = global.AppTramites;
    if (!T || !p.tramites) return "";
    const falta = (lado) => {
      const lista = T.faltantes(p.tramites, lado).slice(0, 4);
      if (!lista.length) return "completo";
      const total = T.faltantes(p.tramites, lado).reduce((s, f) => s + f.pts, 0);
      return `faltan ${Math.round(total * 10) / 10} pts: ` + lista.map((f) => `${esc(f.nombre)} ${Math.round(f.pts * 10) / 10}`).join(" · ");
    };
    return `
      <div class="detail__section-title">Trámites y permisos</div>
      <div class="tram-head" aria-hidden="true"><span>Trámite (peso)</span><span>Parque</span><span>LT</span></div>
      <ul class="tram-list">${filasTramites(p.tramites)}</ul>
      <div class="tram-falta"><b>Parque</b> ${falta("parque")}</div>
      <div class="tram-falta"><b>LT</b> ${falta("lt")}</div>`;
  }

  function projectCardHtml(p) {
    const grupoInfo = GRUPO_INFO[p.grupo];
    return `
      <div class="pcard${p.prioritario ? " pcard--prio" : ""}${p.geo ? "" : " pcard--nogeo"}" data-id="${esc(p.id)}">
        <div class="pcard__top">
          <div>
            <h2 class="pcard__title"><button type="button" class="pcard__open" data-id="${esc(p.id)}">${esc(p.nombre)}</button></h2>
            <div class="pcard__sub">${esc([p.socio, p.ubicacion].filter(Boolean).join(" · "))}</div>
          </div>
          <div class="pcard__side">
            ${p.prioritario ? PRIO_CHIP : ""}
            ${grupoInfo ? `<span class="badge badge--${grupoInfo.css}">${grupoInfo.label}</span>` : ""}
            ${tieneEvolucion(p) ? `<button type="button" class="evo-btn" data-evolucion="${esc(p.id)}" aria-label="Evolución por corte de ${esc(p.nombre)}">${EVO_ICON}Evolución</button>` : ""}
          </div>
        </div>
        <div class="pcard__meta">
          ${p.tecnologia ? `<span><b>${esc(p.tecnologia)}</b></span>` : ""}
          ${p.capacidad ? `<span>${esc(p.capacidad)}</span>` : ""}
          ${p.capex ? `<span>${esc(p.capex)}</span>` : ""}
        </div>
        <div class="pcard__bars">
          ${progressRow("Parque", p.parquePct)}
          ${progressRow("LT", p.ltPct)}
          ${progressRow("Global", p.globalPct)}
        </div>
        ${!p.geo ? `<div class="geo-flag">Sin ubicación vinculada en el KML</div>` : ""}
      </div>`;
  }

  function renderProjectList(elId, countElId, projects, onSelect, onEvolucion) {
    const container = document.getElementById(elId);
    document.getElementById(countElId).textContent = `${projects.length} proyecto${
      projects.length === 1 ? "" : "s"
    }`;

    if (!projects.length) {
      container.innerHTML = `
        <div class="empty-state">
          <div class="empty-state__title">Sin resultados</div>
          <div>Ajusta o limpia los filtros para ver proyectos.</div>
        </div>`;
      return;
    }

    container.innerHTML = projects.map(projectCardHtml).join("");
    // El nombre es el botón que abre la ficha; cubre toda la tarjeta (ver
    // .pcard__open::after en styles.css), así que se puede tocar en
    // cualquier parte. "Evolución" es otro botón, encima, que abre su panel.
    container.querySelectorAll(".pcard__open").forEach((btn) => {
      btn.addEventListener("click", () => onSelect(btn.getAttribute("data-id")));
    });
    container.querySelectorAll("[data-evolucion]").forEach((btn) => {
      btn.addEventListener("click", () => onEvolucion(btn.getAttribute("data-evolucion")));
    });
  }

  // ------------------------------------------------------------ Detalle
  const DETAIL_FIELDS = [
    { section: "Datos generales", items: [
      ["socio", "Socio"], ["tecnologia", "Tecnología"], ["ubicacion", "Ubicación"], ["capacidad", "Capacidad"],
    ]},
    { section: "Almacenamiento", items: [
      ["bess", "Almacenamiento (BESS)"], ["horasAlmacenamiento", "Horas de almacenamiento"],
    ]},
    { section: "Programa", items: [
      ["inicioInversion", "Inicio de inversión"], ["finConstruccion", "COD"], ["firmaContrato", "Firma de contrato"],
    ]},
    { section: "Financiero", items: [
      ["capex", "CAPEX (USD)"],
    ]},
  ];

  function detailField(p, key, label) {
    const value = p[key];
    if (value === null || value === undefined || value === "") return "";
    return `<div><div class="detail-field__label">${esc(label)}</div><div class="detail-field__value">${esc(value)}</div></div>`;
  }

  function renderDetail(elId, p) {
    const grupoInfo = GRUPO_INFO[p.grupo];
    const acciones = [
      p.geo ? `<button class="detail__mapbtn" data-view-on-map="${esc(p.id)}">Ver en el mapa</button>` : "",
      tieneEvolucion(p) ? `<button class="detail__mapbtn" data-open-evolucion>${EVO_ICON}Evolución</button>` : "",
    ].join("");
    const sections = DETAIL_FIELDS.map((sec) => {
      const fields = sec.items.map(([key, label]) => detailField(p, key, label)).filter(Boolean).join("");
      return fields ? `<div class="detail__section-title">${sec.section}</div><div class="detail-grid">${fields}</div>` : "";
    }).join("");

    document.getElementById(elId).innerHTML = `
      <div class="detail__head">
        <button class="detail__close" data-close-detail aria-label="Cerrar">&times;</button>
        ${grupoInfo ? `<span class="detail__badge badge--${grupoInfo.css}">${grupoInfo.label}</span>` : ""}
        ${p.prioritario ? `<span class="detail__badge detail__badge--prio">★ Prioritario</span>` : ""}
        <div class="detail__title" id="detail-title">${esc(p.nombre)}</div>
        <div class="detail__sub">${esc([p.socio, p.ubicacion].filter(Boolean).join(" · "))}</div>
      </div>
      <div class="detail__body">
        <div class="detail__section-title">Avance</div>
        <div class="detail-progress">
          ${progressRow("Parque", p.parquePct)}
          ${progressRow("LT", p.ltPct)}
          ${progressRow("Global", p.globalPct)}
        </div>
        ${acciones ? `<div class="detail__actions">${acciones}</div>` : ""}
        ${seccionTramites(p)}
        ${sections}
      </div>`;
  }

  // ------------------------------------------------------------ Filtros
  function renderFilterOptions(elId, options, state, onToggle) {
    const LABELS = {
      prioridad: "Prioridad",
      tecnologia: "Tecnología",
      estado: "Estado",
      socio: "Socio",
      grupo: "Grupo de atención",
      codAnio: "Año de COD",
    };
    const VALUE_LABELS = {
      grupo: { A: "Grupo A", B: "Grupo B", C: "Grupo C" },
      prioridad: { P: "★ Prioritario", NoP: "No prioritario" },
    };

    const groups = Object.keys(options).map((field) => {
      const chips = options[field]
        .map((value) => {
          const active = state[field].has(value);
          const text = (VALUE_LABELS[field] || {})[value] || value;
          return `<button class="chip ${active ? "is-active" : ""}" data-field="${esc(field)}" data-value="${esc(value)}" aria-pressed="${active}">${esc(text)}</button>`;
        })
        .join("");
      return `
        <div class="filter-group">
          <div class="filter-group__title">${esc(LABELS[field] || field)}</div>
          <div class="chip-row">${chips}</div>
        </div>`;
    });

    document.getElementById(elId).innerHTML = groups.join("");
    document.getElementById(elId).querySelectorAll(".chip").forEach((chip) => {
      chip.addEventListener("click", () => {
        onToggle(chip.getAttribute("data-field"), chip.getAttribute("data-value"));
      });
    });
  }

  function showToast(elId, message) {
    const el = document.getElementById(elId);
    el.textContent = message;
    el.classList.add("is-visible");
    clearTimeout(el._t);
    el._t = setTimeout(() => el.classList.remove("is-visible"), 4000);
  }

  /**
   * Resumen: avance promedio de cada trámite entre los proyectos mostrados,
   * del más rezagado (más puntos ponderados pendientes) al más avanzado.
   */
  function renderTramitesResumen(sectionId, listId, hintId, projects) {
    const T = global.AppTramites;
    const section = document.getElementById(sectionId);
    const conDatos = T ? projects.filter((p) => p.tramites) : [];
    section.hidden = !conDatos.length;
    if (!conDatos.length) return;
    const pendiente = (t) => t.peso * (100 - (t.avParque ?? 100)) * T.PESO_GLOBAL.parque + t.peso * (100 - (t.avLt ?? 100)) * T.PESO_GLOBAL.lt;
    const items = T.promedios(conDatos.map((p) => p.tramites)).sort((a, b) => pendiente(b) - pendiente(a));
    document.getElementById(listId).innerHTML = items
      .map((t) => {
        const barras = t.compartido
          ? `<span class="tram-ambos">${miniBarra(t.avParque, "Parque y LT")}</span>`
          : `${miniBarra(t.avParque, "Parque")}${miniBarra(t.avLt, "LT")}`;
        return `<li class="tram-row"><span class="tram-name">${esc(t.nombre)}<span class="tram-peso">${t.peso}%</span></span>${barras}</li>`;
      })
      .join("");
    document.getElementById(hintId).textContent = `promedio de ${conDatos.length} proyecto${conDatos.length === 1 ? "" : "s"}`;
  }

  global.AppUI = { renderKPIs, renderProjectList, renderDetail, renderFilterOptions, renderTramitesResumen, showToast };
})(window);
