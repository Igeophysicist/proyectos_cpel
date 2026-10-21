/**
 * hitos.js
 * Lee el Excel de hitos de pago de Cartera CPEL
 * (cartera-cpel/data/HITOS_CARTERA_CPEL.xlsx) y lo convierte en los datos
 * que muestra la página (cartera-cpel/data/hitos.json). Lo usa
 * scripts/build-data.js; las funciones son puras (reciben el libro ya
 * abierto con SheetJS) y se prueban en tests/hitos.test.js.
 *
 * CÓMO SE LEE EL EXCEL
 *   - Una hoja por proyecto (o varias, si el proyecto tiene varios
 *     contratos: CHICOASEN_II_1, CHICOASEN_II_2). El nombre de la hoja
 *     se compara con los proyectos de Cartera: "AMATA" -> "PEH AMATA",
 *     "STA_MARIA" -> "PEH SANTA MARÍA", "PPSIII" -> "CFV PUERTO PEÑASCO
 *     SECUENCIA III"; un número suelto al final (_1, _9) se ignora.
 *   - En cada hoja, cada tabla empieza en la fila cuyo primer encabezado
 *     dice "No. Hito…". Si la fila de arriba dice "… Contrato …", es el
 *     nombre del contrato (una hoja puede tener varios, como Picachos).
 *   - Las columnas se reconocen por su encabezado, en cualquier orden:
 *     descripción, valor sobre el precio (%), fecha programada (o del
 *     evento crítico), fecha de solicitud de pago, fecha de pago,
 *     estatus y, si está, tipo de evento.
 *   - Los MONTOS no se publican: el sitio es público. Si el Excel trae
 *     columnas de montos o importes, se avisa para quitarlas del archivo.
 *
 * Errores (no se publica nada): hoja que no corresponde a un proyecto,
 * tabla sin columna de estatus o de fecha programada, fecha ilegible.
 * Avisos: hito sin estatus, estatus desconocido, % de un contrato que no
 * suma 100, columnas de montos.
 */
const { normalizeText, parseNumber, parseDate, slugify } = require("../assets/js/shared/text-utils.js");

// Estatus del Excel -> clave que usa la página (ver cartera-cpel/assets/js/hitos.js).
const ESTATUS = [
  [/^PAGADO PARCIAL/, "parcial"],
  [/^PAGADO/, "pagado"],
  [/TRANSITO|TRAMITE/, "transito"],
  [/INCONCLUSO/, "inconcluso"],
  [/^PENDIENTE/, "pendiente"],
];

// Abreviaturas en nombres de hoja.
const ALIAS_HOJA = [
  [/^PPS\s*/, "PUERTO PENASCO SECUENCIA "],
  [/\bSTA\b/, "SANTA"],
];

const MESES = {
  ENE: 1, JAN: 1, FEB: 2, MAR: 3, ABR: 4, APR: 4, MAY: 5, JUN: 6, JUL: 7,
  AGO: 8, AUG: 8, SEP: 9, SET: 9, OCT: 10, NOV: 11, DIC: 12, DEC: 12,
};

