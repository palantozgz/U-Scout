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
- `client/src/pages/scout/Personnel.tsx` — gestión plantillas + import WCBA + import liga + borrar todo ✅
- `client/src/pages/scout/MyScout.tsx` — fichas coach (canónicas + sandbox) + StatsMiniChip ✅
- `client/src/pages/core/Schedule.tsx` — god file ~228KB (U Schedule)
- `client/src/pages/core/Stats.tsx` — U Stats: 2 tabs (Liga/Jugadoras) + SeasonPicker + StatsPlayerSheet + StatsTeamSheet + deep link ?player= + StatsRadar toggle + sort grupos A→B ✅
- `client/src/lib/stats-api.ts` — hooks completos ✅
- `client/src/components/StatsRadar.tsx` — radar 6 ejes recharts ✅ AXIS_MAX calibrado con datos reales WCBA 2024-25 (SPG=3.5/BPG=2.5/FG%=80)
- `server/routes.ts` — rutas API Express
- `server/stats-ingest.ts` — ingest endpoint Pi → Railway → Supabase
- `collector/src/sync/boxscores.ts` — FIELD MAPPING FIJO: usa p.points (no p.pts), p.assists, p.steals, p.blocks, p.turnover, parseShotStr(p.shot) para fgm/fga ✅
- `collector/src/sync/pbp.ts` — URL /api/v2/game/${gameId}/actions ✅ field mapping verificado
- `collector/src/sync/standings.ts` — URL /datahub/cbamatch/rank/teamrankfirst ✅
- `collector/src/sync/schedule.ts` — URL /datahub/cbamatch/games/matchschedules via phases ✅
- `collector/src/sync/roster.ts` — URL /datahub/cbamatch/team/teamplayers, respuesta en data.data.players ✅
- `collector/src/sync/phases.ts` — /datahub/cbamatch/games/phasemenus → matchmenusschedule ✅
- `collector/fix-player-names.js` — one-shot pinyin, ya ejecutado (297 jugadoras) ✅
- `collector/audit-end-to-end.js` — script audit 34/34 ✅, ejecutar en Pi para verificar pipeline

## i18n — arquitectura lazy
- `client/src/lib/i18n-core.ts` — runtime lazy: EN estático, ES/ZH async

## Tailwind v4
- NO hay tailwind.config.js — usa `@theme inline` en `client/src/index.css`

## NUNCA tocar
- `Profile.tsx` · `schema.ts` · `migrations/`
- SQL destructivo: solo Supabase SQL Editor, nunca `drizzle-kit push`

---

## U Playbook — módulo futuro
(ver sección completa en versión anterior — sin cambios)

---

## Estado app — 7 mayo 2026 (sesión p22 — CIERRE)

### Completado sesión p21 ✅
- **audit-end-to-end.js**: 34/34 ✅ — pipeline completo verificado
- **TRUNCATE stats_player_boxscores** + pm2 restart → Pi re-sincronizó 223 partidos (5312 rows, avg_scorers=9.7, max_pts=51 ✅)
- **Personnel import WCBA / import-league / borrar todo** ✅
- **Stats.tsx — Orden grupos A→B** ✅

### Completado sesión p22 ✅
- **fix-team-names.js**: ejecutado en Pi → 18 equipos con name_en (pinyin) en stats_teams ✅
- **HTTP 500 player detail RESUELTO**: causa = `pb.team_external_id` (TEXT) comparado con `stats_teams.external_id` (INTEGER) en game log query → operador no existente. Fix: JOIN stats_players sp2 + usar `sg.home_team_id = sp2.team_id` (INTEGER). try/catch añadido. ✅
- **Stats UX Phase 1 ✅**: B1 scroll-snap chips, B2 scroll reset, B3 6-col game log con border color +/-, badge Titular, contraste leaders
- **Stats UX Phase 2 ✅**: sortDir en Jugadoras, StatChip hero PPG/RPG/APG + secondary FG%/SPG/BPG/TOPG + showMore, radar button estilo filled, position badge, sort clickable en game log y roster
- **Nombres en locale en/es ✅**: `pickName(nameZh, nameEn, locale)` en Stats.tsx — standings, PlayerSheet, TeamSheet, Jugadoras. `teamNameEn` / `nameEn` añadidos a tipos en stats-api.ts y a los endpoints standings, player detail, team detail
- **GET /api/stats/players `teamNameEn`**: pendiente confirmar aplicación (Cursor prompt en curso)

