/**
 * curva.js (Cartera CPEL)
 * Ventana "Curva de avance": avance Programado y Real de cada corte
 * semanal (data/historial.json, lo genera la Action "Datos") y una línea
 * de TENDENCIA punteada: el ritmo real de los últimos cortes proyectado
 * hacia adelante (ver shared/trend.js). No hay programa de obra completo,
 * así que la tendencia indica a dónde llegaría el proyecto si sigue igual.
 *
 * Chart.js se descarga solo la primera vez que se abre esta ventana.
 *
 * Requiere: shared/text-utils.js, shared/trend.js, shared/progress-chart.js.
 * Expone: window.CarteraCurva.cargar(), window.CarteraCurva.mostrar(proyecto)
 */
(function (global) {
  const HISTORIAL_URL = "data/historial.json";
  const TREND_WINDOW = 6; // cortes reales usados para la tendencia
  const PROJECTION_DAYS = 28; // cuánto se dibuja la tendencia después del último corte
  const CHART_JS = {
    src: "https://cdn.jsdelivr.net/npm/chart.js@4.4.4/dist/chart.umd.js",
    integrity: "sha384-G436+Z2nlA8+PNoeRvWdxKbvOf8E/y+lYxqht2iBwNHTQDV5CJr3+AGVj8fGZi5t",
  };

  const { slugify, parseDate, isPastOrToday } = global.TextUtils;
  const { fitTrend, valueAt, weeklyRate, dateToReach, cortePoint, MIN_CORTES_CONFIABLES, DAY_MS } = global.Trend;
  const PC = global.ProgressChart;

  let historialPromise = null;
  let chartJsPromise = null;
  let chart = null;

  /** Descarga data/historial.json (una sola vez). Sin historial = sin cortes. */
  function cargar() {
    if (!historialPromise) {
      historialPromise = fetch(HISTORIAL_URL, { cache: "no-store" })
        .then((res) => (res.ok ? res.json() : { cortes: [] }))
        .catch(() => ({ cortes: [] }));
    }
    return historialPromise;
  }

  function loadChartJs() {
    if (global.Chart) return Promise.resolve();
    if (!chartJsPromise) {
      chartJsPromise = new Promise((resolve, reject) => {
        const s = document.createElement("script");
        s.src = CHART_JS.src;
        s.integrity = CHART_JS.integrity;
        s.crossOrigin = "anonymous";
        s.onload = resolve;
        s.onerror = () => {
          chartJsPromise = null; // permite reintentar al volver a abrir
          reject(new Error("No se pudo cargar Chart.js"));
        };
        document.head.appendChild(s);
      });
    }
    return chartJsPromise;
  }

  /** Puntos de un campo (prog/real); cada corte va en el lunes de su semana (ver Trend.cortePoint). */
  function puntos(cortes, slug, campo) {
    return cortes
      .map((c) => cortePoint(c.fecha, c.proyectos[slug] ? c.proyectos[slug][campo] : null))
      .filter((p) => Number.isFinite(p.v));
  }

  const fmt1 = (n) => n.toLocaleString("es-MX", { minimumFractionDigits: 1, maximumFractionDigits: 1 });
  const fmt2 = (n) => n.toLocaleString("es-MX", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  function resumen({ real, fit, operacion }) {
    const items = [];
    const n = real.length;
    items.push(
      n === 1
        ? `<b>1 corte semanal</b> registrado (${PC.fmtFull(real[0].fecha)}).`
        : `<b>${n} cortes semanales</b>, del ${PC.fmtFull(real[0].fecha)} al ${PC.fmtFull(real[n - 1].fecha)}.`
    );
    if (!fit) {
      items.push("La tendencia aparece a partir de 2 cortes semanales.");
      return items;
    }
    const rate = weeklyRate(fit);
    if (rate > 0.005) {
      items.push(`Ritmo real reciente: <b>+${fmt2(rate)} pts por semana</b> (últimos ${fit.n} cortes).`);
    } else if (rate < -0.005) {
      items.push(`El avance real <b>bajó ${fmt2(-rate)} pts por semana</b> en los últimos ${fit.n} cortes.`);
    } else {
      items.push(`<b>Sin avance real</b> entre los últimos ${fit.n} cortes.`);
    }
    const llega = fit.lastValue >= 100 ? null : dateToReach(fit, 100);
    if (fit.lastValue >= 100) items.push("El avance real ya llegó a <b>100%</b>.");
    else if (llega) {
      items.push(
        `Al ritmo actual llegaría a 100% el <b>${PC.fmtFull(llega.getTime())}</b>` +
          (fit.n < MIN_CORTES_CONFIABLES ? ` (estimación preliminar: solo ${fit.n} cortes).` : ".")
      );
    }
    else items.push("Al ritmo actual no hay fecha estimada para llegar a 100%.");
    if (operacion && !isPastOrToday(operacion)) {
      items.push(
        `En la fecha de operación (${PC.fmtFull(operacion.getTime())}) llevaría <b>${fmt1(valueAt(fit, operacion.getTime()))}%</b> al ritmo actual.`
      );
    }
    return items;
  }

  function tabla(prog, real) {
    const porFecha = new Map();
    prog.forEach((p) => porFecha.set(p.t, { t: p.fecha, prog: p.v }));
    real.forEach((p) => porFecha.set(p.t, { ...(porFecha.get(p.t) || { t: p.fecha }), real: p.v }));
    const filas = [...porFecha.values()].sort((a, b) => b.t - a.t);
    const celda = (v) => (Number.isFinite(v) ? fmt2(v) + "%" : "—");
    return `
      <details class="curva-datos">
        <summary>Ver datos de cada corte</summary>
        <table>
          <thead><tr><th>Corte</th><th>Programado</th><th>Real</th><th>Diferencia</th></tr></thead>
          <tbody>${filas
            .map(
              (f) => `<tr><td>${PC.fmtFull(f.t)}</td><td>${celda(f.prog)}</td><td>${celda(f.real)}</td><td>${
                Number.isFinite(f.prog) && Number.isFinite(f.real) ? (f.real - f.prog >= 0 ? "+" : "") + fmt2(f.real - f.prog) : "—"
              }</td></tr>`
            )
            .join("")}</tbody>
        </table>
      </details>`;
  }

  /** Pinta la curva del proyecto en la ventana (#curvaBody). */
  async function mostrar(proyecto) {
    const body = document.getElementById("curvaBody");
    if (chart) {
      chart.destroy();
      chart = null;
    }
    const { cortes = [] } = await cargar();
    const slug = slugify(proyecto.nombre);
    const prog = puntos(cortes, slug, "prog");
    const real = puntos(cortes, slug, "real");
    if (!real.length && !prog.length) {
      body.innerHTML = `<div class="state-msg">Aún no hay cortes semanales registrados para este proyecto.</div>`;
      return;
    }

    const fit = fitTrend(real, { window: TREND_WINDOW });
    const series = [
      { label: "Programado", color: PC.COLORS.programado, points: prog },
      { label: "Real", color: PC.COLORS.real, points: real },
    ];
    let end = Math.max(...prog.concat(real).map((p) => p.t));
    if (fit) {
      end = fit.to + PROJECTION_DAYS * DAY_MS;
      series.push({
        label: "Tendencia",
        color: PC.COLORS.real,
        dashed: true,
        points: global.Trend.segment(fit, end),
      });
      end = series[series.length - 1].points[1].t; // termina donde termina la tendencia
    }

    const operacion = parseDate(String(proyecto.plazo_operacion_fecha || ""));
    body.innerHTML = `
      <div class="pc-legend">${PC.legendHtml(series)}</div>
      <div class="curva-chart"><canvas role="img" aria-label="Avance programado, real y tendencia por corte semanal"></canvas></div>
      <ul class="curva-resumen">${resumen({ real, fit, operacion })
        .map((t) => `<li>${t}</li>`)
        .join("")}</ul>
      <p class="curva-nota">La tendencia es una recta ajustada a los últimos ${TREND_WINDOW} cortes reales: muestra a dónde llegaría el proyecto si mantiene su ritmo reciente. No sustituye al programa de obra.</p>
      ${tabla(prog, real)}`;

    try {
      await loadChartJs();
      chart = PC.render(body.querySelector("canvas"), { series, end });
    } catch {
      body.querySelector(".curva-chart").innerHTML =
        `<div class="state-msg">No se pudo cargar la gráfica (revisa tu conexión). Los datos están abajo.</div>`;
    }
  }

  global.CarteraCurva = { cargar, mostrar };
})(window);
