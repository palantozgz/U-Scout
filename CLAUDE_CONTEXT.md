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
- `collector/src/sync/pbp.ts` — parser PBP con ACTION_CODE_MAP completo
- `collector/src/sync/possessions.ts` — (PENDIENTE CREAR) procesador de posesiones
- `ios/App/App/ThemePlugin.swift` — plugin nativo iOS para sincronizar UIWindow.backgroundColor con tema
- `ios/App/App.xcodeproj/project.pbxproj` — MODIFICADO — ThemePlugin registrado en Sources

## NUNCA tocar
- `Profile.tsx` · `schema.ts` · `migrations/`
- SQL destructivo: solo Supabase SQL Editor, nunca `drizzle-kit push`

---

## Tools de Claude — CRÍTICO

### Tools que funcionan en Mac (Filesystem MCP):
- `Filesystem:read_text_file` — **USAR SIEMPRE** para leer archivos del Mac. Funciona con `head`/`tail` para archivos grandes.
- `Filesystem:search_files` — buscar patrones en archivos del Mac
- `filesystem:write_file` (minúscula) — **USAR para escribir archivos completos** en el Mac. Fiable.
- `filesystem:edit_file` (minúscula) — **PELIGROSO con routes.ts**: corrompe archivos grandes que contienen template literals SQL con `${...}`. Usar solo para archivos pequeños o TypeScript puro sin SQL.

### Tools que NO funcionan en Mac:
- `bash_tool` — corre en contenedor Linux de Claude, NO accede al Mac. Nunca intentarlo para leer/escribir archivos del Mac.

### Regla para routes.ts:
**NUNCA usar `edit_file` en `server/routes.ts`**. El archivo tiene template literals SQL con `${seasonId}` etc. que el MCP confunde con placeholders y duplica el contenido. Para cambios en routes.ts: siempre Cursor con prompt completo.

---

## Estándares de trabajo de Pablo (no negociables)

1. **Fórmulas estándar internacionales FIBA** — sin estimaciones no documentadas
2. **Datos exactos, no aproximaciones** — verificar en Supabase antes de implementar
3. **Consistencia total equipo = liga** — exactamente la misma fórmula en ambos lados
4. **Verdad antes que darle la razón** — si algo no es posible o los datos son sospechosos, decirlo primero
5. **Leer código real antes de proponer** — nunca especular sobre el estado del código
6. **Garantizar antes de implementar** — investigar a fondo y garantizar resultado antes de tocar código
7. **Cursor para routes.ts** — todo cambio en routes.ts va por prompt Cursor completo, nunca edit_file
8. **PBP es fuente única de verdad** — boxscore solo para auditoría. Nunca mezclar fuentes para la misma métrica.

---

## U Stats — Arquitectura PBP (decisión 2026-05-23)

### Principio fundamental
Todo viene del PBP. Boxscore = auditoría y validación únicamente.
La razón: boxscore y PBP son fuentes distintas → PPP por tramo nunca cuadraría con PPP general si vienen de fuentes diferentes.

### Tablas derivadas (Fase A completada 2026-05-23)
Creadas en Supabase. El collector las puebla al procesar cada partido.

| Tabla | Contenido | Estado |
|---|---|---|
| `pbp_possessions` | 1 fila por posesión — la unidad fundamental | ✅ creada |
| `pbp_player_game_stats` | 1 fila por jugadora por partido, stats desde PBP | ✅ creada |
| `pbp_lineup_stats` | 1 fila por quinteto por partido | ✅ creada |
| `pbp_audit_log` | diff PBP vs boxscore por partido/equipo | ✅ creada |

### Estado del PBP verificado (2026-05-23)
- 223/223 partidos con PBP (100% cobertura)
- 96.8% de eventos tienen player_external_id (los 3.2% restantes son team events por diseño)
- sub_in/sub_out: 100% con player → base para minutos reales
- tiros, ast, stl, blk, foul, ft: 100% con player
- 864 rebotes sin player = team rebounds (correcto)
- 1.000 TOVs sin player = TOTLTO + TNO24S + TNOOTH (team turnovers, correcto)
- Gap FGM ~10%: action codes no mapeados. Fix aplicado 2026-05-23, pendiente re-sync.

### Roadmap Fases B-F
- **Fase B** (SIGUIENTE): `collector/src/sync/possessions.ts` — procesador que genera las 3 tablas por partido
- **Fase C**: nuevos handlers en `server/stats-ingest.ts` para recibir las 3 tablas
- **Fase D**: reescribir endpoints en `server/routes.ts` para leer de tablas derivadas
- **Fase E**: UI — vaciar fuente actual, conectar nueva. Añadir quintetos, on/off
- **Fase F**: re-sync histórico automático (TRUNCATE + Pi reprocesa 223 partidos)

### Documentación
- `PBP_STATS_BLUEPRINT.md` — arquitectura completa con algoritmos
- `FORMULAS_STATS.md` — fórmulas implementadas con estado
- `PBP_EVENTS.md` — catálogo event_types, gaps, visión PBP vs boxscore

---

## U Stats — Estado actual (fórmulas)

### Fórmulas implementadas — estado actual (en routes.ts, fuente boxscore — PENDIENTE migración)

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
| ORTG/DRTG equipo | 100×pts/posesiones (boxscore) | ⚠️ pendiente migrar a PBP |
| PPP equipo/liga | pts/posesiones (boxscore) | ⚠️ pendiente migrar a PBP |
| Pace liga | (poss_home+poss_away)/2/games | ⚠️ pendiente migrar a PBP |
| PPP por tramo | PBP con TOVs en denominador | ✅ fix 2026-05-23 |
| pointsByZone | coeficiente fijo 70/30 | ❌ estimación — tag "est." en UI |

