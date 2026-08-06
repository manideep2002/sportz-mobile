-- ─────────────────────────────────────────────────────────────────────────────
-- Story-reaction notifications
--
-- When a user reacts to a story we now:
--  1. Extend the notification kind enum with 'story_reaction'.
--  2. Fire a notification row via upsert_notification_bundle so the author
--     sees an in-app badge and, via the existing notification-dispatcher
--     webhook, receives a push notification.
--
-- The aggregate_key groups multiple reactions on the same story into a single
-- unread bundle (mirrors how likes on posts work).  A new reaction by a
-- different user bumps the bundle rather than creating a second row.
-- ─────────────────────────────────────────────────────────────────────────────

-- 1. Add 'story_reaction' to the notification kind enum.
do $$
begin
  alter type public.sportz_notification_kind add value if not exists 'story_reaction';
end $$;

-- 2. Add story_reactions column to notification_preferences so users can opt
--    out of push for this kind. Default true = opted in for everyone.
alter table public.notification_preferences
  add column if not exists story_reactions boolean not null default true;

-- 3. Patch notification_bundle_title so bundled story-reaction notifications
--    are phrased correctly ("Alex reacted to your story" / "Alex and 2 others
--    reacted to your story") instead of falling through to the generic
--    "sent you an update" copy.
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
    when 'like'           then 'liked your post'
    when 'comment'        then 'commented on your post'
    when 'mention'        then 'mentioned you in a post'
    when 'follow'         then 'followed you'
    when 'follow_request' then 'requested to follow you'
    when 'event'          then 'joined your event'
    when 'invite'         then 'invited you'
    when 'message'        then 'sent you a message'
    when 'story_reaction' then 'reacted to your story'
    else                       'sent you an update'
  end;

  if normalized_count <= 1 then
    return actor_name || ' ' || action_text;
  end if;

  return actor_name || ' and ' || others::text || ' other' ||
    case when others = 1 then '' else 's' end ||
    ' ' || action_text;
end;
$$;

-- 4. Patch notification_route_payload so tapping a story_reaction notification
--    routes to the reactor's profile (/profile/[id]).
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
      'type',     notification_kind::text,
      'kind',     notification_kind::text,
      'screen',   case
        when notification_entity_type = 'post'                         then '/post/[id]'
        when notification_entity_type = 'event'                        then '/event/[id]'
        when notification_entity_type = 'profile'                      then '/profile/[id]'
        when notification_entity_type in ('conversation', 'chat_room') then '/messages/[id]'
        when notification_entity_type = 'group'                        then '/group/[id]'
        when notification_entity_type = 'page'                         then '/page/[id]'
        else null
      end,
      'entityType',     notification_entity_type,
      'entityId',       notification_entity_id::text,
      'postId',         case when notification_entity_type = 'post'    then notification_entity_id::text end,
      'eventId',        case when notification_entity_type = 'event'   then notification_entity_id::text end,
      'profileId',      case when notification_entity_type = 'profile' then notification_entity_id::text end,
      'conversationId', case when notification_entity_type in ('conversation', 'chat_room') then notification_entity_id::text end,
      'communityId',    case when notification_entity_type in ('group', 'page') then notification_entity_id::text end
    )
  );
$$;

-- 5. Trigger function: fires after a row is inserted into story_reactions.
create or replace function public.notify_story_reaction()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  story_author_id uuid;
  actor_name      text;
begin
  -- Look up who owns this story.
  select user_id
  into story_author_id
  from public.stories
  where id = new.story_id;

  -- No story found or reactor is the author → skip.
  if story_author_id is null or story_author_id = new.user_id then
    return new;
  end if;

  select display_name
  into actor_name
  from public.profiles
  where id = new.user_id;

  perform public.upsert_notification_bundle(
    -- recipient
    story_author_id,
    -- actor (reactor)
    new.user_id,
    -- kind
    'story_reaction'::public.sportz_notification_kind,
    -- title  (upsert_notification_bundle recomputes via notification_bundle_title on update)
    coalesce(actor_name, 'An athlete') || ' reacted ' || new.reaction || ' to your story',
    -- body shown in the notification centre
    'Someone reacted to your SPORTZ story.',
    -- entity_type: 'profile' routes the tap to the reactor's profile
    'profile',
    -- entity_id: the reactor's user_id
    new.user_id,
    -- extra data forwarded through to the push payload
    jsonb_build_object(
      'emoji',   new.reaction,
      'storyId', new.story_id::text
    ),
    -- aggregate_key: one unread bundle per story, collapses multiple reactors
    'story_reaction:story:' || new.story_id::text,
    -- bundle_eligible: yes
    true
  );

  return new;
end;
$$;

-- Revoke direct invocation from regular roles; trigger runs as SECURITY DEFINER.
revoke all on function public.notify_story_reaction() from public, anon, authenticated;

-- 6. Attach the trigger to story_reactions.
drop trigger if exists story_reactions_notify_author on public.story_reactions;
create trigger story_reactions_notify_author
  after insert on public.story_reactions
  for each row execute function public.notify_story_reaction();
