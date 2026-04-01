# U Scout — Basketball Scouting App

## Overview
U Scout is a mobile-first React basketball scouting application. Coaches can build detailed offensive profiles for players on opposing teams, while players/scouts can view generated scouting reports.

## Architecture

### Frontend (React + TypeScript)
- **Framework**: React with Vite, TypeScript
- **Routing**: Wouter
- **State / API**: TanStack Query (React Query) for all server state
- **UI**: shadcn/ui components + Tailwind CSS
- **Animation**: Framer Motion (profile page swipe)

### Backend (Node.js + Express)
- **Server**: Express.js with TypeScript (tsx)
- **ORM**: Drizzle ORM
- **Database**: PostgreSQL (Replit built-in)
- **API**: REST at `/api/*`

## Key Files

| File | Purpose |
|------|---------|
| `shared/schema.ts` | Drizzle schema: `users`, `teams`, `players` tables + Zod insert schemas |
| `server/db.ts` | Drizzle db instance connected via `DATABASE_URL` |
| `server/storage.ts` | `DatabaseStorage` class implementing `IStorage` with full CRUD |
| `server/routes.ts` | REST API routes: GET/POST `/api/teams`, GET/POST/PATCH/DELETE `/api/players/:id` |
| `client/src/lib/mock-data.ts` | Types, `generateProfile` engine, `createDefaultPlayer` helper, TanStack Query hooks |
| `client/src/pages/coach/Dashboard.tsx` | Coach roster view using `useTeams`/`usePlayers`/`useCreateTeam` |
| `client/src/pages/coach/PlayerEditor.tsx` | 5-tab player editor using `usePlayer`/`useCreatePlayer`/`useUpdatePlayer` |
| `client/src/pages/player/Dashboard.tsx` | Player mode roster grid with search |
| `client/src/pages/player/Profile.tsx` | 5-screen swipeable profile viewer |

## Data Model

### teams
- `id` (UUID, PK)
- `name`, `logo`, `primaryColor`

### players
- `id` (UUID, PK)
- `teamId` (FK → teams)
- `name`, `number`, `imageUrl`, `archetype`
- `keyTraits` (text array)
- `inputs` (JSONB — PlayerInput)
- `internalModel` (JSONB — InternalProfileModel)
- `defensivePlan` (JSONB — `{ defender: string[], forzar: string[] }`)

## Scouting Engine
The `generateProfile(inputs: PlayerInput)` function in `mock-data.ts` computes:
- Dominant side (left/right/ambidextrous)
- Scoring type (Driver/Shooter/Post Scorer/Balanced)
- PnR/Post role classifications
- Up to 3 scored traits per play type (Post, ISO, PnR, Off-Ball)
- Archetype label
- Defensive game plan (take-aways + force-tos)

## API Endpoints
- `GET /api/teams` — list all teams
- `POST /api/teams` — create team
- `GET /api/players?teamId=` — list all/filtered players
- `GET /api/players/:id` — get single player
- `POST /api/players` — create player
- `PATCH /api/players/:id` — update player
- `DELETE /api/players/:id` — delete player
