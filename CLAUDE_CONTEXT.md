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

Claude gestiona todo directamente. Solo usa prompts de Cursor para `routes.ts` (riesgo de duplicar handlers). Para todo lo demás, Claude actúa sin intermediarios.

### Decisión por tipo de tarea

| Tipo de tarea | Herramienta | Notas |
|---|---|---|
| Leer archivo del Mac | `Filesystem:read_text_file` | head/tail para archivos grandes |
| Escribir archivo completo en Mac | `filesystem:write_file` | sobrescribe sin aviso — solo para archivos no-críticos |
| Edición quirúrgica en Mac (1-3 bloques) | `Filesystem:edit_file` | falla con backticks en SQL o JSX anidado profundo |
| Edición de `routes.ts` (cualquier cambio) | **Cursor — prompt completo** | riesgo documentado de duplicar handlers |
| Analizar archivo grande copiado | `Filesystem:copy_file_user_to_claude` + `bash_tool` | grep/sed/python en contenedor Linux |
| Queries a Supabase | `Control your Mac:osascript` + `do shell script curl` | credenciales en `/Users/palant/Downloads/U scout/.env` |
| Comandos en Mac (git, npm, curl) | `Control your Mac:osascript` + `do shell script` | no sudo interactivo |
| Comandos en Pi | `osascript` + `do shell script ssh pablo@192.168.1.7` | password: `skapol` |
| Transferir archivos al Pi | `osascript` + `do shell script scp ...` | GitHub no accesible desde Pi |

### Credenciales Supabase
```
SUPA_URL = https://ybpzvkkxcmwwxrrouyhm.supabase.co
SK = $(grep SUPABASE_SERVICE_ROLE_KEY /Users/palant/Downloads/U\ scout/.env | cut -d= -f2)
```

### Pi
- IP: `192.168.1.7` · usuario: `pablo` · password: `skapol`
- PM2: `ucore-collector` · systemd startup habilitado
- Código activo: commit `d51e98f`

### Patrón osascript para Supabase
```applescript
set SK to (do shell script "grep SUPABASE_SERVICE_ROLE_KEY /Users/palant/Downloads/U\\ scout/.env | cut -d= -f2")
set SUPA to "https://ybpzvkkxcmwwxrrouyhm.supabase.co"
do shell script "curl -s '" & SUPA & "/rest/v1/TABLA?select=...&...' -H 'apikey: " & SK & "' -H 'Authorization: Bearer " & SK & "'"
```

---

## Principios de datos — NO NEGOCIABLES

1. **PBP es fuente única de verdad.** Todos los datos de stats provienen de tablas derivadas del PBP.
2. **NUNCA estimar.** Sin splits hardcodeados, sin disclaimers.
3. **`stats_player_boxscores`** — solo `/api/stats/game/:id/boxscore` (auditoría).
4. **`stats_standings`** — solo W/L/racha/rank oficial.
5. **team_id en tablas derivadas es SIEMPRE el internal id** (stats_teams.id, entero 1-18). NUNCA el external_id (entero grande >100).

### Regla crítica: team_id interno vs externo
- `stats_pbp.team_id` = external_id (de la API WCBA, ej: 723)
- `pbp_possessions.team_id` = internal id — normalizado en possessions.ts
- `pbp_player_game_stats.team_id` = internal id
- `pbp_lineup_stats.team_id` = internal id

En routes.ts, SIEMPRE comparar con `st.id` (internal), nunca con `st.external_id`.

---

## Arquitectura de datos

```
API WCBA → collector (Pi, commit d51e98f) → stats_pbp (team_id = external)
stats_pbp → possessions.ts v6.3 (Railway) → tablas derivadas (team_id = internal)
```

### possessions.ts v6.3 — fix crítico aplicado
- `extToInt` bidireccional: cubre internal→internal y external→internal
- Todas las comparaciones cambiadas a `homeTeamId` (internal) — 5 puntos en el código
- `getSnap()` usa `homeTeamId` en lugar de `homeTeamExtId`
- Commit: `ed57280`

---

## Estado DB — 2026-06-02 (PROBLEMA ACTIVO)

**⚠️ P0 — Reprocesado incompleto:**
- `pbp_audit_log`: 446 error, 2 ok, max_diff=123 — datos INVÁLIDOS en producción
- `pbp_possessions`: 36.611 filas pero solo ~1 partido realmente procesado (game_id=1)
- Causa: `reset_and_reprocess.py` del 2026-05-31 hizo DELETE pero no completó el reprocesado
- **Acción necesaria: relanzar `reset_and_reprocess.py` hasta diff=0 en todos los partidos**
- NO tocar datos de stats hasta que audit muestre ok=448, max_diff=0

---

## Endpoints de stats

| Endpoint | Fuente | Estado |
|---|---|---|
| `/api/stats/players` | `pbp_player_game_stats` | ✅ código correcto |
| `/api/stats/player/:id` | `pbp_player_game_stats` | ✅ |
| `/api/stats/standings` | `stats_standings` + `pbp_possessions` | ✅ |
| `/api/stats/team/:id` | `pbp_possessions` + `pbp_player_game_stats` | ✅ |
| `/api/stats/team/:id/pace-segments` | `pbp_possessions` | ✅ |
| `/api/stats/team/:id/lineups` | `pbp_lineup_stats` | ✅ |
| `/api/stats/league-averages` | `pbp_player_game_stats` + `pbp_possessions` | ✅ |
| `/api/stats/game/:id/boxscore` | `stats_player_boxscores` | ✅ único uso legítimo |

