/**
 * grupo.js
 * Grupo de atención de cada proyecto de Mixtos según su avance de Parque
 * (ya no se toma de una columna del Excel):
 *
 *   Grupo A: Parque de 85 % o más.
 *   Grupo B: Parque de 76 % a menos de 85 %.
 *   Grupo C: Parque menor a 76 %.
 *   Sin Parque (vacío o "SIN DATO"): sin grupo.
 *
 * Lo usan la página (data.js) y la Action "Datos" (scripts/historial.js),
 * así el grupo es el mismo en las tarjetas, el mapa, el historial y "Esta
 * semana" del portal. Para cambiar los límites, edita LIMITES.
 *
 * Expone: window.AppGrupo (o module.exports en Node)
 */
(function (global) {
  const LIMITES = { A: 85, B: 76 }; // mínimo de Parque (%) de cada grupo

  /** "A", "B", "C" o null según el % de Parque (número, p. ej. 81.5). */
  function grupoPorParque(parque) {
    if (!Number.isFinite(parque)) return null;
    if (parque >= LIMITES.A) return "A";
    if (parque >= LIMITES.B) return "B";
    return "C";
  }

  const api = { grupoPorParque, LIMITES };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else global.AppGrupo = api;
})(typeof window !== "undefined" ? window : globalThis);
