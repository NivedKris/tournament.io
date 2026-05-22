-- ============================================================
-- Migration 002: Tournaments, Nations, Claims, Players, Squads
-- Phase 2 — Tournament Setup & Squad Builder
-- ============================================================

-- 1. Tournaments
create table if not exists tournaments (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  mode        text not null check (mode in ('world_cup', 'ucl')),
  status      text not null default 'registration'
                check (status in ('registration','pre_qual','group_stage','knockout','completed')),
  created_at  timestamptz not null default now()
);

-- 2. Nations / clubs
create table if not exists nations (
  id        uuid primary key default gen_random_uuid(),
  name      text not null,
  flag_url  text,
  mode      text not null check (mode in ('world_cup', 'ucl'))
);

-- 3. Nation Claims
create table if not exists nation_claims (
  id             uuid primary key default gen_random_uuid(),
  tournament_id  uuid not null references tournaments(id) on delete cascade,
  nation_id      uuid not null references nations(id) on delete cascade,
  user_id        uuid not null references users(id) on delete cascade,
  status         text not null default 'pending'
                   check (status in ('pending','pending_prequal','qualified','eliminated')),
  created_at     timestamptz not null default now(),
  unique (tournament_id, user_id)
);

-- 4. Players
create table if not exists players (
  id           bigint primary key,  -- eFootball Pesmaster ID
  name         text not null,
  positions    text[] not null,     -- ['GK', 'CF']
  overall      integer,
  club         text,
  nationality  text,
  image_url    text,
  created_at   timestamptz not null default now()
);

-- 5. Squads
create table if not exists squads (
  id             uuid primary key default gen_random_uuid(),
  user_id        uuid not null references users(id) on delete cascade,
  tournament_id  uuid not null references tournaments(id) on delete cascade,
  claim_id       uuid not null references nation_claims(id) on delete cascade,
  formation      text not null,     -- '4-3-3'
  positions      jsonb not null,    -- { "GK": player_id, "CB_L": player_id, ... }
  coordinates    jsonb,             -- { "GK": { "x": 50, "y": 88 }, ... }
  updated_at     timestamptz not null default now(),
  unique (claim_id)
);

-- ============================================================
-- Row Level Security
-- ============================================================

alter table tournaments enable row level security;
alter table nations enable row level security;
alter table nation_claims enable row level security;
alter table players enable row level security;
alter table squads enable row level security;

-- Tournaments policies
create policy "public read tournaments" on tournaments for select using (true);
create policy "admin write tournaments" on tournaments for all using (
  exists (select 1 from users where users.id = auth.uid() and users.role = 'admin')
);

-- Nations policies
create policy "public read nations" on nations for select using (true);
create policy "admin write nations" on nations for all using (
  exists (select 1 from users where users.id = auth.uid() and users.role = 'admin')
);

-- Nation Claims policies
create policy "public read nation_claims" on nation_claims for select using (true);
create policy "self insert nation_claims" on nation_claims for insert with check (auth.uid() = user_id);
create policy "self delete nation_claims" on nation_claims for delete using (auth.uid() = user_id);
create policy "admin write nation_claims" on nation_claims for all using (
  exists (select 1 from users where users.id = auth.uid() and users.role = 'admin')
);

-- Players policies
create policy "public read players" on players for select using (true);
create policy "authenticated insert players" on players for insert with check (auth.uid() is not null);
create policy "authenticated update players" on players for update using (auth.uid() is not null);

-- Squads policies
create policy "public read squads" on squads for select using (true);
create policy "owner insert squads" on squads for insert with check (auth.uid() = user_id);
create policy "owner update squads" on squads for update using (auth.uid() = user_id);
create policy "admin write squads" on squads for all using (
  exists (select 1 from users where users.id = auth.uid() and users.role = 'admin')
);

-- ============================================================
-- Seeding Default Data
-- ============================================================

