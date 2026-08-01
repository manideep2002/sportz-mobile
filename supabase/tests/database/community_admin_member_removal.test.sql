begin;
create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions, pgtap;
select plan(11);

insert into auth.users (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
values
  ('71000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'community-owner@test', 'x', now(), '{}', '{}', now(), now()),
  ('71000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'community-admin@test', 'x', now(), '{}', '{}', now(), now()),
  ('71000000-0000-0000-0000-000000000003', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'target-admin@test', 'x', now(), '{}', '{}', now(), now()),
  ('71000000-0000-0000-0000-000000000004', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'target-member@test', 'x', now(), '{}', '{}', now(), now()),
  ('71000000-0000-0000-0000-000000000005', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'target-follower@test', 'x', now(), '{}', '{}', now(), now()),
  ('71000000-0000-0000-0000-000000000006', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'ordinary-member@test', 'x', now(), '{}', '{}', now(), now())
on conflict (id) do nothing;

insert into public.communities (id, type, name, slug, sport, is_private, created_by)
values ('72000000-0000-0000-0000-000000000001', 'group', 'Removal test', 'removal-test', 'Cricket', false, '71000000-0000-0000-0000-000000000001');

insert into public.community_members (community_id, user_id, role)
values
  ('72000000-0000-0000-0000-000000000001', '71000000-0000-0000-0000-000000000001', 'owner'),
  ('72000000-0000-0000-0000-000000000001', '71000000-0000-0000-0000-000000000002', 'admin'),
  ('72000000-0000-0000-0000-000000000001', '71000000-0000-0000-0000-000000000003', 'admin'),
  ('72000000-0000-0000-0000-000000000001', '71000000-0000-0000-0000-000000000004', 'member'),
  ('72000000-0000-0000-0000-000000000001', '71000000-0000-0000-0000-000000000005', 'follower'),
  ('72000000-0000-0000-0000-000000000001', '71000000-0000-0000-0000-000000000006', 'member');

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"71000000-0000-0000-0000-000000000002","role":"authenticated"}', true);
select lives_ok(
  $$ select public.remove_community_member('72000000-0000-0000-0000-000000000001', '71000000-0000-0000-0000-000000000004') $$,
  'an administrator can remove an ordinary member'
);
select is(
  (select count(*)::integer from public.community_members where community_id = '72000000-0000-0000-0000-000000000001' and user_id = '71000000-0000-0000-0000-000000000004'),
  0,
  'the target membership is deleted'
);
select lives_ok(
  $$ select public.remove_community_member('72000000-0000-0000-0000-000000000001', '71000000-0000-0000-0000-000000000005') $$,
  'an administrator can remove a follower'
);
select throws_ok(
  $$ select public.remove_community_member('72000000-0000-0000-0000-000000000001', '71000000-0000-0000-0000-000000000003') $$,
  'P0001', 'Only an owner can remove another administrator.',
  'an administrator cannot remove another administrator'
);
select throws_ok(
  $$ select public.remove_community_member('72000000-0000-0000-0000-000000000001', '71000000-0000-0000-0000-000000000001') $$,
  'P0001', 'An owner cannot be removed. Transfer ownership first.',
  'an administrator cannot remove the owner'
);
reset role;

select is(
  (select count(*)::integer from public.community_admin_audit_log where community_id = '72000000-0000-0000-0000-000000000001' and actor_id = '71000000-0000-0000-0000-000000000002' and action = 'member_removed'),
  2,
  'administrator removals emit audit entries'
);

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"71000000-0000-0000-0000-000000000006","role":"authenticated"}', true);
select throws_ok(
  $$ select public.remove_community_member('72000000-0000-0000-0000-000000000001', '71000000-0000-0000-0000-000000000003') $$,
  'P0001', 'Only community administrators can remove members.',
  'an ordinary member cannot remove another member'
);
reset role;

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"71000000-0000-0000-0000-000000000001","role":"authenticated"}', true);
select lives_ok(
  $$ select public.remove_community_member('72000000-0000-0000-0000-000000000001', '71000000-0000-0000-0000-000000000003') $$,
  'the owner can remove an administrator'
);
select throws_ok(
  $$ select public.remove_community_member('72000000-0000-0000-0000-000000000001', '71000000-0000-0000-0000-000000000001') $$,
  'P0001', 'Transfer ownership before leaving this community.',
  'the final owner cannot remove themselves'
);
reset role;

select is(
  (select metadata->>'targetRole' from public.community_admin_audit_log where community_id = '72000000-0000-0000-0000-000000000001' and target_user_id = '71000000-0000-0000-0000-000000000003' order by created_at desc limit 1),
  'admin',
  'the audit event records the removed target role'
);
select is(
  (select count(*)::integer from public.community_members where community_id = '72000000-0000-0000-0000-000000000001' and role = 'owner'),
  1,
  'the community retains its final owner'
);

select * from finish();
rollback;
