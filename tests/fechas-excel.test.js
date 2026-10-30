// Fechas con formato de fecha de Excel en Mixtos (scripts/build-data.js → fechaLarga).
const test = require("node:test");
const assert = require("node:assert/strict");
const { fechaLarga } = require("../scripts/build-data.js");
const { parseDate } = require("../assets/js/shared/text-utils.js");

test("número de serie de Excel -> \"03 de julio de 2026\" (sin la ambigüedad de 7/3/26)", () => {
  assert.equal(fechaLarga(46206), "03 de julio de 2026");
  assert.equal(fechaLarga(46388), "01 de enero de 2027");
  assert.equal(fechaLarga(47057), "31 de octubre de 2028");
  // La página lo lee igual que las fechas escritas a mano.
  assert.deepEqual(parseDate(fechaLarga(47057)), new Date(2028, 9, 31));
});
