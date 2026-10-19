begin;

-- A stable, profile-scoped key lets every device owned by the same profile
-- pseudonymize a source session identically without sending its raw ID.
create table public.profile_secrets (
  profile_id uuid primary key references public.profiles(id) on delete cascade,
  session_hash_key text not null default encode(extensions.gen_random_bytes(32), 'hex')
    check (session_hash_key ~ '^[a-f0-9]{64}$'),
  created_at timestamptz not null default now()
);

insert into public.profile_secrets(profile_id)
select id from public.profiles
on conflict (profile_id) do nothing;

alter table public.profile_secrets enable row level security;
revoke all privileges on table public.profile_secrets from public, anon, authenticated;

-- Keep the v1 RPC available during deployment so an in-flight request does not
-- break. New collectors use this capability-negotiated v2 RPC.
create function public.exchange_pairing_code_v2(
  p_code_hash text,
  p_token_hash text,
  p_name text,
  p_platform text,
  p_collector_version text
) returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_profile_id uuid;
  v_device_id uuid;
  v_session_hash_key text;
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

  insert into public.profile_secrets(profile_id)
  values (v_profile_id)
  on conflict (profile_id) do nothing;

  select session_hash_key
    into v_session_hash_key
    from public.profile_secrets
   where profile_id = v_profile_id;

  insert into public.devices(profile_id, name, token_hash, platform, collector_version)
  values (v_profile_id, p_name, p_token_hash, p_platform, p_collector_version)
  returning id into v_device_id;

  return jsonb_build_object(
    'deviceId', v_device_id,
    'sessionHashKey', v_session_hash_key
  );
end;
$$;

revoke all on function public.exchange_pairing_code_v2(text, text, text, text, text)
  from public, anon, authenticated;
grant execute on function public.exchange_pairing_code_v2(text, text, text, text, text)
  to service_role;

-- Idempotency is scoped to the authenticated owner. The same physical source
-- session may legitimately be synchronized to two different profiles.
alter table public.usage_events
  drop constraint usage_events_idempotency_key_key;
alter table public.usage_events
  add constraint usage_events_profile_id_idempotency_key_key
  unique (profile_id, idempotency_key);

commit;
