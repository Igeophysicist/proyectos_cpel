// Accesibilidad (WCAG 2.2 AA + buenas prácticas) con axe-core en cada
// página y en sus ventanas, y el foco del teclado dentro de las ventanas.
const { test, expect } = require("./ayuda.js");

const AXE = require.resolve("axe-core/axe.min.js");
const REGLAS = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa", "best-practice"];

/** Revisa la página tal como está y falla con la lista de problemas. */
async function revisar(page, estado) {
  await page.addScriptTag({ path: AXE });
  const problemas = await page.evaluate(async (tags) => {
    const r = await window.axe.run(document, { runOnly: { type: "tag", values: tags } });
    return r.violations.map((v) => `${v.id} (${v.impact}): ${v.help} → ${v.nodes.slice(0, 3).map((n) => n.target.join(" ")).join(", ")}`);
  }, REGLAS);
  expect(problemas, `${estado}:\n${problemas.join("\n")}`).toEqual([]);
}

// Sin animaciones de entrada: axe revisa la página ya pintada (a mitad de
// la animación los textos están semitransparentes y su contraste baja).
test.beforeEach(({ page }) => page.emulateMedia({ reducedMotion: "reduce" }));

const mixtosCargado = (page) => expect(page.locator("#loader")).toHaveClass(/is-hidden/, { timeout: 20_000 });

test.describe("pantalla de contraseña", () => {
  test.use({ storageState: { cookies: [], origins: [] } }); // sin sesión
  test("sin problemas de accesibilidad", async ({ page }) => {
    await page.goto("/");
    await expect(page.locator("#password")).toBeVisible();
    await revisar(page, "contraseña");
  });
});

test("portal sin problemas de accesibilidad", async ({ page }) => {
  await page.goto("/");
  await expect(page.locator("#semana")).toBeVisible();
  await revisar(page, "portal");
  await page.click("#siteFooter");
  await expect(page.locator("#sheetColaboradores")).toHaveClass(/is-open/);
  await revisar(page, "portal: colaboradores");
});

test("Cartera y sus ventanas sin problemas de accesibilidad", async ({ page }) => {
  await page.goto("/cartera-cpel/");
  await expect(page.locator("#projectName")).not.toHaveText("Cargando…");
  await revisar(page, "cartera");
  for (const [boton, ventana] of [
    ["Ficha técnica", "#sheetFicha"],
    ["Plazos", "#sheetPlazos"],
    ["Curva de avance", "#sheetCurva"],
  ]) {
    await page.locator(".actionbar__btn", { hasText: boton }).click();
    await expect(page.locator(ventana)).toHaveClass(/is-open/);
    await revisar(page, "cartera: " + boton);
    await page.keyboard.press("Escape");
    await expect(page.locator(ventana)).not.toHaveClass(/is-open/);
  }
});

test("Mixtos y sus ventanas sin problemas de accesibilidad", async ({ page, isMobile }) => {
  await page.goto("/cartera-mixtos/");
  await mixtosCargado(page);
  await revisar(page, "mixtos: listado");
  if (isMobile) {
    await page.click("[data-tab=resumen]");
    await expect(page.locator("#group-resumen")).toBeVisible();
    await revisar(page, "mixtos: resumen");
    await page.click("[data-tab=proyectos]");
    await page.click("#filter-btn");
    await expect(page.locator("#filters")).toHaveClass(/is-open/);
    await revisar(page, "mixtos: filtros");
    await page.keyboard.press("Escape");
  }
  await page.locator("#project-list .pcard").first().click();
  await expect(page.locator("#detail")).toHaveClass(/is-open/);
  await revisar(page, "mixtos: ficha");
});

test("con una ventana abierta, el tabulador no sale de ella", async ({ page, isMobile }) => {
  test.skip(isMobile, "teclado: basta con computadora");
  await page.goto("/cartera-mixtos/");
  await mixtosCargado(page);
  await page.locator("#project-list .pcard__open").first().focus();
  await page.keyboard.press("Enter");
  await expect(page.locator("#detail")).toHaveClass(/is-open/);
  for (let i = 0; i < 12; i++) {
    await page.keyboard.press(i % 3 === 2 ? "Shift+Tab" : "Tab");
    expect(await page.evaluate(() => !!document.activeElement.closest("#detail"))).toBe(true);
  }
  await page.keyboard.press("Escape");
  await expect(page.locator("#detail")).not.toHaveClass(/is-open/);
  // El foco vuelve al botón de la tarjeta que abrió la ficha.
  await expect(page.locator("#project-list .pcard__open").first()).toBeFocused();
});
