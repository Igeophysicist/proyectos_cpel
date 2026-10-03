# Panel Ejecutivo de Proyectos

Dashboard ejecutivo, geoespacial y responsivo (mobile-first) para el
seguimiento de proyectos de infraestructura. Publicable directamente en
GitHub Pages, sin build step: HTML/CSS/JS planos.

## Por qué este rediseño

La versión anterior era una tabla HTML de una sola columna con un
`<select>`, pensada para un solo proyecto a la vez. Para un uso
ejecutivo (varios proyectos, consulta mayormente desde celular,
necesidad de mapa) esa arquitectura no escalaba: no había manera de
comparar proyectos, filtrar, ver el conjunto agregado ni ubicarlos en
el mapa. Se rediseñó desde cero conservando únicamente la fuente de
datos (hoy `DATOS_MIXTOS.xlsx`) y los colores/identidad de marca
originales (teal, oro, arena).

## Estructura de carpetas

```
cartera-mixtos/
├── index.html                 punto de entrada, único HTML
├── assets/
│   ├── css/
│   │   └── styles.css         sistema de diseño completo
│   └── js/
│       ├── data.js            carga Excel+KML, normaliza, vincula
│       ├── map.js             mapa Leaflet
│       ├── charts.js          gráficos Chart.js
│       ├── filters.js         estado y lógica de filtros
│       ├── ui.js              KPIs, tarjetas, panel de detalle
│       ├── url-state.js       vista actual <-> dirección (enlaces directos)
│       └── app.js             orquestador (conecta todo)
└── data/
    ├── DATOS_MIXTOS.xlsx      fuente de datos ejecutiva (única fuente de verdad)
    ├── DATOS_MIXTOS.json      generado y validado desde el Excel (no editar a mano)
    ├── historial.json         cortes semanales para la evolución (generado)
    ├── actualizaciones.json   cambios de Parque o grupo por día, para el portal (generado)
    ├── ENTRADA_PROYECTOS.kml  puntos de ubicación de cada proyecto
    └── AREAS_REFERENCIA.kml   polígonos de referencia (se vinculan por nombre)
```

Además usa los módulos compartidos de la raíz del sitio
(`../assets/js/shared/`): `text-utils.js` (normalizar nombres, escapar
HTML, leer números y fechas), `kml-parser.js`, `base-map.js` (capas
base del mapa) y `dialog.js` (paneles accesibles: Escape y foco).

Los datos se editan en un archivo **Excel** (`.xlsx`), más cómodo para
cualquiera que use hojas de cálculo. Al subirlo, una GitHub Action lo
valida y lo convierte a `data/DATOS_MIXTOS.json`, que es lo que lee la
página (así el navegador ya no descarga la librería SheetJS). Ver
"Datos: del Excel al sitio" en el README de la raíz.

### Cómo editar los datos

Abre `data/DATOS_MIXTOS.xlsx`:
- Todo va en la hoja **"Proyectos"** — una fila por proyecto. No
  cambies los encabezados de la fila 1 (el código los lee por nombre
  exacto) ni renombres esa hoja.
- La hoja **"Instrucciones"** (dentro del mismo archivo) explica el
  formato esperado de cada columna — en particular, `Parque`/`LT`/
  `Global` y las fechas se guardan como **texto**, no con el formato
  de fecha/porcentaje nativo de Excel, para que se lean tal cual se
  escriben (evita que Excel reinterprete "92%" como 9200%, o una
  fecha según la configuración regional de quien la edite).
- `TÍTULO 2` (o, en su defecto, `TÍTULO 1`) debe coincidir con el
  `<name>` del Placemark en el KML para que ese proyecto aparezca en el
  mapa (ver "Estrategia de vinculación" más abajo).
- Las fechas pueden escribirse como `31 de diciembre de 2028`,
  `31/12/2028` o `2028-12-31`.
- Guarda y publica — no hace falta build step ni conversión.

Cada módulo JS es independiente y solo se comunica a través de un
objeto global (`window.AppData`, `window.AppMap`, etc.), así que se
puede editar o reemplazar uno sin tocar los demás — por ejemplo, si
más adelante cambias de Leaflet a otra librería de mapas, solo se
reescribe `map.js`.

## Tecnologías

- **Sin build step / sin framework**: HTML, CSS y JavaScript planos.
  Es la opción correcta para un sitio que se actualiza únicamente
  editando archivos de datos y se publica en GitHub Pages — un
  proyecto React/Vue añadiría un paso de compilación sin aportar
  beneficio aquí.
- **Leaflet** (mapa) y **Chart.js** (gráficos), cargados por CDN.
  Ambas son ligeras, muy usadas y no requieren licencia.
