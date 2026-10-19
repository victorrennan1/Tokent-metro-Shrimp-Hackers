begin;

create table public.ingest_rate_limits (
  device_id uuid primary key references public.devices(id) on delete cascade,
  window_started_at timestamptz not null,
  request_count integer not null check (request_count >= 0)
);

alter table public.ingest_rate_limits enable row level security;
revoke all privileges on table public.ingest_rate_limits from anon, authenticated;

create or replace function public.consume_device_ingest_rate_limit(
  p_device_id uuid,
  p_limit integer default 30
) returns boolean
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_now timestamptz := clock_timestamp();
  v_count integer;
begin
  if p_limit < 1 or p_limit > 1000 then
    return false;
  end if;

  insert into public.ingest_rate_limits(device_id, window_started_at, request_count)
  values (p_device_id, v_now, 1)
  on conflict (device_id) do update
    set window_started_at = case
          when ingest_rate_limits.window_started_at <= v_now - interval '1 minute' then v_now
          else ingest_rate_limits.window_started_at
        end,
        request_count = case
          when ingest_rate_limits.window_started_at <= v_now - interval '1 minute' then 1
          else ingest_rate_limits.request_count + 1
        end
  returning request_count into v_count;

  return v_count <= p_limit;
end;
$$;

revoke all on function public.consume_device_ingest_rate_limit(uuid, integer) from public, anon, authenticated;
grant execute on function public.consume_device_ingest_rate_limit(uuid, integer) to service_role;

commit;
