-- ═══════════════════════════════════════════════════════════════
-- TestOrbit Supabase Schema
-- ═══════════════════════════════════════════════════════════════
-- This schema is IDEMPOTENT — safe to run multiple times.
-- It uses CREATE TABLE IF NOT EXISTS + ALTER TABLE ADD COLUMN IF NOT EXISTS
-- to handle partial prior runs gracefully.
--
-- EXECUTION ORDER (to avoid "relation does not exist" errors):
--   Phase 1: Create all tables (no cross-table policy references)
--   Phase 2: Add columns that may be missing from older table versions
--   Phase 3: Create triggers and functions
--   Phase 4: Create/replace all RLS policies (may reference any table)
--   Phase 5: Create indexes
-- ═══════════════════════════════════════════════════════════════

-- Enable UUID extension
create schema if not exists private;
revoke all on schema private from public;
grant usage on schema private to authenticated;

-- ─────────────────────────────────────────────────────────────
-- PHASE 1: CREATE ALL TABLES (no cross-references in policies)
-- ─────────────────────────────────────────────────────────────

-- 1. PROFILES
create table if not exists profiles (
  id uuid references auth.users not null primary key,
  email text,
  full_name text,
  avatar_url text,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);
alter table profiles enable row level security;

-- 2. COLLECTIONS
create table if not exists collections (
  id uuid default gen_random_uuid() primary key,
  name text not null,
  description text,
  owner_id uuid references auth.users not null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null,
  data jsonb default '{}'::jsonb
);
alter table collections enable row level security;

-- 3. COLLECTION_SHARES
create table if not exists collection_shares (
  id uuid default gen_random_uuid() primary key,
  collection_id uuid references collections(id) on delete cascade not null,
  user_email text not null,
  role text check (role in ('viewer', 'editor')) default 'viewer',
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  unique(collection_id, user_email)
);
alter table collection_shares enable row level security;

-- 4. TEAMS
create table if not exists teams (
  id uuid default gen_random_uuid() primary key,
  name text not null,
  owner_id uuid references auth.users not null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);
alter table teams enable row level security;

-- 5. TEAM_MEMBERS
create table if not exists team_members (
  id uuid default gen_random_uuid() primary key,
  team_id uuid references teams(id) on delete cascade not null,
  user_id uuid references auth.users,
  user_email text not null,
  role text check (role in ('owner', 'admin', 'editor', 'viewer')) default 'viewer',
  invited_at timestamp with time zone default timezone('utc'::text, now()) not null,
  joined_at timestamp with time zone,
  unique(team_id, user_email)
);
alter table team_members enable row level security;

-- 6. ENVIRONMENTS
create table if not exists environments (
  id uuid default gen_random_uuid() primary key,
  owner_id uuid references auth.users not null,
  name text not null,
  vars jsonb default '[]'::jsonb,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null,
  unique(owner_id, name)
);
alter table environments enable row level security;

-- 7. USAGE_LOGS
create table if not exists usage_logs (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users not null,
  endpoint text not null,
  category text not null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);
alter table usage_logs enable row level security;

-- 8. REQUEST_HISTORY
create table if not exists request_history (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users not null,
  collection_id uuid references collections(id) on delete set null,
  name text,
  method text not null default 'GET',
  url text not null,
  status integer,
  duration_ms integer,
  success boolean default false,
  request_body text,
  response_body text,
  request_headers jsonb,
  response_headers jsonb,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);
alter table request_history enable row level security;

-- ─────────────────────────────────────────────────────────────
-- PHASE 2: ADD COLUMNS THAT MAY BE MISSING (from older schema runs)
-- ─────────────────────────────────────────────────────────────

-- collections.team_id (added in team workspace sprint)
ALTER TABLE collections ADD COLUMN IF NOT EXISTS team_id uuid references teams(id) on delete cascade;

-- environments.team_id (added in team workspace sprint)
ALTER TABLE environments ADD COLUMN IF NOT EXISTS team_id uuid references teams(id) on delete cascade;


-- ─────────────────────────────────────────────────────────────
-- PHASE 3: FUNCTIONS & TRIGGERS
-- ─────────────────────────────────────────────────────────────

-- 3-pre. SECURITY DEFINER helpers to avoid infinite recursion in RLS policies.
-- team_members policies need to query team_members itself (self-reference).
-- Without SECURITY DEFINER, Postgres detects infinite recursion and errors.
-- These functions bypass RLS when called from policies.

