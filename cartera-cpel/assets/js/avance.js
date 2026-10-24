/**
 * avance.js (Cartera CPEL y Cartera Anteproyectos)
 * Cómo se muestra el avance de un proyecto:
 *
 *  - Una sola barra con el avance Real y una marca vertical donde va el
 *    Programado (se ve de inmediato si va adelante o atrás).
 *  - Semáforo de la diferencia Real − Programado:
 *      verde ("ok")    al día o adelantado,
 *      ámbar ("leve")  atraso menor a ATRASO_LEVE pts,
 *      rojo ("grave")  atraso de ATRASO_LEVE pts o más.
 *  - Cambio del Real desde el corte semanal anterior (data/historial.json).
 *
 * Las funciones puras se prueban en tests/avance.test.js.
 *
 * Requiere: shared/text-utils.js.
 * Expone: window.CarteraAvance (o module.exports en Node)
 */
(function (global) {
  const ATRASO_LEVE = 3; // pts: un atraso menor a esto es "leve" (ámbar)

  const { formatPct, formatPts } = global.TextUtils;
  const num = (v) => (typeof v === "number" && Number.isFinite(v) ? v : null);
  const ancho = (v) => Math.max(0, Math.min(v || 0, 100));
  const r2 = (v) => Math.round(v * 100) / 100;

  /** "ok", "leve" o "grave" según la diferencia Real − Programado (pts); null sin dato. */
  function semaforo(diff) {
    if (num(diff) === null) return null;
    if (diff >= 0) return "ok";
    return -diff < ATRASO_LEVE ? "leve" : "grave";
  }

  /** Texto de la diferencia: "Atraso de 2.93 pts respecto al programa", etc. */
  function textoDiferencia(diff) {
    if (diff > 0) return `Adelantado ${formatPts(diff)} pts respecto al programa`;
    if (diff < 0) return `Atraso de ${formatPts(diff)} pts respecto al programa`;
    return "Al día respecto al programa";
  }

  /**
   * Cambio del Real entre los dos últimos cortes que tienen dato del
   * proyecto: { diff, desde: "AAAA-MM-DD" } o null si hay menos de dos.
   */
  function cambioSemanal(cortes, slug) {
    const con = (cortes || []).filter((c) => c.proyectos && c.proyectos[slug] && num(c.proyectos[slug].real) !== null);
    if (con.length < 2) return null;
    const [antes, ahora] = con.slice(-2);
    return { diff: r2(ahora.proyectos[slug].real - antes.proyectos[slug].real), desde: antes.fecha };
  }

  /** Barra de Real con la marca del Programado (sin marca si prog es null). */
  function barra(real, prog, { mini = false } = {}) {
    const p = num(prog);
    return `<span class="bala${mini ? " bala--mini" : ""}" aria-hidden="true">
        <span class="bala__real" style="width:${ancho(num(real))}%"></span>
        ${p === null ? "" : `<span class="bala__prog" style="left:${ancho(p)}%"></span>`}
      </span>`;
  }

  /**
   * Avance General: Real grande, Programado a la derecha, la barra y el
   * semáforo. pendiente = el Programado aún no se captura (sin marca ni
   * semáforo). El cambio semanal se pinta después en [data-semana].
   */
  function generalHtml(real, prog, { pendiente = false } = {}) {
    const r = num(real);
    const p = pendiente ? null : num(prog);
    const diff = r !== null && p !== null ? r2(r - p) : null;
    const sem = semaforo(diff);
    return `
      <div class="avg">
        <div class="avg__top">
          <div class="avg__real">
            <span class="avg__label">Real</span>
            <span class="avg__valor tabular">${formatPct(r)}</span>
            <span class="avg__semana" data-semana hidden></span>
          </div>
          <div class="avg__prog">
            <span class="avg__label"><i class="marca-prog" aria-hidden="true"></i>Programado</span>
            <span class="avg__pvalor tabular">${pendiente ? "pendiente" : formatPct(p)}</span>
          </div>
        </div>
        ${barra(r, p)}
        ${sem ? `<div class="variance variance--${sem}">${textoDiferencia(diff)}</div>` : ""}
      </div>`;
  }

  /**
   * Avance chico (particulares, ponderados): Real y Programado arriba, la
   * barra abajo. Solo <span> porque puede ir dentro de un botón.
   */
  function miniHtml(real, prog, { pendiente = false } = {}) {
    const r = num(real);
    const p = pendiente ? null : num(prog);
    return `
      <span class="amini">
        <span class="amini__top">
          <span class="amini__real tabular" title="Real">${formatPct(r)}</span>
          <span class="amini__prog tabular" title="Programado"><i class="marca-prog" aria-hidden="true"></i>${pendiente ? "pendiente" : formatPct(p)}</span>
        </span>
        ${barra(r, p, { mini: true })}
      </span>`;
  }

  /**
   * Pinta el cambio semanal en el [data-semana] del contenedor, si el
   * historial tiene dos cortes del proyecto. "vigente()" dice si el
   * proyecto sigue en pantalla cuando llega el historial.
   */
  function pintarSemana(contenedor, historialPromise, slug, vigente = () => true) {
    if (!historialPromise) return;
    historialPromise.then(({ cortes = [] } = {}) => {
      const el = contenedor && contenedor.querySelector("[data-semana]");
      const c = cambioSemanal(cortes, slug);
      if (!el || !c || !vigente()) return;
      const [, m, d] = c.desde.split("-").map(Number);
      const fecha = new Date(2000, m - 1, d).toLocaleDateString("es-MX", { day: "numeric", month: "short" }).replace(/\./g, "");
      const clase = c.diff > 0 ? "sube" : c.diff < 0 ? "baja" : "igual";
      const flecha = c.diff > 0 ? "▲ +" : c.diff < 0 ? "▼ −" : "= ";
      el.className = `avg__semana avg__semana--${clase}`;
      el.textContent = `${flecha}${formatPts(c.diff)} desde el ${fecha}`;
      el.hidden = false;
    });
  }

  const api = { ATRASO_LEVE, semaforo, textoDiferencia, cambioSemanal, barra, generalHtml, miniHtml, pintarSemana };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else global.CarteraAvance = api;
})(typeof window !== "undefined" ? window : globalThis);
