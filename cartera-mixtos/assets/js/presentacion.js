/**
 * presentacion.js
 * Botón "Presentación" de la barra superior: abre en una ventana la
 * presentación de seguimiento (presentacion/presentacion.pdf) para verla
 * y descargarla.
 *
 * El PDF y el visor (PDF.js, ~320 KB) se descargan solo al abrir la
 * ventana, no con el resto de Mixtos. Las diapositivas se dibujan
 * conforme se acercan a la pantalla y se liberan al alejarse, para no
 * llenar la memoria del celular.
 *
 * Para actualizarla basta con subir el PDF nuevo con el mismo nombre.
 *
 * Requiere: shared/dialog.js
 */
(function (global) {
  const PDF_URL = "presentacion/presentacion.pdf";
  const LIB = {
    src: "https://cdn.jsdelivr.net/npm/pdfjs-dist@3.11.174/build/pdf.min.js",
    integrity: "sha384-/1qUCSGwTur9vjf/z9lmu/eCUYbpOTgSjmpbMQZ1/CtX2v/WcAIKqRv+U1DUCG6e",
  };
  const WORKER = {
    src: "https://cdn.jsdelivr.net/npm/pdfjs-dist@3.11.174/build/pdf.worker.min.js",
    integrity: "sha384-SnzOobpRMLXZ52iJvZm/C0fYw0OQemTXzTjIsdsfMcrCtCEe9qgzxTd3RSklO5x2",
  };
  const MAX_ANCHO_PX = 1800; // tope del lienzo de cada diapositiva

  const $ = (id) => document.getElementById(id);
  const panel = $("presentacion");
  const paginas = $("presentacion-paginas");
  const estado = $("presentacion-estado");
  const info = $("presentacion-info");

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

  async function abrirDocumento() {
    const lib = await cargarVisor();
    const tarea = lib.getDocument({ url: PDF_URL, isEvalSupported: false });
    tarea.onProgress = ({ loaded, total }) => {
      if (total) estado.textContent = `Cargando presentación… ${Math.min(100, Math.round((loaded / total) * 100))} % de ${mb(total)}`;
    };
    return tarea.promise;
  }

  // ------------------------------------------------ diapositivas
  const dibujadas = new Map(); // número de página -> tarea de dibujo

  async function dibujar(hoja) {
    const n = Number(hoja.dataset.pagina);
    if (dibujadas.has(n)) return;
    const page = await doc.getPage(n);
    const base = page.getViewport({ scale: 1 });
    const anchoCss = hoja.clientWidth || base.width;
    const escala = Math.min((anchoCss * Math.min(global.devicePixelRatio || 1, 2)) / base.width, MAX_ANCHO_PX / base.width);
    const vp = page.getViewport({ scale: escala });
    const canvas = hoja.querySelector("canvas");
    hoja.style.aspectRatio = `${base.width} / ${base.height}`;
    canvas.width = Math.floor(vp.width);
    canvas.height = Math.floor(vp.height);
    const tarea = page.render({ canvasContext: canvas.getContext("2d"), viewport: vp });
    dibujadas.set(n, tarea);
    try {
      await tarea.promise;
      hoja.classList.add("is-lista");
    } catch {
      // Cancelada porque la diapositiva salió de la pantalla.
    }
  }

  function liberar(hoja) {
    const n = Number(hoja.dataset.pagina);
    const tarea = dibujadas.get(n);
    if (!tarea) return;
    tarea.cancel();
    dibujadas.delete(n);
    const canvas = hoja.querySelector("canvas");
    canvas.width = canvas.height = 0;
    hoja.classList.remove("is-lista");
  }

  let observador = null;

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
      hoja.style.aspectRatio = `${width} / ${height}`;
      hoja.innerHTML = `<canvas role="img" aria-label="Diapositiva ${n} de ${total}"></canvas>`;
      paginas.appendChild(hoja);
    }
    observador = new IntersectionObserver(
      (entradas) => entradas.forEach((e) => (e.isIntersecting ? dibujar(e.target) : liberar(e.target))),
      { root: paginas.parentElement, rootMargin: "150% 0px" }
    );
    paginas.querySelectorAll(".pres__hoja").forEach((h) => observador.observe(h));
  }

  function limpiar() {
    if (observador) observador.disconnect();
    observador = null;
    paginas.querySelectorAll(".pres__hoja").forEach(liberar);
    paginas.innerHTML = "";
  }

  async function abrir() {
    global.Dialog.open(panel, { onClose: limpiar });
    estado.hidden = false;
    estado.textContent = "Cargando presentación…";
    try {
      if (!doc) doc = await abrirDocumento();
      estado.hidden = true;
      await mostrar();
    } catch (err) {
      doc = null;
      estado.textContent =
        err && err.name === "MissingPDFException"
          ? "Aún no hay presentación publicada."
          : "No se pudo mostrar la presentación. Revisa tu conexión o descárgala con el botón de arriba.";
    }
  }

  $("presentacion-btn").addEventListener("click", abrir);
  document.addEventListener("click", (e) => {
    if (e.target.closest("[data-close-presentacion]")) global.Dialog.close(panel);
  });
})(window);
