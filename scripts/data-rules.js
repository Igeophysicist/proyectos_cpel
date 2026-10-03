/**
 * data-rules.js
 * Reglas de validación de los Excel de cada tablero. Son funciones puras
 * (no leen archivos), así que se prueban en tests/data-rules.test.js.
 *
 * Cada validador recibe:
 *   headers         encabezados de la fila 1 del Excel
 *   rows            filas como objetos (lo mismo que verá la página)
 *   placemarkNames  nombres de los Placemark de los KML del tablero
 *   fileExists(rel) para comprobar imágenes (solo Cartera)
 * y devuelve { errors: [...], warnings: [...] } con mensajes en español
 * que indican la FILA DEL EXCEL (la 2 es el primer proyecto) y la columna.
 *
 * ERRORES bloquean la publicación de datos nuevos (el sitio sigue con los
 * anteriores). AVISOS solo se reportan.
 */
const { normalizeText, parseNumber, parseDate, slugify } = require("../assets/js/shared/text-utils.js");

const isEmpty = (v) => v === null || v === undefined || String(v).trim() === "";

// Marcadores de "dato pendiente" que se escriben a propósito en el Excel
// y la página muestra tal cual; no son errores de formato.
const PLACEHOLDERS = new Set(["sin dato", "sin datos", "n/a", "na", "nd", "n/d", "-", "—", "pendiente", "por definir"]);
const isPlaceholder = (v) => PLACEHOLDERS.has(String(v).trim().toLowerCase());
const excelRow = (i) => i + 2; // fila 1 = encabezados

function checkHeaders(headers, required, errors) {
  const present = new Set(headers.map((h) => String(h).trim()));
  required
    .filter((h) => !present.has(h))
    .forEach((h) => errors.push(`Falta la columna "${h}" en la fila 1 (¿se renombró o se borró?).`));
}

function checkPercent(value, where, errors) {
  if (isEmpty(value) || isPlaceholder(value)) return;
  const n = parseNumber(value);
  if (n === null) errors.push(`${where}: "${value}" no es un porcentaje.`);
  else if (n < 0 || n > 100) errors.push(`${where}: ${value} está fuera del rango 0–100.`);
}

function checkDate(value, where, errors) {
  if (isEmpty(value) || isPlaceholder(value)) return;
  if (!parseDate(String(value))) {
    errors.push(`${where}: "${value}" no es una fecha válida (usa dd/mm/aaaa o "31 de diciembre de 2028").`);
  }
}

function checkUniqueNames(names, errors) {
  const seen = new Map();
  names.forEach(({ name, row }) => {
    const id = slugify(name);
    if (seen.has(id)) {
      errors.push(`Fila ${row}: el proyecto "${name}" se repite (igual que la fila ${seen.get(id)}).`);
    } else {
      seen.set(id, row);
    }
  });
}

// ------------------------------------------------------------ Cartera
const CARTERA_PARTICULARES = ["Ing", "Sum", "Cons", "Pps"];
const CARTERA_REQUIRED = [
  "nombre", "tecnologia", "ubicacion", "imagen", "avanceProg", "avanceReal",
  ...CARTERA_PARTICULARES.flatMap((k) => [`prog${k}`, `real${k}`]),
  "eventos_importantes", "desarrollador", "inversion", "fuenteRecursos",
  "plazo_dias", "plazo_contrato", "plazo_firmado",
  "plazo_inicio_fecha", "plazo_pruebas_fecha", "plazo_aceptacion_fecha", "plazo_operacion_fecha",
];
const CARTERA_PERCENTS = ["avanceProg", "avanceReal", ...CARTERA_PARTICULARES.flatMap((k) => [`prog${k}`, `real${k}`])];

