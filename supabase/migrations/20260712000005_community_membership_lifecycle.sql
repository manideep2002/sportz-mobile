-- Complete community membership lifecycle:
-- private groups, join requests, invite responses, leave flows, and admin member controls.

alter table public.communities
  add column if not exists is_private boolean not null default false;

alter table public.community_members
  drop constraint if exists community_members_role_check;

alter table public.community_members
  add constraint community_members_role_check
  check (role in ('owner', 'admin', 'member', 'follower'));

create table if not exists public.community_join_requests (
  id uuid primary key default gen_random_uuid(),
  community_id uuid not null references public.communities(id) on delete cascade,
  requester_id uuid not null references public.profiles(id) on delete cascade,
  status text not null default 'pending' check (status in ('pending', 'approved', 'declined', 'cancelled')),
  created_at timestamptz not null default now(),
  responded_at timestamptz,
  constraint community_join_requests_unique unique (community_id, requester_id)
);

create index if not exists community_join_requests_requester_status_idx
  on public.community_join_requests(requester_id, status, created_at desc);

create index if not exists community_join_requests_community_status_idx
  on public.community_join_requests(community_id, status, created_at desc);

alter table public.community_join_requests enable row level security;

create or replace function public.is_community_member(target_community_id uuid, target_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.community_members member
    where member.community_id = target_community_id
      and member.user_id = target_user_id
  );
$$;

create or replace function public.is_community_admin(target_community_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.community_members member
    where member.community_id = target_community_id
      and member.user_id = auth.uid()
      and member.role in ('owner', 'admin')
  );
$$;

