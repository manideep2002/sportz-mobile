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
  if target_user_id is null or target_user_id = actor_user_id then
    return;
  end if;

  insert into public.notifications (
    user_id,
    actor_id,
    kind,
    title,
    body,
    entity_type,
    entity_id
  )
  values (
    target_user_id,
    actor_user_id,
    notification_kind,
    notification_title,
    notification_body,
    notification_entity_type,
    notification_entity_id
  );
end;
$$;

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

  perform public.insert_notification_once(
    post_author,
    new.user_id,
    'like',
    coalesce(actor_name, 'An athlete') || ' liked your post',
    'Your SPORTZ post got a new like.',
    'post',
    new.entity_id
  );

  return new;
end;
$$;

drop trigger if exists likes_notify_post_author on public.likes;
create trigger likes_notify_post_author
after insert on public.likes
for each row execute function public.notify_post_like();

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

  perform public.insert_notification_once(
    post_author,
    new.author_id,
    'comment',
    coalesce(actor_name, 'An athlete') || ' commented on your post',
    left(new.body, 140),
    'post',
    new.post_id
  );

  return new;
end;
$$;

drop trigger if exists comments_notify_post_author on public.comments;
create trigger comments_notify_post_author
after insert on public.comments
for each row execute function public.notify_post_comment();

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

  perform public.insert_notification_once(
    new.following_id,
    new.follower_id,
    'follow',
    coalesce(actor_name, 'An athlete') || ' followed you',
    'You have a new follower on SPORTZ.',
    'profile',
    new.follower_id
  );

  return new;
end;
$$;

drop trigger if exists follows_notify_followed_user on public.follows;
create trigger follows_notify_followed_user
after insert on public.follows
for each row execute function public.notify_new_follow();

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

  select organizer_id, title into event_organizer, event_title
  from public.sport_events
  where id = new.event_id;
  select display_name into actor_name from public.profiles where id = new.user_id;

  perform public.insert_notification_once(
    event_organizer,
    new.user_id,
    'event',
    coalesce(actor_name, 'An athlete') || ' joined your event',
    coalesce(event_title, 'Your event') || ' has a new attendee.',
    'event',
    new.event_id
  );

  return new;
end;
$$;

drop trigger if exists event_attendees_notify_organizer on public.event_attendees;
create trigger event_attendees_notify_organizer
after insert on public.event_attendees
for each row execute function public.notify_event_join();

