# Cartera CPEL

Ficha por proyecto de la cartera CPEL: avance programado vs. real,
avances particulares, eventos importantes, hitos, información general,
ubicación en el mapa, ficha técnica y plazos. Se elige el proyecto en
el selector de la barra superior.

## Estructura

```
cartera-cpel/
├── index.html
├── assets/
│   ├── css/cartera.css         estilos propios (usa los tokens de ../assets/css/landing.css)
│   └── js/
│       ├── cartera.js          lee el JSON y pinta la ficha del proyecto
│       ├── pdf.js              botón "PDF" (imprimir / archivo en celular)
│       └── map.js              mapa Leaflet de un proyecto a la vez
└── data/
    ├── datos_proyectos.xlsx    fuente de datos (primera hoja) — se edita este
    ├── datos_proyectos.json    generado y validado desde el Excel (no editar a mano)
    ├── historial.json          cortes semanales para la curva de avance (generado)
    ├── CARTERA-CPEL.kml        ubicación de cada proyecto (vinculada por nombre)
    ├── CARTERA-CPEL-POLIGONOS.kml  polígonos de secuencias ("... SEC III", etc.)
    └── CARTERA-CPEL/*.jpg      imágenes de encabezado
```

También usa los módulos compartidos de `../assets/js/shared/`
(`text-utils.js`, `kml-parser.js`, `base-map.js`, `dialog.js`).

## Cómo editar los datos

Abre `data/datos_proyectos.xlsx`. Una fila por proyecto; los
encabezados de la fila 1 se leen por nombre exacto. Al subirlo, se
valida y se genera `datos_proyectos.json` automáticamente (ver "Datos:
del Excel al sitio" en el README de la raíz).

| Columnas | Uso |
|---|---|
| `nombre`, `tecnologia`, `ubicacion` | Encabezado. `nombre` debe coincidir con el `<name>` del Placemark en `CARTERA-CPEL.kml` para que aparezca en el mapa (sin importar acentos ni mayúsculas). |
| `imagen` | Ruta de la imagen, p. ej. `data/CARTERA-CPEL/AMATA.jpg`. Usa JPG de ~1200 px de ancho como máximo. |
| `avanceProg`, `avanceReal` | Avance general (número o `"30.5%"`). |
| `prog<X>`, `real<X>` | Avances particulares (`Ing`, `Sum`, `Cons`, `Pps`). Ver `PARTICULARES` en `cartera.js`. |
| `hitoN_num`, `hitoN_titulo`, `hitoN_fecha`, `hitoN_desc` | Hitos. Se muestran tantos como columnas `hitoN_*` existan: para un quinto hito, agrega `hito5_*`. |
| `eventos_importantes` | Texto libre. |
| `desarrollador`, `inversion`, `fuenteRecursos` | Información general. |
| `plazo_*` | Ventana "Plazos". Las fechas (`dd/mm/aaaa`) que ya pasaron se marcan en la línea de tiempo. |
| `ft_*` / `ht_*` | Ficha técnica fotovoltaica / hidroeléctrica, según el texto de `tecnologia`. Ver `TECH_SPECS` en `cartera.js` para agregar otra tecnología. |

## Curva de avance

El tercer botón de la barra inferior abre la **Curva de avance** del
proyecto: Programado y Real de cada corte semanal (jueves 8:00) y una línea de
tendencia (ritmo reciente proyectado). Los cortes salen de
`data/historial.json`, que se actualiza solo con cada Excel (ver "Curva
de avance" en el README de la raíz). Lógica en `assets/js/curva.js`.

## Ficha en PDF

El botón **PDF** de la barra superior entrega la ficha del proyecto en
**una sola hoja** (ancho carta; si el contenido no cabe en el alto
carta, la hoja se alarga en vez de partirse): encabezado, avance general y particulares, eventos,
hitos, información general, ficha técnica y plazos; sin mapa ni
botones.

- **Computadora:** abre la impresión del navegador (ahí se elige
  "Guardar como PDF" o una impresora). También funciona con Ctrl+P.
- **Celular:** genera el archivo `Cartera_<proyecto>_<fecha>.pdf` en la
  página y abre el menú de compartir del teléfono (guardar en Archivos,
  WhatsApp, correo…); si el teléfono no tiene ese menú, lo descarga. Se
  hace así porque en el celular la impresión no funciona en varios
  casos (sitio instalado como app en iPhone, navegadores dentro de
  WhatsApp, Teams o Gmail). Las librerías para esto (html2canvas y
  jsPDF, ~560 KB) se descargan solo la primera vez que se toca el botón.

Lógica en `assets/js/pdf.js`; estilos de la hoja en la sección "Ficha
en PDF" de `assets/css/cartera.css` (`body.modo-pdf`), compartidos por
ambas salidas.

## Enlace directo y fecha de los datos

- La dirección lleva el proyecto seleccionado (`?proyecto=ph-chicoasen-ii`,
  a partir de la columna `nombre`), así que basta con copiarla para
  compartir el proyecto. Si cambia el nombre en el Excel, el enlace viejo
  abre el primer proyecto.
- "Datos al …" (en el encabezado) es la fecha de último guardado del
  Excel.

## Probar en local

Sirve la **raíz del repositorio** (no solo esta carpeta):

```bash
python3 -m http.server 8000
```

y abre `http://localhost:8000/cartera-cpel/index.html`.
