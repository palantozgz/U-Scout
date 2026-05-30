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

## Stack
React + TypeScript + Vite · Express · Drizzle ORM · TanStack Query · shadcn/ui · Tailwind v4
Capacitor 8.x — iOS nativo + Mac Catalyst (Xcode)

---

## Principios de datos — NO NEGOCIABLES

1. **PBP es fuente única de verdad.** Todos los datos de stats provienen de tablas derivadas del PBP.
2. **NUNCA estimar.** Sin LAG sobre reloj, sin splits hardcodeados, sin disclaimers de metodología.
3. **`stats_player_boxscores`** — solo `/api/stats/game/:id/boxscore` (auditoría) y `/api/stats/sync-status`.
4. **`stats_standings`** — solo W/L/racha/rank oficial.
5. **Cero referencias ilegítimas a boxscores** — confirmado último audit.

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

**bash_tool NUNCA para red, Mac, ni Pi.**

### Acceso a Supabase
Credenciales en `/Users/palant/Downloads/U scout/.env`. Service key funciona directamente.
Patrón: `curl -s 'SUPA_URL/rest/v1/TABLA?...' -H 'apikey: SK' -H 'Authorization: Bearer SK'`

### Acceso a API WCBA
`curl -s 'https://www.cba.net.cn/datahub/cbamatch/games/ENDPOINT?PARAMS' -H 'Referer: https://www.cba.net.cn/' -H 'User-Agent: Mozilla/5.0...'`
Endpoints: `phasemenus`, `matchmenusschedule`, `matchschedules`, `matchinfoscores`, `pbpinfo`, `hotspot/hotspotdata`, `player/playerdata`.

### Acceso a Pi
- IP: `192.168.1.7` · usuario: `pablo` · contraseña: `skapol`
- SSH key: `~/.ssh/pi_ucore` ✅ (desde casa)
- `do shell script "ssh -i ~/.ssh/pi_ucore pablo@192.168.1.7 'COMANDO'"`
- Código activo en Pi: commit `80a7b88` — **pendiente SCP a commit `d51e98f`**

---

## Arquitectura de datos

```
API WCBA → collector (Pi) → stats_pbp / stats_player_boxscores / stats_standings
stats_pbp → possessions.ts v6.2 (Railway) → pbp_possessions / pbp_player_game_stats / pbp_lineup_stats / pbp_audit_log
```

### Campos clave

**`pbp_possessions`:** `game_id, team_id, season_id, points, is_transition, is_early_offense, is_halfcourt, duration_sec, turnovers, shot_attempts, lineup_id, quarter`
- Flags: `is_transition` (dur≤8s), `is_early_offense` (8-14s), `is_halfcourt` (>14s)
- `team_id` = internal id (fix aplicado en v6.2, reprocesado en curso)

**`pbp_player_game_stats`:** `player_external_id, team_id, game_id, season_id, pts, reb, ast, stl, blk, tov, fgm, fga, fg3m, fg3a, ftm, fta, off_reb, def_reb, fouls, plus_minus, seconds_played, is_starter`

**`pbp_lineup_stats`:** `lineup_id, team_id, game_id, season_id, off_possessions, def_possessions, off_pts, def_pts, off_reb, def_reb, tov, stl, total_seconds, games_played`

**`stats_games`:** columnas `home_q1..q4` / `away_q1..q4` — pobladads vía backfill (224 partidos). Nuevos partidos: `handleBoxscores` + `period_scores` ingest.

### Audit estado — 2026-05-31
- Reprocesado en curso tras fix team_id en possessions.ts
- Marcador por cuartos: 223/224 partidos backfilleados (1 completado hoy por script)
- plus_minus real confirmado (top +55)

---

## Collector (Pi) — estado

- Código activo en Pi: commit `80a7b88` — DESACTUALIZADO
- **Pendiente SCP urgente (commit `d51e98f`):**
  - `collector/src/sync/pbp.ts` — hotspot fix, period_scores, syncNewPBP con matchId
  - `collector/src/sync/shotZones.ts` — clasificación zonas FIBA calibrada
  - `collector/src/index.ts` — candidatesForPBP status=3 + matchId en syncNewPBP
  - `collector/src/ingest.ts` — IngestType añade 'period_scores'
- **SCP comando:**
  ```
  scp -i ~/.ssh/pi_ucore \
    'collector/src/sync/pbp.ts' \
    'collector/src/sync/shotZones.ts' \
    'collector/src/ingest.ts' \
    pablo@192.168.1.7:/home/pablo/ucore/collector/src/sync/
  scp -i ~/.ssh/pi_ucore \
    'collector/src/index.ts' \
    'collector/src/ingest.ts' \
    pablo@192.168.1.7:/home/pablo/ucore/collector/src/
  ```
  Luego en Pi: `cd /home/pablo/ucore/collector && npm run build && pm2 restart ucore-collector`

---

## Endpoints de stats — estado

| Endpoint | Fuente | Estado |
|---|---|---|
| `/api/stats/players` | `pbp_player_game_stats` | ✅ |
| `/api/stats/player/:id` | `pbp_player_game_stats` | ✅ |
| `/api/stats/games` | `pbp_player_game_stats` | ✅ |
| `/api/stats/leaders` | `pbp_player_game_stats` | ✅ |
| `/api/stats/standings` | `stats_standings` (W/L) + `pbp_possessions` (ppg/oppg) + `pbp_player_game_stats` (eFG%) | ✅ |
| `/api/stats/team/:id` | `pbp_possessions` + `pbp_player_game_stats` + `stats_standings` (W/L solo) | ✅ |
| `/api/stats/team/:id/pace-segments` | `pbp_possessions` (is_transition/early/halfcourt) | ✅ |
| `/api/stats/team/:id/lineups` | `pbp_lineup_stats` | ✅ |
| `/api/stats/team/:id/on-off/:id` | `pbp_lineup_stats` | ✅ |
| `/api/stats/league-averages` | `pbp_player_game_stats` + `pbp_possessions` | ✅ |
| `/api/stats/player-percentiles` | `pbp_player_game_stats` | ✅ |
| `/api/stats/game/:id/boxscore` | `stats_player_boxscores` + `stats_games` (q1..q4) | ✅ único uso legítimo |

