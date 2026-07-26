-- P2-3 follow-up: ownership transfer must not leave creator-based private access,
-- and lifecycle security-definer RPCs must not be executable by anonymous users.

drop policy if exists "communities readable" on public.communities;
create policy "communities readable"
on public.communities for select
using (
  coalesce(is_private, false) = false
  or public.is_community_member(id, auth.uid())
  or exists (
    select 1
    from public.community_invites invite
    where invite.community_id = communities.id
      and invite.invitee_id = auth.uid()
      and invite.status = 'pending'
  )
  or exists (
    select 1
    from public.community_join_requests request
    where request.community_id = communities.id
      and request.requester_id = auth.uid()
      and request.status = 'pending'
  )
);

drop policy if exists "community administrators read audit log" on public.community_admin_audit_log;
create policy "community administrators read audit log"
on public.community_admin_audit_log for select
using (
  (
    community_id is not null
    and public.is_community_admin(community_id)
  )
  or public.current_user_is_admin()
);

create or replace function public.is_community_owner(
  target_community_id uuid,
  target_user_id uuid default auth.uid()
)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select
    (
      target_user_id = auth.uid()
      or public.current_user_is_admin()
    )
    and exists (
      select 1
      from public.community_members member
      where member.community_id = target_community_id
        and member.user_id = target_user_id
        and member.role = 'owner'
    );
$$;

revoke execute on function public.is_community_owner(uuid, uuid) from public, anon;
grant execute on function public.is_community_owner(uuid, uuid) to authenticated;

revoke execute on function public.create_community(text, text, text, text, text, text, boolean) from public, anon;
revoke execute on function public.update_community_settings(uuid, text, text, text, text, boolean, text, boolean, text) from public, anon;
revoke execute on function public.update_community_branding(uuid, text, text) from public, anon;
revoke execute on function public.transfer_community_ownership(uuid, uuid) from public, anon;
revoke execute on function public.set_community_archived(uuid, boolean) from public, anon;
revoke execute on function public.delete_community(uuid) from public, anon;
revoke execute on function public.remove_community_post(uuid, uuid, text) from public, anon;

grant execute on function public.create_community(text, text, text, text, text, text, boolean) to authenticated;
grant execute on function public.update_community_settings(uuid, text, text, text, text, boolean, text, boolean, text) to authenticated;
grant execute on function public.update_community_branding(uuid, text, text) to authenticated;
grant execute on function public.transfer_community_ownership(uuid, uuid) to authenticated;
grant execute on function public.set_community_archived(uuid, boolean) to authenticated;
grant execute on function public.delete_community(uuid) to authenticated;
grant execute on function public.remove_community_post(uuid, uuid, text) to authenticated;

