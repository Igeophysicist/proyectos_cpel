/**
 * landing.js
 * Página principal: panel de colaboradores (se abre desde el footer) y
 * botón "Salir". La sección "Esta semana" está en semana-portal.js.
 *
 * Requiere: shared/text-utils.js y shared/dialog.js.
 */
(function () {
  const COLABORADORES_URL = "data/colaboradores.json";

  const { esc } = window.TextUtils;

  // -------------------------------------------------- Colaboradores
  // Panel que se abre al hacer clic en el footer. La lista de nombres
  // viene de data/colaboradores.json (un simple arreglo de strings) —
  // para agregar o quitar colaboradores solo se edita ese archivo, no
  // hace falta tocar este script.
  let colaboradoresCargados = false;

  async function cargarColaboradores() {
    const lista = document.getElementById("colaboradoresList");
    try {
      const res = await fetch(COLABORADORES_URL, { cache: "no-store" });
      if (!res.ok) throw new Error("HTTP " + res.status);
      const nombres = await res.json();
      colaboradoresCargados = true;
      if (!Array.isArray(nombres) || !nombres.length) {
        lista.innerHTML = `<li class="colaboradores-empty">Sin colaboradores registrados.</li>`;
        return;
      }
      lista.innerHTML = nombres.map((nombre) => `<li>${esc(nombre)}</li>`).join("");
    } catch (err) {
      console.error("No se pudieron cargar los colaboradores:", err);
      lista.innerHTML = `<li class="colaboradores-empty">No se pudieron cargar los colaboradores.</li>`;
    }
  }

  function abrirColaboradores() {
    window.Dialog.open(document.getElementById("sheetColaboradores"));
    // Se carga la primera vez que se abre (no en cada apertura), así el
    // dato no queda desactualizado si se edita el JSON durante la sesión
    // pero tampoco se repite la petición innecesariamente.
    if (!colaboradoresCargados) cargarColaboradores();
  }

  function cerrarColaboradores() {
    window.Dialog.close(document.getElementById("sheetColaboradores"));
  }

  function wireColaboradores() {
    const footer = document.getElementById("siteFooter");
    if (footer) footer.addEventListener("click", abrirColaboradores);
    document.addEventListener("click", (e) => {
      if (e.target.closest("[data-close-sheet]")) cerrarColaboradores();
    });
  }

  // Botón "Salir": la cookie cpel_auth la pone functions/_middleware.js
  // al entrar con la contraseña (solo existe en Cloudflare Pages).
  function mostrarSalirSiHaySesion() {
    const link = document.getElementById("logoutLink");
    if (link && /(?:^|;\s*)cpel_auth=1(?:;|$)/.test(document.cookie)) link.hidden = false;
  }

  document.addEventListener("DOMContentLoaded", () => {
    wireColaboradores();
    mostrarSalirSiHaySesion();
  });
})();
