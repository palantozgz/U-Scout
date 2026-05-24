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

---

## Collector (Pi) — estado

- IP: `192.168.1.7` / `ucore-pi.local` · usuario: `pablo` · contraseña: `skapol`
- PM2: `ucore-collector` activo
- Código activo: commit `80a7b88` (2026-05-24)
- **GitHub no accesible desde Pi** (HTTP2 framing layer error) — usar SCP para actualizaciones
- `@supabase/supabase-js` instalado en Pi

### Action codes WCBA — diccionario completo (auditado 2026-05-24)
- Sistema: Genius Sports FIBA LiveStats — formato `[actionType][M=made|A=attempt][subType]`
- Fuentes: Genius Sports Warehouse API docs + FIBA Statisticians Manual 2024 + PBP context
- FLT y FLO mutuamente excluyentes por partido = variante de operador, mismo tipo de tiro
- Administrativos: TOTLTO, TOTSTO, TNOSTL → `'unknown'` — nunca contar como eventos estadísticos
- MADE3_CODES completo: incluye 3PMSBK, 3PMFAD, 3PMPUL, 3PMFLT

---

## AUDITORÍA COMPLETA DE STATS (2026-05-24)

### Fórmulas correctas (routes.ts — fuente boxscore)
✅ PPG, RPG, APG, SPG, BPG, TOPg — medias aritméticas correctas
✅ FG%, 3P%, FT% — fórmula FIBA estándar
✅ eFG% = (FGM+0.5×3PM)/FGA
✅ TS% = PTS/(2×(FGA+0.44×FTA))
✅ FT Rate = FTA/FGA (sin ×100, igual que BBRef)
✅ TOV% = TOV/(FGA+0.44×FTA+TOV)
✅ ORB%/DRB% — fórmula BBRef con CTE rival correcta
✅ USG% — fórmula BBRef exacta con minutos
✅ PIE — fórmula NBA exacta
✅ ORTG/DRTG — Dean Oliver, posesiones = FGA+0.44×FTA+TOV-ORB
✅ Pace = (poss_own+poss_rival)/2/games

### Bugs confirmados (possessions.ts)

**B1 — CRÍTICO: Posesión doble en steal**
Para cada steal, el PBP tiene: TNOBHD (turnover) + STEBAL (steal).
El bloque de turnover abre posesión del defensor. Luego el bloque de steal la cierra y abre de nuevo.
Resultado: posesión abierta dos veces, conteo de posesiones inflado, PPP distorsionado.
Fix: cuando `event_type === 'steal'`, el bloque de turnover no debe ejecutarse.
Solución: añadir `&& ev.event_type !== 'steal'` no es suficiente — hay que mirar si el evento SIGUIENTE es steal antes de cerrar por turnover.
Implementación: lookahead `events[i+1]?.event_type === 'steal'` → no cerrar posesión en el turnover, dejar que el steal lo haga.

**B2 — MEDIO: Minutos multi-cuarto**
`flushMinutesForPlayer` solo cubre la transición al cuarto inmediatamente anterior.
Jugadoras que juegan 3+ cuartos sin sustituirse pierden minutos de los cuartos intermedios.
Fix: el bucle de cierre de cuarto (`isNewQuarter`) ya hace `ps.secondsPlayed += entry.entrySec` para el cuarto anterior y resetea. Este es el mecanismo correcto — pero `flushMinutesForPlayer` luego también suma, lo que puede duplicar. Necesita revisión con caso de prueba concreto.

**B3 — BAJO: plusMinus siempre 0**
No implementado. TODO en el código.
Fix: al cerrar stint de una jugadora, `plusMinus += score_differential_exit - score_differential_entry`.

### Bugs conocidos (routes.ts)

**B4 — CONOCIDO: PPP por tramo inflado ~15-20%**
`pace-segments` usa tiros como denominador, no posesiones totales.
Nombre correcto de lo que calcula: PPT (Points Per Shot attempt), no PPP.
Estado: documentado, pendiente fix via Cursor.

**B5 — CONOCIDO: pointsByZone inventado**
Split 70/30 pintura/mid hardcodeado sin datos de coordenadas.
Estado: tag "est." en UI, pendiente Fase 4 (shot coordinates).

**B6 — MENOR: isTransition usa reloj de partido**
Proxy razonable sin shot clock. No comparable con Synergy pero válido para uso interno.

### Fórmulas correctas (possessions.ts)
✅ points, shotAttempts, ftAttempts, turnovers, offensiveRebounds — acumulación correcta
✅ durationSec = possStartSec - endTimeSec en segundos de reloj FIBA
✅ isSecondChance = hubo rebote ofensivo en la posesión
✅ lineupId = snapshot del quinteto al inicio de posesión
✅ scoreMarginStart = diferencial desde perspectiva del equipo atacante
✅ Seed de titulares: usa is_start_lineup del boxscore + mapping team_external_id→internal

---

## INICIO PRÓXIMA SESIÓN — orden estricto

