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
- Aplicado en: `PlayerEditor.tsx`. Verificar otras páginas con dvh.

### PostgREST bulk insert
- Todos los JSON deben tener las mismas keys (usar null para opcionales).
- `Prefer: resolution=ignore-duplicates` para upserts seguros.

---

## ═══════════════════════════════
## MÓDULO U SCOUT
## ═══════════════════════════════

### Rutas activas
```
/coach               → CoachHome (4 contenedores: MyScout/FilmRoom/GamePlan/Personnel)
/coach/personnel     → Personnel (canónicas + sandbox + equipos)
/coach/my-scout      → MyScout (fichas sandbox del coach + StatsMiniChip)
/coach/quick-scout/:id → QuickScout (wizard adaptativo 7 ramas)
/coach/player/:id    → PlayerEditor (editor completo, iOS scroll fix ✅)
/coach/film-room     → FilmRoom (revisión colectiva anti-bias)
/coach/game-plan     → GamePlan (publicados al roster)
/coach/scout/:id/review  → ReportViewV4
/coach/scout/:id/preview → ReportSlidesV1
/coach/club          → ClubManagement (4 tabs: Club/Liga/Equipo/Stats)
/settings            → Settings (3 temas: Gamenight/Office/Oldschool)
```

### Flow correcto U Scout
```
head_coach/badge → Personnel → crear ficha CANÓNICA
cualquier coach  → MyScout  → edita su versión (PlayerEditor)
                 → View report (ReportViewV4) → OverridePanel → "→ Film Room"
Film Room        → detecta discrepancias → X/Y enviaron
                 → publica a Game Plan
Game Plan        → jugadoras ven en /player/report/:id → ReportSlidesV1
head_coach       → puede RETIRAR ficha (vuelve a Film Room)
```

### Motor
- Motor v4 activo (motor-v2.1.ts renombrado). 3 slides: ¿Quién es? / ¿Qué hará? / ¿Qué hago yo?
- `backup/motor-v2.1-pre-20260405` — rama backup, pendiente confirmar merge o descartar
- Motor v3 diseñado teóricamente pero no implementado (inputs → outputs alto nivel)

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

### Estado real de features U Scout

| Feature | Estado |
|---|---|
| Motor v4 + ReportSlidesV1 (3 slides) | ✅ |
| PlayerEditor iOS scroll | ✅ fix 2026-06-07 |
| hasReport fix MyScout (Primary/Secondary) | ✅ ya aplicado |
| OverridePanel.tsx (componente) | ✅ construido |
| OverridePanel wiring con report_overrides Supabase | ❌ sin conectar |
| ReportViewV4 simplificada (solo OverridePanel + "→ Film Room") | ❌ pendiente |
| FilmRoom como ÚNICO lugar de publicación | ❌ pendiente |
| Discrepancias entre coaches (inputs distintos → marcado automático) | ❌ pendiente |
| StatsMiniChip en MyScout (3 stats → deep link /stats?player=ID) | ⚠️ componente existe, verificar wiring |
| Integración U Stats → U Scout (stats WCBA en fichas rival) | ❌ sin implementar |
| player_stats tabla: UI entrada manual stats propias | ❌ pendiente |
| player_stats tabla: feed desde Pi (fuente WCBA para equipo propio) | ❌ pendiente |
| QuickScout wizard 7 ramas | ⚠️ existente, estado desconocido — leer antes de tocar |
| ClubManagement — tab Liga (leagueType, gender, level, ageCategory) | ❌ campos no existen en schema |
| ClubManagement — tab Stats (uso staff/jugadoras, discrepancias) | ❌ pendiente |
| Offline mode — write queue | ❌ diseñado, no implementado |
| backup/motor-v2.1-pre-20260405 — merge/discard | ❌ pendiente decisión |
| Favicon U Scout + logo imagen real | ❌ backlog |
| Simple vs Pro mode (usuarios amateur) | ❌ backlog |

