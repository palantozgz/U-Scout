# Auditoría completa — U Stats

> Estado del documento: **EN PROGRESO**. Este documento se construye de forma incremental, sesión a sesión.
> Todo lo marcado `[VERIFICADO]` se comprobó contra el código real del repo (`/Users/palant/Downloads/U scout/ucore/`) en la fecha indicada.
> Todo lo marcado `[PENDIENTE]` es hueco conocido, no relleno inventado.
> Este documento **hereda** `PBP_EVENTS.md` y `FORMULAS_STATS.md` (generados 2026-05-23) como base. Donde el código actual difiere de lo que dicen esos docs, se anota explícitamente el cambio — no se asume que siguen vigentes.

---

## 0. Cambio de contexto más importante desde `FORMULAS_STATS.md` (2026-05-23)

**[VERIFICADO 2026-09-10]** Entre el 23/05 y hoy se construyó un pipeline nuevo de posesiones (`server/possessions.ts`, creado 2026-06-03, 36 KB) que no existía cuando se escribieron los docs originales. Las tablas derivadas (`pbp_possessions`, `pbp_player_game_stats`, `pbp_lineup_stats`, `pbp_audit_log`) vienen de ahí, no de queries inline sobre `stats_pbp` como describían los docs viejos.

Esto significa que **parte de lo que dice `FORMULAS_STATS.md` sobre el endpoint `pace-segments` ya no es literalmente cierto** — el código cambió de sitio y de forma. Abajo, la verificación punto por punto.

---

## 1. Bug del PPP por tramo — reverificado contra código actual

### Lo que decía el doc viejo
`FORMULAS_STATS.md` documentaba un bug confirmado: el denominador del PPP por tramo contaba solo posesiones que terminaban en tiro (`event_type IN ('shot_made','shot_missed',...)`), excluyendo las que acababan en pérdida de balón. Impacto estimado: PPP inflado 15-20%.

### Lo que hay ahora — `server/routes.ts:2842-2956`

El endpoint `GET /api/stats/team/:externalId/pace-segments` ya **no** construye el conteo desde eventos PBP crudos filtrados por tipo de tiro. Ahora lee directamente de `pbp_possessions`:

```sql
SELECT
  CASE
    WHEN pp.is_transition    THEN 'transition'
    WHEN pp.is_early_offense THEN 'early'
    ELSE                          'halfcourt'
  END AS seg,
  COUNT(*)::int AS poss,
  SUM(pp.points)::int AS pts,
  ROUND(AVG(pp.duration_sec)::numeric, 1) AS avg_dur
FROM pbp_possessions pp
JOIN stats_games sg ON sg.id = pp.game_id
WHERE pp.team_id = ${team.id} AND sg.status = 4 AND sg.season_id = ${seasonId}
GROUP BY seg
```

`COUNT(*)` aquí cuenta **filas de posesión**, no filas de tiro. La pregunta clave es: ¿se inserta una fila en `pbp_possessions` por cada posesión, incluidas las que acaban en pérdida sin tirar?

**Verificado en `server/possessions.ts:532-560` (`closePoss`)**: la función se llama al cierre de *cualquier* posesión — el `endType` que recibe puede ser `'shot_made'`, `'ft_made'`, `'shot_missed'`, **`'turnover'`**, `'ft_missed_rebound'` o `'unknown'` (ver `server/possessions.ts:660-673`, donde `steal`, `turnover` y falta ofensiva mapean a `endType = 'turnover'`). El objeto `Possession` se empuja a `possessions[]` sin ningún filtro por `endType` (línea 543), y ese array se inserta completo en `pbp_possessions` (línea 737+, sin `WHERE` que excluya TOVs).

### Conclusión

✅ **El bug documentado en `FORMULAS_STATS.md` está corregido.** El denominador actual del PPP por tramo es el número real de posesiones (incluye TOVs), no solo las que llegan a tiro. La distinción PPT vs. PPP que hacía el doc viejo (sección 7 de `PBP_EVENTS.md`) ya no aplica al código actual tal cual estaba descrita — hay que reescribir esa sección para el estado nuevo.

