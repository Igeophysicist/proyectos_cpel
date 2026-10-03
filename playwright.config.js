// Pruebas en el navegador (tests/e2e). Corren con:  npm run test:e2e
// En GitHub corren solas en cada PR y en cada push a main (.github/workflows/navegador.yml).
const { defineConfig, devices } = require("@playwright/test");
const { SESION } = require("./tests/e2e/ayuda.js");

const PORT = process.env.PORT || "8788";

module.exports = defineConfig({
  testDir: "tests/e2e",
  testMatch: /.*\.(spec|setup)\.js$/,
  timeout: 45_000,
  expect: { timeout: 10_000 },
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: 0,
  workers: process.env.CI ? 2 : undefined,
  reporter: process.env.CI ? [["list"], ["html", { open: "never" }]] : "list",
  use: {
    baseURL: `http://127.0.0.1:${PORT}/`,
    timezoneId: "America/Mexico_City",
    locale: "es-MX",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  projects: [
    { name: "sesion", testMatch: /sesion\.setup\.js/ },
    { name: "celular", testMatch: /.*\.spec\.js$/, dependencies: ["sesion"], use: { ...devices["Pixel 7"], storageState: SESION } },
    {
      name: "computadora",
      testMatch: /.*\.spec\.js$/,
      dependencies: ["sesion"],
      use: { ...devices["Desktop Chrome"], viewport: { width: 1280, height: 860 }, storageState: SESION },
    },
  ],
  webServer: {
    command: "node tests/e2e/servidor.js",
    url: `http://127.0.0.1:${PORT}/__login`,
    reuseExistingServer: !process.env.CI,
    timeout: 90_000,
    env: { PORT },
  },
});
