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
  test_user.id,
  '00000000-0000-0000-0000-000000000000'::uuid,
  'authenticated',
  'authenticated',
  test_user.email,
  'test-password',
  now(),
  '{"provider":"email","providers":["email"]}'::jsonb,
  jsonb_build_object('username', test_user.username, 'display_name', test_user.display_name),
  now(),
  now()
from (
  values
    ('10000000-0000-0000-0000-000000000001'::uuid, 'waitlist-organizer@example.test', 'waitlist_host', 'Waitlist Host'),
    ('10000000-0000-0000-0000-000000000002'::uuid, 'waitlist-attendee@example.test', 'waitlist_attendee', 'Existing Attendee'),
    ('10000000-0000-0000-0000-000000000003'::uuid, 'waitlist-one@example.test', 'waitlist_one', 'Waitlist One'),
    ('10000000-0000-0000-0000-000000000004'::uuid, 'waitlist-two@example.test', 'waitlist_two', 'Waitlist Two'),
    ('10000000-0000-0000-0000-000000000005'::uuid, 'waitlist-three@example.test', 'waitlist_three', 'Waitlist Three'),
    ('10000000-0000-0000-0000-000000000006'::uuid, 'waitlist-outsider@example.test', 'waitlist_outsider', 'Waitlist Outsider')
) as test_user(id, email, username, display_name)
on conflict (id) do nothing;

insert into public.sport_events (
  id,
  organizer_id,
  title,
  event_type,
  sport,
  description,
  starts_at,
  ends_at,
  location_name,
  city,
  max_players,
  visibility,
  status
)
values (
  '20000000-0000-0000-0000-000000000001',
  '10000000-0000-0000-0000-000000000001',
  'Waitlist lifecycle test',
  'Pickup Game',
  'Basketball',
  'Database lifecycle test fixture',
  now() + interval '2 days',
  now() + interval '2 days 2 hours',
  'Test Court',
  'Bengaluru',
  2,
  'public',
  'open'
);

insert into public.event_attendees (event_id, user_id, status)
values
  ('20000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001', 'going'),
  ('20000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000002', 'going');
select public.set_sport_event_capacity_status('20000000-0000-0000-0000-000000000001');

set local role authenticated;
select set_config(
  'request.jwt.claims',
  '{"sub":"10000000-0000-0000-0000-000000000003","role":"authenticated"}',
  true
);
select is(
  public.join_sport_event('20000000-0000-0000-0000-000000000001'),
  'waitlisted',
  'a full-event join enters the waitlist'
);
select is(
  public.join_sport_event('20000000-0000-0000-0000-000000000001'),
  'waitlisted',
  'duplicate waitlist joins are idempotent'
);
reset role;

select is(
  (select count(*)::integer from public.event_waitlist where event_id = '20000000-0000-0000-0000-000000000001' and user_id = '10000000-0000-0000-0000-000000000003' and status = 'waiting'),
  1,
  'only one active waitlist row exists per user and event'
);

set local role authenticated;
select set_config(
  'request.jwt.claims',
  '{"sub":"10000000-0000-0000-0000-000000000004","role":"authenticated"}',
  true
);
select is(
  public.join_sport_event('20000000-0000-0000-0000-000000000001'),
  'waitlisted',
  'a second user joins behind the first'
);
reset role;

set local role authenticated;
select set_config(
  'request.jwt.claims',
  '{"sub":"10000000-0000-0000-0000-000000000003","role":"authenticated"}',
  true
);
select is(
  public.get_event_participation_status('20000000-0000-0000-0000-000000000001'),
  'waitlisted',
  'single participation reads include active waitlist rows'
);
select lives_ok(
  $$ select public.leave_event_waitlist('20000000-0000-0000-0000-000000000001') $$,
  'users can leave their waitlist'
);
select is(
  public.get_event_participation_status('20000000-0000-0000-0000-000000000001'),
  'none',
  'leaving the waitlist clears participation'
);
reset role;

select is(
  (select status from public.event_waitlist where event_id = '20000000-0000-0000-0000-000000000001' and user_id = '10000000-0000-0000-0000-000000000003'),
  'cancelled',
  'leaving preserves a cancelled audit row'
);

set local role authenticated;
select set_config(
  'request.jwt.claims',
  '{"sub":"10000000-0000-0000-0000-000000000002","role":"authenticated"}',
  true
);
select lives_ok(
  $$ select public.leave_sport_event('20000000-0000-0000-0000-000000000001') $$,
  'an attendee can leave while another user is queued'
);
reset role;

