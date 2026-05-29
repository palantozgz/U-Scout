# U Core — Contexto para Claude

> Leer este archivo al inicio de cada sesión antes de proponer cualquier cambio.
> Claude SIEMPRE actualiza este archivo al cierre de sesión.
> Claude NUNCA pide a Pablo que edite este archivo manualmente.

---

## Producción
- URL: https://u-scout-production.up.railway.app
- Deploy: Railway, auto-deploy en push a `main`
- DB: Supabase (PostgreSQL)
- **Repo real:** `/Users/palant/Downloads/U scout/ucore/`
- **GitHub:** https://github.com/palantozgz/U-Scout.git
- `/Users/palant/Downloads/U scout/` es wrapper con .env — NO es el repo

## Stack
React + TypeScript + Vite · Express · Drizzle ORM · TanStack Query · shadcn/ui · Tailwind v4
Capacitor 8.x — iOS nativo + Mac Catalyst (Xcode)

---

## Principios de datos — NO NEGOCIABLES

1. **PBP es fuente única de verdad.** Todos los datos de stats provienen de tablas derivadas del PBP.
2. **NUNCA estimar.** Si un dato no sale limpio de `pbp_possessions` (auditado, diff=0), no existe en la app. Sin LAG sobre reloj, sin splits hardcodeados, sin disclaimers de metodología.
3. **`stats_player_boxscores`** — solo `/api/stats/game/:id/boxscore` (auditoría) y `/api/stats/sync-status` (metadata collector).
4. **`stats_standings`** — solo W/L/racha/rank oficial. PPG/OPPG ya migrados a `pbp_possessions`.
5. **Cero referencias ilegítimas a boxscores confirmado** — último audit 2026-05-30.

---

## Herramientas de Claude — CRÍTICO

| Herramienta | Puede | No puede |
|---|---|---|
| `Filesystem:read_text_file` | Leer archivos del Mac | Ejecutar código |
| `Filesystem:edit_file` | Editar archivos del Mac quirúrgicamente | — |
| `filesystem:write_file` | Escribir archivos completos en el Mac | Acceder a red |
| `bash_tool` | Grep/sed/python sobre archivos copiados al contenedor Linux | Acceder al Mac, Pi, APIs |
| `Filesystem:copy_file_user_to_claude` | Copiar archivo del Mac al contenedor para bash_tool | — |
| `Control your Mac:osascript` con `do shell script` | curl, git, npm en el Mac | SSH con contraseña interactiva |

**bash_tool NUNCA para red, Mac, ni Pi.** Solo para analizar archivos ya copiados.

### Acceso a Supabase
Credenciales en `/Users/palant/Downloads/U scout/.env`. Patrón:
```
do shell script "curl -s --max-time 15 'https://ybpzvkkxcmwwxrrouyhm.supabase.co/rest/v1/TABLA?select=CAMPOS&limit=N' -H 'apikey: SK' -H 'Authorization: Bearer SK'"
```
Service key funciona directamente. Anon key bloqueada por RLS.

### Acceso a API WCBA
```
do shell script "curl -s 'https://www.cba.net.cn/datahub/cbamatch/games/ENDPOINT?PARAMS' -H 'Referer: https://www.cba.net.cn/' -H 'User-Agent: Mozilla/5.0...' -H 'Accept: application/json'"
```
Endpoints: `phasemenus`, `matchmenusschedule`, `matchschedules`, `matchinfoscores`, `pbpinfo`, `hotspot/hotspotdata`, `player/playerdata`.

### Acceso a Pi
- IP: `192.168.1.7` · usuario: `pablo` · contraseña: `skapol`
- SSH key: `~/.ssh/pi_ucore` ✅
- `do shell script "ssh -i ~/.ssh/pi_ucore pablo@192.168.1.7 'COMANDO'"` funciona desde casa
- Desde fuera de casa: Pi no accesible (IP local)

---

## Arquitectura de datos

