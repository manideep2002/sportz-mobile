-- P2-3: complete community/page lifecycle administration.
-- Page identity decision: page administrators publish as themselves. A page is
-- context for a post, never an impersonated author.

alter table public.communities
  add column if not exists rules text not null default '',
  add column if not exists avatar_path text,
  add column if not exists cover_path text,
  add column if not exists join_approval_required boolean not null default false,
  add column if not exists posting_permission text not null default 'members',
  add column if not exists archived_at timestamptz,
  add column if not exists archived_by uuid references public.profiles(id) on delete set null;

alter table public.communities
  drop constraint if exists communities_posting_permission_check;
alter table public.communities
  add constraint communities_posting_permission_check
  check (posting_permission in ('members', 'admins'));

update public.communities
set join_approval_required = true
where type = 'group' and coalesce(is_private, false);

create index if not exists communities_discovery_idx
  on public.communities(type, archived_at, created_at desc);
create index if not exists communities_name_search_idx
  on public.communities using gin (to_tsvector('simple', name || ' ' || coalesce(description, '') || ' ' || coalesce(city, '') || ' ' || sport));
create index if not exists community_members_role_idx
  on public.community_members(community_id, role, created_at);

create table if not exists public.community_admin_audit_log (
  id uuid primary key default gen_random_uuid(),
  community_id uuid references public.communities(id) on delete set null,
  community_name text not null,
  community_type text not null check (community_type in ('group', 'page')),
  actor_id uuid references public.profiles(id) on delete set null,
  action text not null check (
    action in (
      'created',
      'settings_updated',
      'branding_updated',
      'branding_removed',
      'member_promoted',
      'member_demoted',
      'member_removed',
      'ownership_transferred',
      'content_removed',
      'archived',
      'deleted'
    )
  ),
  target_user_id uuid references public.profiles(id) on delete set null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists community_admin_audit_lookup_idx
  on public.community_admin_audit_log(community_id, created_at desc);

alter table public.community_admin_audit_log enable row level security;

drop policy if exists "community administrators read audit log" on public.community_admin_audit_log;
create policy "community administrators read audit log"
on public.community_admin_audit_log for select
using (
  community_id is not null
  and public.is_community_admin(community_id)
);

create or replace function public.is_community_owner(target_community_id uuid, target_user_id uuid default auth.uid())
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
      and member.role = 'owner'
  );
$$;

