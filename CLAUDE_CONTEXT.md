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
- `client/src/lib/theme.ts` — gestión temas + **sincronización nativa iOS via ThemePlugin**
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
- `ios/App/App/ThemePlugin.swift` — **NUEVO** plugin nativo iOS para sincronizar UIWindow.backgroundColor con tema
- `ios/App/App.xcodeproj/project.pbxproj` — **MODIFICADO** — ThemePlugin registrado en Sources

## NUNCA tocar
- `Profile.tsx` · `schema.ts` · `migrations/`
- SQL destructivo: solo Supabase SQL Editor, nunca `drizzle-kit push`

---

## Estado sesión 2026-05-19 (activa)

### ✅ Completado sesión 2026-05-19

#### U Stats — Sprint C
- `ShotZoneChart` sustituido: 10 zonas NBA estándar (RA, Paint, Mid-L/C/R, Corner-L/R, Wing-L/R, Center-3). Colores vs liga. Compatibilidad legacy `fgPct`/`fg3Pct`.
- `StatsTeamSheet` sustituido: 3 tabs (Ficha / Avanzado / Partidos)
  - Ficha: PPG/NET/OPPG + dots L5 + Four Factors + Casa/Fuera + forma reciente + plantilla colapsable
  - Avanzado: ORTG/DRTG/netRtg/PACE/PPP + OReb%/DReb%/eFG%/TOV% + donut puntos por zona + quintetos placeholder
  - Partidos: game log equipo (fecha/rival/marcador/diferencial)
- Backend `/api/stats/team/:externalId`: añadidos ortg, drtg, netRtg, pppOf, pppDef, pointsByZone, gameLog
- `stats-api.ts`: +`TeamGameLogEntry`, campos opcionales en `TeamDetail` (ortg/drtg/netRtg/pppOf/pppDef/pointsByZone/gameLog)
- Ajustes SQL reales: home_team_id/away_team_id vs stats_teams.id, pb.tpm (no fg3m), sg.scheduled_at (no game_date)
- `npm run check` → exit 0 en ambos sprints

### ✅ Completado sesiones anteriores

#### U Stats — Fase 0 y 1
- Schema auditado: shot_x/shot_y ❌ (0 filas), stint_id ✅ 116.700, rebound_type ✅ 17.140, off_reb/def_reb ✅
- Backend Fase 1 completo en `routes.ts`:
  - `/api/stats/team/:id`: +eFGPct, tovPct, ftRate, orbPct, drbPct, paceEst
  - `/api/stats/player/:id`: +tsPct, eFGPct, astTovRatio, ftRate, usagePct, orbPerGame, drbPerGame, pie, homeSplit, awaySplit
  - `/api/stats/leaders`: +tsPct, eFGPct, astTovRatio, orbPerGame
  - `/api/stats/league-averages`: nuevo endpoint
  - `/api/stats/player-percentiles`: nuevo endpoint
  - `stats-api.ts`: +useLeagueAverages, usePlayerPercentiles

#### iOS fixes
- **ThemePlugin.swift** creado y registrado en Xcode — sincroniza `UIWindow.backgroundColor` con el tema activo (gamenight/office/oldschool) via bridge JS→nativo. Resuelve la franja blanca del home indicator.
- `theme.ts` actualizado — llama a `cap.Plugins.Theme.setBackgroundColor` al cambiar de tema
- `AppDelegate.swift` limpiado — eliminado código incorrecto de UserDefaults
- **App icon** regenerado — logo ocupa ~85% del canvas (vs ~50% anterior), centrado verticalmente
- **Schedule día incorrecto** — `localDateKey()` helper reemplaza `toISOString().slice(0,10)` en 5 puntos del Schedule.tsx. Usa hora local, no UTC. Fix para China (UTC+8).

#### UI/UX fixes Home
- KPI bar visible en Dark: `border-2 border-primary/20` + `min-h` via inline style
- Grid módulos: quita `flex-1` problemático, usa layout natural
- Mi Club siempre visible
- Header centrado con logo 56px móvil / 88px desktop
- `ModuleHeader.tsx` — logo SVG con `viewBox="256 280 512 360"` correcto

#### Otros fixes
- Planner scroll: eliminada `scrollElementIntoOverflowParents` → `scrollIntoView({block:"nearest"})`
- Nav: `bg-card` sin `backdrop-blur`, `pb-[env(safe-area-inset-bottom)]` en div interior
- `body::after` con `hsl(var(--background))` cubre home indicator (complementa ThemePlugin)
- `capacitor.config.ts`: `contentInset: 'never'`

