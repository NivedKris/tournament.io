-- ============================================================
-- Migration 001: Users table
-- Phase 1 — Foundation & Authentication
-- ============================================================

create table if not exists users (
  id            uuid primary key,  -- same UUID as auth.users.id
  google_id     text unique not null,
  display_name  text not null default '',
  username      text unique not null default '',
  role          text not null default 'player'
                  check (role in ('player', 'admin')),
  is_suspended  boolean not null default false,
  created_at    timestamptz not null default now()
);

-- Row Level Security
alter table users enable row level security;

-- Anyone can read public profiles
create policy "public read users"
  on users for select
  using (true);

-- Users can only update their own record
create policy "self update users"
  on users for update
  using (auth.uid() = id);

-- Only the service role (backend) can insert/delete
-- (RLS won't block service role — this just prevents anon/authenticated direct inserts)
create policy "service insert users"
  on users for insert
  with check (false);   -- blocked for anon/authenticated; service role bypasses RLS
