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

## Metodología de herramientas — LEER ANTES DE CADA SESIÓN

Claude gestiona todo directamente. Solo usa prompts de Cursor para `routes.ts`.

| Tipo de tarea | Herramienta |
|---|---|
| Leer archivo del Mac | `Filesystem:read_text_file` (head/tail para archivos grandes) |
| Escribir archivo completo en Mac | `filesystem:write_file` |
| Edición quirúrgica (1-3 bloques, sin backticks en SQL) | `Filesystem:edit_file` |
| Cualquier cambio en `routes.ts` | **Cursor — prompt completo** |
| Analizar archivo grande | `Filesystem:copy_file_user_to_claude` + bash_tool grep/sed |
| Queries a Supabase | `Control your Mac:osascript` + curl |
| Comandos en Mac (git, npm, python) | `Control your Mac:osascript` + Terminal |
| Comandos en Pi | `expect` + ssh (password: skapol) — sshpass NO instalado |
| Copiar archivos al Pi | osascript + scp |
| Monitorizar Railway sin logs | `scripts/monitor_game.py` |

### Credenciales
```
SUPA_URL = https://ybpzvkkxcmwwxrrouyhm.supabase.co
SK       = grep SUPABASE_SERVICE_ROLE_KEY /Users/palant/Downloads/U\ scout/.env | cut -d= -f2
Pi IP    = 192.168.1.7  usuario=pablo  password=skapol
```

### Pi — watchdog instalado (sesión 2026-06-02)
- `watchdog` daemon activo (systemd enabled+active)
- `dtparam=watchdog=on` en `/boot/firmware/config.txt` — activa watchdog hardware en próximo reboot
- Causa del cuelgue anterior: desconocida (no OOM, no temperatura, no I/O). Watchdog cubre reincidencias.
- SSD externo USB (no SD card) — `/dev/sda2 / ext4`, 117GB, 5.2GB usados

---

## Principios de datos — NO NEGOCIABLES

1. PBP es fuente única de verdad.
2. NUNCA estimar. Sin hardcodes.
3. `stats_player_boxscores` — solo `/api/stats/game/:id/boxscore`.
4. `stats_standings` — solo W/L/racha/rank oficial.
5. **team_id en tablas derivadas es SIEMPRE internal id** (stats_teams.id, entero 1-18).

### Regla crítica: team_id interno vs externo
- `stats_pbp.team_id` = external_id (API WCBA, ej: 723)
- `pbp_possessions.team_id` = internal id
- `pbp_player_game_stats.team_id` = internal id
- `pbp_lineup_stats.team_id` = internal id
- En audit: filtrar `p.teamId === tid` (internal), NUNCA `=== extId`

---

## Arquitectura de datos

```
API WCBA → collector (Pi, commit d51e98f) → stats_pbp (team_id = external)
stats_pbp → possessions.ts v6.5 (Railway) → tablas derivadas (team_id = internal)
```

### possessions.ts — historial de cambios
- **v6.3** (ed57280): extToInt bidireccional, comparaciones homeTeamId internal
- **v6.4** (c343b8d): offFg3m/Fga/Fta en LineupStats; fix audit p.teamId===tid
- **v6.5** (pending deploy): skip playerExternalId null/'null'/invalid antes del INSERT player_game_stats; log players skipped

### pbp_lineup_stats — columnas añadidas
```sql
-- Ya ejecutado:
ALTER TABLE pbp_lineup_stats
  ADD COLUMN IF NOT EXISTS off_fg3m integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS off_fga  integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS off_fta  integer NOT NULL DEFAULT 0;
```

---

## ⚠️ Estado DB — 2026-06-02 — PENDIENTE VERIFICACIÓN

**Bug en investigación:** `pbp_player_game_stats` y `pbp_lineup_stats` no se escriben aunque `pbp_possessions` sí.

**Diagnóstico:**
- A t+5s del process-game: poss=56 ✅, players=0 ❌, lineup=0 ❌, audit=0 ❌
- El INSERT falla silenciosamente (fire-and-forget endpoint, sin logs visibles)
- Hipótesis confirmada: `playerExternalId = 'null'` (String(null)) en playerMap → INSERT falla con `invalid input syntax for type integer`
- Fix aplicado en v6.5: `if (!ps.playerExternalId || ps.playerExternalId === 'null' || isNaN(extId) || extId <= 0) skip`
- **Pendiente:** verificar que v6.5 llegó a Railway y que el INSERT ahora funciona

**Al inicio de próxima sesión, verificar:**
```python
# python3 scripts/monitor_game.py  (borra partido 2 y lo reprocesa)
# Debe mostrar: t+Xs: poss=N players=N lineup=N audit=2
```

Si funciona → lanzar `python3 scripts/fast_reprocess.py --reset`

---

## Endpoints de stats

