# U Core — Contexto para Claude

> Leer este archivo al inicio de cada sesión antes de proponer cualquier cambio.
> Claude SIEMPRE actualiza este archivo al cierre de sesión.
> NUNCA proponer nada sin leer primero el código real de los archivos afectados.

---

## Producción
- URL: https://u-scout-production.up.railway.app
- Deploy: Railway, auto-deploy en push a `main`
- DB: Supabase (PostgreSQL) — https://ybpzvkkxcmwwxrrouyhm.supabase.co
- **Repo:** `/Users/palant/Downloads/U scout/ucore/`
- **GitHub:** https://github.com/palantozgz/U-Scout.git

## Stack
React + TypeScript + Vite · Express · Drizzle ORM · TanStack Query · shadcn/ui · Tailwind v4 · Capacitor 8.x

---

## Metodología de herramientas — AUTONOMÍA TOTAL

Claude tiene acceso completo a la máquina y debe trabajar de forma completamente autónoma.
**Nunca pedir a Pablo que ejecute comandos en terminal, Cursor, o en ningún sitio.**

| Tipo de tarea | Herramienta | Notas |
|---|---|---|
| Leer archivo Mac | `Filesystem:read_text_file` o `Filesystem:read_text_file` (capitalizado) | |
| Escribir/sobrescribir archivo | `filesystem:write_file` (minúscula) | |
| Edit quirúrgico | `Filesystem:edit_file` | No en routes.ts (template literals SQL) |
| Editar routes.ts | Script Python via osascript | Reemplazos exactos de texto |
| npm, git, comandos shell Mac | `Control your Mac:osascript` | PATH=/opt/homebrew/bin:/usr/local/bin:$PATH |
| Queries Supabase | Script Python → `Control your Mac:osascript` | Siempre escribir a archivo, ejecutar, borrar |
| SSH Pi | `Control your Mac:osascript` con /usr/bin/ssh | No interactivo, usar -o StrictHostKeyChecking=no |

### Scripts Python en osascript — patrón correcto
```python
# 1. Escribir script: filesystem:write_file → /Users/palant/Downloads/U scout/ucore/tmp_script.py
# 2. Ejecutar: Control your Mac:osascript
#    set r to do shell script "python3 '/path/tmp_script.py' 2>&1"; return r
# IMPORTANTE: usar "set r to do shell script ... ; return r" — NO "do shell script ... 2>&1"
# Scripts con mucha red: considerar dividir en chunks pequeños (timeout ~30s)
```

### Git — siempre vía osascript
```bash
export PATH=/opt/homebrew/bin:/usr/local/bin:$PATH && cd '/Users/palant/Downloads/U scout/ucore' && git add -A && git commit -m "..." && git push origin main
```

### routes.ts — editar vía Python (NO Cursor, NO filesystem:edit_file)
```python
# El archivo tiene template literals SQL con ${...} — filesystem:edit_file lo corrompe
# Usar Python: leer, reemplazar texto exacto, escribir
with open(routes_path, 'r') as f: content = f.read()
content = content.replace(old_exact_text, new_text, 1)
with open(routes_path, 'w') as f: f.write(content)
```

### Credenciales
```
SUPA_URL = https://ybpzvkkxcmwwxrrouyhm.supabase.co
SK       = grep SUPABASE_SERVICE_ROLE_KEY '/Users/palant/Downloads/U scout/.env' | cut -d= -f2
Pi user  = pablo  Pi host = 192.168.1.7
```

### Pi
- Watchdog activo (systemd + dtparam). SSD /dev/sda2, 117GB. Collector commit d51e98f.
- Conectar: `/usr/bin/ssh -i /Users/palant/.ssh/pi_ucore -o StrictHostKeyChecking=no pablo@192.168.1.7`

---

## Principios de datos

1. **PBP es fuente única de verdad para U Stats** — NUNCA mezclar fuentes
2. NUNCA estimar. Sin hardcodes
3. `team_id` en tablas derivadas = SIEMPRE internal id (1-18 y 373-378)
4. `stats_pbp.team_id` = external_id WCBA
5. `pp.points` en `pbp_possessions` es exacto — auditado 2026-06-08: 0 discrepancia por partido
6. La diferencia total entre `SUM(pp.points regular)` y `SUM(game scores)` = puntos de playoff excluidos del filtro `phase_type='regular'`. No es un bug.
7. **`plus_minus` en `pbp_player_game_stats` es calculado (PBP tracking), NO oficial** — 69.5% mismatch vs boxscore. SIEMPRE usar `stats_player_boxscores.plus_minus` para PM en game logs.

