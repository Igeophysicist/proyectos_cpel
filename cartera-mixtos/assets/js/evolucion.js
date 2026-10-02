/**
 * evolucion.js
 * Panel "Evolución por corte" de un proyecto (botón "Evolución" en cada
 * tarjeta del listado y en la ficha): Parque, LT y Global de cada semana
 * con actualizaciones (domingo a sábado, data/historial.json) y la
 * TENDENCIA de Global punteada (ver shared/trend.js).
 *
 * El texto solo dice si Global avanzó, disminuyó o se mantuvo: SIN fechas
 * estimadas ni predicciones, porque estos proyectos aún son volátiles y
 * pueden pasar tiempo sin avanzar aunque tengan COD.
 *
 * Requiere: Chart.js, shared/trend.js, shared/progress-chart.js,
 * shared/dialog.js y data.js (que agrega project.historial).
 * Expone: window.AppEvolucion.tieneDatos(project), .abrir(project)
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

  /** Contenido del panel. */
  function html(p) {
    return `
      <div class="detail__head">
        <button class="detail__close" data-close-evolucion aria-label="Cerrar">&times;</button>
        <div class="detail__title" id="evolucion-title">Evolución por corte</div>
        <div class="detail__sub">${global.TextUtils.esc(p.nombre)}</div>
      </div>
      <div class="detail__body evolucion" data-evolucion>
        <div class="pc-legend"></div>
        <div class="evolucion__chart"><canvas role="img" aria-label="Avance de Parque, LT y Global por corte semanal"></canvas></div>
        <p class="evolucion__resumen"></p>
        <p class="evolucion__nota">Un punto por semana (domingo a sábado) con el último dato de esa semana; las semanas sin actualizaciones no tienen punto.</p>
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

  /** Abre el panel con la evolución del proyecto. */
  function abrir(p) {
    if (!hasData(p)) return;
    const el = document.getElementById("evolucion");
    const body = document.getElementById("evolucion-body");
    body.innerHTML = html(p);
    global.Dialog.open(el, { onClose: destroy });
    render(body, p); // ya visible: la gráfica toma el tamaño del panel
  }

  document.addEventListener("click", (e) => {
    if (e.target.closest("[data-close-evolucion]")) global.Dialog.close(document.getElementById("evolucion"));
  });

  global.AppEvolucion = { tieneDatos: (p) => !!hasData(p), abrir };
})(window);
