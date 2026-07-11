-- Resilient social interactions:
-- - compact interaction tables with cached counters
-- - durable PGMQ queue handoff
-- - delayed notification bundle state for the process-social-events Edge Function

create extension if not exists pgmq;
create extension if not exists pg_net;

alter table public.posts
  add column if not exists likes_count integer not null default 0,
  add column if not exists comments_count integer not null default 0;

alter table public.profiles
  add column if not exists followers_count integer not null default 0,
  add column if not exists following_count integer not null default 0,
  add column if not exists posts_count integer not null default 0;

create table if not exists public.post_likes (
  user_id uuid not null references public.profiles(id) on delete cascade,
  post_id uuid not null references public.posts(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, post_id)
);

create table if not exists public.post_comments (
  id uuid primary key default public.uuid_generate_v7(),
  post_id uuid not null references public.posts(id) on delete cascade,
  author_id uuid not null references public.profiles(id) on delete cascade,
  parent_id uuid,
  body text not null check (char_length(body) between 1 and 1500),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, post_id)
);

create table if not exists public.user_follows (
  follower_id uuid not null references public.profiles(id) on delete cascade,
  following_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  constraint user_follows_no_self_follow check (follower_id <> following_id),
  primary key (follower_id, following_id)
);

insert into public.post_likes (user_id, post_id, created_at)
select l.user_id, l.entity_id, l.created_at
from public.likes l
join public.posts p on p.id = l.entity_id
where l.entity_type = 'post'
on conflict (user_id, post_id) do nothing;

insert into public.post_comments (id, post_id, author_id, parent_id, body, created_at, updated_at)
select c.id, c.post_id, c.author_id, c.parent_comment_id, c.body, c.created_at, c.updated_at
from public.comments c
on conflict (id) do nothing;

update public.post_comments c
set parent_id = null
where c.parent_id is not null
  and not exists (
    select 1
    from public.post_comments parent
    where parent.id = c.parent_id
      and parent.post_id = c.post_id
  );

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'post_comments_parent_same_post_fk'
      and conrelid = 'public.post_comments'::regclass
  ) then
    alter table public.post_comments
      add constraint post_comments_parent_same_post_fk
      foreign key (parent_id, post_id)
      references public.post_comments(id, post_id)
      on delete cascade;
  end if;
end $$;

insert into public.user_follows (follower_id, following_id, created_at)
select f.follower_id, f.following_id, f.created_at
from public.follows f
on conflict (follower_id, following_id) do nothing;

create index if not exists post_likes_post_created_idx
  on public.post_likes(post_id, created_at desc, user_id);

create index if not exists post_comments_post_parent_created_idx
  on public.post_comments(post_id, parent_id, created_at, id);

create index if not exists post_comments_parent_created_idx
  on public.post_comments(parent_id, created_at, id)
  where parent_id is not null;

create index if not exists post_comments_author_created_idx
  on public.post_comments(author_id, created_at desc);

create index if not exists user_follows_following_created_idx
  on public.user_follows(following_id, created_at desc, follower_id);

create index if not exists user_follows_follower_created_idx
  on public.user_follows(follower_id, created_at desc, following_id);

alter table public.post_likes enable row level security;
alter table public.post_comments enable row level security;
alter table public.user_follows enable row level security;

drop policy if exists "post likes readable" on public.post_likes;
create policy "post likes readable" on public.post_likes
  for select using (true);

drop policy if exists "users insert own post likes" on public.post_likes;
create policy "users insert own post likes" on public.post_likes
  for insert with check (auth.uid() = user_id);

drop policy if exists "users delete own post likes" on public.post_likes;
create policy "users delete own post likes" on public.post_likes
  for delete using (auth.uid() = user_id);

drop policy if exists "post comments readable" on public.post_comments;
create policy "post comments readable" on public.post_comments
  for select using (true);

drop policy if exists "users insert own post comments" on public.post_comments;
create policy "users insert own post comments" on public.post_comments
  for insert with check (
    auth.uid() = author_id
    and exists (select 1 from public.posts p where p.id = post_id)
  );

drop policy if exists "users update own post comments" on public.post_comments;
create policy "users update own post comments" on public.post_comments
  for update using (auth.uid() = author_id) with check (auth.uid() = author_id);

drop policy if exists "users delete own post comments" on public.post_comments;
create policy "users delete own post comments" on public.post_comments
  for delete using (auth.uid() = author_id);

drop policy if exists "user follows readable" on public.user_follows;
create policy "user follows readable" on public.user_follows
  for select using (true);

drop policy if exists "users insert public user follows" on public.user_follows;
create policy "users insert public user follows" on public.user_follows
  for insert with check (
    auth.uid() = follower_id
    and follower_id <> following_id
    and exists (
      select 1
      from public.profiles p
      where p.id = following_id
        and coalesce(p.is_private, false) = false
    )
  );

