# U Scout — Contexto para Claude

> Leer este archivo al inicio de cada sesión antes de proponer cualquier cambio.

---

## Producción
- URL: https://u-scout-production.up.railway.app
- Deploy: Railway, auto-deploy en push a `main`
- DB: Supabase (PostgreSQL)
- Repo local: `/Users/palant/Downloads/U scout`

## Stack
React + TypeScript + Vite · Express · Drizzle ORM · TanStack Query · shadcn/ui · Tailwind

## Archivos clave
- `client/src/lib/motor-v4.ts` — scoring layer
- `client/src/lib/motor-v2.1.ts` — motor base
- `client/src/lib/reportTextRenderer.ts` — texto EN/ES/ZH con gender
- `client/src/lib/mock-data.ts` — playerInputToMotorInputs, clubRowToMotorContext
- `client/src/pages/scout/ReportSlidesV1.tsx` — 3 slides (rediseño Figma YA APLICADO)
- `client/src/pages/scout/ReportViewV4.tsx` — shell coach_review
- `client/src/pages/scout/PlayerEditor.tsx` — editor inputs jugador
- `client/src/pages/core/Schedule.tsx` — god file 228KB (U Schedule)
- `client/src/pages/core/Stats.tsx` — U Stats módulo completo (tabs Season/Games)
- `client/src/lib/stats-api.ts` — tipos PlayerSeasonStats + GameLog, hooks usePlayerSeasonStats + useGameLog
- `server/routes.ts` — rutas API Express
- `server/storage.ts` — acceso Supabase
- `scripts/calibrate-motor.ts` — 66 perfiles (100% / 551 checks)
- `scripts/eval-motor-quality.ts` — 10 perfiles calidad
- `scripts/eval-report-llm.ts` — evaluador multi-juez v2 (pendiente API keys)

## i18n — arquitectura lazy
- `client/src/lib/i18n-core.ts` — runtime lazy: EN estático, ES/ZH async
- `client/src/lib/i18n.ts` — re-export shim
- `client/src/lib/locales/en|es|zh.ts` — chunks lazy

## Capacitor
- `capacitor.config.ts` — appId: com.ucore.app, webDir: dist/public
- iOS platform añadido: `ios/` en repo
- Xcode: NO instalado · Apple Developer Account: NO ($99/año — pendiente)
- Retomar: `npx cap sync && npx cap open ios`

## NUNCA tocar
- `Profile.tsx` · `schema.ts` · `migrations/`
- SQL destructivo: solo Supabase SQL Editor, nunca `drizzle-kit push`

---

## Arquitectura 4 capas U Scout
1. `motor-v4.ts` → scores + candidatos
2. `reportTextRenderer.ts` → texto EN/ES/ZH
3. `overrideEngine.ts` → overrides + discrepancias
4. `ReportSlidesV1.tsx` + `ReportViewV4.tsx` → UI

## Flujo de navegación
Personnel → PlayerEditor → MyScout → FilmRoom → GamePlan

---

## Estado sesión 1 mayo 2026 (p8 — FINAL)

### Commits de esta sesión (en orden)
1. `fix: move tsx to dependencies so Railway build can find it`
2. `feat: U Stats module + P0 fixes (Dashboard nav, viewStatus threshold, mergeAndClear transaction, ClipboardList import)`
3. `fix: canonical players visible to all club coaches regardless of creator`
4. `fix: Personnel access for coaches with operationsAccess badge + canCreateCanonical`
5. `fix: getPlayers returns canonicals even when club has no active members`
6. `fix: validate club ownership before promoting player to canonical`
7. `fix: sandbox players scoped to creator, not visible to other coaches`

