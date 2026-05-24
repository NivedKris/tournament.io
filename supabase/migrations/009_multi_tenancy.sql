-- ============================================================
-- Migration 009: Multi-Tenancy & Super Admin Support
-- ============================================================

-- Create tenants table
create table if not exists tenants (
  id             uuid primary key default gen_random_uuid(),
  name           text not null,
  slug           text not null unique,
  logo_url       text,
  primary_color  text not null default '#3b82f6',
  admin_email    text unique not null,
  status         text not null default 'active' check (status in ('active', 'suspended')),
  created_at     timestamptz not null default now()
);

-- Alter users check constraint for roles and add tenant_id
alter table users drop constraint if exists users_role_check;
alter table users add constraint users_role_check check (role in ('player', 'admin', 'super_admin'));
alter table users add column if not exists tenant_id uuid references tenants(id) on delete cascade;

-- Alter other tables to partition data by tenant
alter table tournaments add column if not exists tenant_id uuid references tenants(id) on delete cascade;
alter table nation_claims add column if not exists tenant_id uuid references tenants(id) on delete cascade;
alter table squads add column if not exists tenant_id uuid references tenants(id) on delete cascade;
alter table matches add column if not exists tenant_id uuid references tenants(id) on delete cascade;
alter table tournament_rewards add column if not exists tenant_id uuid references tenants(id) on delete cascade;

-- Seed default tenant
insert into tenants (id, name, slug, logo_url, primary_color, admin_email)
values ('00000000-0000-0000-0000-000000000000', 'Default Tournament League', 'default', '/logo.png', '#3b82f6', 'default_admin@test.com')
on conflict (id) do nothing;

-- Populate existing records with default tenant_id
update users set tenant_id = '00000000-0000-0000-0000-000000000000' where tenant_id is null;
update tournaments set tenant_id = '00000000-0000-0000-0000-000000000000' where tenant_id is null;
update nation_claims set tenant_id = '00000000-0000-0000-0000-000000000000' where tenant_id is null;
update squads set tenant_id = '00000000-0000-0000-0000-000000000000' where tenant_id is null;
update matches set tenant_id = '00000000-0000-0000-0000-000000000000' where tenant_id is null;
update tournament_rewards set tenant_id = '00000000-0000-0000-0000-000000000000' where tenant_id is null;
