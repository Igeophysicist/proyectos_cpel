# Portal de Seguimiento CPEL

Sitio estático (HTML/CSS/JS sin build step) publicado en GitHub Pages.

| Ruta | Contenido |
|---|---|
| `index.html` | Portal: accesos, sección "Esta semana" y colaboradores (`data/colaboradores.json`). |
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

## Datos: del Excel al sitio

Los datos se siguen editando en los **Excel** de cada tablero
(`cartera-cpel/data/datos_proyectos.xlsx`,
`cartera-mixtos/data/DATOS_MIXTOS.xlsx`). Las páginas no leen el Excel:
leen un **JSON** que se genera y **valida** automáticamente.

1. Subes el Excel (o un KML) a GitHub, como siempre.
2. La GitHub Action **Datos** (`.github/workflows/datos.yml`) revisa el
   Excel con `scripts/build-data.js`.
3. **Si está bien:** agrega un commit "Actualiza datos (JSON) desde
   Excel" y Cloudflare publica los datos nuevos (1–2 minutos).
4. **Si hay errores:** el commit queda con ❌, GitHub te avisa por correo
   y **el sitio sigue mostrando los datos anteriores**. Para ver qué
   corregir: pestaña **Actions** → la ejecución "Datos" en rojo → el
   resumen lista cada error con **fila y columna** del Excel. Corrige
   y vuelve a subir el Excel.

Qué se revisa (`scripts/data-rules.js`):

| Errores (bloquean la publicación) | Avisos (solo se reportan) |
|---|---|
| Falta una columna que usa la página (renombrada o borrada) | Proyecto sin ubicación en el KML (no sale en el mapa) |
| Porcentaje que no es número o fuera de 0–100 | |
| Fecha que no se puede leer | |
| Proyecto repetido | |
| Imagen que no existe o que no es JPG/PNG, p. ej. HEIC (Cartera) | |
| Grupo de atención distinto de A, B o C (Mixtos) | |

Las celdas vacías y los marcadores de dato pendiente ("SIN DATO",
"N/A", "PENDIENTE", "POR DEFINIR", "-") no son errores.

### Imágenes de Cartera CPEL

Las imágenes de encabezado (`cartera-cpel/data/CARTERA-CPEL/`) se suben
tal cual, aunque sean fotos pesadas de celular. La Action **Datos** las
optimiza (`scripts/imagenes.js`): ancho máximo de 1200 px, giradas
según la cámara, **sin metadatos** (se borra la ubicación GPS de las
fotos) y con el **mismo nombre**, así que la columna `imagen` del Excel
no cambia. Sube la versión ligera en un commit "Optimiza imágenes de
Cartera CPEL". Las que ya están optimizadas no se tocan, y el original
queda en el historial de GitHub.

Usa **JPG** o PNG. Las fotos **HEIC** del iPhone no se ven en Chrome ni
en Android: la validación las marca como error. Para que el iPhone
guarde JPG: Ajustes → Cámara → Formatos → "Más compatible".

**No edites los JSON a mano:** se sobrescriben con cada Excel. Para
revisar un Excel antes de subirlo: `npm install` y luego `npm run data`
(valida, regenera y optimiza imágenes) o `npm run data:check` (solo
revisa).

## Curva de avance (cortes semanales)

- **Cartera CPEL:** botón **Curva de avance** (junto a Ficha técnica y
  Plazos). **Mixtos:** botón **Evolución** en cada tarjeta del listado
  (debajo de la etiqueta de grupo) y en la ficha; abre un panel con
  Parque, LT y Global.
- **Un punto por semana.** La Action "Datos" guarda el avance en
  `data/historial.json` de cada tablero (`scripts/historial.js`) según
  la fecha de guardado del Excel (hora de México). Lo guardado después
  dentro de la misma semana **reemplaza** ese punto (cada Excel trae la
  hoja completa). Subir solo un KML (sin cambiar el Excel) no agrega
  puntos.
  - **Cartera CPEL:** corte cada **jueves a las 8:00**; lo guardado de
    jueves 8:00 al jueves siguiente 7:59 es el punto de ese jueves.
  - **Mixtos:** se actualiza lunes, miércoles y viernes; la semana va
    de **domingo a sábado** y el punto queda en el día de la última
    actualización. Las semanas sin actualizaciones no tienen punto.
- Los cortes previos a esta regla (24–30 sep 2026, reconstruidos de las
  versiones anteriores de los Excel) se conservan en la fecha en que se
  guardó su Excel.
