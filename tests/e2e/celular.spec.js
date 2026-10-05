// Uso en celular: leyenda del mapa siempre visible, ventanas que no
// mueven la página de atrás y que se cierran deslizando hacia abajo.
const { test, expect } = require("./ayuda.js");

test.skip(({ isMobile }) => !isMobile, "gestos de celular");

// Sin animaciones: los gestos empiezan con cada ventana ya en su lugar.
test.beforeEach(({ page }) => page.emulateMedia({ reducedMotion: "reduce" }));

const mixtosCargado = (page) => expect(page.locator("#loader")).toHaveClass(/is-hidden/, { timeout: 20_000 });

// Una sesión de eventos táctiles por página: cerrarla justo al soltar el
// dedo puede descartar el desplazamiento que el navegador aún no aplica.
const sesiones = new WeakMap();
async function sesionTactil(page) {
  if (!sesiones.has(page)) sesiones.set(page, await page.context().newCDPSession(page));
  return sesiones.get(page);
}

/** Arrastra un dedo de (x, y1) a (x, y2) con eventos táctiles reales. */
async function arrastrar(page, x, y1, y2) {
  const cdp = await sesionTactil(page);
  await cdp.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [{ x, y: y1 }] });
  for (let i = 1; i <= 12; i++) {
    await cdp.send("Input.dispatchTouchEvent", { type: "touchMove", touchPoints: [{ x, y: y1 + ((y2 - y1) * i) / 12 }] });
    await page.waitForTimeout(16);
  }
  await cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
  await page.waitForTimeout(300); // que el navegador termine el gesto
}

/** Arrastra hacia abajo desde el encabezado de la ventana. */
async function deslizarParaCerrar(page, encabezado, distancia = 260) {
  const r = await page.locator(encabezado).boundingBox();
  const y = r.y + Math.min(r.height / 2, 30);
  await arrastrar(page, r.x + r.width / 2, y, y + distancia);
}

test("la leyenda del mapa se ve aunque la lista se haya desplazado", async ({ page }) => {
  await page.goto("/cartera-mixtos/");
  await mixtosCargado(page);
  await page.evaluate(() => window.scrollTo(0, 3000));
  await page.click("[data-tab=mapa]");
  const leyenda = await page.locator(".map-legend").boundingBox();
  const pestanas = await page.locator(".tabbar").boundingBox();
  const barra = await page.locator(".topbar").boundingBox();
  const mapa = await page.locator("#map").boundingBox();
  // El mapa ocupa justo el espacio entre las dos barras (no se movió con
  // la página) y la leyenda queda abajo, encima de las pestañas.
  expect(Math.round(mapa.y)).toBe(Math.round(barra.y + barra.height));
  expect(Math.round(mapa.y + mapa.height)).toBe(Math.round(pestanas.y));
  const hueco = pestanas.y - (leyenda.y + leyenda.height);
  expect(hueco).toBeGreaterThanOrEqual(0);
  expect(hueco).toBeLessThan(24);
});

test("Mixtos: la ficha bloquea la página de atrás y se cierra deslizando hacia abajo", async ({ page }) => {
  await page.goto("/cartera-mixtos/");
  await mixtosCargado(page);
  await page.locator("#project-list .pcard__open").nth(2).click();
  await expect(page.locator("#detail")).toHaveClass(/is-open/);
  const y = await page.evaluate(() => window.scrollY);

  // Arrastre corto: la ficha regresa a su lugar.
  await deslizarParaCerrar(page, "#detail .detail__head", 40);
  await expect(page.locator("#detail")).toHaveClass(/is-open/);
  // Deslizar sobre el fondo oscuro no mueve la página.
  const panel = await page.locator("#detail-body").boundingBox();
  await arrastrar(page, 200, panel.y - 10, 5);
  expect(await page.evaluate(() => window.scrollY)).toBe(y);

  await deslizarParaCerrar(page, "#detail .detail__head");
  await expect(page.locator("#detail")).not.toHaveClass(/is-open/);
  expect(await page.evaluate(() => window.scrollY)).toBe(y);

  await page.click("#filter-btn");
  await expect(page.locator("#filters")).toHaveClass(/is-open/);
  await deslizarParaCerrar(page, "#filters .filters__head");
  await expect(page.locator("#filters")).not.toHaveClass(/is-open/);
});

test("Cartera: el contenido de la ventana se desplaza y, ya arriba, deslizar hacia abajo la cierra", async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 480 }); // pantalla chica: la ficha técnica no cabe
  await page.goto("/cartera-cpel/");
  await expect(page.locator("#projectName")).not.toHaveText("Cargando…");
  await page.locator(".actionbar__btn", { hasText: "Ficha técnica" }).click();
  await expect(page.locator("#sheetFicha")).toHaveClass(/is-open/);
  // Que la ventana termine de acomodarse antes de medirla y tocarla (si no,
  // el navegador a veces aún no desplaza su contenido con el dedo).
  await page.waitForTimeout(500);
  const cuerpo = page.locator("#sheetFicha .sheet__body");
  const r = await cuerpo.boundingBox();
  const y = await page.evaluate(() => window.scrollY);

  await arrastrar(page, r.x + 100, r.y + r.height - 30, r.y + 30); // hacia arriba: desplaza el contenido
  await expect.poll(() => cuerpo.evaluate((el) => el.scrollTop)).toBeGreaterThan(0);
  expect(await page.evaluate(() => window.scrollY)).toBe(y);
  await arrastrar(page, r.x + 100, r.y + 30, r.y + 120); // hacia abajo con contenido desplazado: no cierra
  await expect(page.locator("#sheetFicha")).toHaveClass(/is-open/);

  await deslizarParaCerrar(page, "#sheetFicha .sheet__head");
  await expect(page.locator("#sheetFicha")).not.toHaveClass(/is-open/);
});
