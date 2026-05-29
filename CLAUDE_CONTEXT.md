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
- `/Users/palant/Downloads/U scout/` es wrapper con .env — NO es el repo

## Stack
React + TypeScript + Vite · Express · Drizzle ORM · TanStack Query · shadcn/ui · Tailwind v4
Capacitor 8.x — iOS nativo + Mac Catalyst (Xcode)

---

## Principios de datos — NO NEGOCIABLES

1. **PBP es fuente única de verdad.** Absolutamente todos los datos de stats en la app deben provenir de las tablas derivadas del PBP (`pbp_possessions`, `pbp_player_game_stats`, `pbp_lineup_stats`).
2. **`stats_player_boxscores` solo existe para auditoría** — el único endpoint que puede leerlo es `/api/stats/game/:id/boxscore`.
3. **`stats_standings` solo existe como datos de clasificación oficial** — W/L/racha desde WCBA API. No se usa para métricas de rendimiento.
4. **Ninguna métrica de rendimiento (PPG, RPG, eFG%, ORTG, etc.) puede salir de boxscores.** Nunca.

**Estado de migración:**
- Todos los endpoints de rendimiento usan PBP ✅
- `/api/stats/players/all-detail` y `/api/stats/player-link` → aún leen boxscores, pero **sin consumidores activos en la UI** — candidatos a eliminar
- `/api/stats/team/:id` (W/L base) → `stats_standings` (aceptable para W/L únicamente)

---

## Herramientas de Claude — CRÍTICO

### Qué puede hacer cada herramienta

| Herramienta | Puede | No puede |
|---|---|---|
| `Filesystem:read_text_file` | Leer archivos del Mac | Ejecutar código |
| `filesystem:write_file` | Escribir archivos en el Mac | Acceder a red |
| `bash_tool` | Grep/sed/python sobre archivos copiados al contenedor Linux | Acceder al Mac, Pi, ni APIs externas |
| `Control your Mac:osascript` con `do shell script` | curl, git, npm en el Mac | SSH con contraseña interactiva |
| `Filesystem:copy_file_user_to_claude` | Copiar archivo del Mac al contenedor Linux para análisis con bash_tool | — |

### Regla bash_tool
**NUNCA usar bash_tool para acceder al Mac, Pi, o APIs.** Solo sirve para analizar archivos ya copiados al contenedor Linux via `Filesystem:copy_file_user_to_claude`. Perder tokens intentando `ssh` o `curl` desde bash_tool es un error que no debe repetirse.

### Acceso a Supabase (directo, sin Terminal UI)
Credenciales en `/Users/palant/Downloads/U scout/.env` — leer de ahí, nunca hardcodear en context.
```applescript
-- Leer credenciales del .env:
set envContent to do shell script "cat '/Users/palant/Downloads/U scout/.env'"
-- Extraer SERVICE_KEY y SUPA_URL, luego:
set result to do shell script "curl -s --max-time 15 '" & SUPA_URL & "/rest/v1/TABLA?select=CAMPOS&limit=N' -H 'apikey: " & SERVICE_KEY & "' -H 'Authorization: Bearer " & SERVICE_KEY & "'"
```
Patrón real verificado: `do shell script` + `curl` + service key funciona directamente. Devuelve JSON. RLS bloqueó con anon key — siempre usar service key.

**Para queries SQL complejas:** pedir a Pablo que ejecute en Supabase SQL Editor. La REST API no soporta SQL arbitrario sin función RPC.

### Acceso a API WCBA (directo)
```applescript
set result to do shell script "curl -s --max-time 10 'https://www.cba.net.cn/datahub/cbamatch/games/ENDPOINT?PARAMS' -H 'Referer: https://www.cba.net.cn/' -H 'User-Agent: Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/120.0.0.0 Safari/537.36' -H 'Accept: application/json, text/plain, */*' -H 'Accept-Language: zh-CN,zh;q=0.9'"
```
Endpoints confirmados: `phasemenus`, `matchmenusschedule`, `matchschedules`, `matchinfoscores`, `pbpinfo`.