---

## ═══════════════════════════════
## MÓDULO U PLAYBOOK
## ═══════════════════════════════

### Estado real

| Feature | Estado |
|---|---|
| Hub view (4 cards: Defensiva/Ofensiva/ATOs/Film) | ✅ |
| Wizard defensivo completo (v5, 12 secciones, ~41 pasos, condicionales) | ✅ |
| Planes guardados en localStorage | ✅ |
| Comparador de sistemas portado al app (3 planes, traffic lights) | ❌ solo en HTML standalone |
| Wizard ofensivo (sets, plays, transiciones) | ❌ sin implementar |
| Wizard ATOs | ❌ sin implementar |
| Film Room stub (placeholder vídeo táctico) | ❌ sin implementar |
| Persistencia en Supabase (actualmente localStorage) | ❌ pendiente |

### Wizard defensivo v5 — secciones implementadas
Identity · Off-Ball · Ball Screens (PnR coverage, ICE, DHO, Hot system) · Early Offense ·
Off-Ball Screens (pin-down, back screen, flare, stagger, DHO off-ball) · Spain PnR ·
Switch Management (rescram, X-out model Last/Next/Beaten, Barcelona zone) · Post Defense ·
Personnel · Transition · KYP (custom opponent rules)

---

## ═══════════════════════════════
## MÓDULO U STATS
## ═══════════════════════════════

### possessions.ts v6.6
- Playoff phases: `{27743, 27747, 27753, 27757}`
- unknown end_type (~35%): tiros fallados sin rebote defensivo en PBP. No rompe PPP.
- Fases WCBA 2092: 27172+27206 (regular, 192 partidos) · playoff (32)

### UI Stats
- PhaseToggle: Liga | Playoff | Todo — sitio A: jugadoras · sitio B: team sheet
- Multi-temporada: SEASON_LABELS 2092-2095. Solo 2092 existe actualmente.
- GameBoxscoreSheet: score header, cuartos, tabs H/A, sortable, totals, comparativa avanzada, prev/next
- Roster tab: `pickName(nameZh, nameEn, locale)` ✅
- Lineups: locale zh → `playerNamesZh`, es/en → `playerNamesEn` ✅

### Estado real de features U Stats

| Feature | Estado |
|---|---|
| Pipeline PBP completo | ✅ |
| Todas las métricas estándar (ORTG/DRTG/Pace/eFG%/PIE/USG%) | ✅ |
| PhaseToggle liga/playoff | ✅ |
| Multi-temporada infrastructure | ✅ |
| GameBoxscoreSheet prev/next | ✅ 2026-06-07 |
| StatsMiniChip en MyScout | ⚠️ verificar |
| Bubble chart (Phase 3) | ❌ pendiente |
| Radar comparator jugadoras (Phase 3) | ❌ pendiente |
| Shot chart (Fase 4 Pi: shot_zone data) | ❌ bloqueado |
| Hero card jugadoras (profiles tabla) | ❌ P3 backlog |

---

## ═══════════════════════════════
## MÓDULO U SCHEDULE
## ═══════════════════════════════

| Feature | Estado |
|---|---|
| MVP calendario + sesiones | ✅ |
| Scroll recentering List↔Planner | ✅ ya aplicado |
| Kebab landscape simplificado | ✅ ya aplicado |
| Tap=detail / long-press=edit (grid) | ✅ |
| Wellness standalone jugadoras (/player/wellness) | ❌ sin ruta propia |
| league_matches integration | ❌ pendiente |
| Recurring events | ❌ sin implementar |
| Attendance modes groups/signup UI completa | ⚠️ parcial |

---

## ═══════════════════════════════
## MÓDULO U WELLNESS
## ═══════════════════════════════

| Feature | Estado |
|---|---|
| Player check-ins | ✅ funcional |
| Acceso standalone (/player/wellness sin pasar por Schedule) | ❌ sin ruta |
| Dashboard coach (datos bienestar del equipo) | ❌ sin implementar |

