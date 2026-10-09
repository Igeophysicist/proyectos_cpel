/**
 * regiones.js — convierte el KMZ de regiones (capa de referencia de los
 * mapas) en un GeoJSON ligero que la página carga al activar la capa.
 *
 *   npm run regiones            -> assets/capas/regiones.kmz -> assets/capas/regiones.geojson
 *   node scripts/regiones.js otro.kmz   (o un .kml)
 *
 * El KMZ original trae ~250 mil vértices con 15 decimales (unos 10 MB):
 * demasiado para un celular. Aquí cada contorno se simplifica con
 * Ramer–Douglas–Peucker (TOLERANCIA en grados, ~50 m) y las coordenadas
 * se redondean a DECIMALES (~1 m). A la escala de los mapas no se nota
 * la diferencia y el archivo baja a menos de 1 MB.
 *
 * Para actualizar la capa: reemplaza assets/capas/regiones.kmz y corre
 * "npm run regiones"; sube el .geojson que se genera.
 */
const fs = require("fs");
const path = require("path");

const TOLERANCIA = 0.0005;
const DECIMALES = 5;
const ENTRADA = path.join(__dirname, "..", "assets", "capas", "regiones.kmz");
const SALIDA = path.join(__dirname, "..", "assets", "capas", "regiones.geojson");

/** Ramer–Douglas–Peucker sobre [[x, y], ...] (sin recursión). */
function simplificar(puntos, tol) {
  if (puntos.length < 3 || tol <= 0) return puntos;
  const conservar = new Array(puntos.length).fill(false);
  conservar[0] = conservar[puntos.length - 1] = true;
  const pila = [[0, puntos.length - 1]];
  while (pila.length) {
    const [a, b] = pila.pop();
    const [ax, ay] = puntos[a];
    const dx = puntos[b][0] - ax;
    const dy = puntos[b][1] - ay;
    const largo = dx * dx + dy * dy || 1e-30;
    let mayor = -1;
    let indice = -1;
    for (let i = a + 1; i < b; i++) {
      const [px, py] = puntos[i];
      const t = Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / largo));
      const qx = ax + t * dx - px;
      const qy = ay + t * dy - py;
      const d = qx * qx + qy * qy;
      if (d > mayor) {
        mayor = d;
        indice = i;
      }
    }
    if (mayor > tol * tol) {
      conservar[indice] = true;
      pila.push([a, indice], [indice, b]);
    }
  }
  return puntos.filter((_, i) => conservar[i]);
}

const ENTIDADES = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'" };
const texto = (s) =>
  s
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1")
    .replace(/&(amp|lt|gt|quot|apos);/g, (_, e) => ENTIDADES[e])
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
    .trim();

/**
 * KML (texto) -> FeatureCollection con un MultiPolygon por Placemark y
 * properties { nombre }. Solo toma polígonos (las regiones no traen
 * puntos ni líneas).
 */
function kmlARegiones(kml, { tolerancia = TOLERANCIA, decimales = DECIMALES } = {}) {
  const f = 10 ** decimales;
  const redondear = (v) => Math.round(v * f) / f;
  const features = [];
  for (const [, pm] of kml.matchAll(/<Placemark\b[^>]*>([\s\S]*?)<\/Placemark>/g)) {
    const nombre = texto((pm.match(/<name>([\s\S]*?)<\/name>/) || [])[1] || "");
    const poligonos = [];
    for (const [, poly] of pm.matchAll(/<Polygon\b[^>]*>([\s\S]*?)<\/Polygon>/g)) {
      const anillos = [];
      for (const [, coords] of poly.matchAll(/<coordinates>([\s\S]*?)<\/coordinates>/g)) {
        const puntos = coords
          .trim()
          .split(/\s+/)
          .map((c) => c.split(",").slice(0, 2).map(Number))
          .filter(([x, y]) => Number.isFinite(x) && Number.isFinite(y));
        if (puntos.length < 4) continue;
        let s = simplificar(puntos, tolerancia);
        // Un anillo muy pequeño puede quedar en una línea: se conserva
        // como triángulo para que no desaparezca.
        if (s.length < 4) s = [puntos[0], puntos[Math.floor(puntos.length / 3)], puntos[Math.floor((2 * puntos.length) / 3)], puntos[0]];
        anillos.push(s.map(([x, y]) => [redondear(x), redondear(y)]));
      }
      if (anillos.length) poligonos.push(anillos);
    }
    if (!poligonos.length) continue;
    features.push({ type: "Feature", properties: { nombre }, geometry: { type: "MultiPolygon", coordinates: poligonos } });
  }
  return { type: "FeatureCollection", features };
}

/** Texto KML de un .kml o del primer .kml dentro de un .kmz (zip). */
function leerKml(archivo) {
  if (!/\.kmz$/i.test(archivo)) return fs.readFileSync(archivo, "utf8");
  const { CFB } = require("xlsx"); // CFB también lee archivos zip
  const zip = CFB.read(fs.readFileSync(archivo), { type: "buffer" });
  const entrada = zip.FileIndex.find((e, i) => e.type === 2 && /\.kml$/i.test(zip.FullPaths[i]));
  if (!entrada) throw new Error(`${archivo} no contiene ningún .kml`);
  return Buffer.from(entrada.content).toString("utf8");
}

function main() {
  const entrada = process.argv[2] || ENTRADA;
  const geo = kmlARegiones(leerKml(entrada));
  if (!geo.features.length) throw new Error(`${entrada} no tiene polígonos`);
  const json = JSON.stringify(geo);
  fs.writeFileSync(SALIDA, json + "\n");
  const vertices = geo.features.reduce((n, ft) => n + ft.geometry.coordinates.flat(1).reduce((m, a) => m + a.length, 0), 0);
  console.log(
    `${path.relative(process.cwd(), SALIDA)}: ${geo.features.length} regiones, ${vertices} vértices, ${(json.length / 1e6).toFixed(2)} MB`
  );
}

if (require.main === module) main();

module.exports = { simplificar, kmlARegiones };
