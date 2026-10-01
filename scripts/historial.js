/**
 * historial.js
 * Historial de cortes semanales para la curva de avance. Funciones puras
 * (se prueban en tests/historial.test.js).
 *
 * Cada vez que se genera el JSON de un tablero se registra un CORTE con el
 * avance de cada proyecto. La fecha del corte es la de último guardado del
 * Excel (la misma de "Datos al ...") en hora de México, y se agrupa por
 * SEMANA (lunes a domingo): las correcciones subidas en la misma semana
 * REEMPLAZAN el punto de esa semana; el siguiente punto aparece con el
 * siguiente corte semanal.
 *
 * Archivo: data/historial.json de cada tablero
 *   { "cortes": [ { "semana": "2026-W40", "fecha": "2026-09-29",
 *                   "proyectos": { "<slug del nombre>": { ...valores } } } ] }
 * Los proyectos se identifican por el nombre (TextUtils.slugify); si un
 * proyecto se renombra en el Excel, su historial empieza de nuevo.
 */
const { parseNumber, slugify } = require("../assets/js/shared/text-utils.js");

const TIME_ZONE = "America/Mexico_City";

/** Fecha local (México) "AAAA-MM-DD" de un instante ISO. */
function localDate(iso, timeZone = TIME_ZONE) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone, year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(d);
  const get = (t) => parts.find((p) => p.type === t).value;
  return `${get("year")}-${get("month")}-${get("day")}`;
}

/** Semana ISO-8601 ("2026-W40", semanas de lunes a domingo) de una fecha "AAAA-MM-DD". */
function isoWeek(dateStr) {
  const [y, m, d] = dateStr.split("-").map(Number);
  const date = new Date(Date.UTC(y, m - 1, d));
  const day = date.getUTCDay() || 7; // lunes = 1 ... domingo = 7
  date.setUTCDate(date.getUTCDate() + 4 - day); // jueves de esa semana
  const year = date.getUTCFullYear();
  const week = Math.ceil(((date - Date.UTC(year, 0, 1)) / 86400000 + 1) / 7);
  return `${year}-W${String(week).padStart(2, "0")}`;
}

const pct = (v) => {
  const n = parseNumber(v);
  return n === null ? null : Math.round(n * 100) / 100;
};

/** Avance de cada proyecto de Cartera CPEL: { slug: { prog, real } }. */
function snapshotCartera(rows) {
  const out = {};
  rows.forEach((r) => {
    const name = String(r.nombre || "").trim();
    if (!name) return;
    out[slugify(name)] = { prog: pct(r.avanceProg), real: pct(r.avanceReal) };
  });
  return out;
}

/** Avance de cada proyecto de Mixtos: { slug: { parque, lt, global } }. */
function snapshotMixtos(rows) {
  const out = {};
  rows.forEach((r) => {
    const name = String(r["TÍTULO 2"] || r["TÍTULO 1"] || "").trim();
    if (!name) return;
    out[slugify(name)] = { parque: pct(r.Parque), lt: pct(r.LT), global: pct(r.Global) };
  });
  return out;
}

/**
 * Agrega o reemplaza el corte de su semana y deja los cortes en orden
 * cronológico. No modifica el historial recibido.
 */
function upsertCorte(historial, { fecha, proyectos }) {
  const semana = isoWeek(fecha);
  const cortes = (historial && historial.cortes ? historial.cortes : []).filter((c) => c.semana !== semana);
  cortes.push({ semana, fecha, proyectos });
  cortes.sort((a, b) => (a.fecha < b.fecha ? -1 : a.fecha > b.fecha ? 1 : 0));
  return { cortes };
}

module.exports = { localDate, isoWeek, snapshotCartera, snapshotMixtos, upsertCorte, TIME_ZONE };
