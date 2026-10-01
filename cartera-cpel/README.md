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

## Imprimir o guardar en PDF

El botón **PDF** de la barra superior abre la impresión del navegador
(ahí se elige "Guardar como PDF"). Sale una hoja carta por proyecto
con el encabezado, avance general y particulares, eventos, hitos,
información general, ficha técnica y plazos; sin mapa ni botones.
También funciona con Ctrl+P. Los estilos están en la sección
"Impresión" de `assets/css/cartera.css`. Si los eventos son muy largos,
puede pasar a una segunda hoja.

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
