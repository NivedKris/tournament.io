-- 1. Add email column to users table
alter table users add column if not exists email text;

-- 2. Sync existing records from auth.users
update users u
set email = au.email
from auth.users au
where u.id = au.id;
