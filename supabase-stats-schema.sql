-- ============================================================
-- U Core — U Stats Schema completo
-- Ejecutar en Supabase SQL Editor (una sola vez)
-- Generado: 2 mayo 2026
-- ============================================================
-- INSTRUCCIONES:
--   1. Abre Supabase → SQL Editor
--   2. Pega todo este archivo
--   3. Ejecuta (Run)
--   4. Verifica que no hay errores
-- ============================================================

-- ─── EQUIPOS ─────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS stats_teams (
  id               SERIAL PRIMARY KEY,
  external_id      INTEGER NOT NULL UNIQUE,   -- teamId de la API WCBA
  name_zh          TEXT NOT NULL,
  name_en          TEXT,
  logo_url         TEXT,
  competition_id   INTEGER DEFAULT 56,
  created_at       TIMESTAMPTZ DEFAULT NOW(),
  updated_at       TIMESTAMPTZ DEFAULT NOW()
);

-- ─── JUGADORAS ───────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS stats_players (
  id               SERIAL PRIMARY KEY,
  external_id      INTEGER NOT NULL UNIQUE,   -- playerId / userId de la API WCBA
  name_zh          TEXT NOT NULL,
  name_en          TEXT,
  team_id          INTEGER REFERENCES stats_teams(id),
  is_foreign       BOOLEAN DEFAULT FALSE,
  jersey_number    INTEGER,
  position         TEXT,
  created_at       TIMESTAMPTZ DEFAULT NOW(),
  updated_at       TIMESTAMPTZ DEFAULT NOW()
);

-- ─── PARTIDOS ────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS stats_games (
  id               SERIAL PRIMARY KEY,
  external_game_id INTEGER NOT NULL UNIQUE,   -- gameId de la API WCBA
  match_id         INTEGER,                   -- matchId (para matchinfoscores)
  season_id        INTEGER NOT NULL,
  competition_id   INTEGER DEFAULT 56,
  phase_id         INTEGER,
  round_id         INTEGER,
  home_team_id     INTEGER REFERENCES stats_teams(id),
  away_team_id     INTEGER REFERENCES stats_teams(id),
  home_score       INTEGER,
  away_score       INTEGER,
  home_q1          INTEGER, home_q2 INTEGER, home_q3 INTEGER, home_q4 INTEGER,
  away_q1          INTEGER, away_q2 INTEGER, away_q3 INTEGER, away_q4 INTEGER,
  scheduled_at     TIMESTAMPTZ,
  status           INTEGER DEFAULT 0,         -- 4 = finalizado
  created_at       TIMESTAMPTZ DEFAULT NOW(),
  updated_at       TIMESTAMPTZ DEFAULT NOW()
);

-- ─── BOXSCORES INDIVIDUALES (por jugadora por partido) ────────────────────────
CREATE TABLE IF NOT EXISTS stats_boxscores (
  id               SERIAL PRIMARY KEY,
  game_id          INTEGER REFERENCES stats_games(id),
  player_id        INTEGER REFERENCES stats_players(id),
  player_external_id INTEGER,
  team_id          INTEGER REFERENCES stats_teams(id),
  season_id        INTEGER,
  is_starter       BOOLEAN,
  minutes          NUMERIC,
  pts              INTEGER DEFAULT 0,
  reb              INTEGER DEFAULT 0,
  ast              INTEGER DEFAULT 0,
  stl              INTEGER DEFAULT 0,
  blk              INTEGER DEFAULT 0,
  tov              INTEGER DEFAULT 0,
  fgm              INTEGER DEFAULT 0,
  fga              INTEGER DEFAULT 0,
  tpm              INTEGER DEFAULT 0,         -- triples anotados
  tpa              INTEGER DEFAULT 0,         -- triples intentados
  ftm              INTEGER DEFAULT 0,
  fta              INTEGER DEFAULT 0,
  plus_minus       INTEGER,
  eff              NUMERIC,
  fg_pct           NUMERIC,
  tp_pct           NUMERIC,
  ft_pct           NUMERIC,
  created_at       TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(game_id, player_id)
);

-- ─── STATS DE TEMPORADA (promedios acumulados por fase) ───────────────────────
CREATE TABLE IF NOT EXISTS stats_season (
  id               SERIAL PRIMARY KEY,
  player_id        INTEGER REFERENCES stats_players(id),
  player_external_id INTEGER,
  team_id          INTEGER REFERENCES stats_teams(id),
  season_id        INTEGER NOT NULL,
  phase_id         INTEGER,
  games            INTEGER DEFAULT 0,
  minutes          NUMERIC,
  pts              NUMERIC,
  reb              NUMERIC,
  ast              NUMERIC,
  stl              NUMERIC,
  blk              NUMERIC,
  tov              NUMERIC,
  fgm              NUMERIC,
  fga              NUMERIC,
  tpm              NUMERIC,
  tpa              NUMERIC,
  ftm              NUMERIC,
  fta              NUMERIC,
  eff              NUMERIC,
  fg_pct           NUMERIC,
  tp_pct           NUMERIC,
  ft_pct           NUMERIC,
  updated_at       TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(player_external_id, season_id, phase_id)
);

