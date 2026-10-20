/**
 * kpis.js
 * Totales de los indicadores del Resumen de Mixtos. Los proyectos de
 * segunda ronda (con "(2DA RONDA)" en el nombre) siguen en el listado, el
 * mapa y el conteo de proyectos, pero NO cuentan en la capacidad total, el
 * CAPEX total ni el avance global promedio.
 *
 * Funciones puras (se prueban en tests/kpis.test.js).
 * Expone: window.AppKpis (o module.exports en Node)
 */
(function (global) {
  const esSegundaRonda = (nombre) => /\(\s*2\s*DA\.?\s+RONDA\s*\)/i.test(String(nombre || ""));

  /** { capacidad, capex, avancePromedio, excluidos } de los proyectos dados. */
  function totales(projects) {
    const cuentan = projects.filter((p) => !esSegundaRonda(p.nombre));
    const avances = cuentan.map((p) => p.globalPct).filter((v) => Number.isFinite(v));
    return {
      capacidad: cuentan.reduce((s, p) => s + (p.capacidadNum || 0), 0),
      capex: cuentan.reduce((s, p) => s + (p.capexNum || 0), 0),
      avancePromedio: avances.length ? avances.reduce((a, b) => a + b, 0) / avances.length : null,
      excluidos: projects.length - cuentan.length,
    };
  }

  const api = { esSegundaRonda, totales };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else global.AppKpis = api;
})(typeof window !== "undefined" ? window : globalThis);
