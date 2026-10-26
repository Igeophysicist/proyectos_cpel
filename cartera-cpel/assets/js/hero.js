/**
 * hero.js (Cartera CPEL y Cartera Anteproyectos)
 * Foto del proyecto en la tarjeta de arriba. Si el proyecto no tiene foto
 * (o no carga), en lugar de un bloque liso se ve un fondo con el ícono de
 * su tecnología: solar, eólica, hidroeléctrica u otra.
 *
 * Expone: window.CarteraHero.foto(hero, img, src, tecnologia)
 *         window.CarteraHero.tipo(tecnologia) -> "solar" | "eolica" | "hidro" | "otra"
 */
(function (global) {
  const { normalizeText } = global.TextUtils;

  /** Tipo de tecnología a partir del texto del Excel ("Fotovoltaico", "Equipamiento Hidroeléctrico"…). */
  function tipo(tecnologia) {
    const t = normalizeText(tecnologia || "");
    if (/FOTOVOLT|SOLAR|\bFV\b|TERMOSOLAR/.test(t)) return "solar";
    if (/EOLIC|VIENTO|\bEO\b/.test(t)) return "eolica";
    if (/HIDRO/.test(t)) return "hidro";
    return "otra";
  }

  const trazo = (d) => `<path d="${d}" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/>`;
  const ICONOS = {
    solar: `<circle cx="12" cy="12" r="4" stroke="currentColor" stroke-width="1.6"/>${trazo("M12 2.5v2M12 19.5v2M2.5 12h2M19.5 12h2M5.3 5.3l1.4 1.4M17.3 17.3l1.4 1.4M5.3 18.7l1.4-1.4M17.3 6.7l1.4-1.4")}`,
    eolica: `${trazo("M12 11v10M9.5 21h5")}<circle cx="12" cy="9" r="1.5" stroke="currentColor" stroke-width="1.6"/>${trazo("M12 7.5V2.5M13.3 9.8l4.3 2.5M10.7 9.8l-4.3 2.5")}`,
    hidro: `${trazo("M12 3.5c3 4 5 6.6 5 9.2a5 5 0 0 1-10 0c0-2.6 2-5.2 5-9.2Z")}${trazo("M3 20c1.5 1 3 1 4.5 0s3-1 4.5 0 3 1 4.5 0 3-1 4.5 0")}`,
    otra: trazo("M13 2.5 5 13.5h6l-1 8 8-11h-6l1-8Z"),
  };

  /** Muestra la foto, o el fondo con el ícono si no hay foto o no carga. */
  function foto(hero, img, src, tecnologia) {
    let icono = hero.querySelector(".hero-card__icono");
    if (!icono) {
      hero.insertAdjacentHTML("afterbegin", `<span class="hero-card__icono" aria-hidden="true"></span>`);
      icono = hero.querySelector(".hero-card__icono");
    }
    icono.innerHTML = `<svg viewBox="0 0 24 24" fill="none">${ICONOS[tipo(tecnologia)]}</svg>`;
    const sinFoto = () => {
      hero.classList.add("hero-card--sinfoto");
      img.style.visibility = "hidden";
    };
    img.onerror = sinFoto;
    hero.classList.remove("hero-card--sinfoto");
    if (src) {
      img.src = src;
      img.style.visibility = "visible";
    } else {
      img.removeAttribute("src");
      sinFoto();
    }
  }

  global.CarteraHero = { foto, tipo };
})(window);
