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

## Estado DB — 2026-06-08

- `pbp_audit_log`: ok=444, error=2 (partido 286 aceptado)
- `pbp_possessions`: ~34K regular + ~5K playoff ✅ pp.points auditado y correcto
- `pbp_player_game_stats` + `pbp_lineup_stats`: poblados ✅
- `stats_players name_zh IS NULL`: 0 filas ✅
- 19 jugadoras stub (team#XXXX) — sobreescribirán en próximo roster sync
- Playoff phase IDs en season 2092: `{27743, 27747, 27753, 27757}`

---

## Notas técnicas críticas (iOS)

### recharts TDZ — NUNCA separar en chunk propio
- `vite.config.ts`: recharts + d3 EN `vendor-react`. Chunk separado → TDZ crash WebKit.

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
3. **Bundle iOS TestFlight** — objetivo ~290KB gzip (sesión dedicada)

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
15. `set r to do shell script "..." ; return r` es la forma correcta de osascript con output largo. `do shell script "... 2>&1"` puede fallar con pipes o comandos complejos.
16. LIKE '%id%' en SQL para matching de IDs numéricos → false positives si un ID es substring de otro. Usar regex `~` con `(^|-)id(-|$)`.

---

## Historial sesiones

### 2026-06-09 — Audit completo + 5 bugfixes + data corruption corregida

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
