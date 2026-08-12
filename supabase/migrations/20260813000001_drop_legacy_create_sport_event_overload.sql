-- Drop the legacy 14-parameter overload of create_sport_event that was
-- introduced in schema.sql before community-scoped events were added.
-- The migration 20260724000002/3 introduced the current 15-parameter version
-- (adding target_community_id uuid), but did not drop the old signature.
-- PostgREST fails to resolve the call with "iterator method is not callable"
-- whenever both overloads are present and target_community_id is supplied,
-- because it cannot determine which overload to invoke for a scalar-returning
-- function from a JSON request body that contains the extra key.

drop function if exists public.create_sport_event(
  text,             -- target_title
  text,             -- target_event_type
  text,             -- target_sport
  text,             -- target_description
  text,             -- target_cover_url
  timestamptz,      -- target_starts_at
  timestamptz,      -- target_ends_at
  text,             -- target_location_name
  text,             -- target_city
  double precision, -- target_latitude
  double precision, -- target_longitude
  integer,          -- target_max_players
  integer,          -- target_entry_fee_cents
  public.sportz_visibility  -- target_visibility  (no community_id = legacy)
);