---

## Arquitectura general

```
API WCBA → collector Pi → stats_pbp → possessions.ts v6.6 (Railway) → tablas derivadas
                       ↘ player_stats (own team — manual entry UI pendiente)
```

---

## Estado DB — 2026-06-12

- `pbp_audit_log`: ok=444, error=2 (partido 286 aceptado)
- `pbp_possessions`: ~31K regular + ~5K playoff ✅ pp.points auditado y correcto
  - Phase 27172 (132 games): todos correctos ✅
  - Phase 27206 (60 games): games 325-340 tenían 2-3x duplicados → borrados y reprocesados ✅
  - Phase 27206 games 283-324 y 341-342: correctos ✅
- `pbp_player_game_stats` + `pbp_lineup_stats`: poblados ✅
- `stats_player_boxscores`: SOLO 21/224 partidos — season averages usan pgs (completo) ✅
- `stats_players name_zh IS NULL`: 0 filas ✅
- Playoff phase IDs en season 2092: `{27743, 27747, 27753, 27757}`
- Liga pace = 81.6 poss/game, ORTG = 99.5 (verificado post-fix)
- Pace por equipo: 77-87 poss/game (todos dentro de ±10 del promedio liga) ✅

---

## U Playbook — estado y plan

### Estado actual (2026-06-12)
- Existe `Playbook.tsx` (1119 líneas) con hub de 4 módulos: Defensiva/Ofensiva/ATOs/Film
- Wizard defensivo funcional genera un `Report` desde `defensive-system.ts`
- Ofensiva, ATOs, Film son shells vacíos
- NO existe vista de lectura para jugadoras — el output del wizard no llega a ellas
- NO existe sección de Transición

### Visión acordada con Pablo
U Playbook es el **manual táctico del equipo**, visible para las jugadoras.
Propósito: una jugadora que llega al equipo sabe exactamente qué se va a encontrar.
NO es para ajustes ni defensas especiales — es el esqueleto táctico permanente.

**4 secciones:**
1. **Defensa** — planes defensivos estándar construidos por el staff via wizard
   (man-to-man, zona, etc.). El wizard guía coherencia entre reglas.
2. **Transición** — reglas de transición ofensiva y defensiva (wizard similar al defensivo)
3. **Ataque** — sistemas ofensivos con diagramas clásicos + vídeo/animación 2D
4. **Saques** — jugadas de fondo y banda con diagramas + vídeo

### Principios de diseño
- **Todo multilingüe**: el contenido se crea en los idiomas del equipo (es/zh/en).
  Cada jugadora ve SOLO su idioma (setting global de la app, igual que el resto de U Core).
  NO bilingüe en pantalla — adaptado por usuario.
- **Dos modos**: vista jugadora (read-only, limpia) y vista staff (edit + wizard)
- **Publicado / Borrador**: el staff controla qué ve la jugadora
- **Reglas por fase**: transición → media cancha → situaciones especiales
- **Diagrama como gancho visual** en Ataque/Saques (diagrama pequeño en la tarjeta,
  diagrama grande + vídeo dentro)

### Mockup aprobado (pantallas discutidas)
1. **Hub** — 4 módulos con estado Publicado/Borrador + fecha última actualización
2. **Defensa hub** — lista de todos los planes disponibles
3. **Plan reader** — reglas organizadas por fase (transición/media cancha/rebote),
   idioma único del usuario, chips de categoría a probar
4. **Transición** — tabs Ofensiva/Defensiva, mismo formato de reglas
5. **Ataque** — lista de sets con diagrama-preview pequeño + info, tabs Sistemas/S.fondo/S.banda

### Decisión pendiente (necesita respuesta de Pablo)
¿El contenido lo escriben a través del wizard (opciones guiadas) o es texto libre
que el staff trae preparado y pega? Esto define si el wizard es un flow de opciones
o un editor de texto enriquecido.

### Plan de implementación — próxima sesión
FASE 1 (sin backend nuevo):
- Rediseñar el Hub actual (reemplazar los 4 tiles genéricos por las cards con estado)
- Crear la vista player-facing del Plan reader defensivo
  (conectar con los Reports que el wizard ya genera)
- Añadir sección Transición como shell navegable con tabs

