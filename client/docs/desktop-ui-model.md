# Modelo de interfaz desktop (U Core / cliente web)

Este documento describe **solo convenciones visuales** (espaciado, densidad, alineación) alineadas con patrones habituales en aplicaciones de escritorio profesionales (p. ej. **Fluent Design** en ventanas de contenido, **Apple Human Interface Guidelines** para jerarquía y respiración, **Material** para rejillas y elevación suave). No define flujos de negocio ni estructura de menús.

## Objetivos

1. **Legibilidad a distancia** en pantallas anchas: márgenes laterales generosos y bloques con aire entre ellos.
2. **Densidad coherente**: menos “apretado” en `md+` sin volverse disperso en móvil.
3. **Jerarquía clara**: título → contexto → acciones → contenido, con saltos de 4–8 px entre niveles relacionados y 16–24 px entre secciones.

## Rejilla y espaciado

- **Base mental 8 px**: agrupar márgenes y gaps en múltiplos razonables (`4`, `6`, `8`, `10`, `12`, `16`, `20`, `24` en escala Tailwind).
- **Contenedor principal** en páginas “módulo”: `max-w-5xl mx-auto` + `px-4 md:px-8` y, en desktop, **`md:py-6`** (o `md:pt-*` / `md:pb-*` según la página) para alinear la columna de contenido con la cabecera global.
- **Espacio vertical entre bloques**: `space-y-3` en móvil → **`md:space-y-4` o `md:space-y-5`** cuando hay listas o tarjetas apiladas.
- **Pestañas / tabs**: separar el listado de pestañas del cuerpo con **`md:mt-6`** y relajar el stack interno (`md:space-y-5`).

## Navegación lateral (shell)

- **Zona de marca**: padding superior algo mayor que el resto (`pt-6`) para “ancorar” la app en la esquina.
- **Ítems de navegación**: altura mínima táctil cómoda en desktop (**`min-h-11`**, `py-2.5`) y márgenes horizontales suaves (`mx-1.5 lg:mx-2`) para que la selección no roce el borde del rail.
- **Panel lateral derecho** (detalle / contexto): fondo ligeramente diferenciado (`bg-muted/10`), cabecera del panel con padding horizontal generoso (`px-5 py-3.5`) y etiqueta en mayúsculas con **tracking** amplio en desktop para lectura escaneada.

## Tarjetas y KPIs

- **Tarjetas** en grid: en `md+`, **`md:rounded-xl`**, **`md:p-5`**, sombra muy sutil (`md:shadow-sm`) y anillo ligero opcional (`md:ring-1 md:ring-border/40`) solo donde aporta jerarquía; en **dark** suele bastar con borde y sin sombra fuerte (`dark:md:shadow-none`).
- **KPIs en fila**: más padding vertical en desktop (`md:py-8`) para equilibrar números grandes y etiquetas pequeñas.
- **Separación entre KPI strip, alertas y “próximo evento”**: **`mb-6 md:mb-8`** para que el ojo agrupe por secciones.

## Tipografía (impresión general)

- Evitar tamaños por debajo de **`text-xs`** en UI de lectura en desktop; reservar `text-[10px]` solo para metadatos secundarios, y subir a **`md:text-xs`** cuando el bloque gana área en pantalla ancha.
- Títulos de página: mantener el componente de cabecera existente; el refinamiento va en **márgenes** alrededor (`pb-5 md:pb-8`) más que en nuevos estilos de título sueltos.

## Temas (claro / oscuro / oldschool)

Los tres temas comparten la misma **geometría**; solo cambian tokens de color. Las sombras en modo claro deben ser **bajas opacidad** (`shadow-black/[0.03]`–`0.04`) para no competir con bordes. En oscuro, preferir **borde + contraste suave** antes que sombras densas.

## Checklist al añadir una pantalla nueva

1. Contenedor: `max-w-5xl mx-auto w-full` + `px-4 md:px-8` + `md:py-6` (o coherente con páginas hermanas).
2. Stack principal: `space-y-3 md:space-y-4` (o 5 si hay muchas tarjetas).
3. Grids responsive: no forzar 3 columnas en `md` si el contenido es denso; usar **`md:grid-cols-2 lg:grid-cols-3`**.
4. Un solo nivel de “elevación” por vista: o sombra suave en bloque hero, o en tarjetas, evitando sombras en todos los niveles.

## Referencias externas (lectura)

- [Microsoft Fluent: spacing](https://learn.microsoft.com/en-us/windows/apps/design/style/spacing)
- [Apple HIG: Layout](https://developer.apple.com/design/human-interface-guidelines/layout)
- [Material 3: Understanding layout](https://m3.material.io/foundations/layout/understanding-layout/overview)
