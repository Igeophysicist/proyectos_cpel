/**
 * anteproyectos.js
 * Ficha de cada anteproyecto. Los datos se editan en
 * data/datos_anteproyectos.xlsx; la página lee data/anteproyectos.json,
 * que genera y valida scripts/build-data.js (lectura en
 * scripts/anteproyectos.js).
 *
 * Tarjetas: 1) Presentación (PRES), 2) Descripción técnica (DESC),
 * 3) Red de Transmisión Propuesta (RTA), 4) Ficha técnica (FICHA_<tipo>,
 * en la ventana del botón) y 5) Avance (AVAN_<tipo>), en dos tarjetas:
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

  /** Avance general: Real, Programado (o "pendiente"), semáforo y la NOTA TOTAL. */
  function generalHtml(avance) {
    if (!avance || !avance.general) return `<div class="state-msg">Sin avance registrado para este anteproyecto.</div>`;
    const { general, programadoPendiente } = avance;
    return `
      ${A.generalHtml(general.real, general.prog, { pendiente: programadoPendiente })}
      ${programadoPendiente ? `<p class="av-pendiente">Programado: pendiente de captura.</p>` : ""}
      ${
        general.nota
          ? `<details class="av-notas-gen"><summary>Notas</summary><div class="av-notas-gen__texto">${textoHtml(general.nota)}</div></details>`
          : ""
      }`;
  }

  /** Nota del Excel, en rojo para que destaque. */
  const notaHtml = (texto, titulo = "") =>
    `<div class="av-nota">${titulo ? `<div class="av-nota__titulo">${esc(titulo)}</div>` : ""}${textoHtml(texto)}</div>`;

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
            g.items.some((x) => x.nota) || g.nota ? ' <span class="particular__nota">con notas</span>' : ""
          }</span>
        </button>`
      )
      .join("");
  }

  /** Ventana con los avances ponderados de un avance particular. */
  function ponderadosHtml(g, pendiente) {
    return `
      <div class="pond-resumen">
        ${miniFilas(g, pendiente)}
        ${g.nota ? notaHtml(g.nota) : ""}
      </div>
      ${
        g.items.length
          ? `<ul class="pond-lista">${g.items
              .map(
                (x) => `
            <li class="pond">
              <div class="pond__titulo"><b>${esc(x.clave)}</b> ${esc(x.titulo)}</div>
              ${miniFilas(x, pendiente)}
              ${x.nota ? notaHtml(x.nota, "Nota") : ""}
            </li>`
              )
              .join("")}</ul>`
          : `<div class="state-msg">Este avance no tiene avances ponderados.</div>`
      }`;
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
    A.pintarSemana($("generalBody"), window.CarteraCurva.cargar(), slugify(p.nombre), () => actual === p);
    $("particularGrid").innerHTML = particularesHtml(p.avance);
    $("fichaBody").innerHTML = fichaHtml(p);

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
      if (e.target.closest("[data-close-sheet]")) return cerrarTodas();
      const grupo = e.target.closest("[data-grupo]");
      if (grupo) abrirPonderados(Number(grupo.dataset.grupo));
    });
    window.CarteraMap.initMap("mapaProyecto");
    cargar();
  });
})();
