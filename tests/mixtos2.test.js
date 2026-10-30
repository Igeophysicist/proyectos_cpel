// Pruebas de scripts/mixtos2.js (Excel de Mixtos 2da Ronda) y del estatus de trámites.
const test = require("node:test");
const assert = require("node:assert/strict");
const XLSX = require("xlsx");
const { leerMixtos2, conUnidad } = require("../scripts/mixtos2.js");
const Tramites = require("../cartera-mixtos/assets/js/tramites.js");

const DATOS = [
  "No.", "ID_VUPE", "Región", "Grupo de Interés Económico", "Proyecto", "Entidad", "Municipio", "Tecnología",
  "Capacidad Neta [MW]", "Porcentaje BESS [%]", "Almacenamiento BESS [MW]", "HORAS DE ALMACENAMIENTO",
  "Energía por horas [MWh]", "Inicio de Inversión", "Fin de Construcción", "Fecha firma de contrato", "CAPEX", "PRIORI",
];
const ENCABEZADOS = [...DATOS, ...Tramites.COLUMNAS.map(Tramites.colEstatus), ...Tramites.COLUMNAS];

/** Fila de un proyecto; "estatus" = { columna: estatus } (el resto Pendiente, 0 %). */
function proyecto(no, id, nombre, estatus = {}, extra = {}) {
  const datos = {
    "No.": no, ID_VUPE: id, Región: "Noreste", "Grupo de Interés Económico": "Socio SA", Proyecto: nombre,
    Entidad: "Coahuila", Municipio: "Saltillo", Tecnología: "Fotovoltaica", "Capacidad Neta [MW]": "120.00",
    "Porcentaje BESS [%]": "SIN DATO", "Almacenamiento BESS [MW]": "SIN DATO", "HORAS DE ALMACENAMIENTO": "SIN DATO",
    "Energía por horas [MWh]": "SIN DATO", "Inicio de Inversión": "SIN DATO", "Fin de Construcción": "SIN DATO",
    "Fecha firma de contrato": "SIN DATO", CAPEX: "SIN DATO", PRIORI: "NoP", ...extra,
  };
  Tramites.COLUMNAS.forEach((c) => {
    const est = Tramites.estatus(estatus[c] || "Pendiente");
    datos[Tramites.colEstatus(c)] = estatus[c] || "Pendiente";
    datos[c] = extra[c] ?? `${est ? est.avance : 0}%`;
  });
  return ENCABEZADOS.map((h) => datos[h] ?? "");
}

/** Libro con la hoja BASE_DE_DATOS: dos filas de títulos y los encabezados en la fila 3. */
function libro(filas, encabezados = ENCABEZADOS) {
  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.aoa_to_sheet([["Datos Relevantes del Proyecto"], [""], encabezados, ...filas]);
  XLSX.utils.book_append_sheet(wb, ws, "BASE_DE_DATOS");
  return XLSX.read(XLSX.write(wb, { type: "buffer", bookType: "xlsx" }), { type: "buffer" });
}

test("lee los proyectos con los nombres de columna de Mixtos y calcula Parque, LT y Global", () => {
  const wb = libro([
    proyecto(1, "573", "Bura Energy Center II", { A_MIA_P: "Liberado", A_MIA_LT: "En evaluación", ES_INT: "N/A" }),
    proyecto(2, "70", "CFE Cerro Prieto"),
  ]);
  const { errors, warnings, proyectos } = leerMixtos2(wb, XLSX, { kml: ["573", "70"] });
  assert.deepEqual(errors, []);
  assert.deepEqual(warnings, []);
  assert.equal(proyectos.length, 2);
  const [p] = proyectos;
  assert.equal(p["TÍTULO 2"], "Bura Energy Center II");
  assert.equal(p.ID_VUPE, "573");
  assert.equal(p.Ubicación, "Saltillo, Coahuila");
  assert.equal(p.Región, "Noreste");
  assert.equal(p.Socio, "Socio SA");
  assert.equal(p.Capacidad, "120 MW");
  assert.equal(p["Almacenamiento BESS"], "SIN DATO");
  assert.equal(p["Energía por horas"], "SIN DATO");
  assert.equal(p["Porcentaje BESS"], "SIN DATO");
  assert.equal(p.A_MIA_P_ESTATUS, "Liberado");
  // Parque = MIA 20 × 100 % + Interconexión 10 × 100 % = 30; LT = MIA 20 × 50 % + 10 = 20.
  assert.equal(p.Parque, "30.00%");
  assert.equal(p.LT, "20.00%");
  assert.equal(p.Global, "28.00%");
});

test("encuentra los encabezados aunque se agreguen filas arriba", () => {
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([["Título"], [""], [""], [""], ENCABEZADOS, proyecto(1, "9", "Uno")]), "BASE_DE_DATOS");
  const { errors, proyectos } = leerMixtos2(XLSX.read(XLSX.write(wb, { type: "buffer", bookType: "xlsx" }), { type: "buffer" }), XLSX, { kml: ["9"] });
  assert.deepEqual(errors, []);
  assert.equal(proyectos.length, 1);
});