---

## ═══════════════════════════════
## TRANSVERSAL / iOS
## ═══════════════════════════════

| Feature | Estado |
|---|---|
| recharts TDZ fix (vendor-react) | ✅ 2026-06-07 |
| iOS dvh scroll fix (Scout/Home/CoachHome/ReportSlidesV1/PlayerEditor) | ✅ |
| Bundle TestFlight <300KB (i18n lazy + React.lazy) | ❌ sesión dedicada |
| Figma/Rive SVG logo morph | ❌ backlog |
| Offline write queue | ❌ diseñado, no implementado |

---

## Pendientes ordenados por impacto

### P0 — Bloquea flujo real de uso
1. **ReportViewV4 + FilmRoom flow completo** — OverridePanel wiring + FilmRoom como único lugar de publicación + discrepancias entre coaches
2. **StatsMiniChip wiring** — verificar que el chip de stats en MyScout realmente enlaza con U Stats

### P1 — Funcionalidad importante sin entregar
3. **U Playbook — wizard ofensivo** + persistencia Supabase
4. **player_stats UI** — entrada manual de estadísticas propias (puente U Stats ↔ U Scout)
5. **Integración stats en fichas scout** — al editar jugadora rival, mostrar sus stats WCBA (PPG/RPG/AST/FG%) como contexto informativo
6. **Wellness standalone** — ruta /player/wellness
7. **U Playbook — comparador** portado desde HTML v5

### P2 — Mejora significativa
8. **Bundle iOS TestFlight** — sesión dedicada
9. **U Stats Phase 3** — bubble chart + radar comparator
10. **ClubManagement Liga tab** — leagueType, gender, level

### P3 — Backlog
11. **Shot chart** — bloqueado (Pi Fase 4)
12. **Motor v3 U Scout** — outputs de alto nivel
13. **Hero card jugadoras** (profiles PostgREST)
14. **backup/motor-v2.1-pre-20260405** — merge o discard
15. **Offline write queue**
16. **Recurring events** en Schedule

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
- `server/routes.ts` — API endpoints (Cursor only)
- `server/possessions.ts` — PBP processor v6.6
- `client/src/lib/stats-api.ts` — hooks TanStack Query
- `client/src/pages/core/Stats.tsx` — U Stats (god file, leer en chunks)
- `client/src/components/GameBoxscoreSheet.tsx` — boxscore prev/next
- `client/src/pages/scout/PlayerEditor.tsx` — editor fichas (iOS scroll fix ✅)
- `client/src/pages/scout/ReportViewV4.tsx` — override flow pendiente
- `client/src/pages/scout/FilmRoom.tsx` — publicación pendiente
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
7. toISOString() → UTC, no local. Usar toLocaleDateString("sv") para fechas en China
8. recharts debe ir en mismo chunk que react; nunca en vendor-charts separado

---

## Historial sesiones

### 2026-06-07 — iOS fixes + Boxscore + Multi-season + Nav + U Scout scroll + Nombres
- iOS TDZ recharts resuelto (vendor-react)
- GameBoxscoreSheet completo con prev/next nav
- SEASON_LABELS 2092-2095
- PlayerEditor iOS scroll (app-shell pattern)
- Roster locale fix + lineups nombres (19 stubs insertados)
- Commits: 07536a4, a10282e, 8a0757c, a906cf0, b0e5309, d354b7c, 1703b20

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
### 2026-05-08 — StatsRadar recharts + boxscore field mapping fix
### 2026-05-05 — U Playbook defensive wizard v5, UX audit U Stats
### 2026-05-04 — U Stats datos + sync architecture
### 2026-05-03 — sync WCBA, Pi collector, Stats Fase 1
### 2026-05-01 — hasReport fix, Schedule scroll+kebab, OverridePanel build
