// Cartera CPEL: selector, enlace directo, ventanas, curva de avance y PDF.
const { test, expect, datos, slugify, FICHA_CARTERA } = require("./ayuda.js");

const listo = (page) => expect(page.locator("#projectName")).not.toHaveText("Cargando…");

test("el selector tiene todos los proyectos y el enlace directo abre el pedido", async ({ page }) => {
  const { cartera } = datos();
  const ultimo = cartera.at(-1);
  await page.goto(`/cartera-cpel/?proyecto=${slugify(ultimo.nombre)}`);
  await listo(page);
  await expect(page.locator("#projectSelect option")).toHaveCount(cartera.length);
  await expect(page.locator("#projectName")).toHaveText(ultimo.nombre.trim());
  // cambiar de proyecto actualiza la dirección
  await page.selectOption("#projectSelect", { index: 0 });
  await expect(page).toHaveURL(new RegExp(`proyecto=${slugify(cartera[0].nombre)}`));
});

test("Ficha técnica, Plazos y Curva de avance abren con contenido", async ({ page }) => {
  await page.goto(FICHA_CARTERA);
  await listo(page);
  for (const [sheet, cuerpo] of [
    ["sheetFicha", "#fichaBody"],
    ["sheetPlazos", "#plazosBody .timeline li"],
  ]) {
    await page.click(`[data-open-sheet="${sheet}"]`);
    await expect(page.locator(`#${sheet}`)).toBeVisible();
    await expect(page.locator(cuerpo).first()).not.toBeEmpty();
    await page.keyboard.press("Escape");
    await expect(page.locator(`#${sheet}`)).toBeHidden();
  }
  await page.click('[data-open-sheet="sheetCurva"]');
  await expect(page.locator("#curvaBody canvas")).toBeVisible();
  await expect.poll(() => page.evaluate(() => !!window.Chart && !!Chart.getChart(document.querySelector("#curvaBody canvas")))).toBe(true);
});

test("PDF en computadora: abre la impresión con la hoja completa", async ({ page, isMobile }) => {
  test.skip(isMobile, "en celular se genera el archivo (otra prueba)");
  await page.addInitScript(() => {
    window.print = () => {
      window.__impreso = true;
    };
  });
  await page.goto(FICHA_CARTERA);
  await listo(page);
  await page.click("#printBtn");
  expect(await page.evaluate(() => window.__impreso)).toBe(true);
  // Lo que hace el navegador al imprimir (Ctrl+P o el botón):
  await page.evaluate(() => window.dispatchEvent(new Event("beforeprint")));
  await expect(page.locator("body")).toHaveClass(/modo-pdf/);
  await expect(page.locator("#printFicha")).not.toBeEmpty();
  await expect(page.locator("#printPlazos")).not.toBeEmpty();
  await page.evaluate(() => window.dispatchEvent(new Event("afterprint")));
  await expect(page.locator("body")).not.toHaveClass(/modo-pdf/);
});

test("PDF en celular: genera el archivo de una hoja", async ({ page, isMobile }) => {
  test.skip(!isMobile, "en computadora se usa la impresión");
  const { cartera } = datos();
  await page.goto(`/cartera-cpel/?proyecto=${slugify(cartera[0].nombre)}`);
  await listo(page);
  const [descarga] = await Promise.all([page.waitForEvent("download", { timeout: 40_000 }), page.click("#printBtn")]);
  expect(descarga.suggestedFilename()).toMatch(new RegExp(`^Cartera_${slugify(cartera[0].nombre)}_\\d{4}-\\d{2}-\\d{2}\\.pdf$`));
  const pdf = require("fs").readFileSync(await descarga.path(), "latin1");
  expect(pdf.startsWith("%PDF")).toBe(true);
  expect((pdf.match(/\/Type\s*\/Page[^s]/g) || []).length).toBe(1);
  await expect(page.locator("#printBtn span")).toHaveText("PDF");
});

test("sin desplazamiento horizontal", async ({ page }) => {
  await page.goto(FICHA_CARTERA);
  await listo(page);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
});

test("todas las fichas cargan (cada proyecto del Excel)", async ({ page }) => {
  const { cartera } = datos();
  await page.goto(FICHA_CARTERA);
  await listo(page);
  for (const [i, p] of cartera.entries()) {
    await page.selectOption("#projectSelect", { index: i });
    await expect(page.locator("#projectName")).toHaveText(p.nombre.trim());
    await expect(page.locator("#hitosCard")).not.toBeEmpty();
  }
});

