-- IF-07: make client-generated chat message IDs true idempotency keys.
-- A retry after a lost response returns the original row for the same
-- authenticated sender and room instead of producing a duplicate-key error.

create or replace function public.send_chat_message(
  target_room_id uuid,
  client_message_id uuid,
  target_message_type public.chat_message_type,
  message_body text default null,
  target_media_url text default null,
  target_media_path text default null,
  target_media_width integer default null,
  target_media_height integer default null,
  target_media_mime_type text default null
)
returns public.chat_messages
language plpgsql
security definer
set search_path = public
as $$
declare
  current_user_id uuid := auth.uid();
  normalized_body text := nullif(btrim(coalesce(message_body, '')), '');
  resolved_message_id uuid := coalesce(client_message_id, gen_random_uuid());
  inserted_message public.chat_messages;
begin
  if current_user_id is null then
    raise exception 'You must be signed in to message.';
  end if;

  if not public.is_active_chat_participant(target_room_id, current_user_id) then
    raise exception 'You are not a member of this chat.';
  end if;

  if exists (
    select 1
    from public.chat_participants other_member
    join public.blocks b
      on (
        (b.blocker_id = current_user_id and b.blocked_id = other_member.user_id)
        or (b.blocker_id = other_member.user_id and b.blocked_id = current_user_id)
      )
    where other_member.room_id = target_room_id
      and other_member.user_id <> current_user_id
      and other_member.is_active
  ) then
    raise exception 'You cannot message this player.';
  end if;

  insert into public.chat_messages (
    id,
    room_id,
    sender_id,
    message_type,
    body,
    media_url,
    media_path,
    media_width,
    media_height,
    media_mime_type
  )
  values (
    resolved_message_id,
    target_room_id,
    current_user_id,
    target_message_type,
    normalized_body,
    target_media_url,
    target_media_path,
    target_media_width,
    target_media_height,
    target_media_mime_type
  )
  on conflict (id) do nothing
  returning * into inserted_message;

  if inserted_message.id is null then
    select message.*
    into inserted_message
    from public.chat_messages message
    where message.id = resolved_message_id
      and message.room_id = target_room_id
      and message.sender_id = current_user_id
      and message.deleted_at is null;

    if inserted_message.id is null then
      raise exception 'Message id is already in use.';
    end if;
  end if;

  return inserted_message;
end;
$$;

revoke all on function public.send_chat_message(
  uuid,
  uuid,
  public.chat_message_type,
  text,
  text,
  text,
  integer,
  integer,
  text
) from public;

grant execute on function public.send_chat_message(
  uuid,
  uuid,
  public.chat_message_type,
  text,
  text,
  text,
  integer,
  integer,
  text
) to authenticated;
