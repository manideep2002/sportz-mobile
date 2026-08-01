-- IF-15: authorize community administrators to remove ordinary members while
-- preserving the owner/admin hierarchy and emitting the existing audit event.

create or replace function public.remove_community_member(target_community_id uuid, target_user_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  current_user_id uuid := auth.uid();
  actor_role text;
  existing_role text;
begin
  if current_user_id is null then
    raise exception 'You must be signed in to remove a community member.';
  end if;

  if target_user_id = current_user_id then
    perform public.leave_community(target_community_id);
    return;
  end if;

  select role into actor_role
  from public.community_members
  where community_id = target_community_id and user_id = current_user_id
  for update;

  if actor_role not in ('owner', 'admin') then
    raise exception 'Only community administrators can remove members.';
  end if;

  select role into existing_role
  from public.community_members
  where community_id = target_community_id and user_id = target_user_id
  for update;

  if existing_role is null then
    return;
  end if;
  if existing_role = 'owner' then
    raise exception 'An owner cannot be removed. Transfer ownership first.';
  end if;
  if actor_role = 'admin' and existing_role = 'admin' then
    raise exception 'Only an owner can remove another administrator.';
  end if;

  delete from public.community_members
  where community_id = target_community_id and user_id = target_user_id;

  perform public.log_community_admin_action(
    target_community_id,
    'member_removed',
    target_user_id,
    jsonb_build_object('actorRole', actor_role, 'targetRole', existing_role)
  );
end;
$$;

revoke execute on function public.remove_community_member(uuid, uuid) from public, anon;
grant execute on function public.remove_community_member(uuid, uuid) to authenticated;