FASE 2 (con backend):
- Schema para reglas de transición y contenido multilingual
- Editor de planes en el wizard
- Publicación controlada por staff

FASE 3 (más adelante):
- Ataque: diagramas + vídeo/animación
- Saques: biblioteca de jugadas

### Archivos clave Playbook
- `client/src/pages/core/Playbook.tsx` — componente principal (1119 líneas)
- `client/src/lib/playbook-api.ts` — API hooks
- `client/src/lib/defensive-system.ts` — lógica del wizard defensivo + buildReport()

---

## Notas técnicas críticas (iOS)

### GameBoxscoreSheet freeze iOS — PENDIENTE DE RESOLVER
- Se aplicó fix `2ff3484`: overflow-hidden movido a wrapper interno, svh→dvh, CSS body[data-scroll-locked]
- Pablo confirma que el bug PERSISTE en dispositivo físico
- Causa adicional posible: aria-hidden en el root app cuando el Sheet abre (Radix behavior)
  → Radix Dialog pone aria-hidden="true" en el root #root, lo que en algunos builds de iOS
  hace que WKWebView deje de procesar touch events en el modal
- Fix a intentar: en sheet.tsx, pasar modal={false}... pero Radix Sheet no tiene esa prop
- Fix alternativo: usar Vaul (drawer library) en lugar de Radix Sheet para bottom sheets
  Vaul es específicamente para mobile drawers y no tiene el aria-hidden issue
- Fix alternativo 2: portal container personalizado — Sheet abre en un div dentro del app
  root en lugar de en document.body
- PRIORIDAD ALTA — afecta directamente al flujo de uso en partidos

### recharts TDZ — RESUELTO 2026-06-12
- recharts estaba en vendor-react por precaución TDZ pero nadie lo importaba → 104KB gzip de peso muerto
- Eliminado de manualChunks. Ahora va automáticamente al chunk de Schedule (único importador)
- Schedule.tsx es lazy (solo se parsea cuando el user navega ahí) → React ya inicializado → sin TDZ
- vendor-react: 166KB → 61KB gzip. El TDZ solo ocurre si recharts carga ANTES de React.
- Si en el futuro se importa recharts en el shell de la app → volver a añadir a vendor-react.

### Scroll en Capacitor iOS — app-shell pattern
- Root: `h-[100dvh] overflow-hidden flex flex-col`
- Main scrollable: `flex-1 overflow-y-auto`
- NUNCA `min-h-[100dvh]` sin `overflow-y-auto` en el scrollable.

### PostgREST bulk insert
- Todos los JSON deben tener las mismas keys (null para opcionales).
- `Prefer: resolution=ignore-duplicates` para upserts seguros.
- `Prefer: count=exact` + `Range: 0-0` timeout en tablas grandes — contar via paginación Python.

---

## ═══════════════════════════════
## MÓDULO U SCOUT
## ═══════════════════════════════

### Estado real — 2026-06-08

| Feature | Estado |
|---|---|
| Motor v4 + ReportSlidesV1 (3 slides) | ✅ |
| PlayerEditor iOS scroll + team selector eliminado | ✅ 2026-06-08 |
| OverridePanel wired con report_overrides | ✅ confirmado |
| ReportViewV4: solo OverridePanel + "→ Film Room" | ✅ confirmado |
| FilmRoom como ÚNICO lugar de publicación | ✅ confirmado |
| Discrepancias entre coaches (DiscrepancyPanel) | ✅ confirmado |
| StatsMiniChip en MyScout + backend player-link | ✅ 2026-06-08 |
| PlayerEditorStatsChip — stats WCBA en context tab del editor | ✅ 2026-06-08 |
| player_stats UI — formulario entrada manual stats propias | ❌ pendiente |
| backup/motor-v2.1-pre-20260405 — merge/discard | ❌ pendiente decisión |

### Schema Supabase relevante (fuera de schema.ts — no tocar)
```
players.is_canonical, player_scout_versions, report_overrides,
report_approvals, report_publications, league_matches,
player_stats, invite_links
```

---

## ═══════════════════════════════
## MÓDULO U PLAYBOOK
## ═══════════════════════════════

| Feature | Estado |
|---|---|
| Hub + wizard defensivo (v5, 41 pasos) | ✅ |
| Wizard ofensivo | ❌ — requiere input de Pablo sobre estructura |
| Persistencia en Supabase (actualmente localStorage) | ❌ pendiente |
| Comparador portado al app | ❌ solo HTML standalone |

