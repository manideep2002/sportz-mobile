-- ─────────────────────────────────────────────────────────────────────────────
-- Drop story-reaction notification trigger
--
-- Story reactions are delivered directly as messages (DMs) to the story author.
-- Creating a separate notification entry for them is redundant and confusing.
-- This migration drops the trigger that was inserting 'story_reaction' rows
-- into the notifications table.
--
-- The notify_story_reaction() function is kept (to avoid breaking anything that
-- references it), but its trigger is removed so it is never invoked.
-- ─────────────────────────────────────────────────────────────────────────────

drop trigger if exists story_reactions_notify_author on public.story_reactions;
