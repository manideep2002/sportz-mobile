-- User-scoped push settings and installation-scoped token revocation.
-- Token values are never persisted in client retry state; only the opaque installation id is used.

create or replace function public.revoke_push_installation(target_device_id text)
returns void
language plpgsql
security invoker
set search_path = public
as $$
begin
  if auth.uid() is null then
    raise exception 'You must be signed in to revoke push tokens.';
  end if;
  if target_device_id is null or char_length(trim(target_device_id)) = 0 then
    raise exception 'A device id is required.';
  end if;

  update public.user_push_tokens
  set is_active = false,
      revoked_at = coalesce(revoked_at, now()),
      updated_at = now()
  where user_id = auth.uid()
    and device_id = target_device_id
    and is_active;
end;
$$;

revoke all on function public.revoke_push_installation(text) from public, anon;
grant execute on function public.revoke_push_installation(text) to authenticated;

-- User-only RLS already protects preferences. Publish changes so another signed-in device
-- receives the authoritative server setting and updates its local cache.
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'notification_preferences'
  ) then
    alter publication supabase_realtime add table public.notification_preferences;
  end if;
end;
$$;
