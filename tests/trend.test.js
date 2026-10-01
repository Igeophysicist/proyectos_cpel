// Pruebas de assets/js/shared/trend.js (línea de tendencia).
process.env.TZ = "America/Mexico_City";
const test = require("node:test");
const assert = require("node:assert/strict");
const { fitTrend, valueAt, weeklyRate, dateToReach, cortePoint, segment, DAY_MS } = require("../assets/js/shared/trend.js");

const day = (iso) => new Date(iso + "T12:00:00Z").getTime();
const near = (a, b, eps = 1e-6) => assert.ok(Math.abs(a - b) < eps, `${a} ≈ ${b}`);

test("con menos de 2 cortes no hay tendencia", () => {
  assert.equal(fitTrend([]), null);
  assert.equal(fitTrend([{ t: day("2026-09-29"), v: 10 }]), null);
  assert.equal(fitTrend([{ t: day("2026-09-29"), v: 10 }, { t: day("2026-09-29"), v: 12 }]), null);
  assert.equal(fitTrend([{ t: day("2026-09-22"), v: null }, { t: day("2026-09-29"), v: 12 }]), null);
});

test("dos cortes: ritmo semanal exacto y fecha para llegar a 100", () => {
  const fit = fitTrend([{ t: day("2026-09-22"), v: 20 }, { t: day("2026-09-29"), v: 22 }]);
  near(weeklyRate(fit), 2);
  near(valueAt(fit, day("2026-10-06")), 24);
  // De 22 a 100 a 2 pts/semana = 39 semanas después del 29 de septiembre.
  near(dateToReach(fit, 100).getTime(), day("2026-09-29") + 39 * 7 * DAY_MS, 1);
});

test("usa solo los últimos cortes (ventana)", () => {
  const pts = [0, 0, 0, 10, 20, 30].map((v, i) => ({ t: day("2026-08-03") + i * 7 * DAY_MS, v }));
  near(weeklyRate(fitTrend(pts, { window: 3 })), 10);
  assert.ok(weeklyRate(fitTrend(pts, { window: 6 })) < 10);
});

test("sin avance o retroceso: no hay fecha estimada; valores acotados a 0–100", () => {
  const plano = fitTrend([{ t: day("2026-09-22"), v: 49.7 }, { t: day("2026-09-29"), v: 49.7 }]);
  near(weeklyRate(plano), 0);
  assert.equal(dateToReach(plano), null);
  const fit = fitTrend([{ t: day("2026-09-22"), v: 90 }, { t: day("2026-09-29"), v: 99 }]);
  assert.equal(valueAt(fit, day("2027-09-29")), 100);
});

test("cortePoint ubica cada corte en el lunes de su semana y conserva la fecha real", () => {
  const a = cortePoint("2026-09-25", 63.6); // viernes
  const b = cortePoint("2026-09-30", 79); // miércoles de la semana siguiente
  assert.equal(new Date(a.t).getDate(), 21); // lunes 21 sep
  assert.equal(new Date(b.t).getDate(), 28); // lunes 28 sep
  assert.equal(b.t - a.t, 7 * DAY_MS);
  assert.equal(new Date(b.fecha).getDate(), 30);
  assert.equal(new Date(cortePoint("2026-09-28", 1).t).getDate(), 28); // un lunes se queda igual
  assert.equal(new Date(cortePoint("2026-10-04", 1).t).getDate(), 28); // domingo -> lunes anterior
  // Ritmo semanal correcto aunque las subidas estén a 5 días:
  near(weeklyRate(fitTrend([a, b])), 15.4);
});

test("segment termina donde la tendencia toca 100% (conserva la inclinación)", () => {
  const fit = fitTrend([{ t: day("2026-09-21"), v: 63.6 }, { t: day("2026-09-28"), v: 79 }]);
  const [a, b] = segment(fit, day("2026-10-26"));
  near(a.v, 63.6);
  near(b.v, 100);
  near(b.t, dateToReach(fit, 100).getTime(), 1);
  // Si no llega a 100 antes del final, termina en el final pedido.
  const lento = fitTrend([{ t: day("2026-09-21"), v: 10 }, { t: day("2026-09-28"), v: 11 }]);
  near(segment(lento, day("2026-10-26"))[1].v, 15);
});
