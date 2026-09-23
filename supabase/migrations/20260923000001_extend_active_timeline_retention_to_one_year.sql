-- Extend active timeline retention from 30 days to 1 year (365 days)
create or replace function public.active_timeline_retention()
returns interval
language sql
stable
as $$
  select interval '365 days';
$$;

create or replace function public.archive_stale_feed_items(
  retention interval default interval '365 days',
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
    $cron$select public.archive_stale_feed_items(interval '365 days', 100000);$cron$
  );
exception
  when others then
    null;
end $$;
