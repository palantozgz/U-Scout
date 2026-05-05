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

## U Playbook — módulo futuro de U Core

### Qué es
**U Playbook** es el módulo de documentación de filosofía defensiva (y en el futuro ofensiva) del equipo. La primera pieza es el **Defensive System Builder**, un wizard HTML standalone desarrollado fuera del repo en sesión paralela (mayo 2026) que permite a un staff técnico construir, documentar y comparar hasta 3 sistemas defensivos completos.

### Archivo actual
- **Ruta standalone**: `/Users/palant/Downloads/defensive-system-builder-v5.html`
- **Versión**: v5 (la más reciente y estable)
- Este archivo es un HTML self-contained — sin dependencias externas excepto `html2canvas` (CDN) para export PNG. No requiere backend.

### Specs técnicas del wizard
- **41 pasos totales** organizados en 12 secciones
- **Engine condicional**: `showIf(answers)` por paso — pasos aparecen/desaparecen según respuestas anteriores
- **Visibilidad mínima** (switch anchor, sin ICE, sin dig): ~30 pasos
- **Visibilidad máxima** (hedge + ICE + dig + front + todo activo): ~37 pasos
- **3 sistemas en paralelo**: crear, editar, comparar
- **Comparador mejorado**: 🔴 Critical / 🟡 Tactical / ⚪ Detail + sección "En común"
- **Export PNG** por sistema (html2canvas)
- **Personnel compatibility analysis**: semáforo 🔴🟡🟢 automático cruzando elecciones vs personnel

### Secciones del wizard (12)
1. **Identity** (5 pasos): systemName, priority, driveDirection, onBall, pickupPoint
2. **Off-Ball** (3 pasos): offBallPosition, onePassDeny, helpSideDepth
3. **Ball Screens** (7 pasos, 4 condicionales): pnrCoverage, coverageSubtype, sideRule, middleRule, dhoRule, nextCoverage¹, popAnswer²
4. **ICE Details** (2 pasos, condicionales si sideRule=ice): iceCornerX3, iceSnake
5. **Early Offense** (4 pasos): earlyPnrCoverage, earlyPnrBig, earlyRescreenRule, earlyPostRule
6. **Off-Ball Screens** (5 pasos): pinDownRule, backScreenRule, flareRule, stagRule, dhoOffBall
7. **Spain PnR** (1 paso): spainCoverage — define los 3 roles (X5/X1/X-backscreener) en una sola elección
8. **Switch Management** (3 pasos): rescramRule, xoutModel, mismatchResponse
9. **Post Defense** (3 pasos, 2 condicionales): postDefense, postDigger³, postFront⁴
10. **Personnel** (4 pasos): rimProtection, mobilityBig, switchability, discipline
11. **Transition** (3 pasos): transitionSafety, transitionPriority, reboundBalance
12. **KYP Rules** (1 paso): kypRules (0–5 reglas game-day específicas por rival)

¹ nextCoverage: solo si pnrCoverage ≠ switch — implementa sistema Gonzalo Rodríguez / Monbus Obradoiro (X5 attached to roller, perimetral más cercano salta al balón, guards rotan entre sí)
² popAnswer: solo si hay pnrCoverage — opciones diferenciadas por anchor (hedge→X5 recovery corta vs drop→X5 closeout largo)
³ postDigger: solo si postDefense = 'dig'
⁴ postFront: solo si postDefense = 'front' o 'threeFront'

### Decisiones de arquitectura importantes (para cuando se integre en U Core)
- **spainCoverage** cubre los 3 roles defensores en una pregunta — NO añadir spainBackScreener ni spainMismatchAnswer (eliminados por redundancia)
- **mismatchResponse** cubre tanto big-on-guard como guard-on-big en una sola pregunta — NO añadir mismatchBigOnGuard ni mismatchGuardOnBig (eliminados por redundancia)
- **xoutModel** primera opción es "Last helps · Next reads first pass · Beaten recovers second" (modelo real del staff, no scripted)
- El comparador requiere ≥2 sistemas completados para habilitarse

### Roadmap U Playbook (cuando se integre a U Core)
1. Portarlo como página React: `client/src/pages/playbook/DefensiveSystems.tsx`
2. Persistir sistemas en Supabase tabla `playbook_systems` (por club, por coach)
3. Share de sistema entre staff (vista de solo lectura)
4. Añadir sección Offensive Systems (PnR offense sets, ATO plays)
5. Vincular sistemas a partidos (KYP rules pre-game)
6. Export PDF además de PNG

