// Pruebas de cartera-cpel/assets/js/video.js (video del proyecto en Cartera CPEL).
const test = require("node:test");
const assert = require("node:assert/strict");
const { fuente } = require("../cartera-cpel/assets/js/video.js");

const YT = "https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ?autoplay=1&rel=0";

test("YouTube: watch, youtu.be, shorts y embed dan el reproductor sin cookies", () => {
  for (const v of [
    "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
    "https://youtube.com/watch?v=dQw4w9WgXcQ&t=30s",
    "https://m.youtube.com/watch?v=dQw4w9WgXcQ",
    "https://youtu.be/dQw4w9WgXcQ?si=abc",
    "https://www.youtube.com/shorts/dQw4w9WgXcQ",
    "https://www.youtube.com/embed/dQw4w9WgXcQ",
    "  https://youtu.be/dQw4w9WgXcQ  ",
  ]) {
    assert.deepEqual(fuente(v), { tipo: "iframe", src: YT, origen: "YouTube" }, v);
  }
});

test("Vimeo y Google Drive", () => {
  assert.equal(fuente("https://vimeo.com/76979871").src, "https://player.vimeo.com/video/76979871?autoplay=1");
  assert.equal(fuente("https://player.vimeo.com/video/76979871").src, "https://player.vimeo.com/video/76979871?autoplay=1");
  const drive = "https://drive.google.com/file/d/1AbCdEfGhIjKlMnOp/preview";
  assert.equal(fuente("https://drive.google.com/file/d/1AbCdEfGhIjKlMnOp/view?usp=sharing").src, drive);
  assert.equal(fuente("https://drive.google.com/open?id=1AbCdEfGhIjKlMnOp").src, drive);
});

test("archivos MP4/WebM del repositorio o de un enlace directo", () => {
  assert.deepEqual(fuente("data/VIDEOS/AMATA.mp4"), { tipo: "archivo", src: "data/VIDEOS/AMATA.mp4", origen: "archivo" });
  assert.equal(fuente("data/VIDEOS/obra.WEBM").tipo, "archivo");
  assert.deepEqual(fuente("https://ejemplo.com/v/obra.mp4"), { tipo: "archivo", src: "https://ejemplo.com/v/obra.mp4", origen: "enlace" });
});

test("vacío, otros sitios, formatos que el navegador no reproduce o rutas raras: sin video", () => {
  for (const v of ["", "   ", null, undefined, "https://www.youtube.com/", "https://ejemplo.com/pagina", "data/VIDEOS/obra.mov",
    "javascript:alert(1)", "/data/VIDEOS/a.mp4", "https://drive.google.com/drive/folders"]) {
    assert.equal(fuente(v), null, String(v));
  }
});