-- Helper to check collection ownership (avoids cross-table RLS recursion between collections ↔ collection_shares)
create or replace function private.is_collection_owner(p_collection_id uuid, p_user_id uuid)
returns boolean as $$
  select exists (
    select 1 from public.collections
    where id = p_collection_id and owner_id = p_user_id and p_user_id = auth.uid()
  );
$$ language sql security definer set search_path = '';

-- Helper to check if user has a share on a collection (avoids recursion from public.collections SELECT policy)
create or replace function private.has_collection_share(p_collection_id uuid, p_email text)
returns boolean as $$
  select exists (
    select 1 from public.collection_shares
    where collection_id = p_collection_id and user_email = p_email and p_email = auth.email()
  );
$$ language sql security definer set search_path = '';

create or replace function private.has_collection_share_role(p_collection_id uuid, p_email text, p_role text)
returns boolean as $$
  select exists (
    select 1 from public.collection_shares
    where collection_id = p_collection_id and user_email = p_email and p_email = auth.email() and role = p_role
  );
$$ language sql security definer set search_path = '';

-- No DROP — policies depend on these functions. CREATE OR REPLACE updates them in-place.
create or replace function private.is_team_member(p_team_id uuid, p_email text)
returns boolean as $$
  select exists (
    select 1 from public.team_members
    where team_id = p_team_id and user_email = p_email and p_email = auth.email()
  );
$$ language sql security definer set search_path = '';

-- No DROP — policies depend on this function. CREATE OR REPLACE updates it in-place.
create or replace function private.is_team_member_with_role(p_team_id uuid, p_email text, p_roles text[])
returns boolean as $$
  select exists (
    select 1 from public.team_members
    where team_id = p_team_id and user_email = p_email and p_email = auth.email() and role = ANY(p_roles)
  );
$$ language sql security definer set search_path = '';

-- 3a. Prevent editors from stealing collection ownership
drop trigger if exists guard_owner_id on collections;
drop function if exists prevent_owner_id_hijack;

create or replace function private.prevent_owner_id_hijack()
returns trigger as $$
begin
  if OLD.owner_id is distinct from NEW.owner_id then
    raise exception 'Ownership cannot be changed through the client API';
  end if;
  if OLD.team_id is distinct from NEW.team_id then
    raise exception 'Resource team cannot be changed through the client API';
  end if;
  return NEW;
end;
$$ language plpgsql security definer set search_path = '';

create trigger guard_owner_id
  before update on collections
  for each row execute function private.prevent_owner_id_hijack();
drop trigger if exists guard_environment_owner on environments;
create trigger guard_environment_owner
  before update on environments
  for each row execute function private.prevent_owner_id_hijack();

-- Retire paid-tier restrictions without deleting existing customer data.
drop trigger if exists guard_share_limit on collection_shares;
drop function if exists enforce_share_limit;
drop trigger if exists guard_team_member_limit on team_members;
drop function if exists enforce_team_member_limit;

-- 3d. Prevent non-owners from changing the owner role
drop trigger if exists guard_owner_role on team_members;
drop function if exists prevent_owner_role_change;

create or replace function private.prevent_owner_role_change()
returns trigger as $$
begin
  if TG_OP = 'UPDATE' then
    if OLD.team_id is distinct from NEW.team_id
       or OLD.user_email is distinct from NEW.user_email
       or OLD.user_id is distinct from NEW.user_id then
      raise exception 'Member identity cannot be changed';
    end if;
    if OLD.role = 'owner' and NEW.role != 'owner' then
      raise exception 'The team owner role cannot be changed';
    end if;
  end if;
  if NEW.role = 'owner' and not exists (
    select 1 from public.teams t join auth.users u on u.id = t.owner_id
    where t.id = NEW.team_id and t.owner_id = NEW.user_id and u.email = NEW.user_email
  ) then
    raise exception 'Only the actual team owner can hold the owner role';
  end if;
  return NEW;
end;
$$ language plpgsql security definer set search_path = '';

create trigger guard_owner_role
  before insert or update on team_members
  for each row execute function private.prevent_owner_role_change();

drop trigger if exists guard_team_plan on teams;
drop function if exists prevent_team_plan_change;

-- 3f. Auto-create profile on signup
drop trigger if exists on_auth_user_created on auth.users;
drop function if exists public.handle_new_user;

create or replace function private.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, email, full_name, avatar_url)
  values (new.id, new.email, new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'avatar_url');
  return new;