### 🔴 RIESGOS ACTIVOS
- P1 Schedule scroll List→Planner: no recentra en hoy (pendiente)
- P2 hasReport — verificar con datos reales

### 🔴 BACKLOG COMPLETO

#### U Stats (sesión p23 — 8 mayo 2026)
- TS%/eFG%/DD/TD/hot streak/consistency ✅ (client-side desde gameLog)
- Infinite scroll Jugadoras ✅
- StatsRadar AXIS_MAX calibrado con datos reales ✅ (SPG 4→3.5, BPG 4→2.5, FG% 65→80)
- fix-player-names.js: skip is_foreign ✅
- fix-foreign-names.js: jersey type cast fix ✅ — 23 nombres actualizados
- Shot chart landscape (hexbin) — requiere datos XY de tiro (largo plazo)
- StatsComparator landscape split view (largo plazo)

#### Personnel
- Migración asistida (sesión dedicada de diseño)

#### U Scout
- PlayerEditor: auditoría completa campos
- ReportViewV4 → diseño 3 slides

#### Platform
- TestFlight: Apple Developer + Xcode
- Favicon + Club logo upload real

---

## Raspberry Pi 5
- IP: 192.168.1.59 · SSH: pablo@192.168.1.59
- Node 20 + PM2 · Collector en ~/ucore/collector
- **dist/ sincronizado desde Mac** — NUNCA compilar en el Pi (pm2 usa dist/index.js directamente)
- Deploy Pi: `npm run build` en Mac → `scp -r dist/ pablo@192.168.1.59:~/ucore/collector/dist/` → `pm2 restart`
- Scripts de test en Pi: test-sync-one.js, test-3games.js, audit-pipeline-3.js, audit-roster-pbp.js, audit-end-to-end.js
- fix-player-names.js: ya ejecutado, no volver a ejecutar salvo nuevo import

## Workflow Pi — REGLA FIJA
```
# Siempre desde el Mac:
cd "/Users/palant/Downloads/U scout/collector"
npm run build
scp -r dist/ pablo@192.168.1.59:~/ucore/collector/dist/
scp src/sync/ARCHIVO.ts pablo@192.168.1.59:~/ucore/collector/src/sync/ARCHIVO.ts
ssh pablo@192.168.1.59 "grep -c 'PATRON_FIX' ~/ucore/collector/dist/sync/ARCHIVO.js"
# Si devuelve >0: pm2 restart
ssh pablo@192.168.1.59 "cd ~/ucore/collector && pm2 restart ucore-collector"
# Verificar con test script inmediatamente
ssh pablo@192.168.1.59 "cd ~/ucore/collector && node test-sync-one.js"
```

## API WCBA — URLs confirmadas
```
BASE: https://www.cba.net.cn
standings:    GET /datahub/cbamatch/rank/teamrankfirst?competitionId=56&seasonId=2092
phasemenus:   GET /datahub/cbamatch/games/phasemenus?seasonId=2092
matchmenus:   GET /datahub/cbamatch/games/matchmenusschedule?competitionId=56&seasonId=2092&phaseId=X
schedule:     GET /datahub/cbamatch/games/matchschedules?competitionId=56&seasonId=2092&phaseId=X&roundId=X&teamId=''
boxscore:     GET /datahub/cbamatch/games/matchinfoscores?matchId=X&gameId=X
playerbox:    GET /datahub/cbamatch/games/player/playerdata?gameId=X  → Array [{teamType:'Home',teamPlayerData:[...]}]
roster:       GET /datahub/cbamatch/team/teamplayers?seasonId=X&teamId=X → data.data.players[]
pbp:          GET /api/v2/game/${gameId}/actions → array directo, 556 eventos por partido
hotspot:      GET /datahub/cbamatch/games/hotspot/hotspotdata?gameId=X&periods=1&periods=2...
⚠ matchschedules requiere teamId='' (string vacío)
⚠ /datahub/wcba/* dan 404 — usar /datahub/cbamatch/*
```

