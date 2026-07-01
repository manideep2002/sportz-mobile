create or replace function public.create_direct_conversation(other_user_id uuid)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  current_user_id uuid := auth.uid();
  existing_conversation_id uuid;
  new_conversation_id uuid;
  other_display_name text;
begin
  if current_user_id is null then
    raise exception 'You must be signed in to start a conversation.';
  end if;

  if other_user_id is null or other_user_id = current_user_id then
    raise exception 'Choose another player to message.';
  end if;

  select c.id
  into existing_conversation_id
  from public.conversations c
  where c.is_group = false
    and exists (
      select 1
      from public.conversation_members cm
      where cm.conversation_id = c.id
        and cm.user_id = current_user_id
    )
    and exists (
      select 1
      from public.conversation_members om
      where om.conversation_id = c.id
        and om.user_id = other_user_id
    )
    and (
      select count(*)
      from public.conversation_members count_members
      where count_members.conversation_id = c.id
    ) = 2
  order by c.updated_at desc
  limit 1;

  if existing_conversation_id is not null then
    return existing_conversation_id;
  end if;

  select display_name
  into other_display_name
  from public.profiles
  where id = other_user_id;

  if other_display_name is null then
    raise exception 'Player profile not found.';
  end if;

  insert into public.conversations (is_group, created_by, title, last_message)
  values (false, current_user_id, other_display_name, '')
  returning id into new_conversation_id;

  insert into public.conversation_members (conversation_id, user_id)
  values
    (new_conversation_id, current_user_id),
    (new_conversation_id, other_user_id)
  on conflict (conversation_id, user_id) do nothing;

  return new_conversation_id;
end;
$$;

revoke all on function public.create_direct_conversation(uuid) from public;
grant execute on function public.create_direct_conversation(uuid) to authenticated;
