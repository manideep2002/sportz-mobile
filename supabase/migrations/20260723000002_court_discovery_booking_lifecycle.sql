-- Complete court discovery and booking lifecycle.
-- Payment is deliberately out of platform scope: each court declares either
-- `external` (settled with the venue) or `not_required`.

alter table public.courts
  add column if not exists timezone text not null default 'Asia/Kolkata',
  add column if not exists slot_duration_minutes integer not null default 60,
  add column if not exists booking_window_days integer not null default 30,
  add column if not exists cancellation_notice_hours integer not null default 6,
  add column if not exists booking_requires_approval boolean not null default true,
  add column if not exists booking_enabled boolean not null default true,
  add column if not exists payment_policy text not null default 'external';

alter table public.courts
  drop constraint if exists courts_slot_duration_valid,
  add constraint courts_slot_duration_valid
    check (slot_duration_minutes between 15 and 240 and mod(slot_duration_minutes, 15) = 0),
  drop constraint if exists courts_booking_window_valid,
  add constraint courts_booking_window_valid check (booking_window_days between 1 and 90),
  drop constraint if exists courts_cancellation_notice_valid,
  add constraint courts_cancellation_notice_valid check (cancellation_notice_hours between 0 and 168),
  drop constraint if exists courts_payment_policy_valid,
  add constraint courts_payment_policy_valid check (payment_policy in ('external', 'not_required'));

create or replace function public.validate_court_timezone()
returns trigger
language plpgsql
set search_path = public, pg_catalog
as $$
begin
  if not exists (select 1 from pg_timezone_names where name = new.timezone) then
    raise exception 'Unknown court timezone: %', new.timezone;
  end if;
  return new;
end;
$$;

drop trigger if exists courts_validate_timezone on public.courts;
create trigger courts_validate_timezone
before insert or update of timezone on public.courts
for each row execute function public.validate_court_timezone();

create table if not exists public.court_operating_hours (
  court_id uuid not null references public.courts(id) on delete cascade,
  weekday smallint not null check (weekday between 0 and 6),
  opens_at time without time zone,
  closes_at time without time zone,
  is_closed boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (court_id, weekday),
  constraint court_operating_hours_times_valid check (
    (is_closed and opens_at is null and closes_at is null)
    or
    (not is_closed and opens_at is not null and closes_at is not null and closes_at > opens_at)
  )
);

create table if not exists public.court_closures (
  id uuid primary key default public.uuid_generate_v7(),
  court_id uuid not null references public.courts(id) on delete cascade,
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  reason text not null default '',
  created_at timestamptz not null default now(),
  created_by uuid references public.profiles(id) on delete set null,
  constraint court_closures_valid_time check (ends_at > starts_at)
);

create or replace function public.initialize_court_operating_hours()
returns trigger
language plpgsql
security definer
set search_path = public, pg_catalog
as $$
begin
  insert into public.court_operating_hours (court_id, weekday, opens_at, closes_at, is_closed)
  select new.id, weekday, time '06:00', time '22:00', false
  from generate_series(0, 6) weekday
  on conflict (court_id, weekday) do nothing;
  return new;
end;
$$;

drop trigger if exists courts_initialize_operating_hours on public.courts;
create trigger courts_initialize_operating_hours
after insert on public.courts
for each row execute function public.initialize_court_operating_hours();

create index if not exists court_closures_court_time_idx
  on public.court_closures(court_id, starts_at, ends_at);

drop trigger if exists court_operating_hours_set_updated_at on public.court_operating_hours;
create trigger court_operating_hours_set_updated_at
before update on public.court_operating_hours
for each row execute function public.set_updated_at();

insert into public.court_operating_hours (court_id, weekday, opens_at, closes_at, is_closed)
select c.id, weekday, time '06:00', time '22:00', false
from public.courts c
cross join generate_series(0, 6) as weekday
on conflict (court_id, weekday) do nothing;

alter table public.court_bookings
  add column if not exists updated_at timestamptz not null default now(),
  add column if not exists cancelled_at timestamptz,
  add column if not exists cancelled_by uuid references public.profiles(id) on delete set null,
  add column if not exists cancellation_reason text,
  add column if not exists price_cents integer,
  add column if not exists currency text;

update public.court_bookings booking
set price_cents = round(
      coalesce(court.hourly_price_cents, 0)::numeric
      * extract(epoch from (booking.ends_at - booking.starts_at))
      / 3600
    )::integer,
    currency = court.currency
from public.courts court
where court.id = booking.court_id
  and (booking.price_cents is null or booking.currency is null);

