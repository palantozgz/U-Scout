# U Core — Contexto para Claude

> Leer este archivo al inicio de cada sesión antes de proponer cualquier cambio.
> Claude SIEMPRE actualiza este archivo al cierre de sesión usando filesystem:write_file.
> Claude NUNCA pide a Pablo que edite este archivo manualmente.

---

## Producción
- URL: https://u-scout-production.up.railway.app
- Deploy: Railway, auto-deploy en push a `main`
- DB: Supabase (PostgreSQL)
- Repo local: `/Users/palant/Downloads/U scout`

## Stack
React + TypeScript + Vite · Express · Drizzle ORM · TanStack Query · shadcn/ui · Tailwind v4

## Archivos clave
- `client/src/lib/motor-v4.ts` — scoring layer
- `client/src/lib/motor-v2.1.ts` — motor base
- `client/src/lib/reportTextRenderer.ts` — texto EN/ES/ZH con gender
- `client/src/lib/mock-data.ts` — playerInputToMotorInputs, clubRowToMotorContext
- `client/src/pages/scout/ReportSlidesV1.tsx` — 3 slides
- `client/src/pages/scout/ReportViewV4.tsx` — shell coach_review con OverridePanel
- `client/src/pages/scout/PlayerEditor.tsx` — editor inputs jugador
- `client/src/pages/scout/Personnel.tsx` — gestión plantillas + import WCBA (header responsive ✅)
- `client/src/pages/scout/MyScout.tsx` — fichas coach (canónicas + sandbox) + StatsMiniChip ✅
- `client/src/pages/core/Schedule.tsx` — god file ~228KB (U Schedule)
- `client/src/pages/core/Stats.tsx` — U Stats: 3 tabs + SeasonPicker + StatsPlayerSheet ✅
- `client/src/lib/stats-api.ts` — hooks completos: usePlayerSeasonStats, useGameLog, useSeasons, useStandings, useLeaders, usePlayerDetail ✅
- `client/src/components/LandscapeHint.tsx` — componente rotate hint ✅
- `server/routes.ts` — rutas API Express
- `server/stats-ingest.ts` — ingest endpoint Pi → Railway → Supabase
- `collector/src/sync/pbp.ts` — mapeo action_codes WCBA real (completo)
- `collector/src/sync/boxscores.ts` — syncPlayerBoxscore via /playerdata

## i18n — arquitectura lazy
- `client/src/lib/i18n-core.ts` — runtime lazy: EN estático, ES/ZH async

## Tailwind v4
- NO hay tailwind.config.js — usa `@theme inline` en `client/src/index.css`

## NUNCA tocar
- `Profile.tsx` · `schema.ts` · `migrations/`
- SQL destructivo: solo Supabase SQL Editor, nunca `drizzle-kit push`

---

## Estado app — 4 mayo 2026 (sesión p15 — CIERRE)

### Completado esta sesión ✅
1. `GET /api/stats/player/:externalId` — ficha completa con promedios temporada + game log (30 partidos)
   - MPG calculado correctamente desde `minutes text` "MM:SS" via SPLIT_PART / 60
   - rivalName y score con subquery para resolver home_team_id (integer FK) a external_id
2. `PlayerDetail` + `GameLogEntry` interfaces en stats-api.ts
3. `usePlayerDetail(externalId)` hook en stats-api.ts
4. `StatsPlayerSheet` componente en Stats.tsx:
   - Header: nombre (EN/ZH según locale) + dorsal + equipo + posición + nº partidos
   - Averages grid: PPG/RPG/APG + SPG/BPG/TOPG/MPG + FG%/3P%/FT%
   - `LandscapeHint` inline (shot chart placeholder)
   - Game log: últimos 30 partidos, columnas fecha/rival/PTS/REB/AST/MIN/+/-
   - +/- coloreado (verde positivo, rojo negativo)
   - Titular badge cuando `isStart = true`
5. `minutesToDisplay()` helper — convierte "MM:SS" text a display legible
6. Deep link completo: `?player=EXTERNAL_ID` en URL → abre StatsPlayerSheet directa
7. Líderes: cada fila es tappable → abre StatsPlayerSheet de esa jugadora
8. Personnel: fix importación WCBA (prompt ejecutado) — sin segundo selector, auto-crea equipo
9. Fix `minutes ~ '^\d+:\d{2}$'` — operador regex válido para columna text

### Estado sync al cierre sesión p15
```
stats_games con score:    ~224 (sync boxscores corriendo — Ingest OK boxscores confirmado)
stats_player_boxscores:     0 → sync player_boxscores empieza cuando boxscores terminen (~5 min)
stats_pbp:            116.700 ✅
```

