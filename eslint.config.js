// Configuración de ESLint para los scripts del sitio (JavaScript plano que
// corre en el navegador, sin build step) y para las pruebas de Node.
const js = require("@eslint/js");
const globals = require("globals");

module.exports = [
  { ignores: ["node_modules/"] },
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
    files: ["tests/**/*.js", "eslint.config.js"],
    languageOptions: { ecmaVersion: 2022, sourceType: "commonjs", globals: globals.node },
  },
];
