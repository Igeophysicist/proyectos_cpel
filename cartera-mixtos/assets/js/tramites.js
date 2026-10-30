/**
 * tramites.js
 * Desglose de trámites y permisos de cada proyecto de Mixtos: las columnas
 * DI_P … AFAC_LT de la hoja "CAPEX" (copiadas de la hoja "Base de
 * Datos" del Excel de Estado de Proyectos) y sus pesos.
 *
 *   Parque = Σ peso × avance del trámite en Parque
 *   LT     = Σ peso × avance del trámite en la Línea
 *   Global = 80 % Parque + 20 % LT
 *
 * Estudios de interconexión y Consulta indígena tienen un solo valor que
 * cuenta igual para Parque y LT.
 *
 * ESTATUS: cada trámite puede traer además su estatus en la columna
 * <columna>_ESTATUS (DI_P_ESTATUS…).
 *  - Mixtos 2da Ronda: el estatus es uno de la hoja REGLAS y define el
 *    avance (ver ESTATUS; scripts/mixtos2.js lo valida).
 *  - Mixtos: texto libre copiado de otra base de datos, sin relación con
 *    el avance. Toma el color del código de colores de su Excel
 *    (COLORES_MIXTOS); un texto que no está ahí se muestra en gris claro.
 *    Vacío o "0" = sin estatus.
 * La página dice qué colores usar: Mixtos 2da Ronda lleva
 * data-estatus="reglas" en el <body> (ver data.js).
 * Sin esas columnas en el Excel no se muestra el estatus.
 *
 * Lo usan la página (data.js, ui.js) y la Action "Datos"
 * (scripts/data-rules.js, que avisa si Parque/LT/Global del Excel no
 * cuadran con esta ponderación). Si cambian los pesos, se editan aquí.
 *
 * Expone: window.AppTramites (o module.exports en Node)
 */
(function (global) {
  const TRAMITES = [
    { id: "mia", grupo: "Ambientales", nombre: "MIA – DTU", peso: 20, parque: "A_MIA_P", lt: "A_MIA_LT" },
    { id: "etj", grupo: "Ambientales", nombre: "ETJ", peso: 10, parque: "A_ETJ_P", lt: "A_ETJ_LT" },
    { id: "misse", grupo: "Social", nombre: "MISSE (EvIS)", peso: 20, parque: "S_MISSE_C", lt: "S_MISSE_LT" },
    { id: "cons", grupo: "Social", nombre: "Consulta indígena", peso: 10, parque: "S_CONS", lt: "S_CONS" },
    { id: "inah", grupo: "Dependencias", nombre: "INAH", peso: 5, parque: "INAH_C", lt: "INAH_LT" },
    { id: "pemex", grupo: "Dependencias", nombre: "PEMEX", peso: 5, parque: "PEMEX_C", lt: "PEMEX_LT" },
    { id: "conagua", grupo: "Dependencias", nombre: "CONAGUA", peso: 5, parque: "CONA_C", lt: "CONA_LT" },
    { id: "afac", grupo: "Dependencias", nombre: "AFAC", peso: 5, parque: "AFAC_C", lt: "AFAC_LT" },
    { id: "di", grupo: "Derechos inmobiliarios", nombre: "Derechos inmobiliarios", peso: 10, parque: "DI_P", lt: "DI_LT" },
    { id: "int", grupo: "Interconexión", nombre: "Estudios de interconexión", peso: 10, parque: "ES_INT", lt: "ES_INT" },
  ];
  const PESO_GLOBAL = { parque: 0.8, lt: 0.2 };
  // Hoja REGLAS del Excel de Mixtos 2da Ronda: avance (%) y color de cada estatus.
  const ESTATUS = [
    { nombre: "Pendiente", avance: 0, color: "#BFBFBF" },
    { nombre: "En elaboración", avance: 20, color: "#FF7C80" },
    { nombre: "En evaluación", avance: 50, color: "#FFFF99" },
    { nombre: "Requerimiento", avance: 75, color: "#95B3D7" },
    { nombre: "En actualización", avance: 75, color: "#95B3D7" },
    { nombre: "En dictaminación", avance: 85, color: "#FABF8F" },
    { nombre: "Liberado", avance: 100, color: "#92D050" },
    { nombre: "N/A", avance: 100, color: "#92D050" },
  ];
  const sinAcentos = (t) => String(t ?? "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/\s+/g, " ").trim().toLowerCase();
  /** Estatus de la lista que corresponde al texto (sin importar acentos ni mayúsculas), o null. */
  const estatus = (texto) => ESTATUS.find((e) => sinAcentos(e.nombre) === sinAcentos(texto)) || null;
  const colEstatus = (col) => `${col}_ESTATUS`;
  const SIN_COLOR = "#e7ebea";
  // Código de colores del Excel de Mixtos (celdas de estatus).
  const COLORES_MIXTOS = {
    "liberado": "#D8E4BC", // verde claro: listo al 100 %
    "n/a": "#D8E4BC",
    "en elaboracion": "#E79999", // rojo: por parte del socio
    "en actualizacion": "#8DB4E2", // azul: la autoridad pide información adicional
    "en evaluacion": "#FFFF99", // amarillo: en espera de respuesta de la autoridad
    "concluida": "#FABF8F", // naranja: consulta concluida por SENER, en espera de liberación
    "iniciada": "#D9D9D9", // gris: consulta iniciada por SENER
  };
  /**
   * Estatus a mostrar, o null si está vacío o en 0. paleta "reglas"
   * (Mixtos 2da Ronda): el de REGLAS; "mixtos": el texto tal cual con el
   * color de COLORES_MIXTOS. Un texto desconocido va en gris claro.
   */
  function estatusMostrado(valor, paleta = "mixtos") {
    const t = String(valor ?? "").replace(/\s+/g, " ").trim();
    if (!t || t === "0") return null;
    if (paleta === "reglas") return estatus(t) || { nombre: t, avance: null, color: SIN_COLOR };
    return { nombre: t, avance: null, color: COLORES_MIXTOS[sinAcentos(t)] || SIN_COLOR };
  }
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
  function desglose(raw, { paleta } = {}) {
    if (!raw || !COLUMNAS.some((c) => pct(raw[c]) !== null)) return null;
    return TRAMITES.map((t) => ({
      ...t,
      compartido: t.parque === t.lt,
      avParque: pct(raw[t.parque]),
      avLt: pct(raw[t.lt]),
      // null si el Excel no trae estatus o la celda está vacía
      estParque: estatusMostrado(raw[colEstatus(t.parque)], paleta),
      estLt: estatusMostrado(raw[colEstatus(t.lt)], paleta),
    }));
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


  const api = { TRAMITES, PESO_GLOBAL, COLUMNAS, ESTATUS, COLORES_MIXTOS, estatus, estatusMostrado, colEstatus, pct, desglose, ponderado, faltantes };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else global.AppTramites = api;
})(typeof window !== "undefined" ? window : globalThis);