drop policy if exists "users delete own user follows" on public.user_follows;
create policy "users delete own user follows" on public.user_follows
  for delete using (auth.uid() in (follower_id, following_id));

grant select on public.post_likes, public.post_comments, public.user_follows to anon, authenticated;
grant insert, update, delete on public.post_comments to authenticated;
grant insert, delete on public.post_likes, public.user_follows to authenticated;

do $$
begin
  if not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'post_likes'
  ) then
    execute 'alter publication supabase_realtime add table public.post_likes';
  end if;

  if not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'post_comments'
  ) then
    execute 'alter publication supabase_realtime add table public.post_comments';
  end if;
exception
  when undefined_object then
    null;
end $$;

create or replace function public.set_post_comments_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists post_comments_set_updated_at on public.post_comments;
create trigger post_comments_set_updated_at
before update on public.post_comments
for each row execute function public.set_post_comments_updated_at();

create or replace function public.reset_social_counters()
returns void
language sql
security definer
set search_path = public
as $$
  update public.posts p
  set likes_count = coalesce(l.count, 0),
      comments_count = coalesce(c.count, 0)
  from (
    select p0.id
    from public.posts p0
  ) base
  left join (
    select post_id, count(*)::integer as count
    from public.post_likes
    group by post_id
  ) l on l.post_id = base.id
  left join (
    select post_id, count(*)::integer as count
    from public.post_comments
    group by post_id
  ) c on c.post_id = base.id
  where p.id = base.id;

  update public.profiles pr
  set followers_count = coalesce(followers.count, 0),
      following_count = coalesce(following.count, 0),
      posts_count = coalesce(posts.count, 0)
  from (
    select p0.id
    from public.profiles p0
  ) base
  left join (
    select following_id, count(*)::integer as count
    from public.user_follows
    group by following_id
  ) followers on followers.following_id = base.id
  left join (
    select follower_id, count(*)::integer as count
    from public.user_follows
    group by follower_id
  ) following on following.follower_id = base.id
  left join (
    select author_id, count(*)::integer as count
    from public.posts
    group by author_id
  ) posts on posts.author_id = base.id
  where pr.id = base.id;
$$;

select public.reset_social_counters();

create or replace function public.adjust_post_likes_count()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'INSERT' then
    update public.posts
    set likes_count = likes_count + 1
    where id = new.post_id;
    return new;
  elsif tg_op = 'DELETE' then
    update public.posts
    set likes_count = greatest(likes_count - 1, 0)
    where id = old.post_id;
    return old;
  end if;

  return null;
end;
$$;

drop trigger if exists post_likes_adjust_count on public.post_likes;
create trigger post_likes_adjust_count
after insert or delete on public.post_likes
for each row execute function public.adjust_post_likes_count();

create or replace function public.adjust_post_comments_count()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'INSERT' then
    update public.posts
    set comments_count = comments_count + 1
    where id = new.post_id;
    return new;
  elsif tg_op = 'DELETE' then
    update public.posts
    set comments_count = greatest(comments_count - 1, 0)
    where id = old.post_id;
    return old;
  end if;

  return null;
end;
$$;

drop trigger if exists post_comments_adjust_count on public.post_comments;
create trigger post_comments_adjust_count
after insert or delete on public.post_comments
for each row execute function public.adjust_post_comments_count();

create or replace function public.adjust_user_follows_count()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'INSERT' then
    update public.profiles
    set following_count = following_count + 1
    where id = new.follower_id;

    update public.profiles
    set followers_count = followers_count + 1
    where id = new.following_id;

    return new;
  elsif tg_op = 'DELETE' then
    update public.profiles
    set following_count = greatest(following_count - 1, 0)
    where id = old.follower_id;

    update public.profiles
    set followers_count = greatest(followers_count - 1, 0)
    where id = old.following_id;

    return old;
  end if;

  return null;
end;
$$;

drop trigger if exists user_follows_adjust_count on public.user_follows;
create trigger user_follows_adjust_count
after insert or delete on public.user_follows
for each row execute function public.adjust_user_follows_count();

create or replace function public.adjust_profile_posts_count()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'INSERT' then
    update public.profiles
    set posts_count = posts_count + 1
    where id = new.author_id;
    return new;
  elsif tg_op = 'DELETE' then
    update public.profiles
    set posts_count = greatest(posts_count - 1, 0)
    where id = old.author_id;
    return old;
  end if;

  return null;
end;
$$;

drop trigger if exists posts_adjust_profile_count on public.posts;
create trigger posts_adjust_profile_count
after insert or delete on public.posts
for each row execute function public.adjust_profile_posts_count();

create or replace view public.feed_posts as
select
  p.id,
  p.author_id,
  p.community_id,
  p.kind,
  p.sport,
  p.body,
  p.media_url,
  p.media_kind,
  p.stats_line,
  p.visibility,
  p.created_at,
  p.updated_at,
  pr.display_name,
  pr.username,
  pr.avatar_url,
  p.likes_count,
  p.comments_count,
  coalesce(share_counts.shares_count, 0) as shares_count