---

## ═══════════════════════════════
## MÓDULO U STATS
## ═══════════════════════════════

### possessions.ts v6.6 — estado auditado
- FT_LAST_MADE = `{FTH11M, FTH22M, FTH33M}` — correcto (last FT de cada serie)
- FTH21M/FTH31M/FTH32M correctamente FUERA del set (no son último TL)
- `pp.points` exacto per-game — auditado en Supabase SQL Editor 2026-06-08

### ORTG/DRTG — metodología corregida 2026-06-08
- **Antes:** cross-join `pbp_possessions p × op` → promedio ponderado inconsistente con league avg
- **Ahora:** 3 subqueries simples (own poss, opp poss, games count) — idéntico a league-averages endpoint
- Commit: `ededf5b`
- Fórmula: ORTG = 100 × SUM(pp.points propias) / COUNT(posesiones propias). Sin boxscores.

### Audit fórmulas — 2026-06-09 (audit completo end-to-end)

**Verificado correcto ✅:**
- pace-segments PPP incluye TOV possessions (19.6% de poss son TOV → denominador correcto)
- fgm en pgs incluye fg3m (FG% estándar)
- fouls poblados (77.2%) → PIE correcto
- Solo season_id=2092 en DB → standings LEFT JOIN bug latente pero no activo
- eFGPct, tsPct, ftRate, ORB%/DRB%, tsPct — fórmulas correctas
- pace liga — fórmula COUNT(*) / (COUNT(DISTINCT game_id) × 2) correcto

**Bugs corregidos en commit `f809a6c`:**
1. `astTovRatio` en `/api/stats/players/all-detail` era TOV% (SUM(tov)/denominador_poss) → ahora SUM(ast)/SUM(tov) correcto
2. `on-off` endpoint usaba `LIKE '%id%'` → 20 false positives confirmados → ahora regex `(^|-)id(-|$)`
3. `plus_minus` en game logs de 3 endpoints usaba pgs calculado (69.5% mismatch vs boxscore) → ahora COALESCE(spb.plus_minus, pgs.plus_minus) desde stats_player_boxscores

**Bug latente (no activo, una sola season):**
- standings eFGPct usa LEFT JOIN sin filtro efectivo de season — no afecta hasta que haya datos de season 2093+

### UI Stats — estado 2026-06-09

| Feature | Estado |
|---|---|
| Pipeline PBP completo | ✅ |
| ORTG/DRTG/Pace/eFG%/PIE/USG% — metodología correcta | ✅ ededf5b |
| League averages — auditadas y correctas | ✅ 2026-06-08 |
| PhaseToggle + multi-temporada | ✅ |
| GameBoxscoreSheet — col labels locale-aware | ✅ dd3b92f |
| StatsMiniChip en MyScout | ✅ 52cb42d |
| Bubble chart (eFG% vs PPG) — StatsBubbleChart.tsx SVG | ✅ 70d121a |
| Radar comparator — StatsPlayerComparator.tsx SVG | ✅ 0c19c17 |
| /api/stats/players/all-detail + prefetcher key fix | ✅ 2903160 |
| Cache-Control en /players, /leaders, /player-link | ✅ |
| astTovRatio all-detail corregido | ✅ f809a6c |
| on-off regex (no LIKE) | ✅ f809a6c |
| plus_minus desde boxscore (3 game log endpoints) | ✅ f809a6c |
| Shot chart (Pi Fase 4) | ❌ bloqueado |

---

## ═══════════════════════════════
## MÓDULO U SCHEDULE
## ═══════════════════════════════

| Feature | Estado |
|---|---|
| MVP calendario + sesiones | ✅ |
| Scroll recentering — block:"start" | ✅ 040276d |
| Wellness standalone (/player/wellness) | ✅ |
| Recurring events | ❌ |

---

## Pendientes ordenados por impacto

### P1
1. **U Playbook wizard ofensivo** — estructura a definir con Pablo
2. **player_stats UI** — `/coach/stats-entry`, tabla existe en Supabase, falta backend + frontend
3. ~~**Bundle iOS TestFlight**~~ — ✅ COMPLETADO 2026-06-12 (ver sesión de performance)
4. ~~**player_stats UI**~~ — ELIMINADO de P1. Era confusión: player_stats es sync automático
   de boxscores desde WCBA API (ya funciona). No hay entrada manual pendiente.

