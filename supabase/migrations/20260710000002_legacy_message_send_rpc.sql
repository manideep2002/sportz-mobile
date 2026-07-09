create or replace function public.legacy_message_preview(message_body text)
returns text
language sql
immutable
as $$
  select case
    when message_body like '[media:%' then 'Photo / Video'
    when message_body like '[location:%' then 'Shared location'
    else message_body
  end;
$$;

create or replace function public.send_conversation_message(
  target_conversation_id uuid,
  message_body text
)
returns public.messages
language plpgsql
security definer
set search_path = public
as $$
declare
  current_user_id uuid := auth.uid();
  normalized_body text := btrim(coalesce(message_body, ''));
  inserted_message public.messages;
begin
  if current_user_id is null then
    raise exception 'You must be signed in to message.';
  end if;

  if target_conversation_id is null then
    raise exception 'Chat is missing. Please reopen the conversation.';
  end if;

  if normalized_body = '' then
    raise exception 'Message cannot be empty.';
  end if;

  if char_length(normalized_body) > 2000 then
    raise exception 'Message is too long.';
  end if;

  if not exists (
    select 1
    from public.conversation_members cm
    where cm.conversation_id = target_conversation_id
      and cm.user_id = current_user_id
  ) then
    raise exception 'You are not a member of this chat.';
  end if;

  if exists (
    select 1
    from public.conversation_members other_member
    join public.blocks b
      on (
        (b.blocker_id = current_user_id and b.blocked_id = other_member.user_id)
        or (b.blocker_id = other_member.user_id and b.blocked_id = current_user_id)
      )
    where other_member.conversation_id = target_conversation_id
      and other_member.user_id <> current_user_id
  ) then
    raise exception 'You cannot message this player.';
  end if;

  insert into public.messages (conversation_id, sender_id, body)
  values (target_conversation_id, current_user_id, normalized_body)
  returning * into inserted_message;

  update public.conversations
  set
    last_message = public.legacy_message_preview(inserted_message.body),
    last_sender_id = inserted_message.sender_id,
    updated_at = inserted_message.created_at
  where id = target_conversation_id;

  return inserted_message;
end;
$$;

revoke all on function public.legacy_message_preview(text) from public;
grant execute on function public.legacy_message_preview(text) to authenticated, service_role;

revoke all on function public.send_conversation_message(uuid, text) from public;
grant execute on function public.send_conversation_message(uuid, text) to authenticated;
