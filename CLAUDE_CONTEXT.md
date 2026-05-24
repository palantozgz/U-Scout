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
- `server/possessions.ts` — procesador PBP **v6.2** (algoritmo verificado contra partido real)
- `server/stats-ingest.ts` — ingest endpoint Pi → Railway → Supabase
- `collector/src/sync/pbp.ts` — parser PBP con ACTION_CODE_MAP completo (auditado 2026-05-24)
- `collector/src/ingest.ts` — IngestType + fetchSyncStatus
- `client/src/lib/stats-api.ts` — hooks stats completos
- `client/src/pages/core/Stats.tsx` — U Stats UI
- `client/src/pages/core/ModuleNav.tsx` — nav bar (safe-area iOS fix aplicado 2026-05-25)

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

## U Stats — Arquitectura

### Flujo de datos
```
API WCBA → collector/pbp.ts (Pi) → stats_pbp → Railway/possessions.ts v6.2 → tablas derivadas → app
```

**IMPORTANTE:** El procesador de posesiones corre en Railway (`server/possessions.ts`), NO en el Pi.
El Pi solo hace ingest de PBP crudo a `stats_pbp`. Railway procesa las posesiones en background
al recibir cada partido via `handlePBP()` en `stats-ingest.ts`.

### Tablas derivadas

| Tabla | Contenido | Estado |
|---|---|---|
| `pbp_possessions` | 1 fila por posesión | ✅ activa — v6.2 |
| `pbp_player_game_stats` | 1 fila por jugadora por partido | ✅ activa |
| `pbp_lineup_stats` | 1 fila por quinteto por partido | ✅ activa — columnas off_ppp/def_ppp/net_ppp añadidas |
| `pbp_audit_log` | diff PBP vs boxscore | ✅ activa |

### Endpoints de stats

| Endpoint | Fuente | Estado |
|---|---|---|
| `/api/stats/players` | `pbp_player_game_stats` | ✅ |
| `/api/stats/player/:id` | `pbp_player_game_stats` | ✅ |
| `/api/stats/team/:id` | `pbp_possessions` | ✅ |
| `/api/stats/league-averages` | `pbp_possessions` | ✅ |
| `/api/stats/player-percentiles` | `pbp_player_game_stats` | ✅ |
| `/api/stats/team/:id/pace-segments` | `stats_pbp` | ✅ (B4 pendiente) |
| `/api/stats/team/:id/lineups` | `pbp_lineup_stats` | ✅ NUEVO 2026-05-25 |
| `/api/stats/team/:id/on-off/:playerId` | `pbp_lineup_stats` | ✅ NUEVO 2026-05-25 |
| `/api/stats/players/combined` | `pbp_lineup_stats` | ✅ NUEVO 2026-05-25 |
| `/api/stats/standings` | `stats_standings` | ✅ oficial WCBA |
| `/api/stats/game/:id/boxscore` | `stats_player_boxscores` | ✅ auditoría |

---

## Procesador de posesiones v6.2 — arquitectura

### Por qué v6.2 (vs v5)
v5 usaba flujo reactivo — inferencia por tipo de evento con lookaheads frágiles.
Bug principal: FTs de equipo A durante posesión de equipo B no se contabilizaban en possessions
(el `tid` del FT era el atacante pero `possTid` era el defensor → ningún bloque los capturaba).
Resultado: HOME -10pts en possessions vs boxscore en partido real.

v6.2 usa dos pasadas explícitas:

### Pasada 1A: lineup tracking + player stats + snapshots
- Sub_in/sub_out actualizan `lineups` y `onCourtSince`
- Snapshot de lineup por evento → `snapHome[i]` / `snapAway[i]`
- Player stats acumuladas por evento (independiente de posesión)
- Minutos por stint con flush en cambio de cuarto

### Pasada 1B: inferir offense_team_id por evento
El `team_id` del evento NO es siempre el equipo atacante:

| Código | offense = |
|---|---|
| shot/turnover/ORB | tid (atacante) |
| REBDEF | tid (reboteador pasa a atacar) |
| STEBAL | tid (robador pasa a atacar) |
| FOLDEF/FOLPER/FOLDSQ/FOLUSM/FOLTEC | rival de tid (fouler es defensor) |
| FOLOFF/FOLOFN | tid (fouler es atacante) |
| ft_made/ft_missed | tid (tirador siempre es atacante) |
| JUBSUC | tid (ganador del jump ball) |
| decoradores (assist, foul_drawn, block, sub, timeout, unknown) | último offense conocido |