## API WCBA — field mapping player boxscore (CONFIRMADO)
```
p.points          → pts        (string "18", convertir Number)
p.rebound         → reb
p.offensiveRebound → offReb
p.defensiveRebound → defReb
p.assists         → ast
p.steals          → stl
p.blocks          → blk
p.turnover        → tov
p.fouls           → fouls
p.shot            → "6-17 (35.3%)" → parseShotStr → [fgm=6, fga=17]
p.threePoints     → "0-1 (0.0%)"  → parseShotStr → [tpm=0, tpa=1]
p.foulShot        → "6-11 (54.5%)"→ parseShotStr → [ftm=6, fta=11]
p.positiveNegativeValue → plusMinus
p.playerId        → playerExternalId (string)
p.minutes         → "34:40"
p.isStartLineUp   → boolean
⚠ teamId NO viene en player data — teamExternalId queda vacío
```

## API WCBA — field mapping standings (CONFIRMADO desde audit)
```
r.teamId          → teamId
r.teamName        → teamName
r.rank            → rank
r.wins            → wins
r.loses           → losses  (ojo: "loses" no "losses")
r.pts             → ptsPerGame (85.9)
r.losePts         → ptsAgainstPerGame (72.4)
r.phaseName       → phaseName ("常规赛A组")
r.phaseId         → phaseId
r.goalDifference  → goalDiff
r.winLoss         → streak
r.last10Win/last10Loses → last10Wins/last10Losses
r.homeWin/homeLoses → homeWins/homeLosses
r.awayWin/awayLoses → awayWins/awayLosses
```

## API WCBA — field mapping PBP (CONFIRMADO)
```
a.action_code     → actionCode
a.user_id         → playerExternalId
a.team_id         → teamId
a.home_score      → homeScore
a.away_score      → awayScore
a.start_time      → clock
a.current_period  → quarter/period
a.action_title    → eventZh
PBP pts verificado: player 530931 = 18pts desde PBP = 18pts desde boxscore ✅
```

## Supabase — estado tablas (7 mayo 2026 al cierre p21)
```
stats_games:            223 partidos status=4, season_id=2092
stats_teams:            18 equipos
stats_players:          307 jugadoras (name_en regenerado con pinyin ✅)
stats_standings:        18 filas ✅
stats_player_boxscores: TRUNCATE hecho — Pi re-sincronizando. Verificar COUNT/AVG en próxima sesión
stats_pbp:              116.700 eventos ✅
```

## Endpoints Railway implementados
```
GET  /api/stats/seasons      ✅ requireAuth
GET  /api/stats/standings    ✅ requireAuth — retorna teamName (zh) + teamNameEn (pinyin)
GET  /api/stats/leaders      ✅ requireAuth (HAVING games >= 5)
GET  /api/stats/players      ✅ requireAuth — retorna teamName (zh) + teamNameEn (pinyin, pendiente confirmar)
GET  /api/stats/player/:id   ✅ requireAuth — ppg/rpg/apg desde boxscores + teamNameEn + try/catch + game log fix (sp2 JOIN)
GET  /api/stats/team/:id     ✅ requireAuth — retorna nameZh + nameEn
GET  /api/stats/player-link  ✅ requireAuth
GET  /api/stats/games        ✅ requireAuth
GET  /api/stats/sync-status  ✅ Bearer STATS_INGEST_KEY
POST /api/stats/ingest       ✅ Bearer STATS_INGEST_KEY
GET  /api/stats/teams        ✅ requireAuth — lista 18 equipos WCBA para import
POST /api/stats/import-team  ✅ requireAuth — importa jugadoras de un equipo WCBA
POST /api/stats/import-league ✅ requireAuth — importa todos los 18 equipos WCBA de golpe
DELETE /api/personnel/reset  ✅ requireAuth + headCoach — borra todos equipos+jugadoras del club
```

