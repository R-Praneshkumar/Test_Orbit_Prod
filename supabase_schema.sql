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
create extension if not exists "uuid-ossp";

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
  id uuid default uuid_generate_v4() primary key,
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
  id uuid default uuid_generate_v4() primary key,
  collection_id uuid references collections(id) on delete cascade not null,
  user_email text not null,
  role text check (role in ('viewer', 'editor')) default 'viewer',
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  unique(collection_id, user_email)
);
alter table collection_shares enable row level security;

-- 4. TEAMS
create table if not exists teams (
  id uuid default uuid_generate_v4() primary key,
  name text not null,
  owner_id uuid references auth.users not null,
  plan text check (plan in ('free', 'pro', 'team')) default 'free',
  max_members integer default 3,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);
alter table teams enable row level security;

-- 5. TEAM_MEMBERS
create table if not exists team_members (
  id uuid default uuid_generate_v4() primary key,
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
  id uuid default uuid_generate_v4() primary key,
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
  id uuid default uuid_generate_v4() primary key,
  user_id uuid references auth.users not null,
  endpoint text not null,
  category text not null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);
alter table usage_logs enable row level security;

-- 8. REQUEST_HISTORY
create table if not exists request_history (
  id uuid default uuid_generate_v4() primary key,
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

-- 9. SUBSCRIPTIONS
CREATE TABLE IF NOT EXISTS subscriptions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  plan TEXT NOT NULL DEFAULT 'free' CHECK (plan IN ('free', 'pro', 'team')),
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'cancelled', 'paused', 'expired')),
  razorpay_subscription_id TEXT UNIQUE,
  razorpay_plan_id TEXT,
  current_period_start TIMESTAMPTZ,
  current_period_end TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id)
);
ALTER TABLE subscriptions ENABLE ROW LEVEL SECURITY;


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
create or replace function is_collection_owner(p_collection_id uuid, p_user_id uuid)
returns boolean as $$
  select exists (
    select 1 from collections
    where id = p_collection_id and owner_id = p_user_id
  );
$$ language sql security definer;

-- Helper to check if user has a share on a collection (avoids recursion from collections SELECT policy)
create or replace function has_collection_share(p_collection_id uuid, p_email text)
returns boolean as $$
  select exists (
    select 1 from collection_shares
    where collection_id = p_collection_id and user_email = p_email
  );
$$ language sql security definer;

create or replace function has_collection_share_role(p_collection_id uuid, p_email text, p_role text)
returns boolean as $$
  select exists (
    select 1 from collection_shares
    where collection_id = p_collection_id and user_email = p_email and role = p_role
  );
$$ language sql security definer;

-- No DROP — policies depend on these functions. CREATE OR REPLACE updates them in-place.
create or replace function is_team_member(p_team_id uuid, p_email text)
returns boolean as $$
  select exists (
    select 1 from team_members
    where team_id = p_team_id and user_email = p_email
  );
$$ language sql security definer;

-- No DROP — policies depend on this function. CREATE OR REPLACE updates it in-place.
create or replace function is_team_member_with_role(p_team_id uuid, p_email text, p_roles text[])
returns boolean as $$
  select exists (
    select 1 from team_members
    where team_id = p_team_id and user_email = p_email and role = ANY(p_roles)
  );
$$ language sql security definer;

-- 3a. Prevent editors from stealing collection ownership
drop trigger if exists guard_owner_id on collections;
drop function if exists prevent_owner_id_hijack;

create or replace function prevent_owner_id_hijack()
returns trigger as $$
begin
  if OLD.owner_id is distinct from NEW.owner_id and auth.uid() != OLD.owner_id then
    raise exception 'Only the owner can transfer ownership';
  end if;
  return NEW;
end;
$$ language plpgsql security definer;

create trigger guard_owner_id
  before update on collections
  for each row execute function prevent_owner_id_hijack();

-- 3b. Enforce free-tier collaborator limit (max 2 per collection)
drop trigger if exists guard_share_limit on collection_shares;
drop function if exists enforce_share_limit;