### Completado esta sesión ✅
- **Build Railway**: `tsx` movido de devDependencies a dependencies
- **Audit UX/DB/TestFlight completo**: 3P0 / 7P1 / 4P2 documentados
- **P0 fixes aplicados**: Dashboard nav, viewStatus threshold, mergeAndClear transaction, ClipboardList
- **U Stats módulo**: Stats.tsx + API + tabla Supabase
- **Acceso Personnel por badge**: capabilities.ts + CoachHome + Personnel con operationsAccess
- **Canónicos visibles a todos**: getPlayers devuelve is_canonical=true a todo el club
- **Audit multi-club scope**: 2P0 + 3P1 adicionales encontrados y documentados
- **P0 fix — canonical ownership**: POST /api/players/:id/canonical valida que el player pertenece al club del head_coach
- **P0 fix — sandbox cross-coach**: getPlayers con viewerUserId → sandbox solo visible al creador; canónicos visibles a todos los coaches del club

### Arquitectura de permisos getPlayers (definitiva)
```
getPlayers(teamId?, clubId?, viewerUserId?)

Con clubId + viewerUserId (GET /api/players):
  WHERE is_canonical = true          → todos los coaches del club lo ven
  OR created_by_user_id = viewerUserId  → cada coach ve solo su sandbox

Con clubId sin viewerUserId (legacy — film-room, delete-info, etc.):
  WHERE is_canonical = true OR created_by_user_id IN (all active club members)

Sin clubId (sin scope):
  WHERE sin filtro (todos los players)
```

### Arquitectura de permisos Personnel
- **head_coach / master**: acceso + crear canónicos + promover sandbox
- **coach con `operationsAccess`**: ve Personnel, edita canónicos, NO crea ni promueve
- **coach sin badge**: sin acceso a Personnel

### 🔴 RIESGOS ACTIVOS (pendientes)
- **P1** Touch targets flechas ReportSlidesV1: `p-2` (~36px) — Apple exige 44px
- **P1** hasReportInputs en MyScout: heurística frágil (4 frecuencias, falla con off-ball/catch&shoot)
- **P1** queryKey de usePlayers/useTeams/useClub sin userId — riesgo de cache compartido en dev/QA

### 🟡 PENDIENTE PRÓXIMA SESIÓN (orden prioridad)
1. **Verificar en producción** que Luffy ve fichas canónicas en MyScout (deploy Railway activo)
2. **Touch targets**: flechas ReportSlidesV1 `p-2` → `p-3`
3. **U Stats — configuración scraper**: UI para añadir URLs de scraper manualmente
4. **TestFlight prep**: contratar Apple Developer ($99) + instalar Xcode → ejecutar prompt Cursor
5. **hasReportInputs**: ampliar check a catchAndShoot + offBall
6. **Raspberry Pi scraper**: cuando llegue Pi 5, endpoint ingest vía API key interna
7. **Wellness standalone jugadora**: acceso directo sin pasar por /schedule

---

## U Scout — rutas activas
- `/coach` → CoachHome
- `/coach/personnel` → Personnel
- `/coach/my-scout` → MyScout
- `/coach/quick-scout/:id` → QuickScout
- `/coach/player/:id` → PlayerEditor
- `/coach/film-room` → FilmRoom
- `/coach/game-plan` → GamePlan
- `/coach/scout/:id/review` → ReportViewV4
- `/coach/scout/:id/preview` → ReportSlidesV1
- `/coach/club` → ClubManagement
- `/settings` → Settings
- `/stats` → Stats (U Stats)

**Rutas eliminadas:** `/coach/editor`, `/coach/reports`, `/coach/team/:id`, `/coach/test`

## Flow U Scout (workflow correcto)
```
head_coach/badge → Personnel → crear ficha CANÓNICA
cualquier coach  → MyScout  → edita su versión → View report → overrides → "→ Film Room"
Film Room        → compara versiones → detecta discrepancias → X/Y enviados
cualquier coach  → Game Plan → publica a jugadoras
head_coach/badge → Game Plan → puede RETIRAR ficha (vuelve a Film Room)
jugadoras        → /player/team/:teamId → tap card → /player/report/:id → ReportSlidesV1
```

