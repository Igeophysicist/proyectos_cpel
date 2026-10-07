// Pruebas de cartera-mixtos/assets/js/kpis.js (totales del Resumen de Mixtos).
const test = require("node:test");
const assert = require("node:assert/strict");
const { esSegundaRonda, totales } = require("../cartera-mixtos/assets/js/kpis.js");

test("detecta los proyectos de 2da ronda por su nombre", () => {
  assert.equal(esSegundaRonda("DELARO (2DA RONDA)"), true);
  assert.equal(esSegundaRonda("SIERRA MADRE [EL CHORRO] (2da Ronda)"), true);
  assert.equal(esSegundaRonda("SAN SIMÓN SOLAR"), false);
  assert.equal(esSegundaRonda(""), false);
});

test("capacidad, CAPEX y avance promedio no cuentan los de 2da ronda", () => {
  const t = totales([
    { nombre: "A", capacidadNum: 100, capexNum: 50, globalPct: 80 },
    { nombre: "B", capacidadNum: 200, capexNum: null, globalPct: 60 },
    { nombre: "C (2DA RONDA)", capacidadNum: 580, capexNum: 999, globalPct: 10 },
    { nombre: "D", capacidadNum: null, capexNum: 25, globalPct: null },
  ]);
  assert.deepEqual(t, { capacidad: 300, capex: 75, avancePromedio: 70, excluidos: 1 });
});

test("sin proyectos que cuenten, el promedio queda vacío", () => {
  assert.deepEqual(totales([{ nombre: "X (2DA RONDA)", capacidadNum: 1, capexNum: 1, globalPct: 5 }]), {
    capacidad: 0,
    capex: 0,
    avancePromedio: null,
    excluidos: 1,
  });
});
