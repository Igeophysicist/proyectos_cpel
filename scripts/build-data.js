#!/usr/bin/env node
/**
 * build-data.js — Excel -> JSON con validación.
 *
 *   npm run data          valida y, si no hay errores, escribe los JSON
 *   npm run data:check    valida y comprueba que los JSON estén al día
 *                         (no escribe nada; falla si hay que regenerarlos)
 *
 * Los Excel siguen siendo la fuente de verdad (se editan igual que
 * siempre). Las páginas leen los JSON generados aquí, así que ya no
 * descargan la librería SheetJS (~900 KB) en cada visita.
 *
 * Si hay ERRORES no se escribe ningún JSON: el sitio sigue mostrando los
 * datos anteriores y el comando termina con código 1 (en GitHub Actions
 * el commit queda en rojo y se lista cada error). Los AVISOS no bloquean.
 *
 * Cada JSON es: { fuente, excelModificado, proyectos: [filas] }, donde
 * las filas son exactamente las que antes leía la página desde el Excel
 * (mismas opciones de SheetJS), para no cambiar nada de su lógica.
 *
 * También optimiza las imágenes de encabezado de Cartera CPEL
 * (scripts/imagenes.js): las reduce a 1200 px, les quita los metadatos
 * (ubicación GPS) y las guarda con el mismo nombre. Con --check solo
 * avisa cuáles faltan por optimizar.
 *
 * Además registra el CORTE SEMANAL en data/historial.json de cada tablero
 * (curva de avance; ver scripts/historial.js): un punto por semana
 * (Cartera: jueves 8:00 a jueves 8:00; Mixtos: lunes a domingo).
 *
 * HITOS DE PAGO de Cartera CPEL: cartera-cpel/data/HITOS_CARTERA_CPEL.xlsx
 * -> data/hitos.json (ver scripts/hitos.js).
 *
 * CARTERA ANTEPROYECTOS: cartera-anteproyectos/data/datos_anteproyectos.xlsx
 * (varias hojas, ver scripts/anteproyectos.js) -> data/anteproyectos.json,
 * con su corte semanal (jueves, como Cartera CPEL) para la curva de avance.
 *
 * MIXTOS 2DA RONDA: cartera-mixtos-2/data/DATOS_MIXTOS_2.xlsx (hoja
 * BASE_DE_DATOS, ver scripts/mixtos2.js) -> data/DATOS_MIXTOS_2.json, con
 * su corte semanal (domingo, como Mixtos) para la evolución.
 */
const fs = require("fs");
const path = require("path");
const XLSX = require("xlsx");
const { validateCartera, validateMixtos, checkExcelAnterior, MIXTOS_SHEET, MIXTOS_COLUMNAS, MIXTOS_DATES } = require("./data-rules.js");
const { optimizarCarpeta } = require("./imagenes.js");
const { snapshotCartera, snapshotMixtos, upsertCorte, cambiosMixtos, registrarActualizacion } = require("./historial.js");
const { slugify } = require("../assets/js/shared/text-utils.js");
const { leerHitos } = require("./hitos.js");
const { leerAnteproyectos, snapshotAnteproyectos } = require("./anteproyectos.js");
const { leerMixtos2 } = require("./mixtos2.js");

const ROOT = path.resolve(__dirname, "..");

