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
- `client/src/pages/scout/Personnel.tsx` — gestión plantillas + import WCBA
- `client/src/pages/scout/MyScout.tsx` — fichas coach (canónicas + sandbox)
- `client/src/pages/core/Schedule.tsx` — god file ~228KB (U Schedule)
- `client/src/pages/core/Stats.tsx` — U Stats (Season + Games tabs actuales)
- `client/src/lib/stats-api.ts` — hooks usePlayerSeasonStats + useGameLog
- `client/src/components/LandscapeHint.tsx` — componente rotate hint ✅ creado
- `server/routes.ts` — rutas API Express
- `server/stats-ingest.ts` — ingest endpoint Pi → Railway → Supabase
- `collector/src/sync/pbp.ts` — mapeo action_codes WCBA real (completo)

## i18n — arquitectura lazy
- `client/src/lib/i18n-core.ts` — runtime lazy: EN estático, ES/ZH async
- EN estático en bundle, ES/ZH cargan async

## Tailwind v4
- NO hay tailwind.config.js — usa `@theme inline` en `client/src/index.css`
- Animaciones custom se añaden en index.css: `--animate-spin-slow: spin 3s linear infinite;`
- `animate-spin-slow` ya añadido por Cursor ✅

## NUNCA tocar
- `Profile.tsx` · `schema.ts` · `migrations/`
- SQL destructivo: solo Supabase SQL Editor, nunca `drizzle-kit push`

---

## Estado app — 3 mayo 2026 (sesión p13 — CIERRE)

### Completado esta sesión ✅
1. Fix Railway build: `esbuild` movido de devDependencies → dependencies
2. Fix standings: `matchoutrank` → `teamrankfirst` (endpoint WCBA movido)
3. Fix roster: mismo fix + timeout 120s en ucoreClient
4. Fix scores a 0: `home/away.teamScore` en matchinfoscores
5. boxscores.ts: cuartos desde `home.periodScores "Q1;Q2;Q3;Q4"`
6. `syncPlayerBoxscore` via `/datahub/cbamatch/games/player/playerdata?gameId=X`
7. `stats_player_boxscores` tabla creada + handler en stats-ingest.ts
8. `stats_pbp` FK `stats_pbp_team_id_fkey` eliminada (team_id es external ID)
9. PBP action_codes WCBA reales — mapa completo de ~50 códigos
10. `GET /api/stats/players` — promedios temporada on-demand
11. `GET /api/stats/games` — game log por jugadora
12. `GET /api/stats/teams` — lista equipos con updatedAt alias
13. `GET /api/stats/standings` — clasificación con rank/W-L/PPG/OPPG ✅
14. `GET /api/stats/leaders` — top 15 por stat con season scope ✅
15. `POST /api/stats/import-team` — importa roster WCBA → players tabla
16. Personnel: botón Import WCBA + modal con selector/aviso temporada
17. `LandscapeHint.tsx` componente creado ✅
18. Schedule: `useLongPress` hook añadido (tap=detalle, long-press=editar) ✅
19. `docs/ustats-ux-spec.md` — spec completa U Stats aprobada ✅

### Estado sync al cierre sesión p13
```
stats_teams:       18 ✅
stats_games:      224 ✅
stats_standings:   18 ✅
stats_players:    307 ✅
home_score/away_score: 223 partidos ✅
stats_player_boxscores: EN CURSO (sync corriendo ~3h, partido por partido)
stats_pbp:             EN CURSO (sync corriendo, 498 eventos/partido confirmados)
```

### Al iniciar próxima sesión — verificar PRIMERO:
```sql
SELECT
  (SELECT COUNT(*) FROM stats_player_boxscores) as player_boxscores,
  (SELECT COUNT(*) FROM stats_pbp) as pbp_eventos,
  (SELECT COUNT(*) FROM stats_games WHERE home_score > 0) as con_score;
```
Cuando pbp > 50.000 → Stats.tsx mostrará datos reales automáticamente.

### 🔴 OBJETIVO PRÓXIMA SESIÓN — U Stats Fase 1
Ver `docs/ustats-ux-spec.md` para spec completa aprobada.
Implementar en este orden:
1. `GET /api/stats/player-link?name=X` → match nombre → externalId + 3 stats
2. `GET /api/stats/seasons` → temporadas con datos disponibles
3. Stats.tsx refactor: 3 tabs (Liga | Jugadoras | Equipos) + SeasonPicker header
4. `StatsPlayerSheet` — ficha jugadora con game log + LandscapeHint
5. `StatsMiniChip` en MyScout.tsx para link a stats individuales
6. Deep link `/stats?tab=jugadoras&player=EXTERNAL_ID`

### 🔴 RIESGOS ACTIVOS
- P1 hasReport — verificar con datos reales primero, puede no ser bug
- P1 Schedule scroll List→Planner: no recentra en hoy (pendiente)
- P2 queryKey fix no verificado multi-cuenta

### 🔴 PENDIENTE SESIONES FUTURAS
- Scraping histórico temporadas [1767, 1470, 1108, 873, 428, 253...]
- ReportViewV4 → 3 slides
- Telegram Pi: bloqueado GFW
- U Stats Fase 2: StatsTeamSheet + radar + shot chart landscape
- U Stats Fase 3: comparador landscape split view
- TestFlight: Apple Developer ($99/año) + Xcode

