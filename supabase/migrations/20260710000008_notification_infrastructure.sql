-- Enterprise notification infrastructure:
-- - one push-token registry for Expo devices
-- - one bundled activity table for in-app feed + push fan-out
-- - strict read-only/update-is-read RLS for notification consumers

create table if not exists public.user_push_tokens (
  id uuid primary key default public.uuid_generate_v7(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  expo_push_token text not null,
  platform text not null check (char_length(platform) > 0),
  device_id text,
  device_name text,
  app_version text,
  is_active boolean not null default true,
  last_seen_at timestamptz not null default now(),
  revoked_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint user_push_tokens_user_token_unique unique (user_id, expo_push_token)
);

create unique index if not exists user_push_tokens_one_active_token_idx
  on public.user_push_tokens(expo_push_token)
  where is_active;

create index if not exists user_push_tokens_active_user_idx
  on public.user_push_tokens(user_id, last_seen_at desc)
  where is_active;

create or replace function public.prepare_user_push_token()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  new.updated_at = now();
  new.last_seen_at = coalesce(new.last_seen_at, now());

  if new.is_active then
    new.revoked_at = null;

    update public.user_push_tokens
    set is_active = false,
        revoked_at = now(),
        updated_at = now()
    where expo_push_token = new.expo_push_token
      and user_id <> new.user_id
      and is_active;
  elsif new.revoked_at is null then
    new.revoked_at = now();
  end if;

  return new;
end;
$$;

drop trigger if exists user_push_tokens_prepare on public.user_push_tokens;
create trigger user_push_tokens_prepare
before insert or update on public.user_push_tokens
for each row execute function public.prepare_user_push_token();

insert into public.user_push_tokens (
  user_id,
  expo_push_token,
  platform,
  is_active,
  created_at,
  updated_at,
  last_seen_at
)
select
  user_id,
  token,
  platform,
  true,
  created_at,
  updated_at,
  updated_at
from public.push_tokens
on conflict (user_id, expo_push_token) do update
set platform = excluded.platform,
    is_active = true,
    updated_at = now(),
    last_seen_at = now(),
    revoked_at = null;

alter table public.user_push_tokens enable row level security;

drop policy if exists "users read own push tokens" on public.user_push_tokens;
create policy "users read own push tokens" on public.user_push_tokens
  for select using (auth.uid() = user_id);

drop policy if exists "users insert own push tokens" on public.user_push_tokens;
create policy "users insert own push tokens" on public.user_push_tokens
  for insert with check (auth.uid() = user_id);

drop policy if exists "users update own push tokens" on public.user_push_tokens;
create policy "users update own push tokens" on public.user_push_tokens
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "users delete own push tokens" on public.user_push_tokens;
create policy "users delete own push tokens" on public.user_push_tokens
  for delete using (auth.uid() = user_id);

revoke all on public.user_push_tokens from public, anon;
grant select, insert, delete on public.user_push_tokens to authenticated;
grant update (
  platform,
  device_id,
  device_name,
  app_version,
  is_active,
  last_seen_at,
  revoked_at,
  updated_at
) on public.user_push_tokens to authenticated;

alter table public.notification_preferences
  add column if not exists mentions boolean not null default true;

alter table public.notifications
  add column if not exists is_read boolean not null default false,
  add column if not exists aggregate_key text,
  add column if not exists actor_ids uuid[] not null default array[]::uuid[],
  add column if not exists actor_count integer not null default 0,
  add column if not exists data jsonb not null default '{}'::jsonb,
  add column if not exists last_event_at timestamptz not null default now(),
  add column if not exists updated_at timestamptz not null default now(),
  add column if not exists push_last_attempt_at timestamptz,
  add column if not exists push_ticket_ids jsonb not null default '[]'::jsonb;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'notifications_actor_count_nonnegative'
      and conrelid = 'public.notifications'::regclass
  ) then
    alter table public.notifications
      add constraint notifications_actor_count_nonnegative check (actor_count >= 0);
  end if;
end $$;

