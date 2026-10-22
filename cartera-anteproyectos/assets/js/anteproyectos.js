/**
 * anteproyectos.js
 * Ficha de cada anteproyecto. Los datos se editan en
 * data/datos_anteproyectos.xlsx; la página lee data/anteproyectos.json,
 * que genera y valida scripts/build-data.js (lectura en
 * scripts/anteproyectos.js).
 *
 * Tarjetas: 1) Presentación (PRES), 2) Descripción técnica (DESC),
 * 3) Red de Transmisión Propuesta (RTA), 4) Ficha técnica (FICHA_<tipo>,
 * en la ventana del botón) y 5) Avance (AVAN_<tipo>). Los campos de cada
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

  const { esc, slugify, formatDateShort, normalizeText } = window.TextUtils;
  const $ = (id) => document.getElementById(id);

  let proyectos = [];
  let actual = null;

  // ------------------------------------------------------------ texto
  /**
   * Texto del Excel -> HTML: párrafos separados por línea en blanco,
   * listas numeradas ("1. …") y con viñetas ("•", "-").
   */
  function textoHtml(texto) {
    const t = String(texto || "").trim();
    if (!t) return "";
    return t
      .split(/\n\s*\n/)
      .map((bloque) => {
        const out = [];
        let lista = null;
        bloque.split("\n").forEach((linea) => {
          const num = /^(\d+)[.)]\s+(.+)$/.exec(linea);
          const vin = /^[•\-–*]\s*(.+)$/.exec(linea);
          const tipo = num ? "ol" : vin ? "ul" : null;
          if (tipo) {
            if (!lista || lista.tipo !== tipo) out.push((lista = { tipo, items: [] }));
            lista.items.push((num || vin)[num ? 2 : 1]);
          } else {
            lista = null;
            out.push({ p: linea });
          }
        });
        return out
          .map((b) => (b.p !== undefined ? `<p>${esc(b.p)}</p>` : `<${b.tipo}>${b.items.map((i) => `<li>${esc(i)}</li>`).join("")}</${b.tipo}>`))
          .join("");
      })
      .join("");
  }

  /** "Nivel de Tensión [kV]" -> { nombre: "Nivel de Tensión", unidad: "kV" }. */
  function separarUnidad(campo) {
    const m = /^(.*?)\s*\[(.+?)\]\s*$/.exec(campo || "");
    return m ? { nombre: m[1], unidad: m[2].trim() } : { nombre: campo || "", unidad: "" };
  }

  /** "DESCRIPCIÓN TÉCNICA" -> "Descripción técnica" (encabezados en mayúsculas). */
  const oracion = (t) => (t && t === t.toUpperCase() ? t.charAt(0) + t.slice(1).toLowerCase() : t);

  const pctTxt = (v) => (v === null || v === undefined ? "—" : `${Math.round(v * 10) / 10}%`);
  const ancho = (v) => Math.max(0, Math.min(Number(v) || 0, 100));

  // ------------------------------------------------------------ avance
  function barra(valor, clase) {
    return `<div class="bar bar--mini"><span class="bar__fill ${clase}" style="width:${ancho(valor)}%"></span></div>`;
  }

  function avanceHtml(avance) {
    if (!avance || !avance.general) return `<div class="state-msg">Sin avance registrado para este anteproyecto.</div>`;
    const { general, grupos, programadoPendiente } = avance;
    const conProg = !programadoPendiente;
    const filaGeneral = (lado, etiqueta, valor) => `
      <div class="progress-row progress-row--${lado}">
        <div class="progress-row__info"><span>${etiqueta}</span><span>${pctTxt(valor)}</span></div>
        <div class="bar"><span class="bar__fill bar__fill--${lado}" style="width:${ancho(valor)}%"></span></div>
      </div>`;
    let variacion = "";
    if (conProg && general.real !== null && general.prog !== null) {
      const d = Math.round((general.real - general.prog) * 10) / 10;
      variacion = `<div class="variance ${d >= 0 ? "variance--ok" : "variance--late"}">${
        d > 0 ? `Adelantado ${d} pts respecto al programa` : d < 0 ? `Atraso de ${Math.abs(d)} pts respecto al programa` : "Al día respecto al programa"
      }</div>`;
    }
    const item = (x) => `
      <li class="av-item">
        <div class="av-item__head"><span class="av-item__titulo"><b>${esc(x.clave)}</b> ${esc(x.titulo)}</span><span class="av-item__pct">${pctTxt(x.real)}</span></div>
        ${barra(x.real, "bar__fill--real")}
        ${conProg ? `<div class="av-item__prog">${barra(x.prog, "bar__fill--prog")}<span>Prog. ${pctTxt(x.prog)}</span></div>` : ""}
        ${x.nota ? `<div class="av-nota av-nota--item">${textoHtml(x.nota)}</div>` : ""}
      </li>`;
    return `
      <div class="av-general">
        <div class="progress-stack">
          ${filaGeneral("real", "Real", general.real)}
          ${conProg ? filaGeneral("prog", "Programado", general.prog) : ""}
        </div>
        ${conProg ? variacion : `<p class="av-pendiente">Programado: pendiente de captura.</p>`}
        ${general.nota ? `<div class="av-nota"><div class="av-nota__titulo">Notas</div>${textoHtml(general.nota)}</div>` : ""}
      </div>
      <div class="av-grupos">
        ${grupos
          .map(
            (g) => `
          <div class="av-grupo">
            <div class="av-grupo__head">
              <span class="av-grupo__num">${esc(g.clave)}</span>
              <span class="av-grupo__titulo">${esc(g.titulo)}</span>
              <span class="av-grupo__pct">${pctTxt(g.real)}</span>
            </div>
            <div class="bar"><span class="bar__fill bar__fill--real" style="width:${ancho(g.real)}%"></span></div>
            ${conProg ? `<div class="av-item__prog">${barra(g.prog, "bar__fill--prog")}<span>Prog. ${pctTxt(g.prog)}</span></div>` : ""}
            ${g.nota ? `<div class="av-nota av-nota--item">${textoHtml(g.nota)}</div>` : ""}
            ${g.items.length ? `<ul class="av-items">${g.items.map(item).join("")}</ul>` : ""}
          </div>`
          )
          .join("")}
      </div>`;
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
      seleccionar(indiceDesdeUrl());
    } catch (err) {
      console.error(err);
      if (window.PWA && window.PWA.recargarSiHayRed()) return;
      $("projectSelect").innerHTML = "<option>Error al cargar datos</option>";
      $("cartera").innerHTML = `<div class="state-msg">No se pudieron cargar los datos. Detalle: ${esc(err.message)}</div>`;
    }
  }

  function indiceDesdeUrl() {
    const buscado = new URLSearchParams(window.location.search).get("proyecto");
    const i = buscado ? proyectos.findIndex((p) => slugify(p.nombre) === slugify(buscado)) : -1;
    return i === -1 ? 0 : i;
  }

  function seleccionar(i) {
    const p = proyectos[i];
    if (!p) return;
    actual = p;
    $("projectSelect").value = String(i);
    mostrar(p);
    const url = new URL(window.location.href);
    url.searchParams.set("proyecto", slugify(p.nombre));
    window.history.replaceState(null, "", url);
    document.title = `${p.nombre} — Cartera Anteproyectos`;
  }

  // ------------------------------------------------------------ render
  function mostrar(p) {
    const img = $("projectImg");
    if (p.imagen) img.src = p.imagen;
    else img.removeAttribute("src");
    img.alt = p.nombre;
    img.style.visibility = p.imagen ? "visible" : "hidden";
    $("projectName").textContent = p.nombre;
    $("projectLocation").textContent = p.ubicacion || "Sin ubicación";
    $("projectTech").textContent = p.tecnologia || "";
    $("projectTech").hidden = !p.tecnologia;
    document.querySelectorAll("[data-project-name]").forEach((el) => (el.textContent = p.nombre));

    $("descVal").innerHTML = textoHtml(p.descripcion) || `<p class="state-msg">Sin descripción para este anteproyecto.</p>`;
    const extras = p.extras || [];
    $("extrasVal").hidden = !extras.length;
    $("extrasVal").innerHTML = extras
      .map((x) => `<div class="info-item"><div><div class="info-item__label">${esc(x.campo)}</div><div class="info-item__value">${esc(x.valor)}</div></div></div>`)
      .join("");

    $("rtaTitle").textContent = (p.rta && p.rta.titulo) || "Red de Transmisión Propuesta (RTA)";
    $("rtaBody").innerHTML = rtaHtml(p.rta);
    $("avanceBody").innerHTML = avanceHtml(p.avance);
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
      if (e.target.closest("[data-close-sheet]")) cerrarTodas();
    });
    window.CarteraMap.initMap("mapaProyecto");
    cargar();
  });
})();
