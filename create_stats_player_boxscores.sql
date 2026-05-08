-- ============================================================
-- U Core — Crear tabla stats_player_boxscores
-- Ejecutar en Supabase → SQL Editor
-- Esta tabla es la que usa el colector y las rutas del backend.
-- La tabla stats_boxscores del schema original es diferente.
-- ============================================================

CREATE TABLE IF NOT EXISTS stats_player_boxscores (
  id                   SERIAL PRIMARY KEY,
  game_id              INTEGER NOT NULL REFERENCES stats_games(id) ON DELETE CASCADE,
  player_external_id   TEXT NOT NULL,
  team_external_id     INTEGER,
  team_type            TEXT,                    -- 'Home' | 'Away'
  is_start_lineup      BOOLEAN DEFAULT FALSE,
  minutes              TEXT DEFAULT '00:00',    -- formato MM:SS
  pts                  INTEGER DEFAULT 0,
  off_reb              INTEGER DEFAULT 0,
  def_reb              INTEGER DEFAULT 0,
  reb                  INTEGER DEFAULT 0,
  ast                  INTEGER DEFAULT 0,
  stl                  INTEGER DEFAULT 0,
  blk                  INTEGER DEFAULT 0,
  tov                  INTEGER DEFAULT 0,
  fouls                INTEGER DEFAULT 0,
  fgm                  INTEGER DEFAULT 0,
  fga                  INTEGER DEFAULT 0,
  tpm                  INTEGER DEFAULT 0,
  tpa                  INTEGER DEFAULT 0,
  ftm                  INTEGER DEFAULT 0,
  fta                  INTEGER DEFAULT 0,
  plus_minus           INTEGER DEFAULT 0,
  created_at           TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(game_id, player_external_id)
);

CREATE INDEX IF NOT EXISTS idx_spb_game     ON stats_player_boxscores(game_id);
CREATE INDEX IF NOT EXISTS idx_spb_player   ON stats_player_boxscores(player_external_id);
CREATE INDEX IF NOT EXISTS idx_spb_team_ext ON stats_player_boxscores(team_external_id);

-- Verificar:
SELECT COUNT(*) AS total_boxscores FROM stats_player_boxscores;