const DATASETS = [
  {
    label: "Cartera CPEL",
    dir: "cartera-cpel",
    excel: "data/datos_proyectos.xlsx",
    json: "data/datos_proyectos.json",
    historial: "data/historial.json",
    regla: "jueves", // corte cada jueves 8:00
    snapshot: snapshotCartera,
    kml: ["data/CARTERA-CPEL.kml"],
    imagenes: "data/CARTERA-CPEL", // se optimizan al subirlas (scripts/imagenes.js)
    // Igual que cartera.js antes: primera hoja, valores crudos.
    read: (wb) => ({ sheetName: wb.SheetNames[0], options: { defval: "" } }),
    validate: validateCartera,
  },
  {
    label: "Mixtos",
    dir: "cartera-mixtos",
    excel: "data/DATOS_MIXTOS.xlsx",
    json: "data/DATOS_MIXTOS.json",
    historial: "data/historial.json",
    regla: "domingo", // domingo a sábado (se actualiza lunes, miércoles y viernes)
    snapshot: snapshotMixtos,
    // Cada subida con cambios de Parque, para "Esta semana" del portal.
    actualizaciones: "data/actualizaciones.json",
    nombre: (r) => String(r["TÍTULO 2"] || r["TÍTULO 1"] || "").trim(),
    kml: ["data/ENTRADA_PROYECTOS.kml", "data/AREAS_REFERENCIA.kml"],
    // Hoja "CAPEX", texto tal como se ve en Excel.
    read: (wb) => ({ sheetName: wb.SheetNames.includes(MIXTOS_SHEET) ? MIXTOS_SHEET : null, options: { raw: false, defval: "" } }),
    // Solo se publican los proyectos (no las filas de totales y promedios
    // de abajo, que no tienen TÍTULO) y las columnas que usa la página,
    // sin los espacios que agrega el formato de contabilidad (" $93.9 ").
    publicar: (r) =>
      String(r["TÍTULO 2"] || r["TÍTULO 1"] || "").trim()
        ? Object.fromEntries(
            Object.entries(r)
              .filter(([k]) => MIXTOS_COLUMNAS.includes(k))
              .map(([k, v]) => [k, typeof v === "string" ? v.trim() : v])
          )
        : null,
    // Fechas con formato de fecha de Excel: se publican como "03 de julio de
    // 2026" (como cuando se escribían a mano), no como "7/3/26", que es
    // ambiguo (¿3 de julio o 7 de marzo?).
    fechas: MIXTOS_DATES,
    validate: validateMixtos,
  },
];

const MESES = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"];

/** Número de serie de una fecha de Excel -> "03 de julio de 2026". */
function fechaLarga(serie) {
  const f = XLSX.SSF.parse_date_code(serie);
  return f && f.y ? `${String(f.d).padStart(2, "0")} de ${MESES[f.m - 1]} de ${f.y}` : null;
}

// Hitos de pago de Cartera CPEL (un Excel aparte, una hoja por proyecto).
const HITOS = {
  label: "Hitos de Cartera CPEL",
  dir: "cartera-cpel",
  excel: "data/HITOS_CARTERA_CPEL.xlsx",
  json: "data/hitos.json",
};

// Cartera Anteproyectos (un Excel con varias hojas; ver scripts/anteproyectos.js).
const ANTEPROYECTOS = {
  label: "Cartera Anteproyectos",
  dir: "cartera-anteproyectos",
  excel: "data/datos_anteproyectos.xlsx",
  json: "data/anteproyectos.json",
  historial: "data/historial.json",
  regla: "jueves",
  kml: ["data/ANTEPROYECTOS.kml"],
  imagenes: "data/IMAGENES",
};

// Mixtos 2da Ronda (misma página que Mixtos; ver scripts/mixtos2.js).
const MIXTOS2 = {
  label: "Mixtos 2da Ronda",
  dir: "cartera-mixtos-2",
  excel: "data/DATOS_MIXTOS_2.xlsx",
  json: "data/DATOS_MIXTOS_2.json",
  historial: "data/historial.json",
  regla: "domingo",
  kml: ["data/MIXTOS_2.kml"],
};

function decodeXml(s) {
  return s
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1")
    .replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&apos;/g, "'")
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)))
    .replace(/&amp;/g, "&")
    .trim();
}

/** Nombres de los Placemark de un KML (suficiente para validar; no se necesita la geometría). */
function placemarkNames(file) {
  if (!fs.existsSync(file)) return [];
  const xml = fs.readFileSync(file, "utf8");
  const names = [];
  for (const m of xml.matchAll(/<Placemark\b[^>]*>([\s\S]*?)<\/Placemark>/g)) {
    const n = /<name>([\s\S]*?)<\/name>/.exec(m[1]);
    if (n) names.push(decodeXml(n[1]));
  }
  return names;
}

const toJson = (data) => JSON.stringify(data, null, 2) + "\n";

const readJson = (file) => (fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, "utf8")) : null);

