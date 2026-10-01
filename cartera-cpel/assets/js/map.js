/**
 * map.js (Cartera CPEL)
 * Mapa Leaflet de un solo proyecto a la vez: cuando cambias de proyecto
 * en el selector, el mapa centra y resalta su ubicación (tomada del
 * archivo data/CARTERA-CPEL.kml, vinculado por nombre con el Excel).
 *
 * Requiere: shared/text-utils.js, shared/kml-parser.js y
 * shared/base-map.js cargados antes de este archivo.
 */
(function (global) {
  const KML_FILE_PATH = "data/CARTERA-CPEL.kml";
  // KML adicional de polígonos "fijos" por proyecto (p. ej. las secuencias
  // de un parque grande). No se vincula por nombre exacto (los Placemark
  // de este KML se llaman "POLÍGONO SEC III", no el nombre completo del
  // proyecto), sino por el número romano al final de ambos nombres — ver
  // buscarPoligonosSecuencia() más abajo. Para agregar más, solo súmalos
  // a este KML con el mismo patrón "... SEC <número romano>".
  const SECUENCIAS_KML_FILE_PATH = "data/CARTERA-CPEL-POLIGONOS.kml";

  const { normalizeText, parseNumber, esc } = global.TextUtils;

  let map = null;
  let layerGroup = null;
  const placemarksByName = new Map(); // nombre normalizado -> placemark KML
  let poligonosSecuencias = []; // [{name, type, latlngs}] del KML de secuencias

  /** Último token de un nombre si es un número romano (I, II, III, IV...). */
  function numeralRomanoFinal(nombre) {
    const tokens = normalizeText(nombre).split(" ");
    const ultimo = tokens[tokens.length - 1] || "";
    return /^[IVXLCDM]+$/.test(ultimo) ? ultimo : null;
  }

  /**
   * Busca en el KML de secuencias los polígonos que corresponden a un
   * proyecto: mismo número romano final Y ambos nombres mencionan
   * "SEC" (de "SECUENCIA"/"SEC"), para no cruzar proyectos distintos que
   * por casualidad terminen en el mismo número romano.
   */
  function buscarPoligonosSecuencia(project) {
    const numeral = numeralRomanoFinal(project.nombre);
    if (!numeral) return [];
    if (!normalizeText(project.nombre).includes("SEC")) return [];
    return poligonosSecuencias.filter((pm) => {
      if (numeralRomanoFinal(pm.name) !== numeral) return false;
      return normalizeText(pm.name).includes("SEC");
    });
  }

  function colorFor(project) {
    const prog = parseNumber(project.avanceProg) || 0;
    const real = parseNumber(project.avanceReal) || 0;
    return real >= prog ? "#1f7a4d" : "#c0392b"; // verde adelantado/al día, rojo atraso
  }

  function initMap(elementId) {
    map = global.BaseMap.create(elementId, { tileWarningId: "mapTileWarning" }).setView([23.6, -102.5], 5);
    layerGroup = L.layerGroup().addTo(map);

    // El contenedor puede arrancar con tamaño incorrecto si el layout aún
    // no terminó de acomodarse; esto corrige el "mapa cortado" ocasional.
    requestAnimationFrame(() => map.invalidateSize());
    window.addEventListener("resize", () => map.invalidateSize());

    return map;
  }

  async function fetchKML(url) {
    const res = await fetch(url, { cache: "no-store" });
    if (!res.ok) throw new Error(`No se pudo cargar ${url} (HTTP ${res.status})`);
    return global.KMLParser.parse(await res.text());
  }

  /**
   * Carga ambos KML en paralelo y arma el índice nombre -> placemark.
   * Devuelve una promesa con true si el KML principal cargó.
   */
  async function cargarKML() {
    // El KML de polígonos de secuencias es opcional (puede no existir en
    // despliegues anteriores): si falla, solo no se dibujan esos polígonos.
    const [principal, secuencias] = await Promise.allSettled([
      fetchKML(KML_FILE_PATH),
      fetchKML(SECUENCIAS_KML_FILE_PATH),
    ]);

    if (secuencias.status === "fulfilled") {
      poligonosSecuencias = secuencias.value.filter((pm) => pm.name);
    } else {
      console.warn("No se pudo cargar el KML de polígonos de secuencias:", secuencias.reason.message);
    }

    if (principal.status === "rejected") {
      console.error(principal.reason);
      const el = document.getElementById("mapEmpty");
      if (el) {
        el.hidden = false;
        el.textContent = "No se pudo cargar el mapa de ubicaciones.";
      }
      return false;
    }
    principal.value.forEach((pm) => {
      if (pm.name) placemarksByName.set(normalizeText(pm.name), pm);
    });
    return true;
  }

  /** Muestra el proyecto dado (si tiene coincidencia geográfica) en el mapa. */
  function mostrarProyecto(project) {
    if (!map) return;
    layerGroup.clearLayers();

    const pm = placemarksByName.get(normalizeText(project.nombre));
    const mapEmpty = document.getElementById("mapEmpty");

    if (!pm) {
      if (mapEmpty) {
        mapEmpty.hidden = false;
        mapEmpty.textContent = "Este proyecto no tiene ubicación registrada en el KML.";
      }
      return;
    }
    if (mapEmpty) mapEmpty.hidden = true;

    const color = colorFor(project);
    let layer;
    let bounds = [];

    if (pm.type === "point") {
      const [lat, lng] = pm.latlngs;
      layer = L.circleMarker([lat, lng], {
        radius: 9,
        weight: 2,
        color: "#ffffff",
        fillColor: color,
        fillOpacity: 0.95,
      });
      bounds = [[lat, lng]];
    } else if (pm.type === "polygon") {
      layer = L.polygon(pm.latlngs, { color, weight: 2, fillColor: color, fillOpacity: 0.25 });
      bounds = pm.latlngs;
    } else if (pm.type === "line") {
      layer = L.polyline(pm.latlngs, { color, weight: 3 });
      bounds = pm.latlngs;
    }
    if (!layer) return;

    // Etiqueta con el nombre del proyecto junto al punto, igual que en el
    // mapa de Panel de Proyectos (Mixtos). Como aquí solo se muestra un
    // proyecto a la vez, se deja siempre visible (sin umbral de zoom).
    // Leaflet inserta el texto del tooltip como HTML, por eso se escapa.
    layer.bindTooltip(esc(project.nombre), {
      permanent: true,
      direction: "top",
      offset: [0, -8],
      className: "project-label",
      interactive: false,
    });

    layer.addTo(layerGroup);

    // Polígonos fijos del proyecto (KML de secuencias, ver
    // buscarPoligonosSecuencia). Se dibujan siempre que el proyecto
    // tenga coincidencia — no dependen de ningún clic ni selector propio.
    const secuencias = buscarPoligonosSecuencia(project);
    secuencias.forEach((sec) => {
      if (sec.type !== "polygon" && sec.type !== "line") return;
      const secLayer =
        sec.type === "polygon"
          ? L.polygon(sec.latlngs, { color: "#c9932e", weight: 2, fillColor: "#c9932e", fillOpacity: 0.25 })
          : L.polyline(sec.latlngs, { color: "#c9932e", weight: 3 });
      secLayer.addTo(layerGroup);
      bounds = bounds.concat(sec.latlngs);
    });

    if (secuencias.length) {
      // Con polígono(s) de secuencia, el encuadre debe cubrir todo
      // (marcador + polígonos), no solo el punto.
      map.fitBounds(bounds, { padding: [30, 30] });
    } else if (bounds.length === 1) {
      map.setView(bounds[0], 14, { animate: true });
    } else if (bounds.length) {
      map.fitBounds(bounds, { padding: [30, 30] });
    }
  }

  global.CarteraMap = { initMap, cargarKML, mostrarProyecto };
})(window);
