# U Core — Contexto para Claude

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
- `client/src/pages/scout/ReportSlidesV1.tsx` — 3 slides
- `client/src/pages/scout/ReportViewV4.tsx` — shell coach_review con OverridePanel
- `client/src/pages/scout/PlayerEditor.tsx` — editor inputs jugador
- `client/src/pages/scout/QuickScout.tsx` — wizard 3-5 pasos por situación
- `client/src/pages/core/Schedule.tsx` — god file ~228KB (U Schedule)
- `client/src/pages/core/Stats.tsx` — U Stats (tabs Season/Games, esperando Pi)
- `client/src/lib/stats-api.ts` — hooks usePlayerSeasonStats + useGameLog
- `client/src/lib/motor-icons.ts` — mapa situationId/defenseKey/awareKey → LucideIcon
- `client/src/pages/player/WellnessStandalone.tsx` — wellness jugadora /player/wellness
- `server/routes.ts` — rutas API Express
- `server/storage.ts` — acceso Supabase
- `scripts/calibrate-motor.ts` — 66 perfiles (100% / 551 checks)
- `scripts/eval-motor-quality.ts` — 10 perfiles calidad
- `scripts/eval-report-llm.ts` — evaluador multi-juez (pendiente API keys, falta 6ª dimensión)

## i18n — arquitectura lazy
- `client/src/lib/i18n-core.ts` — runtime lazy: EN estático, ES/ZH async — VERIFICADO lazy correcto
- `client/src/lib/i18n.ts` — re-export shim
- `client/src/lib/locales/en|es|zh.ts` — chunks lazy
- Todas las claves wellness_* existen en los 3 locales

## Capacitor
- `capacitor.config.ts` — appId: com.ucore.app, webDir: dist/public
- iOS platform añadido: `ios/` en repo
- Info.plist: NSCamera + NSPhotoLibrary añadidos. Portrait lock aplicado.
- Xcode: NO instalado · Apple Developer Account: NO ($99/año — compra inminente)
- Retomar: `npx cap sync && npx cap open ios`

## NUNCA tocar
- `Profile.tsx` · `schema.ts` · `migrations/`
- SQL destructivo: solo Supabase SQL Editor, nunca `drizzle-kit push`

---

## Arquitectura 4 capas U Scout
1. `motor-v4.ts` → scores + candidatos
2. `reportTextRenderer.ts` → texto EN/ES/ZH (RenderedAlert tiene key+triggerKey)
3. `overrideEngine.ts` → overrides + discrepancias
4. `ReportSlidesV1.tsx` + `ReportViewV4.tsx` → UI con iconos Lucide via motor-icons.ts

## Flujo de navegación (staff)
```
head_coach/badge → Personnel → crear ficha CANÓNICA
cualquier coach  → MyScout  → edita → View report → overrides → "→ Film Room"
Film Room        → compara versiones → detecta discrepancias → X/Y enviados
cualquier coach  → Game Plan → publica a jugadoras
head_coach       → Game Plan → puede RETIRAR → vuelve a MyScout
```

## Flujo jugadora
```
/player (PlayerTeamList) → 1 tap → /player/team/:teamId (Dashboard grid)
→ tap card → /player/report/:id (ReportSlidesV1, coachMode=false)
→ POST /api/player/views en cada slide (viewStatus partial/complete)
→ onBack → /player/team/:teamId (fromTeamId via history.state)
```

---

## Estado app — 1 mayo 2026 (sesión p9+p10 — ACTUAL)

### Fixes aplicados y deployados ✅
1. P0 — viewStatus tracking: POST fire-and-forget en ReportSlidesV1 (solo player mode)
2. P1 — onBack jugadora: vuelve a /player/team/:teamId via window.history.state.fromTeamId
3. P1 — ownership PATCH /api/players/:id: coach solo edita sus sandboxes
4. P1 — PlayerEditor back: respeta window.history.state.from
5. P1 — hasReportInputs: amplía a indirectsFrequency + perimeterThreats
6. P1 — Touch targets: p-1→p-3 backs, h-7/h-8→h-10/h-11 botones, chevrons p-2→p-3
7. P2 — Personnel conteo: doble fallback isCanonical ?? is_canonical
8. P2 — GamePlan retire: navega a /coach/my-scout
9. P2 — QuickScout back: respeta window.history.state.from
10. P1 — cache logout: clearAllLocalCache() en handleSignOut
11. P1 — overrides en jugadora: PlayerReportV4Route carga y pasa overrides
12. P1 — Wellness standalone: /player/wellness → WellnessStandalone.tsx
13. P1 — PlayerTeamList 1 tap: navegación directa
14. P2 — Personnel guard URL directa: redirect a /coach
15. P1 — Stats ingest endpoint: POST /api/stats/ingest con Bearer STATS_INGEST_KEY
16. i18n wellness keys: todas en en/es/zh
17. motor-icons.ts: mapa situationId/defenseKey/awareKey → LucideIcon
18. ReportSlidesV1: iconos Lucide en situaciones (slide 2) y DENY/FORCE/ALLOW/AWARE (slide 3)
19. BasketballPlaceholderAvatar: -28KB gzip (JPEG base64 → SVG puro)
20. queryKey + userId: usePlayers/useTeams/useClub scoped por usuario
21. RenderedAlert: tipo completo con key+triggerKey (elimina as any en ReportSlidesV1)