drop trigger if exists court_bookings_set_updated_at on public.court_bookings;
create trigger court_bookings_set_updated_at
before update on public.court_bookings
for each row execute function public.set_updated_at();

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
begin
  if range_start is null or range_end is null or range_end < range_start then
    raise exception 'Choose a valid availability date range.';
  end if;

  if range_end - range_start > 31 then
    raise exception 'Availability can be requested for at most 32 days.';
  end if;

  select * into selected_court
  from public.courts
  where id = target_court_id;

  if selected_court.id is null or not selected_court.booking_enabled then
    return;
  end if;

  return query
  with local_days as (
    select generated_day::date as local_day
    from generate_series(range_start, range_end, interval '1 day') as generated_day
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
      * selected_court.slot_duration_minutes
      / 60
    )::integer,
    selected_court.currency
  from candidate_slots candidate
  where candidate.slot_start > now()
    and candidate.slot_start <= now() + make_interval(days => selected_court.booking_window_days)
    and not exists (
      select 1
      from public.court_closures closure
      where closure.court_id = selected_court.id
        and tstzrange(closure.starts_at, closure.ends_at, '[)')
          && tstzrange(candidate.slot_start, candidate.slot_end, '[)')
    )
    and not exists (
      select 1
      from public.court_bookings booking
      where booking.court_id = selected_court.id
        and booking.status in ('pending', 'confirmed')
        and tstzrange(booking.starts_at, booking.ends_at, '[)')
          && tstzrange(candidate.slot_start, candidate.slot_end, '[)')
    )
  order by candidate.slot_start;
