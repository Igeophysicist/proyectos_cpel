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
 * Además registra el CORTE SEMANAL en data/historial.json de cada tablero
 * (curva de avance; ver scripts/historial.js): las subidas de la misma
 * semana reemplazan su punto.
 */
const fs = require("fs");
const path = require("path");
const XLSX = require("xlsx");
const { validateCartera, validateMixtos, MIXTOS_SHEET } = require("./data-rules.js");
const { localDate, snapshotCartera, snapshotMixtos, upsertCorte } = require("./historial.js");

const ROOT = path.resolve(__dirname, "..");

const DATASETS = [
  {
    label: "Cartera CPEL",
    dir: "cartera-cpel",
    excel: "data/datos_proyectos.xlsx",
    json: "data/datos_proyectos.json",
    historial: "data/historial.json",
    snapshot: snapshotCartera,
    kml: ["data/CARTERA-CPEL.kml"],
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
    snapshot: snapshotMixtos,
    kml: ["data/ENTRADA_PROYECTOS.kml", "data/AREAS_REFERENCIA.kml"],
    // Igual que data.js antes: hoja "Proyectos", texto tal como se ve en Excel.
    read: (wb) => ({ sheetName: wb.SheetNames.includes(MIXTOS_SHEET) ? MIXTOS_SHEET : null, options: { raw: false, defval: "" } }),
    validate: validateMixtos,
  },
];

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

/**
 * Lee y valida un Excel. "buffer" permite procesar versiones anteriores
 * del archivo (scripts/backfill-historial.js); por omisión se lee el actual.
 */
function buildDataset(ds, buffer) {
  const dir = path.join(ROOT, ds.dir);
  const excelPath = path.join(dir, ds.excel);
  const wb = XLSX.read(buffer || fs.readFileSync(excelPath), { type: "buffer" });
  const { sheetName, options } = ds.read(wb);
  if (!sheetName) {
    return { errors: [`No existe la hoja "${MIXTOS_SHEET}" en ${ds.excel}.`], warnings: [] };
  }
  const sheet = wb.Sheets[sheetName];
  const headers = (XLSX.utils.sheet_to_json(sheet, { header: 1, defval: "" })[0] || []).map(String);
  const rows = XLSX.utils.sheet_to_json(sheet, options);

  const { errors, warnings } = ds.validate({
    headers,
    rows,
    placemarkNames: ds.kml.flatMap((k) => placemarkNames(path.join(dir, k))),
    fileExists: (rel) => fs.existsSync(path.join(dir, rel)),
  });

  const modified = wb.Props && wb.Props.ModifiedDate ? new Date(wb.Props.ModifiedDate) : null;
  const data = {
    fuente: path.basename(ds.excel),
    excelModificado: modified && !Number.isNaN(modified.getTime()) ? modified.toISOString() : null,
    proyectos: rows,
  };
  // Corte semanal para la curva de avance (solo si el Excel trae su fecha de guardado).
  const fecha = data.excelModificado ? localDate(data.excelModificado) : null;
  if (!fecha) warnings.push("El Excel no tiene fecha de guardado: no se registró el corte en la curva de avance.");
  return {
    errors,
    warnings,
    json: toJson(data),
    jsonPath: path.join(dir, ds.json),
    corte: fecha ? { fecha, proyectos: ds.snapshot(rows) } : null,
    historialPath: path.join(dir, ds.historial),
  };
}

const readJson = (file) => (fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, "utf8")) : null);

/** Historial con el corte de este Excel agregado (o reemplazado en su semana). */
function historialWithCorte(result) {
  const current = readJson(result.historialPath);
  return result.corte ? upsertCorte(current, result.corte) : current || { cortes: [] };
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

function main() {
  const check = process.argv.includes("--check");
  const summary = ["## Validación de datos", ""];
  const results = DATASETS.map((ds) => ({ ds, ...buildDataset(ds) }));
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
      [r.historialPath, toJson(historialWithCorte(r))],
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

if (require.main === module) main();

module.exports = { DATASETS, buildDataset, toJson, ROOT };
