// Pruebas de cartera-cpel/assets/js/avance.js (barras de Programado y
// Real, semáforo y cambio desde el corte anterior).
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

test("generalHtml y miniHtml: Programado y Real con dos decimales, semáforo y Programado pendiente", () => {
  const g = A.generalHtml(31.37, 34.3);
  assert.match(g, /progress-row--prog[\s\S]*34\.30%[\s\S]*width:34.3%/);
  assert.match(g, /progress-row--real[\s\S]*31\.37%[\s\S]*width:31.37%/);
  assert.match(g, /variance--leve">Atraso de 2\.93 pts/);
  assert.match(A.generalHtml(120, 50), /width:100%/); // barra acotada a 0–100
  const p = A.generalHtml(12, 80, { pendiente: true });
  assert.match(p, /Programado<\/span><span>—/);
  assert.doesNotMatch(p, /variance/);
  const m = A.miniHtml(6.46, 6.36);
  assert.match(m, /mini-row__tag--prog">P[\s\S]*6\.36%[\s\S]*mini-row__tag--real">R[\s\S]*6\.46%/);
  assert.match(A.miniHtml(5, 9, { pendiente: true }), /mini-row__val">—/);
  assert.doesNotMatch(m, /<div/); // puede ir dentro de un botón
});

test("diferenciaHtml: diferencia Real − Programado con el color del semáforo", () => {
  assert.match(A.diferenciaHtml(6.46, 6.36), /mini-dif--ok"[^>]*>\+0\.10 pts/);
  assert.match(A.diferenciaHtml(7.62, 10.15), /mini-dif--leve"[^>]*>−2\.53 pts/);
  assert.match(A.diferenciaHtml(32.21, 100), /mini-dif--grave"[^>]*>−67\.79 pts/);
  assert.match(A.diferenciaHtml(5, 5), /mini-dif--ok"[^>]*>Al día/);
  assert.equal(A.diferenciaHtml(null, 5), "");
  assert.match(A.miniHtml(6.46, 6.36, { diferencia: true }), /mini-dif/);
  assert.doesNotMatch(A.miniHtml(6.46, 6.36), /mini-dif/);
  assert.doesNotMatch(A.miniHtml(6.46, 6.36, { diferencia: true, pendiente: true }), /mini-dif/);
});

test("Programado y Real en 0: \"Sin iniciar\" en gris (no \"Al día\")", () => {
  assert.match(A.diferenciaHtml(0, 0), /mini-dif--sin"[^>]*>Sin iniciar/);
  assert.match(A.diferenciaHtml(0, 0.5), /mini-dif--leve/); // programado ya empezó: atraso
  assert.match(A.generalHtml(0, 0), /variance--sin">Sin iniciar/);
  assert.doesNotMatch(A.generalHtml(0, 0), /Al día/);
  assert.doesNotMatch(A.generalHtml(0, 5, { pendiente: true }), /Sin iniciar/);
});
