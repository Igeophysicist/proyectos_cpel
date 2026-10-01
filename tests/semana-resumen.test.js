// Pruebas de assets/js/semana-resumen.js (sección "Esta semana" del portal).
const test = require("node:test");
const assert = require("node:assert/strict");
const { resumenMixtos, resumenCartera, lunesDe } = require("../assets/js/semana-resumen.js");

test("lunesDe: lunes de la semana (lunes a domingo)", () => {
  assert.equal(lunesDe("2026-10-01"), "2026-09-28"); // jueves
  assert.equal(lunesDe("2026-09-28"), "2026-09-28"); // lunes
  assert.equal(lunesDe("2026-10-04"), "2026-09-28"); // domingo
});

const mixtos = [
  {
    semana: "2026-W39",
    fecha: "2026-09-25",
    proyectos: {
      a: { parque: 64.75, grupo: "C" },
      b: { parque: 37.5, grupo: "C" },
      c: { parque: 94, grupo: "A" },
      d: { parque: 10, grupo: "B" },
    },
  },
  {
    semana: "2026-W40",
    fecha: "2026-10-02",
    proyectos: {
      a: { parque: 81.5, grupo: "B" }, // avanzó y cambió de grupo
      b: { parque: 18, grupo: "C" }, // bajó, mismo grupo
      c: { parque: 94, grupo: "B" }, // solo cambió el grupo: no cuenta
      d: { parque: 10.004, grupo: "B" }, // redondeo: no cuenta
      e: { parque: 5, grupo: "A" }, // nuevo: no hay con qué comparar
    },
  },
];

test("resumenMixtos: solo proyectos cuyo Parque cambió, con el estado del grupo", () => {
  const r = resumenMixtos(mixtos, { a: "Proyecto A" }, "2026-10-03");
  assert.equal(r.semanaIni, "2026-09-28");
  assert.equal(r.semanaFin, "2026-10-04");
  assert.equal(r.esActual, true);
  assert.equal(r.desde, "2026-09-25");
  assert.deepEqual(
    r.cambios.map((c) => [c.slug, c.nombre, c.antes, c.ahora, c.grupoAntes, c.grupoAhora]),
    [
      ["a", "Proyecto A", 64.75, 81.5, "C", "B"],
      ["b", "b", 37.5, 18, "C", "C"],
    ]
  );
});

test("resumenMixtos: semana sin actualizaciones muestra la última que sí tuvo", () => {
  const r = resumenMixtos(mixtos, {}, "2026-10-06"); // martes de la semana siguiente
  assert.equal(r.esActual, false);
  assert.equal(r.semanaIni, "2026-09-28");
});

test("resumenMixtos: con menos de dos cortes no hay resumen", () => {
  assert.equal(resumenMixtos([mixtos[0]], {}, "2026-10-01"), null);
  assert.equal(resumenMixtos(null, {}, "2026-10-01"), null);
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