**Ojo — esto NO se ha verificado con datos reales, solo con lectura de código.** Falta:
- `[PENDIENTE]` Confirmar con una query SQL directa sobre Supabase que `pbp_possessions` efectivamente tiene filas con `end_type = 'turnover'` en volumen no trivial (si por algún bug de runtime todas fueran `'unknown'` o el insert fallara silenciosamente para TOVs, el fix de código no se traduciría en datos correctos).
- `[PENDIENTE]` Recalcular el ejemplo numérico de la sección 8 de `FORMULAS_STATS.md` con datos reales de un equipo concreto y comparar contra el PPP que muestra la UI hoy.

---

## 2. Definición de "transición" — reverificado

**[VERIFICADO]** `server/possessions.ts:546-548`:

```
isTransition:   dur <= 8,
isEarlyOffense: dur > 8 && dur <= 14,
isHalfcourt:    dur > 14,
```

Mismos umbrales que documentaba `PBP_EVENTS.md` sección 3 (≤8s / 8-14s / >14s), simplemente movidos de una query inline a precálculo en ingesta. **Esta parte de la auditoría vieja sigue vigente sin cambios**: sigue siendo un proxy por tiempo de posesión (game clock), no la definición estándar de Synergy (defensa no colocada), y "early offense" (renombrado desde "demi-transición" en el código actual — el nombre en runtime ya no es el que describían los docs) sigue sin ser una categoría estándar en la literatura.

`dur` se calcula como `possStartSec - endSec` (línea 532) — tiempo de reloj de juego consumido en la posesión, confirmando que es game clock, no shot clock, tal como decía el doc viejo.

---

## 2.5. ORTG / DRTG / PPP / Pace de equipo — reverificado, deviación grande vs. `FORMULAS_STATS.md`

**[VERIFICADO 2026-09-10]** `server/routes.ts:2623-2680` (endpoint `/api/stats/team/:id`) y `server/routes.ts:3056-3072` (`/api/stats/league-averages`).

El doc viejo (`FORMULAS_STATS.md`, sección "Offensive/Defensive Rating") describe ORTG/DRTG/Pace calculados con la fórmula de estimación de posesiones de Dean Oliver sobre boxscore: `poss = fga + 0.44*fta + tov - off_reb`.

**Eso ya no es lo que hace el código.** Ahora:

```sql
SELECT COUNT(*)::int AS cnt, SUM(pp.points)::int AS pts
FROM pbp_possessions pp
JOIN stats_games sg ON sg.id = pp.game_id AND sg.status = 4 AND sg.season_id = ${seasonId}
WHERE pp.team_id = ${teamIntId} ${phaseFilterPP}
```

`ortg = 100 * ownPts / ownCnt` — el denominador es el **conteo real de posesiones** desde `pbp_possessions` (una fila = una posesión real, cerrada por el motor de `possessions.ts`), no la estimación boxscore. Mismo patrón para `drtg`, `pppOf`, `pppDef` y `paceEst` (líneas 2671-2678). El endpoint de liga (`league-averages`, línea 3064) usa el mismo patrón: `100.0 * SUM(pp.points) / NULLIF(COUNT(*), 0)`.

**Esto es en principio una mejora real** (posesión contada de verdad, no estimada) — coherente con la regla de memoria del proyecto ("nunca estimar, todo debe salir de `pbp_possessions`"). Pero significa que toda la sección "Métricas por equipo" de `FORMULAS_STATS.md` (ORTG/DRTG/PPP/Pace) **está obsoleta tal como está escrita** y hay que reescribirla para el doc nuevo con esta fórmula.

**Importante — esto es independiente del bug de `end_type` de la sección 2.6**: como esta query usa `COUNT(*)` sobre todas las filas de `pbp_possessions` sin filtrar por `end_type`, el bug de `end_type='unknown'` (sección 2.6) **no afecta** a ORTG/DRTG/PPP/Pace — esas métricas quedan correctas aunque la etiqueta de cómo terminó la posesión esté mal.