### Acceso a la Pi
- IP: `192.168.1.7` · usuario: `pablo` · contraseña: `skapol`
- **SSH key configurada:** `~/.ssh/pi_ucore` ✅
- Desde casa: `do shell script "ssh -i ~/.ssh/pi_ucore pablo@192.168.1.7 'COMANDO'"` funciona directamente
- Desde fuera de casa: Pi no accesible (IP local 192.168.1.7)

---

## Arquitectura del sistema de datos

### Flujo de datos
```
API WCBA
  → collector/pbp.ts (Pi) → stats_pbp (raw PBP)
  → collector/boxscores.ts (Pi) → stats_player_boxscores (SOLO AUDITORÍA)
  → collector/standings.ts (Pi) → stats_standings (SOLO W/L oficial)
  
stats_pbp → possessions.ts v6.2 (Railway) → tablas derivadas:
  → pbp_possessions         (1 fila por posesión)
  → pbp_player_game_stats   (1 fila por jugadora por partido)
  → pbp_lineup_stats        (1 fila por quinteto por partido)
  → pbp_audit_log           (diff PBP vs boxscore)
  
tablas derivadas → endpoints Express → UI React
```

### Estado del audit — 2026-05-27
- 440 partidos: status=ok, max_diff=0 ✅
- 2 partidos en error: game_id=286 (partido 1106673, boxscore=0 porque sync nocturno pendiente)
- El PBP procesado es correcto.

### Tablas derivadas — campos clave

**`pbp_player_game_stats`** (fuente principal para métricas de jugadoras):
`player_external_id, team_id, game_id, pts, reb, ast, stl, blk, tov, fgm, fga, fg3m, fg3a, ftm, fta, off_reb, def_reb, fouls, plus_minus, seconds_played, is_starter`

**`pbp_possessions`** (fuente principal para métricas de equipo):
`game_id, team_id, points, possession_type, duration_seconds`

**`pbp_lineup_stats`** (fuente para quintetos y on/off):
`lineup_id, team_id, game_id, season_id, off_possessions, def_possessions, off_pts, def_pts, off_reb, def_reb, tov, stl, total_seconds`

---

## Collector (Pi) — estado

- IP: `192.168.1.7` · usuario: `pablo` · contraseña: `skapol`
- PM2: `ucore-collector` activo
- Código activo en Pi: commit `80a7b88`
- **GitHub no accesible desde Pi** — usar SCP para actualizaciones
- TOTLTO y TOTSTO son los únicos action_codes que quedan como `unknown`
- Fix pendiente de SCP: commit `d0f2622` (candidatesForPBP status=3 con marcador)

### Action codes WCBA
- Sistema: Genius Sports FIBA LiveStats
- TOTLTO/TOTSTO/TNOSTL → `'unknown'` (administrativos)
- FOLDEF/FOLPER/FOLDSQ/FOLUSM → `'foul'` (fouler = defensor)

---

## Procesador de posesiones v6.2 (server/possessions.ts)

### Pasada 1B: inferir offense_team_id

| Código | offense = |
|---|---|
| shot/turnover/ORB | tid (atacante) |
| REBDEF | tid (reboteador pasa a atacar) |
| STEBAL | tid (robador pasa a atacar) |
| FOLDEF/FOLPER/FOLDSQ/FOLUSM/FOLTEC | rival de tid |
| FOLOFF/FOLOFN | tid (fouler es atacante) |
| ft_made/ft_missed | tid (tirador siempre es atacante) |
| JUBSUC | tid (ganador del jump ball) |
| decoradores | último offense conocido |

### Verificación (partido 1108582)
- HOME 65pts: possessions=65 ✅ diff=0
- AWAY 74pts: possessions=74 ✅ diff=0

---

## Estándares de trabajo (no negociables)

