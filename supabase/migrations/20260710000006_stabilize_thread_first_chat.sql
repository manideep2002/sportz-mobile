-- Stabilize direct-room identity after the legacy-to-thread-first cutover.
-- A direct pair must resolve to one room, otherwise the inbox can show the
-- same person twice.

create temporary table thread_direct_room_canonical on commit drop as
with direct_room_members as (
  select
    cr.id as room_id,
    array_agg(cp.user_id order by cp.user_id) as member_ids,
    coalesce(cr.last_message_at, cr.updated_at, cr.created_at) as last_activity_at
  from public.chat_rooms cr
  join public.chat_participants cp
    on cp.room_id = cr.id
   and cp.is_active
  where cr.room_kind = 'direct'
  group by cr.id
  having count(*) = 2
),
ranked as (
  select
    room_id,
    member_ids[1]::text || ':' || member_ids[2]::text as pair_key,
    first_value(room_id) over (
      partition by member_ids[1]::text || ':' || member_ids[2]::text
      order by last_activity_at desc, room_id desc
    ) as canonical_room_id,
    count(*) over (
      partition by member_ids[1]::text || ':' || member_ids[2]::text
    ) as pair_room_count
  from direct_room_members
)
select *
from ranked;

with participant_rollup as (
  select
    drc.canonical_room_id,
    cp.user_id,
    max(cp.last_read_at) as last_read_at,
    max(cp.muted_until) as muted_until,
    min(cp.joined_at) as joined_at
  from thread_direct_room_canonical drc
  join public.chat_participants cp
    on cp.room_id = drc.room_id
  where drc.pair_room_count > 1
  group by drc.canonical_room_id, cp.user_id
)
update public.chat_participants cp
set
  last_read_at = nullif(
    greatest(
      coalesce(cp.last_read_at, '-infinity'::timestamptz),
      coalesce(participant_rollup.last_read_at, '-infinity'::timestamptz)
    ),
    '-infinity'::timestamptz
  ),
  muted_until = nullif(
    greatest(
      coalesce(cp.muted_until, '-infinity'::timestamptz),
      coalesce(participant_rollup.muted_until, '-infinity'::timestamptz)
    ),
    '-infinity'::timestamptz
  ),
  joined_at = least(cp.joined_at, participant_rollup.joined_at)
from participant_rollup
where cp.room_id = participant_rollup.canonical_room_id
  and cp.user_id = participant_rollup.user_id;

update public.chat_messages cm
set room_id = drc.canonical_room_id
from thread_direct_room_canonical drc
where cm.room_id = drc.room_id
  and drc.room_id <> drc.canonical_room_id;

update public.notifications n
set entity_id = drc.canonical_room_id
from thread_direct_room_canonical drc
where n.kind = 'message'
  and n.entity_type in ('conversation', 'chat_room')
  and n.entity_id = drc.room_id
  and drc.room_id <> drc.canonical_room_id;

delete from public.chat_rooms cr
using thread_direct_room_canonical drc
where cr.id = drc.room_id
  and drc.room_id <> drc.canonical_room_id;

with latest_message as (
  select distinct on (cm.room_id)
    cm.room_id,
    cm.id,
    cm.message_type,
    cm.body,
    cm.created_at
  from public.chat_messages cm
  where cm.deleted_at is null
    and cm.room_id in (select distinct canonical_room_id from thread_direct_room_canonical)
  order by cm.room_id, cm.created_at desc, cm.id desc
)
update public.chat_rooms cr
set
  last_message_id = latest_message.id,
  last_message_preview = public.chat_message_preview(latest_message.message_type, latest_message.body),
  last_message_at = latest_message.created_at,
  updated_at = greatest(cr.updated_at, latest_message.created_at)
from latest_message
where cr.id = latest_message.room_id;

update public.chat_rooms cr
set metadata = coalesce(cr.metadata, '{}'::jsonb) || jsonb_build_object('direct_pair_key', pair_keys.pair_key)
from (
  select distinct canonical_room_id, pair_key
  from thread_direct_room_canonical
) pair_keys
where cr.id = pair_keys.canonical_room_id;

create unique index if not exists chat_rooms_direct_pair_key_unique_idx
  on public.chat_rooms ((metadata->>'direct_pair_key'))
  where room_kind = 'direct'
    and metadata ? 'direct_pair_key';

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
  direct_pair_key text;
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

  direct_pair_key := least(current_user_id::text, other_user_id::text)
    || ':'
    || greatest(current_user_id::text, other_user_id::text);

  perform pg_advisory_xact_lock(hashtextextended(direct_pair_key, 0));

  select cr.id
  into existing_room_id
  from public.chat_rooms cr
  where cr.room_kind = 'direct'
    and (
      cr.metadata->>'direct_pair_key' = direct_pair_key
      or (
        exists (
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
      )
    )
  order by coalesce(cr.last_message_at, cr.updated_at, cr.created_at) desc, cr.id desc
  limit 1;

  if existing_room_id is not null then
    update public.chat_rooms
    set metadata = coalesce(metadata, '{}'::jsonb) || jsonb_build_object('direct_pair_key', direct_pair_key)
    where id = existing_room_id;

    insert into public.chat_participants (room_id, user_id, role)
    values
      (existing_room_id, current_user_id, 'owner'),
      (existing_room_id, other_user_id, 'member')
    on conflict (room_id, user_id) do update
    set is_active = true,
        left_at = null;

    return existing_room_id;
  end if;

  insert into public.chat_rooms (room_kind, created_by, metadata)
  values ('direct', current_user_id, jsonb_build_object('direct_pair_key', direct_pair_key))
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

revoke all on function public.create_direct_chat_room(uuid) from public;
grant execute on function public.create_direct_chat_room(uuid) to authenticated;
