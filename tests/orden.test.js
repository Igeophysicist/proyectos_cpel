// Pruebas de cartera-mixtos/assets/js/orden.js ("Ordenar por" del listado).
const test = require("node:test");
const assert = require("node:assert/strict");
const { ordenar, valida, ORDENES } = require("../cartera-mixtos/assets/js/orden.js");

const P = [
  { id: "0", nombre: "Zeta Solar", globalPct: 40, parquePct: 50, grupo: "C", finConstruccionFecha: new Date(2028, 6, 1), capacidadNum: 100 },
  { id: "1", nombre: "Álvaro Obregón", globalPct: 90, parquePct: 95, grupo: "A", finConstruccionFecha: null, capacidadNum: 300 },
  { id: "2", nombre: "Bravo", globalPct: null, parquePct: 10, grupo: "", finConstruccionFecha: new Date(2027, 0, 1), capacidadNum: null },
  { id: "3", nombre: "carmen", globalPct: 90, parquePct: 20, grupo: "B", finConstruccionFecha: new Date(2027, 0, 1), capacidadNum: 300 },
];
const ids = (lista) => lista.map((p) => p.id).join(",");

test("ordenar: cada criterio, sin dato al final y empates en orden del Excel", () => {
  assert.equal(ids(ordenar(P, "excel")), "0,1,2,3");
  assert.equal(ids(ordenar(P, "nombre")), "1,2,3,0"); // sin distinguir acentos ni mayúsculas
  assert.equal(ids(ordenar(P, "global")), "1,3,0,2"); // 90, 90 (empate: Excel), 40, sin dato
  assert.equal(ids(ordenar(P, "parque")), "1,0,3,2");
  assert.equal(ids(ordenar(P, "grupo")), "1,3,0,2");
  assert.equal(ids(ordenar(P, "cod")), "2,3,0,1"); // más próximo primero; sin COD al final
  assert.equal(ids(ordenar(P, "capacidad")), "1,3,0,2");
});

test("ordenar no modifica la lista original; claves desconocidas = orden del Excel", () => {
  const copia = P.slice();
  ordenar(P, "global");
  assert.deepEqual(P, copia);
  assert.equal(valida("nada"), "excel");
  assert.equal(ids(ordenar(P, "nada")), "0,1,2,3");
  assert.ok(Object.keys(ORDENES).includes("excel"));
});
