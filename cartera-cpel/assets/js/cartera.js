/**
 * cartera.js
 * Lee data/datos_proyectos.xlsx (primera hoja) y pinta la ficha del
 * proyecto seleccionado. Las columnas del Excel son las mismas que ya
 * usabas; no hace falta cambiar el archivo.
 *
 * FICHA TÉCNICA POR TECNOLOGÍA
 * ---------------------------------------------------------------
 * La Ficha técnica ya no es una sola lista fija: se elige según el
 * texto de la columna "tecnologia" de cada proyecto. TECH_SPECS (abajo)
 * es el catálogo de tecnologías conocidas — cada una con su propio
 * prefijo de columna en el Excel y su propio agrupamiento de campos:
 *   - Fotovoltaica   → columnas que empiezan con "ft_"
 *   - Hidroeléctrica → columnas que empiezan con "ht_"
 * "match" detecta la tecnología buscando una palabra clave dentro del
 * texto de la celda (sin importar mayúsculas ni el resto de la frase),
 * así "Fotovoltaico", "Solar Fotovoltaica", "Equipamiento
 * Hidroeléctrico" o "Hidroeléctrica" caen todas en su grupo correcto
 * sin tener que escribir el texto exacto en el Excel.
 *
 * Para agregar una tecnología nueva (p. ej. eólica): 1) agrega sus
 * columnas al Excel con un prefijo propio (ej. "eo_"), 2) copia uno de
 * los bloques de TECH_SPECS de abajo, cambia "match" por la palabra
 * clave de esa tecnología y "campos" por sus columnas.
 *
 * Para agregar/quitar campos de los Avances particulares, edita la
 * lista PARTICULARES: cada entrada es [columna del Excel, etiqueta].
 */
