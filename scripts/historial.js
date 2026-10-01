/**
 * historial.js
 * Historial de cortes semanales para la curva de avance. Funciones puras
 * (se prueban en tests/historial.test.js).
 *
 * Cada vez que se genera el JSON de un tablero con un Excel NUEVO se
 * registra un CORTE con el avance de cada proyecto. El corte semanal es
 * cada JUEVES a las 8:00 (hora de México): un Excel guardado desde el
 * jueves 8:00 hasta el jueves siguiente a las 7:59 pertenece al corte de
 * ese primer jueves. Las correcciones guardadas en ese lapso REEMPLAZAN
 * el punto; el siguiente punto aparece con el corte del jueves siguiente.
 * Volver a generar con el mismo Excel (p. ej. al subir solo un KML) no
 * agrega puntos.
 *
 * Archivo: data/historial.json de cada tablero
 *   { "cortes": [ { "corte": "2026-10-01", "fecha": "2026-10-01",
 *                   "excel": "<fecha de guardado ISO>",
 *                   "proyectos": { "<slug del nombre>": { ...valores } } } ] }
 * "fecha" es el día que se grafica. Los cortes anteriores a esta regla
 * (con "semana" en lugar de "corte") se conservan tal cual, con la fecha
 * de guardado de su Excel.
 * Los proyectos se identifican por el nombre (TextUtils.slugify); si un
 * proyecto se renombra en el Excel, su historial empieza de nuevo.
 */
const { parseNumber, slugify } = require("../assets/js/shared/text-utils.js");

const TIME_ZONE = "America/Mexico_City";
const DIA_CORTE = 4; // jueves (0 = domingo)
const HORA_CORTE = 8; // 8:00

function localParts(iso, timeZone) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    hourCycle: "h23",
  }).formatToParts(d);
  const get = (t) => parts.find((p) => p.type === t).value;
  return { y: +get("year"), m: +get("month"), d: +get("day"), hour: +get("hour") };
}

const ymd = (date) => date.toISOString().slice(0, 10);

/** Fecha local (México) "AAAA-MM-DD" de un instante ISO. */
function localDate(iso, timeZone = TIME_ZONE) {
  const p = localParts(iso, timeZone);
  return p ? ymd(new Date(Date.UTC(p.y, p.m - 1, p.d))) : null;
}

/** Jueves ("AAAA-MM-DD") del corte al que pertenece un Excel guardado en "iso". */
function corteDe(iso, timeZone = TIME_ZONE) {
  const p = localParts(iso, timeZone);
  if (!p) return null;
  const date = new Date(Date.UTC(p.y, p.m - 1, p.d));
  let atras = (date.getUTCDay() - DIA_CORTE + 7) % 7;
  if (atras === 0 && p.hour < HORA_CORTE) atras = 7; // jueves antes de las 8:00: corte anterior
  date.setUTCDate(date.getUTCDate() - atras);
  return ymd(date);
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
 * Registra el corte del Excel guardado en "excel" (ISO): agrega el punto de
 * su jueves o reemplaza el que ya había ese mismo corte. Si ese Excel ya
 * está registrado, no cambia nada. No modifica el historial recibido.
 */
function upsertCorte(historial, { excel, proyectos }) {
  const cortes = historial && historial.cortes ? historial.cortes.slice() : [];
  const guardado = localDate(excel);
  const corte = corteDe(excel);
  if (!corte || cortes.some((c) => c.excel === excel || (!c.corte && c.fecha === guardado))) return { cortes };
  const out = cortes.filter((c) => c.corte !== corte);
  out.push({ corte, fecha: corte, excel, proyectos });
  out.sort((a, b) => (a.fecha < b.fecha ? -1 : a.fecha > b.fecha ? 1 : 0));
  return { cortes: out };
}

module.exports = { localDate, corteDe, snapshotCartera, snapshotMixtos, upsertCorte, TIME_ZONE };