from public.posts p
join public.profiles pr on pr.id = p.author_id
left join (
  select post_id, count(*)::integer as shares_count
  from public.post_shares
  group by post_id
) share_counts on share_counts.post_id = p.id;

create or replace function public.profile_uses_push_feed(profile_id uuid)
returns boolean
language plpgsql
security definer
set search_path = public
stable
as $$
declare
  delivery_mode text;
  follower_count integer;
begin
  select p.feed_delivery_mode
  into delivery_mode
  from public.profiles p
  where p.id = profile_id;

  if delivery_mode = 'push' then
    return true;
  end if;

  if delivery_mode = 'pull' then
    return false;
  end if;

  select followers_count
  into follower_count
  from public.profiles
  where id = profile_id;

  return coalesce(follower_count, 0) <= public.feed_fanout_follower_threshold();
end;
$$;

create or replace function public.backfill_home_feed_for_user_follow()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if public.profile_uses_push_feed(new.following_id) then
    insert into public.feed_items (user_id, post_id, author_id, post_created_at, source)
    select new.follower_id, recent_posts.id, recent_posts.author_id, recent_posts.created_at, 'backfill'
    from (
      select p.id, p.author_id, p.created_at
      from public.posts p
      where p.author_id = new.following_id
        and p.visibility in ('public', 'followers')
      order by p.created_at desc
      limit 100
    ) recent_posts
    on conflict (user_id, post_id) do nothing;
  end if;

  return new;
end;
$$;

drop trigger if exists user_follows_backfill_home_feed on public.user_follows;
create trigger user_follows_backfill_home_feed
after insert on public.user_follows
for each row execute function public.backfill_home_feed_for_user_follow();

create or replace function public.remove_home_feed_for_user_unfollow()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  delete from public.feed_items
  where user_id = old.follower_id
    and author_id = old.following_id;

  return old;
end;
$$;

drop trigger if exists user_follows_remove_home_feed on public.user_follows;
create trigger user_follows_remove_home_feed
after delete on public.user_follows
for each row execute function public.remove_home_feed_for_user_unfollow();

create or replace function public.list_home_feed(page_cursor timestamptz default null, page_limit integer default 20)
returns table (
  id uuid,
  author_id uuid,
  kind public.sportz_post_kind,
  sport text,
  body text,
  media_url text,
  media_kind text,
  stats_line text,
  visibility public.sportz_visibility,
  created_at timestamptz,
  display_name text,
  username text,
  avatar_url text,
  likes_count integer,
  comments_count integer,
  shares_count integer
)
language sql
security invoker
set search_path = public
stable
as $$
  with viewer_profile as (
    select auth.uid() as id
  ),
  cached_candidates as (
    select fi.post_id, fi.post_created_at as sort_at
    from public.feed_items fi
    where fi.user_id = (select id from viewer_profile)
  ),
  pull_candidates as (
    select p.id as post_id, p.created_at as sort_at
    from public.user_follows f
    join public.posts p on p.author_id = f.following_id
    where f.follower_id = (select id from viewer_profile)
      and not public.profile_uses_push_feed(f.following_id)
      and p.visibility in ('public', 'followers')
  ),
  candidates as (
    select post_id, max(sort_at) as sort_at
    from (
      select post_id, sort_at from cached_candidates
      union all
      select post_id, sort_at from pull_candidates
    ) feed_union
    group by post_id
  ),
  share_counts as (
    select ps.post_id, count(*)::integer as count
    from public.post_shares ps
    where ps.post_id in (select post_id from candidates)
    group by ps.post_id
  )
  select
    p.id,
    p.author_id,
    p.kind,
    p.sport,
    p.body,
    p.media_url,
    p.media_kind,
    p.stats_line,
    p.visibility,
    p.created_at,
    pr.display_name,
    pr.username,
    pr.avatar_url,
    p.likes_count,
    p.comments_count,
    coalesce(share_counts.count, 0) as shares_count
  from candidates c
  join public.posts p on p.id = c.post_id
  join public.profiles pr on pr.id = p.author_id
  left join share_counts on share_counts.post_id = p.id
  where page_cursor is null or c.sort_at < page_cursor
  order by c.sort_at desc
  limit least(greatest(page_limit, 1), 50);
$$;

revoke all on function public.profile_uses_push_feed(uuid) from public;
revoke all on function public.list_home_feed(timestamptz, integer) from public;
grant execute on function public.profile_uses_push_feed(uuid) to authenticated, service_role;
grant execute on function public.list_home_feed(timestamptz, integer) to authenticated;

create or replace function public.request_or_follow_profile(target_user_id uuid)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  current_user_id uuid := auth.uid();
  target_is_private boolean;
