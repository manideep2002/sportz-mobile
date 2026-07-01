alter table public.conversations
add column if not exists last_sender_id uuid references public.profiles(id) on delete set null;

drop policy if exists "members update conversation previews" on public.conversations;
create policy "members update conversation previews"
  on public.conversations
  for update
  using (public.is_conversation_member(id))
  with check (public.is_conversation_member(id));

drop policy if exists "members read message receipts" on public.message_receipts;
create policy "members read message receipts"
  on public.message_receipts
  for select
  using (
    exists (
      select 1
      from public.messages msg
      where msg.id = message_receipts.message_id
        and public.is_conversation_member(msg.conversation_id)
    )
  );
