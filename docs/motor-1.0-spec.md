# Motor 1.0 — especificación teórica (proyecto de planificación, NO implementación)

> Estado: borrador de planificación, 2026-09-10. No se ha escrito ni una línea de código de este motor. Este documento nace directamente de la auditoría real de `motor-v2.1.ts`, `motor-v4.ts` y `mock-data.ts` (ver `auditoria-u-scout-completa.md`) — no repite esa auditoría, la usa como insumo.
>
> Decisión ya tomada por Pablo (2026-09-10): no tocar los motores actuales para arreglarlos. Construir un motor nuevo, único, "1.0 de verdad", que sustituya a los dos existentes, aprovechando que las herramientas (Claude, Cursor) han mejorado desde que se escribió v2.1 (abril 2026).

---

## 1. Qué NO es este documento

- No es una implementación. Cero código de producto.
- No es una decisión de arquitectura de software (Supabase/React/etc.) — eso ya está fijado por el resto de U Core.
- No sustituye el criterio de producto de Pablo sobre baloncesto — donde este documento propone un comportamiento del motor, es una propuesta a validar, no una imposición.

## 2. Qué SÍ es

Un documento de especificación para que, en una sesión dedicada (probablemente con Cursor haciendo la implementación pesada, guiado por prompts completos), se construya un motor nuevo que:
1. Sustituye tanto a `motor-v2.1.ts`/`motor-v4.ts` como a la lógica standalone de `mock-data.ts` (`generateProfile`) — **una sola fuente de verdad**, elimina el bug de los dos motores documentado en la auditoría.
2. Conserva lo que ya funciona bien de los motores actuales (verificado en la auditoría, no se tira todo).
3. Mejora la UX de captura (staff) y de lectura (jugadora).
4. Incorpora estadísticas reales de U Stats donde exista un dato real disponible — nunca inventa un dato que no exista.

---

## 3. Lo que SÍ conservar de los motores actuales (verificado en la auditoría, no hay que reinventarlo)

- **El principio de "nunca inferir observación del scout"** (`INFERENCE_RULES.neverInfer` de v2.1): campos como dirección de ISO, hombro de post, tipo de corte — son observación pura del staff, un modelo estadístico no debe inventarlos. Motor 1.0 debe mantener esta distinción explícita entre "campo observado" y "campo inferido/calculado".
- **La idea de un ranking por situación con un tope anti-inflación** (`calculateThreatScores()`: máximo por situación + cap a 0,72 si hay ≥2 situaciones primarias). La lógica es sólida, solo hay que llevarla a una única implementación.
- **Calibración contra literatura real cuando existe** — ya hay dos casos verificados en el código actual (peso de `cut` = 0,72 citando 1,58 PPP de Synergy EuroLeague; comentario "ISO is statistically one of the least efficient play types"). Motor 1.0 debe mantener y ampliar esta práctica — cada peso base debería, donde sea posible, tener un comentario de origen (dato real o "criterio de staff sin dato externo", explícito).
- **El formato de informe de 3 slides** (¿Quién es? / ¿Qué hará? / ¿Qué hago yo?) — ya validado como decisión de producto en `u-scout-design-decisions.md`, no hay motivo para cambiarlo salvo que la UX de lectura (sección 6) sugiera algo mejor.
- **El flujo de aprobación** (edición privada → coach revisa/aprueba → staff ve discrepancias → cualquier coach publica) — el proceso es bueno, el problema detectado era que dos motores generan `itemKey`s distintos para el mismo concepto. Con un solo motor, ese problema desaparece por construcción.

## 4. Lo que Motor 1.0 debe arreglar de raíz (no parchear)

