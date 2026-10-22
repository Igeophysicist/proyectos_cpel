// Cartera Anteproyectos: tarjetas, ficha técnica, curva, mapa y PDF.
const fs = require("fs");
const path = require("path");
const { test, expect, slugify } = require("./ayuda.js");

const datos = () => JSON.parse(fs.readFileSync(path.join(__dirname, "../../cartera-anteproyectos/data/anteproyectos.json"), "utf8"));
const listo = (page) => expect(page.locator("#projectName")).not.toHaveText("Cargando…");

test("el portal enlaza la página y el selector tiene todos los anteproyectos", async ({ page }) => {
  const { proyectos } = datos();
  await page.goto("/");
  await page.locator(".nav-card", { hasText: "Cartera Anteproyectos" }).click();
  await listo(page);
  await expect(page.locator("#projectSelect option")).toHaveCount(proyectos.length);
  await expect(page.locator("#projectName")).toHaveText(proyectos[0].nombre);
  await expect(page).toHaveURL(new RegExp(`proyecto=${slugify(proyectos[0].nombre)}`));
});

test("las tarjetas muestran la información del Excel", async ({ page }) => {
  const p = datos().proyectos[0];
  await page.goto(`/cartera-anteproyectos/?proyecto=${slugify(p.nombre)}`);
  await listo(page);
  await expect(page.locator("#projectTech")).toHaveText(p.tecnologia);
  await expect(page.locator("#projectLocation")).toHaveText(p.ubicacion);
  // Descripción: párrafos y lista numerada
  await expect(page.locator("#descVal p").first()).toBeVisible();
  if (/\n\d+\.\s/.test(p.descripcion)) await expect(page.locator("#descVal ol li").first()).toBeVisible();
  // RTA: especificaciones, POI, componentes y justificación plegable
  const secciones = Object.fromEntries(p.rta.secciones.map((s) => [s.tipo, s]));
  await expect(page.locator(".rta-spec")).toHaveCount(secciones.especificaciones.campos.length);
  await expect(page.locator(".rta-poi__se")).toHaveText(secciones.poi.campos[0].valor);
  await expect(page.locator(".rta-comp tbody tr")).toHaveCount(secciones.componentes.filas.length);
  await page.locator(".rta-mas summary").click();
  await expect(page.locator(".rta-just li").first()).toBeVisible();
  // Avance: general y un bloque por grupo, con sus sub-avances
  await expect(page.locator(".av-general .progress-row--real")).toContainText(`${p.avance.general.real}%`);
  await expect(page.locator(".av-grupo")).toHaveCount(p.avance.grupos.length);
  await expect(page.locator(".av-item")).toHaveCount(p.avance.grupos.reduce((s, g) => s + g.items.length, 0));
  if (p.avance.programadoPendiente) {
    await expect(page.locator(".av-pendiente")).toBeVisible();
    await expect(page.locator(".progress-row--prog")).toHaveCount(0);
  }
  // Mapa: el punto del KML
  await expect(page.locator("#mapEmpty")).toBeHidden();
  await expect(page.locator(".leaflet-interactive").first()).toBeVisible();
});

test("Ficha técnica y Curva de avance abren con contenido", async ({ page }) => {
  const p = datos().proyectos[0];
  await page.goto("/cartera-anteproyectos/");
  await listo(page);
  await page.click('[data-open-sheet="sheetFicha"]');
  await expect(page.locator("#fichaBody .spec tr")).toHaveCount(p.ficha.length);
  await page.keyboard.press("Escape");
  await page.click('[data-open-sheet="sheetCurva"]');
  await expect(page.locator("#curvaBody canvas")).toBeVisible();
  await expect.poll(() => page.evaluate(() => !!window.Chart && !!Chart.getChart(document.querySelector("#curvaBody canvas")))).toBe(true);
});

test("PDF en computadora: la hoja lleva la ficha técnica y la justificación abierta", async ({ page, isMobile }) => {
  test.skip(isMobile, "en celular se genera el archivo (otra prueba)");
  await page.addInitScript(() => {
    window.print = () => (window.__impreso = true);
  });
  await page.goto("/cartera-anteproyectos/");
  await listo(page);
  await page.click("#printBtn");
  expect(await page.evaluate(() => window.__impreso)).toBe(true);
  await page.evaluate(() => window.dispatchEvent(new Event("beforeprint")));
  await expect(page.locator("body")).toHaveClass(/modo-pdf/);
  await expect(page.locator("#printFicha .spec")).toBeVisible();
  await expect(page.locator(".rta-mas")).toHaveAttribute("open", "");
  await page.evaluate(() => window.dispatchEvent(new Event("afterprint")));
});

test("PDF en celular: genera el archivo de una hoja", async ({ page, isMobile }) => {
  test.skip(!isMobile, "en computadora se usa la impresión");
  const p = datos().proyectos[0];
  await page.goto(`/cartera-anteproyectos/?proyecto=${slugify(p.nombre)}`);
  await listo(page);
  const [descarga] = await Promise.all([page.waitForEvent("download", { timeout: 40_000 }), page.click("#printBtn")]);
  expect(descarga.suggestedFilename()).toMatch(new RegExp(`^Anteproyecto_${slugify(p.nombre)}_\\d{4}-\\d{2}-\\d{2}\\.pdf$`));
});

test("sin desplazamiento horizontal", async ({ page }) => {
  await page.goto("/cartera-anteproyectos/");
  await listo(page);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
});