/** Lee y valida el Excel de un tablero. */
function buildDataset(ds) {
  const dir = path.join(ROOT, ds.dir);
  const excelPath = path.join(dir, ds.excel);
  const wb = XLSX.read(fs.readFileSync(excelPath), { type: "buffer" });
  const { sheetName, options } = ds.read(wb);
  if (!sheetName) {
    return { errors: [`No existe la hoja "${MIXTOS_SHEET}" en ${ds.excel}.`], warnings: [] };
  }
  const sheet = wb.Sheets[sheetName];
  const headers = (XLSX.utils.sheet_to_json(sheet, { header: 1, defval: "" })[0] || []).map(String);
  // Columnas sin encabezado (p. ej. celdas vacías con formato a la derecha
  // de la tabla) no son datos: SheetJS las nombra "__EMPTY…" y se quitan.
  // Tampoco se publican las columnas viejas de hitos de Cartera (hitoN_*:
  // traían montos); ahora los hitos salen de HITOS_CARTERA_CPEL.xlsx.
  const rows = XLSX.utils.sheet_to_json(sheet, options).map((r) =>
    Object.fromEntries(Object.entries(r).filter(([k]) => !k.startsWith("__EMPTY") && !/^hito\d+_/.test(k)))
  );
  if (ds.fechas) {
    // Celdas con fecha de Excel (número de serie): a texto largo en español.
    const crudas = XLSX.utils.sheet_to_json(sheet, { ...options, raw: true });
    rows.forEach((r, i) =>
      ds.fechas.forEach((c) => {
        const v = crudas[i] && crudas[i][c];
        if (typeof v === "number" && fechaLarga(v)) r[c] = fechaLarga(v);
      })
    );
  }

  const { errors, warnings } = ds.validate({
    headers,
    rows,
    placemarkNames: ds.kml.flatMap((k) => placemarkNames(path.join(dir, k))),
    fileExists: (rel) => fs.existsSync(path.join(dir, rel)),
    fileSize: (rel) => fs.statSync(path.join(dir, rel)).size,
    parecido: (rel) => {
      const carpeta = path.join(dir, path.dirname(rel));
      const clave = (n) => n.trim().toLowerCase();
      if (!fs.existsSync(carpeta)) return null;
      const otro = fs.readdirSync(carpeta).find((n) => clave(n) === clave(path.basename(rel)));
      return otro ? path.posix.join(path.dirname(rel), otro) : null;
    },
  });

  const modified = wb.Props && wb.Props.ModifiedDate ? new Date(wb.Props.ModifiedDate) : null;
  const data = {
    fuente: path.basename(ds.excel),
    excelModificado: modified && !Number.isNaN(modified.getTime()) ? modified.toISOString() : null,
    proyectos: ds.publicar ? rows.map(ds.publicar).filter(Boolean) : rows,
  };
  // Un Excel guardado antes que el ya publicado es casi siempre una copia
  // vieja: se bloquea para no regresar los avances (ver data-rules.js).
  const publicado = readJson(path.join(dir, ds.json));
  const anterior = checkExcelAnterior(data.excelModificado, publicado && publicado.excelModificado);
  if (anterior) errors.push(anterior);
  // Corte semanal para la curva de avance (solo si el Excel trae su fecha de guardado).
  if (!data.excelModificado) warnings.push("El Excel no tiene fecha de guardado: no se registró el corte en la curva de avance.");
  return {
    errors,
    warnings,
    json: toJson(data),
    jsonPath: path.join(dir, ds.json),
    corte: data.excelModificado ? { excel: data.excelModificado, proyectos: ds.snapshot(rows) } : null,
    regla: ds.regla,
    historialPath: path.join(dir, ds.historial),
    actualizacionesPath: ds.actualizaciones ? path.join(dir, ds.actualizaciones) : null,
    nombres: ds.nombre ? Object.fromEntries(rows.map(ds.nombre).filter(Boolean).map((n) => [slugify(n), n])) : {},
  };
}

/** Lee y valida el Excel de hitos contra los proyectos de Cartera. */
function buildHitos(nombresCartera) {
  const dir = path.join(ROOT, HITOS.dir);
  const excelPath = path.join(dir, HITOS.excel);
  if (!fs.existsSync(excelPath)) return { errors: [`No existe ${HITOS.excel}.`], warnings: [] };
  const wb = XLSX.read(fs.readFileSync(excelPath), { type: "buffer" });
  const { errors, warnings, proyectos } = leerHitos(wb, XLSX, nombresCartera);
  nombresCartera
    .filter((n) => !proyectos[slugify(n)])
    .forEach((n) => warnings.push(`"${n}" no tiene hoja de hitos; su ficha dirá que no hay hitos registrados.`));
  const modified = wb.Props && wb.Props.ModifiedDate ? new Date(wb.Props.ModifiedDate) : null;
  const excelModificado = modified && !Number.isNaN(modified.getTime()) ? modified.toISOString() : null;
  const publicado = readJson(path.join(dir, HITOS.json));
  const anterior = checkExcelAnterior(excelModificado, publicado && publicado.excelModificado);
  if (anterior) errors.push(anterior);
  return {
    errors,
    warnings,
    json: toJson({ fuente: path.basename(HITOS.excel), excelModificado, proyectos }),
    jsonPath: path.join(dir, HITOS.json),
  };
}