-- ─── PLAY BY PLAY ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS stats_pbp (
  id                      SERIAL PRIMARY KEY,
  game_id                 INTEGER REFERENCES stats_games(id),
  external_game_id        INTEGER,
  quarter                 INTEGER,
  clock                   TEXT,              -- "MM:SS" tal como viene de la API
  sequence                INTEGER,           -- orden dentro del partido
  event_type              TEXT,              -- normalizado desde ACTION_CODE_MAP
  action_code             TEXT,              -- raw de la API WCBA (EN)
  event_zh                TEXT,              -- action_title original chino, raw
  player_external_id      INTEGER,
  player_id               INTEGER REFERENCES stats_players(id),
  team_id                 INTEGER REFERENCES stats_teams(id),
  action_owner_team       TEXT,              -- "Home" | "Away"
  home_score              INTEGER,
  away_score              INTEGER,

  -- Enriquecimiento calculado en el collector
  score_differential      INTEGER,           -- home_score - away_score
  lead_change             BOOLEAN,           -- cambia el liderato en este evento
  tie                     BOOLEAN,           -- empate en este evento
  current_momentum_run    INTEGER,           -- racha de puntos consecutivos en curso
  stint_id                INTEGER,           -- tramo entre sustituciones
  rebound_type            TEXT,              -- 'offensive' | 'defensive' | NULL
  assisted_by_external_id INTEGER,           -- player_id del asistente inferido

  -- Shot chart (del endpoint hotspotdata)
  shot_x                  NUMERIC,           -- coordenada X normalizada sistema Home (0-1)
  shot_y                  NUMERIC,           -- coordenada Y normalizada sistema Home (0-1)
  shot_made               BOOLEAN,           -- true=encestado false=fallado null=no es tiro
  shot_zone               TEXT,              -- restricted_area|paint_non_ra|midrange_baseline|midrange_elbow|three_corner|three_above_break
  shot_band_side          TEXT,              -- top_band|center|bottom_band
  shot_dist_m             NUMERIC,           -- distancia exacta al aro en metros

  created_at              TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(game_id, sequence)
);

-- ─── CLASIFICACIÓN ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS stats_standings (
  id                  SERIAL PRIMARY KEY,
  team_id             INTEGER REFERENCES stats_teams(id),
  team_external_id    INTEGER,
  season_id           INTEGER NOT NULL,
  phase_id            TEXT,
  phase_name          TEXT,
  rank                INTEGER,
  wins                INTEGER DEFAULT 0,
  losses              INTEGER DEFAULT 0,
  win_pct             NUMERIC,
  pts_per_game        NUMERIC,
  pts_against_per_game NUMERIC,
  goal_diff           NUMERIC,
  streak              INTEGER,               -- racha actual (+= victorias, -= derrotas)
  last10_wins         INTEGER,
  last10_losses       INTEGER,
  home_wins           INTEGER,
  home_losses         INTEGER,
  away_wins           INTEGER,
  away_losses         INTEGER,
  updated_at          TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(team_external_id, season_id, phase_id)
);

-- ─── CACHE DE MÉTRICAS AVANZADAS ─────────────────────────────────────────────
-- Calculadas en Railway sobre los datos crudos, guardadas para servir rápido a la UI
CREATE TABLE IF NOT EXISTS stats_insights_cache (
  id               SERIAL PRIMARY KEY,
  entity_type      TEXT NOT NULL,            -- 'player' | 'team'
  entity_id        INTEGER NOT NULL,         -- player_id o team_id
  season_id        INTEGER NOT NULL,
  metric_key       TEXT NOT NULL,            -- nombre de la métrica
  metric_value     NUMERIC,
  metric_json      JSONB,                    -- para métricas complejas (distribuciones, etc.)
  computed_at      TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(entity_type, entity_id, season_id, metric_key)
);

-- ─── LOG DE SINCRONIZACIÓN ────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS stats_sync_log (
  id               SERIAL PRIMARY KEY,
  sync_type        TEXT NOT NULL,            -- 'standings'|'schedule'|'boxscores'|'player_stats'|'pbp'
  season_id        INTEGER,
  records_processed INTEGER DEFAULT 0,
  status           TEXT DEFAULT 'ok',        -- 'ok' | 'error' | 'partial'
  error_message    TEXT,
  started_at       TIMESTAMPTZ DEFAULT NOW(),
  finished_at      TIMESTAMPTZ
);

