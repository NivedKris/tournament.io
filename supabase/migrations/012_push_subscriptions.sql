-- ============================================================
-- Migration 012: Push subscriptions
-- Add table to store user Web Push Subscriptions with RLS
-- ============================================================

create table if not exists push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users(id) on delete cascade,
  subscription jsonb not null,
  created_at timestamptz not null default now(),
  constraint unique_user_subscription unique (user_id, subscription)
);

-- Enable Row Level Security
alter table push_subscriptions enable row level security;

-- Policies for security
create policy "users manage own push subscriptions"
  on push_subscriptions for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
