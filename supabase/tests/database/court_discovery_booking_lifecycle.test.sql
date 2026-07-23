begin;

create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;

select plan(27);

insert into auth.users (
  id,
  instance_id,
  aud,
  role,
  email,
  encrypted_password,
  email_confirmed_at,
  raw_app_meta_data,
  raw_user_meta_data,
  created_at,
  updated_at
)
select
  fixture.id,
  '00000000-0000-0000-0000-000000000000'::uuid,
  'authenticated',
  'authenticated',
  fixture.email,
  'test-password',
  now(),
  '{"provider":"email","providers":["email"]}'::jsonb,
  jsonb_build_object('username', fixture.username, 'display_name', fixture.display_name),
  now(),
  now()
from (
  values
    ('11000000-0000-0000-0000-000000000001'::uuid, 'court-user@example.test', 'court_user', 'Court User'),
    ('11000000-0000-0000-0000-000000000002'::uuid, 'court-other@example.test', 'court_other', 'Court Other'),
    ('11000000-0000-0000-0000-000000000003'::uuid, 'court-admin@example.test', 'court_admin', 'Court Admin')
) as fixture(id, email, username, display_name)
on conflict (id) do nothing;

update public.profiles
set is_admin = true
where id = '11000000-0000-0000-0000-000000000003';

insert into public.courts (
  id,
  name,
  sport,
  city,
  address,
  latitude,
  longitude,
  surface,
  rating,
  hourly_price_cents,
  currency,
  timezone,
  slot_duration_minutes,
  booking_window_days,
  cancellation_notice_hours,
  booking_requires_approval,
  booking_enabled,
  payment_policy
)
values
  (
    '21000000-0000-0000-0000-000000000001',
    'Lifecycle Court',
    'Tennis',
    'Bengaluru',
    'Test Address',
    12.9716,
    77.5946,
    'Clay',
    4.5,
    60000,
    'INR',
    'UTC',
    60,
    30,
    6,
    true,
    true,
    'external'
  ),
  (
    '21000000-0000-0000-0000-000000000002',
    'Timezone Court',
    'Badminton',
    'Bengaluru',
    'Timezone Address',
    12.98,
    77.60,
    'Synthetic',
    4.0,
    40000,
    'INR',
    'Asia/Kolkata',
    60,
    30,
    6,
    false,
    true,
    'not_required'
  );

insert into public.court_operating_hours (court_id, weekday, opens_at, closes_at, is_closed)
select court_id, weekday, time '06:00', time '22:00', false
from (
  values
    ('21000000-0000-0000-0000-000000000001'::uuid),
    ('21000000-0000-0000-0000-000000000002'::uuid)
) courts(court_id)
cross join generate_series(0, 6) weekday;

insert into public.court_closures (court_id, starts_at, ends_at, reason)
values (
  '21000000-0000-0000-0000-000000000001',
  ((current_date + 1) + time '08:00') at time zone 'UTC',
  ((current_date + 1) + time '10:00') at time zone 'UTC',
  'Maintenance'
);

select ok(
  (
    select distance_km < 0.01
    from public.discover_courts(
      target_court_id => '21000000-0000-0000-0000-000000000001',
      origin_latitude => 12.9716,
      origin_longitude => 77.5946
    )
  ),
  'discovery calculates a real geographic distance'
);

select is(
  (
    select count(*)::integer
    from public.discover_courts(
      filter_city => 'Bengaluru',
      filter_sport => 'Tennis',
      filter_surface => 'Clay',
      max_distance_km => 5,
      max_price_cents => 70000,
      origin_latitude => 12.9716,
      origin_longitude => 77.5946
    )
  ),
  1,
  'server-side discovery combines city, sport, surface, distance, and price filters'
);

select is(
  (select count(*)::integer from public.discover_courts(filter_sport => 'Football')),
  0,
  'sport filter excludes non-matching courts'
);

select is(
  (select count(*)::integer from public.discover_courts(max_price_cents => 1000)),
  0,
  'price filter excludes expensive courts'
);