### 0. FIX PREVIO AL RE-SYNC: B1 en possessions.ts (steal doble posesión)
Antes de truncar y reprocesar, corregir B1 o los datos procesados serán incorrectos.
El fix requiere lookahead en el loop de eventos:
```typescript
// En el bloque de turnover (possessions.ts):
// Antes de cerrar posesión, verificar si el siguiente evento es steal
const nextEv = events[i + 1];
const nextIsSteal = nextEv?.event_type === 'steal' && nextEv?.team_id !== tid;
if (!nextIsSteal) {
  closePossession(clockSec, 'turnover', ev.quarter);
  const nextTeam = tid === homeTeamId ? awayTeamId : homeTeamId;
  startPossession(nextTeam, clockSec, 'dead_ball', ev.quarter, ev.score_differential);
}
// El steal manejará el cambio de posesión correctamente
```

### 1. Verificar que stats_pbp tiene 0 unknowns
```sql
SELECT action_code, COUNT(*)
FROM stats_pbp WHERE event_type = 'unknown'
GROUP BY action_code ORDER BY COUNT(*) DESC;
```
Si hay unknowns → TRUNCATE stats_pbp + re-sync nocturno.

### 2. TRUNCATE tablas derivadas y reprocesar
Solo después de fix B1 y 0 unknowns:
```sql
TRUNCATE TABLE pbp_possessions;
TRUNCATE TABLE pbp_player_game_stats;
TRUNCATE TABLE pbp_lineup_stats;
TRUNCATE TABLE pbp_audit_log;
```
```bash
curl -s -X POST "https://u-scout-production.up.railway.app/api/stats/admin/trigger-possessions?seasonId=2092"
```

### 3. Verificar audit — objetivo diff_pts = 0
```sql
SELECT team_external_id, box_pts, pbp_pts, diff_pts, status
FROM pbp_audit_log WHERE season_id = 2092
ORDER BY ABS(diff_pts) DESC LIMIT 20;
```

---

## Sesiones anteriores resumidas

### Sesión 2026-05-24 — Action codes completos, auditoría stats, collector compila limpio

**Problema raíz descubierto:**
commit c947527 documentó 12 nuevos action codes pero NUNCA los escribió en pbp.ts.
175 eventos/partido clasificados como 'unknown'.

**Fixes en pbp.ts:**
- TNOSTL → 'unknown' (era 'turnover' — doble conteo)
- TOTLTO / TOTSTO → 'unknown' (marcadores administrativos)
- MADE3_CODES completado (triples contaban como 2pts)
- 2PMPUL/2PAPUL añadidos al mapa
- Nuevos: 2PMALY, 2PAALY, 2PMTDK, 2PATDK, 3PMFLT, 3PAFLT, 3PATRN, TNO5SC, TNO8SC, FOLPER, FOLDSQ

**Fixes en collector infrastructure:**
- supabaseClient.ts creado
- IngestType ampliado (pbp_possessions, pbp_player_game_stats, pbp_lineup_stats, pbp_audit)
- fetchSyncStatus restaurado
- GameRow interface — fix TypeScript
- Seed de titulares desde boxscore (bloque anterior vacío)

**Conocimiento nuevo:**
- WCBA usa Genius Sports FIBA LiveStats
- GitHub no accesible desde Pi — usar SCP
- Auditoría completa de fórmulas: ver sección AUDITORÍA COMPLETA

**Commit:** `80a7b88`

---

### Sesión 2026-05-23 — PBP como fuente única, blueprint arquitectura
- PPP por tramo: TOVs añadidos al denominador — fix commit `c947527`
- Fase A: 4 tablas derivadas creadas en Supabase
- Documentos: FORMULAS_STATS.md, PBP_EVENTS.md, PBP_STATS_BLUEPRINT.md

---

## Bugs activos (por impacto)

**P0:**
- **B1**: Posesión doble en steal — `possessions.ts` abre posesión dos veces para cada steal — CORREGIR ANTES de cualquier re-sync
- `stats_pbp` histórico tiene eventos mal clasificados — requiere TRUNCATE + re-sync
- `pbp_possessions` / `pbp_player_game_stats` / `pbp_lineup_stats` vacías hasta completar re-sync

**P1:**
- **B2**: Minutos multi-cuarto en possessions.ts — jugadoras sin sustitución entre cuartos pierden minutos
- **B4**: PPP por tramo inflado ~15-20% (denominador son tiros, no posesiones)
- Nav bar iOS se bloquea al abrir ficha jugadora/equipo en Stats
- Hero card "Mis estadísticas" jugadoras — depende de `profile.wcba_external_id` no null
- `hasReport` siempre true en MyScout
- Schedule scroll no recentering en List↔Planner switch

**P2:**
- **B3**: plusMinus siempre 0 — no implementado
- **B5**: pointsByZone: split 70/30 inventado (tag "est." en UI)
- Game boxscore: falta marcador por cuartos
- Módulos en desktop en español
- Scout en iOS ha perdido la "U"

**Pendientes futuros:**
- Fase E: UI quintetos y on/off
- Stats Fase 4: shot_x/shot_y hotspot data
- iOS TestFlight: bundle <300KB gzip
- Eliminar endpoints admin sin auth
- Confirmar `backup/motor-v2.1-pre-20260405` estable y mergear