- **Tendencia** (línea punteada): recta ajustada a los últimos 6 cortes
  reales (`assets/js/shared/trend.js`), es decir, el ritmo reciente
  proyectado. En **Cartera** el resumen muestra el ritmo en pts/semana,
  cuándo llegaría a 100% y cuánto llevaría en la fecha de operación (con
  menos de 4 cortes, la fecha se marca como estimación preliminar). En
  **Mixtos** solo dice si Global avanzó, disminuyó o se mantuvo en el
  último corte, sin fechas estimadas: esos proyectos aún son volátiles.
  La tendencia no sustituye al programa de obra.
- Los proyectos se identifican por su nombre: si se renombra en el
  Excel, su historial empieza de nuevo.
- Para quitar un corte que quedó mal, se borra su bloque en
  `data/historial.json` (o pídeselo a quien mantenga el sitio).

## Esta semana (portal)

Sección del portal, debajo de los accesos, que se arma sola con los
datos que genera la Action (`assets/js/semana-resumen.js` calcula y
`assets/js/semana-portal.js` pinta):

- **Mixtos:** lista cronológica de las actualizaciones de la semana
  (domingo a sábado), **la más reciente arriba**, con fecha y hora. En
  cada una, los proyectos cuyo avance de **Parque** o **grupo de
  atención** cambió, **comparados con su dato anterior**, y si el grupo
  cambió o se mantuvo. Las subidas del **mismo día se juntan** en una
  sola entrada (una corrección minutos después no sale aparte: cada
  proyecto se compara con cómo estaba antes de la primera subida del
  día). La semana no se vacía
  el domingo: se sigue mostrando hasta que llega una actualización de
  otra semana. Los datos salen de `cartera-mixtos/data/actualizaciones.json`,
  que la Action llena sola en cada subida que cambia Parque o grupo
  (`scripts/historial.js`).
- **Cartera CPEL:** tabla compacta con el avance **Real** y
  **Programado** de cada proyecto en el último corte y una flecha con
  el cambio del Real contra el corte anterior.

Cada nombre abre la ficha del proyecto. Si los datos no cargan, la
sección no aparece.

## Enlaces directos y fecha de los datos

- **Enlaces directos:** la dirección de cada tablero refleja lo que se
  está viendo, así que basta con copiarla y compartirla:
  - Cartera CPEL: `cartera-cpel/?proyecto=ph-chicoasen-ii`
  - Mixtos: `cartera-mixtos/?proyecto=san-simon-solar` (ficha abierta) o
    una vista filtrada, p. ej. `?tecnologia=EO%20-%20Eólica&q=noria&tab=mapa`.

  El identificador sale del nombre del proyecto (sin acentos ni
  símbolos). Si alguien abre un enlace sin sesión, después de la
  contraseña llega a la misma vista.
- **"Datos al …":** es la fecha en que se guardó por última vez el
  Excel de cada tablero (Cartera: en el encabezado del proyecto; Mixtos:
  bajo el título de la barra superior). Se actualiza sola al subir un
  Excel nuevo; no hay que capturarla.

## Modo app (instalable)

El sitio se puede instalar en el celular o la computadora como una app
(`manifest.json` + íconos en `assets/img/icon-*.png`).

- **Android / Chrome / Edge:** menú del navegador → *Instalar app* o
  *Agregar a pantalla de inicio*.
- **iPhone / iPad (Safari):** botón Compartir → *Agregar a inicio*.

`sw.js` (Service Worker, registrado por `assets/js/shared/pwa.js`):

- **Siempre la versión más reciente:** páginas, CSS, JS e imágenes del
  sitio se piden primero al servidor; la copia guardada solo se usa sin
  conexión. No hace falta cambiar nada al publicar.
- **Sin conexión:** abren las páginas ya visitadas en ese dispositivo;
  las demás muestran un aviso. Los **datos** (`/data/`: Excel, KML,
  JSON) **nunca** se guardan, así que sin conexión las páginas abren
  pero sin datos.
- Las librerías de CDN se guardan porque su URL incluye la versión
  (cambiar de versión = cambiar la URL en el HTML).
- **Salir** borra todo lo guardado y desactiva el Service Worker en ese
  dispositivo.
- `VERSION` en `sw.js` solo se cambia si se modifica la lógica del
  propio `sw.js` (borra lo guardado por la versión anterior).

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
9. Haz un cambio pequeño (p. ej. en este README) y confirma que aparece una
   publicación nueva en **Deployments**. Si no, en GitHub: Settings →
   Applications → Cloudflare Workers and Pages → Configure, y agrega
   este repositorio.

No escribas el link de Cloudflare ni la contraseña en el repositorio
(README, commits, datos) mientras sea público.

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
