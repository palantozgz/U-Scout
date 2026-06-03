# U Core — Contexto para Claude

> Leer este archivo al inicio de cada sesión antes de proponer cualquier cambio.
> Claude SIEMPRE actualiza este archivo al cierre de sesión.

---

## Producción
- URL: https://u-scout-production.up.railway.app
- Deploy: Railway, auto-deploy en push a `main`
- DB: Supabase (PostgreSQL)
- **Repo:** `/Users/palant/Downloads/U scout/ucore/`
- **GitHub:** https://github.com/palantozgz/U-Scout.git

## Stack
React + TypeScript + Vite · Express · Drizzle ORM · TanStack Query · shadcn/ui · Tailwind v4 · Capacitor 8.x

---

## Metodología de herramientas

| Tipo de tarea | Herramienta |
|---|---|
| Leer archivo Mac | `Filesystem:read_text_file` |
| Escribir archivo completo | `filesystem:write_file` |
| Edición quirúrgica (sin backticks SQL) | `Filesystem:edit_file` |
| Cualquier cambio en `routes.ts` | **Cursor — prompt completo** |
| Analizar archivo grande | `Filesystem:copy_file_user_to_claude` + bash_tool |
| Queries Supabase | `Control your Mac:osascript` + curl |
| Comandos Mac | `Control your Mac:osascript` + Terminal do script |
| SSH Pi | `expect` + ssh pablo@192.168.1.7 (password: skapol) |

### Credenciales
```
SUPA_URL = https://ybpzvkkxcmwwxrrouyhm.supabase.co
SK       = grep SUPABASE_SERVICE_ROLE_KEY /Users/palant/Downloads/U\ scout/.env | cut -d= -f2
Pi       = 192.168.1.7  pablo  skapol
```

### Pi
- Watchdog daemon activo (systemd) + dtparam en config.txt
- SSD /dev/sda2, 117GB. Collector commit d51e98f.

---

## Principios de datos

1. PBP es fuente única de verdad
2. NUNCA estimar. Sin hardcodes
3. `team_id` en tablas derivadas = SIEMPRE internal id (1-18)
4. `stats_pbp.team_id` = external_id. En audit usar `tid` (internal)

---

## Arquitectura

```
API WCBA → collector Pi → stats_pbp → possessions.ts v6.6 (Railway) → tablas derivadas
```

### possessions.ts v6.6 — estado actual
- v6.3: extToInt bidireccional
- v6.4: offFg3m/Fga/Fta en LineupStats; fix audit tid
- v6.5: skip playerExternalId null/'null'/inválido
- v6.6: `phase_type` ('regular'|'playoff') en las 3 tablas derivadas
  - `PLAYOFF_PHASES = {27743, 27747, 27753, 27757}`
  - Lee `phase_id` de `stats_games` al inicio de `processPossessions`

### Columnas añadidas a tablas derivadas (SQL ya ejecutado)
```sql
-- pbp_lineup_stats:
off_fg3m integer NOT NULL DEFAULT 0
off_fga  integer NOT NULL DEFAULT 0
off_fta  integer NOT NULL DEFAULT 0
phase_type text NOT NULL DEFAULT 'regular'

-- pbp_possessions:
phase_type text NOT NULL DEFAULT 'regular'

-- pbp_player_game_stats:
phase_type text NOT NULL DEFAULT 'regular'
```

### Fases WCBA temporada 2092
```
27172 → 132 partidos → Grupo A (liga regular)
27206 →  60 partidos → Grupo B (liga regular)
27743 →   9 partidos → Playoff (cuartos)
27747 →  14 partidos → Playoff
27753 →   4 partidos → Playoff
27757 →   5 partidos → Final
```

---

## Estado DB — 2026-06-03 ✅

- `pbp_audit_log`: ok=444, error=2 (partido 286 — boxscore vacío, no es bug)
- `pbp_possessions`: ~43k regular + ~5k playoff ✅
- `pbp_player_game_stats`: poblado ✅
- `pbp_lineup_stats`: ~6k filas ✅
- Partido 286: boxscore vacío → se resolverá en próximo sync Pi
- **Verificado:** partido regular → `phase_type='regular'` ✅, partido playoff (id=350) → `phase_type='playoff'` ✅

---

## Endpoints de stats

| Endpoint | Fuente | phase_type |
|---|---|---|
| `/api/stats/players` | `pbp_player_game_stats` | ✅ filtra |
| `/api/stats/games` | `pbp_player_game_stats` | ✅ filtra |
| `/api/stats/standings` | `stats_standings` + `pbp_possessions` | ✅ filtra poss; W/L sin filtro |
| `/api/stats/leaders` | `pbp_player_game_stats` | ✅ filtra |
| `/api/stats/player/:id` | `pbp_player_game_stats` | ✅ filtra |
| `/api/stats/team/:id` | `pbp_possessions` + `pbp_player_game_stats` | ✅ filtra |
| `/api/stats/team/:id/pace-segments` | `pbp_possessions` | ✅ filtra |
| `/api/stats/league-averages` | ambas | ✅ filtra |
| `/api/stats/player-percentiles` | `pbp_player_game_stats` | ✅ filtra |
| `/api/stats/team/:id/lineups` | `pbp_lineup_stats` | ✅ filtra |

