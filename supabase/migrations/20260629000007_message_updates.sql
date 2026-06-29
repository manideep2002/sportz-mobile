drop policy if exists "users update own messages" on public.messages;
create policy "users update own messages" on public.messages
  for update using (auth.uid() = sender_id) with check (auth.uid() = sender_id);

