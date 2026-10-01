/**
 * share.js (compartido por cartera-cpel y cartera-mixtos)
 * Comparte un enlace directo (a un proyecto o a una vista filtrada):
 *   - en el celular abre el menú nativo de compartir (WhatsApp, correo…);
 *   - si el navegador no lo tiene (p. ej. escritorio), copia el enlace
 *     al portapapeles y muestra un aviso breve.
 * Es importante en la app instalada, que no muestra barra de direcciones.
 *
 * Expone: window.Share.link({ url, title })
 */
(function (global) {
  let toastEl = null;
  let toastTimer = null;

  function toast(message) {
    if (!toastEl) {
      toastEl = document.createElement("div");
      toastEl.setAttribute("role", "status");
      toastEl.style.cssText =
        "position:fixed; left:50%; bottom:calc(84px + env(safe-area-inset-bottom, 0px)); transform:translateX(-50%);" +
        "z-index:3000; background:#234240; color:#fff; padding:10px 16px; border-radius:10px; font-size:13px;" +
        "font-weight:600; box-shadow:0 8px 28px rgba(26,36,34,.25); max-width:calc(100% - 32px); text-align:center;";
      document.body.appendChild(toastEl);
    }
    toastEl.textContent = message;
    toastEl.hidden = false;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => (toastEl.hidden = true), 2500);
  }

  async function link({ url, title }) {
    if (navigator.share) {
      try {
        await navigator.share({ url, title });
        return;
      } catch (err) {
        if (err && err.name === "AbortError") return; // la persona canceló
      }
    }
    try {
      await navigator.clipboard.writeText(url);
      toast("Enlace copiado");
    } catch {
      window.prompt("Copia el enlace:", url);
    }
  }

  global.Share = { link };
})(window);
