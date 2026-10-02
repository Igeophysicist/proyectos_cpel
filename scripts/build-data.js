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
 */
const fs = require("fs");
const path = require("path");
const XLSX = require("xlsx");
const { validateCartera, validateMixtos, MIXTOS_SHEET } = require("./data-rules.js");
const { optimizarCarpeta } = require("./imagenes.js");
const { snapshotCartera, snapshotMixtos, upsertCorte, cambiosMixtos, registrarActualizacion } = require("./historial.js");
const { slugify } = require("../assets/js/shared/text-utils.js");

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

const readJson = (file) => (fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, "utf8")) : null);

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
  for (const ds of DATASETS.filter((d) => d.imagenes)) {
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

if (require.main === module) {
  main().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}

module.exports = { DATASETS, buildDataset, toJson, ROOT };
