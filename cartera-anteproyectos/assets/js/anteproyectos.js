/**
 * anteproyectos.js
 * Ficha de cada anteproyecto. Los datos se editan en
 * data/datos_anteproyectos.xlsx; la página lee data/anteproyectos.json,
 * que genera y valida scripts/build-data.js (lectura en
 * scripts/anteproyectos.js).
 *
 * Tarjetas: 1) Presentación (PRES), 2) Descripción técnica (DESC),
 * 3) Red de Transmisión Propuesta (RTA), 4) Ficha técnica (FICHA_<tipo>,
 * en la ventana del botón), Plazos (PLAZOS, ventana con las etapas y su
 * estado según el mes de hoy) y 5) Avance (AVAN_<tipo>), en dos tarjetas:
 * Avance General (con la NOTA TOTAL) y Avances particulares ("1. …",
 * "2. …"), que abren una ventana con sus avances ponderados ("1.1 …").
 * En pantalla el orden es: presentación, avances, descripción, RTA y
 * mapa. Los campos de cada
 * hoja se pintan tal como vienen: si el Excel agrega o quita columnas, la
 * página cambia sola.
 *
 * Avance: se muestran los porcentajes del Excel sin recalcular. Mientras
 * no haya programado capturado (todo en 0), solo se muestra el Real.
 *
 * Reutiliza de Cartera CPEL el mapa (map.js), la curva de avance
 * (curva.js, con data/historial.json) y el PDF (pdf.js).
 *
 * Requiere: shared/text-utils.js, shared/dialog.js y los tres archivos de
 * Cartera CPEL mencionados.
 */
