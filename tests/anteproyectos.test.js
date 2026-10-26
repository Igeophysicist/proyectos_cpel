// Pruebas de scripts/anteproyectos.js (Excel de Cartera Anteproyectos).
const test = require("node:test");
const assert = require("node:assert/strict");
const XLSX = require("xlsx");
const { leerAnteproyectos, snapshotAnteproyectos, sufijoDe, encabezado, limpiar } = require("../scripts/anteproyectos.js");

/** Libro de prueba: { hoja: { filas, merges } }. */
function libro(hojas) {
  const wb = XLSX.utils.book_new();
  Object.entries(hojas).forEach(([n, { filas, merges }]) => {
    const ws = XLSX.utils.aoa_to_sheet(filas);
    if (merges) ws["!merges"] = merges.map((m) => XLSX.utils.decode_range(m));
    XLSX.utils.book_append_sheet(wb, ws, n);
  });
  return XLSX.read(XLSX.write(wb, { type: "buffer", bookType: "xlsx" }), { type: "buffer" });
}

const BASE = {
  PRES: { filas: [["No.", "Proyecto", "Tecnología", "Ubicación", "Imagen", "Capacidad", "Nivel de estudio"], [1, "PFV Uno", "Fotovoltaico", "Sonora", "", "20 MW", "Prefactibilidad"], [2, "EO Dos", "Eólico", "Oaxaca", "data/IMAGENES/dos.jpg"]] },
  DESC: { filas: [["No.", "Proyecto", "Descripción"], [1, "PFV Uno", "Párrafo uno.\r\n\r\n1. Obra A\r\n2. Obra B"]] },
  RTA: {
    filas: [
      ["Red de Transmisión Propuesta (RTA)"],
      ["No.", "Proyecto", "Especificaciones del sistema", "", "Componetes", "", "Punto de Interconexión (POI)"],
      [1, "PFV Uno", "Nivel de Tensión [kV]", "Longitud [km]", "COMPONENTE", "DESCRIPCIÓN TÉCNICA**", "SE Eléctrica"],
      ["", "", 115, 0.2, "Torres", "Celosía", "SE Norte"],
      ["", "", "", "", "Protecciones", "Relés", ""],
      [2, "EO Dos", "", "", "", "", ""],
      ["", "", 230, 5, "Torres", "Tubulares", "SE Sur"],
    ],
    merges: ["A1:G1", "C2:D2", "E2:F2", "A3:A5", "B3:B5", "A6:A7", "B6:B7"],
  },
  FICHA_FOTOV: { filas: [["No.", "Proyecto", "Potencia​ [MW]", "Estructura"], [1, "PFV Uno", "19.7", "Fija​"]] },
  AVAN_FOTOV: {
    filas: [
      ["No.", "Proyecto", "TIPO DE AVANCE", "GENERAL", "1. Ambiental", "1.1 Tierra", "2. Ingeniería", "NOTA TOTAL", "NOTA (1.1)"],
      [1, "PFV Uno", "Real", "58%", "56%", "50%", "60%", "Nota general", "Nota de tierra"],
      ["", "", "Programado", "0%", "0%", "0%", "0%"],
    ],
    merges: ["A2:A3", "B2:B3"],
  },
  FICHA_EO: { filas: [["No.", "Proyecto", "Aerogeneradores"], [2, "EO Dos", "30"]] },
  AVAN_EO: { filas: [["No.", "Proyecto", "TIPO DE AVANCE", "GENERAL"], [2, "EO Dos", "Real", "10%"], [2, "EO Dos", "Programado", "20%"]] },
};

test("tecnología -> sufijo de hojas, también con la hoja TIPOS", () => {
  assert.equal(sufijoDe("Fotovoltaico"), "FOTOV");
  assert.equal(sufijoDe("Equipamiento Hidroeléctrico"), "EQUIHIDRO");
  assert.equal(sufijoDe("Hidroeléctrico"), "HIDRO");
  assert.equal(sufijoDe("Eólico"), "EO");
  assert.equal(sufijoDe("Termosolar"), "TERSOL");
  assert.equal(sufijoDe("Proyecto de Acumulación de Energía por Bombeo"), "PAEB");
  assert.equal(sufijoDe("Geotérmico"), null);
  assert.equal(sufijoDe("Geotérmico", [{ tecnologia: "Geotérmico", sufijo: "GEO" }]), "GEO");
});

