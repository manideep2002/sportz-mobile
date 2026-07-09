create or replace function public.active_chat_room_admin(
  check_room_id uuid,
  check_user_id uuid default auth.uid()
)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.chat_participants cp
    where cp.room_id = check_room_id
      and cp.user_id = check_user_id
      and cp.is_active
      and cp.role in ('owner', 'admin')
  );
$$;

create or replace function public.chat_users_blocked_each_other(
  left_user_id uuid,
  right_user_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.blocks b
    where (b.blocker_id = left_user_id and b.blocked_id = right_user_id)
       or (b.blocker_id = right_user_id and b.blocked_id = left_user_id)
  );
$$;

create or replace function public.create_direct_chat_room(other_user_id uuid)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  current_user_id uuid := auth.uid();
  existing_room_id uuid;
  new_room_id uuid;
begin
  if current_user_id is null then
    raise exception 'You must be signed in to start a chat.';
  end if;

  if other_user_id is null or other_user_id = current_user_id then
    raise exception 'Choose another player to message.';
  end if;

  if not exists (select 1 from public.profiles p where p.id = other_user_id) then
    raise exception 'Player profile not found.';
  end if;

  if public.chat_users_blocked_each_other(current_user_id, other_user_id) then
    raise exception 'You cannot message this player.';
  end if;

  select cr.id
  into existing_room_id
  from public.chat_rooms cr
  where cr.room_kind = 'direct'
    and exists (
      select 1
      from public.chat_participants cp
      where cp.room_id = cr.id
        and cp.user_id = current_user_id
        and cp.is_active
    )
    and exists (
      select 1
      from public.chat_participants op
      where op.room_id = cr.id
        and op.user_id = other_user_id
        and op.is_active
    )
    and (
      select count(*)
      from public.chat_participants count_participants
      where count_participants.room_id = cr.id
        and count_participants.is_active
    ) = 2
  order by cr.updated_at desc
  limit 1;

  if existing_room_id is not null then
    return existing_room_id;
  end if;

  insert into public.chat_rooms (room_kind, created_by)
  values ('direct', current_user_id)
  returning id into new_room_id;

  insert into public.chat_participants (room_id, user_id, role)
  values
    (new_room_id, current_user_id, 'owner'),
    (new_room_id, other_user_id, 'member')
  on conflict (room_id, user_id) do update
  set is_active = true,
      left_at = null;

  return new_room_id;
end;
$$;

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
  values ('group', coalesce(clean_title, 'Group chat'), current_user_id)
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

  if not public.active_chat_room_admin(target_room_id, current_user_id) then
    raise exception 'Only chat admins can add members.';
  end if;

  for target_member_id in
    select distinct member_id
    from unnest(coalesce(member_ids, '{}'::uuid[])) as member_id
    where member_id is not null
      and member_id <> current_user_id
  loop
    if exists (select 1 from public.profiles p where p.id = target_member_id)
       and not public.chat_users_blocked_each_other(current_user_id, target_member_id) then
      insert into public.chat_participants (room_id, user_id, role)
      values (target_room_id, target_member_id, 'member')
      on conflict (room_id, user_id) do update
      set is_active = true,
          left_at = null;
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
begin
  if current_user_id is null then
    raise exception 'You must be signed in to update chat members.';
  end if;

  if current_user_id <> target_user_id
     and not public.active_chat_room_admin(target_room_id, current_user_id) then
    raise exception 'Only chat admins can remove members.';
  end if;

  update public.chat_participants
  set is_active = false,
      left_at = now()
  where room_id = target_room_id
    and user_id = target_user_id;
end;
$$;

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
    coalesce(client_message_id, gen_random_uuid()),
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
  returning * into inserted_message;

  return inserted_message;
end;
$$;

revoke all on function public.active_chat_room_admin(uuid, uuid) from public;
grant execute on function public.active_chat_room_admin(uuid, uuid) to authenticated, service_role;

revoke all on function public.chat_users_blocked_each_other(uuid, uuid) from public;
grant execute on function public.chat_users_blocked_each_other(uuid, uuid) to authenticated, service_role;

revoke all on function public.create_direct_chat_room(uuid) from public;
grant execute on function public.create_direct_chat_room(uuid) to authenticated;

revoke all on function public.create_group_chat_room(text, uuid[]) from public;
grant execute on function public.create_group_chat_room(text, uuid[]) to authenticated;

revoke all on function public.add_chat_room_members(uuid, uuid[]) from public;
grant execute on function public.add_chat_room_members(uuid, uuid[]) to authenticated;

revoke all on function public.remove_chat_room_member(uuid, uuid) from public;
grant execute on function public.remove_chat_room_member(uuid, uuid) to authenticated;

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

insert into public.chat_rooms (
  id,
  room_kind,
  title,
  created_by,
  last_message_preview,
  last_message_at,
  created_at,
  updated_at
)
select
  c.id,
  case when c.is_group then 'group'::public.chat_room_kind else 'direct'::public.chat_room_kind end,
  c.title,
  coalesce(
    c.created_by,
    (
      select cm.user_id
      from public.conversation_members cm
      where cm.conversation_id = c.id
      order by cm.created_at asc
      limit 1
    )
  ),
  c.last_message,
  c.updated_at,
  c.created_at,
  c.updated_at
from public.conversations c
where not exists (
  select 1
  from public.chat_rooms cr
  where cr.id = c.id
)
and coalesce(
  c.created_by,
  (
    select cm.user_id
    from public.conversation_members cm
    where cm.conversation_id = c.id
    order by cm.created_at asc
    limit 1
  )
) is not null;

insert into public.chat_participants (
  room_id,
  user_id,
  role,
  last_read_at,
  joined_at
)
select
  cm.conversation_id,
  cm.user_id,
  case when cm.role in ('owner', 'admin', 'member') then cm.role else 'member' end,
  cm.last_read_at,
  cm.created_at
from public.conversation_members cm
where exists (
  select 1
  from public.chat_rooms cr
  where cr.id = cm.conversation_id
)
on conflict (room_id, user_id) do nothing;

insert into public.chat_messages (
  id,
  room_id,
  sender_id,
  message_type,
  body,
  media_url,
  created_at,
  edited_at
)
select
  m.id,
  m.conversation_id,
  m.sender_id,
  case
    when m.body ~ '^\[media:.+\]$' then 'image'::public.chat_message_type
    else 'text'::public.chat_message_type
  end,
  case
    when m.body ~ '^\[media:.+\]$' then null
    else m.body
  end,
  case
    when m.body ~ '^\[media:.+\]$' then substring(m.body from '^\[media:(.+)\]$')
    else null
  end,
  m.created_at,
  m.edited_at
from public.messages m
where exists (
  select 1
  from public.chat_rooms cr
  where cr.id = m.conversation_id
)
on conflict (id) do nothing;

update public.chat_rooms cr
set
  last_message_id = latest.id,
  last_message_preview = public.chat_message_preview(latest.message_type, latest.body),
  last_message_at = latest.created_at,
  updated_at = greatest(cr.updated_at, latest.created_at)
from (
  select distinct on (room_id)
    id,
    room_id,
    message_type,
    body,
    created_at
  from public.chat_messages
  where deleted_at is null
  order by room_id, created_at desc, id desc
) latest
where latest.room_id = cr.id;
