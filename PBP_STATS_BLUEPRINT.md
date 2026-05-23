# PBP_STATS_BLUEPRINT.md
> Generado 2026-05-23. Arquitectura completa basada en PBP como fuente única.
> Boxscore = validación y auditoría solamente.

---

## 1. Principios

1. **PBP es la única fuente de verdad** para todas las stats de U Stats.
2. **Boxscore es auditoría** — se compara con PBP al final de cada sync para detectar gaps. Se muestra en UI como lazy panel opcional, nunca como fuente primaria.
3. **El Pi procesa, Railway sirve** — las tablas derivadas se calculan en el collector una vez por partido. Railway hace SELECTs simples, sin JOINs complejos ni cálculos on-the-fly.
4. **Filtrar en el output, nunca en la recolección** — todo lo que llega del API WCBA se guarda.

---

## 2. Estado actual del PBP (verificado 2026-05-23)

| Dato | Estado |
|---|---|
| `player_external_id` en eventos | 96.8% (1.872 son team events por diseño) |
| Tiros (todos los tipos) | 100% con player |
| Asistencias, robos, tapones, faltas, FTs | 100% con player |
| Sub_in / Sub_out | 100% con player — base para minutos |
| Rebotes sin player | 864 = team rebounds (correcto) |
| TOVs sin player | 1.000 = TOTLTO + TNO24S + TNOOTH (team turnovers, correcto) |
| Cobertura de partidos | 223/223 (100%) |
| `rebound_type` (off/def) | calculado en collector |
| `assisted_by_external_id` | calculado en collector |
| `stint_id` | calculado en collector |
| `home_score/away_score` por evento | guardado |
| `score_differential` | guardado |
| `lead_change`, `tie` | guardados |

**Gap conocido:** ~10% de FGM faltan en PBP vs boxscore (action codes no mapeados). Fix aplicado en esta sesión (2026-05-23) — pendiente re-sync completo.

---

## 3. Tablas derivadas a crear

El collector genera estas tres tablas al procesar cada partido. Son el núcleo del sistema.

### 3.1 `pbp_possessions`

Una fila por posesión. Unidad fundamental.

```sql
CREATE TABLE pbp_possessions (
  id                    bigserial PRIMARY KEY,
  game_id               integer REFERENCES stats_games(id),
  team_id               integer,               -- equipo en ataque
  opponent_team_id      integer,               -- equipo en defensa
  possession_number     integer,               -- orden en el partido
  quarter               integer,
  start_time_sec        integer,               -- tiempo restante al inicio (FIBA: descuenta)
  end_time_sec          integer,               -- tiempo restante al final
  duration_sec          integer,               -- start - end
  start_type            text,                  -- 'def_rebound' | 'steal' | 'made_basket' | 'live_turnover' | 'dead_ball' | 'period_start'
  end_type              text,                  -- 'shot_made' | 'shot_missed' | 'turnover' | 'foul' | 'period_end'
  points                integer DEFAULT 0,     -- puntos anotados en la posesión
  shot_attempts         integer DEFAULT 0,     -- FGA en la posesión
  ft_attempts           integer DEFAULT 0,     -- FTA en la posesión
  turnovers             integer DEFAULT 0,     -- TOVs en la posesión (máx 1 en posesión normal)
  offensive_rebounds    integer DEFAULT 0,     -- ORBs durante la posesión (second chances)
  is_transition         boolean,               -- duration_sec <= 8
  is_early_offense      boolean,               -- 8 < duration_sec <= 14
  is_halfcourt          boolean,               -- duration_sec > 14
  is_second_chance      boolean,               -- hubo ORB antes del final
  score_margin_start    integer,               -- diferencial al inicio (perspectiva equipo atacante)
  lineup_id             text,                  -- IDs jugadoras en pista separados por '-' (ordenados)
  opponent_lineup_id    text,
  season_id             integer,
  created_at            timestamptz DEFAULT now()
);

CREATE INDEX idx_pbp_poss_game ON pbp_possessions(game_id);
CREATE INDEX idx_pbp_poss_team ON pbp_possessions(team_id, season_id);
CREATE INDEX idx_pbp_poss_lineup ON pbp_possessions(lineup_id, season_id);
```

