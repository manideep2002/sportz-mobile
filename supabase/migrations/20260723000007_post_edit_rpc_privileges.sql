-- The local and new hosted Supabase defaults do not auto-grant table privileges.
-- Keep the edit RPC security-invoker so the existing post and mention RLS policies
-- remain authoritative, while granting only the operations used by the transaction.

grant select, update on table public.posts to authenticated;
grant select, insert, delete on table public.post_mentions to authenticated;