create or replace function public.log_community_admin_action(
  target_community_id uuid,
  target_action text,
  target_user_id uuid default null,
  action_metadata jsonb default '{}'::jsonb
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  community_row public.communities%rowtype;
begin
  select * into community_row
  from public.communities
  where id = target_community_id;

  if community_row.id is null then
    raise exception 'Community not found.';
  end if;

  insert into public.community_admin_audit_log (
    community_id,
    community_name,
    community_type,
    actor_id,
    action,
    target_user_id,
    metadata
  )
  values (
    community_row.id,
    community_row.name,
    community_row.type::text,
    auth.uid(),
    target_action,
    target_user_id,
    coalesce(action_metadata, '{}'::jsonb)
  );
end;
$$;

create or replace function public.create_community(
  community_type text,
  community_name text,
  community_slug text,
  community_description text,
  community_sport text,
  community_city text,
  community_is_private boolean default false
)
returns public.communities
language plpgsql
security definer
set search_path = public
as $$
declare
  current_user_id uuid := auth.uid();
  created_community public.communities%rowtype;
begin
  if current_user_id is null then
    raise exception 'You must be signed in to create a community.';
  end if;
  if community_type not in ('group', 'page') then
    raise exception 'Invalid community type.';
  end if;
  if char_length(trim(community_name)) < 2 then
    raise exception 'Community name must contain at least 2 characters.';
  end if;

  insert into public.communities (
    type,
    name,
    slug,
    description,
    sport,
    city,
    is_private,
    join_approval_required,
    posting_permission,
    created_by
  )
  values (
    community_type::public.sportz_community_type,
    trim(community_name),
    community_slug,
    trim(coalesce(community_description, '')),
    community_sport,
    trim(coalesce(community_city, '')),
    case when community_type = 'group' then coalesce(community_is_private, false) else false end,
    case when community_type = 'group' then coalesce(community_is_private, false) else false end,
    case when community_type = 'page' then 'admins' else 'members' end,
    current_user_id
  )
  returning * into created_community;

  insert into public.community_members (community_id, user_id, role)
  values (created_community.id, current_user_id, 'owner');

  perform public.log_community_admin_action(created_community.id, 'created');
  return created_community;
end;
$$;

create or replace function public.update_community_settings(
  target_community_id uuid,
  community_name text,
  community_description text,
  community_city text,
  community_sport text,
  community_is_private boolean,
  community_rules text,
  require_join_approval boolean,
  community_posting_permission text
)
returns public.communities
language plpgsql
security definer
set search_path = public
as $$
declare
  updated_community public.communities%rowtype;
begin
  if not public.is_community_owner(target_community_id) then
    raise exception 'Only an owner can change community settings.';
  end if;
  if char_length(trim(community_name)) < 2 then
    raise exception 'Community name must contain at least 2 characters.';
  end if;
  if community_posting_permission not in ('members', 'admins') then
    raise exception 'Invalid posting permission.';
  end if;

  update public.communities
  set name = trim(community_name),
      description = trim(coalesce(community_description, '')),
      city = trim(coalesce(community_city, '')),
      sport = community_sport,
      is_private = case when type = 'group' then coalesce(community_is_private, false) else false end,
      rules = trim(coalesce(community_rules, '')),
      join_approval_required = case
        when type = 'group' then coalesce(require_join_approval, false) or coalesce(community_is_private, false)
        else false
      end,
      posting_permission = case
        when type = 'page' then 'admins'
        else community_posting_permission
      end
  where id = target_community_id
  returning * into updated_community;

  perform public.log_community_admin_action(
    target_community_id,
    'settings_updated',
    null,
    jsonb_build_object(
      'isPrivate', updated_community.is_private,
      'joinApprovalRequired', updated_community.join_approval_required,
      'postingPermission', updated_community.posting_permission
    )
  );
  return updated_community;
end;
$$;

create or replace function public.update_community_branding(
  target_community_id uuid,
  target_kind text,
  storage_path text
)
returns public.communities
language plpgsql
security definer
set search_path = public
as $$
declare
  updated_community public.communities%rowtype;
begin
  if not public.is_community_owner(target_community_id) then
    raise exception 'Only an owner can change community branding.';
  end if;
  if target_kind not in ('avatar', 'cover') then
    raise exception 'Invalid branding type.';
  end if;
  if storage_path is not null and storage_path not like target_community_id::text || '/%' then
    raise exception 'Invalid branding storage path.';
  end if;

  update public.communities
  set avatar_path = case when target_kind = 'avatar' then storage_path else avatar_path end,
      cover_path = case when target_kind = 'cover' then storage_path else cover_path end
  where id = target_community_id
  returning * into updated_community;

  perform public.log_community_admin_action(
    target_community_id,
    case when storage_path is null then 'branding_removed' else 'branding_updated' end,
    null,
    jsonb_build_object('kind', target_kind)
  );
  return updated_community;
end;
$$;

create or replace function public.protect_final_community_owner()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if old.role <> 'owner' then
    if tg_op = 'DELETE' then return old; end if;
    return new;
  end if;
  if tg_op = 'UPDATE' and new.role = 'owner' then
    return new;
  end if;
  if current_setting('sportz.allow_owner_removal', true) = 'true' then
    if tg_op = 'DELETE' then return old; end if;
    return new;
  end if;
  if not exists (
    select 1 from public.community_members member
    where member.community_id = old.community_id
      and member.user_id <> old.user_id
      and member.role = 'owner'
  ) then
    raise exception 'Transfer ownership before removing or demoting the final owner.';
  end if;
  if tg_op = 'DELETE' then return old; end if;
  return new;
end;
$$;

drop trigger if exists protect_final_community_owner_trigger on public.community_members;
create trigger protect_final_community_owner_trigger
before update or delete on public.community_members
for each row execute function public.protect_final_community_owner();

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
  target_role text;
begin
  if current_user_id is null or not public.is_community_owner(target_community_id, current_user_id) then
    raise exception 'Only an owner can transfer ownership.';
  end if;
  if target_user_id = current_user_id then
    raise exception 'Choose another member.';
  end if;

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
end;
$$;

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
begin
  if not public.is_community_owner(target_community_id) then
    raise exception 'Only an owner can promote or demote administrators.';
  end if;
  if target_role not in ('admin', 'member', 'follower') then
    raise exception 'Invalid member role.';
  end if;

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
end;
$$;

create or replace function public.remove_community_member(target_community_id uuid, target_user_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  current_user_id uuid := auth.uid();
  existing_role text;
begin
  if target_user_id = current_user_id then
    perform public.leave_community(target_community_id);
    return;
  end if;
  if not public.is_community_admin(target_community_id) then
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

  delete from public.community_members
  where community_id = target_community_id and user_id = target_user_id;
  perform public.log_community_admin_action(target_community_id, 'member_removed', target_user_id);
end;
$$;

create or replace function public.leave_community(target_community_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  current_user_id uuid := auth.uid();
  current_role text;
begin
  if current_user_id is null then
    raise exception 'You must be signed in to leave.';
  end if;

  select role into current_role
  from public.community_members
  where community_id = target_community_id and user_id = current_user_id
  for update;

  if current_role is null then
    return;
  end if;
  if current_role = 'owner' then
    raise exception 'Transfer ownership before leaving this community.';
  end if;

  delete from public.community_members
  where community_id = target_community_id and user_id = current_user_id;
end;
$$;

create or replace function public.set_community_archived(target_community_id uuid, archive boolean)
returns public.communities
language plpgsql
security definer
set search_path = public
as $$
declare
  updated_community public.communities%rowtype;
begin
  if not public.is_community_owner(target_community_id) then
    raise exception 'Only an owner can archive a community.';
  end if;

  if archive then
    update public.community_invites
    set status = 'cancelled', responded_at = now()
    where community_id = target_community_id and status = 'pending';
    update public.community_join_requests
    set status = 'cancelled', responded_at = now()
    where community_id = target_community_id and status = 'pending';
  end if;

  update public.communities
  set archived_at = case when archive then now() else null end,
      archived_by = case when archive then auth.uid() else null end
  where id = target_community_id
  returning * into updated_community;

  perform public.log_community_admin_action(
    target_community_id,
    case when archive then 'archived' else 'settings_updated' end,
    null,
    jsonb_build_object('archived', archive)
  );
  return updated_community;
end;
$$;

create or replace function public.delete_community(target_community_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  community_row public.communities%rowtype;
begin
  if not public.is_community_owner(target_community_id) then
    raise exception 'Only an owner can delete a community.';
  end if;

  select * into community_row
  from public.communities
  where id = target_community_id
  for update;

  insert into public.community_admin_audit_log (
    community_id,
    community_name,
    community_type,
    actor_id,
    action,
    metadata
  )
  values (
    community_row.id,
    community_row.name,
    community_row.type::text,
    auth.uid(),
    'deleted',
    jsonb_build_object('archivedAt', community_row.archived_at)
  );

  perform set_config('sportz.allow_owner_removal', 'true', true);
  delete from public.communities where id = target_community_id;
end;
$$;

create or replace function public.join_community(
  target_community_id uuid,
  requested_role text default 'member'
)
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
  if community_row.archived_at is not null then
    raise exception 'Archived communities cannot receive new activity.';
  end if;
  if exists (
    select 1 from public.community_members
    where community_id = target_community_id and user_id = current_user_id
  ) then
    return 'joined';
  end if;

  select * into pending_invite
  from public.community_invites
  where community_id = target_community_id
    and invitee_id = current_user_id
    and status = 'pending'
  order by created_at desc
  limit 1
  for update;

  if pending_invite.id is not null then
    update public.community_invites
    set status = 'accepted', responded_at = now()
    where id = pending_invite.id;
    insert into public.community_members (community_id, user_id, role)
    values (
      target_community_id,
      current_user_id,
      case when community_row.type = 'page' then 'follower' else requested_role end
    )
    on conflict (community_id, user_id) do nothing;
    return 'joined';
  end if;

  if community_row.type = 'group' and community_row.join_approval_required then
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
      select user_id from public.community_members
      where community_id = target_community_id
        and role in ('owner', 'admin')
        and user_id <> current_user_id
    loop
      insert into public.notifications (
        user_id, actor_id, kind, title, body, entity_type, entity_id, data
      )
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
  values (
    target_community_id,
    current_user_id,
    case when community_row.type = 'page' then 'follower' else requested_role end
  )
  on conflict (community_id, user_id) do nothing;
  return 'joined';
end;
$$;

create or replace function public.ensure_community_accepts_activity()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  activity_community_id uuid;
begin
  activity_community_id := new.community_id;
  if exists (
    select 1 from public.communities
    where id = activity_community_id and archived_at is not null
  ) then
    raise exception 'Archived communities cannot receive new activity.';
  end if;
  return new;
end;
$$;

drop trigger if exists community_members_require_active on public.community_members;
create trigger community_members_require_active
before insert on public.community_members
for each row execute function public.ensure_community_accepts_activity();

drop trigger if exists community_invites_require_active on public.community_invites;
create trigger community_invites_require_active
before insert on public.community_invites
for each row execute function public.ensure_community_accepts_activity();

drop trigger if exists community_join_requests_require_active on public.community_join_requests;
create trigger community_join_requests_require_active
before insert on public.community_join_requests
for each row execute function public.ensure_community_accepts_activity();

drop trigger if exists community_events_require_active on public.sport_events;
create trigger community_events_require_active
before insert or update on public.sport_events
for each row
when (new.community_id is not null)
execute function public.ensure_community_accepts_activity();

create or replace function public.enforce_community_post_authorization()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  community_row public.communities%rowtype;
  actor_role text;
begin
  if new.community_id is null then
    return new;
  end if;

  select * into community_row
  from public.communities
  where id = new.community_id;
  if community_row.id is null then
    raise exception 'Community not found.';
  end if;
  if community_row.archived_at is not null then
    raise exception 'Archived communities cannot receive new activity.';
  end if;
  if new.author_id <> auth.uid() then
    raise exception 'Community posts must use the publishing administrator or member as author.';
  end if;

  select role into actor_role
  from public.community_members
  where community_id = new.community_id and user_id = auth.uid();

  if community_row.type = 'page' and actor_role not in ('owner', 'admin') then
    raise exception 'Only page administrators can publish to a page.';
  end if;
  if community_row.type = 'group' and (
    actor_role is null
    or actor_role = 'follower'
    or (community_row.posting_permission = 'admins' and actor_role not in ('owner', 'admin'))
  ) then
    raise exception 'You do not have permission to publish in this group.';
  end if;
  return new;
end;
$$;

drop trigger if exists enforce_community_post_authorization_trigger on public.posts;
create trigger enforce_community_post_authorization_trigger
before insert or update on public.posts
for each row execute function public.enforce_community_post_authorization();

create or replace function public.remove_community_post(
  target_community_id uuid,
  target_post_id uuid,
  removal_reason text default 'Community rules'
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  post_author_id uuid;
begin
  if not public.is_community_admin(target_community_id) then
    raise exception 'Only community administrators can remove community content.';
  end if;

  select author_id into post_author_id
  from public.posts
  where id = target_post_id and community_id = target_community_id
  for update;

  if post_author_id is null then
    raise exception 'Post not found.';
  end if;

  perform public.log_community_admin_action(
    target_community_id,
    'content_removed',
    post_author_id,
    jsonb_build_object(
      'postId', target_post_id,
      'reason', left(trim(coalesce(removal_reason, 'Community rules')), 200)
    )
  );
  delete from public.posts where id = target_post_id;
end;
$$;

-- Public branding is intentionally opaque-path and contains no private terms or
-- member data. Community-row RLS remains the authority for discovery metadata.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'community-media',
  'community-media',
  true,
  10485760,
  array['image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do update
set public = excluded.public,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "community owners upload branding" on storage.objects;
create policy "community owners upload branding"
on storage.objects for insert to authenticated
with check (
  bucket_id = 'community-media'
  and public.is_community_owner(((storage.foldername(name))[1])::uuid)
);

drop policy if exists "community owners update branding" on storage.objects;
create policy "community owners update branding"
on storage.objects for update to authenticated
using (
  bucket_id = 'community-media'
  and public.is_community_owner(((storage.foldername(name))[1])::uuid)
)
with check (
  bucket_id = 'community-media'
  and public.is_community_owner(((storage.foldername(name))[1])::uuid)
);

drop policy if exists "community owners delete branding" on storage.objects;
create policy "community owners delete branding"
on storage.objects for delete to authenticated
using (
  bucket_id = 'community-media'
  and public.is_community_owner(((storage.foldername(name))[1])::uuid)
);

grant select on public.community_admin_audit_log to authenticated;
revoke insert, update, delete on public.communities from anon, authenticated;
revoke insert, update, delete on public.community_members from anon, authenticated;
revoke insert, update, delete on public.community_admin_audit_log from anon, authenticated;
grant execute on function public.is_community_owner(uuid, uuid) to anon, authenticated;
revoke execute on function public.log_community_admin_action(uuid, text, uuid, jsonb) from public, anon, authenticated;
grant execute on function public.create_community(text, text, text, text, text, text, boolean) to authenticated;
grant execute on function public.update_community_settings(uuid, text, text, text, text, boolean, text, boolean, text) to authenticated;
grant execute on function public.update_community_branding(uuid, text, text) to authenticated;
grant execute on function public.transfer_community_ownership(uuid, uuid) to authenticated;
grant execute on function public.set_community_archived(uuid, boolean) to authenticated;
grant execute on function public.delete_community(uuid) to authenticated;
grant execute on function public.remove_community_post(uuid, uuid, text) to authenticated;