### 3.2 `pbp_player_game_stats`

Una fila por jugadora por partido. Reemplaza `stats_player_boxscores` como fuente primaria.

```sql
CREATE TABLE pbp_player_game_stats (
  id                    bigserial PRIMARY KEY,
  game_id               integer REFERENCES stats_games(id),
  player_external_id    text,
  team_id               integer,
  season_id             integer,
  -- Minutos (desde sub_in/sub_out)
  seconds_played        integer DEFAULT 0,
  -- Tiro
  fgm                   integer DEFAULT 0,
  fga                   integer DEFAULT 0,
  fg3m                  integer DEFAULT 0,
  fg3a                  integer DEFAULT 0,
  ftm                   integer DEFAULT 0,
  fta                   integer DEFAULT 0,
  pts                   integer DEFAULT 0,
  -- Rebotes
  off_reb               integer DEFAULT 0,
  def_reb               integer DEFAULT 0,
  reb                   integer DEFAULT 0,
  -- Otras stats
  ast                   integer DEFAULT 0,
  stl                   integer DEFAULT 0,
  blk                   integer DEFAULT 0,
  tov                   integer DEFAULT 0,
  fouls                 integer DEFAULT 0,
  -- Contexto
  plus_minus            integer DEFAULT 0,     -- calculado desde score_differential
  is_starter            boolean DEFAULT false, -- primer stint del partido
  created_at            timestamptz DEFAULT now(),
  UNIQUE (game_id, player_external_id)
);

CREATE INDEX idx_pbp_player_game_player ON pbp_player_game_stats(player_external_id, season_id);
CREATE INDEX idx_pbp_player_game_team ON pbp_player_game_stats(team_id, season_id);
```

### 3.3 `pbp_lineup_stats`

Una fila por combinación quinteto+partido. La métrica más avanzada.

```sql
CREATE TABLE pbp_lineup_stats (
  id                    bigserial PRIMARY KEY,
  game_id               integer REFERENCES stats_games(id),
  team_id               integer,
  lineup_id             text,                  -- IDs separados por '-', ordenados
  season_id             integer,
  -- Tiempo
  seconds_played        integer DEFAULT 0,
  -- Posesiones
  off_possessions       integer DEFAULT 0,
  def_possessions       integer DEFAULT 0,
  -- Puntos
  off_pts               integer DEFAULT 0,
  def_pts               integer DEFAULT 0,
  -- Calculados (pueden derivarse de los anteriores pero se precomputan)
  off_ppp               numeric(5,3),          -- off_pts / off_possessions
  def_ppp               numeric(5,3),          -- def_pts / def_possessions
  net_ppp               numeric(5,3),          -- off_ppp - def_ppp
  -- Desglose
  off_reb               integer DEFAULT 0,
  def_reb               integer DEFAULT 0,
  tov                   integer DEFAULT 0,
  stl                   integer DEFAULT 0,
  created_at            timestamptz DEFAULT now(),
  UNIQUE (game_id, team_id, lineup_id)
);

CREATE INDEX idx_pbp_lineup_team ON pbp_lineup_stats(team_id, season_id);
CREATE INDEX idx_pbp_lineup_id ON pbp_lineup_stats(lineup_id, season_id);
```

---

## 4. Algoritmo de procesamiento por partido (collector)

El collector ejecuta esto al sincronizar cada partido. Fuente: `stats_pbp` donde `game_id = X`.

### Paso 1: Reconstruir quintetos (lineup tracking)

```
lineup_state = { team_A: Set<player_id>, team_B: Set<player_id> }

Para cada evento ordenado por sequence:
  Si event_type = 'sub_in':
    lineup_state[team_id].add(player_external_id)
  Si event_type = 'sub_out':
    lineup_state[team_id].delete(player_external_id)
  
  → lineup_id = lineup_state[team_id].sort().join('-')
  → opponent_lineup_id = lineup_state[opponent].sort().join('-')

Inicio de partido: los 5 primeros sub_in de cada equipo = titulares.
Si no hay sub_in iniciales: usar is_start_lineup del boxscore como fallback.
```

