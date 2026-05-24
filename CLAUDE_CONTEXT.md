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
- `collector/src/sync/pbp.ts` — parser PBP con ACTION_CODE_MAP completo (auditado 2026-05-24)
- `collector/src/sync/possessions.ts` — procesador posesiones desde stats_pbp
- `collector/src/supabaseClient.ts` — cliente Supabase para collector (creado 2026-05-24)
- `collector/src/ingest.ts` — IngestType + fetchSyncStatus
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
API WCBA → collector/pbp.ts (Pi) → stats_pbp → collector/possessions.ts (Pi) → ingest → Railway → tablas derivadas → app
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
- Código activo: commit `80a7b88` (2026-05-24)
- **GitHub no accesible desde Pi** (HTTP2 framing layer error) — usar SCP para actualizaciones
- `@supabase/supabase-js` instalado en Pi (necesario para possessions.ts)

### Action codes WCBA — diccionario completo (auditado 2026-05-24)
- Sistema: Genius Sports FIBA LiveStats — formato `[actionType][M=made|A=attempt][subType]`
- Fuentes: Genius Sports Warehouse API docs + FIBA Statisticians Manual 2024 + PBP context analysis
- FLT y FLO son mutuamente excluyentes por partido = variante de operador, mismo tipo de tiro
- Códigos administrativos (TOTLTO, TOTSTO, TNOSTL) → `'unknown'` — nunca contar como eventos estadísticos
- TNOSTL era `'turnover'` → causaba doble conteo con TNOBHD+STEBAL para el mismo hecho
- MADE3_CODES estaba incompleto (faltaban 3PMSBK, 3PMFAD, 3PMPUL, 3PMFLT) → pointsFromCode devolvía 2pts para triples

### collector/src/sync/possessions.ts — estado
- Compila limpio (0 errores TypeScript)
- Seed de titulares: usa `is_start_lineup` del boxscore + mapping `team_external_id→internal` via PBP cross-reference
- Bug P2 conocido: bloque TOV-sin-robo usa `!action_code.startsWith('STEAL')` — nunca filtra (STEBAL ≠ STEAL*); impacto reducido porque TNOSTL→unknown ya no llega como turnover

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

### 1. Verificar que stats_pbp tiene 0 unknowns
El collector corrió con código viejo hasta el sync de 2026-05-24 11:06. El nuevo código (TNOSTL→unknown, nuevos códigos añadidos) está en el Pi desde 2026-05-24 ~20:30. El próximo sync nocturno (19:00 hora Pi = 11:00 UTC) procesará los partidos nuevos con el mapa correcto, pero los 223 partidos históricos en stats_pbp siguen teniendo los eventos mal clasificados.

```sql
SELECT action_code, COUNT(*)
FROM stats_pbp WHERE event_type = 'unknown'
GROUP BY action_code ORDER BY COUNT(*) DESC;
```

Si devuelve filas → TRUNCATE stats_pbp + re-sync. Si 0 filas → continuar.

### 2. TRUNCATE stats_pbp + re-sync histórico
Solo si el paso 1 muestra unknowns (probable):
```sql
TRUNCATE TABLE stats_pbp;
```
Luego en el Pi:
```bash
ssh pablo@ucore-pi.local
# dentro del Pi:
pm2 stop ucore-collector
node dist/index.js --force-pbp-sync
# o modificar el cron para forzar re-sync inmediato
pm2 restart ucore-collector
```

### 3. TRUNCATE tablas derivadas y reprocesar
Después de confirmar 0 unknowns en stats_pbp:
```sql
TRUNCATE TABLE pbp_possessions;
TRUNCATE TABLE pbp_player_game_stats;
TRUNCATE TABLE pbp_lineup_stats;
TRUNCATE TABLE pbp_audit_log;
```
```bash
curl -s -X POST "https://u-scout-production.up.railway.app/api/stats/admin/trigger-possessions?seasonId=2092"
```

### 4. Verificar audit — objetivo diff_pts = 0
```sql
SELECT team_external_id, box_pts, pbp_pts, diff_pts, status
FROM pbp_audit_log
WHERE season_id = 2092
ORDER BY ABS(diff_pts) DESC
LIMIT 20;
```

### 5. Si audit OK → verificar UI
La UI ya lee de PBP (Fase D completada). Verificar que los datos aparecen correctamente en Stats.

---

## Sesiones anteriores resumidas

### Sesión 2026-05-24 — Auditoría completa action codes, collector compila limpio

**Problema raíz descubierto:**
El commit c947527 (2026-05-23) documentó 12 nuevos action codes en FORMULAS_STATS.md pero NUNCA los escribió en `collector/src/sync/pbp.ts`. El Pi tenía el `dist/` compilado con código viejo y generaba 175 eventos `unknown` por partido.

