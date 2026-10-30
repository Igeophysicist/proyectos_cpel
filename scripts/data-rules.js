/**
 * data-rules.js
 * Reglas de validación de los Excel de cada tablero. Son funciones puras
 * (no leen archivos), así que se prueban en tests/data-rules.test.js.
 *
 * Cada validador recibe:
 *   headers         encabezados de la fila 1 del Excel
 *   rows            filas como objetos (lo mismo que verá la página)
 *   placemarkNames  nombres de los Placemark de los KML del tablero
 *   fileExists(rel) para comprobar imágenes y videos (solo Cartera)
 *   fileSize(rel)   tamaño en bytes de un archivo (videos de Cartera)
 *   parecido(rel)   nombre de un archivo que existe y solo cambia en
 *                   espacios o mayúsculas (para sugerirlo en el error)
 * y devuelve { errors: [...], warnings: [...] } con mensajes en español
 * que indican la FILA DEL EXCEL (la 2 es el primer proyecto) y la columna.
 *
 * ERRORES bloquean la publicación de datos nuevos (el sitio sigue con los
 * anteriores). AVISOS solo se reportan.
 */
const { normalizeText, parseNumber, parseDate, slugify } = require("../assets/js/shared/text-utils.js");
const Tramites = require("../cartera-mixtos/assets/js/tramites.js");
const Video = require("../cartera-cpel/assets/js/video.js");

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
// avanfinProg/avanfinReal (avance financiero) son opcionales: sin ellas la
// tarjeta de avance general muestra solo el físico.
const CARTERA_PERCENTS = [
  "avanceProg", "avanceReal", "avanfinProg", "avanfinReal",
  ...CARTERA_PARTICULARES.flatMap((k) => [`prog${k}`, `real${k}`]),
];

