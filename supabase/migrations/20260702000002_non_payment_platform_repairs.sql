-- Remaining non-payment platform repairs:
-- group chat membership, follow/event/court admin workflows, moderation status,
-- event waitlists, and push fan-out tracking.

do $$
begin
  alter type public.sportz_notification_kind add value if not exists 'follow_request';
end $$;

alter table public.reports
  add column if not exists status text not null default 'open' check (status in ('open', 'reviewed', 'dismissed', 'actioned')),
  add column if not exists reviewed_by uuid references public.profiles(id) on delete set null,
  add column if not exists reviewed_at timestamptz,
  add column if not exists resolution text;

create index if not exists reports_status_created_idx on public.reports(status, created_at desc);

alter table public.notifications
  add column if not exists push_sent_at timestamptz,
  add column if not exists push_error text,
  add column if not exists push_attempts integer not null default 0;

create index if not exists notifications_push_pending_idx
  on public.notifications(created_at)
  where push_sent_at is null;

create table if not exists public.event_waitlist (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.sport_events(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  status text not null default 'waiting' check (status in ('waiting', 'promoted', 'cancelled')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint event_waitlist_unique unique (event_id, user_id)
);

drop trigger if exists event_waitlist_set_updated_at on public.event_waitlist;
create trigger event_waitlist_set_updated_at
before update on public.event_waitlist
for each row execute function public.set_updated_at();

create index if not exists event_waitlist_event_status_idx on public.event_waitlist(event_id, status, created_at);
alter table public.event_waitlist enable row level security;

create table if not exists public.community_invites (
  id uuid primary key default gen_random_uuid(),
  community_id uuid not null references public.communities(id) on delete cascade,
  inviter_id uuid not null references public.profiles(id) on delete cascade,
  invitee_id uuid not null references public.profiles(id) on delete cascade,
  status text not null default 'pending' check (status in ('pending', 'accepted', 'declined', 'cancelled')),
  created_at timestamptz not null default now(),
  responded_at timestamptz,
  constraint community_invites_no_self check (inviter_id <> invitee_id),
  constraint community_invites_unique unique (community_id, invitee_id)
);

create index if not exists community_invites_invitee_status_idx on public.community_invites(invitee_id, status, created_at desc);
alter table public.community_invites enable row level security;

create or replace function public.current_user_is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce((select p.is_admin from public.profiles p where p.id = auth.uid()), false);
$$;

create or replace function public.request_or_follow_profile(target_user_id uuid)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  current_user_id uuid := auth.uid();
  target_is_private boolean;
begin
  if current_user_id is null then
    raise exception 'You must be signed in to follow players.';
  end if;

  if target_user_id is null or target_user_id = current_user_id then
    raise exception 'You cannot follow yourself.';
  end if;

  if public.users_blocked_each_other(current_user_id, target_user_id) then
    raise exception 'You cannot follow this player.';
  end if;

  select coalesce(is_private, false)
  into target_is_private
  from public.profiles
  where id = target_user_id;

  if target_is_private is null then
    raise exception 'Profile not found.';
  end if;

  if target_is_private then
    insert into public.follow_requests (requester_id, target_id, status)
    values (current_user_id, target_user_id, 'pending')
    on conflict (requester_id, target_id)
    do update set status = 'pending', responded_at = null, created_at = now()
    where public.follow_requests.status in ('declined', 'cancelled');

    insert into public.notifications (user_id, actor_id, kind, title, body, entity_type, entity_id)
    select target_user_id, current_user_id, 'follow_request', 'New follow request', 'A player requested to follow you.', 'profile', current_user_id
    where not exists (
      select 1 from public.notifications n
      where n.user_id = target_user_id
        and n.actor_id = current_user_id
        and n.kind = 'follow_request'
        and n.entity_id = current_user_id
        and n.created_at > now() - interval '1 day'
    );
    return 'requested';
  end if;

  insert into public.follows (follower_id, following_id)
  values (current_user_id, target_user_id)
  on conflict (follower_id, following_id) do nothing;
  return 'following';
end;
$$;

create or replace function public.respond_to_follow_request(request_id uuid, approve boolean)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  request_row public.follow_requests%rowtype;
begin
  select *
  into request_row
  from public.follow_requests
  where id = request_id
    and target_id = auth.uid()
    and status = 'pending'
  for update;

  if request_row.id is null then
    raise exception 'Follow request not found.';
  end if;

  update public.follow_requests
  set status = case when approve then 'approved' else 'declined' end,
      responded_at = now()
  where id = request_id;

  if approve then
    insert into public.follows (follower_id, following_id)
    values (request_row.requester_id, request_row.target_id)
    on conflict (follower_id, following_id) do nothing;

    insert into public.notifications (user_id, actor_id, kind, title, body, entity_type, entity_id)
    values (request_row.requester_id, request_row.target_id, 'follow', 'Follow request approved', 'Your follow request was approved.', 'profile', request_row.target_id);
  end if;
end;
$$;

drop function if exists public.create_group_conversation(text, uuid[]);
create function public.create_group_conversation(group_title text, member_ids uuid[])
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  current_user_id uuid := auth.uid();
  new_conversation_id uuid;
  cleaned_member_ids uuid[];
begin
  if current_user_id is null then
    raise exception 'You must be signed in to create a group chat.';
  end if;

  select coalesce(array_agg(distinct member_id), array[]::uuid[])
  into cleaned_member_ids
  from unnest(coalesce(member_ids, array[]::uuid[])) as member_id
  where member_id is not null and member_id <> current_user_id;

  if array_length(cleaned_member_ids, 1) is null then
    raise exception 'Choose at least one other player.';
  end if;

  if array_length(cleaned_member_ids, 1) > 49 then
    raise exception 'Group chats are limited to 50 members.';
  end if;

  if exists (
    select 1
    from unnest(cleaned_member_ids) as member_id
    join public.blocks b on (
      (b.blocker_id = current_user_id and b.blocked_id = member_id)
      or (b.blocker_id = member_id and b.blocked_id = current_user_id)
    )
  ) then
    raise exception 'A blocked player cannot be added to this chat.';
  end if;

  insert into public.conversations (title, is_group, created_by, last_message)
  values (nullif(trim(group_title), ''), true, current_user_id, '')
  returning id into new_conversation_id;

  insert into public.conversation_members (conversation_id, user_id, role)
  values (new_conversation_id, current_user_id, 'owner');

  insert into public.conversation_members (conversation_id, user_id, role)
  select new_conversation_id, member_id, 'member'
  from unnest(cleaned_member_ids) as member_id
  on conflict (conversation_id, user_id) do nothing;

  return new_conversation_id;
end;
$$;

drop function if exists public.add_group_conversation_members(uuid, uuid[]);
create function public.add_group_conversation_members(target_conversation_id uuid, member_ids uuid[])
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  current_user_id uuid := auth.uid();
  cleaned_member_ids uuid[];
begin
  if current_user_id is null then
    raise exception 'You must be signed in to add group members.';
  end if;

  if not exists (
    select 1
    from public.conversations c
    join public.conversation_members cm on cm.conversation_id = c.id
    where c.id = target_conversation_id
      and c.is_group = true
      and cm.user_id = current_user_id
      and (c.created_by = current_user_id or cm.role in ('owner', 'admin'))
  ) then
    raise exception 'Only group owners can add members.';
  end if;

  select coalesce(array_agg(distinct member_id), array[]::uuid[])
  into cleaned_member_ids
  from unnest(coalesce(member_ids, array[]::uuid[])) as member_id
  where member_id is not null and member_id <> current_user_id;

  if array_length(cleaned_member_ids, 1) is null then
    return;
  end if;

  if exists (
    select 1
    from unnest(cleaned_member_ids) as member_id
    join public.blocks b on (
      (b.blocker_id = current_user_id and b.blocked_id = member_id)
      or (b.blocker_id = member_id and b.blocked_id = current_user_id)
    )
  ) then
    raise exception 'A blocked player cannot be added to this chat.';
  end if;

  insert into public.conversation_members (conversation_id, user_id, role)
  select target_conversation_id, member_id, 'member'
  from unnest(cleaned_member_ids) as member_id
  on conflict (conversation_id, user_id) do nothing;
end;
$$;

drop function if exists public.remove_group_conversation_member(uuid, uuid);
create function public.remove_group_conversation_member(target_conversation_id uuid, target_user_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  current_user_id uuid := auth.uid();
begin
  if current_user_id is null then
    raise exception 'You must be signed in to leave a group.';
  end if;

  if target_user_id = current_user_id then
    delete from public.conversation_members
    where conversation_id = target_conversation_id and user_id = current_user_id;
    return;
  end if;

  if not exists (
    select 1
    from public.conversations c
    join public.conversation_members cm on cm.conversation_id = c.id
    where c.id = target_conversation_id
      and c.is_group = true
      and cm.user_id = current_user_id
      and (c.created_by = current_user_id or cm.role in ('owner', 'admin'))
  ) then
    raise exception 'Only group owners can remove members.';
  end if;

  delete from public.conversation_members
  where conversation_id = target_conversation_id and user_id = target_user_id;
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
    and exists (
      select 1 from public.community_members m
      where m.community_id = c.id
        and m.user_id = current_user_id
        and m.role in ('owner', 'admin')
    );

  if community_name is null then
    raise exception 'Only community admins can invite members.';
  end if;

  insert into public.community_invites (community_id, inviter_id, invitee_id, status)
  values (target_community_id, current_user_id, target_user_id, 'pending')
  on conflict (community_id, invitee_id)
  do update set inviter_id = current_user_id, status = 'pending', responded_at = null, created_at = now();

  insert into public.notifications (user_id, actor_id, kind, title, body, entity_type, entity_id)
  values (target_user_id, current_user_id, 'invite', 'Community invite', 'You were invited to join ' || community_name || '.', 'group', target_community_id);
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
  where id = invite_id and invitee_id = current_user_id and status = 'pending'
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
    on conflict (community_id, user_id) do update set role = excluded.role;
  end if;
end;
$$;

create or replace function public.notify_new_message()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  sender_name text;
  recipient_id uuid;
begin
  select display_name into sender_name from public.profiles where id = new.sender_id;

  for recipient_id in
    select cm.user_id
    from public.conversation_members cm
    where cm.conversation_id = new.conversation_id
      and cm.user_id <> new.sender_id
  loop
    insert into public.notifications (user_id, actor_id, kind, title, body, entity_type, entity_id)
    values (
      recipient_id,
      new.sender_id,
      'message',
      coalesce(sender_name, 'A player') || ' sent you a message',
      left(new.body, 140),
      'conversation',
      new.conversation_id
    );
  end loop;

  return new;
end;
$$;

drop trigger if exists messages_notify_conversation_members on public.messages;
create trigger messages_notify_conversation_members
after insert on public.messages
for each row execute function public.notify_new_message();

drop function if exists public.join_sport_event(uuid);
create function public.join_sport_event(target_event_id uuid)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  current_user_id uuid := auth.uid();
  event_row public.sport_events%rowtype;
  going_count integer;
begin
  if current_user_id is null then
    raise exception 'You must be signed in to join events.';
  end if;

  select * into event_row from public.sport_events where id = target_event_id for update;
  if event_row.id is null then
    raise exception 'Event not found.';
  end if;

  if event_row.status not in ('open', 'full') then
    raise exception 'This event is not open for joins.';
  end if;

  if event_row.visibility <> 'public' and event_row.organizer_id <> current_user_id then
    raise exception 'This event is invite-only.';
  end if;

  if exists (
    select 1 from public.event_attendees
    where event_id = target_event_id and user_id = current_user_id and status = 'going'
  ) then
    return 'joined';
  end if;

  select count(*) into going_count
  from public.event_attendees
  where event_id = target_event_id and status = 'going';

  if going_count >= event_row.max_players then
    update public.sport_events set status = 'full' where id = target_event_id;
    insert into public.event_waitlist (event_id, user_id, status)
    values (target_event_id, current_user_id, 'waiting')
    on conflict (event_id, user_id) do update set status = 'waiting';
    return 'waitlisted';
  end if;

  insert into public.event_attendees (event_id, user_id, status)
  values (target_event_id, current_user_id, 'going')
  on conflict (event_id, user_id) do update set status = 'going';

  update public.event_waitlist
  set status = 'cancelled'
  where event_id = target_event_id and user_id = current_user_id and status = 'waiting';

  update public.sport_events set status = 'open' where id = target_event_id and status = 'full';
  return 'joined';
end;
$$;

drop function if exists public.leave_sport_event(uuid);
create function public.leave_sport_event(target_event_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  current_user_id uuid := auth.uid();
  event_row public.sport_events%rowtype;
  promoted_user_id uuid;
begin
  if current_user_id is null then
    raise exception 'You must be signed in to leave events.';
  end if;

  select * into event_row from public.sport_events where id = target_event_id for update;
  if event_row.id is null then
    raise exception 'Event not found.';
  end if;

  delete from public.event_attendees
  where event_id = target_event_id and user_id = current_user_id;

  update public.event_waitlist
  set status = 'cancelled'
  where event_id = target_event_id and user_id = current_user_id and status = 'waiting';

  select user_id into promoted_user_id
  from public.event_waitlist
  where event_id = target_event_id and status = 'waiting'
  order by created_at
  limit 1
  for update skip locked;

  if promoted_user_id is not null then
    insert into public.event_attendees (event_id, user_id, status)
    values (target_event_id, promoted_user_id, 'going')
    on conflict (event_id, user_id) do update set status = 'going';

    update public.event_waitlist
    set status = 'promoted'
    where event_id = target_event_id and user_id = promoted_user_id;
  end if;

  update public.sport_events
  set status = 'open'
  where id = target_event_id and status = 'full';
end;
$$;

drop function if exists public.remove_event_attendee(uuid, uuid);
create function public.remove_event_attendee(target_event_id uuid, target_user_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  current_user_id uuid := auth.uid();
  event_row public.sport_events%rowtype;
  promoted_user_id uuid;
begin
  if current_user_id is null then
    raise exception 'You must be signed in to manage attendees.';
  end if;

  select * into event_row from public.sport_events where id = target_event_id for update;
  if event_row.id is null then
    raise exception 'Event not found.';
  end if;

  if event_row.organizer_id <> current_user_id and not public.current_user_is_admin() then
    raise exception 'Only the organizer can manage attendees.';
  end if;

  delete from public.event_attendees
  where event_id = target_event_id and user_id = target_user_id;

  select user_id into promoted_user_id
  from public.event_waitlist
  where event_id = target_event_id and status = 'waiting'
  order by created_at
  limit 1
  for update skip locked;

  if promoted_user_id is not null then
    insert into public.event_attendees (event_id, user_id, status)
    values (target_event_id, promoted_user_id, 'going')
    on conflict (event_id, user_id) do update set status = 'going';

    update public.event_waitlist
    set status = 'promoted'
    where event_id = target_event_id and user_id = promoted_user_id;
  end if;

  update public.sport_events
  set status = 'open'
  where id = target_event_id and status = 'full';
end;
$$;

drop function if exists public.update_court_booking_status(uuid, text);
create function public.update_court_booking_status(target_booking_id uuid, target_status text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null or not public.current_user_is_admin() then
    raise exception 'Only admins can manage court bookings.';
  end if;

  if target_status not in ('pending', 'confirmed', 'cancelled') then
    raise exception 'Invalid booking status.';
  end if;

  update public.court_bookings
  set status = target_status
  where id = target_booking_id;
end;
$$;

drop policy if exists "event waitlist readable by participants and organizers" on public.event_waitlist;
create policy "event waitlist readable by participants and organizers" on public.event_waitlist
  for select using (
    auth.uid() = user_id
    or exists (select 1 from public.sport_events e where e.id = event_id and e.organizer_id = auth.uid())
    or public.current_user_is_admin()
  );
drop policy if exists "users manage own event waitlist rows" on public.event_waitlist;
create policy "users manage own event waitlist rows" on public.event_waitlist
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "community invite participants read" on public.community_invites;
create policy "community invite participants read" on public.community_invites
  for select using (
    auth.uid() in (inviter_id, invitee_id)
    or exists (
      select 1 from public.community_members m
      where m.community_id = public.community_invites.community_id
        and m.user_id = auth.uid()
        and m.role in ('owner', 'admin')
    )
  );
drop policy if exists "community admins create invites" on public.community_invites;
create policy "community admins create invites" on public.community_invites
  for insert with check (
    auth.uid() = inviter_id
    and exists (
      select 1 from public.community_members m
      where m.community_id = public.community_invites.community_id
        and m.user_id = auth.uid()
        and m.role in ('owner', 'admin')
    )
  );
drop policy if exists "invitees update own community invites" on public.community_invites;
create policy "invitees update own community invites" on public.community_invites
  for update using (auth.uid() = invitee_id and status = 'pending')
  with check (auth.uid() = invitee_id and status in ('accepted', 'declined'));

drop policy if exists "users read blocks involving them" on public.blocks;
create policy "users read blocks involving them" on public.blocks
  for select using (auth.uid() in (blocker_id, blocked_id));

drop policy if exists "admins read reports" on public.reports;
create policy "admins read reports" on public.reports
  for select using (public.current_user_is_admin());
drop policy if exists "admins update reports" on public.reports;
create policy "admins update reports" on public.reports
  for update using (public.current_user_is_admin()) with check (public.current_user_is_admin());

drop policy if exists "admins read all court bookings" on public.court_bookings;
create policy "admins read all court bookings" on public.court_bookings
  for select using (public.current_user_is_admin());
drop policy if exists "admins update all court bookings" on public.court_bookings;
create policy "admins update all court bookings" on public.court_bookings
  for update using (public.current_user_is_admin()) with check (public.current_user_is_admin());

grant execute on function public.request_or_follow_profile(uuid) to authenticated;
grant execute on function public.respond_to_follow_request(uuid, boolean) to authenticated;
grant execute on function public.create_group_conversation(text, uuid[]) to authenticated;
grant execute on function public.add_group_conversation_members(uuid, uuid[]) to authenticated;
grant execute on function public.remove_group_conversation_member(uuid, uuid) to authenticated;
grant execute on function public.invite_community_member(uuid, uuid) to authenticated;
grant execute on function public.respond_community_invite(uuid, boolean) to authenticated;
grant execute on function public.join_sport_event(uuid) to authenticated;
grant execute on function public.leave_sport_event(uuid) to authenticated;
grant execute on function public.remove_event_attendee(uuid, uuid) to authenticated;
grant execute on function public.update_court_booking_status(uuid, text) to authenticated;

do $$
begin
  if not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'event_waitlist'
  ) then
    execute 'alter publication supabase_realtime add table public.event_waitlist';
  end if;
end $$;