1. **Verdad antes que velocidad** — si hay dudas, investigar antes de proponer
2. **Leer código real antes de proponer** — nunca especular sobre el estado del código
3. **Simular antes de deployar** — especialmente el procesador de posesiones
4. **Gap cero** — diff PBP vs boxscore debe ser 0 en todos los partidos
5. **PBP es fuente única** — ningún endpoint de rendimiento lee de boxscores
6. **Cursor para routes.ts** — nunca edit_file directo; siempre prompt Cursor completo
7. **npm run check exit 0** antes de cada commit

### Reglas de entrega de código
- NUNCA "añade estas líneas aquí"
- Siempre uno de: archivo completo para copy-paste, comando terminal, o prompt Cursor completo
- Nunca mezclar métodos
- `npm run check` exit 0 antes de cualquier commit

### Arquitectura de sesiones de trabajo
Para cualquier investigación de datos, el orden correcto es:
1. Verificar qué devuelve la API WCBA (do shell script + curl)
2. Verificar qué llega a Supabase (do shell script + Supabase REST o SQL Editor)
3. Verificar qué produce el procesador (leer possessions.ts, comparar con audit_log)
4. Verificar qué exponen los endpoints (leer routes.ts)
5. Verificar qué muestra la UI (leer Stats.tsx)
Solo cuando los 5 niveles son correctos, proponer cambios.

---

## Archivos clave
- `server/routes.ts` — rutas API Express (god file — leer en chunks)
- `server/possessions.ts` — procesador PBP v6.2
- `server/stats-ingest.ts` — ingest endpoint Pi → Railway → Supabase
- `collector/src/sync/pbp.ts` — parser PBP con ACTION_CODE_MAP completo
- `collector/src/sync/schedule.ts` — sync de partidos
- `collector/src/index.ts` — nightly sync + candidatesForPBP logic
- `collector/src/config.ts` — configuración WCBA API base URL y parámetros
- `client/src/lib/stats-api.ts` — hooks TanStack Query de stats
- `client/src/pages/core/Stats.tsx` — U Stats UI (god file — leer en chunks)
- `client/src/pages/core/Playbook.tsx` — U Playbook UI
- `client/src/lib/defensive-system.ts` — motor v5 completo

## NUNCA tocar
- `Profile.tsx` · `schema.ts` · `migrations/`
- SQL destructivo: solo Supabase SQL Editor, nunca `drizzle-kit push`
- `routes.ts`: SIEMPRE via Cursor con prompt completo, nunca `edit_file` directo

---

## Estado de módulos — 2026-05-27

### U Stats — endpoints y fuentes

| Endpoint | Fuente actual | Estado |
|---|---|---|
| `/api/stats/players` | `pbp_player_game_stats` | ✅ PBP |
| `/api/stats/player/:id` | `pbp_player_game_stats` | ✅ PBP |
| `/api/stats/games` | `pbp_player_game_stats` | ✅ PBP |
| `/api/stats/leaders` | `pbp_player_game_stats` | ✅ PBP |
| `/api/stats/standings` | `stats_standings` | ⚠️ aceptable solo para W/L |
| `/api/stats/team/:id` (ORTG/DRTG/PPP/Pace) | `pbp_possessions` | ✅ PBP |
| `/api/stats/team/:id` (roster) | `pbp_player_game_stats` | ✅ PBP |
| `/api/stats/team/:id` (W/L base) | `stats_standings` | ⚠️ aceptable |
| `/api/stats/game/:id/boxscore` | `stats_player_boxscores` | ✅ único uso legítimo |
| `/api/stats/league-averages` | `pbp_player_game_stats` | ✅ PBP |
| `/api/stats/player-percentiles` | `pbp_player_game_stats` | ✅ PBP |
| `/api/stats/team/:id/lineups` | `pbp_lineup_stats` | ✅ PBP |
| `/api/stats/team/:id/on-off/:id` | `pbp_lineup_stats` | ✅ PBP |
| `/api/stats/team/:id/pace-segments` | `stats_pbp` (raw) | ⚠️ metodología proxy — ver nota |

