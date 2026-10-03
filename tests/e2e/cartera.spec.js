// Cartera CPEL: selector, enlace directo, ventanas, curva de avance y PDF.
const { test, expect, datos, slugify } = require("./ayuda.js");

const listo = (page) => expect(page.locator("#projectName")).not.toHaveText("Cargando…");

test("el selector tiene todos los proyectos y el enlace directo abre el pedido", async ({ page }) => {
  const { cartera } = datos();
  const ultimo = cartera.at(-1);
  await page.goto(`/cartera-cpel/?proyecto=${slugify(ultimo.nombre)}`);
  await listo(page);
  await expect(page.locator("#projectSelect option")).toHaveCount(cartera.length);
  await expect(page.locator("#projectName")).toHaveText(ultimo.nombre.trim());
  // cambiar de proyecto actualiza la dirección
  await page.selectOption("#projectSelect", { index: 0 });
  await expect(page).toHaveURL(new RegExp(`proyecto=${slugify(cartera[0].nombre)}`));
});

test("Ficha técnica, Plazos y Curva de avance abren con contenido", async ({ page }) => {
  await page.goto("/cartera-cpel/");
  await listo(page);
  for (const [sheet, cuerpo] of [
    ["sheetFicha", "#fichaBody"],
    ["sheetPlazos", "#plazosBody .timeline li"],
  ]) {
    await page.click(`[data-open-sheet="${sheet}"]`);
    await expect(page.locator(`#${sheet}`)).toBeVisible();
    await expect(page.locator(cuerpo).first()).not.toBeEmpty();
    await page.keyboard.press("Escape");
    await expect(page.locator(`#${sheet}`)).toBeHidden();
  }
  await page.click('[data-open-sheet="sheetCurva"]');
  await expect(page.locator("#curvaBody canvas")).toBeVisible();
  await expect.poll(() => page.evaluate(() => !!window.Chart && !!Chart.getChart(document.querySelector("#curvaBody canvas")))).toBe(true);
});

test("PDF en computadora: abre la impresión con la hoja completa", async ({ page, isMobile }) => {
  test.skip(isMobile, "en celular se genera el archivo (otra prueba)");
  await page.addInitScript(() => {
    window.print = () => {
      window.__impreso = true;
    };
  });
  await page.goto("/cartera-cpel/");
  await listo(page);
  await page.click("#printBtn");
  expect(await page.evaluate(() => window.__impreso)).toBe(true);
  // Lo que hace el navegador al imprimir (Ctrl+P o el botón):
  await page.evaluate(() => window.dispatchEvent(new Event("beforeprint")));
  await expect(page.locator("body")).toHaveClass(/modo-pdf/);
  await expect(page.locator("#printFicha")).not.toBeEmpty();
  await expect(page.locator("#printPlazos")).not.toBeEmpty();
  await page.evaluate(() => window.dispatchEvent(new Event("afterprint")));
  await expect(page.locator("body")).not.toHaveClass(/modo-pdf/);
});

test("PDF en celular: genera el archivo de una hoja", async ({ page, isMobile }) => {
  test.skip(!isMobile, "en computadora se usa la impresión");
  const { cartera } = datos();
  await page.goto(`/cartera-cpel/?proyecto=${slugify(cartera[0].nombre)}`);
  await listo(page);
  const [descarga] = await Promise.all([page.waitForEvent("download", { timeout: 40_000 }), page.click("#printBtn")]);
  expect(descarga.suggestedFilename()).toMatch(new RegExp(`^Cartera_${slugify(cartera[0].nombre)}_\\d{4}-\\d{2}-\\d{2}\\.pdf$`));
  const pdf = require("fs").readFileSync(await descarga.path(), "latin1");
  expect(pdf.startsWith("%PDF")).toBe(true);
  expect((pdf.match(/\/Type\s*\/Page[^s]/g) || []).length).toBe(1);
  await expect(page.locator("#printBtn span")).toHaveText("PDF");
});

test("sin desplazamiento horizontal", async ({ page }) => {
  await page.goto("/cartera-cpel/");
  await listo(page);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
});

test("todas las fichas cargan (cada proyecto del Excel)", async ({ page }) => {
  const { cartera } = datos();
  await page.goto("/cartera-cpel/");
  await listo(page);
  for (const [i, p] of cartera.entries()) {
    await page.selectOption("#projectSelect", { index: i });
    await expect(page.locator("#projectName")).toHaveText(p.nombre.trim());
    await expect(page.locator("#hitosGrid")).not.toBeEmpty();
  }
});
