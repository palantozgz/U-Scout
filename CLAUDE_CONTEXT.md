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
2. **NUNCA estimar.** Sin LAG sobre reloj, sin splits hardcodeados, sin disclaimers.
3. **`stats_player_boxscores`** — solo `/api/stats/game/:id/boxscore` (auditoría) y `/api/stats/sync-status`.
4. **`stats_standings`** — solo W/L/racha/rank oficial.
5. **team_id en tablas derivadas es SIEMPRE el internal id** (stats_teams.id, entero pequeño 1-18). NUNCA el external_id (entero grande >100). Verificar esto en cualquier query que use pbp_possessions.team_id o pbp_player_game_stats.team_id.

### Regla crítica: team_id interno vs externo
`stats_pbp.team_id` = external_id (lo que llega de la API WCBA, ej: 723)
`pbp_possessions.team_id` = internal id (stats_teams.id, ej: 12) — normalizado en possessions.ts
`pbp_player_game_stats.team_id` = internal id — normalizado en possessions.ts
`pbp_lineup_stats.team_id` = internal id — normalizado en possessions.ts

En routes.ts, SIEMPRE comparar con `st.id` (internal), nunca con `st.external_id`.

---

## Herramientas de Claude

| Herramienta | Puede | No puede |
|---|---|---|
| `Filesystem:read_text_file` | Leer archivos del Mac | Ejecutar código |
| `Filesystem:edit_file` | Editar archivos del Mac | — |
| `filesystem:write_file` | Escribir archivos completos en el Mac | Acceder a red |
| `bash_tool` | Grep/sed/python sobre archivos copiados al contenedor Linux | Mac, Pi, APIs |
| `Filesystem:copy_file_user_to_claude` | Copiar archivo del Mac al contenedor | — |
| `Control your Mac:osascript` con `do shell script` | curl, git, npm en el Mac | sudo interactivo |

**bash_tool NUNCA para red, Mac, ni Pi. Solo análisis de archivos copiados.**

### Acceso a Supabase
Credenciales en `/Users/palant/Downloads/U scout/.env`.
`do shell script "curl -s 'SUPA_URL/rest/v1/TABLA?...' -H 'apikey: SK' -H 'Authorization: Bearer SK'"`

### Acceso a Pi
- SSH key: `~/.ssh/pi_ucore` (desde casa, IP 192.168.1.7)
- PM2 startup configurado (pm2-pablo.service en systemd)

---

## Arquitectura de datos

```
API WCBA → collector (Pi) → stats_pbp (team_id = external)
stats_pbp → possessions.ts v6.3 (Railway) → tablas derivadas (team_id = internal)
```

### possessions.ts v6.3 — cambios respecto a v6.2
- `extToInt` ahora incluye `[String(homeTeamId)]: homeTeamId` y `[String(awayTeamId)]: awayTeamId`
- Pasada de normalización sobre `rawEvents`: todos los `ev.team_id` convertidos a internal antes de procesar
- Todas las comparaciones `homeTeamExtId` → `homeTeamId` (5 puntos en el código)
- `getSnap()`: usa `homeTeamId` en lugar de `homeTeamExtId`
- Commit: `ed57280`

### Estado DB — 2026-05-31 (reprocesado en curso)
- `reset_and_reprocess.py` corriendo en Terminal — procesa un partido a la vez, espera confirmación Supabase
- Aproximadamente 220 partidos con PBP real pendientes (~2-3h desde ~12:00)
- Verificación limpieza: `team_ids en muestra = {1: 39, 2: 38}`, PPP=1.078 ✅
- **NO lanzar más scripts de reprocesado mientras este esté activo**

### Script de reprocesado correcto
`scripts/reset_and_reprocess.py` — hace DELETE de todas las tablas derivadas y procesa uno a uno con confirmación. Es el único script válido para reprocesado completo. Los scripts anteriores (`reprocess_all.py`, `reprocess_sync.py`) son obsoletos.

---

## Endpoints de stats — estado

Todos los endpoints usan IDs internos desde commit `0497d2e` + `ed57280`.

