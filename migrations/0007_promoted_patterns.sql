-- Nivel B / "el decantador" (spec 38/39): patrones de sustitución promovidos
-- a permanentes por un entrenador con permiso de calibración. Reversible por
-- diseño -- status+revertedBy/At en la misma fila (no DELETE) para conservar
-- historial. Un solo patrón "activo" a la vez por club+arquetipo+campo
-- (índice único parcial); revertir y promocionar de nuevo crea una fila
-- nueva, conservando el intento anterior como historial auditable.
CREATE TABLE IF NOT EXISTS promoted_patterns (
  id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
  club_id varchar NOT NULL REFERENCES clubs(id) ON DELETE CASCADE,
  archetype_key text NOT NULL,
  field_key text NOT NULL,
  replacement_key text NOT NULL,
  status varchar(16) NOT NULL DEFAULT 'active',
  promoted_by varchar NOT NULL,
  promoted_at timestamptz NOT NULL DEFAULT now(),
  reverted_by varchar,
  reverted_at timestamptz,
  distinct_coaches_at_promotion integer NOT NULL,
  avg_score_gap_at_promotion numeric
);

CREATE UNIQUE INDEX IF NOT EXISTS promoted_patterns_active_unique
  ON promoted_patterns (club_id, archetype_key, field_key)
  WHERE status = 'active';