test("Hitos de pago: anterior, actual y próximo; Ver todos abre la lista por contrato", async ({ page }) => {
  const hitos = JSON.parse(require("fs").readFileSync(require("path").join(__dirname, "../../cartera-cpel/data/hitos.json"), "utf8"));
  // Un proyecto con varios contratos (pestañas) y uno con uno solo.
  const [slugVarios, varios] = Object.entries(hitos.proyectos).find(([, p]) => p.contratos.length > 1);
  await page.goto(`/cartera-cpel/?proyecto=${slugVarios}`);
  await listo(page);
  const tarjeta = page.locator("#hitosCard");
  await expect(tarjeta.locator(".hito3")).toHaveCount(3);
  const total = varios.contratos.reduce((s, c) => s + c.hitos.length, 0);
  await expect(tarjeta.locator(".hitos-res__top")).toContainText(`de ${total} hitos pagados`);
  // Monto a pagar de cada hito.
  await expect(tarjeta.locator(".hito3__monto").first()).toContainText(/\$[\d,]+\.\d{2} (USD|MXN)/);

  await tarjeta.locator(".hitos-ver").click();
  const ventana = page.locator("#sheetHitos");
  await expect(ventana).toHaveClass(/is-open/);
  await expect(ventana.locator(".htab")).toHaveCount(varios.contratos.length);
  await expect(ventana.locator(".hl")).toHaveCount(varios.contratos[0].hitos.length);
  await ventana.locator(".htab").nth(1).click();
  await expect(ventana.locator(".htab").nth(1)).toHaveAttribute("aria-selected", "true");
  await expect(ventana.locator(".hl")).toHaveCount(varios.contratos[1].hitos.length);
  await expect(ventana.locator(".hl__monto").first()).toContainText(/\$[\d,]+\.\d{2} (USD|MXN)/);
  // Altura fija en celular: se sigue viendo un poco de la ficha detrás.
  const alto = await ventana.locator(".sheet__panel").evaluate((el) => el.getBoundingClientRect().height / window.innerHeight);
  if (page.viewportSize().width < 900) expect(alto).toBeLessThan(0.9);
});

test("Avance General: Programado y Real, semáforo y cambio desde el corte anterior", async ({ page }) => {
  const { cartera, carteraHistorial } = datos();
  globalThis.TextUtils = require("../../assets/js/shared/text-utils.js");
  const A = require("../../cartera-cpel/assets/js/avance.js");
  const p = cartera[0];
  const n = (v) => Math.round(parseFloat(String(v).replace("%", "")) * 100) / 100;
  const real = n(p.avanceReal);
  const prog = n(p.avanceProg);
  await page.goto(`/cartera-cpel/?proyecto=${slugify(p.nombre)}`);
  await listo(page);
  const general = page.locator("#generalBody");
  await expect(general.locator(".progress-row--real .progress-row__info > span").last()).toHaveText(`${real.toFixed(2)}%`);
  await expect(general.locator(".progress-row--prog .progress-row__info > span").last()).toHaveText(`${prog.toFixed(2)}%`);
  const sem = A.semaforo(Math.round((real - prog) * 100) / 100);
  await expect(general.locator(".variance")).toHaveClass(new RegExp(`variance--${sem}`));
  const cambio = A.cambioSemanal(carteraHistorial, slugify(p.nombre));
  if (cambio) await expect(general.locator(".avg__semana")).toContainText(`${Math.abs(cambio.diff).toFixed(2)} desde el`);
  // Avances particulares: P y R por área
  await expect(page.locator("#particularGrid .particular .mini-row")).toHaveCount(8);
});

test("Avances particulares: la diferencia Real − Programado de cada área con el color del semáforo", async ({ page }) => {
  globalThis.TextUtils = require("../../assets/js/shared/text-utils.js");
  const A = require("../../cartera-cpel/assets/js/avance.js");
  const p = datos().cartera[0];
  const n = (v) => Math.round(parseFloat(String(v).replace("%", "")) * 100) / 100;
  await page.goto(`/cartera-cpel/?proyecto=${slugify(p.nombre)}`);
  await listo(page);
  const difs = page.locator("#particularGrid .particular .mini-dif");
  await expect(difs).toHaveCount(4);
  // Ingeniería es la primera tarjeta (columnas realIng / progIng)
  const d = Math.round((n(p.realIng) - n(p.progIng)) * 100) / 100;
  await expect(difs.first()).toHaveClass(new RegExp(`mini-dif--${A.semaforo(d)}`));
});

test("Eventos importantes: viñetas como lista y, si es largo, \"Ver más\" / \"Ver menos\"", async ({ page }) => {
  const p = datos().cartera[0];
  await page.goto(`/cartera-cpel/?proyecto=${slugify(p.nombre)}`);
  await listo(page);
  const eventos = page.locator("#eventosVal");
  if (/^\s*•/m.test(p.eventos_importantes)) await expect(eventos.locator("ul li").first()).toBeVisible();
  const alto = () => eventos.evaluate((el) => el.clientHeight);
  const btn = page.locator("#eventosVal + .plegable__btn");
  if (!(await btn.count())) return; // texto corto: sin botón
  const plegado = await alto();
  await btn.click();
  await expect(btn).toHaveText("Ver menos");
  await expect(btn).toHaveAttribute("aria-expanded", "true");
  expect(await alto()).toBeGreaterThan(plegado);
  await btn.click();
  await expect(btn).toHaveText("Ver más");
});

