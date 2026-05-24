-- Clear existing player/squad/match/reward/claims data
truncate table public.matches cascade;
truncate table public.squads cascade;
truncate table public.nation_claims cascade;
truncate table public.tournament_rewards cascade;

-- Delete all users from Supabase Auth and public users EXCEPT for the super admin
delete from auth.users where email != 'mark.organisation@gmail.com';
delete from public.users where email != 'mark.organisation@gmail.com';

-- Create tenant_memberships table
create table if not exists public.tenant_memberships (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.users(id) on delete cascade,
  tenant_id uuid references public.tenants(id) on delete cascade,
  role text not null check (role in ('player', 'admin')),
  created_at timestamptz default now(),
  unique(user_id, tenant_id)
);

-- Enable RLS and permissions for tenant_memberships
alter table public.tenant_memberships enable row level security;
grant all on table public.tenant_memberships to postgres, service_role, authenticated, anon;

-- Create tenant_invitations table
create table if not exists public.tenant_invitations (
  id uuid primary key default gen_random_uuid(),
  email text not null,
  tenant_id uuid references public.tenants(id) on delete cascade,
  role text not null check (role in ('player', 'admin')),
  status text not null check (status in ('pending', 'joined')),
  created_at timestamptz default now(),
  unique(email, tenant_id)
);

-- Enable RLS and permissions for tenant_invitations
alter table public.tenant_invitations enable row level security;
grant all on table public.tenant_invitations to postgres, service_role, authenticated, anon;

-- Insert tenant_memberships for existing admins so they don't get locked out
insert into public.tenant_memberships (user_id, tenant_id, role)
select id, tenant_id, role from public.users
where role = 'admin' and tenant_id is not null
on conflict do nothing;