const vacio = (v) => v === null || v === undefined || String(v).trim() === "";
const iso = (y, m, d) => `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;

/**
 * Celda de fecha -> "AAAA-MM-DD", "" si está vacía, null si no se entiende.
 * Acepta fechas de Excel (número con formato de fecha) y texto como
 * "01-dic-2023", "1-Sep-26", "20/05/2026" o "31 de diciembre de 2028".
 */
function fechaCelda(cell, XLSX) {
  if (!cell || vacio(cell.v)) return "";
  if (cell.t === "n") {
    const d = XLSX.SSF.parse_date_code(cell.v);
    return d && d.y > 1900 ? iso(d.y, d.m, d.d) : null;
  }
  const s = String(cell.v).trim();
  const m = /^(\d{1,2})[-\s/]([A-Za-zÁÉÍÓÚáéíóú]{3,})\.?[-\s/](\d{2}|\d{4})$/.exec(s);
  if (m) {
    const mes = MESES[normalizeText(m[2]).slice(0, 3)];
    const anio = m[3].length === 2 ? 2000 + Number(m[3]) : Number(m[3]);
    const dia = Number(m[1]);
    if (mes && dia >= 1 && dia <= 31) return iso(anio, mes, dia);
    return null;
  }
  const d = parseDate(s);
  return d ? iso(d.getFullYear(), d.getMonth() + 1, d.getDate()) : null;
}

/** Celda de porcentaje -> número en % (0.05 o "5%" -> 5); null si vacía. */
function pctCelda(cell) {
  if (!cell || vacio(cell.v)) return null;
  if (cell.t === "n") return Math.round(cell.v * 100 * 1000) / 1000;
  return parseNumber(cell.v);
}

const textoCelda = (cell) => (cell && !vacio(cell.w ?? cell.v) ? String(cell.w ?? cell.v).replace(/\s+/g, " ").trim() : "");

/** Proyecto de Cartera que corresponde a una hoja, o null. */
function proyectoDeHoja(hoja, nombres) {
  let clave = normalizeText(String(hoja).replace(/_/g, " "));
  ALIAS_HOJA.forEach(([re, sust]) => (clave = clave.replace(re, sust)));
  const palabras = clave.split(" ").filter(Boolean);
  if (palabras.length > 1 && /^\d+$/.test(palabras[palabras.length - 1])) palabras.pop();
  const candidatos = nombres.filter((n) => {
    const del = new Set(normalizeText(n).split(" "));
    return palabras.every((p) => del.has(p));
  });
  return candidatos.length === 1 ? candidatos[0] : null;
}

/** Qué columna es cada dato, a partir de la fila de encabezados. */
function columnas(encabezados) {
  const col = {};
  const montos = [];
  encabezados.forEach((h, c) => {
    const t = normalizeText(h);
    if (!t) return;
    if (/^NO HITO/.test(t)) col.num ??= c;
    else if (/DESCRIPCION/.test(t)) col.desc ??= c;
    else if (/VALOR SOBRE EL PRECIO|PORCENTAJE TOTAL/.test(t)) col.pct ??= c;
    else if (/FECHA PROGRAMADA|FECHA (DEL )?EVENTO CRITICO/.test(t)) col.programada ??= c;
    else if (/FECHA DE SOLICITUD/.test(t)) col.solicitud ??= c;
    else if (/^FECHA DE PAGO$/.test(t)) col.pago ??= c;
    else if (/^ESTATUS|^STATUS/.test(t)) col.estatus ??= c;
    else if (/TIPO DE EVENTO/.test(t)) col.tipo ??= c;
    else if (/MONTO|IMPORTE/.test(t)) montos.push(String(h).trim());
  });
  return { col, montos };
}

/** Nombre corto del contrato para las pestañas: "AHYG" o "F/1320-004-2022". */
function nombreCorto(titulo) {
  if (!titulo) return "";
  const antes = /^(.*?)\s+Contrato\b/i.exec(titulo);
  if (antes && antes[1].trim()) return antes[1].trim();
  const num = /Contrato\s+([^,(]+)/i.exec(titulo);
  return num ? num[1].trim() : titulo.split(",")[0].trim();
}

function estatusDe(texto) {
  const t = normalizeText(texto);
  if (!t) return "sin";
  const e = ESTATUS.find(([re]) => re.test(t));
  return e ? e[1] : "otro";
}

/**
 * Lee el libro de hitos. nombres = proyectos de Cartera (columna nombre).
 * Devuelve { errors, warnings, proyectos: { slug: { nombre, contratos } } }.
 */
function leerHitos(wb, XLSX, nombres) {
  const errors = [];
  const warnings = [];
  const proyectos = {};

  wb.SheetNames.forEach((hoja) => {
    const ws = wb.Sheets[hoja];
    if (!ws["!ref"]) return;
    const proyecto = proyectoDeHoja(hoja, nombres);
    if (!proyecto) {
      errors.push(
        `Hoja "${hoja}": no corresponde a ningún proyecto de Cartera CPEL. ` +
          `Ponle un nombre que lo identifique (p. ej. "AMATA", "STA_MARIA" o "CHICOASEN_II_2").`
      );
      return;
    }
    const rango = XLSX.utils.decode_range(ws["!ref"]);
    const celda = (r, c) => ws[XLSX.utils.encode_cell({ r, c })];
    const filaTexto = (r) => {
      const out = [];
      for (let c = rango.s.c; c <= rango.e.c; c++) out[c] = textoCelda(celda(r, c));
      return out;
    };

    let tabla = null;
    const tablas = [];
    const montosHoja = new Set();
    for (let r = rango.s.r; r <= rango.e.r; r++) {
      const fila = filaTexto(r);
      const primera = fila.find((v) => v) || "";
      if (/^NO HITO/.test(normalizeText(primera))) {
        // Nueva tabla: el título es la fila anterior si dice "Contrato".
        const previa = r > rango.s.r ? filaTexto(r - 1).filter(Boolean) : [];
        const titulo = previa.length === 1 && /contrato/i.test(previa[0]) ? previa[0] : "";
        const { col, montos } = columnas(fila);
        const donde = `Hoja "${hoja}", fila ${r + 1}`;
        if (col.estatus === undefined) errors.push(`${donde}: la tabla no tiene columna "Estatus".`);
        if (col.programada === undefined) errors.push(`${donde}: la tabla no tiene columna de fecha programada.`);
        montos.forEach((m) => montosHoja.add(m));
        tabla = { titulo, col, hitos: [], fila: r + 1 };
        tablas.push(tabla);
        continue;
      }
      if (!tabla || tabla.col.desc === undefined) continue;
      const desc = fila[tabla.col.desc];
      const num = fila[tabla.col.num] || "";
      if (!desc || /^TOTAL/.test(normalizeText(num))) continue; // títulos, totales, notas
      const donde = `Hoja "${hoja}", fila ${r + 1} (hito ${num || "sin número"})`;
      const fecha = (k) => {
        if (tabla.col[k] === undefined) return "";
        const v = fechaCelda(celda(r, tabla.col[k]), XLSX);
        if (v === null) errors.push(`${donde}: "${fila[tabla.col[k]]}" no es una fecha válida.`);
        return v || "";
      };
      const estatusTexto = tabla.col.estatus === undefined ? "" : fila[tabla.col.estatus];
      const estatus = estatusDe(estatusTexto);
      if (estatus === "sin") warnings.push(`${donde}: no tiene estatus.`);
      if (estatus === "otro") warnings.push(`${donde}: estatus "${estatusTexto}" desconocido (se muestra tal cual).`);
      tabla.hitos.push({
        num,
        desc,
        pct: tabla.col.pct === undefined ? null : pctCelda(celda(r, tabla.col.pct)),
        programada: fecha("programada"),
        solicitud: fecha("solicitud"),
        pago: fecha("pago"),
        estatus,
        ...(estatus === "otro" ? { estatusTexto } : {}),
        ...(tabla.col.tipo !== undefined && fila[tabla.col.tipo] ? { tipo: fila[tabla.col.tipo] } : {}),
      });
    }

    if (montosHoja.size) {
      warnings.push(
        `Hoja "${hoja}": tiene columnas de montos (${[...montosHoja].join(", ")}). El sitio no las muestra, ` +
          "pero el Excel del repositorio es público: bórralas del archivo."
      );
    }

    const slug = slugify(proyecto);
    proyectos[slug] ??= { nombre: proyecto, contratos: [] };
    tablas
      .filter((t) => t.hitos.length)
      .forEach((t) => {
        const suma = t.hitos.reduce((s, h) => s + (h.pct || 0), 0);
        if (t.col.pct !== undefined && Math.abs(suma - 100) > 0.5) {
          warnings.push(`Hoja "${hoja}", tabla de la fila ${t.fila}: los porcentajes suman ${Math.round(suma * 100) / 100} %, no 100 %.`);
        }
        proyectos[slug].contratos.push({ nombre: nombreCorto(t.titulo), titulo: t.titulo, hitos: t.hitos });
      });
  });

  return { errors, warnings, proyectos };
}

module.exports = { leerHitos, proyectoDeHoja, fechaCelda, nombreCorto, estatusDe };
