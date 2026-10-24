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

test("Evolución: ya no está en la tarjeta; desde la ficha abre su panel encima", async ({ page }) => {
  const p = proyectoConEvolucion();
  await page.goto("/cartera-mixtos/");
  await cargado(page);
  await expect(page.locator("#project-list .evo-btn")).toHaveCount(0);
  const tarjeta = page.locator("#project-list .pcard", { hasText: p.nombre }).first();
  await tarjeta.click();
  await expect(page.locator("#detail")).toHaveClass(/is-open/);
  await page.click("#detail [data-open-evolucion]");
  await expect(page.locator("#evolucion")).toHaveClass(/is-open/);
  await expect(page.locator("#evolucion .detail__sub")).toHaveText(p.nombre);
  await expect.poll(() => page.evaluate(() => !!Chart.getChart(document.querySelector("#evolucion canvas")))).toBe(true);
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
  // Al entrar: avance Global de mayor a menor (sin "orden" en el enlace).
  await page.goto("/cartera-mixtos/");
  await cargado(page);
  await expect(page.locator("#sort-select")).toHaveValue("global");
  await expect(page.locator("#project-list .pcard__title").first()).toHaveText(mayor.nombre);
  await expect(page).not.toHaveURL(/orden=/);
  await page.selectOption("#sort-select", "global_asc");
  await expect(page.locator("#project-list .pcard__title").first()).toHaveText(menor.nombre);
  await expect(page).toHaveURL(/orden=global_asc/);
  await page.reload();
  await cargado(page);
  await expect(page.locator("#sort-select")).toHaveValue("global_asc");
  await expect(page.locator("#project-list .pcard__title").first()).toHaveText(menor.nombre);
  await page.selectOption("#sort-select", "excel"); // "Default": orden del Excel
  await expect(page.locator("#project-list .pcard__title").first()).toHaveText(mixtos[0].nombre);
  await expect(page).toHaveURL(/orden=excel/);
  await page.selectOption("#sort-select", "global");
  await expect(page).not.toHaveURL(/orden=/);
});

test("el grupo de cada tarjeta sale del avance de Parque (A ≥ 85, B ≥ 76, C < 76)", async ({ page }) => {
  const { mixtos } = datos();
  const grupo = (parque) => {
    const n = parseFloat(String(parque).replace("%", ""));
    if (!Number.isFinite(n)) return null;
    return n >= 85 ? "A" : n >= 76 ? "B" : "C";
  };
  await page.goto("/cartera-mixtos/?orden=excel"); // tarjetas en el orden del Excel
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
  await expect(kpi("Avance global promedio")).toHaveText(`${promedio.toFixed(2)}%`);
  const capex = cuentan.reduce((s, r) => s + (parseNumber(r.CAPEX) || 0), 0);
  const capexKpi = page.locator(".kpi", { hasText: "CAPEX total (USD)" });
  await expect(capexKpi.locator(".kpi__value")).toHaveText(
    `${new Intl.NumberFormat("es-MX", { minimumFractionDigits: 1, maximumFractionDigits: 1 }).format(capex / 1e6)} M`
  );
  await expect(capexKpi).toContainText("sin 2da ronda");
});

test("Prioritarios (columna PRIORI): el ranking solo los lista, por avance de Parque, y sus tarjetas se distinguen", async ({ page }) => {
  const { mixtos } = datos();
  const prio = mixtos.filter((r) => String(r.PRIORI).trim().toUpperCase() === "P");
  expect(prio.length).toBeGreaterThan(0);
  const orden = prio
    .map((r) => ({ nombre: r.nombre, parque: parseFloat(String(r.Parque).replace("%", "")) }))
    .filter((r) => Number.isFinite(r.parque))
    .sort((a, b) => b.parque - a.parque);
  await page.goto("/cartera-mixtos/?orden=excel"); // tarjetas en el orden del Excel
  await cargado(page);
  await expect(page.locator("#ranking .ranking__name")).toHaveText(orden.map((r) => r.nombre));
  await expect(page.locator("#ranking-hint")).toHaveText(`${orden.length} proyectos`);

  const tarjetas = page.locator("#project-list .pcard");
  for (let i = 0; i < mixtos.length; i++) {
    const esPrio = prio.includes(mixtos[i]);
    await expect(tarjetas.nth(i).locator(".prio-chip"), mixtos[i].nombre).toHaveCount(esPrio ? 1 : 0);
    if (esPrio) await expect(tarjetas.nth(i)).toHaveClass(/pcard--prio/);
  }
});

