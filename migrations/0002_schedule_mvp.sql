-- U Schedule MVP tables (Phase 1).
-- RSVP model: schedule_participants only (no slot registrations for MVP).
-- Apply in Supabase SQL Editor. RLS intentionally disabled for MVP.

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

