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

### possessions.ts v6.6
- v6.3: extToInt bidireccional
- v6.4: offFg3m/Fga/Fta en LineupStats; fix audit tid
- v6.5: skip playerExternalId null/'null'/inválido
- v6.6: `phase_type` ('regular'|'playoff') en las 3 tablas derivadas
  - `PLAYOFF_PHASES = {27743, 27747, 27753, 27757}`

### Columnas en tablas derivadas (SQL ya ejecutado)
```sql
pbp_lineup_stats:      off_fg3m, off_fga, off_fta  integer DEFAULT 0
pbp_possessions:       phase_type text DEFAULT 'regular'
pbp_player_game_stats: phase_type text DEFAULT 'regular'
pbp_lineup_stats:      phase_type text DEFAULT 'regular'
```

### Fases WCBA temporada 2092
```
27172 → 132 partidos → Grupo A (liga regular)
27206 →  60 partidos → Grupo B (liga regular)
27743/27747/27753/27757 → 32 partidos → Playoffs
```

---

## Estado DB — 2026-06-03 ✅

- `pbp_audit_log`: ok=444, error=2 (partido 286 — boxscore vacío, no es bug)
- `pbp_possessions`: ~43k regular + ~5k playoff ✅
- `pbp_player_game_stats`: poblado ✅
- `pbp_lineup_stats`: ~6k filas ✅
- Partido 286: boxscore vacío → resolución automática en próximo sync Pi

---

## UI Stats — arquitectura actual

### PhaseToggle
- Componente reutilizable: Liga | Playoff | Todo (`regular` | `playoff` | `all`)
- **Sitio A:** encima de la lista en tab Jugadoras
- **Sitio B:** dentro de StatsTeamSheet, antes de las tabs ficha/avanzado/etc.
- Estado persistido en `localStorage('stats-phase-type')`, acepta 'all'
- **NO está en la barra superior global** (solo queda el selector de temporada ahí)

### Columna central dinámica en desktop (centerView)
| Estado | Columna central |
|---|---|
| Jugadora desde equipo (`returnToTeamId`) | Roster compacto + ← + PhaseToggle |
| Jugadora desde lista | Lista jugadoras con fila activa resaltada |
| Equipo abierto | Clasificación sola (sin tabs) |
| Por defecto | Tabs actuales (Clasificación / Jugadoras) |

- `CompactRosterList`: #, nombre, PPG, RPG. Tap → cambia jugadora activa en panel derecho.
- `useTeamDetail(returnToTeamId, …)` para el roster central (TanStack cachea, no duplica fetch).

---

## Endpoints de stats

Todos aceptan `?phaseType=regular|playoff|all` (default: `regular`).
W/L en standings siempre de `stats_standings` sin filtro.
`app.get.*lineups` → 1 resultado (línea 2927).

---

## Bugs activos

**P1:**
- Hero card "Mis estadísticas" jugadoras — depende de `profile.wcba_external_id` no null

**P2:**
- `pointsByZone` 70/30 hardcodeado — pendiente shot_x/y/zone
- Partido 286 audit error — boxscore vacío

---

## Pendientes próxima sesión

1. **Revisar UX en prod** — comprobar toggle y columna central en desktop
2. **T4 shot chart** — `SELECT shot_zone, COUNT(*) FROM stats_pbp WHERE shot_zone IS NOT NULL GROUP BY shot_zone` — si hay datos, implementar
3. **Hero card jugadoras** — verificar `profile.wcba_external_id` en Supabase
4. **T5 bundle iOS** — sesión dedicada; leer `client/src/lib/i18n.ts` primero
5. **Pi como procesador** — arquitectura futura (eliminar dependencia de Railway en reprocesados)

---

## Scripts de mantenimiento

| Script | Uso |
|---|---|
| `scripts/fast_reprocess.py [--reset]` | **Canónico.** Paralelo x6, ~15min. |
| `scripts/monitor_game.py` | Diagnóstico por partido. |
| `scripts/seq_reprocess.py` | ❌ timeout Railway |
| `scripts/sync_reprocess.py` | ❌ timeout Railway |

---

## Estándares de código

1. Leer código real antes de proponer
2. `npm run check` exit 0 antes de cada commit
3. Cursor para `routes.ts`
4. SQL destructivo — solo Supabase SQL Editor
5. NUNCA tocar `Profile.tsx`, `schema.ts`, `migrations/`
6. Tras Cursor: `grep -n 'app.get.*api/stats' server/routes.ts` para detectar duplicados

---

## Lecciones aprendidas

1. `String(null) = 'null'` — filtrar playerExternalId antes de INSERT integer
2. Railway procesa en background — esperar Supabase, no HTTP response
3. `fast_reprocess.py` paralelo x6 correcto; seq/sync dan timeout
4. Inventario: 1 query a `stats_games`, no paginar `stats_pbp`
5. `phase_type` se determina en Railway al procesar
6. `process-game-sync` timeout en Railway — no usar para diagnóstico

---

## Archivos clave
- `server/routes.ts` — endpoints API
- `server/possessions.ts` — procesador PBP v6.6
- `client/src/lib/stats-api.ts` — hooks (StatsPhaseType, statsPhaseQs)
- `client/src/pages/core/Stats.tsx` — PhaseToggle, centerView, CompactRosterList
- `scripts/fast_reprocess.py` — reprocesado canónico

## NUNCA tocar
- `Profile.tsx` · `schema.ts` · `migrations/`

---

## Sesiones anteriores

### Sesión 2026-06-03 — phase_type end-to-end + UX Stats desktop
- possessions v6.5 + v6.6 (phase_type)
- SQL columnas añadidas
- Reprocesado: 444 ok, 2 error (partido 286)
- PhaseToggle contextual (sitio A: jugadoras, sitio B: team sheet)
- Columna central dinámica: roster/playerList/standings/default según estado
- Commits: possessions v6.6, phase_type UI, PhaseToggle + centerView

### Sesión 2026-06-02 — possessions v6.3-v6.5, T1+T2+T3, watchdog Pi
### Sesión 2026-05-31 — possessions v6.3
### Sesión 2026-05-30 — audit fórmulas
### Sesión 2026-05-27 — shotZones, infraestructura
