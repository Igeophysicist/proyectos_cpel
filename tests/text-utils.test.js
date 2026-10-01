// Pruebas de assets/js/shared/text-utils.js. Se ejecutan con `npm test`.
// Se fija la zona horaria de México para reproducir el caso real: con
// new Date("2029-01-01") el año salía 2028.
process.env.TZ = "America/Mexico_City";

const test = require("node:test");
const assert = require("node:assert/strict");
const { normalizeText, esc, parseNumber, parseDate, isPastOrToday, debounce } = require(
  "../assets/js/shared/text-utils.js"
);

function ymd(date) {
  return date && [date.getFullYear(), date.getMonth() + 1, date.getDate()];
}

test("parseDate: fecha larga del 1 de enero conserva el año (zona de México)", () => {
  assert.deepEqual(ymd(parseDate("01 de enero de 2029")), [2029, 1, 1]);
  assert.deepEqual(ymd(parseDate("31 de diciembre de 2028")), [2028, 12, 31]);
  assert.deepEqual(ymd(parseDate("15 de Septiembre de 2026")), [2026, 9, 15]);
  assert.deepEqual(ymd(parseDate("3 de setiembre de 2026")), [2026, 9, 3]);
});

test("parseDate: ISO, dd/mm/aaaa y dd/mm/aa en hora local", () => {
  assert.deepEqual(ymd(parseDate("2027-01-01")), [2027, 1, 1]);
  assert.deepEqual(ymd(parseDate("22/12/2025")), [2025, 12, 22]);
  assert.deepEqual(ymd(parseDate("20/05/26")), [2026, 5, 20]);
  assert.deepEqual(ymd(parseDate("1-7-2027")), [2027, 7, 1]);
});

test("parseDate: valores inválidos devuelven null", () => {
  assert.equal(parseDate(""), null);
  assert.equal(parseDate(null), null);
  assert.equal(parseDate("pendiente"), null);
  assert.equal(parseDate("31/02/2027"), null);
  assert.equal(parseDate("10 de brumario de 2027"), null);
});

test("isPastOrToday compara solo por día", () => {
  const now = new Date(2026, 9, 1, 15, 30);
  assert.equal(isPastOrToday(new Date(2026, 9, 1), now), true);
  assert.equal(isPastOrToday(new Date(2026, 8, 30), now), true);
  assert.equal(isPastOrToday(new Date(2026, 9, 2), now), false);
  assert.equal(isPastOrToday(null, now), false);
});

test("normalizeText quita acentos, puntuación y espacios extra", () => {
  assert.equal(normalizeText("  Central  Fotovoltaica Quásara. "), "CENTRAL FOTOVOLTAICA QUASARA");
  assert.equal(normalizeText("PROYECTO EÓLICO (LA NORIA)"), "PROYECTO EOLICO LA NORIA");
  assert.equal(normalizeText("CFV Puerto Peñasco Secuencia III"), "CFV PUERTO PENASCO SECUENCIA III");
  assert.equal(normalizeText(null), "");
});

test("esc escapa caracteres especiales de HTML", () => {
  assert.equal(esc(`<b>"A&B"</b> 'x'`), "&lt;b&gt;&quot;A&amp;B&quot;&lt;/b&gt; &#39;x&#39;");
  assert.equal(esc(undefined), "");
  assert.equal(esc(0), "0");
});

test("parseNumber entiende montos, porcentajes y unidades", () => {
  assert.equal(parseNumber("$93,931,093.40"), 93931093.4);
  assert.equal(parseNumber("94.00%"), 94);
  assert.equal(parseNumber("301.5 MW"), 301.5);
  assert.equal(parseNumber(12), 12);
  assert.equal(parseNumber(""), null);
  assert.equal(parseNumber("sin dato"), null);
});

test("debounce ejecuta solo la última llamada", async () => {
  const calls = [];
  const fn = debounce((v) => calls.push(v), 20);
  fn(1);
  fn(2);
  fn(3);
  await new Promise((r) => setTimeout(r, 50));
  assert.deepEqual(calls, [3]);
});