create or replace function enforce_share_limit()
returns trigger as $$
declare
  share_count integer;
  owner_plan text;
begin
  select count(*) into share_count
  from collection_shares
  where collection_id = NEW.collection_id;

  select t.plan into owner_plan
  from collections c
  join teams t on t.owner_id = c.owner_id
  where c.id = NEW.collection_id
    and t.plan in ('pro', 'team')
  limit 1;

  if owner_plan is null and share_count >= 2 then
    raise exception 'Free plan allows up to 2 collaborators per collection. Upgrade to Pro for unlimited sharing.';
  end if;

  return NEW;
end;
$$ language plpgsql security definer;

create trigger guard_share_limit
  before insert on collection_shares
  for each row execute function enforce_share_limit();

-- 3c. Enforce team member limit
drop trigger if exists guard_team_member_limit on team_members;
drop function if exists enforce_team_member_limit;

create or replace function enforce_team_member_limit()
returns trigger as $$
declare
  member_count integer;
  team_max integer;
begin
  select count(*) into member_count
  from team_members where team_id = NEW.team_id;

  select max_members into team_max
  from teams where id = NEW.team_id;

  if team_max > 0 and member_count >= team_max then
    raise exception 'Team member limit reached (%). Upgrade your team plan for more members.', team_max;
  end if;

  return NEW;
end;
$$ language plpgsql security definer;

create trigger guard_team_member_limit
  before insert on team_members
  for each row execute function enforce_team_member_limit();

-- 3d. Prevent non-owners from changing the owner role
drop trigger if exists guard_owner_role on team_members;
drop function if exists prevent_owner_role_change;

create or replace function prevent_owner_role_change()
returns trigger as $$
begin
  if OLD.role = 'owner' and NEW.role != 'owner' then
    if not exists (select 1 from teams where id = OLD.team_id and owner_id = auth.uid()) then
      raise exception 'Only the team owner can transfer ownership';
    end if;
  end if;
  return NEW;
end;
$$ language plpgsql security definer;

create trigger guard_owner_role
  before update on team_members
  for each row execute function prevent_owner_role_change();

-- 3e. Auto-create profile on signup
drop trigger if exists on_auth_user_created on auth.users;
drop function if exists public.handle_new_user;

create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, email, full_name, avatar_url)
  values (new.id, new.email, new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'avatar_url');
  return new;
end;
$$ language plpgsql security definer;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();


-- ─────────────────────────────────────────────────────────────
-- PHASE 4: ALL RLS POLICIES
-- Now ALL tables and columns exist, so cross-references are safe.
-- ─────────────────────────────────────────────────────────────

-- ── Profiles policies ──
drop policy if exists "Public profiles are viewable by everyone." on profiles;
create policy "Public profiles are viewable by everyone." on profiles for select using (true);

drop policy if exists "Users can insert their own profile." on profiles;
create policy "Users can insert their own profile." on profiles for insert with check (auth.uid() = id);

drop policy if exists "Users can update own profile." on profiles;
create policy "Users can update own profile." on profiles for update using (auth.uid() = id);

-- ── Collections policies (all cross-table refs use SECURITY DEFINER helpers) ──
drop policy if exists "Users can view their own collections." on collections;
create policy "Users can view their own collections." on collections for select using (
  auth.uid() = owner_id
  or has_collection_share(id, auth.email())
  or is_team_member(team_id, auth.email())
);

drop policy if exists "Users can insert their own collections." on collections;
create policy "Users can insert their own collections." on collections for insert with check (
  auth.uid() = owner_id
  or is_team_member_with_role(team_id, auth.email(), ARRAY['owner', 'admin', 'editor'])
);

drop policy if exists "Users can update their own collections." on collections;
create policy "Users can update their own collections." on collections for update using (
  auth.uid() = owner_id
  or has_collection_share_role(id, auth.email(), 'editor')
  or is_team_member_with_role(team_id, auth.email(), ARRAY['owner', 'admin', 'editor'])
);

