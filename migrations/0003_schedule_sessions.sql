-- U Schedule product alignment: sessions model columns.
-- Apply in Supabase SQL Editor. RLS intentionally disabled for MVP.

alter table public.schedule_events
  add column if not exists session_type text not null default 'training',
  add column if not exists notes text null,
  add column if not exists attendance_required boolean not null default true;

alter table public.schedule_events
  drop constraint if exists schedule_events_session_type_check;
alter table public.schedule_events
  add constraint schedule_events_session_type_check
  check (session_type in ('training','match','travel','meeting','recovery','other'));

alter table public.schedule_participants
  drop constraint if exists schedule_participants_status_check;
alter table public.schedule_participants
  add constraint schedule_participants_status_check
  check (status in ('confirmed','declined','maybe'));

comment on column public.schedule_events.session_type is 'training|match|travel|meeting|recovery|other';
comment on column public.schedule_events.attendance_required is 'If true, players should RSVP.';