test("un estatus que no está en REGLAS o un avance que no le corresponde es error", () => {
  const wb = libro([
    proyecto(1, "1", "Uno", { DI_P: "En revisión" }),
    proyecto(2, "2", "Dos", { DI_LT: "En elaboración" }, { DI_LT: "50%" }),
    proyecto(3, "3", "Tres", { CONA_C: "Requerimiento" }, { CONA_C: "ERROR" }),
  ]);
  const { errors } = leerMixtos2(wb, XLSX, { kml: ["1", "2", "3"] });
  assert.equal(errors.length, 3);
  assert.match(errors[0], /Fila 4 \(Uno\), columna DI_P_ESTATUS \([A-Z]+\): "En revisión" no es un estatus/);
  assert.match(errors[1], /Fila 5 \(Dos\), columna DI_LT .*el estatus "En elaboración" vale 20%/);
  assert.match(errors[2], /Fila 6 \(Tres\), columna CONA_C .*"ERROR"/);
});

test("el estatus se reconoce sin importar acentos ni mayúsculas, y se publica como en REGLAS", () => {
  const wb = libro([proyecto(1, "1", "Uno", { DI_P: "en dictaminacion" })]);
  const { errors, proyectos } = leerMixtos2(wb, XLSX, { kml: ["1"] });
  assert.deepEqual(errors, []);
  assert.equal(proyectos[0].DI_P_ESTATUS, "En dictaminación");
});

test("ID_VUPE repetido o sin punto en el KML, PRIORI inválido y columnas faltantes", () => {
  const dup = leerMixtos2(libro([proyecto(1, "5", "Uno"), proyecto(2, "5", "Dos", {}, { PRIORI: "Si" })]), XLSX, { kml: [] });
  assert.ok(dup.errors.some((e) => /ID_VUPE 5 se repite \(igual que la fila 4\)/.test(e)));
  assert.ok(dup.errors.some((e) => /PRIORI .*"Si" no es válido/.test(e)));
  assert.ok(dup.warnings.some((w) => /"Uno" \(ID_VUPE 5\) no tiene punto en el KML/.test(w)));

  const sinCol = leerMixtos2(libro([], ENCABEZADOS.filter((h) => h !== "S_CONS_ESTATUS")), XLSX);
  assert.match(sinCol.errors[0], /Falta la columna "S_CONS_ESTATUS" en la fila 3/);
});

test("almacenamiento, energía y capacidad con su unidad", () => {
  const wb = libro([proyecto(1, "1", "Uno", {}, { "Porcentaje BESS [%]": "30.00%", "Almacenamiento BESS [MW]": "24.00", "HORAS DE ALMACENAMIENTO": "3", "Energía por horas [MWh]": "72.00" })]);
  const [p] = leerMixtos2(wb, XLSX, { kml: ["1"] }).proyectos;
  assert.equal(p["Porcentaje BESS"], "30.00%");
  assert.equal(p["Almacenamiento BESS"], "24 MW");
  assert.equal(p["Horas de Almacenamiento"], "3");
  assert.equal(p["Energía por horas"], "72 MWh");
  assert.equal(conUnidad("301.50", "MW"), "301.5 MW");
  assert.equal(conUnidad("SIN DATO", "MW"), "SIN DATO");
});

test("estatus de Mixtos (texto libre): colores del código de Mixtos, otro texto en gris claro, vacío o 0 sin estatus", () => {
  assert.equal(Tramites.estatusMostrado("Liberado").color, "#D8E4BC");
  assert.equal(Tramites.estatusMostrado("N/A").color, "#D8E4BC");
  assert.equal(Tramites.estatusMostrado("En elaboracion").color, "#E79999");
  assert.equal(Tramites.estatusMostrado("En actualización").color, "#8DB4E2");
  assert.equal(Tramites.estatusMostrado("En evaluación").color, "#FFFF99");
  assert.equal(Tramites.estatusMostrado("Concluida").color, "#FABF8F");
  assert.deepEqual(Tramites.estatusMostrado(" Iniciada "), { nombre: "Iniciada", avance: null, color: "#D9D9D9" });
  assert.equal(Tramites.estatusMostrado("Otro").color, "#e7ebea");
  // 2da Ronda: colores de REGLAS
  assert.equal(Tramites.estatusMostrado("liberado", "reglas").color, "#92D050");
  assert.equal(Tramites.estatusMostrado("0"), null);
  assert.equal(Tramites.estatusMostrado(0), null);
  assert.equal(Tramites.estatusMostrado(""), null);
});

test("desglose de trámites: estatus por lado, y null en Mixtos (sin columnas de estatus)", () => {
  const raw = Object.fromEntries(Tramites.COLUMNAS.map((c) => [c, "0%"]));
  assert.equal(Tramites.desglose(raw)[0].estParque, null);
  raw.A_MIA_P_ESTATUS = "Liberado";
  const mia = Tramites.desglose(raw, { paleta: "reglas" }).find((t) => t.id === "mia");
  assert.equal(mia.estParque.nombre, "Liberado");
  assert.equal(mia.estParque.color, "#92D050");
});
