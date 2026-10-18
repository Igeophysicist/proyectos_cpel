const test = require("node:test");
const assert = require("node:assert");
const T = require("../cartera-mixtos/assets/js/tramites.js");
const { proyectos } = require("../cartera-mixtos/data/DATOS_MIXTOS.json");

test("los pesos suman 100 % (Parque y LT) y Global es 80/20", () => {
  assert.equal(T.TRAMITES.reduce((s, t) => s + t.peso, 0), 100);
  assert.equal(T.PESO_GLOBAL.parque + T.PESO_GLOBAL.lt, 1);
});

test("con los datos actuales, la ponderación da los mismos Parque, LT y Global del Excel", () => {
  const conDesglose = proyectos.filter((r) => T.desglose(r));
  assert.ok(conDesglose.length > 0);
  for (const r of conDesglose) {
    const c = T.ponderado(T.desglose(r));
    for (const [col, v] of [["Parque", c.parque], ["LT", c.lt], ["Global", c.global]]) {
      assert.ok(Math.abs(parseFloat(r[col]) - v) <= 0.05, `${r["TÍTULO 2"]}: ${col} ${r[col]} vs ${v}`);
    }
  }
});

test("faltantes: puntos pendientes por trámite, de mayor a menor y sin los completos", () => {
  const raw = Object.fromEntries(T.COLUMNAS.map((c) => [c, "100%"]));
  raw.A_MIA_P = "50%"; // 20 % de peso -> faltan 10 pts
  raw.AFAC_C = "0%"; // 5 % -> faltan 5 pts
  assert.deepEqual(T.faltantes(T.desglose(raw), "parque"), [
    { nombre: "MIA – DTU", pts: 10 },
    { nombre: "AFAC", pts: 5 },
  ]);
  assert.deepEqual(T.faltantes(T.desglose(raw), "lt"), []);
  assert.equal(T.desglose({ Parque: "90%" }), null); // sin columnas de trámites
});
