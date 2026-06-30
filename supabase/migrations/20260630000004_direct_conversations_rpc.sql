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
  join public.conversation_members current_member
    on current_member.conversation_id = c.id
    and current_member.user_id = current_user_id
  join public.conversation_members other_member
    on other_member.conversation_id = c.id
    and other_member.user_id = other_user_id
  where c.is_group = false
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

drop policy if exists "conversation creators read own conversations" on public.conversations;
create policy "conversation creators read own conversations" on public.conversations
  for select using (auth.uid() = created_by);