### Bundle — estado real y objetivo correcto
```
TOTAL BUNDLE: ~532KB gzip (suma de todos los chunks)
INITIAL CHUNK (lo que bloquea el primer render): ~150-160KB gzip
  - vendor-react no está separado: entra en index junto con supabase etc.

OBJETIVO CORRECTO para apps React profesionales:
  - Initial chunk (bloquea primer render): < 100KB gzip  ← esto importa para TTI
  - Total bundle: 400-600KB gzip es normal para este stack
  - Apple NO rechaza por bundle size — rechaza por crashes/APIs/privacidad

INTERVENCIONES AUDITADAS (1 mayo 2026):
  - manualChunks (B): EMPEORÓ (+21KB) porque modulepreload suma todos los vendors → REVERTIDO
  - i18n lazy (D): ya estaba correcto, sin cambios
  - Profile preload (C): no había preload, sin cambios
  - Motor server-side (A): mayor ganancia posible (~45-65KB total) — requiere decisión Pablo

PRÓXIMA ACCIÓN DE BUNDLE:
  Separar el initial chunk real: mover Supabase init + providers fuera del entry,
  cargarlos solo después del primer render (bootstrap pattern).
  Ganancia estimada en initial chunk: -40-60KB (Supabase 50KB gzip sale del initial).
  TOTAL no baja mucho, pero TTI (tiempo hasta login visible) sí mejora significativamente.
```

### 🔴 RIESGOS ACTIVOS
- P1 queryKey fix aplicado pero no verificado en producción con multi-cuenta
- P2 Schedule scroll List→Planner: recentrar en hoy al cambiar tab (no verificado)
- P2 readCoachBadges + isPhysicalTrainer hardcodeados a false — código muerto

### 🟡 PENDIENTE PRÓXIMA SESIÓN (orden prioridad)
1. QA producción — verificar flujos clave en Railway tras deploy de hoy
2. Decisión: mover motor a server-side (sesión completa, mayor ganancia bundle)
3. Bootstrap pattern: separar Supabase init del initial chunk (mejora TTI)
4. U Stats features — opponent report, importar plantillas a Personnel
5. TestFlight: contratar Apple Developer ($99) + Xcode → npx cap sync
6. Iconos app — diseñar en Figma (1024x1024 PNG sin transparencia) — Figma MCP resetea en junio
7. U Schedule — kebab/tap behavior fix

---

## U Scout — rutas activas
- `/coach` → CoachHome
- `/coach/personnel` → Personnel
- `/coach/my-scout` → MyScout
- `/coach/quick-scout/:id` → QuickScout (wizard por situación)
- `/coach/player/:id` → PlayerEditor
- `/coach/film-room` → FilmRoom
- `/coach/game-plan` → GamePlan
- `/coach/scout/:id/review` → ReportViewV4
- `/coach/scout/:id/preview` → ReportSlidesV1 (coach mode)
- `/coach/club` → ClubManagement
- `/settings` → Settings
- `/stats` → Stats (U Stats)
- `/player` → PlayerTeamList
- `/player/team/:teamId` → Dashboard (PlayerTeamView)
- `/player/report/:id` → ReportSlidesV1 (player mode, con overrides)
- `/player/wellness` → WellnessStandalone

**Rutas eliminadas:** `/coach/editor`, `/coach/reports`, `/coach/team/:id`, `/coach/test`

---

## Schema Supabase (fuera de schema.ts)
- `players.is_canonical` boolean DEFAULT false
- `player_scout_versions` (player_id, coach_id, inputs JSONB, status, submitted_at)
- `league_matches` (club_id, rival_name, match_date, location, match_type)
- `player_stats` (club_id, player_name, team_name, season, game_date, rival_name, minutes, points, rebounds_*, assists, steals, blocks, turnovers, fouls_personal, fg_made/attempted, fg3_made/attempted, ft_made/attempted, plus_minus, source) — índices en club_id + season
- `schedule_events`, `schedule_participants`, `wellness_entries` — RLS allow_all
- `user_roles` (user_id UUID PK, role TEXT, granted_by UUID, granted_at TIMESTAMPTZ) — server-controlled, RLS deny_all
- CASCADE: players→teams, report_*→players, player_scout_versions→players

## Arquitectura permisos getPlayers (definitiva)
```
getPlayers(teamId?, clubId?, viewerUserId?)
  Con clubId + viewerUserId:
    WHERE is_canonical = true                    → todos los coaches del club
    OR created_by_user_id = viewerUserId         → sandbox solo al creador
  Con clubId sin viewerUserId (legacy):
    WHERE is_canonical = true OR created_by_user_id IN (active club members)
  Sin clubId: sin filtro
```

## Arquitectura permisos Personnel
- head_coach / master: acceso + crear canónicos + promover sandbox
- coach con operationsAccess: ve Personnel, edita canónicos, NO crea ni promueve
- coach sin badge: redirect a /coach si accede por URL directa

