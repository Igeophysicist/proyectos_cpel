/**
 * functions/_middleware.js — Contraseña única para todo el sitio
 * (Cloudflare Pages Functions).
 *
 * Cloudflare ejecuta este archivo ANTES de entregar cualquier archivo
 * del sitio: páginas, JS, CSS, imágenes y también los Excel/KML de
 * data/. Sin una sesión válida, solo se ve la pantalla de contraseña.
 *
 * CONFIGURACIÓN (panel de Cloudflare → el proyecto de Pages →
 * Settings → Variables and Secrets):
 *   SITE_PASSWORD  (tipo "Secret") — la contraseña que se comparte.
 * La contraseña NUNCA va en este archivo ni en el repositorio.
 *
 * SESIÓN: al entrar se guarda una cookie firmada que dura
 * SESSION_DAYS días y se renueva sola con el uso. La firma depende de
 * la contraseña, así que CAMBIAR SITE_PASSWORD CIERRA LA SESIÓN DE
 * TODOS (útil si la contraseña se filtró o alguien dejó el equipo).
 *
 * Rutas propias:
 *   POST /__login   valida la contraseña y crea la sesión
 *   GET  /__logout  cierra la sesión
 *
 * En GitHub Pages este archivo no hace nada (solo funciona en
 * Cloudflare Pages).
 */

const COOKIE_NAME = "cpel_session";
// Cookie visible para JavaScript (sin datos sensibles): solo indica que
// hay sesión, para que el portal muestre el botón "Salir".
const FLAG_COOKIE_NAME = "cpel_auth";
const SESSION_DAYS = 30;
// Si a la sesión le quedan menos días que esto, se renueva en la
// siguiente visita (quien usa el sitio seguido casi nunca vuelve a
// escribir la contraseña).
const RENEW_WHEN_DAYS_LEFT = 15;
// Espera tras una contraseña incorrecta: frena a quien intente adivinar.
const FAILED_LOGIN_DELAY_MS = 1500;

const DAY_S = 24 * 60 * 60;

// Archivos visibles sin sesión (solo los que usa la pantalla de acceso).
const PUBLIC_PATHS = new Set([
  "/assets/img/apple-touch-icon.png",
  "/assets/img/logo-cpel.png",
]);

const encoder = new TextEncoder();

// ----------------------------------------------------------- firma

