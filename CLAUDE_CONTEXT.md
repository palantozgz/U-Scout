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
| Comandos en Mac (git, npm, python) | `Control your Mac:osascript` + do shell script |
| Comandos en Pi | osascript + `ssh pablo@192.168.1.7` (password: skapol) |
| Copiar archivos al Pi | osascript + scp |

### Credenciales
```
SUPA_URL = https://ybpzvkkxcmwwxrrouyhm.supabase.co
SK       = $(grep SUPABASE_SERVICE_ROLE_KEY /Users/palant/Downloads/U\ scout/.env | cut -d= -f2)
Pi IP    = 192.168.1.7  usuario=pablo  password=skapol
```

### Patrón osascript para Supabase
```applescript
set SK to (do shell script "grep SUPABASE_SERVICE_ROLE_KEY /Users/palant/Downloads/U\\ scout/.env | cut -d= -f2")
set SUPA to "https://ybpzvkkxcmwwxrrouyhm.supabase.co"
do shell script "curl -s '" & SUPA & "/rest/v1/TABLA?...' -H 'apikey: " & SK & "' -H 'Authorization: Bearer " & SK & "'"
```

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
stats_pbp → possessions.ts v6.4 (Railway) → tablas derivadas (team_id = internal)
```

### possessions.ts v6.4 — cambios sesión 2026-06-02
- `offFg3m`, `offFga`, `offFta` añadidos a `LineupStats` interface
- Acumulados en `accumulate()` y propagados en `closePoss()` a `offLu`
- Persistidos en `pbp_lineup_stats` (INSERT + ON CONFLICT UPDATE)
- **Fix audit:** `p.teamId === tid` (internal) en lugar de `=== extId` — era el bug raíz de audit siempre error
- Commit: `c343b8d`

### pbp_lineup_stats — columnas añadidas sesión 2026-06-02
```sql
ALTER TABLE pbp_lineup_stats
  ADD COLUMN IF NOT EXISTS off_fg3m integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS off_fga  integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS off_fta  integer NOT NULL DEFAULT 0;
```
Ya ejecutado en Supabase. ✅

---

## Estado DB — 2026-06-02

- **Reprocesado lanzado** con `fast_reprocess.py` (script nuevo): 224/224 requests ok en 0.5min
- Railway procesando posesiones en background (async fire-and-forget)
- **Verificar al inicio de próxima sesión:**
  ```
  SELECT status, COUNT(*) FROM pbp_audit_log WHERE season_id=2092 GROUP BY status;
  ```
  Debe dar: ok=448, error=0, max_diff=0
- `fast_reprocess.py` reemplaza `reset_and_reprocess.py` — es el script canónico de ahora en adelante

---

## Endpoints de stats

| Endpoint | Fuente | Estado |
|---|---|---|
| `/api/stats/players` | `pbp_player_game_stats` | ✅ |
| `/api/stats/player/:id` | `pbp_player_game_stats` | ✅ |
| `/api/stats/standings` | `stats_standings` + `pbp_possessions` | ✅ |
| `/api/stats/team/:id` | `pbp_possessions` + `pbp_player_game_stats` | ✅ |
| `/api/stats/team/:id/pace-segments` | `pbp_possessions` | ✅ |
| `/api/stats/team/:id/lineups` | `pbp_lineup_stats` | ✅ pendiente T1+T3C (Cursor) |
| `/api/stats/league-averages` | `pbp_player_game_stats` + `pbp_possessions` | ✅ |
| `/api/stats/game/:id/boxscore` | `stats_player_boxscores` | ✅ |

---

## Bugs activos

**P1:**
- Hero card "Mis estadísticas" jugadoras — depende de `profile.wcba_external_id` no null

**P2:**
- `pointsByZone` 70/30 hardcodeado — bloqueado hasta shot_x/y/zone disponibles
- Nombres de lineups ignoran locale — pendiente prompt Cursor T1+T3C
- TOV% en tabla de quintetos — pendiente mismo prompt Cursor T1+T3C

**Resueltos sesión 2026-06-02:**
- ✅ T2: `hasReport` en MyScout — ahora usa `archetype !== 'arch_role_player'` OR `frequency === 'Primary'`
- ✅ T3A: `offFg3m/offFga/offFta` en possessions.ts v6.4
- ✅ T3B: SQL columnas en `pbp_lineup_stats`
- ✅ Bug audit `pbp_pts=0` — filtro `tid` (internal) en lugar de `extId`
- ✅ `fast_reprocess.py`: reprocesado 224 partidos en 0.5min (antes 8-10h)
- ✅ Commit: `c343b8d`

---

## Pendientes próxima sesión

1. **Verificar audit** al inicio: `ok=448, max_diff=0`
2. **Cursor T1+T3C**: locale en lineups + TOV% (prompt listo abajo)
3. **T4 shot chart**: verificar `SELECT shot_zone, COUNT(*) FROM stats_pbp WHERE shot_zone IS NOT NULL GROUP BY shot_zone` — si devuelve filas, implementar
4. **T5 bundle**: sesión dedicada — leer `client/src/lib/i18n.ts` primero
5. **Pi procesador**: arquitectura futura — mover `processAllPendingPossessions` al collector del Pi para eliminar dependencia de Railway en reprocesados masivos
6. **fast_reprocess.py mejora**: añadir verificación con espera real en Supabase por partido (no solo contar ok de HTTP response)

---

## Prompt Cursor pendiente — T1 + T3C (locale lineups + TOV%)

```
Lee antes de tocar nada:
- server/routes.ts (endpoint GET /api/stats/team/:id/lineups, línea 2880)
- client/src/lib/stats-api.ts (interface LineupRow, normalizeLineupRow, ~línea 504)
- client/src/pages/core/Stats.tsx (función lineupShortNames, ~línea 155)

