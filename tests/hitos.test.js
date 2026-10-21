// Pruebas de scripts/hitos.js (lectura del Excel de hitos de pago de Cartera CPEL).
const test = require("node:test");
const assert = require("node:assert/strict");
const XLSX = require("xlsx");
const { leerHitos, proyectoDeHoja, nombreCorto, estatusDe } = require("../scripts/hitos.js");

const NOMBRES = [
  "CFV PUERTO PEÑASCO SECUENCIA III",
  "CFV PUERTO PEÑASCO SECUENCIA IV",
  "PEH SANTA MARÍA",
  "PEH PICACHOS",
  "PEH AMATA",
  "PH CHICOASÉN II",
];

/** Libro de prueba: { hoja: filas } (las fechas como números de Excel). */
function libro(hojas) {
  const wb = XLSX.utils.book_new();
  Object.entries(hojas).forEach(([n, filas]) => XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(filas), n));
  // Ida y vuelta para tener los mismos tipos de celda que un archivo real.
  return XLSX.read(XLSX.write(wb, { type: "buffer", bookType: "xlsx" }), { type: "buffer" });
}
const fechaExcel = (iso) => (Date.UTC(...iso.split("-").map((v, i) => Number(v) - (i === 1 ? 1 : 0))) - Date.UTC(1899, 11, 30)) / 86400000;

test("cada hoja corresponde a su proyecto (abreviaturas y número final)", () => {
  assert.equal(proyectoDeHoja("PPSIII", NOMBRES), "CFV PUERTO PEÑASCO SECUENCIA III");
  assert.equal(proyectoDeHoja("PPSIV", NOMBRES), "CFV PUERTO PEÑASCO SECUENCIA IV");
  assert.equal(proyectoDeHoja("CHICOASEN_II_2", NOMBRES), "PH CHICOASÉN II");
  assert.equal(proyectoDeHoja("STA_MARIA", NOMBRES), "PEH SANTA MARÍA");
  assert.equal(proyectoDeHoja("PICACHOS_9", NOMBRES), "PEH PICACHOS");
  assert.equal(proyectoDeHoja("Hoja1", NOMBRES), null);
});

test("nombre corto del contrato y estatus", () => {
  assert.equal(nombreCorto("AHYG Contrato FIEL/10670-025/2024, Anexo 2G"), "AHYG");
  assert.equal(nombreCorto("Contrato F/1320-004-2022, Anexo 28 (Convenio Modificatorio No. 05)"), "F/1320-004-2022");
  assert.equal(nombreCorto(""), "");
  assert.equal(estatusDe("PAGADO"), "pagado");
  assert.equal(estatusDe("Pagado parcialmente"), "parcial");
  assert.equal(estatusDe("EN TRÁNSITO DE PAGO"), "transito");
  assert.equal(estatusDe("HITO INCONCLUSO"), "inconcluso");
  assert.equal(estatusDe("PENDIENTE"), "pendiente");
  assert.equal(estatusDe(""), "sin");
  assert.equal(estatusDe("CANCELADO"), "otro");
});

test("lee varias tablas por hoja, sin montos, y fechas numéricas o en texto", () => {
  const encabezado = ["No. Hito", "Descripción de Hito de Pago", "Valor sobre el Precio Alzado del Contrato", "Fecha programada de cumplimiento", "Monto a pagar USD", "Fecha de solicitud de pago", "Fecha de pago", "Estatus"];
  const wb = libro({
    PICACHOS_9: [
      ["AHYG Contrato FIEL/10670-025/2024, Anexo 2G"],
      encabezado,
      [1, "Entrega de bienes", 0.7, fechaExcel("2024-11-28"), 1000, "", fechaExcel("2025-11-20"), "PAGADO"],
      [2, "Entrega de servicios", 0.3, "28-ene-2025", 2000, "", "", "PENDIENTE"],
      ["Total", "", "", "", 3000],
      ["SUMRI Contrato FIEL/10670-031/2024, Anexo 2G"],
      encabezado,
      [1, "Bienes", "70%", "1-Sep-26", 5, "", "", "EN TRÁNSITO DE PAGO"],
      [2, "Servicios", "30%", "01-dic-2026", 5, "", "", ""],
    ],
  });
  const { errors, warnings, proyectos } = leerHitos(wb, XLSX, NOMBRES);
  assert.deepEqual(errors, []);
  const p = proyectos["peh-picachos"];
  assert.equal(p.nombre, "PEH PICACHOS");
  assert.deepEqual(p.contratos.map((c) => c.nombre), ["AHYG", "SUMRI"]);
  assert.deepEqual(p.contratos[0].hitos[0], {
    num: "1", desc: "Entrega de bienes", pct: 70, programada: "2024-11-28", solicitud: "", pago: "2025-11-20", estatus: "pagado",
  });
  assert.equal(p.contratos[0].hitos[1].programada, "2025-01-28");
  assert.equal(p.contratos[1].hitos[0].programada, "2026-09-01");
  assert.equal(p.contratos[1].hitos[0].estatus, "transito");
  assert.equal(p.contratos[1].hitos[1].programada, "2026-12-01");
  // Ningún monto llega a los datos publicados.
  assert.doesNotMatch(JSON.stringify(proyectos), /1000|2000|3000/);
  assert.equal(warnings.filter((w) => /montos/.test(w)).length, 1);
  assert.ok(warnings.some((w) => /hito 2\): no tiene estatus/.test(w)));
});

test("errores: hoja sin proyecto, sin estatus y fecha ilegible; aviso si el % no suma 100", () => {
  const wb = libro({
    Hoja1: [["No. Hito", "Descripción", "Estatus"]],
    AMATA: [
      ["No. Hito", "Descripción de Hito de Pago", "Valor sobre el Precio del Contrato", "Fecha Evento Crítico", "Tipo de Evento", "Estatus"],
      [1, "Inicio", 0.5, "mañana", "Crítico", "PAGADO"],
    ],
    PPSIII: [["No. Hito de Pago y Evento Crítico", "Fecha del Evento Crítico", "Descripción de Hito de Pago y Evento Crítico"], [1, fechaExcel("2026-01-20"), "Manuales"]],
  });
  const { errors, warnings, proyectos } = leerHitos(wb, XLSX, NOMBRES);
  assert.ok(errors.some((e) => /Hoja "Hoja1": no corresponde/.test(e)));
  assert.ok(errors.some((e) => /AMATA.*"mañana" no es una fecha válida/.test(e)));
  assert.ok(errors.some((e) => /PPSIII.*no tiene columna "Estatus"/.test(e)));
  assert.ok(warnings.some((w) => /AMATA.*suman 50 %/.test(w)));
  assert.equal(proyectos["peh-amata"].contratos[0].hitos[0].tipo, "Crítico");
});
