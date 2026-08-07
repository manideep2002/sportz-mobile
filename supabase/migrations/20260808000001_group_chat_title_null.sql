-- Preserve null titles for unnamed group chats and clean up placeholder titles.
-- This migration updates the group chat creation RPC and converts existing placeholder titles.

create or replace function public.create_group_chat_room(
  group_title text,
  member_ids uuid[]
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  current_user_id uuid := auth.uid();
  new_room_id uuid;
  clean_title text := nullif(btrim(coalesce(group_title, '')), '');
  target_member_id uuid;
  clean_member_ids uuid[];
begin
  if current_user_id is null then
    raise exception 'You must be signed in to create a group chat.';
  end if;

  clean_member_ids := array(
    select distinct member_id
    from unnest(coalesce(member_ids, '{}'::uuid[])) as member_id
    where member_id is not null
      and member_id <> current_user_id
  );

  if array_length(clean_member_ids, 1) is null or array_length(clean_member_ids, 1) < 2 then
    raise exception 'Select at least two players to create a group chat.';
  end if;

  insert into public.chat_rooms (room_kind, title, created_by)
  values ('group', clean_title, current_user_id)
  returning id into new_room_id;

  insert into public.chat_participants (room_id, user_id, role)
  values (new_room_id, current_user_id, 'owner');

  foreach target_member_id in array clean_member_ids
  loop
    if exists (select 1 from public.profiles p where p.id = target_member_id)
       and not public.chat_users_blocked_each_other(current_user_id, target_member_id) then
      insert into public.chat_participants (room_id, user_id, role)
      values (new_room_id, target_member_id, 'member')
      on conflict (room_id, user_id) do nothing;
    end if;
  end loop;

  return new_room_id;
end;
$$;

update public.chat_rooms
set title = null
where room_kind = 'group'
  and title = 'Group chat'
  and title is not null;
