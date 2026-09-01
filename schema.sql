-- Ledger: task board schema for Supabase
-- Run this in the Supabase SQL editor (Project > SQL Editor > New query)
-- NOTE: this replaces the old fixed-status "tasks" table with a workspaces/groups
-- model that supports multiple boards and custom columns. Safe to re-run.

create extension if not exists "pgcrypto";

drop table if exists tasks cascade;
drop table if exists groups cascade;
drop table if exists workspaces cascade;

create table workspaces (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  position int not null default 0,
  created_at timestamptz not null default now()
);

create table groups (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspaces(id) on delete cascade,
  name text not null,
  is_done_group boolean not null default false,
  position int not null default 0,
  created_at timestamptz not null default now()
);

create table tasks (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references groups(id) on delete cascade,
  title text not null,
  description text default '',
  priority text not null default 'normal' check (priority in ('low', 'normal', 'high')),
  due_date date,
  is_favorite boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Keep updated_at current on every edit
create or replace function set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists tasks_set_updated_at on tasks;
create trigger tasks_set_updated_at
  before update on tasks
  for each row
  execute function set_updated_at();

-- Row Level Security
-- This is a single-user personal tool. RLS is enabled below with an open
-- policy for the anon key so the static site can read/write directly.
-- Do NOT put this site's URL somewhere public/indexed — anyone with the
-- link and the anon key can read and edit your boards. If you ever expose
-- this beyond yourself, swap this policy for real Supabase Auth.
alter table workspaces enable row level security;
alter table groups enable row level security;
alter table tasks enable row level security;

drop policy if exists "anon full access" on workspaces;
create policy "anon full access" on workspaces for all to anon using (true) with check (true);

drop policy if exists "anon full access" on groups;
create policy "anon full access" on groups for all to anon using (true) with check (true);

drop policy if exists "anon full access" on tasks;
create policy "anon full access" on tasks for all to anon using (true) with check (true);

-- Helpful indexes
create index groups_workspace_idx on groups (workspace_id);
create index tasks_group_idx on tasks (group_id);
create index tasks_due_date_idx on tasks (due_date);

-- The website auto-creates a default "My tasks" board with To do / In
-- progress / Done groups on first load if no workspace exists yet, so no
-- seed data is needed here.

-- Migration only (run this ONE line instead of the whole file if you already
-- have data in your tasks table and don't want to wipe it):
-- alter table tasks add column if not exists is_favorite boolean not null default false;
