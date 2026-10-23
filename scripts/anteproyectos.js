/**
 * anteproyectos.js
 * Lee el Excel de Cartera Anteproyectos
 * (cartera-anteproyectos/data/datos_anteproyectos.xlsx) y lo convierte en
 * los datos de la página (data/anteproyectos.json). Lo usa
 * scripts/build-data.js; las funciones son puras (reciben el libro ya
 * abierto con SheetJS) y se prueban en tests/anteproyectos.test.js.
 *
 * HOJAS (los campos pueden aumentar o disminuir sin tocar el código):
 *   PRES   Presentación: No., Proyecto, Tecnología, Ubicación, Imagen
 *          (columnas extra se muestran como datos adicionales).
 *   DESC   Descripción técnica: No., Proyecto, Descripción (texto).
 *   RTA    Red de Transmisión Propuesta: fila de grupos ("Especificaciones
 *          del sistema", "Justificación de la ruta", "Componentes", "Punto
 *          de Interconexión (POI)"...), fila de encabezados y, debajo, las
 *          filas de cada proyecto. Una fila pertenece al proyecto cuyo No.
 *          la cubre (celda combinada o escrita solo en su primera fila).
 *          Los componentes ocupan una fila cada uno.
 *   FICHA_<TIPO>  Ficha técnica: No., Proyecto y una columna por dato.
 *   AVAN_<TIPO>   Avance: No., Proyecto, Tipo de avance (Real /
 *          Programado), GENERAL, "1. …", "1.1 …", "2. …"… y notas
 *          ("NOTA TOTAL", "NOTA (1.2)"). Se muestran tal cual, sin recalcular.
 *   TIPOS  (opcional) Tecnología | Sufijo, para tecnologías nuevas.
 *
 * <TIPO> sale de la tecnología de PRES: Fotovoltaico -> FOTOV, Termosolar
 * -> TERSOL, Eólico -> EO, Equipamiento Hidroeléctrico -> EQUIHIDRO,
 * Hidroeléctrico -> HIDRO (o lo que diga la hoja TIPOS).
 *
 * Los proyectos se relacionan entre hojas por el No. (y si falta, por el
 * nombre). Se limpian los caracteres invisibles que deja copiar desde
 * PowerPoint y los asteriscos de notas al pie en los encabezados.
 */
const { normalizeText, parseNumber, slugify } = require("../assets/js/shared/text-utils.js");

// Tecnología (texto de PRES) -> sufijo de sus hojas. El orden importa:
// "Equipamiento Hidroeléctrico" antes que "Hidroeléctrico".
const TIPOS_BASE = [
  [/EQUIPAMIENTO.*HIDRO/, "EQUIHIDRO"],
  [/HIDRO/, "HIDRO"],
  [/FOTOVOLT/, "FOTOV"],
  [/TERMOSOL|SOLAR TERM/, "TERSOL"],
  [/EOLIC/, "EO"],
];

// Erratas conocidas en encabezados.
const ERRATAS = { COMPONETES: "Componentes" };

const vacio = (v) => v === null || v === undefined || String(v).trim() === "";