**Investigación:**
- Sistema confirmado: Genius Sports FIBA LiveStats — códigos son `[actionType][M/A][subType]`
- Documentación oficial: developer.geniussports.com + FIBA Statisticians Manual 2024
- TOTSTO/TOTLTO: confirmados como marcadores administrativos de cambio de posesión via análisis de contexto PBP (aparecen después de FGM, FTM, steals ya registrados — nunca standalone)
- FLT: mutuamente excluyente con FLO por partido = variante de operador del mismo tipo de tiro

**Fixes en pbp.ts:**
- TNOSTL → `'unknown'` (era `'turnover'` — doble conteo con TNOBHD+STEBAL)
- TOTLTO → `'unknown'` (era `'turnover'`)
- TOTSTO → `'unknown'` (no estaba en el mapa)
- MADE3_CODES completado (faltaban 3PMSBK, 3PMFAD, 3PMPUL, 3PMFLT → triples contaban como 2pts)
- 2PMPUL/2PAPUL añadidos al ACTION_CODE_MAP (estaban en SHOT_CODES pero no en el mapa → unknown)
- Nuevos códigos: 2PMALY, 2PAALY, 2PMTDK, 2PATDK, 3PMFLT, 3PAFLT, 3PATRN, TNO5SC, TNO8SC, FOLPER, FOLDSQ

**Fixes en collector infrastructure:**
- `collector/src/supabaseClient.ts` creado (possessions.ts lo necesita para leer stats_pbp)
- `IngestType` ampliado: pbp_possessions, pbp_player_game_stats, pbp_lineup_stats, pbp_audit
- `fetchSyncStatus` restaurado en ingest.ts (se perdió en reescritura)
- `SyncStatus.boxDone` (no boxscoresDone) — compatibilidad con boxscores.ts
- `GameRow` interface en possessions.ts — fix TypeScript implicit any en lambdas
- Seed de titulares en possessions.ts: reemplazado bloque vacío con seed real usando `is_start_lineup` del boxscore + mapping `team_external_id→internal` via cross-reference con PBP events

**Pi — actualizaciones vía SCP (GitHub no accesible desde Pi):**
- `collector/src/sync/pbp.ts`
- `collector/src/sync/possessions.ts`
- `collector/src/ingest.ts`
- `collector/src/supabaseClient.ts`
- `npm install @supabase/supabase-js` en Pi
- Build limpio + pm2 restart confirmado

**Commit:** `80a7b88`

---

### Sesión 2026-05-23 — PBP como fuente única, blueprint arquitectura

**Fixes aplicados:**
- PPP por tramo: TOVs añadidos al denominador (routes.ts via Cursor) — fix commit `c947527`
- Nombres tramos pace-segments: Transition / Early Offense / Halfcourt (Stats.tsx)
- ACTION_CODE_MAP: 12 nuevos códigos DOCUMENTADOS (pero no aplicados — ver sesión 2026-05-24)
- Collector actualizado en Pi: git pull + npm build + pm2 restart

**Fase A completada:**
4 tablas creadas en Supabase: `pbp_possessions`, `pbp_player_game_stats`, `pbp_lineup_stats`, `pbp_audit_log`

**Documentos creados:**
- `FORMULAS_STATS.md` — fórmulas con fuente y estado
- `PBP_EVENTS.md` — catálogo event_types con literatura externa
- `PBP_STATS_BLUEPRINT.md` — arquitectura completa

---

## Bugs activos (por impacto)

**P0:**
- `stats_pbp` histórico tiene eventos mal clasificados (TNOSTL como turnover, unknowns) — requiere TRUNCATE + re-sync antes de procesar posesiones
- `pbp_possessions` / `pbp_player_game_stats` / `pbp_lineup_stats` vacías hasta completar re-sync

**P1:**
- Nav bar iOS se bloquea al abrir ficha jugadora/equipo en Stats
- Hero card "Mis estadísticas" jugadoras — depende de `profile.wcba_external_id` no null
- `hasReport` siempre true en MyScout
- Schedule scroll no recentering en List↔Planner switch
- possessions.ts bloque TOV-sin-robo: `!action_code.startsWith('STEAL')` nunca filtra (P2 en práctica tras TNOSTL→unknown)

**P2:**
- Game boxscore: falta marcador por cuartos
- Módulos en desktop en español
- Scout en iOS ha perdido la "U"

**Pendientes futuros:**
- Fase E: UI quintetos y on/off
- Stats Fase 4: shot_x/shot_y hotspot data
- iOS TestFlight: bundle <300KB gzip
- Eliminar endpoints admin sin auth cuando todo esté estable
- Confirmar `backup/motor-v2.1-pre-20260405` estable y mergear