end;
$$ language plpgsql security definer set search_path = '';

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure private.handle_new_user();


-- ─────────────────────────────────────────────────────────────
-- PHASE 4: ALL RLS POLICIES
-- Now ALL tables and columns exist, so cross-references are safe.
-- ─────────────────────────────────────────────────────────────

-- ── Profiles policies ──
drop policy if exists "Public profiles are viewable by everyone." on profiles;
drop policy if exists "Users can view their own profile." on profiles;
create policy "Users can view their own profile." on profiles for select to authenticated using (auth.uid() = id);

drop policy if exists "Users can insert their own profile." on profiles;
create policy "Users can insert their own profile." on profiles for insert with check (auth.uid() = id);

drop policy if exists "Users can update own profile." on profiles;
create policy "Users can update own profile." on profiles for update using (auth.uid() = id);

-- ── Collections policies (all cross-table refs use SECURITY DEFINER helpers) ──
drop policy if exists "Users can view their own collections." on collections;
create policy "Users can view their own collections." on collections for select using (
  auth.uid() = owner_id
  or private.has_collection_share(id, auth.email())
  or private.is_team_member(team_id, auth.email())
);

drop policy if exists "Users can insert their own collections." on collections;
create policy "Users can insert their own collections." on collections for insert to authenticated with check (
  auth.uid() = owner_id
  and (team_id is null or private.is_team_member_with_role(team_id, auth.email(), ARRAY['owner', 'admin', 'editor']))
);

drop policy if exists "Users can update their own collections." on collections;
create policy "Users can update their own collections." on collections for update using (
  auth.uid() = owner_id
  or private.has_collection_share_role(id, auth.email(), 'editor')
  or private.is_team_member_with_role(team_id, auth.email(), ARRAY['owner', 'admin', 'editor'])
);

drop policy if exists "Users can delete their own collections." on collections;
create policy "Users can delete their own collections." on collections for delete using (
  auth.uid() = owner_id
  or private.is_team_member_with_role(team_id, auth.email(), ARRAY['owner', 'admin'])
);

-- ── Collection shares policies (use SECURITY DEFINER helper to avoid recursion with collections) ──
drop policy if exists "Users can view shares for their collections." on collection_shares;
create policy "Users can view shares for their collections." on collection_shares for select using (
  private.is_collection_owner(collection_id, auth.uid())
  or user_email = auth.email()
);

drop policy if exists "Owners can insert shares." on collection_shares;
create policy "Owners can insert shares." on collection_shares for insert with check (
  private.is_collection_owner(collection_id, auth.uid())
);

drop policy if exists "Owners can update shares." on collection_shares;
create policy "Owners can update shares." on collection_shares for update using (
  private.is_collection_owner(collection_id, auth.uid())
) with check (
  role in ('viewer', 'editor')
  and private.is_collection_owner(collection_id, auth.uid())
);

drop policy if exists "Owners can delete shares." on collection_shares;
create policy "Owners can delete shares." on collection_shares for delete using (
  private.is_collection_owner(collection_id, auth.uid())
);

-- ── Teams policies (references: team_members via helper) ──
drop policy if exists "Team members can view their teams." on teams;
create policy "Team members can view their teams." on teams for select using (
  auth.uid() = owner_id
  or private.is_team_member(id, auth.email())
);

drop policy if exists "Authenticated users can create teams." on teams;
create policy "Authenticated users can create teams." on teams for insert with check (auth.uid() = owner_id);

drop policy if exists "Team owner can update team." on teams;
create policy "Team owner can update team." on teams for update using (auth.uid() = owner_id);

drop policy if exists "Team owner can delete team." on teams;
create policy "Team owner can delete team." on teams for delete using (auth.uid() = owner_id);

-- ── Team members policies (use SECURITY DEFINER helpers to avoid recursion) ──
drop policy if exists "Team members can view co-members." on team_members;
create policy "Team members can view co-members." on team_members for select using (
  private.is_team_member(team_id, auth.email())
);

drop policy if exists "Team owner or admin can invite members." on team_members;
create policy "Team owner or admin can invite members." on team_members for insert with check (
  -- Team table owner can always add members (needed for first member / team creator)
  exists (select 1 from public.teams where id = team_id and owner_id = auth.uid())
  -- Existing owner/admin members can invite others
  or private.is_team_member_with_role(team_id, auth.email(), ARRAY['owner', 'admin'])
);

