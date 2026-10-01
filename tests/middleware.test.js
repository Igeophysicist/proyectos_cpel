// Pruebas de functions/_middleware.js (contraseña única en Cloudflare
// Pages). Node 22 trae las mismas APIs web que el runtime de Cloudflare
// (Request, Response, crypto.subtle), así que se prueba sin emularlo.
const test = require("node:test");
const assert = require("node:assert/strict");

const PASSWORD = "frase de prueba larga";
const BASE = "https://cpel.pages.dev";

let onRequest;
test.before(async () => {
  ({ onRequest } = await import("../functions/_middleware.js"));
});

/** Ejecuta el middleware; "next" simula el archivo estático solicitado. */
async function run(path, { method = "GET", accept = "text/html", cookie, body, env } = {}) {
  const headers = { Accept: accept };
  if (cookie) headers.Cookie = cookie;
  if (body) headers["Content-Type"] = "application/x-www-form-urlencoded";
  let served = false;
  const response = await onRequest({
    request: new Request(BASE + path, { method, headers, body }),
    env: env || { SITE_PASSWORD: PASSWORD },
    next: async () => {
      served = true;
      return new Response("contenido protegido", { headers: { "Cache-Control": "public, max-age=600" } });
    },
  });
  return { response, served };
}

async function login(next = "/") {
  const body = new URLSearchParams({ password: PASSWORD, next }).toString();
  const { response } = await run("/__login", { method: "POST", body });
  const cookies = response.headers.getSetCookie();
  const session = cookies.find((c) => c.startsWith("cpel_session=")).split(";")[0];
  return { response, cookies, session };
}

test("sin SITE_PASSWORD el sitio queda cerrado", async () => {
  const { response, served } = await run("/", { env: {} });
  assert.equal(response.status, 503);
  assert.equal(served, false);
});

test("sin sesión: páginas muestran el formulario y los datos no se entregan", async () => {
  const page = await run("/cartera-mixtos/index.html?x=1");
  assert.equal(page.response.status, 401);
  assert.equal(page.served, false);
  const html = await page.response.text();
  assert.match(html, /<form[^>]+action="\/__login"/);
  assert.match(html, /name="next" value="\/cartera-mixtos\/index.html\?x=1"/);

  const data = await run("/cartera-mixtos/data/DATOS_MIXTOS.xlsx", { accept: "*/*" });
  assert.equal(data.response.status, 401);
  assert.equal(data.served, false);
});

test("los recursos de la pantalla de acceso son públicos", async () => {
  const { served } = await run("/assets/img/logo-cpel.png", { accept: "image/*" });
  assert.equal(served, true);
});

test("contraseña correcta: crea la sesión y redirige", async () => {
  const { response, cookies } = await login("/cartera-cpel/index.html");
  assert.equal(response.status, 303);
  assert.equal(response.headers.get("Location"), "/cartera-cpel/index.html");
  const session = cookies.find((c) => c.startsWith("cpel_session="));
  assert.match(session, /HttpOnly/);
  assert.match(session, /Secure/);
  assert.match(session, /Max-Age=2592000/);
  assert.ok(cookies.some((c) => c.startsWith("cpel_auth=1")));
});

test("con sesión se entrega el contenido sin caché compartido", async () => {
  const { session } = await login();
  const { response, served } = await run("/cartera-mixtos/data/DATOS_MIXTOS.xlsx", { accept: "*/*", cookie: session });
  assert.equal(served, true);
  assert.equal(response.status, 200);
  assert.equal(response.headers.get("Cache-Control"), "private, no-cache");
  assert.equal(response.headers.getSetCookie().length, 0, "sesión nueva: no hace falta renovarla");
});

test("contraseña incorrecta: vuelve a pedirla, sin sesión", async () => {
  const body = new URLSearchParams({ password: "otra", next: "/" }).toString();
  const started = Date.now();
  const { response } = await run("/__login", { method: "POST", body });
  assert.equal(response.status, 401);
  assert.ok(Date.now() - started >= 1400, "espera tras el intento fallido");
  assert.match(await response.text(), /Contraseña incorrecta/);
  assert.equal(response.headers.getSetCookie().length, 0);
});

test("no redirige a otros sitios", async () => {
  for (const next of ["//evil.example", "https://evil.example", "/\\evil.example"]) {
    const { response } = await login(next);
    assert.equal(response.headers.get("Location"), "/", next);
  }
});

test("cookie alterada o firmada con otra contraseña no sirve", async () => {
  const { session } = await login();
  const [exp, sig] = session.split("=")[1].split(".");
  const tampered = `cpel_session=${Number(exp) + 999999}.${sig}`;
  assert.equal((await run("/", { cookie: tampered })).served, false);
  // Cambiar la contraseña cierra todas las sesiones.
  const otherEnv = { SITE_PASSWORD: "contraseña nueva" };
  assert.equal((await run("/", { cookie: session, env: otherEnv })).served, false);
});

test("sesión vencida no sirve y una próxima a vencer se renueva", async (t) => {
  const { session } = await login();
  const realNow = Date.now;
  t.after(() => (Date.now = realNow));

  Date.now = () => realNow() + 20 * 24 * 3600 * 1000; // faltan 10 días
  const renewed = await run("/", { cookie: session });
  assert.equal(renewed.served, true);
  assert.ok(renewed.response.headers.getSetCookie().some((c) => c.startsWith("cpel_session=")));

  Date.now = () => realNow() + 31 * 24 * 3600 * 1000; // vencida
  assert.equal((await run("/", { cookie: session })).served, false);
});

test("salir borra la sesión", async () => {
  const { response } = await run("/__logout");
  assert.equal(response.status, 303);
  const cookies = response.headers.getSetCookie();
  assert.ok(cookies.some((c) => /^cpel_session=;.*Max-Age=0/.test(c)));
  assert.ok(cookies.some((c) => /^cpel_auth=;.*Max-Age=0/.test(c)));
});
