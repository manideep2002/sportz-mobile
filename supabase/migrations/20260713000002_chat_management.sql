-- Durable chat-management state and server-enforced message/member actions.

alter table public.chat_participants
  add column if not exists is_pinned boolean not null default false;

grant update (is_pinned) on public.chat_participants to authenticated;

create index if not exists chat_participants_user_pinned_idx
  on public.chat_participants (user_id, room_id)
  where is_active and is_pinned;

create or replace function public.refresh_chat_room_after_message_update()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  latest_message public.chat_messages;
begin
  if new.body is not distinct from old.body
     and new.deleted_at is not distinct from old.deleted_at then
    return new;
  end if;

  if exists (
    select 1
    from public.chat_rooms cr
    where cr.id = new.room_id
      and cr.last_message_id = new.id
  ) then
    select cm.*
    into latest_message
    from public.chat_messages cm
    where cm.room_id = new.room_id
      and cm.deleted_at is null
    order by cm.created_at desc, cm.id desc
    limit 1;

    update public.chat_rooms
    set last_message_id = latest_message.id,
        last_message_preview = case
          when latest_message.id is null then null
          else public.chat_message_preview(latest_message.message_type, latest_message.body)
        end,
        last_message_at = latest_message.created_at
    where id = new.room_id;
  end if;

  return new;
end;
$$;

drop trigger if exists chat_messages_refresh_room_after_update on public.chat_messages;
create trigger chat_messages_refresh_room_after_update
after update of body, deleted_at on public.chat_messages
for each row execute function public.refresh_chat_room_after_message_update();

create or replace function public.edit_chat_message(
  target_message_id uuid,
  message_body text
)
returns public.chat_messages
language plpgsql
security definer
set search_path = public
as $$
declare
  current_user_id uuid := auth.uid();
  normalized_body text := nullif(btrim(coalesce(message_body, '')), '');
  target_message public.chat_messages;
begin
  if current_user_id is null then
    raise exception 'You must be signed in to edit messages.';
  end if;

  if normalized_body is null then
    raise exception 'A message cannot be empty.';
  end if;

  if char_length(normalized_body) > 4000 then
    raise exception 'Messages can be at most 4000 characters.';
  end if;

  select cm.*
  into target_message
  from public.chat_messages cm
  where cm.id = target_message_id
  for update;

  if target_message.id is null
     or target_message.sender_id <> current_user_id
     or target_message.message_type <> 'text'
     or target_message.deleted_at is not null
     or not public.is_active_chat_participant(target_message.room_id, current_user_id) then
    raise exception 'You can only edit your own text messages.';
  end if;

  update public.chat_messages
  set body = normalized_body,
      edited_at = now()
  where id = target_message_id
  returning * into target_message;

  return target_message;
end;
$$;

create or replace function public.delete_chat_message(target_message_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  current_user_id uuid := auth.uid();
  target_message public.chat_messages;
begin
  if current_user_id is null then
    raise exception 'You must be signed in to delete messages.';
  end if;

  select cm.*
  into target_message
  from public.chat_messages cm
  where cm.id = target_message_id
  for update;

  if target_message.id is null
     or target_message.sender_id <> current_user_id
     or target_message.deleted_at is not null
     or not public.is_active_chat_participant(target_message.room_id, current_user_id) then
    raise exception 'You can only delete your own messages.';
  end if;

  update public.chat_messages
  set deleted_at = now()
  where id = target_message_id;
end;
$$;

revoke all on function public.edit_chat_message(uuid, text) from public;
grant execute on function public.edit_chat_message(uuid, text) to authenticated;
revoke all on function public.delete_chat_message(uuid) from public;
grant execute on function public.delete_chat_message(uuid) to authenticated;

create or replace function public.add_chat_room_members(
  target_room_id uuid,
  member_ids uuid[]
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  current_user_id uuid := auth.uid();
  target_member_id uuid;
begin
  if current_user_id is null then
    raise exception 'You must be signed in to add members.';
  end if;

  if not exists (
    select 1 from public.chat_rooms cr
    where cr.id = target_room_id and cr.room_kind = 'group'
  ) then
    raise exception 'Members can only be added to group chats.';
  end if;

  if not public.active_chat_room_admin(target_room_id, current_user_id) then
    raise exception 'Only chat admins can add members.';
  end if;

  for target_member_id in
    select distinct member_id
    from unnest(coalesce(member_ids, '{}'::uuid[])) as member_id
    where member_id is not null and member_id <> current_user_id
  loop
    if exists (select 1 from public.profiles p where p.id = target_member_id)
       and not public.chat_users_blocked_each_other(current_user_id, target_member_id) then
      insert into public.chat_participants (room_id, user_id, role)
      values (target_room_id, target_member_id, 'member')
      on conflict (room_id, user_id) do update
      set is_active = true,
          left_at = null,
          role = 'member',
          last_read_at = now(),
          muted_until = null,
          is_pinned = false
      where not chat_participants.is_active;
    end if;
  end loop;
end;
$$;

create or replace function public.remove_chat_room_member(
  target_room_id uuid,
  target_user_id uuid
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  current_user_id uuid := auth.uid();
  current_role text;
  target_role text;
  target_room_kind public.chat_room_kind;
  replacement_user_id uuid;
begin
  if current_user_id is null then
    raise exception 'You must be signed in to update chat members.';
  end if;

  select cr.room_kind into target_room_kind
  from public.chat_rooms cr
  where cr.id = target_room_id;

  select cp.role into current_role
  from public.chat_participants cp
  where cp.room_id = target_room_id
    and cp.user_id = current_user_id
    and cp.is_active;

  select cp.role into target_role
  from public.chat_participants cp
  where cp.room_id = target_room_id
    and cp.user_id = target_user_id
    and cp.is_active
  for update;

  if target_room_kind is null or current_role is null or target_role is null then
    raise exception 'This chat member is no longer active.';
  end if;

  if current_user_id <> target_user_id then
    if target_room_kind <> 'group' then
      raise exception 'Members can only be removed from group chats.';
    end if;

    if current_role = 'member' then
      raise exception 'Only chat admins can remove members.';
    end if;

    if current_role = 'admin' and target_role <> 'member' then
      raise exception 'Admins can only remove group members.';
    end if;
  end if;

  if target_room_kind = 'group' and target_role = 'owner' then
    select cp.user_id into replacement_user_id
    from public.chat_participants cp
    where cp.room_id = target_room_id
      and cp.user_id <> target_user_id
      and cp.is_active
    order by case cp.role when 'owner' then 0 when 'admin' then 1 else 2 end,
             cp.joined_at asc
    limit 1;

    if replacement_user_id is not null then
      update public.chat_participants
      set role = 'owner'
      where room_id = target_room_id
        and user_id = replacement_user_id;
    end if;
  end if;

  update public.chat_participants
  set is_active = false,
      left_at = now(),
      is_pinned = false,
      muted_until = null
  where room_id = target_room_id
    and user_id = target_user_id;
end;
$$;

revoke all on function public.add_chat_room_members(uuid, uuid[]) from public;
grant execute on function public.add_chat_room_members(uuid, uuid[]) to authenticated;
revoke all on function public.remove_chat_room_member(uuid, uuid) from public;
grant execute on function public.remove_chat_room_member(uuid, uuid) to authenticated;
