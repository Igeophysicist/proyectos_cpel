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
 */
(function () {
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