**Nota pace-segments:** usa LAG sobre el reloj del PBP para estimar tiempo de posesión. No es comparable con PPP general (que usa `pbp_possessions`). Los valores de PPP por tramo son señal cualitativa, no cifra exacta. No mostrar en la misma pantalla que el ORTG sin advertencia.

### U Stats — UI
La UI en Stats.tsx tiene:
- Tab Liga: Standings (W/L/PPG/NET/eFG%), Líderes (PPG/RPG/APG/SPG/BPG/FG%/TS%/TOPG)
- Tab Jugadoras: lista ordenable con filtros (posición, equipo, avanzados), ficha individual
- Ficha jugadora: radar, barras vs liga, PPG/RPG/APG/SPG/BPG/TOPG/MPG, home/away splits, game log, deep tab (USG%, PIE, FT Rate, AST/TOV, on/off)
- TeamSheet: Overview (ORTG/DRTG/Pace/4Factores/zones), Advanced (pace-segments), Quintetos, Partidos, Roster
- Coach Dashboard: colapsable, próximo rival + nuestro registro (ownTeamName usa `OWN_TEAM_NAME_FALLBACK = "Inner Mongolia"`)

### U Playbook
- Wizard defensivo: 35 pasos, 12 secciones, motor v5, persistencia Supabase (`playbook_plans`)
- Split auth: coach crea/edita/publica, jugadora solo lectura
- Ofensiva y ATOs: placeholders

### U Scout
- Motor v5 + ReportSlidesV1 (3 slides)
- MyScout: canónico por equipo + sandbox colapsable
- Bug: `hasReport` siempre true (mira campos de versión antigua)

---

## Bugs activos

**P1 — bloquean datos correctos:**
- `player/:id`, `leaders`, `games` leen de boxscores — migración PBP pendiente
- Hero card "Mis estadísticas" jugadoras depende de `profile.wcba_external_id` no null

**P2 — datos incorrectos/incompletos:**
- `plusMinus` siempre 0 (B3) — tracking jugadoras en possessions.ts no implementado
- `pointsByZone` split 70/30 inventado (B5) — bloqueado hasta shot coords del Pi
- Game boxscore sin marcador por cuartos
- pace-segments: metodología proxy (no comparable con ORTG)
- `ownTeamName` hardcodeado como "Inner Mongolia" en Stats.tsx

**P2 — UI:**
- Lineups en chino (lineupShortNames usa name_zh si no hay name_en)
- Roster con filas sin nombre (jugadoras sin entrada en stats_players)
- Filtro de equipos en tab Jugadoras innecesario (quitar)
- Módulos desktop en español
- Scout iOS ha perdido la "U" en el icono

---

## Pendientes futuros (por prioridad)

### Bloqueante — arquitectura
1. ~~Auditar datos crudos de la API WCBA~~ ✅
2. ~~Definir arquitectura teórica~~ ✅ — schema supabase-stats-schema.sql ya tiene todo
3. ~~Migrar endpoints player/:id, leaders, games~~ ✅ commit 0f6f67a
4. **Añadir hotspot + periodScores al scraper** — requiere SCP a Pi (en casa)
5. **Calcular plus_minus real** desde pbp_lineup_stats en possessions.ts
6. **Eliminar endpoints huérfanos** players/all-detail y player-link (sin consumidores)
7. **Shot chart UI** — bloqueado hasta que hotspot esté scrapeado y shot_zone relleno

### Operacional urgente
- SCP collector fix (candidatesForPBP) al Pi + pm2 restart
- ~~SSH key Pi~~ ✅ configurada en ~/.ssh/pi_ucore

### Técnico pendiente
- Eliminar endpoints admin sin auth (`/api/stats/admin/...`)
- iOS TestFlight: bundle <300KB (actualmente ~509KB) — lazy i18n + React.lazy
- OverridePanel integration Supabase
- Confirmar motor v2.1 backup estable y mergear