| Endpoint | Fuente | Estado |
|---|---|---|
| `/api/stats/players` | `pbp_player_game_stats` | ✅ |
| `/api/stats/player/:id` | `pbp_player_game_stats` | ✅ usa teamIntId |
| `/api/stats/standings` | `stats_standings` (W/L) + `pbp_possessions` (ppg) | ✅ usa st.id |
| `/api/stats/team/:id` | `pbp_possessions` + `pbp_player_game_stats` | ✅ usa teamIntId |
| `/api/stats/team/:id/pace-segments` | `pbp_possessions` | ✅ usa team.id |
| `/api/stats/team/:id/lineups` | `pbp_lineup_stats` | ✅ |
| `/api/stats/league-averages` | `pbp_player_game_stats` + `pbp_possessions` | ✅ |
| `/api/stats/game/:id/boxscore` | `stats_player_boxscores` | ✅ único uso legítimo |

---

## Collector (Pi)

- Código activo: commit `d51e98f` ✅
- PM2 startup systemd habilitado ✅
- Sync nocturno activo — rellenará shot_x/y/zone en próximo ciclo

---

## Bugs activos

**P1:**
- Reprocesado en curso — datos parciales hasta que termine
- Hero card "Mis estadísticas" jugadoras — depende de `profile.wcba_external_id` no null

**P2:**
- `pointsByZone` 70/30 — bloqueado hasta hotspot scrapeado
- Lineup eFG%/TOV%/MIN — pendiente
- `ownTeamName` = "Inner Mongolia" hardcodeado en Stats.tsx
- `hasReport` en MyScout siempre true

---

## Lecciones aprendidas — NO repetir

1. **No reprocesar en producción con datos parciales visibles.** El DELETE borra datos reales antes de que el reprocesado termine. Siempre usar el script síncrono `reset_and_reprocess.py` que espera confirmación.
2. **Verificar team_id antes de deployar cualquier cambio en possessions.ts.** El internal vs external es el bug más costoso del sistema.
3. **No lanzar múltiples scripts de reprocesado en paralelo.** Compiten por los mismos game_ids y se interfieren.
4. **Antes de cualquier cambio en possessions.ts**: verificar con `audit_full.py` el estado de las tablas derivadas.

---

## Estándares

1. Leer código real antes de proponer
2. npm run check exit 0 antes de cada commit
3. Cursor para `routes.ts` cambios grandes — edit_file para cambios quirúrgicos de 1-2 líneas localizadas
4. SQL destructivo — solo Supabase SQL Editor o scripts auditados
5. NUNCA tocar `Profile.tsx`, `schema.ts`, `migrations/`

---

## Archivos clave
- `server/routes.ts` — endpoints API
- `server/possessions.ts` — procesador PBP v6.3
- `server/stats-ingest.ts` — ingest handler
- `collector/src/sync/pbp.ts` — parser PBP
- `collector/src/sync/shotZones.ts` — 6 zonas FIBA calibradas
- `client/src/lib/stats-api.ts` — hooks
- `client/src/pages/core/Stats.tsx` — UI stats
- `scripts/reset_and_reprocess.py` — script de reprocesado limpio
- `scripts/audit_full.py` — verificación de integridad de datos
- `scripts/backfill_quarters.py` — backfill marcadores por cuartos

---

## Sesiones anteriores

### Sesión 2026-05-31 — Bugs team_id, reprocesado, reset limpio

**Causa raíz del problema:** `possessions.ts` normalizaba `ev.team_id` a internal via `extToInt`, pero las comparaciones `possTid === homeTeamExtId` seguían usando el external_id. Resultado: `getSnap()`, `defTid`, `opponentTeamId`, `possMargin` todos calculados incorrectamente. Los lineups y plus_minus estaban invertidos para algunos partidos.

**Fix aplicado (commit ed57280):** Todas las comparaciones cambiadas a `homeTeamId` (internal). `extToInt` bidireccional.

**Consecuencia:** 171 partidos procesados con código roto antes del fix → datos mezclados en Supabase → reset completo necesario.

**Reset:** `scripts/reset_and_reprocess.py` — DELETE de 4 tablas derivadas + reprocesado síncrono. Verificado limpio con PPP=1.078 y solo IDs internos.

### Sesión 2026-05-30 — Audit fórmulas completo
- pace-segments desde pbp_possessions (commit 9b947f9)
- avgPpg liga fix subquery por equipo/partido (commit 3d9824c)
- Todos los endpoints migrados a PBP

### Sesión 2026-05-27 — Infraestructura, shotZones, migración endpoints