-- Seed World Cup Nations (mode = 'world_cup')
insert into nations (name, flag_url, mode) values
  ('Qatar', 'https://flagcdn.com/w160/qa.png', 'world_cup'),
  ('Ecuador', 'https://flagcdn.com/w160/ec.png', 'world_cup'),
  ('Senegal', 'https://flagcdn.com/w160/sn.png', 'world_cup'),
  ('Netherlands', 'https://flagcdn.com/w160/nl.png', 'world_cup'),
  ('England', 'https://flagcdn.com/w160/gb-eng.png', 'world_cup'),
  ('Iran', 'https://flagcdn.com/w160/ir.png', 'world_cup'),
  ('USA', 'https://flagcdn.com/w160/us.png', 'world_cup'),
  ('Wales', 'https://flagcdn.com/w160/gb-wls.png', 'world_cup'),
  ('Argentina', 'https://flagcdn.com/w160/ar.png', 'world_cup'),
  ('Saudi Arabia', 'https://flagcdn.com/w160/sa.png', 'world_cup'),
  ('Mexico', 'https://flagcdn.com/w160/mx.png', 'world_cup'),
  ('Poland', 'https://flagcdn.com/w160/pl.png', 'world_cup'),
  ('France', 'https://flagcdn.com/w160/fr.png', 'world_cup'),
  ('Australia', 'https://flagcdn.com/w160/au.png', 'world_cup'),
  ('Denmark', 'https://flagcdn.com/w160/dk.png', 'world_cup'),
  ('Tunisia', 'https://flagcdn.com/w160/tn.png', 'world_cup'),
  ('Spain', 'https://flagcdn.com/w160/es.png', 'world_cup'),
  ('Costa Rica', 'https://flagcdn.com/w160/cr.png', 'world_cup'),
  ('Germany', 'https://flagcdn.com/w160/de.png', 'world_cup'),
  ('Japan', 'https://flagcdn.com/w160/jp.png', 'world_cup'),
  ('Belgium', 'https://flagcdn.com/w160/be.png', 'world_cup'),
  ('Canada', 'https://flagcdn.com/w160/ca.png', 'world_cup'),
  ('Morocco', 'https://flagcdn.com/w160/ma.png', 'world_cup'),
  ('Croatia', 'https://flagcdn.com/w160/hr.png', 'world_cup'),
  ('Brazil', 'https://flagcdn.com/w160/br.png', 'world_cup'),
  ('Serbia', 'https://flagcdn.com/w160/rs.png', 'world_cup'),
  ('Switzerland', 'https://flagcdn.com/w160/ch.png', 'world_cup'),
  ('Cameroon', 'https://flagcdn.com/w160/cm.png', 'world_cup'),
  ('Portugal', 'https://flagcdn.com/w160/pt.png', 'world_cup'),
  ('Ghana', 'https://flagcdn.com/w160/gh.png', 'world_cup'),
  ('Uruguay', 'https://flagcdn.com/w160/uy.png', 'world_cup'),
  ('South Korea', 'https://flagcdn.com/w160/kr.png', 'world_cup');