---

## Bugs activos

**P1:**
- Hero card "Mis estadísticas" jugadoras — depende de `profile.wcba_external_id` no null

**P2 — pendientes:**
- `pointsByZone` split 70/30 (B5) — bloqueado hasta hotspot scrapeado en Pi (SCP pendiente)
- `ownTeamName` hardcodeado como `OWN_TEAM_NAME_FALLBACK = "Inner Mongolia"` en Stats.tsx
- `hasReport` en MyScout siempre true (campos de versión antigua)
- Jugadoras sin nombre en lineups (IDs numéricos) — fix UI aplicado (`#XXXX`), fix real: roster sync en Pi
- Lineup eFG%/TOV%/MIN — pendiente añadir al endpoint y UI (referencia Synergy: mín 40 poss)

**UI menor:**
- Módulos desktop en español
- Scout iOS ha perdido la "U" en el icono
- Playbook: Ofensiva y ATOs son placeholders

---

## Pendientes futuros

1. **SCP collector al Pi** (urgente) — activa hotspot sync (shot coords) + period_scores
2. **Reprocesado en curso** — 224 partidos con fix team_id (script reprocess_all.py)
3. **Shot chart UI** — endpoint y UI pendientes; datos en `stats_pbp.shot_x/y/zone` cuando Pi sync
4. **Lineups mejorados** — añadir eFG%, TOV%, MIN al endpoint + UI (referencia: Synergy 40 poss mínimo)
5. **iOS TestFlight** — bundle <300KB (actualmente ~509KB): lazy i18n + React.lazy
6. Eliminar endpoints admin sin auth (`/api/stats/admin/...`)
7. OverridePanel integration Supabase
8. Confirmar `backup/motor-v2.1-pre-20260405` estable y mergear

---

## Estándares de trabajo

1. Leer código real antes de proponer — nunca especular
2. Diagnose before implement
3. npm run check exit 0 antes de cada commit
4. Cursor para `routes.ts` — nunca `edit_file` directo en ese archivo (excepción: edits quirúrgicos de 1-2 líneas ya localizadas)
5. SQL destructivo — solo Supabase SQL Editor
6. NUNCA tocar `Profile.tsx`, `schema.ts`, `migrations/`

### Entrega de código
- NUNCA "añade estas líneas aquí"
- Siempre: archivo completo, comando terminal, o prompt Cursor completo

---

## Archivos clave
- `server/routes.ts` — 3900+ líneas
- `server/possessions.ts` — procesador PBP v6.2
- `server/stats-ingest.ts` — ingest handler
- `collector/src/sync/pbp.ts` — parser PBP + hotspot + period_scores
- `collector/src/sync/shotZones.ts` — clasificación 6 zonas FIBA (calibrado 2026-05-27)
- `client/src/lib/stats-api.ts` — hooks TanStack Query
- `client/src/pages/core/Stats.tsx` — U Stats UI, 4500+ líneas

---

## Sesiones anteriores (resumen)

### Sesión 2026-05-31 — Bugs UI, cuartos, team_id fix, SCP

**Bugs corregidos:**
- `team_id` inconsistente en `pbp_player_game_stats` (mix internal/external) — fix en `possessions.ts`:
  extToInt ahora incluye `[String(homeTeamId)]: homeTeamId` + pasada de normalización en rawEvents.
  Reprocesado lanzado (script reprocess_all.py).
- `lineupShortNames` con IDs numéricos mostraba número completo — ahora muestra `#XXXX` (últimos 4 dígitos)
- Marcador por cuartos: `handlePeriodScores` añadido a stats-ingest, endpoint boxscore devuelve q1..q4,
  UI renderiza "Q1 X–Y · Q2 X–Y · Q3 X–Y · Q4 X–Y" si hay datos. Backfill 223/224 partidos completado.
- Collector `syncNewPBP` ahora acepta `{gameId, matchId}[]` para period_scores correctos.
- `IngestType` añade `'period_scores'`.

**SCP pendiente:** commit `d51e98f` al Pi — no se completó (SSH Pi cortado temporalmente).

**Investigación lineups:** Synergy usa 40 poss mínimo, columnas estándar: G/MIN/POSS/ORTG/DRTG/NET/eFG%/TOV%.
Faltan en U Stats: MIN (total_seconds disponible), eFG%, TOV%, % tiempo equipo.

### Sesión 2026-05-30 — Audit y fix completo de fórmulas y fuentes
- pace-segments desde pbp_possessions (commit 9b947f9)
- avgPpg liga era ~8.1 → fix subquery por equipo/partido (commit 3d9824c)
- ppg/oppg standings y team/:id desde pbp_possessions
- DRTG liga = ORTG por definición matemática

### Sesión 2026-05-27 — Infraestructura Claude, audit API WCBA, shotZones
- SSH key Pi, acceso Supabase/WCBA directo
- shotZones.ts calibrado (6 zonas FIBA)
- Migración player/:id, leaders, games a pbp_player_game_stats