---

## Bugs activos

**P0:**
- Reprocesado incompleto — relanzar `reset_and_reprocess.py` antes de cualquier validación de datos

**P1:**
- `hasReport` en MyScout siempre true — evalúa campos obsoletos (`catchAndShootFrequency`, `perimeterThreats`)
- Hero card "Mis estadísticas" jugadoras — depende de `profile.wcba_external_id` no null

**P2:**
- `pointsByZone` 70/30 hardcodeado — bloqueado hasta shot_x/y/zone disponibles
- Lineup eFG%/TOV% — pendiente (requiere off_fg3m/off_fga/off_fta en pbp_lineup_stats)
- Nombres de lineups ignoran locale — siempre name_en
- `ownTeamName` = "Inner Mongolia" hardcodeado en Stats.tsx

---

## Tareas pendientes (sesión 2026-06-02)

1. **P0: relanzar reprocesado** — `reset_and_reprocess.py` completo hasta audit=0
2. **T2: fix hasReport** — `client/src/pages/scout/MyScout.tsx`, función `hasReportInputs`
   - Fix: `archetype !== 'arch_role_player'` OR al menos un frequency === 'Primary'
   - Método: `Filesystem:edit_file` directo (cambio quirúrgico ~15 líneas)
3. **T1: locale en nombres de lineups** — routes.ts + stats-api.ts + Stats.tsx
   - Método: Cursor (toca routes.ts) — prompt ya redactado en sesión anterior
4. **T3: eFG%/TOV% en lineups** — 3 pasos: SQL Supabase → possessions.ts → routes.ts + UI
   - Paso B SQL: ejecutar directo en Supabase SQL Editor (no necesita Claude)
   - Paso A possessions.ts: `Filesystem:edit_file` o Cursor según complejidad
   - Paso C routes.ts + UI: Cursor
5. **T4: shot chart** — verificar `SELECT shot_zone, COUNT(*) FROM stats_pbp WHERE shot_zone IS NOT NULL GROUP BY shot_zone` antes de implementar nada
6. **T5: bundle iOS <300KB** — sesión dedicada; leer i18n.ts primero

---

## Estándares de código

1. Leer código real antes de proponer
2. `npm run check` exit 0 antes de cada commit
3. Cursor para `routes.ts` — edit_file solo para cambios de 1-2 líneas sin backticks ni JSX anidado
4. SQL destructivo — solo Supabase SQL Editor o scripts auditados
5. NUNCA tocar `Profile.tsx`, `schema.ts`, `migrations/`
6. Después de Cursor en routes.ts: `grep -n 'app.get.*api/stats' server/routes.ts` para detectar handlers duplicados

---

## Archivos clave
- `server/routes.ts` — endpoints API
- `server/possessions.ts` — procesador PBP v6.3
- `server/stats-ingest.ts` — ingest handler
- `collector/src/sync/pbp.ts` — parser PBP
- `collector/src/sync/shotZones.ts` — 6 zonas FIBA calibradas
- `client/src/lib/stats-api.ts` — hooks
- `client/src/pages/core/Stats.tsx` — UI stats
- `client/src/pages/scout/MyScout.tsx` — My Scout coach view
- `client/src/lib/mock-data.ts` — PlayerProfile, PlayerInput, motor
- `scripts/reset_and_reprocess.py` — script de reprocesado limpio (**único válido**)
- `scripts/audit_full.py` — verificación de integridad

## Archivos NUNCA tocar
- `Profile.tsx` · `schema.ts` · `migrations/`

---

## Lecciones aprendidas — NO repetir

1. **No usar reprocess_all.py ni reprocess_sync.py** — obsoletos, compiten entre sí
2. **Verificar team_id (internal vs external) antes de deployar cualquier cambio en possessions.ts**
3. **No lanzar múltiples scripts de reprocesado en paralelo**
4. **El DELETE en reset_and_reprocess.py es inmediato** — los datos en producción quedan rotos hasta que termine el reprocesado. No interrumpir.
5. **audit_log status=error con pbp_pts=0** significa que pbp_possessions está vacía para ese partido, no que haya un bug en el procesador

---

## Sesiones anteriores

### Sesión 2026-06-02 — Revisión metodología herramientas, planificación T1-T5
- Verificado estado real DB: reprocesado incompleto (446 error, 2 ok, max_diff=123)
- Actualizado CLAUDE_CONTEXT.md con metodología de herramientas por tipo de tarea
- Prompts Cursor redactados para T1 (locale lineups), T3C (eFG%/TOV% UI)
- Fix hasReport diagnosticado — listo para ejecutar con edit_file

### Sesión 2026-05-31 — Bugs team_id, reprocesado, reset limpio
- Fix possessions.ts v6.3: extToInt bidireccional, comparaciones a homeTeamId (internal)
- reset_and_reprocess.py creado y lanzado — quedó incompleto (solo ~1 partido procesado)
- Commit: `ed57280`

### Sesión 2026-05-30 — Audit fórmulas completo
- pace-segments desde pbp_possessions (commit 9b947f9)
- avgPpg liga fix subquery por equipo/partido (commit 3d9824c)
- Todos los endpoints migrados a PBP

### Sesión 2026-05-27 — Infraestructura, shotZones, migración endpoints
- shotZones.ts: 6 zonas FIBA calibradas
- Migración endpoints a tablas derivadas
