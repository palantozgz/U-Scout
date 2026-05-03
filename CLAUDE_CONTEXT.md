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
- `client/src/pages/scout/MyScout.tsx` — fichas coach (canónicas + sandbox) + StatsMiniChip ✅
- `client/src/pages/core/Schedule.tsx` — god file ~228KB (U Schedule)
- `client/src/pages/core/Stats.tsx` — U Stats: 3 tabs Liga|Jugadoras|Equipos ✅
- `client/src/lib/stats-api.ts` — hooks: usePlayerSeasonStats, useGameLog, useSeasons, useStandings, useLeaders ✅
- `client/src/components/LandscapeHint.tsx` — componente rotate hint ✅
- `server/routes.ts` — rutas API Express
- `server/stats-ingest.ts` — ingest endpoint Pi → Railway → Supabase
- `collector/src/sync/pbp.ts` — mapeo action_codes WCBA real (completo)
- `collector/src/sync/boxscores.ts` — syncPlayerBoxscore via /playerdata

## i18n — arquitectura lazy
- `client/src/lib/i18n-core.ts` — runtime lazy: EN estático, ES/ZH async
- EN estático en bundle, ES/ZH cargan async

## Tailwind v4
- NO hay tailwind.config.js — usa `@theme inline` en `client/src/index.css`
- Animaciones custom se añaden en index.css

## NUNCA tocar
- `Profile.tsx` · `schema.ts` · `migrations/`
- SQL destructivo: solo Supabase SQL Editor, nunca `drizzle-kit push`

---

## Estado app — 3 mayo 2026 (sesión p14 — CIERRE)

### Completado esta sesión ✅
1. `GET /api/stats/player-link?name=X` → match nombre → externalId + ppg/rpg/apg
2. `GET /api/stats/seasons` → temporadas con datos disponibles (DISTINCT season_id WHERE status=4)
3. `GET /api/stats/leaders` extendido con `fgPct` (SUM-based, ORDER BY value DESC NULLS LAST)
4. `stats-ingest.ts` fix crítico: `updated_at = NOW()` eliminado de ON CONFLICT en `handlePlayerBoxscores` — la tabla NO tiene esa columna → causaba player_boxscores = 0 en silencio. Fix desplegado en Railway.
5. `Stats.tsx` reescrito completo: 3 tabs Liga|Jugadoras|Equipos, SeasonPicker (Sheet bottom), deep link `?tab=`, segment Clasificación|Líderes, team filter + sort chips en Jugadoras, Equipos con NET rating
6. `stats-api.ts` ampliado: useSeasons, useStandings, useLeaders, StandingsRow, LeaderRow
7. `StatsMiniChip` en MyScout.tsx — chip PPG/RPG/APG entre nombre y botones, solo fichas canónicas, navega a `/stats?tab=jugadoras&player=EXTERNAL_ID`
8. `useStatsLink` hook en MyScout.tsx usando `apiRequest` (Bearer JWT) — no fetch puro
9. Personnel fix importación WCBA (prompt Cursor preparado, pendiente ejecutar): quitar selector "Import into team", auto-crear equipo con nombre WCBA, fix aviso nombres en chino

### Estado sync al cierre sesión p14
```
stats_teams:            18 ✅
stats_games:           224 ✅
stats_standings:        18 ✅
stats_players:         307 ✅
stats_pbp:          ~9.600 (sync corriendo esta noche, ~19 partidos de 224)
stats_player_boxscores:  0 → FIX DESPLEGADO, se llenará en próximo sync nocturno
```

### Al iniciar próxima sesión — verificar PRIMERO
```sql
SELECT
  (SELECT COUNT(*) FROM stats_player_boxscores) as player_boxscores,
  (SELECT COUNT(*) FROM stats_pbp) as pbp_eventos;
```
- Si `player_boxscores > 500` → fix funcionó, hay datos reales para Stats.tsx tab Jugadoras
- Si `player_boxscores = 0` → sync nocturno aún no corrió o hay otro problema, revisar logs Pi