end;
$$;

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
    select c.booking_enabled
      and exists (
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

create or replace function public.discover_courts(
  target_court_id uuid default null,
  origin_latitude double precision default null,
  origin_longitude double precision default null,
  filter_city text default null,
  filter_sport text default null,
  filter_surface text default null,
  max_distance_km double precision default null,
  max_price_cents integer default null,
  require_open_now boolean default false,
  require_future_availability boolean default false,
  availability_start date default current_date,
  availability_end date default current_date + 7,
  result_limit integer default 30
)
returns table (
  id uuid,
  name text,
  sport text,
  city text,
  address text,
  latitude double precision,
  longitude double precision,
  distance_km double precision,
  surface text,
  rating numeric,
  hourly_price_cents integer,
  currency text,
  is_open_now boolean,
  is_future_bookable boolean,
  timezone text,
  slot_duration_minutes integer,
  booking_window_days integer,
  cancellation_notice_hours integer,
  booking_requires_approval boolean,
  payment_policy text
)
language plpgsql
stable
security definer
set search_path = public, extensions, pg_catalog
as $$
begin
  if (origin_latitude is null) <> (origin_longitude is null) then
    raise exception 'Latitude and longitude must be provided together.';
  end if;
  if origin_latitude is not null and (origin_latitude not between -90 and 90 or origin_longitude not between -180 and 180) then
    raise exception 'Invalid discovery coordinates.';
  end if;
  if max_distance_km is not null and max_distance_km <= 0 then
    raise exception 'Distance must be greater than zero.';
  end if;

  return query
  with discovered as (
    select
      c.*,
      case
        when origin_latitude is null then null::double precision
        else st_distance(
          c.geo,
          st_setsrid(st_makepoint(origin_longitude, origin_latitude), 4326)::geography
        ) / 1000.0
      end as calculated_distance_km,
      public.court_is_open_at(c.id, now()) as calculated_open_now,
      (
        c.booking_enabled
        and exists (
          select 1
          from public.get_court_availability(c.id, availability_start, availability_end)
        )
      ) as calculated_future_bookable
    from public.courts c
    where (target_court_id is null or c.id = target_court_id)
      and (nullif(trim(filter_city), '') is null or c.city ilike '%' || trim(filter_city) || '%')
      and (nullif(trim(filter_sport), '') is null or c.sport = trim(filter_sport))
      and (nullif(trim(filter_surface), '') is null or lower(c.surface) = lower(trim(filter_surface)))
      and (max_price_cents is null or c.hourly_price_cents <= max_price_cents)
  )
  select
    d.id,
    d.name,
    d.sport,
    d.city,
    d.address,
    d.latitude,
    d.longitude,
    d.calculated_distance_km,
    coalesce(d.surface, 'Court'),
    coalesce(d.rating, 0),
    coalesce(d.hourly_price_cents, 0),
    d.currency,
    d.calculated_open_now,
    d.calculated_future_bookable,
    d.timezone,
    d.slot_duration_minutes,
    d.booking_window_days,
    d.cancellation_notice_hours,
    d.booking_requires_approval,
    d.payment_policy
  from discovered d
  where (max_distance_km is null or d.calculated_distance_km <= max_distance_km)
    and (not require_open_now or d.calculated_open_now)
    and (not require_future_availability or d.calculated_future_bookable)
  order by d.calculated_distance_km asc nulls last, d.rating desc, d.name
  limit least(greatest(coalesce(result_limit, 30), 1), 100);
end;
$$;

drop function if exists public.book_court_slot(uuid, timestamptz, timestamptz);
create function public.book_court_slot(
  target_court_id uuid,
  target_starts_at timestamptz,
  target_ends_at timestamptz
)
returns table (booking_id uuid, booking_status text)
language plpgsql
security definer
set search_path = public, extensions, pg_catalog
as $$
declare
  current_user_id uuid := auth.uid();
  selected_court public.courts%rowtype;
  local_booking_date date;
  new_booking_id uuid;
  new_booking_status text;
begin
  if current_user_id is null then
    raise exception 'You must be signed in to book a court.';
  end if;

  select * into selected_court
  from public.courts
  where id = target_court_id
  for update;

  if selected_court.id is null then
    raise exception 'Court not found.';
  end if;
  if not selected_court.booking_enabled then
    raise exception 'This court is not accepting future bookings.';
  end if;
  if target_starts_at is null or target_ends_at is null or target_starts_at <= now() then
    raise exception 'Choose a future court slot.';
  end if;
  if target_ends_at - target_starts_at <> make_interval(mins => selected_court.slot_duration_minutes) then
    raise exception 'Bookings for this court must use its % minute slots.', selected_court.slot_duration_minutes;
  end if;

  local_booking_date := (target_starts_at at time zone selected_court.timezone)::date;
  if not exists (
    select 1
    from public.get_court_availability(selected_court.id, local_booking_date, local_booking_date) available
    where available.starts_at = target_starts_at
      and available.ends_at = target_ends_at
  ) then
    raise exception 'That slot is not available. Refresh and choose another time.';
  end if;

  new_booking_status := case when selected_court.booking_requires_approval then 'pending' else 'confirmed' end;

  insert into public.court_bookings (
    court_id,
    user_id,
    starts_at,
    ends_at,
    status,
    price_cents,
    currency
  )
  values (
    selected_court.id,
    current_user_id,
    target_starts_at,
    target_ends_at,
    new_booking_status,
    round(
      coalesce(selected_court.hourly_price_cents, 0)::numeric
      * selected_court.slot_duration_minutes
      / 60
    )::integer,
    selected_court.currency
  )
  returning id into new_booking_id;

  return query select new_booking_id, new_booking_status;
exception
  when exclusion_violation then
    raise exception 'That slot was just booked. Refresh and choose another time.';
end;
$$;

create or replace function public.cancel_court_booking(
  target_booking_id uuid,
  cancellation_reason text default null
)
returns void
language plpgsql
security definer
set search_path = public, pg_catalog
as $$
declare
  current_user_id uuid := auth.uid();
  selected_booking public.court_bookings%rowtype;
  notice_hours integer;
  is_admin boolean;
begin
  if current_user_id is null then
    raise exception 'You must be signed in to cancel a booking.';
  end if;

  is_admin := public.current_user_is_admin();

  select booking.*
  into selected_booking
  from public.court_bookings booking
  where booking.id = target_booking_id
  for update;

  if selected_booking.id is null then
    raise exception 'Booking not found.';
  end if;

  select court.cancellation_notice_hours
  into notice_hours
  from public.courts court
  where court.id = selected_booking.court_id;
  if selected_booking.user_id <> current_user_id and not is_admin then
    raise exception 'You can only cancel your own bookings.';
  end if;
  if selected_booking.status not in ('pending', 'confirmed') then
    raise exception 'This booking cannot be cancelled.';
  end if;
  if not is_admin and now() > selected_booking.starts_at - make_interval(hours => notice_hours) then
    raise exception 'This booking is inside the % hour cancellation window. Contact the venue.', notice_hours;
  end if;

  update public.court_bookings
  set status = 'cancelled',
      cancelled_at = now(),
      cancelled_by = current_user_id,
      cancellation_reason = nullif(left(trim(cancellation_reason), 240), '')
  where id = selected_booking.id;
end;
$$;

create or replace function public.update_court_booking_status(
  target_booking_id uuid,
  target_status text
)
returns void
language plpgsql
security definer
set search_path = public, extensions, pg_catalog
as $$
declare
  selected_booking public.court_bookings%rowtype;
begin
  if auth.uid() is null or not public.current_user_is_admin() then
    raise exception 'Only admins can manage court bookings.';
  end if;
  if target_status not in ('confirmed', 'cancelled') then
    raise exception 'Admins can only confirm or cancel booking requests.';
  end if;

  select * into selected_booking
  from public.court_bookings
  where id = target_booking_id
  for update;

  if selected_booking.id is null then
    raise exception 'Booking not found.';
  end if;
  if selected_booking.status = 'cancelled' then
    raise exception 'Cancelled bookings cannot be reopened.';
  end if;
  if selected_booking.ends_at <= now() then
    raise exception 'Past bookings cannot be changed.';
  end if;

  update public.court_bookings
  set status = target_status,
      cancelled_at = case when target_status = 'cancelled' then now() else null end,
      cancelled_by = case when target_status = 'cancelled' then auth.uid() else null end
  where id = selected_booking.id;
exception
  when exclusion_violation then
    raise exception 'That slot conflicts with another active booking.';
end;
$$;

create or replace function public.notify_court_booking_status_change()
returns trigger
language plpgsql
security definer
set search_path = public, pg_catalog
as $$
declare
  court_name text;
begin
  if old.status = new.status or new.status not in ('confirmed', 'cancelled') then
    return new;
  end if;
  if new.status = 'cancelled' and new.cancelled_by = new.user_id then
    return new;
  end if;

  select name into court_name from public.courts where id = new.court_id;
  perform public.upsert_notification_bundle(
    new.user_id,
    new.cancelled_by,
    'event',
    case when new.status = 'confirmed' then 'Court booking confirmed' else 'Court booking cancelled' end,
    coalesce(court_name, 'Your court') || ' booking was ' || new.status || '.',
    'court_booking',
    new.id,
    jsonb_build_object(
      'source', 'court_booking_status',
      'screen', 'CourtBookingDetail',
      'bookingId', new.id::text
    ),
    'court_booking:' || new.id::text || ':' || new.status,
    false
  );
  return new;
end;
$$;

drop trigger if exists court_bookings_notify_status_change on public.court_bookings;
create trigger court_bookings_notify_status_change
after update of status on public.court_bookings
for each row execute function public.notify_court_booking_status_change();

alter table public.court_operating_hours enable row level security;
alter table public.court_closures enable row level security;

drop policy if exists "court operating hours readable" on public.court_operating_hours;
create policy "court operating hours readable"
on public.court_operating_hours for select using (true);

drop policy if exists "admins manage court operating hours" on public.court_operating_hours;
create policy "admins manage court operating hours"
on public.court_operating_hours for all
using (public.current_user_is_admin())
with check (public.current_user_is_admin());

drop policy if exists "court closures readable" on public.court_closures;
create policy "court closures readable"
on public.court_closures for select using (true);

drop policy if exists "admins manage court closures" on public.court_closures;
create policy "admins manage court closures"
on public.court_closures for all
using (public.current_user_is_admin())
with check (public.current_user_is_admin());

-- All booking mutations must pass through the checked lifecycle functions.
drop policy if exists "users create own court bookings" on public.court_bookings;
drop policy if exists "users update own court bookings" on public.court_bookings;
drop policy if exists "admins update all court bookings" on public.court_bookings;

revoke all on function public.validate_court_timezone() from public, anon, authenticated;
revoke all on function public.initialize_court_operating_hours() from public, anon, authenticated;
revoke all on function public.court_is_open_at(uuid, timestamptz) from public, anon, authenticated;
revoke all on function public.notify_court_booking_status_change() from public, anon, authenticated;
revoke all on function public.get_court_availability(uuid, date, date) from public, anon;
revoke all on function public.discover_courts(uuid, double precision, double precision, text, text, text, double precision, integer, boolean, boolean, date, date, integer) from public, anon;
revoke all on function public.book_court_slot(uuid, timestamptz, timestamptz) from public, anon;
revoke all on function public.cancel_court_booking(uuid, text) from public, anon;
revoke all on function public.update_court_booking_status(uuid, text) from public, anon;

grant execute on function public.get_court_availability(uuid, date, date) to authenticated;
grant execute on function public.discover_courts(uuid, double precision, double precision, text, text, text, double precision, integer, boolean, boolean, date, date, integer) to authenticated;
grant execute on function public.book_court_slot(uuid, timestamptz, timestamptz) to authenticated;
grant execute on function public.cancel_court_booking(uuid, text) to authenticated;
grant execute on function public.update_court_booking_status(uuid, text) to authenticated;
