/**
 * ayuda.js — utilidades de las pruebas en el navegador (tests/e2e).
 *
 *  - test: igual que el de Playwright, pero cada prueba falla si la
 *    página tiene errores de JavaScript, y bloquea las imágenes del mapa
 *    (servidores externos: si fallan, la prueba no debe depender de ellos).
 *  - datos(): los JSON del repositorio, para comparar la página contra
 *    los datos reales (así las pruebas no fallan cuando se sube un Excel).
 */
const fs = require("fs");
const path = require("path");
const base = require("@playwright/test");
const { slugify } = require("../../assets/js/shared/text-utils.js");

const ROOT = path.resolve(__dirname, "../..");
const PASSWORD = process.env.E2E_PASSWORD || "contraseña de prueba e2e";
const SESION = path.join(ROOT, "test-results", ".sesion.json");

const leer = (rel) => JSON.parse(fs.readFileSync(path.join(ROOT, rel), "utf8"));

function datos() {
  const cartera = leer("cartera-cpel/data/datos_proyectos.json").proyectos.filter((p) => String(p.nombre || "").trim());
  const mixtos = leer("cartera-mixtos/data/DATOS_MIXTOS.json")
    .proyectos.map((r) => ({ ...r, nombre: String(r["TÍTULO 2"] || r["TÍTULO 1"] || "").trim() }))
    .filter((r) => r.nombre);
  return {
    cartera,
    carteraHistorial: leer("cartera-cpel/data/historial.json").cortes,
    mixtos,
    mixtosHistorial: leer("cartera-mixtos/data/historial.json").cortes,
    mixtosActualizaciones: leer("cartera-mixtos/data/actualizaciones.json").registros,
  };
}

/** Fecha de hoy en México ("AAAA-MM-DD"). */
const hoyMexico = () =>
  new Intl.DateTimeFormat("en-CA", { timeZone: "America/Mexico_City", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());

const test = base.test.extend({
  // Errores que una prueba provoca a propósito (lista de expresiones regulares).
  erroresEsperados: [[], { option: true }],
  page: async ({ page, erroresEsperados }, use) => {
    const errores = [];
    page.on("pageerror", (e) => !erroresEsperados.some((re) => re.test(e.message)) && errores.push(e.message));
    await page.route(/arcgisonline\.com|tile\.openstreetmap\.org/, (r) => r.abort());
    await use(page);
    base.expect(errores, "errores de JavaScript en la página").toEqual([]);
  },
});

module.exports = { test, expect: base.expect, datos, hoyMexico, slugify, PASSWORD, SESION };
