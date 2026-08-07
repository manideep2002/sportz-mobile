-- Patch chat_message_preview so the conversations list shows a human-readable
-- summary instead of the raw encoded story_reaction|… / story_reply|… string.
--
-- Also handles the legacy colon-separated format (story_reaction:… / story_reply:…)
-- that was used before the pipe-separator fix, so old messages render correctly.

create or replace function public.chat_message_preview(
  check_message_type public.chat_message_type,
  check_body text
)
returns text
language sql
immutable
as $$
  select case
    when check_message_type = 'image' then 'Photo'
    when check_message_type = 'video' then 'Video'
    -- New pipe-separated format
    when check_body like 'story_reaction|%' then
      '⚡ Reacted to your story'
    when check_body like 'story_reply|%' then
      '💬 Replied to your story'
    -- Legacy colon-separated format (messages sent before the fix)
    when check_body like 'story_reaction:%' then
      '⚡ Reacted to your story'
    when check_body like 'story_reply:%' then
      '💬 Replied to your story'
    else left(coalesce(check_body, ''), 180)
  end;
$$;