select ok(
  exists (select 1 from public.event_attendees where event_id = '20000000-0000-0000-0000-000000000001' and user_id = '10000000-0000-0000-0000-000000000004' and status = 'going'),
  'the next FIFO user is promoted automatically'
);
select is(
  (select status from public.event_waitlist where event_id = '20000000-0000-0000-0000-000000000001' and user_id = '10000000-0000-0000-0000-000000000004'),
  'promoted',
  'the promoted waitlist row is finalized exactly once'
);
select is(
  (select count(*)::integer from public.notifications where user_id = '10000000-0000-0000-0000-000000000004' and entity_id = '20000000-0000-0000-0000-000000000001' and data->>'source' = 'waitlist_promotion'),
  1,
  'promotion creates one routed user notification'
);
select is(
  (select count(*)::integer from public.event_attendees where event_id = '20000000-0000-0000-0000-000000000001' and status = 'going'),
  2,
  'automatic promotion fills but does not overfill capacity'
);
select is(
  (select status::text from public.sport_events where id = '20000000-0000-0000-0000-000000000001'),
  'full',
  'event capacity status stays synchronized'
);

select throws_ok(
  $$ insert into public.event_attendees (event_id, user_id, status) values ('20000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000006', 'going') $$,
  'P0001',
  'Event capacity has been reached.',
  'the database capacity trigger rejects an overfill independently of RLS'
);

set local role authenticated;
select set_config(
  'request.jwt.claims',
  '{"sub":"10000000-0000-0000-0000-000000000005","role":"authenticated"}',
  true
);
select is(
  public.join_sport_event('20000000-0000-0000-0000-000000000001'),
  'waitlisted',
  'another full-event join is queued'
);
reset role;

set local role authenticated;
select set_config(
  'request.jwt.claims',
  '{"sub":"10000000-0000-0000-0000-000000000001","role":"authenticated"}',
  true
);
select throws_ok(
  $$ select public.promote_event_waitlist_user('20000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000005') $$,
  'P0001',
  'No event space is available for manual promotion.',
  'manual promotion cannot exceed event capacity'
);
select lives_ok(
  $$ select public.remove_event_attendee('20000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000004') $$,
  'organizer attendee removal is capacity-safe'
);
reset role;

select ok(
  exists (select 1 from public.event_attendees where event_id = '20000000-0000-0000-0000-000000000001' and user_id = '10000000-0000-0000-0000-000000000005' and status = 'going'),
  'organizer removal promotes the next FIFO user'
);
select is(
  (select count(*)::integer from public.notifications where user_id = '10000000-0000-0000-0000-000000000005' and entity_id = '20000000-0000-0000-0000-000000000001' and data->>'source' = 'waitlist_promotion'),
  1,
  'organizer-triggered promotion notifies exactly once'
);

set local role authenticated;
select set_config(
  'request.jwt.claims',
  '{"sub":"10000000-0000-0000-0000-000000000003","role":"authenticated"}',
  true
);
select is(
  (select count(*)::integer from public.event_waitlist where event_id = '20000000-0000-0000-0000-000000000001' and user_id = '10000000-0000-0000-0000-000000000005'),
  0,
  'RLS hides another user waitlist row from non-organizers'
);
select is(
  (select count(*)::integer from public.event_waitlist where event_id = '20000000-0000-0000-0000-000000000001' and user_id = '10000000-0000-0000-0000-000000000003'),
  1,
  'RLS still allows users to read their own waitlist history'
);
reset role;

set local role authenticated;
select set_config(
  'request.jwt.claims',
  '{"sub":"10000000-0000-0000-0000-000000000006","role":"authenticated"}',
  true
);
select throws_ok(
  $$ insert into public.event_waitlist (event_id, user_id, status) values ('20000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000006', 'waiting') $$,
  '42501',
  'new row violates row-level security policy for table "event_waitlist"',
  'RLS blocks direct waitlist lifecycle writes'
);
select throws_ok(
  $$ insert into public.event_attendees (event_id, user_id, status) values ('20000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000006', 'interested') $$,
  '42501',
  'new row violates row-level security policy for table "event_attendees"',
  'RLS blocks direct RSVP lifecycle writes'
);
reset role;

set local role authenticated;
select set_config(
  'request.jwt.claims',
  '{"sub":"10000000-0000-0000-0000-000000000003","role":"authenticated"}',
  true
);
select is(
  public.join_sport_event('20000000-0000-0000-0000-000000000001'),
  'waitlisted',
  'a user can rejoin at the back of the queue after leaving'
);
reset role;

set local role authenticated;
select set_config(
  'request.jwt.claims',
  '{"sub":"10000000-0000-0000-0000-000000000001","role":"authenticated"}',
  true
);
select lives_ok(
  $$ select public.remove_event_waitlist_user('20000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000003') $$,
  'organizers can remove an active waitlist entry'
);
reset role;

select is(
  (select status from public.event_waitlist where event_id = '20000000-0000-0000-0000-000000000001' and user_id = '10000000-0000-0000-0000-000000000003'),
  'cancelled',
  'organizer waitlist removal persists as cancelled'
);

select * from finish();
rollback;
