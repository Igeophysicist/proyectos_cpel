/**
 * dialog.js (compartido por el portal, cartera-cpel y cartera-mixtos)
 * Abre y cierra paneles emergentes (bottom sheets / paneles laterales)
 * de forma accesible:
 *   - alterna la clase "is-open" y aria-hidden,
 *   - mueve el foco al panel al abrir y lo devuelve al botón que lo
 *     abrió al cerrar,
 *   - cierra el panel abierto más reciente con la tecla Escape,
 *   - mantiene el foco del teclado dentro del panel abierto (Tab y
 *     Mayús+Tab dan la vuelta en vez de salir a la página de atrás).
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

  /** Elementos enfocables y visibles del panel (en orden de tabulación). */
  function focusables(panel) {
    return Array.from(panel.querySelectorAll(FOCUSABLE)).filter((el) => el.getClientRects().length);
  }

  function trapTab(e) {
    const top = stack[stack.length - 1];
    const panel = top.el.querySelector('[role="dialog"]') || top.el;
    const items = focusables(panel);
    if (!items.length) {
      e.preventDefault();
      panel.focus({ preventScroll: true });
      return;
    }
    const first = items[0];
    const last = items[items.length - 1];
    const dentro = panel.contains(document.activeElement);
    if (e.shiftKey && (!dentro || document.activeElement === first || document.activeElement === panel)) {
      e.preventDefault();
      last.focus();
    } else if (!e.shiftKey && (!dentro || document.activeElement === last)) {
      e.preventDefault();
      first.focus();
    }
  }

  document.addEventListener("keydown", (e) => {
    if (!stack.length) return;
    if (e.key === "Escape") {
      e.preventDefault();
      closeTop();
    } else if (e.key === "Tab") {
      trapTab(e);
    }
  });

  global.Dialog = { open, close, closeTop, isOpen };
})(window);