/** Texto limpio: sin invisibles, espacios simples por línea, párrafos separados por una línea en blanco. */
function limpiar(v) {
  if (vacio(v)) return "";
  return String(v)
    .replace(/[\u200B-\u200D\uFEFF]/g, "")
    .replace(/\u00A0/g, " ")
    .split(/\r?\n/)
    .map((l) => l.replace(/[ \t]+/g, " ").trim())
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

/** Encabezado limpio: sin asteriscos de nota al pie y con erratas corregidas. */
function encabezado(v) {
  const t = limpiar(v).replace(/\s*\*+\s*$/, "").replace(/\s+/g, " ");
  return ERRATAS[normalizeText(t)] || t;
}

/** Hoja -> filas de texto (tal como se ven en Excel) y función para leer celdas combinadas. */
function tabla(ws, XLSX) {
  if (!ws || !ws["!ref"]) return { filas: [], valor: () => "" };
  const filas = XLSX.utils.sheet_to_json(ws, { header: 1, raw: false, defval: "", blankrows: true });
  const merges = ws["!merges"] || [];
  // Valor de una celda; si está dentro de una combinación, el de su esquina superior izquierda.
  const valor = (r, c) => {
    const m = merges.find((g) => r >= g.s.r && r <= g.e.r && c >= g.s.c && c <= g.e.c);
    const f = m ? filas[m.s.r] : filas[r];
    return f ? f[m ? m.s.c : c] ?? "" : "";
  };
  return { filas, valor };
}

/** Sufijo de hojas de una tecnología, o null. */
function sufijoDe(tecnologia, tipos = []) {
  const t = normalizeText(tecnologia);
  if (!t) return null;
  const propio = tipos.find((x) => normalizeText(x.tecnologia) === t);
  if (propio) return propio.sufijo;
  const directo = [...tipos.map((x) => x.sufijo), ...TIPOS_BASE.map(([, s]) => s)].find((s) => normalizeText(s) === t);
  if (directo) return directo;
  const base = TIPOS_BASE.find(([re]) => re.test(t));
  return base ? base[1] : null;
}

/**
 * Filas de datos de una hoja con encabezados en la fila "fila" (índice) y
 * No./Proyecto en las columnas A y B. Las filas sin No. pertenecen al
 * proyecto anterior (celdas combinadas o escritas solo una vez).
 */
function filasPorProyecto(t, desde) {
  const out = [];
  let no = "";
  let nombre = "";
  for (let r = desde; r < t.filas.length; r++) {
    const fila = t.filas[r] || [];
    if (!fila.some((v) => !vacio(v))) continue;
    const a = limpiar(t.valor(r, 0));
    const b = limpiar(t.valor(r, 1));
    if (a || b) {
      no = a;
      nombre = b;
    }
    if (!no && !nombre) continue;
    out.push({ r, no, nombre, fila: fila.map(limpiar) });
  }
  return out;
}

const pct = (v) => {
  if (vacio(v)) return null;
  const n = parseNumber(v);
  return n === null ? null : Math.round(n * 100) / 100;
};

/** Avance: { general, grupos: [{ clave, titulo, real, prog, nota, items: [...] }], programadoPendiente }. */
function leerAvance(t, filas, donde, errors) {
  const enc = (t.filas[0] || []).map(encabezado);
  const columnas = [];
  const notas = {};
  enc.forEach((h, c) => {
    if (c < 2 || !h) return;
    const n = normalizeText(h);
    if (/^TIPO DE AVANCE/.test(n)) return;
    // Sobre el encabezado original: normalizeText quitaría el punto de "1.2".
    const nota = /^notas?\b\s*(.*)$/i.exec(h.trim());
    if (nota) {
      const num = /(\d+(?:\.\d+)*)/.exec(nota[1]);
      const clave = num ? num[1] : "general";
      notas[c] = clave;
      return;
    }
    const num = /^(\d+(?:\.\d+)*)\.?\s+(.+)$/.exec(h.trim());
    if (/^GENERAL/.test(n)) columnas.push({ c, clave: "general", titulo: "General" });
    else if (num) columnas.push({ c, clave: num[1], titulo: num[2].trim() });
    else columnas.push({ c, clave: h, titulo: h });
  });
  const colTipo = enc.findIndex((h) => /^TIPO DE AVANCE/.test(normalizeText(h)));

  const valores = {};
  const notasTexto = {};
  filas.forEach(({ r, fila }) => {
    const tipo = normalizeText(colTipo >= 0 ? fila[colTipo] : "");
    const lado = /PROG/.test(tipo) ? "prog" : /REAL/.test(tipo) ? "real" : null;
    if (lado) {
      columnas.forEach(({ c, clave }) => {
        const v = fila[c];
        const n = pct(v);
        if (!vacio(v) && n === null) errors.push(`${donde}, fila ${r + 1}: "${v}" no es un porcentaje.`);
        else if (n !== null && (n < 0 || n > 100)) errors.push(`${donde}, fila ${r + 1}: ${v} está fuera de 0–100.`);
        (valores[clave] ??= {})[lado] = n;
      });
    } else if (fila.some((v, c) => c > 1 && !vacio(v) && !notas[c])) {
      errors.push(`${donde}, fila ${r + 1}: el tipo de avance debe ser "Real" o "Programado".`);
    }
    Object.entries(notas).forEach(([c, clave]) => {
      if (fila[c] && !notasTexto[clave]) notasTexto[clave] = fila[c];
    });
  });

  const nodo = ({ clave, titulo }) => ({
    clave,
    titulo,
    real: valores[clave] ? valores[clave].real ?? null : null,
    prog: valores[clave] ? valores[clave].prog ?? null : null,
    ...(notasTexto[clave] ? { nota: notasTexto[clave] } : {}),
  });
  const general = columnas.find((x) => x.clave === "general");
  const grupos = [];
  columnas
    .filter((x) => x.clave !== "general")
    .forEach((x) => {
      const padre = x.clave.includes(".") ? x.clave.split(".").slice(0, -1).join(".") : null;
      const grupo = padre && grupos.find((g) => g.clave === padre);
      if (grupo) grupo.items.push(nodo(x));
      else grupos.push({ ...nodo(x), items: [] });
    });
  const todos = [general && nodo(general), ...grupos.flatMap((g) => [g, ...g.items])].filter(Boolean);
  return {
    general: general ? nodo(general) : null,
    grupos,
    // Sin programa capturado (todo vacío o en 0): la página muestra solo el Real.
    programadoPendiente: todos.every((x) => !x.prog),
  };
}

/** RTA de cada proyecto (por No.). */
function leerRta(t, errors) {
  const filaNo = t.filas.findIndex((f) => /^NO\b/.test(normalizeText((f || [])[0])));
  if (filaNo < 0) {
    errors.push('Hoja "RTA": no se encontró la fila de encabezados (la que empieza con "No.").');
    return { titulo: "", porNo: {} };
  }
  const titulo = encabezado((t.filas.slice(0, filaNo).flat().find((v) => !vacio(v))) || "");
  const filaEnc = filaNo + 1;
  const ancho = Math.max(...t.filas.map((f) => (f || []).length));
  // Grupo de cada columna (celdas combinadas en la fila de grupos).
  const grupos = [];
  for (let c = 2; c < ancho; c++) {
    const g = encabezado(t.valor(filaNo, c));
    const h = encabezado((t.filas[filaEnc] || [])[c]);
    if (!g && !h) continue;
    const ultimo = grupos[grupos.length - 1];
    if (ultimo && ultimo.titulo === g) ultimo.cols.push({ c, h });
    else grupos.push({ titulo: g, cols: [{ c, h }] });
  }
  const tipoDe = (titulo) => {
    const n = normalizeText(titulo);
    if (/ESPECIFICACION/.test(n)) return "especificaciones";
    if (/JUSTIFICACION/.test(n)) return "justificacion";
    if (/COMPONENTE/.test(n)) return "componentes";
    if (/INTERCONEXION|POI/.test(n)) return "poi";
    return "otro";
  };
  // Las filas de cada proyecto empiezan en la de encabezados si ahí está su No. (combinado hacia abajo).
  const filas = filasPorProyecto(t, filaEnc).filter((f) => f.r > filaEnc);
  const porNo = {};
  filas.forEach(({ no, nombre, fila }) => {
    const clave = no || slugify(nombre);
    const p = (porNo[clave] ??= {
      nombre,
      secciones: grupos.map((g) => ({ tipo: tipoDe(g.titulo), titulo: g.titulo, columnas: g.cols.map((x) => x.h), filas: [] })),
    });
    grupos.forEach((g, i) => {
      const valores = g.cols.map((x) => fila[x.c] || "");
      if (valores.some(Boolean)) p.secciones[i].filas.push(valores);
    });
  });
  // Componentes: una fila cada uno; las demás secciones usan su primera fila (pares campo/valor).
  Object.values(porNo).forEach((p) => {
    p.secciones = p.secciones
      .filter((s) => s.filas.length)
      .map((s) =>
        s.tipo === "componentes"
          ? s
          : { tipo: s.tipo, titulo: s.titulo, campos: s.columnas.map((campo, k) => ({ campo, valor: s.filas[0][k] || "" })).filter((x) => x.campo || x.valor) }
      );
  });
  return { titulo, porNo };
}

/** Ficha técnica: [{ campo, valor }] de cada proyecto (por No.). */
function leerFicha(t) {
  const enc = (t.filas[0] || []).map(encabezado);
  const porNo = {};
  filasPorProyecto(t, 1).forEach(({ no, nombre, fila }) => {
    porNo[no || slugify(nombre)] ??= enc.map((campo, c) => ({ campo, valor: fila[c] || "" })).filter((x, c) => c > 1 && x.campo);
  });
  return porNo;
}

/**
 * Lee el libro completo. kml = nombres de los Placemark (para avisar si
 * un proyecto no sale en el mapa); existe(ruta) comprueba imágenes.
 * Devuelve { errors, warnings, titulo, proyectos: [...] }.
 */
function leerAnteproyectos(wb, XLSX, { kml = [], existe = () => true } = {}) {
  const errors = [];
  const warnings = [];
  const hoja = (n) => wb.Sheets[wb.SheetNames.find((s) => normalizeText(s) === normalizeText(n))];

  const pres = tabla(hoja("PRES"), XLSX);
  if (!pres.filas.length) return { errors: ['Falta la hoja "PRES" (presentación de los proyectos).'], warnings, proyectos: [] };
  const encPres = (pres.filas[0] || []).map(encabezado);
  const col = (re) => encPres.findIndex((h) => re.test(normalizeText(h)));
  const cNo = col(/^NO\b|^NUM/);
  const cNombre = col(/^PROYECTO|^NOMBRE/);
  const cTec = col(/^TECNOLOGIA|^TIPO/);
  const cUbi = col(/^UBICACION/);
  const cImg = col(/^IMAGEN|^FOTO/);
  [
    [cNo, "No."],
    [cNombre, "Proyecto"],
    [cTec, "Tecnología"],
  ].forEach(([c, n]) => c < 0 && errors.push(`Hoja "PRES": falta la columna "${n}".`));
  if (errors.length) return { errors, warnings, proyectos: [] };

  const tipos = filasPorProyecto(tabla(hoja("TIPOS"), XLSX), 1)
    .map(({ no, nombre }) => ({ tecnologia: no, sufijo: normalizeText(nombre).replace(/\s+/g, "") }))
    .filter((x) => x.tecnologia && x.sufijo);
  const desc = tabla(hoja("DESC"), XLSX);
  const encDesc = (desc.filas[0] || []).map(encabezado);
  const cDesc = Math.max(2, encDesc.findIndex((h) => /^DESCRIPCION/.test(normalizeText(h))));
  const descripciones = {};
  filasPorProyecto(desc, 1).forEach(({ no, nombre, fila }) => (descripciones[no || slugify(nombre)] ??= fila[cDesc] || ""));
  const rta = tabla(hoja("RTA"), XLSX).filas.length ? leerRta(tabla(hoja("RTA"), XLSX), errors) : { titulo: "", porNo: {} };

  const fichas = {};
  const avances = {};
  const geo = new Set(kml.map(normalizeText));
  const vistos = new Map();
  const proyectos = [];

  filasPorProyecto(pres, 1).forEach(({ r, no, nombre, fila }) => {
    const donde = `Hoja "PRES", fila ${r + 1}`;
    nombre = fila[cNombre];
    no = fila[cNo];
    if (!nombre) return;
    const id = slugify(nombre);
    if (vistos.has(id)) return errors.push(`${donde}: el proyecto "${nombre}" se repite (igual que la fila ${vistos.get(id)}).`);
    vistos.set(id, r + 1);
    const clave = no || id;
    const tecnologia = fila[cTec];
    const tipo = sufijoDe(tecnologia, tipos);
    if (!tipo) {
      errors.push(
        `${donde} (${nombre}): no se reconoce la tecnología "${tecnologia}". Usa Fotovoltaico, Termosolar, Eólico, ` +
          'Equipamiento Hidroeléctrico o Hidroeléctrico, o agrégala en la hoja "TIPOS" (Tecnología | Sufijo).'
      );
      return;
    }
    if (!fichas[tipo]) fichas[tipo] = leerFicha(tabla(hoja(`FICHA_${tipo}`), XLSX));
    if (!avances[tipo]) {
      const t = tabla(hoja(`AVAN_${tipo}`), XLSX);
      const porNo = {};
      const filas = filasPorProyecto(t, 1);
      [...new Set(filas.map((f) => f.no || slugify(f.nombre)))].forEach((k) => {
        porNo[k] = leerAvance(t, filas.filter((f) => (f.no || slugify(f.nombre)) === k), `Hoja "AVAN_${tipo}"`, errors);
      });
      avances[tipo] = porNo;
    }

    let imagen = cImg >= 0 ? fila[cImg] : "";
    if (imagen && !/\.(jpe?g|png)$/i.test(imagen)) {
      warnings.push(`${donde} (${nombre}): la imagen "${imagen}" no es una ruta a JPG o PNG; se muestra sin foto.`);
      imagen = "";
    } else if (imagen && !existe(imagen)) {
      warnings.push(`${donde} (${nombre}): no existe la imagen "${imagen}"; se muestra sin foto.`);
      imagen = "";
    }
    const extras = encPres
      .map((campo, c) => ({ campo, valor: fila[c] || "" }))
      .filter((x, c) => ![cNo, cNombre, cTec, cUbi, cImg].includes(c) && x.campo && x.valor);

    const ficha = fichas[tipo][clave] || null;
    const avance = avances[tipo][clave] || null;
    const red = rta.porNo[clave] || null;
    if (descripciones[clave] === undefined) warnings.push(`${nombre}: no tiene fila en la hoja "DESC".`);
    if (!red) warnings.push(`${nombre}: no tiene filas en la hoja "RTA".`);
    if (!ficha) warnings.push(`${nombre}: no tiene fila en la hoja "FICHA_${tipo}".`);
    if (!avance) warnings.push(`${nombre}: no tiene filas en la hoja "AVAN_${tipo}".`);
    if (!geo.has(normalizeText(nombre))) warnings.push(`${nombre}: no tiene ubicación en el KML; no aparecerá en el mapa.`);

    proyectos.push({
      no,
      nombre,
      tecnologia,
      tipo,
      ubicacion: cUbi >= 0 ? fila[cUbi] : "",
      imagen,
      ...(extras.length ? { extras } : {}),
      descripcion: descripciones[clave] || "",
      rta: red ? { titulo: rta.titulo || "Red de Transmisión Propuesta (RTA)", secciones: red.secciones } : null,
      ficha,
      avance,
    });
  });
  if (!proyectos.length && !errors.length) errors.push('La hoja "PRES" no tiene proyectos.');
  return { errors, warnings, proyectos };
}

/** Avance general de cada proyecto para la curva semanal: { slug: { prog, real } }. */
function snapshotAnteproyectos(proyectos) {
  const out = {};
  proyectos.forEach((p) => {
    const g = p.avance && p.avance.general;
    out[slugify(p.nombre)] = {
      prog: g && !p.avance.programadoPendiente ? g.prog : null,
      real: g ? g.real : null,
    };
  });
  return out;
}

module.exports = { leerAnteproyectos, snapshotAnteproyectos, sufijoDe, limpiar, encabezado };
