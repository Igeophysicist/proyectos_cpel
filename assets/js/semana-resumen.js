/**
 * semana-resumen.js
 * Cálculo de la sección "Esta semana" del portal (ver scripts/historial.js).
 * Funciones puras (se prueban en tests/semana-resumen.test.js);
 * semana-portal.js las pinta.
 *
 *  - Mixtos (se actualiza lunes, miércoles y viernes, 3 a 5 proyectos),
 *    desde data/actualizaciones.json: las actualizaciones de la semana
 *    (domingo a sábado) de la más reciente, de la última a la primera.
 *    Cada proyecto (Parque o grupo cambiaron) se compara con su dato
 *    anterior y se indica si su grupo cambió o se mantuvo. La semana se sigue
 *    mostrando hasta que llega una actualización de otra semana.
 *  - Cartera CPEL (corte cada jueves): Real y Programado de cada proyecto
 *    en el último corte y el cambio del Real contra el corte anterior.
 *
 * Fechas como "AAAA-MM-DD" (las de los JSON).
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
  /** Domingo ("AAAA-MM-DD") de la semana (domingo a sábado) de una fecha. */
  const domingoDe = (s) => {
    const t = toUTC(s);
    return fromUTC(t - new Date(t).getUTCDay() * DAY_MS);
  };
  const sumarDias = (s, n) => fromUTC(toUTC(s) + n * DAY_MS);
  const num = (v) => (Number.isFinite(v) ? v : null);

  /**
   * registros: data/actualizaciones.json de Mixtos; hoy: "AAAA-MM-DD".
   * Devuelve null si aún no hay actualizaciones.
   */
  function resumenMixtos(registros, hoy) {
    if (!registros || !registros.length) return null;
    const ultimo = registros.reduce((a, b) => (b.excel > a.excel ? b : a));
    const ini = domingoDe(ultimo.fecha);
    const fin = sumarDias(ini, 6);
    const entradas = registros
      .filter((r) => r.fecha >= ini && r.fecha <= fin)
      .sort((a, b) => (a.excel < b.excel ? 1 : -1))
      .map((r) => ({
        fecha: r.fecha,
        excel: r.excel,
        cambios: r.cambios
          .map((c) => ({
            slug: c.slug,
            nombre: c.nombre || c.slug,
            antes: num(c.antes.parque),
            ahora: num(c.ahora.parque),
            diff: Number.isFinite(c.ahora.parque - c.antes.parque) && Math.abs(c.ahora.parque - c.antes.parque) > UMBRAL ? c.ahora.parque - c.antes.parque : 0,
            grupoAntes: c.antes.grupo || null,
            grupoAhora: c.ahora.grupo || null,
          }))
          .sort((x, y) => y.diff - x.diff),
      }));
    return { semanaIni: ini, semanaFin: fin, esActual: ini === domingoDe(hoy), entradas };
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

  const api = { resumenMixtos, resumenCartera, domingoDe, UMBRAL };

  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else global.SemanaResumen = api;
})(typeof window !== "undefined" ? window : globalThis);