async function hmacKey(password) {
  // La llave de firma se deriva de la contraseña: si cambia la
  // contraseña, todas las sesiones anteriores dejan de ser válidas.
  const raw = await crypto.subtle.digest("SHA-256", encoder.encode("cpel-session-v1:" + password));
  return crypto.subtle.importKey("raw", raw, { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
}

async function sign(key, text) {
  const mac = await crypto.subtle.sign("HMAC", key, encoder.encode(text));
  return base64url(new Uint8Array(mac));
}

function base64url(bytes) {
  let s = "";
  bytes.forEach((b) => (s += String.fromCharCode(b)));
  return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

/** Comparación en tiempo constante (no revela cuántos caracteres coinciden). */
async function safeEqual(a, b) {
  const key = await crypto.subtle.importKey(
    "raw",
    crypto.getRandomValues(new Uint8Array(32)),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const [ma, mb] = await Promise.all([
    crypto.subtle.sign("HMAC", key, encoder.encode(a)),
    crypto.subtle.sign("HMAC", key, encoder.encode(b)),
  ]);
  const x = new Uint8Array(ma);
  const y = new Uint8Array(mb);
  let diff = 0;
  for (let i = 0; i < x.length; i++) diff |= x[i] ^ y[i];
  return diff === 0;
}

// --------------------------------------------------------- sesión

async function createSessionValue(key, nowS) {
  const exp = nowS + SESSION_DAYS * DAY_S;
  return `${exp}.${await sign(key, "v1." + exp)}`;
}

/** Devuelve la fecha de expiración (segundos) si la cookie es válida; si no, null. */
async function readSession(key, value, nowS) {
  const m = /^(\d{1,12})\.([A-Za-z0-9_-]+)$/.exec(value || "");
  if (!m) return null;
  const exp = Number(m[1]);
  if (exp <= nowS) return null;
  const expected = await sign(key, "v1." + exp);
  return (await safeEqual(expected, m[2])) ? exp : null;
}

function getCookie(request, name) {
  const header = request.headers.get("Cookie") || "";
  for (const part of header.split(";")) {
    const i = part.indexOf("=");
    if (i !== -1 && part.slice(0, i).trim() === name) return part.slice(i + 1).trim();
  }
  return null;
}

/** Set-Cookie de la sesión (HttpOnly) y de la marca para el botón "Salir". */
function sessionCookies(value, maxAgeS) {
  return [
    `${COOKIE_NAME}=${value}; Path=/; Max-Age=${maxAgeS}; HttpOnly; Secure; SameSite=Lax`,
    `${FLAG_COOKIE_NAME}=${maxAgeS > 0 ? 1 : ""}; Path=/; Max-Age=${maxAgeS}; Secure; SameSite=Lax`,
  ];
}

/** Solo rutas internas ("/algo"); evita redirigir a otro sitio. */
function safeNext(next) {
  return typeof next === "string" && next.startsWith("/") && !next.startsWith("//") && !next.startsWith("/\\")
    ? next
    : "/";
}

// ------------------------------------------------------ respuestas

function esc(s) {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function loginPage({ next = "/", error = "" } = {}, status = 401) {
  const html = `<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover">
<meta name="robots" content="noindex, nofollow">
<meta name="theme-color" content="#234240">
<title>CPEL — Acceso</title>
<link rel="icon" href="/assets/img/apple-touch-icon.png">
<style>
  *{box-sizing:border-box}
  body{margin:0; min-height:100vh; display:flex; align-items:center; justify-content:center; padding:16px;
    background:#F3F3F3; color:#1a2422; font-family:-apple-system,"Inter","Segoe UI",Roboto,Helvetica,Arial,sans-serif;}
  .card{width:100%; max-width:360px; background:#fff; border:1px solid #dfe3e1; border-radius:16px;
    box-shadow:0 1px 2px rgba(26,36,34,.06),0 4px 16px rgba(26,36,34,.06); overflow:hidden;}
  .head{background:#234240; padding:20px; display:flex; align-items:center; gap:12px;}
  .head img{height:28px; width:auto;}
  .body{padding:20px;}
  h1{margin:0 0 4px; font-size:18px; color:#1b332f;}
  p{margin:0 0 16px; font-size:13.5px; color:#6b7572;}
  label{display:block; font-size:12.5px; font-weight:700; color:#3d4a47; margin-bottom:6px;}
  input{width:100%; font:inherit; font-size:16px; padding:11px 12px; border:1px solid #c7cdca; border-radius:10px;}
  input:focus{outline:2px solid #b6893a; outline-offset:1px; border-color:#b6893a;}
  button{margin-top:14px; width:100%; font:inherit; font-size:15px; font-weight:700; color:#fff; background:#234240;
    border:0; border-radius:10px; padding:12px; cursor:pointer;}
  button:hover{background:#2e534f;}
  .error{margin:0 0 14px; padding:10px 12px; border-radius:10px; background:#fbe9e9; color:#b83b3b; font-size:13px; font-weight:600;}
</style>
</head>
<body>
  <main class="card">
    <div class="head"><img src="/assets/img/logo-cpel.png" alt="CPEL"></div>
    <form class="body" method="post" action="/__login">
      <h1>Portal de Seguimiento</h1>
      <p>Ingresa la contraseña para continuar.</p>
      ${error ? `<div class="error" role="alert">${esc(error)}</div>` : ""}
      <label for="password">Contraseña</label>
      <input id="password" name="password" type="password" autocomplete="current-password" required autofocus>
      <input type="hidden" name="next" value="${esc(next)}">
      <button type="submit">Entrar</button>
    </form>
  </main>
</body>
</html>`;
  return new Response(html, {
    status,
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Cache-Control": "no-store",
      "X-Robots-Tag": "noindex, nofollow",
    },
  });
}

function redirect(location, cookies = []) {
  const headers = new Headers({ Location: location, "Cache-Control": "no-store" });
  cookies.forEach((c) => headers.append("Set-Cookie", c));
  return new Response(null, { status: 303, headers });
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// ------------------------------------------------------- principal

export async function onRequest(context) {
  const { request, env } = context;
  const url = new URL(request.url);
  const nowS = Math.floor(Date.now() / 1000);

  // Sin contraseña configurada el sitio queda CERRADO (nunca abierto
  // por un descuido de configuración).
  const password = env.SITE_PASSWORD;
  if (!password) {
    return new Response("Falta configurar SITE_PASSWORD en Cloudflare Pages (Settings → Variables and Secrets).", {
      status: 503,
      headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "no-store" },
    });
  }
  const key = await hmacKey(password);

  if (url.pathname === "/__logout") {
    return redirect("/", sessionCookies("", 0));
  }

  if (url.pathname === "/__login") {
    if (request.method !== "POST") return redirect("/");
    const form = await request.formData();
    const next = safeNext(form.get("next"));
    if (await safeEqual(String(form.get("password") || ""), password)) {
      return redirect(next, sessionCookies(await createSessionValue(key, nowS), SESSION_DAYS * DAY_S));
    }
    await sleep(FAILED_LOGIN_DELAY_MS);
    return loginPage({ next, error: "Contraseña incorrecta." });
  }

  if (PUBLIC_PATHS.has(url.pathname)) return context.next();

  const exp = await readSession(key, getCookie(request, COOKIE_NAME), nowS);
  if (exp === null) {
    // Navegación del navegador: pantalla de contraseña. Peticiones de
    // datos (fetch del Excel/KML, scripts): 401 sin contenido.
    const accept = request.headers.get("Accept") || "";
    if (request.method === "GET" && accept.includes("text/html")) {
      return loginPage({ next: url.pathname + url.search });
    }
    return new Response("Sesión no válida o vencida. Recarga la página.", {
      status: 401,
      headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "no-store" },
    });
  }

  const response = await context.next();
  // Contenido protegido: que ningún caché compartido (proxy de la red,
  // etc.) guarde una copia que otra persona pueda recibir.
  const out = new Response(response.body, response);
  out.headers.set("Cache-Control", "private, no-cache");
  if (exp - nowS < RENEW_WHEN_DAYS_LEFT * DAY_S) {
    const cookies = sessionCookies(await createSessionValue(key, nowS), SESSION_DAYS * DAY_S);
    cookies.forEach((c) => out.headers.append("Set-Cookie", c));
  }
  return out;
}
