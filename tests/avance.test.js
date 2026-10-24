// Pruebas de cartera-cpel/assets/js/avance.js (barra con marca del
// Programado, semáforo y cambio desde el corte anterior).
const test = require("node:test");
const assert = require("node:assert/strict");
globalThis.TextUtils = require("../assets/js/shared/text-utils.js");
const A = require("../cartera-cpel/assets/js/avance.js");

test("semáforo: al día o adelantado, atraso leve (< 3 pts) y atraso mayor", () => {
  assert.equal(A.semaforo(0), "ok");
  assert.equal(A.semaforo(1.2), "ok");
  assert.equal(A.semaforo(-0.1), "leve");
  assert.equal(A.semaforo(-2.99), "leve");
  assert.equal(A.semaforo(-3), "grave");
  assert.equal(A.semaforo(-15), "grave");
  assert.equal(A.semaforo(null), null);
  assert.equal(A.textoDiferencia(-2.93), "Atraso de 2.93 pts respecto al programa");
  assert.equal(A.textoDiferencia(1.5), "Adelantado 1.50 pts respecto al programa");
  assert.equal(A.textoDiferencia(0), "Al día respecto al programa");
});

test("cambioSemanal: Real de los dos últimos cortes con dato del proyecto", () => {
  const cortes = [
    { fecha: "2026-10-01", proyectos: { a: { real: 20 } } },
    { fecha: "2026-10-08", proyectos: { a: { real: 22.5 }, b: { real: 5 } } },
    { fecha: "2026-10-15", proyectos: { b: { real: 6 } } }, // sin "a"
    { fecha: "2026-10-22", proyectos: { a: { real: 23.59 }, b: { real: null } } },
  ];
  assert.deepEqual(A.cambioSemanal(cortes, "a"), { diff: 1.09, desde: "2026-10-08" });
  assert.deepEqual(A.cambioSemanal(cortes, "b"), { diff: 1, desde: "2026-10-08" });
  assert.equal(A.cambioSemanal(cortes.slice(0, 1), "a"), null);
  assert.equal(A.cambioSemanal([], "a"), null);
  assert.equal(A.cambioSemanal(undefined, "a"), null);
});

test("barra: Real a lo ancho y marca en el Programado (sin marca si no hay Programado)", () => {
  const html = A.barra(31.37, 34.3);
  assert.match(html, /bala__real" style="width:31.37%"/);
  assert.match(html, /bala__prog" style="left:34.3%"/);
  assert.doesNotMatch(A.barra(10, null), /bala__prog/);
  assert.match(A.barra(120, 150), /width:100%.*left:100%/s); // acotada a 0–100
});

test("generalHtml y miniHtml: valores con dos decimales, semáforo y Programado pendiente", () => {
  const g = A.generalHtml(31.37, 34.3);
  assert.match(g, /31\.37%/);
  assert.match(g, /34\.30%/);
  assert.match(g, /variance--leve">Atraso de 2\.93 pts/);
  const p = A.generalHtml(12, 80, { pendiente: true });
  assert.match(p, /pendiente/);
  assert.doesNotMatch(p, /variance|bala__prog/);
  const m = A.miniHtml(6.46, 6.36);
  assert.match(m, /amini__real tabular" title="Real">6\.46%/);
  assert.match(m, /6\.36%/);
  assert.doesNotMatch(m, /<div/); // puede ir dentro de un botón
});
