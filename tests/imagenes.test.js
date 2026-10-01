// Pruebas de scripts/imagenes.js (optimización de imágenes de Cartera CPEL).
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const os = require("os");
const path = require("path");
const sharp = require("sharp");
const { optimizarCarpeta, necesitaOptimizar, MAX_WIDTH } = require("../scripts/imagenes.js");

test("necesitaOptimizar: ancho, peso o metadatos", () => {
  assert.equal(necesitaOptimizar({ width: 1200, bytes: 200000 }), false);
  assert.equal(necesitaOptimizar({ width: 4032, bytes: 200000 }), true);
  assert.equal(necesitaOptimizar({ width: 800, bytes: 900000 }), true);
  assert.equal(necesitaOptimizar({ width: 800, bytes: 100000, exif: Buffer.from("x") }), true);
});

/** Foto "de celular": 4032x3024 con ruido (pesada), GPS y orientación EXIF. */
async function fotoDeCelular(file) {
  const w = 4032, h = 3024;
  const raw = Buffer.alloc(w * h * 3);
  for (let i = 0; i < raw.length; i++) raw[i] = (i * 2654435761) >>> 24;
  await sharp(raw, { raw: { width: w, height: h, channels: 3 } })
    .withMetadata({ orientation: 6 }) // cámara girada 90°
    .withExifMerge({ IFD0: { Make: "Phone" }, IFD3: { GPSLatitudeRef: "N", GPSLatitude: "19/1 25/1 0/1" } })
    .jpeg({ quality: 95 })
    .toFile(file);
}

test("optimizarCarpeta: reduce, gira, quita metadatos y conserva el nombre", async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "img-"));
  try {
    const foto = path.join(dir, "FOTO.jpg");
    await fotoDeCelular(foto);
    const antes = fs.statSync(foto).size;
    const original = await sharp(foto).metadata();
    assert.ok(original.exif && original.orientation === 6, "la foto de prueba trae EXIF y orientación");

    const cambios = await optimizarCarpeta(dir);
    assert.equal(cambios.length, 1);
    const meta = await sharp(foto).metadata();
    // Orientación 6 = girada 90°: la foto vertical queda de 1200 de ancho.
    assert.equal(meta.width, MAX_WIDTH);
    assert.equal(meta.height, 1600);
    assert.equal(meta.exif, undefined, "sin metadatos (GPS)");
    assert.ok(fs.statSync(foto).size < antes / 5, "mucho más ligera");
    assert.deepEqual(fs.readdirSync(dir), ["FOTO.jpg"], "mismo nombre, sin archivos extra");

    // Una segunda pasada no vuelve a comprimir.
    const bytes = fs.readFileSync(foto);
    assert.deepEqual(await optimizarCarpeta(dir), []);
    assert.ok(fs.readFileSync(foto).equals(bytes));
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test("optimizarCarpeta: con dryRun no modifica nada; ignora otros archivos", async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "img-"));
  try {
    await sharp({ create: { width: 2000, height: 1000, channels: 3, background: "#2e534f" } }).png().toFile(path.join(dir, "A.png"));
    fs.writeFileSync(path.join(dir, "notas.txt"), "x");
    const antes = fs.readFileSync(path.join(dir, "A.png"));
    const cambios = await optimizarCarpeta(dir, { dryRun: true });
    assert.equal(cambios.length, 1);
    assert.ok(fs.readFileSync(path.join(dir, "A.png")).equals(antes));
    await optimizarCarpeta(dir);
    assert.equal((await sharp(path.join(dir, "A.png")).metadata()).width, MAX_WIDTH);
    assert.equal((await sharp(path.join(dir, "A.png")).metadata()).format, "png");
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});
