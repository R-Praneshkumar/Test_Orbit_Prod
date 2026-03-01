-- Enable UUID extension
create extension if not exists "uuid-ossp";

-- PROFILES (Public info for users)
create table if not exists profiles (
  id uuid references auth.users not null primary key,
  email text,
  full_name text,
  avatar_url text,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- RLS for Profiles
alter table profiles enable row level security;

-- Policies (Drop first to avoid errors)
drop policy if exists "Public profiles are viewable by everyone." on profiles;
create policy "Public profiles are viewable by everyone." on profiles for select using (true);

drop policy if exists "Users can insert their own profile." on profiles;
create policy "Users can insert their own profile." on profiles for insert with check (auth.uid() = id);

drop policy if exists "Users can update own profile." on profiles;
create policy "Users can update own profile." on profiles for update using (auth.uid() = id);

-- COLLECTIONS (Synced workspaces)
create table if not exists collections (
  id uuid default uuid_generate_v4() primary key,
  name text not null,
  description text,
  owner_id uuid references auth.users not null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null,
  data jsonb default '{}'::jsonb
);

-- RLS for Collections
alter table collections enable row level security;

drop policy if exists "Users can view their own collections." on collections;
create policy "Users can view their own collections." on collections for select using (auth.uid() = owner_id);

drop policy if exists "Users can insert their own collections." on collections;
create policy "Users can insert their own collections." on collections for insert with check (auth.uid() = owner_id);

drop policy if exists "Users can update their own collections." on collections;
create policy "Users can update their own collections." on collections for update using (auth.uid() = owner_id);

drop policy if exists "Users can delete their own collections." on collections;
create policy "Users can delete their own collections." on collections for delete using (auth.uid() = owner_id);

-- Update SELECT policy to include shared collections
drop policy if exists "Users can view their own collections." on collections;
create policy "Users can view their own collections." on collections for select using (
  auth.uid() = owner_id
  or exists (
    select 1 from collection_shares cs
    where cs.collection_id = id and cs.user_email = auth.email()
  )
);

-- Update UPDATE policy to allow editors on shared collections
drop policy if exists "Users can update their own collections." on collections;
create policy "Users can update their own collections." on collections for update using (
  auth.uid() = owner_id
  or exists (
    select 1 from collection_shares cs
    where cs.collection_id = id and cs.user_email = auth.email() and cs.role = 'editor'
  )
);

-- SECURITY: Prevent editors from stealing ownership by changing owner_id
-- RLS WITH CHECK cannot compare OLD vs NEW row, so a trigger is required
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

-- COLLECTION SHARES (Collaborators)
create table if not exists collection_shares (
  id uuid default uuid_generate_v4() primary key,
  collection_id uuid references collections(id) on delete cascade not null,
  user_email text not null,
  role text check (role in ('viewer', 'editor')) default 'viewer',
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  unique(collection_id, user_email)
);

-- RLS for Shares
alter table collection_shares enable row level security;

drop policy if exists "Users can view shares for their collections." on collection_shares;
create policy "Users can view shares for their collections." on collection_shares for select using (
  exists ( select 1 from collections where id = collection_shares.collection_id and owner_id = auth.uid() )
  or user_email = auth.email()
);

drop policy if exists "Owners can insert shares." on collection_shares;
create policy "Owners can insert shares." on collection_shares for insert with check (
  exists ( select 1 from collections where id = collection_shares.collection_id and owner_id = auth.uid() )
);

drop policy if exists "Owners can update shares." on collection_shares;
create policy "Owners can update shares." on collection_shares for update using (
  exists ( select 1 from collections where id = collection_shares.collection_id and owner_id = auth.uid() )
) with check (
  role in ('viewer', 'editor')
  and exists ( select 1 from collections where id = collection_shares.collection_id and owner_id = auth.uid() )
);

drop policy if exists "Owners can delete shares." on collection_shares;
create policy "Owners can delete shares." on collection_shares for delete using (
  exists ( select 1 from collections where id = collection_shares.collection_id and owner_id = auth.uid() )
);

-- ENVIRONMENTS (Synced per-user)
create table if not exists environments (
  id uuid default uuid_generate_v4() primary key,
  owner_id uuid references auth.users not null,
  name text not null,
  vars jsonb default '[]'::jsonb,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null,
  unique(owner_id, name)
);

-- RLS for Environments
alter table environments enable row level security;

drop policy if exists "Users can view own environments." on environments;
create policy "Users can view own environments." on environments for select using (auth.uid() = owner_id);

drop policy if exists "Users can insert own environments." on environments;
create policy "Users can insert own environments." on environments for insert with check (auth.uid() = owner_id);

drop policy if exists "Users can update own environments." on environments;
create policy "Users can update own environments." on environments for update using (auth.uid() = owner_id);

drop policy if exists "Users can delete own environments." on environments;
create policy "Users can delete own environments." on environments for delete using (auth.uid() = owner_id);

-- SYNC FUNCTION (Handle profile creation on signup)
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

-- Performance indexes
CREATE INDEX IF NOT EXISTS idx_collections_owner_id ON collections(owner_id);
CREATE INDEX IF NOT EXISTS idx_collection_shares_user_email ON collection_shares(user_email);
CREATE INDEX IF NOT EXISTS idx_collection_shares_collection_id ON collection_shares(collection_id);
CREATE INDEX IF NOT EXISTS idx_environments_owner_id ON environments(owner_id);
