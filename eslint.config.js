// Configuración de ESLint para los scripts del sitio (JavaScript plano que
// corre en el navegador, sin build step) y para las pruebas de Node.
const js = require("@eslint/js");
const globals = require("globals");

module.exports = [
  { ignores: ["node_modules/", ".wrangler/", "test-results/", "playwright-report/"] },
  js.configs.recommended,
  {
    files: ["**/assets/js/**/*.js"],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: "script",
      globals: {
        ...globals.browser,
        L: "readonly", // Leaflet (CDN)
        Chart: "readonly", // Chart.js (CDN)
        XLSX: "readonly", // SheetJS (CDN)
        module: "readonly", // text-utils.js también se exporta para Node
      },
    },
    rules: {
      "no-unused-vars": ["error", { args: "none" }],
    },
  },
  {
    // Service Worker del modo app.
    files: ["sw.js"],
    languageOptions: { ecmaVersion: 2022, sourceType: "script", globals: globals.serviceworker },
  },
  {
    // Cloudflare Pages Functions: módulos ES con las APIs web del runtime
    // de Workers (Request, Response, crypto, etc.).
    files: ["functions/**/*.js"],
    languageOptions: { ecmaVersion: 2022, sourceType: "module", globals: globals.serviceworker },
  },
  {
    files: ["tests/**/*.js", "scripts/**/*.js", "eslint.config.js", "playwright.config.js"],
    languageOptions: { ecmaVersion: 2022, sourceType: "commonjs", globals: globals.node },
  },
  {
    // Pruebas en el navegador: el código de page.evaluate() corre en la página.
    files: ["tests/e2e/**/*.js"],
    languageOptions: { globals: { ...globals.node, ...globals.browser, Chart: "readonly" } },
  },
];
