begin;
create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions, pgtap;
select plan(11);

insert into auth.users (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
values
  ('61000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'clear-owner@test', 'x', now(), '{}', '{}', now(), now()),
  ('61000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'clear-peer@test', 'x', now(), '{}', '{}', now(), now()),
  ('61000000-0000-0000-0000-000000000003', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'clear-outsider@test', 'x', now(), '{}', '{}', now(), now())
on conflict (id) do nothing;

insert into public.chat_rooms (id, room_kind, created_by, title)
values
  ('62000000-0000-0000-0000-000000000001', 'direct', '61000000-0000-0000-0000-000000000001', 'Direct clear fixture'),
  ('62000000-0000-0000-0000-000000000002', 'group', '61000000-0000-0000-0000-000000000001', 'Group clear fixture');

insert into public.chat_participants (room_id, user_id, role)
values
  ('62000000-0000-0000-0000-000000000001', '61000000-0000-0000-0000-000000000001', 'member'),
  ('62000000-0000-0000-0000-000000000001', '61000000-0000-0000-0000-000000000002', 'member'),
  ('62000000-0000-0000-0000-000000000002', '61000000-0000-0000-0000-000000000001', 'owner'),
  ('62000000-0000-0000-0000-000000000002', '61000000-0000-0000-0000-000000000002', 'member');

insert into public.chat_messages (id, room_id, sender_id, message_type, body, created_at)
values
  ('63000000-0000-0000-0000-000000000001', '62000000-0000-0000-0000-000000000001', '61000000-0000-0000-0000-000000000002', 'text', 'before clear', now() - interval '1 minute');

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"61000000-0000-0000-0000-000000000001","role":"authenticated"}', true);
select lives_ok(
  $$ select public.clear_direct_chat_history('62000000-0000-0000-0000-000000000001') $$,
  'an active direct-chat participant can clear their own history'
);
select ok(
  (select cleared_at is not null from public.chat_participants where room_id = '62000000-0000-0000-0000-000000000001' and user_id = '61000000-0000-0000-0000-000000000001'),
  'the clear watermark is stored for the acting participant'
);
select is(
  (select cleared_at from public.chat_participants where room_id = '62000000-0000-0000-0000-000000000001' and user_id = '61000000-0000-0000-0000-000000000002'),
  null::timestamptz,
  'clearing does not modify the other direct-chat participant'
);
select throws_ok(
  $$ update public.chat_participants set cleared_at = now() where room_id = '62000000-0000-0000-0000-000000000001' and user_id = '61000000-0000-0000-0000-000000000002' $$,
  '42501', null,
  'RLS and column privileges prevent a participant from changing another user watermark'
);
select throws_ok(
  $$ select public.clear_direct_chat_history('62000000-0000-0000-0000-000000000002') $$,
  'P0001', 'Only active participants can clear a direct conversation.',
  'group history cannot be cleared through the direct-history RPC'
);
reset role;

select is(
  (select count(*)::integer from public.chat_messages where room_id = '62000000-0000-0000-0000-000000000001'),
  1,
  'the clear operation does not delete shared message records'
);

insert into public.chat_messages (id, room_id, sender_id, message_type, body, created_at)
values
  ('63000000-0000-0000-0000-000000000002', '62000000-0000-0000-0000-000000000001', '61000000-0000-0000-0000-000000000002', 'text', 'after clear', now() + interval '1 minute');

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"61000000-0000-0000-0000-000000000001","role":"authenticated"}', true);
select is(
  (select count(*)::integer from public.chat_messages cm join public.chat_participants cp on cp.room_id = cm.room_id and cp.user_id = auth.uid() where cm.room_id = '62000000-0000-0000-0000-000000000001' and cm.created_at > cp.cleared_at),
  1,
  'the acting participant query cursor exposes only messages after its watermark'
);
reset role;

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"61000000-0000-0000-0000-000000000002","role":"authenticated"}', true);
select is(
  (select count(*)::integer from public.chat_messages cm join public.chat_participants cp on cp.room_id = cm.room_id and cp.user_id = auth.uid() where cm.room_id = '62000000-0000-0000-0000-000000000001' and (cp.cleared_at is null or cm.created_at > cp.cleared_at)),
  2,
  'the other participant still sees the full shared history'
);
select lives_ok(
  $$ select public.clear_direct_chat_history('62000000-0000-0000-0000-000000000001') $$,
  'the other participant can independently clear their own history'
);
reset role;

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"61000000-0000-0000-0000-000000000003","role":"authenticated"}', true);
select throws_ok(
  $$ select public.clear_direct_chat_history('62000000-0000-0000-0000-000000000001') $$,
  'P0001', 'Only active participants can clear a direct conversation.',
  'RLS-backed membership validation rejects outsiders'
);
reset role;

select is(
  (select count(*)::integer from public.chat_messages where room_id = '62000000-0000-0000-0000-000000000001'),
  2,
  'independent clear actions never delete messages for either participant'
);
select * from finish();
rollback;
