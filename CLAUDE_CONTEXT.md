# U Core — Contexto para Claude

> Leer este archivo al inicio de cada sesión antes de proponer cualquier cambio.
> Claude SIEMPRE actualiza este archivo al cierre de sesión.
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
- `client/src/pages/scout/ReportSlidesV1.tsx` — 3 slides
- `client/src/pages/scout/ReportViewV4.tsx` — shell coach_review con OverridePanel
- `client/src/pages/scout/PlayerEditor.tsx` — editor inputs jugador
- `client/src/pages/scout/Personnel.tsx` — gestión plantillas + import WCBA + import liga + borrar todo ✅
- `client/src/pages/scout/MyScout.tsx` — fichas coach (canónicas + sandbox) + StatsMiniChip ✅
- `client/src/pages/core/Schedule.tsx` — god file ~228KB (U Schedule + Wellness como tabs)
- `client/src/pages/core/Stats.tsx` — U Stats: 2 tabs (Liga/Jugadoras) + SeasonPicker + deep link + radar ✅
- `client/src/pages/core/Home.tsx` — **REESCRITO p23** — KPI bar + próximo evento + 2×2 grid + Mi Club button
- `client/src/pages/core/ModuleNav.tsx` — **REESCRITO p23** — 4 items (player) / 5 items con Mi Club (staff)
- `client/src/index.css` — **REESCRITO p23** — sistema 3 temas via CSS variables
- `client/src/lib/stats-api.ts` — hooks completos ✅
- `client/src/components/StatsRadar.tsx` — radar 6 ejes recharts ✅
- `server/routes.ts` — rutas API Express
- `server/stats-ingest.ts` — ingest endpoint Pi → Railway → Supabase
- `collector/src/sync/boxscores.ts` — FIELD MAPPING FIJO ✅
- `collector/src/sync/pbp.ts` — URL /api/v2/game/${gameId}/actions ✅
- `collector/src/sync/standings.ts` — URL /datahub/cbamatch/rank/teamrankfirst ✅

## i18n — arquitectura
- `client/src/lib/i18n-core.ts` — runtime lazy: EN estático, ES/ZH async
- `client/src/lib/locales/en.ts` · `es.ts` · `zh.ts` — fuertemente tipados vía `I18nKey`
- Todas las claves `home_*` y `ucore_nav_*` añadidas en p23 ✅

## Tailwind v4
- NO hay tailwind.config.js — usa `@theme inline` en `client/src/index.css`
- Animaciones en `index.css`, NO en tailwind.config

## NUNCA tocar
- `Profile.tsx` · `schema.ts` · `migrations/`
- SQL destructivo: solo Supabase SQL Editor, nunca `drizzle-kit push`

---

## Sistema de Temas — implementado p23 ✅

Tres temas CSS vía clases en `<html>`:
- `.dark` (Game Night) — amber gold `#F5A623`, fondo near-black `228 18% 5%`
- `.theme-office` — indigo `#4563E9`, fondo blanco limpio `220 33% 96%`
- `.theme-oldschool` (Classic) — naranja `28 90% 52%` + teal complementario `178 55% 28%`, fondo mahogany cálido, fuente Space Mono, líneas de cancha vía CSS gradients, LED glow en `[data-scoreboard]` via `text-shadow`

### Cómo aplican
- Variables CSS en `client/src/index.css`: `--primary`, `--background`, `--card`, `--border`, `--foreground`, `--muted`, etc.
- Selector activador: `html.dark`, `html.theme-office`, `html.theme-oldschool`
- Font Space Mono: cargada en `client/index.html` via Google Fonts
- `[data-scoreboard]` → en Classic aplica LED glow. Usar en elementos numéricos prominentes.
- `[data-teal]` → en Classic aplica color teal secundario. Usar para acentos secundarios.
- Settings.tsx controla el cambio de tema via localStorage + clase en `document.documentElement`

### Componentes Home.tsx (p23)
```tsx
// KPI bar chip
function KpiCell({ value, label, color }) → <span data-scoreboard="" ...>

// 2×2 module card
function ModCard({ icon, title, subtitle, badge, dot, comingSoon, onClick })
// comingSoon=true → disabled + opacity-50

// Layout staff: KPI(players/sessions/wellness%) + próximo evento + grid(Schedule&Wellness, Scout, Stats, UPlaybook[comingSoon]) + Mi Club button
// Layout player: KPI(days/reports/wellness%) + próximo evento + grid(Schedule, Wellness, Scout, Stats)
```

---

## Estado app — 8 mayo 2026 (sesión p24 — EN CURSO)

### Completado p23 ✅
- **Redesign completo UI**: 3 temas (Dark/Classic/Office) en toda la navegación, todos los idiomas
- **Home.tsx reescrito**: KPI bar + próximo evento + 2×2 module grid + Mi Club button (staff)
- **ModuleNav.tsx reescrito**: 4 items (player) / 5 items + Mi Club (staff), dot activo, tamaños dinámicos
- **Bug fix**: Schedule y Wellness unificados en una sola tarjeta → /schedule (pestañas internas)
- **Bug fix**: U Playbook card (comingSoon) sustituye la tarjeta Wellness redundante en grid staff
- **Bug fix**: Mi Club desaparecido para head coach → añadido en ModuleNav (5th item) + botón explícito bajo grid en Home
- **CSS Classic mode**: court lines background, LED glow en [data-scoreboard], teal complementario, Space Mono
- **i18n**: claves `home_*` y `ucore_nav_club` en en/es/zh
- **Git push**: cambios pusheados a main → Railway deploy ✅

