begin;

create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions, pgtap;

select plan(4);

insert into auth.users (
  id, instance_id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at
)
values
  (
    '14000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000000',
    'authenticated', 'authenticated', 'group-owner@example.test', 'test-password', now(),
    '{"provider":"email","providers":["email"]}'::jsonb,
    '{"username":"group_owner","display_name":"Group Owner"}'::jsonb, now(), now()
  ),
  (
    '14000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000000',
    'authenticated', 'authenticated', 'group-member@example.test', 'test-password', now(),
    '{"provider":"email","providers":["email"]}'::jsonb,
    '{"username":"group_member","display_name":"Group Member"}'::jsonb, now(), now()
  ),
  (
    '14000000-0000-0000-0000-000000000003', '00000000-0000-0000-0000-000000000000',
    'authenticated', 'authenticated', 'group-outsider@example.test', 'test-password', now(),
    '{"provider":"email","providers":["email"]}'::jsonb,
    '{"username":"group_outsider","display_name":"Group Outsider"}'::jsonb, now(), now()
  )
on conflict (id) do nothing;

insert into public.communities (id, type, name, slug, sport, is_private, created_by)
values (
  '24000000-0000-0000-0000-000000000001',
  'group',
  'Private pagination group',
  'private-pagination-group',
  'Basketball',
  true,
  '14000000-0000-0000-0000-000000000001'
);

insert into public.community_members (community_id, user_id, role)
values
  ('24000000-0000-0000-0000-000000000001', '14000000-0000-0000-0000-000000000001', 'owner'),
  ('24000000-0000-0000-0000-000000000001', '14000000-0000-0000-0000-000000000002', 'member');

insert into public.posts (id, author_id, community_id, kind, sport, body, visibility)
values (
  '34000000-0000-0000-0000-000000000001',
  '14000000-0000-0000-0000-000000000001',
  '24000000-0000-0000-0000-000000000001',
  'post',
  'Basketball',
  'Private group post',
  'group'
);

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"14000000-0000-0000-0000-000000000002","role":"authenticated"}', true);
select is(
  (select count(*)::integer from public.posts where id = '34000000-0000-0000-0000-000000000001'),
  1,
  'a private group member can paginate group posts'
);
reset role;

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"14000000-0000-0000-0000-000000000003","role":"authenticated"}', true);
select is(
  (select count(*)::integer from public.posts where id = '34000000-0000-0000-0000-000000000001'),
  0,
  'a non-member cannot load private group posts'
);
reset role;

insert into public.blocks (blocker_id, blocked_id)
values ('14000000-0000-0000-0000-000000000001', '14000000-0000-0000-0000-000000000002');

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"14000000-0000-0000-0000-000000000002","role":"authenticated"}', true);
select is(
  (select count(*)::integer from public.posts where id = '34000000-0000-0000-0000-000000000001'),
  0,
  'a block hides the author posts even from a private group member'
);
reset role;

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"14000000-0000-0000-0000-000000000001","role":"authenticated"}', true);
select is(
  (select count(*)::integer from public.posts where id = '34000000-0000-0000-0000-000000000001'),
  1,
  'the author retains access to their own post'
);
reset role;

select * from finish();
rollback;
