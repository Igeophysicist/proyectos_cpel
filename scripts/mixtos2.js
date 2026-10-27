/**
 * mixtos2.js
 * Lee el Excel de Mixtos 2da Ronda (cartera-mixtos-2/data/DATOS_MIXTOS_2.xlsx)
 * y lo convierte en los datos de la página (data/DATOS_MIXTOS_2.json). Lo
 * usa scripts/build-data.js; las funciones son puras (reciben el libro ya
 * abierto con SheetJS) y se prueban en tests/mixtos2.test.js.
 *
 * HOJA "BASE_DE_DATOS": dos filas de títulos combinados y, en la fila 3,
 * los encabezados (se busca la fila que tiene "ID_VUPE" y "Proyecto", por
 * si se agregan filas arriba). Cada fila de abajo es un proyecto:
 *   No., ID_VUPE, Región, Grupo de Interés Económico, Proyecto, Entidad,
 *   Municipio, Tecnología, Capacidad Neta [MW], Porcentaje BESS [%],
 *   Almacenamiento BESS [MW], HORAS DE ALMACENAMIENTO, Energía por horas
 *   [MWh], Inicio de Inversión, Fin de Construcción, Fecha firma de
 *   contrato, CAPEX, PRIORI, el estatus de cada trámite (DI_P_ESTATUS …
 *   AFAC_LT_ESTATUS) y su avance (DI_P … AFAC_LT).
 *
 * La página es la misma de Mixtos, así que cada proyecto se publica con
 * los nombres de columna de Mixtos (TÍTULO 1/2, Socio, Ubicación,
 * Capacidad, Almacenamiento (BESS)…) más ID_VUPE, Región y los estatus.
 * Parque, LT y Global no vienen en la hoja: se calculan con los pesos de
 * los trámites (cartera-mixtos/assets/js/tramites.js), los mismos de la
 * hoja "Base valores".
 *
 * Revisa que cada estatus sea uno de la hoja REGLAS y que el avance del
 * trámite sea el de su estatus. En el KML cada punto se llama como el
 * ID_VUPE del proyecto (la página muestra el nombre del Excel).
 */
const { normalizeText, parseNumber, parseDate, slugify } = require("../assets/js/shared/text-utils.js");
const Tramites = require("../cartera-mixtos/assets/js/tramites.js");

const HOJA = "BASE_DE_DATOS";
const COLUMNAS = {
  no: "No.",
  id: "ID_VUPE",
  region: "Región",
  socio: "Grupo de Interés Económico",
  proyecto: "Proyecto",
  entidad: "Entidad",
  municipio: "Municipio",
  tecnologia: "Tecnología",
  capacidad: "Capacidad Neta [MW]",
  bessPct: "Porcentaje BESS [%]",
  bessMw: "Almacenamiento BESS [MW]",
  horas: "HORAS DE ALMACENAMIENTO",
  bessMwh: "Energía por horas [MWh]",
  inicio: "Inicio de Inversión",
  fin: "Fin de Construcción",
  firma: "Fecha firma de contrato",
  capex: "CAPEX",
  priori: "PRIORI",
};
const FECHAS = ["inicio", "fin", "firma"];
const REQUERIDAS = [...Object.values(COLUMNAS), ...Tramites.COLUMNAS, ...Tramites.COLUMNAS.map(Tramites.colEstatus)];

const vacio = (v) => v === null || v === undefined || String(v).trim() === "";
const texto = (v) => (vacio(v) ? "" : String(v).replace(/\u00A0/g, " ").replace(/\s+/g, " ").trim());
// "SIN DATO" y similares: se publican tal cual (la página los muestra en gris).
const esMarcador = (v) => /^(sin datos?|n\/?a|n\/?d|-|—|por definir)$/i.test(texto(v));
const fmtNum = new Intl.NumberFormat("en-US", { maximumFractionDigits: 2 });

/** Índice de columna (0) -> letra de Excel ("A", …, "Z", "AA"). */
function colExcel(c) {
  let s = "";
  for (let n = c + 1; n > 0; n = Math.floor((n - 1) / 26)) s = String.fromCharCode(65 + ((n - 1) % 26)) + s;
  return s;
}

/** "38.00" -> "38 MW"; marcadores ("SIN DATO") tal cual. */
function conUnidad(v, unidad) {
  if (vacio(v) || esMarcador(v)) return texto(v);
  const n = parseNumber(v);
  return n === null ? texto(v) : `${fmtNum.format(n)} ${unidad}`;
}

/** "24 MW / 72 MWh"; si no hay ninguno de los dos, el marcador del Excel ("SIN DATO"). */
function almacenamiento(mw, mwh) {
  const partes = [[mw, "MW"], [mwh, "MWh"]].filter(([v]) => !vacio(v) && !esMarcador(v)).map(([v, u]) => conUnidad(v, u));
  return partes.length ? partes.join(" / ") : texto(mw) || texto(mwh);
}

const pctTexto = (v) => `${v.toFixed(2)}%`;

/**
 * { errors, warnings, proyectos } de la hoja BASE_DE_DATOS.
 * kml = nombres de los Placemark (el ID_VUPE de cada proyecto).
 */
