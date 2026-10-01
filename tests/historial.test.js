// Pruebas de scripts/historial.js (cortes semanales de la curva de avance).
const test = require("node:test");
const assert = require("node:assert/strict");
const { localDate, isoWeek, corteDe, snapshotCartera, snapshotMixtos, upsertCorte } = require("../scripts/historial.js");

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
  assert.equal(isoWeek("2027-01-01"), "2026-W53"); // pertenece a la semana del año anterior
  assert.equal(isoWeek("2027-01-04"), "2027-W01");
});

test("corteDe: corte de jueves 8:00 a jueves 7:59 (hora de México)", () => {
  // México = UTC-6.
  assert.equal(corteDe("2026-10-01T14:00:00Z"), "2026-10-01"); // jue 08:00 -> ese jueves
  assert.equal(corteDe("2026-10-01T13:59:00Z"), "2026-09-24"); // jue 07:59 -> jueves anterior
  assert.equal(corteDe("2026-10-03T00:10:00Z"), "2026-10-01"); // vie 18:10
  assert.equal(corteDe("2026-10-08T05:00:00Z"), "2026-10-01"); // mié 23:00
  assert.equal(corteDe("2026-12-31T20:00:00Z"), "2026-12-31"); // cambio de año
  assert.equal(corteDe("2027-01-04T20:00:00Z"), "2026-12-31");
  assert.equal(corteDe("no es fecha"), null);
});

test("snapshotCartera toma prog/real por proyecto (con % o vacío)", () => {
  const snap = snapshotCartera([
    { nombre: "PH CHICOASÉN II", avanceProg: 49.7, avanceReal: "49.70%" },
    { nombre: "Nuevo", avanceProg: "", avanceReal: "SIN DATO" },
    { nombre: "" },
  ]);
  assert.deepEqual(snap, { "ph-chicoasen-ii": { prog: 49.7, real: 49.7 }, nuevo: { prog: null, real: null } });
});

test("snapshotMixtos usa TÍTULO 2 o TÍTULO 1 y guarda el grupo", () => {
  const snap = snapshotMixtos([
    { "TÍTULO 1": "X", "TÍTULO 2": "SAN SIMÓN SOLAR", Parque: "94.00%", LT: "93.00%", Global: "93.80%", "Grupo de atención": "b " },
    { "TÍTULO 1": "Solo título uno", "TÍTULO 2": "", Parque: "10%", LT: "", Global: "5%" },
  ]);
  assert.deepEqual(snap, {
    "san-simon-solar": { parque: 94, lt: 93, global: 93.8, grupo: "B" },
    "solo-titulo-uno": { parque: 10, lt: null, global: 5, grupo: null },
  });
});

test("upsertCorte: mismo corte reemplaza, otro jueves agrega, orden cronológico", () => {
  let h = upsertCorte(null, { excel: "2026-10-01T15:00:00Z", proyectos: { a: { real: 1 } } }); // jue 9:00
  h = upsertCorte(h, { excel: "2026-09-25T00:00:00Z", proyectos: { a: { real: 0.5 } } }); // corte anterior
  h = upsertCorte(h, { excel: "2026-10-06T23:00:00Z", proyectos: { a: { real: 1.2 } } }); // corrección (mar)
  assert.deepEqual(
    h.cortes.map((c) => [c.corte, c.fecha, c.proyectos.a.real]),
    [["2026-09-24", "2026-09-24", 0.5], ["2026-10-01", "2026-10-01", 1.2]]
  );
});

test("upsertCorte es idempotente (regenerar con el mismo Excel no crea puntos)", () => {
  const corte = { excel: "2026-10-01T15:00:00Z", proyectos: { a: { real: 1 } } };
  const h1 = upsertCorte(null, corte);
  assert.deepEqual(upsertCorte(h1, corte), h1);
});

test("upsertCorte conserva los cortes anteriores a la regla de los jueves", () => {
  const legado = {
    cortes: [
      { semana: "2026-W39", fecha: "2026-09-24", proyectos: { a: { real: 1 } } },
      { semana: "2026-W40", fecha: "2026-09-29", proyectos: { a: { real: 2 } } },
    ],
  };
  // El mismo Excel del corte legado (29 sep 18:18) no agrega nada.
  assert.deepEqual(upsertCorte(legado, { excel: "2026-09-30T00:18:25Z", proyectos: { a: { real: 2 } } }), legado);
  // Un Excel nuevo (jueves 1 oct) agrega su punto sin borrar los anteriores.
  const h = upsertCorte(legado, { excel: "2026-10-01T16:00:00Z", proyectos: { a: { real: 3 } } });
  assert.deepEqual(h.cortes.map((c) => c.fecha), ["2026-09-24", "2026-09-29", "2026-10-01"]);
});

test("upsertCorte regla semana (Mixtos): lunes a domingo, la última actualización manda", () => {
  const legado = { cortes: [{ semana: "2026-W40", fecha: "2026-09-30", proyectos: { a: { parque: 1 } } }] };
  // Viernes 2 oct (misma semana que el corte legado del miércoles): lo reemplaza.
  let h = upsertCorte(legado, { excel: "2026-10-02T23:00:00Z", proyectos: { a: { parque: 2 } } }, "semana");
  assert.deepEqual(h.cortes.map((c) => [c.semana, c.fecha, c.proyectos.a.parque]), [["2026-W40", "2026-10-02", 2]]);
  // Lunes 5 oct: semana nueva.
  h = upsertCorte(h, { excel: "2026-10-05T23:00:00Z", proyectos: { a: { parque: 3 } } }, "semana");
  // Miércoles 7 oct: reemplaza el del lunes.
  h = upsertCorte(h, { excel: "2026-10-07T23:00:00Z", proyectos: { a: { parque: 4 } } }, "semana");
  assert.deepEqual(
    h.cortes.map((c) => [c.semana, c.fecha, c.proyectos.a.parque]),
    [["2026-W40", "2026-10-02", 2], ["2026-W41", "2026-10-07", 4]]
  );
});
