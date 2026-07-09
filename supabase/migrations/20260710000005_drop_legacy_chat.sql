-- Drop the legacy conversation/message stack after the thread-first backfill.
-- This project is still pre-production, so we intentionally remove the old
-- tables/functions instead of keeping two messaging systems alive.

update public.chat_participants cp
set muted_until = cm.muted_until
from public.conversation_mutes cm
where cp.room_id = cm.conversation_id
  and cp.user_id = cm.user_id
  and cm.muted_until is not null;

do $$
begin
  if to_regclass('public.messages') is not null then
    drop trigger if exists messages_notify_conversation_members on public.messages;
  end if;
end $$;

drop function if exists public.notify_new_message();
drop function if exists public.send_conversation_message(uuid, text);
drop function if exists public.legacy_message_preview(text);
drop function if exists public.create_direct_conversation(uuid);
drop function if exists public.create_group_conversation(text, uuid[]);
drop function if exists public.add_group_conversation_members(uuid, uuid[]);
drop function if exists public.remove_group_conversation_member(uuid, uuid);
drop function if exists public.is_conversation_member(uuid) cascade;

drop table if exists public.message_receipts cascade;
drop table if exists public.conversation_mutes cascade;
drop table if exists public.messages cascade;
drop table if exists public.conversation_members cascade;
drop table if exists public.conversations cascade;
