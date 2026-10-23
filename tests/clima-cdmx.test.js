const test = require("node:test");
const assert = require("node:assert/strict");
const { fechaHora, describir } = require("../assets/js/clima-cdmx.js");

test("fecha y hora en hora de México, sin importar la zona del equipo", () => {
  // 23 oct 2026 20:05 UTC = 14:05 en la CDMX (UTC-6)
  const { fecha, hora } = fechaHora(new Date("2026-10-23T20:05:00Z"));
  assert.equal(fecha, "vie 23 oct");
  assert.match(hora, /^2:05 p\.\s?m\.$/);
});

test("códigos del clima: descripción e ícono, luna de noche", () => {
  assert.deepEqual(describir(0), { texto: "Despejado", icono: "sol" });
  assert.deepEqual(describir(0, false), { texto: "Despejado", icono: "luna" });
  assert.deepEqual(describir(2, false), { texto: "Parcialmente nublado", icono: "lunaNube" });
  assert.equal(describir(63).texto, "Lluvia");
  assert.equal(describir(95).icono, "tormenta");
  assert.equal(describir(3, false).icono, "nube");
  assert.equal(describir(1234), null);
});