test("limpieza: invisibles de PowerPoint, asteriscos de nota y erratas de encabezado", () => {
  assert.equal(limpiar("30,380​"), "30,380");
  assert.equal(encabezado("DESCRIPCIÓN TÉCNICA**"), "DESCRIPCIÓN TÉCNICA");
  assert.equal(encabezado("Componetes"), "Componentes");
});

test("lee las 5 hojas de cada proyecto según su tecnología", () => {
  const { errors, warnings, proyectos } = leerAnteproyectos(libro(BASE), XLSX, { kml: ["PFV Uno"], existe: () => false });
  assert.deepEqual(errors, []);
  const [uno, dos] = proyectos;
  assert.equal(uno.tipo, "FOTOV");
  assert.deepEqual(uno.extras, [{ campo: "Capacidad", valor: "20 MW" }]);
  assert.equal(uno.nivel, "Prefactibilidad");
  assert.equal(uno.descripcion, "Párrafo uno.\n\n1. Obra A\n2. Obra B");
  assert.deepEqual(uno.ficha, [{ campo: "Potencia [MW]", valor: "19.7" }, { campo: "Estructura", valor: "Fija" }]);

  const secciones = Object.fromEntries(uno.rta.secciones.map((s) => [s.tipo, s]));
  assert.equal(uno.rta.titulo, "Red de Transmisión Propuesta (RTA)");
  assert.deepEqual(secciones.especificaciones.campos, [{ campo: "Nivel de Tensión [kV]", valor: "115" }, { campo: "Longitud [km]", valor: "0.2" }]);
  assert.equal(secciones.componentes.titulo, "Componentes");
  assert.deepEqual(secciones.componentes.columnas, ["COMPONENTE", "DESCRIPCIÓN TÉCNICA"]);
  assert.deepEqual(secciones.componentes.filas, [["Torres", "Celosía"], ["Protecciones", "Relés"]]);
  assert.equal(secciones.poi.campos[0].valor, "SE Norte");
  // El segundo proyecto escribe su No. en su propia fila (combinada) y no se mezcla con el primero.
  assert.equal(dos.rta.secciones.find((s) => s.tipo === "poi").campos[0].valor, "SE Sur");

  assert.equal(uno.avance.general.real, 58);
  assert.equal(uno.avance.general.nota, "Nota general");
  assert.equal(uno.avance.grupos[0].items[0].nota, "Nota de tierra");
  assert.deepEqual(uno.avance.grupos.map((g) => [g.clave, g.items.length]), [["1", 1], ["2", 0]]);
  assert.equal(uno.avance.programadoPendiente, true);
  assert.equal(dos.avance.programadoPendiente, false);

  assert.deepEqual(snapshotAnteproyectos(proyectos), { "pfv-uno": { prog: null, real: 58 }, "eo-dos": { prog: 20, real: 10 } });
  assert.ok(warnings.some((w) => /EO Dos: no tiene ubicación en el KML/.test(w)));
  assert.ok(warnings.some((w) => /no existe la imagen/.test(w)));
  assert.ok(warnings.some((w) => /EO Dos: no tiene fila en la hoja "DESC"/.test(w)));
});

test("RTA con fila de grupos arriba y No./Proyecto en la fila de encabezados", () => {
  const hojas = {
    ...BASE,
    RTA: {
      filas: [
        ["Red de Transmisión Propuesta (RTA)"],
        ["Identificadores", "", "Especificaciones del sistema", "", "Componetes", "", "Punto de Interconexión (POI)"],
        ["No.", "Proyecto", "Nivel de Tensión [kV]", "Longitud [km]", "COMPONENTE", "CANTIDAD", "SE Eléctrica"],
        [1, "PFV Uno", 115, 0.2, "Torres", "2 Unid.", "SE Norte"],
        ["", "", "", "", "Protecciones", "1 Equip.", ""],
        [2, "EO Dos", 230, 5, "Torres", "28 Unid.", "SE Sur"],
      ],
      merges: ["A1:G1", "A2:B2", "C2:D2", "E2:F2", "A4:A5", "B4:B5"],
    },
  };
  const { errors, proyectos } = leerAnteproyectos(libro(hojas), XLSX);
  assert.deepEqual(errors, []);
  const [uno, dos] = proyectos.map((p) => Object.fromEntries(p.rta.secciones.map((s) => [s.tipo, s])));
  assert.deepEqual(uno.especificaciones.campos.map((c) => c.valor), ["115", "0.2"]);
  assert.deepEqual(uno.componentes.filas, [["Torres", "2 Unid."], ["Protecciones", "1 Equip."]]);
  assert.equal(dos.poi.campos[0].valor, "SE Sur");
  assert.equal(proyectos[0].rta.titulo, "Red de Transmisión Propuesta (RTA)");
});

