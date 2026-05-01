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

## Estado sesión 1 mayo 2026 (p6 — FINAL)

### Último commit
`feat: U Stats module + P0 fixes (Dashboard nav, viewStatus threshold, mergeAndClear transaction, ClipboardList import)`

### Completado esta sesión ✅
- **Audit completo**: UX, DB, TestFlight — 3 P0 / 7 P1 / 4 P2 identificados y documentados
- **P0 fix**: Dashboard.tsx tap jugadora → `/player/report/:id` → ReportSlidesV1 (antes iba a Profile.tsx)
- **P0 fix**: viewStatus threshold — `complete` ahora = slide 2 vista (antes requería las 5 slides 0-4)
- **P0 fix**: ClipboardList importado en Home.tsx (error de runtime en player mode)
- **P1 fix**: mergeAndClearScoutVersions envuelto en `db.transaction` — eliminado el UPDATE no-op de report_approvals
- **Bug crítico eliminado**: Cursor duplicó `/api/player/teams` y `/api/player/team/:teamId` al final de routes.ts con implementaciones simplificadas (viewStatus hardcodeado "none", ignorando scouting_report_assignments). Duplicados eliminados — las implementaciones correctas con storage.listPlayerTeamsReportSummary y storage.listAssignedPlayersInTeamForUser quedan activas.
- **U Stats módulo completo**:
  - `Stats.tsx` — tabs Season (tabla ordenable + filas expandibles) / Games (dropdown jugadora + game log)
  - Empty state "Esperando datos del scraper" (es/en/zh)
  - Loading + error + retry states
  - `stats-api.ts` — tipos + hooks usePlayerSeasonStats + useGameLog
  - `GET /api/stats/players` — season averages club-scoped, numerics normalizados
  - `GET /api/stats/games` — game log por playerName + season opcional
  - Tabla `player_stats` creada en Supabase (raw SQL, no en schema.ts)

### 🔴 RIESGOS ACTIVOS
- **P1** Touch targets flechas ReportSlidesV1: `p-2` (~36px) — Apple exige 44px mínimo
- **P1** hasReportInputs en MyScout: heurística frágil (solo chequea 4 frecuencias, falla con off-ball/catch&shoot)

### 🟡 PENDIENTE PRÓXIMA SESIÓN (orden prioridad)
1. **Verificar flow en producción** con cuenta coach + jugadora (tap ficha → ReportSlidesV1, badges viewStatus)
2. **Touch targets**: flechas ReportSlidesV1 `p-2` → `p-3` (1 línea por flecha)
3. **TestFlight prep**: contratar Apple Developer ($99) + instalar Xcode → ejecutar prompt Cursor de sección TestFlight
4. **U Stats — entrada manual**: UI para insertar estadísticas mientras Pi/scraper no esté activo
5. **Raspberry Pi scraper**: cuando llegue Pi 5, conectar scraper WCBA → player_stats vía API key interna
6. **hasReportInputs**: ampliar check a catchAndShoot + offBall
7. **Wellness standalone jugadora**: acceso directo sin pasar por /schedule

---

## U Scout — rutas activas
- `/coach` → CoachHome (4 contenedores + alertas smart)
- `/coach/personnel` → Personnel (fichas canónicas + sandbox + equipos)
- `/coach/my-scout` → MyScout (solo fichas sandbox propias del coach)
- `/coach/quick-scout/:id` → QuickScout (wizard adaptativo 7 ramas)
- `/coach/player/:id` → PlayerEditor (editor completo)
- `/coach/film-room` → FilmRoom (revisión colectiva anti-bias)
- `/coach/game-plan` → GamePlan (publicados al roster)
- `/coach/scout/:id/review` → ReportViewV4
- `/coach/scout/:id/preview` → ReportSlidesV1
- `/coach/club` → ClubManagement (4 tabs: Club/Liga/Equipo/Stats)
- `/settings` → Settings (3 temas: Gamenight/Office/Oldschool)
- `/stats` → Stats (U Stats — tabs Season/Games)

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
- **U Schedule** — `client/src/pages/core/Schedule.tsx` (god file, Schedule.tsx en pages/core/ no en src/core/)
- **U Wellness** — check-in jugadoras (embebido en Schedule)
- **U Scout** — scouting defensivo 1-on-1 (módulo más avanzado)
- **U Stats** — `client/src/pages/core/Stats.tsx` — UI completa, esperando scraper Pi para datos reales
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
- Samuel/Luffy (3db8ec31) = coach
- Yuming (0d27576d) = coach
- rodman91jym (1d72e00d) = coach
- keitotm (3039a355) = coach
- Mario (ccf99303) = coach

### Raspberry Pi
- Comprada (Pi 5 8GB) — en tránsito
- Uso: WCBA scraper + Telegram bot + Tailscale SSH
- Destino datos: tabla `player_stats` vía API key interna (endpoint pendiente de crear)

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
- Hot/Cold/Stable: tendencia reciente jugador — campo `recentForm` en PlayerInput
- trapResponse: reacción a blitz/hedge en PnR
- pressureResponse: reacción a presión individual

