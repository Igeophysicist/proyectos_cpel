/**
 * map.js (Cartera CPEL)
 * Mapa Leaflet de un solo proyecto a la vez: cuando cambias de proyecto
 * en el selector, el mapa centra y resalta su ubicación (tomada del
 * archivo data/CARTERA-CPEL.kml, vinculado por nombre con el Excel).
 *
 * Requiere: kml-parser.js cargado antes de este archivo.
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

  let map = null;
  let layerGroup = null;
  let placemarksByName = new Map(); // nombre normalizado -> placemark KML
  let poligonosSecuencias = []; // [{name, type, latlngs}] del KML de secuencias
  let ajustadoInicialmente = false;

  function normalizar(nombre) {
    return String(nombre || "")
      .trim()
      .toLowerCase()
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, ""); // quita acentos
  }

  /** Último token de un nombre si es un número romano (I, II, III, IV...). */
  function numeralRomanoFinal(nombre) {
    const tokens = normalizar(nombre).toUpperCase().trim().split(/\s+/);
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
    const nombreProyecto = normalizar(project.nombre).toUpperCase();
    if (!nombreProyecto.includes("SEC")) return [];
    return poligonosSecuencias.filter((pm) => {
      if (numeralRomanoFinal(pm.name) !== numeral) return false;
      return normalizar(pm.name).toUpperCase().includes("SEC");
    });
  }

  function colorFor(project) {
    const prog = parseFloat(String(project.avanceProg ?? "").replace("%", "")) || 0;
    const real = parseFloat(String(project.avanceReal ?? "").replace("%", "")) || 0;
    return real >= prog ? "#1f7a4d" : "#c0392b"; // verde adelantado/al día, rojo atraso
  }

  function initMap(elementId) {
    map = L.map(elementId, {
      zoomControl: false,
      attributionControl: true,
    }).setView([23.6, -102.5], 5);

    L.control.zoom({ position: "bottomright" }).addTo(map);

    // Dos capas base para elegir: satelital (Esri, por defecto) y calles
    // (OpenStreetMap). El selector de abajo (L.control.layers) agrega el
    // icono de capas junto a los botones de zoom; al tocarlo se despliega
    // la lista para cambiar entre ambas.
    const capaSatelital = L.tileLayer(
      "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
      {
        attribution: "Tiles &copy; Esri",
        maxZoom: 18,
      }
    );
    const capaCalles = L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
      maxZoom: 19,
    });

    capaSatelital.addTo(map); // capa inicial

    L.control
      .layers(
        { Satelital: capaSatelital, Calles: capaCalles },
        {},
        { position: "bottomright", collapsed: true }
      )
      .addTo(map);

    // Aviso no bloqueante si las imágenes del mapa no cargan (red/CDN
    // bloqueados), sea cual sea la capa activa — los puntos de los
    // proyectos igual se ven, porque no dependen de esas imágenes.
    let avisoTiles = false;
    const avisarSiFallaTile = () => {
      if (avisoTiles) return;
      avisoTiles = true;
      const el = document.getElementById("mapTileWarning");
      if (el) el.hidden = false;
    };
    capaSatelital.on("tileerror", avisarSiFallaTile);
    capaCalles.on("tileerror", avisarSiFallaTile);
    // Si el usuario cambia de capa, permite que un nuevo fallo (de la
    // otra capa) vuelva a mostrar el aviso.
    map.on("baselayerchange", () => {
      avisoTiles = false;
      const el = document.getElementById("mapTileWarning");
      if (el) el.hidden = true;
    });

    layerGroup = L.layerGroup().addTo(map);

    // El contenedor puede arrancar con tamaño incorrecto si el layout aún
    // no terminó de acomodarse; esto corrige el "mapa cortado" ocasional.
    requestAnimationFrame(() => map.invalidateSize());
    window.addEventListener("resize", () => map.invalidateSize());

    return map;
  }

  /** Carga el KML y arma el índice nombre -> placemark. Devuelve una promesa. */
  async function cargarKML() {
    try {
      const res = await fetch(KML_FILE_PATH, { cache: "no-store" });
      if (!res.ok) throw new Error(`No se pudo cargar ${KML_FILE_PATH} (HTTP ${res.status})`);
      const placemarks = global.KMLParser.parse(await res.text());
      placemarks.forEach((pm) => {
        if (pm.name) placemarksByName.set(normalizar(pm.name), pm);
      });
    } catch (err) {
      console.error(err);
      const el = document.getElementById("mapEmpty");
      if (el) {
        el.hidden = false;
        el.textContent = "No se pudo cargar el mapa de ubicaciones.";
      }
      return false;
    }

    // KML de polígonos de secuencias: es opcional (puede no existir aún
    // en despliegues anteriores), así que un fallo aquí no bloquea el
    // resto del mapa — solo no se dibujan esos polígonos adicionales.
    try {
      const res = await fetch(SECUENCIAS_KML_FILE_PATH, { cache: "no-store" });
      if (res.ok) {
        poligonosSecuencias = global.KMLParser.parse(await res.text()).filter((pm) => pm.name);
      }
    } catch (err) {
      console.warn("No se pudo cargar el KML de polígonos de secuencias:", err.message);
    }

    return true;
  }

  /** Muestra el proyecto dado (si tiene coincidencia geográfica) en el mapa. */
  function mostrarProyecto(project) {
    if (!map) return;
    layerGroup.clearLayers();

    const pm = placemarksByName.get(normalizar(project.nombre));
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
    layer.bindTooltip(project.nombre, {
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
    secuencias.forEach((pm) => {
      if (pm.type !== "polygon" && pm.type !== "line") return;
      const secLayer =
        pm.type === "polygon"
          ? L.polygon(pm.latlngs, { color: "#c9932e", weight: 2, fillColor: "#c9932e", fillOpacity: 0.25 })
          : L.polyline(pm.latlngs, { color: "#c9932e", weight: 3 });
      secLayer.addTo(layerGroup);
      bounds = bounds.concat(pm.latlngs);
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
