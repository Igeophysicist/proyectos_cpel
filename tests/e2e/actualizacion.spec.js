// App instalada con una copia vieja de la página y scripts nuevos (versiones
// mezcladas): la página se recarga una vez sola y carga bien (pwa.js).
const { test, expect } = require("./ayuda.js");

// Sin Service Worker para poder servir la "copia vieja" desde la prueba.
test.use({ serviceWorkers: "block" });
test.skip(({ isMobile }) => !isMobile, "basta con probarlo en celular");

/** Sirve la página sin un <script> la primera vez (copia vieja) y normal después. */
async function copiaVieja(page, ruta, script) {
  let cargas = 0;
  await page.route(ruta, async (route) => {
    cargas++;
    const r = await route.fetch();
    let html = await r.text();
    if (cargas === 1) html = html.replace(`<script src="${script}"></script>`, "");
    await route.fulfill({ response: r, body: html });
  });
  return () => cargas;
}

test("Mixtos: copia vieja con scripts nuevos se recarga sola y carga", async ({ page }) => {
  const cargas = await copiaVieja(page, /cartera-mixtos\/(index\.html)?(\?.*)?$/, "assets/js/kpis.js");
  await page.goto("/cartera-mixtos/");
  await expect(page.locator("#loader")).toHaveClass(/is-hidden/, { timeout: 20_000 });
  await expect(page.locator("#project-list .pcard").first()).toBeVisible();
  expect(cargas()).toBe(2);
});

test.describe("Cartera", () => {
  // La copia vieja sin text-utils.js falla a propósito en su primera carga.
  test.use({ erroresEsperados: [/TextUtils/] });
  test("un script que falla al cargar provoca una sola recarga y carga", async ({ page }) => {
    const cargas = await copiaVieja(page, /cartera-cpel\/(index\.html)?(\?.*)?$/, "../assets/js/shared/text-utils.js");
    await page.goto("/cartera-cpel/");
    await expect(page.locator("#projectName")).not.toHaveText("Cargando…", { timeout: 20_000 });
    expect(cargas()).toBe(2);
  });
});

test("un error real no provoca recargas sin fin: una recarga y el mensaje", async ({ page }) => {
  let cargas = 0;
  page.on("framenavigated", (f) => f === page.mainFrame() && /cartera-mixtos/.test(f.url()) && cargas++);
  await page.route(/DATOS_MIXTOS\.json/, (r) => r.fulfill({ status: 500, body: "" }));
  await page.goto("/cartera-mixtos/");
  await expect(page.locator("#loader-text")).toContainText("No se pudieron cargar", { timeout: 20_000 });
  await page.waitForTimeout(1500);
  expect(cargas).toBe(2);
});
