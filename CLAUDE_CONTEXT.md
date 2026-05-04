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
- `collector/src/ingest.ts` — fetchSyncStatus() ✅ + ingest()
- `collector/src/sync/pbp.ts` — syncNewPBP incremental (skip games ya en DB) ✅
- `collector/src/sync/boxscores.ts` — syncNewPlayerBoxscores incremental ✅ + fix Array API
- `collector/src/force-player-boxscores.ts` — script one-shot para re-sync manual

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
1. `GET /api/stats/player/:externalId` — ficha completa con promedios temporada + game log 30 partidos
   - MPG: SPLIT_PART(minutes,':',1)*60 + SPLIT_PART(minutes,':',2) / 60 (columna text "MM:SS")
   - rivalName y score: subquery para resolver home_team_id FK → external_id
2. `PlayerDetail` + `GameLogEntry` interfaces + `usePlayerDetail` hook en stats-api.ts
3. `StatsPlayerSheet` en Stats.tsx: averages grid + LandscapeHint + game log 30 partidos
4. `minutesToDisplay()` helper — convierte "MM:SS" text a display legible
5. Deep link completo: `?player=EXTERNAL_ID` → abre StatsPlayerSheet directa
6. Líderes: cada fila tappable → abre StatsPlayerSheet
7. **Fix crítico collector**: API `/playerdata` devuelve array `[{teamType,teamPlayerData}]` no `{home,away}` → `Array.isArray(d)` con `find(teamType==='Home')`
8. **Fix duplicate key**: `2PAPUL` duplicado en pbp.ts eliminado
9. **Arquitectura incremental sync**:
   - `GET /api/stats/sync-status` en Railway → devuelve gameIds ya en DB para pbp y player_boxscores
   - `fetchSyncStatus()` en collector/src/ingest.ts
   - `syncNewPBP` y `syncNewPlayerBoxscores` filtran solo gameIds pendientes
   - Sync nightly: ~10 min en vez de ~5 horas una vez datos cargados
10. `collector/src/force-player-boxscores.ts` — script one-shot (npx tsx)

### Estado DB al cierre sesión p15
```
stats_teams:              18 ✅
stats_games:             224 ✅ (223 con status=4, 1 cancelado/aplazado)
stats_standings:          18 ✅
stats_players:           307 ✅
stats_pbp:           116.700 ✅
stats_player_boxscores: 1.564 ✅ (subiendo — sync en curso)
```

### Al iniciar próxima sesión — verificar PRIMERO
```sql
SELECT
  (SELECT COUNT(*) FROM stats_player_boxscores) as player_boxscores,
  (SELECT COUNT(*) FROM stats_pbp) as pbp_eventos;
```
Target: `player_boxscores > 3000` (223 partidos × ~14 jugadoras/partido)

Si < 3000: revisar logs Pi
```bash
ssh pablo@192.168.1.59 "grep -E 'PlayerBoxscore synced|player boxscores done|boxscores done' ~/.pm2/logs/ucore-collector-out.log | tail -10"
```

### 🔴 OBJETIVO PRÓXIMA SESIÓN
1. Verificar SQL → probar StatsPlayerSheet en producción con datos reales
2. Tab Jugadoras: hacer filas tappables → StatsPlayerSheet (ahora solo desde Líderes)
3. `StatsTeamSheet` — ficha equipo
4. StatsMiniChip deep link end-to-end verificado en producción

### 🔴 RIESGOS ACTIVOS
- P1 Schedule scroll List→Planner: no recentra en hoy (pendiente)
- P2 hasReport — verificar con datos reales

### 🔴 BACKLOG COMPLETO

#### U Stats
- Jugadoras tab: tap fila → StatsPlayerSheet (solo abre desde Líderes ahora) — PRÓXIMA
- `StatsTeamSheet` — ficha equipo con plantilla + métricas — PRÓXIMA
- `StatsRadar` recharts 6 ejes (portrait behind tap)
- Shot chart landscape (hexbin) — LandscapeHint placeholder ya en StatsPlayerSheet
- `StatsComparator` landscape split view
- Bubble chart liga (freq vs eficiencia, referencia elradardelscout.com)
- Scraping histórico temporadas [1767, 1470, 1108, 873, 428, 253...]

#### Personnel — gestión de temporadas (diseño aprobado)
- **"Borrar todo" manual**: head_coach borra TODOS equipos+fichas canónicas de golpe. Destructiva, doble confirmación, nunca automática.
- **Migración asistida**: match por `name_zh` exacto → migradas conservan scouting, nuevas vacías, ausentes → inactivas.
- **"Importar liga completa"**: iterar todos equipos WCBA (sesión separada).
- **Nombres WCBA**: `stats_teams` solo `name_zh`. `stats_players` tiene `name_en` (pinyin).

#### U Scout
- PlayerEditor: auditoría completa campos
- ReportViewV4 → diseño 3 slides
- `backup/motor-v2.1-pre-20260405` → merge a main

#### Platform
- Favicon + Club logo upload real
- "Simple vs Pro" mode
- Iconos output: Figma con referencias reales — NUNCA SVG sin referencias
- Branding: Figma → Rive
- TestFlight: Apple Developer ($99/año) + Xcode

---

## Raspberry Pi 5
- IP: 192.168.1.59 · SSH: pablo@192.168.1.59
- Node 20 + PM2 · Collector en ~/ucore/collector
- Telegram: BLOQUEADO por GFW
- Deploy Pi: SCP archivos individuales desde Mac + `npm run build && pm2 restart ucore-collector` en Pi
- Re-sync manual: `pm2 restart ucore-collector` (ejecuta runNightlySync() al arrancar)
- Script one-shot: `npx tsx src/force-player-boxscores.ts` (se cuelga por axios keepalive — usar pm2 restart)
- ⚠️ `node -e "require('./dist/...')"` se cuelga — no usar para scripts one-shot

