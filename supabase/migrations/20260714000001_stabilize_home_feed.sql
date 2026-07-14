-- Keep the home feed semantically stable as a user's personalized cache changes.
-- The previous RPC returned only cached/followed posts, while the mobile
-- fallback returned all visible non-community posts. Creating a post could
-- therefore switch sources and make most of the timeline disappear.

create or replace function public.list_home_feed_v2(
  page_cursor timestamptz default null,
  page_limit integer default 20
)
returns table (
  id uuid,
  author_id uuid,
  kind public.sportz_post_kind,
  sport text,
  body text,
  media_url text,
  media_kind text,
  media_placeholder text,
  media_width integer,
  media_height integer,
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
    join public.posts p on p.id = fi.post_id
    where fi.user_id = (select id from viewer_profile)
      and fi.post_created_at >= now() - public.active_timeline_retention()
      and p.visibility <> 'group'
  ),
  pull_candidates as (
    select p.id as post_id, p.created_at as sort_at
    from public.user_follows f
    join public.posts p on p.author_id = f.following_id
    where f.follower_id = (select id from viewer_profile)
      and not public.profile_uses_push_feed(f.following_id)
      and p.visibility in ('public', 'followers')
      and p.created_at >= now() - public.active_timeline_retention()
  ),
  discovery_candidates as (
    select p.id as post_id, p.created_at as sort_at
    from public.posts p
    where p.visibility <> 'group'
      and p.created_at >= now() - public.active_timeline_retention()
  ),
  candidates as (
    select post_id, max(sort_at) as sort_at
    from (
      select post_id, sort_at from cached_candidates
      union all
      select post_id, sort_at from pull_candidates
      union all
      select post_id, sort_at from discovery_candidates
    ) feed_union
    group by post_id
  ),
  paged_candidates as (
    select post_id, sort_at
    from candidates
    where page_cursor is null or sort_at < page_cursor
    order by sort_at desc
    limit least(greatest(page_limit, 1), 50)
  ),
  share_counts as (
    select ps.post_id, count(*)::integer as count
    from public.post_shares ps
    where ps.post_id in (select post_id from paged_candidates)
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
    p.media_placeholder,
    p.media_width,
    p.media_height,
    p.stats_line,
    p.visibility,
    p.created_at,
    pr.display_name,
    pr.username,
    pr.avatar_url,
    p.likes_count,
    p.comments_count,
    coalesce(share_counts.count, 0) as shares_count
  from paged_candidates c
  join public.posts p on p.id = c.post_id
  join public.profiles pr on pr.id = p.author_id
  left join share_counts on share_counts.post_id = p.id
  order by c.sort_at desc;
$$;

-- Repair the original endpoint for already-released clients as well.
create or replace function public.list_home_feed(
  page_cursor timestamptz default null,
  page_limit integer default 20
)
returns table (
  id uuid,
  author_id uuid,
  kind public.sportz_post_kind,
  sport text,
  body text,
  media_url text,
  media_kind text,
  media_placeholder text,
  media_width integer,
  media_height integer,
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
  select *
  from public.list_home_feed_v2(page_cursor, page_limit);
$$;

revoke all on function public.list_home_feed_v2(timestamptz, integer) from public;
revoke all on function public.list_home_feed(timestamptz, integer) from public;

grant execute on function public.list_home_feed_v2(timestamptz, integer) to authenticated;
grant execute on function public.list_home_feed(timestamptz, integer) to authenticated;
