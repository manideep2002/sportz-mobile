-- Complete the event participation and waitlist lifecycle.
-- All capacity-changing mutations are serialized by locking sport_events rows.

create unique index if not exists event_waitlist_one_active_user_idx
  on public.event_waitlist(event_id, user_id)
  where status = 'waiting';

create index if not exists event_attendees_event_going_idx
  on public.event_attendees(event_id, created_at, id)
  where status = 'going';

create or replace function public.set_sport_event_capacity_status(target_event_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  current_count integer;
  event_capacity integer;
begin
  select max_players
  into event_capacity
  from public.sport_events
  where id = target_event_id;

  if event_capacity is null then
    return;
  end if;

  select count(*)
  into current_count
  from public.event_attendees
  where event_id = target_event_id
    and status = 'going';

  update public.sport_events
  set status = case
    when current_count >= event_capacity then 'full'::public.sportz_event_status
    else 'open'::public.sportz_event_status
  end
  where id = target_event_id
    and status in ('open', 'full');
end;
$$;

create or replace function public.notify_event_waitlist_promotion(
  target_event_id uuid,
  target_user_id uuid
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  event_row public.sport_events%rowtype;
begin
  select *
  into event_row
  from public.sport_events
  where id = target_event_id;

  if event_row.id is null then
    return;
  end if;

  perform public.upsert_notification_bundle(
    target_user_id,
    event_row.organizer_id,
    'event',
    'You are in!',
    event_row.title || ' has a spot for you. You are now going.',
    'event',
    target_event_id,
    jsonb_build_object(
      'eventId', target_event_id::text,
      'participationStatus', 'going',
      'source', 'waitlist_promotion'
    ),
    'event_waitlist_promotion:event:' || target_event_id::text || ':user:' || target_user_id::text,
    false
  );
end;
$$;

create or replace function public.promote_event_waitlist_locked(
  target_event_id uuid,
  preferred_user_id uuid default null,
  promotion_limit integer default null
)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  event_row public.sport_events%rowtype;
  waitlist_row public.event_waitlist%rowtype;
  going_count integer;
  available_spaces integer;
  promoted_count integer := 0;
  selected_user_id uuid := preferred_user_id;
begin
  select *
  into event_row
  from public.sport_events
  where id = target_event_id
  for update;

  if event_row.id is null or event_row.status not in ('open', 'full') then
    return 0;
  end if;

  -- Repair stale legacy rows without notifying somebody who is already going.
  update public.event_waitlist w
  set status = 'promoted'
  where w.event_id = target_event_id
    and w.status = 'waiting'
    and exists (
      select 1
      from public.event_attendees a
      where a.event_id = w.event_id
        and a.user_id = w.user_id
        and a.status = 'going'
    );

  select count(*)
  into going_count
  from public.event_attendees
  where event_id = target_event_id
    and status = 'going';

  available_spaces := greatest(event_row.max_players - going_count, 0);

  while available_spaces > 0
    and (promotion_limit is null or promoted_count < promotion_limit)
  loop
    waitlist_row := null;

    if selected_user_id is not null then
      select *
      into waitlist_row
      from public.event_waitlist
      where event_id = target_event_id
        and user_id = selected_user_id
        and status = 'waiting'
      for update;
    else
      select *
      into waitlist_row
      from public.event_waitlist
      where event_id = target_event_id
        and status = 'waiting'
      order by created_at, id
      limit 1
      for update;
    end if;

    if waitlist_row.id is null then
      exit;
    end if;

    insert into public.event_attendees (event_id, user_id, status)
    values (target_event_id, waitlist_row.user_id, 'going')
    on conflict (event_id, user_id) do update
      set status = 'going';

    update public.event_waitlist
    set status = 'promoted'
    where id = waitlist_row.id
      and status = 'waiting';

    if found then
      perform public.notify_event_waitlist_promotion(target_event_id, waitlist_row.user_id);
      promoted_count := promoted_count + 1;
      available_spaces := available_spaces - 1;
    end if;

    -- A preferred user applies only to the first promotion.
    selected_user_id := null;
  end loop;

  perform public.set_sport_event_capacity_status(target_event_id);
  return promoted_count;
end;
$$;

create or replace function public.enforce_event_attendee_capacity()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  event_capacity integer;
  existing_going integer;
  attendee_to_exclude uuid;
begin
  if new.status <> 'going' then
    return new;
  end if;

  if tg_op = 'UPDATE'
    and old.status = 'going'
    and old.event_id = new.event_id then
    return new;
  end if;

  if tg_op = 'UPDATE' then
    attendee_to_exclude := old.id;
  end if;

  select max_players
  into event_capacity
  from public.sport_events
  where id = new.event_id
  for update;

  if event_capacity is null then
    raise exception 'Event not found.';
  end if;

  select count(*)
  into existing_going
  from public.event_attendees
  where event_id = new.event_id
    and status = 'going'
    and (attendee_to_exclude is null or id <> attendee_to_exclude);

  if existing_going >= event_capacity then
    raise exception 'Event capacity has been reached.';
  end if;

  return new;
end;
$$;

drop trigger if exists event_attendees_enforce_capacity on public.event_attendees;
create trigger event_attendees_enforce_capacity
before insert or update of event_id, status on public.event_attendees
for each row execute function public.enforce_event_attendee_capacity();

create or replace function public.fill_event_vacancy_after_attendee_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'DELETE' then
    if old.status = 'going' then
      perform public.promote_event_waitlist_locked(old.event_id);
    else
      perform public.set_sport_event_capacity_status(old.event_id);
    end if;
    return old;
  end if;

  if old.status = 'going'
    and (new.status <> 'going' or new.event_id <> old.event_id) then
    perform public.promote_event_waitlist_locked(old.event_id);
  end if;

  if new.status = 'going' then
    perform public.set_sport_event_capacity_status(new.event_id);
  end if;

  return new;
end;
$$;

drop trigger if exists event_attendees_fill_vacancy on public.event_attendees;
create trigger event_attendees_fill_vacancy
after delete or update of event_id, status on public.event_attendees
for each row execute function public.fill_event_vacancy_after_attendee_change();

create or replace function public.guard_sport_event_capacity_update()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  going_count integer;
begin
  select count(*)
  into going_count
  from public.event_attendees
  where event_id = old.id
    and status = 'going';

  if new.max_players < going_count then
    raise exception 'Max players cannot be lower than the current attendee count (%).', going_count;
  end if;

  return new;
end;
$$;

drop trigger if exists sport_events_guard_capacity_update on public.sport_events;
create trigger sport_events_guard_capacity_update
before update of max_players on public.sport_events
for each row
when (old.max_players is distinct from new.max_players)
execute function public.guard_sport_event_capacity_update();

create or replace function public.fill_waitlist_after_capacity_update()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.promote_event_waitlist_locked(new.id);
  perform public.set_sport_event_capacity_status(new.id);
  return new;
end;
$$;

drop trigger if exists sport_events_fill_waitlist_after_capacity_update on public.sport_events;
create trigger sport_events_fill_waitlist_after_capacity_update
after update of max_players on public.sport_events
for each row
when (old.max_players is distinct from new.max_players)
execute function public.fill_waitlist_after_capacity_update();

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

  select *
  into event_row
  from public.sport_events
  where id = target_event_id
  for update;

  if event_row.id is null then
    raise exception 'Event not found.';
  end if;

  if event_row.status = 'cancelled' then
    raise exception 'This event has been cancelled.';
  end if;

  if event_row.status not in ('open', 'full') then
    raise exception 'This event is not open for joins.';
  end if;

  if not public.can_discover_sport_event(event_row.organizer_id, event_row.visibility) then
    if event_row.visibility = 'followers' then
      raise exception 'Only the organizer''s followers can join this event.';
    end if;
    raise exception 'This private event is not open for joins.';
  end if;

  if exists (
    select 1
    from public.event_attendees
    where event_id = target_event_id
      and user_id = current_user_id
      and status = 'going'
  ) then
    return 'going';
  end if;

  if exists (
    select 1
    from public.event_waitlist
    where event_id = target_event_id
      and user_id = current_user_id
      and status = 'waiting'
  ) then
    return 'waitlisted';
  end if;

  select count(*)
  into going_count
  from public.event_attendees
  where event_id = target_event_id
    and status = 'going';

  if going_count >= event_row.max_players then
    delete from public.event_attendees
    where event_id = target_event_id
      and user_id = current_user_id
      and status <> 'going';

    insert into public.event_waitlist (event_id, user_id, status)
    values (target_event_id, current_user_id, 'waiting')
    on conflict (event_id, user_id) do update
      set status = 'waiting',
          created_at = now();

    perform public.set_sport_event_capacity_status(target_event_id);
    return 'waitlisted';
  end if;

  insert into public.event_attendees (event_id, user_id, status)
  values (target_event_id, current_user_id, 'going')
  on conflict (event_id, user_id) do update
    set status = 'going';

  update public.event_waitlist
  set status = 'cancelled'
  where event_id = target_event_id
    and user_id = current_user_id
    and status = 'waiting';

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
  if current_user_id is null then
    raise exception 'You must be signed in to RSVP.';
  end if;

  if target_status = 'going' then
    return public.join_sport_event(target_event_id);
  end if;

  select *
  into event_row
  from public.sport_events
  where id = target_event_id
  for update;

  if event_row.id is null then
    raise exception 'Event not found.';
  end if;

  if event_row.status = 'cancelled' then
    raise exception 'This event has been cancelled.';
  end if;

  if not public.can_view_sport_event(target_event_id) then
    raise exception 'You cannot RSVP to this event.';
  end if;

  update public.event_waitlist
  set status = 'cancelled'
  where event_id = target_event_id
    and user_id = current_user_id
    and status = 'waiting';

  insert into public.event_attendees (event_id, user_id, status)
  values (target_event_id, current_user_id, target_status)
  on conflict (event_id, user_id) do update
    set status = excluded.status;

  perform public.set_sport_event_capacity_status(target_event_id);
  return target_status::text;
end;
$$;

create or replace function public.leave_sport_event(target_event_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  current_user_id uuid := auth.uid();
  event_row public.sport_events%rowtype;
begin
  if current_user_id is null then
    raise exception 'You must be signed in to leave events.';
  end if;

  select *
  into event_row
  from public.sport_events
  where id = target_event_id
  for update;

  if event_row.id is null then
    raise exception 'Event not found.';
  end if;

  delete from public.event_attendees
  where event_id = target_event_id
    and user_id = current_user_id;

  update public.event_waitlist
  set status = 'cancelled'
  where event_id = target_event_id
    and user_id = current_user_id
    and status = 'waiting';

  perform public.promote_event_waitlist_locked(target_event_id);
  perform public.set_sport_event_capacity_status(target_event_id);
end;
$$;

create or replace function public.leave_event_waitlist(target_event_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  current_user_id uuid := auth.uid();
  event_row public.sport_events%rowtype;
begin
  if current_user_id is null then
    raise exception 'You must be signed in to leave an event waitlist.';
  end if;

  select *
  into event_row
  from public.sport_events
  where id = target_event_id
  for update;

  if event_row.id is null then
    raise exception 'Event not found.';
  end if;

  update public.event_waitlist
  set status = 'cancelled'
  where event_id = target_event_id
    and user_id = current_user_id
    and status = 'waiting';
end;
$$;

create or replace function public.remove_event_attendee(
  target_event_id uuid,
  target_user_id uuid
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  current_user_id uuid := auth.uid();
  event_row public.sport_events%rowtype;
begin
  if current_user_id is null then
    raise exception 'You must be signed in to manage attendees.';
  end if;

  select *
  into event_row
  from public.sport_events
  where id = target_event_id
  for update;

  if event_row.id is null then
    raise exception 'Event not found.';
  end if;

  if event_row.organizer_id <> current_user_id and not public.current_user_is_admin() then
    raise exception 'Only the organizer can manage attendees.';
  end if;

  if target_user_id = event_row.organizer_id then
    raise exception 'The event organizer cannot be removed.';
  end if;

  delete from public.event_attendees
  where event_id = target_event_id
    and user_id = target_user_id;

  perform public.promote_event_waitlist_locked(target_event_id);
  perform public.set_sport_event_capacity_status(target_event_id);
end;
$$;

create or replace function public.remove_event_waitlist_user(
  target_event_id uuid,
  target_user_id uuid
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  current_user_id uuid := auth.uid();
  event_row public.sport_events%rowtype;
begin
  if current_user_id is null then
    raise exception 'You must be signed in to manage the waitlist.';
  end if;

  select *
  into event_row
  from public.sport_events
  where id = target_event_id
  for update;

  if event_row.id is null then
    raise exception 'Event not found.';
  end if;

  if event_row.organizer_id <> current_user_id and not public.current_user_is_admin() then
    raise exception 'Only the organizer can manage the waitlist.';
  end if;

  update public.event_waitlist
  set status = 'cancelled'
  where event_id = target_event_id
    and user_id = target_user_id
    and status = 'waiting';
end;
$$;

create or replace function public.promote_event_waitlist_user(
  target_event_id uuid,
  target_user_id uuid
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  current_user_id uuid := auth.uid();
  event_row public.sport_events%rowtype;
  going_count integer;
  promoted integer;
begin
  if current_user_id is null then
    raise exception 'You must be signed in to manage the waitlist.';
  end if;

  select *
  into event_row
  from public.sport_events
  where id = target_event_id
  for update;

  if event_row.id is null then
    raise exception 'Event not found.';
  end if;

  if event_row.organizer_id <> current_user_id and not public.current_user_is_admin() then
    raise exception 'Only the organizer can promote waitlisted users.';
  end if;

  if not exists (
    select 1
    from public.event_waitlist
    where event_id = target_event_id
      and user_id = target_user_id
      and status = 'waiting'
  ) then
    raise exception 'This user is not actively waitlisted.';
  end if;

  select count(*)
  into going_count
  from public.event_attendees
  where event_id = target_event_id
    and status = 'going';

  if going_count >= event_row.max_players then
    raise exception 'No event space is available for manual promotion.';
  end if;

  promoted := public.promote_event_waitlist_locked(target_event_id, target_user_id, 1);
  if promoted <> 1 then
    raise exception 'The waitlisted user could not be promoted.';
  end if;
end;
$$;

create or replace function public.get_event_participation_status(target_event_id uuid)
returns text
language sql
stable
security definer
set search_path = public
as $$
  select case
    when auth.uid() is null then 'none'
    when exists (
      select 1
      from public.event_attendees a
      where a.event_id = target_event_id
        and a.user_id = auth.uid()
        and a.status = 'going'
    ) then 'going'
    when exists (
      select 1
      from public.event_waitlist w
      where w.event_id = target_event_id
        and w.user_id = auth.uid()
        and w.status = 'waiting'
    ) then 'waitlisted'
    else coalesce((
      select a.status::text
      from public.event_attendees a
      where a.event_id = target_event_id
        and a.user_id = auth.uid()
      limit 1
    ), 'none')
  end;
$$;

create or replace function public.get_event_participation_statuses(target_event_ids uuid[])
returns table(event_id uuid, participation_status text)
language sql
stable
security definer
set search_path = public
as $$
  with requested_events as (
    select distinct unnest(coalesce(target_event_ids, array[]::uuid[])) as event_id
  )
  select
    requested_events.event_id,
    case
      when auth.uid() is null then 'none'
      when exists (
        select 1
        from public.event_attendees a
        where a.event_id = requested_events.event_id
          and a.user_id = auth.uid()
          and a.status = 'going'
      ) then 'going'
      when exists (
        select 1
        from public.event_waitlist w
        where w.event_id = requested_events.event_id
          and w.user_id = auth.uid()
          and w.status = 'waiting'
      ) then 'waitlisted'
      else coalesce((
        select a.status::text
        from public.event_attendees a
        where a.event_id = requested_events.event_id
          and a.user_id = auth.uid()
        limit 1
      ), 'none')
    end as participation_status
  from requested_events;
$$;

-- All attendee and waitlist writes must pass through the locked RPCs above.
drop policy if exists "users manage own rsvp" on public.event_attendees;
drop policy if exists "users manage own event waitlist rows" on public.event_waitlist;

revoke all on function public.set_sport_event_capacity_status(uuid) from public, anon, authenticated;
revoke all on function public.notify_event_waitlist_promotion(uuid, uuid) from public, anon, authenticated;
revoke all on function public.promote_event_waitlist_locked(uuid, uuid, integer) from public, anon, authenticated;
revoke all on function public.enforce_event_attendee_capacity() from public, anon, authenticated;
revoke all on function public.fill_event_vacancy_after_attendee_change() from public, anon, authenticated;
revoke all on function public.guard_sport_event_capacity_update() from public, anon, authenticated;
revoke all on function public.fill_waitlist_after_capacity_update() from public, anon, authenticated;

revoke all on function public.join_sport_event(uuid) from public, anon;
revoke all on function public.set_sport_event_rsvp(uuid, public.sportz_rsvp_status) from public, anon;
revoke all on function public.leave_sport_event(uuid) from public, anon;
revoke all on function public.leave_event_waitlist(uuid) from public, anon;
revoke all on function public.remove_event_attendee(uuid, uuid) from public, anon;
revoke all on function public.remove_event_waitlist_user(uuid, uuid) from public, anon;
revoke all on function public.promote_event_waitlist_user(uuid, uuid) from public, anon;
revoke all on function public.get_event_participation_status(uuid) from public, anon;
revoke all on function public.get_event_participation_statuses(uuid[]) from public, anon;

grant execute on function public.join_sport_event(uuid) to authenticated;
grant execute on function public.set_sport_event_rsvp(uuid, public.sportz_rsvp_status) to authenticated;
grant execute on function public.leave_sport_event(uuid) to authenticated;
grant execute on function public.leave_event_waitlist(uuid) to authenticated;
grant execute on function public.remove_event_attendee(uuid, uuid) to authenticated;
grant execute on function public.remove_event_waitlist_user(uuid, uuid) to authenticated;
grant execute on function public.promote_event_waitlist_user(uuid, uuid) to authenticated;
grant execute on function public.get_event_participation_status(uuid) to authenticated;
grant execute on function public.get_event_participation_statuses(uuid[]) to authenticated;
