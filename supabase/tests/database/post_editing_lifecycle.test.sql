begin;

create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;

select plan(7);

insert into auth.users (
  id, instance_id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at
)
values
  (
    '12000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000000',
    'authenticated', 'authenticated', 'post-author@example.test', 'test-password', now(),
    '{"provider":"email","providers":["email"]}'::jsonb,
    '{"username":"post_author","display_name":"Post Author"}'::jsonb, now(), now()
  ),
  (
    '12000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000000',
    'authenticated', 'authenticated', 'post-outsider@example.test', 'test-password', now(),
    '{"provider":"email","providers":["email"]}'::jsonb,
    '{"username":"post_outsider","display_name":"Post Outsider"}'::jsonb, now(), now()
  )
on conflict (id) do nothing;

insert into public.communities (id, type, name, slug, sport, created_by)
values (
  '22000000-0000-0000-0000-000000000001',
  'group',
  'Post editing test group',
  'post-editing-test-group',
  'Basketball',
  '12000000-0000-0000-0000-000000000001'
);

insert into public.community_members (community_id, user_id, role)
values (
  '22000000-0000-0000-0000-000000000001',
  '12000000-0000-0000-0000-000000000001',
  'owner'
);

insert into public.posts (
  id, author_id, community_id, kind, sport, body, media_url, media_kind,
  media_storage_path, visibility
)
values (
  '32000000-0000-0000-0000-000000000001',
  '12000000-0000-0000-0000-000000000001',
  '22000000-0000-0000-0000-000000000001',
  'post',
  'Basketball',
  'Original body',
  'https://example.test/original.jpg',
  'image',
  '12000000-0000-0000-0000-000000000001/original.jpg',
  'group'
);

set local role authenticated;
select set_config(
  'request.jwt.claims',
  '{"sub":"12000000-0000-0000-0000-000000000001","role":"authenticated"}',
  true
);

select lives_ok(
  $$
    select public.update_post_content(
      '32000000-0000-0000-0000-000000000001', '', 'Basketball', 'highlight',
      null, 'group', 'https://example.test/replacement.mp4', 'video',
      '12000000-0000-0000-0000-000000000001/replacement.mp4', 1280, 720,
      'processing', 'Central Court',
      array['12000000-0000-0000-0000-000000000002'::uuid]
    )
  $$,
  'the author can atomically save a media-only community post'
);

reset role;

select is(
  (select body from public.posts where id = '32000000-0000-0000-0000-000000000001'),
  '',
  'media-only edits keep an empty body'
);
select is(
  (select location_label from public.posts where id = '32000000-0000-0000-0000-000000000001'),
  'Central Court',
  'location context is persisted'
);
select is(
  (select count(*)::integer from public.post_mentions where post_id = '32000000-0000-0000-0000-000000000001'),
  1,
  'mentions are replaced inside the same transaction'
);

set local role authenticated;
select set_config(
  'request.jwt.claims',
  '{"sub":"12000000-0000-0000-0000-000000000001","role":"authenticated"}',
  true
);
select throws_like(
  $$
    select public.update_post_content(
      '32000000-0000-0000-0000-000000000001', 'Public now', 'Basketball', 'post',
      null, 'public', null, 'none', null, null, null, 'ready', null, array[]::uuid[]
    )
  $$,
  '%must remain visible only to its community%',
  'a group post cannot transition to public'
);
reset role;

select is(
  (select visibility::text from public.posts where id = '32000000-0000-0000-0000-000000000001'),
  'group',
  'a rejected visibility edit preserves group visibility'
);

set local role authenticated;
select set_config(
  'request.jwt.claims',
  '{"sub":"12000000-0000-0000-0000-000000000002","role":"authenticated"}',
  true
);
select throws_like(
  $$
    select public.update_post_content(
      '32000000-0000-0000-0000-000000000001', 'Tampered', 'Basketball', 'post',
      null, 'group', null, 'none', null, null, null, 'ready', null, array[]::uuid[]
    )
  $$,
  '%not allowed to edit this post%',
  'a non-author cannot update a post'
);
reset role;

select is(
  (select media_storage_path from public.posts where id = '32000000-0000-0000-0000-000000000001'),
  '12000000-0000-0000-0000-000000000001/replacement.mp4',
  'failed edits preserve the successfully persisted media'
);

select * from finish();
rollback;