test("Filtro de prioridad: Prioritario / No prioritario, también desde el enlace", async ({ page }) => {
  const { mixtos } = datos();
  const prio = mixtos.filter((r) => String(r.PRIORI).trim().toUpperCase() === "P").length;
  await page.goto("/cartera-mixtos/");
  await cargado(page);
  await page.click("#filter-btn");
  await page.locator("#filter-options .chip", { hasText: "★ Prioritario" }).click();
  await page.click("#filter-apply");
  await expect(page.locator("#project-list .pcard")).toHaveCount(prio);
  await expect(page.locator("#project-list .pcard:not(.pcard--prio)")).toHaveCount(0);
  await expect(page).toHaveURL(/prioridad=P(&|$)/);

  await page.goto("/cartera-mixtos/?prioridad=NoP");
  await cargado(page);
  await expect(page.locator("#project-list .pcard")).toHaveCount(mixtos.length - prio);
  await expect(page.locator("#project-list .pcard--prio")).toHaveCount(0);
  await expect(page.locator("#ranking .ranking__name")).toHaveCount(0); // ningún prioritario entre los mostrados
});

test("Trámites: el botón de la ficha abre el desglose de los 10 trámites", async ({ page }) => {
  const p = datos().mixtos.find((r) => r.DI_P !== undefined && r.DI_P !== "");
  test.skip(!p, "el Excel no trae desglose de trámites");
  await page.goto(`/cartera-mixtos/?proyecto=${slugify(p.nombre)}`);
  await cargado(page);
  // En la ficha solo está el botón; el desglose se abre en su panel.
  await expect(page.locator("#detail.is-open .tram-row")).toHaveCount(0);
  await page.click("#detail [data-open-tramites]");
  const panel = page.locator("#tramites.is-open");
  await expect(panel.locator("#tramites-title")).toHaveText("Trámites");
  await expect(panel.locator(".tram-row")).toHaveCount(10);
  await expect(panel.locator(".tram-row", { hasText: "MIA – DTU" })).toContainText(String(parseFloat(p.A_MIA_P)));
  await expect(panel.locator(".tram-falta").first()).toContainText("Parque");
  await page.keyboard.press("Escape");
  await expect(panel).toHaveCount(0);
  await expect(page.locator("#detail")).toHaveClass(/is-open/); // la ficha sigue abierta
  await expect(page.locator("#tramites-resumen")).toHaveCount(0); // ya no está en el Resumen
});

test("mientras cargan los datos se ven tarjetas de relleno, no una pantalla completa", async ({ page }) => {
  let soltar;
  const espera = new Promise((r) => (soltar = r));
  await page.route(/DATOS_MIXTOS\.json/, async (route) => {
    await espera;
    await route.continue();
  });
  await page.goto("/cartera-mixtos/");
  await expect(page.locator("#project-list .pcard--esqueleto").first()).toBeVisible();
  await expect(page.locator(".topbar")).toBeVisible(); // la página no queda tapada
  soltar();
  await cargado(page);
  await expect(page.locator("#project-list .pcard--esqueleto")).toHaveCount(0);
  await expect(page.locator("#project-list .pcard").first()).toBeVisible();
});

test("la barra de Parque de cada tarjeta lleva el color de su grupo", async ({ page }) => {
  await page.goto("/cartera-mixtos/");
  await cargado(page);
  const tarjetas = page.locator("#project-list .pcard");
  const n = await tarjetas.count();
  for (let i = 0; i < n; i++) {
    const t = tarjetas.nth(i);
    const grupo = await t.locator(".badge").last().textContent().catch(() => null);
    const letra = grupo && /Grupo ([ABC])/.exec(grupo);
    if (!letra) continue;
    await expect(t.locator(".pbar").first().locator(".pbar__fill")).toHaveClass(new RegExp(`pbar__fill--${letra[1].toLowerCase()}`));
    await expect(t.locator(".pbar").nth(1).locator(".pbar__fill")).not.toHaveClass(/pbar__fill--/);
  }
});
