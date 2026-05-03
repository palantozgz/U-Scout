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
- `client/src/lib/i18n-core.ts` — runtime lazy: EN estático, ES/ZH async
- `client/src/lib/i18n.ts` — re-export shim
- `client/src/lib/locales/en|es|zh.ts` — chunks lazy
- Todas las claves wellness_* existen en los 3 locales

## Capacitor / Plataformas
- `capacitor.config.ts` — appId: com.ucore.app, webDir: dist/public
- iOS platform añadido: `ios/` en repo
- Info.plist: NSCamera + NSPhotoLibrary añadidos. Portrait lock aplicado.
- Xcode: NO instalado · Apple Developer Account: NO ($99/año — compra inminente)
- Retomar iOS: `npx cap sync && npx cap open ios`

### Decisiones de plataforma (pendientes)
- **Android:** sí, post-TestFlight. Capacitor lo soporta nativamente — `npx cap add android`.
  Trabajo mínimo porque la app ya es mobile-first. Prioridad alta tras iOS.
- **iPad:** funciona técnicamente pero diseño portrait 375px queda mal en pantalla ancha.
  Requiere layout adaptativo (sidebar, columnas). No prioritario — coaches usan móvil en banquillo.
  Decisión pendiente, no antes de Android.
- **Desktop:** la app ya funciona en navegador desktop (es web app). Diseño no optimizado
  para pantallas anchas. U Stats sí se beneficiaría de vista desktop con más datos.
  U Scout correcto en mobile-first. Decisión pendiente post-Android.

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
21. Schema stats_* creado en Supabase: 10 tablas
22. collector/src/sync/roster.ts — nuevo sync plantillas
23. collector/src/ingest.ts — tipo 'roster' añadido
24. collector/src/index.ts — syncRosters() en nightly sync
25. server/stats-ingest.ts — handleRoster() + handleSchedule() batch optimizado
26. collector/src/sync/schedule.ts — ingestChunked() chunks de 50
27. server/index.ts — limit 10mb + PORT env var + sin reusePort
28. server/routes.ts — eliminado handler viejo /api/stats/ingest
29. collector/src/client.ts — timeout ucoreClient 30s → 120s

### Bundle — estado sesión 2 mayo 2026
```
Initial chunk: 100KB gzip (era 230KB) ✅
vendor-react: 63KB · vendor-supabase: 51KB · vendor-query: 12KB
Total: ~532KB gzip
PRÓXIMA ACCIÓN (post-TestFlight): motor server-side → -50KB más. DECISIÓN PENDIENTE.
```

### 🔴 RIESGOS ACTIVOS
- P1 queryKey fix aplicado pero no verificado en producción con multi-cuenta
- P2 Schedule scroll List→Planner: recentrar en hoy al cambiar tab
- P2 readCoachBadges + isPhysicalTrainer hardcodeados a false — código muerto

### 🔴 PENDIENTE INMEDIATO
1. Verificar primer sync completo (standings + schedule + roster → Supabase)
2. collector/src/sync/boxscores.ts: añadir playerdata?gameId=X — stats individuales por partido
   Campos: offensiveRebound/defensiveRebound, isStartLineUp, positiveNegativeValue,
   twoPoints/threePoints/foulShot "made-att (pct%)", minutes "MM:SS"
3. POST /api/stats/import-team → importar equipo WCBA a Personnel con un clic
4. Telegram Pi: bloqueado por GFW — pendiente VPN
5. Scraping histórico: loop temporadas [2092, 1767, 1470, 1108, 873, 428, 253, 236, 228, 245, 189, 175]

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
  - networkMode offlineFirst + staleTime 10min + gcTime 7d
  - Cola offline players con flush en window.online
  - clearAllLocalCache() en logout
  - Motor client-side → coach genera report sin conexión ✅