/** Lee y valida el Excel de Cartera Anteproyectos. */
function buildAnteproyectos() {
  const ds = ANTEPROYECTOS;
  const dir = path.join(ROOT, ds.dir);
  const excelPath = path.join(dir, ds.excel);
  if (!fs.existsSync(excelPath)) return { errors: [`No existe ${ds.excel}.`], warnings: [] };
  const wb = XLSX.read(fs.readFileSync(excelPath), { type: "buffer" });
  const { errors, warnings, proyectos } = leerAnteproyectos(wb, XLSX, {
    kml: ds.kml.flatMap((k) => placemarkNames(path.join(dir, k))),
    existe: (rel) => fs.existsSync(path.join(dir, rel)),
  });
  const modified = wb.Props && wb.Props.ModifiedDate ? new Date(wb.Props.ModifiedDate) : null;
  const excelModificado = modified && !Number.isNaN(modified.getTime()) ? modified.toISOString() : null;
  const publicado = readJson(path.join(dir, ds.json));
  const anterior = checkExcelAnterior(excelModificado, publicado && publicado.excelModificado);
  if (anterior) errors.push(anterior);
  if (!excelModificado) warnings.push("El Excel no tiene fecha de guardado: no se registró el corte en la curva de avance.");
  return {
    errors,
    warnings,
    json: toJson({ fuente: path.basename(ds.excel), excelModificado, proyectos }),
    jsonPath: path.join(dir, ds.json),
    corte: excelModificado ? { excel: excelModificado, proyectos: snapshotAnteproyectos(proyectos) } : null,
    regla: ds.regla,
    historialPath: path.join(dir, ds.historial),
  };
}

/** Lee y valida el Excel de Mixtos 2da Ronda. */
function buildMixtos2() {
  const ds = MIXTOS2;
  const dir = path.join(ROOT, ds.dir);
  const excelPath = path.join(dir, ds.excel);
  if (!fs.existsSync(excelPath)) return { errors: [`No existe ${ds.excel}.`], warnings: [] };
  const wb = XLSX.read(fs.readFileSync(excelPath), { type: "buffer" });
  const { errors, warnings, proyectos } = leerMixtos2(wb, XLSX, {
    kml: ds.kml.flatMap((k) => placemarkNames(path.join(dir, k))),
  });
  const modified = wb.Props && wb.Props.ModifiedDate ? new Date(wb.Props.ModifiedDate) : null;
  const excelModificado = modified && !Number.isNaN(modified.getTime()) ? modified.toISOString() : null;
  const publicado = readJson(path.join(dir, ds.json));
  const anterior = checkExcelAnterior(excelModificado, publicado && publicado.excelModificado);
  if (anterior) errors.push(anterior);
  if (!excelModificado) warnings.push("El Excel no tiene fecha de guardado: no se registró el corte en la evolución.");
  return {
    errors,
    warnings,
    json: toJson({ fuente: path.basename(ds.excel), excelModificado, proyectos }),
    jsonPath: path.join(dir, ds.json),
    corte: excelModificado ? { excel: excelModificado, proyectos: snapshotMixtos(proyectos) } : null,
    regla: ds.regla,
    historialPath: path.join(dir, ds.historial),
  };
}

/** Historial con el corte de este Excel agregado (o reemplazado en su semana). */
function historialWithCorte(result) {
  const current = readJson(result.historialPath);
  return result.corte ? upsertCorte(current, result.corte, result.regla) : current || { cortes: [] };
}

/**
 * Registro de actualizaciones con la de este Excel: sus cambios contra la
 * subida anterior (el último corte del historial, que siempre es la foto
 * del último Excel procesado). Si este Excel ya estaba procesado, no cambia.
 */
function actualizacionesWithExcel(result) {
  const current = readJson(result.actualizacionesPath) || { registros: [] };
  const cortes = (readJson(result.historialPath) || { cortes: [] }).cortes;
  const previo = cortes[cortes.length - 1];
  if (!result.corte || !previo || previo.excel === result.corte.excel) return current;
  const cambios = cambiosMixtos(previo.proyectos, result.corte.proyectos, result.nombres);
  return registrarActualizacion(current, { excel: result.corte.excel, cambios });
}

// ------------------------------------------------------------ reporte
const inActions = !!process.env.GITHUB_ACTIONS;
const escAnnotation = (s) => s.replace(/%/g, "%25").replace(/\r/g, "%0D").replace(/\n/g, "%0A");

