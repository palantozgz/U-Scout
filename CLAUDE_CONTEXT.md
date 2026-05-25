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
- `collector/src/sync/schedule.ts` — sync de partidos
- `collector/src/index.ts` — nightly sync + candidatesForPBP logic
- `collector/src/ingest.ts` — IngestType + fetchSyncStatus
- `client/src/lib/stats-api.ts` — hooks stats completos (incluye useTeamLineups, usePlayerOnOff, usePlayersCombinedLineups)
- `client/src/lib/playbook-api.ts` — hooks Playbook (usePlans, useCreatePlan, useUpdatePlan, useDeletePlan)
- `client/src/pages/core/Stats.tsx` — U Stats UI
- `client/src/pages/core/ModuleNav.tsx` — nav bar (safe-area iOS fix aplicado 2026-05-25)
- `client/src/pages/core/Playbook.tsx` — hub + wizard v5 + review + split auth coach/player
- `client/src/lib/defensive-system.ts` — motor v5 completo

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
| `/api/stats/team/:id/pace-segments` | `stats_pbp` | ✅ B4 fix aplicado (TOVs en denominador) |
| `/api/stats/team/:id/lineups` | `pbp_lineup_stats` | ✅ |
| `/api/stats/team/:id/on-off/:playerId` | `pbp_lineup_stats` | ✅ |
| `/api/stats/players/combined` | `pbp_lineup_stats` | ✅ |
| `/api/stats/standings` | `stats_standings` | ✅ oficial WCBA |
| `/api/stats/game/:id/boxscore` | `stats_player_boxscores` | ✅ auditoría |

### Endpoints Playbook

| Endpoint | Comportamiento | Estado |
|---|---|---|
| `GET /api/playbook/plans` | club_id desde profiles; RLS por rol | ✅ |
| `POST /api/playbook/plans` | Insert con created_by, visibility default draft | ✅ |
| `PATCH /api/playbook/plans/:id` | Edición si autor o coach/head_coach | ✅ |
| `DELETE /api/playbook/plans/:id` | Solo el autor | ✅ |

---

## Procesador de posesiones v6.2 — arquitectura

### Pasada 1B: inferir offense_team_id por evento

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

### Verificación contra partido real 1108582
- HOME 65pts: possessions=65 ✅ diff=0
- AWAY 74pts: possessions=74 ✅ diff=0
- Dur=0: 2/153 (1%) — sub-segundo físicamente correctos
- AvgDur: 16.7s — rango FIBA correcto

---

## Collector (Pi) — estado 2026-05-26

- IP: `192.168.1.7` · usuario: `pablo` · contraseña: `skapol`
- PM2: `ucore-collector` activo
- Código activo en Pi: commit `80a7b88`
- **GitHub no accesible desde Pi** — usar SCP para actualizaciones
- TOTLTO y TOTSTO son los únicos action_codes que deben quedar como `unknown`

### Fix collector aplicado esta sesión (pendiente deploy al Pi via SCP)
En `collector/src/index.ts`: `candidatesForPBP` incluye partidos status=3 con marcador
(no solo status=4). Captura partidos que la API WCBA deja en status=3 permanentemente
aunque estén terminados (bug confirmado con partido 1106673).

En `server/stats-ingest.ts`: `handleSchedule` usa `GREATEST(status, EXCLUDED.status)`
para que el status nunca retroceda de 4 a 3.

En `collector/src/sync/pbp.ts`: PBP vacío loguea como `logger.error` en vez de `logger.warn`.

**Cambios en repo (commit d0f2622) pero NO en el Pi todavía.**
Cuando estés en casa: SCP del collector al Pi y `pm2 restart ucore-collector`.

### Action codes WCBA
- Sistema: Genius Sports FIBA LiveStats
- TOTLTO/TOTSTO/TNOSTL → `'unknown'` (administrativos)
- FOLDEF/FOLPER/FOLDSQ/FOLUSM → `'foul'` (fouler = defensor)

