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

Synergy tiene un sistema de "roles ofensivos" ya validado en la industria: Playmaking/Scoring/Secondary ball handler, Slashing/Spot-up/Dynamic-shooting wing, Playmaking/Post-up/Stretch/Rim-finishing big ([Synergy Player Comps / Insights Package](https://support.synergysports.com/support/solutions/articles/77000565958-insights-package)). Esto contrasta con el naming actual, ya detectado en la auditoría como inconsistente entre motores (`arch_isolation_driver` vs. `archetype_iso_scorer` para el mismo concepto). `[PENDIENTE VALIDAR CON PABLO]`: adoptar esta nomenclatura (o una traducción/adaptación) como el esquema oficial de archetypes de Motor 1.0 daría dos ventajas: (a) naming estable y único de una vez por todas, (b) terminología reconocible si algún día se compara con datos de Synergy externos.

### 12.6. ✅ Validación del formato compacto, con un matiz

La práctica de coaching real confirma que los informes de una página, centrados en lo más crítico, se retienen y usan mejor que los informes largos — varias fuentes independientes de coaching (no solo una) insisten en esto ([6 Scouting Report Essentials, Hoop Mentality](https://hoopmentality.com/blogs/basketball/scouting-report-essentials-every-high-school-coach-needs); [How to Scout Opponents](https://hoopmentality.com/blogs/basketball/how-to-scout-opponents-a-basketball-coachs-guide), que menciona un "framework de seis preguntas" por jugadora para entrega en una sola página). Esto **valida** el formato de 3 slides ya aprobado y la idea de "modo sencillo" de 1 slide que propuso Pablo. El matiz: el framework de "seis preguntas" es más granular que las 3 preguntas actuales de U Scout (¿Quién es? / ¿Qué hará? / ¿Qué hago yo?) — `[PENDIENTE]` no tengo el detalle exacto de esas seis preguntas (la fuente no las lista completas), valdría la pena buscarlo específicamente para ver si falta algo relevante en el formato actual de 3 preguntas antes de darlo por definitivo en Motor 1.0.

### 12.7. Nota de humildad metodológica, citada, no inventada

Incluso Synergy —el estándar de oro con etiquetado humano por vídeo— tiene ambigüedad real en el borde entre categorías: un bloqueo directo roto que termina en un intento aislado se cuenta como ISO; una recepción en spot-up donde la jugadora amaga varias veces antes de atacar también pasa a contarse como ISO ([Nylon Calculus: How to understand Synergy play type categories](https://fansided.com/2017/09/08/nylon-calculus-understanding-synergy-play-type-data/)). **Implicación honesta para Motor 1.0:** ni el estándar de la industria con vídeo humano es perfectamente preciso en los bordes. No merece la pena perseguir una precisión de clasificación imposible — el objetivo realista es "tan bueno o mejor que la observación humana actual del staff", no "perfecto".

### 12.8. Resumen de mejoras lógicas concretas, priorizadas

1. **Contracción bayesiana en vez de corte binario** para cualquier porcentaje mostrado como destacado (12.3) — la más importante técnicamente, evita mostrar datos falsos por poca muestra.
2. **Ventana de recencia (10-15 partidos) junto a temporada completa** (12.4) — barata de añadir si ya existe el vínculo de datos de la sección 5.
3. **Revisar criterio de calibración de pesos**: añadir "poder discriminante" junto a "PPP bruto" (12.2) — requiere más trabajo de análisis, no es trivial de calcular sin datos de tracking, pero vale la pena documentarlo como principio aunque se implemente de forma aproximada.
4. **Percentiles por posición**, ya señalado en la sección 10.2 — sigue siendo el pendiente más crítico de la parte de stats.
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

El formato actual (3 slides fijas: ¿Quién es? / ¿Qué hará? / ¿Qué hago yo?) se reorganiza en **capas**, donde la primera capa es autónoma y suficiente por sí sola — diseño mobile-first real, no un resumen recortado de algo más largo:

- **Capa 0 — siempre visible, única en "modo sencillo":** una sola tarjeta que combina identidad (archetype con nomenclatura Synergy) + el stat destacado real más extremo (sección 10.3, con shrinkage aplicado) + el output "quiet edge" (13.2) + **una sola** acción defensiva concreta (el `winner` de `deny`, no una lista). Es la respuesta condensada a las 6 preguntas de Hoop Mentality en una sola tarjeta.
- **Capa 1 — modo completo:** mapa de situaciones ordenado por amenaza (equivalente al "¿Qué hará?" actual), ahora con el emparejamiento defensivo (pregunta 4 de 13.0, hueco nuevo a construir) si el club ya tiene asignado quién la marca.
- **Capa 2 — modo completo:** plan defensivo completo deny/force/allow con nivel de confianza visible por recomendación (13.2).
- **Capa 3 — modo completo, nueva, no existía antes:** contexto estadístico real de U Stats con transparencia de muestra (chips con percentil Y tamaño de muestra visible, nunca un número sin contexto).

### 13.4. Qué se propone recortar del modelo actual ("más ágil", como pide Pablo)

Comparado contra el framework de 6 preguntas, hay campos del `PlayerEditor` actual (~48) que no alimentan ninguna de las 6 preguntas ni ningún output visible en las 4 capas de arriba — candidatos a revisar si de verdad hacen falta o son ruido heredado de iteraciones anteriores. `[PENDIENTE]`: no he hecho el mapeo campo-por-campo de los ~48 contra las 6 preguntas todavía (requiere releer `PlayerEditor.tsx` entero, que quedó pendiente en la auditoría original) — es el siguiente paso lógico antes de considerar esta sección cerrada.

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
5. **¿Capa 0 autónoma, aunque implique rediseñar la slide 1 actual?** → **Sí.** Es el cambio de mayor impacto de todo el documento para el caso de uso real (jugadora leyendo en el móvil, posiblemente solo esa tarjeta). Mantener la slide 1 actual como "resumen recortado" en vez de autocontenida sería arrastrar el mismo problema de diseño que ya se identificó como mejorable.
6. **¿Agilidad del formulario vs. no perder campos ya usados?** → **Agilidad por defecto, pero con revelado progresivo, no borrado.** Ningún campo del `PlayerEditor` actual desaparece de la base de datos ni dejará de poder rellenarse — se reorganiza la UI para mostrar primero lo esencial (las 6 preguntas) y el resto queda en una sección "avanzado" plegada por defecto. Nadie pierde capacidad, se gana velocidad para el caso común.

### 14.2. Boceto del modelo de datos de Fase 0 (nivel de tipos, no código real — esto es lo que se implementaría)

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

`[PENDIENTE VALIDAR CON PABLO]`: la traducción/naming exacto es una decisión de producto y de tono de marca, esto es una primera propuesta razonable, no la última palabra.

### 14.4. Definición de "listo para empezar a construir"

Con las secciones 1-14 de este documento, **la Fase 0 del roadmap (sección 8) ya tiene todo lo que necesita para arrancar**: modelo de datos (14.2), naming (14.3), qué conservar y qué cambiar (secciones 3-4, 13.2), y las decisiones de producto que antes bloqueaban el arranque (14.1). Lo único que sigue pendiente y no puedo resolver yo solo es el mapeo campo-por-campo de `PlayerEditor.tsx` (13.4) — requiere releer el archivo completo, que es trabajo mecánico de auditoría, no una decisión de producto; puedo hacerlo en la próxima tanda si quieres seguir antes de pasar a implementación real.

---

## 15. Mapeo campo-por-campo de `PlayerEditor.tsx` real y rediseño agresivo para minimizar tiempo del entrenador y margen de error

> Pablo: "podemos cambiar todo absolutamente si está justificado para mejorar el scouting, la retención de la jugadora, y reducir el tiempo del entrenador y su margen de error al mínimo". Con ese mandato explícito, esta sección propone cambios de fondo, no solo cosméticos.

### 15.1. Las 9 secciones reales del formulario, verificadas leéndolo (no asumidas)

**[VERIFICADO]** `PlayerEditor.tsx`, líneas 584-1969, tiene exactamente estas 9 secciones visuales, en este orden fijo: Identidad → Perfil físico → Tiros libres/faltas → Manejo de balón → Post → ISO → PnR → Actividad sin balón → Spot-up. **Orden fijo, siempre las 9 visibles, sin importar si la jugadora tiene 1 situación relevante o 6.**

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

---

## 16. Presentación a la jugadora — cómo se lee el informe, no solo qué contiene

> Todo lo de las secciones 13-15 diseña **qué dato mostrar**. Esta sección diseña **cómo se ve y se siente** al leerlo, que es una pregunta distinta y Pablo tiene razón en separarla.

### 16.1. El contexto real que hay que respetar, ya verificado en memoria del proyecto

**[VERIFICADO, ya decidido como producto]** "El informe lo lee la jugadora directamente en el móvil, individualmente, bastante antes del día del partido" (`u-scout-design-decisions.md`). Esto es importante porque **descarta** una recomendación que encontré en la investigación de coaching (sección 12/13): la práctica de que "el mejor método de entrega es un walkthrough en pista en vivo, no un documento" ([How to Scout Opponents, Hoop Mentality](https://hoopmentality.com/blogs/basketball/how-to-scout-opponents-a-basketball-coachs-guide)) **no aplica aquí** — U Scout ya decidió el modelo asíncrono/individual, y es una decisión de producto válida (escala mejor, no depende de tiempo de pista compartido), no algo que este documento deba cuestionar. Lo que sí aplica de esa misma investigación es todo lo que ayuda a que un documento leído en solitario retenga tan bien como una sesión en vivo — ahí es donde hay que invertir.

### 16.2. Principios de UX móvil deportiva, con fuente, aplicados a este caso concreto

- **Regla de 2 toques**: cualquier información crítica (la Capa 0, sección 13.3) debe verse sin scroll ni navegación extra al abrir el informe — principio general de diseño móvil deportivo confirmado en [Sports App UX Design, TheFinch](https://thefinch.design/sports-app-ux-design-cricket-fantasy-live-score-platforms/): las interacciones principales no deberían requerir más de dos toques desde cualquier pantalla.
- **Diseño para uso con una mano y en condiciones de luz variable**: la jugadora puede leer esto en el pabellón, en el bus, con luz mala — tipografía grande y contraste alto en la Capa 0 en particular (misma fuente que arriba).
- **Nada de gamificación genérica (rachas, insignias, tablas de clasificación).** Esto sí lo descarto explícitamente, aunque aparece mucho en la literatura de apps deportivas de fitness/consumo ([Fitness App UI Design](https://stormotion.io/blog/fitness-app-ux/)) — encaja con apps de motivación personal, no con un informe de scouting profesional de un club WCBA. Añadir insignias por "leer tu informe" trivializaría el tono serio que ya tiene el producto.

### 16.3. Lo que SÍ propongo añadir, justificado, no visto en ningún lado todavía

**Confirmación de lectura, visible solo para el staff (nuevo, no existe hoy).** Verificado en memoria: hoy el flujo de aprobación rastrea quién del staff aprobó qué, pero no hay ningún rastro de si la jugadora **leyó de verdad** su informe antes del partido. Dado que el propio diseño aprobado dice "bastante antes del día del partido", el coach necesita saber si eso realmente pasa — sin esto, no hay forma de saber si el modelo async individual está funcionando de verdad o si las jugadoras simplemente no lo abren. Propuesta concreta: marca de tiempo de "visto" al abrir la Capa 0 por primera vez, visible en un panel de staff (no visible para otras jugadoras, no es un ranking público — evita la presión social que sí generaría una tabla de "quien ha leído/quién no" compartida entre compañeras).

**Recordatorio, no notificación insistente.** Una única notificación cuando el informe se publica, y como mucho un segundo recordatorio si sigue sin abrirse a X horas del partido (número exacto a decidir con Pablo, no lo invento yo) — nunca más de dos avisos. Empujar demasiado iría en contra de la idea de "herramienta seria", se sentiría como spam.

**Tono del texto: directo y de entrenador, no corporativo ni motivacional genérico.** Esto conecta con el hallazgo ya documentado de plantillas mezcladas inglés/español (sección 12.6/OUTPUT_CATALOG) — al unificar el idioma base, la ocasión es también para fijar un tono único: frases cortas, imperativas, sin relleno ("Fuerza a la izquierda", no "Se recomienda intentar forzar hacia el lado izquierdo cuando sea posible") — coincide con el estilo que ya usan las plantillas más logradas del catálogo actual (ej. "Cerrar el espacio").

### 16.4. Lo que NO sé y no voy a inventar

`[PENDIENTE VALIDAR CON PABLO]`: el número exacto de horas antes del partido para el recordatorio, si la marca de "visto" debe mostrarse solo a nivel de equipo (agregado, "7 de 12 ya lo han abierto") o también individual por jugadora, y si a las jugadoras les parecería bien saber que el staff ve si lo han abierto (esto es una cuestión de cultura de equipo, no algo que yo pueda decidir sin conocer al grupo real).

---

## 17. Sistema de comparación y discrepancias entre entrenadores — diseño concreto

> Ya existía como principio en la memoria del proyecto ("Staff sees all versions; the app surfaces specific discrepancies") pero sin diseño concreto de cómo. Aquí lo desarrollo.

### 17.1. Qué cuenta como discrepancia (definición explícita, no existía)

Cuando dos o más entrenadores editan el mismo perfil de forma independiente (paso 1 del flujo de aprobación ya aprobado), una discrepancia es cualquiera de estas tres cosas, cada una con su propio tratamiento visual:

1. **Discrepancia de Nivel 1 (observación subjetiva)**: dos entrenadores marcan frecuencias distintas para la misma situación (ej. uno dice ISO=Principal, otro dice ISO=Secundaria). Esto es legítimo desafío cualitativo, no un error — se muestra lado a lado, ninguno "gana" automáticamente.
2. **Discrepancia de output final** (consecuencia de la anterior, o de cómo cada uno interpretó el motor): el `archetypeKey` o la acción `deny` ganadora difiere entre versiones. Esta es la más crítica para resolver antes de publicar — dos entrenadores no pueden mandar planes defensivos contradictorios a la vez.
3. **Discrepancia Nivel 1 vs. Nivel 2** (nueva, sección 13.1): un entrenador concreto discrepa del dato real de U Stats. Distinta de las dos anteriores porque aquí uno de los dos lados es un dato objetivo, no otra opinión — se marca de forma visualmente distinta ("el dato real dice X, tu observación dice Y").

### 17.2. Cómo se resuelve (añade al flujo ya aprobado, no lo sustituye)

El paso 3 ya aprobado ("staff ve todas las versiones, la app muestra discrepancias") se concreta así: vista de comparación campo a campo (side-by-side, no una lista de texto — el ojo detecta diferencias en columnas mucho más rápido que leyéndolas en prosa), con las discrepancias tipo 2 (output final contradictorio) bloqueando la publicación hasta que un entrenador con permiso elija explícitamente cuál versión prevalece — nunca un merge automático silencioso de dos opiniones contradictorias sobre baloncesto real.

### 17.3. Conexión nueva con el sistema de confianza (sección 13.2)

Esto no existía hasta ahora: si dos o más entrenadores coinciden de forma independiente en una observación de Nivel 1, eso en sí mismo es una señal de **confianza alta** para ese output — y si discrepan, confianza automáticamente **baja**, aunque cada uno por separado estuviera seguro. Es una forma barata de calibrar confianza sin necesitar más datos de U Stats: el acuerdo entre observadores humanos independientes es en sí una medida de fiabilidad, un principio estándar en metodología de scouting/evaluación (inter-rater agreement).

---

## 18. Modo offline y sincronización automática — para trabajar incluso en un avión

### 18.1. Lo que ya existe en el stack y sobre lo que hay que construir (verificado, no asumido)

**[VERIFICADO en memoria del proyecto]** U Stats ya usa `staleTime` con `networkMode: offlineFirst` en TanStack Query para lecturas cacheadas. Esto **no cubre** el caso que pide Pablo — eso es solo para leer datos ya descargados sin conexión, no para poder **escribir** (rellenar un scouting nuevo) estando offline y que se envíe solo después.

### 18.2. La pieza que falta: cola de mutaciones offline persistida

TanStack Query (la librería ya usada en todo el proyecto) tiene soporte oficial para esto exactamente: `PersistQueryClientProvider` + un persister (`localStorage` en web, o `AsyncStorage`/almacenamiento nativo vía Capacitor en la build de iOS) que guarda las mutaciones pausadas mientras no hay red, y `resumePausedMutations()` para reenviarlas al volver la conexión ([TanStack Query Mutations docs](https://tanstack.com/query/latest/docs/framework/react/guides/mutations)).

**Honestidad técnica, no vender esto como magia perfecta:** esta función de TanStack Query tiene un historial real de bugs de fiabilidad documentados en su propio repo — mutaciones que se quedan atascadas en estado "pausado" tras recargar la app, o que no se reanudan correctamente entre versiones de la librería ([GitHub Issue #5847](https://github.com/TanStack/query/issues/5847); [Issue #6825](https://github.com/TanStack/query/issues/6825)). **Recomendación concreta:** no depender solo del reintento automático silencioso — añadir siempre un indicador visible ("3 cambios pendientes de sincronizar") y un botón manual de "Sincronizar ahora", para que el entrenador nunca se quede sin saber si su trabajo en el avión realmente se guardó al aterrizar.

### 18.3. Disparadores de sincronización (los 3 que pide Pablo)

1. **Al recuperar conexión** — evento de `onlineManager` de TanStack Query, disparo inmediato de `resumePausedMutations()`.
2. **Cada cierto tiempo** — mientras la app está abierta y hay mutaciones pendientes, reintentar cada pocos minutos (no un número exacto propuesto aún, `[PENDIENTE]` decidir con Pablo, probablemente 3-5 min es razonable sin ser agresivo con batería/datos).
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