CAMBIO 1 — routes.ts, endpoint /api/stats/team/:id/lineups
En el bloque "const playerNames: Record<string, string> = {};" reemplaza TODO ese bloque por:

  const playerNamesZh: Record<string, string> = {};
  const playerNamesEn: Record<string, string> = {};
  if (allPlayerIds.size > 0) {
    const ids = Array.from(allPlayerIds).map(Number).filter((n) => !isNaN(n));
    if (ids.length > 0) {
      const namesRes = await db.execute(sql`
        SELECT external_id, name_zh, name_en
        FROM stats_players
        WHERE external_id::text IN (${sql.join(ids.map((id: number) => sql`${String(id)}`), sql`, `)})
      `);
      for (const p of (namesRes as any).rows ?? []) {
        playerNamesZh[String(p.external_id)] = String(p.name_zh?.trim() || p.name_en?.trim() || p.external_id);
        playerNamesEn[String(p.external_id)] = String(p.name_en?.trim() || p.name_zh?.trim() || p.external_id);
      }
    }
  }

En la query SQL del SELECT, añade al final del bloque SELECT (antes del FROM):
  SUM(off_fg3m) AS off_fg3m,
  SUM(off_fga)  AS off_fga,
  SUM(off_fta)  AS off_fta

En el objeto enrichedRows:
- Reemplaza la línea "playerNames:" por estas tres:
  playerNamesZh: String(r.lineup_id).split("-").map((id: string) => playerNamesZh[id] ?? id),
  playerNamesEn: String(r.lineup_id).split("-").map((id: string) => playerNamesEn[id] ?? id),
  playerNames:   String(r.lineup_id).split("-").map((id: string) => playerNamesEn[id] ?? id),
- Añade al final del objeto:
  offFg3m: Number(r.off_fg3m ?? 0),
  offFga:  Number(r.off_fga  ?? 0),
  offFta:  Number(r.off_fta  ?? 0),
  tovPct: (Number(r.off_fga ?? 0) + 0.44 * Number(r.off_fta ?? 0) + Number(r.tov ?? 0)) > 0
    ? Math.round(Number(r.tov ?? 0) /
        (Number(r.off_fga ?? 0) + 0.44 * Number(r.off_fta ?? 0) + Number(r.tov ?? 0)) * 1000) / 10
    : null,

CAMBIO 2 — stats-api.ts
En interface LineupRow añade después de "playerNames: string[]":
  playerNamesZh: string[];
  playerNamesEn: string[];
Añade al final de LineupRow:
  offFg3m: number;
  offFga:  number;
  offFta:  number;
  tovPct:  number | null;
En type LineupApiRow añade los mismos campos como opcionales.
En normalizeLineupRow añade:
  playerNamesZh: row.playerNamesZh ?? row.playerNames ?? [],
  playerNamesEn: row.playerNamesEn ?? row.playerNames ?? [],
  offFg3m: row.offFg3m ?? 0,
  offFga:  row.offFga  ?? 0,
  offFta:  row.offFta  ?? 0,
  tovPct:  row.tovPct  ?? null,

