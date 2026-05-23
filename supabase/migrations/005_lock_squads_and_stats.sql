-- 1. Add locked column to squads table
alter table squads add column if not exists locked boolean not null default false;

-- 2. Add screenshot_url column to matches table
alter table matches add column if not exists screenshot_url text;

-- 3. Create match_events table for tracking player goals and assists
create table if not exists match_events (
  id              uuid primary key default gen_random_uuid(),
  match_id        uuid not null references matches(id) on delete cascade,
  claim_id        uuid not null references nation_claims(id) on delete cascade,
  player_id       bigint not null references players(id) on delete cascade,
  event_type      text not null check (event_type in ('goal', 'assist')),
  created_at      timestamptz not null default now()
);

-- Enable RLS
alter table match_events enable row level security;

-- Create public read policy
create policy "public read match_events" on match_events for select using (true);
