#!/usr/bin/env node
/**
 * backfill-historial.js — reconstruye data/historial.json de cada tablero
 * a partir de las versiones anteriores de los Excel guardadas en git.
 *
 *   node scripts/backfill-historial.js
 *
 * Recorre los commits que cambiaron cada Excel (del más antiguo al más
 * reciente, incluyendo rutas anteriores del archivo) y registra un corte
 * por versión con las mismas reglas que el flujo normal: fecha de guardado
 * del Excel en hora de México y una versión por semana (la última manda).
 * Las versiones sin las columnas de avance o sin fecha de guardado se
 * omiten. Requiere el historial completo de git (no un clon superficial).
 * Normalmente se ejecuta una sola vez; después el historial crece solo
 * con la Action "Datos".
 */
const { execFileSync } = require("child_process");
const fs = require("fs");
const path = require("path");
const XLSX = require("xlsx");
const { DATASETS, toJson, ROOT } = require("./build-data.js");
const { localDate, upsertCorte } = require("./historial.js");

// Rutas que tuvo cada Excel a lo largo del tiempo (la actual al final).
const PATHS = {
  "Cartera CPEL": ["data/datos_proyectos.xlsx", "cartera-cpel/data/datos_proyectos.xlsx"],
  Mixtos: ["panel-proyectos/data/DATOS_MIXTOS.xlsx", "cartera-mixtos/data/DATOS_MIXTOS.xlsx"],
};
// Columnas mínimas para tomar el avance de una versión antigua.
const REQUIRED = { "Cartera CPEL": ["nombre", "avanceProg", "avanceReal"], Mixtos: ["Parque", "LT", "Global"] };

const git = (...args) =>
  execFileSync("git", args, { cwd: ROOT, maxBuffer: 64 * 1024 * 1024, stdio: ["ignore", "pipe", "ignore"] });

function versions(paths, ref) {
  const out = [];
  paths.forEach((p) => {
    git("log", "--reverse", "--format=%H %cI", ref, "--", p)
      .toString()
      .trim()
      .split("\n")
      .filter(Boolean)
      .forEach((line) => {
        const [sha, date] = line.split(" ");
        let buffer;
        try {
          buffer = git("show", `${sha}:${p}`);
        } catch {
          return; // el commit borró el archivo
        }
        out.push({ sha, date, path: p, buffer });
      });
  });
  return out.sort((a, b) => (a.date < b.date ? -1 : 1));
}

function main() {
  const ref = process.argv[2] || "HEAD";
  DATASETS.forEach((ds) => {
    let historial = { cortes: [] };
    console.log(`\n${ds.label}`);
    versions(PATHS[ds.label], ref).forEach((v) => {
      const wb = XLSX.read(v.buffer, { type: "buffer" });
      const { sheetName, options } = ds.read(wb);
      const rows = sheetName ? XLSX.utils.sheet_to_json(wb.Sheets[sheetName], options) : [];
      const headers = Object.keys(rows[0] || {});
      const modified = wb.Props && wb.Props.ModifiedDate;
      const fecha = modified ? localDate(new Date(modified).toISOString()) : null;
      const missing = REQUIRED[ds.label].filter((c) => !headers.includes(c));
      if (missing.length || !fecha) {
        console.log(`  omitido ${v.sha.slice(0, 7)} ${v.path}: ${missing.length ? "faltan " + missing.join(", ") : "sin fecha de guardado"}`);
        return;
      }
      historial = upsertCorte(historial, { fecha, proyectos: ds.snapshot(rows) });
      console.log(`  ${v.sha.slice(0, 7)} ${v.path}: corte ${fecha}`);
    });
    const file = path.join(ROOT, ds.dir, ds.historial);
    fs.writeFileSync(file, toJson(historial));
    console.log(`  => ${historial.cortes.length} corte(s): ${historial.cortes.map((c) => `${c.semana} (${c.fecha})`).join(", ")}`);
  });
}

main();
