// Pruebas de assets/js/semana-resumen.js (sección "Esta semana" del portal).
const test = require("node:test");
const assert = require("node:assert/strict");
const { resumenMixtos, resumenCartera, domingoDe } = require("../assets/js/semana-resumen.js");

test("domingoDe: semana de domingo a sábado", () => {
  assert.equal(domingoDe("2026-10-01"), "2026-09-27"); // jueves
  assert.equal(domingoDe("2026-09-27"), "2026-09-27"); // domingo
  assert.equal(domingoDe("2026-10-03"), "2026-09-27"); // sábado
});

const cambio = (slug, antes, ahora, ga = "C", gb = "C") => ({
  slug, nombre: slug.toUpperCase(), antes: { parque: antes, grupo: ga }, ahora: { parque: ahora, grupo: gb },
});
const registros = [
  { excel: "2026-09-25T23:55:23.000Z", fecha: "2026-09-25", cambios: [cambio("x", 67.5, 83, "C", "B")] }, // semana anterior
  { excel: "2026-10-01T00:10:24.000Z", fecha: "2026-09-30", cambios: [cambio("b", 37.5, 18), cambio("a", 64.75, 81.5, "C", "B")] },
  { excel: "2026-10-02T00:22:10.000Z", fecha: "2026-10-01", cambios: [cambio("s", 80.5, 90.5, "B", "B")] },
];

test("resumenMixtos: actualizaciones de la semana (domingo a sábado), la más reciente arriba", () => {
  const r = resumenMixtos(registros, "2026-10-02");
  assert.equal(r.semanaIni, "2026-09-27");
  assert.equal(r.semanaFin, "2026-10-03");
  assert.equal(r.esActual, true);
  assert.deepEqual(r.entradas.map((e) => e.fecha), ["2026-10-01", "2026-09-30"]); // sin la de la semana anterior
  // dentro de cada actualización: primero lo que más avanzó
  assert.deepEqual(r.entradas[1].cambios.map((c) => [c.slug, c.antes, c.ahora, c.grupoAntes, c.grupoAhora]), [
    ["a", 64.75, 81.5, "C", "B"],
    ["b", 37.5, 18, "C", "C"],
  ]);
  assert.equal(r.entradas[0].cambios[0].diff, 10);
});

test("resumenMixtos: sin actualizaciones nuevas, se sigue mostrando la última semana", () => {
  const r = resumenMixtos(registros, "2026-10-13"); // dos semanas después
  assert.equal(r.esActual, false);
  assert.equal(r.semanaIni, "2026-09-27");
  assert.equal(r.entradas.length, 2);
  // con una actualización nueva, la semana cambia y solo se ve esa
  const r2 = resumenMixtos(
    [...registros, { excel: "2026-10-12T23:00:00.000Z", fecha: "2026-10-12", cambios: [cambio("a", 81.5, 85)] }],
    "2026-10-13"
  );
  assert.equal(r2.semanaIni, "2026-10-11");
  assert.equal(r2.esActual, true);
  assert.deepEqual(r2.entradas.map((e) => e.fecha), ["2026-10-12"]);
});

test("resumenMixtos: cambio solo de grupo queda con diferencia 0", () => {
  const r = resumenMixtos([{ excel: "2026-10-02T00:24:38.000Z", fecha: "2026-10-01", cambios: [cambio("s", 90.5, 90.5, "B", "A")] }], "2026-10-02");
  assert.deepEqual([r.entradas[0].cambios[0].diff, r.entradas[0].cambios[0].grupoAntes, r.entradas[0].cambios[0].grupoAhora], [0, "B", "A"]);
});

test("resumenMixtos: sin registros no hay resumen", () => {
  assert.equal(resumenMixtos([], "2026-10-01"), null);
  assert.equal(resumenMixtos(null, "2026-10-01"), null);
});

test("resumenCartera: Real y Programado del último corte y flecha contra el anterior", () => {
  const cortes = [
    { semana: "2026-W40", fecha: "2026-09-29", proyectos: { x: { prog: 77.44, real: 80.72 }, y: { prog: 49.7, real: 49.7 }, z: { prog: 5, real: 4 } } },
    { corte: "2026-10-01", fecha: "2026-10-01", proyectos: { x: { prog: 78, real: 81.92 }, y: { prog: 50, real: 49.7 }, z: { prog: 6, real: 3.5 }, w: { prog: 1, real: null } } },
  ];
  const r = resumenCartera(cortes, [
    { slug: "x", nombre: "X" },
    { slug: "y", nombre: "Y" },
    { slug: "z", nombre: "Z" },
    { slug: "w", nombre: "W" },
    { slug: "sin-corte", nombre: "Sin corte" },
  ]);
  assert.equal(r.fecha, "2026-10-01");
  assert.equal(r.esJueves, true);
  assert.equal(r.desde, "2026-09-29");
  assert.deepEqual(
    r.filas.map((f) => [f.slug, f.real, f.prog, f.cambio === null ? null : Math.round(f.cambio * 100) / 100]),
    [
      ["x", 81.92, 78, 1.2],
      ["y", 49.7, 50, 0],
      ["z", 3.5, 6, -0.5],
      ["w", null, 1, null],
    ]
  );
});

test("resumenCartera: con un solo corte no hay flecha", () => {
  const r = resumenCartera([{ fecha: "2026-09-24", proyectos: { x: { prog: 1, real: 1 } } }], [{ slug: "x", nombre: "X" }]);
  assert.equal(r.desde, null);
  assert.equal(r.esJueves, false);
  assert.equal(r.filas[0].cambio, null);
  assert.equal(resumenCartera([], []), null);
});
