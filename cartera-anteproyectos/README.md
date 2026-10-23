# Cartera Anteproyectos

Ficha por anteproyecto, con el mismo diseño que Cartera CPEL (reutiliza
sus estilos, el mapa, la curva de avance y el PDF de `../cartera-cpel/`).

| Archivo | Uso |
|---|---|
| `data/datos_anteproyectos.xlsx` | Los datos (se editan aquí). |
| `data/ANTEPROYECTOS.kml` | Ubicación: un punto por proyecto; el `<name>` del Placemark debe coincidir con el nombre del proyecto (sin importar acentos ni mayúsculas). |
| `data/IMAGENES/` | Fotos de encabezado (JPG/PNG). La Action "Datos" las reduce a 1200 px y les quita los metadatos. |
| `data/anteproyectos.json`, `data/historial.json` | Generados por la Action "Datos" (no se editan). |

## El Excel

Cinco tipos de hoja; los proyectos se relacionan entre hojas por el **No.**
En pantalla el orden es: presentación, avance general y particulares,
descripción técnica, RTA y mapa.
Las columnas pueden aumentar o disminuir: la página muestra lo que haya.

| Hoja | Tarjeta | Cómo se lee |
|---|---|---|
| `PRES` | 1. Presentación | No., Proyecto, Tecnología, Ubicación, Imagen (ruta, p. ej. `data/IMAGENES/cayacal.jpg`). Columnas extra se muestran bajo la descripción. |
| `DESC` | 2. Descripción técnica | No., Proyecto, Descripción. Las líneas en blanco separan párrafos; "1. …" y "•" hacen listas. |
| `RTA` | 3. Red de Transmisión Propuesta | Fila de grupos (Especificaciones del sistema, Justificación de la ruta, Componentes, Punto de Interconexión) y fila de encabezados; debajo, las filas de cada proyecto (su No. combinado o solo en su primera fila). Cada componente, una fila. |
| `FICHA_<TIPO>` | 4. Ficha técnica (botón) | No., Proyecto y una columna por dato. |
| `AVAN_<TIPO>` | 5. Avance | No., Proyecto, Tipo de avance (Real / Programado), GENERAL, "1. …", "1.1 …"… y notas ("NOTA TOTAL", "NOTA (1.2)"). Se muestran tal cual, sin recalcular, en dos tarjetas: **Avance General** (con la NOTA TOTAL) y **Avances particulares** ("1. …", "2. …"; al tocarlos se abren sus avances ponderados "1.1 …" con sus notas, en rojo). Mientras el programado esté en ceros se muestra "pendiente". |
| `TIPOS` (opcional) | — | Tecnología \| Sufijo, para tecnologías nuevas. |

`<TIPO>` sale de la tecnología: Fotovoltaico → `FOTOV`, Termosolar →
`TERSOL`, Eólico → `EO`, Equipamiento Hidroeléctrico → `EQUIHIDRO`,
Hidroeléctrico → `HIDRO`. Para otra tecnología, agrega sus hojas
`FICHA_…` y `AVAN_…` y una fila en `TIPOS` (p. ej. `Geotérmico | GEO`).

Se limpian solos los caracteres invisibles que deja copiar desde
PowerPoint y los asteriscos de notas al pie en los encabezados.

Curva de avance: corte semanal (jueves 8:00, como Cartera CPEL) del
avance GENERAL. Lectura del Excel en `scripts/anteproyectos.js`.
