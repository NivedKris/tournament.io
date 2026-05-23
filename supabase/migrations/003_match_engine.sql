-- ============================================================
-- Migration 003: Match Engine, Chat, Disputes
-- Phase 3 — Pre-Qualification, Group Stage & Knockouts
-- ============================================================

-- 1. Matches
create table if not exists matches (
  id              uuid primary key default gen_random_uuid(),
  tournament_id   uuid not null references tournaments(id) on delete cascade,
  home_claim_id   uuid not null references nation_claims(id) on delete cascade,
  away_claim_id   uuid not null references nation_claims(id) on delete cascade,

  -- Stage: pre_qual | group | knockout
  stage           text not null check (stage in ('pre_qual', 'group', 'knockout')),
  group_name      text,       -- 'A', 'B', … (group stage only)
  round           integer,    -- knockout: 1=final, 2=semi, 3=quarter, etc.
  bracket_slot    integer,    -- knockout: slot within the round (1-based). Used to build the tree.

  -- Status lifecycle
  status          text not null default 'scheduled'
                    check (status in ('scheduled','pending_verification','verified','disputed')),

  -- Scores (null until submitted)
  home_score      integer,
  away_score      integer,

  -- Penalty shootout (null if no shootout was needed)
  home_pens       integer,
  away_pens       integer,

  submitted_by    uuid references users(id),  -- who submitted the tentative score
  is_prequal      boolean not null default false,
  is_bye          boolean not null default false,  -- BYE slot, auto-verified on creation

  verified_at     timestamptz,
  created_at      timestamptz not null default now()
);

-- 2. Messages (per-match chat)
create table if not exists messages (
  id              uuid primary key default gen_random_uuid(),
  match_id        uuid not null references matches(id) on delete cascade,
  sender_id       uuid not null references users(id) on delete cascade,
  body            text not null check (char_length(body) <= 1000),
  attachment_url  text,
  created_at      timestamptz not null default now()
);

-- 3. Disputes
create table if not exists disputes (
  id           uuid primary key default gen_random_uuid(),
  match_id     uuid not null references matches(id) on delete cascade,
  raised_by    uuid not null references users(id) on delete cascade,
  comment      text,
  status       text not null default 'open' check (status in ('open','resolved')),
  resolution   text,
  resolved_by  uuid references users(id),
  resolved_at  timestamptz,
  created_at   timestamptz not null default now()
);

-- ============================================================
-- Row Level Security
-- ============================================================

alter table matches  enable row level security;
alter table messages enable row level security;
alter table disputes enable row level security;

-- Matches: public read, admin write
create policy "public read matches"  on matches for select using (true);
create policy "admin write matches"  on matches for all using (
  exists (select 1 from users where users.id = auth.uid() and users.role = 'admin')
);

-- Messages: only match participants (or admin) can read/insert
create policy "participant read messages" on messages for select using (
  exists (
    select 1 from matches m
    join nation_claims hc on hc.id = m.home_claim_id
    join nation_claims ac on ac.id = m.away_claim_id
    where m.id = messages.match_id
      and (hc.user_id = auth.uid() or ac.user_id = auth.uid())
  )
  or exists (select 1 from users where users.id = auth.uid() and users.role = 'admin')
);

create policy "participant insert messages" on messages for insert with check (
  auth.uid() = sender_id
  and (
    exists (
      select 1 from matches m
      join nation_claims hc on hc.id = m.home_claim_id
      join nation_claims ac on ac.id = m.away_claim_id
      where m.id = match_id
        and (hc.user_id = auth.uid() or ac.user_id = auth.uid())
    )
    or exists (select 1 from users where users.id = auth.uid() and users.role = 'admin')
  )
);

-- Disputes
create policy "participant read disputes" on disputes for select using (
  exists (
    select 1 from matches m
    join nation_claims hc on hc.id = m.home_claim_id
    join nation_claims ac on ac.id = m.away_claim_id
    where m.id = disputes.match_id
      and (hc.user_id = auth.uid() or ac.user_id = auth.uid())
  )
  or exists (select 1 from users where users.id = auth.uid() and users.role = 'admin')
);

create policy "participant insert disputes" on disputes for insert with check (
  auth.uid() = raised_by
  and exists (
    select 1 from matches m
    join nation_claims hc on hc.id = m.home_claim_id
    join nation_claims ac on ac.id = m.away_claim_id
    where m.id = match_id
      and (hc.user_id = auth.uid() or ac.user_id = auth.uid())
  )
);

create policy "admin update disputes" on disputes for update using (
  exists (select 1 from users where users.id = auth.uid() and users.role = 'admin')
);
