/**
 * video.js (Cartera CPEL)
 * Video del proyecto: botón pequeño en la esquina superior derecha de la
 * foto que abre el visor (ventana "sheetVideo").
 *
 * El video sale de la columna "video" del Excel (opcional; vacía = sin
 * botón). Acepta:
 *   - un enlace de YouTube (watch, youtu.be, shorts), Vimeo o Google
 *     Drive (el archivo debe estar compartido con quien lo vea);
 *   - un archivo MP4 o WebM subido al repositorio, p. ej.
 *     data/VIDEOS/AMATA.mp4 (máximo 25 MB: es el límite de Cloudflare).
 *
 * fuente() es pura y la usan la página y la Action "Datos"
 * (scripts/data-rules.js); se prueba en tests/video.test.js.
 *
 * Expone: window.CarteraVideo (o module.exports en Node)
 */
(function (global) {
  const ARCHIVO = /\.(mp4|webm)$/i;
  const MAX_MB = 25;

  const url = (valor) => {
    try {
      return new URL(valor);
    } catch {
      return null;
    }
  };

  /**
   * { tipo: "iframe" | "archivo", src, origen } del valor de la columna
   * "video", o null si está vacío o no es un video que se pueda mostrar.
   */
  function fuente(valor) {
    const t = String(valor ?? "").trim();
    if (!t) return null;
    const u = /^https?:\/\//i.test(t) ? url(t) : null;
    if (!u) {
      // Archivo del repositorio (ruta relativa a la página).
      return ARCHIVO.test(t) && !/^[a-z]+:/i.test(t) && !t.startsWith("/") ? { tipo: "archivo", src: t, origen: "archivo" } : null;
    }
    const host = u.hostname.replace(/^(www|m)\./, "");
    const idOk = (id) => (id && /^[\w-]{6,}$/.test(id) ? id : null);
    if (host === "youtube.com" || host === "youtube-nocookie.com" || host === "youtu.be") {
      const partes = u.pathname.split("/").filter(Boolean);
      const id = idOk(
        host === "youtu.be" ? partes[0] : u.searchParams.get("v") || (["shorts", "embed", "live"].includes(partes[0]) ? partes[1] : null)
      );
      return id ? { tipo: "iframe", src: `https://www.youtube-nocookie.com/embed/${id}?autoplay=1&rel=0`, origen: "YouTube" } : null;
    }
    if (host === "vimeo.com" || host === "player.vimeo.com") {
      const id = u.pathname.split("/").filter((p) => /^\d+$/.test(p))[0];
      return id ? { tipo: "iframe", src: `https://player.vimeo.com/video/${id}?autoplay=1`, origen: "Vimeo" } : null;
    }
    if (host === "drive.google.com") {
      const id = idOk((/\/file\/d\/([^/]+)/.exec(u.pathname) || [])[1] || u.searchParams.get("id"));
      return id ? { tipo: "iframe", src: `https://drive.google.com/file/d/${id}/preview`, origen: "Google Drive" } : null;
    }
    // Enlace directo a un MP4/WebM en otro servidor.
    return ARCHIVO.test(u.pathname) ? { tipo: "archivo", src: u.href, origen: "enlace" } : null;
  }

  // -------------------------------------------------- Página
  /**
   * Prepara el botón y la ventana. proyecto() = proyecto mostrado.
   * Devuelve { mostrar(p) } para enseñar u ocultar el botón según el proyecto.
   */
  function instalar({ proyecto }) {
    const boton = document.getElementById("projectVideo");
    const ventana = document.getElementById("sheetVideo");
    const marco = document.getElementById("videoBody");
    if (!boton || !ventana || !marco) return { mostrar() {} };

    // Al cerrar se vacía el visor para que el video deje de sonar.
    const vaciar = () => (marco.innerHTML = "");

    boton.addEventListener("click", () => {
      const f = fuente(proyecto() && proyecto().video);
      if (!f) return;
      marco.innerHTML =
        f.tipo === "iframe"
          ? `<iframe src="${f.src}" title="Video del proyecto" allow="autoplay; encrypted-media; fullscreen; picture-in-picture" allowfullscreen></iframe>`
          : `<video src="${f.src}" controls autoplay playsinline preload="metadata"></video>`;
      global.Dialog.open(ventana, { onClose: vaciar });
    });

    return {
      mostrar(p) {
        boton.hidden = !fuente(p && p.video);
      },
    };
  }

  const api = { fuente, instalar, MAX_MB };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else global.CarteraVideo = api;
})(typeof window !== "undefined" ? window : globalThis);
