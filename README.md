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
2. **Workers & Pages → Create** y busca la opción de **Pages** (pestaña
   "Pages" o el enlace *"Looking to deploy Pages? Get started"*) →
   **Import an existing Git repository** → este repositorio → **Begin
   setup**.

   > ⚠️ **No uses "Import a repository" de Workers.** Eso crea un
   > *Worker*, no un proyecto de Pages: el despliegue corre
   > `npx wrangler deploy`, ignora la carpeta `functions/` (el sitio
   > quedaría **sin contraseña**) e intenta publicar `node_modules`,
   > por lo que falla con *"Asset too large"*. Si te pasa, borra ese
   > Worker (Settings → Delete) y crea el proyecto de Pages.
3. Configuración de compilación:

   | Campo | Valor |
   |---|---|
   | Production branch | `main` |
   | Framework preset | **None** |
   | Build command | vacío |
   | Build output directory | vacío (la raíz); si no lo acepta, `/` |

   En **Environment variables (advanced)** agrega
   `SKIP_DEPENDENCY_INSTALL` = `1`, para que Cloudflare no instale ni
   publique las herramientas de desarrollo (`node_modules`).

   En el log del despliegue **no** deben aparecer
   `npx wrangler deploy` ni `Installing project dependencies`, y debe
   detectar la carpeta `functions`. El primer despliegue muestra
   "Falta configurar SITE_PASSWORD": es lo esperado.
4. En el proyecto: **Settings → Variables and Secrets → Add**, tipo
   **Secret**, nombre `SITE_PASSWORD`, con la contraseña como valor.
   Agrégala para *Production* y también para *Preview* (si falta, esas
   versiones quedan cerradas con un aviso).
5. **Deployments → Retry deployment** para que tome la contraseña.
6. Comprueba en `https://<proyecto>.pages.dev`:
   - pide contraseña; una equivocada muestra error y la correcta entra;
   - Mixtos y Cartera cargan y el portal muestra el botón **Salir**;
   - en una ventana de incógnito,
     `/cartera-mixtos/data/DATOS_MIXTOS.xlsx` **no** se descarga.
7. Comparte el link y la contraseña por canales distintos y avisa la
   fecha en que dejará de funcionar el link de GitHub Pages.
8. Llegada esa fecha: desactiva GitHub Pages (Settings → Pages) y
   vuelve **privado** este repositorio (Settings → General → Change
   visibility). Mientras el repositorio sea público, los Excel y KML
   se pueden descargar directo desde GitHub sin contraseña.
9. Haz un cambio pequeño (p. ej. un aviso) y confirma que aparece una
   publicación nueva en **Deployments**. Si no, en GitHub: Settings →
   Applications → Cloudflare Workers and Pages → Configure, y agrega
   este repositorio.

No escribas el link de Cloudflare ni la contraseña en el repositorio
(avisos, README, commits) mientras sea público.

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
