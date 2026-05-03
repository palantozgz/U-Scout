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
- `server/stats-ingest.ts` — ingest endpoint Pi → Railway → Supabase
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

## Estado app — 3 mayo 2026 (sesión p11 — ACTUAL)

### Fixes aplicados y deployados ✅ (sesiones anteriores)
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
15. i18n wellness keys: todas en en/es/zh
16. motor-icons.ts: mapa situationId/defenseKey/awareKey → LucideIcon
17. ReportSlidesV1: iconos Lucide en situaciones (slide 2) y DENY/FORCE/ALLOW/AWARE (slide 3)
18. BasketballPlaceholderAvatar: -28KB gzip (JPEG base64 → SVG puro)
19. queryKey + userId: usePlayers/useTeams/useClub scoped por usuario
20. RenderedAlert: tipo completo con key+triggerKey (elimina as any en ReportSlidesV1)

### Fixes sesión 3 mayo 2026 ✅
21. Schema stats_* creado en Supabase: 10 tablas (stats_teams, stats_players, stats_games,
    stats_boxscores, stats_season, stats_pbp, stats_standings, stats_roster_snapshots,
    stats_insights_cache, stats_sync_log)
22. collector/src/sync/roster.ts — nuevo sync plantillas via teamplayers endpoint
23. collector/src/ingest.ts — tipo 'roster' añadido
24. collector/src/index.ts — syncRosters() en nightly sync
25. server/stats-ingest.ts — handleRoster() + case 'roster' en switch
26. collector/src/sync/schedule.ts — ingestChunked() chunks de 50 (resuelve 413)
27. server/index.ts — limit 10mb + PORT env var + sin reusePort (resuelve healthcheck Railway)
28. server/routes.ts — eliminado handler viejo /api/stats/ingest que causaba 400

### Bundle — estado sesión 2 mayo 2026
```
MEDIDO POST-BUILD:
  - Initial chunk (index): 100KB gzip  ← OBJETIVO CUMPLIDO (era 230KB)
  - vendor-react:     63KB gzip (carga paralela, no bloquea)
  - vendor-supabase:  51KB gzip (carga paralela)
  - vendor-query:     12KB gzip (carga paralela)
  - Total bundle:    ~532KB gzip (sin cambio — correcto para este stack)

PRÓXIMA ACCIÓN BUNDLE (post-TestFlight):
  Motor server-side: ganancia estimada -50KB gzip. BLOQUEANTE: rompe offline coaches.
  DECISIÓN PENDIENTE — no antes de TestFlight.
```

### 🔴 RIESGOS ACTIVOS
- P1 queryKey fix aplicado pero no verificado en producción con multi-cuenta
- P2 Schedule scroll List→Planner: recentrar en hoy al cambiar tab (no verificado)
- P2 readCoachBadges + isPhysicalTrainer hardcodeados a false — código muerto

### 🔴 PENDIENTE INMEDIATO
1. Verificar primer sync completo (standings + schedule + roster → Supabase) — EN PROGRESO
2. collector/src/sync/boxscores.ts: añadir playerdata?gameId=X para stats individuales por partido
3. POST /api/stats/import-team → importar equipo WCBA a Personnel con un clic
4. Telegram Pi: bloqueado por GFW — pendiente VPN (Clash/sing-box)
5. Scraping histórico: loop temporadas en index.ts
   [2092, 1767, 1470, 1108, 873, 428, 253, 236, 228, 245, 189, 175]