test("tablet vertical: tarjetas en dos columnas y ventanas centradas de ancho cómodo", async ({ page }) => {
  await page.setViewportSize({ width: 800, height: 1280 });
  const p = datos().cartera[0];
  await page.goto(`/cartera-cpel/?proyecto=${slugify(p.nombre)}`);
  await listo(page);
  // Avance General y Avances particulares lado a lado
  const [a, b] = await page.locator("#cartera > .card").evaluateAll((els) => els.slice(0, 2).map((e) => e.getBoundingClientRect()));
  expect(Math.abs(a.top - b.top)).toBeLessThan(20); // misma fila (con margen por la animación de entrada)
  expect(b.left).toBeGreaterThan(a.right);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  expect(Math.abs(a.height - b.height)).toBeLessThan(2); // misma altura (sin hueco debajo)
  await page.locator(".actionbar__btn", { hasText: "Ficha técnica" }).click();
  const panel = await page.locator("#sheetFicha .sheet__panel").boundingBox();
  expect(panel.width).toBeLessThanOrEqual(600);
  expect(Math.abs(panel.x + panel.width / 2 - 400)).toBeLessThan(2); // centrada
});

test("mientras cargan los datos se ven tarjetas de relleno (no barras en 0 %)", async ({ page }) => {
  let soltar;
  const espera = new Promise((r) => (soltar = r));
  await page.route(/datos_proyectos\.json/, async (route) => {
    await espera;
    await route.continue();
  });
  await page.goto(FICHA_CARTERA);
  await expect(page.locator("#generalBody .esq").first()).toBeVisible();
  await expect(page.locator("#particularGrid .particular--esq")).toHaveCount(4);
  await expect(page.locator("#generalBody .progress-row")).toHaveCount(0);
  soltar();
  await listo(page);
  await expect(page.locator("#cartera .esq")).toHaveCount(0);
  await expect(page.locator("#generalBody .progress-row")).toHaveCount(2);
});

test("proyecto sin foto (o que no carga): fondo con el ícono de su tecnología", async ({ page }) => {
  const p = datos().cartera[0];
  await page.route(/\/data\/.*\.(jpe?g|png|webp)(\?.*)?$/i, (r) => r.abort()); // la foto del proyecto no carga
  await page.goto(`/cartera-cpel/?proyecto=${slugify(p.nombre)}`);
  await listo(page);
  await expect(page.locator(".hero-card")).toHaveClass(/hero-card--sinfoto/);
  await expect(page.locator(".hero-card__icono svg")).toBeVisible();
  await expect(page.locator("#projectImg")).toBeHidden();
});

test("celular: el selector de proyecto usa letra más chica para que quepa más del nombre", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(`/cartera-cpel/?proyecto=${slugify(datos().cartera[0].nombre)}`);
  await listo(page);
  expect(await page.locator("#projectSelect").evaluate((el) => getComputedStyle(el).fontSize)).toBe("12.5px");
});

test("pantalla previa: tarjetas con nombre y tecnología, mapa del país, abrir la ficha y regresar", async ({ page }) => {
  const { cartera } = datos();
  await page.goto("/cartera-cpel/");
  const tarjetas = page.locator("#vistaGrid .vcard");
  await expect(tarjetas).toHaveCount(cartera.length);
  await expect(tarjetas.first().locator(".vcard__nombre")).toHaveText(cartera[0].nombre.trim());
  await expect(tarjetas.first().locator(".vcard__tec")).toHaveText(cartera[0].tecnologia.trim());
  await expect(page.locator("#pdfRoot")).toBeHidden();
  await expect(page.locator(".actionbar")).toBeHidden();
  // mapa de todo el país con un punto por proyecto con ubicación
  await expect(page.locator("#vistaMapa .leaflet-interactive").first()).toBeVisible();
  await expect(page.locator("#vistaLeyenda span").first()).toBeVisible();
  // abrir desde una tarjeta
  await tarjetas.nth(2).click();
  await expect(page.locator("#projectName")).toHaveText(cartera[2].nombre.trim());
  await expect(page).toHaveURL(new RegExp(`proyecto=${slugify(cartera[2].nombre)}`));
  await expect(page.locator("#vista")).toBeHidden();
  // la flecha de la barra regresa a la pantalla previa
  await page.click("#backLink");
  await expect(tarjetas.first()).toBeVisible();
  await expect(page).not.toHaveURL(/proyecto=/);
  // y el "atrás" del navegador también
  await tarjetas.nth(1).click();
  await expect(page.locator("#projectName")).toHaveText(cartera[1].nombre.trim());
  await page.goBack();
  await expect(tarjetas.first()).toBeVisible();
  // desde el mapa: un punto abre su ventana con "Ver proyecto"
  await page.locator("#vistaMapa .leaflet-interactive").last().click(); // el de arriba puede quedar bajo el aviso de mosaicos
  await page.locator(".leaflet-popup [data-ver-proyecto]").click();
  await expect(page.locator("#vista")).toBeHidden();
  await listo(page);
});