### P2
4. **ClubManagement Liga tab** — campos leagueType/gender/level no existen en schema
5. **backup/motor-v2.1-pre-20260405** — merge o discard

### P3
6. **Shot chart** — bloqueado Pi Fase 4
7. **Hero card jugadoras** — requiere wcba_external_id en profiles
8. **Recurring events** en Schedule

---

## Estándares de código

1. Leer código real antes de proponer cualquier cambio
2. `npm run check` exit 0 antes de todo commit — ejecutar via osascript
3. `routes.ts`: editar via Python (reemplazo de texto exacto), NO filesystem:edit_file
4. SQL destructivo: solo Supabase SQL Editor
5. NUNCA tocar `Profile.tsx`, `schema.ts`, `migrations/`

---

## Archivos clave
- `server/routes.ts` — API (~3700 líneas, editar via Python)
- `scripts/audit-precision.ts` — audit end-to-end L1/L2/L3. Correr antes de cerrar U Stats.
- `server/possessions.ts` — PBP processor v6.6
- `client/src/lib/stats-api.ts` — hooks TanStack Query
- `client/src/pages/core/Stats.tsx` — U Stats (4636+ líneas, leer en chunks)
- `client/src/components/StatsBubbleChart.tsx` — bubble chart SVG ✅
- `client/src/components/StatsPlayerComparator.tsx` — radar comparator SVG ✅
- `client/src/components/GameBoxscoreSheet.tsx` — boxscore locale-aware ✅
- `client/src/components/scout/PlayerEditorStatsChip.tsx` — stats WCBA en fichas ✅
- `client/src/pages/core/Playbook.tsx` — hub + wizard defensivo
- `client/src/pages/core/Schedule.tsx` — god file 228KB (sin SQL, edit_file OK)

## NUNCA tocar
- `Profile.tsx` · `schema.ts` · `migrations/`

---

## Lecciones aprendidas (no repetir)

1. `String(null) = 'null'` → filtrar antes de INSERT integer
2. Railway 30s timeout → fire-and-forget + polling Supabase
3. recharts TDZ → mantener en vendor-react, NUNCA chunk separado
4. iOS scroll → h-[100dvh]+overflow-hidden root, flex-1+overflow-y-auto main
5. PostgREST bulk → todas las keys iguales, null para opcionales
6. `Prefer: count=exact` + `Range: 0-0` → timeout en tablas grandes
7. toISOString() → UTC. Usar toLocaleDateString("sv") para fechas UTC+8
8. CLAUDE_CONTEXT.md puede estar desactualizado — siempre verificar con código real
9. `scrollIntoView({ block: "nearest" })` → usar `block: "start"` para re-center
10. osascript con mucha red (>30s) → timeout. Usar batches pequeños o escribir a archivo primero
11. NUNCA mezclar fuentes de datos — pp.points para puntos, no stats_games.score
12. La diferencia total pp.points(regular) vs game_pts incluye puntos de playoff — no es bug
13. `plus_minus` en `pbp_player_game_stats` es calculado desde PBP tracking, NO oficial. Tasa de mismatch vs boxscore: 69.5%. SIEMPRE usar `stats_player_boxscores.plus_minus` vía COALESCE en game logs.
14. REST cap PostgREST = 1000 rows por defecto. Paginar con `offset=` para datasets grandes. Para counts, usar `Prefer: count=exact + Range: 0-0` (puede timeout en tablas grandes → usar HEAD request).
17. **Paginación Python via REST: SIEMPRE usar `order=id.asc` y `limit=999`, break cuando `len(chunk) < 999`**. Sin ORDER BY, páginas sucesivas pueden devolver filas duplicadas → datos inflados. Patrón correcto: `qpage(t, p, off, 999)`, incrementar offset=+999, break si chunk<999.
18. **Duplicados en pbp_possessions**: causa = Pi collector procesando el mismo game_id múltiples veces sin DELETE efectivo. Detección: `poss_rows / (home_score + away_score) > 1.5`. Fix: DELETE todos los registros del game en las 3 tablas derivadas → `processAllPendingPossessions` los reinserta en startup.
15. `set r to do shell script "..." ; return r` es la forma correcta de osascript con output largo. `do shell script "... 2>&1"` puede fallar con pipes o comandos complejos.
16. LIKE '%id%' en SQL para matching de IDs numéricos → false positives si un ID es substring de otro. Usar regex `~` con `(^|-)id(-|$)`.

