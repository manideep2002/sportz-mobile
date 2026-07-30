begin;
create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions, pgtap;
select plan(5);

insert into auth.users (
  id, instance_id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at
)
values
  ('71000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'delivery-sender@test', 'x', now(), '{}', '{}', now(), now()),
  ('71000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'delivery-peer@test', 'x', now(), '{}', '{}', now(), now())
on conflict (id) do nothing;

insert into public.chat_rooms (id, room_kind, created_by, title)
values
  ('72000000-0000-0000-0000-000000000001', 'direct', '71000000-0000-0000-0000-000000000001', 'Delivery fixture one'),
  ('72000000-0000-0000-0000-000000000002', 'direct', '71000000-0000-0000-0000-000000000001', 'Delivery fixture two');

insert into public.chat_participants (room_id, user_id, role)
values
  ('72000000-0000-0000-0000-000000000001', '71000000-0000-0000-0000-000000000001', 'member'),
  ('72000000-0000-0000-0000-000000000001', '71000000-0000-0000-0000-000000000002', 'member'),
  ('72000000-0000-0000-0000-000000000002', '71000000-0000-0000-0000-000000000001', 'member'),
  ('72000000-0000-0000-0000-000000000002', '71000000-0000-0000-0000-000000000002', 'member');

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"71000000-0000-0000-0000-000000000001","role":"authenticated"}', true);

select lives_ok(
  $$ select public.send_chat_message(
    '72000000-0000-0000-0000-000000000001',
    '73000000-0000-0000-0000-000000000001',
    'text',
    'hello once'
  ) $$,
  'the first delivery inserts the client-generated message id'
);

select is(
  (select (public.send_chat_message(
    '72000000-0000-0000-0000-000000000001',
    '73000000-0000-0000-0000-000000000001',
    'text',
    'hello once'
  )).id),
  '73000000-0000-0000-0000-000000000001'::uuid,
  'retrying the same client id returns the confirmed message'
);

select is(
  (select count(*)::integer from public.chat_messages where id = '73000000-0000-0000-0000-000000000001'),
  1,
  'an idempotent retry does not create a duplicate row'
);

select throws_ok(
  $$ select public.send_chat_message(
    '72000000-0000-0000-0000-000000000002',
    '73000000-0000-0000-0000-000000000001',
    'text',
    'wrong room'
  ) $$,
  'P0001',
  'Message id is already in use.',
  'a sender cannot reuse the idempotency key in another room'
);

reset role;
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"71000000-0000-0000-0000-000000000002","role":"authenticated"}', true);

select throws_ok(
  $$ select public.send_chat_message(
    '72000000-0000-0000-0000-000000000001',
    '73000000-0000-0000-0000-000000000001',
    'text',
    'wrong sender'
  ) $$,
  'P0001',
  'Message id is already in use.',
  'another participant cannot claim the sender idempotency key'
);

select * from finish();
rollback;
