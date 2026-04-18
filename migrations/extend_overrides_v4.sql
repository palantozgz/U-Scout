-- ============================================================
-- U Scout — extend report_overrides + create motor_feedback_stats
-- Ejecutar en Supabase SQL Editor (nunca drizzle-kit push)
-- ============================================================

-- 1. Extender report_overrides con columnas para ML y runners-up
ALTER TABLE public.report_overrides
  ADD COLUMN IF NOT EXISTS replacement_value  text,
  ADD COLUMN IF NOT EXISTS original_score     numeric(4,3),
  ADD COLUMN IF NOT EXISTS replacement_score  numeric(4,3),
  ADD COLUMN IF NOT EXISTS archetype_key      text,
  ADD COLUMN IF NOT EXISTS locale             varchar(8),
  ADD COLUMN IF NOT EXISTS approved_at        timestamptz;

-- 2. Crear motor_feedback_stats (anonimizado — sin user_id ni player_id)
CREATE TABLE IF NOT EXISTS public.motor_feedback_stats (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  archetype_key    text,
  field_key        text        NOT NULL,
  action           varchar(16) NOT NULL,   -- 'hide' | 'replace' | 'approve_as_is'
  replacement_key  text,
  score_gap        numeric(4,3),           -- original_score - replacement_score
  locale           varchar(8),
  is_approved      boolean     NOT NULL DEFAULT false,
  created_at       timestamptz NOT NULL DEFAULT now()
);

-- Índices para consultas del admin
CREATE INDEX IF NOT EXISTS idx_feedback_field_key      ON public.motor_feedback_stats(field_key);
CREATE INDEX IF NOT EXISTS idx_feedback_archetype      ON public.motor_feedback_stats(archetype_key);
CREATE INDEX IF NOT EXISTS idx_feedback_action         ON public.motor_feedback_stats(action);

-- 3. Trigger de anonimización: cada insert en report_overrides
--    genera automáticamente una fila anonimizada en motor_feedback_stats
CREATE OR REPLACE FUNCTION public.anonymize_override()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.motor_feedback_stats (
    archetype_key,
    field_key,
    action,
    replacement_key,
    score_gap,
    locale,
    is_approved
  ) VALUES (
    NEW.archetype_key,
    NEW.item_key,
    NEW.action,
    NEW.replacement_value,
    CASE
      WHEN NEW.original_score IS NOT NULL AND NEW.replacement_score IS NOT NULL
      THEN NEW.original_score - NEW.replacement_score
      ELSE NULL
    END,
    NEW.locale,
    NEW.approved_at IS NOT NULL
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_override_insert ON public.report_overrides;
CREATE TRIGGER on_override_insert
  AFTER INSERT ON public.report_overrides
  FOR EACH ROW EXECUTE FUNCTION public.anonymize_override();

-- ============================================================
-- Fin de migración
-- ============================================================
