// Pruebas de cartera-cpel/assets/js/hitos.js (anterior / actual / próximo de la ficha).
const test = require("node:test");
const assert = require("node:assert/strict");
globalThis.TextUtils = require("../assets/js/shared/text-utils.js");
const H = require("../cartera-cpel/assets/js/hitos.js");

const hito = (num, programada, estatus, extra = {}) => ({ num: String(num), desc: `Hito ${num}`, pct: 10, programada, solicitud: "", pago: "", estatus, ...extra });
const HOY = "2026-10-20";

test("anterior = último pagado; actual = el sin pagar más antiguo; próximo = el siguiente a futuro", () => {
  const p = {
    contratos: [
      {
        nombre: "",
        hitos: [
          hito(1, "2026-01-20", "pagado", { pago: "2026-02-25" }),
          hito(5, "2026-08-08", "pagado", { pago: "2026-09-25" }),
          hito(8, "2026-07-19", "inconcluso"),
          hito(7, "2026-10-07", "pendiente"),
          hito(11, "2026-11-13", "pendiente"),
          hito(10, "2027-02-04", "pendiente"),
        ],
      },
    ],
  };
  const r = H.resumen(p, HOY);
  assert.equal(r.anterior.num, "5");
  assert.equal(r.actual.num, "8");
  assert.equal(r.proximo.num, "11");
  assert.equal(r.otrosVencidos, 1); // el 7
  assert.equal(r.pagados, 2);
  assert.equal(r.total, 6);
});

test("vencido: sin pagar con fecha pasada, salvo en tránsito de pago", () => {
  assert.equal(H.vencido(hito(1, "2026-10-19", "pendiente"), HOY), true);
  assert.equal(H.vencido(hito(1, "2026-10-19", "transito"), HOY), false);
  assert.equal(H.vencido(hito(1, "2026-10-19", "pagado"), HOY), false);
  assert.equal(H.vencido(hito(1, "2026-10-20", "pendiente"), HOY), false);
  assert.equal(H.vencido(hito(1, "", "pendiente"), HOY), false);
});

test("varios contratos: se juntan y cada hito lleva su contrato; % pagado por contrato", () => {
  const p = {
    contratos: [
      { nombre: "AHYG", hitos: [hito(1, "2024-11-28", "pagado", { pct: 70 }), hito(2, "2025-01-28", "pendiente", { pct: 30 })] },
      { nombre: "SIEMES", hitos: [hito(10, "2026-12-01", "pendiente")] },
    ],
  };
  const r = H.resumen(p, HOY);
  assert.equal(r.actual.contrato, "AHYG");
  assert.equal(r.proximo.contrato, "SIEMES");
  assert.equal(H.pctPagado(p.contratos[0]), 70);
  const html = H.ventana(p, HOY, 1);
  assert.match(html, /role="tablist"/);
  assert.match(html, /data-contrato="1"[^>]*>SIEMES|aria-selected="true" data-contrato="1">SIEMES/);
});

test("descripciones: saltos de línea, guiones, listas con ; o comas y oraciones", () => {
  assert.deepEqual(H.bloques("Suministro de:\n-Sistema contra incendio\n-Sistema de aire"), [
    { p: "Suministro de:" },
    { lista: ["Sistema contra incendio", "Sistema de aire"] },
  ]);
  assert.deepEqual(H.bloques("Suministro de: -Uno -Dos -Tres"), [{ p: "Suministro de:" }, { lista: ["Uno", "Dos", "Tres"] }]);
  assert.deepEqual(H.bloques("Ingeniería aprobada (Arreglo rev0; Unifilar rev0; Geotecnia rev0.)"), [
    { p: "Ingeniería aprobada" },
    { lista: ["Arreglo rev0", "Unifilar rev0", "Geotecnia rev0"] },
  ]);
  assert.deepEqual(H.bloques("Terminación de fabricación Columna (U1), Escotilla (U1), Anillo (U1), Flecha (U1 y U2), Sello (U1), Servomotor (U1), Laminado (U2) (GRUPO 3)"), [
    { p: "Terminación de fabricación (GRUPO 3):" },
    { lista: ["Columna (U1)", "Escotilla (U1)", "Anillo (U1)", "Flecha (U1 y U2)", "Sello (U1)", "Servomotor (U1)", "Laminado (U2)"] },
  ]);
  assert.deepEqual(H.bloques("Entrega de manuales en rev0. Entrega del Programa de ejecución aprobado por la CFE."), [
    { p: "Entrega de manuales en rev0." },
    { p: "Entrega del Programa de ejecución aprobado por la CFE." },
  ]);
  // Abreviaturas y pedazos cortos no se cortan.
  assert.equal(H.bloques("Llegada a Sitio de la S.E. CFV Puerto Peñasco y S.E. Cucapáh Bco. 3").length, 1);
  assert.equal(H.bloques("Pruebas de fábrica satisfactorias. U1 y U2.").length, 1);
});

test("monto con su moneda", () => {
  assert.equal(H.monto({ monto: 14700350, moneda: "USD" }), "$14,700,350.00 USD");
  assert.equal(H.monto({ monto: 1446688.69, moneda: "MXN" }), "$1,446,688.69 MXN");
  assert.equal(H.monto({}), "");
});

test("todo pagado o sin datos: mensajes claros", () => {
  const todo = { contratos: [{ nombre: "", hitos: [hito(1, "2025-01-01", "pagado")] }] };
  assert.match(H.tarjeta(todo, HOY), /Todos los hitos están pagados/);
  assert.match(H.tarjeta(undefined, HOY), /Sin hitos registrados/);
  assert.match(H.ventana(undefined, HOY), /Sin hitos registrados/);
  assert.match(H.tarjeta({ contratos: [{ nombre: "", hitos: [hito(2, "2026-10-01", "pendiente")] }] }, HOY), /Fecha vencida/);
});
