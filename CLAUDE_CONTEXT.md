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
- `server/routes.ts` — rutas API Express (~3540 líneas)
- `server/stats-ingest.ts` — ingest endpoint Pi → Railway → Supabase
- `server/possessions.ts` — procesador PBP → tablas derivadas (v6, verificado)
- `collector/src/sync/pbp.ts` — parser PBP con ACTION_CODE_MAP completo
- `ios/App/App/ThemePlugin.swift` — plugin nativo iOS para sincronizar UIWindow.backgroundColor con tema
- `ios/App/App.xcodeproj/project.pbxproj` — MODIFICADO — ThemePlugin registrado en Sources

## NUNCA tocar
- `Profile.tsx` · `schema.ts` · `migrations/`
- SQL destructivo: solo Supabase SQL Editor, nunca `drizzle-kit push`

---

## Tools de Claude — CRÍTICO

### Tools que funcionan en Mac (Filesystem MCP):
- `Filesystem:read_text_file` — **USAR SIEMPRE** para leer archivos del Mac.
- `Filesystem:search_files` — buscar patrones en archivos del Mac
- `filesystem:write_file` (minúscula) — **USAR para escribir archivos completos** en el Mac.
- `filesystem:edit_file` (minúscula) — PELIGROSO con routes.ts. Solo para archivos pequeños sin SQL.

### Tools que NO funcionan en Mac:
- `bash_tool` — corre en contenedor Linux de Claude, NO accede al Mac.

### Regla para routes.ts:
**NUNCA usar `edit_file` en `server/routes.ts`**. Para cambios en routes.ts: siempre Cursor con prompt completo.

---

## Estándares de trabajo de Pablo (no negociables)

1. **Fórmulas estándar internacionales FIBA** — sin estimaciones no documentadas
2. **Datos exactos, no aproximaciones** — verificar en Supabase antes de implementar
3. **Verdad antes que darle la razón** — si algo no es posible o los datos son sospechosos, decirlo primero
4. **Leer código real antes de proponer** — nunca especular sobre el estado del código
5. **Garantizar antes de implementar** — investigar a fondo y garantizar resultado antes de tocar código
6. **Cursor para routes.ts** — todo cambio en routes.ts va por prompt Cursor completo, nunca edit_file
7. **PBP es fuente única de verdad** — boxscore solo para auditoría
8. **Simular antes de deployar** — cualquier cambio al procesador de posesiones debe pasar simulación local primero
9. **No 0 gap aceptado** — cualquier diferencia PBP vs boxscore > 3 pts es un error a investigar

---

## U Stats — Arquitectura PBP (decisión 2026-05-23)

### Principio fundamental
Todo viene del PBP. Boxscore = auditoría y validación únicamente.

### Flujo de datos
1. Pi scrapa JSON crudo de la API WCBA → guarda en `stats_pbp`
2. Railway lee `stats_pbp` → genera tablas derivadas via `server/possessions.ts`
3. App fetchea solo las tablas derivadas ya cocinadas

### Tablas derivadas (Fase A completada 2026-05-23)

| Tabla | Contenido | Estado |
|---|---|---|
| `pbp_possessions` | 1 fila por posesión | ✅ creada y poblada |
| `pbp_player_game_stats` | 1 fila por jugadora por partido | ✅ creada y poblada |
| `pbp_lineup_stats` | 1 fila por quinteto por partido | ✅ creada y poblada |
| `pbp_audit_log` | diff PBP vs boxscore | ✅ creada y poblada |

### FKs eliminados (2026-05-23)
Las columnas `team_id` en las tablas derivadas usan external_id (igual que stats_pbp), NO internal id.
FK constraints eliminados: `pbp_possessions_team_id_fkey`, `pbp_possessions_opponent_team_id_fkey`,
`pbp_lineup_stats_team_id_fkey`, `pbp_player_game_stats_team_id_fkey`

### Estado del procesador `server/possessions.ts` (v6, commit 8c00df5)
Algoritmo verificado con simulación local sobre datos reales del Q1 del partido 1106508.

**Bugs corregidos en v6:**
- `assist`, `block`, `foul_drawn`, `sub_in`, `sub_out` son decoradores — NUNCA abren posesión nueva
- `shot_made` del equipo contrario al possTid: cierra posesión actual y abre la del equipo que anota
- And-1: look-ahead detecta `foul` del rival tras `shot_made` → mantiene posesión abierta para el FT

**Resultado verificado game_id=1 (post v6):**
- Equipo 710: 76 poss, 68 pts (box=73, diff=5)
- Equipo 713: 80 poss, 85 pts (box=88, diff=3)