- **Parser KML propio** (`kml-parser.js`, ~100 líneas) en vez de una
  librería externa (p. ej. `leaflet-omnivore`): los KML de este
  proyecto usan solo `Point`, `LineString` y `Polygon` simples, así
  que un parser propio es más ligero, no depende de un tercero y es
  fácil de auditar. Si en el futuro necesitas geometrías más
  complejas (huecos en polígonos, `MultiGeometry` anidada), ese es el
  único archivo a extender.

## Estrategia de vinculación Excel ↔ KML

El Excel sigue siendo la única fuente de verdad para los datos
ejecutivos. El o los KML solo aportan geometría. La vinculación es
automática, por nombre:

1. Cada proyecto en la hoja "Proyectos" tiene `TÍTULO 2` (con
   `TÍTULO 1` como respaldo si el primero falta o no coincide con
   ningún Placemark).
2. Cada `Placemark` del KML tiene `<name>`.
3. Ambos valores se normalizan (mayúsculas, sin acentos, sin
   puntuación redundante, espacios colapsados) y se comparan.
4. Si coinciden, el proyecto queda geolocalizado. Si no, el proyecto
   se sigue mostrando en KPIs, gráficos y listado — simplemente no
   aparece en el mapa, y el detalle queda en la consola del navegador.

**Esto significa que el único requisito para que un proyecto nuevo
aparezca en el mapa es que su nombre en el KML coincida con
`TÍTULO 2` del Excel.** No hace falta mantener un ID paralelo. Para
agregar más archivos KML, súmalos al arreglo `KML_SOURCES` en
`assets/js/data.js`.

## Evolución por corte

El botón **Evolución** (en cada tarjeta del listado, debajo de la
etiqueta de grupo, y en la ficha junto a "Ver en el mapa") abre un
panel con Parque, LT y Global de cada semana con actualizaciones
(domingo a sábado, un punto con el último dato) y la tendencia de Global
(`assets/js/evolucion.js`, con datos de `data/historial.json`; ver
"Curva de avance" en el README de la raíz). El texto solo indica si
Global avanzó, disminuyó o se mantuvo en el último corte; no hace
predicciones.

## Enlaces directos

La dirección guarda la vista actual: ficha abierta (`?proyecto=san-simon-solar`),
búsqueda (`q`), filtros (`tecnologia`, `estado`, `socio`, `grupo`, `cod`;
se repiten si hay varios valores) y pestaña (`tab`), así que basta con
copiar la dirección para compartir esa vista. Los valores que ya no
existen en el Excel se ignoran al abrir el enlace.

## Filtros

Los filtros se generan dinámicamente a partir de los datos: un campo
(Tecnología, Estado, Socio, Año de COD) solo aparece como filtro si tiene más
de un valor distinto en el dataset actual, para no mostrar controles
inútiles. El filtro por Grupo de atención siempre aparece si hay al
menos un proyecto clasificado. La búsqueda de texto libre cubre
nombre, socio, ubicación y tecnología.

## Experiencia móvil vs. escritorio

- **Móvil (`<900px`)**: tres pestañas (Resumen, Mapa, Proyectos) con
  barra inferior fija, hoja de filtros deslizable desde abajo y panel
  de detalle tipo bottom-sheet.
- **Escritorio (`≥900px`)**: una sola página de scroll continuo
  (KPIs → analítica → mapa → listado completo), panel de filtros
  como popover y panel de detalle deslizado desde la derecha.

## Publicar en GitHub Pages

1. Sube el repositorio completo: esta carpeta depende de
   `../assets/js/shared/`, así que no se puede publicar sola.
2. Settings → Pages → Deploy from branch → selecciona la rama y
   carpeta `/ (root)`.
3. Listo — no hay paso de build.

## Actualizar datos

Edita únicamente `data/DATOS_MIXTOS.xlsx` (hoja "Proyectos") y
el/los KML si cambian ubicaciones, conservando exactamente los mismos
encabezados de columna. El JSON se regenera y valida solo; si el Excel
tiene errores, el sitio sigue con los datos anteriores hasta corregirlo.

## Probar en local antes de publicar

Como la app usa `fetch()` para cargar el Excel y el KML, **no
funciona abriendo `index.html` con doble clic** (bloqueo CORS de
`file://`). Sirve la carpeta con un servidor local, por ejemplo:

```bash
cd raiz-del-repositorio
python3 -m http.server 8000
```

y abre `http://localhost:8000/cartera-mixtos/index.html` (hay que servir
la raíz del repositorio, no solo esta carpeta, por los módulos
compartidos).

## Extensiones sugeridas para más adelante

- Exportar el listado filtrado a Excel/CSV.
- Filtro por rango de fechas (el código ya interpreta las fechas de
  `Inicio de Inversión` / `Fin de Construcción`).
- Capa de agrupación (clustering) en el mapa si el número de
  proyectos crece mucho más allá de unas cuantas decenas.
