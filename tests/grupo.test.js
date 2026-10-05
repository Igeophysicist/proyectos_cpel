// Pruebas de cartera-mixtos/assets/js/grupo.js (grupo de atención según Parque).
const test = require("node:test");
const assert = require("node:assert/strict");
const { grupoPorParque, LIMITES } = require("../cartera-mixtos/assets/js/grupo.js");

test("grupo según el avance de Parque, con los límites exactos", () => {
  assert.deepEqual(LIMITES, { A: 85, B: 76 });
  assert.equal(grupoPorParque(0), "C");
  assert.equal(grupoPorParque(75.99), "C");
  assert.equal(grupoPorParque(76), "B");
  assert.equal(grupoPorParque(84.99), "B");
  assert.equal(grupoPorParque(85), "A");
  assert.equal(grupoPorParque(100), "A");
});

test("sin dato de Parque no hay grupo", () => {
  assert.equal(grupoPorParque(null), null);
  assert.equal(grupoPorParque(undefined), null);
  assert.equal(grupoPorParque(NaN), null);
});