`[PENDIENTE]` Falta comprobar: (a) que `stats_player_boxscores` no se siga usando en ningún endpoint de equipo en paralelo con `pbp_possessions` para la misma métrica (mezclar fuentes está prohibido por la regla dura del proyecto — no se ha revisado cada endpoint de equipo todavía); (b) TOV%, ORB%/DRB%, eFG%, TS%, PIE, USG%, FT Rate — ninguna de estas se ha releído contra el código actual esta sesión, siguen citadas tal cual del doc viejo.

---

## 2.6. BUG NUEVO (no documentado antes) — `end_type = 'unknown'` en el 31% de las posesiones

**[VERIFICADO 2026-09-10 con SQL real contra Supabase, proyecto `ybpzvkkxcmwwxrrouyhm`]**

Distribución real de `end_type` en `pbp_possessions` (35.611 filas totales):

| end_type | filas | % |
|---|---|---|
| shot_made | 12.712 | 34,72% |
| **unknown** | **11.391** | **31,11%** |
| turnover | 7.121 | 19,45% |
| ft_made | 3.743 | 10,22% |
| ft_missed_rebound | 957 | 2,61% |
| period_end | 555 | 1,52% |
| **shot_missed** | **132** | **0,36%** |

`shot_missed` en 0,36% es imposible en baloncesto real — un equipo falla muchísimo más del 0,36% de sus tiros. Para contrastar: en `stats_pbp` (eventos crudos) hay **12.000 eventos `rebound` con `rebound_type='defensive'`** — es decir, ~12.000 posesiones deberían cerrar como `shot_missed`, pero solo 132 lo hacen. El resto (~11.391, que cuadra casi exacto con el conteo de `unknown`) cae en `unknown`.

**Causa raíz localizada — `server/possessions.ts:653-673` (bucle principal) vs. comentario de cabecera líneas 9-16:**

Según el comentario del propio archivo (línea 10): `REBDEF → offense = tid (reboteador pasa a atacar)` — es decir, el evento de rebote defensivo YA lleva el campo `offense` puesto al equipo que recupera el balón. Eso significa que el cambio de posesión (`ev.offense !== possTid`, línea 657) se detecta **en el propio evento de rebote**, no en el evento siguiente.

Pero el cálculo de `endType` (líneas 660-669) mira `prev = gameEvs[i-1]` — el evento **anterior** al que disparó el cambio. Si el cambio se dispara en el propio rebote, `prev` es el evento **antes del rebote** (normalmente el `shot_missed` que el rival acaba de fallar), no el rebote en sí. Y `'shot_missed'` no es uno de los casos contemplados en el if/else de la línea 663-669 (solo hay rama para `rebound`+`defensive`, pero nunca se llega a evaluar sobre el rebote porque el rebote es `ev`, no `prev`) → cae al valor por defecto `'unknown'` (línea 661).

**Ubicación exacta para revisar (no tocado, solo localizado):** `server/possessions.ts`, función del bucle principal, líneas ~653-673, específicamente la condición `else if (prev.event_type === 'rebound' && prev.rebound_type === 'defensive')` en la línea 665 — probablemente debería comprobar `ev` (el evento que disparó el cierre) en vez de, o además de, `prev`.

**Impacto real (acotado, verificado):**
- ✅ **NO afecta** a puntos por posesión (`points`), ORTG/DRTG/PPP/Pace (sección 2.5) ni al PPP por tramo (sección 1) — todos usan `COUNT(*)` / `SUM(points)` sin filtrar por `end_type`, y `accumulate()` suma los puntos correctamente independientemente de esta clasificación.
- ⚠️ **SÍ afecta** a cualquier métrica futura o ya existente que agrupe o filtre por `end_type` directamente (p.ej. un desglose "cómo terminan nuestras posesiones": % tiro anotado / % tiro fallado / % pérdida — hoy ese desglose mentiría, mostrando casi 0% de posesiones acabadas en tiro fallado).
- **[VERIFICADO]** `grep -rn 'end_type|endType' server/routes.ts client/src/` (excluyendo `possessions.ts`) no devuelve ningún resultado: **ningún endpoint ni componente de cliente usa `end_type` hoy**. Impacto actual real en producción: **ninguno visible** — es un dato mal etiquetado que nadie lee todavía, pero es una mina para el primer futuro feature que agregue por `end_type` (desglose de posesiones, por ejemplo).
- `[PENDIENTE]` Confirmar si `is_second_chance` u otros campos derivados de `endType`/rebote sufren el mismo desfase de índice.

