-- Hora local "HH:MM" configurable por el head coach para los 2 recordatorios
-- diarios a jugadoras (spec 45): revisar scout reports y rellenar wellness.
-- Notificaciones locales en iOS (Capacitor @capacitor/local-notifications),
-- sin backend push -- estas columnas son solo la preferencia del club, el
-- cliente las lee y programa la notificación en el propio dispositivo.
-- Null = usar el valor por defecto de la app (21:30), sin fila que
-- mantener/migrar por cada club que nunca lo personaliza.
ALTER TABLE clubs ADD COLUMN IF NOT EXISTS scout_reports_notify_time varchar(5);
ALTER TABLE clubs ADD COLUMN IF NOT EXISTS wellness_notify_time varchar(5);