## Schema Supabase (fuera de schema.ts)
- `players.is_canonical` boolean DEFAULT false
- `player_scout_versions` (player_id, coach_id, inputs JSONB, status, submitted_at)
- `league_matches` (club_id, rival_name, match_date, location, match_type)
- `player_stats` (club_id, player_name, team_name, season, game_date, rival_name, minutes, points, rebounds_*, assists, steals, blocks, turnovers, fouls_personal, fg_made/attempted, fg3_made/attempted, ft_made/attempted, plus_minus, source) — índices en club_id + season
- `schedule_events`, `schedule_participants`, `wellness_entries` — RLS con `allow_all` aplicado
- `user_roles` (user_id UUID PK, role TEXT, granted_by UUID, granted_at TIMESTAMPTZ) — server-controlled, RLS deny_all para clientes
- CASCADE: players→teams, report_*→players, player_scout_versions→players

## Nombres EN/ES/ZH
| Menú | EN | ES | ZH |
|------|----|----|----|
| Infraestructura | Personnel | Plantilla | 球员档案 |
| Mi trabajo | My Scout | Mi Scout | 我的报告 |
| Trabajo grupo | Film Room | Sala de análisis | 集体分析 |
| Publicado | Game Plan | Plan de juego | 比赛方案 |
| Estadísticas | Stats | Stats | 统计 |

---

## U CORE — módulos
- **U Schedule** — `client/src/pages/core/Schedule.tsx` (god file, en pages/core/ no en src/core/)
- **U Wellness** — check-in jugadoras (embebido en Schedule)
- **U Scout** — scouting defensivo 1-on-1 (módulo más avanzado)
- **U Stats** — `client/src/pages/core/Stats.tsx` — UI completa, esperando scraper Pi
Shell: `client/src/pages/core/ModulePage.tsx` + `client/src/pages/core/ModuleNav.tsx`

### Bundle
- **229 KB gzip** — objetivo <300 KB cumplido

### Motor
- Calibración: 100% (551/551, 66 perfiles)
- Quality eval: 100% (46/46, 10 perfiles)

### Club INNER MONGOLIA
- Club ID: `4bca3aa8-9062-4709-9d29-9e2313308f1a`
- Pablo (b334e51a) = owner + head_coach
- Javier (6c5b76ab) = coach
- Samuel/Luffy (3db8ec31) = coach + operationsAccess
- Yuming (0d27576d) = coach
- rodman91jym (1d72e00d) = coach
- keitotm (3039a355) = coach
- Mario (ccf99303) = coach

### Raspberry Pi
- Comprada (Pi 5 8GB) — en tránsito
- Uso: WCBA scraper + Telegram bot + Tailscale SSH
- Destino datos: tabla `player_stats` vía API key interna (endpoint pendiente)

---

## Principios de producto U CORE
- Máximo 3 outputs accionables por pantalla
- Mobile-first: 375px portrait primero
- Coherencia visual entre módulos
- Iconos: Figma obligatorio, nunca SVG desde código
- Scope Scout: solo matchup 1-on-1, sin defensa colectiva

## Reglas entrega código
- NUNCA "añade estas líneas aquí"
- Siempre: archivo completo, O comando terminal, O prompt Cursor completo
- `npm run check` después de cada cambio
- Migrations destructivas: raw SQL Supabase, nunca `drizzle-kit push`
- **Verificar siempre** que Cursor no duplica handlers en routes.ts al añadir endpoints nuevos
- **Capabilities requieren membership**: pasar siempre `myMembership` de `useClub().data.members`

## Scripts
```bash
cd "/Users/palant/Downloads/U scout" && npx tsx scripts/calibrate-motor.ts
cd "/Users/palant/Downloads/U scout" && npx tsx scripts/eval-motor-quality.ts
cd "/Users/palant/Downloads/U scout" && npx tsx scripts/eval-report-llm.ts --judge deepseek --fast
```

