-- Atomically consumes a one-time pairing code and creates exactly one device.
create or replace function public.exchange_pairing_code(
  p_code_hash text,
  p_token_hash text,
  p_name text,
  p_platform text,
  p_collector_version text
) returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_profile_id uuid;
  v_device_id uuid;
begin
  update public.pairing_codes
     set used_at = now()
   where code_hash = p_code_hash
     and used_at is null
     and expires_at > now()
  returning profile_id into v_profile_id;

  if v_profile_id is null then
    return null;
  end if;

  insert into public.devices(profile_id, name, token_hash, platform, collector_version)
  values (v_profile_id, p_name, p_token_hash, p_platform, p_collector_version)
  returning id into v_device_id;

  return v_device_id;
end;
$$;

revoke all on function public.exchange_pairing_code(text, text, text, text, text) from public, anon, authenticated;
grant execute on function public.exchange_pairing_code(text, text, text, text, text) to service_role;

drop policy if exists "profiles public leaderboard read" on public.profiles;
revoke all on public.public_builder_leaderboard from anon, authenticated;