update public.notifications
set
  is_read = read_at is not null,
  actor_ids = case
    when actor_id is null then array[]::uuid[]
    else array[actor_id]
  end,
  actor_count = case
    when actor_id is null then 0
    else 1
  end,
  data = coalesce(data, '{}'::jsonb),
  last_event_at = created_at,
  updated_at = created_at
where actor_count = 0
  and cardinality(actor_ids) = 0;

create or replace function public.notification_route_payload(
  notification_kind public.sportz_notification_kind,
  notification_entity_type text,
  notification_entity_id uuid
)
returns jsonb
language sql
immutable
as $$
  select jsonb_strip_nulls(
    jsonb_build_object(
      'type', notification_kind::text,
      'kind', notification_kind::text,
      'screen', case
        when notification_entity_type = 'post' then '/post/[id]'
        when notification_entity_type = 'event' then '/event/[id]'
        when notification_entity_type = 'profile' then '/profile/[id]'
        when notification_entity_type in ('conversation', 'chat_room') then '/messages/[id]'
        when notification_entity_type = 'group' then '/group/[id]'
        when notification_entity_type = 'page' then '/page/[id]'
        else null
      end,
      'entityType', notification_entity_type,
      'entityId', notification_entity_id::text,
      'postId', case when notification_entity_type = 'post' then notification_entity_id::text end,
      'eventId', case when notification_entity_type = 'event' then notification_entity_id::text end,
      'profileId', case when notification_entity_type = 'profile' then notification_entity_id::text end,
      'conversationId', case when notification_entity_type in ('conversation', 'chat_room') then notification_entity_id::text end,
      'communityId', case when notification_entity_type in ('group', 'page') then notification_entity_id::text end
    )
  );
$$;

create or replace function public.notification_bundle_title(
  notification_kind public.sportz_notification_kind,
  actor_display_name text,
  notification_actor_count integer
)
returns text
language plpgsql
immutable
as $$
declare
  actor_name text := coalesce(nullif(actor_display_name, ''), 'An athlete');
  normalized_count integer := greatest(coalesce(notification_actor_count, 1), 1);
  others integer := greatest(coalesce(notification_actor_count, 1), 1) - 1;
  action_text text;
begin
  action_text := case notification_kind
    when 'like' then 'liked your post'
    when 'comment' then 'commented on your post'
    when 'mention' then 'mentioned you in a post'
    when 'follow' then 'followed you'
    when 'follow_request' then 'requested to follow you'
    when 'event' then 'joined your event'
    when 'invite' then 'invited you'
    when 'message' then 'sent you a message'
    else 'sent you an update'
  end;

  if normalized_count <= 1 then
    return actor_name || ' ' || action_text;
  end if;

  return actor_name || ' and ' || others::text || ' other' ||
    case when others = 1 then '' else 's' end ||
    ' ' || action_text;
end;
$$;

create or replace function public.prepare_notification_row()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'INSERT' then
    if new.read_at is not null then
      new.is_read = true;
    elsif new.is_read then
      new.read_at = now();
    end if;

    new.created_at = coalesce(new.created_at, now());
    new.last_event_at = coalesce(new.last_event_at, new.created_at);
    new.updated_at = coalesce(new.updated_at, new.created_at);
  else
    if new.is_read is distinct from old.is_read then
      if new.is_read then
        new.read_at = coalesce(new.read_at, now());
      else
        new.read_at = null;
      end if;
    elsif new.read_at is distinct from old.read_at then
      new.is_read = new.read_at is not null;
    elsif new.is_read and new.read_at is null then
      new.read_at = now();
    end if;

    new.updated_at = now();
  end if;

  new.data = coalesce(new.data, '{}'::jsonb) ||
    public.notification_route_payload(new.kind, new.entity_type, new.entity_id);

  if new.actor_id is not null and array_position(coalesce(new.actor_ids, array[]::uuid[]), new.actor_id) is null then
    new.actor_ids = array_prepend(new.actor_id, coalesce(new.actor_ids, array[]::uuid[]));
  end if;

  new.actor_ids = coalesce(new.actor_ids[1:12], array[]::uuid[]);
  new.actor_count = greatest(coalesce(new.actor_count, 0), cardinality(new.actor_ids));

  return new;
