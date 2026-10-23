/**
 * clima-cdmx.js
 * Fecha, hora y clima de la Ciudad de México en la barra superior del
 * portal. La hora es la de México aunque el equipo esté en otra zona.
 * El clima viene de Open-Meteo (gratuito, sin clave) y se actualiza cada
 * 15 minutos; si no responde, solo se muestran la fecha y la hora.
 *
 * Las funciones puras (fechaHora, describir) se prueban en
 * tests/clima-cdmx.test.js.
 */
(function (global) {
  const ZONA = "America/Mexico_City";
  const CLIMA_URL =
    "https://api.open-meteo.com/v1/forecast?latitude=19.4326&longitude=-99.1332" +
    "&current=temperature_2m,weather_code,is_day&timezone=America%2FMexico_City";
  const CADA_CLIMA = 15 * 60 * 1000;

  const fmtFecha = new Intl.DateTimeFormat("es-MX", { timeZone: ZONA, weekday: "short", day: "numeric", month: "short" });
  const fmtHora = new Intl.DateTimeFormat("es-MX", { timeZone: ZONA, hour: "numeric", minute: "2-digit" });

  /** { fecha: "vie 23 oct", hora: "2:05 p.m." } de un instante, en hora de México. */
  function fechaHora(date) {
    const parte = (t) => (fmtFecha.formatToParts(date).find((p) => p.type === t) || {}).value || "";
    const fecha = [parte("weekday"), parte("day"), parte("month")].map((x) => x.replace(/\./g, "")).join(" ");
    return { fecha, hora: fmtHora.format(date).replace(/\s/g, " ") };
  }

  // Códigos WMO de Open-Meteo → descripción e ícono.
  const CODIGOS = [
    [[0], "Despejado", "sol"],
    [[1], "Mayormente despejado", "solNube"],
    [[2], "Parcialmente nublado", "solNube"],
    [[3], "Nublado", "nube"],
    [[45, 48], "Niebla", "niebla"],
    [[51, 53, 55, 56, 57], "Llovizna", "lluvia"],
    [[61, 63, 66, 80, 81], "Lluvia", "lluvia"],
    [[65, 67, 82], "Lluvia fuerte", "lluvia"],
    [[71, 73, 75, 77, 85, 86], "Nieve", "nieve"],
    [[95, 96, 99], "Tormenta", "tormenta"],
  ];

  /** { texto, icono } del código del clima; de noche el sol se vuelve luna. */
  function describir(codigo, esDia = true) {
    const c = CODIGOS.find(([lista]) => lista.includes(Number(codigo)));
    if (!c) return null;
    let icono = c[2];
    if (!esDia && icono === "sol") icono = "luna";
    if (!esDia && icono === "solNube") icono = "lunaNube";
    return { texto: c[1], icono };
  }

  const TRAZOS = {
    sol: '<circle cx="12" cy="12" r="4"/><path d="M12 2.5v2M12 19.5v2M2.5 12h2M19.5 12h2M5.3 5.3l1.4 1.4M17.3 17.3l1.4 1.4M5.3 18.7l1.4-1.4M17.3 6.7l1.4-1.4"/>',
    luna: '<path d="M20 14.5A8 8 0 1 1 9.5 4a6.5 6.5 0 0 0 10.5 10.5Z"/>',
    solNube: '<path d="M8 3v1.5M3.5 8H2M4.8 4.8l1 1M12.2 4.8l-1 1"/><path d="M5.2 11a3.5 3.5 0 1 1 6.3-2.8"/><path d="M8 20h9a4 4 0 1 0-1-7.9A5 5 0 0 0 7 14a3 3 0 0 0 1 6Z"/>',
    lunaNube: '<path d="M11 5.5A4.5 4.5 0 0 1 5 10.6 5 5 0 0 0 11 5.5Z"/><path d="M8 20h9a4 4 0 1 0-1-7.9A5 5 0 0 0 7 14a3 3 0 0 0 1 6Z"/>',
    nube: '<path d="M7 19h10a4.5 4.5 0 1 0-1.2-8.8A6 6 0 0 0 4.5 12.5 3.3 3.3 0 0 0 7 19Z"/>',
    niebla: '<path d="M7 13h10a4 4 0 1 0-1.1-7.8A5.5 5.5 0 0 0 5 8a2.6 2.6 0 0 0 2 5Z"/><path d="M4 17h16M6 20.5h12"/>',
    lluvia: '<path d="M7 15h10a4 4 0 1 0-1.1-7.8A5.5 5.5 0 0 0 5 10a2.6 2.6 0 0 0 2 5Z"/><path d="M8 18l-1 2.5M12 18l-1 2.5M16 18l-1 2.5"/>',
    nieve: '<path d="M7 15h10a4 4 0 1 0-1.1-7.8A5.5 5.5 0 0 0 5 10a2.6 2.6 0 0 0 2 5Z"/><path d="M8 18.5h.01M12 20.5h.01M16 18.5h.01"/>',
    tormenta: '<path d="M7 15h10a4 4 0 1 0-1.1-7.8A5.5 5.5 0 0 0 5 10a2.6 2.6 0 0 0 2 5Z"/><path d="M12.5 15.5 10.5 19h3l-2 3.5"/>',
  };
  const svg = (icono) =>
    `<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${TRAZOS[icono]}</svg>`;

  // -------------------------------------------------- Página
  function iniciar() {
    const caja = document.getElementById("cdmx");
    if (!caja) return;
    const elFecha = document.getElementById("cdmxFecha");
    const elHora = document.getElementById("cdmxHora");
    const elClima = document.getElementById("cdmxClima");

    function pintarHora() {
      const ahora = new Date();
      const { fecha, hora } = fechaHora(ahora);
      elFecha.textContent = fecha;
      elHora.textContent = hora;
      elHora.setAttribute("datetime", ahora.toISOString());
      // siguiente cambio de minuto
      setTimeout(pintarHora, 60_000 - (Date.now() % 60_000) + 50);
    }

    async function pintarClima() {
      try {
        const res = await fetch(CLIMA_URL, { cache: "no-store" });
        if (!res.ok) throw new Error("HTTP " + res.status);
        const { current } = await res.json();
        const temp = Number(current && current.temperature_2m);
        if (!Number.isFinite(temp)) throw new Error("sin temperatura");
        const d = describir(current.weather_code, current.is_day !== 0);
        elClima.innerHTML =
          (d ? svg(d.icono) : "") +
          `<span class="cdmx__temp">${Math.round(temp)}°C</span>` +
          (d ? `<span class="cdmx__desc">${d.texto}</span>` : "");
        elClima.title = d ? `Clima en la CDMX: ${d.texto}, ${Math.round(temp)} °C` : "";
        elClima.hidden = false;
      } catch {
        // sin clima: se quedan la fecha y la hora (o el último dato)
      }
    }

    pintarHora();
    caja.hidden = false;
    pintarClima();
    setInterval(pintarClima, CADA_CLIMA);
  }

  const api = { fechaHora, describir, CLIMA_URL };

  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else {
    global.ClimaCdmx = api;
    if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", iniciar);
    else iniciar();
  }
})(typeof window !== "undefined" ? window : globalThis);