---

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
- U Schedule — client/src/pages/core/Schedule.tsx (god file ~228KB, en pages/core/)
- U Wellness — embebido en Schedule (staff) + standalone /player/wellness (jugadora)
- U Scout — scouting defensivo 1-on-1 (módulo más avanzado)
- U Stats — client/src/pages/core/Stats.tsx — UI completa (Season/Games), esperando Pi + SSD
Shell: client/src/pages/core/ModulePage.tsx + client/src/pages/core/ModuleNav.tsx

### Motor
- Calibración: 100% (551/551, 66 perfiles)
- Quality eval: 100% (46/46, 10 perfiles)
- motor-icons.ts: iconos Lucide por situationId, defenseKey, awareKey — reemplazables con SVG custom cuando Figma MCP esté disponible (junio)

### Club INNER MONGOLIA
- Club ID: 4bca3aa8-9062-4709-9d29-9e2313308f1a
- Pablo (b334e51a) = owner + head_coach
- Javier (6c5b76ab) = coach
- Samuel/Luffy (3db8ec31) = coach + operationsAccess
- Yuming (0d27576d) = coach
- rodman91jym (1d72e00d) = coach
- keitotm (3039a355) = coach
- Mario (ccf99303) = coach

### Raspberry Pi 5 (8GB)
- Comprada, SSD en camino
- Uso: WCBA scraper + Telegram bot + Tailscale SSH
- Destino: tabla player_stats via POST /api/stats/ingest + Bearer STATS_INGEST_KEY
- STATS_INGEST_KEY pendiente añadir en Railway env vars
- Pi envía: { clubId, rows: [{ playerName, teamName, season, ... }] }

---

## U Stats — estado y roadmap
- Implementado: UI Season/Games, tipos, endpoints GET stats/players + stats/games, POST stats/ingest
- Schema actual: player_stats simple — suficiente para MVP con Pi
- Pendiente Pi: añadir STATS_INGEST_KEY en Railway
- Pendiente features: opponent report, standings WCBA, importar plantillas a Personnel
- No implementar schema normalizado hasta tener datos reales

## QuickScout — estado y decisión de producto
- Existe y funciona: wizard 3-5 pasos por situación
- Problema: entrenadores revisan todos los campos en PlayerEditor igualmente — wizard no ahorra tiempo real
- Decisión pendiente: evaluar si tiene sentido como "primer contacto" o refactorizar
- No eliminar sin decisión consciente

---

## Principios de producto U CORE
- Máximo 3 outputs accionables por pantalla
- Mobile-first: 375px portrait primero
- Coherencia visual entre módulos
- Iconos: Figma obligatorio para iconos custom; Lucide como placeholder aceptable
- Scope Scout: solo matchup 1-on-1, sin defensa colectiva

## Reglas entrega código
- NUNCA "añade estas líneas aquí"
- Siempre: archivo completo, O comando terminal, O prompt Cursor completo
- npm run check después de cada cambio
- Migrations destructivas: raw SQL Supabase, nunca drizzle-kit push
- Verificar siempre que Cursor no duplica handlers en routes.ts
- Capabilities requieren membership: pasar siempre myMembership de useClub().data.members

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
- trapResponse: reacción a blitz/hedge en PnR
- pressureResponse: reacción a presión individual

## Notas de sesión (trampas conocidas)
- Schedule.tsx está en client/src/pages/core/, NO en client/src/core/
- bash_tool corre en Linux — NO puede acceder al filesystem del Mac. Usar Filesystem MCP
- Filesystem MCP write: usar filesystem:write_file (lowercase)
- Figma MCP: límite mensual Starter agotado — resetea junio 2026
- Cursor duplica handlers en routes.ts — verificar siempre post-edición
- useCapabilities() sin membership ignora operationsAccess
- getPlayers firma: (teamId?, clubId?, viewerUserId?) — siempre pasar viewerUserId
- manualChunks en Vite EMPEORA el bundle porque modulepreload suma todos los vendors — NO usar
- zsh heredoc + JSX curly braces: usar Python scripts o ficheros temporales

---

## TestFlight — checklist

### Bloqueantes externos:
- [ ] Contratar Apple Developer Program ($99/año) — compra inminente
- [ ] Instalar Xcode en el Mac
- [ ] Crear App ID + cert + provisioning profile

### Código (listo cuando se compre Developer):
- [x] Info.plist: NSCameraUsageDescription + NSPhotoLibraryUsageDescription
- [x] Orientación portrait-only en Info.plist
- [x] Touch targets ≥44px en todas las pantallas auditadas
- [ ] npx cap sync tras build
- [ ] Iconos app: 1024x1024 PNG sin transparencia (Figma, junio)
- [ ] Bundle version CFBundleVersion + CFBundleShortVersionString
- [ ] WKWebView: Supabase auth persiste entre sesiones iOS
- [ ] Safe area: pb-16/pb-20 → env(safe-area-inset-bottom) donde aplica
- [ ] Code signing + Archive + Upload + TestFlight testers
