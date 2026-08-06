-- Fix: notify_story_reaction used the wrong column name.
-- stories.user_id does not exist; the correct column is stories.author_id.
-- Migration 20260807000002 is already applied, so this patch re-creates the
-- function with the correct column reference.

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
  select author_id
  into story_author_id
  from public.stories
  where id = new.story_id;

  if story_author_id is null or story_author_id = new.user_id then
    return new;
  end if;

  select display_name
  into actor_name
  from public.profiles
  where id = new.user_id;

  perform public.upsert_notification_bundle(
    story_author_id,
    new.user_id,
    'story_reaction'::public.sportz_notification_kind,
    coalesce(actor_name, 'An athlete') || ' reacted ' || new.reaction || ' to your story',
    'Someone reacted to your SPORTZ story.',
    'profile',
    new.user_id,
    jsonb_build_object('emoji', new.reaction, 'storyId', new.story_id::text),
    'story_reaction:story:' || new.story_id::text,
    true
  );

  return new;
end;
$$;

revoke all on function public.notify_story_reaction() from public, anon, authenticated;
