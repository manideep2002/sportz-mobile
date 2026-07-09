create extension if not exists "pgcrypto";

create or replace function public.uuid_generate_v7()
returns uuid
language plpgsql
volatile
as $$
declare
  unix_ts_ms bigint;
  ts_hex text;
  rand_hex text;
  variant_nibble text;
begin
  unix_ts_ms := floor(extract(epoch from clock_timestamp()) * 1000)::bigint;
  ts_hex := right(lpad(to_hex(unix_ts_ms), 12, '0'), 12);
  rand_hex := encode(gen_random_bytes(9), 'hex');
  variant_nibble := substr('89ab', (get_byte(gen_random_bytes(1), 0) % 4) + 1, 1);

  return (
    substr(ts_hex, 1, 8) || '-' ||
    substr(ts_hex, 9, 4) || '-' ||
    '7' || substr(rand_hex, 1, 3) || '-' ||
    variant_nibble || substr(rand_hex, 4, 3) || '-' ||
    substr(rand_hex, 7, 12)
  )::uuid;
end;
$$;

grant execute on function public.uuid_generate_v7() to anon, authenticated, service_role;

do $$
declare
  target_table text;
begin
  foreach target_table in array array[
    'follows',
    'follow_requests',
    'blocks',
    'reports',
    'stories',
    'posts',
    'comments',
    'likes',
    'courts',
    'court_bookings',
    'sport_events',
    'event_attendees',
    'event_waitlist',
    'event_messages',
    'communities',
    'community_invites',
    'conversations',
    'messages',
    'notifications',
    'saved_posts',
    'post_shares',
    'story_reactions',
    'story_replies',
    'push_tokens',
    'feed_fanout_jobs'
  ]
  loop
    if exists (
      select 1
      from information_schema.columns
      where table_schema = 'public'
        and table_name = target_table
        and column_name = 'id'
        and data_type = 'uuid'
    ) then
      execute format('alter table public.%I alter column id set default public.uuid_generate_v7()', target_table);
    end if;
  end loop;
end $$;
