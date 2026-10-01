# Portal de Seguimiento CPEL

Sitio estático (HTML/CSS/JS sin build step) publicado en GitHub Pages.

| Ruta | Contenido |
|---|---|
| `index.html` | Portal: accesos, avisos (`data/avisos.json`) y colaboradores (`data/colaboradores.json`). |
| `cartera-mixtos/` | Panel de proyectos mixtos: listado, filtros, mapa y resumen. Ver su [README](cartera-mixtos/README.md). |
| `cartera-cpel/` | Ficha por proyecto de la cartera CPEL. Ver su [README](cartera-cpel/README.md). |
| `assets/js/shared/` | Módulos compartidos por las tres páginas (ver abajo). |

## Módulos compartidos (`assets/js/shared/`)

- `text-utils.js`: normalizar nombres (para vincular Excel ↔ KML y
  buscar), escapar HTML, leer números y fechas. Las fechas siempre se
  crean en hora local para que el 1 de enero no se convierta en el 31
  de diciembre del año anterior.
- `kml-parser.js`: parser KML mínimo (Point, LineString, Polygon).
- `base-map.js`: mapa Leaflet con capas satelital/calles y aviso cuando
  no cargan las imágenes.
- `dialog.js`: abre y cierra paneles emergentes (Escape, foco y
  `aria-hidden`).

## Avisos

Para publicar un aviso, agrega un objeto a `data/avisos.json` con
`fecha` (`AAAA-MM-DD`) y `texto`. El texto se inserta como HTML a
propósito (permite `<b>`, `<br>`), así que solo debe editarlo personal
de confianza.

## Probar en local

```bash
python3 -m http.server 8000
# abre http://localhost:8000/
```

## Revisiones automáticas

Requiere Node.js 22:

```bash
npm install
npm run check   # ESLint + pruebas de assets/js/shared/text-utils.js
```

La misma revisión corre en GitHub Actions (`.github/workflows/ci.yml`)
en cada push y pull request.
