# U Core — Contexto para Claude

> Leer este archivo al inicio de cada sesión antes de proponer cualquier cambio.
> Claude SIEMPRE actualiza este archivo al cierre de sesión.
> Claude NUNCA pide a Pablo que edite este archivo manualmente.

---

## Producción
- URL: https://u-scout-production.up.railway.app
- Deploy: Railway, auto-deploy en push a `main`
- DB: Supabase (PostgreSQL)
- **Repo real:** `/Users/palant/Downloads/U scout/ucore/` ← SIEMPRE trabajar aquí
- **GitHub:** https://github.com/palantozgz/U-Scout.git
- `/Users/palant/Downloads/U scout/` es wrapper vacío — NO tocar

## Stack
React + TypeScript + Vite · Express · Drizzle ORM · TanStack Query · shadcn/ui · Tailwind v4
Capacitor 8.x — iOS nativo + Mac Catalyst (Xcode)

## Archivos clave
- `client/src/lib/motor-v4.ts` — scoring layer
- `client/src/lib/motor-v2.1.ts` — motor base
- `client/src/lib/reportTextRenderer.ts` — texto EN/ES/ZH con gender
- `client/src/lib/theme.ts` — gestión temas + sincronización nativa iOS via ThemePlugin
- `client/src/pages/scout/ReportSlidesV1.tsx` — 3 slides
- `client/src/pages/scout/ReportViewV4.tsx` — shell coach_review con OverridePanel
- `client/src/pages/scout/PlayerEditor.tsx` — editor inputs jugador
- `client/src/pages/scout/Personnel.tsx` — gestión plantillas
- `client/src/pages/scout/MyScout.tsx` — fichas coach
- `client/src/pages/core/Schedule.tsx` — god file ~228KB (U Schedule + Wellness como tabs)
- `client/src/pages/core/Stats.tsx` — U Stats: 2 tabs (Liga/Jugadoras) + SeasonPicker
- `client/src/pages/core/Home.tsx` — Home con KPI bar + grid módulos
- `client/src/pages/core/ModuleNav.tsx` — nav 5 items fijos
- `client/src/pages/core/ModulePage.tsx` — shell módulos
- `client/src/pages/core/Playbook.tsx` — "en desarrollo"
- `client/src/components/branding/ModuleHeader.tsx` — header centrado con logo SVG
- `client/src/index.css` — sistema 3 temas via CSS variables
- `client/src/lib/stats-api.ts` — hooks stats completos
- `server/routes.ts` — rutas API Express
- `server/stats-ingest.ts` — ingest endpoint Pi → Railway → Supabase
- `ios/App/App/ThemePlugin.swift` — plugin nativo iOS para sincronizar UIWindow.backgroundColor con tema
- `ios/App/App.xcodeproj/project.pbxproj` — MODIFICADO — ThemePlugin registrado en Sources

## NUNCA tocar
- `Profile.tsx` · `schema.ts` · `migrations/`
- SQL destructivo: solo Supabase SQL Editor, nunca `drizzle-kit push`

---

## Estado actual — sesión 2026-05-20 (cierre)

### ✅ Stats Fase 2 — PlayerSheet redesign completo

**StatsRadar** (`client/src/components/StatsRadar.tsx`):
- Dual mode `compact` (iOS) / full (desktop)
- Normalización: `AVG_NORM=0.65` → media de liga en 0.65, p95 → 1.0
- Grid rings en `[0.25, 0.65, 0.85, 1.0]` — ring 2 coincide exactamente con avg
- Una sola línea avg punteada (acento del tema), sin ring duplicado
- Toggle posición controlado desde parent (`byPosition`+`onTogglePosition`+`leagueAvgData`+`percentilesData`)
- Colores acento por tema: gamenight=amber, office=indigo, oldschool=teal
- Labels ejes usan `col.dot` (color acento) — visibles en los 3 temas
- Props: `positionLabel` (traducido desde parent, NO chino crudo)
- Labels DENTRO del viewBox — sin `overflow:visible` (no hay clipping)

**StatsPlayerSheet** (`Stats.tsx`):
- Hero: radar izq + 7 barras de stats der (PPG/RPG/FG%/TS%/eFG%/APG/3P%)
- 3P% siempre visible: `fg3 = p.fg3Pct ?? (gameLog.length > 0 ? 0 : null)`
- Barra 3P% compara contra `lg?.fg3Pct` (NO `fgPct * 0.85`)
- `barColor()`: `lgv == null → "muted"` (antes `!lgv → "amber"` roto para 0)
- Insight badge bajo barra 3P%: `"3s attempted: none/very few/few/average/many/loads"`
  - 6 niveles por `tpaPerGame` vs percentiles p25/p50/p75/p90 de TPA
  - `tpaPerGame` con sanity cap: si avg > 20 (dato acumulado) usa `player.games`
  - Caso explícito `tpa === 0` → "none"/"ninguno"/"无" — evita bug de "loads" sin intentos
