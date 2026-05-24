-- Drop unused tables
drop table if exists notifications cascade;

-- Add ON UPDATE CASCADE to all foreign key references to users(id)

-- 1. nation_claims (user_id)
alter table nation_claims drop constraint if exists nation_claims_user_id_fkey;
alter table nation_claims 
  add constraint nation_claims_user_id_fkey 
  foreign key (user_id) 
  references users(id) 
  on delete cascade 
  on update cascade;

-- 2. squads (user_id)
alter table squads drop constraint if exists squads_user_id_fkey;
alter table squads 
  add constraint squads_user_id_fkey 
  foreign key (user_id) 
  references users(id) 
  on delete cascade 
  on update cascade;

-- 3. matches (submitted_by)
alter table matches drop constraint if exists matches_submitted_by_fkey;
alter table matches 
  add constraint matches_submitted_by_fkey 
  foreign key (submitted_by) 
  references users(id) 
  on delete set null 
  on update cascade;

-- 4. messages (sender_id)
alter table messages drop constraint if exists messages_sender_id_fkey;
alter table messages 
  add constraint messages_sender_id_fkey 
  foreign key (sender_id) 
  references users(id) 
  on delete cascade 
  on update cascade;

-- 5. disputes (raised_by and resolved_by)
alter table disputes drop constraint if exists disputes_raised_by_fkey;
alter table disputes 
  add constraint disputes_raised_by_fkey 
  foreign key (raised_by) 
  references users(id) 
  on delete cascade 
  on update cascade;

alter table disputes drop constraint if exists disputes_resolved_by_fkey;
alter table disputes 
  add constraint disputes_resolved_by_fkey 
  foreign key (resolved_by) 
  references users(id) 
  on delete set null 
  on update cascade;