CAMBIO 3 — Stats.tsx
Reemplaza la función lineupShortNames por:
  function lineupShortNames(names: string[], locale: string): string {
    return names.map((n) => {
      const t = n.trim();
      if (/^\d+$/.test(t)) return `#${t.slice(-4)}`;
      if (locale === "zh") return t.slice(0, 2);
      const parts = t.split(/\s+/).filter(Boolean);
      return parts.length > 1 ? parts[parts.length - 1]! : (parts[0] ?? t);
    }).join(" / ");
  }
En todos los lugares donde se llama lineupShortNames, cámbialo a:
  locale === "zh"
    ? lineupShortNames(row.playerNamesZh, locale)
    : lineupShortNames(row.playerNamesEn, locale)
En la tabla de quintetos, añade columna "TOV%" después de "NET":
  row.offPossessions >= 40 && row.tovPct != null ? `${row.tovPct.toFixed(1)}%` : "—"

npm run check exit 0.
Verificar: grep -n "app.get.*lineups" server/routes.ts → debe aparecer exactamente una vez.
```

---

## Estándares de código

1. Leer código real antes de proponer
2. `npm run check` exit 0 antes de cada commit
3. Cursor para `routes.ts`
4. SQL destructivo — solo Supabase SQL Editor o scripts auditados
5. NUNCA tocar `Profile.tsx`, `schema.ts`, `migrations/`
6. Después de Cursor en routes.ts: `grep -n 'app.get.*api/stats' server/routes.ts` para detectar handlers duplicados

---

## Archivos clave
- `server/routes.ts` — endpoints API
- `server/possessions.ts` — procesador PBP **v6.4**
- `server/stats-ingest.ts` — ingest handler
- `collector/src/sync/pbp.ts` — parser PBP
- `collector/src/sync/shotZones.ts` — 6 zonas FIBA calibradas
- `client/src/lib/stats-api.ts` — hooks
- `client/src/pages/core/Stats.tsx` — UI stats
- `client/src/pages/scout/MyScout.tsx` — My Scout coach view
- `client/src/lib/mock-data.ts` — PlayerProfile, PlayerInput, motor
- `scripts/fast_reprocess.py` — **script canónico de reprocesado** (reemplaza reset_and_reprocess.py)
- `scripts/reset_and_reprocess.py` — obsoleto, no usar

## Archivos NUNCA tocar
- `Profile.tsx` · `schema.ts` · `migrations/`

---

## Lecciones aprendidas

1. **No usar reprocess_all.py ni reprocess_sync.py** — obsoletos
2. **No lanzar múltiples scripts de reprocesado en paralelo**
3. **El endpoint process-game es fire-and-forget** — HTTP 200 no significa que Supabase tenga los datos. Esperar 30-60s antes de verificar audit
4. **audit pbp_pts=0 con possessions correctas** = bug de filtro tid vs extId en el audit (ya corregido en v6.4)
5. **Paginar stats_pbp por offset es lento** (117k filas) — usar stats_games como fuente de game_ids y verificar existencia con limit=1 por partido
6. **6 workers paralelos en fast_reprocess.py**: 224 partidos en 0.5min de requests; Railway procesa en background ~10-15min

---

## Sesiones anteriores

### Sesión 2026-06-02 — Metodología herramientas, reprocesado, possessions v6.4
- Verificado estado DB: audit 446 error → causa raíz: `p.teamId === extId` en audit
- Fix audit: `p.teamId === tid` (internal) — una línea, impacto total
- T3A: offFg3m/offFga/offFta en possessions.ts + pbp_lineup_stats
- T2: hasReport en MyScout — archetype + primaryFrequency
- fast_reprocess.py: 224 partidos en 0.5min (paralelo x6, inventario eficiente)
- Commit: c343b8d

### Sesión 2026-05-31 — possessions v6.3, extToInt bidireccional
- Fix team_id interno vs externo en possessions.ts
- Commit: ed57280

### Sesión 2026-05-30 — Audit fórmulas, migración endpoints
- Commits: 9b947f9, 3d9824c

### Sesión 2026-05-27 — shotZones, infraestructura
- shotZones.ts: 6 zonas FIBA calibradas
