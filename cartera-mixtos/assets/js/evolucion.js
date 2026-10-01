/**
 * evolucion.js
 * Sección "Evolución por corte" de la ficha de un proyecto: Parque, LT y
 * Global de cada corte semanal (data/historial.json) y la TENDENCIA de
 * Global punteada (ritmo de los últimos cortes, ver shared/trend.js).
 *
 * El texto solo dice si Global avanzó, disminuyó o se mantuvo: SIN fechas
 * estimadas ni predicciones, porque estos proyectos aún son volátiles y
 * pueden pasar tiempo sin avanzar aunque tengan COD.
 *
 * Requiere: Chart.js, shared/trend.js, shared/progress-chart.js y data.js
 * (que agrega project.historial).
 * Expone: window.AppEvolucion.html(project), window.AppEvolucion.render(container, project)
 */
(function (global) {
  const TREND_WINDOW = 6;
  const PROJECTION_DAYS = 28;
  const { fitTrend, DAY_MS } = global.Trend;
  const PC = global.ProgressChart;

  let chart = null;

  function hasData(p) {
    const h = p.historial;
    return !!h && (h.parque.length || h.lt.length || h.global.length);
  }

  /** Marcador HTML de la sección (vacío si el proyecto no tiene cortes). */
  function html(p) {
    if (!hasData(p)) return "";
    return `
      <div class="detail__section-title">Evolución por corte</div>
      <div class="evolucion" data-evolucion>
        <div class="pc-legend"></div>
        <div class="evolucion__chart"><canvas role="img" aria-label="Avance de Parque, LT y Global por corte semanal"></canvas></div>
        <p class="evolucion__resumen"></p>
      </div>`;
  }

  /** Solo describe lo que pasó entre los dos últimos cortes (sin predicciones). */
  function resumen(pts) {
    const n = pts.length;
    const cortes = n === 1 ? `1 corte (${PC.fmtFull(pts[0].fecha)})` : `${n} cortes, del ${PC.fmtFull(pts[0].fecha)} al ${PC.fmtFull(pts[n - 1].fecha)}`;
    if (n < 2) return `${cortes}.`;
    const diff = pts[n - 1].v - pts[n - 2].v;
    const estado = diff > 0.005 ? "<b>avanzó</b>" : diff < -0.005 ? "<b>disminuyó</b>" : "<b>se mantuvo</b>";
    return `${cortes}. Global ${estado} en el último corte.`;
  }

  /** Dibuja la gráfica dentro del contenedor de la ficha ya pintada. */
  function render(container, p) {
    if (chart) {
      chart.destroy();
      chart = null;
    }
    const box = container.querySelector("[data-evolucion]");
    if (!box || !hasData(p) || !global.Chart) return;

    const h = p.historial;
    const fit = fitTrend(h.global, { window: TREND_WINDOW });
    const series = [
      { label: "Parque", color: PC.COLORS.parque, points: h.parque },
      { label: "LT", color: PC.COLORS.lt, points: h.lt },
      { label: "Global", color: PC.COLORS.global, points: h.global },
    ].filter((s) => s.points.length);
    let end = Math.max(...series.flatMap((s) => s.points.map((x) => x.t)));
    if (fit) {
      end = fit.to + PROJECTION_DAYS * DAY_MS;
      series.push({
        label: "Tendencia (Global)",
        color: PC.COLORS.global,
        dashed: true,
        points: global.Trend.segment(fit, end),
      });
      end = series[series.length - 1].points[1].t; // termina donde termina la tendencia
    }
    box.querySelector(".pc-legend").innerHTML = PC.legendHtml(series);
    box.querySelector(".evolucion__resumen").innerHTML = h.global.length ? resumen(h.global) : "";
    chart = PC.render(box.querySelector("canvas"), { series, end });
  }

  function destroy() {
    if (chart) {
      chart.destroy();
      chart = null;
    }
  }

  global.AppEvolucion = { html, render, destroy };
})(window);
