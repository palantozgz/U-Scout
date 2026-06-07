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

## Metodología de herramientas

| Tipo de tarea | Herramienta |
|---|---|
| Leer archivo Mac | `Filesystem:read_text_file` |
| Escribir archivo completo | `filesystem:write_file` |
| Edit quirúrgico (no routes.ts) | `Filesystem:edit_file` |
| Script Python puntual | `filesystem:write_file` → `Control your Mac:osascript` |
| Cualquier cambio en `routes.ts` | **Cursor — prompt completo** |
| Queries Supabase | `Control your Mac:osascript` + Python urllib |
| Comandos Mac (npm, git) | `Control your Mac:osascript` |
| SSH Pi | `/usr/bin/ssh -i /Users/palant/.ssh/pi_ucore -o StrictHostKeyChecking=no pablo@192.168.1.7` |

### Credenciales
```
SUPA_URL = https://ybpzvkkxcmwwxrrouyhm.supabase.co
SK       = grep SUPABASE_SERVICE_ROLE_KEY /Users/palant/Downloads/U\ scout/.env | cut -d= -f2
Pi       = 192.168.1.7  pablo  skapol
```

### Pi
- Watchdog activo (systemd + dtparam). SSD /dev/sda2, 117GB. Collector commit d51e98f.
- Conectar: `/usr/bin/ssh -i /Users/palant/.ssh/pi_ucore -o StrictHostKeyChecking=no pablo@192.168.1.7`

---

## Principios de datos

1. PBP es fuente única de verdad para U Stats
2. NUNCA estimar. Sin hardcodes
3. `team_id` en tablas derivadas = SIEMPRE internal id (1-18)
4. `stats_pbp.team_id` = external_id

---

## Arquitectura general

```
API WCBA → collector Pi → stats_pbp → possessions.ts v6.6 (Railway) → tablas derivadas
                       ↘ player_stats (own team — manual entry UI pendiente)
```

---

## Estado DB — 2026-06-07

