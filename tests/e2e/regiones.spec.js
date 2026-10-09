// Capa de referencia "Regiones" en los mapas de Mixtos y Cartera CPEL.
const fs = require("fs");
const path = require("path");
const { test, expect } = require("./ayuda.js");

const regiones = JSON.parse(fs.readFileSync(path.join(__dirname, "../../assets/capas/regiones.geojson"), "utf8"));
const NOMBRES = new Set(regiones.features.map((ft) => ft.properties.nombre)).size;

const casillaRegiones = (page) =>
  page.locator(".leaflet-control-layers label", { hasText: "Regiones" }).locator("input[type=checkbox]");

/**
 * Despliega el selector de capas (al pasar el puntero) y marca o desmarca
 * "Regiones". Si la página aún se acomoda (imagen, gráficas), el puntero
 * queda fuera, el selector se cierra y se vuelve a intentar.
 */
async function ponerRegiones(page, encendida) {
  const control = page.locator(".leaflet-control-layers");
  await expect(async () => {
    await control.hover();
    await casillaRegiones(page).setChecked(encendida, { timeout: 1000 });
  }).toPass();
}

test("Mixtos: la capa se descarga al encenderla, muestra nombres al acercarse y se recuerda", async ({ page, isMobile }) => {
  const descargas = [];
  page.on("request", (r) => r.url().includes("regiones.geojson") && descargas.push(r.url()));
  await page.goto("/cartera-mixtos/");
  await expect(page.locator("#loader")).toHaveClass(/is-hidden/, { timeout: 20_000 });
  if (isMobile) await page.click("[data-tab=mapa]");

  await expect(casillaRegiones(page)).not.toBeChecked();
  expect(descargas).toHaveLength(0); // apagada: no se descarga nada
  await ponerRegiones(page, true);
  await expect(page.locator(".leaflet-regiones-pane canvas")).toBeAttached();
  expect(descargas).toHaveLength(1);

  // Vista de país: sin nombres. Al acercarse aparece uno por región.
  await expect(page.locator(".region-label")).toHaveCount(0);
  for (let i = 0; i < 8 && !(await page.locator(".region-label").count()); i++) {
    await page.locator(".leaflet-control-zoom-in").click();
    await page.waitForTimeout(350);
  }
  await expect(page.locator(".region-label")).toHaveCount(NOMBRES);

  // Al volver a abrir la página sigue encendida.
  await page.reload();
  await expect(page.locator("#loader")).toHaveClass(/is-hidden/, { timeout: 20_000 });
  if (isMobile) await page.click("[data-tab=mapa]");
  await expect(casillaRegiones(page)).toBeChecked();
  await ponerRegiones(page, false);
  await expect(page.locator(".region-label")).toHaveCount(0);
  expect(await page.evaluate(() => localStorage.getItem("mapa-regiones"))).toBeNull();
});

test("Cartera: la capa Regiones se enciende desde el selector de capas", async ({ page }) => {
  await page.goto("/cartera-cpel/");
  await expect(page.locator("#projectName")).not.toHaveText("Cargando…");
  await ponerRegiones(page, true);
  await expect(page.locator(".leaflet-regiones-pane canvas")).toBeAttached();
  // El proyecto se ve de cerca: ya hay nombres de región.
  await expect(page.locator(".region-label")).toHaveCount(NOMBRES);
});