---

## Sesiones anteriores (resumen)

### Sesión 2026-05-27 — Audit API WCBA + shotZones.ts calibrado

**Infraestructura Claude:**
- SSH key configurada para Pi (~/.ssh/pi_ucore). Desde fuera de casa la Pi no es accesible (IP local 192.168.1.7).
- Acceso directo a Supabase y API WCBA via `do shell script` confirmado.
- bash_tool: SOLO para analizar archivos copiados al contenedor Linux. Nunca para red ni Mac.

**Audit completo API WCBA (partido 1106508, Dongguan vs Jiangsu):**

Endpoints y schemas confirmados:
- `/api/v2/game/:id/actions` — PBP. 17 campos. Sin coordenadas. action_code, user_id (playerId), team_id, current_period, start_time (reloj MM:SS), home_score, away_score, direction.
- `/datahub/cbamatch/games/hotspot/hotspotdata?gameId=&teamId=` — Shot coords. 10 campos: playerId, teamType, period, fgTypeStatus (made/missed), pointX, pointY (normalizadas 0-1), isStartLineUp. Sin action_id.
- `/datahub/cbamatch/games/player/playerdata?gameId=` — Boxscore jugadora. 27 campos incluyendo positiveNegativeValue (+/-), isStartLineUp, minutes ("MM:SS"), twoPoints/threePoints/foulShot (formato "X-Y (XX.X%)").
- `/datahub/cbamatch/games/matchinfoscores?matchId=&gameId=` — Info partido. Incluye `periods: ["13","23","27","25"]` (marcador por cuartos).

Verificación hotspot: 142 shots — match exacto con PBP, 0 diferencias por jugadora. No hay action_id → link por (playerId, period, made/missed, orden).

**shotZones.ts creado y verificado (commit de65882):**
- 6 zonas FIBA: restricted_area, paint_non_ra, midrange_baseline, midrange_elbow, three_corner, three_above_break
- Sistema de coordenadas: full court 28×15m, aro Home x=0.0575, Away x=0.9425, espejo solo en X
- bandSide: left/right/center (relativo al ataque, Y<0.45=left)
- collector tsc: exit 0, repo npm run check: exit 0

### Sesión 2026-05-27 (mañana) — Audit, plan de implementación, fixes UI

**Audit real:** Lectura directa de Stats.tsx, stats-api.ts, routes.ts. Confirmado que player/:id, leaders, games todavía leen de boxscores. Identificado que pace-segments usa metodología incompatible con ORTG general.

**Fixes implementados (commit 7db1c29):**
- Stats UI: banner condicional, líderes dinámico, TS%/TOPG en líderes
- Stats UI: quintetos filtro ≥20 posesiones + gamesPlayed
- Stats UI: Coach Dashboard tappable al TeamSheet del rival
- Stats UI: deepTab "deep" — USG%, PIE, FT Rate, AST/TOV, On/Off
- Backend: pace-segments TL en numerador añadido luego revertido (ft_made crea ruido)

**Infraestructura Claude (sesión 2026-05-27 tarde):**
- Confirmado: `do shell script` puede acceder a Supabase (REST API) y API WCBA directamente
- Pi: no hay SSH key — requiere setup manual una vez
- bash_tool: solo para analizar archivos copiados, nunca para red/Mac

### Sesión 2026-05-26 — Stats UI, Playbook Supabase, fix collector
Commits: `d0f2622`, `6640196`

### Sesión 2026-05-25 — possessions v6.2, lineups, iOS safe-area
Commits: `3ee80c3`, `d46a7e4`

### Sesión 2026-05-24 — Action codes completos
Commit: `80a7b88`

### Sesión 2026-05-23 — Blueprint arquitectura PBP
FORMULAS_STATS.md, PBP_EVENTS.md, PBP_STATS_BLUEPRINT.md creados
