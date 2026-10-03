#!/usr/bin/env node
/**
 * servidor.js — levanta el sitio para las pruebas en el navegador con el
 * mismo motor que Cloudflare Pages (wrangler pages dev), incluida la
 * contraseña de functions/_middleware.js.
 *
 * Copia solo los archivos del sitio a una carpeta temporal (sin
 * node_modules, que hace muy lento a wrangler) y la sirve en el puerto
 * PORT con una contraseña DE PRUEBA (nunca la real, que vive solo en
 * Cloudflare). Lo usa playwright.config.js (webServer).
 */
const fs = require("fs");
const os = require("os");
const path = require("path");
const { spawn } = require("child_process");

const ROOT = path.resolve(__dirname, "../..");
const SITIO = ["index.html", "manifest.json", "sw.js", "assets", "data", "functions", "cartera-cpel", "cartera-mixtos"];
const PORT = process.env.PORT || "8788";
const PASSWORD = process.env.E2E_PASSWORD || "contraseña de prueba e2e";

const destino = fs.mkdtempSync(path.join(os.tmpdir(), "cpel-e2e-"));
SITIO.forEach((f) => fs.cpSync(path.join(ROOT, f), path.join(destino, f), { recursive: true }));

const wrangler = spawn(
  process.execPath,
  [
    path.join(ROOT, "node_modules", "wrangler", "bin", "wrangler.js"),
    "pages",
    "dev",
    destino,
    "--port",
    PORT,
    "--ip",
    "127.0.0.1",
    "--compatibility-date",
    "2026-09-30",
    "--binding",
    `SITE_PASSWORD=${PASSWORD}`,
  ],
  // cwd en la carpeta temporal: wrangler deja ahí su carpeta .wrangler, no en el repo.
  { cwd: destino, stdio: "inherit", env: { ...process.env, WRANGLER_SEND_METRICS: "false" } }
);

const salir = () => {
  wrangler.kill();
  fs.rmSync(destino, { recursive: true, force: true });
};
process.on("SIGINT", salir);
process.on("SIGTERM", salir);
wrangler.on("exit", (code) => {
  fs.rmSync(destino, { recursive: true, force: true });
  process.exit(code ?? 0);
});
