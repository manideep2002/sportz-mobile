-- Event invitations and group-scoped event lifecycle.

do $$ begin
  create type public.event_invitation_status as enum ('pending', 'accepted', 'declined', 'revoked', 'expired');
exception when duplicate_object then null;
end $$;

alter table public.sport_events
  add column if not exists community_id uuid references public.communities(id) on delete set null;

create index if not exists sport_events_community_starts_idx
  on public.sport_events(community_id, starts_at)
  where community_id is not null;

create table if not exists public.event_invitations (
  id uuid primary key default public.uuid_generate_v7(),
  event_id uuid not null references public.sport_events(id) on delete cascade,
  invitee_id uuid not null references public.profiles(id) on delete cascade,
  inviter_id uuid not null references public.profiles(id) on delete cascade,
  status public.event_invitation_status not null default 'pending',
  expires_at timestamptz not null,
  responded_at timestamptz,
  revoked_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint event_invitations_unique_event_invitee unique (event_id, invitee_id),
  constraint event_invitations_no_self_invite check (invitee_id <> inviter_id)
);

drop trigger if exists event_invitations_set_updated_at on public.event_invitations;
create trigger event_invitations_set_updated_at
before update on public.event_invitations
for each row execute function public.set_updated_at();

create index if not exists event_invitations_invitee_pending_idx
  on public.event_invitations(invitee_id, expires_at, created_at desc)
  where status = 'pending';
create index if not exists event_invitations_event_status_idx
  on public.event_invitations(event_id, status, created_at desc);

alter table public.event_invitations enable row level security;