### Pasada 2: posesiones por cambio de offense_team_id
- startTimeSec = clockSec del ÚLTIMO evento de la posesión ANTERIOR (no del primero de la actual)
  → esto corrige dur=0 masivo de v5 (41% → 2%)
- endTimeSec = clockSec del último evento de juego de esta posesión
- dur = startTimeSec - endTimeSec (reloj FIBA cuenta hacia atrás)
- And-1 detectado por lookahead: shot_made seguido de FT del mismo offense

### Verificación contra partido real 1108582
- HOME 65pts: possessions=65 ✅ diff=0
- AWAY 74pts: possessions=74 ✅ diff=0
- HOME FTA: events=21, possessions=21 ✅
- AWAY FTA: events=17, possessions=17 ✅
- Dur=0: 2/153 (1%) — sub-segundo físicamente correctos
- AvgDur: 16.7s — rango FIBA correcto (10-20s)
- Pace: 19.1 poss/cuarto — rango FIBA correcto

---

## Collector (Pi) — estado 2026-05-25

- IP: `192.168.1.7` · usuario: `pablo` · contraseña: `skapol`
- PM2: `ucore-collector` activo (restart #9)
- Código activo: commit `80a7b88`
- **GitHub no accesible desde Pi** — usar SCP para actualizaciones
- Re-sync nocturno en curso desde 02:35 (procesando 223 partidos PBP)
- TOTLTO es el ÚNICO action_code que debe quedar como `unknown` — correcto

### Action codes WCBA
- Sistema: Genius Sports FIBA LiveStats
- TOTLTO/TOTSTO/TNOSTL → `'unknown'` (administrativos, no estadísticos)
- FOLDEF/FOLPER/FOLDSQ/FOLUSM → `'foul'` (fouler = defensor)

---

## Estado de re-sync 2026-05-25

**Pendiente al cierre de sesión:**
- stats_pbp truncada ✅ y re-sync en curso en el Pi (iniciado ~02:35)
- pbp_possessions/pbp_player_game_stats/pbp_lineup_stats/pbp_audit_log truncadas ✅
- El trigger de posesiones todavía NO se ha lanzado — hacerlo MAÑANA

**Al inicio de próxima sesión:**
1. Verificar sync completo: `pm2 logs ucore-collector --lines 5 --nostream` → buscar `=== NIGHTLY SYNC DONE ===`
2. Verificar unknowns — solo TOTLTO debe aparecer:
```sql
SELECT action_code, COUNT(*) FROM stats_pbp WHERE event_type = 'unknown'
GROUP BY action_code ORDER BY COUNT(*) DESC;
```
3. Lanzar trigger de posesiones:
```bash
curl -s -X POST "https://u-scout-production.up.railway.app/api/stats/admin/trigger-possessions?seasonId=2092"
```
4. Auditar — objetivo diff_pts = 0:
```sql
SELECT team_external_id, box_pts, pbp_pts, diff_pts, status
FROM pbp_audit_log WHERE season_id = 2092
ORDER BY ABS(diff_pts) DESC LIMIT 20;
```
5. Verificar quintetos:
```sql
SELECT team_id, COUNT(DISTINCT lineup_id) AS lineups, SUM(off_possessions) AS poss
FROM pbp_lineup_stats WHERE season_id = 2092
GROUP BY team_id ORDER BY team_id;
```

---

## Bugs activos (por impacto)

**P1:**
- **B4**: PPP por tramo inflado — `pace-segments` usa tiros como denominador, no posesiones.
  Nombre correcto: PPT (Points Per Shot), no PPP. Pendiente fix via Cursor.
- **Hero card "Mis estadísticas"** jugadoras — depende de `profile.wcba_external_id` no null.
  Verificar en Supabase que los perfiles de jugadoras tienen el campo.
- **`hasReport` en MyScout** — función mira `catchAndShootFrequency` y `perimeterThreats`
  que son campos de versiones antiguas. Perfiles viejos en DB pueden tener esos campos activos
  → botón siempre dice "Ver informe". No bloqueante. Investigar en producción cuántos perfiles afectados.

**P2:**
- **B3**: plusMinus siempre 0 — no implementado en possessions.ts.
- **B5**: pointsByZone: split 70/30 inventado (tag "est." en UI). Pendiente Fase 4 shot coords.
- Game boxscore: falta marcador por cuartos.
- Módulos en desktop en español.
- Scout en iOS ha perdido la "U" en el icono del módulo.

**Resueltos esta sesión (2026-05-25):**
- ✅ Nav bar iOS safe-area — `ModuleNav.tsx` añade `env(safe-area-inset-left/top/bottom)` al sidebar
- ✅ possessions.ts v6.2 — puntos exactos, FTs exactos, dur media correcta
- ✅ Endpoints lineups/on-off/combined deployados en Railway
- ✅ stats_pbp truncada y re-sync con ACTION_CODE_MAP correcto

**Eliminados de pendientes:**
- Schedule scroll no recentering — descartado por Pablo
- Nav bar iOS bloqueo al abrir ficha — resuelto (safe-area fix)

---

## Pendientes futuros

- Fase E: UI quintetos y on/off (endpoints ya listos, falta UI)
- Stats Fase 4: shot_x/shot_y hotspot data (Pi pipeline)
- iOS TestFlight: bundle <300KB gzip (actualmente ~509KB)
  - Plan: lazy i18n (~-120KB) + React.lazy code splitting (~-100KB)
- Eliminar endpoints admin sin auth (`/api/stats/admin/...`)
- Confirmar `backup/motor-v2.1-pre-20260405` estable y mergear
- OverridePanel integration — pendiente full wiring a Supabase
- Favicon replacement (muestra icono Replit)
- Club logo: upload imagen real (replace emoji picker)

---

## Sesiones anteriores resumidas

### Sesión 2026-05-25 — possessions v6.2, lineups endpoints, iOS safe-area

**Problema central:** v5 del procesador tenía bug fundamental donde FTs del equipo atacante
durante posesión del defensor no se contabilizaban → -10pts por partido en possessions.
Causa raíz: todos los bloques de FT tenían `&& tid === possTid` — si el FOLDEF cambiaba el
equipo atacante nominal sin cerrar posesión, los FTs quedaban huérfanos.

**Solución v6.2:** dos pasadas. Pasada 1B infiere `offense_team_id` por tipo de acción —
FOLDEF → offense = rival del fouler. Pasada 2 agrupa por cambio de offense_team_id.
startTimeSec = clock del cierre anterior (no del primer evento de la posesión actual)
→ corrige dur=0 masivo de 41% a 2%.

**Verificación:** partido real 1108582, HOME 65pts AWAY 74pts.
possessions: HOME=65 AWAY=74, diff=0. FTA exactos. AvgDur=16.7s. ✅

**iOS safe-area:** `ModuleNav.tsx` sidebar añade padding con `env(safe-area-inset-*)`.
Sidebar en iPhone landscape no quedaba tapada por cámara/notch.

**Commits:**
- `3ee80c3` — possessions v6.2 + 3 endpoints stats (lineups/on-off/combined)
- `d46a7e4` — ModuleNav safe-area iOS

### Sesión 2026-05-24 — Action codes completos, auditoría stats, collector

**Problema:** commit c947527 documentó 12 nuevos action codes pero NUNCA los escribió en pbp.ts.
175 eventos/partido clasificados como 'unknown'.

**Fixes en pbp.ts:** TNOSTL → 'unknown', TOTLTO/TOTSTO → 'unknown', MADE3_CODES completado,
nuevos: 2PMALY, 2PAALY, 2PMTDK, 2PATDK, 3PMFLT, 3PAFLT, 3PATRN, TNO5SC, TNO8SC, FOLPER, FOLDSQ.

**Commit:** `80a7b88`

### Sesión 2026-05-23 — PBP como fuente única, blueprint arquitectura
- Fase A: 4 tablas derivadas creadas en Supabase
- Documentos: FORMULAS_STATS.md, PBP_EVENTS.md, PBP_STATS_BLUEPRINT.md
