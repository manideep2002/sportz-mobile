create or replace function public.is_conversation_member(check_conversation_id uuid)
returns boolean
language sql
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.conversation_members cm
    where cm.conversation_id = check_conversation_id
      and cm.user_id = auth.uid()
  );
$$;

revoke all on function public.is_conversation_member(uuid) from public;
grant execute on function public.is_conversation_member(uuid) to authenticated;

drop policy if exists "conversation members read joined rows" on public.conversation_members;
create policy "conversation members read joined rows"
  on public.conversation_members
  for select
  using (public.is_conversation_member(conversation_id));