GAP P3: wellness sin cola offline
```

---

## Raspberry Pi 5
- OS: Raspberry Pi OS Lite 64-bit en SSD externo
- IP local: 192.168.1.59 · SSH: pablo@192.168.1.59
- Node 20 + PM2 · Collector en ~/ucore/collector
- pm2 status: ucore-collector online
- Telegram: BLOQUEADO por GFW — pendiente VPN
- STATS_INGEST_KEY: configurada en .env Pi y en Railway ✅
- GitHub: bloqueado por GFW a veces — usar SCP para actualizar archivos individuales
  SCP desde Mac: scp "ruta/archivo" pablo@192.168.1.59:~/ucore/collector/src/...
- Deploy Pi: cd ~/ucore/collector && npm run build && pm2 restart ucore-collector

## API WCBA — endpoints completos confirmados
```
matchoutrank?competitionId=56&seasonId=X          → standings ✅
matchschedules?competitionId=56&seasonId=X&phaseId=Y&roundId=Z&teamId=
  teamId='' REQUERIDO, respuesta date-grouped      → schedule ✅
teamplayers?seasonId=X&teamId=Y                   → roster ✅
playerbasicpage?...                               → promedios temporada ✅
hotspotdata?gameId=Y&periods=1&periods=2...       → shot chart (en pbp.ts) ✅
/api/v2/game/:id/actions                          → PBP completo ✅
playerdata?gameId=X                               → boxscore individual ❌ FALTA
matchinfoscores?matchId=X&gameId=Y                → score final + cuartos ✅
lastlymatchschedule?competitionId=56&seasonId=X   → último partido activo
phasemenus?seasonId=X                             → phaseIds
matchmenusschedule?competitionId=56&seasonId=X&phaseId=Y → roundIds
```

## Temporadas WCBA
```
2092 (activa), 1767, 1470, 1108, 873, 428, 253, 236, 228, 245, 189, 175
```

## Schema Supabase stats_* (creado 3 mayo 2026)
```
stats_teams, stats_players (external_id TEXT), stats_games, stats_boxscores,
stats_season, stats_pbp, stats_standings, stats_roster_snapshots,
stats_insights_cache, stats_sync_log
```

## Schema Supabase app (fuera de schema.ts)
- `players.is_canonical` boolean DEFAULT false
- `player_scout_versions` (player_id, coach_id, inputs JSONB, status, submitted_at)
- `league_matches` (club_id, rival_name, match_date, location, match_type)
- `player_stats` (legacy MVP)
- `schedule_events`, `schedule_participants`, `wellness_entries` — RLS allow_all
- `user_roles` — server-controlled, RLS deny_all

---

## U Stats — diseño aprobado (3 mayo 2026)

### Arquitectura Pi-heavy
Pi calcula nightly → stats_insights_cache → Railway sirve JSON → cliente solo renderiza.

### Métricas jugadora (Pi)
TS%, eFG%, TOV%, USG%, percentiles vs liga, shot zones 14 zonas,
clutch stats Q4 diff≤5, sparkline últimos 5 partidos, hot zones,
conexiones asistencias entre pares

### Métricas equipo (Pi)
PACE, PPP, ORTG, DRTG, Net Rating, OReb%, DReb%, AST/TOV,
eFG%, TS%, FT Rate, puntos por zona (paint/mid/3P/FT%)

### Navegación aprobada
```
Liga      → Clasificación | Líderes
Equipos   → Ficha | Plantilla | Partidos
Jugadoras → Ficha | Game log | Tendencia
Comparador → Jugadora vs Jugadora | Equipo vs Equipo
```

### Gráficas aprobadas
Radar perfil, shot chart hexagonal, sparkline tendencia, donut puntos por zona,
comparador vs liga, grafo conexiones asistencias, score flow (PBP),
radar rebotes (前板/后板/篮板率)

### Import a U Scout
POST /api/stats/import-team → 1 clic → team canónico + jugadoras en players
Nombre chino en DB, pinyin cuando locale=EN/ES (librería pinyin Node, pendiente)

### Insights para U Scout
1. Hot zone → FORCE direction
2. Clutch scorer → isoDanger
3. Tendencia reciente → threat level

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
- `/coach/scout/:id/preview` → ReportSlidesV1 (coach)
- `/coach/club` → ClubManagement
- `/settings` → Settings
- `/stats` → Stats (U Stats)
- `/player` → PlayerTeamList
- `/player/team/:teamId` → Dashboard
- `/player/report/:id` → ReportSlidesV1 (player)
- `/player/wellness` → WellnessStandalone

---

## Arquitectura permisos getPlayers
```
getPlayers(teamId?, clubId?, viewerUserId?)
  Con clubId + viewerUserId:
    WHERE is_canonical = true  OR  created_by_user_id = viewerUserId