## Sync incremental — arquitectura
```
GET /api/stats/sync-status (Railway, auth: STATS_INGEST_KEY)
  → { pbpDone: number[], boxDone: number[] }  (external_game_id arrays)

collector/src/ingest.ts: fetchSyncStatus()
  → llama al endpoint, devuelve arrays, en caso de fallo devuelve [] (procesa todo)

syncNewPlayerBoxscores(gameIds):
  → fetchSyncStatus() → filtra pending = gameIds - boxDone → procesa solo pending
  → log: { total, pending, skipped }

syncNewPBP(gameIds):
  → fetchSyncStatus() → filtra pending = gameIds - pbpDone → procesa solo pending
  → log: { total, pending, skipped }

Sync nightly estimado con datos completos: ~10 min (vs ~5h sin incremental)
```

## API WCBA — endpoints confirmados
```
teamrankfirst?competitionId=56&seasonId=X          → standings ✅
matchschedules?...teamId='' REQUERIDO              → schedule ✅
teamplayers?seasonId=X&teamId=Y                    → roster ✅
hotspotdata?gameId=Y&periods=...                   → shot chart ✅
/datahub/cbamatch/games/player/playerdata?gameId=X → player boxscores ✅
  ⚠ devuelve ARRAY: [{teamType:'Home',teamPlayerData:[...]},{teamType:'Away',...}]
  ⚠ NO es {home:{players:[]},away:{players:[]}}
matchinfoscores?matchId=X&gameId=Y                 → score+cuartos ✅
playerbasicpage → 404 PERMANENTE (descartado)
```

## PBP — action_codes WCBA confirmados
```
SUBONC/SUBOFF=sub, 2PM*/2PA*=shot_made/missed, 3PM*/3PA*=3pt
FTH*M/A=ft, REBDEF/REBOFN=reb, ASSIST=ast, STEBAL=stl, BLKBAL/BLKSHT=blk
FOLDEF/FOLOFF/FOLUSM/FOLTEC=foul, FDRAWN=foul_drawn
TNO*=turnover, TMOLEG/TMOILL=timeout
STRTPD=period_start, ENDPD=period_end, JUBSUC/JUBFAL=jumpball
⚠ Unmapped no críticos: 3PASBK/3PMSBK, TNOOBD, 2PMPUL, 3PATRN, TNO8SC
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
  ⚠ 223 con status=4, 1 cancelado/aplazado
stats_standings (18)
stats_player_boxscores      — minutes columna TEXT "MM:SS", NO updated_at
  ⚠ API devuelve teamPlayerData no players
stats_pbp (116.700)
CONSTRAINT eliminada: stats_pbp_team_id_fkey
```

## Endpoints Railway implementados
```
GET  /api/stats/teams          ✅
GET  /api/stats/players        ✅
GET  /api/stats/games          ✅
GET  /api/stats/standings      ✅
GET  /api/stats/leaders        ✅ (ppg/rpg/apg/spg/bpg/fgPct)
GET  /api/stats/player-link    ✅
GET  /api/stats/seasons        ✅
GET  /api/stats/player/:id     ✅ ficha completa + game log 30 partidos
GET  /api/stats/sync-status    ✅ (auth: STATS_INGEST_KEY) pbpDone + boxDone
POST /api/stats/import-team    ✅
POST /api/stats/ingest         ✅

PENDIENTES:
GET  /api/stats/team/:id       → ficha equipo con plantilla + métricas
```

## U Stats — componentes
### Implementados ✅
- `LandscapeHint.tsx`
- `Stats.tsx` — 3 tabs + SeasonPicker + StatsPlayerSheet + deep link ?player=
- `StatsMiniChip` — MyScout.tsx, fichas canónicas, apiRequest Bearer
- `StatsPlayerSheet` — averages + LandscapeHint + game log 30 partidos

### Pendientes
- Jugadoras tab: tap fila → StatsPlayerSheet
- `StatsTeamSheet`
- `StatsRadar` recharts 6 ejes
- `StatsComparator` landscape split

---

## Reglas entrega código
- NUNCA "añade estas líneas aquí"
- Siempre: archivo completo, O comando terminal, O prompt Cursor
- npm run check después de cada cambio
- Collector: `npm run build` en collector/ + SCP + `npm run build && pm2 restart` en Pi
- Migrations destructivas: raw SQL Supabase, nunca drizzle-kit push
- Railway: esbuild en dependencies (no devDependencies)
- Tailwind v4: animaciones en index.css, NO en tailwind.config

## Notas (trampas conocidas)
- bash_tool corre en Linux — NO accede al Mac. Usar Filesystem MCP
- filesystem:write_file parámetro "content" (no "file_text")
- Cursor duplica handlers en routes.ts — verificar siempre
- stats_player_boxscores.minutes = TEXT "MM:SS" — SPLIT_PART para AVG, NO ::interval
- `sql.raw()` solo para allowlist fija
- `node -e "require('./dist/...')"` se cuelga en Pi — no usar
- `npx tsx` también se cuelga si hay conexiones HTTP axios abiertas
- Pi re-sync: pm2 restart es el método fiable (ejecuta runNightlySync inmediatamente)
- Duplicate keys en ACTION_CODE_MAP de pbp.ts → error TS1117, revisar siempre

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