---

## Historial sesiones

### 2026-06-12 — U Stats cierre definitivo + perf bundle + UX

**U Stats — cierre definitivo:**
- FOLTEC (109 eventos, 77 partidos): phantom possessions corregidas en possessions.ts
  - `isTechFT` flag: FTs técnicos del equipo no-atacante no cambian la posesión ni acumulan possFTA/possPts
  - FOLOFN: `endType` corregido de 'unknown' a 'turnover' (348 eventos)
- Possessions duplicadas games 319/360/365 (race condition Pi) → borradas + reprocesadas
  - game=365: 62 duplicados (+33 pts inflados), game=360: 10 dups, game=319: 4 dups
- `scripts/audit-precision.ts`: script permanente de audit end-to-end
  - L1: SUM(poss.points) == stats_games.score para TODOS los partidos (223/223 ✅)
  - L2: FTA/TOV/REB vs pbp_audit_log
  - L3: integridad secuencias PBP y orden de reloj
  - Detección de possession_numbers duplicados
  - Resultado final: 223/223 L1 OK, 446/446 L2 OK, 0 FAIL 0 WARN ✅
- **U Stats queda cerrado** — datos verificados, audit permanente disponible

**Performance bundle — commits a main:**
- A: `/api/ping` keepalive endpoint + `useRailwayWarmup` hook (warm-on-focus/resume)
- B: staleTime correcto por tipo de dato (30s/1min → 2h para stats) + networkMode offlineFirst
- C: BackgroundPrefetcher timing 2000ms → 100ms + query keys corregidos (prefetch se ignoraba)
- D: recharts/d3/victory fuera de vendor-react → vendor-react 166→61 KB gzip
- E: i18n chain lazy (`initLocale()` en main.tsx antes de render) → index bundle 98→42 KB gzip
- server self-ping cada 4 min (Railway no duerme en prod)
- Skeleton screens: SkeletonMyScout + SkeletonStats (Schedule pendiente — god file 249KB)

**Métricas finales:**
- Parse eager antes del primer render: 326 KB → 224 KB gzip (-31%)
- vendor-react: 166 → 61 KB gzip
- index main bundle: 98 → 42 KB gzip
- Total bundle: 710 → 709 KB (redistribuido correctamente)
- `staleTime` correcto: stats abre instantáneo con caché, funciona sin wifi
- Cold start: self-ping servidor + warm-on-resume en cliente + UptimeRobot (manual, ver instrucciones)

**Notas técnicas nuevas:**
- `i18n-core.ts`: `import type` para tipado, `initLocale()` async pre-carga locales antes de React
- `main.tsx`: `await localeReady` antes de `createRoot()`, timeout 3s de seguridad
- `BackgroundPrefetcher`: query keys DEBEN coincidir exactamente con los hooks → siempre verificar
- Schedule skeleton: pendiente — sin loading entry point único, necesita sesión dedicada

**Commits de esta sesión:**
`5631725` U Stats audit-precision script + FOLTEC + FOLOFN + data fix games 319/360/365
`2ff3484` fix(ios): GameBoxscoreSheet freeze en Capacitor WKWebView
  - overflow-hidden eliminado del SheetContent (position:fixed + overflow-hidden = iOS freeze)
  - Movido a wrapper div interno. h-[92svh] → h-[92dvh]
  - index.css: body[data-scroll-locked] touch-action:auto + pointer-events:auto
  - NOTA: Pablo reporta que el bug PERSISTE en dispositivo. Posible causa adicional
    pendiente de investigar en próxima sesión.
`efbf9c0` ux: skeleton Schedule — isInitialLoad + SkeletonSchedule
`19190f5` perf(A): Railway keepalive
`d31de9b` perf(B): staleTime correcto + networkMode offlineFirst
`1029dec` perf(C): BackgroundPrefetcher timing + query keys
`7b4dc1c` perf(D): recharts/d3/victory fuera de vendor-react
`eeec22c` perf(E): i18n locale chain lazy — index bundle 98→42 KB
`ebd0e1d` perf(keepalive): server self-ping cada 4min
`cdb4a77` ux: skeleton screens MyScout + Stats

### 2026-06-10 — Audit end-to-end completo + 5 bugfixes + data corruption corregida