```
API WCBA → collector (Pi)
  → stats_pbp            (PBP crudo)
  → stats_player_boxscores  (SOLO auditoría)
  → stats_standings         (SOLO W/L/rank oficial)

stats_pbp → possessions.ts v6.2 (Railway)
  → pbp_possessions         (1 fila/posesión) — fuente principal equipo
  → pbp_player_game_stats   (1 fila/jugadora/partido) — fuente principal jugadora
  → pbp_lineup_stats        (1 fila/quinteto/partido)
  → pbp_audit_log           (diff vs boxscore — debe ser 0)
```

### Audit estado — 2026-05-30
- 446 ok, 2 error (partido 1106673 — boxscore pendiente sync), max_diff=0
- `plus_minus` real calculado en possessions.ts, 224 partidos reprocesados, top +55

### Campos clave tablas derivadas

**`pbp_possessions`:** `game_id, team_id, season_id, points, is_transition, is_early_offense, is_halfcourt, duration_sec, turnovers, shot_attempts, lineup_id, start_type, end_type, quarter, score_margin_start`

**`pbp_player_game_stats`:** `player_external_id, team_id, game_id, season_id, pts, reb, ast, stl, blk, tov, fgm, fga, fg3m, fg3a, ftm, fta, off_reb, def_reb, fouls, plus_minus, seconds_played, is_starter`

**`pbp_lineup_stats`:** `lineup_id, team_id, game_id, season_id, off_possessions, def_possessions, off_pts, def_pts, off_reb, def_reb, tov, stl, total_seconds, games_played`

---

## Collector (Pi)

- Código activo: commit `80a7b88`
- **Fix pendiente SCP:** commits `d0f2622` + `de65882` (candidatesForPBP status=3, shotZones.ts)
- TOTLTO/TOTSTO/TNOSTL → `'unknown'` (administrativos, únicos válidos)

---

## Procesador de posesiones v6.2

Verificado contra partido real 1108582: HOME 65pts diff=0, AWAY 74pts diff=0.
`plus_minus` calculado en `closePoss()`: +possPts al quinteto atacante, −possPts al defensor.

---

## Endpoints de stats — estado actual

| Endpoint | Fuente | Estado |
|---|---|---|
| `/api/stats/players` | `pbp_player_game_stats` | ✅ |
| `/api/stats/player/:id` | `pbp_player_game_stats` | ✅ |
| `/api/stats/games` | `pbp_player_game_stats` | ✅ |
| `/api/stats/leaders` | `pbp_player_game_stats` | ✅ |
| `/api/stats/standings` | `stats_standings` (W/L/rank) + `pbp_possessions` (ppg/oppg) + `pbp_player_game_stats` (eFG%) | ✅ |
| `/api/stats/team/:id` | `pbp_possessions` + `pbp_player_game_stats` + `stats_standings` (W/L solo) | ✅ |
| `/api/stats/team/:id/pace-segments` | `pbp_possessions` (is_transition/early/halfcourt) | ✅ |
| `/api/stats/team/:id/lineups` | `pbp_lineup_stats` | ✅ |
| `/api/stats/team/:id/on-off/:id` | `pbp_lineup_stats` | ✅ |
| `/api/stats/league-averages` | `pbp_player_game_stats` + `pbp_possessions` | ✅ |
| `/api/stats/player-percentiles` | `pbp_player_game_stats` | ✅ |
| `/api/stats/game/:id/boxscore` | `stats_player_boxscores` | ✅ único uso legítimo |
| `/api/stats/sync-status` | `stats_player_boxscores` (metadata) | ✅ legítimo |

---

## Bugs activos

**P1:**
- Hero card "Mis estadísticas" jugadoras — depende de `profile.wcba_external_id` no null

**P2:**
- `pointsByZone` split 70/30 (B5) — bloqueado hasta hotspot scrapeado en Pi
- Game boxscore sin marcador por cuartos — pendiente añadir periodScores al collector
- `ownTeamName` hardcodeado como `OWN_TEAM_NAME_FALLBACK = "Inner Mongolia"` en Stats.tsx
- `hasReport` en MyScout siempre true (campos de versión antigua)

**UI menor:**
- Módulos desktop en español
- Scout iOS ha perdido la "U" en el icono

---

## Pendientes futuros