### Al iniciar próxima sesión — verificar PRIMERO
```sql
SELECT
  (SELECT COUNT(*) FROM stats_player_boxscores) as player_boxscores,
  (SELECT COUNT(*) FROM stats_pbp) as pbp_eventos,
  (SELECT COUNT(*) FROM stats_games WHERE home_score > 0) as games_con_score;
```
- `player_boxscores > 3000` → datos reales disponibles, probar StatsPlayerSheet en producción
- Si `player_boxscores = 0` y `games_con_score = 224` → sync player_boxscores falló, revisar logs Pi:
  `ssh pablo@192.168.1.59 "grep -E 'PlayerBoxscore|player_box' ~/.pm2/logs/ucore-collector-out.log | tail -20"`

### 🔴 OBJETIVO PRÓXIMA SESIÓN
1. Verificar SQL → si player_boxscores > 0, probar StatsPlayerSheet en producción
2. Desde tab Jugadoras: hacer filas tappables → abrir StatsPlayerSheet (actualmente solo desde Líderes)
3. `StatsTeamSheet` — ficha equipo (standings data ya disponible)
4. Añadir botón "Ver ficha" en StatsMiniChip de MyScout → deep link funcional end-to-end

### 🔴 RIESGOS ACTIVOS
- P1 `player_boxscores` — sync corriendo, verificar al inicio
- P1 Schedule scroll List→Planner: no recentra en hoy (pendiente)
- P2 hasReport — verificar con datos reales

### 🔴 BACKLOG COMPLETO

#### U Stats
- Jugadoras tab: filas tappables → StatsPlayerSheet (solo abre desde Líderes ahora)
- `StatsTeamSheet` — ficha equipo con plantilla + métricas
- `StatsRadar` recharts 6 ejes (portrait behind tap)
- Shot chart landscape (SVG/canvas, hexbin) — LandscapeHint placeholder ya en StatsPlayerSheet
- `StatsComparator` landscape split view
- Bubble chart liga (freq vs eficiencia, referencia elradardelscout.com)
- Scraping histórico temporadas [1767, 1470, 1108, 873, 428, 253...]

#### Personnel — gestión de temporadas (diseño aprobado)
- **"Borrar todo" manual**: opción head_coach para borrar TODOS equipos+fichas canónicas de golpe. Destructiva, doble confirmación, iniciada por coach, nunca automática.
- **Migración asistida**: al importar nueva temporada, match por `name_zh` exacto → migradas conservan scouting, nuevas vacías, ausentes → inactivas (nunca borrar automáticamente).
- **"Importar liga completa"**: iterar todos equipos WCBA de una vez (sesión separada).
- **Nombres WCBA**: `stats_teams` solo tiene `name_zh`. `stats_players` tiene `name_en` (pinyin).

#### U Scout
- PlayerEditor: auditoría completa campos (section headers → field-by-field)
- ReportViewV4 → diseño 3 slides
- `backup/motor-v2.1-pre-20260405` → merge a main

#### Platform
- Favicon U Scout logo
- Club logo: upload imagen real
- "Simple vs Pro" mode usuarios amateur
- Iconos output: diseñar en Figma con referencias — NUNCA SVG sin referencias
- Branding: Figma → Rive morph animation
- Telegram Pi: bloqueado GFW
- TestFlight: Apple Developer ($99/año) + Xcode

---

## Raspberry Pi 5
- IP: 192.168.1.59 · SSH: pablo@192.168.1.59
- Node 20 + PM2 · Collector en ~/ucore/collector
- Telegram: BLOQUEADO por GFW
- Deploy Pi: `cd ~/ucore/collector && npm run build && pm2 restart ucore-collector`
- Logs: `ssh pablo@192.168.1.59 "tail -f ~/.pm2/logs/ucore-collector-out.log"`
- Re-sync manual: `pm2 restart ucore-collector` (ejecuta runNightlySync() al arrancar)

## API WCBA — endpoints confirmados
```
teamrankfirst?competitionId=56&seasonId=X          → standings ✅
matchschedules?...teamId='' REQUERIDO              → schedule ✅
teamplayers?seasonId=X&teamId=Y                    → roster ✅
hotspotdata?gameId=Y&periods=...                   → shot chart ✅
/api/v2/game/:id/actions                           → PBP ✅
/datahub/cbamatch/games/player/playerdata?gameId=X → boxscore individual ✅
matchinfoscores?matchId=X&gameId=Y                 → score+cuartos ✅
  ⚠ scores en data.home.teamScore / data.away.teamScore
  ⚠ cuartos en data.home.periodScores "Q1;Q2;Q3;Q4"
playerbasicpage → 404 PERMANENTE (descartado)
```

