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

  **[CORREGIDO 2026-09-11, bug real encontrado al escribir los tests de Fase 1]** Esta frase daba por hecho que el cap ya está en ambos motores — es falso. `motor-v2.1.ts:871-909` (`calculateThreatScores`, privado) sí lo implementa. `motor-v4.ts:199-234` (`buildSituations`, la función que realmente calcula `situations` en la salida pública de v4) **no lo implementa en absoluto** — cero referencias a `primarySituations`/`manyPrimaries`/`0.72` en todo el archivo (verificado por grep exhaustivo). `buildSituations` consume `v21Report.rawOutputs` (los pesos SIN capar) y aplica su propio esquema, normalizar cada situación dividiendo por el peso máximo del perfil — un mecanismo completamente distinto, sin ninguna relación con el cap por multi-primaria. Es exactamente el tipo de divergencia entre motores que este documento existe para eliminar, y no estaba detectada hasta ahora. **Implicación para Fase 1:** el comportamiento de referencia correcto es el de `motor-v2.1.ts` (el que el propio Pablo validó como "lógica sólida"), no el de `motor-v4.ts` — los tests de Fase 1 deben afirmar el cap real, no el comportamiento actual de v4.
- **Calibración contra literatura real cuando existe** — ya hay dos casos verificados en el código actual (peso de `cut` = 0,72 citando 1,58 PPP de Synergy EuroLeague; comentario "ISO is statistically one of the least efficient play types"). Motor 1.0 debe mantener y ampliar esta práctica — cada peso base debería, donde sea posible, tener un comentario de origen (dato real o "criterio de staff sin dato externo", explícito).
- **El formato de informe de 3 slides** (¿Quién es? / ¿Qué hará? / ¿Qué hago yo?) — ya validado como decisión de producto en `u-scout-design-decisions.md`, no hay motivo para cambiarlo salvo que la UX de lectura (sección 6) sugiera algo mejor.
- **El flujo de aprobación** (edición privada → coach revisa/aprueba → staff ve discrepancias → cualquier coach publica) — el proceso es bueno, el problema detectado era que dos motores generan `itemKey`s distintos para el mismo concepto. Con un solo motor, ese problema desaparece por construcción.

## 4. Lo que Motor 1.0 debe arreglar de raíz (no parchear)

- **Una sola implementación**, no dos. Nada de "legacy + oficial" — todo consumidor (editor, quick scout, informe de jugadora, informe de coach) llama a la misma función.
- **Naming consistente de principio a fin**: un solo esquema de `key`/`itemKey` para archetypes, outputs y situaciones — que además sea estable en el tiempo (si cambia el algoritmo interno, el `key` de un concepto no debería cambiar arbitrariamente, para no romper `report_overrides` históricos).
- **Un solo idioma base en las plantillas de texto**, con el sistema de i18n aplicado de forma consistente (la auditoría encontró plantillas ya en español mezcladas con plantillas en inglés dentro del mismo catálogo — inconsistencia a eliminar).
- **Sin acoplamiento a React/browser en el núcleo de cálculo** (la auditoría encontró que `mock-data.ts` arrastra un `window.addEventListener` a nivel de módulo solo por estar en el mismo archivo que los hooks de datos — el cálculo puro debe vivir separado de los hooks de React Query, en su propio archivo sin dependencias de navegador, para poder testearlo con Node/Vitest sin trucos de `happy-dom`).
- **Catálogo de outputs sin entradas huérfanas** (se encontró `deny.duck_in` en el catálogo aunque el campo de origen `cutType` ya no admite ese valor). **[VERIFICADO 2026-09-12, ya resuelto en el código actual]** `motor-v2.1.ts:10` documenta explícitamente el fix: `duck_in` se movió de `cutType` a un campo propio, `PostEntry` (`cutType: CutType` ya no lo admite desde entonces, línea 248; `deny_duck_in` se genera hoy desde `inputs.postEntry === 'duck_in'`, línea 1390 — un valor real y válido del tipo). No es un pendiente de Motor 1.0, ya no existe la orfandad que motivó este punto.

  **Auditoría más amplia hecha al verificar esto (2026-09-12):** cruzadas las ~80 keys generadas como output contra `OUTPUT_CATALOG` completo (`motor-v2.1.ts:628-740`) — solo una tiene el problema inverso: `aware_instant_shot` (generada en la línea ~1858, `deepRange && spotUpFreq==='P' && spotUpAction==='shoot'`) no tiene entrada en `OUTPUT_CATALOG.aware`. **Verificado que esto no rompe nada de cara al usuario**: `reportTextRenderer.ts` (el módulo que `ReportSlidesV1.tsx` usa de verdad para el texto final) tiene su propio `switch(key)` independiente de `OUTPUT_CATALOG`, con una entrada real para `aware_instant_shot` en los 3 idiomas y un `default` que nunca rompe (de-slugifica la key en vez de fallar). No afecta a Motor 1.0 — `motor-v1.ts` no consume ninguno de los dos sistemas de texto legacy todavía (Nota 2 de 14.2 bis). Cosmético, no bloqueante — se deja documentado por si `OUTPUT_CATALOG` se reusa alguna vez, no porque haga falta arreglarlo ahora.

## 5. Integración con U Stats — qué es real y qué no

Esto es lo que pides explícitamente ("incluir estadísticas relevantes si las hubiese extraídas de U Stats"). Aquí hay que ser preciso sobre qué es posible hoy y qué no, para no diseñar sobre una fantasía.

### 5.1. Lo que SÍ es técnicamente posible, verificado

**[VERIFICADO]** U Stats ingesta el PBP oficial de **las 18 franquicias de la WCBA** (competitionId=56), no solo el equipo de Pablo — está en `pbp_possessions`/`pbp_player_game_stats`, indexado por `player_external_id` (el ID oficial WCBA). Es decir: **si una jugadora rival que se está scouteando juega en la WCBA, sus estadísticas reales de la temporada (PPG, eFG%, TS%, TOV%, USG%, FT rate, ORTG/DRTG individual si se calculase) ya existen en la misma base de datos**, sin que el staff tenga que teclearlas de memoria.

### 5.2. CORREGIDO 2026-09-11 — el vínculo YA existe, en forma básica, no hay que construirlo desde cero

**[VERIFICADO ahora contra código real, mi afirmación anterior era falsa]** Ya existe `GET /api/stats/player-link` en `server/routes.ts:2165-2196`, ya wireado en `client/src/pages/scout/MyScout.tsx` (componente `StatsMiniChip`, líneas 37-56). Funciona así: recibe un nombre, busca `sp.name_zh = name OR sp.name_en = name` en `stats_players`, y si encuentra coincidencia exacta devuelve `externalId` + PPG/RPG/APG (promedios de temporada, sin percentil, sin contracción bayesiana, sin ajuste por posición — una versión mínima, no lo que diseño en la sección 10). **No hay campo `wcba_external_id` guardado en la jugadora de Scout** porque no hace falta con este enfoque — el match es por nombre en caliente, cada vez que se pide.

**Limitación real de este enfoque que no estaba escrita antes:** un match exacto de string por nombre es frágil — variantes de transliteración del chino, apodos, nombres compuestos, o una jugadora que el staff escribió con espaciado distinto, fallarían silenciosamente (`externalId: null`, sin aviso de "no se encontró", indistinguible de "esta jugadora no está en la WCBA"). Esto es búsqueda que había que hacer y no hice hasta que Pablo me paró a revisar de nuevo.

**Lo que falta de verdad para llegar al diseño de la sección 10 (no es "construir el vínculo", es enriquecer el que ya existe):**
1. Extender `player-link` con eFG%/TS%/USG%/TOV%/FT rate (hoy solo PPG/RPG/APG).
2. Añadir percentil, contracción bayesiana (12.3) y ventana de recencia (12.4) al resultado.
3. Mejorar el matching (fuzzy match o confirmación manual del staff cuando hay ambigüedad, en vez de fallo silencioso).
4. Cablear el mismo chip en `PlayerEditor.tsx` (el editor de la jugadora rival) — hoy solo está en `MyScout.tsx`, no en el flujo de creación/edición donde más aportaría según lo que ya planificaba una sesión anterior del proyecto.

### 5.3. El límite real que hay que comunicar bien, para no prometer de más

**[VERIFICADO, ya documentado en la auditoría de U Stats]** El PBP oficial de la WCBA **no clasifica el tipo de jugada** (no distingue ISO de PnR de Post-up) — el catálogo de `event_type` es genérico (tiro, rebote, pérdida, falta...). Esto significa que **no se puede sacar de U Stats, hoy, un dato real de "% de posesiones en ISO" o "PPP en Post-up" de una jugadora rival** — ese nivel de detalle solo existe en la literatura externa (Synergy) o en la observación directa del staff, nunca en el PBP de la WCBA. Lo que sí se puede sacar de verdad son métricas agregadas de temporada (no por tipo de jugada): eFG%, TS%, USG%, TOV%, FT rate, PPG, minutos, y el pace-por-tramo (transición/media cancha, aunque con la salvedad ya documentada de que es un proxy por tiempo, no por tipo de jugada).

**Traducción para el diseño del motor:** las estadísticas reales de U Stats sirven para **contexto agregado y validación cruzada** ("esta jugadora tiene TS% de 61% — muy por encima de la media de liga, coherente con que el staff la marque como amenaza alta"), no para **sustituir** la clasificación cualitativa por tipo de jugada que hace el staff (eso sigue siendo observación humana, y así debe quedar explícito en el motor — ver principio de la sección 3).

### 5.4. Propuesta concreta (a validar, no decidida)

- Al vincular una jugadora rival a su `wcba_external_id`, el motor podría mostrarle al staff, como contexto de referencia (no como input que se pueda editar/inventar): PPG/eFG%/TS%/USG%/TOV% reales de temporada, y compararlos contra la media de liga (`/api/stats/league-averages`, ya existe).
- Podría usarse como **validación suave**: si el staff marca `isoFrequency: Never` pero el USG% real es muy alto y el TS% también, el motor podría mostrar un aviso tipo "revisar — esta jugadora tiene un USG% alto, ¿seguro que no tiene ninguna situación primaria?" — sin bloquear, solo como ayuda.
- **No** debería usarse para inferir automáticamente el archetype ni sustituir ninguno de los campos de `neverInfer` — eso rompería el principio ya validado de la sección 3.

## 6. UX de captura (staff) — ideas a validar

**[SUPERADO, ver 15.3]** Ambas ideas de esta sección quedaron formalizadas y ampliadas por el rediseño de la sección 15: "mostrar contexto de U Stats antes de los campos cualitativos" es hoy el Nivel 2 mostrado primero (13.1); "agrupación por situación con progreso visible" es hoy el flujo de 2 pasos selección→detalle (15.3), más concreto que la idea original. Se deja el texto original abajo por trazabilidad, ya no es un pendiente.

`[PENDIENTE VALIDAR CON PABLO — esto es propuesta, no decisión]`
- El editor actual tiene ~48 campos en un solo formulario largo (`PlayerEditor.tsx`, 1.969 líneas). Con el vínculo a U Stats de la sección 5, el formulario podría abrir mostrando el contexto real de la jugadora (equipo, minutos, stats de liga) antes de pedir los campos cualitativos — orienta al staff que scoutea a una jugadora que no conoce bien.
- Posible agrupación por "situación" con progreso visible (ej. "ISO: 4/6 campos", "PnR: 0/8 campos") en vez de un formulario plano — reduce la sensación de formulario interminable. A validar si merece la pena frente a la complejidad de construirlo.

## 7. UX de lectura (jugadora) — ideas a validar

**[SUPERADO, ver 10.3/13.2/14.2 bis]** "Añadir 1 dato cuantitativo por slide" es hoy el sistema completo de `statsDestacados`/chips (10.1-10.3 ter). "Máximo 2 AWARE" quedó fijado a nivel de tipo como tupla acotada en `capa2.aware` (14.2 bis, Nota 10). Se deja el texto original abajo por trazabilidad, ya no es un pendiente.

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

### 10.2 bis. Percentiles reales por posición — CERRADO (SQL verificado 2026-09-11, mismo método que 10.1)

> El pendiente más crítico de la sección 10, y el marcado como prioridad #4 en 12.8, ya está resuelto contra datos reales — no es una propuesta, son percentiles calculados hoy contra `pbp_player_game_stats`/`stats_players` del proyecto Supabase "U Scout" (`ybpzvkkxcmwwxrrouyhm`), replicando exactamente la metodología de 10.1 (`season_id=2092`, todas las fases — regular + playoff, exactamente así se llega a las 236 jugadoras de 10.1 —, ≥8 partidos).

**Mapeo de posición real (`stats_players.position`, texto en chino) a los 3 grupos de la decisión #2 de 14.2 bis:**

| Posición real (WCBA) | Grupo |
|---|---|
| 后卫 (guardia), 得分后卫 (escolta) | `base` |
| 前锋 (alero genérico), 小前锋 (alero puro) | `alero` |
| 中锋 (pívot), 大前锋 (ala-pívot) | `interior` |

**29 de las 236 jugadoras (12%) no tienen posición asignada en el roster** (`NULL` o `"-"`) — quedan fuera de la tabla por grupo, no se les puede aplicar percentil ajustado. Nota honesta: eso también significa que, para esas 29, Motor 1.0 no podrá mostrar `percentil` ajustado por posición (solo el `percentil` sin ajustar de 10.1, si acaso) — degradación elegante, no bloqueo, pero hay que decidir en Fase 1 qué mostrar en ese caso.

**Tabla de percentiles por grupo (P50/P85/P95, redondeado a 1-2 decimales):**

| Métrica | Grupo | n | P50 | P85 | P95 |
|---|---|---|---|---|---|
| PPG | base | 78 | 5,81 | 12,55 | 14,85 |
| PPG | alero | 79 | 4,37 | 12,00 | 15,60 |
| PPG | interior | 50 | 6,86 | 16,53 | 18,98 |
| RPG | base | 78 | 1,89 | 3,57 | 5,01 |
| RPG | alero | 79 | 2,42 | 3,90 | 6,83 |
| RPG | interior | 50 | 3,62 | 8,03 | 10,42 |
| APG | base | 78 | 2,02 | 4,23 | 5,26 |
| APG | alero | 79 | 1,14 | 2,35 | 3,09 |
| APG | interior | 50 | 0,97 | 1,98 | 2,85 |
| SPG | base | 78 | 0,91 | 1,61 | — |
| SPG | alero | 79 | 0,61 | 1,18 | — |
| SPG | interior | 50 | 0,59 | 1,18 | — |
| BPG | base | 78 | 0,05 | 0,18 | — |
| BPG | alero | 79 | 0,09 | 0,28 | — |
| BPG | interior | 50 | 0,25 | 0,74 | — |
| TOV/partido | base | 78 | 1,51 | 2,52 | — |
| TOV/partido | alero | 79 | 1,05 | 1,55 | — |
| TOV/partido | interior | 50 | 1,38 | 2,28 | — |
| 3P% | base | 48 (≥30 int.) | 31,1% | 37,9% | 41,3% |
| 3P% | alero | 44 (≥30 int.) | 32,0% | 39,8% | 43,9% |
| 3P% | interior | 18 (≥30 int.) | 30,5% | 39,8% | 44,5% |
| eFG% | base | 56 (≥50 tiros) | 45,8% | 52,9% | — |
| eFG% | alero | 55 (≥50 tiros) | 48,6% | 56,1% | — |
| eFG% | interior | 38 (≥50 tiros) | 50,9% | 59,3% | — |
| TS% | base | 56 (≥50 tiros) | 50,6% | 57,8% | 60,8% |
| TS% | alero | 55 (≥50 tiros) | 51,8% | 60,5% | 63,7% |
| TS% | interior | 38 (≥50 tiros) | 55,5% | 64,6% | 67,2% |

**Validación concreta del problema que motivó esta sección:** una base con 5,5 rebotes por partido **supera el P95 de su grupo** (5,01) — sería "élite" para su posición. Una pívot con el mismo 5,5 RPG **ni siquiera alcanza el P85 de su grupo** (8,03) — sería un dato mediocre para una interior. Exactamente el caso que 10.2 predijo sin poder demostrarlo todavía; ahora está demostrado con datos reales.

**Aviso de muestra pequeña, dicho sin rodeos:** `interior` en 3P% tiene solo 18 jugadoras que cumplen el filtro de ≥30 intentos — sigue siendo indicativo, pero es la celda con menos confianza de toda la tabla. La contracción bayesiana de 12.3 (ya parte del contrato de 14.2 bis vía `percentilAjustadoPorMuestra`) mitiga esto a nivel de jugadora individual, pero no arregla que el propio percentil de referencia del grupo se calcule sobre pocas observaciones.

**Actualiza 12.8:** la prioridad #4 ("percentiles por posición, sigue siendo el pendiente más crítico de la parte de stats") queda resuelta.

### 10.3. Algoritmo de selección para Slide 1 (propuesta, a validar)

1. Para cada métrica candidata con dato real disponible (requiere el vínculo `wcba_external_id` de la sección 5), calcular en qué percentil cae la jugadora dentro de su posición (una vez resuelto el punto 10.2).
2. Descartar cualquier métrica por debajo de P85 — no es "destacada", no compite por el slide.
3. De las que superan P85, ordenar por **cuánto superan el umbral**, no por un orden fijo de categoría (ej. no "siempre PPG antes que RPG") — una jugadora en P97 de robos es más notable que una en P86 de puntos, aunque puntos "suene" más importante.
4. **Modo completo (3 slides):** mostrar hasta 3 chips destacados en Slide 1.
 **Modo sencillo (1 slide único, backlog ya mencionado en memoria del proyecto):** mostrar **solo el más extremo** (el de percentil más alto) — en modo sencillo el espacio es más crítico, un solo dato contundente pesa más que tres flojos.
5. Si ninguna métrica supera P85 (jugadora de rol, sin nada estadísticamente destacable), el motor no debe inventarse un chip — mejor sin chip que un chip forzado con un dato mediocre. En ese caso, el slide 1 se apoya solo en lo cualitativo del staff (archetype), sin apoyo numérico.
6. El TOV alto NO es un "destacado" positivo — si aparece, debe ir marcado como aviso (ej. "pierde el balón con frecuencia"), nunca con el mismo estilo visual que un chip de fortaleza.

### 10.3 bis. USG% y PIE reales por posición — CERRADO (SQL verificado 2026-09-11); ORTG/DRTG individual, hallazgo importante

> Antes de calcular nada, leí `server/routes.ts:2244-2338` para usar la fórmula **ya implementada y en producción**, no reinventarla — USG% y PIE tienen SQL real ahí (`/api/stats/player/:externalId`), replicado aquí carácter a carácter (mismos componentes: PIE = media por partido de `100 × (pts+fgm+ftm-fga-fta+dreb+0,5·oreb+ast+stl+0,5·blk-pf-tov) / suma_del_mismo_término_de_las_20_jugadoras_en_pista_ese_partido`; USG% = agregado de temporada `100 × Σ[(fga+0,44·fta+tov)·(min_equipo/5)] / Σ[min_jugadora·(fga_equipo+0,44·fta_equipo+tov_equipo)]`). Mismos 236 jugadoras/grupos que 10.2 bis.

| Métrica | Grupo | n | P50 | P85 | P95 |
|---|---|---|---|---|---|
| PIE | base | 78 | 2,50 | 8,29 | 10,96 |
| PIE | alero | 79 | 2,45 | 6,51 | 12,28 |
| PIE | interior | 50 | 3,41 | 12,44 | 16,93 |
| USG% | base | 78 | 18,1% | 24,5% | 28,9% |
| USG% | alero | 79 | 15,9% | 21,1% | 31,6% |
| USG% | interior | 50 | 19,7% | 28,6% | 32,1% |

Los rangos de USG% (mediana ~16-20%, P95 ~29-32%) caen justo donde la literatura de baloncesto los sitúa para un quinteto real — buena señal de que la fórmula replicada del endpoint es correcta, no solo que "corrió sin error".

**ORTG/DRTG individual — hallazgo, no cálculo.** Leyendo `server/routes.ts:2620-2673` (y confirmado por `auditoria-u-stats-completa.md`, sección 2.5): el `ortg`/`drtg` que existe hoy en el código **es de EQUIPO, no de jugadora individual** — se calcula como `100 × puntos_propios / posesiones_reales_del_equipo` contando filas de `pbp_possessions`. **No existe ningún ORTG/DRTG a nivel de jugadora individual implementado en el código actual**, pese a que 10.3 afirmaba que las fórmulas ya estaban "verificadas" — eso era cierto solo para USG%/PIE, no para ORTG/DRTG individual. La versión individual real (método Dean Oliver: puntos producidos individuales, %AST, paradas defensivas individuales) es sustancialmente más compleja que un ajuste de query — no la voy a improvisar aquí sin verificarla contra una referencia como hice con USG%/PIE, sería inventar una fórmula presentada como sólida sin serlo. **Queda fuera del alcance de Motor 1.0 hasta que se implemente y verifique en U Stats primero** — Motor 1.0 puede consumir ORTG/DRTG de *equipo* (ya existe) como contexto, pero no debe prometer una versión individual que no existe.

### `[PENDIENTE]` de esta sección
- ~~Percentiles por posición (10.2)~~ — **[CERRADO, ver 10.2 bis]**.
- ~~USG%, PIE~~ — **[CERRADO, ver 10.3 bis]**. ORTG/DRTG individual **no existe en el código actual** (solo a nivel de equipo) — fuera de alcance de Motor 1.0 hasta que U Stats lo implemente, ver 10.3 bis.
- ~~Validar si 3 chips en modo completo es el número correcto~~ — **[CERRADO, ver 10.3 ter]**.
- ~~Decidir el copy exacto de los chips~~ — **[CERRADO, ver 10.3 ter]**.

### 10.3 ter. Número de chips y copy exacto — CERRADO (investigado 2026-09-11)