## Notas de sesión (trampas conocidas)
- `Schedule.tsx` está en `client/src/pages/core/`, NO en `client/src/core/`
- bash_tool corre en Linux y NO puede acceder al filesystem del Mac — usar siempre Filesystem MCP para leer/escribir archivos del repo
- Filesystem MCP es de solo lectura para Claude en esta configuración (write disponible vía Filesystem:write_file)
- Figma MCP: `get_metadata` funciona en plan Starter; `get_design_context` falla por límite de llamadas — no usar salvo petición explícita
- **Cursor duplica handlers**: al pedir añadir endpoints a routes.ts, Cursor tiende a duplicar los handlers existentes de /api/player/* con versiones simplificadas. Verificar siempre el final del archivo post-edición.

---

## TestFlight prep — checklist y prompt Cursor

### Estado actual Capacitor
- `capacitor.config.ts` — appId: `com.ucore.app`, webDir: `dist/public`
- iOS platform añadido: `ios/` en repo
- Xcode: NO instalado · Apple Developer Account: NO ($99/año — pendiente)
- Comando de retomar: `npx cap sync && npx cap open ios`
- Bundle actual: ~229KB gzip — dentro del objetivo <300KB

### Checklist TestFlight (a completar en próxima sesión)

**Infra ($) — hacer antes de tocar código:**
- [ ] Contratar Apple Developer Program ($99/año)
- [ ] Instalar Xcode en el Mac
- [ ] Crear App ID `com.ucore.app` en Apple Developer portal
- [ ] Crear certificado de distribución y provisioning profile

**Código — Cursor puede hacer esto:**
- [ ] `npx cap sync` — sincronizar web build con iOS
- [ ] Iconos de app: 1024x1024 PNG sin transparencia (todas las tallas via Capacitor Assets)
- [ ] Splash screen: configurar en `capacitor.config.ts`
- [ ] `Info.plist`: NSCameraUsageDescription, NSPhotoLibraryUsageDescription si se usa cámara
- [ ] Deep links / Universal Links: configurar si se usan (actualmente no)
- [ ] Bundle version: `CFBundleVersion` y `CFBundleShortVersionString` en Info.plist
- [ ] Safe area insets: verificar `env(safe-area-inset-*)` en todas las pantallas
- [ ] Orientación bloqueada: portrait only en `AppDelegate.swift`
- [ ] Push notifications: configurar APNs si se quieren notificaciones nativas
- [ ] Haptic feedback: revisar que `Haptics` plugin esté instalado y funcione
- [ ] WKWebView cookies: verificar que Supabase auth persiste entre sesiones en iOS
- [ ] Network security: ATS (App Transport Security) — Railway usa HTTPS → OK
- [ ] Code signing en Xcode: Team, Bundle ID, provisioning profile
- [ ] Archive + Upload to App Store Connect
- [ ] TestFlight: añadir testers internos (hasta 100 sin review)

**UX mínima para TestFlight:**
- [ ] Touch targets ≥44px en toda la app (ReportSlidesV1 flechas: `p-2` → `p-3`)
- [ ] No hay modals/dialogs que rompan en iOS (verificar z-index y scroll)
- [ ] Teclado no oculta inputs en formularios (usar `@capacitor/keyboard`)
- [ ] Pull-to-refresh nativo o desactivado explicitamente
- [ ] Error states en todas las pantallas (no pantallas en blanco)

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
Verify:
  appId: "com.ucore.app"
  appName: "U Core"
  webDir: "dist/public"
  server.androidScheme: "https"
Add if missing:
  plugins: {
    SplashScreen: {
      launchShowDuration: 1500,
      launchAutoHide: true,
      backgroundColor: "#FAF8F5",
      androidSplashResourceName: "splash",
      showSpinner: false,
    },
    StatusBar: {
      style: "Light",
      backgroundColor: "#FAF8F5",
    },
    Keyboard: {
      resize: "body",
      resizeOnFullScreen: true,
    },
  }

STEP 2 — package.json: verify Capacitor packages
Check that these are installed, add if missing:
  @capacitor/core, @capacitor/ios, @capacitor/cli
  @capacitor/splash-screen, @capacitor/status-bar, @capacitor/keyboard
  @capacitor/haptics (optional but useful)
If missing: npm install <package> && npx cap sync

STEP 3 — Touch targets audit
Search all .tsx files in client/src for:
  - Buttons/links with h-7 or h-8 (28px or 32px) that are primary actions
  - p-1 or p-2 on icon-only buttons
For each found, report: file, line, current class, suggested fix (h-11 min = 44px).
Do NOT auto-fix — just report.

STEP 4 — Safe area audit
Search client/src for hardcoded bottom padding (pb-16, pb-20) that should use
safe area insets on iOS. Report files that use fixed bottom padding without
`env(safe-area-inset-bottom)`.

STEP 5 — iOS keyboard handling
In client/src/main.tsx or the app entry point, add:
import { Keyboard } from '@capacitor/keyboard';
// Only run on native
if ((window as any).Capacitor?.isNativePlatform?.()) {
  Keyboard.setAccessoryBarVisible({ isVisible: true });
}

STEP 6 — Info.plist additions
In ios/App/App/Info.plist add if missing:
  <key>NSCameraUsageDescription</key>
  <string>Used for uploading club and player photos</string>
  <key>NSPhotoLibraryUsageDescription</key>
  <string>Used for selecting club and player photos</string>
  <key>UIViewControllerBasedStatusBarAppearance</key>
  <false/>

STEP 7 — Orientation lock
In ios/App/App/AppDelegate.swift, add portrait-only lock:
func application(_ application: UIApplication, supportedInterfaceOrientationsFor window: UIWindow?) -> UIInterfaceOrientationMask {
    return .portrait
}

STEP 8 — Build test
Run: npm run build
Report any build errors. Do NOT run npx cap sync (user will do this).

After all steps: output a summary of:
1. Changes made
2. Issues found (touch targets, safe areas)
3. What the user must do manually (Xcode, Apple Developer, certificates)
4. Exact commands to run in order to open Xcode and archive
```
