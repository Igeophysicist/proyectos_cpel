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

test("Ordenar por (y su contrario) cambia el orden de las tarjetas y queda en el enlace", async ({ page }) => {
  const { mixtos } = datos();
  const pct = (v) => parseFloat(String(v).replace("%", ""));
  const conGlobal = mixtos.filter((r) => Number.isFinite(pct(r.Global)));
  const mayor = conGlobal.reduce((a, b) => (pct(b.Global) > pct(a.Global) ? b : a));
  const menor = conGlobal.reduce((a, b) => (pct(b.Global) < pct(a.Global) ? b : a));
  await page.goto("/cartera-mixtos/");
  await cargado(page);
  await expect(page.locator("#sort-select option:checked")).toHaveText("Default");
  await page.selectOption("#sort-select", "global");
  await expect(page.locator("#project-list .pcard__title").first()).toHaveText(mayor.nombre);
  await expect(page).toHaveURL(/orden=global/);
  await page.reload();
  await cargado(page);
  await expect(page.locator("#sort-select")).toHaveValue("global");
  await expect(page.locator("#project-list .pcard__title").first()).toHaveText(mayor.nombre);
  await page.selectOption("#sort-select", "global_asc");
  await expect(page.locator("#project-list .pcard__title").first()).toHaveText(menor.nombre);
  await expect(page).toHaveURL(/orden=global_asc/);
  await page.selectOption("#sort-select", "excel");
  await expect(page.locator("#project-list .pcard__title").first()).toHaveText(mixtos[0].nombre);
  await expect(page).not.toHaveURL(/orden=/);
});

test("el grupo de cada tarjeta sale del avance de Parque (A ≥ 85, B ≥ 76, C < 76)", async ({ page }) => {
  const { mixtos } = datos();
  const grupo = (parque) => {
    const n = parseFloat(String(parque).replace("%", ""));
    if (!Number.isFinite(n)) return null;
    return n >= 85 ? "A" : n >= 76 ? "B" : "C";
  };
  await page.goto("/cartera-mixtos/");
  await cargado(page);
  const tarjetas = page.locator("#project-list .pcard");
  for (let i = 0; i < mixtos.length; i++) {
    const esperado = grupo(mixtos[i].Parque);
    const etiqueta = tarjetas.nth(i).locator(".badge");
    if (esperado) await expect(etiqueta, mixtos[i].nombre).toHaveText(`Grupo ${esperado}`);
    else await expect(etiqueta, mixtos[i].nombre).toHaveCount(0);
  }
});

test("Resumen: capacidad, CAPEX y avance promedio no cuentan los proyectos de 2da ronda", async ({ page }) => {
  const { parseNumber } = require("../../assets/js/shared/text-utils.js");
  const cuentan = datos().mixtos.filter((r) => !/\(2DA RONDA\)/i.test(r.nombre));
  const capacidad = cuentan.reduce((s, r) => s + (parseNumber(r.Capacidad) || 0), 0);
  const globales = cuentan.map((r) => parseNumber(r.Global)).filter((v) => v !== null);
  const promedio = globales.reduce((a, b) => a + b, 0) / globales.length;
  await page.goto("/cartera-mixtos/");
  await cargado(page);
  const kpi = (etiqueta) => page.locator(".kpi", { hasText: etiqueta }).locator(".kpi__value");
  await expect(kpi("Capacidad total")).toHaveText(`${new Intl.NumberFormat("es-MX", { maximumFractionDigits: 0 }).format(capacidad)} MW`);
  await expect(kpi("Avance global promedio")).toHaveText(`${promedio.toFixed(1)}%`);
  await expect(page.locator(".kpi", { hasText: "CAPEX total" })).toContainText("sin 2da ronda");
});
