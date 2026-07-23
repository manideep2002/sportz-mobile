begin;

create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;

select plan(9);

insert into auth.users (
  id, instance_id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at
)
values
  (
    '13000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000000',
    'authenticated', 'authenticated', 'cover-owner@example.test', 'test-password', now(),
    '{"provider":"email","providers":["email"]}'::jsonb,
    '{"username":"cover_owner","display_name":"Cover Owner"}'::jsonb, now(), now()
  ),
  (
    '13000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000000',
    'authenticated', 'authenticated', 'cover-follower@example.test', 'test-password', now(),
    '{"provider":"email","providers":["email"]}'::jsonb,
    '{"username":"cover_follower","display_name":"Cover Follower"}'::jsonb, now(), now()
  ),
  (
    '13000000-0000-0000-0000-000000000003', '00000000-0000-0000-0000-000000000000',
    'authenticated', 'authenticated', 'cover-outsider@example.test', 'test-password', now(),
    '{"provider":"email","providers":["email"]}'::jsonb,
    '{"username":"cover_outsider","display_name":"Cover Outsider"}'::jsonb, now(), now()
  )
on conflict (id) do nothing;

update public.profiles
set primary_sport = 'Cricket', sports = array['Cricket', 'Running'], is_private = false
where id = '13000000-0000-0000-0000-000000000001';

select is(
  (select public from storage.buckets where id = 'profile-covers'),
  false,
  'profile covers are stored in a private bucket'
);

set local role authenticated;
select set_config(
  'request.jwt.claims',
  '{"sub":"13000000-0000-0000-0000-000000000003","role":"authenticated"}',
  true
);
select ok(
  public.can_view_profile_cover('13000000-0000-0000-0000-000000000001'),
  'any viewer can request a signed cover for a public profile'
);
reset role;

update public.profiles
set is_private = true,
    cover_url = 'https://example.test/storage/v1/object/public/post-media/legacy.jpg'
where id = '13000000-0000-0000-0000-000000000001';

select is(
  (select cover_url from public.profiles where id = '13000000-0000-0000-0000-000000000001'),
  null::text,
  'making a profile private clears a legacy public cover URL'
);

set local role authenticated;
select set_config(
  'request.jwt.claims',
  '{"sub":"13000000-0000-0000-0000-000000000003","role":"authenticated"}',
  true
);
select isnt(
  public.can_view_profile_cover('13000000-0000-0000-0000-000000000001'),
  true,
  'an outsider cannot request a private profile cover'
);
reset role;

set local role authenticated;
select set_config(
  'request.jwt.claims',
  '{"sub":"13000000-0000-0000-0000-000000000001","role":"authenticated"}',
  true
);
select ok(
  public.can_view_profile_cover('13000000-0000-0000-0000-000000000001'),
  'the owner can request their private cover'
);
reset role;

insert into public.user_follows (follower_id, following_id)
values (
  '13000000-0000-0000-0000-000000000002',
  '13000000-0000-0000-0000-000000000001'
);

set local role authenticated;
select set_config(
  'request.jwt.claims',
  '{"sub":"13000000-0000-0000-0000-000000000002","role":"authenticated"}',
  true
);
select ok(
  public.can_view_profile_cover('13000000-0000-0000-0000-000000000001'),
  'an approved follower can request a private profile cover'
);
reset role;

insert into public.blocks (blocker_id, blocked_id)
values (
  '13000000-0000-0000-0000-000000000001',
  '13000000-0000-0000-0000-000000000002'
);

set local role authenticated;
select set_config(
  'request.jwt.claims',
  '{"sub":"13000000-0000-0000-0000-000000000002","role":"authenticated"}',
  true
);
select isnt(
  public.can_view_profile_cover('13000000-0000-0000-0000-000000000001'),
  true,
  'a block overrides approved-follower cover access'
);

update public.profiles
set display_name = 'Tampered'
where id = '13000000-0000-0000-0000-000000000001';
reset role;

select is(
  (select display_name from public.profiles where id = '13000000-0000-0000-0000-000000000001'),
  'Cover Owner',
  'profile RLS rejects updates from a different user'
);

select throws_ok(
  $$
    update public.profiles
    set sports = array['Running']
    where id = '13000000-0000-0000-0000-000000000001'
  $$,
  '23514',
  'the database rejects sports that omit the primary sport'
);

select * from finish();
rollback;