end;
$$;

drop trigger if exists notifications_prepare_row on public.notifications;
create trigger notifications_prepare_row
before insert or update on public.notifications
for each row execute function public.prepare_notification_row();

create index if not exists notifications_user_unread_created_idx
  on public.notifications(user_id, is_read, created_at desc);

create index if not exists notifications_user_last_event_idx
  on public.notifications(user_id, last_event_at desc);

create index if not exists notifications_aggregate_lookup_idx
  on public.notifications(user_id, aggregate_key)
  where aggregate_key is not null;

create unique index if not exists notifications_unread_bundle_unique_idx
  on public.notifications(user_id, aggregate_key)
  where is_read = false and aggregate_key is not null;

create index if not exists notifications_data_gin_idx
  on public.notifications using gin (data jsonb_path_ops);

alter table public.notifications replica identity full;

revoke update on public.notifications from public, anon, authenticated;
grant select on public.notifications to authenticated;
grant update (is_read) on public.notifications to authenticated;

create or replace view public.notification_feed
with (security_invoker = true)
as
select
  n.id,
  n.user_id,
  n.actor_id,
  n.actor_ids,
  n.actor_count,
  greatest(n.actor_count - 1, 0) as other_actor_count,
  n.kind,
  n.title,
  n.body,
  n.entity_type,
  n.entity_id,
  n.aggregate_key,
  n.is_read,
  n.read_at,
  n.created_at,
  n.last_event_at,
  n.updated_at,
  public.notification_route_payload(n.kind, n.entity_type, n.entity_id) ||
    n.data ||
    jsonb_build_object('notificationId', n.id::text) as route_data,
  p.display_name as primary_actor_display_name,
  p.username as primary_actor_username,
  p.avatar_url as primary_actor_avatar_url
from public.notifications n
left join public.profiles p on p.id = n.actor_id;

grant select on public.notification_feed to authenticated;

create or replace function public.upsert_notification_bundle(
  target_user_id uuid,
  actor_user_id uuid,
  notification_kind public.sportz_notification_kind,
  notification_title text,
  notification_body text,
  notification_entity_type text,
  notification_entity_id uuid,
  notification_data jsonb default '{}'::jsonb,
  notification_aggregate_key text default null,
  bundle_eligible boolean default true
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  existing_notification public.notifications%rowtype;
  actor_name text;
  normalized_aggregate_key text;
  next_actor_ids uuid[];
  next_actor_count integer;
  new_notification_id uuid;
  merged_data jsonb;
begin
  if target_user_id is null or target_user_id = actor_user_id then
    return null;
  end if;

  select display_name
  into actor_name
  from public.profiles
  where id = actor_user_id;

  if bundle_eligible then
    normalized_aggregate_key := coalesce(
      notification_aggregate_key,
      notification_kind::text || ':' ||
        coalesce(notification_entity_type, 'none') || ':' ||
        coalesce(notification_entity_id::text, target_user_id::text)
    );
  else
    normalized_aggregate_key := notification_aggregate_key;
  end if;

  merged_data := public.notification_route_payload(
    notification_kind,
    notification_entity_type,
    notification_entity_id
  ) || coalesce(notification_data, '{}'::jsonb);

  if normalized_aggregate_key is not null then
    perform pg_advisory_xact_lock(
      hashtextextended(target_user_id::text || ':' || normalized_aggregate_key, 0)
    );

    select *
    into existing_notification
    from public.notifications
    where user_id = target_user_id
      and aggregate_key = normalized_aggregate_key
      and is_read = false
    order by created_at desc
    limit 1
    for update;

    if existing_notification.id is not null then
      next_actor_ids := coalesce(existing_notification.actor_ids, array[]::uuid[]);
      next_actor_count := greatest(
        coalesce(existing_notification.actor_count, 0),
        cardinality(next_actor_ids)
      );

      if actor_user_id is not null then
        if array_position(next_actor_ids, actor_user_id) is null then
          next_actor_count := next_actor_count + 1;
        end if;
        next_actor_ids := array_prepend(actor_user_id, array_remove(next_actor_ids, actor_user_id));
      end if;

      next_actor_ids := coalesce(next_actor_ids[1:12], array[]::uuid[]);

      update public.notifications
      set actor_id = coalesce(actor_user_id, actor_id),
          actor_ids = next_actor_ids,
          actor_count = next_actor_count,
          entity_type = coalesce(notification_entity_type, entity_type),
          entity_id = coalesce(notification_entity_id, entity_id),
          title = public.notification_bundle_title(notification_kind, actor_name, next_actor_count),
          body = coalesce(nullif(notification_body, ''), body),
          data = data || merged_data || jsonb_build_object('notificationId', id::text),
          last_event_at = now()
      where id = existing_notification.id;

      return existing_notification.id;
    end if;
  end if;

  new_notification_id := public.uuid_generate_v7();

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
    new_notification_id,
    target_user_id,
    actor_user_id,
    notification_kind,
    coalesce(
      nullif(notification_title, ''),
      public.notification_bundle_title(notification_kind, actor_name, case when actor_user_id is null then 0 else 1 end)
    ),
    coalesce(nullif(notification_body, ''), 'Open SPORTZ to see what happened.'),
    notification_entity_type,
    notification_entity_id,
    normalized_aggregate_key,
    case when actor_user_id is null then array[]::uuid[] else array[actor_user_id] end,
    case when actor_user_id is null then 0 else 1 end,
    merged_data || jsonb_build_object('notificationId', new_notification_id::text),
    now()
  );

  return new_notification_id;