---

## Estado DB temporada 2092 — 2026-05-26

- **224 partidos** en stats_games (correcto para temporada completa WCBA 2024-25)
  - Grupo A (phase 27172): 132 partidos ✅ todos status=4
  - Grupo B (phase 27206): 60 partidos, 59 status=4, 1 status=3 (partido 1106673)
  - Playoffs (phases 27743/27747/27753/27757): 32 partidos ✅
- **Audit:** 440 ok, 0 warning, 0 error, max_diff=0 ✅
  - Partido 1106673 (大连 78–厦门 76): PBP ingestado manualmente (487 eventos),
    posesiones correctas (78/76), pero audit en ERROR porque boxscore jugadoras = 0.
    Se resolverá automáticamente en el próximo nightly sync del Pi (syncNewBoxscores).
- **Quintetos:** 18 equipos procesados, 1.694–2.521 posesiones por equipo ✅

---

## Playbook — arquitectura actual

### Tabla Supabase: `playbook_plans`
Campos: id, club_id, type, name, opponent_name, opponent_ext_id, game_id,
season_label, notes, answers (jsonb), report (jsonb), visibility, created_by,
created_at, updated_at, published_at, published_by

Visibility states: `draft` → `staff` → `players`
- draft: solo el creador lo ve
- staff: todo el staff del club
- players: jugadoras también lo ven

RLS: staff ve drafts propios + staff/players de su club; jugadoras solo ven visibility=players

### Split auth en UI
- Coach/head_coach (`isPlayerUX=false`): hub completo con wizard, crear/editar/publicar
- Player (`isPlayerUX=true`): `PlaybookPlayerView` — solo lectura, sin botón Nuevo
  - Si no hay planes: estado vacío con mensaje
  - Si hay planes: lista tappable → `DefensivePlanReview` con `readOnly=true`
  - Banner: "Los planes se sincronizan cuando el coach los comparte"

### Tipos de plan implementados
- `defensive` ✅ — wizard 35 pasos, 12 secciones, motor v5, persistencia Supabase
- `offensive` — placeholder (ComingSoonWizard)
- `atos` — placeholder (ComingSoonWizard)

---

## Bugs activos (por impacto)

**P1:**
- **Hero card "Mis estadísticas"** jugadoras — depende de `profile.wcba_external_id` no null.
  Verificar en Supabase que los perfiles de jugadoras tienen el campo.
- **`hasReport` en MyScout** — función mira campos de versiones antiguas (`catchAndShootFrequency`,
  `perimeterThreats`). Perfiles viejos → botón siempre dice "Ver informe". Investigar cuántos afectados.

**P2:**
- **B3**: plusMinus siempre 0 — no implementado en possessions.ts.
- **B5**: pointsByZone: split 70/30 inventado (tag "est." en UI). Pendiente Fase 4 shot coords.
- Game boxscore: falta marcador por cuartos.
- Módulos en desktop en español.
- Scout en iOS ha perdido la "U" en el icono del módulo.
- Playbook: Ofensiva y ATOs son placeholders — pendiente contenido real.
- Defensive system wizard: preguntas en inglés — decisión intencional, no traducir.
- `defensive-system-builder-v5.html` en raíz del repo — fuente de referencia, no borrar.

**Resueltos sesión 2026-05-26:**
- ✅ Fix B4: pace-segments denominador corregido (TOVs incluidos, no solo tiros)
- ✅ Playbook: botón iOS activado en HomeMobile (sin flag comingSoon)
- ✅ Playbook: `DefensivePlanReview` — vista completa del plan con todas las secciones
- ✅ Playbook: split coach/player con `isPlayerUX` + `PlaybookPlayerView`
- ✅ Playbook: migración localStorage → Supabase (`playbook_plans`)
- ✅ Playbook: pills visibilidad draft/staff/players en review (solo coach)
- ✅ Stats: hooks quintetos (`useTeamLineups`, `usePlayerOnOff`, `usePlayersCombinedLineups`)
- ✅ Stats: UI quintetos integrada en TeamSheet
- ✅ Collector: fix candidatesForPBP (status=3 + marcador entra en sync PBP)
- ✅ Ingest: GREATEST(status) — status nunca retrocede en upsert
- ✅ Collector: PBP vacío loguea como error en lugar de warning
- ✅ Partido 1106673: PBP ingestado (487 eventos), posesiones 78/76 correctas
- ✅ Diagnóstico completo temporada: 224 partidos = correcto, 0 faltantes
- ✅ Commit: `d0f2622`