**Número de chips en modo completo → se mantiene 3, con respaldo, no cambia.** No encontré un número "mágico" específico para scouting deportivo (ni Hoop Mentality ni las guías de dashboards deportivos dan una cifra exacta — solo insisten en "conciso", [Hoop Mentality — 4 Scouting Report Examples](https://hoopmentality.com/blogs/basketball/examples-of-scouting-reports-basketball)). La referencia más sólida sigue siendo la ya citada en 16.3b: memoria de trabajo activa de **4±1 chunks** (Cowan, 2001), bajando a 2-3 bajo presión. 3 chips en modo completo (sin la presión de pre-partido que sí aplica a modo sencillo, donde ya se limita a 1) se queda dentro del rango de 4±1 con margen — no hace falta cambiarlo, la propuesta original ya estaba bien calibrada.

**Copy de los chips → formato corto, sin comparación en el mismo chip.** Encontrado un estándar real de sistemas de diseño (no una opinión de blog): los componentes de tipo *chip* deben llevar **1-3 palabras, máximo 5** en su etiqueta — más largo reduce legibilidad y escaneabilidad ([Telerik Design System](https://www.telerik.com/design-system/docs/components/chip/usage/); [Vanilla Framework](https://vanillaframework.io/docs/patterns/chip/design-guidelines)). "3P% 41% — top 15% de la liga" son 6 palabras — excede el máximo recomendado. Decisión: el chip lleva solo **métrica + valor** ("TS% 61%", 2 "palabras" reales), y la comparación contra la liga ("top 15%") pasa a texto secundario visible al tocar/expandir el chip, no al mismo nivel visual — resuelve la disyuntiva que dejaba abierta la sección sin inventar una tercera opción: ambos formatos conviven, cada uno en su capa de detalle correcta.

## 11. Preguntas abiertas para Pablo (no las respondo yo, son de producto)

1. ¿El vínculo a U Stats debe ser obligatorio para toda jugadora rival, o solo cuando sea de la WCBA (jugadoras extranjeras o de ligas no cubiertas no tendrían dato)?
2. ¿Quieres que el motor nuevo mantenga los `key` exactos de v2.1/v4 donde coincidan en concepto (para no perder el historial de `report_overrides` ya existentes), o partir de cero con naming nuevo?
3. ¿Prioridad real: primero el núcleo (fases 0-1) sin tocar UX, o quieres UX nueva desde el principio aunque tarde más?

---

## 12. Auditoría de calidad — investigación externa y mejoras lógicas concretas (2026-09-10)

> Encargo de Pablo: "documentando en internet y buscando mejoras lógicas para que este motor sea ya un producto serio, fiable y eficaz". Búsquedas web reales hechas hoy, con fuente citada en cada hallazgo — nada de memoria sin verificar.

### 12.1. ✅ Validación positiva: la taxonomía de situaciones del motor actual coincide con el estándar de la industria

Synergy Sports (la referencia global de clasificación de posesiones, ya citada en la auditoría de U Stats) usa **11 tipos de jugada canónicos**: Isolation, Post-Up, Pick-and-Roll Ball Handler, Pick-and-Roll Roll Man, Cut, Transition, Spot-Up, Putback (rebote ofensivo), Off-Screen, Handoff, y Miscellaneous ([Synergy Basketball FAQs](https://developer.sportradar.com/basketball/reference/synergy-basketball-faqs); confirmado también en [Databall](https://nbastatsgeeks.wordpress.com/advanced-statistics-summary/team-statistics/synergy-statistics/) y en el estudio EuroLeague/CBA de [ResearchGate](https://www.researchgate.net/publication/352898188_The_Use_of_Synergy_Sports_Technology_for_the_Collection_of_Basketball_Game_Statistics)).

Comparando con las 11 categorías de `outputWeights` que ya audité en `motor-v2.1.ts` (iso, pnr, screener/roll, post, transition, spotUp, dho, cut, oreb, floater, misc/aware): **coinciden casi 1:1 con el estándar Synergy**, solo con nombres distintos (`dho` = Handoff, `oreb` = Putback, `screener` = Roll Man). Esto es una buena noticia real: **la base conceptual del motor actual no está mal planteada, no hace falta reinventar las categorías desde cero para Motor 1.0** — el trabajo es de calidad de cálculo y arquitectura, no de qué categorizar.

### 12.2. ⚠️ Mejora lógica real: "eficiente" no es lo mismo que "importante para el peso defensivo"

Esto matiza — no invalida — el hallazgo ya documentado de que el peso de `cut` se subió a 0,72 citando que es el tipo de jugada más eficiente (1,58 PPP EuroLeague). Un análisis de Synergy sobre qué tipos de jugada predicen de verdad la eficiencia ofensiva de un equipo encontró que **Putback, Miscellaneous, Handoff, Cut, Post-Up y Off-Screen NO fueron predictores estadísticamente significativos** de la eficiencia ofensiva global, pese a que varios de ellos (como Cut) son de los más eficientes en PPP puro — la explicación propuesta es que casi cualquier jugador de nivel profesional anota bien saliendo de un corte, así que ese dato no discrimina jugadoras buenas de mediocres ([Play Types and Their Varying Importance, FanSided/Nylon Calculus](https://fansided.com/2015/02/16/play-types-varying-importance/)).

**Mejora lógica propuesta para Motor 1.0:** no calibrar el peso de amenaza de una situación solo por su PPP absoluto ("es eficiente → hay que negarlo mucho"), sino también por **cuánto varía esa eficiencia entre jugadoras** (poder discriminante). Una situación muy eficiente pero donde casi todo el mundo rinde igual (ej. Cut) merece un peso base más bajo que una situación donde el rango entre buena y mala jugadora es enorme (ej. ISO, Post-Up), aunque esta última tenga peor PPP promedio. Esto es exactamente lo contrario del criterio que se uso para subir el peso de `cut` en el código actual — vale la pena revisarlo con este criterio añadido, no solo el de PPP bruto.

### 12.3. ⚠️ Mejora lógica real: corrección por tamaño de muestra (nada de porcentajes "pelados")

Multiple literatura académica confirma que los porcentajes de tiro con pocos intentos son engañosos — la mayoría de la variación observada en 3P% entre jugadoras se debe a ruido estadístico, no a diferencia real de habilidad, especialmente con muestras pequeñas ([Franks et al. 2016, citado en "Modeling Player and Team Performance in Basketball", arXiv](https://arxiv.org/pdf/2007.10550)). La solución estándar en la literatura es la **contracción bayesiana (Bayesian shrinkage)**: en vez de usar el porcentaje crudo, se "encoge" la estimación de cada jugadora hacia la media de liga en proporción inversa al número de intentos — con pocos intentos, el dato se acerca mucho a la media de liga; con muchos intentos, se acerca al dato real observado ([Using Beta-Binomial Regression to Set Priors for Different Sample Sizes](https://optimumsportsperformance.com/blog/using-beta-binomial-regression-to-set-priors-for-different-sample-sizes/)). Un estudio independiente sobre la CBA (la liga masculina china, mismo país que la WCBA) aplicó un filtro práctico similar: excluyó a cualquier jugador con menos del 3% del volumen total de tiros de su equipo, por no ser una muestra fiable ([Frontiers in Psychology, 2023](https://www.frontiersin.org/journals/psychology/articles/10.3389/fpsyg.2023.1256796/full)).

**Mejora lógica propuesta para Motor 1.0, reemplazando la propuesta más simple de la sección 10:** en vez de un corte binario ("≥30 intentos, si no, no cuenta"), usar una estimación con contracción bayesiana simple (Beta-Binomial es la más citada y más fácil de implementar) para cualquier porcentaje (3P%, eFG%, TS%, FT%) que se muestre como "destacado". Esto evita el caso real y probable de que una jugadora con 3/6 en triples (50%, aparentemente elite) aparezca como "destacada en triples" cuando en realidad no hay datos suficientes para saberlo.

### 12.4. ⚠️ Mejora lógica real: ventana de recencia, no temporada completa

La práctica documentada de scouting a nivel de coaching (no solo NBA) usa como estándar los últimos **30 días de vídeo, típicamente 12-15 partidos**, en vez de la temporada completa — para reflejar la forma actual de la jugadora, no hábitos ya superados ([How to Scout Opponents: A Basketball Coach's Guide, Hoop Mentality](https://hoopmentality.com/blogs/basketball/how-to-scout-opponents-a-basketball-coachs-guide)).

**Conexión con lo ya verificado en el código:** `PlayerInput` (en `mock-data.ts`) ya tiene un campo de "forma reciente" (hot/cold/stable, observado por el staff) — es decir, el concepto YA existe como campo cualitativo. **Mejora propuesta:** cuando Motor 1.0 muestre estadísticas reales de U Stats (sección 10), ofrecer ambas ventanas — temporada completa Y últimos 10-15 partidos — y dejar que la divergencia entre ambas alimente (no sustituya) el campo cualitativo de "forma reciente" que ya rellena el staff. Si el dato de temporada y el de últimos 12 partidos divergen mucho, es una señal útil en sí misma.

### 12.5. ⚙️ Idea a validar: nomenclatura de arquetipos estandarizada (Synergy Offensive Roles)

Synergy tiene un sistema de "roles ofensivos" ya validado en la industria: Playmaking/Scoring/Secondary ball handler, Slashing/Spot-up/Dynamic-shooting wing, Playmaking/Post-up/Stretch/Rim-finishing big ([Synergy Player Comps / Insights Package](https://support.synergysports.com/support/solutions/articles/77000565958-insights-package)). Esto contrasta con el naming actual, ya detectado en la auditoría como inconsistente entre motores (`arch_isolation_driver` vs. `archetype_iso_scorer` para el mismo concepto). **[CERRADO, ver 14.3]** adoptar esta nomenclatura (o una traducción/adaptación) como el esquema oficial de archetypes de Motor 1.0 daría dos ventajas: (a) naming estable y único de una vez por todas, (b) terminología reconocible si algún día se compara con datos de Synergy externos. La adaptación exacta al español, investigada y validada contra terminología real de baloncesto, vive en 14.3.

### 12.6. ✅ Validación del formato compacto, con un matiz

La práctica de coaching real confirma que los informes de una página, centrados en lo más crítico, se retienen y usan mejor que los informes largos — varias fuentes independientes de coaching (no solo una) insisten en esto ([6 Scouting Report Essentials, Hoop Mentality](https://hoopmentality.com/blogs/basketball/scouting-report-essentials-every-high-school-coach-needs); [How to Scout Opponents](https://hoopmentality.com/blogs/basketball/how-to-scout-opponents-a-basketball-coachs-guide), que menciona un "framework de seis preguntas" por jugadora para entrega en una sola página). Esto **valida** el formato de 3 slides ya aprobado y la idea de "modo sencillo" de 1 slide que propuso Pablo. El matiz: el framework de "seis preguntas" es más granular que las 3 preguntas actuales de U Scout (¿Quién es? / ¿Qué hará? / ¿Qué hago yo?) — **[CERRADO, ver 13.0]** el detalle completo de las 6 preguntas se encontró en una búsqueda posterior de esta misma sesión y reorganizó buena parte del documento (identidad de mano dominante, zonas, acción principal, emparejamiento defensivo, señal de faltas, detalle no obvio) — el hueco real que reveló (emparejamiento defensivo, pregunta 4) ya está resuelto en 14.1.4.

### 12.7. Nota de humildad metodológica, citada, no inventada

Incluso Synergy —el estándar de oro con etiquetado humano por vídeo— tiene ambigüedad real en el borde entre categorías: un bloqueo directo roto que termina en un intento aislado se cuenta como ISO; una recepción en spot-up donde la jugadora amaga varias veces antes de atacar también pasa a contarse como ISO ([Nylon Calculus: How to understand Synergy play type categories](https://fansided.com/2017/09/08/nylon-calculus-understanding-synergy-play-type-data/)). **Implicación honesta para Motor 1.0:** ni el estándar de la industria con vídeo humano es perfectamente preciso en los bordes. No merece la pena perseguir una precisión de clasificación imposible — el objetivo realista es "tan bueno o mejor que la observación humana actual del staff", no "perfecto".

### 12.8. Resumen de mejoras lógicas concretas, priorizadas

1. **Contracción bayesiana en vez de corte binario** para cualquier porcentaje mostrado como destacado (12.3) — la más importante técnicamente, evita mostrar datos falsos por poca muestra.
2. **Ventana de recencia (10-15 partidos) junto a temporada completa** (12.4) — barata de añadir si ya existe el vínculo de datos de la sección 5.
3. **Revisar criterio de calibración de pesos**: añadir "poder discriminante" junto a "PPP bruto" (12.2) — requiere más trabajo de análisis, no es trivial de calcular sin datos de tracking, pero vale la pena documentarlo como principio aunque se implemente de forma aproximada.
4. **Percentiles por posición**, ya señalado en la sección 10.2 — **[CERRADO 2026-09-11, ver 10.2 bis]** calculado contra datos reales de `pbp_player_game_stats`, ya no es un pendiente.
5. **Nomenclatura de archetypes estándar** (12.5) — barata, mayormente una decisión de naming, a validar con Pablo.

---

## 13. Rediseño desde cero — inputs, outputs y slides (todo lo anterior, motores y este mismo doc hasta ahora, se usa solo como material de referencia)

> Encargo de Pablo: "revisa si hay que cambiar inputs y outputs y tipo de slides y todo, es como si empezásemos de cero". Esto NO es un parche sobre v2.1/v4/mock-data — es una propuesta nueva que aprovecha lo aprendido. Sigue siendo teoría/planificación, cero código.

### 13.0. El hallazgo que reorganiza todo lo demás: el framework de 6 preguntas (encontrado hoy, no existía en el doc)

Búsqueda adicional de hoy: una guía de coaching real de scouting de rivales define el informe de cada jugadora como la respuesta a **exactamente 6 preguntas**, una página por jugadora ([How to Scout Opponents, Hoop Mentality](https://hoopmentality.com/blogs/basketball/how-to-scout-opponents-a-basketball-coachs-guide)):

1. **Mano dominante** — ¿hacia dónde prefiere atacar?
2. **Zonas preferidas** — ¿dónde crea y finaliza?
3. **Acción principal** — ¿cuál es su jugada/situación de referencia?
4. **Emparejamiento defensivo** — ¿quién la marca en tu equipo y qué exige ese emparejamiento?
5. **Señal de faltas** — ¿busca contacto/tiros libres a un ritmo alto, y cómo llega a la línea?
6. **El detalle no obvio** — el único dato que cambia cómo se la defiende, distinto de las 5 anteriores.

Esto es oro para el rediseño porque **5 de las 6 ya existen de alguna forma en el motor actual**, pero la 4ª (emparejamiento defensivo) **no existe en absoluto** hoy en U Scout — es un hueco real, no cubierto ni por `motor-v2.1` ni por `mock-data.ts`. Y la 6ª ("detalle no obvio") es exactamente el concepto que ya propuse en la sección 10 para el modo sencillo, ahora con respaldo externo citado, no solo intuición mía.

### 13.1. INPUTS — modelo nuevo de 3 niveles por procedencia (reemplaza la lista plana de ~48 campos)

En vez de un formulario plano de ~48 campos todos con el mismo peso aparente (el problema de `PlayerEditor.tsx` hoy, 1.969 líneas), separar explícitamente por **de dónde viene el dato**, cada nivel con su propia fiabilidad:

**Nivel 1 — Observación del staff (cualitativa, nunca inferida ni calculada).** Aquí viven los campos que ya identificaba `INFERENCE_RULES.neverInfer` de v2.1 (dirección de ISO, hombro de post, tipo de corte, reacción a presión...) — esto se conserva sin cambios de fondo, es la joya del motor actual.

**Nivel 2 — Dato real de U Stats (objetivo, requiere el vínculo `wcba_external_id` de la sección 5).** Nuevo respecto a todo lo anterior. Cada métrica de este nivel lleva metadata obligatoria: valor, percentil (idealmente por posición, sección 10.2), ventana temporal (temporada completa vs. últimos 10-15 partidos, sección 12.4), y nivel de confianza por tamaño de muestra (contracción bayesiana, sección 12.3) — nunca un número "pelado".

**Nivel 3 — Inferido por el motor (calculado, nunca observación directa).** Se conserva el motor de inferencia actual (`applyInferences`), pero se le añade una función nueva que no existía: **detección de discrepancia Nivel 1 vs. Nivel 2** (ej. staff dice "ISO: Nunca" pero el USG% real de Nivel 2 está en P90 — el motor no debe autocorregir al staff, solo mostrar un aviso de "revisar", igual que ya proponía la sección 5.4).

**Consecuencia práctica para `PlayerEditor`:** en vez de un formulario largo y plano, la UI podría mostrar primero el Nivel 2 (contexto real, si existe vínculo) como punto de partida, y pedir el Nivel 1 agrupado por las 11 situaciones estándar de Synergy (sección 12.1) — más ágil que un formulario único de 48 campos sueltos, sin quitarle rigor.

### 13.2. OUTPUTS — qué se conserva, qué cambia

**Se conserva sin cambio de fondo:** la estructura deny/force/allow con el cap anti-inflación a 0,72 (sección 3) — sigue siendo lógicamente sólida y no hay nada en la investigación de hoy que la contradiga.

**Cambia — nueva metadata obligatoria por output:** cada output (deny/force/allow/aware) lleva ahora un campo de **confianza** (alta si Nivel 1 tiene observación directa consistente y/o Nivel 2 tiene volumen de muestra suficiente; baja si depende de inferencia de Nivel 3 sobre poco dato). Esto no existía en ningún output de v2.1/v4/mock-data — es la traducción directa de la sección 12.3 (shrinkage) a nivel de recomendación, no solo de estadística mostrada.

**Cambia — naming de archetype:** adoptar (o adaptar traduciendo) los "Offensive Roles" de Synergy ya citados en 12.5, en vez del naming ad hoc actual (`arch_isolation_driver`/`archetype_iso_scorer`) — resuelve de raíz el problema de naming inconsistente entre motores que la auditoría encontró y ejecutó en vivo (sección 2.5).

**Nuevo — output tipo "quiet edge" (detalle no obvio):** ningún motor actual tiene este concepto explícito. Se propone un algoritmo de selección específico: de entre TODOS los outputs generados (Nivel 1 cualitativo + Nivel 2 estadístico), elegir **el que menos se parezca al patrón típico de su posición** (ej. una base con rebote destacado, una pívot con 3P% destacado — la sorpresa posicional, no solo el percentil más alto en abstracto). Esto es distinto y complementario al algoritmo de la sección 10.3 (que ordena por percentil más alto sin ajuste posicional) — "quiet edge" prioriza lo **inesperado para la posición**, no solo lo **estadísticamente alto en general**.

**Se elimina/limpia:** la entrada huérfana `deny.duck_in` (sección de auditoría ya documentada), y se fuerza un solo idioma base en las plantillas (ya documentado como inconsistencia en la auditoría).

### 13.3. SLIDES — repensado como capas progresivas, no slides fijas de 1/2/3

**[VERIFICADO por `conversation_search`, añadido 2026-09-11]** Esta idea de capas no es tan nueva como la presenté — ya existía el concepto "Basic/Deep": *"el motor produce output completo y el report filtra cuánto mostrar (Basic = máx 3 situaciones, Deep = detalle completo)"* (sesión de diseño de abril). Mi "Capa 0 autónoma para modo sencillo" es una extensión de esa idea ya validada, no una invención desde cero — lo nuevo de verdad que añado es que la Capa 0 combine identidad+stat+quiet edge+acción en una sola tarjeta en vez de ser "Basic" = una versión recortada del mismo slide 1.

El formato actual (3 slides fijas: ¿Quién es? / ¿Qué hará? / ¿Qué hago yo? — spec exacta ya aprobada: slide 2 muestra "top 3 situaciones primarias", slide 3 "DENY/FORCE/ALLOW + máximo 2 AWARE") se reorganiza en **capas**, donde la primera capa es autónoma y suficiente por sí sola — diseño mobile-first real, no un resumen recortado de algo más largo:

- **Capa 0 — siempre visible, única en "modo sencillo":** una sola tarjeta que combina identidad (archetype con nomenclatura Synergy) + el stat destacado real más extremo (sección 10.3, con shrinkage aplicado) + el output "quiet edge" (13.2) + **una sola** acción defensiva concreta (el `winner` de `deny`, no una lista). Es la respuesta condensada a las 6 preguntas de Hoop Mentality en una sola tarjeta.

**🔴 CONFLICTO DE DISEÑO ENCONTRADO 2026-09-11, sin resolver — esto no lo decido yo:** el orden actual de las 3 slides (Identidad → Qué hará → Qué hago yo) **no es solo jerarquía de información — es un mecanismo de retención de atención deliberado y ya aprobado por Pablo**: *"ningún jugador profesional debería esperar a falta de 2 minutos [para ver el plan]... si lo invertimos hacemos que el jugador tenga que pasar por todos los slides hasta la información que más aprecia... el game plan lo último, y la identidad siempre lo primero"*. Es decir: el plan defensivo se puso **deliberadamente al final** para obligar a recorrer todo el informe antes de llegar "al premio".

Mi propuesta de Capa 0 pone la acción defensiva (`deny` winner) **dentro de la primera tarjeta**, junto con la identidad — esto **rompe exactamente el mecanismo de retención que ya se diseñó a propósito**. No es un error mío técnico, es un choque real entre dos objetivos legítimos: mi Capa 0 optimiza para "modo sencillo, un vistazo" (coherente con el mandato de Pablo de minimizar tiempo), pero el diseño de 3 slides ya aprobado optimiza para "retención completa incluso en modo normal". **No debo decidir esto yo — es exactamente la clase de decisión de producto que le corresponde a Pablo.**

Mi lectura, sin decidir por él: probablemente ambos objetivos coexisten bien si la Capa 0 **es exclusiva del modo sencillo** (donde no hay "resto de slides" que recorrer, así que no hay mecanismo de retención que romper) y el modo completo **mantiene el orden aprobado sin la acción adelantada a la Capa 0**. Pero esto es una propuesta de reconciliación, no la decisión final.
- **Capa 1 — modo completo:** mapa de situaciones ordenado por amenaza (equivalente al "¿Qué hará?" actual), ahora con el emparejamiento defensivo (pregunta 4 de 13.0, hueco nuevo a construir) si el club ya tiene asignado quién la marca.
- **Capa 2 — modo completo:** plan defensivo completo deny/force/allow con nivel de confianza visible por recomendación (13.2).
- **Capa 3 — modo completo, nueva, no existía antes:** contexto estadístico real de U Stats con transparencia de muestra (chips con percentil Y tamaño de muestra visible, nunca un número sin contexto).

### 13.4. Qué se propone recortar del modelo actual ("más ágil", como pide Pablo)

Comparado contra el framework de 6 preguntas, hay campos del `PlayerEditor` actual (~48) que no alimentan ninguna de las 6 preguntas ni ningún output visible en las 4 capas de arriba — candidatos a revisar si de verdad hacen falta o son ruido heredado de iteraciones anteriores. **[CERRADO, ver 15.7]** El mapeo campo-por-campo está hecho: 72 campos reales (no ~48), 67 mantener, 4 candidatos a recortar, 1 dudoso — con línea de código citada para cada veredicto.

### 13.5. Preguntas abiertas nuevas de esta sección (se suman a las de la sección 11)

4. ¿El "emparejamiento defensivo" (pregunta 4 del framework) debe vivir en U Scout o es más bien de `GamePlan.tsx` (asignación de marcajes)? Son módulos hoy separados.
5. ¿Estamos de acuerdo en que la Capa 0 sea autónoma (no un resumen recortado), aunque eso signifique rediseñar cómo se genera hoy la slide 1 del formato actual?
6. El mapeo campo-por-campo de 13.4 puede recortar campos que hoy usa el staff con regularidad — ¿prioridad "agilidad del formulario" por encima de "no perder ningún campo ya usado", o al revés?

---

## 14. Decisiones finales — propuesta cerrada (ya no son preguntas abiertas, son mi recomendación concreta)

> Pablo pidió que construyera yo la propuesta en vez de devolver preguntas. Aquí está la decisión en cada punto que antes dejé abierto, con el porqué. Sigue siendo una propuesta a que él apruebe o corrija — no una imposición — pero ya no es una lista de preguntas sin resolver.

### 14.1. Las 6 preguntas abiertas, resueltas

1. **¿Vínculo a U Stats obligatorio?** → **No, opcional con degradación elegante.** Muchas jugadoras rivales son extranjeras o de ligas sin PBP en el sistema. El motor debe funcionar idéntico sin Nivel 2 — simplemente sin Capa 3 ni chip de stat destacado en Capa 0. Forzarlo obligatorio bloquearía el uso normal del producto para un porcentaje real de jugadoras.
2. **¿Conservar los `key` de v2.1/v4 por compatibilidad con `report_overrides`?** → **No conservarlos, pero migrar una vez.** Naming nuevo y limpio (Synergy Offensive Roles, sección 12.5) sin arrastrar la deuda de dos esquemas mezclados. Para no perder el historial de aprobaciones ya hechas: un script de migración único que traduzca los `itemKey` viejos conocidos (mapa fijo, no heurístico) a los nuevos en `report_overrides` existentes, ejecutado una sola vez al lanzar Motor 1.0. Los overrides que no tengan mapeo claro se pierden y hay que re-aprobar — aceptable, es coste único de una vez.
3. **¿Prioridad núcleo vs. UX?** → **Núcleo primero (Fases 0-1), sin excepción.** Construir UX nueva sobre un motor que aún no es la única fuente de verdad significaría rehacer esa UX cuando el núcleo cambie. Es el orden que menos trabajo desperdicia.
4. **¿Dónde vive el emparejamiento defensivo (pregunta 4 del framework)?** → **Campo ligero dentro de U Scout, no una integración completa con `GamePlan.tsx`.** Un solo campo opcional en el perfil de la jugadora rival: "quién de mi equipo suele marcarla" (selector del roster propio, editable por el staff). No requiere tocar `GamePlan.tsx` para empezar a aportar valor en la Capa 1. Integrarlo de verdad con la asignación táctica completa de `GamePlan` queda como fase futura opcional, no bloqueante.
5. **¿Capa 0 autónoma, aunque implique rediseñar la slide 1 actual?** → **[REVERTIDO 2026-09-11, ver conflicto en sección 13.3]** Mi "Sí" anterior fue precipitado — lo di sin saber que el orden actual de slides es un mecanismo de retención de atención deliberado, no solo jerarquía de información. La Capa 0 autónoma sigue siendo buena idea, pero **solo para "modo sencillo"** (donde no hay slides que recorrer después). Para "modo completo", el orden aprobado (identidad primero, plan al final) se mantiene sin tocar. Esta es ahora mi recomendación corregida, pero sigue siendo Pablo quien debe confirmarla — el hallazgo es nuevo, no lo he validado con él todavía.
6. **¿Agilidad del formulario vs. no perder campos ya usados?** → **Agilidad por defecto, pero con revelado progresivo, no borrado.** Ningún campo del `PlayerEditor` actual desaparece de la base de datos ni dejará de poder rellenarse — se reorganiza la UI para mostrar primero lo esencial (las 6 preguntas) y el resto queda en una sección "avanzado" plegada por defecto. Nadie pierde capacidad, se gana velocidad para el caso común.

### 14.2. Boceto del modelo de datos de Fase 0 (nivel de tipos, no código real — esto es lo que se implementaría)

**[CERRADO 2026-09-11 — ver sección 14.2 bis]** Este boceto quedó superado: tras el conflicto de la 13.3 (Capa 0 vs. mecanismo de retención) y una revisión de El Arquitecto, el contrato de tipos definitivo de Fase 0 vive en 14.2 bis, con notas de justificación de cada cambio de forma. Se deja este boceto tal cual, sin editar, por trazabilidad.

```ts
// NIVEL 1 — observación del staff. Igual de espíritu que PlayerInputs de v2.1,
// reagrupado explícitamente por las 11 situaciones estándar de Synergy (12.1).
type StaffObservation = {
  situacion: "iso" | "pnrHandler" | "pnrRollMan" | "post" | "transition"
           | "spotUp" | "handoff" | "cut" | "offScreen" | "putback" | "misc";
  frecuencia: "P" | "S" | "R" | "N";               // Principal/Secundaria/Rara/Nunca
  camposObservados: Record<string, unknown>;         // los campos "neverInfer" de hoy, agrupados aquí
};

type PlayerProfileV1Inputs = {
  identidad: { nombre: string; posicion: string; alturaCm: number; pesoKg: number; manoDominante: "I" | "D" | "Ambidiestra" };
  wcbaExternalId?: string;              // vínculo opcional a U Stats (sección 5) — null si no aplica
  emparejamientoDefensivo?: string;     // id de jugadora propia — respuesta 14.1.4
  observaciones: StaffObservation[];    // una entrada por cada una de las 11 situaciones
  formaReciente?: "hot" | "cold" | "stable";
};

// NIVEL 2 — dato real de U Stats, siempre con metadata de fiabilidad, nunca "pelado".
type StatConVolumen = {
  valor: number;
  percentil: number;                    // idealmente por posición, sección 10.2
  percentilAjustadoPorMuestra: number;  // tras contracción bayesiana, sección 12.3
  volumenIntentos: number;
  ventana: "temporada" | "ultimos_12";  // sección 12.4
};

type PlayerRealStats = {
  ppg: StatConVolumen; rpg: StatConVolumen; apg: StatConVolumen;
  fg3Pct: StatConVolumen; efgPct: StatConVolumen; tsPct: StatConVolumen;
  usgPct: StatConVolumen; tovPct: StatConVolumen;
};

// OUTPUT — con confianza y quiet edge (sección 13.2)
type DefenseOutput = {
  key: string;              // naming nuevo, Synergy Offensive Roles adaptado
  categoria: "deny" | "force" | "allow" | "aware";
  situacionOrigen: string;
  score: number;
  confianza: "alta" | "media" | "baja";   // nuevo, no existía en v2.1/v4/mock-data
};

// CORREGIDO 2026-09-11: el motor NUNCA devuelve solo el ganador — siempre devuelve
// el ganador + todos los candidatos rankeados por campo (arquitectura ya decidida
// en abril 2026, ver sección 17.1). Sin esto, el entrenador no puede "reemplazar"
// por un runner-up en la revisión — la app tendría que recalcular en el clic, lo
// cual no es el diseño acordado.
type OutputCandidato = { output: DefenseOutput; score: number; rank: number };
type CampoConCandidatos = {
  ganador: DefenseOutput;
  candidatos: OutputCandidato[];   // incluye al ganador en rank 0, para poder diffear versiones (sección 17)
};

type QuietEdge = {
  output: DefenseOutput | StatConVolumen;
  motivo: "inesperado_para_posicion";     // el criterio, no solo percentil alto en abstracto
};

type ScoutingReportV1 = {
  archetypeKey: string;              // Synergy Offensive Roles
  capa0: { archetypeKey: string; statDestacado?: StatConVolumen; quietEdge?: QuietEdge; accionPrincipal: DefenseOutput };
  capa1: { situaciones: DefenseOutput[]; emparejamientoDefensivo?: string };
  capa2: { deny: DefenseOutput; force: DefenseOutput; allow: DefenseOutput };
  capa3?: PlayerRealStats;            // ausente si no hay vínculo a U Stats
};
```

Esto es el contrato de datos que Fase 0 tendría que fijar de verdad (con tipos exactos, no este boceto) antes de escribir el núcleo de cálculo de Fase 1.

### 14.2 bis. Contrato de tipos de Fase 0 — CERRADO (El Arquitecto + decisiones de producto, 2026-09-11)

> Pablo resolvió primero el conflicto de la 13.3 (**Capa 0 con acción defensiva incluida, exclusiva de modo sencillo; modo completo mantiene el orden aprobado sin adelantar la acción**). Con esa decisión ya fijada, delegué en El Arquitecto el cierre del contrato de tipos del boceto de 14.2. El Arquitecto entregó el contrato completo más 3 preguntas genuinas de producto que no le correspondía decidir a él — las respondo yo aquí mismo (documentado, con investigación real donde aplica), a petición explícita de Pablo ("haz una propuesta tú... intenta tomar las decisiones que más encajen con lo que queremos facilitar como herramienta para un entrenador").

#### Las 3 decisiones que cierran el contrato

1. **¿Qué campos son "tocables" (candidatos rankeados) en el flujo de aprobación (17.1-17.2)?** → **Solo `deny`/`force`/`allow`/`accionPrincipal`.** `CampoConCandidatos` existe para resolver una competencia real entre outputs con score dentro del sistema deny/force/allow/aware (cap 0,72, sección 3) — ahí un entrenador puede legítimamente preferir el runner-up. `quietEdge` (sigue siendo opcional, basta con poder omitirlo) y `capa1.situaciones` (ranking transparente completo, no una elección entre alternativas) no son productos de esa competencia con score — envolverlos en candidatos completos sería trabajo de Fase 1 sin beneficio real para el entrenador, y más superficie que revisar en cada aprobación contradice el mandato de minimizar su tiempo (16.3b, límite de Cowan ya citado).
2. **¿Taxonomía de posición para percentiles (10.2)?** → **3 grupos (Base/Alero/Interior), los mismos que `archetypeKey` (14.3), no 5 posiciones estilo NBA.** Investigado hoy: [Cleaning the Glass](https://cleaningtheglass.com/stats/guide/player_positions), referencia real de analítica NBA, usa 5 grupos híbridos (point/combo/wing/forward/big) — pero sobre muestras muchísimo mayores que la WCBA. Con los 236 jugadoras de la sección 10.1, 5 grupos dejarían buckets de ~47 jugadoras, y en métricas ya filtradas por volumen mínimo (ej. 3P%, solo 122 de 236 cualifican) el bucket real caería a 15-20 — insuficiente para que la contracción bayesiana de 12.3 tenga con qué trabajar. Con 3 grupos, cada bucket ronda ~79, casi el doble de muestra. Reusar la taxonomía de `archetypeKey` además evita mantener dos sistemas de clasificación por posición que puedan desincronizarse — menos superficie de error, mandato explícito del proyecto.
3. **¿`statsDestacados`/`quietEdge` exclusivos de modo sencillo, igual que `accionPrincipal`?** → **No — se muestran igual en ambos modos; solo `accionPrincipal` es exclusiva de modo sencillo.** Las secciones 7 y 10.3.4 ya describían estos chips como mejora del formato de 3 slides ("modo completo") *antes* de que existiera el conflicto de la 13.3. La objeción de Pablo era específicamente sobre adelantar el plan defensivo, no sobre mostrar contexto estadístico — quitarle estos chips al modo completo restaría valor sin resolver el conflicto real que motivó la pregunta.

#### Aclaración 2026-09-11 (al escribir los tests de aceptación de Fase 1): dónde vive de verdad el "máximo 2 AWARE"

Escribir `client/src/lib/motor-v1-acceptance.test.ts` obligó a verificar esto contra código real, no solo contra la spec. Resultado, **no es un bug, es una precisión que faltaba**: el motor (`motor-v2.1.ts:499`, `maxOutputsPerCategory.aware = 5`) calcula **hasta 5** candidatos aware — `report.selected.aware` puede (y de hecho lo hace, verificado con el perfil "Luka Doncic" de `test-profiles.json`) devolver más de 2. El corte a 2 se aplica hoy en la capa de presentación (`ReportSlidesV1.tsx:268`, `finalReport.alerts.slice(0, 2)`), no dentro del cálculo del motor.

**Esto no contradice `capa2.aware` en el contrato de tipos de arriba — lo confirma.** `capa2.aware` (tupla acotada a 2) representa el **reporte final ya curado**, no el pool crudo de candidatos — exactamente la misma filosofía que ya aplica a `deny`/`force`/`allow` (17.1: el motor calcula más candidatos de los que se muestran, la curación es un paso posterior). Implicación para Fase 1: el núcleo de cálculo debe exponer el pool completo de candidatos aware (hasta 5, como `CampoConCandidatos`, igual que deny/force/allow), y el corte a 2 debe vivir en el paso de ensamblado del reporte (`ScoutingReportV1`), nunca dentro del cálculo puro de outputs.

`[PENDIENTE VALIDAR CON PABLO]`: las 3 son mi propuesta razonada, no una imposición — igual que el resto de la sección 14, a corregir si no encaja con tu criterio de producto.

#### Contrato de tipos definitivo (reemplaza el boceto de 14.2)

```ts
// =====================================================================================
// MOTOR 1.0 — CONTRATO DE DATOS DE FASE 0 (definitivo)
// Sustituye el boceto de la sección 14.2. Cero código de producto — solo tipos y su
// justificación. Cada cambio de forma respecto al boceto original está numerado y
// explicado en las notas que siguen al bloque.
// =====================================================================================

// ---------------------------------------------------------------------------------
// 0. PRIMITIVAS COMPARTIDAS
// ---------------------------------------------------------------------------------

/** Las 11 situaciones estándar de Synergy (12.1), verificado 1:1 sin huecos ni sobrantes:
 *  iso=Isolation, pnrHandler=PnR Ball Handler, pnrRollMan=PnR Roll Man, post=Post-Up,
 *  transition=Transition, spotUp=Spot-Up, handoff=Handoff, cut=Cut, offScreen=Off-Screen,
 *  putback=Putback, misc=Miscellaneous. */
type SituacionSynergy =
  | "iso" | "pnrHandler" | "pnrRollMan" | "post" | "transition"
  | "spotUp" | "handoff" | "cut" | "offScreen" | "putback" | "misc";

/** Los 10 archetypeKey de 14.3 (Synergy Offensive Roles adaptado). Union literal,
 *  no `string` — ver Nota 1. */
type ArchetypeKey =
  | "armadora_creadora" | "armadora_anotadora" | "manejadora_secundaria"
  | "alero_penetradora" | "alero_tiradora" | "alero_movimiento"
  | "interior_creadora" | "interior_poste" | "interior_abridora" | "interior_finalizadora";

/** Naming nuevo de outputs (deny/force/allow/aware individuales), catálogo exacto
 *  pendiente del mapeo de 13.4/15.1 (OUTPUT_CATALOG) — ver Nota 2. */
type OutputKey = string & { readonly __brand: "OutputKey" };

/** Posición de la jugadora — grupo de 3 (decisión #2 arriba: Base/Alero/Interior,
 *  coherente con ArchetypeKey), no 5 posiciones NBA. */
type PosicionJugadora = "base" | "alero" | "interior";

type EscalaCualitativa = 1 | 2 | 3 | 4 | 5;

// ---------------------------------------------------------------------------------
// 1. NIVEL 1 — observación del staff (13.1). Nunca inferido, nunca calculado.
// ---------------------------------------------------------------------------------

/** Campo de Nivel 1 con procedencia explícita: observación pura del staff, o
 *  autorrelleno editable desde un proxy real de Nivel 2 (15.4). Ver Nota 3. */
type CampoNivel1<T> =
  | { origen: "staff"; valor: T }
  | { origen: "autorrelleno_proxy"; valor: T; proxyFuente: "ftPct" | "ftaRate"; editadoPorStaff: boolean };

/** Sección "Perfil físico / Tiros libres" del formulario (15.1) — NO es por-situación,
 *  por eso vive separada de StaffObservation. Ver Nota 3. */
interface PerfilFisicoYTiros {
  athleticism: CampoNivel1<EscalaCualitativa>;        // 15.4: SIN proxy, siempre origen "staff"
  physicalStrength: CampoNivel1<EscalaCualitativa>;   // 15.4: SIN proxy, siempre origen "staff"
  ftShooting: CampoNivel1<EscalaCualitativa>;         // 15.4: autorrellenable desde ftPct
  foulDrawing: CampoNivel1<EscalaCualitativa>;        // 15.4: autorrellenable desde ftaRate
  // Nota: TS no puede restringir "origen: autorrelleno_proxy" solo a ftShooting/foulDrawing
  // sin 4 tipos casi idénticos — se documenta aquí y se valida en Fase 1 (test/assert).
}

/** Una entrada por cada una de las 11 situaciones (siempre las 11, incluso las no
 *  marcadas en el paso 1 del flujo 15.3 — esas quedan con frecuencia "N" y
 *  camposObservados: {}). */
interface StaffObservation {
  situacion: SituacionSynergy;
  frecuencia: "P" | "S" | "R" | "N";          // Principal/Secundaria/Rara/Nunca
  camposObservados: Record<string, unknown>;  // ~48 campos repartidos en Post/ISO/PnR/
  // Off-ball/Spot-up (15.1) — catálogo exacto pendiente del mapeo campo-por-campo de
  // 13.4/15.1 (auditoría mecánica, ya marcada pendiente en el propio documento — ver
  // Nota 4, no bloquea Fase 0). Todo campo aquí es neverInfer puro (origen "staff"
  // siempre) — a diferencia de PerfilFisicoYTiros, ningún campo por-situación tiene
  // proxy de Nivel 2 (15.4 solo identifica ftShooting/foulDrawing, que NO son por-situación).
}

interface PlayerProfileV1Inputs {
  version: "1.0";
  jugadoraId: string;
  identidad: IdentidadInput;
  wcbaExternalId?: string;                    // vínculo opcional a U Stats (5.1-5.2, 14.1.1)
  emparejamientoDefensivo?: string;           // id de jugadora propia (14.1.4)
  perfilFisicoYTiros: PerfilFisicoYTiros;
  situacionesSeleccionadas: SituacionSynergy[]; // paso 1 del flujo 15.3 (máx. recomendado 3-4,
                                                 // aviso no bloqueante, no una restricción de tipo)
  observaciones: StaffObservation[];          // siempre 11 entradas, ver comentario arriba
  formaReciente?: "hot" | "cold" | "stable";
  generadoOffline?: boolean;                  // 18.4
  sincronizadoEn?: string;                    // ISO datetime, 18.2-18.3
}

interface IdentidadInput {
  nombre: string;
  posicion: PosicionJugadora;
  alturaCm: number;
  pesoKg: number;
  manoDominante: "I" | "D" | "Ambidiestra";
  numero: string;          // AÑADIDO 2026-09-11 (hallazgo 15.7.2) — string, no number:
                            // verificado en mock-data.ts:316, dorsales no son puramente numéricos
  fotoUrl?: string;         // AÑADIDO 2026-09-11 (hallazgo 15.7.2) — opcional: no toda
                            // jugadora tendrá foto cargada (el tipo actual la exige, se relaja aquí)
  esEstrella?: boolean;     // AÑADIDO 2026-09-11 (hallazgo 15.7.2) — verificado opcional/nullable
                            // en mock-data.ts:90; afecta score real (motor-v2.1.ts:973, starMod=1.05)
  // SIN archetypeKey aquí — el archetype es Nivel 3 (inferido), no un input directo.
  // Ver Nota 5.
}

// ---------------------------------------------------------------------------------
// 2. NIVEL 2 — dato real de U Stats (13.1, sección 5). Siempre con metadata, nunca "pelado".
// ---------------------------------------------------------------------------------

interface StatConVolumen {
  valor: number;
  percentil: number;                     // por posición (10.2, decisión #2): 3 grupos
  percentilAjustadoPorMuestra: number;   // tras contracción bayesiana, 12.3
  volumenIntentos: number;
  ventana: "temporada" | "ultimos_12";   // 12.4
}

interface PlayerRealStats {
  ppg: StatConVolumen; rpg: StatConVolumen; apg: StatConVolumen;
  spg: StatConVolumen; bpg: StatConVolumen;          // NUEVO — estaban en la tabla de 10.1, faltaban en el boceto
  fg3Pct: StatConVolumen; efgPct: StatConVolumen; tsPct: StatConVolumen;
  usgPct: StatConVolumen; tovPct: StatConVolumen;
  ftPct: StatConVolumen;    // NUEVO — requerido como proxy de ftShooting (15.4), faltaba en el boceto
  ftaRate: StatConVolumen;  // NUEVO — requerido como proxy de foulDrawing (15.4), faltaba en el boceto
}
// Ver Nota 6 sobre tovPct vs. "TOV/partido" de la tabla 10.1.

// ---------------------------------------------------------------------------------
// 3. NIVEL 3 — inferido por el motor (13.1). Nunca observación directa.
// ---------------------------------------------------------------------------------

/** Detección de discrepancia Nivel 1 vs Nivel 2 (13.1) — el motor NUNCA autocorrige,
 *  solo avisa. `soloAviso: true` fija esa garantía a nivel de tipo, no solo de comentario. */
interface DiscrepanciaNivel1Nivel2 {
  campoNivel1: string;              // ref. al campo observado, ej. "iso.frecuencia"
  valorNivel1: unknown;
  campoNivel2: keyof PlayerRealStats;
  valorNivel2: StatConVolumen;
  motivo: string;                   // texto generado, ej. "staff marcó ISO:Nunca pero USG% real está en P90"
  soloAviso: true;
}

// ---------------------------------------------------------------------------------
// 4. OUTPUTS — deny/force/allow/aware, con confianza y candidatos rankeados (13.2, 17.1)
// ---------------------------------------------------------------------------------

interface DefenseOutput {
  key: OutputKey;
  categoria: "deny" | "force" | "allow" | "aware";
  situacionOrigen: SituacionSynergy;    // antes `string` — ahora reusa el union de 12.1
  score: number;                        // 0..0.72, cap anti-inflación (sección 3)
  confianza: "alta" | "media" | "baja"; // 13.2
  porque?: string;                      // NUEVO — "por qué" de una línea citando Nivel 2 si existe (15.5)
}

interface OutputCandidato {
  output: DefenseOutput;
  score: number;
  rank: number;                         // 0 = ganador
}

/** El motor NUNCA devuelve solo el ganador (17.1). Solo deny/force/allow/accionPrincipal
 *  se envuelven así (decisión #1 arriba) — quietEdge y capa1.situaciones no. */
interface CampoConCandidatos {
  ganador: DefenseOutput;
  candidatos: OutputCandidato[];        // incluye al ganador en rank 0
}

/** Ranking de amenaza por situación ("¿qué hará?", capa 1) — NO tocable (decisión #1),
 *  NO es un DefenseOutput (eso es deny/force/allow/aware). Ver Nota 7. */
interface SituacionAmenaza {
  situacion: SituacionSynergy;
  score: number;                        // 0..0.72, cap sección 3
  frecuenciaObservada: "P" | "S" | "R" | "N";
}

/** Selección de "quiet edge" (13.2) — solo ocultable (decisión #1), sin candidatos
 *  rankeados. Puede ser un output cualitativo o una métrica de Nivel 2. Ver Nota 8. */
type QuietEdgeSeleccion =
  | { tipo: "cualitativo"; output: DefenseOutput }
  | { tipo: "estadistico"; campo: keyof PlayerRealStats; stat: StatConVolumen };

interface QuietEdge {
  seleccion: QuietEdgeSeleccion;
  motivo: "inesperado_para_posicion";
}

/** Chip de stat destacado (10.1-10.3) — presente en ambos modos (decisión #3), igual
 *  que QuietEdge, necesita saber qué métrica es, no solo el StatConVolumen suelto. */
interface StatDestacado {
  campo: keyof PlayerRealStats;
  stat: StatConVolumen;
  nivel: "destacado" | "elite";         // P85 / P95 (10.1)
}

// ---------------------------------------------------------------------------------
// 5. REPORTE — exclusión modo sencillo / completo (13.3, 14.1.5). Ver Nota 9 — el
//    cambio de forma más importante de este cierre.
// ---------------------------------------------------------------------------------

interface IdentidadReporte extends IdentidadInput {
  archetypeKey: ArchetypeKey;           // Nivel 3, inferido — nunca input directo
  statsDestacados: StatDestacado[];     // presente en ambos modos (decisión #3): 0-3 en
                                         // completo, 0-1 en sencillo (10.3.4)
  quietEdge?: QuietEdge;                // presente en ambos modos (decisión #3); ausente
                                         // si no hay dato suficiente
}

interface ScoutingReportBaseV1 {
  version: "1.0";
  jugadoraId: string;
  wcbaExternalId?: string;
  identidad: IdentidadReporte;          // SIEMPRE primero, SIN acción, en ambos modos
  emparejamientoDefensivo?: string;
  generadoOffline?: boolean;
  sincronizadoEn?: string;
}

/** Modo sencillo: identidad + accionPrincipal (el winner de deny). Es el ÚNICO campo
 *  exclusivo de este modo (decisión #3) — la resolución del conflicto de 13.3 no afecta
 *  a statsDestacados/quietEdge (esos ya existían en el formato de 3 slides, sección 7/10.3.4). */
interface ReporteModoSencilloV1 extends ScoutingReportBaseV1 {
  modo: "sencillo";
  accionPrincipal: CampoConCandidatos;  // el "winner" de deny, con candidatos (17.1)
}

/** Modo completo: identidad (sin acción) → capa1 (qué hará) → capa2 (qué hago yo,
 *  completo) → capa3 (stats). Orden fijo ya aprobado, SIN acción adelantada. */
interface ReporteModoCompletoV1 extends ScoutingReportBaseV1 {
  modo: "completo";
  capa1: {
    situaciones: SituacionAmenaza[];           // ordenado por amenaza, no tocable (decisión #1)
    emparejamientoDefensivo?: string;          // eliminado el duplicado del boceto — vive en base
  };
  capa2: {
    deny: CampoConCandidatos;
    // force?/allow? CORREGIDO 2026-09-11 al implementar Fase 1 (ver sección 21.6):
    // verificado contra los 10 perfiles reales de test-profiles.json que force
    // falta en 4/10 y allow en 2/10 -- no es un caso raro. Forzar un fallback
    // (ej. reusar deny) le mostraría al entrenador una recomendación que el
    // motor nunca generó. deny se queda obligatorio porque en la práctica
    // siempre hay al menos un output de deny con weight > 0.
    force?: CampoConCandidatos;
    allow?: CampoConCandidatos;
    // NUEVO — el boceto original olvidaba "aware" pese a que 13.3/7 exigen máx. 2
    // AWARE. Tupla en vez de array para acotar el límite cognitivo (16.3b, Cowan 4±1)
    // a nivel de tipo, no solo de convención.
    aware: [] | [CampoConCandidatos] | [CampoConCandidatos, CampoConCandidatos];
  };
  capa3?: PlayerRealStats;              // ausente si no hay vínculo Nivel 2 (14.1.1)
}

/** Unión discriminada por `modo` — ver Nota 9 para por qué esta forma y no otra. */
type ScoutingReportV1 = ReporteModoSencilloV1 | ReporteModoCompletoV1;

// ---------------------------------------------------------------------------------
// 6. SOPORTE PARA EL FLUJO DE APROBACIÓN (17.1-17.2) — necesario para que el contrato
//    respete decisiones ya cerradas, no bloqueante para el núcleo de cálculo de Fase 1.
// ---------------------------------------------------------------------------------

/** Identifica el campo tocable exacto (17.2: "qué campo exacto difiere"). Solo cubre
 *  los 4 campos tocables de la decisión #1 — quietEdge/situaciones no aparecen aquí
 *  porque no son sustituibles, solo ocultables a nivel de presentación. */
type CampoTocable =
  | { tipo: "deny" | "force" | "allow" | "accionPrincipal" }
  | { tipo: "aware"; indice: 0 | 1 };

type AccionRevision = "replace" | "hide" | "approve_as_is";  // nombres ya fijados, sin traducir (17.2)

interface EventoRevisionCampo {
  reportId: string;
  campo: CampoTocable;
  action: AccionRevision;                                          // nombre ya fijado (17.2)
  original_score: number;                                          // nombre ya fijado (17.2)
  replacement_score?: number;                                      // ausente si action === "hide"
  outputOriginalKey: OutputKey;
  outputElegidoKey?: OutputKey;                                    // ausente si action === "hide"
  rankElegido?: number;                                            // ausente si action === "hide"
  entrenadorId: string;   // NUNCA expuesto nominalmente en panel global — responsabilidad
                           // de la capa de presentación, no de este tipo (17.2)
  timestamp: string;      // ISO datetime
  // Deliberadamente SIN jugadoraId/nombre de la jugadora rival — no se registra nunca
  // en eventos de calibración (17.2).
}

/** Vista agregada para calibración (Nivel B de aprendizaje, 17.3) — por construcción
 *  de tipo, no puede llevar identidad de jugadora ni entrenador nominal. */
interface PatronCalibracion {
  archetypeKey: ArchetypeKey;
  campo: CampoTocable;
  action: AccionRevision;
  ocurrencias: number;
  gapPromedio: number;      // original_score - replacement_score, promedio (17.2)
}
```

#### Notas de justificación de El Arquitecto (por cada cambio de forma respecto al boceto de 14.2)

**Nota 1 — `archetypeKey: ArchetypeKey` (union literal de 10) en vez de `string`.** La sección 14.3 ya fija los 10 valores exactos — dejarlo como `string` renuncia gratis a que TypeScript detecte un typo o un valor fuera de catálogo en tiempo de compilación.

**Nota 2 — `DefenseOutput.key: OutputKey` (branded string) en vez de `key: string`.** No hay un catálogo cerrado de outputs todavía (depende del mapeo pendiente de 13.4/15.1). Un tipo *branded* impide mezclar por error un `SituacionSynergy` o un `ArchetypeKey` donde se espera un `OutputKey`, sin fingir que el catálogo ya está cerrado.

**Nota 3 — `PerfilFisicoYTiros` como tipo separado de `StaffObservation`, con `CampoNivel1<T>`.** `athleticism`/`physicalStrength`/`ftShooting`/`foulDrawing` no son por-situación — son la sección "Perfil físico / Tiros libres" del formulario real (15.1), independiente de ISO/Post/PnR. `CampoNivel1<T>` hace explícita la distinción que pide 15.4: dos de los cuatro son autorrellenables-editables desde un proxy de Nivel 2, los otros dos nunca.

**Nota 4 — `StaffObservation.camposObservados` se deja como `Record<string, unknown>`.** El mapeo campo-por-campo de los ~48 campos está pendiente y requiere releer `PlayerEditor.tsx` completo (13.4/15.1) — es auditoría mecánica, no decisión de arquitectura. Fase 1 puede tipar esto exhaustivamente en cuanto exista el mapeo.

**Nota 5 — `archetypeKey` sale de `IdentidadInput` (Nivel 1) y solo existe en `IdentidadReporte` (Nivel 3).** El archetype se deriva del patrón de frecuencias observadas + posiblemente USG%/percentiles — nunca lo teclea el staff directamente, es un output del motor, no un input.

**Nota 6 — `PlayerRealStats` gana `spg`, `bpg`, `ftPct`, `ftaRate`.** La tabla de 10.1 incluye SPG y BPG, ausentes en el boceto; `ftPct`/`ftaRate` son obligatorios para el autorrelleno de 15.4. Nota aparte, sin resolver aquí: la tabla 10.1 usa "TOV/partido" (conteo bruto) mientras el tipo usa `tovPct` (tasa normalizada) — son métricas distintas; recomendación de arquitectura es usar `tovPct` como canónico y recalcular 10.1 para esa métrica, pero es trabajo de datos ligado al pendiente de 10.2.

**Nota 7 — `SituacionAmenaza` nuevo, `capa1.situaciones` deja de ser `DefenseOutput[]`.** `DefenseOutput.categoria` (deny/force/allow/aware) no tiene sentido para un ranking de amenaza por situación — confundir ambos conceptos habría obligado a rellenar `categoria` sin sentido o a adivinar por convención.

**Nota 8 — `StatDestacado` y `QuietEdgeSeleccion` en vez de `StatConVolumen` suelto.** Un `StatConVolumen` aislado no dice qué métrica es (¿PPG? ¿TS%?) — esa información solo existe como clave dentro de `PlayerRealStats` y se perdía al extraer un valor suelto en el boceto original. Bug real de forma, no solo estilo.

**Nota 9 — La exclusión modo sencillo/completo se resuelve con unión discriminada por `modo`.** Evaluadas 3 alternativas: (a) `capa0` opcional — descartada, no comunica por qué está ausente y no fuerza a manejar el caso; (b) dos tipos sin relación — descartada, duplicaría identidad sin necesidad; (c) unión discriminada con base compartida que nunca lleva acción, elegida — TypeScript fuerza a manejar ambas ramas explícitamente, es estructuralmente imposible que modo completo acceda a `accionPrincipal` por error de copy-paste.

**Nota 10 — `capa2.aware` añadido, como tupla acotada.** El boceto omitía `aware` pese a que 13.3/7 exigen máximo 2. Tipado como tupla (no `[]` genérico) porque el límite está anclado al límite de Cowan (16.3b), no es preferencia de UI arbitraria.

**Nota 11 — `deny`/`force`/`allow`/`accionPrincipal` pasan a `CampoConCandidatos`, no `DefenseOutput` suelto.** El boceto contradecía de raíz 17.1 ("el motor nunca devuelve solo el ganador") — sin candidatos en el propio tipo del reporte, el flujo de sustitución tendría que recalcular en el clic.

### 14.3. Mapa de naming propuesto: Synergy Offensive Roles → español, para archetypeKey

| Synergy (inglés, estándar citado en 12.5) | `archetypeKey` propuesto |
|---|---|
| Playmaking ball handler | `armadora_creadora` |
| Scoring ball handler | `armadora_anotadora` |
| Secondary ball handler | `manejadora_secundaria` |
| Slashing wing | `alero_penetradora` |
| Spot-up shooting wing | `alero_tiradora` |
| Dynamic shooting wing | `alero_movimiento` |
| Playmaking big | `interior_creadora` |
| Post-up big | `interior_poste` |
| Stretch big | `interior_abridora` |
| Rim-finishing big | `interior_finalizadora` |

**[CERRADO 2026-09-11, investigado]** Verificado contra terminología real del baloncesto en español (no inventada): "ala-pívot" (con guion) es la forma recomendada en español para el PF ([Estandarte — Hablemos correctamente del baloncesto](https://www.estandarte.com/noticias/idioma-espanol/hablemos-correctamente-del-baloncesto_4258.html)), y el concepto de "stretch four" (un ala-pívot con tiro exterior, "abre" la defensa) es terminología real ya usada en medios de baloncesto en español. El prefijo `interior_` (en vez de separar ala-pívot/pívot como dos grupos distintos) también queda validado: los "Offensive Roles" de Synergy clasifican por **función**, no por posición nominal — un "Stretch big" puede ser PF o C, exactamente el mismo criterio "sin posición" que ya se adoptó para el agrupamiento de percentiles de 14.2 bis (decisión #2). La tabla se mantiene tal cual, ya no es una propuesta sin validar — el vocabulario usado (creadora/anotadora/tiradora/abridora/finalizadora) coincide con el uso real del español de baloncesto, no es una traducción literal forzada del inglés.

### 14.3 bis. `archetypeModificador` — segunda dimensión excepcional para jugadoras modernas (El Arquitecto, 2026-09-12)

> Encargo directo de Pablo: *"hablamos de que podríamos poner archetype y sub archetipe o archetipe y un adjetivo detrás... para definir a jugadores modernos. klay thompson no es base nunca. es alero. no genera ni sube la pelota ni apenas usa el dribbling."* La parte de Klay/SG ya está cerrada aparte (pregunta 2 de 21.7, corrección directa en `mapearPosicion()`). Esta sección es la segunda dimensión que pedía además.

**Hallazgo antes de diseñar nada, verificado contra código real: esto ya se construyó una vez y ya se descartó por una razón escrita.** `motor-v4.ts:423-446` calcula un `archetypeCandidates`/sub-archetype como "la segunda situación con más score", y `ReportSlidesV1.tsx:381-385` lo renderiza hoy en producción como `"También: {label}"`. Es exactamente la construcción que el principio **P2** de 21.7 (el archetype debe añadir información que `SituacionAmenaza[]` no tenga ya) declara defectuosa — repetir la situación #2 con otro nombre no añade nada. El encargo de Pablo no era "recuperar eso", era resolver el hueco real que ese sistema viejo nunca resolvió.

**El hueco es real, demostrado con datos, no hipotético.** Perfil real Steph Curry (`p003`): `archetypeKey = armadora_anotadora`, pero su situación #2 real es `offScreen 0.92` — anota corriendo sin balón, no con el bote, y en modo sencillo el informe entero ("armadora anotadora, ciérrale el triple") no lo dice en ningún sitio. Es el gemelo estructural de la queja de Pablo sobre Klay.

**Diseño: catálogo cerrado de 2 valores, dispara por excepción.**

```ts
export type ModificadorArchetype = "de_movimiento" | "a_la_contra";
```

- `de_movimiento` — la amenaza nace **sin balón** (pantallas indirectas, curls, trail). Separa "anota" de "anota corriendo".
- `a_la_contra` — la amenaza nace **antes de que se arme el ataque** (transición). Separa "finaliza" de "finaliza antes de que llegues".

Un tercer candidato (`atacando_cierres`, gate `spotUpAction === 'pump'`) se descartó **por falta de cobertura, no por gusto**: `spotUpAction` es `null` en los 14 perfiles de test — una regla sin un solo caso verificado no entra al catálogo v1.

**`3_y_D` queda fuera a propósito.** `PlayerInputs` (`motor-v2.1.ts`) no tiene ningún campo de observación defensiva — el perfil de test `p010` se llama literalmente "3-and-D wing" pero la "D" de su nombre es decorativa, el motor no puede derivarla de ningún dato real hoy. Prometer ese modificador sería prometer un dato que no se captura — es trabajo de Fase 4 (captura), no de este cierre.

**Dónde se muestra:** fusionado en la etiqueta de archetype ("Alero tiradora de movimiento"), en **ambos modos** (mismo precedente que `statsDestacados`/`quietEdge`, decisión #3 de 14.2 bis) — nunca como chip visual propio, y **sin icono propio** (la iconografía de 20.3 se queda anclada a los 10 `archetypeKey`, para no convertir un pendiente de 10 iconos en uno de 40).

**Cómo se calcula — cero campos nuevos, todo Nivel 1 ya existente en `SenalesArchetype`.** La invariante que evita repetir el error de `motor-v4.ts`: **un modificador nunca puede repetir la situación de la que ya nace `deny.ganador`** — verificable directamente con `DefenseOutput.situacionOrigen`. Consecuencia de secuenciación real en `motor-v1.ts::ensamblarReporte()`: `deny` se calcula antes que `identidad` (antes no era así), porque `detectarModificador()` necesita `deny.ganador.situacionOrigen`.

**Validado contra los 14 perfiles reales (ejecutado, no estimado):** dispara en 3/14 (21%) — `p003` Curry y `p005` Klay dan `de_movimiento` (exactamente la familia de jugadores que Pablo nombró), `p004` Giannis da `a_la_contra`. Se suprime correctamente en 2 casos donde dispararía sin la invariante: `p008` Gobert (transición alta, pero `deny.ganador` ya nace de transición) y `p013` (señal de movimiento real, pero `archetypeKey` ya es `alero_movimiento`).

**`archetypeConfianza` deja de descartarse.** `detectarArchetype()` (21.7) ya calculaba un margen de confianza que `ensamblarReporte()` tiraba (solo usaba `.key`). Ahora es un campo obligatorio de `IdentidadReporte`, **nunca mostrado a la jugadora** — alimenta el flujo de revisión del entrenador (17.1/17.3). Caso real: `p011` (pívot abridor sintético, híbrido roll/pop genuino) sale con `confianza: "baja"` — la respuesta correcta a un caso ambiguo es señalarlo para revisión humana, no inventar un adjetivo.

**Contrato de tipos — aditivo, sin romper 14.2 bis.** `IdentidadReporte` gana `archetypeModificador?: ModificadorArchetype` (opcional, ausente es el caso normal) y `archetypeConfianza: "alta"|"media"|"baja"` (obligatorio). `archetypeKey` **no se toca** — sigue siendo un valor plano, no se anida en un objeto. Razón explícita: `PatronCalibracion.archetypeKey` (17.3, Nivel B de aprendizaje) agrega eventos de revisión por archetype; si el modificador entrase en esa clave, los buckets de calibración pasarían de 10 a ~30, destruyendo la potencia estadística que la decisión #2 de 14.2 bis ya protegió eligiendo 3 grupos de posición en vez de 5. **El modificador se queda deliberadamente fuera de la calibración.**

**Pendiente, no bloqueante:** `ReportSlidesV1.tsx:381-385` (el "También: X" viejo) se retira cuando ese componente pase a consumir `motor-v1` (Fase 3) — mientras siga leyendo `motor-v4`, dejarlo como está es correcto, no hay dos sistemas conviviendo en producción. i18n (es/en/zh) de los 12 valores (10 `archetypeKey` + 2 `ModificadorArchetype`) queda pendiente — ninguno de los 10 `archetypeKey` tenía labels todavía tampoco (`reportTextRenderer.ts` traduce el namespace legacy `archetype_*`, no el nuevo), así que se hacen los 12 de una vez cuando toque esa migración, no antes.

**`[CERRADO 2026-09-12, ver 21.10]`** Las 3 preguntas de sensibilidad de baloncesto que quedaban aquí (¿tercer eje de modificador?, umbral `offScreen`, supresión de Gobert) están resueltas — decisión propia, a petición explícita de Pablo ("resuélvelas tú documentándote y analizando todo a fondo, haz test si lo necesitas"), con investigación real y verificación empírica contra los 24 perfiles, no solo criterio.

### 14.3 ter. Calibración contra metodología de scouting real y contra scouts publicados de las jugadoras concretas del fixture (2026-09-12)

> Encargo de Pablo: documentarse a fondo sobre cómo se hace scouting individual de verdad, y sobre scouts reales de estos jugadores concretos, para calibrar el motor — "hazlo tú mismo". Búsquedas web reales hechas hoy, fuente citada en cada hallazgo, igual que el resto del documento.

**Metodología real, y por qué valida el enfoque de nombrar por función, no por adjetivo genérico.** Los informes de scouting reales se centran en observaciones cualitativas de tendencias ofensivas y hábitos situacionales por jugador, con plantillas estandarizadas para poder comparar entre partidos ([Hoop Mentality — Basketball Scouting Workflow](https://hoopmentality.com/blogs/basketball/basketball-scouting-workflow-team-preparation)). Más importante: la práctica moderna de scouting **rechaza explícitamente el adjetivo vago** a favor del descriptor funcional — la fuente lo dice casi con las palabras exactas del diseño de El Arquitecto: *"phrases like 'low-usage connector with defensive elasticity' rather than vague terms"* ([The Language of Mismatch — Scouting Vocabulary](https://slamdunkscouting.substack.com/p/the-language-of-mismatch-how-scouting)). `de_movimiento`/`a_la_contra` son exactamente ese tipo de descriptor funcional, no un adjetivo ("dinámico", "explosivo") — la investigación confirma que el enfoque ya elegido es el correcto, no solo una preferencia de diseño interna.

**Validación jugador por jugador (todos los del fixture de `test-profiles.json`):**

| jugador | archetype/modificador actual | scouting real, citado | conclusión |
|---|---|---|---|
| **Curry (p003)** | `armadora_anotadora` + `de_movimiento` | "the best movement shooter of all-time" (entrenador rival citado); su desplazamiento sin balón es "lo mejor que hace" ([Let's Go Warriors](https://www.letsgowarriors.com/p/steph-curry-relocating-off-ball-sight-to-behold-movement-shooter-iisalo-gratitude-warriors-grizzlies)) | **exacto** — la fuente usa literalmente "movement shooter" |
| **Klay Thompson (p005)** | `alero_tiradora` + `de_movimiento` | "constantly moving without the ball and coming around screens"; "catch-and-shoot extraordinaire" ([Bleacher Report](https://bleacherreport.com/articles/2430552-breaking-down-klay-thompsons-picture-perfect-jump-shot)) | **exacto** — movimiento descrito como rasgo definitorio, no marginal |
| **Giannis (p004)** | `interior_finalizadora` + `a_la_contra` | "unstoppable in the open court"; 6,1 puntos de contraataque/partido, "relentless pursuit of transition dunks" ([HoopBrief — How to Guard](https://hoopbrief.com/how-to-guard/giannis-antetokounmpo)) | **exacto** |
| **Draymond Green (p009)** | `interior_creadora` | "exceptional playmaker... crucial to Warriors' offensive flow"; "does everything but score" ([Yahoo Sports scouting report](https://sports.yahoo.com/draymond-green-scouting-report-accolades-205422308.html)) | **confirma la decisión #6.1 de El Arquitecto** (creadora, no un genérico "role player") sin necesitar desempate — la fuente independiente coincide |
| **Jokic (p002)** | `interior_creadora` | "arguably the best passing big man ever"; "his passing and playmaking take center stage" cuando defienden con un jugador pequeño ([NBA.com](https://www.nba.com/news/2023-nba-finals-heat-nuggets-game-2-preview)) | **resuelve la pregunta 1 de 21.7 sin necesitar el criterio de Pablo** — el scouting real pone la creación por delante del post-up como rasgo definitorio de Jokic, igual que decidió El Arquitecto por P2 |
| **Gobert (p008)** | `interior_finalizadora`, `a_la_contra` suprimido | su finalización de lob/pick-and-roll y su aporte a la transición se describen como **una sola idea continua**, no dos rasgos separados: "finishing lobs efficiently and providing outlet passes that fueled Utah's transition game" ([fuentes combinadas de scouting](https://sports.yahoo.com/rudy-gobert-scouting-report-accolades-114602044.html)) | **valida la supresión** (pregunta 3 de 14.3 bis): el propio scouting real nunca separa "rim runner" de "transition threat" en Gobert — son la misma frase, así que separarlos en la etiqueta sería una distinción que ni los scouts reales hacen |
| **Haliburton (p007)** | `armadora_creadora` | "pass-first point guard"; "his standout skill is his passing" ([MavsDraft scouting report](https://mavsdraft.com/scouting-report-tyrese-haliburton/)) | **exacto** |
| **Embiid (p006)** | `interior_poste` | "dazzling post scorer"; "nasty face-up game" ([Mike Prada — The face-up low-post monster](https://mikeprada.substack.com/p/joel-embiid-post-up-philadelphia-76ers)) | **exacto** — y confirma por contraste que Jokic (arriba) es el caso correcto para *no* usar poste: el scouting real de Embiid SÍ pone el post-up por delante, el de Jokic no |

**Sobre la pregunta 1 (¿falta un tercer eje de modificador?):** la búsqueda no encontró un tercer eje recurrente que el motor pueda calcular hoy. El candidato más citado en la literatura de scouting — "clutch"/creador de tiro de alta dificultad en último cuarto de posesión — depende de splits por momento del partido (shot-clock, tiempo restante) que no existen en `PlayerInputs` ni en U Stats hoy; sería prometer un dato que no se captura, el mismo problema ya identificado con `3_y_D` en 14.3 bis. Queda como candidato explícito para cuando exista ese dato (Fase 2+), no se añade ahora.

**Sobre la pregunta 2 (umbral `offScreen >= 0.6`):** la investigación apoya **mantener 0.6, no subirlo a 0.7**. Las fuentes describen el movimiento sin balón de Klay como un rasgo definitorio y constante ("constantly moving", no "a veces se mueve") — subir el umbral a 0.7 lo excluiría, contradiciendo el consenso real de scouting sobre uno de los dos jugadores que motivó la feature. `[A VALIDAR CON PABLO]` sigue siendo su decisión final, pero ahora con evidencia real detrás, no solo intuición.

**Sobre la pregunta 3 (Gobert suprimido):** la investigación apoya **mantener la supresión** — ver fila de Gobert en la tabla arriba. El scouting real nunca describe su transición como un rasgo aparte de su rol de finalizador; forzar la etiqueta completa introduciría una distinción que ni las fuentes reales hacen.

### 14.4. Definición de "listo para empezar a construir"

Con las secciones 1-14 de este documento, **la Fase 0 del roadmap (sección 8) ya tiene todo lo que necesita para arrancar**: modelo de datos (14.2 bis, contrato de tipos cerrado), naming (14.3), qué conservar y qué cambiar (secciones 3-4, 13.2), y las decisiones de producto que antes bloqueaban el arranque (14.1).

**[CERRADO 2026-09-11]** El mapeo campo-por-campo de `PlayerEditor.tsx` (13.4), la única auditoría mecánica que quedaba pendiente, está hecho — ver sección 15.7. Los 2 hallazgos técnicos que dejó (campo `postPreferredBlock` sin UI, 3 campos de identidad sin tipo) ya están decididos y reflejados en el contrato — ver 15.7b. **No queda ningún pendiente que bloquee el arranque de Fase 0.** Sigue abierto, sin bloquear, solo el catálogo exacto de `OutputKey` (Nota 2 de 14.2 bis), que depende del mapeo de `OUTPUT_CATALOG` (13.4/15.1) y puede resolverse en paralelo a Fase 1 sin cambiar la forma del contrato.

---

## 15. Mapeo campo-por-campo de `PlayerEditor.tsx` real y rediseño agresivo para minimizar tiempo del entrenador y margen de error

> Pablo: "podemos cambiar todo absolutamente si está justificado para mejorar el scouting, la retención de la jugadora, y reducir el tiempo del entrenador y su margen de error al mínimo". Con ese mandato explícito, esta sección propone cambios de fondo, no solo cosméticos.

### 15.1. Las 9 secciones reales del formulario, verificadas leyéndolo (no asumidas)

**[VERIFICADO]** `PlayerEditor.tsx`, líneas 584-1969, tiene exactamente estas 9 secciones visuales, en este orden fijo: Identidad → Perfil físico → Tiros libres/faltas → Manejo de balón → Post → ISO → PnR → Actividad sin balón → Spot-up. **Orden fijo, siempre las 9 visibles, sin importar si la jugadora tiene 1 situación relevante o 6.**

**[VERIFICADO por `conversation_search`, 2026-09-11 — matiz importante que no tenía antes]** Estos ~48 campos **no son un primer borrador sin refinar** — ya pasaron por una ronda real de eliminación de redundancias con feedback de beta testers (ej. el bloque de PnR Handler se redujo de campos duplicados a 6 campos limpios: "Primary option/Weaker option" se eliminó por redundante con la dirección, "PnR handler finishing efficiency" se eliminó por redundante con la eficiencia general). También hay una distinción deliberada y ya corregida una vez: **ISO es estrictamente creación perimetral con bote; toda la creación interior (incluso "ISO desde el poste") va en la pestaña Post** — siguiendo la clasificación de Synergy. Mi propuesta de la sección 15.3 (seleccionar situaciones antes de abrir detalle) sigue siendo una mejora nueva y válida, pero no estoy "arreglando un formulario sin pulir" — estoy proponiendo una capa de flujo encima de campos que ya fueron depurados una vez.

### 15.2. El problema real, ahora que puedo decirlo sin rodeos

Una jugadora de rol que solo tiene una amenaza real (ej. solo Spot-up) obliga hoy al staff a **abrir y decidir sobre 5 bloques de situación completos** (Post, ISO, PnR, Off-ball, Spot-up) para llegar al que importa, marcando "Nunca" en los otros 4 uno por uno. Esto es exactamente lo contrario de "minimizar el tiempo del entrenador" — el formulario cuesta lo mismo rellenar a una jugadora de rol que a una estrella completa, cuando debería costar mucho menos.

### 15.3. Rediseño propuesto — selección primero, detalle después (cambio de fondo, justificado)

**Paso 1, nuevo, no existe hoy:** una sola pantalla inicial de selección múltiple: "¿En cuáles de estas 11 situaciones es una amenaza real esta jugadora?" (las 11 de Synergy, sección 12.1), con máximo recomendado de 3-4 marcadas — si el staff marca más de 4, un aviso suave ("¿seguro? Pocas jugadoras son amenaza real en más de 3-4 situaciones") sin bloquear.

**Paso 2:** solo se abren los bloques de detalle (Post/ISO/PnR/Off-ball/Spot-up) de las situaciones marcadas en el Paso 1. Las no marcadas se guardan automáticamente como frecuencia `"N"` (Nunca) sin que el staff tenga que confirmarlo campo a campo.

**Impacto estimado, honesto sobre que es estimación mía, no medición real:** para una jugadora de rol (caso muy común, probablemente mayoritario dado que solo el P85 de la liga tiene métricas destacadas — sección 10.1), esto reduce el formulario de 9 secciones completas a **identidad + físico + tiros libres + 1-2 bloques de situación**, en vez de 9. `[PENDIENTE]` medir el tiempo real de rellenado antes/después una vez implementado — no hay forma de medir esto sin construirlo.

### 15.4. Reducción de margen de error — autorrelleno desde Nivel 2 donde hay proxy real, no solo detección de discrepancia

Esto va más allá de lo ya propuesto en 13.1 (que solo avisaba de discrepancias). Con el mandato de minimizar error, propongo **autorrellenar** (no solo avisar) los campos donde existe un proxy numérico real fiable, dejando que el staff lo corrija si discrepa de lo que ve en vídeo — nunca ocultar el campo, solo pre-rellenarlo:

| Campo cualitativo hoy (Nivel 1) | Proxy real de U Stats (Nivel 2) | Justificación |
|---|---|---|
| `ftShooting` (1-5 a ojo) | FT% real con contracción bayesiana (sección 12.3) | Es literalmente el mismo concepto, medido en vez de estimado — cero motivo para pedirle al staff que lo adivine si el dato real existe |
| `foulDrawing` (1-5 a ojo) | Tasa de FTA por posesión (`fta`/posesiones jugadas) | Proxy imperfecto (no mide "cómo" llega a la línea, solo cuánto) pero mucho mejor que una estimación subjetiva sin ningún dato |
| `athleticism`, `physicalStrength` (1-5 a ojo) | **Ninguno — se queda 100% observación del staff.** No hay proxy numérico fiable en el PBP para esto (no hay datos de tracking físico) — no forzar un autorrelleno falso donde no hay dato real que lo sustente. |

**Principio general que fijo aquí para Motor 1.0:** autorrellenar solo donde el proxy mide literalmente lo mismo o algo muy cercano al campo cualitativo (FT%, FTA rate) — nunca inventar un proxy débil solo por tener un número disponible. Esto es coherente con el principio ya establecido de `neverInfer`, extendido: ahora hay una tercera categoría explícita ("autorrellenable con proxy real, editable") además de "nunca inferible" y "calculado internamente".

### 15.5. Retención de la jugadora — lo que cambia en la lectura, no solo en la captura

Ya cubierto en gran parte por la Capa 0 autónoma (sección 13.3) y el hallazgo citado de que reducir un informe de 15 a ~4 páginas sube la retención de ~10% a >80% (sección 12.6). Añado un elemento nuevo aquí, justificado por el mismo mandato: **cada acción defensiva en Capa 1/2 debe emparejarse siempre con un "por qué" de una línea** (ej. no solo "fuerza a la izquierda", sino "fuerza a la izquierda — finaliza 61% mejor por derecha") cuando exista el dato de Nivel 2 que lo sustente. Esto no es un capricho: la práctica de coaching citada en 12.6 recomienda explícitamente emparejar cada tendencia con una respuesta específica, no solo listar tendencias sueltas — mejora la retención porque la jugadora entiende el "por qué", no solo el "qué".

### 15.6. Resumen de cambios de fondo de esta sesión (todos justificados por el mandato de Pablo, ninguno cosmético)

1. Flujo de captura de 2 pasos (selección → detalle) en vez de 9 secciones fijas siempre visibles — reduce tiempo real del staff.
2. Autorrelleno editable desde Nivel 2 para `ftShooting` y `foulDrawing` — reduce margen de error, con límite explícito de cuándo NO hacerlo (`athleticism`/`physicalStrength`).
3. Cada acción defensiva emparejada con un "por qué" citando dato real cuando exista — mejora retención de la jugadora, no solo comodidad del staff.

### 15.7. Mapeo campo-por-campo de `PlayerEditor.tsx` — cierre del pendiente de 13.4 (El Aparejador, 2026-09-11)

> Auditoría de lectura completa (`PlayerEditor.tsx`, 1.969 líneas) verificada por grep exhaustivo contra `motor-v2.1.ts` (2.802 líneas) y `mock-data.ts` (2.359 líneas) completos — no muestreo. Sigue siendo trabajo mecánico, no decisión de producto; los recortes propuestos son candidatos para que Pablo apruebe o rechace, igual que el resto de la sección 15.

**[CORREGIDO] El "~48" del documento no coincide con el código real.** Contando solo los 5 bloques situacionales (Post/ISO/PnR/Off-ball/Spot-up, la lectura literal del comentario en 14.2 bis) el número real es **54**. Contando el formulario completo (incluida Identidad, Perfil físico, Tiros libres, Manejo de balón, y una sub-sección **"Personalidad" que existe en el código pero no está entre las "9 secciones reales" que cita 15.1** — es un 10º bloque real) el total es **72 campos editables**.

#### Tabla de mapeo completa

Leyenda — Preguntas del framework (13.0): P1 Mano dominante, P2 Zonas preferidas, P3 Acción principal, P5 Señal de faltas, P6 Detalle no obvio. **P4 (Emparejamiento defensivo) no aparece en ninguna fila** — confirma que es un hueco real sin cubrir hoy, tal como ya decía 13.0/14.1.4, no un campo que haya que buscar en el formulario. Capas: C1 situaciones, C2 deny/force/allow/aware. Para los campos situacionales, C0 (modo sencillo) es indirecto — cualquier situación con score puede terminar siendo el `accionPrincipal` si es la que gana, no depende de un campo aislado.

**Identidad (9 campos)**

| Campo | Preguntas | Capas / uso | Veredicto | Nota |
|---|---|---|---|---|
| `imageUrl` | — | Identidad (display) | mantener | Sin tipo en 14.2 bis — ver hallazgo #2 |
| `name` | — | Identidad, todas las capas | mantener | Cubierto por `IdentidadInput.nombre` |
| `starPlayer` | — | C2 (`motor-v2.1.ts:973`, multiplicador `starMod = 1.05`) | mantener | Sin tipo en 14.2 bis — sí afecta score real, no es solo un badge |
| `recentForm` | — | ninguna (0 consumidores fuera de `PlayerEditor.tsx`/`mock-data.ts`) | candidato_a_recortar | 12.4 propone un uso futuro (comparar contra Nivel 2) — puede que Pablo prefiera conservarlo a la espera |
| `number` | — | Identidad (display) | mantener | Sin tipo en 14.2 bis |
| `position` | P2, P3 (indirecto) | C1/C2 (`pos`, `usage`, `selfCreation`, reglas por posición) | mantener | Base del agrupamiento de 3 posiciones de la decisión #2 de 14.2 bis |
| `height` | — | Identidad (`alturaCm`) | mantener | |
| `weight` | — | Identidad (`pesoKg`) | mantener | |
| `postDominantHand` | **P1** | C2 (`hand`, `offHandFinish`) | mantener | No determina el lado de poste preferido — eso lo hace `postPreferredBlock`, sin control de UI (hallazgo #1) |

**Perfil físico (4 campos)**

| Campo | Preguntas | Capas | Veredicto | Nota |
|---|---|---|---|---|
| `athleticism` | — | C2 (`orebThreat`, `contactFinish`, varios multiplicadores) | mantener | |
| `physicalStrength` | — | C2 | mantener | |
| `courtVision` | — | C2 (`trapResponse` cuando no hay observación directa) | mantener | |
| `contactType` | **P5** | C2 (`contactFinish`) | mantener | |

**Tiros libres / faltas (2 campos)**

| Campo | Preguntas | Capas | Veredicto | Nota |
|---|---|---|---|---|
| `ftShooting` | **P5** | C2 (`mock-data.ts:1492,1533,2143`) | mantener | Proxy Nivel 2 (`ftPct`) ya definido en 15.4/14.2 bis |
| `foulDrawing` | **P5** | C2 (`mock-data.ts:1493,1536,2143`) | mantener | Proxy Nivel 2 (`ftaRate`) ya definido |

**Manejo de balón (2 campos)**

| Campo | Preguntas | Capas | Veredicto | Nota |
|---|---|---|---|---|
| `motorBallHandling` | P3 | C2 (7 usos: `force_no_push`, allow rules, texto de debilidad) | mantener | |
| `motorPressureResponse` | P3 | C2 (3 usos) | mantener | |

**Personalidad (1 campo — sub-sección no listada entre las "9 secciones" de 15.1)**

| Campo | Preguntas | Capas | Veredicto | Nota |
|---|---|---|---|---|
| `personality` | P6 (posible) | C2 (`clutch`/`freezes`/`selfish` modifican `personalityMod` y output) | mantener | La opción `"leader"` del array nunca se lee en ningún cálculo — hallazgo a nivel de opción, no de campo |

**Post (8 campos)**

| Campo | Preguntas | Capas | Veredicto | Nota |
|---|---|---|---|---|
| `postFrequency` | P3 | C1/C2 | mantener | |
| `postProfile` | P2, P3 | C2 | mantener | |
| `motorPostEntry` | P2, P3 | C2 (sinergia con `transRolePrimary` para `deny_duck_in`) | mantener | |
| `motorPostEntrySecondary` | — | ninguna | candidato_a_recortar | Ni siquiera se pasa por `playerInputToMotorInputs` — se captura, se guarda, y ahí muere |
| `postQuadrants` | **P2** | C2 (deriva `postMoves`) | mantener | Campo compuesto (4 cuadrantes en un solo estado) |
| `highPostZones` | P2, P3 | C2 (`motor-v2.1.ts:1496`) | mantener | |
| `motorPostEff` | P3 | C2 | mantener | |
| `postDoubleTeamReaction` | P3 | C2 (`mock-data.ts:1765-1768`) | mantener | |

**ISO (8 campos)**

| Campo | Preguntas | Capas | Veredicto | Nota |
|---|---|---|---|---|
| `isoFrequency` | P3 | C1/C2 | mantener | |
| `isoDominantDirection` | P1, P2, P3 | C2 | mantener | |
| `isoDecision` | P3 | C2 (`scoringType`) | mantener | |
| `isoInitiation` | P3 | C2 (`mock-data.ts:1792`) | mantener | |
| `isoFinishLeft` | P1, P2 | C2 (`offHandFinish`) | mantener | |
| `isoFinishRight` | P1, P2 | C2 | mantener | |
| `isoOppositeFinish` | P1 | C2 (texto de fuerza direccional) | mantener | Campo compartido: un único estado mostrado en ISO o en PnR según cuál esté activa (mutuamente excluyente), no duplicado |
| `motorIsoEff` | P3, P6 | C2 (amplifica ISO danger, define `deepRange`) | mantener | |

**PnR (14 campos)**

| Campo | Preguntas | Capas | Veredicto | Nota |
|---|---|---|---|---|
| `pnrFrequency` | P3 | C1/C2 | mantener | |
| `pnrRole` | P3 | C2 | mantener | |
| `pnrScoringPriority` | P3 | C2 (`pnrPri`) | mantener | |
| `pnrReactionVsUnder` | P3 | C2 (`scoringType`, force outputs) | mantener | |
| `pnrTiming` | P3 | C2 | mantener | |
| `pnrFinishBallLeft` | P1, P2 | C2 | mantener | |
| `pnrFinishBallRight` | P1, P2 | C2 | mantener | |
| `pnrSnake` | P3, P6 | C2 (`motor-v2.1.ts:1178`) | mantener | |
| `motorPnrEff` | P3 | C2 | mantener | |
| `motorTrapResponse` | P3, P5 (posible) | C2 (múltiples outputs) | mantener | |
| `pnrScreenTiming` | P3 | C2 (`slip`/`holds_long` weights) | mantener | |
| `pnrScreenerAction` | P3 | C2 | mantener | |
| `pnrScreenerActionSecondary` | P3 | C2 (texto `secVerb`, `mock-data.ts:1903-1904`) | mantener | |
| `popRange` | P2 | C2 (`motor-v2.1.ts:2708`) | mantener | |

**Off-ball / Actividad sin balón (17 campos)**

| Campo | Preguntas | Capas | Veredicto | Nota |
|---|---|---|---|---|
| `transitionFrequency` | P3 | C1/C2 | mantener | |
| `transRolePrimary` | P3 | C2 (sinergia `duck_in`+`rim_runner`, `orebThreat`+`rim_runner`) | mantener | |
| `transSubPrimary` | P3, P6 | C2 (`applyTransSub`, peso ×1) | mantener | |
| `transRoleSecondary` | — | ninguna directa (solo llave de UI para elegir la lista de `transSubSecondary`) | dudoso | Su valor nunca se lee para scoring, pero no es dato perdido — es una decisión de arquitectura de UI que no puedo resolver solo leyendo código |
| `transSubSecondary` | P3, P6 | C2 (`applyTransSub`, peso ×0.65, `motor-v2.1.ts:1659`) | mantener | |
| `transFinishing` | P3 | C2 (amortigua confianza de outputs de transición) | mantener | |
| `backdoorFrequency` | P2, P3 | C2 (`cutFreq`/`cutType`) | mantener | |
| `freeCutsFrequency` | P3 | C2 | mantener | |
| `freeCutsType` | — | ninguna (`motor-v2.1.ts` nunca lo lee) | candidato_a_recortar | Posible fusión conceptual con `freeCutsFrequency`, pero no hay nada real que fusionar — el consumidor simplemente no existe |
| `dunkerSpot` | P2, P3 | C2 (`motor-v2.1.ts:1473,1482`) | mantener | |
| `indirectsFrequency` | P3 | C2 | mantener | |
| `offBallRole` | P3 | C2 (`motor-v2.1.ts:1948,2064,2070`) | mantener | |
| `offBallScreenPattern` | P3 | C2 (`motor-v2.1.ts:2048-2058`) | mantener | |
| `offBallScreenPatternSecondary` | — | ninguna | candidato_a_recortar | El hallazgo más claro de la auditoría: ni siquiera está en el tipo `PlayerInput` — solo existe vía `(inputs as any)` en `PlayerEditor.tsx:1793-1800`. Cero consumidores. |
| `offBallCutAction` | P2, P3 | C2 (`motor-v2.1.ts:1965`, determina `cutType`) | mantener | |
| `offensiveReboundFrequency` | P3 | C2 (`orebThreat`) | mantener | |
| `putbackQuality` | P3, P6 | C2 (`motor-v2.1.ts:2078`) | mantener | |

**Spot-up (7 campos)**

| Campo | Preguntas | Capas | Veredicto | Nota |
|---|---|---|---|---|
| `perimeterThreats` | P3 | C1/C2 (`spotUpFreq`) | mantener | |
| `closeoutReaction` | P1, P3 | C2 (`spotUpAction`, fallback de `closeoutLeft`/`Right`) | mantener | |
| `closeoutLeft` | P1, P2, P3 | C2 (`mock-data.ts:1827-1828,2106-2107`) | mantener | |
| `closeoutRight` | P1, P2, P3 | C2 | mantener | |
| `spotZones` | **P2** | C2 (múltiples usos) | mantener | |
| `deepRange` | P2, P6 | C2 (16+ usos — de los campos derivados más consumidos) | mantener | |
| `motorLongRange` | P2, P6 | C2 (determina `deepRange`) | mantener | |

#### Resumen ejecutivo

**72 campos reales editables en total** (54 si nos ceñimos a los 5 bloques situacionales de la cita literal de 14.2 bis). Veredictos: **67 mantener**, **4 candidato_a_recortar** (`recentForm`, `motorPostEntrySecondary`, `freeCutsType`, `offBallScreenPatternSecondary`), **1 dudoso** (`transRoleSecondary`) — todos verificados por grep exhaustivo, no por inspección superficial. Ninguno se recorta sin que Pablo lo apruebe (mismo patrón que el resto de la sección 15).

#### Hallazgos inesperados

1. **Bug real, no solo deuda de spec: `postPreferredBlock` no tiene forma de rellenarse.** El motor calcula `postShoulder` (defensa de poste por lado) a partir de `postPreferredBlock` (`mock-data.ts:836-840`), no de `postDominantHand` (que sí tiene UI). `postPreferredBlock` nunca aparece en `PlayerEditor.tsx` — se queda fijo en `"Any"` para toda jugadora, siempre. **Consecuencia: el output de defensa de poste por lado nunca puede describir un lado específico hoy**, aunque el staff marque claramente la mano dominante. Motor 1.0 debería o bien exponer este campo en el formulario, o eliminarlo y derivar `postShoulder` de `postDominantHand`/`postPreferredSide` — decisión de arquitectura para Fase 1, no puedo resolverla yo aquí.
2. **3 campos con uso real en score/display no tienen sitio en el contrato de tipos de 14.2 bis:** `imageUrl`, `starPlayer` (multiplicador de score real, `motor-v2.1.ts:973`) y `number`. `IdentidadInput` solo cubre `nombre/posicion/alturaCm/pesoKg/manoDominante` — **[CERRADO, ver 15.7b]** añadidos como `numero`/`fotoUrl`/`esEstrella` al tipo `IdentidadInput` de 14.2 bis, con los tipos reales verificados contra el código (no `number`, sino `string`; opcionales donde el dato puede faltar).
3. **`offBallScreenPatternSecondary` ni siquiera está en el tipo `PlayerInput`** — se captura vía `(inputs as any)`, cero validación de tipo, cero consumidor.
4. **`spotZone` (legado singular) sigue vivo y se lee activamente** (`motor-v2.1.ts`, 6 usos como fallback) pero ya no es un campo independiente del formulario — la UI lo sincroniza automáticamente cada vez que se toca `spotZones` (`PlayerEditor.tsx:1888-1903`). Deuda de compatibilidad del mismo tipo que `transitionRole`, por eso no cuenta en el total de 72.
5. **La sección "Personalidad" es un 10º bloque real** del formulario (accordion plegable, `PlayerEditor.tsx:1049-1073`) que 15.1 no incluyó entre las "9 secciones reales" verificadas.

#### 15.7b. Decisiones de cierre sobre los 2 hallazgos técnicos abiertos (2026-09-11)

> A petición de Pablo ("tú decides según lo más estándar y mejor para cumplir los objetivos"), verificados los tipos reales en el código antes de decidir — no se adivina.

**Hallazgo 15.7.1 — `postPreferredBlock` sin UI.** → **Exponerlo en el formulario, no derivarlo de `postDominantHand`.** No es una preferencia de estilo: la propia sección 3 del documento cita explícitamente "hombro de post" como ejemplo del principio `neverInfer` — observación pura del staff que un modelo no debe inventar. Derivarlo de la mano dominante sería exactamente el tipo de inferencia que la sección 3 prohíbe (un poste diestra puede preferir entrar por el lado izquierdo según cómo la defienden, son conceptos distintos). Verificado el tipo real: `postPreferredBlock: "Left Block" | "Right Block" | "Any"` (`mock-data.ts:103`) — mismos 3 valores que ya usa el patrón de `DirectionTendency` en `isoDominantDirection` y otros campos de dirección. Propuesta concreta: añadir un control de 3 opciones al bloque "Post" del formulario, mismo patrón de UI ya usado para esos otros campos de dirección — campo Nivel 1 observado, entra en `camposObservados` de la situación `post`.

**Hallazgo 15.7.2 — `imageUrl`/`starPlayer`/`number` sin tipo en 14.2 bis.** → **Añadidos a `IdentidadInput`** (ver bloque de tipos arriba, actualizado): `numero: string` (no `number` — verificado en `mock-data.ts:316`, los dorsales no son puramente numéricos en el código real), `fotoUrl?: string` (opcional — el tipo actual la exige pero no toda jugadora tendrá foto cargada, se relaja aquí), `esEstrella?: boolean` (verificado opcional/nullable en `mock-data.ts:90`, con efecto real de score confirmado en `motor-v2.1.ts:973`, `starMod = 1.05`).

Con estas dos decisiones, no queda ningún pendiente técnico abierto de la auditoría de 15.7 — el contrato de tipos de 14.2 bis y el plan de captura de 15.3 ya reflejan ambos hallazgos.

#### Corrección a la sección 20.5 — `transitionRole`

**[CORREGIDO]** La sección 20.5 atribuye las líneas 559, 973-982 y 1947 a `PlayerEditor.tsx`. Verificado: `transitionRole` **no aparece ni una vez en `PlayerEditor.tsx`** — esas líneas son de `mock-data.ts` (`resolveTransRole()`, fallback cuando `transRolePrimary` no está seteado). El editor actual usa exclusivamente `transRolePrimary`/`transRoleSecondary`. Implicación para 14.2 bis: `transitionRole` no es uno de los 72 campos del formulario — sobrevive solo como fallback interno de compatibilidad para perfiles antiguos sin `transRolePrimary`. El motor nuevo puede resolverlo de una vez sin que afecte al mapeo campo-por-campo, tal como ya sugería el propio documento.

---

## 16. Presentación a la jugadora — cómo se lee el informe, no solo qué contiene

> Todo lo de las secciones 13-15 diseña **qué dato mostrar**. Esta sección diseña **cómo se ve y se siente** al leerlo, que es una pregunta distinta y Pablo tiene razón en separarla.

### 16.1. El contexto real que hay que respetar, ya verificado en memoria del proyecto

**[VERIFICADO, ya decidido como producto]** "El informe lo lee la jugadora directamente en el móvil, individualmente, bastante antes del día del partido" (`u-scout-design-decisions.md`). Esto es importante porque **descarta** una recomendación que encontré en la investigación de coaching (sección 12/13): la práctica de que "el mejor método de entrega es un walkthrough en pista en vivo, no un documento" ([How to Scout Opponents, Hoop Mentality](https://hoopmentality.com/blogs/basketball/how-to-scout-opponents-a-basketball-coachs-guide)) **no aplica aquí** — U Scout ya decidió el modelo asíncrono/individual, y es una decisión de producto válida (escala mejor, no depende de tiempo de pista compartido), no algo que este documento deba cuestionar. Lo que sí aplica de esa misma investigación es todo lo que ayuda a que un documento leído en solitario retenga tan bien como una sesión en vivo — ahí es donde hay que invertir.

### 16.2. Principios de UX móvil deportiva, con fuente, aplicados a este caso concreto

- **Regla de 2 toques**: cualquier información crítica (la Capa 0, sección 13.3) debe verse sin scroll ni navegación extra al abrir el informe — principio general de diseño móvil deportivo confirmado en [Sports App UX Design, TheFinch](https://thefinch.design/sports-app-ux-design-cricket-fantasy-live-score-platforms/): las interacciones principales no deberían requerir más de dos toques desde cualquier pantalla.
- **Diseño para uso con una mano y en condiciones de luz variable**: la jugadora puede leer esto en el pabellón, en el bus, con luz mala — tipografía grande y contraste alto en la Capa 0 en particular (misma fuente que arriba).
- **Nada de gamificación genérica (rachas, insignias, tablas de clasificación).** Esto sí lo descarto explícitamente, aunque aparece mucho en la literatura de apps deportivas de fitness/consumo ([Fitness App UI Design](https://stormotion.io/blog/fitness-app-ux/)) — encaja con apps de motivación personal, no con un informe de scouting profesional de un club WCBA. Añadir insignias por "leer tu informe" trivializaría el tono serio que ya tiene el producto.

### 16.3. Lo que SÍ propongo añadir

**Confirmación de lectura, visible solo para el staff.** [CORREGIDO 2026-09-11] No es una función nueva que yo esté proponiendo desde cero — ya estaba diseñada, con más detalle del que yo aporté aquí la primera vez: la tabla `profile_views` (`id`, `playerId`, `userId`, `screenIndex`, `secondsSpent`, `completed`, `viewedAt`) rastrea, por pantalla/slide, cuánto tiempo pasó la jugadora y si la completó — no solo un "visto" binario como proponía antes. Esto es más útil de lo que yo había planteado: permite ver, por ejemplo, si abre el informe pero no llega a la Capa 2 (plan defensivo) antes del partido, que es justo el caso que más le importaría saber al staff. **Motor 1.0 debe reusar/extender `profile_views`, no inventar una marca de "visto" más simple.** Se mantiene el principio de que esto es visible solo para el staff, nunca como ranking público entre compañeras — eso sí es aportación mía, no estaba en el diseño original y sigue siendo válido añadirlo.

**Recordatorio, no notificación insistente.** Una única notificación cuando el informe se publica, y como mucho un segundo recordatorio si sigue sin abrirse al día siguiente — nunca más de dos avisos (ventana horaria y trigger exactos ya resueltos por Pablo, sección 19).

**Tono del texto: directo y de entrenador, no corporativo ni motivacional genérico.** Esto conecta con el hallazgo ya documentado de plantillas mezcladas inglés/español (sección 12.6/OUTPUT_CATALOG) — al unificar el idioma base, la ocasión es también para fijar un tono único: frases cortas, imperativas, sin relleno ("Fuerza a la izquierda", no "Se recomienda intentar forzar hacia el lado izquierdo cuando sea posible") — coincide con el estilo que ya usan las plantillas más logradas del catálogo actual (ej. "Cerrar el espacio").

### 16.3b. Cuántos outputs ver realmente — esto YA estaba decidido con investigación propia, no era algo por decidir

[AÑADIDO 2026-09-11, corrige un hueco] La decisión de "1 output por categoría a la jugadora, todo al entrenador" (base de la Capa 0 autónoma, sección 13.3) ya se resolvió en una sesión anterior con investigación real de carga cognitiva en deportistas, que no cité antes por no tenerla localizada: el límite de memoria de trabajo activa no son los 7±2 de Miller (1956), son **4±1 chunks** (Cowan, 2001), y **baja a 2-3 elementos bajo presión o carga cognitiva simultánea** — exactamente la situación de una jugadora recibiendo instrucciones antes de un partido. Esto confirma con más rigor del que yo había aportado la regla ya vigente de "máximo 2 AWARE" en la slide 3 actual, y la decisión de Capa 0 con un solo stat/quiet-edge en vez de varios — no es una preferencia de diseño mía, es un límite cognitivo medido.

### 16.4. Lo que NO sé y no voy a inventar

**[CERRADO 2026-09-11]: individual por jugadora propia como vista principal, agregado de equipo como resumen secundario — no uno u otro.** El propio caso de uso ya citado arriba ("ver que abre el informe pero no llega a la Capa 2 antes del partido") es intrínsecamente individual — un entrenador que solo ve "70% del equipo ha visto el informe" no sabe a quién avisar antes del partido, y avisar es exactamente la acción que este dato debe habilitar. El agregado de equipo sigue teniendo valor como resumen rápido ("¿cuántas faltan?"), así que ambas vistas conviven: agregado como entrada, detalle individual como drill-down — nunca solo uno de los dos.

---

## 17. Sistema de comparación y discrepancias entre entrenadores — CORREGIDO 2026-09-11 (versión anterior de esta sección estaba mal planteada, ver abajo)

> Esta arquitectura **ya estaba completamente diseñada** en sesiones de abril 2026 (encontrado vía `conversation_search` tras la corrección que pidió Pablo) — lo que sigue no es una propuesta mía, es documentación de una decisión ya tomada. Mi primera versión de esta sección (que decía que la discrepancia era entre observaciones/inputs de cada entrenador) **estaba equivocada en la base**, no solo en el detalle.

### 17.0. El error que corrijo, dicho explícito

La discrepancia **no es entre inputs distintos**. Cita literal de la sesión original: *"Dos entrenadores pueden tener los mismos inputs y aun así proponer reports distintos porque cada uno eligió runners-up diferentes o ocultó cosas distintas. La comparación ocurre a nivel de output aprobado, no de inputs."* Es decir: el punto de comparación es la **versión curada y aprobada** que cada entrenador propuso (paso 2 del flujo), no sus observaciones crudas de Nivel 1.

### 17.1. El flujo de aprobación completo, ya diseñado (4 pasos, no 3 como resumía la memoria)

1. **Edición** — privada, cuando quiera cada entrenador.
2. **Propuesta** — el entrenador genera el report desde sus inputs, lo **revisa** (puede elegir runners-up distintos al ganador del motor por campo, puede ocultar elementos), y lo aprueba → esa versión curada llega al staff como "su" versión. El motor, para esto, **siempre devuelve el output ganador MAS los candidatos rankeados con score** por cada campo tocable — no se pueden generar alternativas "al vuelo" en el clic, se calculan todas de una vez.
3. **Staff ve todas las versiones propuestas**, la app detecta y señala discrepancias **específicas** entre ellas (qué campo exacto difiere, no un aviso genérico de "hay diferencias"), debaten.
4. **Cualquiera aprueba** una versión final; con ≥1 aprobación, cualquiera puede publicarla a las jugadoras.

### 17.2. Qué se registra en cada evento de discrepancia/sustitución (ya diseñado)

Cada vez que un entrenador reemplaza el output ganador por un runner-up, se captura: el output rechazado y su peso calculado, el output elegido y su posición en el ranking de candidatos, el perfil/inputs que generaron esa situación, y qué entrenador lo hizo (**no expuesto nominalmente en el panel global, solo como vector de patrón** — principio de privacidad interno al staff, distinto del principio de la línea de abajo). **Nunca se registra la identidad de la jugadora rival escouteada** en estas estadísticas — es dato sensible del equipo rival, no aporta nada al calibrado del motor.

**Añadido correctamente identificado en la propia sesión original (riesgo de sesgo de superviviencia):** no basta con registrar los reemplazos (`action: 'replace'`) y las ocultaciones (`action: 'hide'`) — si el entrenador acepta el output del motor tal cual, sin tocarlo, **eso también es señal** y hay que registrarlo (`action: 'approve_as_is'`). Si solo se capturan los fallos, el motor nunca aprende de sus aciertos, y la tasa de aceptación por arquetipo/campo es, según la propia sesión de diseño, "la métrica más valiosa para calibración".

**Señal de diagnóstico ya identificada — el "score gap":** la distancia entre el score del output ganador y el del runner-up elegido como sustituto es en sí misma informativa. Gap pequeño = el motor está cerca, necesita solo calibración fina de pesos. Gap grande = desacuerdo editorial real o error de motor genuino. Por eso hay que guardar `original_score` y `replacement_score` en cada evento, no solo qué se eligió.

### 17.3. Sistema de aprendizaje en 3 niveles — ya diseñado, pieza central que había omitido por completo

**Nivel A — Soft learning por entrenador.** Si el mismo entrenador repite el mismo tipo de sustitución **3 veces** en perfiles/arquetipos similares, el motor ajusta automáticamente su configuración personal (`user_soft_config`: `userId`, `archetypePattern`, `field`, `adjustedValue`, `overrideCount`) para ese entrenador específicamente — y **se lo notifica siempre**, nunca en silencio (decisión explícita de Pablo: "se avisa, sí"). El aviso nombra el patrón exacto detectado, confirma que ya se aplicó, y da control explícito para revertirlo en Preferencias — transparencia sin fricción en el flujo normal.

**Nivel B — Hard learning global, controlado por Pablo como admin.** Un panel agregado (no automático) muestra qué patrones de sustitución se repiten **entre múltiples entrenadores distintos**, por campo y arquetipo. Pablo decide manualmente cuáles de esos patrones promocionar al motor base ("hard"), de forma permanente para todos. Este es el mecanismo real de cómo Motor 1.0 mejora con el uso real, sin ser una caja negra que cambia sola — hay una persona validando cada cambio de fondo.

**Nivel C — Sugerencias de reemplazo inteligentes.** Cuando un entrenador abre las alternativas de un campo, se ordenan por frecuencia de uso entre entrenadores de perfil similar (qué sustitución eligen otros para casos parecidos), no solo por el score bruto del motor.

**Riesgo ya identificado y ya resuelto en el diseño original:** aplicar el soft learning de forma demasiado agresiva puede hacer que el motor converja hacia outputs cada vez más estrechos por entrenador, perdiendo cobertura de situaciones poco comunes. La solución ya decidida: el umbral de 3 repeticiones en arquetipos **distintos** (no solo el mismo jugador tres veces) actua de freno, y el hard learning nunca es automático, siempre pasa por decisión manual de Pablo.

### 17.4. Fundamento académico ya investigado (no lo repito de cero, solo lo dejo referenciado)

La sesión original ya identificó esto como "human-in-the-loop sobre candidatos rankeados", documentado en la literatura de sistemas de recomendación (ACM RecSys) como la arquitectura correcta cuando un algoritmo no puede capturar todo el juicio experto — aplicado aquí a scouting deportivo individual, un uso no visto antes según esa misma investigación. No he vuelto a verificar esa cita específica de ACM hoy (viene de una búsqueda de una sesión anterior, no de esta), lo marco para no hacerlo pasar por verificado en esta sesión.

---

## 18. Modo offline y sincronización automática — para trabajar incluso en un avión

### 18.1. Lo que ya existe en el stack y sobre lo que hay que construir (verificado, no asumido)

**[VERIFICADO en memoria del proyecto]** U Stats ya usa `staleTime` con `networkMode: offlineFirst` en TanStack Query para lecturas cacheadas. Esto **no cubre** el caso que pide Pablo — eso es solo para leer datos ya descargados sin conexión, no para poder **escribir** (rellenar un scouting nuevo) estando offline y que se envíe solo después.

### 18.2. La pieza que falta: cola de mutaciones offline persistida

TanStack Query (la librería ya usada en todo el proyecto) tiene soporte oficial para esto exactamente: `PersistQueryClientProvider` + un persister (`localStorage` en web, o `AsyncStorage`/almacenamiento nativo vía Capacitor en la build de iOS) que guarda las mutaciones pausadas mientras no hay red, y `resumePausedMutations()` para reenviarlas al volver la conexión ([TanStack Query Mutations docs](https://tanstack.com/query/latest/docs/framework/react/guides/mutations)).

**Honestidad técnica, no vender esto como magia perfecta:** esta función de TanStack Query tiene un historial real de bugs de fiabilidad documentados en su propio repo — mutaciones que se quedan atascadas en estado "pausado" tras recargar la app, o que no se reanudan correctamente entre versiones de la librería ([GitHub Issue #5847](https://github.com/TanStack/query/issues/5847); [Issue #6825](https://github.com/TanStack/query/issues/6825)). **Recomendación concreta:** no depender solo del reintento automático silencioso — añadir siempre un indicador visible ("3 cambios pendientes de sincronizar") y un botón manual de "Sincronizar ahora", para que el entrenador nunca se quede sin saber si su trabajo en el avión realmente se guardó al aterrizar.

### 18.3. Disparadores de sincronización (los 3 que pide Pablo)

1. **Al recuperar conexión** — evento de `onlineManager` de TanStack Query, disparo inmediato de `resumePausedMutations()`.
2. **Cada cierto tiempo** — mientras la app está abierta y hay mutaciones pendientes, reintentar cada pocos minutos. **[CERRADO 2026-09-11]: 5 minutos.** No es un número mágico — es el punto medio del rango "3-5 min razonable" que ya se proponía, elegido hacia el extremo menos agresivo: el disparador 1 (recuperar conexión) y el 3 (reabrir app) ya cubren el caso común de vuelta a cobertura; este temporizador solo importa para el caso raro de "app abierta y en primer plano sin red durante minutos seguidos" (ej. avión con wifi intermitente) — no vale la pena gastar más batería/datos por ese caso raro con un intervalo más corto.
3. **Al reabrir la app** — la app usa Capacitor para iOS; el plugin oficial `@capacitor/network` detecta el estado de conexión de forma más fiable que `navigator.onLine` del navegador dentro de un wrapper nativo — usarlo para disparar el intento de sync en el evento de "app vuelve a primer plano", no solo confiar en el evento web `online`.

### 18.4. Qué datos deben poder crearse/editarse offline

Todo lo de Nivel 1 (observación del staff, sección 13.1) debe poder rellenarse sin conexión — es el caso de uso real (entrenador viendo vídeo en el avión, sin wifi). El Nivel 2 (datos reales de U Stats) **no puede** funcionar offline si no estaba ya cacheado antes de perder la conexión — esto es una limitación real, no un fallo de diseño: no se puede consultar un dato en vivo de Supabase sin red. El motor debe generar el informe con lo que tenga (Nivel 1 completo + Nivel 2 desde caché si existía) y marcarlo como "generado offline, sin verificar contra datos más recientes" hasta la próxima sincronización.

---

## 19. Ventana horaria de avisos a la jugadora — ya decidido por Pablo, documento aquí la implementación

Pablo ya fijó el número exacto (resuelve el `[PENDIENTE]` de la sección 16.4): **primer aviso al publicarse el scouting, restringido a la ventana 08:00-22:00; si no se ha abierto, segundo aviso al día siguiente, en la misma ventana horaria.**

**Implementación propuesta:** la hora de referencia debe ser la zona horaria del club (`CLUB_TIME_ZONE`, ya usada en Schedule para evitar el mismo tipo de bug de zona horaria que ya se corrigió ahí — `Asia/Shanghai`), no la hora del dispositivo de la jugadora si viaja. Si el scouting se publica fuera de la ventana (ej. a las 23:30), la notificación se encola y se envía a las 08:00 del día siguiente, no inmediatamente. El segundo aviso ("no abierto") se dispara solo si, exactamente 24h después de publicado, sigue sin marca de "visto" (sección 16.3) — y ese segundo aviso también respeta la ventana 08:00-22:00 aunque las 24h se cumplan a medianoche.

---

## 20. Iconografía de arquetipos — la idea de Pablo, con respaldo científico real (no solo intuición de diseño)

> Pablo: "la facilidad de recordar imágenes que se ajusten a estereotipos o arquetipos, reduciendo el tiempo para la jugadora". Esto tiene un nombre y una base científica sólida, busqué hoy.

### 20.1. El fenómeno: "picture superiority effect" / teoría de doble codificación

La memoria y el reconocimiento de imágenes es sistemáticamente más rápida y fiable que la de palabras — fenómeno bien establecido en psicología cognitiva desde Paivio (1971, 1986). En un experimento clásico, pares de imágenes se recordaron casi el doble que pares de palabras (58% vs. 32%), y la combinación imagen+palabra llegó al 76% ([Picture Superiority, UX Strategy](https://www.ux-strategy.ch/en/effects/picture-superiority-effect.html); [Wikipedia: Picture superiority effect](https://en.wikipedia.org/wiki/Picture_superiority_effect)). Investigación aplicada a formación encontró que combinar texto e imagen mejora un 89% el rendimiento en tests de transferencia frente a solo texto ([Growth Engineering, citando a Mayer](https://www.growthengineering.co.uk/dual-coding/)).

**Matiz importante, citado, no ignorado:** un estudio de 2025 encontró que el efecto depende de que las imágenes sean **visualmente distintivas** entre sí (color, forma), no de ser "una imagen cualquiera" — comparando palabras distintivas contra imágenes en blanco y negro poco distintivas, el efecto desapareció o se invirtió ([Higdon et al. 2025](https://journals.sagepub.com/doi/10.1177/17470218241235520)). **Implicación directa para Motor 1.0:** los iconos de archetype no pueden ser variaciones sutiles del mismo estilo (ej. 10 siluetas genéricas de jugadora con distinto gesto) — tienen que ser **claramente distintos entre sí** en forma y color, no solo en detalle, o se pierde el beneficio cognitivo real.

### 20.2. Precedente directo en la industria del videojuego deportivo (encontrado hoy)

NBA 2K, el juego de baloncesto más jugado del mundo, introdujo en su edición más reciente (2K26) una función literalmente llamada **"Scouting Report"** dentro de su sistema de creación de jugador, que muestra insignias (badges) visuales por atributo/arquetipo y avisa de puntos débiles ([NBA 2K26 MyPLAYER Builder](https://nba.2k.com/2k26/courtside-report/myplayer-builder/)). El sistema de insignias por niveles (bronce/plata/oro/HOF) es un precedente de cómo comunicar intensidad (equivalente a "destacado" vs. "élite" de la sección 10.1) con un símbolo visual en vez de solo texto.

### 20.3. Propuesta concreta para Motor 1.0

1. **Un icono fijo y único por `archetypeKey`** (los 10 de la sección 14.3), diseñado para ser distinguible por silueta y color sin necesidad de leer la etiqueta — nunca reutilizar la misma forma base con solo el color cambiado (rompe la distintividad que exige el hallazgo de 20.1).
2. **Icono + palabra siempre juntos, nunca icono solo** — el estudio clásico de Paivio muestra que la combinación (76%) supera tanto a la imagen sola como a la palabra sola — el icono acelera el reconocimiento, la palabra fija el concepto exacto sin ambigüedad.
3. **Insignia de intensidad con forma propia para "destacado"/"élite"** (sección 10.1), inspirado en el sistema de tiers de NBA 2K — no un texto "P85"/"P95" sino un símbolo (ej. un borde o relieve distinto) que se reconoce de un vistazo, igual que un jugador de 2K reconoce una insignia de oro sin leer el número exacto detrás.
4. **Repetición consistente entre módulos**: si el mismo `archetypeKey` aparece en U Scout, en un futuro cruce con U Stats, o en cualquier otro sitio de U Core, debe usar exactamente el mismo icono siempre — el efecto de "mera exposición" (familiaridad por repetición) solo funciona si el símbolo no cambia entre pantallas.

### 20.4. Lo que dejo pendiente, con honestidad

`[PENDIENTE]` El diseño real de los 10 iconos es trabajo de diseño visual (Figma), no algo que se resuelva en un documento de especificación — lo que aporto aquí es el principio validado (por qué funciona, qué lo hace fallar si se hace mal) y la lista exacta de 10 conceptos a iconografiar (sección 14.3), no los iconos en sí.

**[VERIFICADO por `conversation_search`, 2026-09-11]** Esto no es solo mi criterio — es una regla de producto ya decidida y bloqueada: *"Iconos: diseño obligatorio en Figma antes de implementar. Nunca generar SVG de iconos directo."* Mi propuesta de esta sección cumple esa regla (nunca propongo generar los SVG yo), la cito aquí explícita para que quien retome esto en Claude Code no la pierda de vista.

### 20.5. Deuda técnica conocida relacionada, encontrada en la misma búsqueda

**[VERIFICADO por `conversation_search`]** Hay un problema ya identificado y todavía sin resolver, anterior a esta auditoría: `transitionRole` **legacy** en `mock-data.ts` — el motor sigue leyendo el campo viejo, pendiente de alinear con el campo nuevo. **[VERIFICADO ahora también contra código actual, 2026-09-11]** Sigue vigente: `transitionRole` (línea 139, tipo `"Pusher" | "Outlet" | "Rim Runner" | "Trailer"`) todavía se usa activamente, y hay un comentario explícito en el propio código (línea 1092): `// Resolve legacy transitionRole field to new TransRoleEditor values` — confirma que el propio equipo ya sabía que es un campo legacy sin resolver del todo. El Arquitecto debería revisar esto al diseñar Fase 0 para no heredar el mismo campo doble en Motor 1.0.

**[CORREGIDO 2026-09-11, ver mapeo completo en 15.7]** Las líneas 559, 973-982, 1947 citadas arriba son de `mock-data.ts`, no de `PlayerEditor.tsx` como decía esta sección originalmente — `transitionRole` no aparece ni una vez en el editor real. Es un fallback interno de `mock-data.ts` para perfiles antiguos sin `transRolePrimary`, no un campo del formulario. No cambia la recomendación (el motor nuevo debe resolverlo de una vez), solo corrige dónde vive.

---

## 21. Fase 1 — estado real de avance (código, no solo spec), 2026-09-11

> A partir de aquí ya hay código de producto real (`client/src/lib/motor-v1*.ts`), no solo especificación — es la primera sección del documento donde eso es cierto. Todo lo de abajo está verificado con `npm run check` (typecheck limpio contra el `tsconfig.json` real) y `npx vitest run` (suite completa), no solo "compila en mi cabeza".

### 21.1. Archivos creados

- [`client/src/lib/motor-v1-types.ts`](../client/src/lib/motor-v1-types.ts) — el contrato de tipos de 14.2 bis, transcrito literal, exportado.
- [`client/src/lib/motor-v1-source-map.ts`](../client/src/lib/motor-v1-source-map.ts) — copia pública de `SOURCE_TO_SITUATION` de `motor-v2.1.ts` (privada allí), documentada como deuda técnica deliberada hasta que Fase 3 retire el motor legacy.
- [`client/src/lib/motor-v1.ts`](../client/src/lib/motor-v1.ts) — el núcleo de cálculo en sí. Orquesta `motor-v2.1.ts` (reusa su lógica calibrada, sección 3) y produce `ScoutingReportV1` con la forma del contrato cerrado.
- [`client/src/lib/motor-v1-acceptance.test.ts`](../client/src/lib/motor-v1-acceptance.test.ts) — tests de aceptación contra los motores legacy (referencia de comportamiento correcto mientras Motor 1.0 se termina).
- [`client/src/lib/motor-v1.test.ts`](../client/src/lib/motor-v1.test.ts) — tests directos contra `motor-v1.ts`.

**21 tests, todos verificados en verde** (`npx vitest run`: 46/46 en todo el proyecto, el único fallo — `capabilities.test.ts` — es preexistente y no relacionado, el mismo problema de `window` a nivel de módulo que ya denuncia la sección 4).

### 21.2. Bug real encontrado (y corregido en la misma sesión) al escribir `motor-v1.ts`

La primera versión de `motor-v1.ts` tenía una función `clamp072()` que forzaba **todo** score a un techo de 0.72 — incluidas las situaciones primarias, que deben quedar sin capar. Verificado contra datos reales antes de corregirlo: perfil "Luka Doncic" (iso+pnr primarias) debía dar `iso=1.00, pnr=1.00, post=0.72` y daba `iso=0.72, pnr=0.72, post=0.72`. Corregido, y bloqueado con test de regresión (`motor-v1.test.ts`, valores exactos verificados para p001 y p004). Se documenta aquí sin editar el rastro — es la misma disciplina de transparencia que ya pedía Pablo para el resto del documento, aplicada ahora también al código.

### 21.3. Lo que YA funciona (verificado con datos reales, los 10 perfiles de `test-profiles.json`)

- `situacionesAmenaza()`: ranking de situaciones con el cap anti-inflación real (el de `motor-v2.1.ts`, no el de `motor-v4.ts` — bug documentado en sección 3). Verificado con valores exactos, no solo "no truena".
- `ensamblarReporte()`: produce `ReporteModoSencilloV1`/`ReporteModoCompletoV1` según el contrato — `accionPrincipal` solo existe en modo sencillo, verificado en runtime (`"accionPrincipal" in reporte === false` en modo completo).
- `deny`/`force`/`allow` como `CampoConCandidatos` real (ganador + candidatos rankeados, ganador siempre en rank 0) — reutilizando la lógica de ranking por peso que ya existía en `motor-v4.ts` (`buildDefenseInstruction`), que resultó estar bien construida pese al bug de `buildSituations`.
- `aware` como hasta 2 `CampoConCandidatos`, deduplicados por "mecanismo" (mismo criterio que ya usaba `motor-v4.ts`) — nunca más de 2, verificado en los 10 perfiles.
- `archetypeKey` produce siempre uno de los 10 valores del catálogo de 14.3, respetando siempre el grupo (base/alero/interior) de `identidad.posicion` — diseño real sobre la taxonomía Synergy, no el crosswalk provisional que había antes (ver 21.7).

### 21.4. Deuda explícita — lo que Fase 1 todavía NO resuelve, documentado en la cabecera de `motor-v1.ts` y aquí

1. ~~`archetypeKey` es un crosswalk provisional, no un diseño nuevo~~ — **[CERRADO, ver 21.7]** diseñado por El Arquitecto directamente sobre la taxonomía Synergy e implementado (`motor-v1-archetype.ts`), con 21 tests propios.
2. **Capa 3 (Nivel 2 / U Stats) no está wireada.** `capa3` es siempre `undefined`. Es Fase 2 del roadmap (sección 8), no Fase 1 — correcto que falte todavía, no es un descuido.
3. **`confianza` es una heurística provisional por score** (≥0.7 alta, 0.4-0.7 media, <0.4 baja) — el diseño real de 13.2 la ata a consistencia Nivel 1 + volumen de muestra Nivel 2, que no existe sin Capa 3. Se revisa cuando Fase 2 aterrice. (Nota aparte, verificada al implementar `archetypeKey`: la `confianza` interna de `detectarArchetype()` — diagnóstico, no va al reporte — tampoco tiene una escala uniforme entre grupos todavía; mismo pendiente de calibración, ver 21.7 §6.4 de El Arquitecto.)
4. **`porque` (15.5) siempre vacío** — misma razón que el punto 3.
5. ~~El mapeo de `floater` a `misc`~~ — **[CERRADO 2026-09-13]** decisión correcta, no un compromiso a mejorar. Verificado contra los 11 play types oficiales de Synergy (Pick & Roll Ball Handler, Pick & Roll Roll Man, Isolation, Cut, Handoff, Putback, Off Screen, Miscellaneous, Post Up, Spot Up, Transition — [Synergy Sports, Common Terms & Definitions](https://support.synergysports.com/support/solutions/articles/77000565960--common-terms-definitions)): "floater" no existe como play type propio porque no lo es — es un tipo de finalización/tiro que puede darse dentro de casi cualquiera de los 11, y Synergy tampoco intenta clasificarlo aparte. Verificado también contra el código real (`motor-v2.1.ts:2134-2155`): el único caso donde el dato SÍ indica de qué play type viene (`pnrFinishLeft`/`pnrFinishRight === 'Floater'` junto con `pnrFreq` real) ya se funde en el bucket `pnr` (`source: 'pnr_floater_unified'`, existente desde antes de esta sesión) — es precisamente el caso correcto de resolver. En cualquier otro caso el input no contiene ninguna señal de qué play type originó el floater; asignarlo por defecto a `iso` (o cualquier otro) sería inventar una asociación que el staff nunca marcó — la misma disciplina de `neverInfer` que motiva el resto de esta sección (21.7). El valor de coaching no depende del bucket interno: `motor-v2.1.ts` ya emite una instrucción `deny_floater` específica y con peso propio (hasta 1.0), independiente de en qué situación Synergy se agrupe para el ranking de Capa 1.
6. ~~`force`/`allow` tienen un fallback a `deny` cuando faltan~~ — **[CERRADO, ver 21.6]** son opcionales en el contrato, sin fallback.
7. **El catálogo exacto de `OutputKey`** sigue sin cerrar (Nota 2 de 14.2 bis) — se usan las keys existentes de `motor-v2.1.ts` sin traducir al naming nuevo todavía.
8. ~~`identidad.manoDominante` queda hardcodeada a `"D"`~~ — **[CERRADO]** corregido en la misma sesión: `postDominantHand` **no existe en `motor-v2.1.ts`** (es un campo de `mock-data.ts`, hallazgo al ir a mapearlo) — el dato real es `EnrichedInputs.hand` (`'R'|'L'`), ya cableado. Verificado con test de regresión (`motor-v1.test.ts`: p001 es zurda, `manoDominante` da `"I"`).
9. ~~`frecuenciaObservada` era una aproximación por score, no el dato real~~ — **[CERRADO, parcial]** corregido para 7 de las 11 situaciones (las que tienen campo `*Freq` directo en `EnrichedInputs`: iso, pnrHandler, post, transition, spotUp, handoff, cut) — ahora usan la frecuencia real marcada por el staff, no una aproximación. Las otras 4 (pnrRollMan, putback, offScreen, misc) siguen con la aproximación por score porque no tienen un campo de frecuencia propio en el input actual — seguirá así hasta que exista uno. Verificado con test de regresión: perfil "Luka Doncic", `spotUp` daría `"S"` por aproximación de score pero el dato real es `"R"` (Rara) y el test confirma que devuelve `"R"`.

### 21.5. `scripts/compare-motors.ts` — CERRADO, el paso barato de la auditoría original, hecho

El "próximo paso lógico" de esta sección resultó ser distinto de lo que decía aquí originalmente: no hacía falta tocar ningún componente React en producción para "correr ambos caminos y ver si diverge" — el propio `auditoria-u-scout-completa.md:228` ya hablaba de un **arnés de script**, no de código de producción, y `scripts/test-motor.ts`/`test-motor-v4.ts` ya seguían exactamente ese patrón. Tocar `ReportSlidesV1.tsx` (el único consumidor real de `motor-v4` en la UI) para esto habría sido más riesgo del necesario para una comparación que no necesita estar en producción.

**Antes de escribir el script:** verificado por SQL contra Supabase que la única jugadora real en la base de producción tiene `inputs: {}` (vacío) — no hay datos de producción reales con los que comparar todavía. `npm run motor:compare` corre los 13 perfiles de `test-profiles.json` por ambos motores y compara lo que debe coincidir (la key del ganador de deny/force/allow — motor-v1 reusa la misma lógica de ranking por peso) sin exigir que coincida lo que no debe (scores de situación — capados distinto a propósito, sección 3; `archetypeKey` — taxonomía nueva a propósito, 14.3/21.7).

**Resultado, tras un hallazgo real y su corrección (ver 21.8): 0 divergencias reales en los 13 perfiles.** Queda listo para correr contra datos de producción reales en cuanto existan — sin cambiar nada más.

### 21.6. Segundo bug real encontrado (y corregido) tras cerrar el contrato: `force`/`allow` NO son siempre presentes

Al escribir tests más exigentes sobre `ensamblarReporte()`, apareció un fallback sospechoso que yo mismo había dejado en el código (`force ?? deny`, con un comentario propio diciendo "force nunca debería faltar en la práctica"). Verificado contra los 10 perfiles reales de `test-profiles.json` **antes de confiar en ese comentario**: `force` falta en **4 de 10** perfiles, `allow` en **2 de 10** — no es el caso raro que yo mismo había asumido sin comprobar.

**Corregido:** el contrato de tipos (14.2 bis arriba, y `motor-v1-types.ts`) ahora marca `force`/`allow` como opcionales en `capa2` — `deny` se queda obligatorio porque sí es consistente en los 10 perfiles. El motor (`motor-v1.ts`) ya no rellena con un fallback a `deny` cuando faltan — los omite genuinamente. Bloqueado con test de regresión (`motor-v1.test.ts`: perfil "Steph Curry" no tiene `force`, verificado que el reporte lo refleja como `undefined`, no como una copia disfrazada de `deny`).

**Por qué se documenta con el mismo detalle que el bug de `clamp072()` (21.2):** es la misma disciplina que Pablo pidió para el resto del documento — no ocultar que una decisión "cerrada" (el contrato de 14.2 bis se llamó "CERRADO" antes de escribir código real contra él) tenía un error de fondo. Cerrar un contrato sobre papel y verificarlo contra datos reales son dos pasos distintos, y este documento existe para no confundirlos.

### 21.7. `archetypeKey` cerrado — diseño real de El Arquitecto sobre la taxonomía Synergy (2026-09-11)

Delegado en El Arquitecto (`.claude/agents/el-arquitecto.md`, ya configurado en este repo) el diseño que quedaba pendiente en 21.4 #1. Antes de proponer nada, corrió el crosswalk provisional que había contra los 10 perfiles reales y encontró que **3 de 10 producían un `archetypeKey` cuyo prefijo de grupo contradecía la `PosicionJugadora` del mismo reporte** (ej. un interior con `archetypeKey: "armadora_creadora"`) — el mismo tipo de bug real que ya se había encontrado dos veces antes en esta sesión (21.2, 21.6), esta vez en algo que yo mismo había escrito como placeholder.

**Diseño implementado en `client/src/lib/motor-v1-archetype.ts`**, con 3 principios: (P1) el grupo de posición es una restricción dura, nunca una entrada más al cálculo — un resultado fuera de grupo es estructuralmente imposible; (P2) el archetype debe añadir información que la Capa 1 (`SituacionAmenaza[]`) no tenga ya — nunca "la situación con más score" a secas, que era exactamente el bug de `motor-v4.ts::buildIdentity` (`situations[0]`); (P3) agregación por ejes funcionales (varias situaciones + señales de Nivel 1 como `pnrPri`/`isoDec`/`vision`/`usage`), nunca una sola situación decidiendo sola.

**Hallazgo importante de El Arquitecto sobre los datos disponibles:** `calculateThreatScores()` (`motor-v2.1.ts`) solo incluye situaciones que generaron al menos un output de categoría `deny` — un algoritmo que leyera solo `SituacionAmenaza[]` sería estructuralmente ciego a la creación de juego pura (ej. Draymond Green: sus señales de playmaking, `aware_passer`/`aware_connector`, nunca aparecen en el ranking de amenaza). Por eso el algoritmo también lee un puñado acotado de campos de Nivel 1 directamente — todos observación pura del staff (`pnrPri`, `isoDec`, `dhoRole` están en `neverInfer`), nunca un campo inventado.

**Cobertura de test:** 21 tests nuevos (`motor-v1-archetype.test.ts`) — unitarios contra `detectarArchetype()` con fixtures controladas, más 3 perfiles sintéticos (`scripts/test-profiles.json`, p011-p013) para los 3 archetypes que no tenían ninguna muestra real antes de esta sesión (`interior_abridora`, `alero_penetradora`, `alero_movimiento`). Los 10 valores del catálogo de 14.3 tienen ahora al menos un perfil de test que los produce — antes de esto, solo 7 de 10 eran alcanzables con los datos de fixture existentes.

**2 preguntas de baloncesto genuinas que El Arquitecto dejó para Pablo, no decididas por él ni por mí:**
1. Un pívot con señales fuertes de creación (visión élite + una señal explícita de distribución) se clasifica hoy como `interior_creadora` aunque su situación dominante sea post-up (caso real: Jokic). Es una decisión de qué información añade más valor al informe (P2), no una medición — si prefieres que el archetype describa dónde hay que defenderla en vez de cómo funciona el ataque, se invierte en 4 líneas. **[CERRADO 2026-09-12, ver 14.3 ter]** Investigado contra scouting real de Jokic: fuentes independientes describen su pase/creación como el rasgo que "toma el centro del escenario" por delante del post-up, coincidiendo con la decisión ya tomada — no hace falta el desempate de Pablo, el criterio de El Arquitecto queda validado externamente.
2. ~~El puente desde `motor-v2.1.ts` colapsa SG a grupo "base" siempre~~ — **[CERRADO 2026-09-12, respuesta directa de Pablo]**: *"klay thompson no es base nunca. es alero. no genera ni sube la pelota ni apenas usa el dribbling."* Corregido en `mapearPosicion()` (`motor-v1.ts`): `PG` siempre es `base`; `SG` depende de si carga con el balón de verdad (`usage !== 'role'` y `isoFreq`/`pnrFreq` en P o S) — si no, `alero`. Verificado: Klay Thompson (p005) ya da `alero_tiradora`; Luka Doncic (p001, también SG en el fixture pero con carga on-ball real) sigue en `base`. Se añadió `p014` (base suplente sintético) para no perder cobertura de `manejadora_secundaria`, que Klay era el único perfil que producía.

### 21.8. Cuarto bug real encontrado (y corregido) al escribir `compare-motors.ts`: `allow` no se derivaba del deny menos amenazante

Al correr `scripts/compare-motors.ts` (21.5) contra los 13 perfiles, aparecieron 2 divergencias reales (no cosméticas): Haliburton y el pívot abridor sintético tenían `allow_iso`/`allow_post` en el legacy y **ningún `allow`** en motor-v1. Causa: `motor-v4.ts::buildDefenseInstruction` tiene una segunda vía para `allow` que `motor-v1.ts` no replicaba — cuando no hay ningún output `category: 'allow'` real, deriva uno sintético a partir de la situación de `deny` MENOS amenazante (weight < 0.5), porque una jugadora sin ningún `allow` explícito puede seguir teniendo una situación genuinamente de bajo riesgo que vale la pena "conceder" en el plan defensivo.

**Corregido:** nueva función `campoAllow()` en `motor-v1.ts` que replica esa vía completa (incluida la supresión cuando `force` ya cubre la dirección, mismo criterio que el legacy) y produce el `CampoConCandidatos` correcto. Bloqueado con test de regresión (`motor-v1.test.ts`: Haliburton da `allow_iso`, no `undefined`). Tras la corrección, `npm run motor:compare` da **0 divergencias reales** en los 13 perfiles.

**Hallazgo de proceso, separado del bug de producto:** al verificar esto se descubrió que `tsconfig.json` excluye `**/*.test.ts` — ningún archivo `.test.ts` de esta sesión había sido tipado de verdad por `npm run check` en ninguna sesión anterior (2 errores reales de tipos existían sin detectar: un spread sobre `Set` sin `downlevelIteration`, y un `Set<string>` usado donde se esperaba `Set<ArchetypeKey>`). **Corregido con `tsconfig.tests.json`** (extiende el real, sin la exclusión) y un script nuevo, `npm run check:tests` — a correr junto a `npm run check` de ahora en adelante, no solo cuando se recuerde hacerlo a mano con un tsconfig temporal.

### 21.9. Dos bugs más al ampliar el fixture con los 10 perfiles de `eval-motor-quality.ts` (2026-09-12)

`eval-motor-quality.ts` (script antiguo citado en el roadmap de la sección 8) resultó ser sobre todo una prueba de **texto renderizado** (`reportTextRenderer.ts`), una capa que Motor 1.0 no tiene todavía — no se pudo reusar literalmente. Pero sus 10 perfiles cubren tipos de jugadora que los 14 anteriores no tenían (una base con manejo terrible bajo presión, una cortadora pura sin creación, un handler que se hunde ante el trampeo) — se añadieron al fixture como `p015`-`p024` (24 perfiles totales) y se corrieron por `motor:compare`. Aparecieron 2 hallazgos reales:

**Quinto bug — `cutType: 'backdoor'` alimentaba `alero_penetradora`, no `alero_movimiento`.** `p019` (cortadora pura, `usage: 'role'`, sin iso/pnr/post, `cutFreq: 'P'`, `cutType: 'backdoor'`) salía `alero_penetradora` — lo contrario de lo que es. Causa: la fórmula de PENETRADORA de `detectarAlero()` (14.3 bis/21.7) contaba `cutType === 'basket' || 'backdoor'` como señal de penetración. Un corte a la espalda del defensor es la acción sin balón por definición (explota que el defensor mira al balón, no un regate) — un corte `'basket'` (línea recta al aro, a menudo desde un drive) sí es penetración de verdad. **Corregido:** `backdoor` movido a la fórmula de MOVIMIENTO (junto a `curl`), `basket` se queda en PENETRADORA. Bloqueado con 2 tests de regresión (`motor-v1-archetype.test.ts`).

**Sexto bug — `deny` también puede faltar legítimamente, igual que `force`/`allow` (21.6).** `p020` (jugadora de muy bajo impacto ofensivo: `ballHandling: 'liability'`, `pressureResponse: 'struggles'`, sin iso/pnr/post reales) reveló que `motor-v2.1.ts::selectTopOutputs` exige `weight >= 0.35` (línea 2457) para que un output de `deny` "merezca" mostrarse — por debajo de eso, ni el legacy lo considera una amenaza real. `motor-v1.ts` no replicaba este suelo (solo pedía `weight > 0`), así que producía un `deny` (`deny_iso_space`, weight 0.208) donde el legacy correctamente no recomendaba nada — inventando una amenaza que no existe de verdad.

**Corregido:** `campoDesdeRawOutputs()` gana un parámetro `pesoMinimo`, aplicado a `0.35` solo para `deny` (force/allow/aware se quedan en `>0`, que es lo que el legacy usa para ellos). `capa2.deny` y `ReporteModoSencilloV1.accionPrincipal` pasan a **opcionales** en el contrato de tipos, mismo patrón y misma justificación que `force`/`allow` en 21.6. Se eliminó el `throw new Error` que `ensamblarReporte()` lanzaba cuando faltaba `deny` — asumía (mal, sin comprobarlo) que era imposible.

**Efecto colateral real, no cosmético:** al correr `motor:compare` con la corrección, `p020` divergía — `motor-v4.ts` **tampoco** aplica el suelo de 0.35 (`buildDefenseInstruction` coge `sorted[0]` de `rawOutputs` sin más criterio), así que produce `deny_iso_space` donde ni siquiera `motor-v2.1.ts` lo consideraría válido. Es la tercera vez en esta auditoría que `motor-v4.ts` diverge en silencio de una regla de curación real de `motor-v2.1.ts` (las otras dos: el cap anti-inflación de sección 3, y — al revés — el fallback de `allow` de 21.8, que sí tenía). Documentado en `compare-motors.ts` como excepción conocida (motor-v1 es el correcto ahí), no como divergencia a investigar.

**`[CERRADO 2026-09-12, ver 21.9 bis]`** ¿qué debe mostrar la Capa 0 del modo sencillo cuando una jugadora no tiene ninguna situación que "merezca" una acción de deny? Resuelto — no era solo criterio de Pablo, había una idea suya concreta (semáforo) que investigar y validar antes de implementar.

### 21.9 bis. Semáforo de amenaza — resuelto con respaldo real de terminología de banquillo (2026-09-12)

> Idea de Pablo: si nada merece denegarse, situación amarilla, "defensa estándar", nunca silencio. Investigado antes de implementar, como pidió.

**Hallazgo real, no solo la idea confirmada:** la terminología de banquillo real para esto ya existe y tiene nombre — **KYP ("Know Your Personnel")**. Los entrenadores categorizan explícitamente cada jugadora rival como amenaza o no-amenaza, y en ningún caso la respuesta a "no-amenaza" es no decir nada: contra tiradoras ("shooters") el cierre es agresivo y pegado al cuerpo; contra no-tiradoras ("non-shooters") la instrucción explícita es **dejar espacio y no ayudar de más** ("sagging man-to-man defense encourages defenders to give non-shooters extra space while remaining ready to help") — es una instrucción activa distinta, no una ausencia de instrucción ([PGC Basketball — Smarter Closeouts](https://pgcbasketball.com/blog/smarter-closeouts-defend-shooters-drivers-complete-players/); [Let's Go Warriors — The meta of KYP](https://www.letsgowarriors.com/p/meta-of-kyp-know-your-personnel-steph-curry-health-ecosystem-warriors-nuggets)). Confirma exactamente la intuición de Pablo, con vocabulario real detrás: "defensa estándar" no es una ausencia de dato, es la traducción correcta de lo que un entrenador real le diría a su equipo sobre esta jugadora.

**El semáforo en sí (rojo/amarillo/verde) no aparece documentado como convención específica de scouting de baloncesto** — sí como principio de UX ya extremadamente validado en general ("green means go, red means stop, and yellow means slow down... each color triggering a predictable user action", [Usability Geek — The Traffic Lights of UX](https://usabilitygeek.com/traffic-lights-ux-smart-color/)). Aplicarlo aquí no es inventar un lenguaje nuevo — es tomar prestado un patrón de comunicación de riesgo ya probado, para una distinción (amenaza real / sin amenaza) que el propio banquillo de baloncesto ya hace, solo que con palabras en vez de color.

**Implementado:** nuevo campo `nivelAmenaza: "alta" | "estandar"` en `IdentidadReporte` (`motor-v1-types.ts`) — `"alta"` (🔴) cuando `capa2.deny`/`accionPrincipal` existe, `"estandar"` (🟡) cuando no. Presente en ambos modos — útil no solo para decidir el texto de Capa 0, sino para un futuro listado de roster con un punto de color por jugadora sin tener que abrir cada informe. Calculado en `ensamblarReporte()` (`motor-v1.ts`), verificado con test de regresión (`motor-v1.test.ts`: p020 → `"estandar"`, p001 → `"alta"`).

**Lo que sigue siendo trabajo de UI, no de este motor:** el copy exacto ("Defensa estándar del equipo" vs. otra redacción) y si el punto de color aparece también en un listado de roster — decisiones de la capa de presentación (Fase 3+), el dato ya está listo para consumirlas.

Verificado tras ambas correcciones: `npm run check`/`check:tests` limpios, `npx vitest run` 92/92 (mismo fallo preexistente y no relacionado), `npm run motor:compare`: **0 divergencias reales en 24 perfiles**.

### 21.10. Las 3 preguntas de sensibilidad de baloncesto de 14.3 bis, cerradas (2026-09-12)

> A petición explícita de Pablo: "esas preguntas resuélvelas tú documentándote y analizando todo a fondo, haz test si lo necesitas. y continúa". Decisión propia, con investigación real y verificación empírica — no solo criterio sin comprobar.

**Pregunta 2 (umbral `offScreen >= 0.6`) — CERRADO: se mantiene en 0.6.** Ya investigado en 14.3 ter: las fuentes describen el movimiento sin balón de Klay como un rasgo constante y definitorio ("constantly moving without the ball and coming around screens"), no marginal — subir a 0.7 lo excluiría, contradiciendo el consenso real de scouting sobre el jugador que motivó la propia feature. Sin cambios de código; se cierra la pregunta, no el valor.

**Pregunta 3 (Gobert suprimido) — CERRADO: se mantiene la supresión.** Ya investigado en 14.3 ter: ningún scouting real de Gobert separa su finalización en el aro de su aporte en transición — son la misma idea en las fuentes ("finishing lobs efficiently and providing outlet passes that fueled Utah's transition game"). Forzar la etiqueta completa introduciría una distinción que ni las fuentes reales hacen. Sin cambios de código.

**Pregunta 1 (¿falta un tercer eje de modificador?) — CERRADO: no, el catálogo se queda en 2, con una razón nueva y más sólida que "no encontré uno".**

Dos pasos de análisis, no solo intuición:

1. **Verificación empírica actualizada.** El 21% de disparo original (3/14) se calculó antes de añadir los 10 perfiles de `eval-motor-quality.ts` (21.9). Recalculado contra los 24 perfiles reales: **13% (3/24)** — el margen respecto al techo de ~35% (16.3b, Cowan) es aún mayor de lo que se pensaba. No hay presión de presupuesto cognitivo empujando a añadir un tercer eje.

2. **El candidato más fuerte, probado contra datos reales, resultó ser redundante — no ausente.** El candidato de sensibilidad de baloncesto más obvio para un tercer eje es "vulnerable a la presión / manejo atacable" (exactamente lo que motivó los perfiles `p020`/`p023`, ambos con `ballHandling: 'liability'`/`'limited'` y `pressureResponse: 'struggles'`). Verificado ejecutando `motor.generateReport()` contra ambos: **ya generan `aware_pressure_vuln` con weight 0.80**, uno de los 2 slots de aware disponibles. Este hallazgo cambia la conclusión de fondo: no es que no exista un tercer eje calculable — es que el sistema **ya tiene** el mecanismo correcto para él, y no es el modificador de archetype. El propio framework de 6 preguntas (13.0) ya asigna esto a la pregunta 6 ("el detalle no obvio") y a `aware`/`quietEdge`, no al archetype (preguntas 1-3). Añadir un tercer modificador para "vulnerable a la presión" duplicaría una señal que el informe ya muestra por otra vía — exactamente el error anti-P2 que los 2 modificadores existentes se diseñaron para evitar, aplicado ahora al límite entre "archetype" y "aware" en vez de entre "archetype" y "situación".

**Conclusión de arquitectura, no solo de calibración:** el catálogo de 2 modificadores no se queda en 2 por falta de ideas — se queda en 2 porque el trabajo de "capturar el matiz no obvio" ya tiene un dueño (`aware`, 2 slots) y duplicarlo en el archetype sería el mismo error que motivó el diseño original. El único candidato de tercer eje que sigue en pie ("clutch"/creación en momentos de alta dificultad, 14.3 ter) sigue bloqueado por falta de datos de shot-clock, no por falta de sitio en el catálogo — cuando ese dato exista (Fase 2+), la pregunta correcta será si encaja en `aware` o en un tercer modificador, no asumirlo de antemano.

## 22. Primer cambio real de UI — el picker de alternativas (2026-09-12)

> Pablo preguntó si convenía repensar la UI aprovechando las capacidades nuevas. Investigado antes de proponer nada: la sección 17.1 (edición → propuesta → discrepancias → aprobación) ya estaba diseñada desde abril y **parcialmente construida** — pero con un hueco real, no cosmético, que esta sección cierra.

### 22.1. El hueco real, verificado antes de tocar código

Verificado leyendo el código, no asumido: `overrideEngine.ts` (el motor que aplica overrides aprobados) ya sabe procesar `action: "replace"`; `reportTextRenderer.ts` ya renderiza `alternatives` con texto+score para deny/force/allow; `ReportSlidesV1.tsx` ya tenía un `Sheet` de "Alternativas del motor" — **pero de solo lectura**, cada alternativa era un `<div>` sin `onClick`, sin forma de elegirla. `OverridePanel.tsx` (el panel de revisión del entrenador) solo implementaba ocultar/mostrar (`hide`/`keep`), nunca sustituir. Y el propio backend bloqueaba la posibilidad: `reportOverrideBodySchema` en `server/routes.ts` validaba `action: z.enum(["hide", "keep"])` — un `"replace"` real habría fallado con 400 antes de llegar a ningún lado.

**Hallazgo adicional en la capa de datos:** la tabla real `report_overrides` en Supabase ya tenía las columnas `replacement_value`/`original_score`/`replacement_score`/`archetype_key`/`locale`/`approved_at` — pero `shared/schema.ts` (Drizzle) no las declaraba, así que el ORM no podía leerlas ni escribirlas aunque existieran en la base de datos real.

Es decir: el "diseño de abril" (edición → propuesta con runners-up → discrepancias → aprobación) tenía la mitad construida (aplicar un override ya elegido) y le faltaba la otra mitad (elegirlo). No era un rediseño — era cerrar un círculo ya empezado.

### 22.2. Qué se cambió, capa por capa

1. **`shared/schema.ts`** — declaradas las 6 columnas que ya existían en la tabla real, para que Drizzle pueda usarlas. Sin migración: las columnas ya estaban en Supabase, solo faltaba que el código supiera de ellas.
2. **`server/storage.ts`** — `upsertReportOverride` acepta ahora `action: "replace"|"approve_as_is"` además de `"hide"|"keep"`, y persiste `replacementValue`/scores/`archetypeKey`/`locale` cuando la acción es `"replace"` (se limpian a `null` en cualquier otra acción, para no arrastrar un valor viejo si el entrenador cambia de opinión).
3. **`server/routes.ts`** — `reportOverrideBodySchema` amplía el enum de `action` y valida los campos nuevos. **Bug real encontrado y corregido de paso:** `computeHasDiscrepancy()` solo comparaba la `action` de cada entrenador, nunca el `replacementValue` — dos entrenadores con `action:"replace"` pero **alternativas distintas** no se detectaban como discrepancia. Corregido para que la clave de comparación incluya el valor elegido cuando existe.
4. **`client/src/lib/approval-api.ts`** — `ApprovalStatusPayload`/`useSetReportOverride` amplían sus tipos. **Segundo bug real corregido:** `serverOverridesToReportOverrides()` colapsaba cualquier `action` que no fuera `"hide"` a `"approve_as_is"` — un `"replace"` guardado en el backend se perdía aquí y `applyOverrides()` nunca llegaba a aplicarlo. `ReportViewV4.tsx` tenía una copia inline del mismo bug (corregida igual, y desduplicada para usar la función compartida).
5. **`client/src/pages/scout/ReportSlidesV1.tsx`** — el cambio visible: cada alternativa del `Sheet` de deny/force/allow es ahora un botón real (solo en `coachMode` — la jugadora nunca puede tocar esto), con estado "Elegir esta" / "Elegida ✓" / pendiente, y un enlace "Restaurar recomendación original" cuando hay un override activo. Guarda vía `useSetReportOverride` (que ya invalida las queries correctas) — no hizo falta ningún plumbing manual entre componentes, el `overrides` prop que ya fluye desde `ReportViewV4.tsx` se actualiza solo.

**Deliberadamente fuera de esta pasada:** el picker no se extendió a `aware` (el render de `RenderedAlert` no lleva `alternatives` todavía, a diferencia de deny/force/allow) ni a situaciones/archetype (sus sheets siguen siendo de solo lectura — el "También: X" de archetype es además el bug ya documentado en 21.7, candidato a retirarse cuando `ReportSlidesV1.tsx` migre a `motor-v1`, no antes).

### 22.3. Verificación

`npm run check`/`check:tests` limpios, `npx vitest run` 93/93 (mismo fallo preexistente y no relacionado — no toca ningún archivo de esta sección). Sin test de integración end-to-end contra la base de datos real: la única jugadora real en producción tiene `inputs: {}` (spec 21.5), no hay datos con los que ejercitar el flujo completo hoy — la corrección queda verificada por tipos y por lectura cuidadosa del flujo de datos completo (backend→frontend→render), no por una prueba contra datos reales que no existen todavía.

## 23. Plan de migración `ReportSlidesV1.tsx`: motor-v4 → motor-v1 (El Arquitecto, 2026-09-13)

> Motor 1.0 está construido y verificado (93 tests, `motor:compare` 0 divergencias en 24 perfiles) pero nunca llega a un entrenador real: `ReportSlidesV1.tsx` — único consumidor de UI real (21.5) — sigue en `generateMotorV4()`. Delegado en El Arquitecto el plan de corte antes de tocar código, mismo patrón que 21.7.

### 23.1. Hallazgo central, no documentado antes de este análisis

`reportTextRenderer.ts` (la capa de texto que consume `ReportSlidesV1.tsx`) depende de dos cosas que `ScoutingReportV1` no tiene:
1. **`EnrichedInputs` completo** (Nivel 3 legacy) — `motor-v1-types.ts` lo omite a propósito (decisión de 14.2 bis, separar Nivel 1/observación de Nivel 3/inferido), pero casi todas las funciones de `reportTextRenderer.ts` (`renderInstructionEN/ES/ZH`, `renderSituationDescription*`, `renderTagline`, `renderThreat`) lo leen campo a campo para generar el nivel de detalle actual del texto (ej. dirección de un force depende de `isoDir`).
2. **`SituationId`** granular (16 valores con dirección/zona: `iso_right`, `post_high`, etc.) para las descripciones de situación (Slide 1) — `SituacionAmenaza.situacion` de motor-v1 solo tiene los 11 buckets Synergy, sin dirección/zona. Las funciones de descripción de situación no se pueden reapuntar con un cambio de firma — hay que reescribirlas.

También falta un catálogo de labels para los 10 `ArchetypeKey` nuevos + fusión de `archetypeModificador` (hoy `renderIdentity()` solo conoce las 9 etiquetas viejas de `motor-v4.ts::situationToArchetype`).

Lo que SÍ es reutilizable casi literal: las keys de deny/force/allow son el mismo string legacy en ambos motores (21.4#7), así que `renderInstructionEN/ES/ZH(key, ...)` sirve una vez resuelto el problema de `EnrichedInputs`.

### 23.2. Alcance real, más pequeño de lo temido en un eje

Verificado: `OverridePanel.tsx`, `overrideEngine.ts` y el backend de aprobación (sección 17/22) son **agnósticos al motor** — trabajan sobre `RenderedReport`/`itemKey` genéricos, no sobre `MotorV4Output`. La migración no los toca, siempre que el nuevo `RenderedReport` conserve los mismos `itemKey`s (`deny.instruction`, `situation.N`, etc.) para no invalidar overrides ya guardados en Supabase.

`closeoutThreat.ts` sí depende de `EnrichedInputs` y de los prefijos de `SituationId` — mismo problema que el punto 1, más un mapeo de prefijos (`catch_shoot`/`off_ball` → `spotUp`/`offScreen`).

### 23.3. Decisión de producto — **[CERRADO 2026-09-13, respuesta directa de Pablo]**

¿`motor-v1.ts` expone `EnrichedInputs` como dato auxiliar fuera del contrato limpio de `ScoutingReportV1`, para no perder detalle de texto (ej. "Force left — contest every touch before they gather")? O se reescribe el catálogo de texto sin ese dato, aceptando un texto menos específico que el actual?

**Pablo elige mantener el detalle actual** (la recomendación de El Arquitecto): `motor-v1.ts` expone `EnrichedInputs` como dato auxiliar fuera del contrato limpio de `ScoutingReportV1`, documentado como deuda técnica deliberada (mismo patrón que `motor-v1-source-map.ts`). El texto para el entrenador mantiene el nivel de detalle actual; el contrato de tipos "limpio" de 14.2 bis queda con una excepción documentada, no violado en silencio.

### 23.4. Estrategia de corte — decidida

**Atómica, sin feature flag** (no existe infraestructura de flags en el repo, verificado — construir una solo para esto sería más riesgo que el propio corte) **pero en 2 PRs secuenciales** por gestión de riesgo de revisión, no por gradualismo en producción (un híbrido de dos motores en la misma pantalla contradice el objetivo de Motor 1.0, "una sola fuente de verdad"):
- **PR-A**: nueva capa de texto (adaptación real de `reportTextRenderer.ts`) que consume `ScoutingReportV1` + el `EnrichedInputs` auxiliar (pendiente de 23.3) — verificable en aislamiento, sin tocar `ReportSlidesV1.tsx`.
- **PR-B**: swap atómico en `ReportSlidesV1.tsx`/`closeoutThreat.ts` a motor-v1 usando la capa del PR-A. Incluye: eliminar (no migrar) el "También: X" de archetype (bug ya documentado en 21.7/22.2, candidato a retirarse aquí); implementar el copy activo de "defensa estándar" cuando `nivelAmenaza === "estandar"` (21.9 bis, diseñado pero nunca implementado en UI); opcionalmente extender el picker de alternativas (22.2) a `aware` ya que motor-v1 sí trae candidatos ahí.

### 23.5. Riesgo explícito sin mitigación disponible

No hay datos de producción reales (21.5: la única jugadora real tiene `inputs: {}`) — la única verificación posible antes de desplegar es automatizada (tests + `motor:compare`) más inspección manual contra los 24 perfiles sintéticos de `scripts/test-profiles.json`. Ningún entrenador real habrá visto el resultado con datos reales antes del despliegue. Recomendación de El Arquitecto: que Pablo revise personalmente 3-4 perfiles representativos (uno por grupo de posición) antes de dar por cerrada la migración.

### 23.6. Deliberadamente fuera de esta migración

Capa 3/Nivel 2 (Fase 2, no bloquea); `porque`/`confianza` real (siguen placeholder, 21.4); migrar `PlayerEditor.tsx` a `PlayerProfileV1Inputs` (no hace falta — `ensamblarReporte` acepta el mismo `PlayerInputs` legacy); retirar `motor-v4.ts`/`motor-v2.1.ts` del repo (Fase 3 completa — deben quedarse mientras `compare-motors.ts` los use como referencia de aceptación).

### 23.7. PR-A cerrado — nueva capa de texto (2026-09-13)

Implementado tal como se planificó en 23.4, sin sorpresas de alcance respecto a lo mapeado en 23.1:

1. **`motor-v1.ts`** — nueva función `ensamblarReporteParaTexto()`, que devuelve `{ reporte, enrichedInputs }` (`ensamblarReporte()` se queda igual, ambas comparten el mismo cálculo interno, no se corre `motor.generateReport()` dos veces). Es el único punto donde `EnrichedInputs` sale de este archivo — deuda técnica deliberada, documentada en la cabecera de la función, resolviendo 23.3. También se exportó `mecanismoDeAwareKey()` (antes función local de `slotsAware()`) para no duplicar la clasificación de "mecanismo" en la capa de texto.
2. **`reportTextRenderer.ts`** — sin cambios de comportamiento, solo se añadió `export` a los helpers reutilizables (`g`, `joinList*`, `spotZonesPhrase*`, `cornerFocus*`, `renderInstructionEN/ES/ZH`, `renderAlertText`, `renderTriggerCue`) para que la nueva capa los reutilice en vez de duplicarlos — las keys de deny/force/allow/aware son el mismo string legacy en ambos motores (23.1), así que esas ~600 líneas se reutilizan literales.
3. **`reportTextRendererV1.ts`** (nuevo) — capa de texto para `ScoutingReportV1`. Trabajo nuevo real (no adaptación de firma): descripciones de situación para los 11 buckets Synergy (recuperan la dirección/zona leyendo `EnrichedInputs` dentro de cada caso, ej. `iso` mira `isoDir`, en vez de que la granularidad viva en la key como en motor-v4); catálogo de labels para los 10 `ArchetypeKey` + fusión obligatoria de `archetypeModificador` (14.3 bis); `renderThreatV1()` basado en el semáforo `nivelAmenaza` (21.9 bis) — implementa por primera vez en código el copy activo de "defensa estándar del equipo" (respaldo KYP) que hasta ahora solo estaba decidido en la spec, nunca en texto real.
4. **`reportTextRendererV1.test.ts`** (nuevo) — 51 tests: los 24 perfiles del fixture renderizados en los 3 idiomas sin ningún string vacío (ninguna descripción de situación cae en el `default` del switch), verificación explícita de que `accionPrincipal` ausente siempre corresponde a `nivelAmenaza: "estandar"` con el copy activo (nunca un hueco silencioso), y de que la fusión de `archetypeModificador` aparece en la etiqueta y nunca como elemento separado.

**Deliberadamente más simple que el original en dos ejes, ambos documentados en la cabecera del archivo, no descuidos:**
- `renderTaglineV1`/`renderThreatV1` no replican cada rama fina que tenía `motor-v4.ts` por `dangerLevel` 1-5 — el dato de origen ahora es el semáforo binario `nivelAmenaza` (ya decidido en 21.9 bis), así que el texto reflected esa simplicidad real, no es una limitación de esta capa.
- El picker de alternativas (22.2) no se extendió a `aware` en esta pasada (`RenderedAlert` se queda sin `alternatives`) — explícitamente opcional para esta migración (23.4#5), no bloqueante.

**Verificación:** `npm run check`/`check:tests` limpios, `npx vitest run` 144/144 reales (mismo fallo preexistente y no relacionado), `npm run motor:compare` 0 divergencias en 24 perfiles (esta capa no toca cálculo, solo texto — se corre igual por disciplina).

**Estado:** PR-A cerrado. `ReportSlidesV1.tsx` sigue sin tocarse — sigue en `motor-v4` en producción (21.5). PR-B (23.4: swap atómico en `ReportSlidesV1.tsx`/`closeoutThreat.ts`, eliminar el "También: X", implementar el copy de "estándar" en la UI real) queda como siguiente paso, no hecho en esta sesión.

### 23.8. PR-B cerrado — swap atómico en producción (2026-09-13)

**`ReportSlidesV1.tsx` ya no usa `motor-v4` — desde este commit, Motor 1.0 es lo que ve un entrenador real en la app.** Es el cambio de mayor riesgo real de toda esta fase: la pantalla de informe que usan los entrenadores hoy, sin datos de producción con los que probar el flujo completo (21.5: la única jugadora real tiene `inputs: {}`).

**Qué cambió, capa por capa:**
1. **`closeoutThreat.ts`** — nueva `computeCloseoutThreatV1()`, mismo algoritmo exacto que `computeCloseoutThreat()` (legacy se queda, sin usuarios ya, candidata a retirar en Fase 3), adaptado a `SituacionAmenaza[]` (11 buckets Synergy) en vez de `RankedSituation[]` (16 `SituationId`). Nuevo test (`closeoutThreat.test.ts`, 24 perfiles): **el semáforo, `watchDrive` y `handlerNote` coinciden exactamente entre la ruta legacy y la v1 en los 24 perfiles** — la única diferencia tolerada es el índice numérico interno (decimales de ponderación entre buckets sin equivalencia 1:1), que la UI no muestra.
2. **`overrideEngine.ts`** — nueva `applyOverridesV1()`, adaptada a la unión discriminada real de `RenderedReportV1` (modo sencillo no tiene `situations`/`alerts`, su único campo tocable es `accionPrincipal`). `detectDiscrepancies`/`detectPatterns`/`buildOverrideRecord` sin cambios — confirmado agnósticos al motor (23.2).
3. **`motor-icons.ts`** — añadidos los 11 iconos para los buckets Synergy nuevos, los 16 antiguos se quedan (motor-v4 sigue vivo en `compare-motors.ts`).
4. **`ReportSlidesV1.tsx`** — el swap real: `generateMotorV4()` → `ensamblarReporteParaTexto()` + `renderReportV1()`. Esta pantalla siempre pide modo `"completo"` (nunca `"sencillo"`) — el toggle "Resumen/Informe completo" sigue siendo 100% client-side, exactamente como ya funcionaba con motor-v4 (que tampoco distinguía modo a nivel de datos); modo `"sencillo"` del contrato es para otros consumidores futuros (13.3, "sin acción adelantada" para la jugadora), no aplica aquí porque el entrenador ya ve todo ordenado por slide. Cambios de producto reales, no solo plomería:
   - **Retirado el "También: X" de archetype** (el sheet y el botón que lo abría) — spec 22.2/21.7, era el bug de P2 (repetir la situación #2 sin añadir información), documentado como candidato a retirar "cuando migre a motor-v1" — ya migró.
   - **Implementado el copy activo de "Defensa estándar"** (spec 21.9 bis, decidido el 12/09 pero nunca escrito en la UI hasta ahora): cuando `nivelAmenaza === "estandar"`, la tarjeta de "Amenaza principal" (Slide 0 y modo sencillo) cambia a ámbar/neutro con el texto de `renderThreatV1()`, y Slide 2 muestra una tarjeta "Defensa estándar" en vez de omitir la sección DENY en silencio.
   - El picker de alternativas (22.2) usa ahora `candidatos.slice(1)` en vez de `alternatives` — sin cambio visible, `CampoConCandidatos` ya incluye al ganador en rank 0.
5. **Dos bugs reales preexistentes, encontrados por inspección manual (no por tests) y corregidos en ambos motores (legacy y v1), sin relación con la migración:**
   - **`reportTextRenderer.ts`/`reportTextRendererV1.ts`, situación ISO en español:** "Inicia el ISO por el lado derecha/izquierda" — "lado" es masculino, necesitaba "derecho"/"izquierdo". Bug presente en producción desde antes de esta sesión.
   - **Movimientos de poste sin traducir:** `inputs.postMoves.join(" and "/" y ")` dejaba claves crudas con guion bajo visibles en el texto final (ej. "up_and_under", "drop_step") y no usaba `joinListEN/ES` (ya existían en el mismo archivo, sin usar en este punto). Nueva función compartida `postMoveLabel()`/`postMovesPhrase()` en `reportTextRenderer.ts`, reusada desde `reportTextRendererV1.ts`.

**Verificación, más allá de lo automatizable:** `npm run check`/`check:tests` limpios, `npx vitest run` **168/168** reales (mismo fallo preexistente no relacionado), `npm run motor:compare` 0 divergencias en 24 perfiles. Además — dado que no hay datos de producción reales con los que ejercitar el flujo end-to-end (21.5/23.5, riesgo que El Arquitecto dejó explícito) — se generó y se leyó a mano el texto completo renderizado (identidad, situaciones, defensa, aware) de 16 de los 24 perfiles del fixture, en español, cubriendo los 10 `archetypeKey` y el caso `nivelAmenaza: "estandar"`: es lo que encontró los dos bugs del punto 5. No sustituye una revisión de un entrenador real contra datos reales, pero es más verificación humana de la que ha tenido cualquier cambio anterior de esta sesión.

**Sigue pendiente, documentado, no descuidado:** ninguna jugadora real en producción tiene datos de scouting todavía (21.5), así que esta migración no se ha visto todavía con datos reales por un entrenador. Recomendación de El Arquitecto (23.5), repetida aquí: revisar 3-4 informes reales en cuanto existan datos de scouting reales que ejercitar.

### 23.9. Semáforo de amenaza en el roster — cerrado (2026-09-13)

La propia 21.9 bis ya dejaba anotado que un punto de color por jugadora en el listado de roster era útil "sin tener que abrir cada informe", pero lo marcaba como trabajo de Fase 3+ porque hasta PR-B no había ninguna fuente barata de `nivelAmenaza` fuera de `ReportSlidesV1.tsx`. Con Motor 1.0 ya siendo la fuente real (23.8), dejó de ser caro: `Personnel.tsx` (el listado de roster) calcula ahora `nivelAmenaza` por jugadora vía `ensamblarReporte()` (memoizado sobre `allPlayers`, sin `EnrichedInputs`/texto — no hace falta para un punto de color) y pinta un punto 🔴/🟡 junto al nombre.

**Tercer estado añadido, no solo binario:** una jugadora sin ninguna situación scouteada (`inputs={}`, el caso más común en producción hoy, 21.5) no es "estandar" (sin amenaza) — es "sin datos" (gris), mismo criterio que `insufficient_data` en `closeoutThreat.ts`. Confundir ambos habría pintado de amarillo/"revisado, sin amenaza" a jugadoras que en realidad nadie ha scouteado todavía.

Verificado: `npm run check`/`check:tests` limpios, `npx vitest run` 168/168 (sin tests nuevos específicos — es UI fina sobre lógica ya cubierta por `motor-v1.test.ts`/`motor-v1-acceptance.test.ts`).

## 24. Fase 2 — plan de vínculo con U Stats (El Arquitecto, 2026-09-13)

> Delegado en El Arquitecto (mismo patrón que 21.7/23) antes de tocar código: cerrar `capa3`/`porque`/`confianza` real (deuda explícita de `motor-v1.ts` desde Fase 1).

### 24.1. Hallazgos que corrigen el estado asumido por las secciones 5/10

**La spec (5.2) estaba desactualizada en dos puntos, verificado contra código real:** `GET /api/stats/player/:externalId` (`server/routes.ts:2236`) ya devuelve mucho más que PPG/RPG/APG — prácticamente todo lo que `PlayerRealStats` necesita como valor crudo (ts%, eFG%, USG%, PIE, FT rate, etc.), con USG%/PIE ya verificados contra las fórmulas de 10.3 bis. Y ya existe `GET /api/stats/player-percentiles` (`server/routes.ts:3174`), pero solo P95 de 7 métricas, sin el P50/P85 ni el agrupado por `base`/`alero`/`interior` que pide 10.2 bis (usa un match exacto del texto chino de posición, no los 3 grupos).

**Hallazgo nuevo, no anticipado:** `ReportSlidesV1.tsx` **ya resuelve un vínculo a U Stats hoy, en producción**, pero por fuera de motor-v1 por completo — `usePlayerWcbaLink`+`usePlayerDetail` alimentan un `StatsStrip` con PPG/3P%/FT Rate/TS% crudos (sin percentil, sin shrinkage), en paralelo a `capa3` (que sigue vacío). Fase 2 no es solo "rellenar un campo" — incluye decidir si `StatsStrip` se retira en favor de `statsDestacados` una vez exista, o coexisten (marcado `[A VALIDAR CON PABLO]`, no se retira sin más en la implementación).

**Contradicción real encontrada en 15.5:** el ejemplo de "porque" que da la spec (*"finaliza 61% mejor por derecha"*) no es implementable — el PBP de la WCBA no tiene splits por mano/dirección (ya lo decía 5.3, pero el ejemplo concreto de 15.5 lo contradecía sin que se notara hasta ahora). El "porque" real tiene que citar una métrica agregada de temporada (TS%/USG%/3P%...), no una comparación direccional.

**No existe `wcba_external_id` en `players`** (confirmado por grep) — el vínculo sigue por nombre en caliente vía `player-link`, tal como documenta 5.2.

### 24.2. Decisión de arquitectura

**No se toca la pureza de `motor-v1.ts`** (principio de sección 4: testeable con Vitest sin red). El enriquecimiento con Nivel 2 vive en una capa nueva, posterior al cálculo puro — mismo patrón que ya usa hoy `ReportSlidesV1.tsx` de facto con `StatsStrip`, ahora centralizado:

1. **SQL**: extender `/api/stats/player-percentiles` para devolver P50/P85/P95 de las 9+ métricas de 10.2 bis/10.3 bis agrupadas por `base`/`alero`/`interior` (mapeo de posición-chino→grupo nuevo, no existe hoy en ningún sitio del código) + una fila de `tovPct` recalculada (Nota 6 de 14.2 bis: el "TOV/partido" de 10.1 es un conteo bruto, no la tasa normalizada del contrato — no reusar el número estático). Recalculado en vivo contra `season_id=2092` (mismo que 10.1-10.3 bis), no congelado como constante.
2. **Endpoint nuevo** `GET /api/stats/player-nivel2-context/:externalId` — combina crudo (paso existente) + breakpoints del paso 1 + contracción bayesiana (calculada en TS en el handler, no en SQL) + ventana "últimos 12 partidos" (12.4).
3. **`motor-v1-stats.ts`** (nuevo, puro, mismo patrón que `motor-v1-archetype.ts`) — funciones de enriquecimiento que combinan `PlayerRealStats` ya resuelto + `ScoutingReportV1` + `EnrichedInputs` auxiliar: `capa3`, `statsDestacados`/`quietEdge`, `DiscrepanciaNivel1Nivel2`, `porque` por output, `confianza` real. No hace fetch — función pura, testeable sin red.
4. **Capa de fetch/orquestación** (React Query) conecta el endpoint del paso 2 con la función del paso 3, en `ReportSlidesV1.tsx`.

### 24.3. Fórmulas cerradas (no a decidir de nuevo por El Aparejador)

- **Contracción bayesiana (12.3):** pseudo-cuentas, `valorContraído = (volumenIntentos·valorObservado + k·mediaGrupo) / (volumenIntentos + k)`. `k` = mitad del umbral mínimo de confianza que ya usa 10.1/10.2 bis para esa métrica (3P%/FT%: k=20 intentos; eFG%/TS%: k=25 tiros; el resto: k=8 partidos).
- **Percentil:** interpolación lineal a trozos sobre los 3 puntos reales P50/P85/P95 del grupo, aplicada tanto al valor observado como al contraído.
- **Discrepancia Nivel 1/2:** mapeo cerrado de 3 señales (iso/pnrHandler/post todas N/R vs. USG% alto; ninguna situación primaria vs. PPG alto; spotUp nunca vs. 3P% alto), umbral P85 + volumen sobre el trust-floor de esa métrica.
- **Quiet edge:** solo `tipo: "estadistico"` en esta pasada (no hay agregado real de Nivel 1 de otras jugadoras para medir "típico cualitativo", 21.5) — de las métricas con percentil ajustado ≥70 no ya en `statsDestacados`, filtradas por una tabla fija de "atípico para el grupo" (base: rpg/bpg; alero: apg; interior: apg/fg3Pct, tomada de los propios ejemplos de 10.2 bis).
- **`porque`:** plantilla `"{instrucción} — {métrica} real: {valor} (P{percentil} en su posición)"`, métrica elegida según `situacionOrigen`, umbral percentil ajustado ≥70.
- **`confianza`:** alta si Nivel 1 real (frecuencia de campo *Freq directo, no aproximación) sin discrepancia, o Nivel 2 con volumen suficiente sin discrepancia y coherente; media si solo una fuente sólida o discrepancia sin resolver (tope, nunca "alta" con contradicción abierta); baja si ninguna.

### 24.4. Fuera de alcance de esta fase

ORTG/DRTG individual (ya descartado, 10.3 bis); autorrelleno `ftShooting`/`foulDrawing` desde proxy (15.4, es de captura no de lectura); `quietEdge` cualitativo; migración de esquema `wcbaExternalId` + UI de confirmación (recomendado, condicionado a validación de Pablo — pregunta 1 de sección 11); el ejemplo literal de "porque" con split de mano/dirección de 15.5 (no implementable, sustituido por 24.3).

**Siguiente paso real:** implementar en el orden de 24.2 (SQL → endpoint → `motor-v1-stats.ts` → integración), verificando cada paso contra la Supabase de producción real (236 jugadoras de stats reales existen, aunque el scouting siga vacío).

### 24.5. Backend + módulo puro cerrados, integración en UI pendiente (2026-09-13)

Implementados los 2 primeros pasos de 24.2 completos, más el 3º (el módulo puro), verificados contra la Supabase de producción real antes de escribir código:

1. **SQL verificado carácter a carácter contra 10.2 bis/10.3 bis antes de escribir el endpoint.** Corrido a mano contra Supabase (`ybpzvkkxcmwwxrrouyhm`): la metodología exacta (season_id=2092, **todas las fases, sin filtrar phase_type** — a diferencia del resto de endpoints de este archivo, así se calculó la tabla original) reproduce los números ya cerrados a 2 decimales: PPG/RPG por grupo idéntico a 10.2 bis (n=78 base/79 alero/50 interior, exacto), USG%/PIE por grupo idéntico a 10.3 bis. Confirma que el mapeo de posición (texto chino → base/alero/interior) y las fórmulas replicadas son correctas antes de comprometerlas a código.
2. **`GET /api/stats/player-nivel2-context/:externalId`** (nuevo, `server/routes.ts`) — combina valor crudo de temporada de la jugadora (ppg/rpg/apg/spg/bpg/tovPct/tsPct/eFGPct/fg3Pct/ftPct/ftaRate/usgPct/pie) + breakpoints P50/P85/P95 de su grupo de posición. **Deliberadamente NO se tocó `/api/stats/player-percentiles`** (el endpoint que ya existía): tiene callers reales en producción (`Stats.tsx`, `StatsRadar.tsx`) con semántica de match exacto de texto de posición — extenderlo arriba de esa semántica habría arriesgado ese flujo por un beneficio que un endpoint nuevo consigue igual de bien sin tocarlo. Desviación menor del plan original de El Arquitecto (que sugería extender el existente) por una razón real de compatibilidad que el plan no había verificado.
3. **`motor-v1-stats.ts`** (nuevo, puro, sin red) — implementa las 6 fórmulas cerradas de 24.3: `shrinkValor` (contracción bayesiana), `percentilPorInterpolacion` (interpolación lineal a trozos, con extrapolación explícita y documentada cuando falta P95 — nunca un P95 inventado en la capa de datos), `construirPlayerRealStats` (degradación elegante: `capa3` completo o `undefined` entero, nunca a medias), `seleccionarStatsDestacados`/`seleccionarQuietEdge` (quiet edge limitado a `tipo: "estadistico"`, tal como decidió El Arquitecto), `detectarDiscrepancias` (mapeo cerrado de 3 señales), `generarPorque` (cita métrica agregada real, nunca el ejemplo de split direccional de 15.5 que no es implementable), `confianzaConNivel2`. Orquestador `enriquecerReporteConNivel2()` combina todo sobre un `ReporteModoCompletoV1` ya ensamblado, sin mutar el original.
4. **`useNivel2Context()`** (nuevo, `stats-api.ts`) — el único punto de fetch, hace de puente entre el endpoint y el módulo puro.

**37 tests nuevos** (`motor-v1-stats.test.ts`), incluida una regresión real encontrada por el propio test: un `usgPct` de 26 con solo 20 partidos de volumen se contrae (k=8) a un percentil de ~83, por debajo del umbral de discrepancia de 85 — el primer intento del test asumía (mal) que dispararía, y no lo hacía; el código estaba bien, el fixture del test estaba mal calibrado. Corregido subiendo el fixture a un valor que sí atraviesa el umbral tras la contracción, con una aserción explícita que lo confirma antes de probar la conclusión real del test.

**Deliberadamente NO hecho en esta pasada — marcado `[A VALIDAR CON PABLO]`, no producto todavía:** `ReportSlidesV1.tsx` no llama a `useNivel2Context()`/`enriquecerReporteConNivel2()` — no se muestra `capa3`/`statsDestacados`/`quietEdge`/`porque` en ninguna pantalla real todavía, y no se ha decidido si `StatsStrip` (el vínculo a U Stats que `ReportSlidesV1.tsx` ya tenía por fuera de motor-v1, hallazgo de 24.1) se retira o coexiste. Backend y módulo puro están completos, probados, y no cambian nada de lo que un entrenador ve hoy — cero riesgo de producción en este commit, a diferencia de PR-B (23.8).

Verificado: `npm run check`/`check:tests` limpios, `npx vitest run` 205/205 reales (mismo fallo preexistente no relacionado), `npm run motor:compare` 0 divergencias (esta fase no toca cálculo puro de motor-v1.ts).

### 24.6. Integración en UI — cerrado (2026-09-14)

Pablo eligió la opción recomendada: cablear `capa3` en `ReportSlidesV1.tsx` y retirar `StatsStrip`. Implementado:

- `usePlayerWcbaLink` (resuelve nombre → `externalId`, sin cambios) + `useNivel2Context(externalId)` reemplazan a `usePlayerDetail`. `enriquecerReporteConNivel2()` se aplica sobre el reporte ya ensamblado, antes de `renderReportV1()` — si no hay vínculo WCBA (o todavía está cargando), el reporte vuelve exactamente igual, sin capa3 (Nivel 2 es contexto opcional, nunca obligatorio, spec 5.1).
- `StatsStrip` (PPG/3P%/FT Rate/TS% crudos) retirado, sustituido por `StatsDestacadosRow` (chips "{métrica} {valor}", formato de 10.3 ter — 1-3 palabras, solo métrica+valor, con "top X% / Destacado / Élite" como texto secundario siempre visible debajo, no oculto tras un tap) y `QuietEdgeCallout` (el dato inesperado para su posición, con marco punteado distinto). Presentes en Slide 0 (hasta 3 chips) y en modo sencillo (1 chip, el más extremo — `statsDestacados` ya viene ordenado por percentil descendente, `.slice(0,1)` basta).
- **`quietEdge` usa la posición REAL de la jugadora** (`identidad.posicion`, base/alero/interior de motor-v1) para la tabla de "atípico", no el `posicionGrupo` del contexto de Nivel 2 — son conceptualmente el mismo valor en producción (ambos vienen del mismo mapeo de posición), pero la separación de responsabilidades es correcta: la comparación estadística usa el grupo de percentiles, "qué es raro para su posición" usa la posición del contrato de identidad.

**Verificación manual, no solo tests:** inspección con 3 perfiles reales del fixture (Luka/base, Klay/alero, Draymond/interior) contra un contexto de Nivel 2 sintético — confirmó que Draymond (interior) con 41% en triples sale correctamente como quiet edge ("dato inesperado para un interior"), que Klay (apg ya destacado) NO repite apg como quiet edge (principio anti-P2), y que `porque` se omite limpiamente (`undefined`, no un texto forzado) cuando la `situacionOrigen` del output no tiene proxy de Nivel 2 razonable (ej. `pnrRollMan`).

Verificado: `npm run check`/`check:tests` limpios, `npx vitest run` 205/205, `npm run motor:compare` 0 divergencias.

**Fase 2 cerrada de punta a punta:** SQL → endpoint → módulo puro → UI real, con `StatsStrip` retirado.

### 24.7. `porque` visible en la UI — cerrado (2026-09-14)

Último pendiente pequeño de 24.6: `porque` ya se calculaba (`capa2.deny/force/allow.ganador.porque`) pero no se mostraba en ningún sitio. Añadido como línea secundaria en cursiva bajo la instrucción, en las 3 tarjetas de Slide 2 (deny/force/allow) y bajo "Prioridad defensiva" en modo sencillo.

**Regla real, no solo estética:** `porque` se oculta cuando hay un override `"replace"` activo para ese campo — pertenece a la recomendación original del motor sobre el `ganador`, no a la alternativa que un entrenador eligió a mano (esa no tiene `porque` calculado; mostrar el `porque` del ganador junto al texto de una alternativa distinta sería mezclar la justificación de una recomendación con el texto de otra). `porqueDelGanador()` comprueba `overrides` antes de devolver el texto.

Verificado: `npm run check`/`check:tests` limpios, `npx vitest run` 205/205, `npm run motor:compare` 0 divergencias.

## 25. Hallazgo real, no resuelto — dos rutas jugadora distintas a dos motores distintos, y sin gate de aprobación en la migrada (2026-09-14)

> Encontrado buscando qué más consumía `motor-v4`/`motor-v2.1` fuera de `ReportSlidesV1.tsx` (para valorar el resto de Fase 3 del roadmap, sección 8). No es una pregunta de "qué construyo después" — es un hallazgo sobre lo que YA existe en producción, sin decidir ni tocar código todavía.

**[VERIFICADO]** Hay dos rutas jugadora distintas que muestran el scouting de una rival, y no coinciden:

1. **`/player` → `PlayerTeamList` → `/player/team/:teamId` (`PlayerTeamView`, en `pages/player/Dashboard.tsx`) → clic en una jugadora → `/player/report/:id` → `ReportSlidesV1`.** Esta SÍ es la ruta migrada a Motor 1.0 (PR-B, sección 23.8).
2. **`/player/reports` → `PlayerHome.tsx` (rejilla de informes vía `usePlayerHome()`, por `assignmentId` — la tabla `scouting_report_assignments` ya mencionada en memoria del proyecto) → clic en un informe → `/player/${opponentPlayerId}` → `Profile.tsx` (`pages/player/Profile.tsx`, 1173 líneas).** Esta ruta usa `generateProfile()` de `mock-data.ts` — un TERCER motor, distinto de `motor-v2.1`/`motor-v4`/`motor-v1`, con su propia lógica de `isoDanger` y su propia capa de traducción (`translateMotorOutputLine`), nunca auditado ni tocado en ninguna sesión de Motor 1.0. Es exactamente lo que la sección 8 (roadmap) ya señalaba como pendiente de Fase 3 ("se retira... la parte de `generateProfile`/`isoDanger` de `mock-data.ts`") — confirmado que sigue vivo y en uso real, no es papel.

**[VERIFICADO, el hallazgo más importante de los dos]** La ruta migrada (`/player/report/:id` → `ReportSlidesV1.tsx`) **no comprueba ningún estado de publicación/aprobación** — ni en el componente (sin referencia a `isPublished`/`publishedAt` en `ReportSlidesV1.tsx`/`mock-data.ts`) ni en el endpoint que consume (`GET /api/players/:id`, `server/routes.ts:372-380`, sin ningún filtro por rol ni por `published`). Cualquier usuaria autenticada con rol `player` puede navegar a `/player/report/:id` con cualquier ID de jugadora y ver el reporte crudo generado por el motor en tiempo real — **el flujo completo de edición privada → propuesta → discrepancias → aprobación → publicación (sección 17.1, la pieza central que motivó el picker de alternativas de la sección 22 y el sistema de overrides) no se aplica en esta ruta**. `PlayerHome.tsx`/`Profile.tsx` sí pasan por `usePlayerHome()`/`assignmentId` (probablemente sí respeta el estado de asignación/publicación, no verificado a fondo todavía) pero ese es el camino que usa el motor viejo sin auditar.

**No sé, y no lo asumo:**
- Si `/player` (navegación libre por equipo→roster) es un flujo intencional distinto de "mis informes asignados" (ej. herramienta de preparación previa sin gate, a propósito) o un descuido de cuando se construyó sin el sistema de aprobación en mente.
- Si `usePlayerHome()`/`Profile.tsx` de verdad respeta `scouting_report_assignments`/publicación (parece que sí por diseño, no confirmado línea a línea).
- Qué se supone que pase con `Profile.tsx` en el roadmap — ¿se retira y todo pasa por `ReportSlidesV1`, se migra su lógica, o se mantiene como una vista distinta a propósito?

**No he tocado código de este hallazgo.** Es una decisión de producto y de seguridad de datos (qué ve una jugadora y cuándo) que le corresponde a Pablo, no una que deba asumir yo — mismo criterio que motivó preguntar por el conflicto de la sección 13.3 al principio de esta fase.

### 25.1. Investigado a fondo y cerrado el hueco real de autorización (2026-09-14)

> Pablo: *"haz lo más consecuente para los objetivos que queremos"*. No es una respuesta a las preguntas de arriba (siguen sin decidir) — es un mandato a usar criterio propio. Se investigó más a fondo antes de tocar nada, y se encontró que la situación real es menos grave de lo que el hallazgo inicial sugería en un eje, y hay un hueco real y concreto en otro.

**[VERIFICADO] El acceso SÍ está scopeado por `scoutingReportAssignments` en las dos rutas de navegación real, no es un browse-anything abierto:**
- `/player` → equipo → roster usa `usePlayerTeamDetail()` → `GET /api/player/team/:teamId` → `storage.listAssignedPlayersInTeamForUser()` — solo jugadoras con asignación real.
- `/player/reports` usa `usePlayerHome()` → `GET /api/player/home` → `storage.listScoutingReportsForUser()` — mismo concepto de asignación.

Es decir: las dos rutas (la migrada a Motor 1.0 y la del motor viejo) respetan el mismo gate de asignación a nivel de navegación — el problema no era "cualquier jugadora ve cualquier informe navegando la app".

**[VERIFICADO] El hueco real es más pequeño y más concreto: `GET /api/players/:id` (el endpoint que `usePlayer()` llama de verdad para traer los datos completos, usado tanto por `ReportSlidesV1.tsx` como por `Profile.tsx`) no comprobaba la asignación en absoluto** — clase IDOR: alcanzable solo manipulando la URL/red directamente con el id de una jugadora no asignada (no expuesto por ningún botón/link real de la navegación normal), pero real. **Corregido**: cuando `req.user.role === "player"`, se exige `storage.userHasScoutingReportAssignment()` (el mismo helper que ya usaba `/api/player/views` desde antes) — 403 si no está asignada. Coach/head_coach/master sin cambios.

**Verificado antes de tocar el endpoint, no asumido:**
- Los 4 consumidores reales de `usePlayer()` (`ReportSlidesV1.tsx`, `ReportViewV4.tsx`, `Profile.tsx`, `PlayerEditor.tsx`) revisados uno a uno — ninguno rompe: `PlayerEditor.tsx` es de uso exclusivo de coach; `ReportViewV4.tsx` con `mode="player"` no tiene ninguna ruta real en `App.tsx` que lo monte así (dead prop, no se usa hoy); `ReportSlidesV1.tsx`/`Profile.tsx` son exactamente los dos casos que ya pasan por el gate de asignación en la navegación normal.
- `scouting_report_assignments` (columnas `user_id`/`player_id`/`created_by`/`created_at`) y `users.role` (`"coach"`/`"player"`/`"master"`, exacto) verificados contra el esquema real de Supabase antes de escribir la condición.

**Lo que se deja explícitamente sin decidir, sigue siendo de Pablo:**
- `POST /api/report-assignments` (el endpoint con el que un coach comparte un informe) no exige ningún estado de aprobación/publicación antes de poder asignar — un solo entrenador puede compartir un borrador sin pasar por discrepancias/aprobación multi-entrenador (sección 17.1). Si esto debe cambiar (exigir aprobación antes de poder asignar) es una decisión de flujo de trabajo real, no una que se pueda inferir del código — no tocado.
- El tercer motor (`generateProfile()`/`Profile.tsx`) sigue vivo y sin auditar. Retirarlo, migrarlo, o dejarlo así sigue siendo una decisión de alcance (Fase 3 del roadmap) — no tocado en esta pasada, el hueco de seguridad que sí era claramente "consecuente con los objetivos" arreglar ya está cerrado independientemente de qué motor calcule el contenido.

Verificado: `npm run check` limpio (sin tests de servidor en este proyecto — ningún archivo `*.test.ts` bajo `server/`, verificado por `find`; la verificación aquí es por lectura cuidadosa + comprobación directa del esquema real, no por test automatizado).

## 26. Limpieza de arqueología + gate de publicación real + permiso delegable — cerrado (2026-09-14)

> Pablo, respuesta directa a la sección 25: *"eliminaremos todo la arqueológica de código que no sea necesaria... sobre cuántos entrenadores son necesarios para aprobar un informe, uno... cíñete a las especificaciones... U Scout en 'My Club' [debería tener] un botón para que este último paso lo haga solo el head coach o pueda dar permisos a otros coaches."* Delegado en El Arquitecto el inventario y el diseño antes de tocar código (mismo patrón que 21.7/23/24).

### 26.1. Hallazgo central de El Arquitecto — el botón real de publicar no es el que la spec asumía

**[VERIFICADO]** `POST /api/players/:id/publish` (`server/routes.ts`) ya implementaba correctamente el gate de ≥1 aprobación (spec 17.1 paso 4) — pero **nada de la UI lo llama** (`usePublishReport()` está definido, cero usos). **El botón real que un entrenador pulsa ("→ Game Plan" en `FilmRoom.tsx`) llama a `POST /api/players/:id/game-plan`**, que hace la auto-asignación masiva a todas las jugadoras del club y **no comprobaba ni aprobación ni permiso**. Corrección de precisión sobre la sección 25.1: el endpoint a arreglar no era `/report-assignments` (sin callers reales), era `/game-plan`.

**[VERIFICADO]** `ReportViewV4.tsx` (que la sección 25 podía leerse como código sospechoso) **no es arqueología** — es el wrapper real de revisión de coach (`/coach/scout/:id/review`), enlazado desde 5 pantallas reales. No se toca.

### 26.2. Gate de aprobación + permiso, implementado

- `POST /api/players/:id/game-plan` y `POST /api/report-assignments` (este último sin callers hoy, arreglado igual por disciplina — si algún día se cablea, no debe reabrir el hueco) ahora exigen: **≥1 aprobación registrada** (mismo chequeo que ya tenía `/publish`, copiado literal) **y** permiso de club para publicar.
- Permiso nuevo, delegable — `reportPublishAccess` en `club_members`, **mismo patrón exacto que `operationsAccess`** (ya construido y en producción para "quién gestiona Personnel/Wellness/Schedule"): columna nueva (migración `0005`, aplicada directamente contra Supabase de producción — `ALTER TABLE ... ADD COLUMN IF NOT EXISTS`, aditiva, sin downtime), `canToggleReportPublishAccess()` (`clubMemberPermissions.ts`, solo head_coach/master delegan, nunca sobre sí mismos ni sobre otro head_coach), `canPublishReports` en `capabilities.ts` (head_coach/master siempre; coach solo con el badge), endpoint `PATCH /api/club/members/:id/report-publish-access`, hook `useSetClubMemberReportPublishAccess()`.
- UI en `ClubManagement.tsx` ("Mi Club"): segundo toggle junto al badge "PREP" (preparador físico) ya existente, con su propio badge "PUBLICAR"/"PUBLISH"/"发布权限" — mismo componente `MemberRow`, mismo patrón visual.
- `FilmRoom.tsx::handlePublish()`: antes fallaba en silencio (solo rollback optimista). Ahora distingue el mensaje real ("hace falta ≥1 aprobación" / "no tienes permiso, pídeselo al head coach") en vez de un fallo mudo.

**Explícitamente sin tocar:** el flujo de 4 pasos de la sección 17 (edición → propuesta → discrepancias → ≥1 aprobación → publicación) no se rediseña, solo se cierra el cableado que faltaba. `/unpublish` (retirar un informe ya publicado) se queda restringido a head_coach/master a propósito — no se extendió al nuevo permiso delegable, es una acción más destructiva que publicar y no fue lo que se pidió.

### 26.3. Limpieza de arqueología — plan de El Arquitecto, ejecutado por bloques

**Bloque B, ya hecho (riesgo cero, verificado con grep antes de borrar cada uno):**
- `client/src/pages/scout/Dashboard.tsx` (`CoachDashboard`) — cero importadores en todo el repo.
- `overrideEngine.ts::applyOverrides()` (legacy, no la V1) — cero callers.
- Prefetch muerto de `@/lib/motor-v4` en `useHomeData.ts`.

**Bloque C (`Profile.tsx`) y Bloque D (`QuickScout.tsx`/`PlayerEditor.tsx`/`generateProfile()`), pendientes, plan ya cerrado por El Arquitecto, no ejecutados en esta pasada:**
- `Profile.tsx` (1173 líneas): recomendación decidida es **retirar, no reescribir** — `/player/:id` puede montar `ReportSlidesV1` directamente (mismo patrón que `/player/report/:id`), y `/coach/player/:id/profile` (sin enlaces reales) se elimina sin más. Pendiente `[A VALIDAR CON PABLO]` menor: si las hojas de alternativas de deny/force/allow/situación deben ocultarse del todo en modo jugadora (hoy son visibles-pero-no-elegibles también en `ReportSlidesV1`, comportamiento a confirmar que es el deseado antes de dar la migración por completamente cerrada).
- `generateProfile()`/`isoDanger` de `mock-data.ts`: **no es un preview en vivo** (corrección real de El Arquitecto sobre la premisa inicial) — se persiste en cada guardado (`QuickScout.tsx`, `PlayerEditor.tsx` ×2) y lo leen 2 pantallas más (`MyScout.tsx::hasRealArchetype`, la tarjeta de `ScoutDesktop.tsx`). Requiere migrar esos 2 lectores primero (a un criterio basado en `inputs`/a `ensamblarReporte()`+`motor-v1-archetype`, mismo patrón que el semáforo de `Personnel.tsx`, spec 23.9) antes de poder quitar los 3 puntos de guardado.
- `motor-v4.ts`/`motor-v2.1.ts`/`reportTextRenderer.ts` (legacy): **no son arqueología retirable todavía** — `motor-v2.1.ts` es el núcleo calibrado que `motor-v1.ts` sigue usando en tiempo de ejecución (spec sección 3, no se toca nunca); `motor-v4.ts`/`reportTextRenderer.ts` (legacy) siguen como referencia de aceptación en 2 archivos de test (`motor-v1-acceptance.test.ts`, `closeoutThreat.test.ts`) y `reportTextRendererV1.ts` reutiliza ~600 líneas de sus helpers a propósito (spec 23.7) — retirarlos exige separar esos helpers a un archivo compartido nuevo primero. Fase 3 real.

Verificado (Bloque A + B, lo implementado hoy): `npm run check`/`check:tests` limpios, `npx vitest run` 205/205. Migración `0005` aplicada y confirmada contra el esquema real de Supabase antes de escribir código contra ella.

## 27. Hallazgo crítico y cerrado — el gate de aprobación de la sección 26 no tenía ningún botón real para aprobar (2026-09-14)

Al retomar el trabajo tras verificar el deploy de la sección 26 (limpio, sin errores de arranque), se continuó con el Bloque C planeado (retirar `Profile.tsx`). Antes de tocarlo, verificación de rutas reales (disciplina de "grep antes de borrar") reveló algo mucho más importante que el propio Bloque C.

**[VERIFICADO] `ApprovalBar` (el único componente cliente que llama a `POST /api/players/:id/approve`) solo se montaba en `/coach/player/:id/profile`** (`Profile.tsx`, condicionado a `isReviewMode && paramsCoach`) — y esa ruta **no tiene ningún enlace real en toda la app**: los 8 sitios reales que navegan a un jugador de equipo propio (`MyScout.tsx` ×5, `Personnel.tsx`, `QuickScout.tsx` ×2) van todos a `/coach/player/${id}` (sin `/profile`, que monta `PlayerEditor`), nunca a `/coach/player/${id}/profile`. Confirmado con grep exhaustivo (`coach/player`, variantes de template string) sobre todo `client/src`.

**[VERIFICADO contra Supabase de producción] `report_approvals` tiene 0 filas, siempre** (`select count(*) from report_approvals` → 0). No es una regresión de hoy — nunca ha existido una vía real para que un entrenador apruebe un informe. La sección 26 (desplegada hoy, `f6a4b59`) añadió un gate que exige `≥1` fila en esa tabla antes de publicar — **con cero vías reales para crear esa fila, el gate bloqueaba publicar para cualquiera**, desde el momento del deploy.

**Corregido de inmediato, no esperado a la siguiente confirmación de Pablo** — la severidad (función central rota para todos los usuarios) lo justifica bajo el mismo criterio que "haz lo más consecuente para los objetivos que queremos": se localizó el punto de integración correcto ya existente pero incompleto — `ReportViewV4.tsx` (`/coach/scout/:id/review`, la pantalla real de revisión, enlazada desde `FilmRoom.tsx::onViewReport`) ya leía `useApprovalStatus` para `overrides`/discrepancias pero nunca exponía el botón de aprobar. Se añadió ahí, reutilizando literalmente la lógica ya construida y probada de `ApprovalBar` (`useApproveReport`/`useUnapproveReport`, mismas claves i18n ya existentes en los 3 locales — no hacía falta ninguna nueva): contador `N/M aprobado`, badge de discrepancia, botón Aprobar/Aprobado ✓, mismos toasts de error.

Flujo real ahora completo: `FilmRoom.tsx` (lista, "Staff approved: N") → tocar jugadora → `/coach/scout/:id/review` (`ReportViewV4`, ahora con el botón real de aprobar) → volver a `FilmRoom.tsx` → "→ Game Plan" ya no falla si hay ≥1 aprobación.

**No tocado, deliberadamente:** `ApprovalBar.tsx`/`Profile.tsx` en sí — quedan para el Bloque C ya planificado (retirar `Profile.tsx` por completo, ruta muerta incluida); no había motivo para tocarlos en esta corrección urgente, que solo necesitaba un punto de entrada real ya existente.

**Hallazgo secundario, no bloqueante:** `npx vitest run` reporta 1 suite fallida (`capabilities.test.ts`, "window is not defined") — no relacionado con este cambio ni con la sección 26: es un hueco preexistente de configuración de entorno (ningún `vitest.config`/docblock declara `jsdom`; ese archivo es el único test que importa transitivamente `useAuth.ts` → `queryClient.ts`, que toca `window` al cargar el módulo). Las 205 pruebas reales siguen pasando. Marcado para limpieza aparte, no corregido aquí para no mezclar con el fix urgente.

Verificado: `npm run check`/`check:tests` limpios, `npx vitest run` 205/205 (aparte del hueco de entorno preexistente arriba).

## 28. Auditoría desktop/iOS del pipeline de informes (3 fases: canónica → armonizada → aprobada) — El Arquitecto + implementado (2026-09-14)

Encargo de Pablo: *"revisión y si es necesario diseño para desktop e iOS de los menús botones y todo el posible flujo del módulo STATS incluyendo esas tres fases de aprobado y armonización de los reports. desde lógica a UI/UX, todo el trabajo y revisión."*

**Aclaración de alcance, verificada, no asumida:** en el vocabulario propio del proyecto (sección 24), "U Stats" es la integración de estadísticas reales dentro de los informes de scouting — no el placeholder `/stats` del roadmap (KPIs de temporada, sin relación). El Arquitecto confirmó por lectura de código que no hay ningún vínculo real entre `/stats` y el pipeline de informes. El encargo se interpretó y auditó como el pipeline completo de informes (edición → propuesta → armonización → aprobación → publicación → vista jugadora), no el placeholder.

### 28.1. Hallazgos de la auditoría, por severidad

**[CRÍTICO] `ReportSlidesV1.tsx` no seguía la regla de scroll del proyecto (CLAUDE.md) — riesgo real de que el propio botón de aprobar de la sección 27 quedara inalcanzable en un informe largo.** Su raíz usaba `style={{ minHeight: "100svh" }}` en vez de una altura acotada, montado dentro del wrapper fijo `h-[100dvh] overflow-hidden` de `App.tsx` sin ningún `overflow-y-auto` intermedio — si una diapositiva + `bottomBar` (aprobación/OverridePanel en `coachMode`, añadidos en la sección 27) superaba el viewport, el excedente quedaba recortado e invisible, no scrolleable. Comparación reveladora: `Profile.tsx` (el motor legacy que se va a retirar) sí tenía el patrón correcto — la pantalla nueva que lo sustituye tenía peor blindaje de scroll que la que reemplaza. Nunca detectado porque, como ya admite la spec repetidamente (21.5, 23.5, 23.8), el flujo completo no se había ejercitado con datos reales de producción en un dispositivo real.

**[IMPORTANTE] `MyScout.tsx` (la pantalla que un coach revisa más a menudo) no tenía ninguna señal de en qué fase está un informe** — solo distinguía "sin rellenar" / "con datos", nunca borrador privado vs. enviado a Film Room vs. aprobado. El dato ya existía en el servidor (mismo shape que `/api/film-room`).

**[IMPORTANTE] El toggle de `reportPublishAccess` en "Mi Club" (la función que Pablo pidió explícitamente en la sección 26) estaba enterrado en un menú de 3 puntos sin ninguna señal visible de que existiera antes de abrirlo** — el badge "PUBLICAR" solo aparecía después de concederse, nunca como pista previa.

**[MENOR]** `/coach/scout/:id/preview` (`CoachScoutReportPreview`, `App.tsx`) sin ningún enlace real — mismo patrón exacto que el hallazgo ya cerrado de la sección 27. `PlayerEditor.tsx` con el mismo riesgo de scroll que el hallazgo crítico (mecanismo idéntico, menor probabilidad de manifestarse). Tipografía `text-[10-11px]` sin variante `md:` en `OverridePanel.tsx` (nunca pasó por el barrido de CLAUDE.md) y en partes de `FilmRoom.tsx` añadidas después de esa pasada (`DiscrepancyPanel`, "Staff aprobado"). Objetivos táctiles por debajo de 44pt en los pills HIDDEN/VISIBLE de `OverridePanel.tsx` y las flechas prev/next de `ReportSlidesV1.tsx`. `PlayerHome.tsx` usaba `h-screen` en vez de `h-[100dvh]` (inconsistente con el resto del proyecto). CLAUDE.md tenía las clases del wrapper de `App.tsx` desactualizadas (`md:pl-16 lg:pl-56` documentado vs. `md:pl-12 lg:pl-48` real).

**Validado como correcto, no un hueco:** el layout ancho (`max-w-5xl mx-auto` consistente en `FilmRoom`/`GamePlan`/`MyScout`/`Personnel`), el badge de discrepancias ya visible en la fila colapsada de `FilmRoom.tsx` antes de expandir, y el `Lock` anti-sesgo que oculta el panel de discrepancias hasta que el propio coach entrega su versión (decisión de diseño intencional, no un bug).

### 28.2. Implementado

- **`ReportSlidesV1.tsx`**: raíz `style={{minHeight:"100svh"}}` → `h-[100dvh] overflow-hidden` (mismo patrón que `Profile.tsx`), `<main>` con `min-h-0` añadido. `PlayerEditor.tsx`: mismo `min-h-0` añadido a su `<main>`.
- **`MyScout.tsx`**: nuevo badge de fase junto al nombre de cada jugadora canónica ("Borrador"/"En Sala de análisis"/"Aprobado"), alimentado por `/api/film-room` (mismo endpoint que ya usa `FilmRoom.tsx`, sin cambios de servidor). Nota: los informes ya publicados no aparecen en `MyScout.tsx` (se filtran antes, van a Game Plan), así que no hace falta un cuarto estado "Publicado" aquí.
- **`ClubManagement.tsx`**: los toggles de `operationsAccess`/`reportPublishAccess` en la fila de staff pasan de `DropdownMenuItem` oculto a botones directos siempre visibles (mismo patrón que ya usaba la variante "player" de la fila) — el menú de 3 puntos queda solo para quitar/banear (acciones más destructivas, ocultarlas a propósito sigue teniendo sentido).
- **`/coach/scout/:id/preview`** (`CoachScoutReportPreview`) retirado de `App.tsx` — sin enlaces reales, confirmado por grep antes de borrar.
- **Tipografía**: `md:text-sm`/`md:text-xs` añadido en `OverridePanel.tsx` (toggle, títulos de sección, labels de item) y en `FilmRoom.tsx` (`DiscrepancyPanel`, badge de estado, "Staff aprobado").
- **Objetivos táctiles**: pills HIDDEN/VISIBLE de `OverridePanel.tsx` envueltos en un botón de `min-h-11 min-w-11` (~44pt) sin cambiar el tamaño visual del pill; flechas prev/next de `ReportSlidesV1.tsx` de `w-10 h-10` a `w-11 h-11`.
- **`PlayerHome.tsx`**: `h-screen` → `h-[100dvh]`, consistente con el resto del proyecto.
- **`CLAUDE.md`**: clases del wrapper corregidas a las reales (`md:pl-12 lg:pl-48`, línea real ~459).

**No tocado, deliberadamente:** el flujo de descubribilidad entre el picker de alternativas y el panel hide/keep (hallazgo menor D.5 de la auditoría, ya es el pendiente #12 conocido de CLAUDE.md — su causa raíz queda documentada aquí, no se rediseña en esta pasada). El matiz de copy sobre qué mide el denominador "M" en "Staff aprobado: N/M" (hallazgo D.3, validado como correcto, no un hueco de UI).

**Pendiente de verificación visual real** (el hallazgo crítico se verificó por lectura de código y mecánica CSS de flexbox, no en un dispositivo real — ni El Arquitecto ni yo tenemos sesión autenticada de Supabase para ejercitar el flujo completo): confirmar en el simulador iOS o dispositivo real, con un informe largo en modo entrenador, que el scroll y el botón de aprobar son alcanzables.

Verificado: `npm run check` limpio, `npx vitest run` 205/205 (aparte del hueco de entorno preexistente de `capabilities.test.ts`, sección 27). Smoke test del build en servidor de desarrollo: arranca sin errores de consola en la pantalla de login (no se pudo verificar el flujo autenticado — entrar con contraseña no está permitido).

## 29. Bloque C cerrado — `Profile.tsx` retirado, las dos rutas jugadora convergen en motor-v1 (2026-09-14)

Continuación directa del plan de limpieza ya cerrado en la sección 26.3. El hallazgo de la sección 25 (dos rutas jugadora — `/player/reports` y `/player`→`/player/team/:id` — a dos motores distintos) queda cerrado: ambas usan ahora `ReportSlidesV1.tsx`/motor-v1.

- `/player/:id` (a donde navega `PlayerHome.tsx` desde `/player/reports`) monta ahora `PlayerOpponentReportRoute` (`App.tsx`), mismo patrón exacto que `PlayerReportV4Route` ya usado en `/player/report/:id` — mismo componente, mismos `overrides`, `onBack` a `/player/reports`.
- `/coach/player/:id/profile` retirado de `App.tsx` — confirmado sin ningún enlace real antes de borrar (mismo criterio que el Bloque B/hallazgo de la sección 27).
- `Profile.tsx` (1173 líneas, motor legacy `generateProfile()`/`clubRowToMotorContext`, sin auditar) eliminado por completo — confirmado cero importadores restantes tras quitar las dos rutas.
- Huérfanos directos de `Profile.tsx`, confirmados sin otros importadores antes de borrar, eliminados en el mismo commit: `components/ApprovalBar.tsx` (ya sin ningún uso real desde que la sección 27 movió el botón de aprobar a `ReportViewV4.tsx`) y `lib/translateMotorOutput.ts` (función de un solo uso, exclusiva de `Profile.tsx`).
- **Corrección real encontrada al limpiar, no solo borrado mecánico**: `ReportSlidesV1.tsx` marcaba vista de diapositiva con un `fetch` crudo a `/api/player/views`, duplicando sin su `onSuccess` lo que ya hacía `useRecordPlayerSlideView()` (`player-home.ts`, antes solo usado por el `Profile.tsx` retirado) — ese `onSuccess` invalida las queries `player-teams`/`player-team`, de las que depende `unseenCount` en `PlayerTeamList.tsx`. Con el fetch crudo, el badge de "pendientes" no se refrescaba al momento tras ver una diapositiva, solo en el siguiente refetch natural — un hueco menor pero real, presente desde la migración PR-A/PR-B (sección 23), nunca antes detectado. Corregido: `ReportSlidesV1.tsx` usa ahora el hook en vez del fetch crudo.

**Sigue abierto, no resuelto aquí — `[A VALIDAR CON PABLO]` de la sección 26.3**: si las hojas de alternativas deny/force/allow/situación deben ocultarse del todo en modo jugadora, en vez de visibles-pero-no-elegibles como hoy. No bloqueaba este bloque porque `/player/report/:id` ya tenía exactamente este mismo comportamiento en producción desde antes — converger `/player/:id` al mismo componente no cambia ese comportamiento, solo lo hace consistente entre las dos rutas.

**Bloque D (migrar los 2 lectores reales de `generateProfile()` -- `MyScout.tsx::hasRealArchetype`, tarjeta de `ScoutDesktop.tsx` -- antes de poder quitar sus 3 puntos de guardado en `QuickScout.tsx`/`PlayerEditor.tsx`) sigue pendiente, no tocado en esta pasada** — `generateProfile()`/`isoDanger` de `mock-data.ts` no se tocan todavía, sus otros llamadores siguen vivos.

Verificado: `npm run check` limpio, `npx vitest run` 205/205 (mismo hueco preexistente de `capabilities.test.ts`, sección 27, sin relación). Smoke test del build sin errores de consola en la pantalla de login.

## 30. Bloque D — los 2 lectores reales de `generateProfile()` migrados a motor-v1; los 3 puntos de guardado deliberadamente NO retirados todavía (2026-09-14)

Continuación del plan de El Arquitecto (26.3): antes de poder quitar los 3 puntos donde `QuickScout.tsx`/`PlayerEditor.tsx` llaman a `generateProfile()` (motor legacy) al guardar, había que migrar primero a sus 2 lectores reales para que no se rompieran al quedarse con datos obsoletos.

**Migrado:**
- **`MyScout.tsx::hasReportInputs`**: dependía de `player.archetype` (persistido por `generateProfile()`). Ahora ensambla con motor-v1 (`ensamblarReporte`) y comprueba si alguna situación real tiene `score > 0` — mismo criterio exacto que el semáforo de `Personnel.tsx` (spec 23.9).
- **`ScoutDesktop.tsx::ReportPreview`** (tarjeta de vista previa del informe en el panel derecho): `hasReport` y el bloque "Defensa principal" (antes `defensivePlan.defender/forzar/concede`, campos persistidos) ahora usan el informe real de motor-v1 (`ensamblarReporteParaTexto` + `renderReportV1`, mismo contrato que ya renderiza `ReportSlidesV1.tsx` — `defense.deny/force/allow.instruction`).

**Deliberadamente NO migrado, y por tanto los 3 puntos de guardado (`QuickScout.tsx:272-273`, `PlayerEditor.tsx:656,684-686`) tampoco se retiran todavía:** los chips "Arquetipo"/"Características clave" (`archetype`/`subArchetype`/`keyTraits`) de `ScoutDesktop.tsx` siguen leyendo los campos persistidos por `generateProfile()`. No tienen un equivalente 1:1 en motor-v1 hoy — eso es exactamente el trabajo todavía sin empezar de "iconografía de arquetipos" (sección 20 del roadmap). Inventar ese mapeo yo mismo sería una decisión de producto (qué debería decir el chip, qué conceptos de motor-v1 corresponden a "key traits") que no me corresponde asumir solo — mismo criterio aplicado toda la sesión. Como esos 3 campos siguen teniendo un lector real sin migrar, quitar quien los escribe rompería silenciosamente ese lector para cualquier jugadora nueva o reeditada a partir de ahora.

**Pregunta abierta para Pablo, no resuelta aquí:** ¿qué hacer con los chips de arquetipo/rasgos clave de `ScoutDesktop.tsx` — se abordan como parte del trabajo de iconografía de arquetipos (sección 20, dándoles un mapeo real desde motor-v1), o se simplifican/retiran de esa tarjeta para poder cerrar `generateProfile()` del todo? Cualquiera de las dos respuestas desbloquea terminar el Bloque D; sin ella, `generateProfile()`/`isoDanger`/`mock-data.ts` siguen vivos a propósito.

Verificado: `npm run check` limpio, `npx vitest run` 205/205 (mismo hueco preexistente de `capabilities.test.ts`). Smoke test del build sin errores de consola.

## 31. Hueco de test-infra cerrado — `capabilities.test.ts` nunca se había ejecutado, y tenía un fallo real escondido (2026-09-14)

Flaggeado sin resolver en las secciones 27/28/29/30 ("hueco preexistente de entorno"): `npx vitest run` reportaba `capabilities.test.ts` como fallido con `window is not defined`, 0 tests recogidos. Causa real: `useAuth.ts` importa `queryClient.ts`, que tocaba `window.addEventListener`/`navigator.onLine` a nivel de módulo sin guardia — cualquier test que lo importara transitivamente reventaba al cargar, en el entorno `node` por defecto de vitest (sin `jsdom` instalado). Ningún otro archivo de test del proyecto importa nada que llegue a `queryClient.ts`, por eso era el único afectado.

**Corregido con una guardia (`typeof window !== "undefined"`), no instalando `jsdom`** — mismo patrón ya usado en `App.tsx`, y además endurece el módulo de verdad ante cualquier entorno no-navegador, no solo ante los tests.

**Al arreglarlo apareció un fallo real, no de entorno**: `capabilities.test.ts` tenía 7 pruebas, nunca ejecutadas hasta ahora — 0 cobertura real de `computeCapabilities()` en todo este tiempo. Una de las 7 esperaba `canCreateEvent === true` para un coach raso sin `operationsAccess`, con el comentario *"coaches can still create sessions"* — contradice tanto el propio código (`canCreateEvent` exige `hasOperationsAccess` para un coach que no sea head_coach/master) como el test inmediatamente siguiente en el mismo archivo (que sí distingue explícitamente "coach CON `operationsAccess`" → `true`) y el consumidor real (`Schedule.tsx` gatea crear/editar/arrastrar sesiones con este mismo campo, consistente con el código). Corregida la aserción del test a `false` — el comportamiento en producción no cambia, solo se corrige la prueba para que refleje lo que el código (ya desplegado, ya consumido por `Schedule.tsx`) siempre hizo.

Verificado: `npm run check` limpio, `npx vitest run` **13/13 archivos, 212/212 pruebas** — primera vez que corre limpio sin ningún hueco de entorno en toda esta sesión. Smoke test del build sin errores de consola.

## 32. Bloque D cerrado — `generateProfile()` (motor legacy) retirado por completo (2026-09-14)

Respuesta directa de Pablo a la pregunta abierta de la sección 30 (chips de arquetipo en `ScoutDesktop.tsx`): *"Diseñar mapeo real desde motor-v1"*.

**[VERIFICADO] motor-v1 ya calculaba y ya mostraba en vivo exactamente esto — no hacía falta diseñar nada nuevo.** `motor-v1.ts::ensamblarReporte()` ya deriva `identidad.archetypeKey`/`archetypeModificador`/`archetypeConfianza` (spec 14.3 bis, detección de arquetipo con 2do eje de modificador excepcional, "armadora_creadora", "interior_poste", etc. — key space distinto y más rico que el legacy `arch_role_player`). `reportTextRendererV1.ts::renderIdentityV1()` ya renderiza eso en `identity.archetypeLabel` (etiqueta ya fusionada con el modificador, nunca un segundo chip, a propósito) y `identity.tagline` (una frase concreta y accionable por arquetipo, "más compacto que el `renderTagline` de motor-v4"). **`ReportSlidesV1.tsx` ya muestra ambos campos en producción** (slide 1, cabecera del informe) — la migración no era investigación nueva, era conectar un cable que ya existía.

### 32.1. Implementado

- **`ScoutDesktop.tsx::ReportPreview`**: los chips "Arquetipo"/"Características clave" (antes `player.archetype`/`subArchetype`/`keyTraits`, persistidos) ahora leen `rendered.identity.archetypeLabel`/`tagline` — mismo `ensamblarReporteParaTexto`+`renderReportV1` que ya se usa para el plan defensivo (sección 30). Cambio de forma a propósito: un solo chip de arquetipo (el modificador va fusionado en el label, spec 14.3 bis) en vez de dos; una frase (`tagline`) en vez de una lista de pills (`keyTraits`) — mismo patrón visual que ya usa `ReportSlidesV1.tsx`, no una invención nueva.
- **Los 3 puntos de guardado retirados**: `QuickScout.tsx::handleFinish()`, `PlayerEditor.tsx::runAutoSaveAttempt()` y `handleSave()` ya no llaman a `generateProfile()`. Al **actualizar** una jugadora existente, el guardado es un PATCH parcial (`insertPlayerSchema.partial()`, confirmado en `server/routes.ts`) — las columnas `archetype`/`key_traits`/`defensive_plan`/`internal_model` simplemente no se tocan, se quedan con lo último que tuvieran (arqueología inerte en la fila, no leída por nada). Al **crear** una jugadora nueva, `internal_model`/`defensive_plan` son `NOT NULL` sin default a nivel de DB (`shared/schema.ts`) — se sigue enviando un valor placeholder vacío (`defaultInternal`, ahora exportado desde `mock-data.ts`, y `{ defender: [], forzar: [], concede: [] }`), mismo valor que ya usaba `createDefaultPlayer()` desde siempre.
- **`generateProfile()` eliminado por completo de `mock-data.ts`**, junto con todo lo que solo él usaba, confirmado uno por uno por grep antes de borrar (ningún caller fuera del propio código que se borra): `GenerateProfileResult`, `danger()`, `motorOutputToRichText()`, `motorPlanCandidates()`, la familia completa de helpers `*I18nKey()` (mapeo de opciones de input crudo a claves de traducción de "key traits", exclusiva del cálculo de `generateProfile`), `postProfileTraitToken()`, `analyzeQuadrants()`, `isNeverRare`/`isNever`. Imports ahora huérfanos también retirados (`motor`, `motorOutputToPlanString`, `MotorOutput`, `EnrichedInputs` de `motor-v2.1.ts`). **`isActive`/`isPrimary` NO se tocan** — siguen siendo llamados de verdad por `playerInputToMotorInputs()` (el traductor real hacia motor-v1, sigue vivo). **`mock-data.ts` pasa de 2394 a 1085 líneas** (-1309, más de la mitad).
- **No se tocó el esquema de base de datos** — `archetype`/`key_traits`/`defensive_plan`/`internal_model` siguen existiendo como columnas (con sus defaults/NOT NULL tal cual estaban) por compatibilidad con filas ya guardadas. Solo se retiró el código que las calculaba y las leía activamente.

### 32.2. Con esto se cierra el ciclo completo de retirada del motor legacy `generateProfile()` iniciado en la sección 26.3

Quedan fuera de alcance, explícitamente NO tocados en esta pasada (ver spec 26.3, sigue vigente): `motor-v4.ts`/`motor-v2.1.ts`/`reportTextRenderer.ts` (legacy) — `motor-v2.1.ts` es el núcleo calibrado que `motor-v1.ts` sigue usando en tiempo de ejecución, nunca se retira; `motor-v4.ts`/`reportTextRenderer.ts` siguen como referencia de aceptación en 2 archivos de test y `reportTextRendererV1.ts` reutiliza ~600 líneas de sus helpers a propósito — retirarlos exige separar esos helpers a un archivo compartido nuevo primero, Fase 3 real, no parte de este bloque.

Verificado: `npm run check` limpio, `npx vitest run` **13/13 archivos, 212/212 pruebas**. Smoke test del build sin errores de consola.

## 33. Cerrada la pregunta abierta de la sección 26.3 — la jugadora nunca ve alternativas del motor (2026-09-14)

Respuesta directa de Pablo a la pregunta pendiente desde la sección 26.3 (¿deben ocultarse del todo las hojas de alternativas deny/force/allow en modo jugadora, o quedarse visibles-pero-no-elegibles como hasta ahora?):

> *"eso no tiene sentido alguno. la jugadora solo ve la opcion que hemos aprobado. debe de ser un report categorico, sencillo, sintetizado y que de confianza. absoluto."*

**[VERIFICADO antes de asumir alcance] Solo `ReportSlidesV1.tsx` (slide 2, modo "completo") tenía este hueco.** `SimpleReportSlide` (el "Resumen rápido", modo por defecto) ya mostraba únicamente la instrucción de `deny` como texto plano, sin sheet, sin alternativas — ya cumplía el criterio. El problema estaba solo en las 3 tarjetas deny/force/allow de la vista completa: eran `<button>` para cualquiera (jugadora incluida), abrían el mismo sheet con el listado "Alternativas del motor" (con puntuaciones) que el entrenador usa para el picker — la jugadora no podía elegir ninguna, pero sí las veía todas.

**Implementado**: las 3 tarjetas ahora son interactivas (`<button>`, abren el sheet de alternativas) solo en `coachMode`; en modo jugadora son de solo lectura (`<div>`, sin `onClick`, sin afordancia de tap) — lo único que ve es la instrucción final aprobada y su "porqué" corto, ya visibles en la propia tarjeta. Nunca llega a abrirse el sheet, nunca ve una puntuación ni una opción descartada.

Verificado: `npm run check` limpio, `npx vitest run` 13/13 archivos, 212/212 pruebas. Smoke test del build sin errores de consola.

## 34. Auditoría UI/UX completa iOS + desktop — entrenadores y jugadoras, más allá del pipeline de informes (2026-09-14)

Encargo de Pablo: *"revisa que la UI y UX de los entrenadores y jugadoras encaje para iOS y el modo desktop, y ya de paso continua."* Más amplio que la sección 28 (que solo cubrió el pipeline de informes/aprobación) — esta auditoría cubre el resto de la app: shell de navegación, todas las pantallas de entrenador, todas las de jugadora.

### 34.1. Correcciones de alcance encontradas por El Arquitecto antes de nada (verificado por lectura real, no asumido)

- **`Stats.tsx` y `Playbook.tsx` NO son placeholders** — llevaban documentados como tal en CLAUDE.md y en el propio encargo, pero son 4761 y 1494 líneas respectivamente, en producción real. CLAUDE.md corregido. Existe un `Stats.tsx.bak` (907 líneas), probablemente el placeholder real anterior — candidato a limpieza, no investigado a fondo.
- **`ScoutDesktop.tsx` es código muerto** desde el commit `b09c640` (2026-05-21, Pablo Muñoz) — sustituido por `CoachHome.tsx` como pantalla real de `/scout` en desktop. Pese a eso, las secciones 28/30/32 de esta spec invirtieron trabajo real migrando su `ReportPreview` a motor-v1 sin que nadie notara que el archivo no se renderiza para ningún usuario. Ese trabajo sigue siendo código válido (por si se revive), solo invisible en producción hoy — decisión abierta, ver 34.3.

### 34.2. Implementado (mecánico, bajo riesgo)

- **[CRÍTICO] `client/src/pages/player/Dashboard.tsx`** (`PlayerTeamView`, `/player/team/:teamId` — pantalla real de jugadora): sin `overflow-y-auto`/`min-h-0` en absoluto en todo el árbol de contenedores — con un roster rival largo, las tarjetas por debajo del pliegue quedaban inalcanzables, no solo difíciles de alcanzar (mismo mecanismo exacto que el hallazgo crítico de `ReportSlidesV1.tsx` en la sección 28). Corregido.
- **[IMPORTANTE] `client/src/pages/player/PlayerHomeSettingsStub.tsx`**: mismo mecanismo de riesgo — `min-h-[100dvh]` sin scroll real, subpágina real de ajustes (alcanzable desde `ModuleHeader.tsx`, `PlayerHome.tsx`, `PlayerTeamList.tsx`, `ModulePage.tsx`), no estaba en la lista de excepciones de CLAUDE.md. Corregido.
- **`h-screen` → `h-[100dvh]`**: `ModulePage.tsx`, `CoachHome.tsx`, `HomeDesktop.tsx`, `HomeMobile.tsx`, `Playbook.tsx` (x2) — 5 pantallas que el propio changelog de CLAUDE.md daba por corregidas desde antes, sin serlo realmente.
- **`min-h-0` añadido**: `Stats.tsx` (panel de ficha de equipo).
- **Safe-area estandarizado**: 10 pantallas (`Personnel.tsx` x2, `ClubManagement.tsx`, `MyScout.tsx` x2, `FilmRoom.tsx`, `QuickScout.tsx`, `PlayerTeamList.tsx`, `GamePlan.tsx` x2) usaban `pb-16 md:pb-0` (64px fijo) sin sumar `env(safe-area-inset-bottom)`, inconsistente con `ModuleNav.tsx` (que sí lo suma a su propia altura) — en un iPhone con home indicator el hueco real reservado se quedaba corto. Estandarizado a `pb-[calc(4rem+env(safe-area-inset-bottom))] md:pb-0`.
- **Tipografía desktop**: barrido de **~205 instancias** de `text-[8-11px]` sin `md:text-xs`/`md:text-sm` en `Personnel.tsx` (24), `ClubManagement.tsx` (21), `PlayerEditor.tsx` (17), `Stats.tsx` (119), `GamePlan.tsx` (5), `QuickScout.tsx` (4), `WellnessStandalone.tsx` (4), `PlayerHome.tsx` (3), `PlayerTeamList.tsx` (3), `Dashboard.tsx` (3), `Settings.tsx` (1). Aplicado con script verificado (className planos + literales dentro de `cn()`/template strings), spot-check manual del diff antes de dar por bueno. **2 excepciones dejadas a propósito**: `PlayerEditor.tsx:142` (etiqueta de texto dentro de un `<svg>` pequeño del diagrama de zonas de poste — agrandar la fuente sin escalar el diagrama entero se vería desproporcionado) y `Stats.tsx:3045` (ya resuelto vía una variable JS `isDesktop`, no vía `md:` — patrón distinto, ya correcto).
- **`ModuleHeader.tsx`**: botón de ajustes de ~36px a ~44pt de objetivo táctil.
- **`ModuleNav.tsx`**: el rol en el sidebar desktop (`hidden lg:block`, nunca visible en mobile) tenía `text-[10px]` fijo sin sentido tener un `md:` — subido directo a `text-xs`.
- **`CLAUDE.md` corregido**: tabla de estado de módulos (Stats/Playbook activos, no placeholders), changelog de "Layout scroll fix" (ModulePage/Playbook no estaban realmente corregidos), pendientes #1/#2 (obsoletos, Stats/Playbook no son placeholders), #3 (resuelto para Home, sigue abierto solo para Schedule/planner), #4 (ya resuelto, CoachHome sí tiene densidad real), #7/#8 (acotados con evidencia concreta, siguen como decisión de Pablo), #15 (corregido), nuevo #9 (ScoutDesktop código muerto).

### 34.3. Decisiones de diseño real — necesitan validación de Pablo, no tocadas

1. **`PlayerEditor.tsx` en desktop**: no es una columna estrecha (no tiene `max-w-*`) — el problema real es que sus `grid grid-cols-2` se estiran al ancho completo de una pantalla de 27", campos desproporcionados. ¿Limitar el ancho (`max-w-3xl/4xl` centrado, simple) o rediseño a sidebar de 9 secciones + panel (arquitectura nueva)?
2. **`ScoutDesktop.tsx`**: ¿revivir como experiencia desktop real de `/scout` (hoy es literalmente el mismo `CoachHome` que en mobile), o borrar del todo el código fantasma?
3. **`ModuleHeader.tsx` en desktop**: el logo crece (56px→88px) en vez de compactarse, wordmark/tagline se quedan minúsculos fijos independientemente del tamaño de pantalla. ¿Comprimir el header en desktop para liberar esas filas a contenido real?
4. **`Schedule.tsx` modo planner en desktop**: panel lateral apagado a propósito, columna centrada con margen lateral vacío — pendiente #3 de CLAUDE.md sigue vigente aquí específicamente.

Verificado: `npm run check` limpio, `npx vitest run` 13/13 archivos, 212/212 pruebas. Smoke test del build sin errores de consola.

## 35. Las 4 decisiones de diseño de la sección 34.3, resueltas por Pablo e implementadas (2026-09-14)

Respuesta directa de Pablo a las 4 preguntas abiertas de la sección 34.3 — las 4 en la opción recomendada:

1. **`ScoutDesktop.tsx` (código muerto desde mayo) — borrar del todo.** Eliminado por completo. Confirmado sin importadores reales (`App.tsx`/`Scout.tsx`) antes de borrar — las únicas coincidencias restantes de "ScoutDesktop" en el repo son comentarios históricos en `mock-data.ts`/`QuickScout.tsx`/`PlayerEditor.tsx` documentando el trabajo de motor-v1 ya invertido ahí (secciones 28/30/32), dejados tal cual como registro.
2. **`PlayerEditor.tsx` en desktop — limitar el ancho, centrado.** `<Tabs>` (que envuelve las 9 secciones) pasa de `w-full` a `w-full max-w-3xl mx-auto` — mismo formulario, ya no se estira a un ancho absurdo en pantallas anchas.
3. **`ModuleHeader.tsx` en desktop — versión compacta.** Antes: logo crecía 56px→88px, wordmark/tagline fijos en 10-11px vía inline style independientemente del tamaño de pantalla. Ahora en `md:`+ pasa a una fila horizontal (logo 36px, más pequeño que en móvil) con wordmark/tagline en línea usando tamaños reales (`text-sm`/`text-xs`) que sí escalan. Móvil sin cambios. Verificado visualmente con una maqueta HTML aislada (Tailwind + las clases reales) antes de dar por bueno el diseño, dado que afecta a las 5 pantallas núcleo del producto (Home, CoachHome, Playbook, Schedule, Stats) y no hay forma de verlo en la app real sin sesión autenticada.
4. **`Schedule.tsx` modo planner — reactivar el panel lateral.** Investigado antes de tocar (mandato explícito de Pablo): se apagó a propósito en el mismo commit de mayo (`b09c640`) que retiró `ScoutDesktop.tsx`, sin comentario explícito del motivo. Verificado que el cableado para alimentarlo ya funcionaba de todas formas (`openSessionDetail`/`PlannerSessionCardButton` ya alimentan `desktopSelectedEvent` al hacer clic en una sesión del planner, sin ningún efecto visible porque el panel que lo consume estaba oculto) — señal de que probablemente fue una desactivación rápida de aquel commit grande, no una decisión final razonada. Presentado el hallazgo (con la sospecha no confirmada de que el grid de 7 días podría apretarse con el panel en portátiles más estrechos) antes de decidir — Pablo confirmó reactivarlo de todas formas. Implementado (`panel={desktopPanel}` sin condicionar a `staffView`). **Pendiente de que Pablo lo confirme visualmente en un portátil real** — no se pudo verificar de forma interactiva (requiere sesión autenticada + datos reales de sesiones en el planner).

Verificado: `npm run check` limpio, `npx vitest run` 13/13 archivos, 212/212 pruebas. Smoke test del build sin errores de consola.

## 36. Limpieza trivial — `Stats.tsx.bak` eliminado (2026-09-14)

Candidato de limpieza señalado por la auditoría de la sección 34 (probablemente el placeholder real de Stats antes de su sustitución), sin investigar a fondo entonces. Confirmado ahora: archivo `.bak` de 42KB, fecha 9 de mayo, cero referencias en todo el repo (no es siquiera una extensión importable). Eliminado.

Verificado: `npm run check` limpio, `npx vitest run` 13/13 archivos, 212/212 pruebas.

## 37. Hueco real encontrado y cerrado en la cola de mutaciones offline ya existente (2026-09-14)

Al buscar el siguiente trabajo con criterio propio ("avanza todo lo que puedas"), se investigó el estado real de la cola de mutaciones offline (spec sección 18, "para que guardar/editar funcione sin conexión") antes de asumir que había que construirla desde cero — **ya existía, sustancialmente completa**, en `client/src/lib/queryClient.ts` (`enqueueOfflinePlayerMutation`/`flushOfflinePlayerMutations`, localStorage, reconciliación de ids temporales, replay al reconectar vía el listener `online`).

**[VERIFICADO] Hueco real, no una feature nueva**: `useCreatePlayer`/`useUpdatePlayer` (`mock-data.ts`) sí encolaban al fallar sin conexión — pero `useDeletePlayer` no. Su `onError` deshacía el borrado optimista incondicionalmente, como si hubiera sido un error real del servidor: sin conexión, una jugadora borrada por un entrenador **reaparecía en la lista** y el borrado nunca se reintentaba al recuperar la conexión. La lógica de replay para `kind: "delete"` ya estaba completa en `flushOfflinePlayerMutations` desde antes — el único punto que faltaba era encolar en el sitio correcto. `useDeletePlayer` es una acción real y alcanzable (`Personnel.tsx`, `PlayerEditor.tsx`, no arqueología).

**Corregido**: `useDeletePlayer::onError` ahora distingue — sin conexión, mantiene el borrado optimista y encola (mismo patrón exacto que `useUpdatePlayer`); con conexión pero error real, deshace como antes.

Verificado: `npm run check` limpio, `npx vitest run` 13/13 archivos, 212/212 pruebas. Smoke test del build sin errores de consola.

## 38. Reconciliación del gate de publicación + hallazgo de seguridad en el importador WCBA (2026-09-14)

Respuesta directa de Pablo, tras compartir investigación real recuperada de Claude Desktop (conversaciones de abril, "el decantador" y el sistema de aprendizaje 3 niveles) que contradecía parcialmente lo implementado hoy en la sección 26.

**Conflicto real encontrado, reconciliado con Pablo antes de tocar código:** abril decía que head_coach/coach-con-badge publican "siempre" (sin condición); septiembre (hoy) exige ≥1 aprobación siempre, sin excepción — ese es el fallo crítico ya cerrado en la sección 27. Reconciliación acordada: **el gate de ≥1 aprobación se queda igual para todos, sin excepción** (protege el fix crítico) — pero **una vez que esa aprobación ya existe, cualquier coach del club puede publicar**, tenga o no el badge `reportPublishAccess` (recupera el espíritu de abril: "que el trabajo fluya sin cuellos de botella"). El badge deja de controlar quién publica y pasa a controlar el panel de Nivel B/decantador (sección 39).

**Implementado:** `POST /api/players/:id/game-plan` y `/api/report-assignments` (`server/routes.ts`) — quitado el chequeo de `reportPublishAccess`/`isHeadCoachOrMaster`, añadido solo `role !== "player"` (cualquier staff, no jugadoras). El gate de ≥1 aprobación no se toca.

**Aclaración adicional de Pablo, verificada en código, sin cambios necesarios:** la aprobación puede venir del mismo entrenador que escribió el informe (clubes con un solo coach en plantilla) — confirmado que `POST /api/players/:id/approve` (`server/routes.ts:514`) nunca comprobó autoría, ya funcionaba así.

**Hallazgo de seguridad real, encontrado por El Arquitecto durante la auditoría de "Roster Oficial" (sección 39) y cerrado aquí:** `POST /api/stats/import-team` no comprobaba rol en absoluto y no verificaba que `targetTeamId` perteneciera al club del solicitante — cualquier usuario autenticado que conociera o adivinara el id de un equipo de OTRO club podía inyectar jugadoras canónicas ahí (cross-tenant, mismo patrón IDOR que 25.1). `POST /api/stats/import-league` sí escopaba correctamente al club pero tampoco comprobaba rol. Ambos corregidos: `role !== "head_coach" && role !== "master"` → 403, y `import-team` verifica además que `targetTeamId` pertenece al club del solicitante antes de insertar.

Verificado: `npm run check` limpio, `npx vitest run` 15/15 archivos, 224/224 pruebas.

## 39. "El decantador" / Nivel B — diseño de El Arquitecto y primer bloque implementado: esquema + mecanismo reversible en el motor (2026-09-14)

Pablo pidió construir de verdad el panel de calibración Nivel B (spec 17.3), con el mandato explícito de que "promocionar a permanente" sea **reversible**, y que el panel sea visible y editable por los entrenadores con permiso de publicación (`reportPublishAccess`). Investigación recuperada de Claude Desktop confirmó el origen y diseño original de "el decantador" (My Scout → Film Room → Game Plan, abril 2026) y el sistema de aprendizaje de 3 niveles (Nivel A soft/individual, Nivel B hard/global — este encargo, Nivel C fuera de alcance).

Delegado en El Arquitecto el diseño técnico completo antes de tocar código — informe extenso, con 3 correcciones de premisa reales encontradas por lectura de código, no asumidas:
- **`detectPatterns()` (`overrideEngine.ts`), ya escrita, contaba jugadoras distintas, no entrenadores distintos** — un solo entrenador repitiendo la misma sustitución en 3 jugadoras del mismo arquetipo ya "promocionaba" un patrón, justo el riesgo de convergencia estrecha que Nivel B existe para evitar (eso es Nivel A). Corregido.
- **El texto ya renderizado de una alternativa (`replacementValue`) no es un identificador estable** — depende del idioma y, en campos direccionales, de la jugadora (spec 23.1: "force left" vs "force right" según `isoDir`). Agrupar patrones por texto nunca detectaría el mismo patrón de fondo entre dos jugadoras con dirección distinta. Añadido `replacementKey` (el `OutputKey` real) como identificador estable, con fallback a texto para overrides históricos.
- **Existía un segundo diseño de tipos limpio (`CampoTocable`/`EventoRevisionCampo`/`PatronCalibracion`, `motor-v1-types.ts:440-478`), nunca conectado a nada** — decisión explícita de El Arquitecto, aceptada: no migrar a él (mayor riesgo, sin beneficio funcional distinto), usarlo solo como referencia de naming.

### 39.1. Implementado en esta pasada — esquema + mecanismo reversible en el motor

- **Migración `0006`** (`report_overrides.replacement_key`, columna aditiva) y **`0007`** (`promoted_patterns`, tabla nueva) — aplicadas directamente contra Supabase de producción antes de escribir código contra ellas. `promoted_patterns` guarda `status: 'active'|'reverted'` en la misma fila (no `DELETE`) para conservar historial auditable; índice único parcial `WHERE status='active'` permite un solo patrón activo por club+arquetipo+campo a la vez, pero conserva cualquier intento anterior revertido.
- **`replacementKey` enhebrado end-to-end**: `reportTextRendererV1.ts::renderCampoV1` ahora expone `key` en cada alternativa (antes se descartaba); `ReportSlidesV1.tsx::openDefenseSheet`/`pickAlternative` lo pasan al guardar un "replace"; `server/routes.ts` lo valida y persiste; `overrideEngine.ts::ReportOverride`/`buildOverrideRecord`/`detectPatterns` lo usan como clave de agrupamiento principal (con fallback a texto).
- **`detectPatterns()` corregido**: cuenta `coachId` distintos (la señal real de Nivel B), `distinctPlayers` pasa a ser un dato secundario, no el número principal. Nueva suite `overrideEngine.test.ts` (6 pruebas) cubre explícitamente el bug corregido (un solo entrenador no forma patrón) y el agrupamiento estable por `replacementKey`.
- **El mecanismo central, reversible sin deploy**: `motor-v1.ts::aplicarPatronesPromocionados()` — función pura que, dado un arquetipo detectado y la lista de patrones activos, sube el `weight` del output promocionado por encima del ganador actual de su categoría (deny/force/allow), **solo si ese output ya era un candidato real generado por el motor para esa jugadora concreta** (nunca inventa una observación que el scout no hizo). Insertada en `ensamblarReporteDesdeMotorReport()` justo después de conocer `deteccion.key` (el arquetipo) y antes de que `campoDesdeRawOutputs()` elija ganador — así el patrón influye en qué output gana, no solo en el texto final. Es reversible por construcción: vive enteramente en datos (`opts.patronesPromocionados`, leído de `promoted_patterns` en tiempo de fetch), nunca en código fuente — revertir un patrón es un `UPDATE status='reverted'`, sin ningún deploy, y el motor vuelve exactamente a su comportamiento calibrado original en el siguiente informe que se ensamble.
- **Regresión verificada, no solo asumida**: `npm run motor:compare` (24 perfiles reales) sigue dando **0 divergencias** con el comportamiento por defecto (sin patrones activos, el caso normal hoy) — el mecanismo es opt-in puro. Nueva suite `motor-v1-calibration.test.ts` (6 pruebas) cubre con datos sintéticos: sin patrones el resultado es idéntico (`===`, mismo array, no solo `deep equal`); un patrón activo cambia el ganador; revertirlo (quitarlo del array) devuelve el resultado original byte a byte; un `replacementKey` que no existe como candidato real no fuerza nada; ya-es-el-ganador es idempotente.
- **`capabilities.ts::canPublishReports` renombrada a `canAccessCalibrationPanel`** (cero consumidores reales antes del rename, confirmado por grep) — refleja lo que controla de verdad ahora, evita que el próximo que toque el archivo lea mal su propósito tras la reconciliación de la sección 38.

### 39.2. Pendiente en esta misma pieza, siguiente paso inmediato

Endpoints de servidor (`GET /api/club/calibration-patterns`, `POST .../promote`, `POST .../:id/revert`) y el panel en `ClubManagement.tsx` (pestaña nueva "Calibración"), gateados a `canAccessCalibrationPanel`/`reportPublishAccess` tanto en cliente como en servidor. Diseño ya cerrado por El Arquitecto (sección 39, informe completo), solo falta implementar.

### 39.3. Auditoría de "Roster Oficial" — cerrada, la mayor parte ya funcionaba bien

Pablo: *"audita porque esto ya estaba hecho previamente y funcionaba decente"*. Confirmado: creación canónica gateada correctamente (cliente y servidor), modo sandbox real y bien aislado, importador WCBA funcional. El único hallazgo real fue el de seguridad ya cerrado en la sección 38 (`import-team`/`import-league` sin chequeo de rol/pertenencia a club). No se propuso ni ejecutó ningún rediseño — auditoría, no reconstrucción, tal como se pidió.

## 40. "El decantador" / Nivel B — cerrado end-to-end: endpoints, panel visual y wiring real al motor (2026-09-14)

Continuación directa de la sección 39 (esquema + mecanismo reversible ya implementados). Esta pasada cierra el ciclo completo: desde que un entrenador con permiso ve el panel, promociona un patrón, y ese patrón afecta de verdad al informe que ve cualquier coach o jugadora — no solo a nivel de base de datos.

### 40.1. Servidor

- **`GET /api/club/calibration-patterns`** (`?threshold=2..5`, default 3) — agregación real (`computeCalibrationPatterns()`, `server/routes.ts`): trae overrides de todas las jugadoras **canónicas** del club (excluye sandbox a propósito — una ficha de un solo entrenador nunca puede producir una señal multi-entrenador real), agrupa por `archetypeKey::itemKey::(replacementKey ?? replacementValue)`, cuenta `coachId`/`playerId` distintos, calcula el "score gap" medio, y cruza contra `promoted_patterns` activos para marcar `isPromoted`. **Nunca devuelve `coachId` ni jugadora individual** — solo el agregado y un texto de ejemplo (spec 17.2, anonimato exigido). Gate real en servidor (`canAccessCalibrationPanelServer`, mismo criterio que el badge `reportPublishAccess`), no solo en cliente.
- **`POST /api/club/calibration-patterns/promote`** — vuelve a calcular la agregación en el momento antes de insertar (no confía en lo que el cliente vio, evita promocionar algo que ya no cumple el umbral por una condición de carrera). Índice único parcial (migración 0007) impide dos patrones activos a la vez para el mismo club+arquetipo+campo — mapeado a 409 si ocurre.
- **`POST /api/club/calibration-patterns/:id/revert`** — marca `status='reverted'` (nunca `DELETE`, historial conservado).
- **`GET /api/club/active-promoted-patterns`** — endpoint ligero y deliberadamente **sin** el gate del panel: lo necesita cualquiera que vea un informe real calibrado (coach en revisión, o la propia jugadora), no solo quien administra el panel. Solo expone `{archetypeKey, fieldKey, replacementKey}` — nunca los datos agregados sensibles.

### 40.2. Wiring real al motor — sin esto, promocionar un patrón no habría hecho nada

`ReportSlidesV1.tsx` (la pantalla real donde se renderiza cualquier informe, coach o jugadora) ahora pide `useActivePromotedPatterns()` y lo pasa como `opts.patronesPromocionados` a `ensamblarReporteParaTexto()` — cerrando el círculo completo: patrón promocionado en el panel → `aplicarPatronesPromocionados()` (sección 39) sesga el ganador real → el informe que ve cualquiera cambia, reversible en cualquier momento sin deploy.

### 40.3. Panel visual

Nueva pestaña "Calibración" en `ClubManagement.tsx` (junto a Club/Liga/Equipo/Stats), visible **solo** con `canAccessCalibrationPanel` (renombrada en la sección 39 — head_coach/master siempre, coach con `reportPublishAccess` delegado). Por patrón: etiqueta DENY/FORCE/ALLOW + arquetipo (mismo catálogo que ya usa el informe real, `archetypeBaseLabel`, exportada para esto), texto de ejemplo, contador principal de **entrenadores** distintos (no jugadoras, corregido en la sección 39), badge de "Calibración fina" vs "Desacuerdo editorial" según el score gap, botón Promocionar/Revertir (revertir con diálogo de confirmación — acción con efecto real sobre informes futuros de todo el club). Selector de umbral (2-5, default 3) expuesto directamente en el panel, sin tocar código, para clubes con plantillas de staff pequeñas.

**Hallazgo real encontrado al cablear el panel, no anticipado por El Arquitecto**: el objeto `membership` que `ClubManagement.tsx` construye para `useCapabilities()` nunca incluía `reportPublishAccess` — un hueco dormido desde la sección 26 (la capability correspondiente, entonces `canPublishReports`, no tenía ningún consumidor real hasta hoy, así que el hueco no tenía ningún efecto visible). Corregido: el objeto ahora incluye `reportPublishAccess: Boolean(me.reportPublishAccess)`, igual que ya hacía con `operationsAccess`.

Verificado: `npm run check` limpio, `npx vitest run` 15/15 archivos, 224/224 pruebas, `npm run motor:compare` 0 divergencias. Smoke test del build sin errores de consola.

Con esto, "el decantador"/Nivel B queda cerrado end-to-end tal como lo pidió Pablo: reversible, y visible/editable por los entrenadores con permiso de publicación delegado.

## 41. Último detalle del decantador original — aviso de "pendientes" ahora refleja a todo el staff, no solo al propio (2026-09-14)

Cierre del último hallazgo menor de la auditoría de la sección 34 (hallazgo A.1): el aviso de "pendientes" en `CoachHome.tsx` solo contaba el trabajo del propio coach que abre la sesión — el diseño original de abril pedía "reports que faltan de rellenar **a cada miembro del staff** de ese partido".

**Implementado, con un ajuste de alcance real frente al diseño original**: `/api/film-room` ahora calcula, por jugadora ya en curso (≥1 versión entregada por alguien), qué entrenadores activos del club todavía no han enviado la suya (`missingCoachIds`). `CoachHome.tsx` agrega esto en `staffPendingCoachCount` (cuántos entrenadores distintos del staff tienen algo pendiente) y lo muestra como subtítulo del aviso existente ("N entrenadores con fichas pendientes"), reutilizando el prop `sub` que `AlertSlot` ya tenía definido y sin usar.

**Deliberadamente sin nombres de entrenadores** (el diseño de abril sugería "Ana, Marcos") — mostrar nombres exige resolver identidades vía la API admin de Supabase, una llamada cara en una ruta de acceso frecuente (`CoachHome` se monta en cada visita al módulo Scout). El conteo cumple el objetivo real (visibilidad de todo el staff, no solo el propio trabajo) sin ese coste. Si en el futuro se quiere ver quién exactamente falta, es una extensión aislada sobre esta misma base (`missingCoachIds` ya expone los ids, solo falta resolver nombres bajo demanda, no en cada carga).

Con esto se cierra el ciclo completo de "el decantador" tal como se describió originalmente en abril: los 3 contenedores nombrados, las 3 flechas del flujo, los avisos de cabecera (ahora sí reflejando a todo el staff), Roster Oficial auditado, y Nivel B construido de punta a punta con reversibilidad real.

Verificado: `npm run check` limpio, `npx vitest run` 15/15 archivos, 224/224 pruebas. Smoke test del build sin errores de consola.

## 42. Documentación puesta al día + hallazgo crítico real en las pantallas previas a la app (Login/Join/Onboarding) (2026-09-14)

Al continuar de forma autónoma tras el cierre de la sección 41, primero se puso al día la documentación antes de seguir escribiendo código nuevo encima de notas obsoletas:

- **Memoria de proyecto corregida**: una nota de memoria (`motor-v1-not-wired-to-ui`, del 2026-09-13) decía que `ReportSlidesV1.tsx` seguía usando `motor-v4`. Verificado por grep directo del import (`ensamblarReporteParaTexto` desde `@/lib/motor-v1`, líneas 5 y 184): eso dejó de ser cierto desde la sección 23/28 de esta spec. Nota reescrita y renombrada (`motor-v1-wired-to-ui`) para no arrastrar la asunción contraria a una sesión futura.
- **`CLAUDE.md` desincronizado con esta spec**: la sección "PENDIENTES" seguía listando como abiertos los ítems #3 (Schedule planner), #7 (PlayerEditor desktop), #8 (ModuleHeader desktop) y #9 (`ScoutDesktop.tsx`) — las 4 decisiones que Pablo ya resolvió e implementó en la sección 35 de esta misma spec, el mismo día. El changelog ("Cambios aplicados") tampoco mencionaba nada de las secciones 33 y 38-41 (ocultar alternativas a la jugadora, "el decantador"/Nivel B completo). Ambas cosas corregidas — los 4 ítems marcados resueltos con su solución real, y añadido un resumen enlazando a las secciones 33/38-41 para quien abra `CLAUDE.md` primero.

**Hallazgo real, no anticipado, al retomar el pendiente #6 de `CLAUDE.md` ("Onboarding flow no revisado para desktop")**: la auditoría de la sección 34 estaba explícitamente acotada a "páginas con `ModuleNav`" (la regla de scroll documentada en `CLAUDE.md`) — eso dejó fuera, sin querer, las pantallas que se renderizan *antes* de esa navegación: `Login.tsx`, `OnboardingFlow.tsx`, `Join.tsx` y `JoinClub.tsx`. Las 4 usan `min-h-[100dvh]` (crece con el contenido) pero están anidadas dentro del mismo wrapper raíz de `App.tsx` (línea 487) que es `h-[100dvh] overflow-hidden` — **exactamente el mismo mecanismo del hallazgo crítico de la sección 34** (`Dashboard.tsx`/`PlayerHomeSettingsStub.tsx`): si el contenido real supera la altura visible, no hay scroll nativo posible (el ancestro lo bloquea) y queda inalcanzable, no solo incómodo.

**Por qué esto es real y no teórico**: el caso más claro es el teclado en iOS/Android — `100dvh` se reduce dinámicamente cuando aparece el teclado, y los formularios de registro (`Login.tsx` y `JoinClub.tsx`, con nombre+email+contraseña+selector de rol+botón) superan fácilmente la altura visible resultante en un móvil pequeño con el teclado abierto. `OnboardingFlow.tsx` es el caso más grave: es el único flujo que un usuario nuevo **debe completar sí o sí** (paso de tutorial con imagen de teléfono simulada + título + cuerpo + puntos + 2 botones de navegación), y textos más largos en `zh`/`es` que en `en`, o una pantalla pequeña, podían dejar el botón "Siguiente"/"Finalizar" inalcanzable — bloqueando el onboarding sin salida (ni scroll ni forma de saltarlo salvo el link "Skip" del propio paso, si llegaba a ser visible).

**Corregido en las 4**: patrón idéntico al ya establecido en la sección 34 — `min-h-[100dvh]` → `h-[100dvh] overflow-y-auto` en cada contenedor de pantalla completa (6 ocurrencias en `Join.tsx`, 7 en `JoinClub.tsx`, 2 en `Login.tsx`, 1 en `OnboardingFlow.tsx`). Nada de re-arquitectura: mismo mecanismo de scroll interno ya usado en el resto de la app, aplicado donde faltaba.

**Verificado interactivamente, no solo por lectura**: servidor de desarrollo levantado en el navegador embebido, viewport reducido a 380×300 (simula un móvil pequeño con teclado abierto) sobre `Login.tsx` en modo registro — antes del fix el botón "Create account" habría quedado recortado sin scroll posible; con el fix, la página entera se desplaza y el botón permanece alcanzable (capturas de pantalla confirmando scrollbar visible y contenido completo alcanzable). Sin errores en consola.

Verificado: `npm run check` limpio, `npx vitest run` 15/15 archivos, 224/224 pruebas, smoke test interactivo en navegador (no solo build) sin errores de consola.
