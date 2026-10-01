/**
 * progress-chart.js (compartido por cartera-cpel y cartera-mixtos)
 * Gráfica de avance en el tiempo (Chart.js) con el mismo estilo en ambos
 * tableros: eje X por fecha de corte, eje Y en %, líneas de 2 px, puntos
 * con borde blanco y tooltip al tocar/pasar el cursor. La tendencia se
 * dibuja punteada en el color de la serie que proyecta.
 *
 * Colores validados (contraste, croma y daltonismo) con la guía de
 * visualización del proyecto; ver COLORS.
 *
 * Expone: window.ProgressChart.render(canvas, { series, end }) -> Chart
 *   series: [{ label, color, points: [{ t, v }], dashed? }]
 *   end:    instante (ms) hasta donde llega el eje X (p. ej. fin de la tendencia)
 */
(function (global) {
  const COLORS = {
    programado: "#b07d1c",
    real: "#0f8a72",
    parque: "#b07d1c",
    lt: "#6a5acd",
    global: "#0f8a72",
  };
  const INK = "#3d4a47";
  const MUTED = "#6b7572";
  const GRID = "#e6eae8";
  const DAY_MS = 86400000;

  const fmtDay = (t) =>
    new Date(t).toLocaleDateString("es-MX", { day: "numeric", month: "short" }).replace(/\./g, "");
  const fmtFull = (t) =>
    new Date(t).toLocaleDateString("es-MX", { day: "numeric", month: "short", year: "numeric" }).replace(/\./g, "");

  /** Máximo "redondo" del eje Y (10, 20, …, 100) según los datos. */
  function niceMax(series) {
    const max = Math.max(0, ...series.flatMap((s) => s.points.map((p) => p.v)).filter(Number.isFinite));
    return Math.min(100, Math.max(10, Math.ceil((max + 5) / 10) * 10));
  }

  function render(canvas, { series, end }) {
    const all = series.flatMap((s) => s.points.map((p) => p.t));
    const min = Math.min(...all) - 3 * DAY_MS;
    const max = Math.max(end || 0, ...all) + 3 * DAY_MS;
    const span = max - min;
    const step = span > 120 * DAY_MS ? 28 * DAY_MS : span > 50 * DAY_MS ? 14 * DAY_MS : 7 * DAY_MS;

    return new Chart(canvas, {
      type: "line",
      data: {
        datasets: series.map((s) => ({
          label: s.label,
          data: s.points.map((p) => ({ x: p.t, y: p.v, fecha: p.fecha })),
          borderColor: s.color,
          backgroundColor: s.color,
          borderWidth: 2,
          borderDash: s.dashed ? [6, 5] : [],
          pointRadius: s.dashed ? 0 : 4.5,
          pointHoverRadius: s.dashed ? 0 : 6,
          pointBorderColor: "#ffffff",
          pointBorderWidth: 2,
          tension: 0,
          spanGaps: true,
        })),
      },
      options: {
        maintainAspectRatio: false,
        animation: { duration: 300 },
        interaction: { mode: "nearest", axis: "x", intersect: false },
        plugins: {
          legend: { display: false }, // la leyenda va en HTML, junto a la gráfica
          datalabels: { display: false }, // Mixtos registra este plugin globalmente
          tooltip: {
            backgroundColor: "#1b332f",
            titleFont: { weight: "700" },
            padding: 10,
            callbacks: {
              // Cortes: fecha real del corte; tendencia: semana proyectada.
              title: (items) => {
                if (!items.length) return "";
                const raw = items[0].raw;
                return raw.fecha ? "Corte del " + fmtFull(raw.fecha) : "Semana del " + fmtFull(items[0].parsed.x);
              },
              label: (item) => ` ${item.dataset.label}: ${item.parsed.y.toFixed(1)}%`,
            },
          },
        },
        scales: {
          x: {
            type: "linear",
            min,
            max,
            ticks: { color: MUTED, font: { size: 11 }, callback: (v) => fmtDay(v), maxRotation: 0 },
            // Marcas en los lunes (donde se ubica cada corte semanal).
            afterBuildTicks: (axis) => {
              const first = new Date(min);
              first.setHours(12, 0, 0, 0);
              first.setDate(first.getDate() + ((8 - first.getDay()) % 7)); // siguiente lunes (o el mismo)
              const ticks = [];
              for (let t = first.getTime(); t <= max; t += step) ticks.push({ value: t });
              axis.ticks = ticks;
            },
            grid: { color: GRID, lineWidth: 1 },
            border: { display: false },
          },
          y: {
            min: 0,
            max: niceMax(series),
            ticks: { color: MUTED, font: { size: 11 }, callback: (v) => v + "%" },
            grid: { color: GRID, lineWidth: 1 },
            border: { display: false },
          },
        },
      },
    });
  }

  // Estilos de la leyenda (iguales en ambos tableros; se inyectan una vez).
  if (!document.getElementById("pc-legend-style")) {
    const style = document.createElement("style");
    style.id = "pc-legend-style";
    style.textContent =
      ".pc-legend{display:flex;flex-wrap:wrap;gap:6px 14px;font-size:12px;font-weight:600;color:" + INK + ";}" +
      ".pc-legend__item{display:inline-flex;align-items:center;gap:6px;}" +
      ".pc-legend__swatch{width:16px;height:0;border-top:2px solid var(--c);border-radius:2px;position:relative;}" +
      ".pc-legend__swatch:not(.pc-legend__swatch--dashed)::after{content:'';position:absolute;left:4px;top:-5px;width:8px;height:8px;border-radius:50%;background:var(--c);}" +
      ".pc-legend__swatch--dashed{border-top-style:dashed;}";
    document.head.appendChild(style);
  }

  /** Leyenda HTML: [{ label, color, dashed? }] */
  function legendHtml(items) {
    return items
      .map(
        (i) =>
          `<span class="pc-legend__item"><i class="pc-legend__swatch${i.dashed ? " pc-legend__swatch--dashed" : ""}" style="--c:${i.color}"></i>${i.label}</span>`
      )
      .join("");
  }

  global.ProgressChart = { render, legendHtml, COLORS, INK, fmtFull };
})(window);
