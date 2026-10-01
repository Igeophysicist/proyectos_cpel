/**
 * exportar.js
 * Botón "Descargar Excel" del listado: genera un .xlsx con los proyectos
 * que se están viendo (búsqueda y filtros aplicados), con las mismas
 * columnas del Excel original. Parque, LT y Global van como porcentaje
 * numérico para poder ordenar y sumar en Excel. Una segunda hoja
 * ("Información") dice la fecha de los datos y los filtros aplicados.
 *
 * SheetJS (versión reducida, ~250 KB) se descarga solo la primera vez
 * que se toca el botón.
 *
 * Requiere: shared/text-utils.js.
 * Expone: window.AppExportar.descargar(projects, { search, filtros, fechaDatos })
 */
(function (global) {
  const SHEETJS = {
    src: "https://cdn.jsdelivr.net/npm/xlsx@0.18.5/dist/xlsx.mini.min.js",
    integrity: "sha384-6fBkVFQw1YKyYpZpKf7bguegzeJqso45fTePEWGNuVaGy70fxEhICA/yswrPjW4+",
  };
  const PORCENTAJES = ["Parque", "LT", "Global"];
  const { parseNumber } = global.TextUtils;

  let sheetJsPromise = null;

  function loadSheetJs() {
    if (global.XLSX) return Promise.resolve();
    if (!sheetJsPromise) {
      sheetJsPromise = new Promise((resolve, reject) => {
        const s = document.createElement("script");
        s.src = SHEETJS.src;
        s.integrity = SHEETJS.integrity;
        s.crossOrigin = "anonymous";
        s.onload = resolve;
        s.onerror = () => {
          sheetJsPromise = null; // permite reintentar
          reject(new Error("No se pudo cargar SheetJS"));
        };
        document.head.appendChild(s);
      });
    }
    return sheetJsPromise;
  }

  /** Columnas en el orden del Excel original (unión de todas las filas). */
  function columnas(projects) {
    const cols = [];
    projects.forEach((p) => Object.keys(p.raw).forEach((k) => cols.includes(k) || cols.push(k)));
    return cols;
  }

  function hojaProyectos(X, projects) {
    const cols = columnas(projects);
    const ws = X.utils.aoa_to_sheet([cols, ...projects.map((p) => cols.map((c) => p.raw[c] ?? ""))]);
    // Porcentajes como número con formato %, no como texto "81.50%".
    PORCENTAJES.forEach((col) => {
      const c = cols.indexOf(col);
      if (c < 0) return;
      projects.forEach((p, i) => {
        const n = parseNumber(p.raw[col]);
        if (n === null) return;
        ws[X.utils.encode_cell({ r: i + 1, c })] = { t: "n", v: n / 100, z: "0.00%" };
      });
    });
    ws["!cols"] = cols.map((c) => ({
      wch: Math.min(45, Math.max(c.length, ...projects.map((p) => String(p.raw[c] ?? "").length)) + 2),
    }));
    ws["!autofilter"] = { ref: ws["!ref"] };
    return ws;
  }

  function hojaInfo(X, n, { search, filtros, fechaDatos }) {
    return X.utils.aoa_to_sheet([
      ["Panel Mixtos"],
      [],
      ["Datos al", fechaDatos || "—"],
      ["Descargado", new Date().toLocaleString("es-MX")],
      ["Proyectos", n],
      ["Búsqueda", search || "(ninguna)"],
      ["Filtros", filtros.length ? filtros.join("; ") : "(ninguno)"],
    ]);
  }

  const hoy = () => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  };

  /**
   * Descarga el .xlsx. "filtros": textos como "Tecnología: FV - Fotovoltaica".
   * Devuelve una promesa (rechaza si no se pudo cargar SheetJS).
   */
  async function descargar(projects, info) {
    await loadSheetJs();
    const X = global.XLSX;
    const wb = X.utils.book_new();
    X.utils.book_append_sheet(wb, hojaProyectos(X, projects), "Proyectos");
    X.utils.book_append_sheet(wb, hojaInfo(X, projects.length, info), "Información");
    const filtrado = info.search || info.filtros.length ? "_filtrado" : "";
    X.writeFile(wb, `Mixtos_${hoy()}${filtrado}.xlsx`);
  }

  global.AppExportar = { descargar };
})(window);
