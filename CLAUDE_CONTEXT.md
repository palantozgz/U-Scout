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

## Metodología de herramientas

Claude gestiona todo directamente. Solo usa prompts de Cursor para `routes.ts`.

| Tipo de tarea | Herramienta |
|---|---|
| Leer archivo del Mac | `Filesystem:read_text_file` |
| Escribir archivo completo en Mac | `filesystem:write_file` |
| Edición quirúrgica (sin backticks en SQL) | `Filesystem:edit_file` |
| Cualquier cambio en `routes.ts` | **Cursor — prompt completo** |
| Analizar archivo grande | `Filesystem:copy_file_user_to_claude` + bash_tool |
| Queries a Supabase | `Control your Mac:osascript` + curl |
| Comandos en Mac | `Control your Mac:osascript` + Terminal do script |
| SSH a Pi | `expect` + ssh pablo@192.168.1.7 (password: skapol) |

### Credenciales
```
SUPA_URL = https://ybpzvkkxcmwwxrrouyhm.supabase.co
SK       = grep SUPABASE_SERVICE_ROLE_KEY /Users/palant/Downloads/U\ scout/.env | cut -d= -f2
Pi       = 192.168.1.7  pablo  skapol
```

### Pi — estado
- Watchdog instalado (daemon activo + dtparam en config.txt)
- SSD externo USB /dev/sda2, 117GB
- Collector commit d51e98f activo

---

## Principios de datos

1. PBP es fuente única de verdad
2. NUNCA estimar. Sin hardcodes
3. team_id en tablas derivadas = SIEMPRE internal id (1-18)
4. `stats_pbp.team_id` = external_id. En audit usar `tid` (internal), nunca `extId`

---

## Arquitectura de datos

```
API WCBA → collector Pi → stats_pbp → possessions.ts v6.5 Railway → tablas derivadas
```

### possessions.ts v6.5 — cambios acumulados
- v6.3: extToInt bidireccional
- v6.4: offFg3m/Fga/Fta en LineupStats; fix audit tid
- v6.5: skip playerExternalId null/'null'/inválido; log skipped
- Commit activo en Railway: verificar con monitor_game.py

### Columnas añadidas a pbp_lineup_stats
```sql
off_fg3m integer NOT NULL DEFAULT 0
off_fga  integer NOT NULL DEFAULT 0
off_fta  integer NOT NULL DEFAULT 0
```

---

## Estado DB — 2026-06-03

- `pbp_audit_log`: ok=444, error=2 (partido 286 — boxscore vacío, no es bug del procesador)
- `pbp_possessions`: 43k filas ✅
- `pbp_lineup_stats`: 6k filas ✅
- `pbp_player_game_stats`: pendiente verificar count
- Partido 286: `box_pts=0` porque `stats_player_boxscores` no tiene datos de ese partido. Se resolverá en próximo sync nocturno del Pi (igual que partido 1106673).
- **Reprocesado completo logrado** usando fast_reprocess.py (fire-and-forget paralelo x6, Railway procesa en background)

### Lección reprocesado — IMPORTANTE
- `process-game` endpoint: fire-and-forget, responde 200 antes de procesar
- `process-game-sync` endpoint: TIMEOUT (Railway corta a 30s, procesamiento tarda 40-60s)
- **El enfoque que funciona:** fast_reprocess.py paralelo x6 + esperar 10-15min a que Railway procese en background + verificar audit en Supabase
- Railway NO falla — procesa en background aunque el HTTP response ya llegó
- El problema era String(null)='null' en playerExternalId → corregido en v6.5

---

## Fase architecture: Liga Regular vs Playoffs

### Estructura de fases en stats_games (season_id=2092)
```
phase_id 27172 → 132 partidos → Grupo A (liga regular)
phase_id 27206 →  60 partidos → Grupo B (liga regular)
phase_id 27743 →   9 partidos → Playoff cuartos ida
phase_id 27747 →  14 partidos → Playoff cuartos vuelta / semis
phase_id 27753 →   4 partidos → Playoff semis/final
phase_id 27757 →   5 partidos → Final
```
`stats_games` tiene columna `phase_id` pero NO `phase_name`.

### Plan aprobado: phase_type en tablas derivadas

**SQL a ejecutar en Supabase (pendiente):**
```sql
ALTER TABLE pbp_possessions       ADD COLUMN IF NOT EXISTS phase_type text NOT NULL DEFAULT 'regular';
ALTER TABLE pbp_player_game_stats ADD COLUMN IF NOT EXISTS phase_type text NOT NULL DEFAULT 'regular';
ALTER TABLE pbp_lineup_stats      ADD COLUMN IF NOT EXISTS phase_type text NOT NULL DEFAULT 'regular';
```

**possessions.ts v6.6 (pendiente):**
```typescript
const PLAYOFF_PHASES = new Set([27743, 27747, 27753, 27757]);
// Leer phase_id de stats_games al inicio de processPossessions
const phaseType = PLAYOFF_PHASES.has(gameRow.phase_id) ? 'playoff' : 'regular';
// Incluir en todos los INSERTs
```

**Endpoints: añadir `?phaseType=regular|playoff|all` (default: regular)**