(function () {
  const EXCEL_FILE_PATH = "data/datos_proyectos.xlsx";
  const IMAGEN_POR_DEFECTO = "";

  // Avances particulares: [sufijo de columna, etiqueta]. Lee prog<Sufijo> y real<Sufijo>.
  const PARTICULARES = [
    ["Ing", "INGENIERÍA"],
    ["Sum", "SUMINISTROS"],
    ["Cons", "CONSTRUCCIÓN"],
    ["Pps", "PUESTA EN SERVICIO"],
  ];

  // Catálogo de fichas técnicas por tecnología. Se evalúan en orden y
  // se usa la primera cuyo "match" encuentre la palabra clave dentro de
  // la columna "tecnologia" del proyecto.
  const TECH_SPECS = [
    {
      match: (tecnologia) => /fotovolt/i.test(tecnologia),
      grupos: [
        {
          grupo: "Generales",
          campos: [
            ["ft_potencia", "Potencia [MWac]"],
            ["ft_factor_planta", "Factor de planta [%]"],
            ["ft_factor_rend", "Factor de rendimiento [%]"],
            ["ft_irradiacion", "Irradiación horizontal [kWh/m², día]"],
            ["ft_area", "Área [ha]"],
            ["ft_densidad", "Densidad de potencia [MW/ha]"],
          ],
        },
        {
          grupo: "Módulos fotovoltaicos",
          campos: [
            ["ft_mod_tipo", "Tipo de módulos"],
            ["ft_mod_capacidad", "Capacidad por módulo [Wp]"],
            ["ft_mod_eficiencia", "Eficiencia del módulo [%]"],
            ["ft_mod_cantidad", "Cantidad de módulos [uds]"],
          ],
        },
        {
          grupo: "Inversores",
          campos: [
            ["ft_inv_capacidad", "Capacidad [MVA]"],
            ["ft_inv_tipo", "Tipo"],
          ],
        },
        {
          grupo: "Estructura",
          campos: [["ft_estructura", "Tipo de estructura"]],
        },
        {
          grupo: "Almacenamiento (SAE)",
          campos: [["ft_sae", "30% [MWac] / 3 hr respaldo [MWh]"]],
        },
      ],
    },
    {
      match: (tecnologia) => /hidro/i.test(tecnologia),
      grupos: [
        {
          grupo: "Generales",
          campos: [
            ["ht_potencia", "Potencia instalada [MW]"],
            ["ht_generacion_media", "Generación media anual [GWh]"],
            ["ht_factor_planta", "Factor de planta [%]"],
          ],
        },
        {
          grupo: "Casa de máquinas",
          campos: [
            ["ht_num_unidades", "Número de unidades"],
            ["ht_tipo_turbina", "Tipo de turbina"],
            ["ht_caida_neta", "Caída neta [m]"],
            ["ht_caudal_diseno", "Caudal de diseño [m³/s]"],
          ],
        },
        {
          grupo: "Obra civil (cortina)",
          campos: [
            ["ht_tipo_cortina", "Tipo de cortina/presa"],
            ["ht_altura_cortina", "Altura de la cortina [m]"],
          ],
        },
        {
          grupo: "Embalse",
          campos: [
            ["ht_volumen_embalse", "Volumen del embalse [Mm³]"],
            ["ht_area_cuenca", "Área de la cuenca [km²]"],
          ],
        },
      ],
    },
  ];

  /** Devuelve el catálogo de campos de Ficha técnica para un proyecto */
  function fichaParaProyecto(p) {
    const tecnologia = String(p.tecnologia || "");
    const encontrada = TECH_SPECS.find((t) => t.match(tecnologia));
    return encontrada ? encontrada.grupos : null;
  }

  // Fechas clave del cronograma (ventana Plazos)
  const PLAZOS_TIMELINE = [
    ["plazo_inicio_fecha", "Inicio"],
    ["plazo_pruebas_fecha", "Inicio de pruebas"],
    ["plazo_aceptacion_fecha", "Aceptación"],
    ["plazo_operacion_fecha", "Operación"],
  ];

  let proyectos = [];
  const $ = (id) => document.getElementById(id);

  // ---------------------------------------------------------- utilidades
  function esc(value) {
    return String(value ?? "")
      .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  }

  function texto(value, fallback = "—") {
    const s = String(value ?? "").trim();
    return s === "" ? fallback : s;
  }

  function pct(value) {
    const n = parseFloat(String(value ?? "").replace("%", ""));
    if (!Number.isFinite(n)) return 0;
    return Math.round(n * 10) / 10;
  }

  function setBar(barId, valId, value) {
    const v = pct(value);
    $(barId).style.width = Math.max(0, Math.min(v, 100)) + "%";
    $(valId).textContent = v + "%";
  }

  // ------------------------------------------------------------- carga
  async function cargarExcel() {
    try {
      const res = await fetch(EXCEL_FILE_PATH);
      if (!res.ok) throw new Error(`No se pudo cargar ${EXCEL_FILE_PATH} (HTTP ${res.status})`);
      const workbook = XLSX.read(await res.arrayBuffer(), { type: "array" });
      const hoja = workbook.Sheets[workbook.SheetNames[0]];
      proyectos = XLSX.utils
        .sheet_to_json(hoja, { defval: "" })
        .filter((p) => String(p.nombre || "").trim() !== ""); // descarta filas vacías

      if (!proyectos.length) throw new Error("El Excel no tiene proyectos.");
      poblarSelector();
      mostrarProyecto(proyectos[0]);
    } catch (err) {
      console.error(err);
      $("projectSelect").innerHTML = "<option>Error al cargar datos</option>";
      $("cartera").innerHTML = `<div class="state-msg">No se pudieron cargar los datos. Detalle: ${esc(err.message)}</div>`;
    }
  }

  function poblarSelector() {
    $("projectSelect").innerHTML = proyectos
      .map((p, i) => `<option value="${i}">${esc(p.nombre)}</option>`)
      .join("");
  }

  // ------------------------------------------------------------ render
  function mostrarProyecto(p) {
    // Encabezado
    const img = $("projectImg");
    img.src = p.imagen || IMAGEN_POR_DEFECTO;
    img.alt = texto(p.nombre, "");
    img.style.visibility = p.imagen ? "visible" : "hidden";
    $("projectName").textContent = texto(p.nombre, "Sin nombre");
    $("projectLocation").textContent = texto(p.ubicacion, "Sin ubicación");
    const tech = $("projectTech");
    tech.textContent = texto(p.tecnologia, "");
    tech.hidden = !String(p.tecnologia || "").trim();
    document.querySelectorAll("[data-project-name]").forEach((el) => (el.textContent = texto(p.nombre, "")));

    // Avance general
    setBar("progGenBar", "progGenVal", p.avanceProg);
    setBar("realGenBar", "realGenVal", p.avanceReal);
    const diff = Math.round((pct(p.avanceReal) - pct(p.avanceProg)) * 10) / 10;
    const variance = $("variance");
    variance.hidden = false;
    variance.className = "variance " + (diff >= 0 ? "variance--ok" : "variance--late");
    variance.textContent =
      diff >= 0 ? `Adelantado ${diff} pts respecto al programa` : `Atraso de ${Math.abs(diff)} pts respecto al programa`;

    // Avances particulares
    $("particularGrid").innerHTML = PARTICULARES.map(([key, label]) => {
      const pv = pct(p[`prog${key}`]);
      const rv = pct(p[`real${key}`]);
      return `
        <div class="particular">
          <div class="particular__title">${label}</div>
          <div class="mini-row">
            <span class="mini-row__tag mini-row__tag--prog">P</span>
            <div class="bar bar--mini"><span class="bar__fill bar__fill--prog" style="width:${Math.min(pv, 100)}%"></span></div>
            <span class="mini-row__val">${pv}%</span>
          </div>
          <div class="mini-row">
            <span class="mini-row__tag mini-row__tag--real">R</span>
            <div class="bar bar--mini"><span class="bar__fill bar__fill--real" style="width:${Math.min(rv, 100)}%"></span></div>
            <span class="mini-row__val">${rv}%</span>
          </div>
        </div>`;
    }).join("");

    // Hitos (1 a 4)
    const hitos = [];
    for (let i = 1; i <= 4; i++) {
      const num = String(p[`hito${i}_num`] ?? "").trim();
      const titulo = String(p[`hito${i}_titulo`] ?? "").trim();
      const encabezado = num ? `Hito ${num}` : titulo || `Hito ${i}`;
      hitos.push(`
        <div class="hito">
          <div class="hito__num">${esc(encabezado)}</div>
          <div class="hito__date">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none"><rect x="3" y="5" width="18" height="16" rx="2" stroke="currentColor" stroke-width="2.4"/><path d="M3 10h18" stroke="currentColor" stroke-width="2.4"/></svg>
            ${esc(texto(p[`hito${i}_fecha`], "--/--/----"))}
          </div>
          <div class="hito__desc">${esc(texto(p[`hito${i}_desc`], ""))}</div>
        </div>`);
    }
    $("hitosGrid").innerHTML = hitos.join("");

    // Información general
    $("devVal").textContent = texto(p.desarrollador);
    $("invVal").textContent = texto(p.inversion);
    $("srcVal").textContent = texto(p.fuenteRecursos);

    // Ficha técnica (según tecnología del proyecto)
    const grupos = fichaParaProyecto(p);
    $("fichaBody").innerHTML = grupos
      ? grupos.map(({ grupo, campos }) => `
      <div class="spec-group">
        <div class="spec-group__title">${grupo}</div>
        <table class="spec"><tbody>
          ${campos.map(([col, label]) => `
            <tr><td class="spec__name">${label}</td><td class="spec__val">${esc(texto(p[col]))}</td></tr>`).join("")}
        </tbody></table>
      </div>`).join("")
      : `<div class="state-msg">No hay una ficha técnica configurada para la tecnología "${esc(texto(p.tecnologia, "sin especificar"))}".</div>`;

    // Plazos
    $("plazosBody").innerHTML = `
      <div class="plazo-summary">
        <div class="plazo-summary__item">
          <div class="plazo-summary__label">Plazo de ejecución</div>
          <div class="plazo-summary__value">${esc(texto(p.plazo_dias))} días</div>
        </div>
        <div class="plazo-summary__item">
          <div class="plazo-summary__label">Firma de contrato</div>
          <div class="plazo-summary__value">${esc(texto(p.plazo_firmado))}</div>
        </div>
        <div class="plazo-summary__item plazo-summary__item--wide">
          <div class="plazo-summary__label">Contrato</div>
          <div class="plazo-summary__value">${esc(texto(p.plazo_contrato))}</div>
        </div>
      </div>
      <ul class="timeline">
        ${PLAZOS_TIMELINE.map(([col, label], i) => `
          <li class="${i === 0 ? "is-first" : ""}">
            <div class="timeline__label">${label}</div>
            <div class="timeline__date">${esc(texto(p[col]))}</div>
          </li>`).join("")}
      </ul>`;
  }

  // ----------------------------------------------------------- ventanas
  function abrir(id) {
    const el = $(id);
    el.classList.add("is-open");
    el.setAttribute("aria-hidden", "false");
  }

  function cerrarTodas() {
    document.querySelectorAll(".sheet.is-open").forEach((el) => {
      el.classList.remove("is-open");
      el.setAttribute("aria-hidden", "true");
    });
  }

  // ------------------------------------------------------------ eventos
  document.addEventListener("DOMContentLoaded", () => {
    $("projectSelect").addEventListener("change", (e) => {
      const p = proyectos[Number(e.target.value)];
      if (p) {
        mostrarProyecto(p);
        window.scrollTo({ top: 0, behavior: "smooth" });
      }
    });

    document.querySelectorAll("[data-open-sheet]").forEach((btn) =>
      btn.addEventListener("click", () => abrir(btn.dataset.openSheet))
    );
    document.addEventListener("click", (e) => {
      if (e.target.closest("[data-close-sheet]")) cerrarTodas();
    });
    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape") cerrarTodas();
    });

    cargarExcel();
  });
})();
