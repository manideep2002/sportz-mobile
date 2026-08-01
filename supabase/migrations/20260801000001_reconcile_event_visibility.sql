-- Keep public events as a first-class mode while making discovery and
-- participation authorization agree for every visibility.

alter table public.sport_events
  drop constraint if exists sport_events_visibility_scope_valid;
alter table public.sport_events
  add constraint sport_events_visibility_scope_valid check (
    (community_id is null and visibility in ('public', 'followers', 'invite'))
    or
    (community_id is not null and visibility in ('group', 'invite'))
  ) not valid;

create or replace function public.can_participate_sport_event(target_event_id uuid)
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
      or e.visibility = 'public'
      or (
        e.visibility = 'followers'
        and exists (
          select 1 from public.user_follows f
          where f.follower_id = auth.uid()
            and f.following_id = e.organizer_id
        )
      )
      or (
        e.visibility = 'group'
        and e.community_id is not null
        and public.is_community_member(e.community_id, auth.uid())
      )
      or (
        e.visibility = 'invite'
        and exists (
          select 1 from public.event_invitations i
          where i.event_id = e.id
            and i.invitee_id = auth.uid()
            and i.status = 'accepted'
            and i.expires_at > now()
        )
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
    from public.sport_events e
    where e.id = target_event_id
  ), false);
$$;

create or replace function public.join_sport_event(target_event_id uuid)
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

  select * into event_row
  from public.sport_events
  where id = target_event_id
  for update;

  if event_row.id is null then raise exception 'Event not found.'; end if;
  if event_row.status = 'cancelled' then raise exception 'This event has been cancelled.'; end if;
  if event_row.status not in ('open', 'full') then raise exception 'This event is not open for joins.'; end if;

  if exists (
    select 1 from public.event_attendees
    where event_id = target_event_id and user_id = current_user_id and status = 'going'
  ) then
    return 'going';
  end if;

  if exists (
    select 1 from public.event_waitlist
    where event_id = target_event_id and user_id = current_user_id and status = 'waiting'
  ) then
    return 'waitlisted';
  end if;

  if not public.can_participate_sport_event(target_event_id) then
    if event_row.visibility = 'followers' then
      raise exception 'Only the organizer''s followers can join this event.';
    elsif event_row.visibility = 'group' then
      raise exception 'Only group members can join this event.';
    elsif event_row.visibility = 'invite' then
      raise exception 'Accept an active invitation before joining this event.';
    end if;
    raise exception 'This event is not open for joins.';
  end if;

  select count(*) into going_count
  from public.event_attendees
  where event_id = target_event_id and status = 'going';

  if going_count >= event_row.max_players then
    delete from public.event_attendees
    where event_id = target_event_id and user_id = current_user_id and status <> 'going';

    insert into public.event_waitlist(event_id, user_id, status)
    values(target_event_id, current_user_id, 'waiting')
    on conflict(event_id, user_id) do update set status = 'waiting', created_at = now();
    perform public.set_sport_event_capacity_status(target_event_id);
    return 'waitlisted';
  end if;

  insert into public.event_attendees(event_id, user_id, status)
  values(target_event_id, current_user_id, 'going')
  on conflict(event_id, user_id) do update set status = 'going';

  update public.event_waitlist set status = 'cancelled'
  where event_id = target_event_id and user_id = current_user_id and status = 'waiting';
  perform public.set_sport_event_capacity_status(target_event_id);
  return 'going';
end;
$$;

create or replace function public.set_sport_event_rsvp(
  target_event_id uuid,
  target_status public.sportz_rsvp_status
)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  current_user_id uuid := auth.uid();
  event_row public.sport_events%rowtype;
begin
  if current_user_id is null then raise exception 'You must be signed in to RSVP.'; end if;
  if target_status = 'going' then return public.join_sport_event(target_event_id); end if;

  select * into event_row from public.sport_events where id = target_event_id for update;
  if event_row.id is null then raise exception 'Event not found.'; end if;
  if event_row.status = 'cancelled' then raise exception 'This event has been cancelled.'; end if;
  if not public.can_participate_sport_event(target_event_id) then
    raise exception 'You cannot RSVP to this event.';
  end if;

  update public.event_waitlist set status = 'cancelled'
  where event_id = target_event_id and user_id = current_user_id and status = 'waiting';
  insert into public.event_attendees(event_id, user_id, status)
  values(target_event_id, current_user_id, target_status)
  on conflict(event_id, user_id) do update set status = excluded.status;
  perform public.set_sport_event_capacity_status(target_event_id);
  return target_status::text;
end;
$$;

revoke all on function public.can_participate_sport_event(uuid) from public, anon;
revoke all on function public.join_sport_event(uuid) from public, anon;
revoke all on function public.set_sport_event_rsvp(uuid, public.sportz_rsvp_status) from public, anon;
grant execute on function public.can_participate_sport_event(uuid) to authenticated;
grant execute on function public.join_sport_event(uuid) to authenticated;
grant execute on function public.set_sport_event_rsvp(uuid, public.sportz_rsvp_status) to authenticated;