---

## Pendientes futuros

- **Pi (urgente):** SCP collector actualizado (fix candidatesForPBP) + `pm2 restart ucore-collector`
- **Partido 1106673:** audit pasará a ok en próximo nightly sync (boxscore pendiente)
- **Hero card jugadoras:** verificar `profile.wcba_external_id` en Supabase
- Fase E: UI quintetos on/off más detallada (endpoints listos, UI básica implementada)
- Stats Fase 4: shot_x/shot_y hotspot data (Pi pipeline)
- iOS TestFlight: bundle <300KB gzip (actualmente ~509KB)
  - Plan: lazy i18n (~-120KB) + React.lazy code splitting (~-100KB)
- Eliminar endpoints admin sin auth (`/api/stats/admin/...`)
- Confirmar `backup/motor-v2.1-pre-20260405` estable y mergear
- OverridePanel integration — pendiente full wiring a Supabase
- Favicon replacement (muestra icono Replit)
- Club logo: upload imagen real (replace emoji picker)
- Playbook: Ofensiva y ATOs — contenido real del wizard

---

## Sesiones anteriores resumidas

### Sesión 2026-05-26 — Stats UI, Playbook Supabase, fix collector, partido 1106673

**Stats:** Fix B4 (pace-segments denominador TOVs), hooks quintetos añadidos a stats-api.ts,
UI de quintetos integrada en Stats.tsx. Todos los endpoints usan pbp_player_game_stats.

**Playbook:** Migración completa de localStorage a Supabase (tabla playbook_plans).
Split auth coach/player implementado. DefensivePlanReview con secciones completas.
Pills de visibilidad draft/staff/players. Botón iOS activado en HomeMobile.
playbook-api.ts con 4 hooks TanStack Query.

**Collector fix:** candidatesForPBP captura partidos status=3 con marcador.
GREATEST(status) en upsert de handleSchedule. PBP vacío loguea como error.
Cambios en repo pero pendientes de SCP al Pi.

**Partido 1106673** (大连 78–厦门 76, 5 dic 2025, Grupo B):
Causa raíz: API WCBA devuelve gameStatus=3 permanente para este partido.
PBP ingestado manualmente desde JSON de la web oficial (487 eventos).
Posesiones: 78pts/117poss y 76pts/113poss, diff=0.
Audit en error porque boxscore jugadoras pendiente — se resolverá en próximo sync nocturno.

**Diagnóstico temporada:** 224 partidos = correcto (132+60+9+14+4+5).
No faltan partidos. Audit: 440 ok, max_diff=0.

### Sesión 2026-05-25 — possessions v6.2, lineups endpoints, iOS safe-area
- possessions.ts v6.2: bug FTs huérfanos corregido, diff=0 verificado
- 3 endpoints stats nuevos: lineups/on-off/combined
- ModuleNav safe-area iOS
- Commits: `3ee80c3`, `d46a7e4`

### Sesión 2026-05-24 — Action codes completos, auditoría stats, collector
- Fix pbp.ts: 12 action codes nuevos añadidos
- Commit: `80a7b88`

### Sesión 2026-05-23 — PBP como fuente única, blueprint arquitectura
- 4 tablas derivadas creadas en Supabase
- Documentos: FORMULAS_STATS.md, PBP_EVENTS.md, PBP_STATS_BLUEPRINT.md