---

## Raspberry Pi 5
- IP: 192.168.1.59 · SSH: pablo@192.168.1.59
- Node 20 + PM2 · Collector en ~/ucore/collector
- Telegram: BLOQUEADO por GFW
- SCP siempre desde terminal Mac: `scp "ruta/archivo" pablo@192.168.1.59:~/ucore/collector/src/...`
- Deploy Pi: `cd ~/ucore/collector && npm run build && pm2 restart ucore-collector`
- Logs: `ssh pablo@192.168.1.59 "tail -f ~/.pm2/logs/ucore-collector-out.log"`

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
TNOPAS/TNOBHD/TNOOFF/TNOSTL/TOTLTO/TNODDR/TNOTRV/TNO3SC/TNO24S/TNOBCT/TNOOTH/TNOOBD=turnover
TMOLEG/TMOILL=timeout, STRTPD=period_start, ENDPD=period_end
JUBSUC/JUBFAL=jumpball
```

## Temporadas WCBA
```
2092 (activa 2024-25), 1767, 1470, 1108, 873, 428, 253, 236, 228, 245, 189, 175
```

## Schema Supabase stats_*
```
stats_teams (18), stats_players (307), stats_games (224)
stats_standings (18), stats_player_boxscores (~3000 en curso)
stats_pbp (~100k en curso), stats_roster_snapshots
stats_insights_cache (vacío — Pi-heavy calcs pendientes)
stats_sync_log (historial syncs)
CONSTRAINT eliminada: stats_pbp_team_id_fkey (team_id es external ID de API)
```

## Endpoints Railway implementados
```
GET  /api/stats/teams          → lista equipos con updatedAt ✅
GET  /api/stats/players        → promedios temporada (ppg/rpg/apg/spg/bpg/topg/fg%/3p%/ft%) ✅
GET  /api/stats/games          → game log por jugadora (?playerName=X) ✅
GET  /api/stats/standings      → clasificación (?seasonId=2092) ✅
GET  /api/stats/leaders        → top 15 por stat (?stat=ppg&seasonId=2092) ✅
POST /api/stats/import-team    → importa roster WCBA → players tabla ✅
POST /api/stats/ingest         → ingest Pi → Supabase (auth: STATS_INGEST_KEY) ✅

PENDIENTES:
GET  /api/stats/player-link    → match nombre → externalId + 3 stats
GET  /api/stats/seasons        → temporadas con datos disponibles
GET  /api/stats/player/:id     → ficha individual con métricas avanzadas
GET  /api/stats/team/:id       → ficha equipo con PACE/ORTG/DRTG
```

---

## U Stats — spec UX aprobada (ver docs/ustats-ux-spec.md)

### Decisiones aprobadas
1. SeasonPicker: en header de Stats entry, discreto `"2024-25 ▾"`
2. Shot chart: landscape-only + LandscapeHint en portrait ✅ componente listo
3. Comparador: desde dentro de ficha (Comparar con...) — NO vista separada
4. Gráficas: sparkline siempre, radar + shot chart behind tap
5. Integración MyScout ↔ U Stats: chip discreto con 3 stats → deep link a ficha

### Componentes creados
- `LandscapeHint.tsx` ✅ — con `useIsLandscape()` hook

### Componentes pendientes (en orden)
- `SeasonPicker` — dropdown temporada header
- `StatsPlayerSheet` — ficha jugadora (game log + radar landscape + shot chart)
- `StatsTeamSheet` — ficha equipo
- `StatsMiniChip` — chip 3 stats para MyScout link
- `StatsRadar` — radar 6 ejes recharts
- `StatsComparator` — split view landscape

### Deep link
`/stats?tab=jugadoras&player=EXTERNAL_ID` → Stats.tsx detecta param → abre StatsPlayerSheet directa

### Anti-mistap MyScout ↔ Stats
El chip StatsMiniChip está ENTRE nombre y botones acción. Color neutro (muted). Tap lleva a Stats player sheet — recoverable con back.

---

## Reglas entrega código
- NUNCA "añade estas líneas aquí"
- Siempre: archivo completo, O comando terminal, O prompt Cursor
- npm run check después de cada cambio
- Migrations destructivas: raw SQL Supabase, nunca drizzle-kit push
- SCP siempre desde Mac, nunca desde Pi
- Railway: esbuild debe estar en dependencies (no devDependencies)
- Tailwind v4: animaciones custom en index.css, NO en tailwind.config

## Notas de sesión (trampas conocidas)
- bash_tool corre en Linux — NO puede acceder al Mac. Usar Filesystem MCP
- filesystem:write_file (lowercase) para escribir en Mac
- Filesystem:edit_file (mayúscula) para edits quirúrgicos
- Cursor duplica handlers en routes.ts — verificar siempre
- Map iteration: usar Array.from(map.entries())
- Pi GFW bloquea GitHub y Telegram — SCP para archivos individuales
- stats_pbp.team_id = external ID de API (FK eliminada)
- `sql.raw()` solo para allowlist de expresiones fijas (leaders stat expr)

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
- [x] Portrait-only
- [x] LandscapeHint para vistas que requieren landscape
- [ ] npx cap sync + iconos + code signing
