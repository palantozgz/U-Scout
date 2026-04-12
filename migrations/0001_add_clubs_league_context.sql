-- ClubContext columns for motor v3 (nullable, no defaults).
-- Apply: `npm run db:push` (recommended), or `npm run db:migrate` if your Drizzle journal is wired,
-- or run this file against Postgres (e.g. Supabase SQL editor).
ALTER TABLE "clubs" ADD COLUMN IF NOT EXISTS "league_type" varchar(32);
ALTER TABLE "clubs" ADD COLUMN IF NOT EXISTS "gender" varchar(16);
ALTER TABLE "clubs" ADD COLUMN IF NOT EXISTS "level" varchar(32);
ALTER TABLE "clubs" ADD COLUMN IF NOT EXISTS "age_category" varchar(16);
