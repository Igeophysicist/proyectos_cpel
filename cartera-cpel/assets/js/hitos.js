/**
 * hitos.js
 * Hitos de pago de la ficha de Cartera CPEL. Los datos vienen de
 * data/hitos.json (generado desde data/HITOS_CARTERA_CPEL.xlsx por
 * scripts/build-data.js; sin montos).
 *
 * En la ficha (tarjeta "Hitos de pago"):
 *   - cuántos hitos van pagados (barra),
 *   - ANTERIOR: el último hito pagado (por fecha de pago o, si no la hay,
 *     por fecha programada),
 *   - ACTUAL: el hito sin pagar con la fecha programada más antigua,
 *   - PRÓXIMO: el siguiente hito sin pagar con fecha de hoy en adelante.
 * Un hito sin pagar (salvo "en tránsito de pago") cuya fecha programada
 * ya pasó lleva la marca "Fecha vencida".
 *
 * "Ver todos los hitos" abre la lista completa por contrato, ordenada por
 * fecha programada (con pestañas si el proyecto tiene varios contratos).
 *
 * Las funciones no tocan el DOM (devuelven HTML), así que se prueban en
 * Node (tests/hitos-ficha.test.js). Requiere: shared/text-utils.js.
 * Expone: window.CarteraHitos (o module.exports en Node)
 */