end;
$$;

revoke all on function public.upsert_notification_bundle(
  uuid,
  uuid,
  public.sportz_notification_kind,
  text,
  text,
  text,
  uuid,
  jsonb,
  text,
  boolean
) from public, anon, authenticated;

grant execute on function public.upsert_notification_bundle(
  uuid,
  uuid,
  public.sportz_notification_kind,
  text,
  text,
  text,
  uuid,
  jsonb,
  text,
  boolean
) to service_role;

create or replace function public.insert_notification_once(
  target_user_id uuid,
  actor_user_id uuid,
  notification_kind public.sportz_notification_kind,
  notification_title text,
  notification_body text,
  notification_entity_type text,
  notification_entity_id uuid
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.upsert_notification_bundle(
    target_user_id,
    actor_user_id,
    notification_kind,
    notification_title,
    notification_body,
    notification_entity_type,
    notification_entity_id,
    '{}'::jsonb,
    null,
    notification_kind in ('like', 'comment', 'mention', 'follow', 'follow_request', 'event', 'invite')
  );
end;
$$;

revoke all on function public.insert_notification_once(
  uuid,
  uuid,
  public.sportz_notification_kind,
  text,
  text,
  text,
  uuid
) from public, anon, authenticated;

create or replace function public.notify_post_like()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  post_author uuid;
  actor_name text;
begin
  if new.entity_type <> 'post' then
    return new;
  end if;

  select author_id into post_author from public.posts where id = new.entity_id;
  select display_name into actor_name from public.profiles where id = new.user_id;

  perform public.upsert_notification_bundle(
    post_author,
    new.user_id,
    'like',
    public.notification_bundle_title('like', actor_name, 1),
    'Your SPORTZ post got a new like.',
    'post',
    new.entity_id,
    jsonb_build_object('likeId', new.id::text),
    'like:post:' || new.entity_id::text,
    true
  );

  return new;
end;
$$;

drop trigger if exists likes_notify_post_author on public.likes;
create trigger likes_notify_post_author
after insert on public.likes
for each row execute function public.notify_post_like();

revoke all on function public.notify_post_like() from public, anon, authenticated;

create or replace function public.notify_post_comment()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  post_author uuid;
  actor_name text;
begin
  select author_id into post_author from public.posts where id = new.post_id;
  select display_name into actor_name from public.profiles where id = new.author_id;

  perform public.upsert_notification_bundle(
    post_author,
    new.author_id,
    'comment',
    public.notification_bundle_title('comment', actor_name, 1),
    left(new.body, 140),
    'post',
    new.post_id,
    jsonb_build_object('commentId', new.id::text),
    'comment:post:' || new.post_id::text,
    true
  );

  return new;
end;
$$;

drop trigger if exists comments_notify_post_author on public.comments;
create trigger comments_notify_post_author
after insert on public.comments
for each row execute function public.notify_post_comment();

revoke all on function public.notify_post_comment() from public, anon, authenticated;

create or replace function public.notify_new_follow()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  actor_name text;
begin
  select display_name into actor_name from public.profiles where id = new.follower_id;

  perform public.upsert_notification_bundle(
    new.following_id,
    new.follower_id,
    'follow',
    public.notification_bundle_title('follow', actor_name, 1),
    'You have a new follower on SPORTZ.',
    'profile',
    new.follower_id,
    '{}'::jsonb,
    'follow:user:' || new.following_id::text,
    true
  );

  return new;
end;
$$;

drop trigger if exists follows_notify_followed_user on public.follows;
create trigger follows_notify_followed_user
after insert on public.follows
for each row execute function public.notify_new_follow();

revoke all on function public.notify_new_follow() from public, anon, authenticated;

create or replace function public.notify_event_join()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  event_organizer uuid;
  event_title text;
  actor_name text;
begin
  if new.status <> 'going' then
    return new;
  end if;

  select organizer_id, title
  into event_organizer, event_title
  from public.sport_events
  where id = new.event_id;

  select display_name into actor_name from public.profiles where id = new.user_id;

  perform public.upsert_notification_bundle(
    event_organizer,
    new.user_id,
    'event',
    public.notification_bundle_title('event', actor_name, 1),
    coalesce(event_title, 'Your event') || ' has a new attendee.',
    'event',
    new.event_id,
    '{}'::jsonb,
    'event_join:event:' || new.event_id::text,
    true
  );

  return new;
end;
$$;

drop trigger if exists event_attendees_notify_organizer on public.event_attendees;
create trigger event_attendees_notify_organizer
after insert on public.event_attendees
for each row execute function public.notify_event_join();

revoke all on function public.notify_event_join() from public, anon, authenticated;

create or replace function public.notify_post_mention()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  post_author uuid;
  actor_name text;
begin
  select p.author_id, pr.display_name
  into post_author, actor_name
  from public.posts p
  join public.profiles pr on pr.id = p.author_id
  where p.id = new.post_id;

  perform public.upsert_notification_bundle(
    new.mentioned_user_id,
    post_author,
    'mention',
    public.notification_bundle_title('mention', actor_name, 1),
    'You were mentioned in a SPORTZ post.',
    'post',
    new.post_id,
    '{}'::jsonb,
    'mention:post:' || new.post_id::text,
    true
  );

  return new;
end;
$$;

drop trigger if exists post_mentions_notify_user on public.post_mentions;
create trigger post_mentions_notify_user
after insert on public.post_mentions
for each row execute function public.notify_post_mention();

revoke all on function public.notify_post_mention() from public, anon, authenticated;

do $$
begin
  if not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'user_push_tokens'
  ) then
    execute 'alter publication supabase_realtime add table public.user_push_tokens';
  end if;
exception
  when undefined_object then
    null;
end $$;

-- Configure the asynchronous Database Webhook in Supabase Dashboard, or create
-- the equivalent SQL trigger after setting the production function URL/secret:
--
-- create trigger "notifications_dispatch_webhook" after insert
-- on "public"."notifications" for each row
-- execute function "supabase_functions"."http_request"(
--   'https://<project-ref>.functions.supabase.co/notification-dispatcher',
--   'POST',
--   '{"Content-Type":"application/json","x-supabase-webhook-secret":"<NOTIFICATION_WEBHOOK_SECRET>"}',
--   '{}',
--   '1000'
-- );
