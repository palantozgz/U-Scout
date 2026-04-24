# U Core Architecture & Product Alignment (Repo-Aware)

This document is based on the **current workspace snapshot** of U Scout / U Core and is intended to guide U Core as the future main platform for **professional basketball club operations**.

## Executive summary

U Core already functions as a **mobile-first shell** with a stable route map (`/home`, `/schedule`, `/scout`, `/stats`) and a working **role + capabilities** abstraction. The platform currently uses a **hybrid data strategy**:

- **Legacy scouting + club management** flows via **Express + Drizzle** (`/api/*`) backed by Postgres (`shared/schema.ts`).
- **Schedule + Wellness** flows via **direct Supabase PostgREST** (`schedule_events`, `schedule_participants`, `wellness_entries`) with TanStack Query and offline-first caching.

The next stage is to formalize U Core into a clean “operating system” layer: **command center**, **alert center**, and **module container**, while progressively migrating legacy `/coach/*` and `/player/*` into feature modules without breaking production.

---

## 1) Current state map

### 1.1 Frontend architecture (what exists today)

- **Routing**: `wouter` in `client/src/App.tsx`
  - Core routes: `/home`, `/schedule`, `/scout`, `/stats`
  - Legacy routes: `/coach/*`, `/player/*`
  - Join routes: `/join/:token`, `/join-club/:token`
  - Guardrail: if `effectiveRole === "player"` and path starts with `/coach`, redirect to `/home`
- **Shell pattern**:
  - `client/src/pages/core/ModulePage.tsx` provides a sticky header + settings button + `ModuleNav`.
  - `client/src/pages/core/ModuleNav.tsx` provides bottom nav ordering by capabilities (player vs staff).
- **i18n**:
  - `client/src/lib/i18n.ts` single-source EN with strict parity to ES/ZH.
- **Role state**:
  - `client/src/lib/useAuth.ts` derives `realRole` from Supabase `user_metadata.role`
  - Supports DEV preview role (localStorage) producing `effectiveRole`
- **Capabilities**:
  - `client/src/lib/capabilities.ts` centralizes UI capabilities and permission-oriented capability computation:
    - UI rendering should use `effectiveRole`
    - sensitive permissions should use `realRole` + membership (where available)

### 1.2 Backend architecture (what exists today)

- **Express API**: `server/routes.ts`
  - Auth middleware: `server/auth.ts` `requireAuth` attaches `req.user` from Supabase JWT.
  - Data access: `server/storage.ts` (via Drizzle) + `server/db.ts` (pg Pool + drizzle schema).
  - Some APIs augment club member rows via Supabase **service role** lookup (`server/supabaseAdmin.ts`, `server/authUserLookup.ts`) to get auth email/name.
- **Database schema (Drizzle)**: `shared/schema.ts`
  - Team + player + scouting report assignment + report views
  - Clubs + club members + club invitations
  - Approvals / overrides / publications

### 1.3 Direct Supabase vs API routes (current split)

**Direct Supabase (client-side PostgREST)**
- `client/src/lib/schedule.ts`
  - Tables: `schedule_events`, `schedule_participants`
  - Operations: fetch ranges; create session; upsert RSVP status; participant lookups
- `client/src/lib/wellness.ts`
  - Table: `wellness_entries`
  - Operations: fetch today; upsert today

**Express API (`/api/*`)**
- Club operations: `client/src/lib/club-api.ts` → `/api/club*`
- Player home & team browsing: `client/src/lib/player-home.ts` → `/api/player/*`
- Scouting CRUD and workflows: various `client/src/lib/*` → `/api/players*`, `/api/report-assignments`, `/api/invitations*`, etc.

**Key architectural implication**
The app currently uses **two “data planes”**:
1) Drizzle/Express plane (`/api/*`)
2) Supabase direct plane (`supabase.from(...)`)

This is workable, but requires an explicit boundary policy (see “Target Architecture”) so future connected features don’t become a tangle.

### 1.4 Role system (what is true today)

- Roles: `master | head_coach | coach | player` (from Supabase auth metadata)
- `effectiveRole = previewRole ?? realRole` (DEV QA only preview)
- Capabilities compute:
  - `canUsePlayerUX` drives UI fork
  - `canManageClub` uses **realRole** + club membership
  - `canCreateEvent` (naming legacy) is currently used for “create session” UI

### 1.5 Module boundaries (what is true today)

**U Core modules**
- `Home`: now consumes cross-module signals (schedule + wellness + reports counts)
- `Schedule`: operations MVP (sessions + attendance + wellness)
- `Scout`: redirect to legacy roots (`/player` or `/coach`) without embedding them yet
- `Stats`: placeholder shell (no analytics plane yet)

**Legacy surfaces (must keep working)**
- `/coach/*` and `/player/*` are still the real scouting engine and club admin workflows.

### 1.6 Technical debt & risks (repo-backed)

- **Dual data plane drift**: schedule/wellness tables are not represented in `shared/schema.ts`, while club/scout tables are. Connected features may require careful joins and/or server aggregation endpoints.
- **Naming drift**: “event” identifiers remain in some code paths (e.g., `event_id` in participants) while product language is “session”.
- **Time boundaries**: schedule uses local-day computations (`startOfTodayLocal()`), while DB is `timestamptz`. This is OK for MVP but must be specified for pro clubs across timezones.
- **RLS posture**: schedule/wellness migrations are described as “RLS disabled for MVP” in SQL. Production-hardening will need a plan.
- **Offline strategy inconsistency**:
  - Query client comments claim “no optimistic updates”, but schedule hooks *do* optimistic updates. That’s fine, but the principle should be aligned/documented.