function report(ds, { errors, warnings }, summary) {
  const file = `${ds.dir}/${ds.excel}`;
  console.log(`\n${ds.label} (${file}): ${errors.length} error(es), ${warnings.length} aviso(s)`);
  errors.forEach((e) => {
    console.log(`  ✖ ${e}`);
    if (inActions) console.log(`::error file=${file},title=${ds.label}::${escAnnotation(e)}`);
  });
  warnings.forEach((w) => {
    console.log(`  ⚠ ${w}`);
    if (inActions) console.log(`::warning file=${file},title=${ds.label}::${escAnnotation(w)}`);
  });
  summary.push(`### ${errors.length ? "❌" : "✅"} ${ds.label} — \`${file}\``);
  if (!errors.length && !warnings.length) summary.push("Sin errores ni avisos.");
  errors.forEach((e) => summary.push(`- ❌ ${e}`));
  warnings.forEach((w) => summary.push(`- ⚠️ ${w}`));
  summary.push("");
}

/** Optimiza (o, con --check, solo lista) las imágenes de cada tablero que las tenga. */
async function imagenes(check, summary) {
  const kb = (n) => `${Math.round(n / 1024)} KB`;
  for (const ds of [...DATASETS, ANTEPROYECTOS].filter((d) => d.imagenes)) {
    const cambios = await optimizarCarpeta(path.join(ROOT, ds.dir, ds.imagenes), { dryRun: check });
    if (cambios.length) summary.push(`### 🖼️ Imágenes — \`${ds.dir}/${ds.imagenes}\``);
    cambios.forEach((c) => {
      const rel = path.relative(ROOT, c.file);
      const texto = check
        ? `${rel}: sin optimizar (${kb(c.antes)}); se optimiza al subirla o con "npm run data".`
        : `${rel}: optimizada, ${kb(c.antes)} → ${kb(c.despues)} (${c.width} px de ancho).`;
      console.log(texto);
      summary.push(`- ${texto}`);
    });
    if (cambios.length) summary.push("");
  }
}

async function main() {
  const check = process.argv.includes("--check");
  const summary = ["## Validación de datos", ""];
  await imagenes(check, summary);
  const results = DATASETS.map((ds) => ({ ds, ...buildDataset(ds) }));
  const cartera = results.find((r) => r.ds.dir === HITOS.dir);
  const nombresCartera = cartera && cartera.json ? JSON.parse(cartera.json).proyectos.map((p) => String(p.nombre || "").trim()).filter(Boolean) : [];
  results.push({ ds: HITOS, ...buildHitos(nombresCartera) });
  results.push({ ds: ANTEPROYECTOS, ...buildAnteproyectos() });
  results.push({ ds: MIXTOS2, ...buildMixtos2() });
  results.forEach((r) => report(r.ds, r, summary));

  const failed = results.some((r) => r.errors.length);
  let exitCode = 0;
  if (failed) {
    console.log("\nHay errores: NO se actualizan los JSON (el sitio sigue con los datos anteriores).");
    summary.push("**Hay errores: no se actualizaron los datos del sitio.** Corrige el Excel y vuelve a subirlo.");
    exitCode = 1;
  } else {
    const outputs = results.flatMap((r) => [
      [r.jsonPath, r.json],
      // Antes que el historial: compara contra el último corte guardado.
      ...(r.actualizacionesPath ? [[r.actualizacionesPath, toJson(actualizacionesWithExcel(r))]] : []),
      ...(r.historialPath ? [[r.historialPath, toJson(historialWithCorte(r))]] : []),
    ]);
    outputs.forEach(([file, content]) => {
      const current = fs.existsSync(file) ? fs.readFileSync(file, "utf8") : null;
      const rel = path.relative(ROOT, file);
      if (current === content) {
        console.log(`${rel}: al día.`);
      } else if (check) {
        console.log(`${rel}: DESACTUALIZADO (ejecuta "npm run data").`);
        exitCode = 1;
      } else {
        fs.writeFileSync(file, content);
        console.log(`${rel}: actualizado.`);
      }
    });
  }
  if (inActions && process.env.GITHUB_STEP_SUMMARY) {
    fs.appendFileSync(process.env.GITHUB_STEP_SUMMARY, summary.join("\n") + "\n");
  }
  process.exit(exitCode);
}

if (require.main === module) {
  main().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}

module.exports = { DATASETS, HITOS, ANTEPROYECTOS, MIXTOS2, buildDataset, buildHitos, buildAnteproyectos, buildMixtos2, fechaLarga, toJson, ROOT };
