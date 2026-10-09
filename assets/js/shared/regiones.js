/**
 * regiones.js (compartido por cartera-cpel y cartera-mixtos)
 * Capa de referencia "Regiones" de los mapas: los polígonos de
 * assets/capas/regiones.geojson (generado con "npm run regiones" desde
 * assets/capas/regiones.kmz).
 *
 *   - Se activa o desactiva con su casilla en el selector de capas del
 *     mapa (el mismo de Satelital / Calles). Empieza apagada y cada
 *     dispositivo recuerda si la dejó encendida.
 *   - El archivo se descarga solo la primera vez que se enciende.
 *   - Cada región tiene su propio color (relleno semitransparente con
 *     borde), distinto de los que usan los proyectos.
 *   - El nombre de cada región aparece al acercarse (desde el mismo zoom
 *     que los nombres de los proyectos en Mixtos).
 *   - Queda debajo de los proyectos y no responde a clics: es solo una
 *     referencia visual.
 *
 * Expone: window.Regiones.capa(map, { etiquetasDesdeZoom }) -> L.LayerGroup
 * (lo usa shared/base-map.js para agregarla al selector de capas).
 */
(function (global) {
  const ARCHIVO = new URL("../../capas/regiones.geojson", document.currentScript.src).href;
  const NOMBRE = "Regiones";
  const GUARDADO = "mapa-regiones"; // localStorage: "1" si se dejó encendida

  // Un color por región (en el orden del archivo). Evita los de los
  // proyectos: verdes, ocres/dorados, rojos y el verde azulado del sitio.
  const COLORES = [
    "#176dcf", "#e8740c", "#9117cf", "#d9d012", "#17b0cf",
    "#cf17a1", "#63cf17", "#2617cf", "#e0457b", "#a1cf17",
    "#5a8cf2", "#ff9a76", "#d35af2", "#f0f06a", "#f25ab7",
    "#85f25a", "#7b5af2", "#7fe0f0", "#0b3d91", "#6b2d8f",
    "#e8a8ff", "#c51b7d", "#1c9dd9", "#b5179e", "#4cc9f0",
  ];

  function leerGuardado() {
    try {
      return global.localStorage.getItem(GUARDADO) === "1";
    } catch {
      return false;
    }
  }
  function guardar(encendida) {
    try {
      if (encendida) global.localStorage.setItem(GUARDADO, "1");
      else global.localStorage.removeItem(GUARDADO);
    } catch {
      // Sin almacenamiento (navegación privada): solo no se recuerda.
    }
  }

  /** Área aproximada (grados²) de un anillo [[lat, lng], ...]. */
  function area(anillo) {
    let s = 0;
    for (let i = 0, j = anillo.length - 1; i < anillo.length; j = i++) {
      s += (anillo[j][1] + anillo[i][1]) * (anillo[j][0] - anillo[i][0]);
    }
    return Math.abs(s / 2);
  }

  function capa(map, { etiquetasDesdeZoom = 8 } = {}) {
    // Panel propio debajo del de los proyectos (overlayPane, z-index 400)
    // y dibujado en canvas: miles de vértices se mueven con fluidez.
    map.createPane("regiones").style.zIndex = 350;
    const renderer = L.canvas({ pane: "regiones" });
    const grupo = L.layerGroup();
    const nombres = L.layerGroup(); // dentro de "grupo" solo con zoom suficiente
    let carga = null;

    function dibujar(geo) {
      const colorDe = new Map();
      const mayor = new Map(); // nombre -> anillo exterior más grande (para la etiqueta)
      geo.features.forEach((ft) => {
        const nombre = (ft.properties && ft.properties.nombre) || "";
        // Una región puede venir en varias piezas con el mismo nombre:
        // comparten color y una sola etiqueta.
        if (!colorDe.has(nombre)) colorDe.set(nombre, COLORES[colorDe.size % COLORES.length]);
        const color = colorDe.get(nombre);
        const latlngs = ft.geometry.coordinates.map((poly) => poly.map((anillo) => anillo.map(([lng, lat]) => [lat, lng])));
        L.polygon(latlngs, { renderer, color, weight: 1.5, opacity: 0.9, fillColor: color, fillOpacity: 0.25, interactive: false }).addTo(grupo);
        latlngs.forEach((poly) => {
          const a = area(poly[0]);
          if (!mayor.has(nombre) || a > mayor.get(nombre).a) mayor.set(nombre, { a, anillo: poly[0] });
        });
      });
      mayor.forEach(({ anillo }, nombre) => {
        const texto = document.createElement("span");
        texto.textContent = nombre; // texto, no HTML
        L.tooltip({ permanent: true, direction: "center", className: "region-label", interactive: false })
          .setLatLng(L.PolyUtil.polygonCenter(anillo, map.options.crs))
          .setContent(texto)
          .addTo(nombres);
      });
      actualizarNombres();
    }

    function cargar() {
      if (!carga) {
        carga = fetch(ARCHIVO)
          .then((res) => {
            if (!res.ok) throw new Error(`HTTP ${res.status}`);
            return res.json();
          })
          .then(dibujar)
          .catch((err) => {
            console.warn("No se pudo cargar la capa de regiones:", err);
            carga = null; // se reintenta al volver a encenderla
            map.removeLayer(grupo); // la casilla se desmarca sola
          });
      }
      return carga;
    }

    function actualizarNombres() {
      const mostrar = map.hasLayer(grupo) && map.getZoom() >= etiquetasDesdeZoom;
      if (mostrar && !grupo.hasLayer(nombres)) grupo.addLayer(nombres);
      else if (!mostrar && grupo.hasLayer(nombres)) grupo.removeLayer(nombres);
    }

    grupo.on("add", () => {
      guardar(true);
      cargar();
      actualizarNombres();
    });
    grupo.on("remove", () => guardar(false));
    map.on("zoomend", actualizarNombres);

    if (leerGuardado()) grupo.addTo(map);
    return grupo;
  }

  global.Regiones = { capa, NOMBRE };
})(window);