drop policy if exists "Team owner or admin can update roles." on team_members;
create policy "Team owner or admin can update roles." on team_members for update using (
  private.is_team_member_with_role(team_id, auth.email(), ARRAY['owner', 'admin'])
);

drop policy if exists "Team owner/admin or self can remove members." on team_members;
create policy "Team owner/admin or self can remove members." on team_members for delete using (
  user_email = auth.email()
  or private.is_team_member_with_role(team_id, auth.email(), ARRAY['owner', 'admin'])
);

-- ── Environments policies (references: team_members via helper) ──
drop policy if exists "Users can view own environments." on environments;
create policy "Users can view own environments." on environments for select using (
  auth.uid() = owner_id
  or private.is_team_member(team_id, auth.email())
);

drop policy if exists "Users can insert own environments." on environments;
create policy "Users can insert own environments." on environments for insert to authenticated with check (
  auth.uid() = owner_id
  and (team_id is null or private.is_team_member_with_role(team_id, auth.email(), ARRAY['owner', 'admin', 'editor']))
);

drop policy if exists "Users can update own environments." on environments;
create policy "Users can update own environments." on environments for update using (
  auth.uid() = owner_id
  or private.is_team_member_with_role(team_id, auth.email(), ARRAY['owner', 'admin', 'editor'])
);

drop policy if exists "Users can delete own environments." on environments;
create policy "Users can delete own environments." on environments for delete using (
  auth.uid() = owner_id
  or private.is_team_member_with_role(team_id, auth.email(), ARRAY['owner', 'admin'])
);

-- ── Usage logs policies (no cross-references) ──
drop policy if exists "Users can view own usage logs." on usage_logs;
create policy "Users can view own usage logs." on usage_logs for select using (auth.uid() = user_id);

drop policy if exists "Users can insert own usage logs." on usage_logs;
create policy "Users can insert own usage logs." on usage_logs for insert with check (auth.uid() = user_id);

-- ── Request history policies (no cross-references) ──
drop policy if exists "Users can view own request history." on request_history;
create policy "Users can view own request history." on request_history for select using (auth.uid() = user_id);

drop policy if exists "Users can insert own request history." on request_history;
create policy "Users can insert own request history." on request_history for insert with check (auth.uid() = user_id);

drop policy if exists "Users can delete own request history." on request_history;
create policy "Users can delete own request history." on request_history for delete using (auth.uid() = user_id);

-- ─────────────────────────────────────────────────────────────
-- PHASE 5: INDEXES
-- ─────────────────────────────────────────────────────────────

CREATE INDEX IF NOT EXISTS idx_collections_owner_id ON collections(owner_id);
CREATE INDEX IF NOT EXISTS idx_collections_team_id ON collections(team_id);
CREATE INDEX IF NOT EXISTS idx_collection_shares_user_email ON collection_shares(user_email);
CREATE INDEX IF NOT EXISTS idx_collection_shares_collection_id ON collection_shares(collection_id);
CREATE INDEX IF NOT EXISTS idx_teams_owner_id ON teams(owner_id);
CREATE INDEX IF NOT EXISTS idx_team_members_team_id ON team_members(team_id);
CREATE INDEX IF NOT EXISTS idx_team_members_user_email ON team_members(user_email);
CREATE INDEX IF NOT EXISTS idx_team_members_user_id ON team_members(user_id);
CREATE INDEX IF NOT EXISTS idx_environments_owner_id ON environments(owner_id);
CREATE INDEX IF NOT EXISTS idx_environments_team_id ON environments(team_id);
CREATE INDEX IF NOT EXISTS idx_usage_logs_user_date ON usage_logs(user_id, created_at);
CREATE INDEX IF NOT EXISTS idx_usage_logs_category ON usage_logs(user_id, category, created_at);
CREATE INDEX IF NOT EXISTS idx_request_history_user_date ON request_history(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_request_history_method ON request_history(user_id, method);
CREATE INDEX IF NOT EXISTS idx_request_history_status ON request_history(user_id, status);

-- Private helpers are usable by authenticated RLS policies, never anonymous RPCs.
revoke all on all functions in schema private from public, anon;
grant execute on all functions in schema private to authenticated;
drop function if exists public.is_collection_owner(uuid, uuid);
drop function if exists public.has_collection_share(uuid, text);
drop function if exists public.has_collection_share_role(uuid, text, text);
drop function if exists public.is_team_member(uuid, text);
drop function if exists public.is_team_member_with_role(uuid, text, text[]);