## PBP — action_codes WCBA reales confirmados
```
SUBONC=sub_in, SUBOFF=sub_out
2PM*=shot_made, 2PA*=shot_missed (JMP/LAY/DLA/HOK/TIP/FLO/TLA/SBK/TRN/FAD/FLT/PUL)
3PM*=shot_made_3, 3PA*=shot_missed_3 (JMP/COR/SBK/FAD/PUL)
FTH*M=ft_made, FTH*A=ft_missed (11/21/22/31/32/33)
REBDEF=rebound(defensive), REBOFN=rebound(offensive)
ASSIST=assist, STEBAL=steal, BLKBAL=block, BLKSHT=block
FOLDEF/FOLOFF/FOLUSM/FOLTEC=foul, FDRAWN=foul_drawn, FOLOFN=foul
TNO*=turnover (varios), TMOLEG/TMOILL=timeout
STRTPD=period_start, ENDPD=period_end, JUBSUC/JUBFAL=jumpball
⚠ Unmapped no críticos: 3PASBK/3PMSBK, TNOOBD
```

## Temporadas WCBA
```
2092 (activa 2024-25), 1767, 1470, 1108, 873, 428, 253, 236, 228, 245, 189, 175
```

## Schema Supabase stats_*
```
stats_teams (18)            — external_id, name_zh, logo_url, competition_id (NO name_en)
stats_players (307)         — external_id, name_zh, name_en, team_id, jersey_number, position
stats_games (224)           — external_game_id, season_id, home/away scores, status
stats_standings (18)        — rank, wins, losses, win_pct, pts_per_game, pts_against_per_game
stats_player_boxscores      — game_id, player_external_id, pts/reb/ast/stl/blk/tov/min(text)/fg/3p/ft
  ⚠ minutes columna TEXT formato "MM:SS" — usar SPLIT_PART para cálculos, operador ~ válido
  ⚠ NO tiene columna updated_at — bug corregido en stats-ingest.ts
stats_pbp (116.700)         — game_id, sequence, event_type, shot_x/y/made, etc.
CONSTRAINT eliminada: stats_pbp_team_id_fkey
```

## Endpoints Railway implementados
```
GET  /api/stats/teams          ✅
GET  /api/stats/players        ✅ promedios temporada
GET  /api/stats/games          ✅ game log por jugadora
GET  /api/stats/standings      ✅ clasificación
GET  /api/stats/leaders        ✅ top 15 por stat (ppg/rpg/apg/spg/bpg/fgPct)
GET  /api/stats/player-link    ✅ match nombre → externalId + ppg/rpg/apg
GET  /api/stats/seasons        ✅ DISTINCT season_id WHERE status=4
GET  /api/stats/player/:id     ✅ ficha completa + game log 30 partidos
POST /api/stats/import-team    ✅
POST /api/stats/ingest         ✅

PENDIENTES:
GET  /api/stats/team/:id       → ficha equipo con plantilla + métricas
```

---

## U Stats — componentes

### Implementados ✅
- `LandscapeHint.tsx` — con `useIsLandscape()` hook
- `Stats.tsx` — 3 tabs + SeasonPicker + StatsPlayerSheet + deep link
- `StatsMiniChip` — en MyScout.tsx, fichas canónicas, apiRequest Bearer
- `StatsPlayerSheet` — en Stats.tsx, averages + LandscapeHint + game log

### Pendientes
- Jugadoras tab: tap fila → StatsPlayerSheet (ahora solo desde Líderes)
- `StatsTeamSheet`
- `StatsRadar` recharts 6 ejes
- `StatsComparator` landscape split

### Deep link
`/stats?tab=jugadoras&player=EXTERNAL_ID` → Stats.tsx → StatsPlayerSheet ✅

---

## Reglas entrega código
- NUNCA "añade estas líneas aquí"
- Siempre: archivo completo, O comando terminal, O prompt Cursor
- npm run check después de cada cambio
- Migrations destructivas: raw SQL Supabase, nunca drizzle-kit push
- Railway: esbuild en dependencies (no devDependencies)
- Tailwind v4: animaciones en index.css, NO en tailwind.config

## Notas (trampas conocidas)
- bash_tool corre en Linux — NO accede al Mac. Usar Filesystem MCP
- filesystem:write_file parámetro "content" (no "file_text")
- Cursor duplica handlers en routes.ts — verificar siempre
- stats_pbp.team_id = external ID de API (FK eliminada)
- stats_player_boxscores.minutes = TEXT "MM:SS" — SPLIT_PART para AVG
- `sql.raw()` solo para allowlist fija (leaders stat expr)
- Pi re-sync: pm2 restart ejecuta runNightlySync() inmediatamente al arrancar

## Scripts
```bash
cd "/Users/palant/Downloads/U scout" && npx tsx scripts/calibrate-motor.ts
cd "/Users/palant/Downloads/U scout" && npx tsx scripts/eval-motor-quality.ts
```

## Club INNER MONGOLIA
- Club ID: 4bca3aa8-9062-4709-9d29-9e2313308f1a
- Pablo (b334e51a) = owner + head_coach

## TestFlight — checklist
- [ ] Apple Developer Program ($99/año)
- [ ] Xcode
- [x] Info.plist permisos (NSCamera + NSPhotoLibrary)
- [x] Portrait-only + LandscapeHint para vistas landscape
- [ ] npx cap sync + iconos + code signing