### 🔴 PENDIENTE PRÓXIMAS SESIONES
- GET /api/stats/* endpoints para UI
- UI de U Stats: Stats.tsx redesign con blueprint aprobado
- Wellness offline P3
- ReportViewV4 → 3 slides
- hasReport fix en MyScout
- Schedule kebab/tap behavior

### Offline — estado 2 mayo 2026
```
IMPLEMENTADO:
  - networkMode offlineFirst + staleTime 10min + gcTime 7d en usePlayers/usePlayer
  - Cola offline players: enqueueOfflinePlayerMutation en useUpdatePlayer/useCreatePlayer
  - Flush automático en window.online event
  - clearAllLocalCache() en logout
  - Motor client-side → coach puede generar report sin conexión ✅
GAP P3: wellness.ts usa Supabase directo → sin cola offline
```

---

## Raspberry Pi 5
- OS: Raspberry Pi OS Lite 64-bit en SSD externo
- IP local: 192.168.1.59 · SSH: pablo@192.168.1.59
- Node 20 + PM2 · Collector en ~/ucore/collector
- pm2 status: ucore-collector online
- Telegram: BLOQUEADO por GFW — pendiente VPN
- STATS_INGEST_KEY: configurada en .env Pi y en Railway ✅
- GitHub: bloqueado por GFW a veces según red — usar SCP para actualizar archivos individuales
  Comando SCP desde Mac: scp "ruta/archivo" pablo@192.168.1.59:~/ucore/collector/src/...
- Comando deploy Pi: cd ~/ucore/collector && npm run build && pm2 restart ucore-collector

## API WCBA — endpoints completos confirmados
```
matchoutrank?competitionId=56&seasonId=X          → standings ✅ scrapeado
matchschedules?competitionId=56&seasonId=X&phaseId=Y&roundId=Z&teamId=
  CLAVE: teamId='' REQUERIDO — sin él devuelve 500
  Respuesta: array de fechas con array de partidos (date-grouped) ✅ scrapeado
teamplayers?seasonId=X&teamId=Y                   → roster completo ✅ scrapeado
teamheader?competitionId=56&seasonId=X&teamId=Y   → cabecera equipo
playerbasicpage?...                               → promedios temporada ✅ scrapeado
hotspotdata?gameId=Y&periods=1&periods=2...       → shot chart ✅ (dentro de pbp.ts)
/api/v2/game/:id/actions                          → PBP completo ✅ scrapeado
playerdata?gameId=X                               → boxscore individual jugadora ❌ FALTA
  Campos: offensiveRebound/defensiveRebound separados, isStartLineUp,
  positiveNegativeValue, twoPoints/threePoints/foulShot "made-att (pct%)", minutes "MM:SS"
matchinfoscores?matchId=X&gameId=Y                → score final + cuartos ✅ scrapeado
lastlymatchschedule?competitionId=56&seasonId=X   → último partido activo
phasemenus?seasonId=X                             → phaseIds
matchmenusschedule?competitionId=56&seasonId=X&phaseId=Y → roundIds
```

## Temporadas WCBA disponibles
```
2092 (2025-2026 activa), 1767, 1470, 1108, 873, 428, 253, 236, 228, 245, 189, 175
```

## Schema Supabase stats_* (creado 3 mayo 2026)
```
stats_teams, stats_players (external_id TEXT), stats_games, stats_boxscores,
stats_season, stats_pbp, stats_standings, stats_roster_snapshots,
stats_insights_cache, stats_sync_log
```
NOTA: stats_players.external_id es TEXT (playerId WCBA viene como string)

## Schema Supabase app (fuera de schema.ts)
- `players.is_canonical` boolean DEFAULT false
- `player_scout_versions` (player_id, coach_id, inputs JSONB, status, submitted_at)
- `league_matches` (club_id, rival_name, match_date, location, match_type)
- `player_stats` (legacy — schema simple para MVP antes de Pi)
- `schedule_events`, `schedule_participants`, `wellness_entries` — RLS allow_all
- `user_roles` (user_id UUID PK, role TEXT) — server-controlled, RLS deny_all

---

## U Stats — diseño aprobado (sesión 3 mayo 2026)

### Arquitectura Pi-heavy
Pi calcula stats avanzadas nightly → stats_insights_cache → Railway sirve JSON pre-calculado
Cliente solo renderiza, cero cálculo, cero joins complejos.

### Métricas jugadora (Pi pre-calcula)
TS%, eFG%, TOV%, USG% estimado, percentiles vs liga por métrica,
shot zones 14 zonas (FG%/frecuencia), clutch stats (Q4 diff≤5),
últimos 5 partidos sparkline, hot zones, top connections (asistencias entre pares)

### Métricas equipo (Pi pre-calcula)
PACE, PPP, ORTG, DRTG, Net Rating, OReb%, DReb%, AST/TOV ratio,
eFG% equipo, TS% equipo, FT Rate, puntos por zona (paint/mid/3P/FT%)

### Navegación U Stats aprobada
```
Liga      → Clasificación | Líderes
Equipos   → Ficha (radar+stats) | Plantilla | Partidos
Jugadoras → Ficha (radar+shot chart+tendencia) | Game log | Tendencia
Comparador → Jugadora vs Jugadora | Equipo vs Equipo
```

### Gráficas aprobadas
Radar perfil, shot chart hexagonal por zonas, tendencia sparkline últimos N partidos,
distribución puntos por zona (donut), comparador lado a lado vs liga,
grafo conexiones asistencias, score flow del partido (del PBP),
radar rebotes (前板/后板/篮板率)

### Import a U Scout
Un clic por equipo → POST /api/stats/import-team → crea team canónico + jugadoras en players
Nombre chino en DB, pinyin visible cuando locale=EN/ES (librería pinyin Node, pendiente)

### Insights para U Scout (alimentan el report)
1. Hot zone: "Dispara 42% desde lado derecho, FG% 58% (liga: 44%)" → FORCE direction
2. Clutch scorer: stats Q4 con diff≤5 → isoDanger
3. Tendencia reciente: últimos 3 partidos → threat level

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
- `/coach/scout/:id/preview` → ReportSlidesV1 (coach mode)
- `/coach/club` → ClubManagement
- `/settings` → Settings
- `/stats` → Stats (U Stats)
- `/player` → PlayerTeamList
- `/player/team/:teamId` → Dashboard
- `/player/report/:id` → ReportSlidesV1 (player mode)
- `/player/wellness` → WellnessStandalone

---

## Arquitectura permisos getPlayers (definitiva)
```
getPlayers(teamId?, clubId?, viewerUserId?)
  Con clubId + viewerUserId:
    WHERE is_canonical = true  OR  created_by_user_id = viewerUserId
```

## Arquitectura permisos Personnel
- head_coach / master: acceso + crear canónicos + promover sandbox
- coach con operationsAccess: ve Personnel, edita canónicos, NO crea ni promueve
- coach sin badge: redirect a /coach si accede por URL directa

---

## Club INNER MONGOLIA
- Club ID: 4bca3aa8-9062-4709-9d29-9e2313308f1a
- Pablo (b334e51a) = owner + head_coach
- Javier (6c5b76ab) = coach
- Samuel/Luffy (3db8ec31) = coach + operationsAccess
- Yuming (0d27576d) = coach
- rodman91jym (1d72e00d) = coach
- keitotm (3039a355) = coach
- Mario (ccf99303) = coach

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
- U Schedule — client/src/pages/core/Schedule.tsx (god file ~228KB)
- U Wellness — embebido en Schedule (staff) + standalone /player/wellness
- U Scout — scouting defensivo 1-on-1 (módulo más avanzado)
- U Stats — client/src/pages/core/Stats.tsx
Shell: client/src/pages/core/ModulePage.tsx + ModuleNav.tsx

### Motor
- Calibración: 100% (551/551, 66 perfiles)
- Quality eval: 100% (46/46, 10 perfiles)
- motor-icons.ts: iconos Lucide — reemplazables con SVG custom (Figma, junio 2026)

---

## Principios de producto U CORE
- Máximo 3 outputs accionables por pantalla
- Mobile-first: 375px portrait primero
- Coherencia visual entre módulos
- Iconos: Figma obligatorio para iconos custom; Lucide como placeholder
- Scope Scout: solo matchup 1-on-1, sin defensa colectiva

## Reglas entrega código
- NUNCA "añade estas líneas aquí"
- Siempre: archivo completo, O comando terminal, O prompt Cursor completo
- npm run check después de cada cambio
- Migrations destructivas: raw SQL Supabase, nunca drizzle-kit push
- Verificar siempre que Cursor no duplica handlers en routes.ts
- Capabilities requieren membership: pasar siempre myMembership de useClub().data.members

## Notas de sesión (trampas conocidas)
- Schedule.tsx está en client/src/pages/core/, NO en client/src/core/
- bash_tool corre en Linux — NO puede acceder al filesystem del Mac. Usar Filesystem MCP
- Filesystem MCP write: usar filesystem:write_file (lowercase)
- str_replace NO funciona con server/routes.ts — usar python3 script para ediciones
- Figma MCP: límite mensual Starter agotado — resetea junio 2026
- Cursor duplica handlers en routes.ts — verificar siempre post-edición
- useCapabilities() sin membership ignora operationsAccess
- getPlayers firma: (teamId?, clubId?, viewerUserId?) — siempre pasar viewerUserId
- manualChunks en Vite EMPEORA el bundle — NO usar muchos chunks pequeños
- zsh heredoc + JSX curly braces: usar Python scripts o ficheros temporales
- Railway healthcheck: usar PORT env var + sin reusePort en server.listen()
- Pi GFW bloquea GitHub y Telegram — usar SCP para subir archivos individuales

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