## Terminología
- DENY/FORCE/ALLOW: instrucciones defensivas slide 3
- AWARE: alertas situacionales (max 2)
- Runners-up: alternativas rankeadas por el motor
- Override: decisión entrenador sobre output del motor
- Discrepancia: dos entrenadores con opciones distintas
- Hot/Cold/Stable: tendencia reciente — campo `recentForm` en PlayerInput
- trapResponse: reacción a blitz/hedge en PnR
- pressureResponse: reacción a presión individual

## Notas de sesión (trampas conocidas)
- `Schedule.tsx` está en `client/src/pages/core/`, NO en `client/src/core/`
- bash_tool corre en Linux — NO puede acceder al filesystem del Mac. Usar siempre Filesystem MCP
- Filesystem MCP: write disponible vía `Filesystem:write_file`
- Figma MCP: `get_metadata` funciona en plan Starter; `get_design_context` falla por límite
- **Cursor duplica handlers**: verificar siempre el final de routes.ts post-edición
- **Capabilities requieren membership**: `useCapabilities()` sin `membership` ignora `operationsAccess`
- **getPlayers firma**: `getPlayers(teamId?, clubId?, viewerUserId?)` — siempre pasar viewerUserId en rutas de usuario

---

## TestFlight prep — checklist y prompt Cursor

### Estado actual Capacitor
- `capacitor.config.ts` — appId: `com.ucore.app`, webDir: `dist/public`
- iOS platform añadido: `ios/` en repo
- Xcode: NO instalado · Apple Developer Account: NO ($99/año — pendiente)
- Comando de retomar: `npx cap sync && npx cap open ios`
- Bundle actual: ~229KB gzip — dentro del objetivo <300KB

### Checklist TestFlight

**Infra ($) — hacer antes de tocar código:**
- [ ] Contratar Apple Developer Program ($99/año)
- [ ] Instalar Xcode en el Mac
- [ ] Crear App ID `com.ucore.app` en Apple Developer portal
- [ ] Crear certificado de distribución y provisioning profile

**Código — Cursor puede hacer esto:**
- [ ] Touch targets ≥44px (ReportSlidesV1 flechas: `p-2` → `p-3`)
- [ ] `npx cap sync` — sincronizar web build con iOS
- [ ] Iconos de app: 1024x1024 PNG sin transparencia
- [ ] Splash screen en `capacitor.config.ts`
- [ ] `Info.plist`: NSCameraUsageDescription, NSPhotoLibraryUsageDescription
- [ ] Bundle version: `CFBundleVersion` y `CFBundleShortVersionString`
- [ ] Orientación bloqueada: portrait only en `AppDelegate.swift`
- [ ] WKWebView cookies: Supabase auth persiste entre sesiones en iOS
- [ ] Code signing en Xcode, Archive + Upload, TestFlight testers

### Prompt Cursor — TestFlight prep

```
TestFlight preparation audit and fixes for U Core iOS app.
Stack: React + Vite + Capacitor. App ID: com.ucore.app.
Do NOT touch schema.ts, storage.ts, Profile.tsx.

READ FIRST:
- capacitor.config.ts
- ios/App/App/Info.plist (if exists)
- package.json (check @capacitor/* versions)

STEP 1 — Audit capacitor.config.ts
Verify: appId, appName, webDir, server.androidScheme.
Add if missing: plugins SplashScreen, StatusBar, Keyboard.

STEP 2 — package.json: verify Capacitor packages
@capacitor/core, /ios, /cli, /splash-screen, /status-bar, /keyboard, /haptics

STEP 3 — Touch targets audit
Search .tsx for h-7/h-8 primary buttons and p-1/p-2 icon-only buttons.
Report file, line, current class, suggested fix. Do NOT auto-fix.

STEP 4 — Safe area audit
Report files using fixed pb-16/pb-20 without env(safe-area-inset-bottom).

STEP 5 — iOS keyboard handling in main.tsx

STEP 6 — Info.plist: NSCameraUsageDescription, NSPhotoLibraryUsageDescription

STEP 7 — Orientation lock in AppDelegate.swift

STEP 8 — npm run build test
```