-- Seed UCL Clubs (mode = 'ucl')
insert into nations (name, flag_url, mode) values
  ('Arsenal', 'https://cdn.jsdelivr.net/gh/luukhopman/football-logos/history/2021-22/England%20-%20Premier%20League/Arsenal.png', 'ucl'),
  ('Chelsea', 'https://cdn.jsdelivr.net/gh/luukhopman/football-logos/history/2021-22/England%20-%20Premier%20League/Chelsea.png', 'ucl'),
  ('Liverpool FC', 'https://cdn.jsdelivr.net/gh/luukhopman/football-logos/history/2021-22/England%20-%20Premier%20League/Liverpool%20FC.png', 'ucl'),
  ('Man City', 'https://cdn.jsdelivr.net/gh/luukhopman/football-logos/history/2021-22/England%20-%20Premier%20League/Man%20City.png', 'ucl'),
  ('Manchester United', 'https://cdn.jsdelivr.net/gh/luukhopman/football-logos/history/2021-22/England%20-%20Premier%20League/Manchester%20United.png', 'ucl'),
  ('Real Madrid', 'https://cdn.jsdelivr.net/gh/luukhopman/football-logos/history/2021-22/Spain%20-%20LaLiga/Real%20Madrid.png', 'ucl'),
  ('Barcelona', 'https://cdn.jsdelivr.net/gh/luukhopman/football-logos/history/2021-22/Spain%20-%20LaLiga/Barcelona.png', 'ucl'),
  ('Atlético de Madrid', 'https://cdn.jsdelivr.net/gh/luukhopman/football-logos/history/2021-22/Spain%20-%20LaLiga/Atl%C3%A9tico%20de%20Madrid.png', 'ucl'),
  ('Sevilla FC', 'https://cdn.jsdelivr.net/gh/luukhopman/football-logos/history/2021-22/Spain%20-%20LaLiga/Sevilla%20FC.png', 'ucl'),
  ('Real Betis Balompié', 'https://cdn.jsdelivr.net/gh/luukhopman/football-logos/history/2021-22/Spain%20-%20LaLiga/Real%20Betis%20Balompi%C3%A9.png', 'ucl'),
  ('AC Milan', 'https://cdn.jsdelivr.net/gh/luukhopman/football-logos/history/2021-22/Italy%20-%20Serie%20A/AC%20Milan.png', 'ucl'),
  ('Inter Milan', 'https://cdn.jsdelivr.net/gh/luukhopman/football-logos/history/2021-22/Italy%20-%20Serie%20A/Inter%20Milan.png', 'ucl'),
  ('Juventus', 'https://cdn.jsdelivr.net/gh/luukhopman/football-logos/history/2021-22/Italy%20-%20Serie%20A/Juventus.png', 'ucl'),
  ('AS Roma', 'https://cdn.jsdelivr.net/gh/luukhopman/football-logos/history/2021-22/Italy%20-%20Serie%20A/AS%20Roma.png', 'ucl'),
  ('SSC Napoli', 'https://cdn.jsdelivr.net/gh/luukhopman/football-logos/history/2021-22/Italy%20-%20Serie%20A/SSC%20Napoli.png', 'ucl'),
  ('FC Bayern ', 'https://cdn.jsdelivr.net/gh/luukhopman/football-logos/history/2021-22/Germany%20-%20Bundesliga/FC%20Bayern%20.png', 'ucl'),
  ('Borussia Dortmund', 'https://cdn.jsdelivr.net/gh/luukhopman/football-logos/history/2021-22/Germany%20-%20Bundesliga/Borussia%20Dortmund.png', 'ucl'),
  ('Bayer 04 Leverkusen', 'https://cdn.jsdelivr.net/gh/luukhopman/football-logos/history/2021-22/Germany%20-%20Bundesliga/Bayer%2004%20Leverkusen.png', 'ucl'),
  ('RB Leipzig', 'https://cdn.jsdelivr.net/gh/luukhopman/football-logos/history/2021-22/Germany%20-%20Bundesliga/RB%20Leipzig.png', 'ucl'),
  ('E. Frankfurt', 'https://cdn.jsdelivr.net/gh/luukhopman/football-logos/history/2021-22/Germany%20-%20Bundesliga/E.%20Frankfurt.png', 'ucl'),
  ('Paris SG', 'https://cdn.jsdelivr.net/gh/luukhopman/football-logos/history/2021-22/France%20-%20Ligue%201/Paris%20SG.png', 'ucl'),
  ('AS Monaco', 'https://cdn.jsdelivr.net/gh/luukhopman/football-logos/history/2021-22/France%20-%20Ligue%201/AS%20Monaco.png', 'ucl'),
  ('Olympique Lyon', 'https://cdn.jsdelivr.net/gh/luukhopman/football-logos/history/2021-22/France%20-%20Ligue%201/Olympique%20Lyon.png', 'ucl'),
  ('Marseille', 'https://cdn.jsdelivr.net/gh/luukhopman/football-logos/history/2021-22/France%20-%20Ligue%201/Marseille.png', 'ucl'),
  ('LOSC Lille', 'https://cdn.jsdelivr.net/gh/luukhopman/football-logos/history/2021-22/France%20-%20Ligue%201/LOSC%20Lille.png', 'ucl');
