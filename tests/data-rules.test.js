// Pruebas de scripts/data-rules.js (validación de los Excel).
process.env.TZ = "America/Mexico_City";

const test = require("node:test");
const assert = require("node:assert/strict");
const { validateCartera, validateMixtos } = require("../scripts/data-rules.js");

const CARTERA_HEADERS = [
  "nombre", "tecnologia", "ubicacion", "imagen", "avanceProg", "avanceReal",
  "progIng", "realIng", "progSum", "realSum", "progCons", "realCons", "progPps", "realPps",
  "hito1_fecha", "eventos_importantes", "desarrollador", "inversion", "fuenteRecursos",
  "plazo_dias", "plazo_contrato", "plazo_firmado",
  "plazo_inicio_fecha", "plazo_pruebas_fecha", "plazo_aceptacion_fecha", "plazo_operacion_fecha",
];
const carteraRow = (extra = {}) => ({
  nombre: "PH CHICOASÉN II", imagen: "data/img.jpg", avanceProg: 49.7, avanceReal: "49.7%",
  hito1_fecha: "20/05/26", plazo_firmado: "22/12/2025", plazo_inicio_fecha: "", ...extra,
});
const cartera = (rows, opts = {}) =>
  validateCartera({ headers: CARTERA_HEADERS, rows, placemarkNames: ["PH Chicoasen II"], fileExists: () => true, ...opts });

test("Cartera: datos correctos pasan sin errores ni avisos", () => {
  assert.deepEqual(cartera([carteraRow()]), { errors: [], warnings: [] });
});

test("Cartera: imagen HEIC u otro formato es error (con indicación de convertir a JPG)", () => {
  const heic = cartera([carteraRow({ imagen: "data/CARTERA-CPEL/FOTO.HEIC" })]).errors;
  assert.ok(heic.some((e) => /imagen: "data\/CARTERA-CPEL\/FOTO.HEIC" debe ser JPG o PNG .*conviértela a JPG/.test(e)));
  assert.ok(cartera([carteraRow({ imagen: "data/x.gif" })]).errors.some((e) => /debe ser JPG o PNG\.$/.test(e)));
  assert.deepEqual(cartera([carteraRow({ imagen: "data/x.JPEG" })]).errors, []);
});

test("Cartera: columna renombrada es error", () => {
  const { errors } = validateCartera({ headers: CARTERA_HEADERS.filter((h) => h !== "avanceReal"), rows: [carteraRow()] });
  assert.ok(errors.some((e) => /Falta la columna "avanceReal"/.test(e)));
});

test("Cartera: porcentaje inválido, fecha inválida e imagen faltante indican fila y columna", () => {
  const { errors } = cartera([carteraRow({ avanceProg: 130, realIng: "mucho", plazo_inicio_fecha: "31/02/2026" })], {
    fileExists: () => false,
  });
  assert.ok(errors.some((e) => /^Fila 2 .*avanceProg: 130 está fuera del rango/.test(e)));
  assert.ok(errors.some((e) => /realIng: "mucho" no es un porcentaje/.test(e)));
  assert.ok(errors.some((e) => /plazo_inicio_fecha: "31\/02\/2026" no es una fecha válida/.test(e)));
  assert.ok(errors.some((e) => /imagen: no existe el archivo "data\/img.jpg"/.test(e)));
});

test("Cartera: proyecto repetido es error y sin KML es solo aviso", () => {
  const { errors, warnings } = cartera([carteraRow(), carteraRow({ nombre: "PH Chicoasen II" }), carteraRow({ nombre: "NUEVO" })]);
  assert.ok(errors.some((e) => /Fila 3: el proyecto "PH Chicoasen II" se repite \(igual que la fila 2\)/.test(e)));
  assert.deepEqual(warnings, ['Fila 4: "NUEVO" no tiene ubicación en el KML; no aparecerá en el mapa.']);
});

test("Cartera: filas vacías se ignoran; Excel sin proyectos es error", () => {
  assert.deepEqual(cartera([carteraRow(), { nombre: "" }]).errors, []);
  assert.ok(cartera([{ nombre: "  " }]).errors.some((e) => /no tiene proyectos/.test(e)));
});

const MIXTOS_HEADERS = [
  "TÍTULO 1", "TÍTULO 2", "Socio", "Tecnología", "Ubicación", "Capacidad", "Almacenamiento (BESS)",
  "Horas de Almacenamiento", "Inicio de Construcción", "Fin de Construcción", "Fecha firma de contrato",
  "CAPEX", "Parque", "LT", "Global", "Grupo de atención",
];
const mixRow = (extra = {}) => ({
  "TÍTULO 1": "SAN SIMÓN SOLAR", "TÍTULO 2": "SAN SIMÓN SOLAR", Parque: "94.00%", LT: "93.00%", Global: "93.80%",
  "Inicio de Construcción": "15 de noviembre de 2026", "Fin de Construcción": "01 de enero de 2029",
  "Fecha firma de contrato": "SIN DATO", "Grupo de atención": "A", ...extra,
});
const mixtos = (rows, names = ["SAN SIMON SOLAR"]) => validateMixtos({ headers: MIXTOS_HEADERS, rows, placemarkNames: names });

test("Mixtos: datos correctos (con 'SIN DATO') pasan", () => {
  assert.deepEqual(mixtos([mixRow()]), { errors: [], warnings: [] });
});

test("Mixtos: grupo, porcentaje y fecha inválidos son errores", () => {
  const { errors } = mixtos([mixRow({ "Grupo de atención": "D", Global: "150%", "Fin de Construcción": "diciembre 2028" })]);
  assert.equal(errors.length, 3);
  assert.ok(errors.some((e) => /Grupo de atención: "D" debe ser A, B o C/.test(e)));
});

test("Mixtos: se vincula al KML por TÍTULO 2 o, si no, por TÍTULO 1", () => {
  assert.deepEqual(mixtos([mixRow({ "TÍTULO 2": "Otro nombre" })]).warnings, []);
  assert.equal(mixtos([mixRow()], []).warnings.length, 1);
});