function validateCartera({ headers, rows, placemarkNames = [], fileExists = () => true, fileSize = () => 0, parecido = () => null }) {
  // "no existe el archivo …", con el nombre parecido si lo hay (p. ej. subido con un espacio al inicio).
  const noExiste = (donde, rel) => {
    const otro = parecido(rel);
    return `${donde}: no existe el archivo "${rel}"` + (otro ? ` (en la carpeta está como "${otro}": corrige el nombre del archivo o del Excel).` : ".");
  };
  const errors = [];
  const warnings = [];
  checkHeaders(headers, CARTERA_REQUIRED, errors);

  const dateCols = headers.filter((h) => /^plazo_.*_fecha$|^plazo_firmado$/.test(h));
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
        errors.push(noExiste(`Fila ${row} (${name}), columna imagen`, imagen));
      }
    }
    // Columna "video" (opcional; ver cartera-cpel/assets/js/video.js).
    if (!isEmpty(r.video)) {
      const video = String(r.video).trim();
      const f = Video.fuente(video);
      const donde = `Fila ${row} (${name}), columna video`;
      if (!f) {
        errors.push(
          `${donde}: "${video}" no es un enlace de YouTube, Vimeo o Google Drive, ni un archivo MP4/WebM` +
            (/\.(mov|avi|wmv|mkv|m4v)$/i.test(video) ? " (convierte el video a MP4)." : ".")
        );
      } else if (f.origen === "archivo") {
        if (!fileExists(video)) errors.push(noExiste(donde, video));
        else if (fileSize(video) > Video.MAX_MB * 1024 * 1024) {
          errors.push(
            `${donde}: "${video}" pesa ${(fileSize(video) / 1024 / 1024).toFixed(1)} MB; el máximo es ${Video.MAX_MB} MB ` +
              "(límite de Cloudflare). Comprímelo o súbelo a YouTube o Google Drive y pon el enlace."
          );
        }
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
const MIXTOS_SHEET = "CAPEX";
const MIXTOS_REQUIRED = [
  "TÍTULO 1", "TÍTULO 2", "Socio", "Tecnología", "Ubicación", "Capacidad",
  "Almacenamiento (BESS)", "Horas de Almacenamiento",
  "Inicio de Inversión", "Fin de Construcción", "Fecha firma de contrato",
  "CAPEX", "Parque", "LT", "Global", "PRIORI",
  // Desglose de trámites (cartera-mixtos/assets/js/tramites.js)
  ...Tramites.COLUMNAS,
];
// Columnas que se publican en DATOS_MIXTOS.json: las que usa la página
// (más NO. y name_BD, de control). Las demás de la hoja (INVERSIONISTA,
// CAPEX/MW, ESTADO…) se quedan solo en el Excel.
// Estatus de cada trámite (DI_P_ESTATUS…; opcionales, texto libre: se
// muestran en la ventana Trámites sin ninguna regla de avance).
const MIXTOS_COLUMNAS = ["NO.", "name_BD", ...MIXTOS_REQUIRED, ...Tramites.COLUMNAS.map(Tramites.colEstatus)];
// Diferencia (puntos) a partir de la cual Parque/LT/Global del Excel no
// cuadran con la ponderación de los trámites.
const TOLERANCIA_PONDERADO = 0.05;
// "Grupo de atención" ya no se lee del Excel: sale del avance de Parque
// (cartera-mixtos/assets/js/grupo.js). Si la columna sigue, se ignora.
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
    if (headers.includes("PRIORI") && !/^(P|NoP)$/i.test(String(r["PRIORI"] ?? "").trim())) {
      errors.push(`Fila ${row} (${name}), columna PRIORI: "${String(r["PRIORI"] ?? "").trim()}" no es válido; escribe "P" (prioritario) o "NoP".`);
    }
    Tramites.COLUMNAS.forEach((c) => checkPercent(r[c], `Fila ${row} (${name}), columna ${c}`, errors));
    const calculado = Tramites.ponderado(Tramites.desglose(r));
    if (calculado) {
      [["Parque", calculado.parque], ["LT", calculado.lt], ["Global", calculado.global]].forEach(([col, valor]) => {
        const excel = parseNumber(r[col]);
        if (excel !== null && Math.abs(excel - valor) > TOLERANCIA_PONDERADO) {
          warnings.push(`Fila ${row} (${name}): ${col} dice ${r[col]}, pero la ponderación de los trámites da ${valor.toFixed(2)}%.`);
        }
      });
    }
    if (!geo.has(normalizeText(r["TÍTULO 2"])) && !geo.has(normalizeText(r["TÍTULO 1"]))) {
      warnings.push(`Fila ${row}: "${name}" no tiene ubicación en el KML; no aparecerá en el mapa.`);
    }
  });

  if (!names.length) errors.push(`La hoja "${MIXTOS_SHEET}" no tiene proyectos.`);
  checkUniqueNames(names, errors);
  return { errors, warnings };
}

// ------------------------------------------------- Excel más viejo
const fechaMexico = (iso) =>
  new Intl.DateTimeFormat("es-MX", {
    timeZone: "America/Mexico_City", day: "numeric", month: "short", year: "numeric", hour: "numeric", minute: "2-digit",
  }).format(new Date(iso));

/**
 * Error si el Excel subido se guardó ANTES que el que ya está publicado
 * (fechas ISO de "excelModificado"): casi siempre es una copia vieja y
 * publicarla regresaría los avances. Sin alguna de las dos fechas no se
 * puede comparar y no hay error. Devuelve el mensaje o null.
 */
function checkExcelAnterior(subido, publicado) {
  if (!subido || !publicado) return null;
  if (new Date(subido).getTime() >= new Date(publicado).getTime()) return null;
  return (
    `El Excel subido se guardó el ${fechaMexico(subido)}, ANTES que el que ya está publicado ` +
    `(${fechaMexico(publicado)}). ¿Es una copia vieja? No se publicó nada para no regresar los datos. ` +
    "Descarga el Excel actual del repositorio, haz tus cambios ahí y súbelo de nuevo " +
    "(si de verdad quieres volver a esa versión, ábrela y guárdala otra vez para que tenga la fecha de hoy)."
  );
}

module.exports = { validateCartera, validateMixtos, checkExcelAnterior, MIXTOS_SHEET, MIXTOS_COLUMNAS, MIXTOS_DATES };