**Gap residual (5 pts en 710):** NO es bug del procesador. Es gap del scraper:
- 7 canastas de 710 no están en stats_pbp porque sus action codes caen a `unknown`
- Fix ya aplicado en collector/src/sync/pbp.ts (nuevos códigos añadidos 2026-05-23)
- **PENDIENTE: re-sync completo de stats_pbp** — TRUNCATE stats_pbp + collector reprocesa 223 partidos

### Endpoints admin (sin auth, temporales)
- `POST /api/stats/admin/trigger-possessions?seasonId=2092` — procesa todos los pendientes
- `POST /api/stats/admin/process-game/:gameId?seasonId=2092` — procesa un partido específico
- `GET /api/stats/admin/possessions-status?seasonId=2092` — estado del procesamiento

### Estado del PBP verificado (2026-05-23)
- 223/223 partidos con PBP (100% cobertura) — pero con action codes viejos
- 116.700 eventos en stats_pbp (pre re-sync con nuevos códigos)
- player_external_id en sub_in/sub_out: ✅ confirmado presente
- **PENDIENTE: TRUNCATE stats_pbp + re-sync desde Pi** para activar nuevos action codes

### Roadmap Fases B-F
- **Fase B** ✅ COMPLETADA: `server/possessions.ts` — procesador que genera las 3 tablas
- **Fase C** ✅ COMPLETADA: handlers en `server/stats-ingest.ts` y `server/routes.ts`
- **Fase D** (SIGUIENTE): reescribir endpoints en `server/routes.ts` para leer de tablas derivadas
- **Fase E**: UI — vaciar fuente actual, conectar nueva. Añadir quintetos, on/off
- **Fase F**: re-sync histórico automático (TRUNCATE + Pi reprocesa 223 partidos)

### Nombres tramos pace-segments (actualizado 2026-05-23)
- 0-8s: **Transition**
- 8-14s: **Early Offense**
- 14-24s: **Halfcourt**

### Pi — estado (2026-05-24)
- IP: 192.168.1.7 / ucore-pi.local · usuario: `pablo` · contraseña: `skapol`
- PM2: proceso `ucore-collector` activo (reiniciado 2026-05-24)
- Collector actualizado con nuevos action codes (2026-05-23, commit c947527)
- **PENDIENTE: TRUNCATE stats_pbp en Supabase → collector re-sincroniza 223 partidos**
- Telegram bot: bloqueado por firewall chino (China), solo warnings — normal

### Action codes añadidos al mapa (2026-05-23)
`2PMALY`, `2PMTDK`, `2PAALY`, `2PATDK`, `3PMFLT`, `3PAFLT`, `3PATRN`,
`TNO5SC`, `TNO8SC`, `FOLPER`, `FOLDSQ`, `TOTSTO`

---

## U Stats — Fórmulas implementadas

| Métrica | Fórmula | Estado |
|---|---|---|
| FG%, 3P%, FT% | Estándar | ✅ |
| eFG% | (FGM + 0.5×3PM)/FGA | ✅ |
| TS% | PTS/(2×(FGA+0.44×FTA)) | ✅ |
| TOV% | TOV/(FGA+0.44×FTA+TOV) | ✅ |
| FT Rate | FTA/FGA | ✅ |
| ORB%, DRB% | ORB/(ORB+rival_DRB) | ✅ |
| AST/TOV | AST/TOV | ✅ |
| PIE | Fórmula NBA exacta | ✅ |
| USG% | Fórmula estándar con minutos | ✅ |
| ORTG/DRTG equipo | 100×pts/posesiones (boxscore) | ⚠️ pendiente migrar a pbp_possessions |
| PPP equipo/liga | pts/posesiones (boxscore) | ⚠️ pendiente migrar a pbp_possessions |
| Pace liga | (poss_home+poss_away)/2/games | ⚠️ pendiente migrar a pbp_possessions |
| PPP por tramo | PBP con TOVs en denominador | ✅ fix 2026-05-23 |
| pointsByZone | coeficiente fijo 70/30 | ❌ estimación — tag "est." en UI |

---

## Infraestructura

### Pi (scraper)
- IP: 192.168.1.7 (también responde en ucore-pi.local)
- usuario: `pablo` (NO `palant`)
- PM2: proceso `ucore-collector` — `pm2 status`, `pm2 logs ucore-collector`
- WCBA API chain: `phasemenus` → `matchmenusschedule` → `matchschedules?teamId=` → `matchinfoscores`
- Telegram bot: bloqueado por firewall chino — solo warnings, normal

