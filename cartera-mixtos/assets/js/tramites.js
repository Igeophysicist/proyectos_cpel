/**
 * tramites.js
 * Desglose de trámites y permisos de cada proyecto de Mixtos: las columnas
 * DI_P … AFAC_LT de la hoja "Proyectos" (copiadas de la hoja "Base de
 * Datos" del Excel de Estado de Proyectos) y sus pesos.
 *
 *   Parque = Σ peso × avance del trámite en Parque
 *   LT     = Σ peso × avance del trámite en la Línea
 *   Global = 80 % Parque + 20 % LT
 *
 * Estudios de interconexión y Consulta indígena tienen un solo valor que
 * cuenta igual para Parque y LT.
 *
 * Lo usan la página (data.js, ui.js) y la Action "Datos"
 * (scripts/data-rules.js, que avisa si Parque/LT/Global del Excel no
 * cuadran con esta ponderación). Si cambian los pesos, se editan aquí.
 *
 * Expone: window.AppTramites (o module.exports en Node)
 */
(function (global) {
  const TRAMITES = [
    { id: "di", grupo: "Derechos inmobiliarios", nombre: "Derechos inmobiliarios", peso: 10, parque: "DI_P", lt: "DI_LT" },
    { id: "int", grupo: "Interconexión", nombre: "Estudios de interconexión", peso: 10, parque: "ES_INT", lt: "ES_INT" },
    { id: "mia", grupo: "Ambientales", nombre: "MIA – DTU", peso: 20, parque: "A_MIA_P", lt: "A_MIA_LT" },
    { id: "etj", grupo: "Ambientales", nombre: "ETJ", peso: 10, parque: "A_ETJ_P", lt: "A_ETJ_LT" },
    { id: "misse", grupo: "Social", nombre: "MISSE (EvIS)", peso: 20, parque: "S_MISSE_C", lt: "S_MISSE_LT" },
    { id: "cons", grupo: "Social", nombre: "Consulta indígena", peso: 10, parque: "S_CONS", lt: "S_CONS" },
    { id: "inah", grupo: "Dependencias", nombre: "INAH", peso: 5, parque: "INAH_C", lt: "INAH_LT" },
    { id: "pemex", grupo: "Dependencias", nombre: "PEMEX", peso: 5, parque: "PEMEX_C", lt: "PEMEX_LT" },
    { id: "conagua", grupo: "Dependencias", nombre: "CONAGUA", peso: 5, parque: "CONA_C", lt: "CONA_LT" },
    { id: "afac", grupo: "Dependencias", nombre: "AFAC", peso: 5, parque: "AFAC_C", lt: "AFAC_LT" },
  ];
  const PESO_GLOBAL = { parque: 0.8, lt: 0.2 };
  const COLUMNAS = Array.from(new Set(TRAMITES.flatMap((t) => [t.parque, t.lt])));

  /** "90%", "90", 0.9 (número de Excel) -> 90; vacío o texto -> null. */
  function pct(v) {
    if (v === null || v === undefined || String(v).trim() === "") return null;
    if (typeof v === "number") return v <= 1 ? v * 100 : v;
    const n = parseFloat(String(v).replace("%", "").replace(",", "."));
    return Number.isFinite(n) ? n : null;
  }

  /**
   * Trámites de una fila del Excel: [{ ...trámite, avParque, avLt }].
   * null si la fila no trae ningún dato de trámites.
   */
  function desglose(raw) {
    if (!raw || !COLUMNAS.some((c) => pct(raw[c]) !== null)) return null;
    return TRAMITES.map((t) => ({ ...t, compartido: t.parque === t.lt, avParque: pct(raw[t.parque]), avLt: pct(raw[t.lt]) }));
  }

  /** { parque, lt, global } (en %) ponderados; null si falta algún dato. */
  function ponderado(items) {
    if (!items || items.some((t) => t.avParque === null || t.avLt === null)) return null;
    const parque = items.reduce((s, t) => s + (t.peso * t.avParque) / 100, 0);
    const lt = items.reduce((s, t) => s + (t.peso * t.avLt) / 100, 0);
    return { parque, lt, global: parque * PESO_GLOBAL.parque + lt * PESO_GLOBAL.lt };
  }

  /**
   * Puntos que le faltan a cada trámite para llegar a 100 % en "parque"
   * o "lt" (peso × lo que le falta), de mayor a menor, sin los completos.
   */
  function faltantes(items, lado) {
    const campo = lado === "lt" ? "avLt" : "avParque";
    return (items || [])
      .filter((t) => t[campo] !== null && t[campo] < 100)
      .map((t) => ({ nombre: t.nombre, pts: (t.peso * (100 - t[campo])) / 100 }))
      .sort((a, b) => b.pts - a.pts);
  }


  const api = { TRAMITES, PESO_GLOBAL, COLUMNAS, pct, desglose, ponderado, faltantes };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else global.AppTramites = api;
})(typeof window !== "undefined" ? window : globalThis);
