/**
 * kpis.js
 * Totales de los indicadores del Resumen de Mixtos. Los proyectos de
 * segunda ronda (con "(2DA RONDA)" en el nombre) siguen en el listado, el
 * mapa y el conteo de proyectos, pero NO cuentan en la capacidad total, el
 * CAPEX total ni el avance global promedio.
 *
 * CAPEX compartido: cuando varios proyectos del mismo socio tienen
 * exactamente el mismo CAPEX (p. ej. las 3 fases de Concepción Mendizábal,
 * que tienen un solo CAPEX para las tres), en el total cuenta una vez.
 *
 * Funciones puras (se prueban en tests/kpis.test.js).
 * Expone: window.AppKpis (o module.exports en Node)
 */
(function (global) {
  const esSegundaRonda = (nombre) => /\(\s*2\s*DA\.?\s+RONDA\s*\)/i.test(String(nombre || ""));

  /** Suma de CAPEX contando una sola vez el que comparten proyectos del mismo socio. */
  function capexSinRepetir(projects) {
    const vistos = new Set();
    return projects.reduce((s, p) => {
      if (!p.capexNum) return s;
      const clave = `${String(p.socio || "").trim().toLowerCase()}|${p.capexNum}`;
      if (vistos.has(clave)) return s;
      vistos.add(clave);
      return s + p.capexNum;
    }, 0);
  }

  /** { capacidad, capex, avancePromedio, excluidos } de los proyectos dados. */
  function totales(projects) {
    const cuentan = projects.filter((p) => !esSegundaRonda(p.nombre));
    const avances = cuentan.map((p) => p.globalPct).filter((v) => Number.isFinite(v));
    return {
      capacidad: cuentan.reduce((s, p) => s + (p.capacidadNum || 0), 0),
      capex: capexSinRepetir(cuentan),
      avancePromedio: avances.length ? avances.reduce((a, b) => a + b, 0) / avances.length : null,
      excluidos: projects.length - cuentan.length,
    };
  }

  const api = { esSegundaRonda, totales };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else global.AppKpis = api;
})(typeof window !== "undefined" ? window : globalThis);
