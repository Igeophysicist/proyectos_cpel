// Cartera Anteproyectos: tarjetas, ficha técnica, curva, mapa y PDF.
const fs = require("fs");
const path = require("path");
const { test, expect, slugify } = require("./ayuda.js");

const datos = () => JSON.parse(fs.readFileSync(path.join(__dirname, "../../cartera-anteproyectos/data/anteproyectos.json"), "utf8"));
const listo = (page) => expect(page.locator("#projectName")).not.toHaveText("Cargando…");

test("el portal aún no muestra el acceso; la página abre por su dirección", async ({ page }) => {
  const { proyectos } = datos();
  await page.goto("/");
  await expect(page.locator(".nav-card").first()).toBeVisible();
  // Oculto hasta liberarla (index.html: <template id="accesoAnteproyectos">).
  await expect(page.locator(".nav-card", { hasText: "Cartera Anteproyectos" })).toHaveCount(0);
  await page.goto("/cartera-anteproyectos/");
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
  if (p.nivel) await expect(page.locator("#projectNivel")).toHaveText(p.nivel);
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
  // Avance general (con la nota total) y avances particulares
  await expect(page.locator("#generalBody .progress-row--real")).toContainText(`${p.avance.general.real.toFixed(2)}%`);
  if (p.avance.general.nota) {
    // La nota total va plegada: se abre al tocarla.
    await expect(page.locator(".av-notas-gen__texto")).toBeHidden();
    await page.locator(".av-notas-gen summary").click();
    await expect(page.locator(".av-notas-gen__texto")).toBeVisible();
  }
  if (p.avance.programadoPendiente) await expect(page.locator(".av-pendiente")).toBeVisible();
  await expect(page.locator("#particularGrid .particular--btn")).toHaveCount(p.avance.grupos.length);
  // Orden: presentación, avances, descripción, RTA y mapa
  const orden = await page.locator("#cartera > section:not(.print-only)").evaluateAll((els) => els.map((e) => e.className));
  expect(orden.map((c) => c.match(/hero-card|card--\w+/)[0])).toEqual(["hero-card", "card--general", "card--particulares", "card--desc", "card--rta", "card--mapa"]);
  // Mapa: el punto del KML
  await expect(page.locator("#mapEmpty")).toBeHidden();
  await expect(page.locator(".leaflet-interactive").first()).toBeVisible();
});

test("cada avance particular abre sus avances ponderados con sus notas", async ({ page }) => {
  const p = datos().proyectos[0];
  await page.goto(`/cartera-anteproyectos/?proyecto=${slugify(p.nombre)}`);
  await listo(page);
  for (const [i, g] of p.avance.grupos.entries()) {
    await page.locator("#particularGrid .particular--btn").nth(i).click();
    await expect(page.locator("#sheetPonderado")).toHaveClass(/is-open/);
    await expect(page.locator("#ponderadoTitulo")).toHaveText(`${g.clave}. ${g.titulo}`);
    await expect(page.locator("#ponderadoBody .pond")).toHaveCount(g.items.length);
    await expect(page.locator("#ponderadoBody .pond .av-nota")).toHaveCount(g.items.filter((x) => x.nota).length);
    await page.keyboard.press("Escape");
    await expect(page.locator("#sheetPonderado")).not.toHaveClass(/is-open/);
  }
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
  await expect(page.locator(".av-notas-gen")).toHaveAttribute("open", "");
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