### Paso 2: Detectar posesiones

```
Evento de inicio de posesión:
  - def_rebound (rebound donde rebound_type = 'defensive')
  - steal
  - ft_made (último FT de la serie — FTH11M, FTH22M, FTH33M)
  - shot_made / shot_made_3 (el rival acaba de anotar → inbound)
  - period_start (inicio de cuarto)
  - live_turnover (steal directo)

Evento de fin de posesión:
  - shot_made / shot_made_3 → end_type = 'shot_made', points += 2 o 3
  - shot_missed sin ORB propio → end_type = 'shot_missed'
  - turnover → end_type = 'turnover'
  - foul que lleva a FTs → end_type = 'foul'
  - último FT → end_type depende de si made o missed

ORB dentro de posesión:
  - rebound donde rebound_type = 'offensive' → is_second_chance = true
  - la posesión CONTINÚA (no termina), shot_clock reset a 14s
```

### Paso 3: Calcular minutos jugados por jugadora

```
Para cada stint (tramo entre sustituciones):
  tiempo_inicio = clock_sec del evento sub_in (o inicio del cuarto)
  tiempo_fin    = clock_sec del evento sub_out (o fin del cuarto)
  seconds_played += tiempo_inicio - tiempo_fin

Cuartos FIBA: 10 min = 600 segundos
Overtime: 5 min = 300 segundos (quarter >= 5)
```

### Paso 4: Atribuir stats a jugadoras

```
shot_made/shot_made_3 → fgm, fg3m, pts al player_external_id
shot_missed/shot_missed_3 → fga, fg3a al player_external_id
ft_made → ftm al player_external_id
ft_missed → fta al player_external_id
rebound (defensive) → def_reb al player_external_id
rebound (offensive) → off_reb al player_external_id
assist → ast al assisted_by_external_id (ya está calculado en PBP)
steal → stl al player_external_id
block → blk al player_external_id
turnover (con player) → tov al player_external_id
foul → fouls al player_external_id
```

### Paso 5: Plus/minus por jugadora

```
Para cada stint donde jugadora está en pista:
  pts_equipo_en_stint = suma de puntos anotados por el equipo
  pts_rival_en_stint  = suma de puntos del rival
  plus_minus += pts_equipo_en_stint - pts_rival_en_stint
```

### Paso 6: Stats de quinteto

```
Para cada posesión:
  lineup_id = quinteto en pista del equipo atacante
  → off_possessions[lineup_id]++
  → off_pts[lineup_id] += points de la posesión

  opponent_lineup_id = quinteto del equipo defensor
  → def_possessions[opponent_lineup_id]++
  → def_pts[opponent_lineup_id] += points de la posesión

  seconds_played[lineup_id] += duration_sec de la posesión
```

---

## 5. Validación vs Boxscore

Al final del procesamiento de cada partido, comparar:

```
diff_pts = box_pts - pbp_pts
diff_reb = box_reb - pbp_reb
diff_ast = box_ast - pbp_ast

Si ABS(diff_pts) > 5:
  → loggear como WARNING
  → guardar en stats_sync_log con detalle del gap
  → NO bloquear — guardar PBP igualmente

Si diff_ast = 0 y diff_stl = 0 y diff_blk = 0:
  → PBP fiable para estas métricas ✅
```

La UI puede mostrar un badge "Verificado vs boxscore" o "Gap: +3 pts" en la ficha del partido.

---

## 6. Métricas que se habilitan

### Individuales (desde pbp_player_game_stats)
- Minutos reales por partido y temporada
- PPG, RPG, APG, SPG, BPG, TOV — misma fuente que el equipo
- FG%, 3P%, FT%, eFG%, TS% — mismas fórmulas, misma fuente
- Plus/minus real (desde score_differential en pista)
- USG% — ahora con minutos reales, no estimados

