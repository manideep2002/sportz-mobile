create extension if not exists pg_net with schema extensions;

do $$
begin
  execute 'create extension if not exists pg_cron with schema extensions';
exception
  when insufficient_privilege or undefined_file then
    raise notice 'pg_cron is not available; continuing without an in-database cleanup schedule.';
end $$;

alter table public.posts
  add column if not exists media_placeholder text,
  add column if not exists media_storage_path text,
  add column if not exists media_width integer check (media_width is null or media_width > 0),
  add column if not exists media_height integer check (media_height is null or media_height > 0),
  add column if not exists media_processing_status text not null default 'ready'
    check (media_processing_status in ('uploading', 'processing', 'ready', 'failed'));

create index if not exists posts_media_storage_path_idx
  on public.posts(media_storage_path)
  where media_storage_path is not null;

create index if not exists posts_active_timeline_created_idx
  on public.posts(created_at desc, id desc)
  where visibility in ('public', 'followers');

create table if not exists public.post_media_assets (
  id uuid primary key default public.uuid_generate_v7(),
  post_id uuid references public.posts(id) on delete set null,
  owner_id uuid references public.profiles(id) on delete set null,
  bucket_id text not null,
  object_name text not null,
  public_url text not null,
  content_type text,
  media_kind text not null default 'unknown' check (media_kind in ('image', 'video', 'unknown')),
  media_width integer check (media_width is null or media_width > 0),
  media_height integer check (media_height is null or media_height > 0),
  media_placeholder text,
  status text not null default 'processing' check (status in ('processing', 'ready', 'failed')),
  error text,
  finalized_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (bucket_id, object_name)
);

create index if not exists post_media_assets_post_idx
  on public.post_media_assets(post_id)
  where post_id is not null;

create index if not exists post_media_assets_owner_created_idx
  on public.post_media_assets(owner_id, created_at desc)
  where owner_id is not null;

alter table public.post_media_assets enable row level security;

drop policy if exists "post media assets service role full access" on public.post_media_assets;
create policy "post media assets service role full access" on public.post_media_assets
  for all using (auth.role() = 'service_role')
  with check (auth.role() = 'service_role');

revoke all on public.post_media_assets from anon, authenticated;
grant all on public.post_media_assets to service_role;

create or replace function public.set_post_media_assets_updated_at()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists post_media_assets_set_updated_at on public.post_media_assets;
create trigger post_media_assets_set_updated_at
before update on public.post_media_assets
for each row execute function public.set_post_media_assets_updated_at();

create or replace function public.hydrate_post_media_from_asset()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  asset public.post_media_assets%rowtype;
begin
  if new.media_url is null and new.media_storage_path is null then
    return new;
  end if;

  select *
  into asset
  from public.post_media_assets a
  where (a.post_id = new.id)
     or (new.media_storage_path is not null and a.object_name = new.media_storage_path)
     or (new.media_url is not null and a.public_url = new.media_url)
  order by a.finalized_at desc nulls last, a.updated_at desc
  limit 1;

  if asset.id is null then
    return new;
  end if;

  new.media_url := coalesce(new.media_url, asset.public_url);
  new.media_storage_path := coalesce(new.media_storage_path, asset.object_name);
  new.media_placeholder := coalesce(new.media_placeholder, asset.media_placeholder);
  new.media_width := coalesce(new.media_width, asset.media_width);
  new.media_height := coalesce(new.media_height, asset.media_height);
  new.media_processing_status := asset.status;

  return new;
end;
$$;

drop trigger if exists posts_hydrate_media_from_asset on public.posts;
create trigger posts_hydrate_media_from_asset
before insert or update of media_url, media_storage_path, media_placeholder, media_width, media_height, media_processing_status
on public.posts
for each row execute function public.hydrate_post_media_from_asset();

create or replace function public.apply_post_media_asset_to_post()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.posts p
  set media_url = new.public_url,
      media_storage_path = new.object_name,
      media_placeholder = coalesce(new.media_placeholder, p.media_placeholder),
      media_width = coalesce(new.media_width, p.media_width),
      media_height = coalesce(new.media_height, p.media_height),
      media_processing_status = new.status
  where (new.post_id is not null and p.id = new.post_id)
     or (p.media_storage_path = new.object_name)
     or (p.media_url = new.public_url);

  return new;
end;
$$;

drop trigger if exists post_media_assets_apply_to_post on public.post_media_assets;
create trigger post_media_assets_apply_to_post
after insert or update of post_id, public_url, media_placeholder, media_width, media_height, status
on public.post_media_assets
for each row execute function public.apply_post_media_asset_to_post();

drop view if exists public.feed_posts;
create view public.feed_posts as
select
  p.id,
  p.author_id,
  p.community_id,
  p.kind,
  p.sport,
  p.body,
  p.media_url,
  p.media_kind,
  p.media_placeholder,
  p.media_storage_path,
  p.media_width,
  p.media_height,
  p.media_processing_status,
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

create or replace function public.active_timeline_retention()
returns interval
language sql
stable
as $$
  select interval '30 days';
$$;