### ✅ Franja blanca home indicator — RESUELTA
- ThemePlugin.swift sincroniza UIWindow.backgroundColor con el tema activo
- `body::after` CSS cubre el área del home indicator
- Verificado en dispositivo físico iPhone 16 Plus

---

## U Stats — Plan completo de implementación

### Fase 2 PENDIENTE — UI con métricas avanzadas
- TeamSheet: Cuatro Factores (eFG%, TOV%, FT Rate, ORB%, Pace) vs media liga con semáforo
- PlayerSheet: chips TS%/eFG%/PIE/AST-TOV/Usage + home/away split
- StatsRadar: calibrar AXIS_MAX con percentiles reales (endpoint ya existe)
- Standings: +eFG% + racha visual (●●○●●)
- Tooltips: tap en StatChip → popover con definición + fórmula
- Shot zones: rediseño SVG FIBA correcto + CSS vars (sin datos reales aún)

### Fase 3 PENDIENTE — Nuevas pantallas
- Bubble chart `/stats`: FGA/g vs TS%, burbuja=MIN/g (Recharts ya en bundle)
- Comparador: radar superpuesto hasta 3 jugadoras
- Stats Home dashboard coaching: Próximo rival / L5 propio / Alerta liga
- Team game log completo (click equipo → standings + historial partidos)

### Fase 4 PENDIENTE — Pi hotspotdata
- Activar sync de hotspotdata en collector → poblar shot_x/shot_y/shot_zone
- Shot chart individual: dots sobre half-court SVG calibrado

---

## Desktop UI/UX — PENDIENTE

### Fact técnico confirmado (sesión 2026-05-17)
- `window.innerWidth` en Mac fullscreen = **1910px**
- "Designed for iPad" en Mac da viewport completo al maximizar — responsive CSS funciona
- Todos los breakpoints Tailwind activos: `md:` `lg:` `xl:` `2xl:`
- No hay problema de arquitectura — es 100% problema de CSS

### Estado de archivos desktop (tras revert b8b3241)
- `Home.tsx` → router a `HomeDesktop.tsx` / `HomeMobile.tsx` via `useIsDesktop()` ✅
- `HomeDesktop.tsx` — implementado, datos reales ✅
- `ScoutDesktop.tsx` — implementado ✅
- `Schedule.tsx` — sin variante desktop, solo edits quirúrgicos md: ⏳
- `Stats.tsx` — sin variante desktop, solo edits quirúrgicos md: ⏳
- `useIsDesktop.ts` / `useHomeData.ts` — existen ✅

### REGLA ABSOLUTA — aprendida por fallos repetidos
**NUNCA** crear archivos `*Desktop.tsx` separados para Schedule o Stats.
**NUNCA** reemplazar un componente completo con una variante desktop.
**SIEMPRE** editar el archivo existente añadiendo clases `md:` / `lg:` / `xl:`.
Motivo: los rewrites completos destruyen formularios, botones y lógica de interacción existente.

### Trabajo pendiente desktop
1. **Schedule.tsx** — labels con `text-[8-11px]` sin `md:` + layout planner no aprovecha 1910px
2. **Stats.tsx** — mismo problema tipografía + standings/detalle sin grid horizontal desktop
3. **Por verificar**: Personnel, PlayerHome, Dashboard (player), WellnessStandalone

### Cómo auditar antes de editar
```bash
grep -n 'text-\[' client/src/pages/core/Schedule.tsx | grep -v 'md:'
```

---

## U Scout — Mejoras pendientes

### APIs y datos
- Endpoints WCBA para datos en tiempo real de partidos (ya scrapeados, falta surfacing en UI)
- `report_overrides`: tabla y endpoint `POST /api/players/:id/overrides` existen pero sin frontend (OverridePanel pendiente de integración)
- `hasReport` fix: prompt preparado pero no aplicado

### Motor y reports
- Motor v2.1 es server-side pendiente (actualmente client-side — deuda técnica)
- ReportViewV4.tsx → rediseño 3 slides aprobado:
  - Slide 1: ¿Quién es? (archetype + tagline + threat)
  - Slide 2: ¿Qué hará? (top 3 situaciones primarias)
  - Slide 3: ¿Qué hago yo? (DENY/FORCE/ALLOW + max 2 AWARE)