begin
  if current_user_id is null then
    raise exception 'You must be signed in to follow players.';
  end if;

  if target_user_id is null or target_user_id = current_user_id then
    raise exception 'You cannot follow yourself.';
  end if;

  if exists (
    select 1
    from public.blocks b
    where (b.blocker_id = current_user_id and b.blocked_id = target_user_id)
       or (b.blocker_id = target_user_id and b.blocked_id = current_user_id)
  ) then
    raise exception 'You cannot follow this player.';
  end if;

  select coalesce(is_private, false)
  into target_is_private
  from public.profiles
  where id = target_user_id;

  if target_is_private is null then
    raise exception 'Profile not found.';
  end if;

  if target_is_private then
    insert into public.follow_requests (requester_id, target_id, status)
    values (current_user_id, target_user_id, 'pending')
    on conflict (requester_id, target_id)
    do update set status = 'pending', responded_at = null, created_at = now()
    where public.follow_requests.status in ('declined', 'cancelled');

    return 'requested';
  end if;

  insert into public.user_follows (follower_id, following_id)
  values (current_user_id, target_user_id)
  on conflict (follower_id, following_id) do nothing;

  return 'following';
end;
$$;

create or replace function public.respond_to_follow_request(request_id uuid, approve boolean)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  request_row public.follow_requests%rowtype;
begin
  select *
  into request_row
  from public.follow_requests
  where id = request_id
    and target_id = auth.uid()
    and status = 'pending'
  for update;

  if request_row.id is null then
    raise exception 'Follow request not found.';
  end if;

  update public.follow_requests
  set status = case when approve then 'approved' else 'declined' end,
      responded_at = now()
  where id = request_id;

  if approve then
    insert into public.user_follows (follower_id, following_id)
    values (request_row.requester_id, request_row.target_id)
    on conflict (follower_id, following_id) do nothing;
  end if;
end;
$$;

revoke all on function public.request_or_follow_profile(uuid) from public;
revoke all on function public.respond_to_follow_request(uuid, boolean) from public;
grant execute on function public.request_or_follow_profile(uuid) to authenticated;
grant execute on function public.respond_to_follow_request(uuid, boolean) to authenticated;

drop trigger if exists likes_notify_post_author on public.likes;
drop trigger if exists comments_notify_post_author on public.comments;
drop trigger if exists follows_notify_followed_user on public.follows;

do $$
begin
  if to_regclass('pgmq.q_social_events') is null then
    perform pgmq.create('social_events');
  end if;
end $$;