---

## 2) U Core target architecture (product-aligned)

### 2.1 U Core: platform responsibilities

U Core should be the **operating shell**, providing:
- **Identity & context**: club, role, season context (future)
- **Command center**: today’s actions across modules (sessions today, pending attendance, wellness completion, report workload)
- **Alert center**: operational alerts (injury flags, attendance issues, readiness lows) in honest, actionable language
- **Navigation + consistency**: global patterns (header, settings, bottom nav, error/empty states)

U Core should **not**:
- own deep module internals (keep loose coupling)
- embed heavy legacy UI until migrated

### 2.2 Module contracts (independent now, connected later)

Define “contracts” between modules as **read-only signals** and **write-only events**:

- **Schedule** produces signals:
  - next session, sessions today, pending attendance, attendance history
  - wellness submission rate, readiness signals (later)
- **Scout** produces signals:
  - pending reviews, unviewed reports, approval backlog
  - player notes and tags (later)
- **Stats** consumes signals:
  - attendance trends, wellness trends, report-derived traits (later)

Recommendation: implement a thin **Signals layer** in U Core:
- each module exposes a small selector/hook returning “signal” objects
- Home composes them without importing deep module UI

### 2.3 Data plane policy (to prevent coupling)

Keep two planes but formalize them:

1) **Operational plane (Supabase direct)** for fast iteration of Schedule/Wellness:
   - client hooks are OK for MVP
   - keep strict query keys + optimistic updates standards
2) **Core domain plane (Express/Drizzle)** for club/scout domain:
   - authoritative for club membership, scouting workflows, approvals, invitations

**When modules become connected**, add **server aggregation endpoints** rather than cross-joining from the client:
- e.g., `/api/core/home-signals` aggregates schedule + wellness + scout counts in one safe response
- can query Supabase tables server-side (service role) without exposing unrestricted access to clients

This supports independent modules now, and connected intelligence later, without a rewrite.

---

## 3) Migration plan (legacy → core without breakage)

### Phase 0 (now): stabilize the shell
- Keep `/home` as default post-login entry.
- Keep `ModulePageShell` and `ModuleNav` as the consistent shell for core modules.
- Ensure role/capabilities are the single source of truth for UI gates.

### Phase 1: “Wrapper migration” (no logic rewrite)
- Create **Core wrapper pages** that embed legacy pages or redirect to them but preserve shell consistency.
  - Scout already redirects; next is to optionally add “entry cards” inside core and keep legacy deep flows unchanged.

### Phase 2: “Feature slice migration” (incremental extraction)
- Move individual slices from legacy into `client/src/features/*` while keeping routes stable:
  - e.g., a “Reports list” slice for players can be moved into core without rewriting report rendering.
  - keep `/player/report/:id` intact initially.

### Phase 3: “Native core modules”
- Schedule becomes fully native (already trending this way).
- Scout: native core navigation + dashboards, legacy editor stays until replaced.
- Stats: becomes native once data model + aggregation endpoints exist.

### Phase 4: deprecate legacy entrypoints
- Eventually `/coach` and `/player` become internal routes, not user-facing entrypoints.

---

## 4) File structure recommendation (future-proof, minimally disruptive)

Keep current pages, but introduce a feature-oriented structure:

```
client/src/
  core/
    shell/
      ModulePageShell.tsx        (move from pages/core/ModulePage.tsx when ready)
      ModuleNav.tsx
    signals/
      homeSignals.ts             (composition only; no UI)
  features/
    schedule/
      api/                       (schedule.ts, wellness.ts later split)
      hooks/
      components/
      types.ts
    scout/
      api/
      components/
      hooks/
    home/
      components/
      hooks/
    stats/
      api/
      components/
      hooks/
  pages/
    core/                        (keep routes here)
    coach/
    player/
```

Key rule: **pages** are route wiring; **features** own logic and components; **core** owns shell + cross-module signals.

---

## 5) Technical-debt guardrails (non-negotiables)

- All cross-module UI should consume **signals**, not import feature internals.
- RLS posture must be explicitly decided before production expansion of schedule/wellness writes.
- “Session” terminology should be consistent at product layer; keep DB columns stable but wrap types.
- Timezone rules must be specified for clubs (local club timezone vs device timezone).

---

## 6) UX rules (premium mobile-first sports ops)

- No fake placeholders. If data doesn’t exist, show **neutral truth**.
- Top area is for **today’s actions**, not marketing.
- KPI cards only if they imply an action (e.g., “5 pending attendance” → tap to review).
- Empty states should suggest the next real step (e.g., “No sessions today” → “Create a session” if permitted).
- Consistent shell patterns across modules: header height, spacing, bottom nav behavior, loading states.

---

## 7) Priority roadmap (next 3 sprints)

### Sprint A — Architecture cleanup (stability + contracts)
- Define a `core/signals` layer and refactor Home to use signal hooks (no UI regressions).
- Normalize naming: “session” across UI; isolate “event_id” internals.
- Add server aggregation endpoint plan (design only, no implementation unless requested).
- Document timezone/RLS decisions and risks.

### Sprint B — Polish current modules (trust + daily use)
- Schedule: tighten staff operational dashboard; improve empty states; error handling; reduce cognitive load.
- Scout: core “entry dashboard” that routes into legacy without losing context.
- Settings: unify account/preferences patterns between `/settings` and player account settings.

### Sprint C — Schedule V2 foundations (design + scaffolding)
- Finalize Schedule V2 data model (entities + constraints + indexing + RLS plan).
- Design template/copy-week workflows; group attendance; slot registrations.
- Define analytics-ready history tables without shipping full analytics UI yet.

