/**
 * trend.js (compartido por cartera-cpel y cartera-mixtos)
 * Línea de tendencia de la curva de avance: una recta ajustada por mínimos
 * cuadrados a los últimos cortes reales (por omisión, hasta 6 semanas),
 * es decir, el RITMO de avance reciente proyectado hacia adelante. No es
 * un programa: indica a dónde llegaría el proyecto si sigue igual.
 *
 * Funciones puras (se prueban en tests/trend.test.js).
 * Expone: window.Trend
 */
(function (global) {
  const DAY_MS = 86400000;

  /**
   * points: [{ t: milisegundos, v: porcentaje }] (se ignoran v nulos).
   * Devuelve null si no hay al menos 2 cortes en fechas distintas.
   */
  function fitTrend(points, { window = 6 } = {}) {
    const pts = points
      .filter((p) => p && Number.isFinite(p.v) && Number.isFinite(p.t))
      .sort((a, b) => a.t - b.t)
      .slice(-window);
    if (pts.length < 2 || pts[0].t === pts[pts.length - 1].t) return null;

    const t0 = pts[0].t;
    const xs = pts.map((p) => (p.t - t0) / DAY_MS);
    const ys = pts.map((p) => p.v);
    const n = pts.length;
    const mx = xs.reduce((a, b) => a + b, 0) / n;
    const my = ys.reduce((a, b) => a + b, 0) / n;
    let sxy = 0;
    let sxx = 0;
    xs.forEach((x, i) => {
      sxy += (x - mx) * (ys[i] - my);
      sxx += (x - mx) * (x - mx);
    });
    const slopePerDay = sxy / sxx;
    return {
      t0,
      slopePerDay,
      intercept: my - slopePerDay * mx, // valor en t0
      n,
      from: pts[0].t,
      to: pts[n - 1].t,
      lastValue: ys[n - 1],
    };
  }

  /** Valor de la tendencia en el instante t (ms), acotado a 0–100. */
  function valueAt(fit, t) {
    const v = fit.intercept + fit.slopePerDay * ((t - fit.t0) / DAY_MS);
    return Math.max(0, Math.min(100, v));
  }

  /** Puntos por semana. */
  function weeklyRate(fit) {
    return fit.slopePerDay * 7;
  }

  /**
   * Fecha en que la tendencia alcanzaría "target" (p. ej. 100), o null si
   * el ritmo es cero o negativo, o si ya se alcanzó.
   */
  function dateToReach(fit, target = 100) {
    if (!(fit.slopePerDay > 0)) return null;
    const days = (target - fit.intercept) / fit.slopePerDay;
    const t = fit.t0 + days * DAY_MS;
    return t > fit.to ? new Date(t) : null;
  }

  /**
   * Punto de un corte semanal. Los cortes se ubican en el LUNES de su
   * semana (t) para que queden a 7 días entre sí aunque el Excel se haya
   * subido en días distintos de la semana; "fecha" conserva el día real
   * del corte (para tooltips y textos). fechaStr = "AAAA-MM-DD".
   */
  function cortePoint(fechaStr, v) {
    const [y, m, d] = fechaStr.split("-").map(Number);
    const fecha = new Date(y, m - 1, d, 12);
    const lunes = new Date(y, m - 1, d - ((fecha.getDay() + 6) % 7), 12);
    return { t: lunes.getTime(), fecha: fecha.getTime(), v };
  }

  /**
   * Los dos extremos de la línea de tendencia para dibujarla: desde el
   * primer corte usado hasta "endT", pero termina antes si toca 100% (o 0%)
   * — así la recta conserva su inclinación en vez de "aplanarse" al
   * recortar el valor final.
   */
  function segment(fit, endT) {
    const raw = (t) => fit.intercept + fit.slopePerDay * ((t - fit.t0) / DAY_MS);
    let end = endT;
    const limit = fit.slopePerDay > 0 ? 100 : fit.slopePerDay < 0 ? 0 : null;
    if (limit !== null) {
      const tLimit = fit.t0 + ((limit - fit.intercept) / fit.slopePerDay) * DAY_MS;
      if (tLimit > fit.from && tLimit < end) end = tLimit;
    }
    return [
      { t: fit.from, v: valueAt(fit, fit.from) },
      { t: end, v: Math.max(0, Math.min(100, raw(end))) },
    ];
  }

  // Con pocos cortes la fecha estimada es poco confiable.
  const MIN_CORTES_CONFIABLES = 4;

  const api = { fitTrend, valueAt, weeklyRate, dateToReach, cortePoint, segment, MIN_CORTES_CONFIABLES, DAY_MS };

  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else global.Trend = api;
})(typeof window !== "undefined" ? window : globalThis);
