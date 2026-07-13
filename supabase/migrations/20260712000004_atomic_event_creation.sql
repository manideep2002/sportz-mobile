-- Create events atomically so the event row and organizer RSVP cannot drift.

create or replace function public.create_sport_event(
  target_title text,
  target_event_type text,
  target_sport text,
  target_description text,
  target_cover_url text,
  target_starts_at timestamptz,
  target_ends_at timestamptz,
  target_location_name text,
  target_city text,
  target_latitude double precision default null,
  target_longitude double precision default null,
  target_max_players integer default 2,
  target_entry_fee_cents integer default 0,
  target_visibility public.sportz_visibility default 'public'
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  current_user_id uuid := auth.uid();
  new_event_id uuid;
begin
  if current_user_id is null then
    raise exception 'You must be signed in to create events.';
  end if;

  if target_title is null or length(btrim(target_title)) = 0 then
    raise exception 'Please enter an event title.';
  end if;

  if target_event_type is null or length(btrim(target_event_type)) = 0 then
    raise exception 'Please choose an event type.';
  end if;

  if target_sport is null or length(btrim(target_sport)) = 0 then
    raise exception 'Please choose a sport.';
  end if;

  if target_location_name is null or length(btrim(target_location_name)) = 0 then
    raise exception 'Please enter a location.';
  end if;

  if target_city is null or length(btrim(target_city)) = 0 then
    raise exception 'Please enter a city.';
  end if;

  if target_starts_at is null or target_ends_at is null or target_ends_at <= target_starts_at then
    raise exception 'Event end time must be after the start time.';
  end if;

  if target_starts_at <= now() then
    raise exception 'Event start time must be in the future.';
  end if;

  if coalesce(target_max_players, 0) < 2 then
    raise exception 'Max players must be at least 2.';
  end if;

  if coalesce(target_entry_fee_cents, 0) < 0 then
    raise exception 'Entry fee must be 0 or a positive amount.';
  end if;

  if target_visibility = 'group' then
    raise exception 'Group event visibility is not available yet.';
  end if;

  insert into public.sport_events (
    organizer_id,
    title,
    event_type,
    sport,
    description,
    cover_url,
    starts_at,
    ends_at,
    location_name,
    city,
    latitude,
    longitude,
    max_players,
    entry_fee_cents,
    currency,
    visibility,
    status
  )
  values (
    current_user_id,
    btrim(target_title),
    btrim(target_event_type),
    btrim(target_sport),
    coalesce(target_description, ''),
    target_cover_url,
    target_starts_at,
    target_ends_at,
    btrim(target_location_name),
    btrim(target_city),
    target_latitude,
    target_longitude,
    target_max_players,
    coalesce(target_entry_fee_cents, 0),
    'INR',
    coalesce(target_visibility, 'public'::public.sportz_visibility),
    'open'
  )
  returning id into new_event_id;

  insert into public.event_attendees (event_id, user_id, status)
  values (new_event_id, current_user_id, 'going')
  on conflict (event_id, user_id) do update set status = 'going';

  return new_event_id;
end;
$$;

grant execute on function public.create_sport_event(
  text,
  text,
  text,
  text,
  text,
  timestamptz,
  timestamptz,
  text,
  text,
  double precision,
  double precision,
  integer,
  integer,
  public.sportz_visibility
) to authenticated;