### UI: toggle phase_type
- Estado en `Stats.tsx`: `phaseType` ('regular'|'playoff') persistido en `localStorage('stats-phase-type')`
- Toggle "Liga Regular / Playoff" junto al selector de temporada
- Propagado a: todos los hooks, prefetch, StatsDesktopPanel, StatsPlayerSheet, StatsTeamSheet
- `StatsPhaseType` type + `statsPhaseQs` helper en `stats-api.ts`

---

## Bugs activos

**P1:**
- Hero card "Mis estadísticas" jugadoras — depende de `profile.wcba_external_id` no null

**P2:**
- `pointsByZone` 70/30 hardcodeado — pendiente shot_x/y/zone
- Partido 286 audit error — boxscore vacío

---

## Pendientes próxima sesión

1. **Verificar UI** — abrir app y comprobar toggle Liga Regular/Playoff funciona, datos cambian
2. **T4 shot chart** — `SELECT shot_zone, COUNT(*) FROM stats_pbp WHERE shot_zone IS NOT NULL GROUP BY shot_zone` — si hay datos, implementar
3. **Hero card jugadoras** — verificar `profile.wcba_external_id` en Supabase
4. **T5 bundle iOS** — sesión dedicada; leer `client/src/lib/i18n.ts` primero
5. **Pi como procesador** — arquitectura futura para eliminar dependencia de Railway en reprocesados

---

## Scripts de mantenimiento

| Script | Uso |
|---|---|
| `scripts/fast_reprocess.py [--reset]` | **Canónico.** Paralelo x6, espera Supabase. ~15min total. |
| `scripts/monitor_game.py` | Diagnóstico: borra partido 2, reprocesa, monitoriza. |
| `scripts/seq_reprocess.py` | ❌ NO usar — timeout Railway |
| `scripts/sync_reprocess.py` | ❌ NO usar — timeout Railway |

### Cómo hacer el reprocesado correctamente
```bash
# 1. Lanzar (tablas ya vacías o con --reset):
cd '/Users/palant/Downloads/U scout/ucore' && python3 -u scripts/fast_reprocess.py --reset 2>&1 | tee /tmp/reprocess.log

# 2. Esperar ~15min — Railway procesa en background
# 3. Verificar:
# audit ok=448, max_diff=0
# pbp_possessions con phase_type='playoff' > 0
```

---

## Estándares de código

1. Leer código real antes de proponer
2. `npm run check` exit 0 antes de cada commit
3. Cursor para `routes.ts`
4. SQL destructivo — solo Supabase SQL Editor
5. NUNCA tocar `Profile.tsx`, `schema.ts`, `migrations/`
6. Tras Cursor: `grep -n 'app.get.*api/stats' server/routes.ts` para detectar duplicados

---

## Archivos clave
- `server/routes.ts` — endpoints API
- `server/possessions.ts` — procesador PBP v6.6
- `client/src/lib/stats-api.ts` — hooks (StatsPhaseType, statsPhaseQs)
- `client/src/pages/core/Stats.tsx` — UI stats (toggle phaseType)
- `scripts/fast_reprocess.py` — reprocesado canónico

## NUNCA tocar
- `Profile.tsx` · `schema.ts` · `migrations/`

---

## Lecciones aprendidas

1. `String(null) = 'null'` — filtrar siempre playerExternalId antes de INSERT integer
2. Railway procesa en background — esperar Supabase, no el HTTP response
3. `fast_reprocess.py` paralelo x6 es correcto; seq/sync dan timeout
4. Inventario: 1 query a `stats_games`, no paginar `stats_pbp`
5. `phase_type` se determina en Railway al procesar — no en el Pi ni en el collector
6. El endpoint `process-game-sync` tiene timeout en Railway (>30s) — no usar para diagnóstico

---

## Sesiones anteriores

### Sesión 2026-06-03 — phase_type, reprocesado completo, fix lineup INSERT
- possessions v6.5: skip playerExternalId='null'
- possessions v6.6: phase_type regular/playoff
- SQL columnas añadidas (off_fg3m/fga/fta, phase_type)
- Reprocesado: 444 ok, 2 error (partido 286)
- Toggle UI Liga Regular/Playoff implementado (Cursor)
- Commits: feat possessions v6.6 + feat phase_type UI

### Sesión 2026-06-02 — possessions v6.3-v6.5, T1+T2+T3, watchdog Pi
- fix audit tid vs extId
- T1 (locale lineups), T2 (hasReport), T3A+B+C (eFG%/TOV%)
- Watchdog Pi instalado

### Sesión 2026-05-31 — possessions v6.3
### Sesión 2026-05-30 — audit fórmulas, migración endpoints
### Sesión 2026-05-27 — shotZones, infraestructura