**Commits:**
- `f809a6c` fix: astTovRatio all-detail (TOV%→AST/TOV), on-off regex, plus_minus boxscore
- `cf9f286` fix: game log W/L indicator usa score real (no plusMinus)
- `26693ee` fix: pace por equipo — gCnt desde pbp_possessions con phaseFilter

**Auditoría end-to-end (WCBA fuente real):**
1. Leí 17 endpoints de routes.ts completos
2. Llamé WCBA API `cba.net.cn` y comparé campo a campo
3. Verifiqué consistencia interna entre todos los endpoints

**Verificado correcto contra WCBA API ✅:**
- Standings 18 equipos: W/L, PPG, OPPG exactos al decimal
- Player boxscore: 10 partidos × 24 jugadoras = 0 mismatches en todos los campos
- Game scores: exactos
- stats_pbp y stats_player_boxscores: correctos

**Bugs corregidos:**
1. `astTovRatio` all-detail era TOV% → ahora AST/TOV ✅
2. on-off LIKE → regex (20 false positives eliminados) ✅
3. plus_minus game logs → COALESCE(boxscore, pgs) ✅
4. W/L indicator game log → usa score real (no plusMinus) ✅
5. pace por equipo → gCnt desde pbp_possessions con phaseFilter (no stats_games sin filtro) ✅

**BUG CRÍTICO DE DATOS CORREGIDO — Possessions duplicadas phase 27206:**
- **16 games (IDs 325-340)** tenían 2-3x posesiones duplicadas en pbp_possessions
- Causa: el Pi collector procesó esos games múltiples veces sin DELETE previo efectivo
- Fix: DELETE de pbp_possessions + pbp_player_game_stats + pbp_lineup_stats para esos 16 games
- Reprocesado: `processAllPendingPossessions` se ejecuta en startup → Railway deploy triggea reprocesado
- Phase 27172 (132 games): verificada, limpia ✅
- Phase 27206 games 283-324 y 341-342: correctos ✅

**Gap operativo (no bug de código):**
- `stats_player_boxscores` tiene solo 21/224 partidos sincronizados
  - Season averages NO afectadas (usan pgs, completo)
  - GameBoxscoreSheet solo funciona para esos 21 partidos
  - Solución pendiente: correr `syncNewPlayerBoxscores` para ~200 partidos

**Lecciones de este audit:**
- Auditar fórmulas SQL ≠ auditar valores reales en pantalla
- Paginación REST sin ORDER BY produce duplicados → SIEMPRE usar `order=id.asc` en supa_all
- Comparar siempre métricas relacionadas entre endpoints (pace equipo vs pace liga)
- Llamar la fuente real (WCBA API) para verificar datos de ingest

### 2026-06-09 — Audit end-to-end contra WCBA fuente real + 4 bugfixes
Commits:
- `f809a6c` fix: astTovRatio all-detail (era TOV%), on-off regex, plus_minus boxscore
- `ccd635b` chore: remove temp scripts
- `88fb838` docs: CLAUDE_CONTEXT.md
- `cf9f286` fix: game log W/L indicator usa score real en lugar de plusMinus

**Metodología del audit (end-to-end real):**
1. Leí 17 endpoints de routes.ts completos
2. Verifiqué fórmulas contra Supabase via scripts Python
3. Llamé directamente a WCBA API `cba.net.cn` y comparé campo a campo

**Verificado correcto contra fuente WCBA ✅:**
- Standings 18 equipos: W/L, PPG, OPPG exactos al decimal
- Player boxscore: 10 partidos × 24 jugadoras = **0 mismatches** en todos los campos (pts, fgm, fga, fg3m, fg3a, ftm, fta, reb, off_reb, def_reb, ast, stl, blk, tov, fouls, plus_minus)
- stats_games scores: exactos
- Season averages (PPG, RPG…) desde pbp_player_game_stats: fuente correcta

**Bugs corregidos:**
1. `astTovRatio` all-detail era TOV% → ahora AST/TOV ✅
2. on-off LIKE → regex (20 false positives eliminados) ✅
3. PM game logs → COALESCE(boxscore, pgs) ✅
4. W/L indicator game log usaba plusMinus → ahora usa score real ✅

**Gap operativo (no bug de código):**
- `stats_player_boxscores` tiene solo 21/224 partidos sincronizados
  - Season averages NO afectadas (usan pgs, completo)
  - GameBoxscoreSheet solo funciona para esos 21 partidos
  - Solución: correr `syncNewPlayerBoxscores` para ~200 partidos pendientes (tarea Pi)