drop policy if exists "communities readable" on public.communities;
create policy "communities readable" on public.communities
  for select using (
    coalesce(is_private, false) = false
    or created_by = auth.uid()
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

drop policy if exists "community members readable" on public.community_members;
create policy "community members readable" on public.community_members
  for select using (
    exists (
      select 1
      from public.communities community
      where community.id = community_members.community_id
        and (
          coalesce(community.is_private, false) = false
          or public.is_community_member(community.id, auth.uid())
        )
    )
  );

drop policy if exists "community creators add owner row" on public.community_members;
create policy "community creators add owner row" on public.community_members
  for insert with check (
    auth.uid() = user_id
    and role = 'owner'
    and exists (
      select 1
      from public.communities community
      where community.id = community_members.community_id
        and community.created_by = auth.uid()
    )
  );

drop policy if exists "users join communities" on public.community_members;
create policy "users join communities" on public.community_members
  for insert with check (
    auth.uid() = user_id
    and role in ('member', 'follower')
    and exists (
      select 1
      from public.communities community
      where community.id = community_members.community_id
        and coalesce(community.is_private, false) = false
    )
  );

drop policy if exists "community admins add members" on public.community_members;
create policy "community admins add members" on public.community_members
  for insert with check (
    public.is_community_admin(community_id)
    and role in ('admin', 'member', 'follower')
  );

drop policy if exists "community admins update members" on public.community_members;
create policy "community admins update members" on public.community_members
  for update
  using (
    public.is_community_admin(community_id)
    and role <> 'owner'
  )
  with check (
    public.is_community_admin(community_id)
    and role in ('admin', 'member', 'follower')
  );

drop policy if exists "users leave communities" on public.community_members;
create policy "users leave communities" on public.community_members
  for delete using (
    auth.uid() = user_id
    and role <> 'owner'
  );

drop policy if exists "community admins remove members" on public.community_members;
create policy "community admins remove members" on public.community_members
  for delete using (
    public.is_community_admin(community_id)
    and role <> 'owner'
  );

drop policy if exists "community join request participants read" on public.community_join_requests;
create policy "community join request participants read" on public.community_join_requests
  for select using (
    auth.uid() = requester_id
    or public.is_community_admin(community_id)
  );

drop policy if exists "users request private community access" on public.community_join_requests;
create policy "users request private community access" on public.community_join_requests
  for insert with check (
    auth.uid() = requester_id
    and exists (
      select 1
      from public.communities community
      where community.id = community_join_requests.community_id
        and community.type = 'group'
        and coalesce(community.is_private, false) = true
    )
  );

drop policy if exists "users cancel own community join requests" on public.community_join_requests;
create policy "users cancel own community join requests" on public.community_join_requests
  for update using (
    auth.uid() = requester_id
    and status = 'pending'
  )
  with check (
    auth.uid() = requester_id
    and status = 'cancelled'
  );

drop policy if exists "community admins respond to join requests" on public.community_join_requests;
create policy "community admins respond to join requests" on public.community_join_requests
  for update using (
    public.is_community_admin(community_id)
    and status = 'pending'
  )
  with check (
    public.is_community_admin(community_id)
    and status in ('approved', 'declined')
  );

drop function if exists public.join_community(uuid, text);
create function public.join_community(target_community_id uuid, requested_role text default 'member')
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  current_user_id uuid := auth.uid();
  community_row public.communities%rowtype;
  pending_invite public.community_invites%rowtype;
  request_id uuid;
  admin_id uuid;
begin
  if current_user_id is null then
    raise exception 'You must be signed in to join.';
  end if;

  if requested_role not in ('member', 'follower') then
    raise exception 'Invalid membership role.';
  end if;

  select * into community_row
  from public.communities
  where id = target_community_id;

  if community_row.id is null then
    raise exception 'Community not found.';
  end if;

  if exists (
    select 1 from public.community_members member
    where member.community_id = target_community_id
      and member.user_id = current_user_id
  ) then
    return 'joined';
  end if;

  select * into pending_invite
  from public.community_invites invite
  where invite.community_id = target_community_id
    and invite.invitee_id = current_user_id
    and invite.status = 'pending'
  order by invite.created_at desc
  limit 1
  for update;

  if pending_invite.id is not null then
    update public.community_invites
    set status = 'accepted',
        responded_at = now()
    where id = pending_invite.id;

    insert into public.community_members (community_id, user_id, role)
    values (target_community_id, current_user_id, requested_role)
    on conflict (community_id, user_id) do nothing;

    update public.community_join_requests
    set status = 'cancelled',
        responded_at = now()
    where community_id = target_community_id
      and requester_id = current_user_id
      and status = 'pending';

    return 'joined';
  end if;

  if community_row.type = 'group' and coalesce(community_row.is_private, false) then
    insert into public.community_join_requests (community_id, requester_id, status)
    values (target_community_id, current_user_id, 'pending')
    on conflict (community_id, requester_id)
    do update set status = 'pending', responded_at = null, created_at = now()
    where public.community_join_requests.status in ('declined', 'cancelled')
    returning id into request_id;

    if request_id is null then
      select id into request_id
      from public.community_join_requests
      where community_id = target_community_id
        and requester_id = current_user_id
        and status = 'pending';
    end if;

    for admin_id in
      select member.user_id
      from public.community_members member
      where member.community_id = target_community_id
        and member.role in ('owner', 'admin')
        and member.user_id <> current_user_id
    loop
      insert into public.notifications (user_id, actor_id, kind, title, body, entity_type, entity_id, data)
      values (
        admin_id,
        current_user_id,
        'invite',
        'Join request',
        'A player requested to join ' || community_row.name || '.',
        'group',
        target_community_id,
        jsonb_build_object('joinRequestId', request_id, 'communityId', target_community_id)
      );
    end loop;

    return 'requested';
  end if;

  insert into public.community_members (community_id, user_id, role)
  values (target_community_id, current_user_id, requested_role)
  on conflict (community_id, user_id) do nothing;

  return 'joined';
end;
$$;

drop function if exists public.leave_community(uuid);
create function public.leave_community(target_community_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  current_user_id uuid := auth.uid();
  current_role text;
  replacement_user_id uuid;
begin
  if current_user_id is null then
    raise exception 'You must be signed in to leave.';
  end if;

  select role into current_role
  from public.community_members
  where community_id = target_community_id
    and user_id = current_user_id
  for update;

  if current_role is null then
    return;
  end if;

  if current_role = 'owner' then
    select user_id into replacement_user_id
    from public.community_members
    where community_id = target_community_id
      and user_id <> current_user_id
    order by case role when 'admin' then 0 when 'member' then 1 else 2 end, created_at
    limit 1
    for update;

    if replacement_user_id is null then
      raise exception 'Transfer ownership or remove the group before leaving.';
    end if;

    update public.community_members
    set role = 'owner'
    where community_id = target_community_id
      and user_id = replacement_user_id;
  end if;

  delete from public.community_members
  where community_id = target_community_id
    and user_id = current_user_id;
end;
$$;

drop function if exists public.update_community_member_role(uuid, uuid, text);
create function public.update_community_member_role(target_community_id uuid, target_user_id uuid, target_role text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  current_user_id uuid := auth.uid();
  existing_role text;
begin
  if current_user_id is null then
    raise exception 'You must be signed in to manage members.';
  end if;

  if not public.is_community_admin(target_community_id) then
    raise exception 'Only community admins can manage members.';
  end if;

  if target_role not in ('admin', 'member', 'follower') then
    raise exception 'Invalid member role.';
  end if;

  select role into existing_role
  from public.community_members
  where community_id = target_community_id
    and user_id = target_user_id
  for update;

  if existing_role is null then
    raise exception 'Member not found.';
  end if;

  if existing_role = 'owner' then
    raise exception 'Owners cannot be changed here.';
  end if;

  update public.community_members
  set role = target_role
  where community_id = target_community_id
    and user_id = target_user_id;
end;
$$;

drop function if exists public.remove_community_member(uuid, uuid);
create function public.remove_community_member(target_community_id uuid, target_user_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  current_user_id uuid := auth.uid();
  existing_role text;
begin
  if current_user_id is null then
    raise exception 'You must be signed in to manage members.';
  end if;

  if target_user_id = current_user_id then
    perform public.leave_community(target_community_id);
    return;
  end if;

  if not public.is_community_admin(target_community_id) then
    raise exception 'Only community admins can remove members.';
  end if;

  select role into existing_role
  from public.community_members
  where community_id = target_community_id
    and user_id = target_user_id
  for update;

  if existing_role is null then
    return;
  end if;

  if existing_role = 'owner' then
    raise exception 'Owners cannot be removed here.';
  end if;

  delete from public.community_members
  where community_id = target_community_id
    and user_id = target_user_id;
end;
$$;

drop function if exists public.invite_community_member(uuid, uuid);
create function public.invite_community_member(target_community_id uuid, target_user_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  current_user_id uuid := auth.uid();
  community_name text;
  invite_id uuid;
begin
  if current_user_id is null then
    raise exception 'You must be signed in to invite members.';
  end if;

  if target_user_id is null or target_user_id = current_user_id then
    raise exception 'Choose another player to invite.';
  end if;

  if public.users_blocked_each_other(current_user_id, target_user_id) then
    raise exception 'You cannot invite this player.';
  end if;

  select c.name into community_name
  from public.communities c
  where c.id = target_community_id
    and public.is_community_admin(c.id);

  if community_name is null then
    raise exception 'Only community admins can invite members.';
  end if;

  if exists (
    select 1 from public.community_members member
    where member.community_id = target_community_id
      and member.user_id = target_user_id
  ) then
    raise exception 'This player is already a member.';
  end if;

  insert into public.community_invites (community_id, inviter_id, invitee_id, status)
  values (target_community_id, current_user_id, target_user_id, 'pending')
  on conflict (community_id, invitee_id)
  do update set inviter_id = current_user_id, status = 'pending', responded_at = null, created_at = now()
  returning id into invite_id;

  update public.community_join_requests
  set status = 'cancelled',
      responded_at = now()
  where community_id = target_community_id
    and requester_id = target_user_id
    and status = 'pending';

  insert into public.notifications (user_id, actor_id, kind, title, body, entity_type, entity_id, data)
  values (
    target_user_id,
    current_user_id,
    'invite',
    'Community invite',
    'You were invited to join ' || community_name || '.',
    'group',
    target_community_id,
    jsonb_build_object('inviteId', invite_id, 'communityId', target_community_id)
  );
end;
$$;

drop function if exists public.respond_community_invite(uuid, boolean);
create function public.respond_community_invite(invite_id uuid, approve boolean)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  current_user_id uuid := auth.uid();
  invite_row public.community_invites%rowtype;
begin
  if current_user_id is null then
    raise exception 'You must be signed in to respond to invites.';
  end if;

  select * into invite_row
  from public.community_invites
  where id = invite_id
    and invitee_id = current_user_id
    and status = 'pending'
  for update;

  if invite_row.id is null then
    raise exception 'Invite not found.';
  end if;

  update public.community_invites
  set status = case when approve then 'accepted' else 'declined' end,
      responded_at = now()
  where id = invite_id;

  if approve then
    insert into public.community_members (community_id, user_id, role)
    values (invite_row.community_id, current_user_id, 'member')
    on conflict (community_id, user_id) do nothing;

    update public.community_join_requests
    set status = 'cancelled',
        responded_at = now()
    where community_id = invite_row.community_id
      and requester_id = current_user_id
      and status = 'pending';
  end if;
end;
$$;

drop function if exists public.respond_community_join_request(uuid, boolean);
create function public.respond_community_join_request(request_id uuid, approve boolean)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  current_user_id uuid := auth.uid();
  request_row public.community_join_requests%rowtype;
  community_name text;
begin
  if current_user_id is null then
    raise exception 'You must be signed in to respond to requests.';
  end if;

  select * into request_row
  from public.community_join_requests
  where id = request_id
    and status = 'pending'
  for update;

  if request_row.id is null then
    raise exception 'Join request not found.';
  end if;

  if not public.is_community_admin(request_row.community_id) then
    raise exception 'Only community admins can respond to requests.';
  end if;

  update public.community_join_requests
  set status = case when approve then 'approved' else 'declined' end,
      responded_at = now()
  where id = request_id;

  select name into community_name
  from public.communities
  where id = request_row.community_id;

  if approve then
    insert into public.community_members (community_id, user_id, role)
    values (request_row.community_id, request_row.requester_id, 'member')
    on conflict (community_id, user_id) do nothing;

    update public.community_invites
    set status = 'accepted',
        responded_at = now()
    where community_id = request_row.community_id
      and invitee_id = request_row.requester_id
      and status = 'pending';
  end if;

  insert into public.notifications (user_id, actor_id, kind, title, body, entity_type, entity_id, data)
  values (
    request_row.requester_id,
    current_user_id,
    'invite',
    case when approve then 'Join request approved' else 'Join request declined' end,
    case when approve then 'You can now access ' || coalesce(community_name, 'the group') || '.'
      else 'Your request to join ' || coalesce(community_name, 'the group') || ' was declined.' end,
    'group',
    request_row.community_id,
    jsonb_build_object('joinRequestId', request_id, 'communityId', request_row.community_id, 'approved', approve)
  );
end;
$$;

grant execute on function public.is_community_member(uuid, uuid) to anon, authenticated;
grant execute on function public.is_community_admin(uuid) to anon, authenticated;
grant execute on function public.join_community(uuid, text) to authenticated;
grant execute on function public.leave_community(uuid) to authenticated;
grant execute on function public.update_community_member_role(uuid, uuid, text) to authenticated;
grant execute on function public.remove_community_member(uuid, uuid) to authenticated;
grant execute on function public.invite_community_member(uuid, uuid) to authenticated;
grant execute on function public.respond_community_invite(uuid, boolean) to authenticated;
grant execute on function public.respond_community_join_request(uuid, boolean) to authenticated;