### Nombres tramos pace-segments (actualizado 2026-05-23)
- 0-8s: **Transition**
- 8-14s: **Early Offense**
- 14-24s: **Halfcourt**

### Pi — estado (2026-05-23)
- IP: 192.168.1.7 / ucore-pi.local · usuario: `pablo` · contraseña: `skapol`
- PM2: proceso `ucore-collector` activo
- Collector actualizado con nuevos action codes (2026-05-23)
- PBP re-sync en curso tras TRUNCATE (iniciado esta sesión)
- `stats_pbp` tenía ~116k eventos antes del TRUNCATE. Re-sync en progreso.

### Action codes añadidos al mapa (2026-05-23)
`2PMALY`, `2PMTDK`, `2PAALY`, `2PATDK`, `3PMFLT`, `3PAFLT`, `3PATRN`,
`TNO5SC`, `TNO8SC`, `FOLPER`, `FOLDSQ`, `TOTSTO`
MADE_SHOT_CODES y SHOT_CODES actualizados correspondientemente.

---

## Infraestructura

### Pi (scraper)
- IP: 192.168.1.7 (también responde en ucore-pi.local)
- usuario: `pablo` (NO `palant`)
- PM2: proceso `ucore-collector` — `pm2 status`, `pm2 logs ucore-collector`
- Tailscale: instalado, pendiente autenticar (`sudo tailscale up`)
- WCBA API chain: `phasemenus` → `matchmenusschedule` → `matchschedules?teamId=` (string vacío requerido) → `matchinfoscores`
- Telegram bot: requiere VPN en Pi (bloqueado por firewall chino)

### WCBA datos
- `competitionId=56`, `seasonId=2092`, 18 equipos seeded
- Shot coordinates: 28m×15m, Home arc x=0.0575, Away x=0.9425
- 6 zonas FIBA verificadas con 12 reference shots
- PBP action codes: en inglés, confirmados
- `user_id` en PBP = player_external_id de la jugadora

---

## Sesiones anteriores resumidas

### Sesión 2026-05-23 — PBP como fuente única, blueprint arquitectura

**Fixes aplicados:**
- PPP por tramo: TOVs añadidos al denominador (routes.ts via Cursor) — fix commit `c947527`
- Nombres tramos pace-segments: Transition / Early Offense / Halfcourt (Stats.tsx)
- ACTION_CODE_MAP: 12 nuevos códigos añadidos (collector/src/sync/pbp.ts)
- Collector actualizado en Pi: git pull + npm build + pm2 restart

**Análisis completados:**
- Auditoría PBP vs boxscore: gap FGM ~10% confirmado = action codes no mapeados (ahora fixeado)
- Verificación cobertura player_external_id: 96.8% (los sin player son team events por diseño)
- Team rebounds (REBDEF/REBOFN sin player) y team turnovers (TOTLTO/TNO24S) = correctos por diseño
- Ambos tipos de eventos sin player DEBEN contarse para stats de equipo aunque no aparezcan en stats individuales

**Documentos creados:**
- `FORMULAS_STATS.md` — fórmulas con fuente y estado
- `PBP_EVENTS.md` — catálogo event_types con literatura externa
- `PBP_STATS_BLUEPRINT.md` — arquitectura completa para migración a PBP como fuente única

**Fase A completada:**
4 tablas creadas en Supabase: `pbp_possessions`, `pbp_player_game_stats`, `pbp_lineup_stats`, `pbp_audit_log`

### Sesión 2026-05-22 — Stats audit + pace segments + PPP
- Barras PPG/RPG/APG: corregidas con avgPlayerPpg/Rpg/Apg (COALESCE)
- Commit `04b515b` = versión estable con barras + PPP por tramo visible
- Umbrales corregidos: 0-8/8-14/14-24 en equipo y liga
- after_basket CASE WHEN aplicado simétricamente en equipo y liga
- paired CTE: DISTINCT ON corregido → pace liga ~80.4 correcto
- pointsByZone tag "est." añadido en Stats.tsx (coeficiente 70/30 hardcoded)
- PPP por tramo implementado y visible (datos solo de tiros, TOVs pendientes — fixeado 2026-05-23)

---

## Bugs activos (por impacto)

**P0:**
- PPP tramos vs PPP general no cuadran: fuente diferente (boxscore vs PBP). Fix = Fases B-F.
- pointsByZone: datos estimados (70/30 hardcoded), tag "est." añadido, datos reales en Fase 4

**P1:**
- Game boxscore sheet tapado por nav bar izquierda en desktop
- Nav bar iOS se bloquea al abrir ficha jugadora/equipo en Stats
- Schedule scroll no recentering en List↔Planner switch
- Hero card "Mis estadísticas" jugadoras — depende de `profile.wcba_external_id` no null
- `hasReport` siempre true en MyScout (usa createDefaultPlayer inputs)

**P2:**
- Game boxscore sheet: falta marcador por cuartos y gráfica desarrollo
- Módulos en desktop en español (deberían inglés según specs)
- Scout en iOS ha perdido la "U" — debe ser "U Scout"

**Pendientes:**
- Fase B: `collector/src/sync/possessions.ts` — procesador posesiones
- Pi: autenticar Tailscale + verificar re-sync PBP completo tras TRUNCATE
- iOS TestFlight: bundle <300KB gzip (actualmente ~509KB)
- Stats Fase 3: bubble chart, comparador radar, coaching dashboard (después de Fases B-F)
- Stats Fase 4: shot_x/shot_y hotspot data
- Confirmar `backup/motor-v2.1-pre-20260405` estable y mergear
