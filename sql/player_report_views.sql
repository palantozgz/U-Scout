-- STATUS: Verify if this has been applied in Supabase. If not applied, run in Supabase SQL Editor.
-- U Scout — player_report_views (Bloque B: slide-level read tracking for player mode)
-- Apply manually in Supabase SQL editor or psql. Do not run via drizzle-kit push unless you intend to sync schema.

CREATE TABLE IF NOT EXISTS player_report_views (
  id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid()::text,
  user_id VARCHAR NOT NULL,
  player_id VARCHAR NOT NULL REFERENCES players(id) ON DELETE CASCADE,
  slide_index INTEGER NOT NULL CHECK (slide_index >= 0 AND slide_index <= 4),
  viewed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT player_report_views_user_player_slide UNIQUE (user_id, player_id, slide_index)
);

CREATE INDEX IF NOT EXISTS idx_player_report_views_user ON player_report_views(user_id);
CREATE INDEX IF NOT EXISTS idx_player_report_views_player ON player_report_views(player_id);
