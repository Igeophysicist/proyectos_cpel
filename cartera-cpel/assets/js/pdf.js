/**
 * pdf.js (Cartera CPEL)
 * Botón "PDF": la ficha del proyecto en una hoja carta.
 *
 *  - Computadora: abre la impresión del navegador (ahí se elige
 *    "Guardar como PDF" o una impresora). También funciona Ctrl+P.
 *  - Celular: genera el archivo PDF en la página y lo entrega con el
 *    menú de compartir del teléfono (guardar en Archivos, WhatsApp,
 *    correo…) o, si no hay, lo descarga. Se hace así porque en el
 *    celular window.print() no hace nada en varios casos (sitio
 *    instalado como app en iPhone, navegadores dentro de WhatsApp,
 *    Teams, Gmail…).
 *
 * Siempre sale en UNA hoja: ancho carta y, si el contenido no cabe en
 * el alto carta, la hoja se alarga (en vez de cortarse en dos).
 *
 * Ambas salidas usan los estilos de body.modo-pdf (cartera.css). Las
 * librerías del archivo (html2canvas + jsPDF, ~560 KB) se descargan solo
 * la primera vez que se genera un PDF en el celular.
 *
 * Requiere: shared/text-utils.js.
 * Expone: window.CarteraPdf.init({ nombre: () => "nombre del proyecto" })
 */