---

## 3. Lo que queda pendiente de esta sesión

`[PENDIENTE]` — no se ha tocado todavía, no inventar contenido:

- Verificación de `isSecondChance` (filtro anti-putback) contra el código real — el doc viejo lo mencionaba como "≤3s desde rebote propio" pero no se ha confirmado el umbral exacto en `possessions.ts` esta sesión.
- ~~Resto de fórmulas de `FORMULAS_STATS.md`~~ — **actualizado parcialmente**: [VERIFICADO] confirmado que `eFGPct`, `tsPct`, `ftRate`, `tovPct` mantienen la misma fórmula matemática que documentaba `FORMULAS_STATS.md`, pero **la fuente cambió de `stats_player_boxscores pb` a `pbp_player_game_stats pgs`** en casi todos los endpoints de jugadora (`server/routes.ts` líneas 1918-3634, múltiples). [VERIFICADO] Solo quedan dos usos de `stats_player_boxscores pb` en todo `routes.ts` (líneas ~2470 y ~2789) y **ninguno mezcla fuentes dentro del mismo cálculo** — uno es `/api/stats/sync-status` (diagnóstico de qué partidos tienen PBP vs. boxscore sincronizado, no es un cálculo de métrica) y el otro es un listado de boxscore crudo por partido (no mezclado con métricas avanzadas derivadas de PBP). **No se detectó violación de la regla dura "nunca mezclar fuentes en el mismo cálculo".** `[PENDIENTE]`: PIE y USG% (fórmulas más complejas, líneas 2244-2338) no se han revisado carácter a carácter contra el estándar BBRef esta sesión, solo se confirmó que usan `pgs`. `pointsByZone` tampoco revisado — el doc viejo ya marcaba esa como ❌ aproximación burda (split 70/30 hardcodeado) por falta de `shot_x/y/zone`; falta confirmar si eso sigue igual.
- Sección 1 (producto y funcionalidades — inventario de pantallas de U Stats).
- Sección 3 completa del encargo original (pipeline de datos: qué cachea, dónde se calcula cliente vs. servidor vs. Supabase — solo se ha mirado la parte de posesiones, falta el resto).
- Sección 4 (arquitectura) — **arrancada, no completa**. [VERIFICADO por `wc -l`]: `client/src/pages/core/Stats.tsx` = **4.761 líneas** (archivo único, monolítico — más grande que el patrón `Schedule.tsx` ya señalado como sobrecargado en la memoria del proyecto). `server/routes.ts` = 3.970 líneas, `server/storage.ts` = 1.085, `server/possessions.ts` = 907. [VERIFICADO] Existe `client/src/pages/core/Stats.tsx.bak` (907 líneas) sentado en el directorio de páginas — archivo muerto, no importado por nadie salvo que se confirme lo contrario (`[PENDIENTE]` confirmar que no se importa desde ningún sitio antes de sugerir borrarlo). Componentes de Stats identificados: `StatsBubbleChart.tsx` (361 líneas), `StatsPlayerComparator.tsx` (390), `StatsRadar.tsx` (281). `[PENDIENTE]`: tablas Supabase completas del schema real (no asumidas), endpoints API completos listados uno a uno, deuda técnica más allá de este primer vistazo.
- Sección 6 (UI/UX real con Puppeteer, tres viewports).
- Verificación con SQL en vivo contra Supabase (no se ha ejecutado ninguna query contra la base de datos real todavía, solo lectura de código fuente).

## 5. Sección 1 — Producto y funcionalidades de U Stats (inventario desde código, sin capturas todavía)