### Equipo (desde pbp_possessions)
- PPP total = SUM(points) / COUNT(possessions) — misma fuente que PPP por tramo
- PPP por tramo (Transition/Early Offense/Halfcourt) — mismo denominador que PPP total ✅
- ORTG = PPP * 100
- Pace = (off_possessions + def_possessions) / 2 / games
- Second chance PPP = PPP filtrado por is_second_chance = true
- Clutch PPP = PPP filtrado por ABS(score_margin_start) <= 5 AND quarter >= 4
- PPP por tipo de inicio (def_rebound vs steal vs after_basket)

### Quintetos (desde pbp_lineup_stats)
- Mejores/peores combinaciones de 5 por net_ppp
- On/Off: rendimiento del equipo con/sin cada jugadora
- Tiempo jugado por quinteto

### Liga (agregando pbp_possessions de todos los equipos)
- PPP de liga = benchmark real desde misma fuente
- Pace de liga
- Distribución Transition/Early/Halfcourt de liga

---

## 7. Orden de implementación

### Fase A — Schema Supabase (1 día)
Crear las 3 tablas con el SQL de la sección 3.
Ejecutar en Supabase SQL Editor directamente.

### Fase B — Collector: procesador de partidos (3-4 días)
Nuevo módulo `collector/src/sync/possessions.ts`:
- Leer stats_pbp por game_id
- Ejecutar pasos 1-6 del algoritmo
- Enviar a Railway via ingest endpoint

### Fase C — Ingest: nuevos handlers (1 día)
En `server/stats-ingest.ts`, añadir handlers para:
- `pbp_possessions`
- `pbp_player_game_stats`
- `pbp_lineup_stats`

### Fase D — Routes: reescribir endpoints (3-4 días)
Reescribir en `server/routes.ts`:
- `/api/stats/player/:id` → desde `pbp_player_game_stats`
- `/api/stats/players` → desde `pbp_player_game_stats`
- `/api/stats/team/:id` → desde `pbp_possessions`
- `/api/stats/league-averages` → desde `pbp_possessions`
- `/api/stats/team/:id/pace-segments` → simplificado (datos ya calculados)
- Nuevo: `/api/stats/team/:id/lineups`
- Nuevo: `/api/stats/player/:id/on-off`

### Fase E — UI: vaciar fuente actual, conectar nueva (2-3 días)
- Stats.tsx: cambiar hooks para consumir nuevos endpoints
- Añadir pestaña Quintetos en TeamSheet
- Boxscore como lazy panel de auditoría

### Fase F — Re-sync histórico (automático)
- TRUNCATE pbp_possessions, pbp_player_game_stats, pbp_lineup_stats
- El collector reprocesa los 223 partidos con el nuevo módulo
- Estimado: 30-60 minutos en el Pi

---

## 8. Notas críticas

**Sub_in/Sub_out asimetría:** hay 6.431 sub_in vs 5.301 sub_out. La diferencia son los jugadores que terminan el partido en pista (nunca sub_out porque el partido acaba). El algoritmo debe cerrar todos los stints abiertos al final de cada cuarto.

**Quintetos al inicio de partido:** el PBP no siempre tiene 5 sub_in explícitos al inicio. Usar `is_start_lineup` del boxscore como seed para los quintetos iniciales, luego actualizarlos con los sub_in/sub_out del PBP.

**Overtime:** cuartos 5+ tienen 5 minutos (300s), no 10. El algoritmo debe detectar `quarter >= 5` para el cálculo de minutos.

**Consistencia PPP:** el PPP total del equipo calculado desde `pbp_possessions` debe cuadrar con el PPP por tramo. Si no cuadra, hay un bug en la detección de posesiones. El test de consistencia es:
```
PPP_total = SUM(points) / COUNT(*) WHERE game_id IN (equipo)
PPP_tramo = SUM(ppp_tramo * pct_tramo)  -- promedio ponderado
Diferencia aceptable: < 0.02
```
