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

## Acceso con contraseña (Cloudflare Pages)

`functions/_middleware.js` protege **todo** el sitio (páginas, scripts,
Excel, KML e imágenes) con una sola contraseña compartida. Solo
funciona cuando el sitio se publica en **Cloudflare Pages**; en GitHub
Pages ese archivo no hace nada y el sitio queda abierto.

- Al entrar se guarda una sesión de 30 días que se renueva sola con el
  uso. El botón **Salir** del portal la cierra.
- **Cambiar la contraseña cierra la sesión de todos** (útil si se
  filtró o si alguien deja el equipo).
- Si la contraseña no está configurada, el sitio queda cerrado (nunca
  abierto por descuido).

### Configuración inicial (una sola vez)

1. Crea una cuenta en <https://dash.cloudflare.com> (de preferencia con
   un correo institucional o compartido del área).
2. **Workers & Pages → Create → Pages → Connect to Git**, autoriza
   GitHub y elige este repositorio y la rama `main`.
3. Configuración de compilación: *Framework preset* **None**, comando
   de compilación **vacío** y como directorio de salida la raíz del
   repositorio. Cloudflare detecta la carpeta `functions/` sola.
4. En el proyecto: **Settings → Variables and Secrets → Add**, tipo
   **Secret**, nombre `SITE_PASSWORD`, con la contraseña como valor.
   Agrégala para *Production* y también para *Preview* (si falta, esas
   versiones quedan cerradas con un aviso).
5. **Deployments → Retry deployment** para que tome la contraseña.
6. Abre la dirección `https://<proyecto>.pages.dev`: debe pedir la
   contraseña.
7. Ya con el sitio nuevo funcionando: vuelve **privado** este
   repositorio (Settings → General → Change visibility) y desactiva
   GitHub Pages. Mientras el repositorio sea público, los Excel y KML
   se pueden descargar directo desde GitHub sin contraseña.

Usa una frase larga (4–5 palabras) como contraseña: el formulario
espera 1.5 s tras cada intento fallido, pero no bloquea por IP.

### Cambiar la contraseña

Settings → Variables and Secrets → edita `SITE_PASSWORD` → Deployments
→ Retry deployment. Todas las sesiones abiertas se cierran.

### Probar en local con contraseña

```bash
npx wrangler pages dev . --binding SITE_PASSWORD="contraseña de prueba"
# abre http://127.0.0.1:8788/
```

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
npm run check   # ESLint + pruebas de text-utils.js y del middleware de contraseña
```

La misma revisión corre en GitHub Actions (`.github/workflows/ci.yml`)
en cada push y pull request.
