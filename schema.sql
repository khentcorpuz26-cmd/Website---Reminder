-- Ledger: task board schema for Supabase
-- Run this once in the Supabase SQL editor (Project > SQL Editor > New query)

create extension if not exists "pgcrypto";

create table if not exists tasks (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  description text default '',
  status text not null default 'todo' check (status in ('todo', 'in_progress', 'done')),
  priority text not null default 'normal' check (priority in ('low', 'normal', 'high')),
  due_date date,
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
-- link and the anon key can read and edit your tasks. If you ever expose
-- this beyond yourself, swap this policy for real Supabase Auth.
alter table tasks enable row level security;

drop policy if exists "anon full access" on tasks;
create policy "anon full access"
  on tasks
  for all
  to anon
  using (true)
  with check (true);

-- Helpful index for the reminder workflow's daily query
create index if not exists tasks_status_idx on tasks (status);
create index if not exists tasks_due_date_idx on tasks (due_date);