- Toggle posición: `byPosition` en StatsPlayerSheet → sincroniza radar + barras
- Grids: PPG/RPG/APG grandes + SPG/BPG/TOPG/MPG con labels text-[11px]/70
- Home/Away splits
- 3 tabs: Forma · Deep stats · Partidos
  - Forma: minibar L5 + media
  - Deep stats: Perfil temporada (DD/TD/Consistencia/PIE con descripción) + Cuatro Factores vs Liga + Más stats
  - Partidos: W/L badge + fecha + "vs/@ Rival" (isHome pendiente en GameLogEntry)
- `positionLabel={translatePosition(player.position, locale)}` — nunca chino crudo
- `showMoreStats` state declarado pero no usado — sin impacto funcional

**Navegación panel desktop — 3 niveles**:
- Nivel 1 (sin panel): tabla `max-w-5xl`, panel `w-80`
- Nivel 2 (equipo/jugadora directa): panel `w-700px`, tabla `max-w-2xl`
- Nivel 3 (jugadora desde roster): panel `w-900px` (`panelMax`), tabla `max-w-sm` — standings oculta PPG/OPPG/NET/eFG%
- `isLevel3 = isDesktop && Boolean(playerSheetId && returnToTeamId)`
- Standing click limpia `playerSheetId` + `returnToTeamId` antes de `setTeamSheetId`

**Back button + roster scroll** (desktop únicamente):
- `returnToPlayerId` state en Stats()
- Al abrir jugadora desde roster: `setReturnToPlayerId(id)` antes de navegar
- `closePlayerSheet`: guarda `prevPlayerId`, limpia `returnToPlayerId` con `setTimeout(..., 600)` para dar tiempo al mount de TeamSheet
- `StatsTeamSheet`: prop `scrollToPlayerId` + `useEffect` → abre roster + scroll
- Botones roster tienen `data-player-id={p.externalId}`
- **NO implementado en iOS** (Sheet mobile no tiene este flujo)
- **TRAMPA**: limpiar `returnToPlayerId` ANTES del mount de TeamSheet rompe el scroll

**WCBA team names** — `pickName()` con fallback `WCBA_TEAM_EN`:
- 18 equipos mapeados de chino → inglés
- Fases standings: `常规赛A组` → "Group A", `B组` → "Group B", `季后赛` → "Playoffs"
- `translatePosition()` cubre 7 posiciones chino → ES/EN

**Backend additions**:
- `/api/stats/league-averages`: +`fg3Pct` (3P% de liga)
- `/api/stats/player-percentiles`: +`p25Tpa`, `p50Tpa`, `p75Tpa`, `p90Tpa`
- Ambos endpoints: `?position=` para filtro por posición
- `stats-api.ts`: tipos actualizados con todos los campos nuevos

**PENDIENTE próxima sesión**:
1. Verificar en producción que insight "3s attempted" muestra valores correctos — confirmar si `g.tpa` en game log es per-game o acumulado en datos reales
2. Shot chart rediseño: laterales más anchos para datos de corner (actualmente `isLandscape` only)
3. Back+scroll en iOS Sheet mobile — no implementado
4. `isHome` en `GameLogEntry` — no está en el tipo, se usa `(g as any).isHome` → añadir al tipo cuando backend lo devuelva

### ✅ Sprint E cerrado — campo `threat` en Slide 0 (`74e1468`)
### ✅ Sprint D cerrado — ReportSlidesV1 3 slides (`de9d2c4`)
### ✅ Stats + Radar + Performance — bundle 253KB gzip ✅

### ⏳ Collector Pi — PENDIENTE
```bash
scp -r "/Users/palant/Downloads/U scout/ucore/collector/dist/" pablo@192.168.1.59:~/ucore/collector/dist/
ssh pablo@192.168.1.59 "pm2 restart ucore-collector"
```

### ⏳ Sprint F — OverridePanel — VERIFICAR ANTES DE TRABAJAR
- Backend 100%: GET/POST/DELETE `/api/players/:id/overrides` ✅
- Frontend `OverridePanel.tsx` cableado — pendiente verificar en dispositivo

---

## Próximos sprints

### Stats Fase 3 PENDIENTE
- Bubble chart: FGA/g vs TS%, burbuja=MIN/g
- Comparador: radar superpuesto hasta 3 jugadoras
- Stats Home dashboard coaching
- Shot chart rediseño: ampliar laterales para meter datos de corner, actualmente `isLandscape` only

### Stats Fase 4 PENDIENTE
- Pi hotspotdata → poblar shot_x/shot_y (actualmente 0 filas)
- Shot chart individual con datos reales por zona

### iOS / TestFlight PENDIENTE
- `100dvh` bug → fix antes de build
- Bundle <300KB gzip: (1) i18n lazy (2) code splitting
- RECORDAR: verificar hero card "Mis estadísticas" para jugadoras — depende de `profile.wcba_external_id` no null

---

