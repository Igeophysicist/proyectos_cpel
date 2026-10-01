// Pruebas de scripts/historial.js (cortes semanales de la curva de avance).
const test = require("node:test");
const assert = require("node:assert/strict");
const { localDate, isoWeek, snapshotCartera, snapshotMixtos, upsertCorte } = require("../scripts/historial.js");

test("localDate usa la hora de México (no UTC)", () => {
  // Guardado el 30 sep 00:18 UTC = 29 sep 18:18 en México.
  assert.equal(localDate("2026-09-30T00:18:25Z"), "2026-09-29");
  assert.equal(localDate("2026-10-01T00:10:24Z"), "2026-09-30");
  assert.equal(localDate("no es fecha"), null);
});

test("isoWeek: semanas de lunes a domingo", () => {
  assert.equal(isoWeek("2026-09-28"), "2026-W40"); // lunes
  assert.equal(isoWeek("2026-10-04"), "2026-W40"); // domingo
  assert.equal(isoWeek("2026-09-27"), "2026-W39"); // domingo anterior
  assert.equal(isoWeek("2026-12-31"), "2026-W53");
  assert.equal(isoWeek("2027-01-01"), "2026-W53"); // pertenece a la semana del año anterior
  assert.equal(isoWeek("2027-01-04"), "2027-W01");
});

test("snapshotCartera toma prog/real por proyecto (con % o vacío)", () => {
  const snap = snapshotCartera([
    { nombre: "PH CHICOASÉN II", avanceProg: 49.7, avanceReal: "49.70%" },
    { nombre: "Nuevo", avanceProg: "", avanceReal: "SIN DATO" },
    { nombre: "" },
  ]);
  assert.deepEqual(snap, { "ph-chicoasen-ii": { prog: 49.7, real: 49.7 }, nuevo: { prog: null, real: null } });
});

test("snapshotMixtos usa TÍTULO 2 o TÍTULO 1", () => {
  const snap = snapshotMixtos([
    { "TÍTULO 1": "X", "TÍTULO 2": "SAN SIMÓN SOLAR", Parque: "94.00%", LT: "93.00%", Global: "93.80%" },
    { "TÍTULO 1": "Solo título uno", "TÍTULO 2": "", Parque: "10%", LT: "", Global: "5%" },
  ]);
  assert.deepEqual(snap, {
    "san-simon-solar": { parque: 94, lt: 93, global: 93.8 },
    "solo-titulo-uno": { parque: 10, lt: null, global: 5 },
  });
});

test("upsertCorte: misma semana reemplaza, otra semana agrega, orden cronológico", () => {
  let h = upsertCorte(null, { fecha: "2026-09-29", proyectos: { a: { real: 1 } } });
  h = upsertCorte(h, { fecha: "2026-09-24", proyectos: { a: { real: 0.5 } } }); // semana anterior
  h = upsertCorte(h, { fecha: "2026-10-01", proyectos: { a: { real: 1.2 } } }); // corrección misma semana
  assert.deepEqual(
    h.cortes.map((c) => [c.semana, c.fecha, c.proyectos.a.real]),
    [["2026-W39", "2026-09-24", 0.5], ["2026-W40", "2026-10-01", 1.2]]
  );
});

test("upsertCorte es idempotente (regenerar no crea puntos de más)", () => {
  const corte = { fecha: "2026-09-29", proyectos: { a: { real: 1 } } };
  const h1 = upsertCorte(null, corte);
  assert.deepEqual(upsertCorte(h1, corte), h1);
});
