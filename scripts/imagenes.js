/**
 * imagenes.js — optimiza las imágenes de encabezado de Cartera CPEL
 * (cartera-cpel/data/CARTERA-CPEL/). Lo usa build-data.js, así que corre
 * en la Action "Datos" cada vez que se sube una imagen.
 *
 * Una imagen se optimiza si mide más de MAX_WIDTH px de ancho, pesa más
 * de MAX_BYTES o trae metadatos (EXIF: ubicación GPS, orientación de la
 * cámara…). Se reduce a MAX_WIDTH de ancho, se gira según la orientación
 * de la cámara, se le quitan los metadatos y se guarda con el MISMO
 * nombre (la columna "imagen" del Excel no cambia). El original queda en
 * el historial de git.
 *
 * Las que ya están optimizadas no se tocan, para no perder calidad en
 * cada subida: si el único motivo es el peso, la nueva versión se guarda
 * solo si queda al menos 10 % más ligera.
 */
const fs = require("fs");
const path = require("path");

const MAX_WIDTH = 1200;
const MAX_BYTES = 300 * 1024;
const JPEG_QUALITY = 82;
const FORMATOS = [".jpg", ".jpeg", ".png"];

/** ¿Hay que optimizarla? (función pura, se prueba en tests/imagenes.test.js) */
function necesitaOptimizar({ width, bytes, exif }) {
  return width > MAX_WIDTH || bytes > MAX_BYTES || !!exif;
}

/**
 * Optimiza las imágenes de "dir". Con dryRun solo informa.
 * Devuelve [{ file, antes, despues, width }] de las que se optimizaron
 * (o se optimizarían).
 */
async function optimizarCarpeta(dir, { dryRun = false } = {}) {
  if (!fs.existsSync(dir)) return [];
  const sharp = require("sharp");
  const cambios = [];
  const archivos = fs
    .readdirSync(dir)
    .filter((f) => FORMATOS.includes(path.extname(f).toLowerCase()))
    .sort();

  for (const nombre of archivos) {
    const file = path.join(dir, nombre);
    const original = fs.readFileSync(file);
    const meta = await sharp(original).metadata();
    if (!necesitaOptimizar({ width: meta.width, bytes: original.length, exif: meta.exif })) continue;

    let img = sharp(original)
      .rotate() // aplica la orientación EXIF de la cámara
      .resize({ width: MAX_WIDTH, withoutEnlargement: true });
    img =
      meta.format === "png"
        ? img.png({ compressionLevel: 9, adaptiveFiltering: true })
        : img.jpeg({ quality: JPEG_QUALITY, mozjpeg: true });
    const nuevo = await img.toBuffer(); // sharp no copia los metadatos
    const soloPeso = meta.width <= MAX_WIDTH && !meta.exif;
    if (soloPeso && nuevo.length > original.length * 0.9) continue;
    const { width } = await sharp(nuevo).metadata();
    cambios.push({ file, antes: original.length, despues: nuevo.length, width });
    if (!dryRun) fs.writeFileSync(file, nuevo);
  }
  return cambios;
}

module.exports = { optimizarCarpeta, necesitaOptimizar, MAX_WIDTH, MAX_BYTES, FORMATOS };
