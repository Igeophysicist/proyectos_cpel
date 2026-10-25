/**
 * plegable.js (Cartera CPEL y Cartera Anteproyectos)
 * Textos largos (Eventos importantes, Descripción técnica): se muestran
 * las primeras líneas y un botón "Ver más" abre el resto ("Ver menos" lo
 * vuelve a cerrar). Si el texto es corto, no aparece el botón. En el PDF
 * el texto sale completo (ver .plegable en cartera.css).
 *
 * Expone: window.Plegable.aplicar(el) — llamarlo cada vez que cambia el texto.
 */
(function (global) {
  function aplicar(el) {
    if (!el) return;
    const previo = el.nextElementSibling;
    if (previo && previo.classList.contains("plegable__btn")) previo.remove();
    el.classList.add("plegable", "is-plegado");
    // Sin desbordar no hace falta el botón.
    if (el.scrollHeight <= el.clientHeight + 4) {
      el.classList.remove("is-plegado");
      return;
    }
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "plegable__btn";
    btn.setAttribute("aria-expanded", "false");
    btn.textContent = "Ver más";
    btn.addEventListener("click", () => {
      const abierto = el.classList.toggle("is-plegado") === false;
      btn.textContent = abierto ? "Ver menos" : "Ver más";
      btn.setAttribute("aria-expanded", String(abierto));
    });
    el.after(btn);
  }

  global.Plegable = { aplicar };
})(window);
