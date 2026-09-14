-- Nivel B / "el decantador" (spec 38/39): el OutputKey real de la
-- alternativa elegida en el picker, no su texto ya renderizado (que es
-- locale/jugadora-dependiente -- ver overrideEngine.ts::ReportOverride).
-- Columna aditiva, nullable, sin afectar filas existentes.
ALTER TABLE report_overrides
ADD COLUMN IF NOT EXISTS replacement_key text;
