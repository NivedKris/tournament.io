-- Migration 011: Add screenshot_url to squads table
alter table squads add column if not exists screenshot_url text;