- **Una sola implementación**, no dos. Nada de "legacy + oficial" — todo consumidor (editor, quick scout, informe de jugadora, informe de coach) llama a la misma función.
- **Naming consistente de principio a fin**: un solo esquema de `key`/`itemKey` para archetypes, outputs y situaciones — que además sea estable en el tiempo (si cambia el algoritmo interno, el `key` de un concepto no debería cambiar arbitrariamente, para no romper `report_overrides` históricos).
- **Un solo idioma base en las plantillas de texto**, con el sistema de i18n aplicado de forma consistente (la auditoría encontró plantillas ya en español mezcladas con plantillas en inglés dentro del mismo catálogo — inconsistencia a eliminar).
- **Sin acoplamiento a React/browser en el núcleo de cálculo** (la auditoría encontró que `mock-data.ts` arrastra un `window.addEventListener` a nivel de módulo solo por estar en el mismo archivo que los hooks de datos — el cálculo puro debe vivir separado de los hooks de React Query, en su propio archivo sin dependencias de navegador, para poder testearlo con Node/Vitest sin trucos de `happy-dom`).
- **Catálogo de outputs sin entradas huérfanas** (se encontró `deny.duck_in` en el catálogo aunque el campo de origen `cutType` ya no admite ese valor).

## 5. Integración con U Stats — qué es real y qué no

Esto es lo que pides explícitamente ("incluir estadísticas relevantes si las hubiese extraídas de U Stats"). Aquí hay que ser preciso sobre qué es posible hoy y qué no, para no diseñar sobre una fantasía.

### 5.1. Lo que SÍ es técnicamente posible, verificado

**[VERIFICADO]** U Stats ingesta el PBP oficial de **las 18 franquicias de la WCBA** (competitionId=56), no solo el equipo de Pablo — está en `pbp_possessions`/`pbp_player_game_stats`, indexado por `player_external_id` (el ID oficial WCBA). Es decir: **si una jugadora rival que se está scouteando juega en la WCBA, sus estadísticas reales de la temporada (PPG, eFG%, TS%, TOV%, USG%, FT rate, ORTG/DRTG individual si se calculase) ya existen en la misma base de datos**, sin que el staff tenga que teclearlas de memoria.

### 5.2. La pieza que falta para que esto funcione — verificado que NO existe hoy

**[VERIFICADO]** Los registros de jugadora rival en U Scout (`PlayerEditor`, tablas de Scout) **no tienen hoy ningún campo `wcba_external_id` ni equivalente** (`grep` sin resultados en `PlayerEditor.tsx`, `Personnel.tsx`, `mock-data.ts`, `routes.ts`). Es decir: **hoy no hay forma de unir un perfil de scouting con su fila real de stats en U Stats** — son mundos separados aunque vivan en el mismo Supabase. Esto es el primer requisito técnico real de Motor 1.0 si se quiere esta integración: añadir ese campo de enlace y una forma (búsqueda por nombre/equipo, quizás autocompletado contra `stats_players`) de vincularlo al crear/editar una jugadora rival en Scout.

### 5.3. El límite real que hay que comunicar bien, para no prometer de más

**[VERIFICADO, ya documentado en la auditoría de U Stats]** El PBP oficial de la WCBA **no clasifica el tipo de jugada** (no distingue ISO de PnR de Post-up) — el catálogo de `event_type` es genérico (tiro, rebote, pérdida, falta...). Esto significa que **no se puede sacar de U Stats, hoy, un dato real de "% de posesiones en ISO" o "PPP en Post-up" de una jugadora rival** — ese nivel de detalle solo existe en la literatura externa (Synergy) o en la observación directa del staff, nunca en el PBP de la WCBA. Lo que sí se puede sacar de verdad son métricas agregadas de temporada (no por tipo de jugada): eFG%, TS%, USG%, TOV%, FT rate, PPG, minutos, y el pace-por-tramo (transición/media cancha, aunque con la salvedad ya documentada de que es un proxy por tiempo, no por tipo de jugada).

**Traducción para el diseño del motor:** las estadísticas reales de U Stats sirven para **contexto agregado y validación cruzada** ("esta jugadora tiene TS% de 61% — muy por encima de la media de liga, coherente con que el staff la marque como amenaza alta"), no para **sustituir** la clasificación cualitativa por tipo de jugada que hace el staff (eso sigue siendo observación humana, y así debe quedar explícito en el motor — ver principio de la sección 3).

### 5.4. Propuesta concreta (a validar, no decidida)

