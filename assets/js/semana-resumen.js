/**
 * semana-resumen.js
 * Cálculo de la sección "Esta semana" del portal a partir de los
 * historial.json de cada tablero (ver scripts/historial.js). Funciones
 * puras (se prueban en tests/semana-resumen.test.js); semana-portal.js
 * las pinta.
 *
 *  - Mixtos (se actualiza lunes, miércoles y viernes, 3 a 5 proyectos):
 *    proyectos cuyo avance de Parque cambió entre el último corte y el
 *    anterior, y si su grupo de atención cambió o se mantuvo.
 *  - Cartera CPEL (corte cada jueves): Real y Programado de cada proyecto
 *    en el último corte y el cambio del Real contra el corte anterior.
 *
 * Fechas como "AAAA-MM-DD" (las del historial).
 * Expone: window.SemanaResumen (o module.exports en Node)
 */
(function (global) {
  const UMBRAL = 0.005; // diferencias menores son redondeo, no cambio
  const DAY_MS = 86400000;

  const toUTC = (s) => {
    const [y, m, d] = s.split("-").map(Number);
    return Date.UTC(y, m - 1, d);
  };
  const fromUTC = (t) => new Date(t).toISOString().slice(0, 10);
  /** Lunes ("AAAA-MM-DD") de la semana de una fecha. */
  const lunesDe = (s) => {
    const t = toUTC(s);
    return fromUTC(t - ((new Date(t).getUTCDay() + 6) % 7) * DAY_MS);
  };
  const sumarDias = (s, n) => fromUTC(toUTC(s) + n * DAY_MS);
  const num = (v) => (Number.isFinite(v) ? v : null);

  /**
   * cortes: historial de Mixtos; nombres: { slug: nombre visible };
   * hoy: "AAAA-MM-DD". Devuelve null si aún no hay dos cortes.
   */
  function resumenMixtos(cortes, nombres, hoy) {
    if (!cortes || cortes.length < 2) return null;
    const ultimo = cortes[cortes.length - 1];
    const previo = cortes[cortes.length - 2];
    const cambios = [];
    Object.keys(ultimo.proyectos).forEach((slug) => {
      const ahora = ultimo.proyectos[slug];
      const antes = previo.proyectos[slug];
      if (!antes || num(ahora.parque) === null || num(antes.parque) === null) return;
      const diff = ahora.parque - antes.parque;
      if (Math.abs(diff) <= UMBRAL) return;
      cambios.push({
        slug,
        nombre: nombres[slug] || slug,
        antes: antes.parque,
        ahora: ahora.parque,
        diff,
        grupoAntes: antes.grupo || null,
        grupoAhora: ahora.grupo || null,
      });
    });
    cambios.sort((a, b) => b.diff - a.diff);
    const lunes = lunesDe(ultimo.fecha);
    return {
      semanaIni: lunes,
      semanaFin: sumarDias(lunes, 6),
      esActual: lunes === lunesDe(hoy),
      fecha: ultimo.fecha,
      desde: previo.fecha,
      cambios,
    };
  }

  /**
   * cortes: historial de Cartera; proyectos: [{ slug, nombre }] en el orden
   * del Excel. Devuelve null si no hay cortes.
   */
  function resumenCartera(cortes, proyectos) {
    if (!cortes || !cortes.length) return null;
    const ultimo = cortes[cortes.length - 1];
    const previo = cortes.length > 1 ? cortes[cortes.length - 2] : null;
    const filas = proyectos
      .filter((p) => ultimo.proyectos[p.slug])
      .map((p) => {
        const v = ultimo.proyectos[p.slug];
        const antes = previo && previo.proyectos[p.slug] ? num(previo.proyectos[p.slug].real) : null;
        const real = num(v.real);
        let cambio = null;
        if (real !== null && antes !== null) cambio = Math.abs(real - antes) <= UMBRAL ? 0 : real - antes;
        return { slug: p.slug, nombre: p.nombre, real, prog: num(v.prog), cambio };
      });
    return { fecha: ultimo.fecha, esJueves: !!ultimo.corte, desde: previo ? previo.fecha : null, filas };
  }

  const api = { resumenMixtos, resumenCartera, lunesDe, UMBRAL };

  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else global.SemanaResumen = api;
})(typeof window !== "undefined" ? window : globalThis);
