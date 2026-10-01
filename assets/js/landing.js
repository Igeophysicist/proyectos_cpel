/**
 * landing.js
 * Carga data/avisos.json y lo pinta en el panel de avisos de la página
 * principal. Para publicar un aviso nuevo, solo agrega un objeto al
 * arreglo de ese archivo (fecha "AAAA-MM-DD" + texto) — no hace falta
 * tocar este script. El más reciente por fecha se muestra primero.
 *
 * IMPORTANTE: el campo "texto" de avisos.json se inserta como HTML a
 * propósito (para permitir <b>, <br>, <i>, etc.). Solo deben editarlo
 * personas de confianza; nunca se debe llenar con texto de terceros.
 *
 * Requiere: shared/text-utils.js y shared/dialog.js.
 */
(function () {
  const AVISOS_URL = "data/avisos.json";
  const COLABORADORES_URL = "data/colaboradores.json";

  const { esc, parseDate } = window.TextUtils;

  function formatFecha(iso) {
    const d = parseDate(iso);
    if (!d) return esc(iso);
    return d.toLocaleDateString("es-MX", { day: "numeric", month: "long", year: "numeric" });
  }

  function render(avisos) {
    const el = document.getElementById("avisos-list");
    if (!avisos.length) {
      el.innerHTML = `<div class="avisos-empty">No hay avisos por el momento.</div>`;
      return;
    }
    const ordenados = [...avisos].sort((a, b) => (a.fecha < b.fecha ? 1 : -1));
    el.innerHTML = ordenados
      .map(
        // "--i" alimenta el retraso escalonado de la animación de entrada
        // (ver .aviso en landing.css); cada tarjeta aparece un poco después
        // que la anterior.
        (a, i) => `
      <div class="aviso" style="--i:${i}">
        <div class="aviso__fecha">${formatFecha(a.fecha)}</div>
        <div class="aviso__texto">${a.texto}</div>
      </div>`
      )
      .join("");
  }

  async function init() {
    try {
      const res = await fetch(AVISOS_URL, { cache: "no-store" });
      if (!res.ok) throw new Error("HTTP " + res.status);
      const avisos = await res.json();
      render(avisos);
    } catch (err) {
      console.error("No se pudieron cargar los avisos:", err);
      document.getElementById("avisos-list").innerHTML =
        `<div class="avisos-empty">No se pudieron cargar los avisos.</div>`;
    }
  }

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
    if (footer) {
      footer.addEventListener("click", abrirColaboradores);
      footer.addEventListener("keydown", (e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          abrirColaboradores();
        }
      });
    }
    document.addEventListener("click", (e) => {
      if (e.target.closest("[data-close-sheet]")) cerrarColaboradores();
    });
  }

  document.addEventListener("DOMContentLoaded", () => {
    init();
    wireColaboradores();
  });
})();