- Al vincular una jugadora rival a su `wcba_external_id`, el motor podría mostrarle al staff, como contexto de referencia (no como input que se pueda editar/inventar): PPG/eFG%/TS%/USG%/TOV% reales de temporada, y compararlos contra la media de liga (`/api/stats/league-averages`, ya existe).
- Podría usarse como **validación suave**: si el staff marca `isoFrequency: Never` pero el USG% real es muy alto y el TS% también, el motor podría mostrar un aviso tipo "revisar — esta jugadora tiene un USG% alto, ¿seguro que no tiene ninguna situación primaria?" — sin bloquear, solo como ayuda.
- **No** debería usarse para inferir automáticamente el archetype ni sustituir ninguno de los campos de `neverInfer` — eso rompería el principio ya validado de la sección 3.

## 6. UX de captura (staff) — ideas a validar

`[PENDIENTE VALIDAR CON PABLO — esto es propuesta, no decisión]`
- El editor actual tiene ~48 campos en un solo formulario largo (`PlayerEditor.tsx`, 1.969 líneas). Con el vínculo a U Stats de la sección 5, el formulario podría abrir mostrando el contexto real de la jugadora (equipo, minutos, stats de liga) antes de pedir los campos cualitativos — orienta al staff que scoutea a una jugadora que no conoce bien.
- Posible agrupación por "situación" con progreso visible (ej. "ISO: 4/6 campos", "PnR: 0/8 campos") en vez de un formulario plano — reduce la sensación de formulario interminable. A validar si merece la pena frente a la complejidad de construirlo.

## 7. UX de lectura (jugadora) — ideas a validar

`[PENDIENTE VALIDAR CON PABLO]`
- El formato de 3 slides ya está aprobado y funciona — no tocarlo sin motivo. Lo que sí podría mejorar: cuando exista el vínculo a U Stats, añadir 1 dato cuantitativo de contexto por slide (ej. en la slide "¿Quién es?", un chip con "TS% 58% — top 20% de la liga" si el dato existe) — dota de credibilidad al informe sin sobrecargarlo.
- Mantener la regla ya establecida: máximo 2 AWARE en la slide 3, no diluir la acción principal.

## 8. Roadmap teórico de fases (orden propuesto, a discutir)

1. **Fase 0 — modelo de datos único**: definir el esquema de inputs/outputs del motor nuevo (puede partir de `PlayerInputs`/`EnrichedInputs` de v2.1, que ya está más maduro que el de `mock-data.ts`), sin tocar UI todavía.
2. **Fase 1 — núcleo de cálculo puro**, sin React, con tests (Vitest, sin necesidad de `happy-dom` si de verdad no toca nada de navegador) que cubran los casos de los antiguos `test-motor-v4.ts`/`eval-motor-quality.ts` más los casos nuevos de esta auditoría (multi-situación primaria, el caso que quedó sin probar).
3. **Fase 2 — vínculo con U Stats** (`wcba_external_id` en Scout + endpoint de contexto).
4. **Fase 3 — migración de consumidores**: `PlayerEditor`, `QuickScout`, `ReportSlidesV1`, `Profile.tsx` pasan todos al motor nuevo, se retiran `motor-v2.1.ts`, `motor-v4.ts` y la parte de `generateProfile`/`isoDanger` de `mock-data.ts`.
5. **Fase 4 — UX de captura/lectura mejorada** (secciones 6-7), una vez el núcleo esté estable.

`[PENDIENTE]` Este roadmap es una propuesta de orden lógico, no una estimación de tiempo — falta que Pablo lo valide o lo reordene según prioridad real.

## 10. Lógica de detección de estadísticas destacadas para Slide 1 (nueva, con datos reales)

> Esto responde directamente al encargo: "qué destacar en el primer slide que, si es modo sencillo, además será el único". Nada de umbrales inventados — son percentiles reales calculados con SQL contra `pbp_player_game_stats` de toda la WCBA (236 jugadoras, ≥8 partidos, temporada actual).

### 10.1. Tabla de percentiles reales de liga (VERIFICADO por SQL, 2026-09-10)