- Approval flow (spec aprobada): Edit → Propose → Staff debate → Approve → Publish

### Bundle
- Tamaño actual: ~509KB gzip. Target TestFlight: <300KB
- Plan: lazy i18n por locale (−120KB) + React.lazy code splitting (−100KB)

---

## U Playbook — Implementación pendiente

Actualmente: página placeholder "en desarrollo" con feature pills.

### Spec pendiente de diseño:
- Play designer: diagramas de jugadas con canvas/SVG
- Tactical board: pizarra interactiva
- Shared game plans: publicar a jugadoras
- Video links: integración con clips de vídeo
- Defensive systems builder (ya existe `defensive-system-builder-elite.html` como referencia)

---

## U Schedule & Wellness — Specs pendientes

### Schedule
- Desktop split view: lista izquierda, detalle sesión derecha
- Kebab menu: tap = detalle, long-press = editar (actualmente mezclado)
- Exportar semana como imagen (funcionalidad existe, bugs)

### Wellness
- Trend charts: implementados en p26 pero necesitan revisión visual en desktop
- Alertas de wellness: lógica existe, falta prominencia en Home

---

## Sistema de Temas
Tres temas CSS vía clases en `<html>`:
- `.dark` (Game Night) — amber gold `#F5A623`, fondo near-black `228 18% 5%`, card `228 16% 9%` = `#131318`
- `.theme-office` — indigo `#4563E9`, fondo blanco, card `#ffffff`
- `.theme-oldschool` (Classic) — naranja + teal, fondo mahogany, fuente Space Mono, card `#3D2410`

### Colores nativos por tema (ThemePlugin)
```
gamenight: #131318  (UIWindow background)
office:    #ffffff
oldschool: #3D2410
```

---

## Logo SVG — referencia
```
D=25: HORN_CLIP_Y=427, CONN_SCALE=translate(0,544) scale(1,1.32468) translate(0,-544)
viewBox icono compacto: "256 280 512 360"
viewBox favicon/app icon: "256 173 512 512"

Paleta módulos:
  core:     #6B6B9A (slate)
  scout:    #3A81FE (blue)
  schedule: #10B981 (emerald)
  wellness: #A78BFA (lavender)
  stats:    #F59E0B (amber)
  playbook: #EF4444 (red)
```

---

## Raspberry Pi 5
- IP: 192.168.1.59 · SSH: pablo@192.168.1.59
- Node 20 + PM2 · Collector en ~/ucore/collector
- **dist/ sincronizado desde Mac** — NUNCA compilar en el Pi

## Workflow Pi
```bash
cd "/Users/palant/Downloads/U scout/collector"
npm run build
scp -r dist/ pablo@192.168.1.59:~/ucore/collector/dist/
ssh pablo@192.168.1.59 "cd ~/ucore/collector && pm2 restart ucore-collector"
```

## API WCBA — URLs confirmadas
```
BASE: https://www.cba.net.cn
standings:    GET /datahub/cbamatch/rank/teamrankfirst?competitionId=56&seasonId=2092
phasemenus:   GET /datahub/cbamatch/games/phasemenus?seasonId=2092
schedule:     GET /datahub/cbamatch/games/matchschedules?competitionId=56&seasonId=2092&phaseId=X&roundId=X&teamId=''
boxscore:     GET /datahub/cbamatch/games/matchinfoscores?matchId=X&gameId=X
playerbox:    GET /datahub/cbamatch/games/player/playerdata?gameId=X
roster:       GET /datahub/cbamatch/team/teamplayers?seasonId=X&teamId=X → data.data.players[]
pbp:          GET /api/v2/game/${gameId}/actions → array directo
⚠ matchschedules requiere teamId='' (string vacío)
⚠ /datahub/wcba/* dan 404 — usar /datahub/cbamatch/*
```

## Supabase — estado tablas
```
stats_games:            223 partidos status=4, season_id=2092
stats_teams:            18 equipos
stats_players:          307 jugadoras
stats_standings:        18 filas
stats_player_boxscores: 5312 rows ✅
stats_pbp:              116.700 eventos ✅
shot_x/shot_y:          0 filas (hotspotdata no sincronizado)
```

## Club INNER MONGOLIA
- Club ID: 4bca3aa8-9062-4709-9d29-9e2313308f1a
- Pablo (b334e51a) = owner + head_coach

---

## Reglas entrega código (NO NEGOCIABLES)
- Claude edita directamente con filesystem:write_file / Filesystem:edit_file
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
