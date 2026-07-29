-- MF-05: retain direct-chat records while allowing each participant to hide
-- everything that existed before their own clear action.

alter table public.chat_participants
  add column if not exists cleared_at timestamptz;

-- Keep the watermark on the participant row and use a dedicated RPC rather
-- than granting clients direct write access to this destructive-looking state.
create or replace function public.clear_direct_chat_history(target_room_id uuid)
returns public.chat_participants
language plpgsql
security definer
set search_path = public
as $$
declare
  current_user_id uuid := auth.uid();
  cleared_participant public.chat_participants;
  clear_time timestamptz := now();
begin
  if current_user_id is null then
    raise exception 'You must be signed in to clear chat history.';
  end if;

  if not exists (
    select 1
    from public.chat_rooms cr
    join public.chat_participants cp
      on cp.room_id = cr.id
     and cp.user_id = current_user_id
     and cp.is_active
    where cr.id = target_room_id
      and cr.room_kind = 'direct'
  ) then
    raise exception 'Only active participants can clear a direct conversation.';
  end if;

  update public.chat_participants
  set cleared_at = greatest(coalesce(cleared_at, '-infinity'::timestamptz), clear_time),
      last_read_at = greatest(coalesce(last_read_at, '-infinity'::timestamptz), clear_time)
  where room_id = target_room_id
    and user_id = current_user_id
  returning * into cleared_participant;

  return cleared_participant;
end;
$$;

revoke all on function public.clear_direct_chat_history(uuid) from public;
grant execute on function public.clear_direct_chat_history(uuid) to authenticated;

-- Preserve the cursor-friendly room index when a clear watermark is applied.
create index if not exists chat_participants_user_cleared_idx
  on public.chat_participants (user_id, room_id, cleared_at)
  where is_active and cleared_at is not null;
