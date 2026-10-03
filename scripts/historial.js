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
 *  - "domingo" (Mixtos, se actualiza lunes, miércoles y viernes): semana
 *    de domingo a sábado ("semana" = su domingo); se grafica en el día de
 *    la última actualización. Las semanas sin actualizaciones no tienen
 *    punto.
 *      { "semana": "2026-09-27", "fecha": "2026-10-01", "excel": "<ISO>", "proyectos": {...} }
 *
 * Archivo: data/historial.json de cada tablero ({ "cortes": [...] }).
 *
 * REGISTRO DE ACTUALIZACIONES (Mixtos, sección "Esta semana" del portal):
 * además del punto semanal, cada Excel que cambia el avance de Parque o
 * el grupo de atención de algún proyecto queda registrado con esos
 * cambios, comparados con el dato ANTERIOR (no con la semana anterior).
 * Las subidas del MISMO DÍA se juntan en una sola entrada: cada proyecto
 * se compara con cómo estaba antes de la primera subida de ese día (así
 * una corrección minutos después no aparece como otra actualización).
 * Archivo data/actualizaciones.json:
 *   { "registros": [ { "excel": "<ISO>", "fecha": "2026-10-01",
 *       "cambios": [ { "slug", "nombre", "antes": { parque, grupo },
 *                      "ahora": { parque, grupo } } ] } ] }
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

/** Domingo ("AAAA-MM-DD") de la semana (domingo a sábado) de una fecha "AAAA-MM-DD". */
function domingoDe(dateStr) {
  const [y, m, d] = dateStr.split("-").map(Number);
  const date = new Date(Date.UTC(y, m - 1, d));
  date.setUTCDate(date.getUTCDate() - date.getUTCDay());
  return ymd(date);
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
  domingo: (excel) => {
    const fecha = localDate(excel);
    return fecha && { clave: { semana: domingoDe(fecha) }, fecha };
  },
};

const mismaClave = (c, clave) => Object.keys(clave).every((k) => c[k] === clave[k]);

/**
 * Registra el corte del Excel guardado en "excel" (ISO) según la regla
 * ("jueves" o "domingo"): agrega el punto de su semana o reemplaza el que
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

// ------------------------------------------------ registro (Mixtos)
const UMBRAL = 0.005; // diferencias menores son redondeo, no cambio

const parqueCambio = (a, b) =>
  Number.isFinite(a.parque) && Number.isFinite(b.parque) && Math.abs(b.parque - a.parque) > UMBRAL;
const grupoCambio = (a, b) => !!a.grupo && !!b.grupo && a.grupo !== b.grupo;
const hayCambio = (a, b) => parqueCambio(a, b) || grupoCambio(a, b);

/**
 * Proyectos cuyo avance de Parque o grupo de atención cambió entre dos
 * fotos de Mixtos ({ slug: { parque, grupo, ... } }). "nombres":
 * { slug: nombre visible }. Los proyectos nuevos no cuentan.
 */
function cambiosMixtos(antes, ahora, nombres = {}) {
  if (!antes || !ahora) return [];
  return Object.keys(ahora)
    .filter((slug) => antes[slug] && hayCambio(antes[slug], ahora[slug]))
    .map((slug) => ({
      slug,
      nombre: nombres[slug] || slug,
      antes: { parque: antes[slug].parque ?? null, grupo: antes[slug].grupo ?? null },
      ahora: { parque: ahora[slug].parque ?? null, grupo: ahora[slug].grupo ?? null },
    }));
}

/**
 * Agrega la actualización del Excel guardado en "excel" al registro, en
 * orden cronológico. Si ya hay una entrada del mismo día, la combina con
 * ella: cada proyecto conserva su dato de antes de ese día y toma el
 * último; los que regresaron a como estaban se quitan. No registra
 * subidas sin cambios ni repite un Excel ya registrado. No modifica el
 * registro recibido.
 */
function registrarActualizacion(registro, { excel, cambios }) {
  const registros = registro && registro.registros ? registro.registros.slice() : [];
  if (registros.some((r) => r.excel === excel)) return { registros };
  const fecha = localDate(excel);
  const ultimo = registros[registros.length - 1];
  if (ultimo && ultimo.fecha === fecha && ultimo.excel < excel) {
    const porSlug = new Map(ultimo.cambios.map((c) => [c.slug, { ...c }]));
    cambios.forEach((c) => {
      const previo = porSlug.get(c.slug);
      porSlug.set(c.slug, previo ? { ...previo, nombre: c.nombre, ahora: c.ahora } : c);
    });
    const combinados = [...porSlug.values()].filter((c) => hayCambio(c.antes, c.ahora));
    registros.pop();
    if (combinados.length) registros.push({ excel, fecha, cambios: combinados });
    return { registros };
  }
  if (!cambios.length) return { registros };
  registros.push({ excel, fecha, cambios });
  registros.sort((a, b) => (a.excel < b.excel ? -1 : a.excel > b.excel ? 1 : 0));
  return { registros };
}

module.exports = {
  localDate,
  domingoDe,
  corteDe,
  snapshotCartera,
  snapshotMixtos,
  upsertCorte,
  cambiosMixtos,
  registrarActualizacion,
  TIME_ZONE,
};