```

## Arquitectura permisos Personnel
- head_coach / master: acceso + crear canónicos + promover sandbox
- coach con operationsAccess: ve Personnel, edita canónicos, NO crea ni promueve
- coach sin badge: redirect a /coach

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
- U Schedule — client/src/pages/core/Schedule.tsx (~228KB)
- U Wellness — embebido en Schedule + standalone /player/wellness
- U Scout — scouting defensivo 1-on-1
- U Stats — client/src/pages/core/Stats.tsx
Shell: ModulePage.tsx + ModuleNav.tsx en client/src/pages/core/

### Motor
- Calibración: 100% (551/551, 66 perfiles)
- Quality eval: 100% (46/46, 10 perfiles)
- motor-icons.ts: Lucide — reemplazable con SVG custom (Figma junio 2026)

---

## Principios de producto
- Máximo 3 outputs accionables por pantalla
- Mobile-first: 375px portrait primero
- Coherencia visual entre módulos
- Iconos: Figma obligatorio para custom; Lucide como placeholder
- Scope Scout: solo matchup 1-on-1, sin defensa colectiva

## Reglas entrega código
- NUNCA "añade estas líneas aquí"
- Siempre: archivo completo, O comando terminal, O prompt Cursor
- npm run check después de cada cambio
- Migrations destructivas: raw SQL Supabase, nunca drizzle-kit push
- Verificar que Cursor no duplica handlers en routes.ts
- Capabilities requieren membership: pasar myMembership de useClub().data.members

## Notas de sesión (trampas conocidas)
- Schedule.tsx está en client/src/pages/core/, NO en client/src/core/
- bash_tool corre en Linux — NO puede acceder al Mac. Usar Filesystem MCP
- Filesystem MCP write: filesystem:write_file (lowercase)
- str_replace NO funciona con server/routes.ts — usar python3 script
- Figma MCP: límite Starter agotado — resetea junio 2026
- Cursor duplica handlers en routes.ts — verificar siempre
- getPlayers firma: (teamId?, clubId?, viewerUserId?) — siempre pasar viewerUserId
- Map iteration: usar Array.from(map.entries()) — tsconfig target no soporta for...of Map
- Railway healthcheck: PORT env var + sin reusePort en server.listen()
- Pi GFW bloquea GitHub y Telegram — SCP para archivos individuales

## Scripts
```bash
cd "/Users/palant/Downloads/U scout" && npx tsx scripts/calibrate-motor.ts
cd "/Users/palant/Downloads/U scout" && npx tsx scripts/eval-motor-quality.ts
cd "/Users/palant/Downloads/U scout" && npx tsx scripts/eval-report-llm.ts --judge deepseek --fast
```

## Terminología
- DENY/FORCE/ALLOW: instrucciones defensivas slide 3
- AWARE: alertas situacionales (max 2)
- Runners-up: alternativas rankeadas por motor
- Override: decisión entrenador sobre output motor
- Discrepancia: dos entrenadores con opciones distintas
- trapResponse: reacción a blitz/hedge en PnR
- pressureResponse: reacción a presión individual

---

## TestFlight — checklist

### Bloqueantes externos:
- [ ] Apple Developer Program ($99/año) — compra inminente
- [ ] Xcode en el Mac
- [ ] App ID + cert + provisioning profile

### Código listo:
- [x] Info.plist: NSCamera + NSPhotoLibrary
- [x] Portrait-only
- [x] Touch targets ≥44px
- [ ] npx cap sync tras build
- [ ] Iconos 1024x1024 PNG (Figma junio)
- [ ] Bundle version
- [ ] WKWebView: Supabase auth persiste
- [ ] Safe area: env(safe-area-inset-bottom)
- [ ] Code signing + Archive + Upload
