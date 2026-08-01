-- Treat booking_window_days as a count of local court calendar dates (today
-- included), and allow the client to request the full supported 90-day range.
create or replace function public.get_court_availability(
  target_court_id uuid,
  range_start date,
  range_end date
)
returns table (
  starts_at timestamptz,
  ends_at timestamptz,
  slot_duration_minutes integer,
  price_cents integer,
  currency text
)
language plpgsql
stable
security definer
set search_path = public, extensions, pg_catalog
as $$
declare
  selected_court public.courts%rowtype;
  local_today date;
  local_window_end date;
begin
  if range_start is null or range_end is null or range_end < range_start then
    raise exception 'Choose a valid availability date range.';
  end if;
  if range_end - range_start > 89 then
    raise exception 'Availability can be requested for at most 90 days.';
  end if;

  select * into selected_court from public.courts where id = target_court_id;
  if selected_court.id is null or not selected_court.booking_enabled then return; end if;

  local_today := (now() at time zone selected_court.timezone)::date;
  local_window_end := local_today + selected_court.booking_window_days;

  return query
  with local_days as (
    select generated_day::date as local_day
    from generate_series(range_start, range_end, interval '1 day') as generated_day
    where generated_day::date >= local_today
      and generated_day::date < local_window_end
  ),
  candidate_slots as (
    select
      slot_start,
      slot_start + make_interval(mins => selected_court.slot_duration_minutes) as slot_end
    from local_days d
    join public.court_operating_hours h
      on h.court_id = selected_court.id
     and h.weekday = extract(dow from d.local_day)::smallint
     and not h.is_closed
    cross join lateral generate_series(
      (d.local_day + h.opens_at) at time zone selected_court.timezone,
      ((d.local_day + h.closes_at) at time zone selected_court.timezone)
        - make_interval(mins => selected_court.slot_duration_minutes),
      make_interval(mins => selected_court.slot_duration_minutes)
    ) as slot_start
  )
  select
    candidate.slot_start,
    candidate.slot_end,
    selected_court.slot_duration_minutes,
    round(
      coalesce(selected_court.hourly_price_cents, 0)::numeric
      * selected_court.slot_duration_minutes / 60
    )::integer,
    selected_court.currency
  from candidate_slots candidate
  where candidate.slot_start > now()
    and not exists (
      select 1 from public.court_closures closure
      where closure.court_id = selected_court.id
        and tstzrange(closure.starts_at, closure.ends_at, '[)')
          && tstzrange(candidate.slot_start, candidate.slot_end, '[)')
    )
    and not exists (
      select 1 from public.court_bookings booking
      where booking.court_id = selected_court.id
        and booking.status in ('pending', 'confirmed')
        and tstzrange(booking.starts_at, booking.ends_at, '[)')
          && tstzrange(candidate.slot_start, candidate.slot_end, '[)')
    )
  order by candidate.slot_start;
end;
$$;

revoke all on function public.get_court_availability(uuid, date, date) from public, anon;
grant execute on function public.get_court_availability(uuid, date, date) to authenticated;
