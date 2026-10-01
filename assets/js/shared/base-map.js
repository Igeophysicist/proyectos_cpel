/**
 * base-map.js (compartido por cartera-cpel y cartera-mixtos)
 * Crea un mapa Leaflet con la configuración común a ambos tableros:
 * zoom abajo a la derecha, dos capas base (satelital de Esri por
 * defecto y calles de OpenStreetMap) con su selector, y un aviso no
 * bloqueante cuando las imágenes del mapa no cargan.
 *
 * Expone: window.BaseMap.create(elementId, { tileWarningId }) -> L.Map
 * Cada tablero decide después la vista inicial (setView / fitBounds).
 */
(function (global) {
  function create(elementId, options = {}) {
    const map = L.map(elementId, { zoomControl: false, attributionControl: true });

    L.control.zoom({ position: "bottomright" }).addTo(map);

    const capaSatelital = L.tileLayer(
      "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
      { attribution: "Tiles &copy; Esri", maxZoom: 18 }
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

    // Aviso si las imágenes del mapa no cargan (red/CDN bloqueados). Los
    // proyectos siguen visibles porque no dependen de esas imágenes.
    const warning = options.tileWarningId ? document.getElementById(options.tileWarningId) : null;
    if (warning) {
      let avisado = false;
      const avisar = () => {
        if (avisado) return;
        avisado = true;
        warning.hidden = false;
      };
      capaSatelital.on("tileerror", avisar);
      capaCalles.on("tileerror", avisar);
      // Al cambiar de capa, un fallo de la nueva capa vuelve a avisar.
      map.on("baselayerchange", () => {
        avisado = false;
        warning.hidden = true;
      });
    }

    return map;
  }

  global.BaseMap = { create };
})(window);