| Endpoint | Fuente | Estado |
|---|---|---|
| `/api/stats/players` | `pbp_player_game_stats` | ⚠️ pendiente reprocesado limpio |
| `/api/stats/player/:id` | `pbp_player_game_stats` | ⚠️ |
| `/api/stats/standings` | `stats_standings` + `pbp_possessions` | ✅ |
| `/api/stats/team/:id` | `pbp_possessions` + `pbp_player_game_stats` | ⚠️ |
| `/api/stats/team/:id/pace-segments` | `pbp_possessions` | ✅ poss ok |
| `/api/stats/team/:id/lineups` | `pbp_lineup_stats` | ⚠️ lineup vacío |
| `/api/stats/league-averages` | `pbp_player_game_stats` + `pbp_possessions` | ⚠️ |
| `/api/stats/game/:id/boxscore` | `stats_player_boxscores` | ✅ |

---

## Bugs activos

**P0:**
- `pbp_player_game_stats` y `pbp_lineup_stats` vacíos — fix en v6.5, pendiente verificación en Railway

**P1:**
- Hero card "Mis estadísticas" jugadoras — depende de `profile.wcba_external_id` no null

**P2:**
- `pointsByZone` 70/30 hardcodeado — bloqueado hasta shot_x/y/zone disponibles

**Resueltos sesión 2026-06-02:**
- ✅ T1+T3C: locale zh/en en lineups, TOV% en tabla quintetos (Cursor aplicado)
- ✅ T2: hasReport en MyScout
- ✅ T3A+B: offFg3m/Fga/Fta en possessions.ts y SQL
- ✅ Bug audit pbp_pts=0 (tid vs extId)
- ✅ fast_reprocess.py canónico (0.5min para 224 partidos)
- ✅ Watchdog Pi instalado
- ✅ Commits: c343b8d, c00a703, 3fb86c3, última v6.5

---

## Scripts de mantenimiento

| Script | Uso |
|---|---|
| `scripts/fast_reprocess.py [--reset]` | Reprocesado completo. Con --reset borra tablas primero. Espera hasta que Supabase confirme. |
| `scripts/monitor_game.py` | Borra partido 2, lo reprocesa, monitoriza tablas cada 10-60s hasta audit=2. Diagnóstico rápido. |

---

## Prompt Cursor pendiente — T1 + T3C (locale lineups + TOV%)

> ⚠️ YA APLICADO por Cursor. No re-aplicar. Verificar que funciona una vez que pbp_lineup_stats tenga datos.

---

## Estándares de código

1. Leer código real antes de proponer
2. `npm run check` exit 0 antes de cada commit
3. Cursor para `routes.ts` — nunca edit_file directo
4. SQL destructivo — solo Supabase SQL Editor o scripts auditados
5. NUNCA tocar `Profile.tsx`, `schema.ts`, `migrations/`
6. Después de Cursor en routes.ts: `grep -n 'app.get.*api/stats' server/routes.ts` para detectar duplicados

---

## Archivos clave
- `server/routes.ts` — endpoints API
- `server/possessions.ts` — procesador PBP v6.5
- `server/stats-ingest.ts` — ingest handler
- `collector/src/sync/pbp.ts` — parser PBP
- `client/src/lib/stats-api.ts` — hooks
- `client/src/pages/core/Stats.tsx` — UI stats
- `client/src/pages/scout/MyScout.tsx` — My Scout coach view
- `scripts/fast_reprocess.py` — reprocesado canónico
- `scripts/monitor_game.py` — diagnóstico partido individual

## Archivos NUNCA tocar
- `Profile.tsx` · `schema.ts` · `migrations/`

---

## Lecciones aprendidas

1. **No usar reprocess_all.py ni reprocess_sync.py** — obsoletos
2. **El endpoint process-game es fire-and-forget** — HTTP 200 ≠ datos en Supabase
3. **String(null) = 'null'** — siempre filtrar playerExternalId antes de INSERT en columna integer
4. **Paginar stats_pbp por game_id cursor** (no por offset) — O(N_partidos) queries en vez de O(N_eventos/1000)
5. **audit pbp_pts=0** = bug de filtro tid vs extId (corregido) o INSERT fallando antes del audit
6. **Railway tarda en deployar** cuando hay múltiples commits en cola — verificar bundle hash antes de probar

---

## Sesiones anteriores

### Sesión 2026-06-02 — Reprocesado, possessions v6.4/v6.5, T1+T2+T3, watchdog Pi
- Bug raíz audit: p.teamId===extId → corregido a ===tid
- Bug player_game_stats/lineup vacíos: String(null)='null' en playerExternalId → fix skip en v6.5
- T3A+B: offFg3m/Fga/Fta en possessions+SQL
- T2: hasReport MyScout arreglado
- T1+T3C: Cursor aplicado (locale + TOV%)
- fast_reprocess.py: 224 partidos en 0.5min
- Watchdog Pi: daemon activo, config.txt actualizado
- Commits: c343b8d, c00a703, 3fb86c3 + commits debug

### Sesión 2026-05-31 — possessions v6.3
- extToInt bidireccional. Commit: ed57280

### Sesión 2026-05-30 — Audit fórmulas, migración endpoints
- Commits: 9b947f9, 3d9824c

### Sesión 2026-05-27 — shotZones, infraestructura
