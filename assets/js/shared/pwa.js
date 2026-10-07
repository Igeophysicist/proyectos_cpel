/**
 * pwa.js (compartido por el portal, cartera-cpel y cartera-mixtos)
 * Registra el Service Worker de la raíz (sw.js), que permite instalar
 * el sitio como app y abrirlo sin conexión mostrando siempre la versión
 * más reciente cuando hay red.
 *
 * Las rutas se calculan a partir de la ubicación de este archivo
 * (assets/js/shared/), así que funciona igual en la raíz de Cloudflare
 * Pages que bajo una subruta de GitHub Pages.
 *
 * Al pulsar "Salir" se borra todo lo guardado en el dispositivo y se
 * desactiva el Service Worker antes de cerrar la sesión (se vuelve a
 * activar solo al entrar de nuevo con la contraseña).
 *
 * window.PWA.recargarSiHayRed(): si una página no pudo cargar, la recarga
 * UNA vez (si hay conexión). Repara el caso de la app instalada que abre
 * la copia guardada de la página (p. ej. sin red al despertar) y luego
 * baja scripts más nuevos que esa copia: versiones mezcladas. Al recargar
 * se pide la página actual. Si vuelve a fallar en menos de un minuto, ya
 * no recarga (no hay bucles) y la página muestra su mensaje de error.
 */
(function () {
  const CLAVE = "pwa-recarga";
  window.PWA = {
    recargarSiHayRed() {
      if (navigator.onLine === false) return false;
      try {
        const ultima = Number(sessionStorage.getItem(CLAVE)) || 0;
        if (Date.now() - ultima < 60000) return false;
        sessionStorage.setItem(CLAVE, String(Date.now()));
      } catch {
        return false; // sin sessionStorage no se puede evitar un bucle
      }
      window.location.reload();
      return true;
    },
  };

  // Lo mismo si un script del sitio falla mientras la página carga (p. ej.
  // usa un archivo nuevo que la copia vieja de la página no incluye).
  let cargando = true;
  window.addEventListener("load", () => setTimeout(() => (cargando = false), 0));
  window.addEventListener("error", (e) => {
    if (!cargando || !(e.error instanceof TypeError || e.error instanceof ReferenceError)) return;
    try {
      if (new URL(e.filename).origin !== window.location.origin) return;
    } catch {
      return;
    }
    window.PWA.recargarSiHayRed();
  });

  if (!("serviceWorker" in navigator)) return;

  const siteRoot = new URL("../../../", document.currentScript.src);

  window.addEventListener("load", () => {
    navigator.serviceWorker
      .register(new URL("sw.js", siteRoot), { scope: siteRoot.pathname, updateViaCache: "none" })
      .catch((err) => console.warn("No se pudo registrar el Service Worker:", err.message));
  });

  // "Salir": borrar las copias guardadas y desactivar el Service Worker
  // antes de ir a /__logout, para que nadie más pueda ver páginas
  // guardadas en este dispositivo.
  document.addEventListener("click", async (e) => {
    const link = e.target.closest('a[href$="__logout"]');
    if (!link) return;
    e.preventDefault();
    try {
      const registrations = await navigator.serviceWorker.getRegistrations();
      await Promise.all(registrations.map((r) => r.unregister()));
      if (window.caches) {
        const names = await caches.keys();
        await Promise.all(names.map((n) => caches.delete(n)));
      }
    } catch (err) {
      console.warn("No se pudo limpiar lo guardado en el dispositivo:", err.message);
    }
    window.location.href = link.href;
  });
})();
