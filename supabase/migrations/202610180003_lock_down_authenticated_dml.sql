begin;

-- Browser sessions may read only rows owned by the authenticated profile.
-- Every write is performed by the server after authentication/authorization,
-- using the service role. This prevents clients from bypassing pairing,
-- revocation, repository privacy, ingest validation, or sync idempotency.

drop policy if exists "profiles own update" on public.profiles;
drop policy if exists "devices own all" on public.devices;
drop policy if exists "pairing codes own all" on public.pairing_codes;
drop policy if exists "repositories own all" on public.repositories;

revoke all privileges on table public.pairing_codes from anon, authenticated;

revoke insert, update, delete, truncate, references, trigger
  on table
    public.profiles,
    public.devices,
    public.repositories,
    public.usage_events,
    public.sync_runs
  from anon, authenticated;

revoke select
  on table
    public.profiles,
    public.devices,
    public.repositories,
    public.usage_events,
    public.sync_runs
  from anon;

grant select
  on table
    public.profiles,
    public.devices,
    public.repositories,
    public.usage_events,
    public.sync_runs
  to authenticated;

drop policy if exists "profiles own read" on public.profiles;
create policy "profiles own read"
  on public.profiles
  for select
  to authenticated
  using ((select auth.uid()) = id);

create policy "devices own read"
  on public.devices
  for select
  to authenticated
  using ((select auth.uid()) = profile_id);

create policy "repositories own read"
  on public.repositories
  for select
  to authenticated
  using ((select auth.uid()) = profile_id);

drop policy if exists "usage own read" on public.usage_events;
create policy "usage own read"
  on public.usage_events
  for select
  to authenticated
  using ((select auth.uid()) = profile_id);

drop policy if exists "sync own read" on public.sync_runs;
create policy "sync own read"
  on public.sync_runs
  for select
  to authenticated
  using ((select auth.uid()) = profile_id);

commit;