test("errores: tecnología desconocida, porcentaje inválido y proyecto repetido", () => {
  const hojas = {
    ...BASE,
    PRES: { filas: [["No.", "Proyecto", "Tecnología"], [1, "PFV Uno", "Fotovoltaico"], [3, "GEO Tres", "Geotérmico"], [4, "PFV Uno", "Fotovoltaico"]] },
    AVAN_FOTOV: { filas: [["No.", "Proyecto", "TIPO DE AVANCE", "GENERAL"], [1, "PFV Uno", "Real", "mucho"]] },
  };
  const { errors } = leerAnteproyectos(libro(hojas), XLSX);
  assert.ok(errors.some((e) => /no se reconoce la tecnología "Geotérmico"/.test(e)));
  assert.ok(errors.some((e) => /"mucho" no es un porcentaje/.test(e)));
  assert.ok(errors.some((e) => /"PFV Uno" se repite/.test(e)));
});

test("AVAN con varias tablas: cada proyecto usa los encabezados (ponderados y notas) de su tabla", () => {
  const T = "Proyecto de Acumulación de Energía por Bombeo";
  const hojas = {
    PRES: { filas: [["No.", "Proyecto", "Tecnología"], [3, "PAEB Uno", T], [4, "PAEB Dos", T]] },
    FICHA_PAEB: { filas: [["No.", "Proyecto", "Potencia [MW]"], [3, "PAEB Uno", "240"], [4, "PAEB Dos", "197"]] },
    AVAN_PAEB: {
      filas: [
        ["No.", "Proyecto", "TIPO DE AVANCE", "GENERAL", "1. Certidumbre", "1.1 Agua", "NOTA (1.1)"],
        [3, "PAEB Uno", "Real", "42%", "50%", "50%", "Ver con CONAGUA"],
        ["", "", "Programado", "61%", "60%", "75%"],
        [],
        ["No.", "Proyecto", "TIPO DE AVANCE", "GENERAL", "1 Planteamiento", "1.1 Agua", "1.2 Topografía", "2. Análisis", "NOTA TOTAL"],
        [4, "PAEB Dos", "Real", "48%", "66%", "100%", "100%", "30%", "Nota de Dos"],
        ["", "", "Programado", "48%", "75%", "100%", "100%", "22%"],
      ],
      merges: ["A2:A3", "B2:B3", "A6:A7", "B6:B7"],
    },
  };
  const { errors, proyectos } = leerAnteproyectos(libro(hojas), XLSX);
  assert.deepEqual(errors, []);
  const [uno, dos] = proyectos;
  assert.equal(uno.tipo, "PAEB");
  assert.deepEqual(uno.avance.grupos.map((g) => g.titulo), ["Certidumbre"]);
  assert.equal(uno.avance.grupos[0].items[0].nota, "Ver con CONAGUA");
  assert.equal(uno.avance.general.real, 42);
  assert.deepEqual(dos.avance.grupos.map((g) => g.titulo), ["Planteamiento", "Análisis"]);
  assert.deepEqual(dos.avance.grupos[0].items.map((x) => x.clave), ["1.1", "1.2"]);
  assert.equal(dos.avance.general.nota, "Nota de Dos");
  assert.equal(dos.avance.grupos[1].prog, 22);
});

test("AVAN: un número repetido (1.10 que Excel cambió a 1.1) es error", () => {
  const hojas = {
    PRES: { filas: [["No.", "Proyecto", "Tecnología"], [1, "PFV Uno", "Fotovoltaico"]] },
    AVAN_FOTOV: {
      filas: [
        ["No.", "Proyecto", "TIPO DE AVANCE", "GENERAL", "1. A", "1.1 Agua", "1.9 Social", "1.1 Arqueológico"],
        [1, "PFV Uno", "Real", 0.1, 0.1, 0.1, 0.1, 0.1],
      ],
    },
  };
  const { errors } = leerAnteproyectos(libro(hojas), XLSX);
  assert.ok(errors.some((e) => /AVAN_FOTOV", fila 1: el número 1\.1 se repite \(columnas F y H\).*'1\.10/.test(e)), errors.join("\n"));
});
