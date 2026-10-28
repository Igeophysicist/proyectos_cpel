# Mixtos 2da Ronda

Panel de los proyectos mixtos de la segunda ronda. Es **la misma página
que Mixtos**: `index.html` carga los scripts y estilos de
`../cartera-mixtos/assets/` y solo cambia qué datos lee (atributos
`data-datos` y `data-kml` del `<body>`). Cualquier mejora a Mixtos aparece
aquí también. No tiene presentación en PDF.

Su tarjeta en el portal está **oculta** hasta liberarla: la página ya
funciona en `/cartera-mixtos-2/`. Para mostrarla, quita el
`<template id="accesoMixtos2">` que la envuelve en `index.html`.

## Datos

| Archivo | Qué es |
|---|---|
| `data/DATOS_MIXTOS_2.xlsx` | Fuente de verdad. Se lee la hoja **BASE_DE_DATOS** (encabezados en la fila 3; las demás hojas no se leen). |
| `data/MIXTOS_2.kml` | Un punto por proyecto; el `<name>` de cada punto es su **ID_VUPE**. |
| `data/DATOS_MIXTOS_2.json` | Lo genera la Action "Datos" (`scripts/mixtos2.js`); no se edita a mano. |
| `data/historial.json` | Cortes semanales (domingo a sábado) para el botón Evolución. |

Al convertir el Excel (`scripts/mixtos2.js`):

- Cada proyecto toma los nombres de columna de Mixtos: "Proyecto" →
  título, "Grupo de Interés Económico" → socio, "Municipio, Entidad" →
  ubicación, "Capacidad Neta [MW]" → capacidad. Los cuatro datos de
  almacenamiento (Porcentaje BESS, Almacenamiento BESS [MW], Horas de
  almacenamiento y Energía por horas [MWh]) se muestran por separado.
- **Parque, LT y Global se calculan** con los pesos de los trámites
  (`cartera-mixtos/assets/js/tramites.js`, los mismos de la hoja "Base
  valores"); el grupo de atención sale de Parque, como en Mixtos.
- **Errores** (no se publica nada hasta corregirlos): falta una columna,
  ID_VUPE vacío o repetido, proyecto repetido, PRIORI distinto de P/NoP,
  fecha inválida, estatus que no está en la hoja REGLAS o avance que no
  corresponde a su estatus.
- **Avisos**: un ID_VUPE sin punto en el KML (no aparece en el mapa).

Para editar: cambia el estatus de cada trámite en el Excel (la lista
desplegable ya pone el avance), guarda y súbelo junto con el KML si
cambiaron ubicaciones. Puedes agregar filas arriba de los encabezados o
columnas nuevas sin problema; no renombres los encabezados.

## Diferencias con Mixtos

- Filtro de **Región** (y búsqueda por región e ID VUPE).
- Ficha: Región, ID VUPE y los cuatro datos de almacenamiento.
- El **ranking de prioritarios** no se muestra mientras ningún proyecto
  tenga PRIORI = "P"; aparece solo en cuanto se marque alguno.
- Trámites: el **estatus** de cada trámite con el color de REGLAS.
- No aparece (todavía) en "Últimas actualizaciones" del portal.
