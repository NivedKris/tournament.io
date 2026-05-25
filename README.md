# Tournament Management Platform

A high-performance, multi-tenant tournament management platform designed for competitive eFootball communities. Built as a monorepo, this system facilitates multi-stage tournament flows, squad builder tactical systems, and administrative consoles.

---

## Architecture Overview

The codebase is structured as a monorepo using npm workspaces:

```
├── apps
│   ├── api             # Express-based REST API
│   └── web             # React & Vite client application
├── packages
│   └── shared          # Shared TypeScript type definitions and models
├── packages/shared/src/index.ts
└── supabase            # Database migrations and schema definitions
```

### Technology Stack

* **Frontend**: React 18, Vite, React Router DOM, Zustand, Axios, Lucide React, and Tailwind CSS / custom stylesheets.
* **Backend**: Node.js, Express, TypeScript, and tsx.
* **Database & Authentication**: Supabase (PostgreSQL) with Row-Level Security (RLS) policies.
* **Integrations**: Google OAuth via Supabase, and Pesmaster API for player search proxies.

---

## Core Systems

### 1. Multi-Tenant Architecture
The platform is designed to run isolated tournament spaces (tenants) under a single database deployment.
* **Tenant Scoping**: All API requests carry the tenant context verified via request headers. The frontend manages tenant context using route queries and persistent local storage scopes (`oauth_tenant_slug`).
* **Tenant Invites**: System administrators can invite managers or players to specific tournaments via the Invitation API, which enforces membership roles.
* **Authentication Callback**: The callback router identifies multi-tenant users, routing them to a Tenant Selection interface if multiple tournament memberships exist, or straight to their active arena if scoped.

### 2. Squad Builder & Tactical Setup
An interactive tactical interface that allows managers to design their squad.
* **Tactical Setup**: Managers select from preloaded formations (e.g., 4-3-3, 4-4-2, 3-5-2) and drag player positions on a coordinate-based virtual pitch.
* **Player Catalog**: Integrates a proxy search querying external eFootball card databases, filtering card duplicates based on maximum overall ratings.
* **Locking Enforcements**: To maintain competitive integrity, squads can only be locked once all 11 starting XI positions and all 15 substitute slots (SUB 1 to SUB 15) are fully populated. Once locked, modifications are disabled.

### 3. Tournament Lifecycle Engine
Tournaments transition dynamically through several operational stages:
* **Registration**: Open phase for managers to claim clubs or nations.
* **Pre-Qualifying**: Play-in stages for unregistered or lower-seeded participants.
* **Group Stage**: Automated round-robin match scheduler dividing qualified claims into group pools.
* **Knockout Stage**: Bracket-based tournament progression.
* **Completed**: Finalized tournament history showing champions and records.

### 4. Dispute & Verification System
Matches are reported directly by players, with an integrated auditing process:
* **Score Submission**: Home and away managers submit scores.
* **Dispute Handler**: Conflicting score submissions flag the match as disputed, pausing bracket progression.
* **Super Admin Verification**: System admins review disputed logs and override scores to maintain tournament consistency.

---

## Database Configuration

Supabase migrations are managed sequentially under the `/supabase/migrations` directory:

1. `001_users.sql` - System-wide user definitions and session storage.
2. `002_tournament_setup.sql` - Core schemas for tournaments, nation claims, and squads.
3. `003_match_engine.sql` - Table models for matches, scoring, and stages.
4. `004_fix_users_rls.sql` - Row-level security adjustments for public profile lookup.
5. `005_lock_squads_and_stats.sql` - Enforcements for roster locking and statistics.
6. `006_users_cascade_update.sql` - Cascade update integrity constraints.
7. `007_rewards_system.sql` - Reward distribution models.
8. `008_user_email_and_notifications.sql` - System email and alerts registration.
9. `009_multi_tenancy.sql` - Multi-tenancy scopes and tenant mappings.
10. `010_invitations.sql` - Management of pending and accepted tenant invitations.

---

## Local Development Setup

### Prerequisites
* Node.js (version 20 or higher)
* npm (version 10 or higher)
* A running Supabase instance

### Environment Configuration
Create a `.env` file in the root directory and populate the required keys:

```env
SUPABASE_URL=your_supabase_project_url
SUPABASE_ANON_KEY=your_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
JWT_SECRET=your_jwt_signing_secret
```

### Installation
Install project dependencies from the repository root:
```bash
npm install
```

### Running the Platform
Launch both the API server (port 3001) and Vite dev server (port 5173) concurrently:
```bash
npm run dev
```

### Building the Platform
Compile TypeScript packages and bundle the production assets:
```bash
npm run build
```
