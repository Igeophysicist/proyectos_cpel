// Contraseña (functions/_middleware.js): sin sesión no se ve nada.
const { test, expect, PASSWORD, datos, slugify } = require("./ayuda.js");

test.use({ storageState: { cookies: [], origins: [] } }); // sin sesión

test.describe("acceso con contraseña", () => {
  test.skip(({ isMobile }) => isMobile, "basta con probarlo en computadora");

  test("sin sesión pide contraseña y los datos no se descargan", async ({ page, request }) => {
    await page.goto("/");
    await expect(page.locator("#password")).toBeVisible();
    await expect(page.locator(".nav-card")).toHaveCount(0);
    for (const archivo of [
      "cartera-mixtos/data/DATOS_MIXTOS.xlsx",
      "cartera-mixtos/data/DATOS_MIXTOS.json",
      "cartera-cpel/data/historial.json",
      "cartera-mixtos/data/ENTRADA_PROYECTOS.kml",
    ]) {
      expect((await request.get(archivo)).status(), archivo).toBe(401);
    }
  });

  test("contraseña equivocada muestra error", async ({ page }) => {
    await page.goto("/");
    await page.fill("#password", "no es la contraseña");
    await page.click("button[type=submit]");
    await expect(page.getByText("Contraseña incorrecta.")).toBeVisible();
  });

  test("con la contraseña llega a la página pedida y Salir cierra la sesión", async ({ page }) => {
    const slug = slugify(datos().cartera.at(-1).nombre);
    await page.goto(`/cartera-cpel/index.html?proyecto=${slug}`);
    await page.fill("#password", PASSWORD);
    await page.click("button[type=submit]");
    // Cloudflare Pages quita "index.html" de la dirección.
    await expect(page).toHaveURL(new RegExp(`cartera-cpel/(index\\.html)?\\?proyecto=${slug}$`));
    await page.goto("/");
    await page.click("#logoutLink");
    await expect(page.locator("#password")).toBeVisible();
  });
});
