/**
 * vista.js (Cartera CPEL y Cartera Anteproyectos)
 * Pantalla previa para elegir el proyecto: una cuadrícula con el nombre y
 * la tecnología de cada uno y, debajo, el mapa de todo el país con todos
 * los proyectos. Al tocar una tarjeta (o "Ver proyecto" en el mapa) se
 * abre su ficha sin recargar la página.
 *
 *  - Sin ?proyecto= en la dirección se entra a la vista; con ?proyecto=…
 *    (enlaces directos, "Esta semana" del portal) se abre la ficha.
 *  - En la ficha, la flecha de la barra y el botón "atrás" del navegador
 *    o del teléfono regresan a la vista; en la vista, la flecha va al portal.
 *
 * Requiere: shared/text-utils.js, hero.js y map.js (CarteraMap).
 * Expone: window.CarteraVista.instalar({ titulo, proyectos, abrir, cerrar })
 *   proyectos: () => [{ nombre, tecnologia }]
 *   abrir:     (i) => muestra la ficha del proyecto i (selector, ficha…)
 *   cerrar:    () => al volver a la vista (cerrar ventanas, etc.)
 * Devuelve { iniciar } para llamar cuando ya cargaron los datos y el KML.
 */
(function (global) {
  const { esc, slugify } = global.TextUtils;
  const $ = (id) => document.getElementById(id);

  // Color del punto en el mapa según la tecnología (CarteraHero.tipo).
  const COLORES = { solar: "#c9932e", eolica: "#2f7fa8", hidro: "#1f6f8b", otra: "#5f6966" };
  const NOMBRE_TIPO = { solar: "Solar", eolica: "Eólica", hidro: "Hidráulica", otra: "Otra" };

  function instalar({ titulo, proyectos, abrir, cerrar = () => {} }) {
    const enVista = () => document.body.classList.contains("modo-vista");
    const proyectoEnUrl = () => new URLSearchParams(global.location.search).get("proyecto");
    const indiceDesdeUrl = () => {
      const buscado = slugify(proyectoEnUrl() || "");
      const i = proyectos().findIndex((p) => slugify(p.nombre) === buscado);
      return i === -1 ? 0 : i;
    };

    function tarjetas() {
      $("vistaGrid").innerHTML = proyectos()
        .map(
          (p, i) => `
          <a class="vcard" href="?proyecto=${encodeURIComponent(slugify(p.nombre))}" data-i="${i}">
            <span class="vcard__icono vcard__icono--${global.CarteraHero.tipo(p.tecnologia)}">${global.CarteraHero.icono(p.tecnologia)}</span>
            <span class="vcard__info">
              <span class="vcard__nombre">${esc(p.nombre)}</span>
              <span class="vcard__tec">${esc(p.tecnologia || "")}</span>
            </span>
          </a>`
        )
        .join("");
    }

    function mapa() {
      const items = proyectos().map((p, i) => ({ i, nombre: p.nombre, color: COLORES[global.CarteraHero.tipo(p.tecnologia)] }));
      const conUbicacion = global.CarteraMap.mostrarTodos("vistaMapa", items, abrirDesdeVista);
      $("vistaMapaVacio").hidden = conUbicacion > 0;
      // Leyenda: solo las tecnologías que hay en la cartera.
      const tipos = [...new Set(proyectos().map((p) => global.CarteraHero.tipo(p.tecnologia)))];
      $("vistaLeyenda").innerHTML = tipos.map((t) => `<span><i style="background:${COLORES[t]}"></i>${NOMBRE_TIPO[t]}</span>`).join("");
    }

    function mostrarVista() {
      cerrar();
      document.body.classList.add("modo-vista");
      document.body.classList.remove("vista-cargando");
      $("vista").hidden = false;
      $("vistaGrid").removeAttribute("aria-hidden");
      const n = proyectos().length;
      const fecha = $("dataDate") ? $("dataDate").textContent : "";
      $("vistaSub").textContent = [`${n} proyecto${n === 1 ? "" : "s"}`, fecha].filter(Boolean).join(" · ");
      tarjetas();
      // El mapa necesita el contenedor ya visible para medirse.
      requestAnimationFrame(mapa);
      $("backLink").href = "../index.html";
      $("backLink").setAttribute("aria-label", "Volver al portal");
      document.title = titulo;
      global.scrollTo(0, 0);
    }

    function abrirFicha(i) {
      document.body.classList.remove("modo-vista", "vista-cargando");
      $("vista").hidden = true;
      abrir(i);
      $("backLink").href = "./";
      $("backLink").setAttribute("aria-label", `Volver a ${titulo}`);
      // El mapa de la ficha estuvo oculto: recalcula su tamaño y el encuadre.
      requestAnimationFrame(() => global.CarteraMap.ajustar());
      global.scrollTo(0, 0);
    }

    function abrirDesdeVista(i) {
      const p = proyectos()[i];
      if (!p) return;
      global.history.pushState({ desdeVista: true }, "", `?proyecto=${encodeURIComponent(slugify(p.nombre))}`);
      abrirFicha(i);
    }

    $("vistaGrid").addEventListener("click", (e) => {
      const tarjeta = e.target.closest("a[data-i]");
      if (!tarjeta || e.metaKey || e.ctrlKey || e.shiftKey || e.button !== 0) return;
      e.preventDefault();
      abrirDesdeVista(Number(tarjeta.dataset.i));
    });
    $("backLink").addEventListener("click", (e) => {
      if (enVista() || !proyectos().length) return; // al portal
      e.preventDefault();
      if (global.history.state && global.history.state.desdeVista) return global.history.back();
      global.history.replaceState(null, "", global.location.pathname);
      mostrarVista();
    });
    global.addEventListener("popstate", () => {
      if (!proyectos().length) return;
      if (proyectoEnUrl()) abrirFicha(indiceDesdeUrl());
      else mostrarVista();
    });

    return {
      iniciar() {
        if (proyectoEnUrl()) abrirFicha(indiceDesdeUrl());
        else mostrarVista();
      },
    };
  }

  global.CarteraVista = { instalar };
})(window);