### WCBA datos
- `competitionId=56`, `seasonId=2092`, 18 equipos seeded
- Shot coordinates: 28m×15m, Home arc x=0.0575, Away x=0.9425
- PBP action codes: en inglés, confirmados
- `user_id` en PBP = player_external_id de la jugadora

---

## Sesiones anteriores resumidas

### Sesión 2026-05-24 — Procesador de posesiones PBP

**Decisión arquitectónica:**
Todo desde PBP. Boxscore solo auditoría. Flujo: Pi → stats_pbp → possessions.ts → tablas derivadas → app.

**Tablas derivadas creadas en Supabase:**
`pbp_possessions`, `pbp_player_game_stats`, `pbp_lineup_stats`, `pbp_audit_log`

**Procesador server/possessions.ts (v6):**
- Algoritmo de posesiones verificado con simulación local sobre datos reales (Q1 partido 1106508)
- Bugs corregidos: decoradores no abren posesión, shot_made equipo contrario, and-1 correcto
- FGA cuadra 100% con PBP raw tras los fixes
- Gap residual de pts (~5) = canastas no scrapeadas (action codes unknown) — no es bug del procesador

**Endpoints admin añadidos a routes.ts:**
- `POST /api/stats/admin/trigger-possessions`
- `POST /api/stats/admin/process-game/:gameId`
- `GET /api/stats/admin/possessions-status`

**Fixes aplicados en esta sesión:**
- PPP por tramo: TOVs añadidos al denominador
- Nombres tramos: Transition / Early Offense / Halfcourt
- ACTION_CODE_MAP: 12 nuevos códigos en pbp.ts
- FK constraints eliminados en tablas derivadas

**Commits de esta sesión:**
- `c947527` — PBP action codes, PPP TOV denominator, pace segment labels, docs
- `30928c8` — possessions v5
- `8c00df5` — fix decorators + cross-team shot_made (v6, ACTIVO)

**INICIO PRÓXIMA SESIÓN:**
1. Verificar que el re-sync del PBP terminó: `pm2 logs ucore-collector --lines 20` en la Pi
2. Verificar 0 unmapped: `SELECT action_code, COUNT(*) FROM stats_pbp WHERE event_type='unknown' GROUP BY action_code ORDER BY COUNT(*) DESC`
3. TRUNCATE pbp_possessions/pbp_player_game_stats/pbp_lineup_stats/pbp_audit_log
4. Disparar: `curl -s -X POST "https://u-scout-production.up.railway.app/api/stats/admin/trigger-possessions?seasonId=2092"`
5. Verificar audit: `SELECT team_external_id, box_pts, pbp_pts, diff_pts, status FROM pbp_audit_log WHERE season_id=2092 ORDER BY ABS(diff_pts) DESC LIMIT 10`
6. Si diff_pts=0 en todos → Fase D: reescribir endpoints stats para leer de tablas derivadas

### Sesión 2026-05-23 — PBP como fuente única, blueprint arquitectura
- Auditoría PBP vs boxscore: gap FGM ~10% = action codes no mapeados
- Verificación cobertura player_external_id: 96.8%
- Documentos creados: FORMULAS_STATS.md, PBP_EVENTS.md, PBP_STATS_BLUEPRINT.md

---

## Bugs activos (por impacto)

**P0:**
- TRUNCATE stats_pbp + re-sync pendiente para activar nuevos action codes
- ORTG/DRTG/PPP en UI vienen de boxscore — inconsistente con PPP por tramo (PBP). Fix = Fase D
- pointsByZone: datos estimados (70/30 hardcoded), tag "est." añadido

**P1:**
- Game boxscore sheet tapado por nav bar izquierda en desktop
- Nav bar iOS se bloquea al abrir ficha jugadora/equipo en Stats
- Schedule scroll no recentering en List↔Planner switch
- Hero card "Mis estadísticas" jugadoras — depende de `profile.wcba_external_id` no null
- `hasReport` siempre true en MyScout

**P2:**
- Game boxscore sheet: falta marcador por cuartos y gráfica desarrollo
- Módulos en desktop en español
- Scout en iOS ha perdido la "U"

**Pendientes:**
- Fase D: reescribir endpoints stats para leer de tablas derivadas
- Fase E: UI conectar nuevas fuentes, añadir quintetos y on/off
- iOS TestFlight: bundle <300KB gzip
- Stats Fase 4: shot_x/shot_y hotspot data
- Confirmar `backup/motor-v2.1-pre-20260405` estable y mergear
- Eliminar endpoint temporal `/api/stats/admin/trigger-possessions` (sin auth) cuando todo esté estable
