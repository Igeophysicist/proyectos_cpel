// Archivos subidos con un nombre "repetido": el mismo nombre pero con los
// acentos guardados de otra forma (NFC/NFD, según el equipo desde el que se
// suba) o con espacios al inicio/fin. Quedan dos archivos y la página sigue
// abriendo el viejo (pasó con presentación_mixtos.pdf y " CHICOASEN.jpg").
const test = require("node:test");
const assert = require("node:assert/strict");
const { execSync } = require("node:child_process");
const path = require("node:path");

test("no hay dos archivos con el mismo nombre salvo acentos o espacios", () => {
  const raiz = path.resolve(__dirname, "..");
  const archivos = execSync("git ls-files -z", { cwd: raiz, encoding: "utf8" }).split("\0").filter(Boolean);
  const clave = (f) => path.posix.join(path.posix.dirname(f), path.posix.basename(f).normalize("NFC").trim().toLowerCase());
  const vistos = new Map();
  const repetidos = [];
  for (const f of archivos) {
    const k = clave(f);
    if (vistos.has(k)) repetidos.push(`"${vistos.get(k)}" y "${f}"`);
    else vistos.set(k, f);
  }
  assert.deepEqual(repetidos, [], "Borra el archivo viejo y deja solo uno con el nombre correcto");
});
