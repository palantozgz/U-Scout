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
- `server/routes.ts` — rutas API Express
- `server/possessions.ts` — procesador PBP v6 (algoritmo verificado)
- `server/stats-ingest.ts` — ingest endpoint Pi → Railway → Supabase
- `collector/src/sync/pbp.ts` — parser PBP con ACTION_CODE_MAP completo (75 códigos WCBA)
- `client/src/lib/stats-api.ts` — hooks stats completos
- `client/src/pages/core/Stats.tsx` — U Stats UI

## NUNCA tocar
- `Profile.tsx` · `schema.ts` · `migrations/`
- SQL destructivo: solo Supabase SQL Editor, nunca `drizzle-kit push`
- `routes.ts`: SIEMPRE via Cursor con prompt completo, nunca `edit_file` directo

---

## Tools de Claude — CRÍTICO
- `Filesystem:read_text_file` — leer archivos del Mac
- `filesystem:write_file` — escribir archivos completos en el Mac
- `bash_tool` — corre en Linux, NO accede al Mac
- `Control your Mac:osascript` — ejecuta en Mac pero NO puede SSH con contraseña interactiva

---

## Estándares de trabajo de Pablo (no negociables)
1. Verdad antes que velocidad — si hay dudas, investigar primero
2. Leer código real antes de proponer — nunca especular
3. Simular antes de deployar — especialmente procesador de posesiones
4. Gap cero aceptado — diff PBP vs boxscore debe ser 0
5. PBP es fuente única de verdad — boxscore solo auditoría
6. Cursor para routes.ts — nunca edit_file directo

---

## U Stats — Arquitectura (completada 2026-05-24)

### Flujo de datos
```
API WCBA → collector (Pi) → stats_pbp → possessions.ts (Railway) → tablas derivadas → app
```

### Tablas derivadas

| Tabla | Contenido | Estado |
|---|---|---|
| `pbp_possessions` | 1 fila por posesión | ✅ activa |
| `pbp_player_game_stats` | 1 fila por jugadora por partido | ✅ activa |
| `pbp_lineup_stats` | 1 fila por quinteto por partido | ✅ activa |
| `pbp_audit_log` | diff PBP vs boxscore | ✅ activa |

### Endpoints de stats — fuente actual (Fase D completada)

| Endpoint | Fuente | Estado |
|---|---|---|
| `/api/stats/players` | `pbp_player_game_stats` | ✅ PBP |
| `/api/stats/player/:id` | `pbp_player_game_stats` | ✅ PBP |
| `/api/stats/team/:id` ORTG/PPP/Pace | `pbp_possessions` | ✅ PBP |
| `/api/stats/team/:id` roster | `pbp_player_game_stats` | ✅ PBP |
| `/api/stats/league-averages` | `pbp_possessions` + `pbp_player_game_stats` | ✅ PBP |
| `/api/stats/player-percentiles` | `pbp_player_game_stats` | ✅ PBP |
| `/api/stats/team/:id/pace-segments` | `stats_pbp` | ✅ PBP |
| `/api/stats/standings` | `stats_standings` | ✅ oficial WCBA |
| `/api/stats/game/:id/boxscore` | `stats_player_boxscores` | ✅ auditoría |

### FKs eliminados en tablas derivadas
`team_id` usa external_id (igual que stats_pbp), no internal id.

---

## Collector (Pi) — estado

- IP: `192.168.1.7` / `ucore-pi.local` · usuario: `pablo` · contraseña: `skapol`
- PM2: `ucore-collector` activo
- Action codes WCBA: 75 únicos, todos mapeados (verificado con script sobre API real)
- **Re-sync en curso** (iniciado 2026-05-24 04:34) — procesa 223 partidos con código actualizado
- Código activo: commit `cd739a4`

### Action codes WCBA confirmados (75 únicos, todos mapeados)
Verificado ejecutando script contra API WCBA real para los 223 partidos de season_id=2092.
Ningún código WCBA cae a `unknown` con el mapa actual.

---

## Procesador de posesiones `server/possessions.ts` (v6)

### Algoritmo verificado
- Simulado con datos reales Q1 partido 1106508
- FGA cuadra 100% con PBP raw
- Bugs corregidos:
  - Decoradores (assist, block, foul_drawn, sub_in, sub_out) nunca abren posesión
  - shot_made del equipo contrario al possTid: cierra y abre correctamente
  - And-1: look-ahead detecta foul rival tras shot_made

### Endpoints admin (sin auth, temporales)
- `POST /api/stats/admin/trigger-possessions?seasonId=2092`
- `POST /api/stats/admin/process-game/:gameId?seasonId=2092`
- `GET /api/stats/admin/possessions-status?seasonId=2092`

---

## INICIO PRÓXIMA SESIÓN — orden estricto

### 1. Verificar re-sync PBP completo
```bash
ssh pablo@ucore-pi.local
pm2 logs ucore-collector --lines 20 --nostream
```
Buscar: `PBP: all up to date` o `NIGHTLY SYNC DONE`

### 2. Verificar 0 unknowns en stats_pbp
```sql
SELECT action_code, COUNT(*)
FROM stats_pbp
WHERE event_type = 'unknown'
GROUP BY action_code
ORDER BY COUNT(*) DESC;
```
**Debe devolver 0 filas.** Si hay unknowns, identificar los códigos y añadir al mapa antes de continuar.

### 3. TRUNCATE tablas derivadas y reprocesar
```sql
TRUNCATE TABLE pbp_possessions;
TRUNCATE TABLE pbp_player_game_stats;
TRUNCATE TABLE pbp_lineup_stats;
TRUNCATE TABLE pbp_audit_log;
```
```bash
curl -s -X POST "https://u-scout-production.up.railway.app/api/stats/admin/trigger-possessions?seasonId=2092"
```
Esperar 5-10 minutos.

### 4. Verificar audit — objetivo diff_pts = 0 en todos
```sql
SELECT team_external_id, box_pts, pbp_pts, diff_pts, status
FROM pbp_audit_log
WHERE season_id = 2092
ORDER BY ABS(diff_pts) DESC
LIMIT 20;
```
Si hay partidos con diff_pts != 0: investigar con los eventos reales de ese game_id.

### 5. Si audit OK → verificar UI
La UI ya lee de PBP (Fase D completada). Verificar que los datos aparecen correctamente en Stats.

---

## Bugs activos (por impacto)

**P0:**
- Re-sync PBP en curso — pendiente verificar completion y audit
- `pointsByZone` eliminado de team endpoint (no hay datos de coordenadas) — pendiente confirmar que UI no rompe

**P1:**
- Nav bar iOS se bloquea al abrir ficha jugadora/equipo en Stats
- Hero card "Mis estadísticas" jugadoras — depende de `profile.wcba_external_id` no null
- `hasReport` siempre true en MyScout
- Schedule scroll no recentering en List↔Planner switch

**P2:**
- Game boxscore: falta marcador por cuartos
- Módulos en desktop en español
- Scout en iOS ha perdido la "U"

**Pendientes futuros:**
- Fase E: UI quintetos y on/off
- Stats Fase 4: shot_x/shot_y hotspot data
- iOS TestFlight: bundle <300KB gzip
- Eliminar endpoints admin sin auth cuando todo esté estable