(function () {
  const DATA_FILE_PATH = "data/anteproyectos.json";
  const KML_FILE_PATH = "data/ANTEPROYECTOS.kml";

  const { esc, slugify, formatDateShort, normalizeText, textoHtml } = window.TextUtils;
  const $ = (id) => document.getElementById(id);

  let proyectos = [];
  let actual = null;

  /** "Nivel de Tensión [kV]" -> { nombre: "Nivel de Tensión", unidad: "kV" }. */
  function separarUnidad(campo) {
    const m = /^(.*?)\s*\[(.+?)\]\s*$/.exec(campo || "");
    return m ? { nombre: m[1], unidad: m[2].trim() } : { nombre: campo || "", unidad: "" };
  }

  /** "DESCRIPCIÓN TÉCNICA" -> "Descripción técnica" (encabezados en mayúsculas). */
  const oracion = (t) => (t && t === t.toUpperCase() ? t.charAt(0) + t.slice(1).toLowerCase() : t);

  // ------------------------------------------------------------ avance
  // Barra de Real con la marca del Programado y semáforo (ver
  // ../cartera-cpel/assets/js/avance.js, el mismo de Cartera CPEL).
  const A = window.CarteraAvance;

  // Notas: la tarjeta que tiene nota lleva el ícono de comentario y, al
  // tocarla, abre la ventana "Notas" (como los trámites de Mixtos).
  const NOTA_ICON = `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M4 5h16v11H9l-5 4V5Z" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/></svg>`;
  const notaMarca = () => `<span class="nota-marca nota-marca--icono" title="Tiene notas" aria-hidden="true">${NOTA_ICON}</span>`;

  /** Avance general: Real, Programado (o "pendiente") y semáforo. La NOTA TOTAL va en la ventana Notas (y en el PDF). */
  function generalHtml(avance) {
    if (!avance || !avance.general) return `<div class="state-msg">Sin avance registrado para este anteproyecto.</div>`;
    const { general, programadoPendiente } = avance;
    return `
      ${A.generalHtml(general.real, general.prog, { pendiente: programadoPendiente })}
      ${programadoPendiente ? `<p class="av-pendiente">Programado: pendiente de captura.</p>` : ""}
      ${general.nota ? `<p class="nota-ayuda">Toca la tarjeta para ver las notas.</p><div class="print-only av-nota-pdf">${textoHtml(general.nota)}</div>` : ""}`;
  }

  /** Real y Programado de un avance, como en Avances particulares de Cartera CPEL. */
  const miniFilas = (x, pendiente) => A.miniHtml(x.real, x.prog, { pendiente, diferencia: true });

  /** Avances particulares ("1. …", "2. …"): un botón por cada uno. */
  function particularesHtml(avance) {
    if (!avance || !avance.grupos.length) return `<div class="state-msg">Sin avances particulares.</div>`;
    return avance.grupos
      .map(
        (g, i) => `
        <button type="button" class="particular particular--btn" data-grupo="${i}" aria-label="${esc(`${g.clave}. ${g.titulo}: ver avances ponderados`)}">
          <span class="particular__title"><b>${esc(g.clave)}.</b> ${esc(g.titulo)}</span>
          ${miniFilas(g, avance.programadoPendiente)}
          <span class="particular__mas">${g.items.length ? `Ver ${g.items.length} avance${g.items.length === 1 ? "" : "s"} ponderado${g.items.length === 1 ? "" : "s"}` : "Ver detalle"}${
            g.items.some((x) => x.nota) || g.nota ? ` <span class="particular__nota">${NOTA_ICON} con notas</span>` : ""
          }</span>
        </button>`
      )
      .join("");
  }

  /** Botón que cubre una tarjeta con nota y abre la ventana Notas. */
  const abrirNotaBtn = (clave, titulo) =>
    `<button type="button" class="card__abrir" data-nota="${esc(clave)}" aria-label="${esc(`${titulo}: ver notas`)}"></button>`;

  /** Ventana con los avances ponderados de un avance particular; los que tienen nota abren la ventana Notas. */
  function ponderadosHtml(g, pendiente) {
    return `
      <div class="pond-resumen${g.nota ? " pond--clic" : ""}">
        ${g.nota ? abrirNotaBtn(g.clave, `${g.clave}. ${g.titulo}`) : ""}
        ${g.nota ? `<div class="pond__titulo pond__titulo--resumen">Total del avance ${notaMarca()}</div>` : ""}
        ${miniFilas(g, pendiente)}
      </div>
      ${
        g.items.length
          ? `<ul class="pond-lista">${g.items
              .map(
                (x) => `
            <li class="pond${x.nota ? " pond--clic" : ""}">
              ${x.nota ? abrirNotaBtn(x.clave, `${x.clave} ${x.titulo}`) : ""}
              <div class="pond__titulo"><span><b>${esc(x.clave)}</b> ${esc(x.titulo)}</span>${x.nota ? notaMarca() : ""}</div>
              ${miniFilas(x, pendiente)}
            </li>`
              )
              .join("")}</ul>
            ${g.items.some((x) => x.nota) || g.nota ? `<p class="nota-ayuda">Toca un avance con ${NOTA_ICON} para ver su nota.</p>` : ""}`
          : `<div class="state-msg">Este avance no tiene avances ponderados.</div>`
      }`;
  }

  /** Avance (General, "1." o "1.1") por su clave. */
  function avancePorClave(clave) {
    const av = actual && actual.avance;
    if (!av) return null;
    if (clave === "general") return av.general ? { ...av.general, titulo: "Avance General" } : null;
    for (const g of av.grupos) {
      if (g.clave === clave) return { ...g, titulo: `${g.clave}. ${g.titulo}` };
      const x = g.items.find((i) => i.clave === clave);
      if (x) return { ...x, titulo: `${x.clave} ${x.titulo}` };
    }
    return null;
  }

  /** Ventana Notas: el avance (Real y Programado) y su nota. */
  function abrirNota(clave) {
    const x = avancePorClave(clave);
    if (!x || !x.nota) return;
    const pendiente = actual.avance.programadoPendiente;
    $("notaTitulo").textContent = x.titulo;
    $("notaBody").innerHTML = `
      <div class="nota-avance">${miniFilas(x, pendiente)}</div>
      <div class="nota-texto">${textoHtml(x.nota)}</div>`;
    window.Dialog.open($("sheetNota"));
  }

  function abrirPonderados(i) {
    const g = actual && actual.avance && actual.avance.grupos[i];
    if (!g) return;
    $("ponderadoTitulo").textContent = `${g.clave}. ${g.titulo}`;
    $("ponderadoBody").innerHTML = ponderadosHtml(g, actual.avance.programadoPendiente);
    window.Dialog.open($("sheetPonderado"));
  }

  // --------------------------------------------------------------- RTA
  function rtaHtml(rta) {
    if (!rta || !rta.secciones.length) return `<div class="state-msg">Sin información de la red de transmisión.</div>`;
    const orden = { especificaciones: 0, poi: 1, componentes: 2, justificacion: 3, otro: 4 };
    return rta.secciones
      .slice()
      .sort((a, b) => orden[a.tipo] - orden[b.tipo])
      .map((s) => {
        const titulo = `<h3 class="rta__sub">${esc(s.titulo)}</h3>`;
        if (s.tipo === "especificaciones") {
          return `${titulo}<div class="rta-specs">${s.campos
            .map((c) => {
              const { nombre, unidad } = separarUnidad(c.campo);
              return `<div class="rta-spec"><div class="rta-spec__valor">${esc(c.valor || "—")}${unidad && c.valor ? ` <small>${esc(unidad)}</small>` : ""}</div><div class="rta-spec__campo">${esc(nombre)}</div></div>`;
            })
            .join("")}</div>`;
        }
        if (s.tipo === "poi") {
          const conf = s.campos.find((c) => /CONFIABILIDAD/.test(normalizeText(c.campo)));
          const [principal, ...resto] = s.campos.filter((c) => c !== conf);
          return `${titulo}<div class="rta-poi">
            ${principal ? `<div class="rta-poi__se">${esc(principal.valor || "—")}</div><div class="rta-poi__campo">${esc(principal.campo)}</div>` : ""}
            ${resto.filter((c) => c.valor).map((c) => `<p class="rta-poi__desc">${esc(c.valor)}</p>`).join("")}
            ${conf && conf.valor ? `<span class="rta-poi__chip">${esc(conf.valor)}</span>` : ""}
          </div>`;
        }
        if (s.tipo === "componentes") {
          return `${titulo}<div class="rta-comp" role="region" aria-label="${esc(s.titulo)}" tabindex="0"><table>
            <thead><tr>${s.columnas.map((c) => `<th>${esc(oracion(c))}</th>`).join("")}</tr></thead>
            <tbody>${s.filas.map((f) => `<tr>${f.map((v) => `<td>${esc(v || "—")}</td>`).join("")}</tr>`).join("")}</tbody>
          </table></div>`;
        }
        const lista = `<ul class="rta-just">${s.campos
          .filter((c) => c.valor)
          .map((c) => `<li><b>${esc(c.campo)}</b><span>${esc(c.valor)}</span></li>`)
          .join("")}</ul>`;
        // Justificación (y secciones nuevas): plegables para no alargar la tarjeta en el celular.
        return `<details class="rta-mas"><summary>${esc(s.titulo)}</summary>${lista}</details>`;
      })
      .join("");
  }

  // ------------------------------------------------------------- ficha
  function fichaHtml(p) {
    if (!p.ficha || !p.ficha.length) return `<div class="state-msg">Sin ficha técnica para este anteproyecto.</div>`;
    return `
      <div class="spec-group">
        <div class="spec-group__title">${esc(p.tecnologia || "Datos generales")}</div>
        <table class="spec"><tbody>
          ${p.ficha.map((f) => `<tr><td class="spec__name">${esc(f.campo)}</td><td class="spec__val">${esc(f.valor || "—")}</td></tr>`).join("")}
        </tbody></table>
      </div>`;
  }

  // ------------------------------------------------------------ plazos
  // Etapas de la hoja PLAZOS: { etapa, total, inicio: "AAAA-MM", fin: "AAAA-MM" }.
  const MESES_CORTOS = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];
  const MESES_LARGOS = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"];
  /** "2026-07" -> número de mes corrido (para restar). */
  const mesNum = (ym) => {
    const [a, m] = String(ym).split("-").map(Number);
    return a * 12 + (m - 1);
  };
  const mesCorto = (ym) => `${MESES_CORTOS[mesNum(ym) % 12]} ${Math.floor(mesNum(ym) / 12)}`;
  const mesLargo = (ym) => `${MESES_LARGOS[mesNum(ym) % 12]} ${Math.floor(mesNum(ym) / 12)}`;

  /** Mes actual en la Ciudad de México, "AAAA-MM". */
  function mesHoy() {
    try {
      const f = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Mexico_City", year: "numeric", month: "2-digit" }).formatToParts(new Date());
      return `${f.find((x) => x.type === "year").value}-${f.find((x) => x.type === "month").value}`;
    } catch {
      const d = new Date();
      return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    }
  }

  /** "concluida" | "curso" | "pendiente" de una etapa respecto al mes de hoy. */
  const estadoEtapa = (e, hoy) => (mesNum(e.fin) < mesNum(hoy) ? "concluida" : mesNum(e.inicio) > mesNum(hoy) ? "pendiente" : "curso");

  function plazosHtml(etapas, hoy = mesHoy()) {
    const validas = (etapas || []).filter((e) => e.inicio && e.fin);
    if (!validas.length) return `<div class="state-msg">Sin plazos registrados para este anteproyecto.</div>`;
    const ini = Math.min(...validas.map((e) => mesNum(e.inicio)));
    const fin = Math.max(...validas.map((e) => mesNum(e.fin)));
    const span = fin - ini + 1;
    const h = mesNum(hoy);
    const actualEt = validas.find((e) => estadoEtapa(e, hoy) === "curso");
    const estadoTxt = actualEt ? actualEt.etapa : h < ini ? "Por iniciar" : h > fin ? "Concluido" : "Entre etapas";
    const pos = (n) => ((n - ini) / span) * 100;
    // Años del eje (marca en cada enero; sin texto si el año casi no cabe)
    const anios = [];
    for (let a = Math.floor(ini / 12); a <= Math.floor(fin / 12); a++) {
      const desde = Math.max(a * 12, ini);
      const hasta = Math.min(a * 12 + 11, fin);
      anios.push({ a, izq: pos(desde), ancho: pos(hasta + 1) - pos(desde) });
    }
    const hoyVisible = h >= ini && h <= fin;
    const hoyPos = pos(h + 0.5);
    const etiqueta = { concluida: "Concluida", curso: "En curso", pendiente: "Por iniciar" };
    return `
      <div class="plazo-summary">
        <div class="plazo-summary__item">
          <div class="plazo-summary__label">Inicio</div>
          <div class="plazo-summary__value">${esc(mesLargo(`${Math.floor(ini / 12)}-${String((ini % 12) + 1).padStart(2, "0")}`))}</div>
        </div>
        <div class="plazo-summary__item">
          <div class="plazo-summary__label">Conclusión estimada</div>
          <div class="plazo-summary__value">${esc(mesLargo(`${Math.floor(fin / 12)}-${String((fin % 12) + 1).padStart(2, "0")}`))}</div>
        </div>
        <div class="plazo-summary__item">
          <div class="plazo-summary__label">Duración total</div>
          <div class="plazo-summary__value">${span} meses</div>
        </div>
        <div class="plazo-summary__item">
          <div class="plazo-summary__label">Etapa actual</div>
          <div class="plazo-summary__value plazo-actual">${esc(estadoTxt)}</div>
        </div>
      </div>
      <div class="gantt" style="--hoy:${hoyPos}%">
        <div class="gantt__eje" aria-hidden="true">
          ${anios.map((x) => `<span style="left:${x.izq}%;width:${x.ancho}%">${x.ancho >= 10 ? x.a : ""}</span>`).join("")}
        </div>
        <ol class="gantt__lista">
          ${validas
            .map((e, i) => {
              const est = estadoEtapa(e, hoy);
              const a = mesNum(e.inicio);
              const b = mesNum(e.fin);
              const meses = b - a + 1;
              const transcurrido = est === "curso" ? h - a + 1 : 0;
              const periodo = a === b ? mesCorto(e.inicio) : `${mesCorto(e.inicio)} – ${mesCorto(e.fin)}`;
              return `
            <li class="etapa etapa--${est}">
              <div class="etapa__top">
                <span class="etapa__num">${i + 1}</span>
                <span class="etapa__nombre">${esc(e.etapa)}</span>
                <span class="etapa__estado">${etiqueta[est]}</span>
              </div>
              <div class="etapa__meta">${esc(e.total || `${meses} ${meses === 1 ? "mes" : "meses"}`)} · ${esc(periodo)}${
                est === "curso" ? ` · <b>mes ${transcurrido} de ${meses}</b>` : ""
              }</div>
              <div class="etapa__pista" aria-hidden="true">
                <span class="etapa__barra" style="left:${pos(a)}%;width:${pos(b + 1) - pos(a)}%">${
                  est === "curso" ? `<i style="width:${(transcurrido / meses) * 100}%"></i>` : ""
                }</span>
                ${hoyVisible ? `<span class="etapa__hoy"></span>` : ""}
              </div>
            </li>`;
            })
            .join("")}
        </ol>
        ${hoyVisible ? `<div class="gantt__leyenda"><span class="gantt__hoy-marca"></span> Hoy (${esc(mesCorto(hoy))})</div>` : ""}
      </div>`;
  }

  // ------------------------------------------------------------- carga
  async function cargar() {
    window.CarteraMap.configurar({ kml: KML_FILE_PATH, secuencias: null });
    const kmlListo = window.CarteraMap.cargarKML();
    window.CarteraCurva.cargar();
    try {
      const res = await fetch(DATA_FILE_PATH, { cache: "no-store" });
      if (!res.ok) throw new Error(`No se pudo cargar ${DATA_FILE_PATH} (HTTP ${res.status})`);
      const datos = await res.json();
      proyectos = datos.proyectos || [];
      if (!proyectos.length) throw new Error("El Excel no tiene anteproyectos.");
      const fecha = formatDateShort(datos.excelModificado ? new Date(datos.excelModificado) : null);
      $("dataDate").textContent = fecha ? `Datos al ${fecha}` : "";
      $("dataDate").hidden = !fecha;
      $("projectSelect").innerHTML = proyectos.map((p, i) => `<option value="${i}">${esc(p.nombre)}</option>`).join("");
      await kmlListo;
      // Pantalla previa para elegir el proyecto, o la ficha si la dirección trae ?proyecto= (vista.js).
      window.CarteraVista.instalar({ titulo: "Cartera Anteproyectos", proyectos: () => proyectos, abrir: seleccionar, cerrar: cerrarTodas }).iniciar();
    } catch (err) {
      console.error(err);
      if (window.PWA && window.PWA.recargarSiHayRed()) return;
      document.body.classList.remove("modo-vista", "vista-cargando"); // el mensaje va en la ficha
      $("projectSelect").innerHTML = "<option>Error al cargar datos</option>";
      $("cartera").innerHTML = `<div class="state-msg">No se pudieron cargar los datos. Detalle: ${esc(err.message)}</div>`;
    }
  }

  function seleccionar(i) {
    const p = proyectos[i];
    if (!p) return;
    actual = p;
    $("projectSelect").value = String(i);
    mostrar(p);
    const url = new URL(window.location.href);
    url.searchParams.set("proyecto", slugify(p.nombre));
    window.history.replaceState(window.history.state, "", url); // conserva si se llegó desde la pantalla previa
    document.title = `${p.nombre} — Cartera Anteproyectos`;
  }

  // ------------------------------------------------------------ render
  function mostrar(p) {
    const img = $("projectImg");
    img.alt = p.nombre;
    // Sin foto (o si no carga): fondo con el ícono de su tecnología (hero.js)
    window.CarteraHero.foto(document.querySelector(".hero-card"), img, String(p.imagen || "").trim(), p.tecnologia);
    $("projectName").textContent = p.nombre;
    $("projectLocation").textContent = p.ubicacion || "Sin ubicación";
    $("projectTech").textContent = p.tecnologia || "";
    $("projectTech").hidden = !p.tecnologia;
    $("projectNivel").textContent = p.nivel || "";
    $("projectNivel").hidden = !p.nivel;
    document.querySelectorAll("[data-project-name]").forEach((el) => (el.textContent = p.nombre));

    $("descVal").innerHTML = textoHtml(p.descripcion) || `<p class="state-msg">Sin descripción para este anteproyecto.</p>`;
    window.Plegable.aplicar($("descVal"));
    const extras = p.extras || [];
    $("extrasVal").hidden = !extras.length;
    $("extrasVal").innerHTML = extras
      .map((x) => `<div class="info-item"><div><div class="info-item__label">${esc(x.campo)}</div><div class="info-item__value">${esc(x.valor)}</div></div></div>`)
      .join("");

    $("rtaTitle").textContent = (p.rta && p.rta.titulo) || "Red de Transmisión Propuesta (RTA)";
    $("rtaBody").innerHTML = rtaHtml(p.rta);
    $("generalBody").innerHTML = generalHtml(p.avance);
    const notaGeneral = !!(p.avance && p.avance.general && p.avance.general.nota);
    $("generalAbrir").hidden = !notaGeneral;
    $("generalAbrir").dataset.nota = "general";
    $("generalMarca").hidden = !notaGeneral;
    $("generalCard").classList.toggle("card--clic", notaGeneral);
    A.pintarSemana($("generalBody"), window.CarteraCurva.cargar(), slugify(p.nombre), () => actual === p);
    $("particularGrid").innerHTML = particularesHtml(p.avance);
    $("fichaBody").innerHTML = fichaHtml(p);
    $("plazosBtn").hidden = !(p.plazos && p.plazos.length);
    $("plazosBody").innerHTML = plazosHtml(p.plazos);

    // Color del punto: verde si va al día o sin programa (ver map.js de Cartera CPEL).
    const g = p.avance && p.avance.general;
    const real = g ? g.real : 0;
    const prog = g && !p.avance.programadoPendiente ? g.prog : real;
    window.CarteraMap.mostrarProyecto({ nombre: p.nombre, avanceReal: real, avanceProg: prog });
  }

  // ----------------------------------------------------------- eventos
  function cerrarTodas() {
    document.querySelectorAll(".sheet.is-open").forEach((el) => window.Dialog.close(el));
  }

  document.addEventListener("DOMContentLoaded", () => {
    $("projectSelect").addEventListener("change", (e) => {
      seleccionar(Number(e.target.value));
      window.scrollTo({ top: 0, behavior: "smooth" });
    });
    window.CarteraPdf.init({ nombre: () => (actual ? actual.nombre : ""), prefijo: "Anteproyecto" });
    // En el PDF van abiertas las secciones plegables (Justificación de la ruta).
    const abrirPlegables = () => document.querySelectorAll("#cartera details").forEach((d) => (d.open = true));
    $("printBtn").addEventListener("click", abrirPlegables, true);
    window.addEventListener("beforeprint", abrirPlegables);
    document.addEventListener("click", (e) => {
      const abre = e.target.closest("[data-open-sheet]");
      if (abre) {
        window.Dialog.open($(abre.dataset.openSheet));
        if (abre.dataset.openSheet === "sheetCurva" && actual) window.CarteraCurva.mostrar(actual);
        return;
      }
      if (e.target.closest("[data-close-nota]")) return window.Dialog.close($("sheetNota")); // solo Notas; la de abajo sigue abierta
      if (e.target.closest("[data-close-sheet]")) return cerrarTodas();
      const nota = e.target.closest("[data-nota]");
      if (nota) return abrirNota(nota.dataset.nota);
      const grupo = e.target.closest("[data-grupo]");
      if (grupo) abrirPonderados(Number(grupo.dataset.grupo));
    });
    window.CarteraMap.initMap("mapaProyecto");
    cargar();
  });
})();
