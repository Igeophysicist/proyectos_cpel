/**
 * historial.js
 * Historial de cortes semanales para la curva de avance. Funciones puras
 * (se prueban en tests/historial.test.js).
 *
 * Cada vez que se genera el JSON de un tablero con un Excel NUEVO se
 * registra un CORTE con el avance de cada proyecto: UN PUNTO POR SEMANA.
 * La fecha de guardado del Excel (hora de México) decide la semana, y lo
 * guardado después en esa misma semana REEMPLAZA el punto (cada Excel
 * trae la hoja completa, así que el último tiene todo lo de la semana).
 * Volver a generar con el mismo Excel (p. ej. al subir solo un KML) no
 * agrega puntos. Hay dos reglas de semana (REGLAS):
 *
 *  - "jueves" (Cartera CPEL, corte cada jueves 8:00): lo guardado del
 *    jueves 8:00 al jueves siguiente 7:59 es el corte de ese primer
 *    jueves; se grafica en ese jueves.
 *      { "corte": "2026-10-01", "fecha": "2026-10-01", "excel": "<ISO>", "proyectos": {...} }
 *  - "semana" (Mixtos, se actualiza lunes, miércoles y viernes): semana
 *    de lunes a domingo; se grafica en el día de la última actualización.
 *    Las semanas sin actualizaciones no tienen punto.
 *      { "semana": "2026-W40", "fecha": "2026-10-02", "excel": "<ISO>", "proyectos": {...} }
 *
 * Archivo: data/historial.json de cada tablero ({ "cortes": [...] }).
 * Los cortes anteriores a estas reglas (sin "excel") se conservan tal
 * cual, con la fecha de guardado de su Excel.
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

/** Avance y grupo de atención de cada proyecto de Mixtos: { slug: { parque, lt, global, grupo } }. */
function snapshotMixtos(rows) {
  const out = {};
  rows.forEach((r) => {
    const name = String(r["TÍTULO 2"] || r["TÍTULO 1"] || "").trim();
    if (!name) return;
    const grupo = String(r["Grupo de atención"] || "").trim().toUpperCase() || null;
    out[slugify(name)] = { parque: pct(r.Parque), lt: pct(r.LT), global: pct(r.Global), grupo };
  });
  return out;
}

/** Cómo se agrupa cada Excel en su punto semanal (ver arriba). */
const REGLAS = {
  jueves: (excel) => {
    const corte = corteDe(excel);
    return corte && { clave: { corte }, fecha: corte };
  },
  semana: (excel) => {
    const fecha = localDate(excel);
    return fecha && { clave: { semana: isoWeek(fecha) }, fecha };
  },
};

const mismaClave = (c, clave) => Object.keys(clave).every((k) => c[k] === clave[k]);

/**
 * Registra el corte del Excel guardado en "excel" (ISO) según la regla
 * ("jueves" o "semana"): agrega el punto de su semana o reemplaza el que
 * ya había. Si ese Excel ya está registrado, no cambia nada. No modifica
 * el historial recibido.
 */
function upsertCorte(historial, { excel, proyectos }, regla = "jueves") {
  const cortes = historial && historial.cortes ? historial.cortes.slice() : [];
  const guardado = localDate(excel);
  const punto = REGLAS[regla](excel);
  if (!punto || cortes.some((c) => c.excel === excel || (!c.excel && c.fecha === guardado))) return { cortes };
  const out = cortes.filter((c) => !mismaClave(c, punto.clave));
  out.push({ ...punto.clave, fecha: punto.fecha, excel, proyectos });
  out.sort((a, b) => (a.fecha < b.fecha ? -1 : a.fecha > b.fecha ? 1 : 0));
  return { cortes: out };
}

module.exports = { localDate, isoWeek, corteDe, snapshotCartera, snapshotMixtos, upsertCorte, TIME_ZONE };
