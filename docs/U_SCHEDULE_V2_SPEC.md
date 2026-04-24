# U Schedule V2 — Sports Operations Data Model & Spec (Design Only)

This is a **future-safe design** for U Schedule as a professional basketball **operations planner**. It is **not** an implementation and does not change routes or legacy surfaces.

## Executive summary

The MVP uses:
- `schedule_events` (sessions) + `schedule_participants` (RSVP)
- `wellness_entries` (daily check-in)

V2 should evolve toward:
- **Sessions** as the top-level operational unit
- Optional **groups** (training groups / units)
- Optional **slots** (limited capacity blocks inside a session)
- Clear **attendance rules** (required/minimum/role-based)
- **Templates** for repeating plans + “copy week”
- **History** tables designed for analytics without reworking core transactional tables

---

## 1) Domain language (product-first)

- **Session**: Training, Match, Travel, Meeting, Recovery, Other
- **Group**: a roster subset (e.g., guards, bigs, rehab)
- **Slot**: capacity-limited sub-unit (e.g., “Weight room 1/2”, “Treatment slots”)
- **Registration**: slot-level sign-up (future)
- **Attendance response**: confirmed / declined / maybe (plus future “late”, “excused”, “injured”)
- **Attendance requirement**: boolean now; later becomes a rule object

---

## 2) Entities (future-safe model)

### 2.1 `sessions`
Represents one operational unit on the calendar.

**Core fields**
- `id` uuid PK
- `club_id` uuid
- `session_type` enum-like text: training|match|travel|meeting|recovery|other
- `title` text (coach-defined)
- `starts_at` timestamptz
- `ends_at` timestamptz nullable
- `location` text nullable
- `notes` text nullable (visible to staff; optionally to players later)
- `created_by` uuid
- `created_at`, `updated_at`

**Operational**
- `visibility` (staff_only|players|mixed) — future
- `attendance_policy` jsonb — future:
  - `required`: boolean
  - `min_required`: integer nullable (e.g., travel bus requires 12)
  - `allowed_roles`: list (players only by default)
  - `deadline_at`: timestamptz nullable

**Indexes**
- `(club_id, starts_at)`
- `(club_id, session_type, starts_at)` for filtering

### 2.2 `session_groups`
Optional grouping inside a session.

- `id` uuid PK
- `club_id`
- `session_id` FK
- `name` text (e.g., “Group A”, “Rehab”)
- `color` text nullable (UI)
- `attendance_policy` jsonb nullable (overrides session)

### 2.3 `session_group_members`
Roster mapping for a given group (can be static or dated).

- `id` uuid PK
- `club_id`
- `group_id`
- `user_id`
- `active_from` date nullable
- `active_to` date nullable

### 2.4 `attendance_responses`
The canonical “player says yes/no/maybe” record.

V2 recommendation: keep a single response per (session_id, user_id) even if slots exist.

- `id` uuid PK
- `club_id`
- `session_id`
- `user_id`
- `status` text: confirmed|declined|maybe|unknown (future)
- `responded_at` timestamptz
- `source` text: player|staff|system (future)
- `reason` text nullable (future)

Unique:
- `(session_id, user_id)`

### 2.5 `session_slots` (optional)
Slots are for limited-capacity workflows.

- `id` uuid PK
- `club_id`
- `session_id`
- `group_id` nullable (slot scoped to a group)
- `name` text (e.g., “Treatment”, “Gym Slot 1”)
- `starts_at` timestamptz nullable (slot inherits session timing if null)
- `ends_at` timestamptz nullable
- `capacity` integer
- `status` text: open|closed|cancelled

### 2.6 `slot_registrations` (optional)
- `id` uuid PK
- `club_id`
- `slot_id`
- `user_id`
- `status` text: registered|cancelled|waitlisted
- `created_at`

Unique:
- `(slot_id, user_id)`

### 2.7 `session_templates`
“Copy week” and repeatable operational plans.

- `id` uuid PK
- `club_id`
- `name` text
- `description` text nullable
- `created_by`
- `created_at`

### 2.8 `template_sessions`
- `id` uuid PK
- `template_id`
- `day_of_week` int (0–6)
- `start_time_local` time
- `duration_minutes` int
- `session_type`
- `title`
- `location` nullable
- `notes` nullable
- `attendance_policy` jsonb

### 2.9 `session_history` (analytics-first)
Do not overload transactional tables with analytics; create a history stream.

- `id` uuid PK
- `club_id`
- `session_id`
- `kind` text: created|updated|cancelled|attendance_changed|slot_added|slot_registration_changed|…
- `payload` jsonb
- `created_at`
- `actor_user_id` nullable

This enables Stats to build later without reworking core tables.

---

## 3) Compatibility with current MVP

Current tables:
- `schedule_events` ≈ `sessions`
- `schedule_participants` ≈ `attendance_responses`
- `schedule_slot_registrations` exists in earlier plans but is not used in MVP

V2 migration approach (conceptual):
- Keep `schedule_events` and `schedule_participants` stable as core transactional tables.
- Introduce optional tables (`session_groups`, `session_slots`, `slot_registrations`, templates, history) in new migrations.
- Add server aggregation endpoints when cross-module intelligence is needed.

---

## 4) UX spec implications (operations-first)

### Player
- Surface “Next session” + required response buttons only when policy requires.
- If slots exist: show slot registration only after attendance response (or as part of it), but keep one canonical response.

### Staff
- Prioritize “today operations”:
  - sessions today
  - missing attendance (roster-level and per session)
  - readiness issues (from wellness)
- Templates enable “copy week” without manual CRUD.

---

## 5) RLS & security (design requirements)

Unknown in repo whether production intends to keep RLS disabled; for V2:
- Define club-scoped policies:
  - players can read sessions visible to them
  - players can write/update their own attendance and wellness
  - staff can create sessions and manage attendance policies
- Prefer server-side aggregation where multi-table joins + role checks are complex.