function validateCartera({ headers, rows, placemarkNames = [], fileExists = () => true }) {
  const errors = [];
  const warnings = [];
  checkHeaders(headers, CARTERA_REQUIRED, errors);

  const dateCols = headers.filter((h) => /^plazo_.*_fecha$|^plazo_firmado$|^hito\d+_fecha$/.test(h));
  const geo = new Set(placemarkNames.map(normalizeText));
  const names = [];

  rows.forEach((r, i) => {
    const row = excelRow(i);
    if (isEmpty(r.nombre)) return; // filas vacías: la página las ignora
    const name = String(r.nombre).trim();
    names.push({ name, row });
    CARTERA_PERCENTS.forEach((c) => checkPercent(r[c], `Fila ${row} (${name}), columna ${c}`, errors));
    dateCols.forEach((c) => checkDate(r[c], `Fila ${row} (${name}), columna ${c}`, errors));
    if (!isEmpty(r.imagen)) {
      const imagen = String(r.imagen).trim();
      if (!/\.(jpe?g|png)$/i.test(imagen)) {
        errors.push(
          `Fila ${row} (${name}), columna imagen: "${imagen}" debe ser JPG o PNG` +
            (/\.hei[cf]$/i.test(imagen) ? " (las fotos HEIC del iPhone no se ven en Chrome ni Android: conviértela a JPG)." : ".")
        );
      } else if (!fileExists(imagen)) {
        errors.push(`Fila ${row} (${name}), columna imagen: no existe el archivo "${r.imagen}".`);
      }
    }
    if (!geo.has(normalizeText(name))) {
      warnings.push(`Fila ${row}: "${name}" no tiene ubicación en el KML; no aparecerá en el mapa.`);
    }
  });

  if (!names.length) errors.push("El Excel no tiene proyectos (columna nombre vacía).");
  checkUniqueNames(names, errors);
  return { errors, warnings };
}

// ------------------------------------------------------------- Mixtos
const MIXTOS_SHEET = "Proyectos";
const MIXTOS_REQUIRED = [
  "TÍTULO 1", "TÍTULO 2", "Socio", "Tecnología", "Ubicación", "Capacidad",
  "Almacenamiento (BESS)", "Horas de Almacenamiento",
  "Inicio de Inversión", "Fin de Construcción", "Fecha firma de contrato",
  "CAPEX", "Parque", "LT", "Global", "Grupo de atención",
];
const MIXTOS_PERCENTS = ["Parque", "LT", "Global"];
const MIXTOS_DATES = ["Inicio de Inversión", "Fin de Construcción", "Fecha firma de contrato"];

function validateMixtos({ headers, rows, placemarkNames = [] }) {
  const errors = [];
  const warnings = [];
  checkHeaders(headers, MIXTOS_REQUIRED, errors);

  const geo = new Set(placemarkNames.map(normalizeText));
  const names = [];

  rows.forEach((r, i) => {
    const row = excelRow(i);
    const name = String(r["TÍTULO 2"] || r["TÍTULO 1"] || "").trim();
    if (!name) return; // filas vacías: la página las ignora
    names.push({ name, row });
    MIXTOS_PERCENTS.forEach((c) => checkPercent(r[c], `Fila ${row} (${name}), columna ${c}`, errors));
    MIXTOS_DATES.forEach((c) => checkDate(r[c], `Fila ${row} (${name}), columna ${c}`, errors));
    const grupo = String(r["Grupo de atención"] || "").trim();
    if (grupo && !["A", "B", "C"].includes(grupo)) {
      errors.push(`Fila ${row} (${name}), columna Grupo de atención: "${grupo}" debe ser A, B o C.`);
    }
    if (!geo.has(normalizeText(r["TÍTULO 2"])) && !geo.has(normalizeText(r["TÍTULO 1"]))) {
      warnings.push(`Fila ${row}: "${name}" no tiene ubicación en el KML; no aparecerá en el mapa.`);
    }
  });

  if (!names.length) errors.push('La hoja "Proyectos" no tiene proyectos.');
  checkUniqueNames(names, errors);
  return { errors, warnings };
}

module.exports = { validateCartera, validateMixtos, MIXTOS_SHEET };
