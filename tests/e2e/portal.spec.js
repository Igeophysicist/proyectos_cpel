// Portal: accesos, "Esta semana" (Mixtos y Cartera) y colaboradores.
const { test, expect, datos, hoyMexico, slugify } = require("./ayuda.js");
const { resumenMixtos, resumenCartera } = require("../../assets/js/semana-resumen.js");

test("Esta semana muestra lo mismo que dicen los datos", async ({ page }) => {
  const d = datos();
  await page.goto("/");
  await expect(page.locator("#semana")).toBeVisible();

  const mixtos = resumenMixtos(d.mixtosActualizaciones, hoyMexico());
  await expect(page.locator("#semanaMixtos .semana-entrada")).toHaveCount(mixtos.entradas.length);
  const cambios = mixtos.entradas.reduce((n, e) => n + e.cambios.length, 0);
  await expect(page.locator("#semanaMixtos .semana-item")).toHaveCount(cambios);
  // la más reciente arriba
  await expect(page.locator("#semanaMixtos .semana-item__nombre").first()).toHaveText(mixtos.entradas[0].cambios[0].nombre);

  const cartera = resumenCartera(
    d.carteraHistorial,
    d.cartera.map((p) => ({ slug: slugify(p.nombre), nombre: p.nombre }))
  );
  await expect(page.locator("#semanaCartera tbody tr")).toHaveCount(cartera.filas.length);
});

test("un proyecto de Esta semana abre su ficha en Mixtos", async ({ page }) => {
  await page.goto("/");
  const enlace = page.locator("#semanaMixtos .semana-item__nombre").first();
  const nombre = (await enlace.textContent()).trim();
  await enlace.click();
  await expect(page.locator("#detail.is-open #detail-title")).toHaveText(nombre);
});

test("colaboradores se abren desde el pie de página", async ({ page }) => {
  await page.goto("/");
  await page.click("#siteFooter");
  await expect(page.locator("#colaboradoresList li").first()).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.locator("#sheetColaboradores")).toBeHidden();
});
