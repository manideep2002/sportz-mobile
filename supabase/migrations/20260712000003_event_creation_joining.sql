-- Complete event creation/joining semantics:
-- persist event type, enforce event validation, and make visibility drive reads/joins.

alter table public.sport_events
  add column if not exists event_type text not null default 'Pickup Game';

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'sport_events_event_type_not_blank') then
    alter table public.sport_events
      add constraint sport_events_event_type_not_blank check (length(btrim(event_type)) > 0) not valid;
  end if;

  if not exists (select 1 from pg_constraint where conname = 'sport_events_title_not_blank') then
    alter table public.sport_events
      add constraint sport_events_title_not_blank check (length(btrim(title)) > 0) not valid;
  end if;

  if not exists (select 1 from pg_constraint where conname = 'sport_events_location_not_blank') then
    alter table public.sport_events
      add constraint sport_events_location_not_blank check (length(btrim(location_name)) > 0) not valid;
  end if;

  if not exists (select 1 from pg_constraint where conname = 'sport_events_valid_time') then
    alter table public.sport_events
      add constraint sport_events_valid_time check (ends_at > starts_at) not valid;
  end if;

  if not exists (select 1 from pg_constraint where conname = 'sport_events_min_players') then
    alter table public.sport_events
      add constraint sport_events_min_players check (max_players >= 2) not valid;
  end if;

  if not exists (select 1 from pg_constraint where conname = 'sport_events_nonnegative_entry_fee') then
    alter table public.sport_events
      add constraint sport_events_nonnegative_entry_fee check (entry_fee_cents >= 0) not valid;
  end if;
end $$;

create index if not exists sport_events_visibility_starts_idx
  on public.sport_events(visibility, starts_at);

create index if not exists sport_events_organizer_visibility_idx
  on public.sport_events(organizer_id, visibility);

create or replace function public.can_discover_sport_event(
  event_organizer_id uuid,
  event_visibility public.sportz_visibility
)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select
    event_visibility = 'public'
    or auth.uid() = event_organizer_id
    or public.current_user_is_admin()
    or (
      event_visibility = 'followers'
      and exists (
        select 1
        from public.follows f
        where f.follower_id = auth.uid()
          and f.following_id = event_organizer_id
      )
    );
$$;

create or replace function public.can_view_sport_event(target_event_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce((
    select
      public.can_discover_sport_event(e.organizer_id, e.visibility)
      or exists (
        select 1
        from public.event_attendees a
        where a.event_id = e.id
          and a.user_id = auth.uid()
      )
      or exists (
        select 1
        from public.event_waitlist w
        where w.event_id = e.id
          and w.user_id = auth.uid()
          and w.status in ('waiting', 'promoted')
      )
    from public.sport_events e
    where e.id = target_event_id
  ), false);
$$;

drop policy if exists "public events readable" on public.sport_events;
drop policy if exists "visible events readable" on public.sport_events;
create policy "visible events readable" on public.sport_events
  for select using (public.can_view_sport_event(id));

drop policy if exists "event attendees readable" on public.event_attendees;
drop policy if exists "visible event attendees readable" on public.event_attendees;
create policy "visible event attendees readable" on public.event_attendees
  for select using (
    auth.uid() = user_id
    or public.can_view_sport_event(event_id)
  );

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

  select * into event_row from public.sport_events where id = target_event_id for update;
  if event_row.id is null then
    raise exception 'Event not found.';
  end if;

  if event_row.status = 'cancelled' then
    raise exception 'This event has been cancelled.';
  end if;

  if event_row.status in ('live', 'completed') then
    raise exception 'This event is not open for joins.';
  end if;

  if event_row.status not in ('open', 'full') then
    raise exception 'This event is not open for joins.';
  end if;

  if exists (
    select 1 from public.event_attendees
    where event_id = target_event_id and user_id = current_user_id and status = 'going'
  ) then
    return 'joined';
  end if;

  if not public.can_discover_sport_event(event_row.organizer_id, event_row.visibility) then
    if event_row.visibility = 'followers' then
      raise exception 'Only the organizer''s followers can join this event.';
    end if;

    raise exception 'This private event is not open for joins.';
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

  update public.sport_events
  set status = case
    when going_count + 1 >= event_row.max_players then 'full'::public.sportz_event_status
    else 'open'::public.sportz_event_status
  end
  where id = target_event_id;

  return 'joined';
end;
$$;

grant execute on function public.can_discover_sport_event(uuid, public.sportz_visibility) to anon, authenticated;
grant execute on function public.can_view_sport_event(uuid) to anon, authenticated;
grant execute on function public.join_sport_event(uuid) to authenticated;
