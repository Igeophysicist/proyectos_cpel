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

test("todo pagado o sin datos: mensajes claros y nunca montos", () => {
  const todo = { contratos: [{ nombre: "", hitos: [hito(1, "2025-01-01", "pagado")] }] };
  assert.match(H.tarjeta(todo, HOY), /Todos los hitos están pagados/);
  assert.match(H.tarjeta(undefined, HOY), /Sin hitos registrados/);
  assert.match(H.ventana(undefined, HOY), /Sin hitos registrados/);
  assert.match(H.tarjeta({ contratos: [{ nombre: "", hitos: [hito(2, "2026-10-01", "pendiente")] }] }, HOY), /Fecha vencida/);
});