1. **SCP collector al Pi** (en casa) — activa hotspot sync + candidatesForPBP fix
2. **Shot chart UI** — bloqueado hasta hotspot scrapeado
3. **Marcador por cuartos** — añadir periodScores al collector + UI
4. **iOS TestFlight** — bundle <300KB (actualmente ~509KB): lazy i18n + React.lazy
5. Eliminar endpoints admin sin auth (`/api/stats/admin/...`)
6. OverridePanel integration Supabase
7. Confirmar `backup/motor-v2.1-pre-20260405` estable y mergear

---

## Estándares de trabajo

1. Leer código real antes de proponer — nunca especular
2. Diagnose before implement — verificar causa raíz antes de escribir código
3. npm run check exit 0 antes de cada commit
4. Cursor para `routes.ts` — nunca `edit_file` directo en ese archivo
5. SQL destructivo — solo Supabase SQL Editor, nunca `drizzle-kit push`
6. NUNCA tocar `Profile.tsx`, `schema.ts`, `migrations/`

### Entrega de código
- NUNCA "añade estas líneas aquí"
- Siempre: archivo completo, comando terminal, o prompt Cursor completo
- Nunca mezclar métodos

---

## Archivos clave
- `server/routes.ts` — 3900+ líneas, leer en chunks con bash_tool
- `server/possessions.ts` — procesador PBP v6.2
- `collector/src/sync/pbp.ts` — parser PBP + hotspot integration
- `collector/src/sync/shotZones.ts` — clasificación 6 zonas FIBA (calibrado 2026-05-27)
- `client/src/lib/stats-api.ts` — hooks TanStack Query
- `client/src/pages/core/Stats.tsx` — U Stats UI, 4500+ líneas
- `client/src/lib/defensive-system.ts` — motor v5

---

## Playbook

- Tabla: `playbook_plans` (Supabase)
- Visibility: `draft` → `staff` → `players`
- Wizard defensivo: 35 pasos, motor v5, persistencia Supabase ✅
- Ofensiva y ATOs: placeholders

---

## Sesiones anteriores (resumen)

### Sesión 2026-05-30 — Audit y fix completo de fórmulas y fuentes

**Audit fórmulas:** 24 fórmulas auditadas, todas correctas matemáticamente.

**Bug crítico encontrado y resuelto:** `avgPpg` en `league-averages` era `AVG(pgs.pts)` sobre filas individuales de jugadoras (~8.1 pts) en lugar de media por equipo/partido (~75 pts). Fix: subquery agrupada por `team_id + game_id`. Commit `3d9824c`.

**ppg/oppg migrados de standings a PBP:** standings y team/:id ya no usan `stats_standings.pts_per_game`. Calculan desde `pbp_possessions` directamente. Commit `3d9824c`.

**DRTG liga simplificado:** eliminada query separada redundante. `lgDrtg = lgOrtg` por definición matemática.

**pace-segments reescrito desde cero:** elimina 300 líneas de SQL con LAG sobre reloj. Usa `pbp_possessions.is_transition / is_early_offense / is_halfcourt`. Sublabels `≤8s / 8-14s / >14s` eliminados. Disclaimers eliminados. Commit `9b947f9`.

**UI:** Coach Dashboard expandido por defecto para coaches. Filtro de equipos eliminado de tab Jugadoras. Roster filtra filas sin nombre. Lineups con name_en prioritario.

**plus_minus real:** implementado en `closePoss()`. 224 partidos reprocesados, top +55. Commit `62bdc84`.

**Cero referencias ilegítimas a boxscores** confirmado tras audit exhaustivo.

### Sesión 2026-05-27 — Infraestructura Claude, audit API WCBA, shotZones
- SSH key Pi configurada, acceso directo Supabase y API WCBA confirmado
- shotZones.ts calibrado (6 zonas FIBA, coordenadas verificadas)
- Migración player/:id, leaders, games a pbp_player_game_stats

### Sesión 2026-05-26 — Stats UI, Playbook Supabase, fix collector
Commits: `d0f2622`, `6640196`

### Sesión 2026-05-25 — possessions v6.2, lineups, iOS safe-area
Commits: `3ee80c3`, `d46a7e4`
