/**
 * text-utils.js (compartido por el portal, cartera-cpel y cartera-mixtos)
 * Utilidades puras de texto, números y fechas. No tocan el DOM, así que
 * también se pueden probar con Node (ver tests/text-utils.test.js).
 *
 * Expone: window.TextUtils
 */
(function (global) {
  /**
   * Normaliza un texto para comparar nombres entre Excel y KML o para
   * buscar: sin acentos, en mayúsculas, sin puntuación redundante y con
   * los espacios colapsados.
   */
  function normalizeText(str) {
    if (str === null || str === undefined) return "";
    return String(str)
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "") // quita acentos
      .toUpperCase()
      .replace(/[.,;:()"'`]/g, "")
      .replace(/\s+/g, " ")
      .trim();
  }

  /** Escapa un valor para insertarlo dentro de HTML (texto o atributo). */
  function esc(value) {
    return String(value ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  /** "$93,931,093.40" -> 93931093.4 · "80 MW" -> 80 · "" -> null */
  function parseNumber(value) {
    if (value === null || value === undefined) return null;
    if (typeof value === "number") return Number.isFinite(value) ? value : null;
    const cleaned = String(value).replace(/[^0-9.,-]/g, "").replace(/,/g, "");
    const num = parseFloat(cleaned);
    return Number.isFinite(num) ? num : null;
  }

  // Nombres de mes en español, para fechas escritas como
  // "31 de diciembre de 2028".
  const MESES_ES = {
    enero: 1, febrero: 2, marzo: 3, abril: 4, mayo: 5, junio: 6,
    julio: 7, agosto: 8, septiembre: 9, setiembre: 9, octubre: 10,
    noviembre: 11, diciembre: 12,
  };

  /**
   * Crea la fecha en HORA LOCAL (no UTC). new Date("2029-01-01") se
   * interpreta como medianoche UTC, que en México todavía es el 31 de
   * diciembre del año anterior; por eso aquí siempre se usa el
   * constructor (año, mes, día). Devuelve null si la fecha no existe
   * (p. ej. 31/02/2027).
   */
  function localDate(y, m, d) {
    const year = Number(y);
    const month = Number(m);
    const day = Number(d);
    const date = new Date(year, month - 1, day);
    if (
      date.getFullYear() !== year ||
      date.getMonth() !== month - 1 ||
      date.getDate() !== day
    ) {
      return null;
    }
    return date;
  }

  /**
   * Acepta "AAAA-MM-DD", "31 de diciembre de 2028", "dd/mm/aaaa" y
   * "dd/mm/aa" (se asume 20aa). Devuelve un Date local o null.
   */
  function parseDate(value) {
    if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value;
    if (!value || typeof value !== "string") return null;
    const s = value.trim();

    const iso = s.match(/(\d{4})-(\d{1,2})-(\d{1,2})/);
    if (iso) return localDate(iso[1], iso[2], iso[3]);

    const largo = s.toLowerCase().match(/(\d{1,2})\s+de\s+([a-záéíóúñ]+)\s+de\s+(\d{4})/);
    if (largo) {
      const mes = MESES_ES[largo[2]];
      return mes ? localDate(largo[3], mes, largo[1]) : null;
    }

    const dmy = s.match(/(\d{1,2})[/-](\d{1,2})[/-](\d{2,4})/);
    if (dmy) {
      let [, d, m, y] = dmy;
      if (y.length === 2) y = "20" + y;
      if (y.length !== 4) return null;
      return localDate(y, m, d);
    }
    return null;
  }

  /** true si la fecha ya pasó o es hoy. */
  function isPastOrToday(date, now = new Date()) {
    if (!date) return false;
    const hoy = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    return date.getTime() <= hoy.getTime();
  }

  /**
   * Identificador para enlaces a partir del nombre de un proyecto:
   * "PH CHICOASÉN II" -> "ph-chicoasen-ii". Sin acentos ni símbolos,
   * así el enlace se puede compartir por WhatsApp o correo sin romperse.
   */
  function slugify(str) {
    return normalizeText(str)
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "");
  }

  /** Fecha corta en español, p. ej. "30 sep 2026" (el mes abreviado varía un poco según el navegador). "" si no es válida. */
  function formatDateShort(date) {
    if (!(date instanceof Date) || Number.isNaN(date.getTime())) return "";
    return date
      .toLocaleDateString("es-MX", { day: "numeric", month: "short", year: "numeric" })
      .replace(/\./g, "");
  }

  /** Ejecuta fn solo cuando dejan de llegar llamadas durante "ms". */
  function debounce(fn, ms) {
    let t = null;
    return function (...args) {
      clearTimeout(t);
      t = setTimeout(() => fn.apply(this, args), ms);
    };
  }

  const api = { normalizeText, esc, parseNumber, parseDate, isPastOrToday, debounce, slugify, formatDateShort };

  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else global.TextUtils = api;
})(typeof window !== "undefined" ? window : globalThis);