### 2026-06-10 — Audit consistencia interna + corrección datos duplicados phase 27206
Commits: `26693ee` fix: pace por equipo gCnt (anterior), más hallazgos de esta sesión.

**Bug crítico encontrado por Pablo (no detectado en 2 audits previos):**
- Pace por equipo siempre más bajo que pace de liga → bug de denominador `gCnt`
- `gCnt` venía de `stats_games` SIN phaseFilter → incluía juegos de playoff en denominador
- Numerador (`ownCnt`+`oppCnt`) filtrado por `phase_type='regular'` → mismatch
- Fix: `gCnt` ahora desde `pbp_possessions` con phaseFilterPP → commit `26693ee`

**Causa raíz del pace anómalo descubierta: datos duplicados en pbp_possessions**
- 16 games de phase 27206 (IDs 325-340) tenían 2-3x filas duplicadas
- Ejemplos: game 326 tenía 495 rows (ratio 3.28x), game 327 tenía 441 (2.86x)
- Phase 27172 (132 games): todos correctos
- Playoffs: datos incompletos (gap de colección Pi, no corrupción)
- Fix: DELETE de pbp_possessions/pbp_player_game_stats/pbp_lineup_stats para 16 games
- El server Railway los reprocessó automáticamente (processAllPendingPossessions)
- Verificación post-fix: 16/16 games ✅, PPG poss = standings exacto en todos los equipos

**Causa probable de la duplicación:** el Pi collector procesó los games 325-340 dos veces
sin que el DELETE previo funcionara correctamente (probable restart/crash entre batches)

**Estado post-fix verificado con datos reales (paginación page=900 correcta):**
- Liga pace = 81.6 poss/game
- Rango equipos: 77.2-86.8 (±5.2 del promedio) ✅
- PPG poss vs standings: ≤0.2 diferencia en todos los equipos ✅

**Lección de auditoría:** Los bugs de consistencia (team pace vs liga pace) solo se detectan
comparando visualmente métricas relacionadas en la misma pantalla. SQL correcto + datos
incorrectos en tablas derivadas = audit por código no los detecta.

**Lección de paginación Python:**
- PostgREST cap = 1000 rows siempre. `limit=2000` devuelve 1000 → loop rompe tras 1 page
- Solución: `page=900` en supa_all → 1000 rows > 900 → loop continúa correctamente
- Nunca usar page > 1000 en supa_all si se quieren todos los rows

**Gap conocido pendiente:** playoff games (IDs 343-374) tienen poco o ningún PBP en stats_pbp
→ La mayoría de playoff games no tienen possessions calculadas
→ `phaseType=playoff` en U Stats mostrará datos muy incompletos
→ Requiere verificar si el Pi collector recogió PBP durante playoffs

### 2026-06-08 — Sesión autónoma larga (stats audit + Phase 3 + bugfixes)
Commits pusheados:
- `52cb42d` GET /api/stats/player-link (StatsMiniChip backend)
- `70d121a` StatsBubbleChart SVG — eFG% vs PPG en tab jugadoras
- `0c19c17` StatsPlayerComparator SVG — radar + tabla, botón Comparar
- `dd3b92f` GameBoxscoreSheet col labels locale-aware (EN/ZH fix)
- `040276d` Schedule scroll re-center block:start
- `b3bcf3b` CLAUDE_CONTEXT correcciones masivas
- `5148b91` PlayerEditorStatsChip — stats WCBA en context tab
- `2903160` /api/stats/players/all-detail + prefetcher query key fix
- `c611523` remove team selector de PlayerEditor
- `ededf5b` ORTG/DRTG sin cross-join — metodología idéntica a league-averages ✅

### 2026-06-07 — iOS fixes + Boxscore + Multi-season + Nav + U Scout scroll
### 2026-06-06 — phase_type + UX Stats desktop + PhaseToggle + centerView
### 2026-06-03 — possessions v6.5/v6.6, reprocesado 444 ok
### 2026-06-02 — possessions v6.3-v6.5, watchdog Pi
### 2026-05-31 — possessions v6.3
### 2026-05-30 — audit fórmulas
### 2026-05-27 — shotZones, infraestructura
### 2026-05-25 — possessions v6.2, Playbook redesign, ThemePlugin iOS
### 2026-05-24 — action codes, PBP pipeline, audit formulas