create or replace function public.can_access_sport_event(target_event_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce((
    select
      e.organizer_id = auth.uid()
      or public.current_user_is_admin()
      or (e.visibility = 'public')
      or (
        e.visibility = 'followers' and exists (
          select 1 from public.user_follows f
          where f.follower_id = auth.uid() and f.following_id = e.organizer_id
        )
      )
      or (
        e.visibility = 'group' and e.community_id is not null
        and public.is_community_member(e.community_id, auth.uid())
      )
      or exists (
        select 1 from public.event_invitations i
        where i.event_id = e.id
          and i.invitee_id = auth.uid()
          and i.status in ('pending', 'accepted')
          and i.expires_at > now()
      )
      or exists (
        select 1 from public.event_attendees a
        where a.event_id = e.id and a.user_id = auth.uid()
      )
      or exists (
        select 1 from public.event_waitlist w
        where w.event_id = e.id and w.user_id = auth.uid()
          and w.status in ('waiting', 'promoted')
      )
    from public.sport_events e where e.id = target_event_id
  ), false);
$$;

create or replace function public.can_view_sport_event(target_event_id uuid)
returns boolean
language sql stable security definer set search_path = public
as $$ select public.can_access_sport_event(target_event_id); $$;

drop policy if exists "visible events readable" on public.sport_events;
create policy "visible events readable" on public.sport_events
for select using (public.can_access_sport_event(id));

drop policy if exists "organizers update own events" on public.sport_events;
create policy "organizers and group admins update events" on public.sport_events
for update using (
  auth.uid() = organizer_id
  or (community_id is not null and public.is_community_admin(community_id))
) with check (
  auth.uid() = organizer_id
  or (community_id is not null and public.is_community_admin(community_id))
);

drop policy if exists "event invitations visible to participants" on public.event_invitations;
create policy "event invitations visible to participants" on public.event_invitations
for select using (
  auth.uid() = invitee_id
  or exists (select 1 from public.sport_events e where e.id = event_id and e.organizer_id = auth.uid())
  or exists (
    select 1 from public.sport_events e
    where e.id = event_id and e.community_id is not null and public.is_community_admin(e.community_id)
  )
);

create or replace function public.expire_event_invitations(target_event_id uuid default null)
returns integer
language plpgsql security definer set search_path = public
as $$
declare updated_count integer;
begin
  update public.event_invitations
  set status = 'expired', responded_at = coalesce(responded_at, now())
  where status = 'pending' and expires_at <= now()
    and (target_event_id is null or event_id = target_event_id);
  get diagnostics updated_count = row_count;
  return updated_count;
end;
$$;

create or replace function public.create_event_invitation(
  target_event_id uuid,
  target_invitee_id uuid,
  target_expires_at timestamptz default null
)
returns uuid
language plpgsql security definer set search_path = public
as $$
declare
  current_user_id uuid := auth.uid();
  event_row public.sport_events%rowtype;
  invitation_id uuid;
  expiry timestamptz;
  inviter_name text;
begin
  if current_user_id is null then raise exception 'You must be signed in to invite players.'; end if;
  select * into event_row from public.sport_events where id = target_event_id for update;
  if event_row.id is null then raise exception 'Event not found.'; end if;
  if event_row.organizer_id <> current_user_id
    and not (event_row.community_id is not null and public.is_community_admin(event_row.community_id))
    and not public.current_user_is_admin() then
    raise exception 'Only the organizer or a group admin can invite players.';
  end if;
  if event_row.visibility <> 'invite' then raise exception 'Invitations are available only for invite-only events.'; end if;
  if target_invitee_id = current_user_id then raise exception 'You cannot invite yourself.'; end if;
  if event_row.community_id is not null and not public.is_community_member(event_row.community_id, target_invitee_id) then
    raise exception 'Only group members can be invited to this group event.';
  end if;
  if public.users_blocked_each_other(current_user_id, target_invitee_id) then raise exception 'You cannot invite this player.'; end if;
  if exists (select 1 from public.event_attendees where event_id = target_event_id and user_id = target_invitee_id and status = 'going') then
    raise exception 'This player is already attending.';
  end if;
  expiry := coalesce(target_expires_at, least(event_row.starts_at, now() + interval '14 days'));
  if expiry <= now() or expiry > event_row.starts_at then raise exception 'Invitation expiry must be before the event starts.'; end if;
  insert into public.event_invitations (event_id, invitee_id, inviter_id, status, expires_at, responded_at, revoked_at)
  values (target_event_id, target_invitee_id, current_user_id, 'pending', expiry, null, null)
  on conflict (event_id, invitee_id) do update set
    inviter_id = excluded.inviter_id, status = 'pending', expires_at = excluded.expires_at,
    responded_at = null, revoked_at = null, updated_at = now()
  where public.event_invitations.status in ('declined', 'revoked', 'expired')
  returning id into invitation_id;
  if invitation_id is null then raise exception 'This player already has an active invitation.'; end if;
  select display_name into inviter_name from public.profiles where id = current_user_id;
  perform public.upsert_notification_bundle(
    target_invitee_id, current_user_id, 'invite',
    coalesce(inviter_name, 'A player') || ' invited you to ' || event_row.title,
    'Respond before the invitation expires.', 'event', target_event_id,
    jsonb_build_object('inviteId', invitation_id::text, 'inviteType', 'event', 'eventId', target_event_id::text, 'screen', '/event/[id]'),
    'event_invitation:' || invitation_id::text, false
  );
  return invitation_id;
end;
$$;

create or replace function public.respond_to_event_invitation(target_invitation_id uuid, accept_invitation boolean)
returns text
language plpgsql security definer set search_path = public
as $$
declare invitation_row public.event_invitations%rowtype; join_result text;
begin
  if auth.uid() is null then raise exception 'You must be signed in to respond to invitations.'; end if;
  select * into invitation_row from public.event_invitations where id = target_invitation_id for update;
  if invitation_row.id is null or invitation_row.invitee_id <> auth.uid() then raise exception 'Invitation not found.'; end if;
  if invitation_row.status <> 'pending' then return invitation_row.status::text; end if;
  if invitation_row.expires_at <= now() then
    update public.event_invitations set status = 'expired', responded_at = now() where id = invitation_row.id;
    return 'expired';
  end if;
  if not accept_invitation then
    update public.event_invitations set status = 'declined', responded_at = now() where id = invitation_row.id;
    return 'declined';
  end if;
  update public.event_invitations set status = 'accepted', responded_at = now() where id = invitation_row.id;
  join_result := public.join_sport_event(invitation_row.event_id);
  return join_result;
end;
$$;

create or replace function public.revoke_event_invitation(target_invitation_id uuid)
returns void
language plpgsql security definer set search_path = public
as $$
declare invitation_row public.event_invitations%rowtype; event_row public.sport_events%rowtype;
begin
  if auth.uid() is null then raise exception 'You must be signed in to revoke invitations.'; end if;
  select * into invitation_row from public.event_invitations where id = target_invitation_id for update;
  if invitation_row.id is null then raise exception 'Invitation not found.'; end if;
  select * into event_row from public.sport_events where id = invitation_row.event_id;
  if event_row.organizer_id <> auth.uid()
    and not (event_row.community_id is not null and public.is_community_admin(event_row.community_id))
    and not public.current_user_is_admin() then raise exception 'Only the organizer or a group admin can revoke invitations.'; end if;
  if invitation_row.status = 'pending' then
    update public.event_invitations set status = 'revoked', revoked_at = now(), responded_at = now() where id = invitation_row.id;
  end if;
end;
$$;

create or replace function public.get_my_event_invitation(target_event_id uuid)
returns table(id uuid, status public.event_invitation_status, expires_at timestamptz)
language plpgsql security definer set search_path = public
as $$
begin
  perform public.expire_event_invitations(target_event_id);
  return query select i.id, i.status, i.expires_at from public.event_invitations i
    where i.event_id = target_event_id and i.invitee_id = auth.uid();
end;
$$;

create or replace function public.list_community_sport_events(target_community_id uuid)
returns setof public.sport_events
language sql stable security definer set search_path = public
as $$
  select e.* from public.sport_events e
  where e.community_id = target_community_id and e.ends_at >= now()
    and public.can_access_sport_event(e.id)
  order by e.starts_at asc;
$$;

create or replace function public.create_sport_event(
  target_title text, target_event_type text, target_sport text, target_description text,
  target_cover_url text, target_starts_at timestamptz, target_ends_at timestamptz,
  target_location_name text, target_city text, target_latitude double precision default null,
  target_longitude double precision default null, target_max_players integer default 2,
  target_entry_fee_cents integer default 0, target_visibility public.sportz_visibility default 'public',
  target_community_id uuid default null
)
returns uuid language plpgsql security definer set search_path = public
as $$
declare current_user_id uuid := auth.uid(); new_event_id uuid;
begin
  if current_user_id is null then raise exception 'You must be signed in to create events.'; end if;
  if target_title is null or length(btrim(target_title)) = 0 then raise exception 'Please enter an event title.'; end if;
  if target_event_type is null or length(btrim(target_event_type)) = 0 then raise exception 'Please choose an event type.'; end if;
  if target_sport is null or length(btrim(target_sport)) = 0 then raise exception 'Please choose a sport.'; end if;
  if target_location_name is null or length(btrim(target_location_name)) = 0 then raise exception 'Please enter a location.'; end if;
  if target_city is null or length(btrim(target_city)) = 0 then raise exception 'Please enter a city.'; end if;
  if target_starts_at is null or target_ends_at is null or target_ends_at <= target_starts_at or target_starts_at <= now() then raise exception 'Enter a valid future event time.'; end if;
  if coalesce(target_max_players, 0) < 2 then raise exception 'Max players must be at least 2.'; end if;
  if coalesce(target_entry_fee_cents, 0) < 0 then raise exception 'Entry fee must be 0 or a positive amount.'; end if;
  if target_community_id is not null and not public.is_community_member(target_community_id, current_user_id) then raise exception 'Only group members can schedule group events.'; end if;
  if target_community_id is not null then target_visibility := 'group'; end if;
  if target_visibility = 'group' and target_community_id is null then raise exception 'Group events require a community.'; end if;
  insert into public.sport_events (organizer_id, community_id, title, event_type, sport, description, cover_url, starts_at, ends_at, location_name, city, latitude, longitude, max_players, entry_fee_cents, currency, visibility, status)
  values (current_user_id, target_community_id, btrim(target_title), btrim(target_event_type), btrim(target_sport), coalesce(target_description, ''), target_cover_url, target_starts_at, target_ends_at, btrim(target_location_name), btrim(target_city), target_latitude, target_longitude, target_max_players, coalesce(target_entry_fee_cents,0), 'INR', coalesce(target_visibility,'public'), 'open') returning id into new_event_id;
  insert into public.event_attendees (event_id, user_id, status) values (new_event_id, current_user_id, 'going');
  return new_event_id;
end;
$$;

revoke all on function public.create_event_invitation(uuid, uuid, timestamptz) from public, anon;
revoke all on function public.respond_to_event_invitation(uuid, boolean) from public, anon;
revoke all on function public.revoke_event_invitation(uuid) from public, anon;
revoke all on function public.get_my_event_invitation(uuid) from public, anon;
grant execute on function public.can_access_sport_event(uuid) to anon, authenticated;
grant execute on function public.create_event_invitation(uuid, uuid, timestamptz) to authenticated;
grant execute on function public.respond_to_event_invitation(uuid, boolean) to authenticated;
grant execute on function public.revoke_event_invitation(uuid) to authenticated;
grant execute on function public.get_my_event_invitation(uuid) to authenticated;
grant execute on function public.list_community_sport_events(uuid) to authenticated;
grant execute on function public.create_sport_event(text, text, text, text, text, timestamptz, timestamptz, text, text, double precision, double precision, integer, integer, public.sportz_visibility, uuid) to authenticated;
