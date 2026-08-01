-- Normalize rows created while the UI allowed unsupported visibility/scope
-- combinations, then make the scope invariant fully validated.
update public.sport_events
set visibility = 'group'
where community_id is not null
  and visibility not in ('group', 'invite');

update public.sport_events
set visibility = 'invite'
where community_id is null
  and visibility = 'group';

alter table public.sport_events
  validate constraint sport_events_visibility_scope_valid;
