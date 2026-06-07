# U Core — Contexto para Claude

> Leer este archivo al inicio de cada sesión antes de proponer cualquier cambio.
> Claude SIEMPRE actualiza este archivo al cierre de sesión.

---

## Producción
- URL: https://u-scout-production.up.railway.app
- Deploy: Railway, auto-deploy en push a `main`
- DB: Supabase (PostgreSQL)
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
| SSH Pi | `/usr/bin/ssh -i /Users/palant/.ssh/pi_ucore pablo@192.168.1.7` |

### Credenciales
```
SUPA_URL = https://ybpzvkkxcmwwxrrouyhm.supabase.co
SK       = grep SUPABASE_SERVICE_ROLE_KEY /Users/palant/Downloads/U\ scout/.env | cut -d= -f2
Pi       = 192.168.1.7  pablo  skapol
```

### Pi
- Watchdog daemon activo (systemd) + dtparam en config.txt
- SSD /dev/sda2, 117GB. Collector commit d51e98f.
- Conectar con: `/usr/bin/ssh -i /Users/palant/.ssh/pi_ucore -o StrictHostKeyChecking=no pablo@192.168.1.7`

---

## Principios de datos

1. PBP es fuente única de verdad
2. NUNCA estimar. Sin hardcodes
3. `team_id` en tablas derivadas = SIEMPRE internal id (1-18)
4. `stats_pbp.team_id` = external_id. En audit usar `tid` (internal)

---

## Arquitectura

```
API WCBA → collector Pi → stats_pbp → possessions.ts v6.6 (Railway) → tablas derivadas
```

### possessions.ts v6.6
- v6.3: extToInt bidireccional
- v6.4: offFg3m/Fga/Fta en LineupStats; fix audit tid
- v6.5: skip playerExternalId null/'null'/inválido
- v6.6: `phase_type` ('regular'|'playoff') en las 3 tablas derivadas
  - `PLAYOFF_PHASES = {27743, 27747, 27753, 27757}`

### Fases WCBA temporada 2092
```
27172 → 132 partidos → Grupo A (liga regular)
27206 →  60 partidos → Grupo B (liga regular)
27743/27747/27753/27757 → 32 partidos → Playoffs
```

---

## Estado DB — 2026-06-07 ✅