- `pbp_audit_log`: ok=444, error=2 (partido 286 aceptado)
- `pbp_possessions`: ~43k regular + ~5k playoff ✅
- `pbp_player_game_stats` + `pbp_lineup_stats`: poblados ✅
- `stats_players name_zh IS NULL`: 0 filas ✅
- 19 jugadoras stub (team#XXXX) — sobreescribirán en próximo roster sync

---

## Notas técnicas críticas (iOS)

### recharts TDZ — NUNCA separar en chunk propio
- `vite.config.ts`: recharts + d3 + victory-vendor EN `vendor-react`.
- Chunk `vendor-charts` separado → TDZ crash WebKit iOS → pantalla negra.

### Scroll en Capacitor iOS — app-shell pattern
- Root: `h-[100dvh] overflow-hidden flex flex-col`
- Main scrollable: `flex-1 overflow-y-auto`
- NUNCA `min-h-[100dvh]` sin `overflow-y-auto` en el scrollable.
- Aplicado en: PlayerEditor ✅. ReportSlidesV1 usa `minHeight:"100svh"` — está contenido por App shell h-[100dvh] overflow-hidden, no es bug activo.

### PostgREST bulk insert
- Todos los JSON deben tener las mismas keys (usar null para opcionales).
- `Prefer: resolution=ignore-duplicates` para upserts seguros.

### BackgroundPrefetcher desktop — `/api/stats/players/all-detail` FALTANTE
- App.tsx prefetcha este endpoint en desktop para warm player detail cache.
- El endpoint NO existe en routes.ts → falla silenciosamente (try/catch).
- Pendiente: implementar en routes.ts (query compleja: todas las jugadoras + game log por temporada).

---

## ═══════════════════════════════
## MÓDULO U SCOUT
## ═══════════════════════════════

### Rutas activas
```
/coach               → CoachHome
/coach/personnel     → Personnel
/coach/my-scout      → MyScout (fichas sandbox del coach + StatsMiniChip ✅)
/coach/quick-scout/:id → QuickScout
/coach/player/:id    → PlayerEditor (iOS scroll fix ✅)
/coach/film-room     → FilmRoom (publicación única ✅)
/coach/game-plan     → GamePlan
/coach/scout/:id/review  → ReportViewV4 (OverridePanel wired ✅)
/coach/scout/:id/preview → ReportSlidesV1
/coach/club          → ClubManagement
/settings            → Settings
```

### Flow correcto U Scout
```
head_coach/badge → Personnel → crear ficha CANÓNICA
cualquier coach  → MyScout  → edita su versión (PlayerEditor)
                 → View report (ReportViewV4) → OverridePanel → "→ Film Room"
Film Room        → detecta discrepancias → X/Y enviaron
                 → ÚNICO lugar de publicación a Game Plan ✅
Game Plan        → jugadoras ven en /player/report/:id → ReportSlidesV1
head_coach       → puede RETIRAR ficha
```

### Motor
- Motor v4 activo. 3 slides: ¿Quién es? / ¿Qué hará? / ¿Qué hago yo?
- `backup/motor-v2.1-pre-20260405` — rama backup, pendiente confirmar merge o descartar

### Schema Supabase relevante (fuera de schema.ts — no tocar)
```
players.is_canonical                  boolean DEFAULT false
player_scout_versions                 (player_id, coach_id, inputs JSONB, status, submitted_at)
report_overrides                      (player_id, coach_id, field, hide/keep, created_at)
report_approvals                      (player_id, coach_id, approved_at)
report_publications                   (player_id, published_by, published_at)
league_matches                        (club_id, rival_name, match_date, location, match_type)
player_stats                          (club_id, player_name, team_name, season, game_date,
                                       rival_name, minutes, pts, reb_off, reb_def, ast, stl,
                                       blk, tov, fouls, fg_made/attempted, fg3_made/attempted,
                                       ft_made/attempted, plus_minus, source)
invite_links                          (universe_id, role, code, expires_at, max_uses, use_count)
```

### Estado real de features U Scout — 2026-06-08

| Feature | Estado |
|---|---|
| Motor v4 + ReportSlidesV1 (3 slides) | ✅ |
| PlayerEditor iOS scroll | ✅ |
| OverridePanel wired con report_overrides (GET+POST /api/players/:id/overrides) | ✅ confirmado |
| ReportViewV4: solo OverridePanel + "→ Film Room" | ✅ confirmado |
| FilmRoom como ÚNICO lugar de publicación | ✅ confirmado |
| Discrepancias entre coaches (DiscrepancyPanel) | ✅ confirmado |
| StatsMiniChip en MyScout + backend player-link | ✅ 2026-06-08 |
| Integración U Stats → U Scout (stats WCBA en fichas rival) | ❌ sin implementar |
| player_stats tabla: UI entrada manual stats propias | ❌ pendiente |
| QuickScout wizard 7 ramas | ⚠️ existente — leer antes de tocar |
| ClubManagement — tab Liga (leagueType, gender, level) | ❌ campos no existen en schema |
| backup/motor-v2.1-pre-20260405 — merge/discard | ❌ pendiente decisión |

---

## ═══════════════════════════════
## MÓDULO U PLAYBOOK
## ═══════════════════════════════

### Estado real

| Feature | Estado |
|---|---|
| Hub view (4 cards) | ✅ |
| Wizard defensivo completo (v5, 12 secciones, ~41 pasos) | ✅ |
| Planes guardados en localStorage | ✅ |
| Wizard ofensivo | ❌ sin implementar |
| Wizard ATOs | ❌ sin implementar |
| Comparador de sistemas portado al app | ❌ solo en HTML standalone |
| Persistencia en Supabase | ❌ pendiente |

---

## ═══════════════════════════════
## MÓDULO U STATS
## ═══════════════════════════════

### possessions.ts v6.6
- Playoff phases: `{27743, 27747, 27753, 27757}`
- unknown end_type (~35%): tiros fallados sin rebote defensivo en PBP. No rompe PPP.

### UI Stats — estado 2026-06-08

| Feature | Estado |
|---|---|
| Pipeline PBP completo | ✅ |
| Todas las métricas estándar (ORTG/DRTG/Pace/eFG%/PIE/USG%) | ✅ |
| PhaseToggle liga/playoff | ✅ |
| Multi-temporada infrastructure | ✅ |
| GameBoxscoreSheet prev/next | ✅ |
| GameBoxscoreSheet column labels locale-aware (STL/BLK/TOV/FT) | ✅ 2026-06-08 |
| StatsMiniChip en MyScout + player-link endpoint | ✅ 2026-06-08 |
| Bubble chart jugadoras (eFG% vs PPG, tamaño=partidos) | ✅ 2026-06-08 — StatsBubbleChart.tsx |
| Radar comparator jugadoras (2 jugadoras, 6 ejes + stat table) | ✅ 2026-06-08 — StatsPlayerComparator.tsx |
| Cache-Control en /players, /leaders, /player-link | ✅ 2026-06-08 |
| Shot chart (Fase 4 Pi: shot_zone data) | ❌ bloqueado |
| Hero card jugadoras (profiles tabla) | ❌ P3 backlog |
| /api/stats/players/all-detail (prefetch bulk desktop) | ❌ endpoint no existe |

### Bubble chart — detalles técnica
- `client/src/components/StatsBubbleChart.tsx` — SVG puro, sin recharts
- X=eFG%, Y=PPG, radio=partidos jugados, crosshairs en promedio liga
- Toggle ☰/◉ en header de jugadoras tab
- minGames=5 para filtrar jugadoras con poca muestra
- Tappable: abre player sheet

### Radar comparator — detalles técnica
- `client/src/components/StatsPlayerComparator.tsx` — SVG puro, sin recharts
- Botón "≈ Comparar" en header de jugadoras tab → Sheet bottom
- Selector búsqueda-por-nombre para Player A y Player B
- 2 mini radars + tabla comparativa 11 stats con indicador de ganadora por fila
- Normalización: max de toda la liga como referencia (no percentiles)

---

## ═══════════════════════════════
## MÓDULO U SCHEDULE
## ═══════════════════════════════

| Feature | Estado |
|---|---|
| MVP calendario + sesiones | ✅ |
| Scroll recentering List↔Planner — block:"start" | ✅ 2026-06-08 |
| Wellness standalone (/player/wellness) | ✅ ruta + componente + enlace desde Home ✅ |
| league_matches integration | ❌ pendiente |
| Recurring events | ❌ sin implementar |
| Attendance modes groups/signup UI completa | ⚠️ parcial |

---

## ═══════════════════════════════
## MÓDULO U WELLNESS
## ═══════════════════════════════

| Feature | Estado |
|---|---|
| Player check-ins | ✅ |
| Standalone en /player/wellness — ruta + link desde HomeMobile + HomeDesktop | ✅ confirmado |
| Dashboard coach (datos bienestar del equipo) | ❌ sin implementar |

---

## ═══════════════════════════════
## TRANSVERSAL / iOS
## ═══════════════════════════════

| Feature | Estado |
|---|---|
| recharts TDZ fix (vendor-react) | ✅ |
| iOS dvh scroll fix | ✅ |
| Bundle TestFlight <300KB (i18n lazy + React.lazy) | ❌ sesión dedicada pendiente |
| /api/stats/players/all-detail para warm desktop cache | ❌ endpoint faltante |

---

## Pendientes ordenados por impacto

### P1 — Funcionalidad importante sin entregar
1. **U Playbook — wizard ofensivo** + persistencia Supabase (leer Playbook.tsx antes)
2. **Integración stats en fichas scout** — al editar rival, mostrar PPG/RPG/AST/FG% como contexto
3. **player_stats UI** — formulario entrada manual estadísticas propias (/coach/stats-entry)
4. **/api/stats/players/all-detail** — endpoint bulk para prefetch desktop (warm player cache)

### P2 — Mejora significativa
5. **Bundle iOS TestFlight** — sesión dedicada, objetivo ~290KB gzip desde ~510KB actual
6. **ClubManagement Liga tab** — leagueType, gender, level, ageCategory

### P3 — Backlog
7. **Shot chart** — bloqueado (Pi Fase 4)
8. **backup/motor-v2.1-pre-20260405** — merge o discard
9. **Hero card jugadoras** (profiles tabla wcba_external_id)
10. **Recurring events** en Schedule

---

## Estándares de código

1. Leer código real antes de proponer cualquier cambio
2. `npm run check` exit 0 antes de todo commit
3. `routes.ts`: SOLO via Cursor
4. SQL destructivo: solo Supabase SQL Editor
5. NUNCA tocar `Profile.tsx`, `schema.ts`, `migrations/`
6. Tras Cursor: `grep -n 'app.get.*api/stats' server/routes.ts` para detectar duplicados

---

## Archivos clave
- `server/routes.ts` — API endpoints (Cursor only, ~3600 líneas)
- `server/possessions.ts` — PBP processor v6.6
- `client/src/lib/stats-api.ts` — hooks TanStack Query
- `client/src/pages/core/Stats.tsx` — U Stats (4636 líneas, leer en chunks)
- `client/src/components/StatsBubbleChart.tsx` — bubble chart eFG% vs PPG ✅ 2026-06-08
- `client/src/components/StatsPlayerComparator.tsx` — radar comparator ✅ 2026-06-08
- `client/src/components/GameBoxscoreSheet.tsx` — boxscore + locale-aware cols ✅ 2026-06-08
- `client/src/pages/scout/PlayerEditor.tsx` — editor fichas (iOS scroll fix ✅)
- `client/src/pages/scout/ReportViewV4.tsx` — override flow ✅
- `client/src/pages/scout/FilmRoom.tsx` — publicación única ✅
- `client/src/pages/core/Playbook.tsx` — hub + wizard defensivo
- `client/src/pages/core/Schedule.tsx` — god file 228KB
- `scripts/fast_reprocess.py` — reprocesado canónico

## NUNCA tocar
- `Profile.tsx` · `schema.ts` · `migrations/`

---

## Lecciones aprendidas (no repetir)
1. `String(null) = 'null'` → filtrar antes de INSERT integer
2. Railway 30s timeout → fire-and-forget + polling Supabase
3. recharts TDZ → mantener en vendor-react, NUNCA chunk separado
4. iOS scroll → h-[100dvh]+overflow-hidden root, flex-1+overflow-y-auto main
5. PostgREST bulk → todas las keys iguales, usar null para opcionales
6. `Prefer: count=exact` + `Range: 0-0` → timeout en tablas grandes
7. toISOString() → UTC. Usar toLocaleDateString("sv") para fechas en China (UTC+8)
8. CLAUDE_CONTEXT.md puede estar desactualizado — siempre leer el código real antes de asumir estado
9. `scrollIntoView({ block: "nearest" })` no re-centra si ya visible → usar `block: "start"`

---

## Historial sesiones

### 2026-06-08 — Stats Phase 3 + UX audit + bugfixes (sesión autónoma)
- `GET /api/stats/player-link` endpoint (StatsMiniChip backend) — 52cb42d
- `StatsBubbleChart.tsx` — eFG% vs PPG, SVG puro, toggle en jugadoras — 70d121a
- `StatsPlayerComparator.tsx` — radar + stat table, botón Comparar — 0c19c17
- OverridePanel.tsx TODO comment stale eliminado — 0c19c17
- Cache-Control: /players (300s), /leaders (300s), /player-link (600s) — 0c19c17
- GameBoxscoreSheet col labels locale-aware (STL/BLK/TOV/FT en EN/ZH) — dd3b92f
- Schedule scroll re-center: block:"start" (fix List↔Planner) — 040276d
- Verificaciones: T1 ReportViewV4+FilmRoom ✅ ya estaba completo, Wellness ✅ ya existía

### 2026-06-07 — iOS fixes + Boxscore + Multi-season + Nav + U Scout scroll + Nombres
- iOS TDZ recharts, GameBoxscoreSheet prev/next, SEASON_LABELS, PlayerEditor scroll
- Commits: 07536a4, a10282e, 8a0757c, a906cf0, b0e5309, d354b7c, 1703b20, 1f431b6

### 2026-06-06 — phase_type + UX Stats desktop + PhaseToggle + centerView
### 2026-06-03 — possessions v6.5/v6.6, reprocesado 444 ok
### 2026-06-02 — possessions v6.3-v6.5, watchdog Pi
### 2026-05-31 — possessions v6.3
### 2026-05-30 — audit fórmulas
### 2026-05-27 — shotZones, infraestructura
### 2026-05-25 — possessions v6.2, Playbook redesign, ThemePlugin iOS
### 2026-05-24 — action codes, PBP pipeline, audit formulas
### 2026-05-22 — league-averages pace fix, PPP segments
### 2026-05-21 — iOS dvh scroll fix, CoachHome routing fix
### 2026-05-20 — StatsPlayerSheet radar + 3P volume chip
### 2026-05-19 — sprint D ReportSlidesV1, StatsRadar SVG puro
### 2026-05-12 — U Stats Fase 1-2 backend + iOS white bar ThemePlugin
