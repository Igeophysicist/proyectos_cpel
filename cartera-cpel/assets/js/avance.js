/**
 * avance.js (Cartera CPEL y Cartera Anteproyectos)
 * Cómo se muestra el avance de un proyecto: barras de Programado y Real,
 * y además
 *
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

  /** Barra de un avance (lado "prog" o "real"), acotada a 0–100. */
  const barra = (lado, v, mini = false) =>
    `<span class="bar${mini ? " bar--mini" : ""}"><span class="bar__fill bar__fill--${lado}" style="width:${ancho(num(v))}%"></span></span>`;

  /**
   * Avance General: Programado y Real con sus barras y el semáforo.
   * pendiente = el Programado aún no se captura ("—" y sin semáforo).
   * El cambio semanal se pinta después en [data-semana], junto a "Real".
   */
  function generalHtml(real, prog, { pendiente = false } = {}) {
    const r = num(real);
    const p = pendiente ? null : num(prog);
    const diff = r !== null && p !== null ? r2(r - p) : null;
    const sem = semaforo(diff);
    // Programado y Real en 0: no ha empezado (no es "al día").
    const pie = sinIniciar(r, p)
      ? `<div class="variance variance--sin">Sin iniciar</div>`
      : sem
        ? `<div class="variance variance--${sem}">${textoDiferencia(diff)}</div>`
        : "";
    const fila = (lado, etiqueta, v, extra = "") => `
        <div class="progress-row progress-row--${lado}">
          <div class="progress-row__info"><span>${etiqueta}${extra}</span><span>${formatPct(v)}</span></div>
          ${barra(lado, v)}
        </div>`;
    return `
      <div class="progress-stack">
        ${fila("prog", "Programado", p)}
        ${fila("real", "Real", r, ` <span class="avg__semana" data-semana hidden></span>`)}
      </div>
      ${pie}`;
  }

  /** Programado y Real en 0: el área (o el proyecto) aún no empieza. */
  const sinIniciar = (r, p) => r === 0 && p === 0;

  /**
   * Diferencia Real − Programado en chico, con el color del semáforo
   * ("−0.10 pts", "+1.20 pts", "Al día"; "Sin iniciar" en gris si los dos
   * están en 0); vacío si falta algún dato.
   */
  function diferenciaHtml(real, prog) {
    const r = num(real);
    const p = num(prog);
    if (r === null || p === null) return "";
    if (sinIniciar(r, p)) return `<span class="mini-dif mini-dif--sin" title="Programado y Real en 0">Sin iniciar</span>`;
    const diff = r2(r - p);
    const texto = diff > 0 ? `+${formatPts(diff)} pts` : diff < 0 ? `−${formatPts(diff)} pts` : "Al día";
    return `<span class="mini-dif mini-dif--${semaforo(diff)}" title="Real − Programado">${texto}</span>`;
  }

  /**
   * Filas P / R (Avances particulares y ponderados) y, con diferencia,
   * la diferencia Real − Programado debajo. Solo <span> porque puede ir
   * dentro de un botón.
   */
  function miniHtml(real, prog, { pendiente = false, diferencia = false } = {}) {
    const fila = (lado, letra, v) => `
      <span class="mini-row">
        <span class="mini-row__tag mini-row__tag--${lado}">${letra}</span>
        ${barra(lado, v, true)}
        <span class="mini-row__val">${formatPct(num(v))}</span>
      </span>`;
    return (
      fila("prog", "P", pendiente ? null : prog) +
      fila("real", "R", real) +
      (diferencia && !pendiente ? diferenciaHtml(real, prog) : "")
    );
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

  const api = { ATRASO_LEVE, semaforo, textoDiferencia, cambioSemanal, barra, generalHtml, miniHtml, diferenciaHtml, pintarSemana };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else global.CarteraAvance = api;
})(typeof window !== "undefined" ? window : globalThis);
