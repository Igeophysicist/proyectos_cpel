/**
 * dialog.js (compartido por el portal, cartera-cpel y cartera-mixtos)
 * Abre y cierra paneles emergentes (bottom sheets / paneles laterales)
 * de forma accesible:
 *   - alterna la clase "is-open" y aria-hidden,
 *   - mueve el foco al panel al abrir y lo devuelve al botón que lo
 *     abrió al cerrar,
 *   - cierra el panel abierto más reciente con la tecla Escape.
 *
 * Expone: window.Dialog.open(el, { onClose }), window.Dialog.close(el)
 */
(function (global) {
  const stack = []; // [{ el, opener, onClose }] — el último es el de arriba

  const FOCUSABLE =
    'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])';

  function open(el, options = {}) {
    if (!el) return;
    if (stack.some((d) => d.el === el)) return;
    stack.push({ el, opener: document.activeElement, onClose: options.onClose });
    el.classList.add("is-open");
    el.setAttribute("aria-hidden", "false");

    const panel = el.querySelector('[role="dialog"]') || el;
    const target = panel.querySelector(FOCUSABLE) || panel;
    if (target === panel && !panel.hasAttribute("tabindex")) panel.setAttribute("tabindex", "-1");
    target.focus({ preventScroll: true });
  }

  function close(el) {
    const i = stack.findIndex((d) => d.el === el);
    if (i === -1) return;
    const [entry] = stack.splice(i, 1);
    el.classList.remove("is-open");
    el.setAttribute("aria-hidden", "true");
    if (entry.opener && document.contains(entry.opener)) entry.opener.focus({ preventScroll: true });
    if (entry.onClose) entry.onClose();
  }

  function closeTop() {
    const top = stack[stack.length - 1];
    if (top) close(top.el);
  }

  function isOpen(el) {
    return stack.some((d) => d.el === el);
  }

  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && stack.length) {
      e.preventDefault();
      closeTop();
    }
  });

  global.Dialog = { open, close, closeTop, isOpen };
})(window);
