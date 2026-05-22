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
- `Filesystem:list_directory` — listar directorios del Mac
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

---

## U Stats — Estado actual

### Datos reales verificados (Supabase, season_id=2092, competitionId=56)
- Partidos completados (status=4): 223 partidos únicos
- Posesiones/equipo/partido real: **80.4** (fórmula: fga + 0.44*fta + tov - off_reb)
- TOVs reales Zhejiang (external_id=19038): 460 / 1585 tiros = 29% de posesiones
- Eventos PBP totales: ~116.700 (en Supabase vía Pi)
- `shot_x/shot_y/shot_zone`: 0 filas — hotspot data nunca sincronizado (Fase 4)

### Fórmulas implementadas — estado

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
| ORTG/DRTG equipo | 100×pts/posesiones | ✅ |
| PPP equipo/liga | pts/posesiones | ✅ |
| Pace liga | (poss_home+poss_away)/2/games | ✅ ~80.4 tras fix DISTINCT ON |
| Pace equipo | misma fórmula vía team_box+rival_box | ✅ |
| PPP por tramo | solo tiros, excluye TOVs | ⚠️ PENDIENTE fix TOVs |
| pointsByZone paint/mid | coeficiente fijo 70/30 | ⚠️ estimación — tag "est." en UI |

### Fix pendiente — PPP por tramo con TOVs
**Problema:** PPP por tramo excluye posesiones que terminan en TOV real (29% en Zhejiang).
Esto infla el PPP ponderado ~0.07 vs PPP general.
**Fix necesario:** añadir TOVs reales en `team_shots` CTE (equipo) y `shots_lg` CTE (liga):
```sql
OR (event_type = 'turnover' AND action_code NOT IN ('TOTLTO','TNOTVR','TNOFGV'))
```
**IMPORTANTE:** Este cambio DEBE hacerse via prompt Cursor (nunca edit_file en routes.ts).
**Ambas CTEs deben tener la misma condición** para mantener consistencia equipo=liga.

### Pace segments — metodología actual
- Umbrales: 0-8s (Transition) / 8-14s (Demi-trans) / 14-24s (Set play)
- Inicio posesión: rebote def, robo, falta, FT último, inicio cuarto
- After_basket (canasta rival): -3s estimados EXCEPTO Q4 últimos 2min (`CASE WHEN quarter < 4 OR clock_sec > 120 THEN 3 ELSE 0 END`)
- Excluye putbacks (rebote ofensivo propio ≤3s)
- Umbral mínimo: 200 posesiones detectadas para mostrar datos
- **Consistencia equipo/liga:** CASE WHEN idéntico en ambas queries ✅

### Pendiente — Pace defensivo por tramos
Misma métrica pero desde perspectiva defensiva:
- % ataques concedidos en cada tramo
- PPP concedido en cada tramo
Arquitectura idéntica a la ofensiva — cambiar filtro `team_id = ${team.ext_id}` por rival.

### paired CTE en league-averages — fix aplicado
`SELECT DISTINCT ON (o.game_id) ... ORDER BY o.game_id` — garantiza 1 fila por partido.
Sin este fix: duplicados inflaban poss_home+poss_away dando pace=40 en vez de ~80.

---

## U Stats — Roadmap

**Fase 2 (actual):** UI TeamSheet y PlayerSheet — completada
**Fase 3:** Bubble chart, comparador radar, coaching dashboard — pendiente
**Fase 4:** Pi pipeline para hotspot data / shot_x/shot_y (0 filas actualmente)

**PBP como fuente principal (visión):**
El boxscore de la web es generado por ellos desde el PBP. Nosotros podemos hacer lo mismo
y obtener más información. Antes de deprecar boxscore: auditar que PBP reconstituye
exactamente los mismos totales (pts, reb, ast, stl, blk, tov). El boxscore queda como
checkeo para detectar errores de parsing PBP.

---

## Infraestructura

### Pi (scraper)
- IP: 192.168.1.7 (cambió tras corte de luz; alternativa: ucore-pi.local)
- PM2: proceso `ucore-collector` — `pm2 status`, `pm2 logs`
- Tailscale: instalado, pendiente autenticación (`sudo tailscale up`)
- WCBA API chain: `phasemenus` → `matchmenusschedule` → `matchschedules?teamId=` (string vacío requerido) → `matchinfoscores`
- Telegram bot: requiere VPN en Pi (bloqueado por firewall chino)

### WCBA datos
- `competitionId=56`, `seasonId=2092`, 18 equipos seeded
- Shot coordinates: 28m×15m, Home arc x=0.0575, Away x=0.9425
- 6 zonas FIBA verificadas con 12 reference shots
- PBP action codes: en inglés, confirmados

---

## Sesiones anteriores resumidas

### Sesión 2026-05-22 — Stats audit + pace segments + PPP
- Barras PPG/RPG/APG: corregidas con avgPlayerPpg/Rpg/Apg (COALESCE)
- Commit `04b515b` = versión estable con barras + PPP por tramo visible
- Umbrales corregidos: 0-8/8-14/14-24 en equipo y liga
- after_basket CASE WHEN aplicado simétricamente en equipo y liga
- paired CTE: DISTINCT ON corregido → pace liga ~80.4 correcto
- pointsByZone tag "est." añadido en Stats.tsx (coeficiente 70/30 hardcoded)
- label "0-7"" → "0-8"" corregido en Stats.tsx
- PPP por tramo implementado y visible (datos solo de tiros, TOVs pendientes)

### Sesión 2026-05-22 — Home layout, permisos, Pi, prefetch
- HomeDesktop grid 2x2 + Mi Club
- effectiveRole para preview en capabilities
- Schedule days clicables
- Pi: IP 192.168.1.7, pm2 activo, Tailscale instalado

---

## Bugs activos (por impacto)

**P0:**
- PPP por tramo no incluye TOVs → inflado vs PPP general (fix en routes.ts via Cursor)
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
- Pi: autenticar Tailscale + sync PBP completo
- iOS TestFlight: bundle <300KB gzip (actualmente ~509KB)
- Stats Fase 3: bubble chart, comparador radar, coaching dashboard
- Stats Fase 4: shot_x/shot_y hotspot data
- Confirmar `backup/motor-v2.1-pre-20260405` estable y mergear

---

## Project Knowledge (archivos en Claude Project)

Documentos útiles para mantener en cache (carpeta del proyecto en Claude.ai):
1. `CLAUDE_CONTEXT.md` — este archivo — estado técnico completo
2. `FORMULAS_STATS.md` — fórmulas implementadas con fuente estándar y estado (pendiente crear)
3. `PBP_EVENTS.md` — catálogo event_types y action_codes reales en DB (pendiente crear)
