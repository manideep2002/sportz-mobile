-- Fire notifications when a community member's role changes (promoted to admin,
-- demoted, or ownership transferred).

-- 1. Extend the notification kind enum.
do $$
begin
  alter type public.sportz_notification_kind add value if not exists 'role_change';
end $$;

-- 2. Replace update_community_member_role so it notifies the affected member.
create or replace function public.update_community_member_role(
  target_community_id uuid,
  target_user_id uuid,
  target_role text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  existing_role text;
  community_row public.communities%rowtype;
  notif_title   text;
  notif_body    text;
begin
  if not public.is_community_owner(target_community_id) then
    raise exception 'Only an owner can promote or demote administrators.';
  end if;
  if target_role not in ('admin', 'member', 'follower') then
    raise exception 'Invalid member role.';
  end if;

  select * into community_row
  from public.communities
  where id = target_community_id;

  select role into existing_role
  from public.community_members
  where community_id = target_community_id and user_id = target_user_id
  for update;

  if existing_role is null then
    raise exception 'Member not found.';
  end if;
  if existing_role = 'owner' then
    raise exception 'Transfer ownership before changing an owner.';
  end if;

  update public.community_members
  set role = target_role
  where community_id = target_community_id and user_id = target_user_id;

  perform public.log_community_admin_action(
    target_community_id,
    case when target_role = 'admin' then 'member_promoted' else 'member_demoted' end,
    target_user_id,
    jsonb_build_object('from', existing_role, 'to', target_role)
  );

  -- Notify the affected member about their role change.
  -- Skip if the role did not actually change to reduce noise.
  if target_role = existing_role then
    return;
  end if;

  if target_role = 'admin' then
    notif_title := 'You''re now an admin';
    notif_body  := 'You have been made an admin of ' || community_row.name || '.';
  elsif existing_role = 'admin' then
    notif_title := 'Admin role removed';
    notif_body  := 'Your admin role in ' || community_row.name || ' has been removed.';
  else
    -- member -> follower or similar; no notification needed.
    return;
  end if;

  insert into public.notifications (
    user_id, actor_id, kind, title, body, entity_type, entity_id, data
  )
  values (
    target_user_id,
    auth.uid(),
    'role_change',
    notif_title,
    notif_body,
    community_row.type::text,
    target_community_id,
    jsonb_build_object(
      'communityId',   target_community_id,
      'communityType', community_row.type::text,
      'role',          target_role
    )
  );
end;
$$;

-- 3. Replace transfer_community_ownership so the new owner gets notified too.
create or replace function public.transfer_community_ownership(
  target_community_id uuid,
  target_user_id uuid
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  current_user_id uuid := auth.uid();
  target_role     text;
  community_row   public.communities%rowtype;
begin
  if current_user_id is null or not public.is_community_owner(target_community_id, current_user_id) then
    raise exception 'Only an owner can transfer ownership.';
  end if;
  if target_user_id = current_user_id then
    raise exception 'Choose another member.';
  end if;

  select * into community_row
  from public.communities
  where id = target_community_id;

  perform 1 from public.communities where id = target_community_id for update;
  perform 1 from public.community_members where community_id = target_community_id for update;

  select role into target_role
  from public.community_members
  where community_id = target_community_id and user_id = target_user_id;

  if target_role is null or target_role = 'follower' then
    raise exception 'Ownership can only be transferred to a member or admin.';
  end if;

  update public.community_members
  set role = 'owner'
  where community_id = target_community_id and user_id = target_user_id;

  update public.community_members
  set role = 'admin'
  where community_id = target_community_id and user_id = current_user_id;

  perform public.log_community_admin_action(
    target_community_id,
    'ownership_transferred',
    target_user_id,
    jsonb_build_object('previousOwnerId', current_user_id)
  );

  -- Notify the new owner.
  insert into public.notifications (
    user_id, actor_id, kind, title, body, entity_type, entity_id, data
  )
  values (
    target_user_id,
    current_user_id,
    'role_change',
    'You are now the owner',
    'Ownership of ' || community_row.name || ' has been transferred to you.',
    community_row.type::text,
    target_community_id,
    jsonb_build_object(
      'communityId',   target_community_id,
      'communityType', community_row.type::text,
      'role',          'owner'
    )
  );
end;
$$;
