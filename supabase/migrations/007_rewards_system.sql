-- 1. Create tournament_rewards table
create table if not exists tournament_rewards (
  id             uuid primary key default gen_random_uuid(),
  tournament_id  uuid not null references tournaments(id) on delete cascade unique,
  name           text not null,
  image_url      text,
  cta_link       text,
  cta_text       text,
  created_at     timestamptz not null default now()
);

-- 2. Enable RLS
alter table tournament_rewards enable row level security;

-- 3. Create policies
create policy "public read tournament_rewards" on tournament_rewards for select using (true);
create policy "admin write tournament_rewards" on tournament_rewards for all using (
  exists (select 1 from users where users.id = auth.uid() and users.role = 'admin')
);
