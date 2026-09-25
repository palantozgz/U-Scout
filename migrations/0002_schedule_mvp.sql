-- U Schedule MVP tables (Phase 1).
-- RSVP model: schedule_participants only (no slot registrations for MVP).
-- Apply in Supabase SQL Editor.
--
-- NOTA 2026-09-25 (verificado contra produccion real, pg_class.relrowsecurity):
-- el comentario original decia "RLS intentionally disabled for MVP" -- eso
-- ya NO es cierto. RLS esta HABILITADA en produccion en schedule_events y
-- schedule_participants, con politicas reales (club_members_read,
-- staff_write/staff_manage con chequeo de operations_access,
-- own_response_insert/update), anadidas directamente en el SQL Editor de
-- Supabase en algun momento posterior sin actualizar esta migracion (mismo
-- patron que el resto de cambios de schema del proyecto: nunca via
-- drizzle-kit push). Esto SI importa de verdad: client/src/lib/schedule.ts
-- consulta estas dos tablas directamente via supabase-js (no via Express),
-- asi que RLS es aqui el limite de seguridad real, no decorativo.
-- schedule_week_templates (migracion 0003) tambien tiene RLS habilitada
-- pero CERO politicas -- inofensivo porque esa tabla nunca se consulta
-- directo desde el cliente, solo via /api/schedule/week-templates
-- (Express, con su propio chequeo de rol).

create extension if not exists pgcrypto;

create table if not exists public.schedule_events (
  id uuid primary key default gen_random_uuid(),
  club_id uuid not null,
  title text not null,
  starts_at timestamptz not null,
  ends_at timestamptz null,
  location text null,
  created_by uuid not null,
  created_at timestamptz not null default now()
);

create index if not exists schedule_events_club_starts_at_idx
  on public.schedule_events (club_id, starts_at);

comment on table public.schedule_events is 'U Schedule events (MVP).';
comment on column public.schedule_events.club_id is 'Club that owns the event.';
comment on column public.schedule_events.created_by is 'Supabase auth user id that created the event.';

create table if not exists public.schedule_participants (
  id uuid primary key default gen_random_uuid(),
  club_id uuid not null,
  event_id uuid not null,
  user_id uuid not null,
  status text not null,
  responded_at timestamptz not null default now()
);

alter table public.schedule_participants
  drop constraint if exists schedule_participants_status_check;
alter table public.schedule_participants
  add constraint schedule_participants_status_check
  check (status in ('confirmed', 'declined'));

create unique index if not exists schedule_participants_event_user_uniq
  on public.schedule_participants (event_id, user_id);

create index if not exists schedule_participants_club_event_idx
  on public.schedule_participants (club_id, event_id);

create index if not exists schedule_participants_club_user_idx
  on public.schedule_participants (club_id, user_id);

comment on table public.schedule_participants is 'Per-event RSVP status (MVP).';
comment on column public.schedule_participants.status is 'confirmed|declined.';

