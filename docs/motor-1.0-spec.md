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

## 9. Preguntas abiertas para Pablo (no las respondo yo, son de producto)

1. ¿El vínculo a U Stats debe ser obligatorio para toda jugadora rival, o solo cuando sea de la WCBA (jugadoras extranjeras o de ligas no cubiertas no tendrían dato)?
2. ¿Quieres que el motor nuevo mantenga los `key` exactos de v2.1/v4 donde coincidan en concepto (para no perder el historial de `report_overrides` ya existentes), o partir de cero con naming nuevo?
3. ¿Prioridad real: primero el núcleo (fases 0-1) sin tocar UX, o quieres UX nueva desde el principio aunque tarde más?
