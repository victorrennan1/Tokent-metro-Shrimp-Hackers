create extension if not exists pgcrypto;

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  github_user_id bigint unique,
  github_handle text not null check (char_length(github_handle) between 1 and 64),
  display_name text not null check (char_length(display_name) between 1 and 80),
  avatar_url text,
  leaderboard_opt_in boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.devices (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles(id) on delete cascade,
  name text not null check (char_length(name) between 1 and 80),
  token_hash text not null unique check (token_hash ~ '^[a-f0-9]{64}$'),
  platform text not null,
  collector_version text,
  last_seen_at timestamptz,
  revoked_at timestamptz,
  created_at timestamptz not null default now()
);

create table public.pairing_codes (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles(id) on delete cascade,
  code_hash text not null unique check (code_hash ~ '^[a-f0-9]{64}$'),
  created_at timestamptz not null default now(),
  expires_at timestamptz not null check (expires_at <= created_at + interval '10 minutes'),
  used_at timestamptz
);

create type public.repository_visibility as enum ('public', 'private', 'anonymous', 'unknown');
create table public.repositories (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles(id) on delete cascade,
  github_owner text,
  github_name text,
  canonical_name text,
  visibility public.repository_visibility not null default 'unknown',
  anonymous_hash text,
  created_at timestamptz not null default now(),
  constraint repository_privacy check (
    (visibility = 'public' and canonical_name is not null and anonymous_hash is null) or
    (visibility in ('private', 'unknown') and canonical_name is null) or
    (visibility = 'anonymous' and canonical_name is null and anonymous_hash ~ '^[a-f0-9]{64}$')
  )
);

create table public.usage_events (
  id uuid primary key default gen_random_uuid(),
  idempotency_key text not null unique check (idempotency_key ~ '^[a-f0-9]{64}$'),
  profile_id uuid not null references public.profiles(id) on delete cascade,
  device_id uuid not null references public.devices(id) on delete cascade,
  repository_id uuid references public.repositories(id) on delete set null,
  repository_snapshot jsonb not null default '{"type":"unknown"}'::jsonb,
  agent text not null check (agent in ('claude-code', 'codex', 'antigravity')),
  model text,
  source_session_hash text not null check (source_session_hash ~ '^[a-f0-9]{64}$'),
  occurred_at timestamptz not null,
  input_tokens bigint check (input_tokens >= 0),
  cached_input_tokens bigint check (cached_input_tokens >= 0),
  cache_creation_tokens bigint check (cache_creation_tokens >= 0),
  output_tokens bigint check (output_tokens >= 0),
  reasoning_tokens bigint check (reasoning_tokens >= 0),
  total_tokens bigint not null check (total_tokens >= 0),
  estimated_cost_usd numeric(18,8) check (estimated_cost_usd >= 0),
  pricing_version text,
  source_version text not null,
  schema_version smallint not null check (schema_version = 1),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint repository_snapshot_safe check (
    jsonb_typeof(repository_snapshot) = 'object' and
    not (repository_snapshot ?| array['prompt','response','message','content','code','path','credential','cookie'])
  )
);

create type public.sync_status as enum ('running', 'completed', 'partial', 'failed');
create table public.sync_runs (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles(id) on delete cascade,
  device_id uuid not null references public.devices(id) on delete cascade,
  batch_id uuid not null unique,
  started_at timestamptz not null default now(),
  finished_at timestamptz,
  status public.sync_status not null default 'running',
  received_count integer not null default 0,
  inserted_count integer not null default 0,
  updated_count integer not null default 0,
  ignored_count integer not null default 0,
  rejected_count integer not null default 0,
  error_summary text
);

create index usage_events_profile_occurred_idx on public.usage_events(profile_id, occurred_at desc);
create index usage_events_agent_idx on public.usage_events(agent);
create index usage_events_model_idx on public.usage_events(model);
create index devices_profile_idx on public.devices(profile_id);

alter table public.profiles enable row level security;
alter table public.devices enable row level security;
alter table public.pairing_codes enable row level security;
alter table public.repositories enable row level security;
alter table public.usage_events enable row level security;
alter table public.sync_runs enable row level security;

create policy "profiles own read" on public.profiles for select using (auth.uid() = id);
create policy "profiles public leaderboard read" on public.profiles for select using (leaderboard_opt_in = true);
create policy "profiles own update" on public.profiles for update using (auth.uid() = id) with check (auth.uid() = id);
create policy "devices own all" on public.devices for all using (auth.uid() = profile_id) with check (auth.uid() = profile_id);
create policy "pairing codes own all" on public.pairing_codes for all using (auth.uid() = profile_id) with check (auth.uid() = profile_id);
create policy "repositories own all" on public.repositories for all using (auth.uid() = profile_id) with check (auth.uid() = profile_id);
create policy "usage own read" on public.usage_events for select using (auth.uid() = profile_id);
create policy "sync own read" on public.sync_runs for select using (auth.uid() = profile_id);

create or replace function public.touch_updated_at() returns trigger language plpgsql security invoker set search_path = '' as $$
begin new.updated_at = now(); return new; end; $$;
create trigger profiles_touch before update on public.profiles for each row execute function public.touch_updated_at();
create trigger usage_events_touch before update on public.usage_events for each row execute function public.touch_updated_at();

create or replace view public.public_builder_leaderboard with (security_invoker = true) as
select p.id, p.display_name, p.github_handle, p.avatar_url, coalesce(sum(u.total_tokens), 0)::bigint as total_tokens
from public.profiles p left join public.usage_events u on u.profile_id = p.id
where p.leaderboard_opt_in = true
group by p.id, p.display_name, p.github_handle, p.avatar_url;

comment on table public.usage_events is 'Only normalized metadata. Prompts, responses, source code, file content and local paths are prohibited.';

