// Mixtos: listado, búsqueda, filtros por enlace, ficha, Evolución y mapa.
const { test, expect, datos, slugify } = require("./ayuda.js");

const cargado = (page) => expect(page.locator("#loader")).toHaveClass(/is-hidden/, { timeout: 20_000 });

/** Primer proyecto con evolución (aparece en el historial) y ubicación en el mapa. */
function proyectoConEvolucion() {
  const d = datos();
  const conHistorial = new Set(d.mixtosHistorial.flatMap((c) => Object.keys(c.proyectos)));
  return d.mixtos.find((r) => conHistorial.has(slugify(r.nombre)));
}

test("el listado tiene todos los proyectos del Excel", async ({ page }) => {
  await page.goto("/cartera-mixtos/");
  await cargado(page);
  await expect(page.locator("#project-list .pcard")).toHaveCount(datos().mixtos.length);
});

test("la búsqueda y los filtros por enlace reducen el listado", async ({ page }) => {
  const { mixtos } = datos();
  const p = mixtos[0];
  await page.goto("/cartera-mixtos/");
  await cargado(page);
  await page.fill("#search-input", p.nombre);
  await expect.poll(() => page.locator("#project-list .pcard").count()).toBeLessThan(mixtos.length);
  await expect(page.locator("#project-list .pcard", { hasText: p.nombre }).first()).toBeVisible();

  const tecnologia = p["Tecnología"];
  await page.goto(`/cartera-mixtos/?tecnologia=${encodeURIComponent(tecnologia)}`);
  await cargado(page);
  await expect(page.locator("#project-list .pcard")).toHaveCount(mixtos.filter((r) => r["Tecnología"] === tecnologia).length);
  await expect(page.locator("#filter-count")).toHaveText("1");
});

test("el enlace directo abre la ficha con sus botones", async ({ page }) => {
  const p = proyectoConEvolucion();
  await page.goto(`/cartera-mixtos/?proyecto=${slugify(p.nombre)}`);
  await cargado(page);
  await expect(page.locator("#detail.is-open #detail-title")).toHaveText(p.nombre);
  await expect(page.locator("#detail [data-open-evolucion]")).toBeVisible();
  await expect(page.locator("#detail canvas")).toHaveCount(0); // la gráfica ya no va dentro de la ficha
});

test("Evolución: desde la tarjeta abre el panel sin abrir la ficha; desde la ficha, encima", async ({ page }) => {
  const p = proyectoConEvolucion();
  await page.goto("/cartera-mixtos/");
  await cargado(page);
  const tarjeta = page.locator("#project-list .pcard", { hasText: p.nombre }).first();
  await tarjeta.locator(".evo-btn").click();
  await expect(page.locator("#evolucion")).toHaveClass(/is-open/);
  await expect(page.locator("#detail")).not.toHaveClass(/is-open/);
  await expect(page.locator("#evolucion .detail__sub")).toHaveText(p.nombre);
  await expect.poll(() => page.evaluate(() => !!Chart.getChart(document.querySelector("#evolucion canvas")))).toBe(true);
  await page.keyboard.press("Escape");
  await expect(page.locator("#evolucion")).not.toHaveClass(/is-open/);

  await tarjeta.click();
  await expect(page.locator("#detail")).toHaveClass(/is-open/);
  await page.click("#detail [data-open-evolucion]");
  await expect(page.locator("#evolucion")).toHaveClass(/is-open/);
  await page.keyboard.press("Escape"); // cierra primero el panel de arriba
  await expect(page.locator("#evolucion")).not.toHaveClass(/is-open/);
  await expect(page.locator("#detail")).toHaveClass(/is-open/);
});

test("Ver en el mapa abre el proyecto en el mapa", async ({ page }) => {
  const p = proyectoConEvolucion();
  await page.goto(`/cartera-mixtos/?proyecto=${slugify(p.nombre)}`);
  await cargado(page);
  await page.click("#detail [data-view-on-map]");
  await expect(page.locator(".leaflet-popup .map-popup__title")).toHaveText(p.nombre);
});

test("sin desplazamiento horizontal", async ({ page }) => {
  await page.goto("/cartera-mixtos/");
  await cargado(page);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
});

test("todas las fichas abren (cada proyecto del Excel)", async ({ page, isMobile }) => {
  test.skip(isMobile, "basta con recorrerlas una vez");
  const { mixtos } = datos();
  await page.goto("/cartera-mixtos/");
  await cargado(page);
  const tarjetas = page.locator("#project-list .pcard");
  for (let i = 0; i < mixtos.length; i++) {
    await tarjetas.nth(i).click();
    await expect(page.locator("#detail")).toHaveClass(/is-open/);
    await expect(page.locator("#detail-title")).not.toBeEmpty();
    await page.keyboard.press("Escape");
    await expect(page.locator("#detail")).not.toHaveClass(/is-open/);
  }
});
