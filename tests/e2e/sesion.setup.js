// Inicia sesión una vez y guarda la cookie para las demás pruebas.
const { test, expect } = require("@playwright/test");
const { PASSWORD, SESION } = require("./ayuda.js");

test("iniciar sesión", async ({ page }) => {
  await page.goto("/");
  await page.fill("#password", PASSWORD);
  await page.click("button[type=submit]");
  await expect(page.locator(".nav-card").first()).toBeVisible();
  await page.context().storageState({ path: SESION });
});
