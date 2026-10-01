/**
 * sw.js — Service Worker del portal CPEL (modo app instalable).
 *
 * OBJETIVO: que el sitio se pueda instalar como app y abra aunque no
 * haya conexión, pero SIEMPRE mostrando la versión más reciente cuando
 * sí la hay.
 *
 * Estrategia por tipo de archivo:
 *   - Páginas, CSS, JS e imágenes del sitio: RED PRIMERO. Siempre se
 *     pide la versión actual al servidor; la copia guardada solo se usa
 *     si no hay conexión. Nunca se muestra una versión vieja estando en
 *     línea.
 *   - Librerías de CDN (Leaflet, Chart.js, SheetJS): CACHÉ PRIMERO. Sus
 *     URLs llevan la versión (p. ej. leaflet@1.9.4), así que el archivo
 *     de esa URL nunca cambia; para actualizar una librería se cambia
 *     la URL en el HTML.
 *   - Datos (todo lo que esté en una carpeta /data/: Excel, KML, JSON):
 *     NUNCA se guardan; siempre van directo a la red.
 *   - Imágenes de los mapas (Esri, OpenStreetMap) y pantalla de
 *     contraseña (/__login, /__logout): no se tocan.
 *   - Respuestas de error, de "sin sesión" (401) o redirecciones nunca
 *     se guardan, así que el caché no puede saltarse la contraseña.
 *
 * No hace falta cambiar VERSION en cada publicación (la red manda).
 * Solo cámbiala si cambias la lógica de este archivo y quieres borrar
 * lo guardado por la versión anterior.
 */
const VERSION = "cpel-v2";
const SITE_CACHE = `${VERSION}-sitio`;
const CDN_CACHE = `${VERSION}-cdn`;
const CDN_HOSTS = ["unpkg.com", "cdn.jsdelivr.net"];

self.addEventListener("install", () => {
  // Activa la versión nueva de inmediato, sin esperar a que se cierren
  // todas las pestañas.
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const names = await caches.keys();
      await Promise.all(names.filter((n) => !n.startsWith(VERSION + "-")).map((n) => caches.delete(n)));
      await self.clients.claim();
    })()
  );
});

function isCacheable(response) {
  return response && response.ok && !response.redirected && (response.type === "basic" || response.type === "cors");
}

function offlinePage() {
  const html = `<!DOCTYPE html><html lang="es"><head><meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0"><title>Sin conexión</title>
<style>body{margin:0;min-height:100vh;display:flex;align-items:center;justify-content:center;padding:16px;
background:#F3F3F3;color:#1a2422;font-family:-apple-system,"Segoe UI",Roboto,Helvetica,Arial,sans-serif;text-align:center}
h1{font-size:18px;color:#1b332f;margin:0 0 6px}p{font-size:14px;color:#6b7572;margin:0}</style></head>
<body><div><h1>Sin conexión</h1><p>Esta página aún no se había abierto en este dispositivo.<br>Conéctate a internet e inténtalo de nuevo.</p></div></body></html>`;
  return new Response(html, { status: 503, headers: { "Content-Type": "text/html; charset=utf-8" } });
}

/** Red primero; si no hay conexión, la última copia guardada. */
async function networkFirst(event) {
  const { request } = event;
  const isNavigation = request.mode === "navigate";
  try {
    // Navegaciones: tal cual (el navegador maneja las redirecciones).
    // Resto: "no-cache" obliga a confirmar con el servidor que el
    // archivo no cambió, aunque el navegador tenga una copia reciente.
    const response = isNavigation ? await fetch(request) : await fetch(request, { cache: "no-cache" });
    if (isCacheable(response)) {
      const copy = response.clone();
      event.waitUntil(caches.open(SITE_CACHE).then((cache) => cache.put(request, copy)));
    }
    return response;
  } catch {
    // Sin conexión: última copia guardada.
    const cached = await findCached(request);
    if (cached) return cached;
    return isNavigation ? offlinePage() : Response.error();
  }
}

/**
 * Busca la copia guardada. Cloudflare Pages redirige ".../index.html"
 * a ".../", así que se prueban ambas formas de la dirección.
 */
async function findCached(request) {
  const cache = await caches.open(SITE_CACHE);
  const hit = await cache.match(request);
  if (hit) return hit;
  const url = new URL(request.url);
  if (url.pathname.endsWith("/index.html")) url.pathname = url.pathname.slice(0, -"index.html".length);
  else if (url.pathname.endsWith("/")) url.pathname += "index.html";
  else return undefined;
  return cache.match(url.href);
}

/** Caché primero para librerías versionadas de CDN. */
async function cacheFirst(event) {
  const { request } = event;
  const cached = await caches.match(request, { cacheName: CDN_CACHE });
  if (cached) return cached;
  const response = await fetch(request);
  if (isCacheable(response)) {
    const copy = response.clone();
    event.waitUntil(caches.open(CDN_CACHE).then((cache) => cache.put(request, copy)));
  }
  return response;
}

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;
  const url = new URL(request.url);

  if (url.origin === self.location.origin) {
    if (url.pathname.includes("/data/") || /\/__(login|logout)$/.test(url.pathname)) return;
    event.respondWith(networkFirst(event));
    return;
  }
  if (CDN_HOSTS.includes(url.hostname)) {
    event.respondWith(cacheFirst(event));
  }
  // Cualquier otro origen (imágenes de mapas, etc.): sin intervenir.
});