-- ─── ÍNDICES ─────────────────────────────────────────────────────────────────
-- PBP es la tabla más consultada — índices críticos
CREATE INDEX IF NOT EXISTS idx_pbp_game       ON stats_pbp(game_id);
CREATE INDEX IF NOT EXISTS idx_pbp_player     ON stats_pbp(player_external_id);
CREATE INDEX IF NOT EXISTS idx_pbp_shot_zone  ON stats_pbp(shot_zone) WHERE shot_zone IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_pbp_quarter    ON stats_pbp(quarter);
CREATE INDEX IF NOT EXISTS idx_pbp_shot_coords ON stats_pbp(shot_x, shot_y) WHERE shot_x IS NOT NULL;

-- Boxscores
CREATE INDEX IF NOT EXISTS idx_boxscores_player  ON stats_boxscores(player_id);
CREATE INDEX IF NOT EXISTS idx_boxscores_game    ON stats_boxscores(game_id);
CREATE INDEX IF NOT EXISTS idx_boxscores_season  ON stats_boxscores(season_id);

-- Season stats
CREATE INDEX IF NOT EXISTS idx_season_player  ON stats_season(player_external_id);
CREATE INDEX IF NOT EXISTS idx_season_team    ON stats_season(team_id);
CREATE INDEX IF NOT EXISTS idx_season_season  ON stats_season(season_id);

-- Standings
CREATE INDEX IF NOT EXISTS idx_standings_season ON stats_standings(season_id);

-- Insights cache
CREATE INDEX IF NOT EXISTS idx_insights_entity ON stats_insights_cache(entity_type, entity_id, season_id);

-- Juegos
CREATE INDEX IF NOT EXISTS idx_games_season   ON stats_games(season_id);
CREATE INDEX IF NOT EXISTS idx_games_teams    ON stats_games(home_team_id, away_team_id);

-- ─── COMENTARIOS ─────────────────────────────────────────────────────────────
COMMENT ON TABLE stats_pbp IS 'Play-by-play completo WCBA. Fuente: /api/v2/game/{id}/actions + hotspotdata. Filosofía: guardar todo, filtrar en output.';
COMMENT ON COLUMN stats_pbp.shot_zone     IS 'restricted_area|paint_non_ra|midrange_baseline|midrange_elbow|three_corner|three_above_break. Calibrado 2 mayo 2026 con 2 partidos reales.';
COMMENT ON COLUMN stats_pbp.shot_band_side IS 'top_band (y>0.56) | center (0.44-0.56) | bottom_band (y<0.44). Eje Y compartido Home/Away.';
COMMENT ON COLUMN stats_pbp.shot_dist_m   IS 'Distancia exacta al aro en metros. ARO HOME: x=0.0575, y=0.501. Cancha 28m x 15m.';
COMMENT ON COLUMN stats_pbp.score_differential IS 'home_score - away_score en el momento exacto del evento.';
COMMENT ON COLUMN stats_pbp.current_momentum_run IS 'Puntos consecutivos del mismo equipo en curso en este momento del partido.';
COMMENT ON COLUMN stats_pbp.stint_id     IS 'Tramo entre sustituciones. Incrementa en cada SUB. Usado para calcular lineup +/-.';
COMMENT ON COLUMN stats_pbp.rebound_type IS 'offensive: el equipo que acaba de fallar recupera el rebote. defensive: el rival recupera.';
COMMENT ON COLUMN stats_pbp.assisted_by_external_id IS 'Inferido: MADE2/MADE3 precedido de evento del mismo equipo, distinto user_id.';
COMMENT ON TABLE stats_insights_cache IS 'Métricas derivadas precalculadas: eFG%, TS%, ORB%, lateral_bias, shot_spatial_entropy, PIE, lineup +/-, etc.';

-- ─── VERIFICACIÓN ─────────────────────────────────────────────────────────────
-- Ejecutar esto al final para confirmar que todo se creó correctamente:
SELECT
  table_name,
  (SELECT COUNT(*) FROM information_schema.columns WHERE table_name = t.table_name AND table_schema = 'public') as columns
FROM (
  VALUES
    ('stats_teams'), ('stats_players'), ('stats_games'),
    ('stats_boxscores'), ('stats_season'), ('stats_pbp'),
    ('stats_standings'), ('stats_insights_cache'), ('stats_sync_log')
) AS t(table_name)
ORDER BY table_name;