create table if not exists public.social_notification_bundles (
  id uuid primary key default public.uuid_generate_v7(),
  recipient_user_id uuid not null references public.profiles(id) on delete cascade,
  kind public.sportz_notification_kind not null,
  entity_type text not null check (entity_type in ('post', 'profile')),
  entity_id uuid not null,
  aggregate_key text not null,
  actor_id uuid references public.profiles(id) on delete set null,
  actor_ids uuid[] not null default array[]::uuid[],
  actor_count integer not null default 0 check (actor_count >= 0),
  event_count integer not null default 0 check (event_count >= 0),
  post_id uuid references public.posts(id) on delete cascade,
  comment_id uuid,
  parent_comment_id uuid,
  body text,
  data jsonb not null default '{}'::jsonb,
  status text not null default 'pending' check (status in ('pending', 'processing', 'sent', 'failed')),
  attempts integer not null default 0,
  first_event_at timestamptz not null default now(),
  last_event_at timestamptz not null default now(),
  next_flush_at timestamptz not null default now(),
  processing_started_at timestamptz,
  delivered_notification_id uuid references public.notifications(id) on delete set null,
  last_error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists social_notification_bundles_pending_unique_idx
  on public.social_notification_bundles(recipient_user_id, aggregate_key)
  where status = 'pending';

create index if not exists social_notification_bundles_due_idx
  on public.social_notification_bundles(status, next_flush_at)
  where status = 'pending';

create index if not exists social_notification_bundles_recipient_created_idx
  on public.social_notification_bundles(recipient_user_id, created_at desc);

alter table public.social_notification_bundles enable row level security;
revoke all on public.social_notification_bundles from public, anon, authenticated;
grant select, insert, update, delete on public.social_notification_bundles to service_role;

create or replace function public.social_bundle_delay_seconds(
  bundle_kind public.sportz_notification_kind,
  bundle_actor_count integer
)
returns integer
language plpgsql
immutable
as $$
declare
  base_seconds integer;
  tier integer;
begin
  base_seconds := case bundle_kind
    when 'like' then 20
    when 'comment' then 8
    when 'follow' then 15
    else 20
  end;

  tier := floor(ln(greatest(bundle_actor_count, 1)::numeric) / ln(2::numeric));
  return least(300, (base_seconds * power(2, tier))::integer);
end;
$$;

create or replace function public.record_social_notification_event(event_payload jsonb)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  event_kind public.sportz_notification_kind := (event_payload->>'type')::public.sportz_notification_kind;
  event_actor_id uuid := nullif(event_payload->>'actorId', '')::uuid;
  event_recipient_id uuid := nullif(event_payload->>'recipientUserId', '')::uuid;
  event_post_id uuid := nullif(event_payload->>'postId', '')::uuid;
  event_comment_id uuid := nullif(event_payload->>'commentId', '')::uuid;
  event_parent_comment_id uuid := nullif(event_payload->>'parentCommentId', '')::uuid;
  event_entity_type text := coalesce(nullif(event_payload->>'entityType', ''), case when event_kind = 'follow' then 'profile' else 'post' end);
  event_entity_id uuid := nullif(event_payload->>'entityId', '')::uuid;
  event_aggregate_key text := nullif(event_payload->>'aggregateKey', '');
  event_body text := nullif(event_payload->>'body', '');
  event_data jsonb := coalesce(event_payload->'data', '{}'::jsonb);
  existing_bundle public.social_notification_bundles%rowtype;
  next_actor_ids uuid[];
  next_actor_count integer;
  next_event_count integer;
  scheduled_flush_at timestamptz;
  inserted_bundle_id uuid;
begin
  if event_kind not in ('like', 'comment', 'follow') then
    return null;
  end if;

  if event_recipient_id is null or event_actor_id is null or event_recipient_id = event_actor_id then
    return null;
  end if;

  if event_entity_id is null then
    event_entity_id := coalesce(event_post_id, event_actor_id);
  end if;

  if event_aggregate_key is null then
    event_aggregate_key := event_kind::text || ':' || event_entity_type || ':' || event_entity_id::text;
  end if;

  perform pg_advisory_xact_lock(hashtextextended(event_recipient_id::text || ':' || event_aggregate_key, 0));

  select *
  into existing_bundle
  from public.social_notification_bundles
  where recipient_user_id = event_recipient_id
    and aggregate_key = event_aggregate_key
    and status = 'pending'
  order by created_at desc
  limit 1
  for update;

  if existing_bundle.id is not null then
    next_actor_ids := array_prepend(event_actor_id, array_remove(existing_bundle.actor_ids, event_actor_id));
    next_actor_ids := coalesce(next_actor_ids[1:12], array[]::uuid[]);
    next_actor_count := greatest(existing_bundle.actor_count, cardinality(existing_bundle.actor_ids));

    if array_position(existing_bundle.actor_ids, event_actor_id) is null then
      next_actor_count := next_actor_count + 1;
    end if;

    next_event_count := existing_bundle.event_count + 1;
    scheduled_flush_at := now() + make_interval(secs => public.social_bundle_delay_seconds(event_kind, next_actor_count));

    update public.social_notification_bundles
    set actor_id = event_actor_id,
        actor_ids = next_actor_ids,
        actor_count = next_actor_count,
        event_count = next_event_count,
        comment_id = coalesce(event_comment_id, comment_id),
        parent_comment_id = coalesce(event_parent_comment_id, parent_comment_id),
        body = coalesce(event_body, body),
        data = data || event_data || jsonb_strip_nulls(jsonb_build_object(
          'postId', event_post_id::text,
          'commentId', event_comment_id::text,
          'parentCommentId', event_parent_comment_id::text,
          'screen', event_payload->>'screen',
          'type', event_kind::text
        )),
        last_event_at = now(),
        next_flush_at = scheduled_flush_at,
        updated_at = now(),
        last_error = null
    where id = existing_bundle.id;

    return existing_bundle.id;
  end if;

  scheduled_flush_at := now() + make_interval(secs => public.social_bundle_delay_seconds(event_kind, 1));
  inserted_bundle_id := public.uuid_generate_v7();

  insert into public.social_notification_bundles (
    id,
    recipient_user_id,
    kind,
    entity_type,
    entity_id,
    aggregate_key,
    actor_id,
    actor_ids,
    actor_count,
    event_count,
    post_id,
    comment_id,
    parent_comment_id,
    body,
    data,
    first_event_at,
    last_event_at,
    next_flush_at
  )
  values (
    inserted_bundle_id,
    event_recipient_id,
    event_kind,
    event_entity_type,
    event_entity_id,
    event_aggregate_key,
    event_actor_id,
    array[event_actor_id],
    1,
    1,
    event_post_id,
    event_comment_id,
    event_parent_comment_id,
    event_body,
    event_data || jsonb_strip_nulls(jsonb_build_object(
      'postId', event_post_id::text,
      'commentId', event_comment_id::text,
      'parentCommentId', event_parent_comment_id::text,
      'screen', event_payload->>'screen',
      'type', event_kind::text
    )),
    now(),
    now(),
    scheduled_flush_at
  );

  return inserted_bundle_id;
end;
$$;

create or replace function public.record_social_notification_events(event_payloads jsonb)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  event_payload jsonb;
  recorded_count integer := 0;
  bundle_id uuid;
begin
  if jsonb_typeof(event_payloads) <> 'array' then
    raise exception 'event_payloads must be a JSON array';
  end if;

  for event_payload in select value from jsonb_array_elements(event_payloads)
  loop
    bundle_id := public.record_social_notification_event(event_payload);
    if bundle_id is not null then
      recorded_count := recorded_count + 1;
    end if;
  end loop;

  return recorded_count;
end;
$$;

create or replace function public.claim_due_social_notification_bundles(bundle_limit integer default 25)
returns table (
  id uuid,
  recipient_user_id uuid,
  kind public.sportz_notification_kind,
  aggregate_key text,
  actor_count integer,
  event_count integer,
  next_flush_at timestamptz
)
language sql
security definer
set search_path = public
as $$
  with claimed as (
    select b.id
    from public.social_notification_bundles b
    where b.status = 'pending'
      and b.next_flush_at <= now()
      and b.attempts < 5
    order by b.next_flush_at, b.created_at
    limit least(greatest(bundle_limit, 1), 100)
    for update skip locked
  ),
  updated as (
    update public.social_notification_bundles b
    set status = 'processing',
        attempts = b.attempts + 1,
        processing_started_at = now(),
        updated_at = now(),
        last_error = null
    from claimed
    where b.id = claimed.id
    returning b.id, b.recipient_user_id, b.kind, b.aggregate_key, b.actor_count, b.event_count, b.next_flush_at
  )
  select * from updated;
$$;

create or replace function public.complete_social_notification_bundle(bundle_id uuid)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  bundle public.social_notification_bundles%rowtype;
  existing_notification public.notifications%rowtype;
  actor_name text;
  merged_actor_ids uuid[];
  known_actor_count integer;
  existing_unknown_count integer;
  bundle_unknown_count integer;
  next_actor_count integer;
  notification_id uuid;
  notification_body text;
  notification_data jsonb;
begin
  select *
  into bundle
  from public.social_notification_bundles
  where id = bundle_id
    and status = 'processing'
  for update;

  if bundle.id is null then
    return null;
  end if;

  if bundle.recipient_user_id = bundle.actor_id then
    update public.social_notification_bundles
    set status = 'sent',
        updated_at = now()
    where id = bundle.id;

    return null;
  end if;

  select display_name
  into actor_name
  from public.profiles
  where id = bundle.actor_id;

  notification_body := case bundle.kind
    when 'like' then
      case
        when bundle.actor_count > 1 then 'Your SPORTZ post is getting more activity.'
        else 'Your SPORTZ post got a new like.'
      end
    when 'comment' then
      case
        when bundle.event_count > 1 then bundle.event_count::text || ' new comments on your post.'
        else coalesce(nullif(left(bundle.body, 140), ''), 'Your SPORTZ post has a new comment.')
      end
    when 'follow' then
      case
        when bundle.actor_count > 1 then 'You have new followers on SPORTZ.'
        else 'You have a new follower on SPORTZ.'
      end
    else 'Open SPORTZ to see what happened.'
  end;

  notification_data := public.notification_route_payload(bundle.kind, bundle.entity_type, bundle.entity_id)
    || bundle.data
    || jsonb_strip_nulls(jsonb_build_object(
      'type', bundle.kind::text,
      'kind', bundle.kind::text,
      'screen', case when bundle.entity_type = 'post' then '/post/[id]' when bundle.entity_type = 'profile' then '/profile/[id]' else null end,
      'postId', bundle.post_id::text,
      'commentId', bundle.comment_id::text,
      'parentCommentId', bundle.parent_comment_id::text,
      'actorCount', bundle.actor_count,
      'eventCount', bundle.event_count,
      'bundleId', bundle.id::text
    ));

  perform pg_advisory_xact_lock(hashtextextended(bundle.recipient_user_id::text || ':' || bundle.aggregate_key, 0));

  select *
  into existing_notification
  from public.notifications
  where user_id = bundle.recipient_user_id
    and aggregate_key = bundle.aggregate_key
    and is_read = false
  order by created_at desc
  limit 1
  for update;

  if existing_notification.id is not null then
    select coalesce(array_agg(actor_id order by first_seen), array[]::uuid[])
    into merged_actor_ids
    from (
      select actor_id, min(ordinality) as first_seen
      from unnest(bundle.actor_ids || existing_notification.actor_ids) with ordinality as actors(actor_id, ordinality)
      where actor_id is not null
      group by actor_id
      order by min(ordinality)
      limit 12
    ) distinct_actors;

    known_actor_count := coalesce(cardinality(merged_actor_ids), 0);
    existing_unknown_count := greatest(coalesce(existing_notification.actor_count, 0) - coalesce(cardinality(existing_notification.actor_ids), 0), 0);
    bundle_unknown_count := greatest(coalesce(bundle.actor_count, 0) - coalesce(cardinality(bundle.actor_ids), 0), 0);
    next_actor_count := greatest(known_actor_count + existing_unknown_count + bundle_unknown_count, known_actor_count);

    update public.notifications
    set actor_id = coalesce(bundle.actor_id, actor_id),
        actor_ids = merged_actor_ids,
        actor_count = next_actor_count,
        entity_type = bundle.entity_type,
        entity_id = bundle.entity_id,
        title = public.notification_bundle_title(bundle.kind, actor_name, next_actor_count),
        body = notification_body,
        data = data || notification_data || jsonb_build_object('notificationId', id::text),
        last_event_at = greatest(last_event_at, bundle.last_event_at)
    where id = existing_notification.id;

    notification_id := existing_notification.id;
  else
    notification_id := public.uuid_generate_v7();

    insert into public.notifications (
      id,
      user_id,
      actor_id,
      kind,
      title,
      body,
      entity_type,
      entity_id,
      aggregate_key,
      actor_ids,
      actor_count,
      data,
      last_event_at
    )
    values (
      notification_id,
      bundle.recipient_user_id,
      bundle.actor_id,
      bundle.kind,
      public.notification_bundle_title(bundle.kind, actor_name, bundle.actor_count),
      notification_body,
      bundle.entity_type,
      bundle.entity_id,
      bundle.aggregate_key,
      bundle.actor_ids,
      bundle.actor_count,
      notification_data || jsonb_build_object('notificationId', notification_id::text),
      bundle.last_event_at
    );
  end if;

  update public.social_notification_bundles
  set status = 'sent',
      delivered_notification_id = notification_id,
      updated_at = now()
  where id = bundle.id;

  return notification_id;
end;
$$;

create or replace function public.fail_social_notification_bundle(bundle_id uuid, bundle_error text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.social_notification_bundles
  set status = case when attempts >= 5 then 'failed' else 'pending' end,
      next_flush_at = case when attempts >= 5 then next_flush_at else now() + interval '60 seconds' end,
      last_error = left(coalesce(bundle_error, 'Unknown social notification bundle error.'), 2000),
      processing_started_at = null,
      updated_at = now()
  where id = bundle_id
    and status = 'processing';
end;
$$;

create or replace function public.next_social_notification_flush_at()
returns timestamptz
language sql
security definer
set search_path = public
stable
as $$
  select min(next_flush_at)
  from public.social_notification_bundles
  where status = 'pending'
    and attempts < 5;
$$;

create or replace function public.read_social_events_queue(
  batch_size integer default 50,
  visibility_timeout integer default 90
)
returns table (
  msg_id bigint,
  read_ct integer,
  enqueued_at timestamptz,
  vt timestamptz,
  message jsonb
)
language sql
security definer
set search_path = public, pgmq
as $$
  select m.msg_id, m.read_ct, m.enqueued_at, m.vt, m.message
  from pgmq.read(
    'social_events',
    least(greatest(visibility_timeout, 10), 600),
    least(greatest(batch_size, 1), 100)
  ) as m;
$$;

create or replace function public.archive_social_events_queue(message_ids bigint[])
returns integer
language sql
security definer
set search_path = public, pgmq
as $$
  with archived as (
    select pgmq.archive('social_events', coalesce(message_ids, array[]::bigint[]))
  )
  select count(*)::integer from archived;
$$;

create or replace function public.record_social_event_failure(
  message_id bigint,
  message_payload jsonb,
  failure_reason text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  raise warning 'social event message % failed: % payload=%', message_id, failure_reason, message_payload;
end;
$$;

revoke all on function public.record_social_notification_event(jsonb) from public, anon, authenticated;
revoke all on function public.record_social_notification_events(jsonb) from public, anon, authenticated;
revoke all on function public.claim_due_social_notification_bundles(integer) from public, anon, authenticated;
revoke all on function public.complete_social_notification_bundle(uuid) from public, anon, authenticated;
revoke all on function public.fail_social_notification_bundle(uuid, text) from public, anon, authenticated;
revoke all on function public.next_social_notification_flush_at() from public, anon, authenticated;
revoke all on function public.read_social_events_queue(integer, integer) from public, anon, authenticated;
revoke all on function public.archive_social_events_queue(bigint[]) from public, anon, authenticated;
revoke all on function public.record_social_event_failure(bigint, jsonb, text) from public, anon, authenticated;

grant execute on function public.record_social_notification_events(jsonb) to service_role;
grant execute on function public.claim_due_social_notification_bundles(integer) to service_role;
grant execute on function public.complete_social_notification_bundle(uuid) to service_role;
grant execute on function public.fail_social_notification_bundle(uuid, text) to service_role;
grant execute on function public.next_social_notification_flush_at() to service_role;
grant execute on function public.read_social_events_queue(integer, integer) to service_role;
grant execute on function public.archive_social_events_queue(bigint[]) to service_role;
grant execute on function public.record_social_event_failure(bigint, jsonb, text) to service_role;

create or replace function private.dispatch_social_events_webhook()
returns void
language plpgsql
security definer
set search_path = public, private, extensions, net
as $$
declare
  webhook_secret text;
  function_url text;
begin
  select secret_value
  into webhook_secret
  from private.edge_function_secrets
  where name = 'process_social_events_webhook';

  select secret_value
  into function_url
  from private.edge_function_secrets
  where name = 'process_social_events_url';

  function_url := coalesce(
    function_url,
    'https://rvsfmfuooxhopmxdqbao.functions.supabase.co/process-social-events'
  );

  if webhook_secret is null then
    raise warning 'process_social_events_webhook secret is not configured.';
    return;
  end if;

  perform net.http_post(
    url := function_url,
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-supabase-webhook-secret', webhook_secret
    ),
    body := jsonb_build_object(
      'queue', 'social_events',
      'source', 'interaction-trigger'
    ),
    timeout_milliseconds := 1000
  );
end;
$$;

revoke all on function private.dispatch_social_events_webhook() from public, anon, authenticated;

create or replace function private.enqueue_social_interaction_event()
returns trigger
language plpgsql
security definer
set search_path = public, private, pgmq
as $$
declare
  payload jsonb;
  target_user_id uuid;
  actor_user_id uuid;
  target_post public.posts%rowtype;
  inserted_message_id bigint;
begin
  if tg_op <> 'INSERT' then
    return new;
  end if;

  if tg_table_name = 'post_likes' then
    select *
    into target_post
    from public.posts
    where id = new.post_id;

    target_user_id := target_post.author_id;
    actor_user_id := new.user_id;

    payload := jsonb_build_object(
      'eventId', 'like:' || new.user_id::text || ':' || new.post_id::text || ':' || extract(epoch from new.created_at)::text,
      'type', 'like',
      'actorId', actor_user_id::text,
      'recipientUserId', target_user_id::text,
      'entityType', 'post',
      'entityId', new.post_id::text,
      'postId', new.post_id::text,
      'aggregateKey', 'like:post:' || new.post_id::text,
      'screen', '/post/[id]',
      'occurredAt', new.created_at
    );
  elsif tg_table_name = 'post_comments' then
    select *
    into target_post
    from public.posts
    where id = new.post_id;

    target_user_id := target_post.author_id;
    actor_user_id := new.author_id;

    payload := jsonb_build_object(
      'eventId', new.id::text,
      'type', 'comment',
      'actorId', actor_user_id::text,
      'recipientUserId', target_user_id::text,
      'entityType', 'post',
      'entityId', new.post_id::text,
      'postId', new.post_id::text,
      'commentId', new.id::text,
      'parentCommentId', new.parent_id::text,
      'aggregateKey', 'comment:post:' || new.post_id::text,
      'screen', '/post/[id]',
      'body', left(new.body, 180),
      'occurredAt', new.created_at,
      'data', jsonb_strip_nulls(jsonb_build_object(
        'commentId', new.id::text,
        'parentCommentId', new.parent_id::text
      ))
    );
  elsif tg_table_name = 'user_follows' then
    target_user_id := new.following_id;
    actor_user_id := new.follower_id;

    payload := jsonb_build_object(
      'eventId', 'follow:' || new.follower_id::text || ':' || new.following_id::text || ':' || extract(epoch from new.created_at)::text,
      'type', 'follow',
      'actorId', actor_user_id::text,
      'recipientUserId', target_user_id::text,
      'entityType', 'profile',
      'entityId', new.follower_id::text,
      'profileId', new.follower_id::text,
      'aggregateKey', 'follow:user:' || target_user_id::text,
      'screen', '/profile/[id]',
      'occurredAt', new.created_at
    );
  else
    return new;
  end if;

  if target_user_id is null or actor_user_id is null or target_user_id = actor_user_id then
    return new;
  end if;

  select send
  into inserted_message_id
  from pgmq.send('social_events', payload, 0)
  limit 1;

  perform private.dispatch_social_events_webhook();

  return new;
end;
$$;

revoke all on function private.enqueue_social_interaction_event() from public, anon, authenticated;

drop trigger if exists post_likes_enqueue_social_event on public.post_likes;
create trigger post_likes_enqueue_social_event
after insert on public.post_likes
for each row execute function private.enqueue_social_interaction_event();

drop trigger if exists post_comments_enqueue_social_event on public.post_comments;
create trigger post_comments_enqueue_social_event
after insert on public.post_comments
for each row execute function private.enqueue_social_interaction_event();

drop trigger if exists user_follows_enqueue_social_event on public.user_follows;
create trigger user_follows_enqueue_social_event
after insert on public.user_follows
for each row execute function private.enqueue_social_interaction_event();
