begin;

create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions, pgtap;

select plan(5);

insert into auth.users (
  id, instance_id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at
)
values
  (
    '13000000-0000-0000-0000-000000000009', '00000000-0000-0000-0000-000000000000',
    'authenticated', 'authenticated', 'cover-organizer@example.test', 'test-password', now(),
    '{"provider":"email","providers":["email"]}'::jsonb,
    '{"username":"cover_organizer","display_name":"Cover Organizer"}'::jsonb, now(), now()
  )
on conflict (id) do nothing;

insert into storage.objects (
  id, bucket_id, name, owner, created_at, updated_at, last_accessed_at, metadata
)
values
  (
    '20000000-0000-0000-0000-000000000001', 'event-covers',
    '13000000-0000-0000-0000-000000000009/orphan-a.jpg',
    '13000000-0000-0000-0000-000000000009',
    now() - interval '2 days', now() - interval '2 days', now() - interval '2 days',
    '{"size":1000,"mimetype":"image/jpeg"}'::jsonb
  ),
  (
    '20000000-0000-0000-0000-000000000002', 'event-covers',
    '13000000-0000-0000-0000-000000000009/attached.jpg',
    '13000000-0000-0000-0000-000000000009',
    now() - interval '2 days', now() - interval '2 days', now() - interval '2 days',
    '{"size":1000,"mimetype":"image/jpeg"}'::jsonb
  ),
  (
    '20000000-0000-0000-0000-000000000003', 'event-covers',
    '13000000-0000-0000-0000-000000000009/fresh.jpg',
    '13000000-0000-0000-0000-000000000009',
    now() - interval '1 hour', now() - interval '1 hour', now() - interval '1 hour',
    '{"size":1000,"mimetype":"image/jpeg"}'::jsonb
  )
on conflict (id) do nothing;

insert into public.sport_events (
  organizer_id, title, sport, starts_at, ends_at, location_name, cover_url
)
values
  (
    '13000000-0000-0000-0000-000000000009', 'Sweeper Match', 'Cricket',
    now() + interval '1 day', now() + interval '2 days', 'Central Park',
    'https://example.supabase.co/storage/v1/object/public/event-covers/13000000-0000-0000-0000-000000000009/attached.jpg'
  );

select is(
  (select public.sweep_orphan_event_covers()),
  1,
  'the sweep removes only the stale unreferenced cover'
);

select is(
  (select count(*) from storage.objects where bucket_id = 'event-covers'),
  2,
  'referenced and young covers survive the sweep'
);

select is(
  (select count(*) from storage.objects where name like '%/attached.jpg'),
  1,
  'an event-attached cover is never removed'
);

select is(
  (select public.sweep_orphan_event_covers(0)),
  1,
  'a zero-age sweep removes the remaining unreferenced cover but keeps the attached one'
);

select is(
  (select tgenabled from pg_trigger where tgname = 'protect_objects_delete'),
  'O',
  'the storage delete guard trigger is re-enabled after the sweep'
);

select * from finish();
rollback;