### ✅ Completado p24
- **Regla entrega código actualizada**: Claude edita directamente o da comandos/prompts Cursor, nunca texto manual
- **Capacitor config**: `server.url` activado → apunta a Railway. Estrategia: remote URL (cero cambios de código, API funciona automáticamente)
- **Responsive shell implementado**:
  - `App.tsx`: `max-w-md` solo en mobile, `md:pl-16 lg:pl-56` para offset sidebar
  - `ModuleNav.tsx`: dual render — bottom bar en mobile (sin cambios), sidebar vertical izquierda en `md+` (w-16 collapsed, lg:w-56 con labels)
  - `ModulePage.tsx`: `pb-16 md:pb-0` + header inner `max-w-5xl mx-auto` centrado en desktop
  - `Home.tsx`: `main` → `max-w-5xl mx-auto md:px-8 md:pb-10`, grid `grid-cols-2 md:grid-cols-4`, todos los `mx-4` con `md:mx-0`
  - `OnboardingFlow.tsx`: bug fix `TUTORIAL_SLIDES` → `activeSlides`

### 🔴 PRÓXIMO — iOS en dispositivo físico (Xcode abierto)
- Estado: `ios/` generado, Xcode abierto
- Cuenta actual: Apple Developer FREE (sin pagar $99 aún)
  - ✅ Puede correr en iPhone propio via USB (válido 7 días, luego re-instalar)
  - ❌ No puede usar TestFlight ni distribuir a otros
  - ✅ Para TestFlight: pagar $99/año en developer.apple.com → cambiar Team en Xcode → Archive → Distribute
- Para correr HOY sin pagar:
  1. Conectar iPhone por USB
  2. Xcode: seleccionar el iPhone como target (no simulador)
  3. Signing & Capabilities → Team: seleccionar cuenta personal gratuita
  4. Product → Run (Cmd+R)
  5. En iPhone: Settings → General → VPN & Device Management → Trust [tu email]
- appId: `com.ucore.app` (cambiar si conflicto → `com.pablomgz.ucore`)
- La app carga desde Railway (server.url en capacitor.config.ts) → requiere internet

### 🔴 PRÓXIMO — Responsive fases siguientes (base implementada p24)
- **Home.tsx**: grid más amplio en desktop (2-col o 3-col en lg+) → prompt Cursor (archivo grande)
- **Schedule.tsx**: split view horizontal en desktop → prompt Cursor (god file ~228KB)
- **Stats.tsx**: panel lateral o columnas en desktop → prompt Cursor
- **Scout**: idem

### 🔴 BACKLOG

#### Platform
- Avatar jugador: `BasketballPlaceholderAvatar` feo → reemplazar con silueta limpia
- Schedule scroll List→Planner: no recentra en hoy (pendiente)
- Jugadoras extranjeras con `-` en name_zh: fix-player-names.js las salta → name_en null

#### U Stats — backlog completo (identificado p24, requieren sesiones Cursor dedicadas)
- **Radar / "hide radar"**: se ve feo, necesita fix visual
- **Shoot zones**: diagrama mal dibujado, colores no funcionan en theme-oldschool, rediseñar desde cero
- **Landscape**: no aporta nada respecto a portrait, necesita layout dedicado (split view o landscape chart)
- **Tooltips stats**: al click en cada stat → tooltip con definición + fórmula de cálculo (todas las stats, incluso las básicas)
- **Stats avanzadas de equipos**: faltan muchas, ver blueprints/conversaciones previas
- **Team slide**: click en equipo → slide con datos completos del equipo, botón Roster → scroll del roster
- StatsRadar AXIS_MAX son estimaciones — verificar contra datos reales
- StatsComparator landscape split view

#### U Scout
- PlayerEditor: auditoría completa campos
- ReportViewV4 → diseño 3 slides

#### Personnel
- Migración asistida (sesión dedicada de diseño)

---

## Raspberry Pi 5
- IP: 192.168.1.59 · SSH: pablo@192.168.1.59
- Node 20 + PM2 · Collector en ~/ucore/collector
- **dist/ sincronizado desde Mac** — NUNCA compilar en el Pi
- Deploy Pi: `npm run build` en Mac → `scp -r dist/ pablo@192.168.1.59:~/ucore/collector/dist/` → `pm2 restart`

