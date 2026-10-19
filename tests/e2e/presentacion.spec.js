// Mixtos: botón "Presentación" (presentacion.js) — visor del PDF y descarga.
const { test, expect } = require("./ayuda.js");

const cargado = (page) => expect(page.locator("#loader")).toHaveClass(/is-hidden/, { timeout: 20_000 });

test("el PDF no se descarga hasta abrir la presentación", async ({ page }) => {
  const pedidos = [];
  page.on("request", (r) => /presentacion\.pdf|pdfjs-dist/.test(r.url()) && pedidos.push(r.url()));
  await page.goto("/cartera-mixtos/");
  await cargado(page);
  expect(pedidos).toEqual([]);
});

test("la presentación se ve diapositiva por diapositiva y se puede descargar", async ({ page }) => {
  await page.goto("/cartera-mixtos/");
  await cargado(page);
  await page.click("#presentacion-btn");
  await expect(page.locator("#presentacion.is-open")).toBeVisible();
  await expect(page.locator("#presentacion .pres__hoja.is-lista").first()).toBeVisible({ timeout: 30_000 });
  expect(await page.locator("#presentacion .pres__hoja").count()).toBeGreaterThan(1);
  await expect(page.locator("#presentacion-info")).toHaveText(/\d+ diapositivas?/);

  const enlace = page.locator("#presentacion .pres__descargar");
  await expect(enlace).toHaveAttribute("download", /\.pdf$/);
  // Desde la página (con la sesión del sitio), como lo pide el navegador al descargar.
  const res = await page.evaluate(async (href) => {
    const r = await fetch(href, { method: "HEAD" });
    return { status: r.status, tipo: r.headers.get("content-type") };
  }, await enlace.getAttribute("href"));
  expect(res.status).toBe(200);
  expect(res.tipo).toContain("pdf");

  await page.click("#presentacion .detail__close");
  await expect(page.locator("#presentacion")).not.toHaveClass(/is-open/);
});
