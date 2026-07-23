-- Physical opening state is independent from whether future booking is enabled.
create or replace function public.court_is_open_at(
  target_court_id uuid,
  target_time timestamptz default now()
)
returns boolean
language sql
stable
security definer
set search_path = public, pg_catalog
as $$
  select coalesce((
    select exists (
        select 1
        from public.court_operating_hours h
        where h.court_id = c.id
          and h.weekday = extract(dow from target_time at time zone c.timezone)::smallint
          and not h.is_closed
          and (target_time at time zone c.timezone)::time >= h.opens_at
          and (target_time at time zone c.timezone)::time < h.closes_at
      )
      and not exists (
        select 1
        from public.court_closures closure
        where closure.court_id = c.id
          and target_time >= closure.starts_at
          and target_time < closure.ends_at
      )
    from public.courts c
    where c.id = target_court_id
  ), false);
$$;

revoke all on function public.court_is_open_at(uuid, timestamptz) from public, anon, authenticated;