function leerMixtos2(wb, XLSX, { kml = [] } = {}) {
  const errors = [];
  const warnings = [];
  const ws = wb.Sheets[HOJA];
  if (!ws) return { errors: [`No existe la hoja "${HOJA}".`], warnings, proyectos: [] };

  const filas = XLSX.utils.sheet_to_json(ws, { header: 1, raw: false, defval: "", blankrows: true });
  const iEnc = filas.slice(0, 15).findIndex((f) => f.some((c) => texto(c) === COLUMNAS.id) && f.some((c) => texto(c) === COLUMNAS.proyecto));
  if (iEnc === -1) {
    return { errors: [`La hoja "${HOJA}" no tiene la fila de encabezados (con "${COLUMNAS.id}" y "${COLUMNAS.proyecto}").`], warnings, proyectos: [] };
  }
  const encabezados = filas[iEnc].map(texto);
  const col = new Map(encabezados.map((h, c) => [h, c]).filter(([h]) => h).reverse());
  REQUERIDAS.filter((h) => !col.has(h)).forEach((h) => errors.push(`Falta la columna "${h}" en la fila ${iEnc + 1} de "${HOJA}" (¿se renombró o se borró?).`));
  if (errors.length) return { errors, warnings, proyectos: [] };

  const enKml = new Set(kml.map(normalizeText));
  const ids = new Map();
  const nombres = new Map();
  const proyectos = [];

  filas.slice(iEnc + 1).forEach((f, i) => {
    const fila = iEnc + 2 + i; // fila del Excel
    const v = (h) => texto(f[col.get(h)]);
    const nombre = v(COLUMNAS.proyecto);
    if (!nombre) return; // filas vacías o de notas al final
    const donde = (h) => `Fila ${fila} (${nombre}), columna ${h} (${colExcel(col.get(h))})`;

    const id = v(COLUMNAS.id);
    if (!id) errors.push(`${donde(COLUMNAS.id)}: falta el ID_VUPE (con él se ubica el proyecto en el mapa).`);
    else if (ids.has(id)) errors.push(`${donde(COLUMNAS.id)}: el ID_VUPE ${id} se repite (igual que la fila ${ids.get(id)}).`);
    else ids.set(id, fila);
    const slug = slugify(nombre);
    if (nombres.has(slug)) errors.push(`Fila ${fila}: el proyecto "${nombre}" se repite (igual que la fila ${nombres.get(slug)}).`);
    else nombres.set(slug, fila);
    if (id && !enKml.has(normalizeText(id))) warnings.push(`Fila ${fila}: "${nombre}" (ID_VUPE ${id}) no tiene punto en el KML; no aparecerá en el mapa.`);

    const priori = v(COLUMNAS.priori);
    if (!/^(P|NoP)$/i.test(priori)) errors.push(`${donde(COLUMNAS.priori)}: "${priori}" no es válido; escribe "P" (prioritario) o "NoP".`);
    FECHAS.forEach((k) => {
      const h = COLUMNAS[k];
      if (!vacio(v(h)) && !esMarcador(v(h)) && !parseDate(v(h))) errors.push(`${donde(h)}: "${v(h)}" no es una fecha válida.`);
    });

    // Avance y estatus de cada trámite.
    Tramites.COLUMNAS.forEach((c) => {
      const ce = Tramites.colEstatus(c);
      const est = Tramites.estatus(v(ce));
      const av = Tramites.pct(v(c));
      if (!est) {
        const lista = Tramites.ESTATUS.map((e) => e.nombre).join(", ");
        errors.push(`${donde(ce)}: "${v(ce)}" no es un estatus de la hoja REGLAS (${lista}).`);
      } else if (av === null || Math.abs(av - est.avance) > 0.01) {
        errors.push(`${donde(c)}: el avance es "${v(c)}", pero el estatus "${est.nombre}" vale ${est.avance}%.`);
      }
    });

    const row = {
      "NO.": v(COLUMNAS.no),
      ID_VUPE: id,
      "TÍTULO 1": nombre,
      "TÍTULO 2": nombre,
      Socio: v(COLUMNAS.socio),
      Región: v(COLUMNAS.region),
      Tecnología: v(COLUMNAS.tecnologia),
      Ubicación: [v(COLUMNAS.municipio), v(COLUMNAS.entidad)].filter(Boolean).join(", "),
      Capacidad: conUnidad(v(COLUMNAS.capacidad), "MW"),
      "Porcentaje BESS": v(COLUMNAS.bessPct),
      "Almacenamiento (BESS)": almacenamiento(v(COLUMNAS.bessMw), v(COLUMNAS.bessMwh)),
      "Horas de Almacenamiento": v(COLUMNAS.horas),
      "Inicio de Inversión": v(COLUMNAS.inicio),
      "Fin de Construcción": v(COLUMNAS.fin),
      "Fecha firma de contrato": v(COLUMNAS.firma),
      CAPEX: v(COLUMNAS.capex),
      PRIORI: priori,
    };
    Tramites.COLUMNAS.forEach((c) => {
      row[c] = v(c);
      const est = Tramites.estatus(v(Tramites.colEstatus(c)));
      row[Tramites.colEstatus(c)] = est ? est.nombre : v(Tramites.colEstatus(c));
    });
    const calc = Tramites.ponderado(Tramites.desglose(row));
    row.Parque = calc ? pctTexto(calc.parque) : "";
    row.LT = calc ? pctTexto(calc.lt) : "";
    row.Global = calc ? pctTexto(calc.global) : "";
    proyectos.push(row);
  });

  if (!proyectos.length) errors.push(`La hoja "${HOJA}" no tiene proyectos.`);
  return { errors, warnings, proyectos };
}

module.exports = { leerMixtos2, HOJA, COLUMNAS, almacenamiento, conUnidad };
