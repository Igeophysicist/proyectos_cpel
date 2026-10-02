/**
 * semana-portal.js
 * Pinta la sección "Esta semana" del portal (index.html) con los cálculos
 * de semana-resumen.js. Lee los JSON, historiales y el registro de
 * actualizaciones que genera la Action "Datos"; no hay que capturar nada. Si algo no carga o aún no hay cortes
 * suficientes, la sección (o la tarjeta de ese tablero) no aparece.
 *
 * Requiere: shared/text-utils.js y semana-resumen.js.
 */
(function () {
  const { esc, slugify } = window.TextUtils;
  const { resumenMixtos, resumenCartera } = window.SemanaResumen;

  const MIXTOS = "cartera-mixtos/";
  const CARTERA = "cartera-cpel/";

  const getJson = (url) =>
    fetch(url, { cache: "no-store" }).then((r) => {
      if (!r.ok) throw new Error(url + ": HTTP " + r.status);
      return r.json();
    });

  const fmtPct = (v) => (v === null ? "—" : v.toLocaleString("es-MX", { maximumFractionDigits: 2 }) + "%");
  // Cartera: siempre 2 decimales para que las cifras queden alineadas en la tabla.
  const fmtPct2 = (v) => (v === null ? "—" : v.toLocaleString("es-MX", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + "%");
  const fmtNum = (v) => Math.abs(v).toLocaleString("es-MX", { maximumFractionDigits: 2 });
  const fecha = (s, opts) => {
    const [y, m, d] = s.split("-").map(Number);
    return new Date(y, m - 1, d).toLocaleDateString("es-MX", opts).replace(/\./g, "");
  };
  const fCorta = (s) => fecha(s, { day: "numeric", month: "short" });
  const hoyLocal = () => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  };

  /** Flecha con el cambio (puntos porcentuales). */
  function delta(v) {
    if (v === null) return "";
    if (v === 0) return `<span class="semana-delta semana-delta--igual">= sin cambio</span>`;
    const sube = v > 0;
    return `<span class="semana-delta semana-delta--${sube ? "sube" : "baja"}" aria-label="${sube ? "subió" : "bajó"} ${fmtNum(v)} puntos">${sube ? "▲ +" : "▼ −"}${fmtNum(v)}</span>`;
  }

  const grupo = (g) => `<span class="semana-grupo semana-grupo--${esc(g.toLowerCase())}">${esc(g)}</span>`;

  function grupoLinea(c) {
    if (!c.grupoAhora) return "";
    if (c.grupoAntes && c.grupoAntes !== c.grupoAhora) {
      return `<div class="semana-item__linea">Grupo ${grupo(c.grupoAntes)} → ${grupo(c.grupoAhora)} <b class="semana-item__nota">cambió</b></div>`;
    }
    return `<div class="semana-item__linea">Grupo ${grupo(c.grupoAhora)} <span class="semana-item__nota">se mantuvo</span></div>`;
  }

  /** "Mié 30 sep · 6:10 p.m." (hora de la subida, por si hay varias el mismo día). */
  function cuando(e) {
    const d = new Date(e.excel);
    const dia = fecha(e.fecha, { weekday: "short", day: "numeric", month: "short" }).replace(/,? de /g, " ").replace(",", "");
    const hora = d.toLocaleTimeString("es-MX", { hour: "numeric", minute: "2-digit", timeZone: "America/Mexico_City" });
    return `${dia[0].toUpperCase() + dia.slice(1)} · ${hora}`;
  }

  function htmlMixtos(r) {
    const semana = `del ${fCorta(r.semanaIni)} al ${fCorta(r.semanaFin)}`;
    const n = r.entradas.length;
    const sub = r.esActual
      ? `Semana ${semana} · ${n === 1 ? "1 actualización" : n + " actualizaciones"}`
      : `Última semana con actualizaciones: ${semana}`;
    const entradas = r.entradas
      .map(
        (e) => `
      <li class="semana-entrada">
        <div class="semana-entrada__fecha">${esc(cuando(e))}</div>
        <ul class="semana-list">${e.cambios
          .map(
            (c) => `
          <li class="semana-item">
            <a class="semana-item__nombre" href="${MIXTOS}?proyecto=${encodeURIComponent(c.slug)}">${esc(c.nombre)}</a>
            <div class="semana-item__linea">Parque ${fmtPct(c.antes)} → ${fmtPct(c.ahora)} ${delta(c.diff)}</div>
            ${grupoLinea(c)}
          </li>`
          )
          .join("")}</ul>
      </li>`
      )
      .join("");
    return `
      <div class="semana-card__head">
        <a class="semana-card__titulo" href="${MIXTOS}">Mixtos</a>
        <div class="semana-card__sub">${sub}</div>
      </div>
      <ol class="semana-entradas">${entradas}</ol>
      <div class="semana-card__pie">Cada cambio se compara con el dato anterior del proyecto.</div>`;
  }

  /** Flecha corta para la tabla de Cartera. */
  function flecha(v) {
    if (v === null) return "";
    if (v === 0) return `<span class="semana-delta semana-delta--igual" aria-label="sin cambio">=</span>`;
    return delta(v);
  }

  function htmlCartera(r) {
    const corte = r.esJueves ? fecha(r.fecha, { weekday: "long", day: "numeric", month: "short" }) : fCorta(r.fecha);
    const sub = `Corte del ${corte}` + (r.desde ? ` · cambio vs. ${fCorta(r.desde)}` : "");
    return `
      <div class="semana-card__head">
        <a class="semana-card__titulo" href="${CARTERA}">Cartera CPEL</a>
        <div class="semana-card__sub">${sub}</div>
      </div>
      <table class="semana-tabla">
        <thead><tr><th scope="col">Proyecto</th><th scope="col">Real</th><th scope="col">Prog.</th>${r.desde ? '<th scope="col">Cambio</th>' : ""}</tr></thead>
        <tbody>${r.filas
          .map(
            (f) => `
          <tr>
            <td><a class="semana-item__nombre" href="${CARTERA}?proyecto=${encodeURIComponent(f.slug)}">${esc(f.nombre)}</a></td>
            <td class="semana-real">${fmtPct2(f.real)}</td>
            <td>${fmtPct2(f.prog)}</td>
            ${r.desde ? `<td>${flecha(f.cambio)}</td>` : ""}
          </tr>`
          )
          .join("")}</tbody>
      </table>`;
  }

  function pintar(id, html) {
    const el = document.getElementById(id);
    if (!el || !html) return false;
    el.innerHTML = html;
    el.hidden = false;
    return true;
  }

  async function mixtos() {
    const { registros } = await getJson(MIXTOS + "data/actualizaciones.json");
    const r = resumenMixtos(registros, hoyLocal());
    return r && htmlMixtos(r);
  }

  async function cartera() {
    const [datos, hist] = await Promise.all([getJson(CARTERA + "data/datos_proyectos.json"), getJson(CARTERA + "data/historial.json")]);
    const proyectos = datos.proyectos
      .map((p) => String(p.nombre || "").trim())
      .filter(Boolean)
      .map((nombre) => ({ slug: slugify(nombre), nombre }));
    const r = resumenCartera(hist.cortes, proyectos);
    return r && htmlCartera(r);
  }

  async function init() {
    const seccion = document.getElementById("semana");
    if (!seccion) return;
    const [m, c] = await Promise.allSettled([mixtos(), cartera()]);
    [m, c].forEach((res) => res.status === "rejected" && console.error("Esta semana:", res.reason));
    const okM = m.status === "fulfilled" && pintar("semanaMixtos", m.value);
    const okC = c.status === "fulfilled" && pintar("semanaCartera", c.value);
    seccion.hidden = !(okM || okC);
  }

  document.addEventListener("DOMContentLoaded", init);
})();