(function (global) {
  // En Node (pruebas), la prueba pone TextUtils en globalThis antes de cargar este archivo.
  const { esc, parseDate, formatDateShort } = global.TextUtils;

  const ESTATUS = {
    pagado: "Pagado",
    parcial: "Pagado parcialmente",
    transito: "En tránsito de pago",
    pendiente: "Pendiente",
    inconcluso: "Hito inconcluso",
    sin: "Sin estatus",
  };
  const etiqueta = (h) => ESTATUS[h.estatus] || h.estatusTexto || "Sin estatus";

  /** Fecha de hoy en México, "AAAA-MM-DD". */
  const hoyMexico = (ahora = new Date()) =>
    new Intl.DateTimeFormat("en-CA", { timeZone: "America/Mexico_City", year: "numeric", month: "2-digit", day: "2-digit" }).format(ahora);

  const fecha = (iso) => (iso ? formatDateShort(parseDate(iso)) : "");
  const dias = (de, a) => Math.round((parseDate(a) - parseDate(de)) / 86400000);

  const pagado = (h) => h.estatus === "pagado";
  const vencido = (h, hoy) => !pagado(h) && h.estatus !== "transito" && !!h.programada && h.programada < hoy;

  /** Orden por fecha programada (sin fecha al final), respetando el orden del Excel en empates. */
  const porFecha = (hitos) =>
    hitos
      .map((h, i) => ({ h, i }))
      .sort((a, b) => (a.h.programada || "9999").localeCompare(b.h.programada || "9999") || a.i - b.i)
      .map((x) => x.h);

  /** Anterior / actual / próximo y conteos de todos los contratos de un proyecto. */
  function resumen(proyecto, hoy) {
    const todos = (proyecto ? proyecto.contratos : []).flatMap((c) =>
      c.hitos.map((h) => ({ ...h, contrato: proyecto.contratos.length > 1 ? c.nombre : "" }))
    );
    const pagados = todos.filter(pagado);
    const anterior = pagados.slice().sort((a, b) => (a.pago || a.programada || "").localeCompare(b.pago || b.programada || "")).pop() || null;
    const pendientes = porFecha(todos.filter((h) => !pagado(h)));
    const actual = pendientes[0] || null;
    const proximo = pendientes.slice(1).find((h) => !h.programada || h.programada >= hoy) || null;
    return {
      total: todos.length,
      pagados: pagados.length,
      parciales: todos.filter((h) => h.estatus === "parcial").length,
      anterior,
      actual,
      proximo,
      otrosVencidos: pendientes.filter((h) => h !== actual && vencido(h, hoy)).length,
    };
  }

  /** % del contrato ya pagado (suma del "valor sobre el precio" de los hitos pagados). */
  const pctPagado = (contrato) => Math.round(contrato.hitos.filter(pagado).reduce((s, h) => s + (h.pct || 0), 0) * 100) / 100;

  // ------------------------------------------------------------ HTML
  const chip = (h) => `<span class="hchip hchip--${esc(h.estatus)}">${esc(etiqueta(h))}</span>`;
  const marcaVencida = `<span class="hvencida">Fecha vencida</span>`;
  const numero = (h) => (/^\d+$/.test(h.num) ? `Hito ${esc(h.num)}` : esc(h.num || "Hito"));

  function cuando(h, hoy, rol) {
    if (rol === "anterior") return h.pago ? `Pagado el ${fecha(h.pago)}` : h.programada ? `Programado: ${fecha(h.programada)}` : "";
    if (!h.programada) return "Sin fecha programada";
    const d = dias(hoy, h.programada);
    const rel = d === 0 ? "hoy" : d > 0 ? `en ${d} día${d === 1 ? "" : "s"}` : `hace ${-d} día${d === -1 ? "" : "s"}`;
    return `Programado: ${fecha(h.programada)} · ${rel}`;
  }

  function fila(rol, titulo, h, hoy, vacio, extra = "") {
    if (!h) {
      return `<li class="hito3 hito3--${rol} hito3--vacio"><div class="hito3__etq">${titulo}</div><div class="hito3__cuerpo"><p class="hito3__vacio">${vacio}</p></div></li>`;
    }
    return `
      <li class="hito3 hito3--${rol}">
        <div class="hito3__etq">${titulo}</div>
        <div class="hito3__cuerpo">
          <div class="hito3__head">
            <span class="hito3__num">${numero(h)}</span>
            ${h.contrato ? `<span class="hcontrato">${esc(h.contrato)}</span>` : ""}
            ${chip(h)}
          </div>
          <p class="hito3__desc">${esc(h.desc)}</p>
          <div class="hito3__fecha">${esc(cuando(h, hoy, rol))}${rol !== "anterior" && vencido(h, hoy) ? marcaVencida : ""}</div>
          ${extra}
        </div>
      </li>`;
  }

  /** Tarjeta de la ficha. proyecto = entrada de hitos.json (o undefined). */
  function tarjeta(proyecto, hoy) {
    const r = resumen(proyecto, hoy);
    if (!r.total) return `<div class="state-msg">Sin hitos registrados para este proyecto.</div>`;
    const anchoPag = (r.pagados / r.total) * 100;
    const anchoPar = (r.parciales / r.total) * 100;
    const otros = r.otrosVencidos
      ? `<div class="hito3__mas">Y ${r.otrosVencidos} hito${r.otrosVencidos === 1 ? "" : "s"} más con fecha vencida</div>`
      : "";
    return `
      <div class="hitos-res">
        <div class="hitos-res__top">
          <span><b>${r.pagados}</b> de ${r.total} hitos pagados</span>
          ${r.parciales ? `<span class="hitos-res__par">${r.parciales} pagado${r.parciales === 1 ? "" : "s"} parcialmente</span>` : ""}
        </div>
        <div class="hitos-bar" role="img" aria-label="${r.pagados} de ${r.total} hitos pagados">
          <span class="hitos-bar__pag" style="width:${anchoPag}%"></span><span class="hitos-bar__par" style="width:${anchoPar}%"></span>
        </div>
      </div>
      <ol class="hitos-tres">
        ${fila("anterior", "Anterior", r.anterior, hoy, "Aún no hay hitos pagados.")}
        ${fila("actual", "Actual", r.actual, hoy, "Todos los hitos están pagados.", otros)}
        ${fila("proximo", "Próximo", r.proximo, hoy, "No hay más hitos programados.")}
      </ol>
      <button type="button" class="hitos-ver" data-open-sheet="sheetHitos">Ver todos los hitos (${r.total})</button>`;
  }

  function listaContrato(contrato, hoy) {
    const pag = contrato.hitos.filter(pagado).length;
    const conPct = contrato.hitos.some((h) => h.pct !== null && h.pct !== undefined);
    return `
      <div class="hlista__resumen">
        ${contrato.titulo ? `<div class="hlista__titulo">${esc(contrato.titulo)}</div>` : ""}
        <div class="hlista__cifras">${pag} de ${contrato.hitos.length} hitos pagados${conPct ? ` · ${pctPagado(contrato)} % del contrato pagado` : ""}</div>
      </div>
      <ol class="hlista">
        ${porFecha(contrato.hitos)
          .map((h) => {
            const meta = [
              h.programada ? `Programado: ${fecha(h.programada)}` : "Sin fecha programada",
              h.solicitud ? `Solicitado: ${fecha(h.solicitud)}` : "",
              h.pago ? `Pagado: ${fecha(h.pago)}` : "",
              h.pct !== null && h.pct !== undefined ? `${h.pct} % del contrato` : "",
              h.tipo ? `Evento ${h.tipo.toLowerCase()}` : "",
            ].filter(Boolean);
            return `
              <li class="hl hl--${esc(h.estatus)}">
                <div class="hl__head"><span class="hl__num">${numero(h)}</span>${chip(h)}${vencido(h, hoy) ? marcaVencida : ""}</div>
                <p class="hl__desc">${esc(h.desc)}</p>
                <div class="hl__meta">${meta.map((m) => `<span>${esc(m)}</span>`).join("")}</div>
              </li>`;
          })
          .join("")}
      </ol>`;
  }

  /** Contenido de la ventana "Hitos de pago"; con varios contratos, pestañas. */
  function ventana(proyecto, hoy, activo = 0) {
    const contratos = proyecto ? proyecto.contratos : [];
    if (!contratos.length) return `<div class="state-msg">Sin hitos registrados para este proyecto.</div>`;
    const i = Math.min(Math.max(activo, 0), contratos.length - 1);
    const pestanas =
      contratos.length > 1
        ? `<div class="htabs" role="tablist" aria-label="Contratos">${contratos
            .map(
              (c, k) =>
                `<button type="button" role="tab" class="htab${k === i ? " is-active" : ""}" aria-selected="${k === i}" data-contrato="${k}">${esc(c.nombre || `Contrato ${k + 1}`)}</button>`
            )
            .join("")}</div>`
        : "";
    return `${pestanas}<div role="tabpanel">${listaContrato(contratos[i], hoy)}</div>`;
  }

  const api = { hoyMexico, resumen, vencido, pctPagado, porFecha, tarjeta, ventana, ESTATUS };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else global.CarteraHitos = api;
})(typeof window !== "undefined" ? window : globalThis);
