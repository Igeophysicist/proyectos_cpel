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

  const nombre = (p) => p.nombre || null;
  const global_ = (p) => num(p.globalPct);
  const parque = (p) => num(p.parquePct);
  const grupo = (p) => p.grupo || null;
  const cod = (p) => fecha(p.finConstruccionFecha);
  const capacidad = (p) => num(p.capacidadNum);

  // clave -> { etiqueta, valor(p), texto, desc }: desc = de mayor a menor
  // (Z–A en texto). Cada criterio va junto a su contrario.
  const ORDENES = {
    excel: { etiqueta: "Default" },
    nombre: { etiqueta: "Nombre (A–Z)", valor: nombre, texto: true },
    nombre_za: { etiqueta: "Nombre (Z–A)", valor: nombre, texto: true, desc: true },
    global: { etiqueta: "Avance Global (mayor a menor)", valor: global_, desc: true },
    global_asc: { etiqueta: "Avance Global (menor a mayor)", valor: global_ },
    parque: { etiqueta: "Avance Parque (mayor a menor)", valor: parque, desc: true },
    parque_asc: { etiqueta: "Avance Parque (menor a mayor)", valor: parque },
    grupo: { etiqueta: "Grupo de atención (A → C)", valor: grupo, texto: true },
    grupo_ca: { etiqueta: "Grupo de atención (C → A)", valor: grupo, texto: true, desc: true },
    cod: { etiqueta: "COD más próximo", valor: cod },
    cod_lejano: { etiqueta: "COD más lejano", valor: cod, desc: true },
    capacidad: { etiqueta: "Capacidad (mayor a menor)", valor: capacidad, desc: true },
    capacidad_asc: { etiqueta: "Capacidad (menor a mayor)", valor: capacidad },
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