(function (global) {
  const LIBS = [
    {
      src: "https://cdn.jsdelivr.net/npm/html2canvas@1.4.1/dist/html2canvas.min.js",
      integrity: "sha384-ZZ1pncU3bQe8y31yfZdMFdSpttDoPmOZg2wguVK9almUodir1PghgT0eY7Mrty8H",
    },
    {
      src: "https://cdn.jsdelivr.net/npm/jspdf@2.5.2/dist/jspdf.umd.min.js",
      integrity: "sha384-en/ztfPSRkGfME4KIm05joYXynqzUgbsG5nMrj/xEFAHXkeZfO3yMK8QQ+mP7p1/",
    },
  ];
  // Hoja carta: 612 x 792 pt (215.9 x 279.4 mm), márgenes de 9 mm.
  const PAGE = { w: 612, h: 792, margin: 25.5 };
  const PAGE_MM = { w: 215.9, h: 279.4, margin: 9 };
  // Ancho del contenido de la hoja en píxeles CSS (216 mm - 18 mm a 96 dpi),
  // para que el archivo se vea igual que la impresión.
  const CONTENT_PX = 748;

  const $ = (id) => document.getElementById(id);
  const { slugify } = global.TextUtils;

  let nombreProyecto = () => "";
  let libsPromise = null;
  let pendiente = null; // archivo listo para compartir si el teléfono pidió otro toque

  // ---------------------------------------------------------- contenido
  /** Copia Ficha técnica y Plazos a la hoja y pone la fecha. */
  function preparar() {
    $("printFicha").innerHTML = $("fichaBody").innerHTML;
    $("printPlazos").innerHTML = $("plazosBody").innerHTML;
    $("printDate").textContent =
      "Impreso el " + new Date().toLocaleDateString("es-MX", { day: "numeric", month: "long", year: "numeric" });
  }

  function cerrarVentanas() {
    document.querySelectorAll(".sheet.is-open").forEach((el) => global.Dialog.close(el));
  }

  // ---------------------------------------------------- computadora
  function imprimir() {
    cerrarVentanas();
    global.print(); // beforeprint/afterprint activan y quitan el modo PDF
  }

  /**
   * Alto (mm) de la hoja impresa para que todo quepa en una: se mide la
   * ficha en modo PDF al ancho de la hoja y se fija con @page.
   */
  function ajustarHojaImpresa() {
    const root = $("pdfRoot");
    root.style.width = CONTENT_PX + "px";
    const altoPx = root.scrollHeight;
    root.style.width = "";
    const altoMm = Math.max(PAGE_MM.h, Math.ceil((altoPx * 25.4) / 96 + 2 * PAGE_MM.margin + 2));
    let estilo = $("pdfPageSize");
    if (!estilo) {
      estilo = document.createElement("style");
      estilo.id = "pdfPageSize";
      document.head.appendChild(estilo);
    }
    estilo.textContent = `@page{ size: ${PAGE_MM.w}mm ${altoMm}mm; margin: ${PAGE_MM.margin}mm; }`;
  }

  // --------------------------------------------------------- celular
  function cargarScript({ src, integrity }) {
    return new Promise((resolve, reject) => {
      const s = document.createElement("script");
      s.src = src;
      s.integrity = integrity;
      s.crossOrigin = "anonymous";
      s.onload = resolve;
      s.onerror = () => reject(new Error("No se pudo cargar " + src));
      document.head.appendChild(s);
    });
  }

  function cargarLibrerias() {
    if (global.html2canvas && global.jspdf) return Promise.resolve();
    if (!libsPromise) {
      libsPromise = Promise.all(LIBS.map(cargarScript)).catch((err) => {
        libsPromise = null; // permite reintentar
        throw err;
      });
    }
    return libsPromise;
  }

  const hoy = () => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  };

  /** Dibuja la hoja (modo PDF, solo en una copia de la página) y arma el archivo. */
  async function crearArchivo() {
    await cargarLibrerias();
    preparar();
    // Se captura el contenido completo (aunque algo quedara más ancho que
    // la hoja, no se corta: la imagen se ajusta al ancho de la página).
    const canvas = await global.html2canvas($("pdfRoot"), {
      scale: 2,
      windowWidth: CONTENT_PX,
      backgroundColor: "#ffffff",
      logging: false,
      onclone: (doc) => {
        doc.documentElement.style.webkitTextSizeAdjust = "100%";
        doc.body.classList.add("modo-pdf");
        doc.getElementById("pdfRoot").style.width = CONTENT_PX + "px";
      },
    });

    // Una sola hoja: ancho carta y el alto que haga falta (mínimo carta).
    const anchoPt = PAGE.w - 2 * PAGE.margin;
    const altoPt = (canvas.height * anchoPt) / canvas.width;
    const altoHoja = Math.max(PAGE.h, altoPt + 2 * PAGE.margin);
    const pdf = new global.jspdf.jsPDF({ unit: "pt", format: [PAGE.w, altoHoja], orientation: "portrait" });
    pdf.addImage(canvas.toDataURL("image/jpeg", 0.92), "JPEG", PAGE.margin, PAGE.margin, anchoPt, altoPt);

    const nombre = `Cartera_${slugify(nombreProyecto()) || "proyecto"}_${hoy()}.pdf`;
    return new File([pdf.output("blob")], nombre, { type: "application/pdf" });
  }

  function descargar(file) {
    const url = URL.createObjectURL(file);
    const a = document.createElement("a");
    a.href = url;
    a.download = file.name;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 60000);
  }

  /** Menú de compartir del teléfono; si no existe, descarga. */
  async function entregar(file) {
    if (navigator.canShare && navigator.canShare({ files: [file] })) {
      try {
        await navigator.share({ files: [file], title: file.name });
        return;
      } catch (err) {
        if (err.name === "AbortError") return; // la persona cerró el menú
        // Algunos teléfonos piden que compartir sea justo después de un toque:
        // el botón queda en "Compartir PDF" y el siguiente toque lo abre.
        if (err.name === "NotAllowedError") {
          pendiente = file;
          etiqueta("Compartir PDF");
          return;
        }
      }
    }
    descargar(file);
  }

  // ----------------------------------------------------------- botón
  function etiqueta(texto) {
    $("printBtn").querySelector("span").textContent = texto;
  }

  const esCelular = () => global.matchMedia("(pointer: coarse)").matches;

  async function alTocar() {
    const btn = $("printBtn");
    if (pendiente) {
      const file = pendiente;
      pendiente = null;
      etiqueta("PDF");
      // Si cambió de proyecto mientras tanto, se genera de nuevo.
      if (file.name.startsWith(`Cartera_${slugify(nombreProyecto())}_`)) return entregar(file);
    }
    if (!esCelular()) return imprimir();

    cerrarVentanas();
    btn.disabled = true;
    etiqueta("Generando…");
    try {
      const file = await crearArchivo();
      etiqueta("PDF");
      await entregar(file);
    } catch (err) {
      console.error(err);
      etiqueta("PDF");
      global.alert("No se pudo generar el PDF. Revisa tu conexión e inténtalo de nuevo.");
    } finally {
      btn.disabled = false;
    }
  }

  function init({ nombre }) {
    nombreProyecto = nombre;
    $("printBtn").addEventListener("click", alTocar);
    // Impresión del navegador (botón en computadora o Ctrl+P).
    global.addEventListener("beforeprint", () => {
      preparar();
      document.body.classList.add("modo-pdf");
      ajustarHojaImpresa();
    });
    global.addEventListener("afterprint", () => document.body.classList.remove("modo-pdf"));
  }

  global.CarteraPdf = { init };
})(window);
