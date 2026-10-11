const test = require("node:test");
const assert = require("node:assert");
const fs = require("fs");
const path = require("path");
const { simplificar, kmlARegiones } = require("../scripts/regiones.js");

test("simplificar quita los puntos casi alineados y conserva los extremos", () => {
  const linea = [[0, 0], [1, 0.0001], [2, 0], [3, 1], [4, 0]];
  assert.deepStrictEqual(simplificar(linea, 0.01), [[0, 0], [2, 0], [3, 1], [4, 0]]);
  assert.deepStrictEqual(simplificar(linea, 0), linea);
});

test("kmlARegiones: un MultiPolygon por Placemark, con nombre y coordenadas redondeadas", () => {
  const anillo = "-97.123456789,18.1,0 -97.0,18.1 -97.0,18.2 -97.123456789,18.1";
  const kml = `<kml><Document><Folder><name>CARPETA</name>
    <Placemark id="1"><name>Tuxtlas, Popolucas &amp; Náhuatl</name>
      <MultiGeometry><Polygon><outerBoundaryIs><LinearRing><coordinates>${anillo}</coordinates></LinearRing></outerBoundaryIs></Polygon>
      <Polygon><outerBoundaryIs><LinearRing><coordinates>${anillo}</coordinates></LinearRing></outerBoundaryIs></Polygon></MultiGeometry>
    </Placemark>
    <Placemark><name>Punto</name><Point><coordinates>-97,18</coordinates></Point></Placemark>
  </Folder></Document></kml>`;
  const geo = kmlARegiones(kml);
  assert.strictEqual(geo.features.length, 1); // el punto no es región
  const [ft] = geo.features;
  assert.strictEqual(ft.properties.nombre, "Tuxtlas, Popolucas & Náhuatl");
  assert.strictEqual(ft.geometry.type, "MultiPolygon");
  assert.strictEqual(ft.geometry.coordinates.length, 2);
  assert.deepStrictEqual(ft.geometry.coordinates[0][0][0], [-97.12346, 18.1]);
});

test("assets/capas/regiones.geojson está generado y es ligero", () => {
  const archivo = path.join(__dirname, "..", "assets", "capas", "regiones.geojson");
  const geo = JSON.parse(fs.readFileSync(archivo, "utf8"));
  assert.ok(geo.features.length > 0);
  for (const ft of geo.features) {
    assert.ok(ft.properties.nombre, "cada región tiene nombre");
    assert.strictEqual(ft.geometry.type, "MultiPolygon");
  }
  assert.ok(fs.statSync(archivo).size < 1.5e6, "menos de 1.5 MB");
});
