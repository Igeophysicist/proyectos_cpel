/**
 * orden.js
 * Selector "Ordenar por" del listado de proyectos. Solo cambia el orden
 * de las tarjetas (no el mapa ni el resumen). Los proyectos sin el dato
 * van al final, y los empates conservan el orden del Excel.
 *
 * Funciones puras (se prueban en tests/orden.test.js).
 * Expone: window.AppOrden.ORDENES, .ordenar(projects, clave), .valida(clave)
 */
(function (global) {
  const num = (v) => (Number.isFinite(v) ? v : null);
  const fecha = (d) => (d instanceof Date && !Number.isNaN(d.getTime()) ? d.getTime() : null);

  // clave -> { etiqueta, valor(p), desc }: desc = de mayor a menor.
  const ORDENES = {
    excel: { etiqueta: "Orden del Excel" },
    nombre: { etiqueta: "Nombre (A–Z)", valor: (p) => p.nombre || null, texto: true },
    global: { etiqueta: "Avance Global (mayor a menor)", valor: (p) => num(p.globalPct), desc: true },
    parque: { etiqueta: "Avance Parque (mayor a menor)", valor: (p) => num(p.parquePct), desc: true },
    grupo: { etiqueta: "Grupo de atención (A → C)", valor: (p) => p.grupo || null, texto: true },
    cod: { etiqueta: "COD más próximo", valor: (p) => fecha(p.finConstruccionFecha) },
    capacidad: { etiqueta: "Capacidad (mayor a menor)", valor: (p) => num(p.capacidadNum), desc: true },
  };

  const valida = (clave) => (Object.prototype.hasOwnProperty.call(ORDENES, clave) ? clave : "excel");
  const posicion = (p) => Number(p.id);

  /** Copia ordenada de projects según la clave (ver ORDENES). */
  function ordenar(projects, clave) {
    const o = ORDENES[valida(clave)];
    const lista = projects.slice();
    if (!o.valor) return lista.sort((a, b) => posicion(a) - posicion(b));
    return lista.sort((a, b) => {
      const va = o.valor(a);
      const vb = o.valor(b);
      if (va === null || vb === null) {
        if (va !== vb) return va === null ? 1 : -1; // sin dato, al final
      } else {
        const c = o.texto ? String(va).localeCompare(String(vb), "es", { sensitivity: "base" }) : va - vb;
        if (c !== 0) return o.desc ? -c : c;
      }
      return posicion(a) - posicion(b);
    });
  }

  const api = { ORDENES, ordenar, valida };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else global.AppOrden = api;
})(typeof window !== "undefined" ? window : globalThis);
