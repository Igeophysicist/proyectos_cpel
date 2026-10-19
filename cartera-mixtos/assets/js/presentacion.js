/**
 * presentacion.js
 * Botón "Presentación" (barra de abajo en celular, barra superior en
 * computadora): abre en una ventana la presentación de seguimiento
 * (presentacion/presentación_mixtos.pdf) para verla y descargarla.
 *
 * El PDF y el visor (PDF.js, ~320 KB) se descargan solo al abrir la
 * ventana, no con el resto de Mixtos. Las diapositivas se dibujan
 * conforme se acercan a la pantalla y se liberan al alejarse, para no
 * llenar la memoria del celular. Al hacer zoom con los dedos, las que se
 * ven se vuelven a dibujar con más resolución (no se pixelean).
 *
 * Para actualizarla basta con subir el PDF nuevo con el mismo nombre.
 *
 * Requiere: shared/dialog.js
 */
(function (global) {
  // El nombre lleva acento: según el equipo desde el que se suba, la "ó"
  // puede quedar guardada de dos formas (NFC/NFD); se prueban ambas y,
  // por si acaso, sin acento.
  const NOMBRE = "presentación_mixtos.pdf";
  const CANDIDATOS = [...new Set([NOMBRE.normalize("NFC"), NOMBRE.normalize("NFD"), "presentacion_mixtos.pdf"])].map(
    (n) => "presentacion/" + encodeURIComponent(n)
  );
  const LIB = {
    src: "https://cdn.jsdelivr.net/npm/pdfjs-dist@3.11.174/build/pdf.min.js",
    integrity: "sha384-/1qUCSGwTur9vjf/z9lmu/eCUYbpOTgSjmpbMQZ1/CtX2v/WcAIKqRv+U1DUCG6e",
  };
  const WORKER = {
    src: "https://cdn.jsdelivr.net/npm/pdfjs-dist@3.11.174/build/pdf.worker.min.js",
    integrity: "sha384-SnzOobpRMLXZ52iJvZm/C0fYw0OQemTXzTjIsdsfMcrCtCEe9qgzxTd3RSklO5x2",
  };
  const MAX_ANCHO_PX = 1800; // tope del lienzo de cada diapositiva sin zoom
  const MAX_AREA_ZOOM = 8e6; // tope (píxeles) de una diapositiva con zoom; los celulares no dan para más

  const $ = (id) => document.getElementById(id);
  const panel = $("presentacion");
  const paginas = $("presentacion-paginas");
  const estado = $("presentacion-estado");
  const info = $("presentacion-info");
  const descargar = panel.querySelector(".pres__descargar");

  let libPromise = null;
  let doc = null; // documento ya abierto (se reutiliza al volver a abrir)

  function cargarScript({ src, integrity }) {
    return new Promise((resolve, reject) => {
      const s = document.createElement("script");
      s.src = src;
      s.integrity = integrity;
      s.crossOrigin = "anonymous";
      s.onload = resolve;
      s.onerror = () => reject(new Error("No se pudo cargar el visor"));
      document.head.appendChild(s);
    });
  }

  /** PDF.js y su worker (el worker se baja comprobando su huella SRI). */
  function cargarVisor() {
    if (!libPromise) {
      libPromise = Promise.all([
        cargarScript(LIB),
        fetch(WORKER.src, { integrity: WORKER.integrity, mode: "cors" }).then((r) => {
          if (!r.ok) throw new Error("No se pudo cargar el visor");
          return r.blob();
        }),
      ])
        .then(([, worker]) => {
          const lib = global.pdfjsLib;
          lib.GlobalWorkerOptions.workerSrc = URL.createObjectURL(new Blob([worker], { type: "text/javascript" }));
          return lib;
        })
        .catch((err) => {
          libPromise = null; // permite reintentar
          throw err;
        });
    }
    return libPromise;
  }

  const mb = (bytes) => `${(bytes / 1048576).toFixed(1)} MB`;

  /** Primera dirección de CANDIDATOS que existe; null si no hay PDF. */
  async function buscarPdf() {
    for (const url of CANDIDATOS) {
      try {
        const r = await fetch(url, { method: "HEAD", cache: "no-cache" });
        if (r.ok) return url;
      } catch {
        // Sin conexión: se intenta la siguiente y luego se avisa.
      }
    }
    return null;
  }

  async function abrirDocumento() {
    const [lib, url] = await Promise.all([cargarVisor(), buscarPdf()]);
    if (!url) throw Object.assign(new Error("Sin PDF"), { name: "MissingPDFException" });
    descargar.href = url;
    const tarea = lib.getDocument({ url, isEvalSupported: false });
    tarea.onProgress = ({ loaded, total }) => {
      if (total) estado.textContent = `Cargando presentación… ${Math.min(100, Math.round((loaded / total) * 100))} % de ${mb(total)}`;
    };
    return tarea.promise;
  }

  // ------------------------------------------------ diapositivas
  const dibujadas = new Map(); // número de página -> { tarea, ancho }
  const enPantalla = new Set(); // diapositivas visibles ahora mismo

  /** Zoom con los dedos (1 = sin zoom). */
  const zoom = () => Math.max(1, (global.visualViewport && global.visualViewport.scale) || 1);

  /**
   * Dibuja la diapositiva al ancho que ocupa en pantalla × densidad de la
   * pantalla × zoom (el zoom solo para las que se ven: las demás quedan a
   * resolución normal para no gastar memoria).
   */
  async function dibujar(hoja) {
    const n = Number(hoja.dataset.pagina);
    const page = await doc.getPage(n);
    const base = page.getViewport({ scale: 1 });
    const anchoCss = hoja.clientWidth || base.width;
    const dpr = Math.min(global.devicePixelRatio || 1, 2);
    const z = enPantalla.has(hoja) ? zoom() : 1;
    let escala = Math.min((anchoCss * dpr) / base.width, MAX_ANCHO_PX / base.width);
    if (z > 1) escala = Math.min((anchoCss * dpr * z) / base.width, Math.sqrt(MAX_AREA_ZOOM / (base.width * base.height)));
    const ancho = Math.floor(base.width * escala);
    const previa = dibujadas.get(n);
    if (previa && previa.ancho >= ancho) return; // ya está igual o más nítida
    if (previa) previa.tarea.cancel();

    const vp = page.getViewport({ scale: escala });
    // Se dibuja en un lienzo aparte y luego se cambia: así no se ve en
    // blanco mientras se redibuja con más resolución.
    const canvas = document.createElement("canvas");
    canvas.width = Math.floor(vp.width);
    canvas.height = Math.floor(vp.height);
    canvas.setAttribute("role", "img");
    canvas.setAttribute("aria-label", hoja.dataset.etiqueta);
    hoja.style.aspectRatio = `${base.width} / ${base.height}`;
    const tarea = page.render({ canvasContext: canvas.getContext("2d"), viewport: vp });
    dibujadas.set(n, { tarea, ancho });
    try {
      await tarea.promise;
    } catch {
      return; // Cancelada (salió de la pantalla o se redibuja).
    }
    const vieja = hoja.querySelector("canvas");
    if (vieja) {
      vieja.width = vieja.height = 0;
      vieja.replaceWith(canvas);
    } else hoja.appendChild(canvas);
    hoja.classList.add("is-lista");
  }

  function liberar(hoja) {
    const n = Number(hoja.dataset.pagina);
    const previa = dibujadas.get(n);
    if (!previa) return;
    previa.tarea.cancel();
    dibujadas.delete(n);
    const canvas = hoja.querySelector("canvas");
    if (canvas) {
      canvas.width = canvas.height = 0;
      canvas.remove();
    }
    hoja.classList.remove("is-lista");
  }

  // Al terminar un zoom, las diapositivas que se ven se redibujan nítidas.
  let esperaZoom = null;
  function alHacerZoom() {
    if (!panel.classList.contains("is-open")) return;
    clearTimeout(esperaZoom);
    esperaZoom = setTimeout(() => enPantalla.forEach((h) => dibujadas.has(Number(h.dataset.pagina)) && dibujar(h)), 250);
  }
  if (global.visualViewport) global.visualViewport.addEventListener("resize", alHacerZoom);

  let observador = null;
  let vista = null; // marca qué diapositivas se ven (sin margen)

  async function mostrar() {
    paginas.innerHTML = "";
    const primera = await doc.getPage(1);
    const { width, height } = primera.getViewport({ scale: 1 });
    const total = doc.numPages;
    info.textContent = `${total} diapositiva${total === 1 ? "" : "s"}`;
    for (let n = 1; n <= total; n++) {
      const hoja = document.createElement("div");
      hoja.className = "pres__hoja";
      hoja.dataset.pagina = n;
      hoja.dataset.etiqueta = `Diapositiva ${n} de ${total}`;
      hoja.style.aspectRatio = `${width} / ${height}`;
      paginas.appendChild(hoja);
    }
    vista = new IntersectionObserver((entradas) =>
      entradas.forEach((e) => {
        if (!e.isIntersecting) return enPantalla.delete(e.target);
        enPantalla.add(e.target);
        if (zoom() > 1) dibujar(e.target); // con zoom, la que entra se dibuja nítida
      })
    );
    observador = new IntersectionObserver(
      (entradas) => entradas.forEach((e) => (e.isIntersecting ? dibujar(e.target) : liberar(e.target))),
      { root: paginas.parentElement, rootMargin: "150% 0px" }
    );
    paginas.querySelectorAll(".pres__hoja").forEach((h) => {
      vista.observe(h);
      observador.observe(h);
    });
  }

  function limpiar() {
    if (observador) observador.disconnect();
    if (vista) vista.disconnect();
    observador = vista = null;
    enPantalla.clear();
    paginas.querySelectorAll(".pres__hoja").forEach(liberar);
    paginas.innerHTML = "";
  }

  async function abrir() {
    global.Dialog.open(panel, { onClose: limpiar });
    estado.hidden = false;
    estado.textContent = "Cargando presentación…";
    try {
      descargar.hidden = false;
      if (!doc) doc = await abrirDocumento();
      estado.hidden = true;
      await mostrar();
    } catch (err) {
      doc = null;
      descargar.hidden = err && err.name === "MissingPDFException";
      estado.textContent =
        err && err.name === "MissingPDFException"
          ? "Aún no hay presentación publicada."
          : "No se pudo mostrar la presentación. Revisa tu conexión e inténtalo de nuevo.";
    }
  }

  document.addEventListener("click", (e) => {
    if (e.target.closest("[data-open-presentacion]")) abrir();
    else if (e.target.closest("[data-close-presentacion]")) global.Dialog.close(panel);
  });
})(window);