- `pbp_audit_log`: ok=444, error=2 (partido 286 — boxscore vacío, aceptado)
- `pbp_possessions`: ~43k regular + ~5k playoff ✅
- `pbp_player_game_stats`: poblado ✅
- `pbp_lineup_stats`: ~6k filas ✅
- `stats_players name_zh IS NULL`: 0 filas ✅
- 19 jugadoras stub insertadas (team#XXXX) — jugadoras de otros equipos sin roster sync. Se sobreescribirán con nombres reales en próximo Pi roster sync (temporada 2026-27).

---

## UI Stats — arquitectura actual

### PhaseToggle
- Componente reutilizable: Liga | Playoff | Todo
- Sitio A: encima lista Jugadoras · Sitio B: dentro StatsTeamSheet
- Estado en `localStorage('stats-phase-type')`

### Multi-temporada
- `/api/stats/seasons` deriva temporadas de `stats_games`
- `SEASON_LABELS` en routes.ts: 2092→"2025-26", 2093→"2026-27", hasta 2095
- Season picker UI existe con localStorage persistence
- `effectiveSeasonId` propagado a todos los endpoints
- Solo temporada 2092 existe actualmente

### GameBoxscoreSheet (`client/src/components/GameBoxscoreSheet.tsx`)
- Score header + scores grandes + ganador resaltado
- Quarter breakdown (Q1-Q4 + TOT)
- Tabs Home / Away
- Tabla sortable por cualquier columna (PTS/REB/AST/ROB/TAP/PER/+−/FG/3P/TL)
- Fila TOTAL al pie
- Comparativa avanzada: eFG%, FG%, 3P%, FT%, TOV%, FT Rate (verde = ganador)
- **Prev/Next navigation** entre partidos con contador "N / Total"
- Wired en StatsPlayerSheet (sobre sortedGameLog) y StatsTeamSheet (sobre teamGameLog)

### Columna central dinámica en desktop (centerView)
- roster / playerList / standings / default según estado de selección

### Nombres en U Stats
- Roster tab: `pickName(nameZh, nameEn, locale)` — respeta locale ✅
- Lineups: locale zh → `playerNamesZh`, es/en → `playerNamesEn` ✅
- Fallback numeric IDs: muestra `Jug.` (es) / `球员` (zh)

---

## Endpoints de stats

Todos aceptan `?phaseType=regular|playoff|all` (default: `regular`).
W/L en standings siempre de `stats_standings` sin filtro.

---

## Bugs activos

**P1 — resueltos esta sesión:**
- iOS pantalla negra en U Stats al entrar equipo → resuelto (recharts TDZ)
- Scroll bloqueado en editor fichas U Scout → resuelto (app-shell pattern)
- Nombres roster no respetaban locale → resuelto
- Lineups mostraban números → resuelto (19 stubs + fallback mejorado)

**P2 — pendientes:**
- `pointsByZone` 70/30 hardcodeado — pendiente shot_x/y/zone (Fase 4 Pi)
- Partido 286 audit error — boxscore vacío (aceptado)
- Hero card jugadoras (`profiles` no expuesto en PostgREST) — P3 backlog

---

## Notas técnicas importantes

### iOS Capacitor — recharts TDZ (CRÍTICO)
- `vite.config.ts`: recharts + d3 + victory-vendor van en `vendor-react` (mismo chunk que react).
- **NUNCA crear chunk separado `vendor-charts` para recharts** → TDZ crash en iOS WebKit.

### iOS Capacitor — scroll en páginas full-height
- Patrón correcto: root div `h-[100dvh] overflow-hidden` + main `flex-1 overflow-y-auto`
- **NUNCA usar `min-h-[100dvh]`** sin `overflow-y-auto` en el contenedor scrollable.
- Aplicado en: `PlayerEditor.tsx`. Revisar si hay otras páginas con el mismo patrón.

### unknown end_type en pbp_possessions (~35%)
- Causa: WCBA PBP no loguea rebote defensivo consistentemente.
- `unknown` possessions: `points=0`, `shot_attempts>0`. No rompe PPP ni pace-segments.

### stats_players — jugadoras stub
- 19 jugadoras con nombre `equipo#XXXX` o `球员#XXXX` — stubs sin nombre real.
- Se sobreescribirán en próximo roster sync del Pi (inicio temporada 2026-27).

---

## Pendientes próxima sesión

### U Stats
1. **T4 shot chart** — `shot_zone IS NOT NULL = 0 filas`. Bloqueado hasta Pi Fase 4.
2. **Verificar boxscore en prod** — GameBoxscoreSheet: prev/next, tabs, comparativa.
3. **GameBoxscoreSheet → Cursor prompt pendiente** — integrar en Stats.tsx si no se aplicó aún.

### U Scout
4. **ReportViewV4 → 3-slide redesign** — formato aprobado: Slide 1 = ¿Quién es?, Slide 2 = ¿Qué hará?, Slide 3 = ¿Qué hago yo?
5. **OverridePanel** — integración frontend con Supabase (componente construido, sin wiring).
6. **`hasReport` fix en MyScout** — prompt listo, no aplicado.
7. **Schedule bugs**: scroll no recentra en List↔Planner toggle (P1); kebab tap=detail / long-press=edit (P1).

### iOS / Bundle
8. **T5 bundle iOS** — sesión dedicada: i18n lazy loading (−120KB) + React.lazy code splitting (−100KB) → ~290KB gzip → TestFlight.
9. **Revisar patrón scroll iOS** en otras páginas del app (mismo patrón que PlayerEditor).

---

## Scripts de mantenimiento

| Script | Uso |
|---|---|
| `scripts/fast_reprocess.py [--reset]` | **Canónico.** Paralelo x6, ~15min. |
| `scripts/monitor_game.py` | Diagnóstico por partido. |
| `scripts/seq_reprocess.py` | ❌ timeout Railway |
| `scripts/sync_reprocess.py` | ❌ timeout Railway |

---

## Estándares de código

1. Leer código real antes de proponer
2. `npm run check` exit 0 antes de cada commit
3. Cursor para `routes.ts`
4. SQL destructivo — solo Supabase SQL Editor
5. NUNCA tocar `Profile.tsx`, `schema.ts`, `migrations/`
6. Tras Cursor: `grep -n 'app.get.*api/stats' server/routes.ts` para detectar duplicados

---

## Lecciones aprendidas

1. `String(null) = 'null'` — filtrar playerExternalId antes de INSERT integer
2. Railway procesa en background — esperar Supabase, no HTTP response
3. `fast_reprocess.py` paralelo x6 correcto; seq/sync dan timeout
4. recharts TDZ en iOS: mantener en vendor-react, nunca separar en chunk propio
5. iOS scroll: `min-h-[100dvh]` sin `overflow-y-auto` → scroll bloqueado en WKWebView
6. PostgREST bulk insert: todos los objetos deben tener las mismas keys (usar null para opcionales)
7. `Prefer: resolution=ignore-duplicates` para upserts seguros via REST

---

## Archivos clave
- `server/routes.ts` — endpoints API (editar solo via Cursor)
- `server/possessions.ts` — procesador PBP v6.6
- `client/src/lib/stats-api.ts` — hooks TanStack Query
- `client/src/pages/core/Stats.tsx` — página principal U Stats
- `client/src/components/GameBoxscoreSheet.tsx` — boxscore con nav prev/next
- `client/src/pages/scout/PlayerEditor.tsx` — editor fichas U Scout
- `scripts/fast_reprocess.py` — reprocesado canónico

## NUNCA tocar
- `Profile.tsx` · `schema.ts` · `migrations/`

---

## Historial de sesiones

### Sesión 2026-06-07 — iOS fixes + Boxscore + Multi-season + Nav UX + U Scout scroll + Nombres
- **iOS TDZ recharts:** vendor-charts eliminado, recharts absorbido en vendor-react
- **GameBoxscoreSheet:** score header, cuartos, tabs equipo, tabla sortable, totals, comparativa avanzada, prev/next nav
- **Multi-season labels:** SEASON_LABELS 2092-2095 en routes.ts
- **Stats.tsx iOS:** min-h fallback, bg-background, null guard externalId
- **PlayerEditor.tsx iOS scroll:** h-[100dvh] overflow-hidden + main overflow-y-auto
- **Roster locale:** pickName respeta locale en tab plantilla
- **Lineups nombres:** 19 stubs insertados + fallback Jug./球员
- Commits: 07536a4, a10282e, 8a0757c, a906cf0, b0e5309, d354b7c

### Sesión 2026-06-06 — phase_type + UX Stats desktop + PhaseToggle + centerView
### Sesión 2026-06-03 — possessions v6.5/v6.6, reprocesado
### Sesión 2026-06-02 — possessions v6.3-v6.5, watchdog Pi
### Sesión 2026-05-31 — possessions v6.3
### Sesión 2026-05-30 — audit fórmulas
### Sesión 2026-05-27 — shotZones, infraestructura