drop function if exists public.list_home_feed(timestamptz, integer);
create function public.list_home_feed(page_cursor timestamptz default null, page_limit integer default 20)
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
    where fi.user_id = (select id from viewer_profile)
      and fi.post_created_at >= now() - public.active_timeline_retention()
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
  from candidates c
  join public.posts p on p.id = c.post_id
  join public.profiles pr on pr.id = p.author_id
  left join share_counts on share_counts.post_id = p.id
  where page_cursor is null or c.sort_at < page_cursor
  order by c.sort_at desc
  limit least(greatest(page_limit, 1), 50);
$$;

revoke all on function public.active_timeline_retention() from public;
revoke all on function public.list_home_feed(timestamptz, integer) from public;
grant execute on function public.active_timeline_retention() to authenticated, service_role;
grant execute on function public.list_home_feed(timestamptz, integer) to authenticated;

create table if not exists public.feed_items_archive (
  user_id uuid not null,
  post_id uuid not null,
  author_id uuid not null,
  post_created_at timestamptz not null,
  source text not null,
  inserted_at timestamptz not null,
  archived_at timestamptz not null default now(),
  primary key (user_id, post_id)
);

create index if not exists feed_items_archive_post_created_brin
  on public.feed_items_archive using brin(post_created_at);

create index if not exists feed_items_archive_user_created_idx
  on public.feed_items_archive(user_id, post_created_at desc);

alter table public.feed_items_archive enable row level security;

drop policy if exists "feed archive service role full access" on public.feed_items_archive;
create policy "feed archive service role full access" on public.feed_items_archive
  for all using (auth.role() = 'service_role')
  with check (auth.role() = 'service_role');

revoke all on public.feed_items_archive from anon, authenticated;
grant all on public.feed_items_archive to service_role;

create or replace function public.archive_stale_feed_items(
  retention interval default interval '30 days',
  batch_size integer default 50000
)
returns integer
language sql
security definer
set search_path = public
as $$
  with stale as (
    select ctid
    from public.feed_items
    where post_created_at < now() - retention
    order by post_created_at
    limit least(greatest(batch_size, 1), 250000)
  ),
  moved as (
    delete from public.feed_items fi
    using stale
    where fi.ctid = stale.ctid
    returning fi.user_id, fi.post_id, fi.author_id, fi.post_created_at, fi.source, fi.inserted_at
  ),
  archived as (
    insert into public.feed_items_archive (
      user_id,
      post_id,
      author_id,
      post_created_at,
      source,
      inserted_at,
      archived_at
    )
    select user_id, post_id, author_id, post_created_at, source, inserted_at, now()
    from moved
    on conflict (user_id, post_id)
    do update set archived_at = excluded.archived_at
    returning 1
  )
  select count(*)::integer from archived;
$$;

revoke all on function public.archive_stale_feed_items(interval, integer) from public, anon, authenticated;
grant execute on function public.archive_stale_feed_items(interval, integer) to service_role;

do $$
begin
  if exists (
    select 1
    from cron.job
    where jobname = 'archive-stale-feed-items'
  ) then
    perform cron.unschedule('archive-stale-feed-items');
  end if;

  perform cron.schedule(
    'archive-stale-feed-items',
    '17 3 * * *',
    $cron$select public.archive_stale_feed_items(interval '30 days', 100000);$cron$
  );
exception
  when others then
    raise notice 'pg_cron is not available; run select public.archive_stale_feed_items(interval ''30 days'', 100000) from an external scheduler.';
end $$;

create or replace function private.dispatch_storage_object_finalizer()
returns trigger
language plpgsql
security definer
set search_path = public, private, extensions, net
as $$
declare
  webhook_secret text;
  function_url text;
begin
  if new.bucket_id <> 'post-media' or new.name like '__placeholders/%' then
    return new;
  end if;

  select secret_value
  into webhook_secret
  from private.edge_function_secrets
  where name = 'finalize_media_upload_webhook';

  select secret_value
  into function_url
  from private.edge_function_secrets
  where name = 'finalize_media_upload_url';

  function_url := coalesce(
    function_url,
    'https://rvsfmfuooxhopmxdqbao.functions.supabase.co/finalize-media-upload'
  );

  if webhook_secret is null then
    raise warning 'finalize_media_upload_webhook secret is not configured.';
    return new;
  end if;

  perform net.http_post(
    url := function_url,
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-supabase-webhook-secret', webhook_secret
    ),
    body := jsonb_build_object(
      'bucketId', new.bucket_id,
      'objectName', new.name,
      'objectId', new.id,
      'source', 'storage.objects'
    ),
    timeout_milliseconds := 3000
  );

  return new;
end;
$$;

revoke all on function private.dispatch_storage_object_finalizer() from public, anon, authenticated;

drop trigger if exists storage_objects_dispatch_media_finalizer on storage.objects;
create trigger storage_objects_dispatch_media_finalizer
after insert or update on storage.objects
for each row
when (new.bucket_id = 'post-media' and new.name not like '__placeholders/%')
execute function private.dispatch_storage_object_finalizer();