drop policy if exists "Users can delete their own collections." on collections;
create policy "Users can delete their own collections." on collections for delete using (
  auth.uid() = owner_id
  or is_team_member_with_role(team_id, auth.email(), ARRAY['owner', 'admin'])
);

-- ── Collection shares policies (use SECURITY DEFINER helper to avoid recursion with collections) ──
drop policy if exists "Users can view shares for their collections." on collection_shares;
create policy "Users can view shares for their collections." on collection_shares for select using (
  is_collection_owner(collection_id, auth.uid())
  or user_email = auth.email()
);

drop policy if exists "Owners can insert shares." on collection_shares;
create policy "Owners can insert shares." on collection_shares for insert with check (
  is_collection_owner(collection_id, auth.uid())
);

drop policy if exists "Owners can update shares." on collection_shares;
create policy "Owners can update shares." on collection_shares for update using (
  is_collection_owner(collection_id, auth.uid())
) with check (
  role in ('viewer', 'editor')
  and is_collection_owner(collection_id, auth.uid())
);

drop policy if exists "Owners can delete shares." on collection_shares;
create policy "Owners can delete shares." on collection_shares for delete using (
  is_collection_owner(collection_id, auth.uid())
);

-- ── Teams policies (references: team_members via helper) ──
drop policy if exists "Team members can view their teams." on teams;
create policy "Team members can view their teams." on teams for select using (
  auth.uid() = owner_id
  or is_team_member(id, auth.email())
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
  is_team_member(team_id, auth.email())
);

drop policy if exists "Team owner or admin can invite members." on team_members;
create policy "Team owner or admin can invite members." on team_members for insert with check (
  -- Team table owner can always add members (needed for first member / team creator)
  exists (select 1 from teams where id = team_id and owner_id = auth.uid())
  -- Existing owner/admin members can invite others
  or is_team_member_with_role(team_id, auth.email(), ARRAY['owner', 'admin'])
);

drop policy if exists "Team owner or admin can update roles." on team_members;
create policy "Team owner or admin can update roles." on team_members for update using (
  is_team_member_with_role(team_id, auth.email(), ARRAY['owner', 'admin'])
);

drop policy if exists "Team owner/admin or self can remove members." on team_members;
create policy "Team owner/admin or self can remove members." on team_members for delete using (
  user_email = auth.email()
  or is_team_member_with_role(team_id, auth.email(), ARRAY['owner', 'admin'])
);

-- ── Environments policies (references: team_members via helper) ──
drop policy if exists "Users can view own environments." on environments;
create policy "Users can view own environments." on environments for select using (
  auth.uid() = owner_id
  or is_team_member(team_id, auth.email())
);

drop policy if exists "Users can insert own environments." on environments;
create policy "Users can insert own environments." on environments for insert with check (
  auth.uid() = owner_id
  or is_team_member_with_role(team_id, auth.email(), ARRAY['owner', 'admin', 'editor'])
);

drop policy if exists "Users can update own environments." on environments;
create policy "Users can update own environments." on environments for update using (
  auth.uid() = owner_id
  or is_team_member_with_role(team_id, auth.email(), ARRAY['owner', 'admin', 'editor'])
);

drop policy if exists "Users can delete own environments." on environments;
create policy "Users can delete own environments." on environments for delete using (
  auth.uid() = owner_id
  or is_team_member_with_role(team_id, auth.email(), ARRAY['owner', 'admin'])
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

-- ── Subscriptions policies ──
drop policy if exists "Users can read own subscription" on subscriptions;
CREATE POLICY "Users can read own subscription"
  ON subscriptions FOR SELECT
  USING (auth.uid() = user_id);

drop policy if exists "Service role manages subscriptions" on subscriptions;
CREATE POLICY "Service role manages subscriptions"
  ON subscriptions FOR ALL
  USING (auth.role() = 'service_role');


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
CREATE INDEX IF NOT EXISTS idx_subscriptions_user_id ON subscriptions(user_id);
CREATE INDEX IF NOT EXISTS idx_subscriptions_razorpay_id ON subscriptions(razorpay_subscription_id);
