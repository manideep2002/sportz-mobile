-- Atomic post editing with structured location/mentions and immutable community context.

alter table public.posts
  add column if not exists location_label text;

alter table public.posts
  drop constraint if exists posts_has_content;
alter table public.posts
  add constraint posts_has_content check (
    length(btrim(body)) > 0
    or media_url is not null
    or length(btrim(coalesce(stats_line, ''))) > 0
    or length(btrim(coalesce(location_label, ''))) > 0
  ) not valid;

create or replace function public.enforce_post_community_edit_rules()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if old.community_id is distinct from new.community_id then
    raise exception using
      errcode = '23514',
      message = 'A post cannot be moved into or out of a community.';
  end if;

  if old.community_id is not null
     and old.visibility = 'group'
     and new.visibility <> 'group' then
    raise exception using
      errcode = '23514',
      message = 'A group post must remain visible only to its community.';
  end if;

  return new;
end;
$$;

drop trigger if exists posts_enforce_community_edit_rules on public.posts;
create trigger posts_enforce_community_edit_rules
before update of community_id, visibility on public.posts
for each row execute function public.enforce_post_community_edit_rules();

drop policy if exists "authors delete post mentions" on public.post_mentions;
create policy "authors delete post mentions" on public.post_mentions
  for delete using (
    exists (
      select 1
      from public.posts p
      where p.id = post_id
        and p.author_id = auth.uid()
    )
  );

create or replace function public.update_post_content(
  target_post_id uuid,
  target_body text,
  target_sport text,
  target_kind public.sportz_post_kind,
  target_stats_line text,
  target_visibility public.sportz_visibility,
  target_media_url text,
  target_media_kind text,
  target_media_storage_path text,
  target_media_width integer,
  target_media_height integer,
  target_media_processing_status text,
  target_location_label text,
  target_mentioned_user_ids uuid[]
)
returns public.posts
language plpgsql
security invoker
set search_path = public
as $$
declare
  current_post public.posts%rowtype;
  updated_post public.posts%rowtype;
begin
  if auth.uid() is null then
    raise exception using errcode = '42501', message = 'You must be signed in to edit posts.';
  end if;

  select *
  into current_post
  from public.posts
  where id = target_post_id
  for update;

  if current_post.id is null or current_post.author_id <> auth.uid() then
    raise exception using errcode = '42501', message = 'You are not allowed to edit this post.';
  end if;

  if current_post.community_id is not null
     and current_post.visibility = 'group'
     and target_visibility <> 'group' then
    raise exception using
      errcode = '23514',
      message = 'A group post must remain visible only to its community.';
  end if;

  update public.posts
  set
    body = coalesce(target_body, ''),
    sport = target_sport,
    kind = target_kind,
    stats_line = nullif(btrim(target_stats_line), ''),
    visibility = target_visibility,
    media_url = target_media_url,
    media_kind = case when target_media_url is null then 'none' else target_media_kind end,
    media_storage_path = target_media_storage_path,
    media_placeholder = case
      when target_media_url is distinct from current_post.media_url then null
      else current_post.media_placeholder
    end,
    media_width = target_media_width,
    media_height = target_media_height,
    media_processing_status = case
      when target_media_url is null then 'ready'
      else coalesce(target_media_processing_status, 'ready')
    end,
    location_label = nullif(btrim(target_location_label), '')
  where id = target_post_id
  returning * into updated_post;

  delete from public.post_mentions
  where post_id = target_post_id;

  insert into public.post_mentions (post_id, mentioned_user_id)
  select target_post_id, mentioned_user_id
  from (
    select distinct unnest(coalesce(target_mentioned_user_ids, array[]::uuid[])) as mentioned_user_id
  ) mentions
  where mentioned_user_id <> auth.uid();

  return updated_post;
end;
$$;

revoke all on function public.update_post_content(
  uuid, text, text, public.sportz_post_kind, text, public.sportz_visibility,
  text, text, text, integer, integer, text, text, uuid[]
) from public, anon;
grant execute on function public.update_post_content(
  uuid, text, text, public.sportz_post_kind, text, public.sportz_visibility,
  text, text, text, integer, integer, text, text, uuid[]
) to authenticated;
