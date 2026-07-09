alter table public.profiles
  add column if not exists feed_delivery_mode text not null default 'auto'
  check (feed_delivery_mode in ('auto', 'push', 'pull'));

create table if not exists public.feed_items (
  user_id uuid not null references public.profiles(id) on delete cascade,
  post_id uuid not null references public.posts(id) on delete cascade,
  author_id uuid not null references public.profiles(id) on delete cascade,
  post_created_at timestamptz not null,
  source text not null default 'push' check (source in ('self', 'push', 'backfill')),
  inserted_at timestamptz not null default now(),
  primary key (user_id, post_id)
);

create table if not exists public.feed_fanout_jobs (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references public.posts(id) on delete cascade,
  author_id uuid not null references public.profiles(id) on delete cascade,
  status text not null default 'pending' check (status in ('pending', 'processing', 'done', 'failed', 'skipped')),
  attempts integer not null default 0,
  last_error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  started_at timestamptz,
  finished_at timestamptz,
  constraint feed_fanout_jobs_post_unique unique (post_id)
);

create index if not exists feed_items_user_created_idx
  on public.feed_items(user_id, post_created_at desc, post_id desc);

create index if not exists feed_items_author_idx
  on public.feed_items(author_id, post_created_at desc);

create index if not exists feed_items_post_idx
  on public.feed_items(post_id);

create index if not exists feed_fanout_jobs_status_created_idx
  on public.feed_fanout_jobs(status, created_at)
  where status in ('pending', 'failed');

alter table public.feed_items enable row level security;
alter table public.feed_fanout_jobs enable row level security;

drop policy if exists "users read own feed items" on public.feed_items;
create policy "users read own feed items" on public.feed_items
  for select using (auth.uid() = user_id);

create or replace function public.feed_fanout_follower_threshold()
returns integer
language sql
immutable
as $$
  select 50000;
$$;

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

  select count(*)
  into follower_count
  from public.follows f
  where f.following_id = profile_id;

  return follower_count <= public.feed_fanout_follower_threshold();
end;
$$;

create or replace function public.enqueue_home_feed_fanout()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.visibility not in ('public', 'followers') then
    return new;
  end if;

  insert into public.feed_items (user_id, post_id, author_id, post_created_at, source)
  values (new.author_id, new.id, new.author_id, new.created_at, 'self')
  on conflict (user_id, post_id) do nothing;

  if public.profile_uses_push_feed(new.author_id) then
    insert into public.feed_fanout_jobs (post_id, author_id, status)
    values (new.id, new.author_id, 'pending')
    on conflict (post_id) do update
      set status = 'pending',
          attempts = 0,
          last_error = null,
          updated_at = now(),
          started_at = null,
          finished_at = null;
  end if;

  return new;
end;
$$;

drop trigger if exists posts_enqueue_home_feed_fanout on public.posts;
create trigger posts_enqueue_home_feed_fanout
after insert on public.posts
for each row execute function public.enqueue_home_feed_fanout();

create or replace function public.backfill_home_feed_for_follow()
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

drop trigger if exists follows_backfill_home_feed on public.follows;
create trigger follows_backfill_home_feed
after insert on public.follows
for each row execute function public.backfill_home_feed_for_follow();

create or replace function public.remove_home_feed_for_unfollow()
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

drop trigger if exists follows_remove_home_feed on public.follows;
create trigger follows_remove_home_feed
after delete on public.follows
for each row execute function public.remove_home_feed_for_unfollow();

create or replace function public.claim_feed_fanout_jobs(job_limit integer default 20)
returns table (
  id uuid,
  post_id uuid,
  author_id uuid,
  post_created_at timestamptz
)
language sql
security definer
set search_path = public
as $$
  with claimed as (
    select j.id
    from public.feed_fanout_jobs j
    where j.status in ('pending', 'failed')
      and j.attempts < 5
    order by j.created_at
    limit least(greatest(job_limit, 1), 100)
    for update skip locked
  ),
  updated as (
    update public.feed_fanout_jobs j
    set status = 'processing',
        attempts = j.attempts + 1,
        started_at = now(),
        updated_at = now(),
        last_error = null
    from claimed
    where j.id = claimed.id
    returning j.id, j.post_id, j.author_id
  )
  select updated.id, updated.post_id, updated.author_id, p.created_at as post_created_at
  from updated
  join public.posts p on p.id = updated.post_id;
$$;

create or replace function public.complete_feed_fanout_job(job_id uuid, job_error text default null)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.feed_fanout_jobs
  set status = case when job_error is null then 'done' else 'failed' end,
      last_error = job_error,
      updated_at = now(),
      finished_at = case when job_error is null then now() else finished_at end
  where id = job_id;
end;
$$;

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
    from public.follows f
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
  like_counts as (
    select l.entity_id as post_id, count(*)::integer as count
    from public.likes l
    where l.entity_type = 'post'
      and l.entity_id in (select post_id from candidates)
    group by l.entity_id
  ),
  comment_counts as (
    select c.post_id, count(*)::integer as count
    from public.comments c
    where c.post_id in (select post_id from candidates)
    group by c.post_id
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
    coalesce(like_counts.count, 0) as likes_count,
    coalesce(comment_counts.count, 0) as comments_count,
    coalesce(share_counts.count, 0) as shares_count
  from candidates c
  join public.posts p on p.id = c.post_id
  join public.profiles pr on pr.id = p.author_id
  left join like_counts on like_counts.post_id = p.id
  left join comment_counts on comment_counts.post_id = p.id
  left join share_counts on share_counts.post_id = p.id
  where page_cursor is null or c.sort_at < page_cursor
  order by c.sort_at desc
  limit least(greatest(page_limit, 1), 50);
$$;

revoke all on function public.profile_uses_push_feed(uuid) from public;
revoke all on function public.claim_feed_fanout_jobs(integer) from public;
revoke all on function public.complete_feed_fanout_job(uuid, text) from public;
revoke all on function public.list_home_feed(timestamptz, integer) from public;

grant execute on function public.profile_uses_push_feed(uuid) to authenticated, service_role;
grant execute on function public.claim_feed_fanout_jobs(integer) to service_role;
grant execute on function public.complete_feed_fanout_job(uuid, text) to service_role;
grant execute on function public.list_home_feed(timestamptz, integer) to authenticated;