select is(
  (
    select count(*)::integer
    from public.discover_courts(
      target_court_id => '21000000-0000-0000-0000-000000000001',
      require_future_availability => true,
      availability_start => current_date + 1,
      availability_end => current_date + 1
    )
  ),
  1,
  'future availability is filtered on the server'
);

select is(
  (
    select count(*)::integer
    from public.get_court_availability(
      '21000000-0000-0000-0000-000000000001',
      current_date + 1,
      current_date + 1
    )
    where extract(hour from starts_at at time zone 'UTC') in (8, 9)
  ),
  0,
  'closures remove affected operating-hour slots'
);

select ok(
  exists (
    select 1
    from public.get_court_availability(
      '21000000-0000-0000-0000-000000000001',
      current_date + 1,
      current_date + 1
    )
    where extract(hour from starts_at at time zone 'UTC') = 6
  ),
  'valid operating-hour slots are returned'
);

select is(
  (
    select min(extract(hour from starts_at at time zone 'Asia/Kolkata'))::integer
    from public.get_court_availability(
      '21000000-0000-0000-0000-000000000002',
      current_date + 1,
      current_date + 1
    )
  ),
  6,
  'availability honors each court timezone'
);

select is(
  (select payment_policy from public.courts where id = '21000000-0000-0000-0000-000000000001'),
  'external',
  'court payment responsibility is explicit'
);

set local role authenticated;
select set_config(
  'request.jwt.claims',
  '{"sub":"11000000-0000-0000-0000-000000000001","role":"authenticated"}',
  true
);

select is(
  (
    select booking_status
    from public.book_court_slot(
      '21000000-0000-0000-0000-000000000001',
      ((current_date + 1) + time '10:00') at time zone 'UTC',
      ((current_date + 1) + time '11:00') at time zone 'UTC'
    )
  ),
  'pending',
  'booking an available approval-required slot creates a pending request'
);
reset role;

select is(
  (
    select count(*)::integer
    from public.get_court_availability(
      '21000000-0000-0000-0000-000000000001',
      current_date + 1,
      current_date + 1
    )
    where extract(hour from starts_at at time zone 'UTC') = 10
  ),
  0,
  'occupied pending slots are not offered'
);

set local role authenticated;
select set_config(
  'request.jwt.claims',
  '{"sub":"11000000-0000-0000-0000-000000000002","role":"authenticated"}',
  true
);
select throws_ok(
  $$ select public.book_court_slot(
    '21000000-0000-0000-0000-000000000001',
    ((current_date + 1) + time '10:00') at time zone 'UTC',
    ((current_date + 1) + time '11:00') at time zone 'UTC'
  ) $$,
  'P0001',
  'That slot is not available. Refresh and choose another time.',
  'a duplicate booking attempt is rejected'
);
reset role;

set local role authenticated;
select set_config(
  'request.jwt.claims',
  '{"sub":"11000000-0000-0000-0000-000000000001","role":"authenticated"}',
  true
);
select is(
  (select count(*)::integer from public.court_bookings),
  1,
  'a user can read their own booking'
);
reset role;

set local role authenticated;
select set_config(
  'request.jwt.claims',
  '{"sub":"11000000-0000-0000-0000-000000000002","role":"authenticated"}',
  true
);
select is(
  (select count(*)::integer from public.court_bookings),
  0,
  'RLS hides another user booking'
);
select throws_ok(
  $$ insert into public.court_bookings (court_id, user_id, starts_at, ends_at, status)
     values (
       '21000000-0000-0000-0000-000000000001',
       '11000000-0000-0000-0000-000000000002',
       now() + interval '3 days',
       now() + interval '3 days 1 hour',
       'pending'
     ) $$,
  '42501',
  null,
  'users cannot bypass the booking lifecycle with a direct insert'
);
reset role;

set local role authenticated;
select set_config(
  'request.jwt.claims',
  '{"sub":"11000000-0000-0000-0000-000000000001","role":"authenticated"}',
  true
);
select lives_ok(
  $$ select public.cancel_court_booking(
    (select id from public.court_bookings where user_id = auth.uid() limit 1),
    'Changed plans'
  ) $$,
  'an owner can cancel before the notice deadline'
);
reset role;