| Métrica | P50 (mediana liga) | P85 ("destacado") | P95 ("élite") | Muestra |
|---|---|---|---|---|
| PPG | 5,85 | 14,13 | 17,78 | 236 jugadoras |
| RPG | 2,52 | 5,53 | 8,85 | 236 |
| APG | 1,44 | 2,82 | 4,36 | 236 |
| SPG | 0,74 | 1,45 | — | 236 |
| BPG | 0,09 | 0,41 | — | 236 |
| TOV/partido | 1,30 | 2,17 (p85, más alto = peor) | — | 236 |
| 3P% | 31,3% | 38,6% | 43,9% | 122 (≥30 intentos) |
| eFG% | 49,2% | 56,2% | — | 173 (≥50 tiros) |
| TS% | 53,0% | 60,6% | 64,8% | 173 (≥50 tiros) |

**Regla base propuesta:** P85 = "destacado" (chip visible en el informe), P95 = "élite" (chip con énfasis visual extra, ej. color/borde distinto). Por debajo de P85, la métrica no se muestra como destacado — evita ruido de datos mediocres disfrazados de highlight.

### 10.2. Límite real, dicho sin rodeos: esto NO está ajustado por posición todavía

Estos percentiles son de **toda la liga junta** (bases, aleros y pívots mezclados). Comparar el RPG de una base contra el de una pívot con el mismo corte es injusto — una base con 5,5 rebotes es un dato muchísimo más raro/destacable que una pívot con 5,5. **`[PENDIENTE]`**, y en mi opinión obligatorio antes de dar esto por bueno: recalcular esta misma tabla separada por posición (`position` ya existe en `PlayerInput`/scouting profile, y las stats de U Stats deberían tener posición vía roster). Sin este ajuste, el motor podría destacar cosas triviales para pívots (rebotes) e ignorar cosas genuinamente raras para bases (una base con muchos rebotes es más scouteable que un pívot con los mismos).

### 10.3. Algoritmo de selección para Slide 1 (propuesta, a validar)

1. Para cada métrica candidata con dato real disponible (requiere el vínculo `wcba_external_id` de la sección 5), calcular en qué percentil cae la jugadora dentro de su posición (una vez resuelto el punto 10.2).
2. Descartar cualquier métrica por debajo de P85 — no es "destacada", no compite por el slide.
3. De las que superan P85, ordenar por **cuánto superan el umbral**, no por un orden fijo de categoría (ej. no "siempre PPG antes que RPG") — una jugadora en P97 de robos es más notable que una en P86 de puntos, aunque puntos "suene" más importante.
4. **Modo completo (3 slides):** mostrar hasta 3 chips destacados en Slide 1.
 **Modo sencillo (1 slide único, backlog ya mencionado en memoria del proyecto):** mostrar **solo el más extremo** (el de percentil más alto) — en modo sencillo el espacio es más crítico, un solo dato contundente pesa más que tres flojos.
5. Si ninguna métrica supera P85 (jugadora de rol, sin nada estadísticamente destacable), el motor no debe inventarse un chip — mejor sin chip que un chip forzado con un dato mediocre. En ese caso, el slide 1 se apoya solo en lo cualitativo del staff (archetype), sin apoyo numérico.
6. El TOV alto NO es un "destacado" positivo — si aparece, debe ir marcado como aviso (ej. "pierde el balón con frecuencia"), nunca con el mismo estilo visual que un chip de fortaleza.

### `[PENDIENTE]` de esta sección
- Percentiles por posición (10.2), el paso más importante que falta.
- USG%, PIE, ORTG/DRTG individual — no calculados aún con percentiles reales, aunque ya están verificados como fórmulas correctas en la auditoría de U Stats.
- Validar con Pablo si 3 chips en modo completo es el número correcto, o prefiere menos/más.
- Decidir el copy exacto de los chips (ej. "3P% 41% — top 15% de la liga" vs. algo más corto para móvil).

## 11. Preguntas abiertas para Pablo (no las respondo yo, son de producto)

1. ¿El vínculo a U Stats debe ser obligatorio para toda jugadora rival, o solo cuando sea de la WCBA (jugadoras extranjeras o de ligas no cubiertas no tendrían dato)?
2. ¿Quieres que el motor nuevo mantenga los `key` exactos de v2.1/v4 donde coincidan en concepto (para no perder el historial de `report_overrides` ya existentes), o partir de cero con naming nuevo?
3. ¿Prioridad real: primero el núcleo (fases 0-1) sin tocar UX, o quieres UX nueva desde el principio aunque tarde más?