## Workflow Pi — REGLA FIJA
```bash
cd "/Users/palant/Downloads/U scout/collector"
npm run build
scp -r dist/ pablo@192.168.1.59:~/ucore/collector/dist/
ssh pablo@192.168.1.59 "cd ~/ucore/collector && pm2 restart ucore-collector"
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
playerbox:    GET /datahub/cbamatch/games/player/playerdata?gameId=X
roster:       GET /datahub/cbamatch/team/teamplayers?seasonId=X&teamId=X → data.data.players[]
pbp:          GET /api/v2/game/${gameId}/actions → array directo
⚠ matchschedules requiere teamId='' (string vacío)
⚠ /datahub/wcba/* dan 404 — usar /datahub/cbamatch/*
```

## API WCBA — field mapping player boxscore (CONFIRMADO)
```
p.points → pts · p.rebound → reb · p.assists → ast · p.steals → stl
p.blocks → blk · p.turnover → tov · p.fouls → fouls
p.shot → "6-17 (35.3%)" → parseShotStr → [fgm, fga]
p.threePoints → parseShotStr → [tpm, tpa]
p.foulShot → parseShotStr → [ftm, fta]
p.positiveNegativeValue → plusMinus
p.isStartLineUp → boolean
⚠ teamId NO viene en player data
```

## API WCBA — field mapping standings (CONFIRMADO)
```
r.teamId/teamName/rank/wins · r.loses (no "losses") · r.pts → ptsPerGame
r.losePts → ptsAgainstPerGame · r.phaseName/phaseId · r.goalDifference
r.winLoss → streak · r.last10Win/last10Loses · r.homeWin/homeLoses
```

## Supabase — estado tablas (8 mayo 2026)
```
stats_games:            223 partidos status=4, season_id=2092
stats_teams:            18 equipos (name_en pinyin ✅)
stats_players:          307 jugadoras (name_en pinyin ✅)
stats_standings:        18 filas ✅
stats_player_boxscores: 5312 rows, avg_scorers=9.7, max_pts=51 ✅
stats_pbp:              116.700 eventos ✅
```

## Endpoints Railway implementados
```
GET  /api/stats/seasons       ✅
GET  /api/stats/standings     ✅ teamName (zh) + teamNameEn (pinyin)
GET  /api/stats/leaders       ✅ (HAVING games >= 5)
GET  /api/stats/players       ✅ teamName (zh) + teamNameEn (pinyin)
GET  /api/stats/player/:id    ✅ ppg/rpg/apg + teamNameEn + try/catch
GET  /api/stats/team/:id      ✅ nameZh + nameEn
GET  /api/stats/player-link   ✅
GET  /api/stats/games         ✅
GET  /api/stats/sync-status   ✅ Bearer STATS_INGEST_KEY
POST /api/stats/ingest        ✅ Bearer STATS_INGEST_KEY
GET  /api/stats/teams         ✅ lista 18 equipos WCBA
POST /api/stats/import-team   ✅ importa jugadoras de un equipo
POST /api/stats/import-league ✅ importa los 18 equipos
DELETE /api/personnel/reset   ✅ headCoach only, confirmación "CONFIRMAR"
```

## Collector — lógica sync (trampa crítica)
```
syncNewPlayerBoxscores → fetchSyncStatus() → boxDone[]
Si gameId ya tiene filas → en boxDone → se SALTA
⚠ Para re-sync completo: TRUNCATE stats_player_boxscores en Supabase → pm2 restart
```

## Scripts Pi disponibles
```
node test-sync-one.js        — ingesta 1 partido
node audit-end-to-end.js     — audit completo 34/34 ✅
node fix-player-names.js     — ya ejecutado, no repetir
```

## Club INNER MONGOLIA
- Club ID: 4bca3aa8-9062-4709-9d29-9e2313308f1a
- Pablo (b334e51a) = owner + head_coach

---

## Reglas entrega código
- NUNCA texto para copiar/pegar en archivos — Pablo no edita archivos manualmente
- Claude SIEMPRE: edita directamente con Edit/Write, O da comandos de terminal, O da prompt para el agente Cursor
- Cuando el archivo es grande (Schedule.tsx, Stats.tsx, routes.ts): prompt Cursor
- Cuando el archivo es pequeño o el cambio es quirúrgico: Edit/Write directo
- NUNCA "añade estas líneas aquí" — siempre archivo completo, O Edit quirúrgico, O comando terminal, O prompt Cursor
- `npm run check` después de cada cambio
- Migrations destructivas: raw SQL Supabase, nunca drizzle-kit push
- Pi: NUNCA compilar en Pi — build en Mac + scp dist/
- Tailwind v4: animaciones en index.css, NO en tailwind.config
- Stats.tsx, routes.ts, Schedule.tsx → preferir prompt Cursor (archivos grandes)
- bash_tool corre en Linux — NO accede al Mac directamente
- Cursor duplica handlers en routes.ts — verificar siempre

## Notas (trampas conocidas)
- `stats_player_boxscores.minutes` = TEXT "MM:SS"
- /datahub/wcba/* → 404. Usar /datahub/cbamatch/*
- matchschedules requiere teamId='' obligatorio
- player boxscore: teamId NO viene en player data
- standings: campo "loses" (no "losses") en API
- Pi: pm2 restart NO recompila — usa dist/ tal cual
- syncNewPlayerBoxscores SALTA juegos ya en boxDone → TRUNCATE para re-sync completo