---

## Estado app — 5 mayo 2026 (sesión p18 — CIERRE)

### Completado esta sesión ✅ (p18)
- **Defensive System Builder v5** (U Playbook MVP): wizard HTML standalone con 41 pasos, engine condicional showIf, 12 secciones, Next coverage (Obradoiro), ICE details, Spain PnR, Switch Management, personnel compatibility analysis, comparador por criticidad
- Auditoría completa de duplicados vs documentación táctica profesional — 4 pasos eliminados, 2 condicionalizados, 3 correcciones de contenido
- Corrección pop answer: opciones diferenciadas hedge vs drop vs blitz
- Corrección xoutModel: opción real "Last · Next reads first pass · Beaten recovers second"
- Corrección mismatchResponse: cubre explícitamente ambas direcciones de mismatch en cada opción
- Corrección spainCoverage: hint y descripciones detallan los 3 roles por opción

### 🔴 OBJETIVO PRÓXIMA SESIÓN (U Stats)
1. Audit UX Stats: scroll, layout, elementos fuera de pantalla — prompt Cursor con capturas de Pablo
2. Verificar StatsTeamSheet en producción (tap equipo en Clasificación)
3. StatsMiniChip deep link end-to-end en producción
4. `StatsRadar` recharts 6 ejes (portrait behind tap en StatsPlayerSheet)

### 🔴 RIESGOS ACTIVOS
- P1 Schedule scroll List→Planner: no recentra en hoy (pendiente)
- P2 hasReport — verificar con datos reales

### 🔴 BACKLOG COMPLETO

#### U Stats
- `StatsRadar` recharts 6 ejes (portrait behind tap en StatsPlayerSheet)
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

#### U Playbook (futuro módulo)
- Portarlo a React dentro de U Core (ver sección U Playbook arriba)

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
GET  /api/stats/team/:id       ✅ standings data + roster con ppg/rpg/apg
GET  /api/stats/sync-status    ✅ (auth: STATS_INGEST_KEY) pbpDone + boxDone
POST /api/stats/import-team    ✅
POST /api/stats/ingest         ✅
```

## U Stats — componentes
### Implementados ✅
- `LandscapeHint.tsx`
- `Stats.tsx` — 3 tabs + SeasonPicker + StatsPlayerSheet + StatsTeamSheet + deep link ?player=
- `StatsMiniChip` — MyScout.tsx, fichas canónicas, apiRequest Bearer
- `StatsPlayerSheet` — averages + LandscapeHint + game log 30 partidos
- `StatsTeamSheet` — logo + W-L + NET + plantilla tappable → StatsPlayerSheet

### Pendientes
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

## Modelo de trabajo — aprendizajes sesiones p17-p18 (CRÍTICO)

### Lo que falló y no debe repetirse
- **Edits directos de Claude sobre archivos grandes** (Stats.tsx, routes.ts) con Filesystem:edit_file causan corrupción cuando el texto contiene backticks, regex o JSX anidado. NUNCA editar estos archivos directamente — siempre prompt Cursor.
- **Claude trabajó a ciegas repetidamente**: propuso fixes sin leer el estado real del archivo, causando loops de debugging. Regla: leer archivo completo ANTES de proponer cualquier cambio.
- **Prompts de audit genéricos**: cuando Pablo pide un audit de UX/navegación, Claude debe proponer un prompt que simule recorridos de usuario reales (tap por tap) y compare contra specs — no una lista de fixes CSS.
- **Cursor duplica handlers en routes.ts**: ya documentado pero se volvió a ignorar. Después de CUALQUIER edit de Cursor a routes.ts, verificar con `grep -n 'app.get.*api/stats' server/routes.ts` antes de commitear.
- **Números inventados**: Claude inventó conteos de pasos sin contar realmente. Siempre contar con grep antes de afirmar números.
- **Proponer eliminaciones sin justificación por paso**: cada eliminación requiere argumentación táctica verificada.

### Cómo debe trabajar Claude en próximas sesiones
1. Leer CLAUDE_CONTEXT.md + archivos relevantes ANTES de cualquier propuesta
2. Para cambios en Stats.tsx, routes.ts, Schedule.tsx → siempre prompt Cursor, nunca edit directo
3. Para audits de UX → prompt Cursor que recorra flujos de usuario completos comparando contra specs
4. Verificar en local antes de commitear
5. Comandos siempre completos: cd + check + add + commit + push en una línea
6. Contar siempre con herramientas antes de afirmar números

---

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
