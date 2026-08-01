-- Global event search must use the same event-id-aware visibility helper as
-- direct discovery. The prior RPC predates group and invitation visibility.
do $$
declare
  search_definition text;
  legacy_filter constant text := 'public.can_discover_sport_event(e.organizer_id, e.visibility)';
begin
  select pg_get_functiondef(
    'public.search_content(text,text,integer,integer)'::regprocedure
  ) into search_definition;

  if position(legacy_filter in search_definition) = 0 then
    raise exception 'search_content no longer contains the expected legacy event visibility filter.';
  end if;

  execute replace(
    search_definition,
    legacy_filter,
    'public.can_access_sport_event(e.id)'
  );
end;
$$;