**[VERIFICADO por lectura de `client/src/pages/core/Stats.tsx`, 4.761 líneas]** — esto es inventario estructural (qué estados/vistas existen en el código), **no** confirmado visualmente todavía con capturas de producción (eso es la sección 6, todavía pendiente). Puede haber matices de UI que solo se ven en pantalla.

### Navegación de primer nivel (línea 46)
```ts
type MainTab = "liga" | "jugadoras";
```
Dos pestañas principales únicamente: **Liga** y **Jugadoras**. No hay una pestaña de primer nivel "Equipos" — se entra a un equipo haciendo clic desde la clasificación de Liga.

### Tab "Liga"
- Segmento interno (`LigaSegment`, línea 47): **Clasificación** (`clasificacion`) y **Líderes** (`lideres`, líderes de liga por categoría).
- Clic en un equipo de la clasificación → abre `StatsTeamSheet` (detalle de equipo).

### Detalle de equipo — `StatsTeamSheet` (función en línea 3704)
5 sub-pestañas (línea 3756): **Ficha** (`ficha`, overview), **Avanzado** (`avanzado` — ORTG/DRTG/PPP/pace/pointsByZone, sección 2.5 de este doc), **Partidos** (`partidos` — game log), **Roster** (`roster`), **Quintetos** (`quintetos` — lineups, con orden por `poss/g/min/ortg/drtg/net/tov`, línea 3734-3735).

### Tab "Jugadoras"
- Lista de jugadoras con dos modos de visualización (línea 408): **lista** (`list`) y **burbujas** (`bubble`, usa `StatsBubbleChart.tsx`).
- Ordenable (`jugadorasSortDir`, línea 403).
- Clic en jugadora → abre `StatsPlayerSheet` (línea 2624), que incluye un radar (`StatsRadar`, usado en línea 3025 dentro del sheet).
- Existe un flujo de **comparación de jugadoras** (`StatsPlayerComparator`, línea 1507) — `[PENDIENTE]` documentar cómo se activa (botón/gesto) y qué muestra exactamente, no leído el componente en detalle aún.
- Hay un atajo a las propias estadísticas del usuario ("Mis estadísticas", mencionado en memoria del proyecto) — visto en código como `setPlayerSheetId(myExternalId)` (línea 1250); coincide con la nota de memoria de que depende de `profile.wcba_external_id` no siendo null.

### Layout responsive
- Desktop usa un panel partido: `StatsDesktopPanel` (función en línea 2380) que renderiza `StatsPlayerSheet`/`StatsTeamSheet` como panel lateral en vez de modal a pantalla completa, controlado por el estado `centerView` (`"default" | "standings" | "roster" | "playerList"`, línea 711).
- Móvil probablemente usa los mismos componentes `StatsPlayerSheet`/`StatsTeamSheet` como sheet/modal a pantalla completa en vez de panel lateral — `[PENDIENTE]` confirmar visualmente, no leído el JSX condicional de breakpoint en detalle.

### `[PENDIENTE]` de esta sección
- Cada botón con efecto real dentro de cada sub-vista (el encargo pide "cada botón") — esto es el esqueleto de navegación, no el inventario exhaustivo botón a botón.
- Confirmación visual con capturas (Puppeteer) en producción — todo lo de arriba es lectura de código, no observación de pantalla real.
- `StatsPlayerComparator` y `StatsBubbleChart` en detalle (qué datos pintan exactamente).

---

## 6. Fuentes usadas en esta sesión

- Lectura directa de `server/routes.ts` (líneas 2842-2956) y `server/possessions.ts` (líneas 70-79, 525-560, 640-760).
- `PBP_EVENTS.md` y `FORMULAS_STATS.md` como base heredada (no releídos en detalle en esta sesión salvo lo referenciado arriba).
- No se hizo investigación web nueva en esta sesión — el material de literatura (Synergy, Cleaning the Glass, Dean Oliver, etc.) que aparece arriba proviene del doc heredado, no de una búsqueda nueva.