## U Stats — componentes
### Implementados ✅
- `StatsRadar.tsx` — radar 6 ejes, AXIS_MAX: PPG=35/RPG=15/APG=10/SPG=4/BPG=4/FG%=65
- `Stats.tsx` — Liga/Jugadoras + SeasonPicker + PlayerSheet + TeamSheet + radar toggle + sort grupos A→B + pickName(nameZh, nameEn, locale) para nombres en/es/zh ✅
- `StatsMiniChip` — MyScout.tsx
- `LandscapeHint.tsx`
- `pickName(nameZh, nameEn, locale)` — helper en Stats.tsx: locale zh→Chinese, en/es→pinyin con fallback

## Personnel — features implementadas
```
Import WCBA (un equipo)   ✅ GET /api/stats/teams + POST /api/stats/import-team
Import liga completa      ✅ POST /api/stats/import-league — 18 equipos + jugadoras en un click
Borrar todo               ✅ DELETE /api/personnel/reset — confirmación "CONFIRMAR" requerida
Migración asistida        🔴 Pendiente — requiere sesión de diseño de producto
```

## Collector — lógica sync (trampa crítica)
```
syncNewPlayerBoxscores usa fetchSyncStatus() → boxDone[]
Si un gameId ya tiene filas en stats_player_boxscores → está en boxDone → se SALTA
⚠ Para forzar re-sync completo: TRUNCATE stats_player_boxscores en Supabase SQL Editor
  luego pm2 restart en Pi → procesará todos los juegos de nuevo
```

---

## Reglas entrega código
- NUNCA "añade estas líneas aquí"
- Siempre: archivo completo, O comando terminal, O prompt Cursor
- npm run check después de cada cambio
- Migrations destructivas: raw SQL Supabase, nunca drizzle-kit push
- Pi: NUNCA compilar en Pi — siempre build en Mac + scp dist/ completo
- Tailwind v4: animaciones en index.css, NO en tailwind.config

## Modelo de trabajo — reglas críticas
- Leer archivos ANTES de proponer
- Para Stats.tsx, routes.ts, Schedule.tsx → siempre prompt Cursor
- Audit de fix: test script inmediato → verificar Supabase → solo si ✅ pm2 restart
- Pi deploy: build Mac → scp dist/ → grep verificación → pm2 restart → test script
- NUNCA esperar sync completo para validar un fix — usar scripts de test unitario

## Notas (trampas conocidas)
- bash_tool corre en Linux — NO accede al Mac. Usar Filesystem MCP
- filesystem:write_file parámetro "content" (no "file_text")
- Cursor duplica handlers en routes.ts — verificar siempre
- stats_player_boxscores.minutes = TEXT "MM:SS"
- Pi: pm2 restart NO recompila — usa dist/ tal cual está
- /datahub/wcba/* → 404. Usar /datahub/cbamatch/*
- matchschedules requiere teamId='' obligatorio
- player boxscore: teamId NO viene en player data
- standings: campo "loses" (no "losses") en API
- syncNewPlayerBoxscores SALTA juegos ya en boxDone → TRUNCATE necesario para re-sync completo

## Scripts Pi disponibles
```
node test-sync-one.js        — ingesta 1 partido, verifica inmediatamente
node test-3games.js          — ingesta 3 partidos
node audit-pipeline-3.js     — verifica URLs y field mapping
node audit-roster-pbp.js     — verifica roster URL + PBP vs boxscore
node audit-end-to-end.js     — audit completo 34 checks (34/34 ✅ verificado p21)
node fix-player-names.js     — regenera pinyin (ya ejecutado, no repetir)
```

## Club INNER MONGOLIA
- Club ID: 4bca3aa8-9062-4709-9d29-9e2313308f1a
- Pablo (b334e51a) = owner + head_coach
