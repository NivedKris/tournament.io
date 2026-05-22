# eFootball Tournament Platform
### Platform Documentation & End-to-End Implementation Guide
_Version 1.0 — May 2026_

---

## Table of Contents

1. [Platform Overview](#1-platform-overview)
2. [Full Feature Specification](#2-full-feature-specification)
3. [Technology Stack](#3-technology-stack)
4. [Database Schema](#4-database-schema)
5. [Phased Implementation Plan](#5-phased-implementation-plan)
6. [Environment & Configuration](#6-environment--configuration)
7. [Testing Strategy](#7-testing-strategy)
8. [Scalability & Future Considerations](#8-scalability--future-considerations)
9. [Glossary](#9-glossary)

---

## 1. Platform Overview

The eFootball Tournament Platform is a full-stack responsive web application for organising, managing, and tracking eFootball tournaments in World Cup and UCL (Champions League) formats. It runs in any browser — desktop, tablet, and mobile — with no native app required.

The platform handles the complete tournament lifecycle:

- Nation or club selection by players
- Pre-qualification knockouts when multiple players claim the same team
- Group stage tables and fixtures
- Knockout bracket progression
- Live statistics and leaderboards
- AI-powered result submission via Google Gemini
- Admin verification of results before they are committed
- Dispute resolution with player-to-admin chat
- In-app notifications
- Reward system for tournament winners and award holders

**Core design principle:** Every feature works at every screen size. Responsive design is a first-class requirement, not an afterthought.

### 1.1 Tournament Modes

| Mode | Description |
|------|-------------|
| **World Cup** | Nations selected, groups drawn, group stage played, then knockout bracket through to the final |
| **UCL** | Club sides selected, Champions League structure — league phase then knockouts from R16 to final |
| **Mode switching** | Admin-only toggle, only permitted between tournaments. Switching mid-tournament wipes all data and requires explicit admin confirmation |
| **UI adaptation** | Terminology, bracket visuals, table layout, and the nation/club picker all adapt automatically to the active mode |

### 1.2 Key Actors

| Actor | Role | Access |
|-------|------|--------|
| **Player** | Registers, selects a team, builds a squad, plays matches, submits results | Standard authenticated user |
| **Admin** | Verifies results, manages players, controls tournament flow, sends notifications | Elevated — full platform access |
| **Public / spectator** | Views dashboard, standings, brackets, stats | Read-only, no auth required |

---

## 2. Full Feature Specification

### 2.1 Authentication & User Management

- Google OAuth 2.0 for sign-in — no email/password flow
- On first login, user completes profile: display name and username
- Auth state persisted via Supabase session (JWT)
- Role field in `users` table: `player` or `admin` (admin set manually in Supabase dashboard)
- Protected routes on both frontend and backend verify role
- Admin can suspend a player — suspended accounts see only a suspension notice screen and cannot submit results or access the app

### 2.2 Nation / Club Selection

- Admin opens the registration window before the tournament begins
- Each player picks one nation (World Cup) or one club (UCL) from a full searchable list
- Multiple players can claim the same team — the system tracks all claimants
- When admin closes registration, the system analyses claims:
  - **Single claimant** → player advances directly to the group stage
  - **Multiple claimants** → a pre-qualification knockout is scheduled among those players; the winner becomes the sole representative
- Pre-qualification match results are **excluded** from all tournament statistics (no goals or assists counted toward golden boot, golden ball, etc.)
- After all pre-qual matches resolve, admin triggers the group draw

### 2.3 Squad Builder

- Every player must configure their squad before their first match
- **Preset formations:** 4-3-3, 4-4-2, 4-2-3-1, 3-5-2, 5-3-2, 3-4-3, 4-1-4-1, 4-5-1, 3-4-2-1
- **Custom formation designer:** drag position markers on a pitch grid to build a bespoke shape
- For each position the player selects from the full in-game player database, filtered by position
- Player database fields: `name`, `aliases` (for nickname resolution), `position[]`, `overall_rating`, `club`, `nationality`
- Squad is editable at any time unless admin enforces a lock
- Squad is publicly visible on the nation/club profile page showing formation and XI

### 2.4 Match Scheduling & Status

- Fixtures are generated automatically after the group draw (or after pre-qual)
- Each match has a UUID, two player IDs, a stage, a status, and timestamps
- **Match status flow:** `scheduled` → `active` → `pending_verification` → `verified` | `disputed`
- Opponents use the in-app match chat to agree on a time to play
- Admin can set a match deadline; overdue matches are flagged

### 2.5 AI Result Submission (Gemini)

After a match, the **winning player** opens the match from their fixture list and taps "Declare result". This triggers the AI intake flow:

1. Player opens the match panel (identified by UUID; system knows player identity from session)
2. The opposing player's panel immediately becomes **read-only** — showing "result submitted by opponent, pending review"
3. Gemini AI begins guided intake:
   - Asks for the final score
   - Optionally asks for a screenshot upload of the result screen
   - Asks who scored each goal and at what minute (if known)
   - Asks who assisted each goal (if known)
   - Validates every named scorer/assister is in the player's registered squad
   - Resolves nicknames: `cr7` → Cristiano Ronaldo, `Messi` → Lionel Messi, etc.
   - If a name is ambiguous, AI asks for clarification before proceeding
   - Rejects any player not in the squad with a clarifying question
4. AI compiles a structured **result package** (JSON): match UUID, scoreline, scorer list with minutes, assist list, screenshot URL
5. Match status changes to `pending_verification`
6. Admin receives a notification

**Both screenshot and verbal intake are supported.** Neither is mandatory on its own — the AI uses whatever is provided.

### 2.6 Admin Result Verification

- Admin opens the pending result from the notification feed or admin panel
- Admin sees the full AI-compiled package: scoreline, scorers, assists, screenshot, and a **preview of all database changes** the approval would trigger
- Admin can edit any field before approving (override a scorer, correct a minute, remove an assist)
- **Approve** → system executes all updates atomically: scoreboard, group table or bracket, golden boot leaderboard, clean sheet records
- **Reject** → player is notified and prompted to resubmit
- For knockout matches: approval marks the losing nation/club as eliminated and advances the winner in the bracket

### 2.7 Dispute System

- The losing player can raise a dispute from their read-only match panel
- Raising a dispute opens a **private threaded chat** between that player and admin, scoped to the match UUID
- Match stays in `pending` state while dispute is open — no results are committed
- Admin resolves with one of three outcomes:
  1. Accept submitted result as correct
  2. Override result with a corrected scoreline
  3. Suspend the guilty player and award the match to the opponent
- **Suspension** automatically removes the player from the tournament, retires their nation slot, and notifies both parties

### 2.8 Dashboard & Public Statistics

**Group stage view**
- Live group tables with P, W, D, L, GF, GA, GD, Pts per group
- Upcoming fixtures and completed results per group

**Knockout bracket view**
- Visual bracket tree from R16 to final
- Match status per fixture: scheduled, pending, or confirmed

**Player & team statistics**
- Top scorers leaderboard (golden boot race) — goals and assists
- Most assists leaderboard
- Best defence — fewest goals conceded and most clean sheets
- Nation/club profile page: squad, formation, match results, stats

**Tournament awards tracker**
- Golden Boot — top scorer, pre-qual excluded
- Golden Ball — admin-designated best player
- Best goalkeeper / best defence — from clean sheet data
- Tournament winner — displayed prominently after the final

### 2.9 In-App Notifications

- Admin broadcasts to all players or targets a specific user
- Notification types: `match_reminder`, `result_verified`, `result_rejected`, `dispute_update`, `tournament_announcement`, `suspension_notice`, `winner_announcement`
- Delivered via Supabase Realtime — bell icon in nav bar with unread badge
- Unread count updates live without page refresh

### 2.10 Match Chat

- Each match has a dedicated chat thread between the two opponents
- Used to coordinate match timing only — results go through AI intake, not chat
- Visible to admin at all times for moderation
- Messages stored in `messages` table linked to match UUID

### 2.11 Admin Panel

- **Match management:** view all matches by stage/status, edit results, approve/reject submissions
- **Player management:** view all players, edit profiles, suspend, remove, reassign nation
- **Tournament controls:** open/close registration, trigger group draw, advance stages, toggle mode
- **Notification composer:** write and send to all or individual players
- **Dispute inbox:** all open disputes with full chat history and resolution controls
- **Reward configuration:** set tournament prize, golden boot prize, other awards
- **Stats overview:** all statistics in one place for manual verification

### 2.12 Reward System

- Admin configures rewards before or during the tournament
- **Tournament winner:** free text (e.g. "Rs. 500 cash", "Official jersey", "Gift voucher")
- Additional awards: golden boot, golden ball, best defence — each with its own configurable prize
- Rewards displayed publicly on the dashboard throughout the tournament
- After the final is verified, winner and award holders announced with a banner
- Prize fulfilment happens outside the app — the platform records who won what

---

## 3. Technology Stack

| Layer | Technology | Purpose |
|-------|-----------|---------|
| Frontend | React 18 + Vite | UI, routing, state management |
| Backend | Express.js (Node 20) | REST API, business logic, auth middleware |
| Database | Supabase (PostgreSQL) | All relational data, row-level security |
| File storage | Supabase Storage | Match screenshots and user uploads |
| Real-time | Supabase Realtime | Live notifications, match chat, status updates |
| Authentication | Google OAuth 2.0 via Supabase Auth | Player and admin sign-in |
| AI | Google Gemini API (Google AI Studio) | Result intake, screenshot parsing, Q&A |
| Frontend deployment | Vercel | Static React build, CDN distribution |
| Backend deployment | Vercel Serverless Functions | Express API as serverless functions |
| CI/CD | GitHub Actions + Vercel Git integration | Test, build, deploy on push |
| Version control | GitHub | Monorepo — `apps/web` and `apps/api` |

### 3.1 Repository Structure

```
tournament-platform/
├── apps/
│   ├── web/                  # React + Vite frontend
│   │   ├── src/
│   │   │   ├── components/
│   │   │   ├── pages/
│   │   │   ├── hooks/
│   │   │   ├── stores/       # Zustand stores
│   │   │   ├── lib/          # Supabase client, axios instance
│   │   │   └── types/
│   │   ├── index.html
│   │   └── vite.config.ts
│   └── api/                  # Express.js backend
│       ├── src/
│       │   ├── routes/
│       │   ├── middleware/
│       │   ├── services/     # Gemini, Supabase admin client
│       │   └── types/
│       └── index.ts
├── packages/
│   └── shared/               # TypeScript types, constants, utils shared by both apps
├── supabase/
│   ├── migrations/           # SQL migration files (run in order)
│   └── seed.sql              # Dev seed data (nations, clubs, players)
├── .github/
│   └── workflows/
│       └── ci.yml            # GitHub Actions CI pipeline
└── vercel.json               # Monorepo routing config
```

### 3.2 Frontend Libraries

```json
{
  "react": "^18.3.0",
  "react-router-dom": "^6.x",
  "zustand": "^4.x",
  "@tanstack/react-query": "^5.x",
  "@supabase/supabase-js": "^2.x",
  "axios": "^1.x",
  "tailwindcss": "^3.x",
  "@radix-ui/react-*": "latest",
  "lucide-react": "latest"
}
```

### 3.3 Backend Libraries

```json
{
  "express": "^4.x",
  "@supabase/supabase-js": "^2.x",
  "@google/generative-ai": "^0.x",
  "helmet": "^7.x",
  "cors": "^2.x",
  "express-rate-limit": "^7.x",
  "multer": "^1.x",
  "zod": "^3.x"
}
```

### 3.4 Vercel Routing Config

```json
// vercel.json (root)
{
  "rewrites": [
    { "source": "/api/(.*)", "destination": "/apps/api/index.js" },
    { "source": "/(.*)",    "destination": "/apps/web/index.html" }
  ]
}
```

### 3.5 CI/CD Pipeline

```yaml
# .github/workflows/ci.yml
name: CI
on:
  pull_request:
    branches: [main]
  push:
    branches: [main]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: npm
      - run: npm ci
      - run: npm run lint
      - run: npm run typecheck
      - run: npm run test
```

Vercel Git integration auto-deploys `main` to production. Every branch gets a preview URL.

---

## 4. Database Schema

All tables live in Supabase (PostgreSQL). Every write operation requiring admin privilege is done from the backend using the **service role key** (bypasses RLS). All frontend direct queries use the **anon key** with RLS enforced.

### 4.1 Table Definitions

```sql
-- Users
create table users (
  id            uuid primary key default gen_random_uuid(),
  google_id     text unique not null,
  display_name  text not null,
  username      text unique not null,
  role          text not null default 'player' check (role in ('player', 'admin')),
  is_suspended  boolean not null default false,
  created_at    timestamptz not null default now()
);

-- Tournaments
create table tournaments (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  mode        text not null check (mode in ('world_cup', 'ucl')),
  status      text not null default 'registration'
                check (status in ('registration','pre_qual','group_stage','knockout','completed')),
  created_at  timestamptz not null default now()
);

-- Nations / clubs (seeded from static data)
create table nations (
  id        uuid primary key default gen_random_uuid(),
  name      text not null,
  flag_url  text,
  mode      text not null check (mode in ('world_cup', 'ucl'))
);

-- A player's claim to represent a nation in a tournament
create table nation_claims (
  id             uuid primary key default gen_random_uuid(),
  tournament_id  uuid not null references tournaments(id),
  nation_id      uuid not null references nations(id),
  user_id        uuid not null references users(id),
  status         text not null default 'pending'
                   check (status in ('pending','pending_prequal','qualified','eliminated')),
  unique (tournament_id, user_id)
);

-- Player database (eFootball players)
create table players (
  id           uuid primary key default gen_random_uuid(),
  name         text not null,
  aliases      text[] default '{}',   -- ['cr7', 'ronaldo', 'cristiano']
  positions    text[] not null,        -- ['ST', 'CF']
  overall      integer,
  club         text,
  nationality  text
);

-- Squad configuration per claim
create table squads (
  id             uuid primary key default gen_random_uuid(),
  user_id        uuid not null references users(id),
  tournament_id  uuid not null references tournaments(id),
  claim_id       uuid not null references nation_claims(id),
  formation      text not null,         -- '4-3-3'
  positions      jsonb not null,        -- { "GK": player_id, "LB": player_id, ... }
  updated_at     timestamptz not null default now(),
  unique (claim_id)
);

-- Match fixtures
create table matches (
  id              uuid primary key default gen_random_uuid(),
  tournament_id   uuid not null references tournaments(id),
  home_claim_id   uuid not null references nation_claims(id),
  away_claim_id   uuid not null references nation_claims(id),
  stage           text not null,   -- 'pre_qual', 'group_A', 'r16', 'qf', 'sf', 'final'
  group_name      text,            -- 'A', 'B', etc. (null for knockout)
  status          text not null default 'scheduled'
                    check (status in ('scheduled','active','pending_verification','verified','disputed')),
  home_score      integer,
  away_score      integer,
  is_prequal      boolean not null default false,
  scheduled_at    timestamptz,
  verified_at     timestamptz
);

-- Individual goal and assist events per match
create table match_events (
  id          uuid primary key default gen_random_uuid(),
  match_id    uuid not null references matches(id),
  type        text not null check (type in ('goal', 'assist')),
  player_id   uuid not null references players(id),
  claim_id    uuid not null references nation_claims(id),
  minute      integer,
  created_at  timestamptz not null default now()
);

-- AI-compiled result package submitted by the winning player
create table result_submissions (
  id               uuid primary key default gen_random_uuid(),
  match_id         uuid not null references matches(id),
  submitted_by     uuid not null references users(id),
  screenshot_url   text,
  ai_package       jsonb not null,   -- { scoreline, scorers: [{player_id, minute}], assists: [{player_id, goal_index}] }
  status           text not null default 'pending'
                     check (status in ('pending','approved','rejected')),
  admin_notes      text,
  reviewed_by      uuid references users(id),
  reviewed_at      timestamptz,
  created_at       timestamptz not null default now()
);

-- Disputes
create table disputes (
  id           uuid primary key default gen_random_uuid(),
  match_id     uuid not null references matches(id),
  raised_by    uuid not null references users(id),
  status       text not null default 'open' check (status in ('open','resolved')),
  resolution   text,   -- 'accepted', 'overridden', 'suspended'
  resolved_by  uuid references users(id),
  resolved_at  timestamptz,
  created_at   timestamptz not null default now()
);

-- Messages for both match chat and dispute chat
create table messages (
  id                uuid primary key default gen_random_uuid(),
  match_id          uuid not null references matches(id),
  dispute_id        uuid references disputes(id),   -- null = match chat, set = dispute chat
  sender_id         uuid not null references users(id),
  body              text not null,
  created_at        timestamptz not null default now()
);

-- In-app notifications
create table notifications (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid references users(id),   -- null = broadcast to all players
  type        text not null,
  body        text not null,
  is_read     boolean not null default false,
  created_at  timestamptz not null default now()
);

-- Tournament rewards
create table rewards (
  id             uuid primary key default gen_random_uuid(),
  tournament_id  uuid not null references tournaments(id),
  type           text not null check (type in ('winner','golden_boot','golden_ball','best_defence','other')),
  label          text not null,         -- 'Tournament Winner'
  description    text not null,         -- 'Rs. 500 cash prize'
  winner_claim   uuid references nation_claims(id),   -- set after tournament ends
  created_at     timestamptz not null default now()
);
```

### 4.2 Row-Level Security Policies

```sql
-- Enable RLS on all tables
alter table users           enable row level security;
alter table nation_claims   enable row level security;
alter table squads          enable row level security;
alter table matches         enable row level security;
alter table match_events    enable row level security;
alter table result_submissions enable row level security;
alter table disputes        enable row level security;
alter table messages        enable row level security;
alter table notifications   enable row level security;

-- users: anyone can read public profiles, users can only update their own
create policy "public read" on users for select using (true);
create policy "self update" on users for update using (auth.uid() = id);

-- squads: anyone can read, only owner can write
create policy "public read" on squads for select using (true);
create policy "owner write" on squads for all using (auth.uid() = user_id);

-- messages: only match participants or admin can read
create policy "participant read" on messages for select
  using (
    exists (
      select 1 from matches m
      join nation_claims nc on nc.id in (m.home_claim_id, m.away_claim_id)
      where m.id = messages.match_id and nc.user_id = auth.uid()
    )
    or exists (select 1 from users where id = auth.uid() and role = 'admin')
  );

-- notifications: users see their own or broadcasts
create policy "own or broadcast" on notifications for select
  using (user_id = auth.uid() or user_id is null);
```

---

## 5. Phased Implementation Plan

**Core principle:** Each phase delivers a working, testable, deployable slice. No phase requires rewriting the previous one — each extends the codebase incrementally. Do not begin the next phase until the current phase's testing gate is fully passed.

---

### Phase 1 — Foundation & Authentication
**Estimated duration: 1–2 weeks**

**Goal:** Monorepo running, both apps deployed, Google OAuth working end to end.

#### Backend tasks
1. Initialise monorepo with `apps/web`, `apps/api`, `packages/shared`
2. Configure Vite for React, Express + TypeScript for API
3. Set up Supabase project; run initial migration creating `users` table
4. Implement Google OAuth: `/auth/google` redirects to Google, `/auth/callback` creates Supabase session, upserts user record
5. Auth middleware: `verifySession` (validates JWT), `requireRole('admin')` (checks role field)
6. `GET /auth/me` — returns current user profile
7. Configure Vercel, confirm preview deployments work on pull requests

#### Frontend tasks
1. Set up React Router v6 with `PublicLayout` and `ProtectedLayout` (redirects to `/login` if no session)
2. Login page with "Sign in with Google" button
3. After OAuth callback, store session in Zustand `authStore`
4. Profile completion screen (display name, username) on first login
5. Nav bar with user avatar, display name, sign-out
6. Axios instance with base URL and auth header injected from session

#### Testing gate
- [ ] New user can sign in with Google on mobile and desktop
- [ ] First-time users are prompted to complete their profile
- [ ] Returning users land directly on the home page
- [ ] Sign-out clears session and redirects to login
- [ ] `/api/auth/me` returns 401 without a valid token
- [ ] Admin route returns 403 for a player-role user

---

### Phase 2 — Tournament Setup & Squad Builder
**Estimated duration: 2–3 weeks**

**Goal:** Admin creates a tournament, players claim nations, players build squads.

#### Database migrations
1. Create `tournaments`, `nations`, `nation_claims`, `squads`, `players` tables
2. Seed `nations` with all FIFA World Cup nations (with flag URLs) and all UCL clubs
3. Seed `players` with eFootball player data including `aliases` array for nickname resolution

#### Backend tasks
1. `POST /admin/tournament` — create tournament (name, mode); status defaults to `registration`
2. `GET /tournament/current` — returns active tournament details
3. `POST /tournament/claim` — player claims a nation (validates registration open, no duplicate claim by same user)
4. `GET /tournament/nations` — all nations with claim count and claimant username(s)
5. `POST /squad` — save or update squad (formation + positions JSON)
6. `GET /squad/:claimId` — public, returns squad and formation for any claim

#### Frontend tasks
1. Home page shows tournament status; if registration open, shows nation picker
2. Nation picker: searchable grid with flags; shows "Claimed by [username]" or "X players competing" if contested
3. After claiming, redirect to squad builder
4. Squad builder: formation selector with live pitch preview, player search and assign per position
5. Custom formation designer: drag-and-drop position circles on a pitch canvas (SVG or canvas)
6. Nation/club profile page: public view of squad and formation

#### Testing gate
- [ ] Admin can create World Cup and UCL tournaments
- [ ] Players can claim nations — duplicate claims by the same user are rejected with clear error
- [ ] Multiple different players can claim the same nation without error
- [ ] Squad saves correctly; formation renders on the public profile page
- [ ] Nation profile is accessible to unauthenticated users
- [ ] Squad builder works on a 375px mobile viewport

---

### Phase 3 — Match Engine & Pre-qualification
**Estimated duration: 2–3 weeks**

**Goal:** Admin closes registration, pre-qual is resolved, group draw generates fixtures, match chat is live.

#### Backend tasks
1. `POST /admin/tournament/close-registration` — sets status to `pre_qual`; analyses all claims:
   - Single-claim nations: `nation_claims.status` → `qualified`
   - Multi-claim nations: generate pre-qual match records (`is_prequal = true`)
   - For 3+ claimants on one nation: schedule a mini round-robin; winner advances
2. `POST /admin/tournament/start-groups` — triggers random group draw, generates all group stage fixtures, sets tournament status to `group_stage`
3. `GET /matches` — list matches for the logged-in user, grouped by stage, with status
4. `GET /matches/:id` — single match detail including both players' nation/club info
5. `POST /matches/:id/message` — send a message to match chat
6. `GET /matches/:id/messages` — retrieve match chat history (paginated)

#### Frontend tasks
1. "My fixtures" page: all matches for the logged-in player, grouped by stage, with status badge
2. Match detail panel: opponent, stage, scheduled time, status, match chat thread
3. Match chat: real-time via Supabase Realtime subscription on `messages` table filtered by `match_id`
4. Admin panel: "Close registration" button, pre-qual status overview, "Start group stage" button

#### Testing gate
- [ ] Closing registration correctly identifies single vs multi-claim nations
- [ ] Pre-qual fixtures are generated only for contested nations
- [ ] Group draw assigns all qualified nations to groups with no nation appearing twice in the same group
- [ ] All group stage fixtures are generated correctly
- [ ] Match chat sends and receives in real time between two separate browser sessions
- [ ] Non-participants cannot read the match chat

---

### Phase 4 — AI Result Submission & Admin Verification
**Estimated duration: 3–4 weeks**

**Goal:** The core product loop — play a match, submit via Gemini AI, admin verifies, standings update.

#### Backend tasks
1. Gemini integration service (`services/gemini.ts`) — **server-side only, API key never sent to browser:**
   - `parseScreenshot(imageBase64: string)` — sends image to Gemini Vision, returns extracted scoreline
   - `resolvePlayerName(input: string, squad: Player[])` — fuzzy matches input against squad including aliases
   - `conductIntake(matchId, userId, history)` — stateful intake conversation handler; returns next AI message and `isComplete` flag
2. `POST /matches/:id/submit` — locks match for opponent, sets status to `active`
3. `POST /matches/:id/intake` — receives user message, returns AI response (conversation continues until `INTAKE_COMPLETE`)
4. `POST /matches/:id/intake/upload` — accepts screenshot (multipart), stores in Supabase Storage, runs `parseScreenshot`, returns extracted data
5. On intake complete: save `result_submissions` record, set match status to `pending_verification`, send notification to all admins
6. `GET /admin/submissions` — list all pending result submissions
7. `POST /admin/submissions/:id/approve` — with optional field overrides; atomically:
   - Inserts `match_events` for each goal and assist
   - Sets `matches.home_score`, `away_score`, `status = 'verified'`
   - Recalculates group table stats (or advances knockout bracket if applicable)
   - Sends `result_verified` notification to both players
8. `POST /admin/submissions/:id/reject` — sets submission status to `rejected`, notifies player to resubmit

#### Gemini system prompt

```
You are the result intake assistant for an eFootball tournament.
Match ID: {matchId}
{homePlayer} plays for {homeNation} vs {awayPlayer} plays for {awayNation}.
The winner opening this intake is: {winnerPlayer}.

You must collect:
1. Final scoreline
2. Who scored each goal (from {winnerPlayer}'s squad ONLY — you cannot attribute a goal to the opponent's players)
3. Who assisted each goal (optional but ask)

{winnerPlayer}'s squad: {squadList}
(format: "Player Name [position] — aliases: alias1, alias2")

Rules:
- Resolve nicknames and abbreviations using the aliases list
- If a name doesn't match any player in the squad, ask for clarification — do not guess
- Never accept a player who is not in the squad
- Ask one question at a time
- When all details are confirmed, output ONLY a JSON block in this format and then say INTAKE_COMPLETE:

{
  "home_score": 3,
  "away_score": 1,
  "events": [
    { "type": "goal", "player_id": "uuid", "minute": 23 },
    { "type": "assist", "player_id": "uuid", "minute": 23 }
  ]
}
```

#### Frontend tasks
1. "Declare result" button on match panel — visible only to the session player when match status is `active`
2. AI intake chat UI: conversational message thread, upload button for screenshot, typing indicator, submission confirmation screen
3. Opponent view: read-only panel showing "result submitted by opponent — pending admin review"
4. Admin submissions panel: list of pending submissions with match details
5. Admin submission detail: editable score fields, editable scorer/assist list, screenshot viewer, approve/reject buttons with notes field

#### Testing gate
- [ ] Winner opens match panel and starts AI intake
- [ ] Opponent's match panel becomes read-only immediately upon submission start
- [ ] AI resolves at least 10 common nickname patterns correctly
- [ ] AI rejects any player not in the squad and asks for clarification
- [ ] Screenshot upload works on mobile (camera capture) and desktop (file picker)
- [ ] Admin receives a notification when submission is ready
- [ ] Approving a submission correctly updates the group table (test with 3+ approved results)
- [ ] Rejecting notifies the player and allows resubmission
- [ ] Knockout match approval correctly advances the winner in the bracket

---

### Phase 5 — Dashboard, Stats & Dispute System
**Estimated duration: 2–3 weeks**

**Goal:** Public dashboard with live standings and leaderboards. Dispute system fully operational.

#### Backend tasks
1. `GET /stats/top-scorers` — ordered by goals, ties broken by assists; excludes pre-qual events
2. `GET /stats/top-assists` — ordered by assists
3. `GET /stats/clean-sheets` — by nation/claim; updated when a verified match has 0 goals conceded
4. `GET /groups` — all group tables with calculated P/W/D/L/GF/GA/GD/Pts
5. `GET /bracket` — current knockout bracket structure with match statuses and results
6. `POST /disputes` — raise dispute for a match; opens dispute chat thread; match status → `disputed`
7. `POST /disputes/:id/message` — send message in dispute chat
8. `GET /admin/disputes` — all open disputes
9. `POST /admin/disputes/:id/resolve` — resolve with outcome: `accepted` | `overridden` | `suspended`
   - `suspended`: sets `users.is_suspended = true`, retires `nation_claims.status = 'eliminated'`, awards match to opponent, notifies both

#### Frontend tasks
1. Dashboard home (public): group tables, top 5 scorers, upcoming fixtures, recent results
2. Bracket page: visual knockout tree; click match to see detail
3. Stats page: full golden boot table, assists table, clean sheets, nation/club profiles
4. Nation/club profile page: squad, results, goal/assist breakdown
5. "Raise dispute" button on losing player's read-only match panel
6. Dispute chat UI (same component as match chat, different thread)
7. Admin dispute panel: open disputes list, full conversation view, resolve controls

#### Testing gate
- [ ] Group tables calculate correctly after approving multiple results in sequence
- [ ] Bracket advances correctly after a knockout result is verified
- [ ] Top scorer list updates immediately after a result is approved
- [ ] Player can raise dispute; admin receives notification
- [ ] Dispute chat works in real time between player and admin
- [ ] Admin suspending a player removes them from the tournament and awards the match
- [ ] Suspended player sees suspension screen on next login
- [ ] Dashboard is fully usable on a 375px mobile viewport

---

### Phase 6 — Notifications, Rewards & Tournament Completion
**Estimated duration: 1–2 weeks**

**Goal:** Notification system live, rewards configured, full end-of-tournament experience.

#### Backend tasks
1. `POST /admin/notifications` — send notification to all players (`user_id = null`) or one player
2. `GET /notifications` — current user's notification feed (paginated, newest first)
3. `POST /notifications/:id/read` — mark single notification as read
4. `POST /notifications/read-all` — mark all as read
5. Supabase Realtime channel on `notifications` table — filter by `user_id = auth.uid() OR user_id IS NULL`
6. `POST /admin/rewards` — create or update reward configuration for the active tournament
7. `GET /rewards` — public; returns current reward configuration including winner if set
8. `POST /admin/tournament/complete` — marks tournament complete, sets winner, triggers winner announcement notification to all players

#### Frontend tasks
1. Bell icon in nav bar with unread count badge; dropdown showing 5 most recent notifications
2. Full notifications page: scrollable feed, read/unread states, mark all read
3. Admin notification composer: textarea, player selector (all / individual), send button
4. Rewards section on public dashboard: prize display for each award category
5. Winner announcement banner on dashboard after tournament completion

#### Testing gate
- [ ] Admin notification reaches all players' bell icons within 2 seconds via Realtime
- [ ] Unread count badge resets correctly when the notifications page is visited
- [ ] Individual notification targeting works — other players do not see it
- [ ] Reward configuration appears on the dashboard immediately after admin saves
- [ ] Tournament completion triggers the winner banner and notifies all players
- [ ] New notifications received without page refresh during an active session

---

## 6. Environment & Configuration

### 6.1 Required Accounts

| Service | Setup steps |
|---------|------------|
| **GitHub** | Create repository; protect `main` branch (require PR + passing CI) |
| **Vercel** | Connect GitHub repo; configure monorepo with `vercel.json`; add env vars in project settings |
| **Supabase** | Create project; note `project URL`, `anon key`, `service role key`; enable Google OAuth provider |
| **Google Cloud Console** | Create OAuth 2.0 client ID; add redirect URIs for localhost and production; enable People API |
| **Google AI Studio** | Create Gemini API key; use `gemini-1.5-flash` for intake conversation, `gemini-1.5-pro` for screenshot parsing |

### 6.2 Environment Variables

```bash
# apps/api/.env  (never commit this file)
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key   # never expose to browser
GEMINI_API_KEY=your-gemini-key
GOOGLE_CLIENT_ID=your-google-client-id
GOOGLE_CLIENT_SECRET=your-google-client-secret
JWT_SECRET=your-jwt-secret
FRONTEND_URL=https://your-app.vercel.app
PORT=3001
```

```bash
# apps/web/.env  (these are exposed to the browser — safe values only)
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key              # safe — RLS enforces access
VITE_API_URL=https://your-api.vercel.app
```

### 6.3 Supabase Auth Setup

In the Supabase dashboard:
1. Authentication → Providers → Google → Enable
2. Add Google Client ID and Secret
3. Add site URL and redirect URLs
4. Set JWT expiry to 3600 (1 hour) with refresh token rotation enabled

### 6.4 Key Security Rules

- **Service role key** is used only in the Express backend. It bypasses RLS. Never import it in any frontend code.
- **Anon key** is used in the frontend Supabase client. RLS policies control what it can access.
- **Gemini API key** is used only server-side. All AI calls are proxied through `/api/matches/:id/intake`.
- **Google OAuth secrets** live only in the backend and in Supabase's provider config.
- All API routes that modify data require `verifySession` middleware at minimum; admin routes additionally require `requireRole('admin')`.

---

## 7. Testing Strategy

### 7.1 Unit Tests

- **Backend (Jest):** test all route handlers with mocked Supabase admin client; test Gemini service with mocked API responses; test group table calculation logic; test bracket advancement logic
- **Frontend (Vitest + React Testing Library):** test form components, stat display components, AI intake conversation state machine, player name resolution utility

### 7.2 Integration Tests

- Run against a dedicated Supabase test project (not production)
- Test full result submission flow: submit → pending → admin approve → stats updated
- Test Gemini intake with fixture conversation scripts covering nickname resolution, squad validation, and screenshot parsing
- Test group table recalculation across a full group's worth of results

### 7.3 End-to-End Tests (Playwright)

```
Critical paths to cover:
1. Sign in → claim nation → build squad → save
2. Admin: create tournament → close registration → start groups
3. Player: open match → complete AI intake → submit result
4. Admin: review submission → approve → verify dashboard updates
5. Player: raise dispute → exchange messages → admin resolves
6. Admin: send notification → player sees it in real time
7. Full tournament from group stage to final
```

Run E2E suite against the Vercel preview deployment on every pull request. Include mobile viewport tests at 375px for all critical flows.

### 7.4 Phase Gate Policy

Do not begin the next phase until every item in the current phase's testing gate is checked. Use at least:
- 1 admin test account
- 2 player test accounts (to test real-time features and opponent flows)

---

## 8. Scalability & Future Considerations

### 8.1 Current architecture capacity

The platform as designed handles tournaments up to 64 nations or clubs with hundreds of concurrent users. Supabase free tier supports up to 500MB storage and 50,000 monthly active users — well above any community tournament's needs.

### 8.2 If the platform grows

- **Cold start latency:** Move Express from Vercel Serverless Functions to a persistent server (Railway, Render) if response times degrade
- **Read performance:** Add a Redis cache layer (Upstash) for group tables and leaderboards to reduce Supabase reads
- **Async workloads:** Add BullMQ job queue for post-approval stat recalculation if running multiple concurrent tournaments
- **Email notifications:** Add Resend or SendGrid alongside in-app notifications for match reminders and important events
- **File storage:** Supabase Storage handles screenshots well at small scale; migrate to Cloudflare R2 if volume grows significantly

### 8.3 Multi-tournament support

The schema is already multi-tournament — every major table has a `tournament_id` foreign key. Running a second concurrent tournament requires no schema changes, only admin UI work to switch context between active tournaments.

### 8.4 Mobile app path

Because the platform is a responsive web app with standard REST APIs and Supabase Realtime, wrapping it in a React Native WebView or building a dedicated React Native app later is straightforward — the API layer requires no changes.

---

## 9. Glossary

| Term | Definition |
|------|-----------|
| **Nation claim** | A player's registration to represent a specific nation or club in the tournament |
| **Pre-qualification (pre-qual)** | Knockout stage run before the main tournament to resolve multiple players claiming the same nation |
| **is_prequal** | Boolean flag on `matches` — results from these matches do not count towards tournament statistics |
| **Result package** | Structured JSON compiled by the AI after intake: scoreline, scorers, assists, screenshot URL |
| **Pending verification** | Match status after result submission but before admin approves — shown publicly with a "pending" tag |
| **Dispute** | Formal challenge by a player against a submitted result; opens a private admin chat tied to the match UUID |
| **Suspension** | Admin action removing a player from the tournament, awarding their match to the opponent, and blocking their account |
| **Golden Boot** | Award for the player with the most goals in the main tournament (pre-qual excluded) |
| **Golden Ball** | Admin-designated award for the best overall player in the tournament |
| **Service role key** | Supabase admin key used exclusively in the backend; bypasses RLS; must never reach the browser |
| **Supabase Realtime** | WebSocket-based feature pushing database changes to clients instantly; used for notifications and match chat |
| **RLS** | Row-Level Security — PostgreSQL policies enforced by Supabase controlling what each user can read or write |
| **Intake** | The AI-guided conversation flow where the winning player submits match details after a game |
| **INTAKE_COMPLETE** | Signal token output by Gemini when all result details are collected and validated |

---

_eFootball Tournament Platform — v1.0 — May 2026_