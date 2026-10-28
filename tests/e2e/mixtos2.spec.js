// Mixtos 2da Ronda: la misma página que Mixtos con sus propios datos
// (cartera-mixtos-2), el mapa vinculado por ID_VUPE, el filtro de Región
// y el estatus de cada trámite.
const { test, expect, datos } = require("./ayuda.js");

const cargado = (page) => expect(page.locator("#loader")).toHaveClass(/is-hidden/, { timeout: 20_000 });

test("el portal aún no muestra el acceso; por su dirección se ven todos sus proyectos, todos en el mapa", async ({ page }) => {
  const { mixtos2 } = datos();
  await page.goto("/");
  await expect(page.locator(".nav-card").first()).toBeVisible();
  // Oculto hasta liberarla (index.html: <template id="accesoMixtos2">).
  await expect(page.locator(".nav-card", { hasText: "Mixtos 2da Ronda" })).toHaveCount(0);
  await page.goto("/cartera-mixtos-2/");
  await cargado(page);
  await expect(page.locator(".topbar__title")).toHaveText("Mixtos 2da Ronda");
  await expect(page.locator("#list-count")).toHaveText(`${mixtos2.length} proyectos`);
  // Cada punto del KML se llama como su ID_VUPE: ningún proyecto queda sin ubicación.
  await expect(page.locator(".geo-flag")).toHaveCount(0);
  // Sin presentación en PDF.
  await expect(page.locator("[data-open-presentacion]")).toHaveCount(0);
});

test("la ficha muestra el nombre del Excel, la región y el ID VUPE", async ({ page }) => {
  const [p] = datos().mixtos2;
  await page.goto("/cartera-mixtos-2/");
  await cargado(page);
  await page.locator("#project-list .pcard", { hasText: p.nombre }).first().locator(".pcard__open").click();
  await expect(page.locator("#detail-title")).toHaveText(p.nombre);
  await expect(page.locator("#detail-body")).toContainText(p.Región);
  await expect(page.locator("#detail-body")).toContainText(p.ID_VUPE);
  // Almacenamiento: los cuatro datos por separado, como en el Excel.
  for (const etiqueta of ["Porcentaje BESS", "Almacenamiento BESS", "Horas de almacenamiento", "Energía por horas"]) {
    await expect(page.locator("#detail-body .detail-field__label", { hasText: new RegExp(`^${etiqueta}$`) })).toHaveCount(1);
  }
});

test("sin proyectos prioritarios no se muestra el ranking (en Mixtos sí)", async ({ page }) => {
  test.skip(datos().mixtos2.some((p) => /^P$/i.test(p.PRIORI)), "ya hay prioritarios en el Excel");
  await page.goto("/cartera-mixtos-2/?tab=resumen");
  await cargado(page);
  await expect(page.locator("#group-resumen .section", { has: page.locator("#ranking") })).toBeHidden();
  await page.goto("/cartera-mixtos/?tab=resumen");
  await cargado(page);
  await expect(page.locator("#group-resumen .section", { has: page.locator("#ranking") })).toBeVisible();
});

test("filtro de Región: solo quedan los proyectos de esa región y queda en el enlace", async ({ page }) => {
  const { mixtos2 } = datos();
  const region = mixtos2[0].Región;
  const cuantos = mixtos2.filter((p) => p.Región === region).length;
  await page.goto("/cartera-mixtos-2/");
  await cargado(page);
  await page.click("#filter-btn");
  await page.locator(".filter-group", { hasText: "Región" }).locator(".chip", { hasText: region }).click();
  await page.click("#filter-apply");
  await expect(page.locator("#list-count")).toHaveText(`${cuantos} proyecto${cuantos === 1 ? "" : "s"}`);
  expect(new URL(page.url()).searchParams.get("region")).toBe(region);
});

test("Trámites muestra el estatus de cada lado con el color de REGLAS; en Mixtos no hay estatus", async ({ page }) => {
  const [p] = datos().mixtos2;
  await page.goto("/cartera-mixtos-2/");
  await cargado(page);
  await page.locator("#project-list .pcard", { hasText: p.nombre }).first().locator(".pcard__open").click();
  await page.locator("[data-open-tramites]").click();
  await expect(page.locator("#tramites")).toHaveClass(/is-open/);
  // 10 trámites: 8 con Parque y LT, Interconexión y Consulta con uno solo.
  await expect(page.locator("#tramites .tram-est")).toHaveCount(18);
  const mia = page.locator("#tramites .tram-card", { hasText: "MIA" }).locator(".tram-est").first();
  await expect(mia).toHaveText(p.A_MIA_P_ESTATUS);

  await page.goto("/cartera-mixtos/");
  await cargado(page);
  await page.locator("#project-list .pcard__open").first().click();
  await page.locator("[data-open-tramites]").click();
  await expect(page.locator("#tramites")).toHaveClass(/is-open/);
  await expect(page.locator("#tramites .tram-est")).toHaveCount(0);
});
