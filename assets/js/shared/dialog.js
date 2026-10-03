/**
 * dialog.js (compartido por el portal, cartera-cpel y cartera-mixtos)
 * Abre y cierra paneles emergentes (bottom sheets / paneles laterales)
 * de forma accesible:
 *   - alterna la clase "is-open" y aria-hidden,
 *   - mueve el foco al panel al abrir y lo devuelve al botón que lo
 *     abrió al cerrar,
 *   - cierra el panel abierto más reciente con la tecla Escape,
 *   - mantiene el foco del teclado dentro del panel abierto (Tab y
 *     Mayús+Tab dan la vuelta en vez de salir a la página de atrás),
 *   - mientras hay un panel abierto, la página de atrás no se desplaza
 *     (clase "dialogo-abierto" en <html>, ver los CSS),
 *   - en celular, los paneles que salen desde abajo se cierran
 *     deslizándolos hacia abajo (desde el encabezado o, si el contenido
 *     está hasta arriba, desde cualquier parte del panel).
 *
 * Expone: window.Dialog.open(el, { onClose }), window.Dialog.close(el)
 */
(function (global) {
  const stack = []; // [{ el, opener, onClose }] — el último es el de arriba

  const FOCUSABLE =
    'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])';

  /** Detiene (o reanuda) el desplazamiento de la página de atrás. */
  function bloquearFondo(bloquear) {
    const html = document.documentElement;
    if (bloquear) {
      // Sin barra de desplazamiento la página se ensancharía: se compensa.
      const barra = global.innerWidth - html.clientWidth;
      if (barra > 0) document.body.style.paddingRight = barra + "px";
      html.classList.add("dialogo-abierto");
    } else {
      html.classList.remove("dialogo-abierto");
      document.body.style.paddingRight = "";
    }
  }

  const panelDe = (el) => el.querySelector('[role="dialog"]') || el;

  function open(el, options = {}) {
    if (!el) return;
    if (stack.some((d) => d.el === el)) return;
    if (!stack.length) bloquearFondo(true);
    stack.push({ el, opener: document.activeElement, onClose: options.onClose });
    el.classList.add("is-open");
    el.setAttribute("aria-hidden", "false");

    const panel = panelDe(el);
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
    if (!stack.length) bloquearFondo(false);
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
    const panel = panelDe(top.el);
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

  // ------------------------------------- Deslizar hacia abajo para cerrar
  const CERRAR_PX = 110; // arrastre que cierra (o 30 % del alto del panel)
  const CERRAR_VEL = 0.6; // o un deslizamiento rápido (px/ms)
  let gesto = null;

  /**
   * Panel de la ventana de arriba si sale desde abajo (celular): ocupa
   * todo el ancho y llega al borde inferior. Los paneles laterales de la
   * computadora no se cierran deslizando.
   */
  function hojaDeAbajo() {
    const top = stack[stack.length - 1];
    if (!top) return null;
    const panel = panelDe(top.el);
    const r = panel.getBoundingClientRect();
    const deAbajo = r.left <= 1 && r.right >= global.innerWidth - 1 && r.bottom >= global.innerHeight - 2;
    return deAbajo ? { top, panel } : null;
  }

  /** Contenedor con desplazamiento propio entre el dedo y el panel. */
  function desplazable(desde, panel) {
    for (let n = desde; n && n !== panel; n = n.parentElement) {
      const oy = getComputedStyle(n).overflowY;
      if ((oy === "auto" || oy === "scroll") && n.scrollHeight > n.clientHeight + 1) return n;
    }
    return null;
  }

  function soltarPanel(panel, cerrar, el) {
    let listo = false;
    const fin = () => {
      if (listo) return;
      listo = true;
      if (cerrar) close(el);
      panel.style.transition = "";
      panel.style.transform = "";
    };
    panel.style.transition = "transform .22s ease-out";
    panel.style.transform = cerrar ? "translateY(100%)" : "";
    panel.addEventListener("transitionend", fin, { once: true });
    setTimeout(fin, 300); // por si no hay transición (menos movimiento)
  }

  document.addEventListener(
    "touchstart",
    (e) => {
      gesto = null;
      if (e.touches.length !== 1) return;
      const hoja = hojaDeAbajo();
      if (!hoja || !hoja.panel.contains(e.target)) return;
      const t = e.touches[0];
      gesto = { ...hoja, x: t.clientX, y: t.clientY, t0: e.timeStamp, dy: 0, arrastrando: false, scroller: desplazable(e.target, hoja.panel) };
    },
    { passive: true }
  );

  document.addEventListener(
    "touchmove",
    (e) => {
      if (!gesto) return;
      const t = e.touches[0];
      const dy = t.clientY - gesto.y;
      const dx = t.clientX - gesto.x;
      if (!gesto.arrastrando) {
        const bajando = dy > 0 && dy >= Math.abs(dx);
        const enTope = !gesto.scroller || gesto.scroller.scrollTop <= 0;
        // Hacia arriba, de lado o con el contenido desplazado: scroll normal.
        if (!bajando || !enTope) {
          if (!enTope || dy < -4 || Math.abs(dx) > 4) gesto = null;
          return;
        }
        if (e.cancelable) e.preventDefault(); // sin rebote nativo mientras decide
        if (dy < 6) return;
        gesto.arrastrando = true;
        gesto.panel.style.transition = "none";
      }
      if (e.cancelable) e.preventDefault();
      gesto.dy = Math.max(0, dy);
      gesto.panel.style.transform = `translateY(${gesto.dy}px)`;
    },
    { passive: false }
  );

  function finGesto(e) {
    const g = gesto;
    gesto = null;
    if (!g || !g.arrastrando) return;
    const vel = g.dy / Math.max(1, e.timeStamp - g.t0);
    const cerrar = g.dy > Math.min(CERRAR_PX, g.panel.offsetHeight * 0.3) || (vel > CERRAR_VEL && g.dy > 30);
    soltarPanel(g.panel, cerrar, g.top.el);
  }
  document.addEventListener("touchend", finGesto);
  document.addEventListener("touchcancel", () => {
    if (gesto && gesto.arrastrando) soltarPanel(gesto.panel, false);
    gesto = null;
  });

  global.Dialog = { open, close, closeTop, isOpen };
})(window);
