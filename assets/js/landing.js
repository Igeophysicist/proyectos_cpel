/**
 * landing.js
 * Carga data/avisos.json y lo pinta en el panel de avisos de la página
 * principal. Para publicar un aviso nuevo, solo agrega un objeto al
 * arreglo de ese archivo (fecha "AAAA-MM-DD" + texto) — no hace falta
 * tocar este script. El más reciente por fecha se muestra primero.
 */
(function () {
  const AVISOS_URL = "data/avisos.json";

  function formatFecha(iso) {
    const d = new Date(iso + "T00:00:00");
    if (Number.isNaN(d.getTime())) return iso;
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
        (a) => `
      <div class="aviso">
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

  document.addEventListener("DOMContentLoaded", init);
})();