### PENDIENTE al inicio próxima sesión
Mandar este prompt a Cursor (Personnel fix importación WCBA — preparado en sesión p14):
```
In client/src/pages/scout/Personnel.tsx, make the following changes to the Import WCBA flow:

1. Remove the state variable `importTargetTeamId` and its setter entirely.
   Also remove the second <select> (value={importTargetTeamId}, "Import into team…").

2. Replace the entire handleImportTeam function with:

  const handleImportTeam = async () => {
    if (!selectedStatsTeamId || !profile?.id) return;
    setImportLoading(true);
    setImportResult(null);
    try {
      const selectedTeam = statsTeams.find((t) => t.id === selectedStatsTeamId);
      const teamName = selectedTeam?.name ?? "WCBA Team";
      let targetTeamId: string;
      const existing = teams.find(
        (t) => t.name.trim().toLowerCase() === teamName.trim().toLowerCase() && !Boolean((t as any).is_system)
      );
      if (existing) {
        targetTeamId = existing.id;
      } else {
        const res = await apiRequest("POST", "/api/teams", {
          name: teamName,
          logo: "🏀",
          primaryColor: "bg-orange-500",
        });
        const created = await res.json();
        await qc.invalidateQueries({ queryKey: ["/api/teams"] });
        targetTeamId = created.id as string;
      }
      const importRes = await apiRequest("POST", "/api/stats/import-team", {
        statsTeamExternalId: selectedStatsTeamId,
        targetTeamId,
        coachUserId: profile.id,
      });
      const data = await importRes.json();
      setImportResult({ created: data.created, skipped: data.skipped });
      await qc.invalidateQueries({ queryKey: ["/api/players"] });
    } catch (err) {
      console.error("Import failed", err);
    } finally {
      setImportLoading(false);
    }
  };

3. Update Import button: disabled={!selectedStatsTeamId || importLoading}
   (remove the || !importTargetTeamId part)

4. Replace amber warning banner with:
   <div className="rounded-lg border border-amber-500/30 bg-amber-500/8 px-3 py-2 space-y-0.5">
     <p className="text-[10px] font-black text-amber-700 dark:text-amber-400 uppercase tracking-wider">
       {locale === "es" ? "Temporada 2024-25" : locale === "zh" ? "2024-25赛季" : "Season 2024-25"}
     </p>
     <p className="text-[10px] text-amber-700/80 dark:text-amber-400/80">
       {locale === "es"
         ? "Datos sincronizados · Nombres oficiales WCBA en chino."
         : locale === "zh"
         ? "数据已同步 · 显示官方WCBA中文名称。"
         : "Data synced · Names shown in official WCBA Chinese."}
     </p>
   </div>

5. Run: npm run check. Report exact output.
```

### 🔴 OBJETIVO PRÓXIMA SESIÓN — U Stats Fase 2
1. Personnel fix (prompt arriba) — ejecutar primero si no se hizo
2. `StatsPlayerSheet` — ficha jugadora: game log + sparkline + LandscapeHint para shot chart
3. Deep link completo: `/stats?tab=jugadoras&player=EXTERNAL_ID` → abre StatsPlayerSheet directa
4. `GET /api/stats/player/:id` — endpoint ficha individual (game log + métricas avanzadas)

### 🔴 RIESGOS ACTIVOS
- P1 `player_boxscores = 0` — fix desplegado, verificar en próxima sesión con SQL arriba
- P1 Schedule scroll List→Planner: no recentra en hoy (pendiente)
- P2 hasReport — verificar con datos reales cuando boxscores estén disponibles

### 🔴 BACKLOG COMPLETO (ordenado por prioridad)

#### U Stats
- Fase 2: `StatsPlayerSheet` (game log + sparkline) — PRÓXIMA SESIÓN
- Fase 2: `GET /api/stats/player/:id` endpoint
- Fase 3: `StatsTeamSheet` + PACE/ORTG/DRTG
- Fase 3: `StatsRadar` recharts 6 ejes (portrait behind tap)
- Fase 3: Shot chart landscape (SVG/canvas, hexbin)
- Fase 4: `StatsComparator` landscape split view
- Bubble chart liga (freq vs eficiencia, referencia elradardelscout.com)
- Scraping histórico temporadas [1767, 1470, 1108, 873, 428, 253...]

#### Personnel — gestión de temporadas (diseño aprobado, implementación pendiente)
- **"Borrar todo" manual**: opción para el head_coach de borrar TODOS los equipos y fichas canónicas de una vez, antes de importar una nueva temporada/liga. Acción destructiva con confirmación explícita de doble paso. El coach decide cuándo hacerlo, nunca automático.
- **Migración asistida entre temporadas**: al importar nueva temporada, buscar coincidencias por `name_zh` exacto entre fichas existentes y roster nuevo. Coincidencias → marcar "migradas" (conservan datos de scouting). Nuevas → crear vacías. Ausentes → marcar "inactivas" (NO borrar nunca automáticamente). UI con switch de temporada en Personnel.
- **"Importar liga completa"**: botón que itere todos los equipos WCBA de una vez (sesión separada, afecta backend).
- **Nombres WCBA**: `stats_teams` solo tiene `name_zh` (chino oficial, NO hay `name_en`). El aviso en el modal de importación debe decir "nombres oficiales WCBA en chino". `stats_players` sí tiene `name_en` (pinyin).