**UI: toggle global `Liga Regular | Playoffs` en Stats**
- Opción A aprobada: toggle global arriba del todo, cambia todas las vistas
- Persiste en localStorage
- Standings: W/L de stats_standings (oficial, siempre liga regular) + métricas calculadas filtradas por phase_type

**Orden de ejecución:**
1. SQL ALTER TABLE (Pablo en Supabase SQL Editor)
2. possessions.ts v6.6 (Claude con edit_file)
3. check + push → Railway deploya
4. fast_reprocess.py --reset
5. routes.ts (Cursor prompt)
6. Stats.tsx toggle (Claude con edit_file)

---

## Endpoints de stats

| Endpoint | Fuente | Estado |
|---|---|---|
| `/api/stats/players` | `pbp_player_game_stats` | ✅ |
| `/api/stats/player/:id` | `pbp_player_game_stats` | ✅ |
| `/api/stats/standings` | `stats_standings` + `pbp_possessions` | ✅ |
| `/api/stats/team/:id` | `pbp_possessions` + `pbp_player_game_stats` | ✅ |
| `/api/stats/team/:id/pace-segments` | `pbp_possessions` | ✅ |
| `/api/stats/team/:id/lineups` | `pbp_lineup_stats` | ✅ |
| `/api/stats/league-averages` | `pbp_player_game_stats` + `pbp_possessions` | ✅ |
| `/api/stats/game/:id/boxscore` | `stats_player_boxscores` | ✅ |

---

## Bugs activos

**P1:**
- Hero card "Mis estadísticas" jugadoras — depende de `profile.wcba_external_id` no null

**P2:**
- `pointsByZone` 70/30 hardcodeado — pendiente shot_x/y/zone
- Partido 286 audit error — boxscore vacío, resolución automática en próximo sync Pi

---

## Pendientes próxima sesión

1. **Phase type** — ejecutar SQL + possessions.ts v6.6 + reprocesado + routes + UI toggle
2. **Verificar lineups UI** — con datos en pbp_lineup_stats, comprobar que TOV% y locale funcionan en prod
3. **T4 shot chart** — verificar `SELECT shot_zone, COUNT(*) FROM stats_pbp WHERE shot_zone IS NOT NULL GROUP BY shot_zone`
4. **T5 bundle** — sesión dedicada

---

## Scripts de mantenimiento

| Script | Uso |
|---|---|
| `scripts/fast_reprocess.py [--reset]` | Reprocesado canónico. Paralelo x6, espera Supabase. |
| `scripts/monitor_game.py` | Diagnóstico: borra partido 2, reprocesa, monitoriza hasta audit=2. |
| `scripts/seq_reprocess.py` | Reprocesado secuencial (NO usar — timeout en Railway). |
| `scripts/sync_reprocess.py` | Reprocesado síncrono (NO usar — timeout en Railway). |

---

## Estándares de código

1. Leer código real antes de proponer
2. `npm run check` exit 0 antes de cada commit
3. Cursor para `routes.ts`
4. SQL destructivo — solo Supabase SQL Editor
5. NUNCA tocar `Profile.tsx`, `schema.ts`, `migrations/`
6. Después de Cursor: `grep -n 'app.get.*api/stats' server/routes.ts` para detectar duplicados

---

## Archivos clave
- `server/routes.ts` — endpoints API
- `server/possessions.ts` — procesador PBP v6.5
- `client/src/lib/stats-api.ts` — hooks
- `client/src/pages/core/Stats.tsx` — UI stats
- `client/src/pages/scout/MyScout.tsx` — My Scout coach view
- `scripts/fast_reprocess.py` — reprocesado canónico

## NUNCA tocar
- `Profile.tsx` · `schema.ts` · `migrations/`

---

## Lecciones aprendidas

1. No usar reprocess_all.py / reprocess_sync.py / seq_reprocess.py — obsoletos o inútiles
2. `String(null) = 'null'` — filtrar siempre playerExternalId antes de INSERT integer
3. Railway procesa en background correctamente — no hace falta esperar HTTP, esperar Supabase
4. fast_reprocess.py paralelo x6 es el approach correcto: rápido y Railway lo aguanta
5. Inventario: 1 query a stats_games, no 224 queries a stats_pbp

---

## Sesiones anteriores

### Sesión 2026-06-03 — Reprocesado completo, phase_type planificado
- fix playerExternalId 'null' → v6.5 funciona (monitor_game.py confirmado)
- Reprocesado: 444 ok, 2 error (partido 286 — boxscore vacío)
- fast_reprocess.py es el script canónico correcto
- seq/sync_reprocess.py descartados por timeout de Railway
- Planificado phase_type (liga regular vs playoffs)

### Sesión 2026-06-02 — possessions v6.4/v6.5, T1+T2+T3, watchdog Pi
- Bug audit tid vs extId corregido
- T1+T2+T3 aplicados
- Watchdog Pi instalado

### Sesión 2026-05-31 — possessions v6.3
### Sesión 2026-05-30 — Audit fórmulas, migración endpoints
### Sesión 2026-05-27 — shotZones, infraestructura