select is(
  (
    select status
    from public.court_bookings
    where user_id = '11000000-0000-0000-0000-000000000001'
    order by created_at
    limit 1
  ),
  'cancelled',
  'cancellation updates the booking status'
);

select ok(
  exists (
    select 1
    from public.get_court_availability(
      '21000000-0000-0000-0000-000000000001',
      current_date + 1,
      current_date + 1
    )
    where extract(hour from starts_at at time zone 'UTC') = 10
  ),
  'a cancelled booking releases its slot'
);

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
  '21000000-0000-0000-0000-000000000001',
  '11000000-0000-0000-0000-000000000001',
  now() + interval '2 hours',
  now() + interval '3 hours',
  'confirmed',
  60000,
  'INR'
);

set local role authenticated;
select set_config(
  'request.jwt.claims',
  '{"sub":"11000000-0000-0000-0000-000000000001","role":"authenticated"}',
  true
);
select throws_ok(
  $$ select public.cancel_court_booking(
    (select id from public.court_bookings where starts_at < now() + interval '4 hours' limit 1)
  ) $$,
  'P0001',
  'This booking is inside the 6 hour cancellation window. Contact the venue.',
  'the database enforces the cancellation notice period'
);
select throws_ok(
  $$ select public.update_court_booking_status(
    (select id from public.court_bookings limit 1),
    'confirmed'
  ) $$,
  'P0001',
  'Only admins can manage court bookings.',
  'non-admin users cannot manage booking status'
);
reset role;

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
  '21000000-0000-0000-0000-000000000001',
  '11000000-0000-0000-0000-000000000002',
  ((current_date + 2) + time '14:00') at time zone 'UTC',
  ((current_date + 2) + time '15:00') at time zone 'UTC',
  'pending',
  60000,
  'INR'
);

set local role authenticated;
select set_config(
  'request.jwt.claims',
  '{"sub":"11000000-0000-0000-0000-000000000003","role":"authenticated"}',
  true
);
select lives_ok(
  $$ select public.update_court_booking_status(
    (
      select id
      from public.court_bookings
      where user_id = '11000000-0000-0000-0000-000000000002'
      order by created_at desc
      limit 1
    ),
    'confirmed'
  ) $$,
  'admins can confirm pending bookings'
);
select ok(
  (select count(*) from public.court_bookings) >= 3,
  'admins retain access to all bookings'
);
reset role;

select is(
  (
    select status
    from public.court_bookings
    where user_id = '11000000-0000-0000-0000-000000000002'
    order by created_at desc
    limit 1
  ),
  'confirmed',
  'admin confirmation persists'
);

select throws_ok(
  $$ update public.courts
     set timezone = 'Not/A_Timezone'
     where id = '21000000-0000-0000-0000-000000000001' $$,
  'P0001',
  'Unknown court timezone: Not/A_Timezone',
  'invalid court timezone configuration is rejected'
);

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
  '21000000-0000-0000-0000-000000000001',
  '11000000-0000-0000-0000-000000000001',
  ((current_date + 3) + time '12:00') at time zone 'UTC',
  ((current_date + 3) + time '13:00') at time zone 'UTC',
  'confirmed',
  60000,
  'INR'
);

select throws_ok(
  $$ insert into public.court_bookings (
       court_id,
       user_id,
       starts_at,
       ends_at,
       status,
       price_cents,
       currency
     )
     values (
       '21000000-0000-0000-0000-000000000001',
       '11000000-0000-0000-0000-000000000002',
       ((current_date + 3) + time '12:30') at time zone 'UTC',
       ((current_date + 3) + time '13:30') at time zone 'UTC',
       'pending',
       60000,
       'INR'
     ) $$,
  '23P01',
  null,
  'the exclusion constraint rejects overlapping active bookings'
);

select is(
  (
    select count(*)::integer
    from public.court_operating_hours
    where court_id = '21000000-0000-0000-0000-000000000001'
  ),
  7,
  'weekly operating hours cover every configured weekday'
);

select is(
  (
    select slot_duration_minutes
    from public.get_court_availability(
      '21000000-0000-0000-0000-000000000001',
      current_date + 1,
      current_date + 1
    )
    limit 1
  ),
  60,
  'availability returns the configured slot duration'
);

select * from finish();
rollback;