## U Scout — Estado motor y reports

### RenderedIdentity — campos actuales
```typescript
export interface RenderedIdentity {
  archetypeLabel: string;
  tagline: string;
  threat: string;          // derivado en renderThreat(), nunca vacío
  dangerLevel: 1|2|3|4|5;
  difficultyLevel: 1|2|3|4|5;
  archetypeAlternatives: { label: string; score: number }[];
}
```

### Motor
- `motor-v4.ts` — NO tiene `threat` en `MotorV4Output.identity` (por diseño — se deriva en renderer)
- Motor v2.1 es client-side — deuda técnica (server-side pendiente, no prioritario)

### Approval flow (spec aprobada, backend completo)
- GET/POST/DELETE overrides en routes.ts ✅
- `storage`: `listReportOverridesForPlayer`, `upsertReportOverride`, `deleteReportOverride` ✅
- Frontend: `OverridePanel.tsx` + `approval-api.ts` + `ReportViewV4.tsx` ✅

---

## Desktop UI/UX — PENDIENTE

### REGLA ABSOLUTA
**NUNCA** crear archivos `*Desktop.tsx` separados para Schedule o Stats.
**SIEMPRE** editar el archivo existente añadiendo clases `md:` / `lg:` / `xl:`.

### Estado archivos desktop
- `Home.tsx` → router `HomeDesktop.tsx` / `HomeMobile.tsx` ✅
- `Schedule.tsx`, `Stats.tsx` — sin variante desktop ⏳

---

## Sistema de Temas
- `.dark` (Game Night) — amber `#F5A623`, fondo `228 18% 5%`, card `#131318`
- `.theme-office` — indigo `#4563E9`, fondo blanco, card `#ffffff`
- `.theme-oldschool` — naranja + teal, fondo mahogany, card `#3D2410`

### Colores nativos (ThemePlugin)
```
gamenight: #131318 · office: #ffffff · oldschool: #3D2410
```

### Franja blanca home indicator — RESUELTA ✅ (ThemePlugin.swift + body::after)

---

## Logo SVG — referencia
```
viewBox icono compacto: "256 280 512 360"
viewBox favicon/app icon: "256 173 512 512"

Paleta módulos:
  core:#6B6B9A  scout:#3A81FE  schedule:#10B981
  wellness:#A78BFA  stats:#F59E0B  playbook:#EF4444
```

---

## Raspberry Pi 5
- IP: 192.168.1.59 · SSH: pablo@192.168.1.59
- Node 20 + PM2 · Collector en ~/ucore/collector
- **dist/ sincronizado desde Mac** — NUNCA compilar en el Pi

## API WCBA — URLs confirmadas
```
BASE: https://www.cba.net.cn
standings:  GET /datahub/cbamatch/rank/teamrankfirst?competitionId=56&seasonId=2092
schedule:   GET /datahub/cbamatch/games/matchschedules?...&teamId=''
boxscore:   GET /datahub/cbamatch/games/matchinfoscores?matchId=X&gameId=X
playerbox:  GET /datahub/cbamatch/games/player/playerdata?gameId=X
pbp:        GET /api/v2/game/${gameId}/actions
⚠ matchschedules requiere teamId='' (string vacío)
⚠ /datahub/wcba/* → 404, usar /datahub/cbamatch/*
```

## Supabase — estado tablas
```
stats_games:            223 partidos · stats_teams: 18 · stats_players: 307
stats_standings:        18 filas
stats_player_boxscores: 5312 rows ✅ · stats_pbp: 116.700 eventos ✅
shot_x/shot_y:          0 filas (hotspotdata no sincronizado)
```

## Club INNER MONGOLIA
- Club ID: 4bca3aa8-9062-4709-9d29-9e2313308f1a · Pablo (b334e51a) = owner + head_coach

---

## Reglas entrega código (NO NEGOCIABLES)
- Claude edita directamente con filesystem:write_file
- O da comandos de terminal exactos
- O da prompt completo para agente Cursor
- NUNCA texto para copiar/pegar manualmente
- `npm run check` después de cada cambio (exit 0 antes de commit)
- Stats.tsx, routes.ts, Schedule.tsx → preferir prompt Cursor (archivos grandes)
- Cursor duplica handlers en routes.ts — verificar siempre últimas 50-80 líneas

## Trampas conocidas
- `stats_player_boxscores.minutes` = TEXT "MM:SS"
- /datahub/wcba/* → 404. Usar /datahub/cbamatch/*
- matchschedules requiere teamId='' obligatorio
- standings: campo "loses" (no "losses") en API
- Pi: pm2 restart NO recompila — usa dist/ tal cual
- Schedule.tsx es 228KB — leer en chunks, nunca completo
- bash_tool corre en Linux — NO accede al Mac directamente
- Path con espacio `/U scout/` — siempre comillas en bash
- `motor-v4.ts`: `threat` NO existe en MotorV4Output — se genera en reportTextRenderer.ts