#### U Scout
- PlayerEditor: auditoría completa de campos (section headers → field-by-field)
- ReportViewV4 → diseño 3 slides
- `backup/motor-v2.1-pre-20260405` → merge a main (verificar estabilidad primero)

#### Platform
- Favicon U Scout logo
- Club logo: upload imagen real (reemplazar emoji picker)
- "Simple vs Pro" mode para usuarios amateur
- Iconos output: diseñar en Figma con referencias reales de acción — NUNCA generar SVG sin referencias
- Branding: SVG paths separados en Figma → Rive morph animation
- Telegram Pi: bloqueado GFW (pendiente solución)
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
⚠ Unmapped no críticos: 3PASBK/3PMSBK (tiros bloqueados 3P), TNOOBD, FOLTEC (ya mapeado como foul)
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
stats_player_boxscores (0)  — game_id, player_external_id, pts/reb/ast/stl/blk/tov/min/fg/3p/ft
  ⚠ NO tiene columna updated_at — el ON CONFLICT nunca debe referenciarla (bug ya corregido)
stats_pbp (~9.600)          — game_id, sequence, event_type, shot_x/y/made, etc.
stats_roster_snapshots      — snapshots diarios de roster
stats_insights_cache        — vacío, calcs Pi-heavy pendientes
stats_sync_log              — historial syncs
CONSTRAINT eliminada: stats_pbp_team_id_fkey (team_id es external ID de API)
```

## Endpoints Railway implementados
```
GET  /api/stats/teams          → lista equipos con updatedAt ✅
GET  /api/stats/players        → promedios temporada (ppg/rpg/apg/spg/bpg/topg/fg%/3p%/ft%) ✅
GET  /api/stats/games          → game log por jugadora (?playerName=X) ✅
GET  /api/stats/standings      → clasificación (?seasonId=2092) ✅
GET  /api/stats/leaders        → top 15 por stat (?stat=ppg|rpg|apg|spg|bpg|fgPct&seasonId) ✅
GET  /api/stats/player-link    → match nombre → { externalId, ppg, rpg, apg } ✅
GET  /api/stats/seasons        → DISTINCT season_id WHERE status=4 ORDER BY DESC ✅
POST /api/stats/import-team    → importa roster WCBA → players tabla ✅
POST /api/stats/ingest         → ingest Pi → Supabase (auth: STATS_INGEST_KEY) ✅

PENDIENTES:
GET  /api/stats/player/:id     → ficha individual con game log + métricas avanzadas
GET  /api/stats/team/:id       → ficha equipo con PACE/ORTG/DRTG
```

---

## U Stats — spec UX aprobada (ver docs/ustats-ux-spec.md)

### Componentes implementados ✅
- `LandscapeHint.tsx` — con `useIsLandscape()` hook
- `Stats.tsx` — 3 tabs Liga|Jugadoras|Equipos + SeasonPicker + deep link ?tab=
- `StatsMiniChip` — inline en MyScout.tsx, solo fichas canónicas, usa apiRequest (Bearer)

### Componentes pendientes (en orden de prioridad)
- `StatsPlayerSheet` — ficha jugadora (game log + sparkline + radar landscape + shot chart)
- `StatsTeamSheet` — ficha equipo
- `StatsRadar` — radar 6 ejes recharts
- `StatsComparator` — split view landscape

### Deep link
`/stats?tab=jugadoras&player=EXTERNAL_ID` → Stats.tsx detecta param → abrirá StatsPlayerSheet (pendiente)

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
- filesystem:write_file (lowercase, parámetro "content") para escribir en Mac
- Filesystem:edit_file (mayúscula) para edits quirúrgicos
- Cursor duplica handlers en routes.ts — verificar siempre
- Map iteration: usar Array.from(map.entries())
- Pi GFW bloquea GitHub y Telegram — SCP para archivos individuales
- stats_pbp.team_id = external ID de API (FK eliminada)
- `sql.raw()` solo para allowlist de expresiones fijas (leaders stat expr)
- stats_player_boxscores NO tiene updated_at — nunca usar en ON CONFLICT

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
