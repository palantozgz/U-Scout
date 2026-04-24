-- U Schedule attendance reality V2: server-persisted registrations.
-- Apply in Supabase SQL Editor. RLS intentionally disabled for MVP (consistent with prior schedule migrations).

create table if not exists public.schedule_registrations (
  id uuid primary key default gen_random_uuid(),
  club_id uuid not null,
  event_id uuid not null,
  user_id uuid not null,
  mode text not null,
  state text not null,
  group_label text null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.schedule_registrations
  drop constraint if exists schedule_registrations_mode_check;
alter table public.schedule_registrations
  add constraint schedule_registrations_mode_check
  check (mode in ('signup', 'group_auto', 'group_coach_assign', 'selected_players'));

alter table public.schedule_registrations
  drop constraint if exists schedule_registrations_state_check;
alter table public.schedule_registrations
  add constraint schedule_registrations_state_check
  check (state in ('joined', 'left', 'waitlisted'));

create unique index if not exists schedule_registrations_event_user_uniq
  on public.schedule_registrations (event_id, user_id);

create index if not exists schedule_registrations_club_event_idx
  on public.schedule_registrations (club_id, event_id);

create index if not exists schedule_registrations_club_user_idx
  on public.schedule_registrations (club_id, user_id);

comment on table public.schedule_registrations is 'Per-event registration intent for attendance modes (Signup, Groups).';
comment on column public.schedule_registrations.mode is 'signup|group_auto|group_coach_assign|selected_players (diagnostic).';
comment on column public.schedule_registrations.state is 'joined|left|waitlisted.';
comment on column public.schedule_registrations.group_label is 'Group label for group_auto, e.g. A/B/C.';

